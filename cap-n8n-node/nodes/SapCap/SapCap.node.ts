import type {
  IExecuteFunctions,
  IHttpRequestMethods,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  ICredentialDataDecryptedObject,
  ILoadOptionsFunctions,
  INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

function extractCapMessage(error: Error): string | undefined {
  const anyErr = error as any;

  // Try every known location n8n versions place the response body
  const body =
    anyErr?.response?.data ??
    anyErr?.response?.body ??
    anyErr?.cause?.response?.data ??
    anyErr?.cause?.response?.body ??
    anyErr?.description ??
    null;

  if (body) {
    let parsed = body;
    if (typeof body === 'string') {
      try { parsed = JSON.parse(body); } catch { return body; }
    }
    if (parsed?.error?.message) return parsed.error.message as string;
  }

  // Last resort: extract JSON from the error message string itself
  const jsonMatch = error.message.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) return parsed.error.message as string;
    } catch { /* ignore */ }
  }

  return undefined;
}

const OPERATION_LABELS: Record<string, string> = {
  query: 'Query', read: 'Read', create: 'Create',
  update: 'Update', delete: 'Delete', action: 'Invoke Action/Function',
};

function buildErrorMessage(error: Error, operation: string, url: string): string {
  const raw = error.message;
  const statusMatch = raw.match(/status code (\d+)/i);
  const status = statusMatch ? parseInt(statusMatch[1]) : null;
  const capMsg = extractCapMessage(error);
  const capDetail = capMsg ? ` — "${capMsg}"` : '';
  const opLabel = OPERATION_LABELS[operation] ?? operation;

  switch (status) {
    case 400:
      return `Bad request for ${opLabel}${capDetail}. Check your input parameters.`;
    case 401:
      return `Authentication failed (HTTP 401). Check your username and password in the SAP CAP credential.`;
    case 403:
      return `Access denied (HTTP 403). Your user does not have permission for this operation.${capDetail}`;
    case 404:
      return `Not found (HTTP 404)${capDetail || ` — the resource at ${url} does not exist`}.`;
    case 405:
      return `Operation not allowed (HTTP 405). "${opLabel}" is not supported on this entity set — it may be read-only.`;
    case 409:
      return `Conflict (HTTP 409). The operation conflicts with existing data.${capDetail}`;
    case 500:
      return `CAP service internal error (HTTP 500)${capDetail}. Check the CAP server logs.`;
    case 503:
      return `CAP service unavailable (HTTP 503). The service may be starting up or overloaded.`;
    default:
      return capMsg ? `${raw}${capDetail}` : raw;
  }
}

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
          { name: 'Invoke Action / Function', value: 'action', action: 'Invoke a CAP action or function' },
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
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getEntitySets',
        },
        default: '',
        description: 'Name of the OData entity set. Loaded from the CAP service $metadata.',
        required: true,
        displayOptions: { show: { operation: ['query', 'read', 'create', 'update', 'delete'] } },
      },
      // Action / Function fields
      {
        displayName: 'Action / Function Name',
        name: 'actionName',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getActions',
        },
        default: '',
        description: 'The action or function to invoke. Loaded from the CAP service $metadata.',
        required: true,
        displayOptions: { show: { operation: ['action'] } },
      },
      {
        displayName: 'Is Bound',
        name: 'isBound',
        type: 'boolean',
        default: false,
        description: 'Whether this action is bound to a specific entity instance',
        displayOptions: { show: { operation: ['action'] } },
      },
      {
        displayName: 'Binding Entity Set',
        name: 'bindingEntitySet',
        type: 'string',
        default: '',
        placeholder: 'Books',
        description: 'Entity set the action is bound to (e.g. Books)',
        displayOptions: { show: { operation: ['action'], isBound: [true] } },
        required: true,
      },
      {
        displayName: 'Binding Entity Key',
        name: 'bindingKey',
        type: 'string',
        default: '',
        placeholder: 'ID=201,IsActiveEntity=true',
        description: 'Key of the entity instance to bind to',
        displayOptions: { show: { operation: ['action'], isBound: [true] } },
        required: true,
      },
      {
        displayName: 'Parameters (JSON)',
        name: 'actionParams',
        type: 'json',
        default: '{}',
        description: 'Input parameters for the action or function as a JSON object',
        displayOptions: { show: { operation: ['action'] } },
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

  methods = {
    loadOptions: {
      async getEntitySets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('sapCapApi');
        const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
        const servicePath = ((this.getCurrentNodeParameter('servicePath') as string) ?? '').replace(/\/$/, '');

        const headers: Record<string, string> = { Accept: 'application/xml' };
        if (credentials.authType === 'basicAuth') {
          const token = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
          headers['Authorization'] = `Basic ${token}`;
        }

        let xml: string;
        try {
          xml = await this.helpers.httpRequest({
            method: 'GET',
            url: `${baseUrl}${servicePath}/$metadata`,
            headers,
          }) as string;
        } catch (error) {
          throw new Error(`Failed to fetch $metadata from ${baseUrl}${servicePath}/$metadata — check your Base URL, Service Path and credentials. (${(error as Error).message})`);
        }

        const matches = [...xml.matchAll(/EntitySet[^>]+Name="([^"]+)"/g)];
        if (matches.length === 0) {
          throw new Error('No EntitySets found in $metadata. Make sure the Service Path points to a valid CAP OData service.');
        }

        return matches.map((m) => ({ name: m[1], value: m[1] }));
      },

      async getActions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('sapCapApi');
        const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
        const servicePath = ((this.getCurrentNodeParameter('servicePath') as string) ?? '').replace(/\/$/, '');

        const headers: Record<string, string> = { Accept: 'application/xml' };
        if (credentials.authType === 'basicAuth') {
          const token = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
          headers['Authorization'] = `Basic ${token}`;
        }

        let xml: string;
        try {
          xml = await this.helpers.httpRequest({
            method: 'GET',
            url: `${baseUrl}${servicePath}/$metadata`,
            headers,
          }) as string;
        } catch (error) {
          throw new Error(`Failed to fetch $metadata from ${baseUrl}${servicePath}/$metadata — check your Base URL, Service Path and credentials. (${(error as Error).message})`);
        }

        const options: INodePropertyOptions[] = [];

        for (const m of xml.matchAll(/ActionImport[^>]+Name="([^"]+)"/g)) {
          options.push({ name: `${m[1]} (Action)`, value: `action::${m[1]}` });
        }
        for (const m of xml.matchAll(/FunctionImport[^>]+Name="([^"]+)"/g)) {
          options.push({ name: `${m[1]} (Function)`, value: `function::${m[1]}` });
        }

        if (options.length === 0) {
          throw new Error('No Actions or Functions found in $metadata for this service path.');
        }

        return options;
      },
    },
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
      const entitySet = operation !== 'action' ? this.getNodeParameter('entitySet', i) as string : '';

      let url = `${baseUrl}${servicePath}/${entitySet}`;
      let method: IHttpRequestMethods = 'GET';
      let bodyStr: string | undefined;

      try {
        if (operation === 'action') {
          const actionValue = this.getNodeParameter('actionName', i) as string;
          const [actionType, actionName] = actionValue.split('::');
          const isBound = this.getNodeParameter('isBound', i) as boolean;
          const paramsStr = this.getNodeParameter('actionParams', i, '{}') as string;
          const params = JSON.parse(paramsStr) as IDataObject;

          if (isBound) {
            const bindingEntitySet = this.getNodeParameter('bindingEntitySet', i) as string;
            const bindingKey = this.getNodeParameter('bindingKey', i) as string;
            url = `${baseUrl}${servicePath}/${bindingEntitySet}(${bindingKey})/${actionName}`;
          } else {
            url = `${baseUrl}${servicePath}/${actionName}`;
          }

          if (actionType === 'function') {
            // Functions use GET with parameters in the URL
            const paramStr = Object.entries(params)
              .map(([k, v]) => `${k}=${typeof v === 'string' ? `'${v}'` : v}`)
              .join(',');
            if (paramStr) url += `(${paramStr})`;
            method = 'GET';
          } else {
            // Actions use POST with parameters in the body
            method = 'POST';
            bodyStr = paramsStr;
          }

        } else if (operation === 'query') {
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
        } else if (operation === 'action') {
          const result = response ?? { success: true };
          returnData.push({ json: stripODataMeta(result as IDataObject) });
        } else {
          returnData.push({ json: stripODataMeta(response as IDataObject) });
        }
      } catch (error) {
        const friendlyMessage = buildErrorMessage(error as Error, operation, url);
        if (this.continueOnFail()) {
          returnData.push({ json: { error: friendlyMessage }, pairedItem: i });
          continue;
        }
        throw new NodeOperationError(this.getNode(), friendlyMessage, { itemIndex: i });
      }
    }

    return [returnData];
  }
}
