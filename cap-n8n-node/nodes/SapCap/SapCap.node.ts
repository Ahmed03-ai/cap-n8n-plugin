import {
  ICredentialDataDecryptedObject,
  ICredentialsDecrypted,
  ICredentialTestFunctions,
  IExecuteFunctions,
  INodeExecutionData,
  INodeCredentialTestResult,
  INodeType,
  INodeTypeDescription,
  NodeConnectionTypes,
} from 'n8n-workflow'

import {
  buildCreateRequest,
  buildDeleteRequest,
  buildActionFunctionRequest,
  buildQueryRequest,
  buildReadRequest,
  buildUpdateRequest,
  createSapCapRequestError,
  isActionFunctionRequestBound,
  normalizeMetadataPath,
  parseJsonObjectParameter,
  resolveActionFunctionEntitySet,
  resolveEntitySetName,
  sapCapApiRequest,
} from './GenericFunctions'
import {
  extractEntityKeyDescriptors,
  extractEntitySetOptions,
  loadActionFunctionOptions,
  loadEntitySetOptions,
  searchActionFunctions,
  searchEntitySets,
} from './ODataMetadata'
import {
  classifySapCapError,
  normalizeODataItems,
  toContinueOnFailItem,
  toNodeOperationError,
} from './ODataResponse'

type SapCapOperation = 'query' | 'read' | 'create' | 'update' | 'delete' | 'actionFunction'

// A bound action/function (from-list value prefixed `bound::`) is invoked against a
// keyed entity, so it needs an entity key. n8n unwraps the resourceLocator's `__rl`
// value when a bare `actionFunction` key is matched, and this rule depends only on
// `operation` + `actionFunction` (both always resolvable) — using `hide` or referencing
// a conditionally-shown field would stop n8n applying the fields' defaults.
const SHOW_FOR_BOUND_ACTION_FUNCTION = {
  operation: ['actionFunction'],
  actionFunction: [{ _cnd: { regex: '^bound::' } }],
}

// A value with no binding prefix and at least one character is a manually typed
// ("By Name") operation, where the user must still pick the kind and binding. From-list
// values always carry a `bound::` / `unbound::` prefix, so they never match.
const SHOW_FOR_MANUAL_ACTION_FUNCTION = {
  operation: ['actionFunction'],
  actionFunction: [{ _cnd: { regex: '^(?!bound::)(?!unbound::).+' } }],
}

