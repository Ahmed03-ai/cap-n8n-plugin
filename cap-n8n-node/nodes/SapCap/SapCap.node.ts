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
  buildQueryRequest,
  buildReadRequest,
  buildUpdateRequest,
  createSapCapRequestError,
  normalizeMetadataPath,
  parseJsonObjectParameter,
  resolveEntitySetName,
  sapCapApiRequest,
} from './GenericFunctions'
import {
  extractEntityKeyDescriptors,
  extractEntitySetOptions,
  loadEntitySetOptions,
} from './ODataMetadata'
import {
  classifySapCapError,
  normalizeODataItems,
  toContinueOnFailItem,
  toNodeOperationError,
} from './ODataResponse'

type SapCapOperation = 'query' | 'read' | 'create' | 'update' | 'delete'

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
        ],
        default: 'query',
        description: 'CAP OData operation to run.',
      },
      {
        displayName: 'Service Path',
        name: 'servicePath',
        type: 'string',
        default: '/odata/v4/admin',
        required: true,
        placeholder: '/odata/v4/admin',
        description: 'Path to the CAP OData service.',
      },
      {
        displayName: 'Entity Set Source',
        name: 'entitySetSource',
        type: 'options',
        options: [
          {
            name: 'From Metadata',
            value: 'metadata',
          },
          {
            name: 'Manual',
            value: 'manual',
          },
        ],
        default: 'metadata',
        required: true,
        description: 'Choose whether to load entity sets from CAP metadata or enter a name manually.',
      },
      {
        displayName: 'Entity Set',
        name: 'entitySet',
        type: 'options',
        default: '',
        required: true,
        placeholder: 'Select an entity set',
        description: 'Loaded from $metadata using the selected SAP CAP API credential.',
        typeOptions: {
          loadOptionsMethod: 'getEntitySets',
        },
        displayOptions: {
          show: {
            entitySetSource: ['metadata'],
          },
        },
      },
      {
        displayName: 'Entity Set Name',
        name: 'entitySetManual',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Books',
        description: 'Use this when metadata cannot be loaded. Enter only the CAP entity set name, not a path or query string.',
        displayOptions: {
          show: {
            entitySetSource: ['manual'],
          },
        },
      },
      {
        displayName: 'Filter',
        name: 'filter',
        type: 'string',
        default: '',
        placeholder: "title eq 'Dune'",
        description: 'Raw OData $filter expression.',
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
        description: 'Raw OData $orderby expression.',
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
        description: 'Comma-separated field list for OData $select.',
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
        description: 'Maximum number of records to return using $top.',
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
        description: 'Number of records to skip using $skip.',
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
        description: 'Choose metadata-derived key parts or a manual OData key predicate.',
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
        description: 'JSON object containing values for every key part from CAP metadata.',
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
        displayName: 'Body (JSON)',
        name: 'body',
        type: 'json',
        default: '',
        required: true,
        placeholder: '{ "title": "New Book" }',
        description: 'Explicit JSON object sent as the CAP entity payload.',
        displayOptions: {
          show: {
            operation: ['create', 'update'],
          },
        },
      },
    ],
  }

  methods = {
    loadOptions: {
      getEntitySets: loadEntitySetOptions,
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
        const entitySetName = resolveEntitySetName({
          entitySetSource: this.getNodeParameter('entitySetSource', itemIndex) as string,
          entitySet: this.getNodeParameter('entitySet', itemIndex, '') as string,
          entitySetManual: this.getNodeParameter('entitySetManual', itemIndex, '') as string,
        })
        const request = await buildOperationRequest(this, operation, itemIndex, servicePath, entitySetName)
        const response = operation === 'delete'
          ? await executeDeleteRequest(this, request, entitySetName)
          : await sapCapApiRequest(this, {
            ...request,
            responseFormat: 'json',
            errorContext: operation === 'read' ? 'read' : 'odata',
          })

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
  servicePath: string,
  entitySetName: string
) {
  if (operation === 'query') {
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
    return buildCreateRequest({
      servicePath,
      entitySetName,
      body: context.getNodeParameter('body', itemIndex),
    })
  }

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

  return buildDeleteRequest({
    servicePath,
    entitySetName,
    ...keyInput,
  })
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

async function executeDeleteRequest(
  context: IExecuteFunctions,
  request: ReturnType<typeof buildDeleteRequest>,
  entitySetName: string
) {
  await sapCapApiRequest(context, {
    ...request,
    responseFormat: 'text',
    errorContext: 'delete',
  })

  return {
    deleted: true,
    entitySet: entitySetName,
    key: extractKeyFromPath(request.path, entitySetName),
  }
}

function extractKeyFromPath(path: string, entitySetName: string) {
  const marker = `/${entitySetName}`
  const index = path.lastIndexOf(marker)

  return index >= 0 ? path.slice(index + marker.length) : ''
}

function resolveOperation(value: unknown): SapCapOperation {
  if (value === 'query' || value === 'read' || value === 'create' || value === 'update' || value === 'delete') {
    return value
  }

  throw createSapCapRequestError('SAP CAP operation is not supported in this release. Use Query, Read, Create, Update, or Delete.', {
    category: 'validation',
  })
}
