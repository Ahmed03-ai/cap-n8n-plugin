# Phase 07: n8n Mutations and CAP Actions/Functions - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 11 likely modified files, plus CAP fixture and package-script references
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `cap-n8n-node/nodes/SapCap/SapCap.node.ts` | n8n node component/controller | request-response + transform | `cap-n8n-node/nodes/SapCap/SapCap.node.ts` | exact |
| `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` | utility/service client | request-response + transform | `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` | exact |
| `cap-n8n-node/nodes/SapCap/ODataMetadata.ts` | utility/metadata parser | request-response + transform | `cap-n8n-node/nodes/SapCap/ODataMetadata.ts` | role-match |
| `cap-n8n-node/nodes/SapCap/ODataResponse.ts` | utility/response adapter | transform + request-response errors | `cap-n8n-node/nodes/SapCap/ODataResponse.ts` | exact |
| `test/integration/n8n-node-read-operations.test.js` | integration test | request-response | `test/integration/n8n-node-read-operations.test.js` | exact |
| `test/integration/n8n-node-metadata-discovery.test.js` | integration test | request-response + transform | `test/integration/n8n-node-metadata-discovery.test.js` | exact |
| `test/integration/n8n-node-response-cleanup.test.js` | integration test | transform + error handling | `test/integration/n8n-node-response-cleanup.test.js` | exact |
| `test/smoke/package-boundaries.test.js` | smoke test | batch/build metadata | `test/smoke/package-boundaries.test.js` | exact |
| `README.md` | documentation | reader workflow + verification | `README.md` | exact |
| `docs/manual-visual-showcase.md` | documentation/runbook | manual workflow | `docs/manual-visual-showcase.md` | exact |
| `mockups/n8n-node-mockup.html` | documentation/mockup component | static UI contract | `mockups/n8n-node-mockup.html`; Phase 6 mockup pattern | docs-match |

## Pattern Assignments

### `cap-n8n-node/nodes/SapCap/SapCap.node.ts` (n8n node component/controller, request-response + transform)

**Analog:** `cap-n8n-node/nodes/SapCap/SapCap.node.ts`

**Imports pattern** (lines 1-27):
```typescript
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
  buildQueryRequest,
  buildReadRequest,
  createSapCapRequestError,
  normalizeMetadataPath,
  resolveEntitySetName,
  sapCapApiRequest,
} from './GenericFunctions'
import { extractEntitySetOptions, loadEntitySetOptions } from './ODataMetadata'
import {
  classifySapCapError,
  normalizeODataItems,
  toContinueOnFailItem,
  toNodeOperationError,
} from './ODataResponse'
```

**Operation selector pattern** (lines 53-75):
```typescript
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
```

**Apply in Phase 7:** expand this same options structure to include `create`, `update`, `delete`, and one combined `Action/Function` mode. Prefer one combined value such as `actionFunction`; do not expose separate `action` and `function` modes unless the planner explicitly justifies that against D-13.

**Metadata/manual entity set UI pattern** (lines 85-133):
```typescript
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
```

**Apply in Phase 7:** copy this metadata/manual fallback shape for operation selection if action/function metadata cannot load. Reuse `displayOptions.show` for mutation-only Body, key, and Parameters fields.

**Manual key predicate pattern** (lines 197-210):
```typescript
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
```

**Apply in Phase 7:** keep this as the reliable fallback for Read, Update, Delete, and bound Action/Function operations. Add metadata-derived key fields only as an augmentation when metadata can provide all key parts.

**Load options and credential test pattern** (lines 214-244):
```typescript
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
```

**Apply in Phase 7:** add load-options methods for operation descriptors and, if the planner chooses, metadata-derived key descriptors. Keep credential tests as metadata validation, not as mutation/action execution.

**Execute loop and error boundary pattern** (lines 253-299):
```typescript
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
```

**Apply in Phase 7:** preserve the per-item loop and single catch. Route Create/Update/Delete/ActionFunction through request builders and response helpers instead of adding raw HTTP branches inside the node class.

---

### `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` (utility/service client, request-response + transform)

**Analog:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts`

**Type/input pattern** (lines 1-43):
```typescript
import {
  ICredentialDataDecryptedObject,
  IDataObject,
  IHttpRequestMethods,
  IHttpRequestOptions,
} from 'n8n-workflow'

type SapCapRequestContext = {
  getCredentials(type: string): Promise<ICredentialDataDecryptedObject>
  helpers: {
    httpRequest(options: IHttpRequestOptions): Promise<unknown>
  }
}

type EntitySetSelection = {
  entitySetSource?: string
  entitySet?: string
  entitySetManual?: string
}
```

**Apply in Phase 7:** add narrow input types for Create, Update, Delete, key parts, and Action/Function invocation. Keep these as local type aliases unless they must be imported elsewhere.

**Validation and manual key fallback pattern** (lines 90-134):
```typescript
export function normalizeMetadataPath(value: unknown = metadataPathDefault) {
  const path = requireString(value, 'Metadata Path must start with /.')

  if (!path.startsWith('/') || path.includes('?') || path.includes('#')) {
    throw createSapCapRequestError('Metadata Path must start with /.', {
      category: 'validation',
    })
  }

  return path
}

export function normalizeServicePath(value: unknown) {
  const path = requireString(value, 'Service Path must start with / and must not include query strings.')

  if (!path.startsWith('/') || path.includes('?') || path.includes('#')) {
    throw createSapCapRequestError('Service Path must start with / and must not include query strings.', {
      category: 'validation',
    })
  }

  return path.replace(/\/+$/, '') || '/'
}

