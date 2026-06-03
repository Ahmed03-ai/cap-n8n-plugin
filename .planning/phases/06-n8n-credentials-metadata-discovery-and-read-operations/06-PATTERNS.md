# Phase 06: n8n Credentials, Metadata Discovery, and Read Operations - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 9
**Analogs found:** 8 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `cap-n8n-node/credentials/SapCapApi.credentials.ts` | credential/config | request-response | `cap-n8n-node/credentials/SapCapApi.credentials.ts` | exact |
| `cap-n8n-node/nodes/SapCap/SapCap.node.ts` | n8n node component/controller | request-response + transform | `cap-n8n-node/nodes/SapCap/SapCap.node.ts` | exact |
| `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` | utility | request-response | `cap-n8n-node/nodes/SapCap/SapCap.node.ts`; `cap-n8n-plugin/lib/N8nWorkflowService.js` | role-match |
| `cap-n8n-node/nodes/SapCap/ODataMetadata.ts` | utility | request-response + transform | `cap-n8n-node/credentials/SapCapApi.credentials.ts`; `cap-n8n-node/nodes/SapCap/SapCap.node.ts` | partial |
| `cap-n8n-node/nodes/SapCap/ODataResponse.ts` | utility | transform + request-response errors | `cap-n8n-node/nodes/SapCap/SapCap.node.ts`; `cap-n8n-plugin/lib/errors.js` | role-match |
| `cap-n8n-node/package.json` | config | batch/build | `cap-n8n-node/package.json`; root `package.json` | exact |
| `test/smoke/package-boundaries.test.js` | test | batch | `test/smoke/package-boundaries.test.js` | exact |
| `test/integration/n8n-node-read-operations.test.js` | test | request-response | `test/integration/n8n-webhook-runtime.test.js` | role-match |
| `mockups/n8n-node-mockup.html` | documentation/mockup component | static UI contract | `mockups/n8n-node-mockup.html`; `06-UI-SPEC.md` | docs-match |

## Pattern Assignments

### `cap-n8n-node/credentials/SapCapApi.credentials.ts` (credential/config, request-response)

**Analog:** `cap-n8n-node/credentials/SapCapApi.credentials.ts`

**Imports pattern** (lines 1-5):
```typescript
import {
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow'
```

**Credential identity pattern** (lines 7-15):
```typescript
export class SapCapApi implements ICredentialType {
  name = 'sapCapApi'

  displayName = 'SAP CAP API'

  icon = 'file:sapCap.svg' as const

  documentationUrl = 'https://github.com/Ahmed03-ai/cap-n8n-plugin#credentials'
```

**Field declaration pattern** (lines 16-34):
```typescript
properties: INodeProperties[] = [
  {
    displayName: 'Base URL',
    name: 'baseUrl',
    type: 'string',
    default: '',
    required: true,
    placeholder: 'http://host.docker.internal:3000',
    description: 'Root URL of the CAP application, without a trailing slash.',
  },
  {
    displayName: 'Metadata Path',
    name: 'metadataPath',
    type: 'string',
    default: '/odata/v4/admin/$metadata',
```

**Conditional credential fields** (lines 35-80):
```typescript
{
  displayName: 'Authentication',
  name: 'authType',
  type: 'options',
  options: [
    {
      name: 'Basic Auth',
      value: 'basicAuth',
    },
    {
      name: 'OAuth2 Client Credentials',
      value: 'oauth2',
    },
    {
      name: 'None',
      value: 'none',
    },
  ],
  default: 'basicAuth',
  required: true,
},
{
  displayName: 'Username',
  name: 'username',
  type: 'string',
  default: '',
  displayOptions: {
    show: {
      authType: ['basicAuth'],
    },
  },
},
```

**Credential test pattern** (lines 134-140):
```typescript
test: ICredentialTestRequest = {
  request: {
    baseURL: '={{$credentials.baseUrl}}',
    url: '={{$credentials.metadataPath}}',
    method: 'GET',
  },
}
```

**Apply in Phase 6:**