export class SapCap implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SAP CAP',
    name: 'sapCap',
    icon: 'file:sapCap.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Connect to SAP CAP OData services',
    defaults: {
      name: 'SAP CAP',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [
      {
        name: 'sapCapApi',
        required: true,
        testedBy: 'sapCapApiCredentialTest',
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Query',
            value: 'query',
            description: 'Retrieve a filtered, sorted, or paged collection of CAP entities.',
            action: 'Query CAP entities',
          },
          {
            name: 'Read',
            value: 'read',
            description: 'Retrieve one CAP entity by key predicate.',
            action: 'Read a CAP entity',
          },
          {
            name: 'Create',
            value: 'create',
            description: 'Create one CAP entity from an explicit JSON Body.',
            action: 'Create a CAP entity',
          },
          {
            name: 'Update',
            value: 'update',
            description: 'Patch one CAP entity by key using an explicit JSON Body.',
            action: 'Update a CAP entity',
          },
          {
            name: 'Delete',
            value: 'delete',
            description: 'Delete one CAP entity by key.',
            action: 'Delete a CAP entity',
          },
          {
            name: 'Action/Function',
            value: 'actionFunction',
            description: 'Invoke a CAP action or function using metadata or manual operation details.',
            action: 'Invoke a CAP action or function',
          },
        ],
        default: 'query',
        description: 'CAP OData operation to run',
      },
      {
        displayName: 'Service Path',
        name: 'servicePath',
        type: 'string',
        default: '/odata/v4/admin',
        required: true,
        placeholder: '/odata/v4/admin',
        description: 'Path to the CAP OData service',
      },
      {
        displayName: 'Entity Set',
        name: 'entitySet',
        type: 'resourceLocator',
        default: { mode: 'list', value: '' },
        required: true,
        description: 'CAP entity set. Pick it from $metadata, or switch to By Name to type it when metadata cannot be loaded.',
        modes: [
          {
            displayName: 'From List',
            name: 'list',
            type: 'list',
            typeOptions: {
              searchListMethod: 'searchEntitySets',
              searchable: true,
            },
          },
          {
            displayName: 'By Name',
            name: 'name',
            type: 'string',
            placeholder: 'Books',
            hint: 'Enter only the CAP entity set name, not a path or query string.',
          },
        ],
        // A resourceLocator does not initialize its default when it carries a `hide`
        // rule, so use `show`. Action/Function does not need the picker: bound operations
        // take their entity set from the selected action's metadata.
        displayOptions: {
          show: {
            operation: ['query', 'read', 'create', 'update', 'delete'],
          },
        },
      },
      {
        displayName: 'Action/Function',
        name: 'actionFunction',
        type: 'resourceLocator',
        default: { mode: 'list', value: '' },
        required: true,
        description: 'CAP action or function. From List reads $metadata (binding detected automatically); By Name lets you type one when metadata cannot be loaded.',
        modes: [
          {
            displayName: 'From List',
            name: 'list',
            type: 'list',
            typeOptions: {
              searchListMethod: 'searchActionFunctions',
              searchable: true,
            },
          },
          {
            displayName: 'By Name',
            name: 'name',
            type: 'string',
            placeholder: 'submitOrder',
            hint: 'Qualified name such as CatalogService.restock for bound operations when required.',
          },
        ],
        displayOptions: {
          show: {
            operation: ['actionFunction'],
          },
        },
      },
      {
        displayName: 'Operation Kind',
        name: 'actionFunctionKind',
        type: 'options',
        options: [
          {
            name: 'Action',
            value: 'action',
          },
          {
            name: 'Function',
            value: 'function',
          },
        ],
        default: 'action',
        required: true,
        description: 'Whether the typed operation is an action (POST) or a function (GET). Detected automatically when picked From List.',
        displayOptions: {
          show: SHOW_FOR_MANUAL_ACTION_FUNCTION,
        },
      },
      {
        displayName: 'Operation Binding',
        name: 'actionFunctionBinding',
        type: 'options',
        options: [
          {
            name: 'Unbound',
            value: 'unbound',
          },
          {
            name: 'Bound to Entity',
            value: 'bound',
          },
        ],
        default: 'unbound',
        required: true,
        description: 'Whether the typed action/function is invoked at the service root or against a keyed entity. Detected automatically when picked From List.',
        displayOptions: {
          show: SHOW_FOR_MANUAL_ACTION_FUNCTION,
        },
      },
      {
        displayName: 'Filter',
        name: 'filter',
        type: 'string',
        default: '',
        placeholder: "title eq 'Dune'",
        description: 'Raw OData $filter expression',
        displayOptions: {
          show: {
            operation: ['query'],
          },
        },
      },
      {
        displayName: 'Order By',
        name: 'orderBy',
        type: 'string',
        default: '',
        placeholder: 'title asc, stock desc',
        description: 'Raw OData $orderby expression',
        displayOptions: {
          show: {
            operation: ['query'],
          },
        },
      },
      {
        displayName: 'Select Fields',
        name: 'select',
        type: 'string',
        default: '',
        placeholder: 'ID,title,stock',
        description: 'Comma-separated field list for OData $select',
        displayOptions: {
          show: {
            operation: ['query'],
          },
        },
      },
      {
        displayName: 'Top',
        name: 'top',
        type: 'number',
        default: 100,
        description: 'Maximum number of records to return using $top',
        displayOptions: {
          show: {
            operation: ['query'],
          },
        },
      },
      {
        displayName: 'Skip',
        name: 'skip',
        type: 'number',
        default: 0,
        description: 'Number of records to skip using $skip',
        displayOptions: {
          show: {
            operation: ['query'],
          },
        },
      },
      {
        displayName: 'Key Input',
        name: 'keyInputMode',
        type: 'options',
        options: [
          {
            name: 'Metadata Key Parts',
            value: 'metadata',
          },
          {
            name: 'Manual Key Predicate',
            value: 'manual',
          },
        ],
        default: 'manual',
        required: true,
        description: 'Choose metadata-derived key parts or a manual OData key predicate',
        displayOptions: {
          show: {
            operation: ['read', 'update', 'delete'],
          },
        },
      },
      {
        displayName: 'Key Parts (JSON)',
        name: 'keyParts',
        type: 'json',
        default: '',
        required: true,
        placeholder: '{ "ID": 201, "IsActiveEntity": true }',
        description: 'JSON object containing values for every key part from CAP metadata',
        displayOptions: {
          show: {
            operation: ['read', 'update', 'delete'],
            keyInputMode: ['metadata'],
          },
        },
      },
      {
        displayName: 'Key Predicate',
        name: 'keyPredicate',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'ID=201,IsActiveEntity=true',
        description: 'OData key predicate. Parentheses are optional; examples: ID=201 or ID=201,IsActiveEntity=true.',
        displayOptions: {
          show: {
            operation: ['read', 'update', 'delete'],
            keyInputMode: ['manual'],
          },
        },
      },
      {
        displayName: 'Entity Key',
        name: 'actionFunctionKey',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'ID=201',
        description: 'Key predicate of the entity the bound action/function targets, for example ID=201. Only bound operations need this.',
        displayOptions: {
          show: SHOW_FOR_BOUND_ACTION_FUNCTION,
        },
      },
      {
        displayName: 'Body (JSON)',
        name: 'body',
        type: 'json',
        default: '',
        required: true,
        placeholder: '{ "title": "New Book" }',
        description: 'Explicit JSON object sent as the CAP entity payload',
        displayOptions: {
          show: {
            operation: ['create', 'update'],
          },
        },
      },
      {
        displayName: 'Parameters (JSON)',
        name: 'parameters',
        type: 'json',
        default: '{}',
        required: true,
        placeholder: '{ "book": 201, "quantity": 1 }',
        description: 'Explicit JSON object sent as action parameters or encoded into OData function-call parameters',
        displayOptions: {
          show: {
            operation: ['actionFunction'],
          },
        },
      },
    ],
  }

  methods = {
    loadOptions: {
      getEntitySets: loadEntitySetOptions,
      getActionFunctions: loadActionFunctionOptions,
    },
    listSearch: {
      searchEntitySets,
      searchActionFunctions,
    },
    credentialTest: {
      async sapCapApiCredentialTest(
        this: ICredentialTestFunctions,
        credential: ICredentialsDecrypted<ICredentialDataDecryptedObject>
      ): Promise<INodeCredentialTestResult> {
        const credentials = credential.data

        if (!credentials) {
          throw createSapCapRequestError('SAP CAP credential data is required for Test Connection.', {
            category: 'configuration',
          })
        }

        const metadataXml = await sapCapApiRequest({
          getCredentials: async () => credentials,
          helpers: {
            httpRequest: async options => this.helpers.request(options),
          },
        }, {
          method: 'GET',
          path: normalizeMetadataPath(credentials.metadataPath),
          responseFormat: 'text',
          errorContext: 'metadata',
        }) as string

        extractEntitySetOptions(metadataXml)

        return {
          status: 'OK',
          message: 'Connection successful',
        }
      },
    },
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData()
    const returnData: INodeExecutionData[] = []

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      let operation: SapCapOperation = 'query'

      try {
        operation = resolveOperation(this.getNodeParameter('operation', itemIndex))
        const servicePath = this.getNodeParameter('servicePath', itemIndex) as string
        const request = await buildOperationRequest(this, operation, itemIndex, servicePath)
        const response = await executeOperationRequest(this, operation, request)

        returnData.push(...normalizeODataItems(operation, response, itemIndex))
      } catch (err) {
        const safeError = classifySapCapError(err, { operation })

        if (this.continueOnFail()) {
          returnData.push(toContinueOnFailItem(safeError, itemIndex))
          continue
        }

        throw toNodeOperationError(this.getNode(), safeError, itemIndex)
      }
    }

    return [returnData]
  }
}