export function normalizeKeyPredicate(value: unknown) {
  const keyPredicate = requireString(value, 'Key Predicate is required for Read.')

  if (containsUrlBoundary(keyPredicate)) {
    throw createSapCapRequestError('Key Predicate must not include /, \\, ?, or #.', {
      category: 'validation',
    })
  }

  return keyPredicate.startsWith('(') && keyPredicate.endsWith(')')
    ? keyPredicate
    : `(${keyPredicate})`
}
```

**Apply in Phase 7:** keep manual key predicate sanitization as fallback. Add metadata-derived key construction beside it, not instead of it, and reuse `createSapCapRequestError(..., { category: 'validation' })` for missing/invalid key parts.

**Query/Read request builder pattern** (lines 136-164):
```typescript
export function buildQueryRequest(input: QueryRequestInput) {
  const servicePath = normalizeServicePath(input.servicePath)
  const entitySetName = normalizeEntitySetName(input.entitySetName)
  const params = new URLSearchParams()

  setTextQueryParam(params, '$filter', input.filter)
  setTextQueryParam(params, '$orderby', input.orderBy)
  setTextQueryParam(params, '$select', input.select)
  setIntegerQueryParam(params, '$top', input.top, 'Top must be a nonnegative integer.')
  setIntegerQueryParam(params, '$skip', input.skip, 'Skip must be a nonnegative integer.')

  const query = params.toString().replace(/\+/g, '%20')

  return {
    method: 'GET' as IHttpRequestMethods,
    path: `${servicePath}/${entitySetName}${query ? `?${query}` : ''}`,
  }
}