- Keep the class shape, icon, `ICredentialType`, `INodeProperties[]`, and `$metadata` test request.
- Remove the visible `None` option from the Phase 6 credential UI.
- Make Basic Auth the working path for credential test, metadata discovery, Query, and Read.
- Keep OAuth2 Client Credentials visible as scaffold only; guard unsupported/incomplete runtime behavior with sanitized configuration/auth errors.
- Do not include usernames, passwords, client secrets, bearer tokens, auth headers, or full metadata response bodies in errors.

---

### `cap-n8n-node/nodes/SapCap/SapCap.node.ts` (n8n node component/controller, request-response + transform)

**Analog:** `cap-n8n-node/nodes/SapCap/SapCap.node.ts`

**Imports pattern** (lines 1-11):
```typescript
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
```

**Node description and credential binding** (lines 119-140):
```typescript
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
```

**Operation options pattern** (lines 141-180):
```typescript
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
```

**Apply in Phase 6:** copy the n8n option object structure, but expose only `query` and `read`. Do not leave `create`, `update`, or `delete` selectable or inert.

**Query fields pattern** (lines 198-260):
```typescript
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
```

**Read key field pattern** (lines 261-274):
```typescript
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
```

**Apply in Phase 6:** rename/copy as `Key Predicate`, show only for `read`, preserve manual OData predicate syntax, and wrap missing parentheses in helper code.

**Execute loop and request pattern** (lines 290-351):
```typescript
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
```

**Error and continue-on-fail pattern** (lines 353-369):
```typescript
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
```

**Apply in Phase 6:**

- Keep one `execute()` adapter in this file and move reusable transport/metadata/response logic into helpers.
- Add `methods.loadOptions.getEntitySets` in this class and bind the `Entity Set` options property through `typeOptions.loadOptionsMethod`.
- Build Query and Read as GET-only.
- Preserve `0` values for `$top` and `$skip`; current `if (top)` / `if (skip)` pattern drops zero.
- Add `pairedItem` to successful Query and Read item outputs, not only failure outputs.

---

### `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` (utility, request-response)

**Analogs:** `cap-n8n-node/nodes/SapCap/SapCap.node.ts`; `cap-n8n-plugin/lib/N8nWorkflowService.js`

**URL normalization pattern** from current n8n node (lines 13-15):
```typescript
function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '')
}
```

**Current auth header pattern** from n8n node (lines 75-98):
```typescript
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
```

**Reusable transport pattern** from CAP plugin (lines 475-485):
```javascript
async _dispatchWebhook(workflowId, inputs = {}, options = {}) {
  const safeBaseUrl = this.baseUrl.replace(/\/$/, '')
  const safePath = normalizeWebhookPath(workflowId)
  const url = `${safeBaseUrl}/${safePath}`
  const headers = {
    'Content-Type': 'application/json'
  }

  if (this.apiKey) {
    headers['X-N8N-API-KEY'] = this.apiKey
  }
```

**Fetch-with-timeout shape** from CAP plugin (lines 551-567):
```javascript
async _fetchWebhook(url, headers, inputs) {
  const controller = new AbortController()
  const timeout = this.timeoutMs > 0
    ? setTimeout(() => controller.abort(), this.timeoutMs)
    : undefined

  try {
    return await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(inputs || {}),
      signal: controller.signal
    })
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
```

**Apply in Phase 6:**

- Put shared Base URL, service path, metadata path, entity-set, key predicate, and request-option construction here.
- Prefer one `sapCapApiRequest` helper used by `execute()` and `loadOptions`.
- Use n8n HTTP helpers from the execution/load-options context, not global `fetch`, for n8n node runtime requests.
- Validate `http`/`https` Base URL, leading slash paths, no query/fragment in service path, nonempty entity-set names, and nonnegative integer `$top`/`$skip`.
- Treat auth headers and tokens as write-only transport details; never surface them in returned errors.

---

### `cap-n8n-node/nodes/SapCap/ODataMetadata.ts` (utility, request-response + transform)

**Analogs:** `cap-n8n-node/credentials/SapCapApi.credentials.ts`; `cap-n8n-node/nodes/SapCap/SapCap.node.ts`

