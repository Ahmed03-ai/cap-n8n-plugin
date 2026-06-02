import {
  IDataObject,
  ICredentialDataDecryptedObject,
  IExecuteFunctions,
  IHttpRequestMethods,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionTypes,
  NodeOperationError,
} from 'n8n-workflow'

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '')
}

function stripODataMetadata(value: IDataObject): IDataObject {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !key.startsWith('@odata.'))
  )
}

function normalizeEntityKey(rawKey: string) {
  const key = rawKey.trim()
  if (!key) {
    throw new Error('Entity Key is required for this operation.')
  }

  return key.startsWith('(') && key.endsWith(')') ? key : `(${key})`
}

function parseJsonBody(body: string) {
  try {
    return JSON.parse(body || '{}')
  } catch (err) {
    throw new Error('Body must be valid JSON.')
  }
}

async function fetchOAuth2Token(
  context: IExecuteFunctions,
  credentials: ICredentialDataDecryptedObject
) {
  const tokenUrl = credentials.tokenUrl as string
  if (!tokenUrl) {
    throw new Error('Token URL is required for OAuth2 Client Credentials authentication.')
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: credentials.clientId as string,
    client_secret: credentials.clientSecret as string,
  })

  if (credentials.scope) {
    body.set('scope', credentials.scope as string)
  }

  const response = await context.helpers.httpRequest({
    method: 'POST',
    url: tokenUrl,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response?.access_token) {
    throw new Error('OAuth2 token request succeeded but returned no access_token.')
  }

  return response.access_token as string
}

async function createAuthHeaders(
  context: IExecuteFunctions,
  credentials: ICredentialDataDecryptedObject
) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const authType = credentials.authType as string

  if (authType === 'basicAuth') {
    const token = Buffer.from(
      `${credentials.username || ''}:${credentials.password || ''}`
    ).toString('base64')
    headers.Authorization = `Basic ${token}`
  }

  if (authType === 'oauth2') {
    const token = await fetchOAuth2Token(context, credentials)
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

function normalizeODataResponse(operation: string, response: IDataObject | undefined, key?: string) {
  if (operation === 'delete') {
    return [{ json: { deleted: true, key } }]
  }

  if (!response) {
    return [{ json: {} }]
  }

  const value = response.value
  if (Array.isArray(value)) {
    return value.map((record) => ({
      json: stripODataMetadata(record as IDataObject),
    }))
  }

  return [{ json: stripODataMetadata(response) }]
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
            name: 'Create',
            value: 'create',
            description: 'Create a CAP entity',
            action: 'Create a CAP entity',
          },
          {
            name: 'Delete',
            value: 'delete',
            description: 'Delete a CAP entity by key',
            action: 'Delete a CAP entity',
          },
          {
            name: 'Query',
            value: 'query',
            description: 'Retrieve a filtered, sorted, or paged collection of CAP entities',
            action: 'Query CAP entities',
          },
          {
            name: 'Read',
            value: 'read',
            description: 'Retrieve one CAP entity by key',
            action: 'Read a CAP entity',
          },
          {
            name: 'Update',
            value: 'update',
            description: 'Update a CAP entity by key',
            action: 'Update a CAP entity',
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
        placeholder: '/odata/v4/admin',
        description: 'Path to the CAP OData service.',
      },
      {
        displayName: 'Entity Set',
        name: 'entitySet',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'Books',
        description: 'CAP OData entity set name.',
      },
      {
        displayName: 'Filter',
        name: 'filter',
        type: 'string',
        default: '',
        placeholder: "title eq 'Dune'",
        description: 'OData $filter expression.',
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
        displayName: 'Order By',
        name: 'orderBy',
        type: 'string',
        default: '',
        placeholder: 'title asc, stock desc',
        description: 'OData $orderby expression.',
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
        displayName: 'Entity Key',
        name: 'entityKey',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'ID=201,IsActiveEntity=true',
        description: 'OData key predicate, for example ID=201,IsActiveEntity=true.',
        displayOptions: {
          show: {
            operation: ['read', 'update', 'delete'],
          },
        },
      },
      {
        displayName: 'Body',
        name: 'body',
        type: 'json',
        default: '{}',
        description: 'JSON request body for Create or Update.',
        displayOptions: {
          show: {
            operation: ['create', 'update'],
          },
        },
      },
    ],
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData()
    const returnData: INodeExecutionData[] = []
    const credentials = await this.getCredentials('sapCapApi')
    const baseUrl = trimTrailingSlash(credentials.baseUrl as string)
    const headers = await createAuthHeaders(this, credentials)

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string
        const servicePath = trimTrailingSlash(this.getNodeParameter('servicePath', itemIndex) as string)
        const entitySet = this.getNodeParameter('entitySet', itemIndex) as string
        const entityKey = operation === 'query' || operation === 'create'
          ? undefined
          : this.getNodeParameter('entityKey', itemIndex) as string
        const keyPredicate = entityKey ? normalizeEntityKey(entityKey) : undefined
        let method: IHttpRequestMethods = 'GET'
        let url = `${baseUrl}${servicePath}/${entitySet}`
        let body: IDataObject | undefined

        if (keyPredicate) {
          url += keyPredicate
        }

        if (operation === 'query') {
          const params = new URLSearchParams()
          const filter = this.getNodeParameter('filter', itemIndex, '') as string
          const top = this.getNodeParameter('top', itemIndex, 100) as number
          const skip = this.getNodeParameter('skip', itemIndex, 0) as number
          const orderBy = this.getNodeParameter('orderBy', itemIndex, '') as string
          const select = this.getNodeParameter('select', itemIndex, '') as string

          if (filter) params.set('$filter', filter)
          if (top) params.set('$top', String(top))
          if (skip) params.set('$skip', String(skip))
          if (orderBy) params.set('$orderby', orderBy)
          if (select) params.set('$select', select)

          const query = params.toString().replace(/\+/g, '%20')
          if (query) url += `?${query}`
        }

        if (operation === 'create') {
          method = 'POST'
          body = parseJsonBody(this.getNodeParameter('body', itemIndex) as string)
        }

        if (operation === 'update') {
          method = 'PATCH'
          body = parseJsonBody(this.getNodeParameter('body', itemIndex) as string)
        }

        if (operation === 'delete') {
          method = 'DELETE'
        }

        const response = await this.helpers.httpRequest({
          method,
          url,
          headers,
          body,
        }) as IDataObject | undefined

        returnData.push(...normalizeODataResponse(operation, response, entityKey))
      } catch (err) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: err instanceof Error ? err.message : String(err),
            },
            pairedItem: {
              item: itemIndex,
            },
          })
          continue
        }

        throw new NodeOperationError(this.getNode(), err as Error, {
          itemIndex,
        })
      }
    }

    return [returnData]
  }
}