export function buildReadRequest(input: ReadRequestInput) {
  const servicePath = normalizeServicePath(input.servicePath)
  const entitySetName = normalizeEntitySetName(input.entitySetName)
  const keyPredicate = normalizeKeyPredicate(input.keyPredicate)

  return {
    method: 'GET' as IHttpRequestMethods,
    path: `${servicePath}/${entitySetName}${keyPredicate}`,
  }
}
```

**Apply in Phase 7:** add sibling builders for Create (`POST collection`), Update (`PATCH keyed entity`), Delete (`DELETE keyed entity`, no body), and Action/Function. Keep path construction centralized here.

**HTTP wrapper pattern** (lines 166-215):
```typescript
export async function sapCapApiRequest(
  context: SapCapRequestContext,
  input: SapCapApiRequestInput
) {
  const credentials = await context.getCredentials('sapCapApi')
  const url = `${normalizeBaseUrl(credentials.baseUrl)}${input.path}`
  const responseFormat = input.responseFormat ?? 'json'
  const headers: IDataObject = {
    Accept: responseFormat === 'text' ? 'application/xml, text/xml, */*' : 'application/json',
  }

  if (input.body) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    Object.assign(headers, await buildAuthenticationHeaders(context.helpers.httpRequest, credentials))

    const response = await context.helpers.httpRequest({
      method: input.method ?? 'GET',
      url,
      headers,
      body: input.body,
      encoding: 'text',
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    }) as FullHttpResponse

    if (response.statusCode >= 400) {
      throw createHttpStatusError(response.statusCode, input.errorContext ?? 'odata')
    }

    if (responseFormat === 'json') {
      try {
        return JSON.parse(String(response.body ?? ''))
      } catch (err) {
        throw createSapCapRequestError('CAP response did not match the expected OData shape.', {
          category: 'responseShape',
        })
      }
    }
```

**Apply in Phase 7:** add optional request headers to support `Prefer: return=representation`; if `input.body` can be an empty object, preserve `Content-Type`. Do not expose raw response bodies in errors.

**Authentication pattern** (lines 249-269):
```typescript
export async function buildAuthenticationHeaders(
  httpRequest: SapCapRequestContext['helpers']['httpRequest'],
  credentials: ICredentialDataDecryptedObject
) {
  const authType = credentials.authType as string

  if (authType === 'basicAuth') {
    return buildBasicAuthHeaders(credentials)
  }

  if (authType === 'oauth2') {
    return {
      Authorization: `Bearer ${await requestOAuth2Token(httpRequest, credentials)}`,
    }
  }

  throw createSapCapRequestError(
    'SAP CAP authentication must use Basic Auth or OAuth2 Client Credentials.',
    { category: 'configuration' }
  )
}
```

**Apply in Phase 7:** reuse unchanged for all mutation/action requests.

---

### `cap-n8n-node/nodes/SapCap/ODataMetadata.ts` (utility/metadata parser, request-response + transform)

**Analog:** `cap-n8n-node/nodes/SapCap/ODataMetadata.ts`

**Imports and helper dependency pattern** (lines 1-10):
```typescript
import {
  ILoadOptionsFunctions,
  INodePropertyOptions,
} from 'n8n-workflow'

import {
  createSapCapRequestError,
  normalizeMetadataPath,
  sapCapApiRequest,
} from './GenericFunctions'
```

**Bounded XML extraction pattern** (lines 16-55):
```typescript
export function extractEntitySetOptions(metadataXml: string): EntitySetOption[] {
  if (typeof metadataXml !== 'string' || !metadataXml.trim().startsWith('<')) {
    throw createSapCapRequestError('CAP metadata response is not valid XML.', {
      category: 'responseShape',
    })
  }

  if (!hasMetadataTag(metadataXml, 'Edmx') ||
    !hasMetadataTag(metadataXml, 'DataServices') ||
    !hasMetadataTag(metadataXml, 'EntityContainer')
  ) {
    throw createSapCapRequestError('CAP metadata response is not valid OData metadata.', {
      category: 'responseShape',
    })
  }

  const entitySetPattern = /<(?:(?:\w+):)?EntitySet\b([^>]*)\/?>/g
  const options: EntitySetOption[] = []
  let match: RegExpExecArray | null

  while ((match = entitySetPattern.exec(metadataXml)) !== null) {
    const attributes = parseAttributes(match[1])
    const name = attributes.Name

    if (!name) continue

    const option: EntitySetOption = {
      name,
      value: name,
    }

    if (attributes.EntityType) {
      option.description = attributes.EntityType
    }

    options.push(option)
  }
```

**Apply in Phase 7:** extend the bounded CSDL extraction approach for `EntityType/Key/PropertyRef`, property types, `Action`, `Function`, `ActionImport`, and `FunctionImport`. Do not add an XML parser dependency in Phase 7.

**Load-options pattern** (lines 57-68):
```typescript
export async function loadEntitySetOptions(this: ILoadOptionsFunctions) {
  const credentials = await this.getCredentials('sapCapApi')
  const metadataPath = normalizeMetadataPath(credentials.metadataPath)
  const metadataXml = await sapCapApiRequest(this, {
    method: 'GET',
    path: metadataPath,
    responseFormat: 'text',
    errorContext: 'metadata',
  }) as string

  return extractEntitySetOptions(metadataXml)
}
```

**Apply in Phase 7:** add sibling load-options methods, for example `loadActionFunctionOptions`, that share the same metadata request and sanitizer.

**Attribute parsing pattern** (lines 70-93):
```typescript
function parseAttributes(rawAttributes: string) {
  const attributes: Record<string, string> = {}
  const attributePattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null

  while ((match = attributePattern.exec(rawAttributes)) !== null) {
    attributes[match[1]] = decodeXmlEntities(match[2] ?? match[3] ?? '')
  }

  return attributes
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
```

**Apply in Phase 7:** reuse this for operation/key metadata attributes so single-quoted metadata and XML entities continue to work.

---

### `cap-n8n-node/nodes/SapCap/ODataResponse.ts` (utility/response adapter, transform + request-response errors)

**Analog:** `cap-n8n-node/nodes/SapCap/ODataResponse.ts`

**Imports and operation/error type pattern** (lines 1-31):
```typescript
import {
  IDataObject,
  INode,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow'

type ODataOperation = 'query' | 'read'

export type SapCapErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'configuration'
  | 'network'
  | 'notFound'
  | 'responseShape'
  | 'server'
  | 'validation'
```

**Apply in Phase 7:** extend `ODataOperation` for `create`, `update`, `delete`, and the combined action/function mode. Keep the same safe category set unless a new category is truly needed.

**Cleanup and item normalization pattern** (lines 33-77):
```typescript
export function stripODataMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripODataMetadata(item))
  }

  if (!isPlainObject(value)) {
    return value
  }

  const cleaned: IDataObject = {}

  for (const [key, childValue] of Object.entries(value)) {
    if (key.startsWith('@odata.') || key.includes('@odata.')) continue

    cleaned[key] = stripODataMetadata(childValue) as IDataObject[keyof IDataObject]
  }

  return cleaned
}

export function normalizeODataItems(
  operation: ODataOperation,
  response: unknown,
  itemIndex: number
): INodeExecutionData[] {
  if (operation === 'query') {
    if (!isPlainObject(response) || !Array.isArray(response.value)) {
      throw createResponseShapeError()
    }

    return response.value.map((record) => {
      if (!isPlainObject(record)) {
        throw createResponseShapeError()
      }

      return toItem(record, itemIndex)
    })
  }
```

**Apply in Phase 7:** reuse `toItem` and `stripODataMetadata` for Create, Update, and Action/Function object responses. Add a dedicated Delete confirmation path that does not require an OData body.

**Sanitized error pattern** (lines 79-134):
```typescript
export function classifySapCapError(
  err: unknown,
  context: SapCapErrorContext = {}
): SafeSapCapError {
  const statusCode = extractStatusCode(err, context)
  const category = resolveCategory(err, context, statusCode)
  const safeError: SafeSapCapError = {
    message: messageForCategory(category, context.operation, statusCode),
    category,
  }

  if (statusCode !== undefined) {
    safeError.statusCode = statusCode
  }

  return safeError
}

export function toContinueOnFailItem(
  safeError: SafeSapCapError,
  itemIndex: number
): INodeExecutionData {
  const json: IDataObject = {
    error: safeError.message,
    category: safeError.category,
  }

  if (safeError.statusCode !== undefined) {
    json.statusCode = safeError.statusCode
  }

  return {
    json,
    pairedItem: {
      item: itemIndex,
    },
  }
}

export function toNodeOperationError(
  node: INode,
  safeError: SafeSapCapError,
  itemIndex: number
): NodeOperationError {
```

**Apply in Phase 7:** all new local validation failures and CAP HTTP failures should pass through this safe shape before `continueOnFail` output or thrown `NodeOperationError`.

**Not-found message pattern** (lines 217-227):
```typescript
if (category === 'notFound') {
  if (operation === 'metadata') {
    return 'CAP metadata endpoint was not found. Check Base URL and Metadata Path.'
  }

  if (operation === 'read') {
    return 'CAP entity was not found for the selected entity set and key predicate.'
  }

  return 'CAP OData endpoint was not found. Check the service path and entity set.'
}
```

**Apply in Phase 7:** add Delete-specific 404 copy per D-11, or generalize keyed operation copy to cover Read/Update/Delete without leaking raw CAP responses.

---

### `test/integration/n8n-node-read-operations.test.js` (integration test, request-response)

**Analog:** `test/integration/n8n-node-read-operations.test.js`

**Fake CAP server pattern** (lines 47-80):
```javascript
async function createCapServer(respond) {
  const requests = []
  const sockets = new Set()
  const server = createServer(async (req, res) => {
    let body = ''

    req.setEncoding('utf8')
    for await (const chunk of req) body += chunk

    const request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
    }

    requests.push(request)
    const response = await respond(request, requests.length)

    res.statusCode = response.statusCode ?? 200
    res.setHeader('content-type', response.contentType ?? 'application/json')
    res.end(response.body ?? JSON.stringify({ value: [] }))
  })
```

**Apply in Phase 7:** use this same fake-server style to assert `POST`, `PATCH`, `DELETE`, action/function method, URL, headers, and JSON body. Do not require Docker n8n or a live CAP app.

**Execution context pattern** (lines 120-216):
```javascript
function defaultParameters(overrides = {}) {
  return {
    operation: 'query',
    servicePath: '/odata/v4/admin',
    entitySetSource: 'metadata',
    entitySet: 'Books',
    entitySetManual: '',
    filter: '',
    orderBy: '',
    select: '',
    top: 100,
    skip: 0,
    keyPredicate: '',
    ...overrides,
  }
}

function createExecutionContext({
  credentials,
  parametersByItem,
  continueOnFail = false,
}) {
  return {
    getInputData: () => parametersByItem.map((parameters, index) => ({
      json: {
        index,
        operation: parameters.operation,
      },
    })),
    getCredentials: async (type) => {
      expect(type).toBe('sapCapApi')
      return credentials
    },
    getNodeParameter: (...args) => {
      const [name, itemIndex, defaultValue] = args
      const parameters = parametersByItem[itemIndex]
```

**Apply in Phase 7:** extend `defaultParameters` with Body, Parameters, key-source/key-fields, and operation-selection defaults. Keep `executeSapCap` invoking the built `dist` node.

**Request/response assertion pattern** (lines 447-486):
```javascript
const result = await executeSapCap([
  defaultParameters({
    operation: 'read',
    keyPredicate: 'ID=201,IsActiveEntity=true',
  }),
], {
  credentials: basicCredentials(server.baseUrl),
})

expect(server.requests).toHaveLength(1)
expect(server.requests[0]).toMatchObject({
  method: 'GET',
  url: '/odata/v4/admin/Books(ID=201,IsActiveEntity=true)',
})
expect(result[0]).toEqual([
  {
    json: {
      ID: 201,
      IsActiveEntity: true,
      title: 'Dune',
      details: {
        stock: 7,
      },
    },
    pairedItem: { item: 0 },
  },
])
```

**Apply in Phase 7:** assert Create returns the cleaned created entity, Update returns the cleaned updated entity, Delete returns one confirmation item, and Action/Function returns cleaned output.

**Validation before transport pattern** (lines 511-561):
```javascript
const result = await executeSapCap([
  defaultParameters({
    operation: 'read',
    keyPredicate: 'ID=201)?$expand=SensitiveNav',
  }),
  defaultParameters({
    operation: 'read',
    keyPredicate: 'ID=201)/$value',
  }),
], {
  credentials: basicCredentials(server.baseUrl),
  continueOnFail: true,
})

expect(server.requests).toHaveLength(0)
expect(result[0]).toEqual(Array.from({ length: 8 }, (_, item) => ({
  json: {
    error: 'CAP rejected the OData request. Check the OData options.',
    category: 'validation',
  },
  pairedItem: { item },
})))
```

**Apply in Phase 7:** use the same zero-requests assertion for invalid JSON Body/Parameters, missing composite key parts, and unsafe key predicates.

**Source gate pattern to update** (lines 951-990):
```javascript
const operationValues = operation.options.map((option) => option.value)

expect(operationValues).toEqual(['query', 'read'])
expect(operationValues).not.toEqual(expect.arrayContaining([
  'create',
  'update',
  'delete',
  'action',
  'function',
  'trigger',
]))
expect(propertyNames).not.toEqual(expect.arrayContaining([
  'body',
  'rawResponse',
  'rawODataResponse',
  'pollInterval',
  'actionName',
  'functionName',
  'entityKey',
]))
```

**Apply in Phase 7:** replace the read-only gate with a positive gate for Create/Update/Delete/ActionFunction and a continued negative gate for triggers and raw-response toggles.

---

### `test/integration/n8n-node-metadata-discovery.test.js` (integration test, request-response + transform)

**Analog:** `test/integration/n8n-node-metadata-discovery.test.js`

**Metadata fixture pattern** (lines 19-51):
```javascript
const metadataWithEntitySets = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <edm:Schema Namespace="AdminService" xmlns:edm="http://docs.oasis-open.org/odata/ns/edm">
      <edm:EntityType Name="Book" />
      <edm:EntityType Name="Author" />
      <edm:EntityContainer Name="EntityContainer">
        <edm:EntitySet Name="Books" EntityType="AdminService.Book" />
        <edm:EntitySet Name="Authors" EntityType="AdminService.Author" />
      </edm:EntityContainer>
    </edm:Schema>
  </edmx:DataServices>
</edmx:Edmx>`

const metadataWithSingleQuotedAttributes = `<?xml version='1.0' encoding='utf-8'?>
<edmx:Edmx Version='4.0' xmlns:edmx='http://docs.oasis-open.org/odata/ns/edmx'>
  <edmx:DataServices>
    <Schema Namespace='AdminService' xmlns='http://docs.oasis-open.org/odata/ns/edm'>
      <EntityContainer Name='EntityContainer'>
        <EntitySet Name='Books' EntityType='AdminService.Book' />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`
```

**Apply in Phase 7:** add metadata fixtures with composite keys, bound operations, unbound action/function imports, and malformed operation metadata.

**Metadata server/context pattern** (lines 62-143):
```javascript
async function createCapServer(respond) {
  const requests = []
  const sockets = new Set()
  const server = createServer(async (req, res) => {
    let body = ''

    req.setEncoding('utf8')
    for await (const chunk of req) body += chunk

    const request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
    }

    requests.push(request)
    const response = await respond(request, requests.length)

    res.statusCode = response.statusCode ?? 200
    res.setHeader('content-type', response.contentType ?? 'application/xml')
    res.end(response.body ?? metadataWithEntitySets)
  })
```

**Apply in Phase 7:** reuse for operation load-options and key metadata load-options; continue asserting Basic and OAuth2 credentials.

**Load-options assertion pattern** (lines 188-208):
```javascript
it('loads entity sets from CAP metadata with Basic Auth', async () => {
  const { loadEntitySetOptions } = await importDistModule('dist/nodes/SapCap/ODataMetadata.js')
  const server = await createCapServer(() => ({
    body: metadataWithEntitySets,
  }))

  const options = await loadEntitySetOptions.call(createContext(basicCredentials(server.baseUrl)))

  expect(server.requests).toHaveLength(1)
  expect(server.requests[0]).toMatchObject({
    method: 'GET',
    url: '/odata/v4/admin/$metadata',
  })
  expect(options).toEqual([
    { name: 'Books', value: 'Books', description: 'AdminService.Book' },
    { name: 'Authors', value: 'Authors', description: 'AdminService.Author' },
  ])
})
```

**Apply in Phase 7:** add analogous expectations for key descriptors and action/function option descriptors.

**Request-builder integration pattern** (lines 316-390):
```javascript
const {
  buildQueryRequest,
  buildReadRequest,
  normalizeBaseUrl,
  normalizeKeyPredicate,
  normalizeMetadataPath,
  normalizeServicePath,
  resolveEntitySetName,
} = await importDistModule('dist/nodes/SapCap/GenericFunctions.js')

const queryRequest = buildQueryRequest({
  servicePath: '/odata/v4/admin/',
  entitySetName: 'Books',
  filter: "title eq 'Dune'",
  orderBy: 'title asc, stock desc',
  select: 'ID,title,stock',
  top: 0,
  skip: 0,
})

expect(buildReadRequest({
  servicePath: '/odata/v4/admin',
  entitySetName: 'Books',
  keyPredicate: 'ID=201,IsActiveEntity=true',
})).toEqual({
  method: 'GET',
  path: '/odata/v4/admin/Books(ID=201,IsActiveEntity=true)',
})
```

**Apply in Phase 7:** test helper-level Create/Update/Delete/ActionFunction request builders here or in the runtime suite, but keep assertions against built `dist` modules.

---

### `test/integration/n8n-node-response-cleanup.test.js` (integration test, transform + error handling)

**Analog:** `test/integration/n8n-node-response-cleanup.test.js`

**Built-helper import pattern** (lines 17-22):
```javascript
async function importResponseHelpers() {
  const modulePath = resolve(n8nPackageDir, 'dist/nodes/SapCap/ODataResponse.js')

  expect(existsSync(modulePath), 'ODataResponse helper should exist after n8n package build').toBe(true)
  return import(pathToFileURL(modulePath).href)
}
```

**Safe error fixture pattern** (lines 36-75):
```javascript
function statusError(statusCode, message = `HTTP ${statusCode}`) {
  return Object.assign(new Error(message), {
    statusCode,
    response: {
      statusCode,
      headers: {
        authorization: fakeBearerToken,
        cookie: 'cap-session-cookie-for-test',
      },
      body: {
        error: message,
        password: fakePassword,
        clientSecret: fakeClientSecret,
        responseBody: fakeResponseBody,
      },
    },
    request: {
      headers: {
        Authorization: fakeBasicToken,
      },
      body: {
        password: fakePassword,
      },
    },
  })
}
```

**Apply in Phase 7:** add Body/Parameters and mutation response bodies to the unsafe fixture, then prove they are never serialized into safe errors.

**Cleanup assertion pattern** (lines 166-190):
```javascript
it('normalizes Read entity responses into one cleaned n8n item', async () => {
  const { normalizeODataItems } = await importResponseHelpers()

  expect(normalizeODataItems('read', {
    '@odata.context': '$metadata#Books/$entity',
    ID: 201,
    title: 'Dune',
    metadataLikeField: '@odata.should-stay-as-value',
    details: {
      '@odata.mediaEtag': 'hidden',
      IsActiveEntity: true,
    },
  }, 1)).toEqual([
    {
      json: {
        ID: 201,
        title: 'Dune',
        metadataLikeField: '@odata.should-stay-as-value',
        details: {
          IsActiveEntity: true,
        },
      },
      pairedItem: { item: 1 },
    },
  ])
})
```

**Apply in Phase 7:** duplicate this pattern for Create, Update, and Action/Function object responses.

**Sanitized category pattern** (lines 204-302):
```javascript
const { classifySapCapError } = await importResponseHelpers()
const cases = [
  [
    statusError(401),
    { operation: 'query' },
    {
      message: 'CAP authentication failed. Check the SAP CAP API credential.',
      statusCode: 401,
      category: 'authentication',
    },
  ],
  [
    statusError(404),
    { operation: 'read' },
    {
      message: 'CAP entity was not found for the selected entity set and key predicate.',
      statusCode: 404,
      category: 'notFound',
    },
  ],
]

for (const [err, context, expected] of cases) {
  const safeError = classifySapCapError(err, context)

  expect(safeError).toEqual(expected)
  expectSerializedSafeError(safeError)
}
```

**Apply in Phase 7:** add contexts for `create`, `update`, `delete`, and combined action/function. Include Delete 404 behavior explicitly.

**continueOnFail and NodeOperationError pattern** (lines 329-391):
```javascript
expect(toContinueOnFailItem(safeValidationError, 4)).toEqual({
  json: {
    error: 'CAP rejected the OData request. Check the OData options.',
    statusCode: 400,
    category: 'validation',
  },
  pairedItem: { item: 4 },
})

const nodeError = toNodeOperationError(node, safeError, 6)

expect(nodeError).toBeInstanceOf(NodeOperationError)
expect(nodeError.message).toBe('CAP service returned a server error. Try again or check the CAP service logs.')
expect(nodeError.context.itemIndex).toBe(6)
expect(serialized).not.toContain(fakePassword)
expect(serialized).not.toContain(fakeBearerToken)
expect(serialized).not.toContain(fakeBasicToken)
expect(serialized).not.toContain(fakeClientSecret)
expect(serialized).not.toContain(fakeResponseBody)
```

**Apply in Phase 7:** keep paired item metadata for all new operations and all local validation failures.

---

### `test/smoke/package-boundaries.test.js` (smoke test, batch/build metadata)

**Analog:** `test/smoke/package-boundaries.test.js`

**Manifest import helper pattern** (lines 12-44):
```javascript
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

async function importManifestModules(manifestPaths) {
  const modules = []

  for (const manifestPath of manifestPaths) {
    const modulePath = resolve(n8nPackageDir, manifestPath)

    expect(existsSync(modulePath), `${manifestPath} should exist after n8n package build`).toBe(true)
    modules.push(await import(pathToFileURL(modulePath).href))
  }

  return modules
}

function propertyByName(properties, name) {
  return properties.find((property) => property.name === name)
}
```

**Apply in Phase 7:** keep importing built `dist` modules, not source TypeScript.

**Node metadata smoke pattern** (lines 76-187):
```javascript
it('exposes SAP CAP credentials and Phase 6 Query/Read operation metadata', async () => {
  const [nodeModule] = await importManifestModules(['dist/nodes/SapCap/SapCap.node.js'])
  const [credentialModule] = await importManifestModules(['dist/credentials/SapCapApi.credentials.js'])
  const SapCap = exportedConstructor(nodeModule, 'SapCap')
  const SapCapApi = exportedConstructor(credentialModule, 'SapCapApi')
  const node = new SapCap()
  const credential = new SapCapApi()
  const operation = propertyByName(node.description.properties, 'operation')
  const operationValues = operation.options.map((option) => option.value)
  const propertyNames = node.description.properties.map((property) => property.name)

  expect(node.methods.loadOptions.getEntitySets).toEqual(expect.any(Function))
  expect(node.methods.credentialTest.sapCapApiCredentialTest).toEqual(expect.any(Function))
  expect(propertyNames).toEqual([
    'operation',
    'servicePath',
    'entitySetSource',
    'entitySet',
    'entitySetManual',
    'filter',
    'orderBy',
    'select',
    'top',
    'skip',
    'keyPredicate',
  ])
  expect(operationValues).toEqual([
    'query',
    'read',
  ])
```

**Apply in Phase 7:** update the title, `propertyNames`, `operationValues`, and operation option expectations to include Phase 7 controls. Keep negative assertions for `trigger`, raw response toggles, and any generated entity-property editors deferred by D-01.

---

### `README.md` (documentation, reader workflow + verification)

**Analog:** `README.md`

**Workspace surface summary pattern** (lines 5-9):
```markdown
This repository is an npm workspace with two product surfaces:

- `cap-n8n-plugin/` - CAP plugin and service implementations for CAP to n8n workflow starts.
- `cap-n8n-node/` - n8n community node package for read-oriented CAP OData access: credentials, metadata discovery, Query, Read, cleanup, and sanitized errors.
- `demo-app/` - demo SAP CAP Bookshop application used as integration evidence.
```

**Apply in Phase 7:** update the `cap-n8n-node/` bullet to include Create, Update, Delete, composite keys, and Action/Function invocation once implemented.

**Manual n8n node validation pattern** (lines 294-338):
````markdown
Use this path to manually validate the n8n community node against the CAP demo app after the local community node has been installed or mounted into n8n. The default `docker-compose.yml` starts plain n8n and does not install `cap-n8n-node` into the container.

This covers the current n8n -> CAP node slice for credentials, dynamic metadata discovery, Query, Read, OData response cleanup, and sanitized errors. Create, Update, Delete, CAP actions/functions, and polling triggers are deferred to later phases and are intentionally not exposed by the current node surface.

First build the node package and start the CAP demo app:

```bash
npm run build --workspace n8n-nodes-sap-cap
npm run cap:serve
```
````

**Apply in Phase 7:** replace the deferred mutation/action sentence and add concise manual examples for Create Body JSON, Update key + Body JSON, Delete key, and Action/Function Parameters JSON. Keep the warning that default Docker n8n does not install the local community node unless separately mounted.

**README maintenance pattern** (lines 416-422):
```markdown
README.md must stay current with important developer instructions. Update it in the same change whenever you add or change:

- root npm scripts or workspace commands
- CAP/n8n configuration fields
- required environment variables
- manual setup steps
- manual or automated verification commands
```

**Apply in Phase 7:** update README in the same implementation wave as node operation changes.

---

### `docs/manual-visual-showcase.md` (documentation/runbook, manual workflow)

**Analog:** `docs/manual-visual-showcase.md`

**Presenter runbook pattern** (lines 1-3):
```markdown
# Manual Visual Showcase Guide

This guide is for someone who has not worked in this codebase before and needs to demonstrate the implemented functionality manually. It is written as a presenter runbook: what to open, what to click, what command to run, what should appear on screen, and what not to claim yet.
```

**Implemented/not-implemented boundary pattern** (lines 11-39):
```markdown
## What You Can Showcase Today

Implemented and demoable from the current repository:

- CAP plugin package and n8n node package are loadable from npm workspace boundaries.
- CAP developers can call `cds.connect.to('n8n')` and start workflows through the plugin service.
- Mock n8n runtime works without Docker.
- Webhook runtime can call local n8n.
- Execution tracking, query, duplicate metadata, and cancellation APIs exist and are covered by integration tests.
- The SAP CAP n8n community node package builds and includes the Phase 6 read-side slice: SAP CAP API credentials, Basic Auth, OAuth2 Client Credentials, `$metadata` Test Connection, dynamic entity-set discovery, Query mode, Read mode, OData response cleanup, and sanitized errors.

## What Not To Showcase As Finished Yet

Be precise about these limitations:

- The SAP CAP n8n community node is not installed or mounted into the default Docker n8n container. Do not claim that the SAP CAP node appears automatically in the Docker n8n UI.
- Create, Update, Delete, CAP actions/functions, and polling triggers are not implemented in the current n8n community node surface. They are deferred to the mutation/action phase.
```

**Apply in Phase 7:** move Create/Update/Delete/actions/functions from "not finished" into the implemented n8n-node slice after tests pass. Keep polling triggers and default Docker installation as not-finished.

**Node package showcase pattern** (lines 494-522):
````markdown
The n8n node package is buildable:

```bash
npm run build --workspace n8n-nodes-sap-cap
```

Expected result:

- `n8n-node build` succeeds.
- The build may print the known Node `DEP0190` warning.

Current implemented code includes:

- SAP CAP API credential fields with Basic Auth and OAuth2 Client Credentials.
- `$metadata` Test Connection with OData metadata validation.
- Dynamic entity-set discovery from CAP `$metadata`.
- Query mode.
- Read mode.
- Plain n8n item output with OData metadata stripped.
- Sanitized n8n-native errors for authentication, authorization, validation, not-found, server, network, configuration, and response-shape failures.
````

**Apply in Phase 7:** extend this list with mutation modes, composite-key support, and Action/Function mode. Add manual caveat that live n8n UI demo still requires installing/mounting the local node package.

---

### `mockups/n8n-node-mockup.html` (documentation/mockup component, static UI contract)

**Analog:** `mockups/n8n-node-mockup.html`; Phase 6 `06-PATTERNS.md` mockup assignment

**Current header text to update** (line 289):
```html
<p class="page-subtitle">Wireframes for the n8n node editor panels ... Current Phase 6 surface: credentials, Query, Read ... Mutation panels are future concepts</p>
```

**Apply in Phase 7:** remove "future concepts" language for Create/Update/Delete and add the combined Action/Function mode to the current surface.

**Operation grid pattern** (lines 568-577):
```html
<div class="field-group">
  <div class="field-label">Operation <span class="field-required">*</span></div>
  <div class="mode-grid">
    <div class="mode-btn">Query</div>
    <div class="mode-btn">Read</div>
    <div class="mode-btn active">Create</div>
    <div class="mode-btn">Update</div>
    <div class="mode-btn">Delete</div>
    <div class="mode-btn">Action</div>
  </div>
</div>
```

**Apply in Phase 7:** change "Action" to "Action/Function" and use this same grid across Query, Read, Create, Update, Delete, and Action/Function examples.

**Create Body panel pattern** (lines 584-592):
```html
<div class="field-group">
  <div class="field-label">Body (JSON) <span class="field-required">*</span></div>
  <div class="field-input" style="font-family:monospace;font-size:11px;line-height:1.5">
    {<br/>
    &nbsp;&nbsp;"title": "New Book",<br/>
    &nbsp;&nbsp;"price": 19.99<br/>
    }
  </div>
  <div class="field-hint">Fields to create. Server-generated fields (e.g. ID) are returned in the output.</div>
</div>
```

**Apply in Phase 7:** keep explicit JSON Body as the visual pattern for Create/Update. Do not show generated entity property editors.

**Update/Delete key panel pattern** (lines 633-688):
```html
<div class="field-group">
  <div class="field-label">ID (Primary Key) <span class="field-required">*</span></div>
  <div class="field-input">42</div>
</div>
<div class="field-group">
  <div class="field-label">Body (JSON) <span class="field-required">*</span></div>
  <div class="field-input" style="font-family:monospace;font-size:11px;line-height:1.5">
    {<br/>
    &nbsp;&nbsp;"price": 24.99<br/>
    }
  </div>
  <div class="field-hint">Only include fields you want to change (PATCH - partial update).</div>
</div>
...
<div class="field-group">
  <div class="field-label">ID (Primary Key) <span class="field-required">*</span></div>
  <div class="field-input">42</div>
  <div class="field-hint">Sends DELETE to Books(42). Returns confirmation or a "not found" error.</div>
</div>
```

**Apply in Phase 7:** adjust the visual key labels to show hybrid metadata-derived keys plus manual Key Predicate fallback. Do not add a Delete confirmation checkbox.

## Shared Patterns

### Explicit JSON Object Parameters

**Source:** `07-RESEARCH.md` lines 208-228, backed by `SapCap.node.ts` parameter reads and `GenericFunctions.ts` validation errors.
**Apply to:** Create Body, Update Body, Action/Function Parameters.

```typescript
function parseJsonObjectParameter(value: unknown, fieldName: string): Record<string, unknown> {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${fieldName} must be a JSON object`)
  }
  return parsed as Record<string, unknown>
}
```

Planner note: implement this with `createSapCapRequestError(..., { category: 'validation' })`, not a raw `Error`, so sanitized n8n error handling remains consistent.

### CRUD Request Builders

**Source:** `07-RESEARCH.md` lines 374-418 plus existing `GenericFunctions.ts` lines 136-164.
**Apply to:** `GenericFunctions.ts`.

```typescript
const request = {
  method: 'POST',
  path: `${servicePath}/${entitySet}`,
  body: parsedBody,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
}
```

Planner note: existing `sapCapApiRequest` does not currently accept extra headers; add that narrowly if needed for `Prefer: return=representation`.

### Hybrid Key Handling

**Source:** `GenericFunctions.ts` lines 122-134, `ODataMetadata.ts` lines 16-55 and 70-93, `07-RESEARCH.md` lines 230-247.
**Apply to:** Read, Update, Delete, bound Action/Function.

```typescript
export function normalizeKeyPredicate(value: unknown) {
  const keyPredicate = requireString(value, 'Key Predicate is required for Read.')

  if (containsUrlBoundary(keyPredicate)) {
    throw createSapCapRequestError('Key Predicate must not include /, \\, ?, or #.', {
      category: 'validation',
    })
  }

  return keyPredicate.startsWith('(') && keyPredicate.endsWith(')')
    ? keyPredicate
    : `(${keyPredicate})`
}
```

Planner note: retain this manual fallback exactly in spirit while adding metadata-derived key fields and type-aware literal formatting.

### Sanitized Error Handling

**Source:** `ODataResponse.ts` lines 79-134; `n8n-node-response-cleanup.test.js` lines 36-75 and 329-391.
**Apply to:** all new operation modes and all new local validation.

```typescript
const safeError = classifySapCapError(err, { operation })

if (this.continueOnFail()) {
  returnData.push(toContinueOnFailItem(safeError, itemIndex))
  continue
}

throw toNodeOperationError(this.getNode(), safeError, itemIndex)
```

Planner note: tests must assert fake passwords, bearer tokens, client secrets, auth headers, request bodies, and raw response bodies are absent from serialized errors.

### CAP Fixture References

**Source:** `demo-app/srv/admin-service.cds` lines 3-8.
**Apply to:** mutation examples and integration fixtures.

```cds
service AdminService {
  entity Authors as projection on my.Authors;
  @odata.draft.bypass
  entity Books   as projection on my.Books;
  entity Genres  as projection on my.Genres;
}
```

**Source:** `demo-app/srv/cat-service.cds` lines 29-32 and `demo-app/srv/cat-service.js` lines 14-25.
**Apply to:** Action/Function examples and tests.

```cds
@requires: 'authenticated-user'
action submitOrder(book: Books:ID, quantity: Integer) returns {
  stock : Integer
};
```

```javascript
this.on('submitOrder', async req => {
  let { book:id, quantity } = req.data
  let book = await SELECT.one.from (Books, id, b => b.stock)

  if (!book) return req.error (404, `Book #${id} doesn't exist`)
  if (quantity < 1) return req.error (400, `quantity has to be 1 or more`)
  if (!book.stock || quantity > book.stock) return req.error (409, `${quantity} exceeds stock for book #${id}`)

  await UPDATE (Books, id) .with ({ stock: book.stock -= quantity })
  return book
})
```

Planner note: use demo service shapes as examples/fixtures only; reusable implementation belongs in `cap-n8n-node`.

### Build and Verification Commands

**Source:** root `package.json` lines 10-16 and `cap-n8n-node/package.json` lines 7-12.
**Apply to:** plan verification steps and README updates.

```json
"scripts": {
  "build": "npm run build --workspaces --if-present",
  "cap:serve": "npm run start --workspace demo-app",
  "cap:compile": "cds compile demo-app/db demo-app/srv demo-app/app --to csn",
  "smoke": "npm run build --workspace n8n-nodes-sap-cap && vitest run test/smoke",
  "test:integration": "vitest run test/integration",
  "test": "npm run smoke && npm run test:integration"
}
```

```json
"scripts": {
  "build": "n8n-node build",
  "lint": "n8n-node lint",
  "dev": "n8n-node dev",
  "test": "npm run lint && npm run build"
}
```

Planner note: Phase 7 should not add dependencies unless there is a human checkpoint; research recommends no new packages.

### Documentation and Mockup Alignment

**Source:** `README.md` lines 294-338, `docs/manual-visual-showcase.md` lines 494-522, `mockups/n8n-node-mockup.html` lines 547-688, Phase 6 `06-PATTERNS.md` lines 652-701.
**Apply to:** README/manual/mockup updates.

Planner note: docs must stop saying Create/Update/Delete/actions/functions are future work after implementation. Keep true caveats: default Docker n8n does not install the local community node, polling triggers remain out of scope, and secrets stay in credentials/env.

## No Analog Found

| File or Pattern | Role | Data Flow | Reason |
|---|---|---|---|
| Metadata-derived composite key field UI | n8n node component | request-response + transform | Existing node only has manual `keyPredicate`; use `GenericFunctions.ts` and `07-RESEARCH.md` hybrid key guidance. |
| Type-aware OData literal formatter | utility | transform | No current helper formats key literals by EDM type; implement narrowly and cover string, numeric, and boolean values. |
| Action/Function metadata descriptor parser | metadata parser | request-response + transform | Existing parser only extracts `EntitySet`; extend `ODataMetadata.ts` with tests for actions, functions, imports, and bound operations. |
| Function URL parameter builder | utility/service client | request-response | Existing helpers only build Query and Read GET paths; use `URLSearchParams` pattern from `buildQueryRequest`. |
| Action/Function mockup panel | documentation/mockup component | static UI contract | Existing HTML has Create/Update/Delete future panels but no complete Action/Function panel; adapt the same panel/card structure. |

## Metadata

**Analog search scope:** `cap-n8n-node/nodes/SapCap`, `cap-n8n-node/package.json`, `test/integration`, `test/smoke`, `README.md`, `docs/`, `mockups/`, `demo-app/srv/`, root `package.json`, Phase 6 planning docs.
**Files scanned:** 67 files from `rg --files` in the search scope.
**Strong analogs read:** `SapCap.node.ts`, `GenericFunctions.ts`, `ODataMetadata.ts`, `ODataResponse.ts`, `n8n-node-read-operations.test.js`, `n8n-node-metadata-discovery.test.js`, `n8n-node-response-cleanup.test.js`, `package-boundaries.test.js`, `README.md`, `docs/manual-visual-showcase.md`, `mockups/n8n-node-mockup.html`, `demo-app/srv/*.cds`, `demo-app/srv/*.js`, Phase 6 `06-PATTERNS.md`.
**Pattern extraction date:** 2026-06-03

## Planner Notes

- Keep Phase 7 implementation in `cap-n8n-node`; demo CAP files are fixtures/examples unless a plan explicitly needs additional demo metadata.
- Prefer extending existing helper modules first. Create a new helper file only if `GenericFunctions.ts` or `ODataMetadata.ts` becomes difficult to read after adding CRUD/action/key helpers.
- Replace Phase 6 read-only negative gates with Phase 7 positive gates, but keep gates against polling triggers, raw OData response toggles, generated entity property editors, and secret leakage.
- Include docs/mockup updates in the same implementation wave as operation visibility changes.