**Metadata endpoint field** (credentials lines 26-34):
```typescript
{
  displayName: 'Metadata Path',
  name: 'metadataPath',
  type: 'string',
  default: '/odata/v4/admin/$metadata',
  required: true,
  placeholder: '/odata/v4/admin/$metadata',
  description: 'CAP OData metadata endpoint used by the credential test.',
},
```

**Metadata request pattern** (credentials lines 134-140):
```typescript
test: ICredentialTestRequest = {
  request: {
    baseURL: '={{$credentials.baseUrl}}',
    url: '={{$credentials.metadataPath}}',
    method: 'GET',
  },
}
```

**n8n display condition pattern** (node lines 205-209):
```typescript
displayOptions: {
  show: {
    operation: ['query'],
  },
},
```

**Apply in Phase 6:**

- Add `getEntitySets` as a design-time `methods.loadOptions` function in `SapCap.node.ts`, but keep metadata fetch/extract logic testable in `ODataMetadata.ts`.
- Return n8n option objects with entity-set `name` and `value`, and optional `description` from CSDL `EntityType`.
- Add an `Entity Set Source` options field with `metadata` and `manual`, then show either loaded `Entity Set` or manual `Entity Set Name`.
- No exact source analog exists for `methods.loadOptions` in this repo. Use the researched n8n convention: `methods.loadOptions.getEntitySets` plus `typeOptions.loadOptionsMethod`.
- Metadata extraction can start targeted: extract CSDL `EntitySet Name` attributes and cover namespace-prefix/multiple-container cases in integration tests before adding an XML parser.

---

### `cap-n8n-node/nodes/SapCap/ODataResponse.ts` (utility, transform + errors)

**Analogs:** `cap-n8n-node/nodes/SapCap/SapCap.node.ts`; `cap-n8n-plugin/lib/errors.js`; `cap-n8n-plugin/lib/N8nWorkflowService.js`

**Current shallow OData cleanup** (node lines 17-20):
```typescript
function stripODataMetadata(value: IDataObject): IDataObject {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !key.startsWith('@odata.'))
  )
}
```

**Current response normalization** (node lines 100-117):
```typescript
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
```

**Sanitization pattern** from CAP plugin errors (lines 75-103):
```javascript
function sanitizeValue(value, sensitiveValues, depth = 0) {
  if (depth > MAX_DETAIL_DEPTH) return '[omitted]'
  if (value === undefined || value === null) return value
  if (typeof value === 'string') return sanitizeString(value, sensitiveValues)
  if (typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, sensitiveValues, depth + 1))
  }

  const sanitized = {}
  for (const [key, childValue] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key)
    if (normalizedKey === 'sensitivevalues' || SENSITIVE_KEYS.has(normalizedKey)) continue
```

**Error object pattern** from CAP plugin errors (lines 105-117):
```javascript
function createN8nError({ message, statusCode, retryable = false, code, details, cause } = {}) {
  const error = cause
    ? new Error(message || 'n8n request failed.', { cause })
    : new Error(message || 'n8n request failed.')

  error.source = 'n8n'
  error.statusCode = statusCode
  error.retryable = Boolean(retryable)
  error.code = code
  error.details = sanitizeDetails(details)

  return error
}
```

**HTTP error classification shape** from CAP plugin (lines 569-612):
```javascript
_createHttpError({ response, responseText, workflowId, options, attempt, maxAttempts }) {
  const statusCode = response.status
  const retryable = isRetryableStatus(statusCode)

  return createN8nError({
    message: `n8n webhook request failed with status ${statusCode}.`,
    statusCode,
    retryable,
    code: retryable ? 'ERR_N8N_RETRYABLE_STATUS' : 'ERR_N8N_HTTP_STATUS',
    details: {
      workflowId,
      executionId: options.executionId,
      statusCode,
```

**Apply in Phase 6:**

- Replace shallow `stripODataMetadata` with recursive cleanup for nested objects and arrays.
- `normalizeODataItems('query', response, itemIndex)` should require `response.value` to be an array and return one n8n item per row.
- `normalizeODataItems('read', response, itemIndex)` should require one object and reject arrays/unexpected shapes.
- Every successful item should include `pairedItem: { item: itemIndex }`.
- Map HTTP failures into sanitized categories: `authentication`, `authorization`, `notFound`, `validation`, `server`, `network`, `configuration`, and `responseShape`.
- `continueOnFail()` output should be `{ error, statusCode, category }` with no raw auth headers, tokens, credential values, stack traces, or full CAP response bodies.