async function buildOperationRequest(
  context: IExecuteFunctions,
  operation: SapCapOperation,
  itemIndex: number,
  servicePath: string
) {
  if (operation === 'query') {
    const entitySetName = resolveEntitySetParameter(context, itemIndex)

    return buildQueryRequest({
      servicePath,
      entitySetName,
      filter: context.getNodeParameter('filter', itemIndex, '') as string,
      orderBy: context.getNodeParameter('orderBy', itemIndex, '') as string,
      select: context.getNodeParameter('select', itemIndex, '') as string,
      top: context.getNodeParameter('top', itemIndex, 100) as number,
      skip: context.getNodeParameter('skip', itemIndex, 0) as number,
    })
  }

  if (operation === 'create') {
    const entitySetName = resolveEntitySetParameter(context, itemIndex)

    return buildCreateRequest({
      servicePath,
      entitySetName,
      body: context.getNodeParameter('body', itemIndex),
    })
  }

  if (operation === 'actionFunction') {
    const actionFunction = readResourceLocator(context.getNodeParameter('actionFunction', itemIndex, ''))
    const operationSource = actionFunction.mode === 'name' ? 'manual' : 'metadata'
    const actionFunctionInput = {
      servicePath,
      operationSource,
      operationDescriptor: operationSource === 'metadata' ? actionFunction.value : '',
      operationKind: context.getNodeParameter('actionFunctionKind', itemIndex, 'action'),
      operationName: operationSource === 'manual' ? actionFunction.value : '',
      operationBinding: context.getNodeParameter('actionFunctionBinding', itemIndex, 'unbound'),
      parameters: context.getNodeParameter('parameters', itemIndex),
    }
    const actionFunctionEntitySetName = isActionFunctionRequestBound(actionFunctionInput)
      ? resolveActionFunctionEntitySet(actionFunctionInput) ?? resolveEntitySetParameter(context, itemIndex)
      : undefined
    const keyInput = actionFunctionEntitySetName
      ? { keyPredicate: context.getNodeParameter('actionFunctionKey', itemIndex, '') as string }
      : {}

    return buildActionFunctionRequest({
      ...actionFunctionInput,
      ...(actionFunctionEntitySetName ? { entitySetName: actionFunctionEntitySetName } : {}),
      ...keyInput,
    })
  }

  const entitySetName = resolveEntitySetParameter(context, itemIndex)
  const keyInput = await resolveKeyInput(context, itemIndex, entitySetName)

  if (operation === 'read') {
    return buildReadRequest({
      servicePath,
      entitySetName,
      ...keyInput,
    })
  }

  if (operation === 'update') {
    return buildUpdateRequest({
      servicePath,
      entitySetName,
      ...keyInput,
      body: context.getNodeParameter('body', itemIndex),
    })
  }

  if (operation === 'delete') {
    return buildDeleteRequest({
      servicePath,
      entitySetName,
      ...keyInput,
    })
  }

  throw createSapCapRequestError('SAP CAP operation is not supported in this release. Use Query, Read, Create, Update, Delete, or Action/Function.', {
    category: 'validation',
  })
}

