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
  buildAuthenticationHeaders,
  buildQueryRequest,
  buildReadRequest,
  createSapCapRequestError,
  normalizeBaseUrl,
  normalizeMetadataPath,
  resolveEntitySetName,
  sapCapApiRequest,
} from './GenericFunctions'
import { loadEntitySetOptions } from './ODataMetadata'
import {
  classifySapCapError,
  normalizeODataItems,
  toContinueOnFailItem,
  toNodeOperationError,
} from './ODataResponse'

type Phase6Operation = 'query' | 'read'

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
        displayName: 'Key Predicate',
        name: 'keyPredicate',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'ID=201,IsActiveEntity=true',
        description: 'OData key predicate. Parentheses are optional; examples: ID=201 or ID=201,IsActiveEntity=true.',
        displayOptions: {
          show: {
            operation: ['read'],
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

        const url = `${normalizeBaseUrl(credentials.baseUrl)}${normalizeMetadataPath(credentials.metadataPath)}`
        const headers = await buildAuthenticationHeaders(
          async options => this.helpers.request(options),
          credentials
        )

        await this.helpers.request({
          method: 'GET',
          url,
          headers,
        })

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
      let operation: Phase6Operation = 'query'

      try {
        operation = resolveOperation(this.getNodeParameter('operation', itemIndex))
        const servicePath = this.getNodeParameter('servicePath', itemIndex) as string
        const entitySetName = resolveEntitySetName({
          entitySetSource: this.getNodeParameter('entitySetSource', itemIndex) as string,
          entitySet: this.getNodeParameter('entitySet', itemIndex, '') as string,
          entitySetManual: this.getNodeParameter('entitySetManual', itemIndex, '') as string,
        })
        const request = operation === 'read'
          ? buildReadRequest({
            servicePath,
            entitySetName,
            keyPredicate: this.getNodeParameter('keyPredicate', itemIndex) as string,
          })
          : buildQueryRequest({
            servicePath,
            entitySetName,
            filter: this.getNodeParameter('filter', itemIndex, '') as string,
            orderBy: this.getNodeParameter('orderBy', itemIndex, '') as string,
            select: this.getNodeParameter('select', itemIndex, '') as string,
            top: this.getNodeParameter('top', itemIndex, 100) as number,
            skip: this.getNodeParameter('skip', itemIndex, 0) as number,
          })

        const response = await sapCapApiRequest(this, {
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

function resolveOperation(value: unknown): Phase6Operation {
  if (value === 'query' || value === 'read') {
    return value
  }

  throw createSapCapRequestError('SAP CAP operation is not supported in this release. Use Query or Read.', {
    category: 'validation',
  })
}