---

### `cap-n8n-node/package.json` (config, batch/build)

**Analog:** `cap-n8n-node/package.json`; root `package.json`

**n8n node package scripts** (lines 7-12):
```json
"scripts": {
  "build": "n8n-node build",
  "lint": "n8n-node lint",
  "dev": "n8n-node dev",
  "test": "npm run lint && npm run build"
},
```

**n8n manifest pattern** (lines 31-39):
```json
"n8n": {
  "n8nNodesApiVersion": 1,
  "nodes": [
    "dist/nodes/SapCap/SapCap.node.js"
  ],
  "credentials": [
    "dist/credentials/SapCapApi.credentials.js"
  ]
},
```

**Root verification pattern** (root `package.json` lines 14-16):
```json
"smoke": "npm run build --workspace n8n-nodes-sap-cap && vitest run test/smoke",
"test:integration": "vitest run test/integration",
"test": "npm run smoke && npm run test:integration",
```

**Apply in Phase 6:**

- Do not add package dependencies unless metadata parsing proves a parser is necessary.
- Keep helper files under `nodes/SapCap/` so current `tsconfig.json` includes them through `nodes/**/*.ts`.
- Keep build evidence on `npm run build --workspace n8n-nodes-sap-cap`.
- If scripts change, preserve the root smoke-before-integration verification order.

---

### `test/smoke/package-boundaries.test.js` (test, batch)

**Analog:** `test/smoke/package-boundaries.test.js`

**Manifest import pattern** (lines 61-74):
```javascript
it('loads every n8n manifest-referenced node and credential module after build', async () => {
  const packageJson = readJson(resolve(n8nPackageDir, 'package.json'))
  const nodeManifestPaths = packageJson.n8n?.nodes ?? []
  const credentialManifestPaths = packageJson.n8n?.credentials ?? []

  expect(nodeManifestPaths.length).toBeGreaterThan(0)
  expect(credentialManifestPaths.length).toBeGreaterThan(0)

  const nodeModules = await importManifestModules(nodeManifestPaths)
  const credentialModules = await importManifestModules(credentialManifestPaths)

  expect(nodeModules.some(hasFunctionExport)).toBe(true)
```

**Current metadata expectation to update** (lines 76-130):
```javascript
it('exposes SAP CAP credentials and CRUD operation metadata', async () => {
  const [nodeModule] = await importManifestModules(['dist/nodes/SapCap/SapCap.node.js'])
  const [credentialModule] = await importManifestModules(['dist/credentials/SapCapApi.credentials.js'])
  const SapCap = exportedConstructor(nodeModule, 'SapCap')
  const SapCapApi = exportedConstructor(credentialModule, 'SapCapApi')
  const node = new SapCap()
  const credential = new SapCapApi()
  const operation = propertyByName(node.description.properties, 'operation')
  const operationValues = operation.options.map((option) => option.value)
```

**Apply in Phase 6:**

- Rename this test from CRUD metadata to Phase 6 Query/Read metadata.
- Update operation expectation from `create/delete/query/read/update` to `query/read`.
- Assert `Entity Set Source`, metadata-backed `Entity Set` with `typeOptions.loadOptionsMethod`, and manual `Entity Set Name`.
- Assert `authType` options are `basicAuth` and `oauth2`, not `none`.
- Keep the built-dist import pattern; smoke tests inspect built package boundaries, not source-only files.

---

### `test/integration/n8n-node-read-operations.test.js` (test, request-response)

**Analog:** `test/integration/n8n-webhook-runtime.test.js`

**Fake HTTP server pattern** (lines 58-99):
```javascript
async function createWebhookServer(respond) {
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
      body: body ? JSON.parse(body) : undefined
    }

    requests.push(request)
    const response = await respond(request, requests.length)
```

**Cleanup pattern** (lines 111-114):
```javascript
afterEach(async () => {
  await resetN8nService()
  await disconnectDb()
})
```