function resolveEntitySetParameter(context: IExecuteFunctions, itemIndex: number) {
  return resolveEntitySetName({
    entitySet: readResourceLocator(context.getNodeParameter('entitySet', itemIndex, '')).value,
  })
}

// A resourceLocator value is `{ mode, value }` in n8n; manual/By-Name selections may
// also arrive as a plain string. Normalize both so callers just read mode and value.
function readResourceLocator(raw: unknown): { mode: string | undefined, value: string } {
  if (raw && typeof raw === 'object') {
    const locator = raw as { mode?: unknown, value?: unknown }

    return {
      mode: typeof locator.mode === 'string' ? locator.mode : undefined,
      value: locator.value === undefined || locator.value === null ? '' : String(locator.value),
    }
  }

  return {
    mode: undefined,
    value: typeof raw === 'string' ? raw : '',
  }
}

async function resolveKeyInput(
  context: IExecuteFunctions,
  itemIndex: number,
  entitySetName: string
) {
  const keyInputMode = context.getNodeParameter('keyInputMode', itemIndex, 'manual')

  if (keyInputMode === 'manual') {
    return {
      keyPredicate: context.getNodeParameter('keyPredicate', itemIndex) as string,
    }
  }

  if (keyInputMode !== 'metadata') {
    throw createSapCapRequestError('Key Input must use Metadata Key Parts or Manual Key Predicate.', {
      category: 'validation',
    })
  }

  const credentials = await context.getCredentials('sapCapApi')
  const metadataXml = await sapCapApiRequest(context, {
    method: 'GET',
    path: normalizeMetadataPath(credentials.metadataPath),
    responseFormat: 'text',
    errorContext: 'metadata',
  }) as string
  const keyDescriptors = extractEntityKeyDescriptors(metadataXml, entitySetName)

  if (keyDescriptors.length === 0) {
    const fallbackPredicate = context.getNodeParameter('keyPredicate', itemIndex, '') as string

    if (fallbackPredicate.trim()) {
      return {
        keyPredicate: fallbackPredicate,
      }
    }

    throw createSapCapRequestError(
      'Metadata key descriptors were not found for the selected entity set. Use Manual Key Predicate.',
      { category: 'validation' }
    )
  }

  return {
    keyDescriptors,
    keyParts: parseJsonObjectParameter(context.getNodeParameter('keyParts', itemIndex), 'Key Parts'),
  }
}

