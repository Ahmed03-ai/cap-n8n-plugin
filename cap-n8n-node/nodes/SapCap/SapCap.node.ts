import type {
  IExecuteFunctions,
  IHttpRequestMethods,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  ICredentialDataDecryptedObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

function stripODataMeta(obj: IDataObject): IDataObject {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !k.startsWith('@odata.')),
  );
}

async function fetchOAuth2Token(
  context: IExecuteFunctions,
  credentials: ICredentialDataDecryptedObject,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: credentials.clientId as string,
    client_secret: credentials.clientSecret as string,
  });
  if (credentials.scope) body.set('scope', credentials.scope as string);

  const response = await context.helpers.httpRequest({
    method: 'POST',
    url: credentials.tokenUrl as string,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response?.access_token) {
    throw new Error(`OAuth2 token request succeeded but returned no access_token. Response: ${JSON.stringify(response)}`);
  }
  return response.access_token as string;
}

export class SapCap implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SAP CAP',
    name: 'sapCap',
    icon: 'file:SapCap.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["entitySet"]}}',
    description: 'Interact with SAP CAP OData services',
    defaults: {
      name: 'SAP CAP',
    },
    inputs: ['main'],
    outputs: ['main'],
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
          { name: 'Create', value: 'create', action: 'Create an entity' },
          { name: 'Delete', value: 'delete', action: 'Delete an entity' },
          { name: 'Query', value: 'query', action: 'Query entities' },
          { name: 'Read', value: 'read', action: 'Read a single entity' },
          { name: 'Update', value: 'update', action: 'Update an entity' },
        ],
        default: 'query',
      },
      {
        displayName: 'Service Path',
        name: 'servicePath',
        type: 'string',
        default: '/odata/v4/catalog',
        placeholder: '/odata/v4/catalog',
        description: 'Path to the OData service (e.g. /odata/v4/CatalogService)',
      },
      {
        displayName: 'Entity Set',
        name: 'entitySet',
        type: 'string',
        default: '',
        placeholder: 'Books',
        description: 'Name of the OData entity set',
        required: true,
      },
      // Query options 
      {
        displayName: 'Filter',
        name: 'filter',
        type: 'string',
        default: '',
        placeholder: "title eq 'Dune'",
        description: 'OData $filter expression',
        displayOptions: { show: { operation: ['query'] } },
      },
      {
        displayName: 'Top (Limit)',
        name: 'top',
        type: 'number',
        default: 100,
        description: 'Maximum number of records to return ($top)',
        displayOptions: { show: { operation: ['query'] } },
      },
      {
        displayName: 'Skip',
        name: 'skip',
        type: 'number',
        default: 0,
        description: 'Number of records to skip for pagination ($skip)',
        displayOptions: { show: { operation: ['query'] } },
      },
      {
        displayName: 'Order By',
        name: 'orderBy',
        type: 'string',
        default: '',
        placeholder: 'title asc, stock desc',
        description: 'OData $orderby expression (comma-separated fields with optional asc/desc)',
        displayOptions: { show: { operation: ['query'] } },
      },
      {
        displayName: 'Select Fields',
        name: 'select',
        type: 'string',
        default: '',
        placeholder: 'ID,title,stock',
        description: 'Comma-separated list of fields to return ($select)',
        displayOptions: { show: { operation: ['query'] } },
      },
      // Read / Update / Delete key 
      {
        displayName: 'Entity Key',
        name: 'entityKey',
        type: 'string',
        default: '',
        placeholder: '1 or guid\'550e8400-...\'',
        description: 'Primary key value of the entity',
        displayOptions: { show: { operation: ['read', 'update', 'delete'] } },
        required: true,
      },
      // Create / Update body 
      {
        displayName: 'Body (JSON)',
        name: 'body',
        type: 'json',
        default: '{}',
        description: 'JSON payload for the entity',
        displayOptions: { show: { operation: ['create', 'update'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('sapCapApi');
    const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
    const authType = credentials.authType as string;

    // Build auth headers once. OAuth2 token is fetched once per execution,
    // not once per item, to avoid hammering the token endpoint.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (authType === 'basicAuth') {
      const token = Buffer.from(
        `${credentials.username}:${credentials.password}`,
      ).toString('base64');
      headers['Authorization'] = `Basic ${token}`;
    } else if (authType === 'oauth2') {
      const token = await fetchOAuth2Token(this, credentials);
      headers['Authorization'] = `Bearer ${token}`;
    }

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const servicePath = (this.getNodeParameter('servicePath', i) as string).replace(/\/$/, '');
      const entitySet = this.getNodeParameter('entitySet', i) as string;

      let url = `${baseUrl}${servicePath}/${entitySet}`;
      let method: IHttpRequestMethods = 'GET';
      let bodyStr: string | undefined;

      try {
        if (operation === 'query') {
          const filter = this.getNodeParameter('filter', i, '') as string;
          const top = this.getNodeParameter('top', i, 100) as number;
          const skip = this.getNodeParameter('skip', i, 0) as number;
          const orderBy = this.getNodeParameter('orderBy', i, '') as string;
          const select = this.getNodeParameter('select', i, '') as string;
          const params = new URLSearchParams();
          if (filter) params.set('$filter', filter);
          if (top) params.set('$top', String(top));
          if (skip) params.set('$skip', String(skip));
          if (orderBy) params.set('$orderby', orderBy);
          if (select) params.set('$select', select);
          if (params.toString()) url += `?${params.toString().replace(/\+/g, '%20')}`;

        } else if (operation === 'read') {
          const key = this.getNodeParameter('entityKey', i) as string;
          url += `(${key})`;

        } else if (operation === 'create') {
          method = 'POST';
          bodyStr = this.getNodeParameter('body', i) as string;

        } else if (operation === 'update') {
          method = 'PATCH';
          const key = this.getNodeParameter('entityKey', i) as string;
          url += `(${key})`;
          bodyStr = this.getNodeParameter('body', i) as string;

        } else if (operation === 'delete') {
          method = 'DELETE';
          const key = this.getNodeParameter('entityKey', i) as string;
          url += `(${key})`;
        }

        const response = await this.helpers.httpRequest({
          method,
          url,
          headers,
          body: bodyStr ? JSON.parse(bodyStr) : undefined,
          returnFullResponse: false,
        });

        if (operation === 'query') {
          const records = (response?.value ?? [response]) as IDataObject[];
          returnData.push(...records.map((r) => ({ json: stripODataMeta(r) })));
        } else if (operation === 'delete') {
          returnData.push({ json: { deleted: true, key: this.getNodeParameter('entityKey', i) } });
        } else {
          returnData.push({ json: stripODataMeta(response as IDataObject) });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
      }
    }

    return [returnData];
  }
}