**Sanitized failure assertion pattern** (lines 250-299):
```javascript
it('throws sanitized structured errors for HTTP 500 responses', async () => {
  await deployExecutionModel()
  const secretApiKey = 'test-secret-api-key'
  const server = await createWebhookServer(() => ({
    statusCode: 500,
    body: JSON.stringify({
      error: 'workflow failed',
      apiKey: secretApiKey,
      stack: 'stack trace should not be exposed'
    })
  }))
```

**Apply in Phase 6:**

- Build or import the n8n node package before testing built modules when necessary.
- Use Node `http` fake CAP/OData servers; do not require live Docker n8n.
- Cover Basic Auth `$metadata`, entity-set extraction from XML, metadata failure, Query URL construction, Query cleanup, Read key predicate URL construction, Read cleanup, 400/401/403/404/5xx categories, response-shape errors, and `continueOnFail()`.
- Include fake secrets in responses/test credentials and assert serialized errors do not contain them.

---

### `mockups/n8n-node-mockup.html` (documentation/mockup component, static UI contract)

**Analog:** `mockups/n8n-node-mockup.html`; `06-UI-SPEC.md`

**Credential mockup pattern** (lines 301-325):
```html
<div class="field-group">
  <div class="field-label">Base URL <span class="field-required">*</span></div>
  <div class="field-input">http://localhost:3000</div>
  <div class="field-hint">Root URL of the CAP OData service</div>
</div>

<div class="field-group">
  <div class="field-label">Authentication Type <span class="field-required">*</span></div>
  <div class="auth-tabs">
    <div class="auth-tab active">Basic Auth</div>
    <div class="auth-tab">OAuth2</div>
```

**Query mockup pattern with stale mutation buttons** (lines 424-445):
```html
<div class="field-group">
  <div class="field-label">Operation <span class="field-required">*</span></div>
  <div class="mode-grid">
    <div class="mode-btn active">Query</div>
    <div class="mode-btn">Read</div>
    <div class="mode-btn">Create</div>
    <div class="mode-btn">Update</div>
    <div class="mode-btn">Delete</div>
    <div class="mode-btn">Action</div>
  </div>
```

**Read mockup pattern with stale mutation buttons** (lines 499-527):
```html
<div class="field-group">
  <div class="field-label">Operation <span class="field-required">*</span></div>
  <div class="mode-grid">
    <div class="mode-btn">Query</div>
    <div class="mode-btn active">Read</div>
    <div class="mode-btn">Create</div>
    <div class="mode-btn">Update</div>
    <div class="mode-btn">Delete</div>
    <div class="mode-btn">Action</div>
  </div>
```

**Apply in Phase 6:**

- Treat this as documentation/mockup alignment only, not runtime UI.
- Keep credential, Query, and Read examples aligned with n8n-native controls.
- Remove or clearly mark mutation/action sections as later-phase examples if the planner includes mockup cleanup.
- Do not create a custom app, CSS design system, standalone frontend, or custom n8n editor shell.

## Shared Patterns

### TypeScript n8n Node Shape
**Source:** `cap-n8n-node/nodes/SapCap/SapCap.node.ts`
**Apply to:** `SapCap.node.ts`, `GenericFunctions.ts`, `ODataMetadata.ts`, `ODataResponse.ts`

- Import only from `n8n-workflow` and local helpers.
- Keep TypeScript under `cap-n8n-node/nodes/SapCap/`.
- Use two-space indentation, single quotes, and no semicolons, matching current n8n node files.
- Keep UI metadata in `description.properties`; keep execution in `execute()`.

### Credential Field and Test Shape
**Source:** `cap-n8n-node/credentials/SapCapApi.credentials.ts`
**Apply to:** credential updates and smoke tests

- Use `ICredentialType`, `properties: INodeProperties[]`, `displayOptions.show`, and `test: ICredentialTestRequest`.
- `$metadata` remains the safe credential test target.
- Password/client-secret fields use `typeOptions: { password: true }`.