async function executeOperationRequest(
  context: IExecuteFunctions,
  operation: SapCapOperation,
  request: ReturnType<typeof buildOperationRequest> extends Promise<infer T> ? T : never
) {
  if (operation === 'delete') {
    return executeDeleteRequest(context, request as ReturnType<typeof buildDeleteRequest>)
  }

  if (operation === 'update') {
    return executeUpdateRequest(context, request as ReturnType<typeof buildUpdateRequest>)
  }

  return sapCapApiRequest(context, {
    ...request,
    responseFormat: 'json',
    errorContext: operation === 'read'
      ? 'read'
      : operation === 'actionFunction'
        ? 'actionFunction'
        : 'odata',
  })
}

async function executeUpdateRequest(
  context: IExecuteFunctions,
  request: ReturnType<typeof buildUpdateRequest>
) {
  const response = await sapCapApiRequest(context, {
    ...request,
    responseFormat: 'json',
    errorContext: 'odata',
  })

  if (response !== undefined) return response

  return sapCapApiRequest(context, {
    method: 'GET',
    path: request.path,
    responseFormat: 'json',
    errorContext: 'read',
  })
}

async function executeDeleteRequest(
  context: IExecuteFunctions,
  request: ReturnType<typeof buildDeleteRequest>
) {
  await sapCapApiRequest(context, {
    ...request,
    responseFormat: 'text',
    errorContext: 'delete',
  })

  return {
    deleted: true,
    entitySet: extractEntitySetFromPath(request.path),
    key: extractKeyFromPath(request.path),
  }
}

function extractEntitySetFromPath(path: string) {
  const match = /\/([A-Za-z_][A-Za-z0-9_]*)\(/.exec(path)

  return match?.[1] ?? ''
}

function extractKeyFromPath(path: string) {
  const match = /\/[A-Za-z_][A-Za-z0-9_]*(\([^/]+\))/.exec(path)

  return match?.[1] ?? ''
}

function resolveOperation(value: unknown): SapCapOperation {
  if (value === 'query' ||
    value === 'read' ||
    value === 'create' ||
    value === 'update' ||
    value === 'delete' ||
    value === 'actionFunction'
  ) {
    return value
  }

  throw createSapCapRequestError('SAP CAP operation is not supported in this release. Use Query, Read, Create, Update, Delete, or Action/Function.', {
    category: 'validation',
  })
}