### Request and URL Construction
**Source:** `cap-n8n-node/nodes/SapCap/SapCap.node.ts` lines 13-15, 314-330; `cap-n8n-plugin/lib/N8nWorkflowService.js` lines 475-485
**Apply to:** `GenericFunctions.ts`, `SapCap.node.ts`, `ODataMetadata.ts`

- Normalize one trailing slash from Base URL and service paths.
- Use `URLSearchParams` for OData query options; replace `+` with `%20` as current code does.
- Preserve `$top=0` and `$skip=0`; avoid falsey checks.
- Keep key predicates as OData syntax, not parsed JSON.

### OData Cleanup
**Source:** `cap-n8n-node/nodes/SapCap/SapCap.node.ts` lines 17-20, 100-117
**Apply to:** `ODataResponse.ts`, integration tests

- Query unpacks `value` arrays into separate n8n items.
- Read returns the entity object directly.
- Phase 6 must make the current shallow `@odata.*` removal recursive.
- No raw OData response toggle in this phase.

### Sanitized Errors
**Source:** `cap-n8n-plugin/lib/errors.js` lines 1-14, 75-117; `cap-n8n-plugin/lib/N8nWorkflowService.js` lines 569-612
**Apply to:** `ODataResponse.ts`, `GenericFunctions.ts`, `SapCap.node.ts`, tests

- Maintain an explicit sensitive-key denylist.
- Remove or redact auth headers, API keys, passwords, bearer tokens, request bodies, stack traces, and full responses.
- Convert low-level errors into sanitized operation errors before throwing `NodeOperationError` or returning `continueOnFail()` items.

### Fake HTTP Integration Tests
**Source:** `test/integration/n8n-webhook-runtime.test.js` lines 58-99, 250-299
**Apply to:** `test/integration/n8n-node-read-operations.test.js`

- Use Node `http` fake servers with captured `requests`.
- Return deterministic XML/JSON/status codes.
- Destroy sockets during cleanup to prevent hanging tests.
- Include secret-looking values in negative tests and assert serialized outputs are clean.

### Package Boundary Verification
**Source:** `test/smoke/package-boundaries.test.js` lines 61-130; `cap-n8n-node/package.json` lines 31-39
**Apply to:** smoke updates and package config

- Build before smoke tests.
- Import built `dist` modules referenced by the n8n manifest.
- Inspect node/credential descriptions from constructors, not source text.

## No Analog Found

| File / Pattern | Role | Data Flow | Reason |
|---|---|---|---|
| `methods.loadOptions.getEntitySets` exact implementation | node design-time method | request-response | No source file currently defines n8n `methods.loadOptions`; planner should use `06-RESEARCH.md` and n8n docs pattern. |
| `httpRequestWithAuthentication` helper usage | utility | request-response | Current n8n node manually creates auth headers and uses `helpers.httpRequest`; no local source analog uses n8n credential-auth helper. |
| Robust CSDL XML parser | utility | transform | No XML parser dependency or metadata parser exists; start with targeted, tested `EntitySet` extraction unless planner adds a dependency checkpoint. |

## Metadata

**Analog search scope:** `cap-n8n-node`, `cap-n8n-plugin/lib`, `test`, `mockups`, phase docs, root package config.
**Files scanned:** 61 repo files from `rg --files` in the search scope, plus required planning docs.
**Strong analogs read:** `SapCapApi.credentials.ts`, `SapCap.node.ts`, `cap-n8n-node/package.json`, `n8n-webhook-runtime.test.js`, `package-boundaries.test.js`, `cap-n8n-plugin/lib/errors.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/lib/workflows/sanitize.js`, `mockups/n8n-node-mockup.html`.
**Pattern extraction date:** 2026-06-03

## Planner Notes

- Keep Phase 6 read-only. Do not implement Create, Update, Delete, CAP actions/functions, dynamic key-field generation, raw response toggles, or polling triggers.
- Current `SapCap.node.ts` already contains mutation options and methods; the planner should remove/hide those from visible metadata and avoid using them as acceptance evidence.
- Current cleanup is shallow and current `$top`/`$skip` checks drop zero; both need explicit Phase 6 fixes.
- OAuth2 interpretation is the main scope risk. Keep Basic Auth as the acceptance path and make OAuth2 scaffold behavior sanitized and non-blocking.
