# Phase 05: workflow-import-and-build-validation - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 24 file/module families
**Analogs found:** 21 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `cap-n8n-plugin/package.json` | config | CLI/process | `cap-n8n-plugin/package.json` | exact |
| `package.json` | config | CLI/process | `package.json` | exact |
| `cap-n8n-plugin/index.js` | package entry | module export | `cap-n8n-plugin/index.js` | exact |
| `cap-n8n-plugin/bin/cap-n8n.js` | controller | CLI request-response | `test/integration/n8n-execution-store.test.js` | partial |
| `cap-n8n-plugin/lib/workflows/import.js` | service | file-I/O + transform | `cap-n8n-plugin/lib/N8nWorkflowService.js` | role-match |
| `cap-n8n-plugin/lib/workflows/live-client.js` | service | request-response | `cap-n8n-plugin/lib/N8nWorkflowService.js` | exact |
| `cap-n8n-plugin/lib/workflows/sanitize.js` | utility | transform | `cap-n8n-plugin/lib/errors.js` | exact |
| `cap-n8n-plugin/lib/workflows/artifacts.js` | utility | file-I/O | `node_modules/@sap/cds-dk/lib/build/plugins/plugin.js` | partial external |
| `cap-n8n-plugin/lib/workflows/schema.js` | model | validation + transform | `cap-n8n-plugin/lib/annotations/AnnotationParser.js` | role-match |
| `cap-n8n-plugin/lib/workflows/generate-cds.js` | utility | transform + file-I/O | `cap-n8n-plugin/index.cds` | partial |
| `cap-n8n-plugin/lib/workflows/manifest.js` | model | transform | `cap-n8n-plugin/lib/result.js` | role-match |
| `cap-n8n-plugin/lib/workflows/validate.js` | service | transform + batch | `cap-n8n-plugin/lib/annotations/AnnotationParser.js` | exact |
| `cap-n8n-plugin/lib/workflows/diagnostics.js` | utility | transform | `cap-n8n-plugin/lib/errors.js` | exact |
| `cap-n8n-plugin/lib/workflows/BuildValidationPlugin.js` | build plugin | batch | `node_modules/@sap/cds-dk/lib/build/plugins/plugin.js` | partial external |
| `cap-n8n-plugin/cds-plugin.js` | plugin/bootstrap | event-driven | `cap-n8n-plugin/cds-plugin.js` | exact |
| `demo-app/n8n/manifest.json` | generated config | file-I/O | `cap-n8n-plugin/lib/result.js` | partial |
| `demo-app/n8n/workflows/<workflow-key>/workflow.json` | generated artifact | file-I/O + transform | `test-workflows/workflows.json` | source-shape |
| `demo-app/n8n/workflows/<workflow-key>/schema.json` | generated artifact | validation model | No close local analog | none |
| `demo-app/n8n/workflows/<workflow-key>/manifest.json` | generated config | file-I/O | `cap-n8n-plugin/lib/result.js` | role-match |
| `demo-app/n8n/index.cds` | generated model | transform | `cap-n8n-plugin/index.cds` | role-match |
| `demo-app/srv/admin-service.cds` | model | request-response annotation | `demo-app/srv/admin-service.cds` | exact |
| `test/integration/n8n-workflow-import.test.js` | test | file-I/O | `test/integration/n8n-annotation-contract.test.js` | role-match |
| `test/integration/n8n-workflow-live-import.test.js` | test | request-response | `test/integration/n8n-webhook-runtime.test.js` | exact |
| `test/integration/n8n-workflow-build-validation.test.js` | test | batch/build validation | `test/integration/n8n-annotations-start.test.js` | role-match |

## Pattern Assignments

### `cap-n8n-plugin/package.json`, `package.json`, `cap-n8n-plugin/index.js`, `cap-n8n-plugin/bin/cap-n8n.js`

**Role:** package entry/config/CLI controller
**Data flow:** CLI process, module export, local command dispatch

**Analogs:**

- `cap-n8n-plugin/package.json`
- `package.json`
- `cap-n8n-plugin/index.js`
- `test/smoke/package-boundaries.test.js`
- `test/integration/n8n-execution-store.test.js`

**Package export pattern** (`cap-n8n-plugin/package.json` lines 5-18):

```json
"main": "index.js",
"exports": {
  ".": "./index.js",
  "./service": "./lib/N8nWorkflowService.js",
  "./mock-service": "./lib/MockN8nWorkflowService.js",
  "./index.cds": "./index.cds",
  "./cds-plugin": "./cds-plugin.js",
  "./cds-plugin.js": "./cds-plugin.js"
},
"files": [
  "index.js",
  "index.cds",
  "cds-plugin.js",
  "lib/"
]
```

**Apply to Phase 5:** add `bin` and any public workflow-tool exports in this same manifest style. Keep the CLI file inside package files, for example `bin/cap-n8n.js`, and expose workflow helpers only when they are intended as public API.

**Root script pattern** (`package.json` lines 10-19):

```json
"scripts": {
  "build": "npm run build --workspaces --if-present",
  "cap:serve": "npm run start --workspace demo-app",
  "cap:compile": "cds compile demo-app/db demo-app/srv demo-app/app --to csn",
  "smoke": "npm run build --workspace n8n-nodes-sap-cap && vitest run test/smoke",
  "test:integration": "vitest run test/integration",
  "test": "npm run smoke && npm run test:integration",
  "n8n:up": "docker compose up -d n8n",
  "n8n:export": "docker compose exec n8n n8n export:workflow --all --output=/test-workflows/workflows.json",
  "n8n:import": "docker compose exec n8n n8n import:workflow --input=/test-workflows/workflows.json"
}
```

**Apply to Phase 5:** add root/demo script wrappers only after `cap-n8n-plugin` has a real `bin` entry. Preserve existing Docker fixture scripts.

**Public package entry pattern** (`cap-n8n-plugin/index.js` lines 1-7):

```js
const N8nWorkflowService = require('./lib/N8nWorkflowService.js')
const MockN8nWorkflowService = require('./lib/MockN8nWorkflowService.js')

module.exports = {
  N8nWorkflowService,
  MockN8nWorkflowService
}
```

**Apply to Phase 5:** if exposing workflow import/validation helpers, require local CommonJS modules and add named exports. Do not turn package runtime code into ESM.

**Package-boundary test pattern** (`test/smoke/package-boundaries.test.js` lines 46-59):

```js
describe('package boundaries', () => {
  it('loads the CAP plugin through its package name', () => {
    const plugin = require('cap-n8n-plugin')
    const service = require('cap-n8n-plugin/service')
    const mockService = require('cap-n8n-plugin/mock-service')

    expect(plugin).toHaveProperty('N8nWorkflowService')
    expect(plugin).toHaveProperty('MockN8nWorkflowService')
    expect(typeof plugin.N8nWorkflowService).toBe('function')
    expect(typeof plugin.MockN8nWorkflowService).toBe('function')
    expect(plugin.N8nWorkflowService).toBe(service)
    expect(plugin.MockN8nWorkflowService).toBe(mockService)
    expect(require.resolve('cap-n8n-plugin/cds-plugin')).toMatch(/cds-plugin\.js$/)
  })
```

**Apply to Phase 5:** add smoke/integration checks that `require.resolve('cap-n8n-plugin/package-cli-export-if-any')` and the `bin` package metadata are valid.

**Child process CLI test pattern** (`test/integration/n8n-execution-store.test.js` lines 66-74):

```js
async function runNode(script) {
  return execFileAsync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  })
}
```

**Apply to Phase 5:** test `bin/cap-n8n.js` with `execFile(process.execPath, [cliPath, ...args])` or `npm exec` style calls. Pass credentials through `env`, not literal CLI args.

### `cap-n8n-plugin/lib/workflows/import.js` and `cap-n8n-plugin/lib/workflows/live-client.js`

**Role:** service
**Data flow:** local file-I/O, live request-response, workflow selection

**Analog:** `cap-n8n-plugin/lib/N8nWorkflowService.js`

**Imports and config pattern** (`cap-n8n-plugin/lib/N8nWorkflowService.js` lines 1-12):

```js
const cds = require('@sap/cds')
const { normalizeDuplicatePolicy, resolveN8nConfig } = require('./config')
const { createN8nError, isRetryableStatus, sanitizeDetails } = require('./errors')
const { ExecutionDispatcher } = require('./ExecutionDispatcher')
const { ExecutionStore } = require('./ExecutionStore')
const {
  createCancelResult,
  createDuplicateResult,
  createExecutionNotFoundResult,
  createStartResult,
  normalizeWebhookPath
} = require('./result')
```

**Apply to Phase 5:** keep workflow import modules CommonJS. Reuse `resolveN8nConfig` for live import defaults and `createN8nError` / `sanitizeDetails` for failed local/live imports.

**HTTP request pattern with API key** (`cap-n8n-plugin/lib/N8nWorkflowService.js` lines 475-485):

```js
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

**Apply to Phase 5:** live import should build `GET /api/v1/workflows/:id?excludePinnedData=true` and list requests with the same optional `X-N8N-API-KEY` convention. Keep base URL normalization local and do not log raw API keys.

**Fetch timeout pattern** (`cap-n8n-plugin/lib/N8nWorkflowService.js` lines 551-567):

```js
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

**Apply to Phase 5:** use the same `AbortController` pattern for live import fetches. Local imports do not need fetch; use `fs.promises.readFile` and JSON parsing with sanitized diagnostics.

**HTTP error pattern** (`cap-n8n-plugin/lib/N8nWorkflowService.js` lines 569-589):

```js
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
      attempt,
      attempts: maxAttempts,
      correlationId: options.correlationId,
      response: parseSafeErrorResponse(responseText),
      sensitiveValues: [this.apiKey].filter(Boolean)
    }
  })
}
```

**Apply to Phase 5:** create import-specific codes such as `ERR_N8N_WORKFLOW_IMPORT_HTTP_STATUS`, but keep `source: 'n8n'`, `statusCode`, `retryable`, and sanitized `details`.

**Config resolution pattern** (`cap-n8n-plugin/lib/config.js` lines 150-214):

```js
function resolveN8nConfig(options = {}, env = process.env) {
  const credentials = options.credentials || {}
  const duplicateOptions = options.duplicates || {}
  const duplicateCredentials = credentials.duplicates || {}
  const cancelOptions = options.cancel || options.cancellation || options.stop || {}
  const cancelCredentials = credentials.cancel || credentials.cancellation || credentials.stop || {}
  const configuredKind = normalizeKind(firstConfiguredValue(options.kind, options.mode))
  const baseUrl = firstConfiguredValue(credentials.baseUrl, options.baseUrl)
  const apiKey = firstConfiguredValue(credentials.apiKey, options.apiKey)
  ...
  if (baseUrl) config.baseUrl = baseUrl
  if (apiKey) config.apiKey = apiKey
  if (cancelApiBaseUrl) config.cancel.apiBaseUrl = cancelApiBaseUrl
  if (options.mock) config.mock = options.mock

  return assertWebhookConfig(config)
}
```

**Apply to Phase 5:** live import should read CAP config/env first and allow routing overrides such as base URL. Avoid literal `--api-key` support unless planner explicitly accepts the shell-history risk.

### `cap-n8n-plugin/lib/workflows/sanitize.js`, `artifacts.js`, and generated workflow JSON

**Role:** utility/generated artifact writer
**Data flow:** transform + file-I/O

**Analogs:**

- `cap-n8n-plugin/lib/errors.js`
- `cap-n8n-plugin/lib/result.js`
- `test/integration/n8n-execution-store.test.js`
- `test-workflows/workflows.json`

**Sensitive-key sanitizer pattern** (`cap-n8n-plugin/lib/errors.js` lines 1-16):

```js
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504])
const SENSITIVE_KEYS = new Set([
  'apikey',
  'api_key',
  'authorization',
  'x-n8n-api-key',
  'headers',
  'stack',
  'input',
  'inputs',
  'payload',
  'request',
  'requestbody'
])
const MAX_DETAIL_DEPTH = 4
const MAX_STRING_LENGTH = 500
```

**Recursive sanitization pattern** (`cap-n8n-plugin/lib/errors.js` lines 75-103):

```js
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

    const safeChild = sanitizeValue(childValue, sensitiveValues, depth + 1)
    if (safeChild !== undefined) sanitized[key] = safeChild
  }

  return sanitized
}

function sanitizeDetails(details = {}, sensitiveValues = []) {
  if (!details || typeof details !== 'object') return {}
  return sanitizeValue(details, [
    ...collectSensitiveValues(details),
    ...sensitiveValues.filter((value) => typeof value === 'string' && value)
  ])
}
```

**Apply to Phase 5:** use a workflow-specific allowlist plus recursive scrub rules. Do not only remove top-level fields. Generated `workflow.json` must remove fields like `shared`, owner/project metadata, pinned/static data, credentials, version counters, auth fields, and personal identifiers.

**Sanitized DTO test pattern** (`test/integration/n8n-execution-store.test.js` lines 179-227):

```js
it('stores and returns sanitized result and error envelopes', async () => {
  const queued = await store.createQueued({
    workflowId: 'secret-workflow'
  })

  await store.saveResult(queued.executionId, {
    ok: true,
    apiKey: 'result-api-key',
    headers: { authorization: 'Bearer result-token' },
    requestBody: { secret: 'request-body-secret' },
    inputs: { customer: 'raw-input-secret' },
    payload: { nested: 'payload-secret' },
    message: 'configured-secret-value should be removed'
  })
  ...
  expectNoForbiddenFields(dto)
  expect(serialized).not.toContain('result-api-key')
  expect(serialized).not.toContain('result-token')
  expect(serialized).not.toContain('request-body-secret')
  expect(serialized).not.toContain('raw-input-secret')
  expect(serialized).not.toContain('payload-secret')
  expect(serialized).not.toContain('configured-secret-value')
  expect(serialized).not.toContain('stack trace should not be public')
  expect(serialized).not.toContain('error-token')
  expect(serialized).not.toContain('error-payload-secret')
  expect(serialized).not.toContain('raw request body')
  expect(dto.error.details.response).toEqual({ message: 'safe diagnostic' })
})
```

**Apply to Phase 5:** add generated artifact tests that read every `demo-app/n8n/**/*.json` output and assert forbidden keys/fragments are absent.

**Optional metadata/result pattern** (`cap-n8n-plugin/lib/result.js` lines 25-29 and 47-82):

```js
function addOptionalValue(target, key, value) {
  if (value !== undefined && value !== null) {
    target[key] = value
  }
}

function createStartResult({
  workflowId,
  executionId,
  n8nExecutionId,
  correlationId,
  businessKey,
  tag,
  status,
  attempts,
  result,
  error,
  duplicate,
  mock
}) {
  const startResult = {
    accepted: true,
    workflowId
  }

  addOptionalValue(startResult, 'executionId', executionId)
  addOptionalValue(startResult, 'n8nExecutionId', n8nExecutionId)
  addOptionalValue(startResult, 'correlationId', correlationId)
  addOptionalValue(startResult, 'businessKey', businessKey)
  addOptionalValue(startResult, 'tag', tag)
  addOptionalValue(startResult, 'status', status)
  addOptionalValue(startResult, 'attempts', attempts)
  addOptionalValue(startResult, 'result', result)
  addOptionalValue(startResult, 'error', error)
  addOptionalValue(startResult, 'duplicate', duplicate)

  if (mock === true) {
    startResult.mock = true
  }

  return startResult
}
```

**Apply to Phase 5:** manifest builders should include provenance fields only when present, while always including `workflowKey`, artifact paths, source type, and accepted reference aliases.

**Raw fixture shape to sanitize** (`test-workflows/workflows.json` line 1):

The current fixture is a one-line n8n export array. It includes workflow identity, webhook node parameters, settings, pinned/static data, version metadata, shared/project metadata, and owner-like instance metadata. Preserve reviewable workflow structure such as `nodes`, `connections`, webhook `parameters.path`, webhook `parameters.httpMethod`, node `type`, and `typeVersion`; remove instance-specific and secret-bearing fields before writing `demo-app/n8n/workflows/<key>/workflow.json`.

### `cap-n8n-plugin/lib/workflows/schema.js`, `generate-cds.js`, generated `schema.json`, and generated `demo-app/n8n/index.cds`

**Role:** schema model and CDS generator
**Data flow:** validation model + transform + file-I/O

**Analogs:**

- `cap-n8n-plugin/lib/annotations/AnnotationParser.js`
- `cap-n8n-plugin/index.cds`
- `test/integration/n8n-annotation-contract.test.js`
- `test/integration/n8n-execution-store.test.js`

**Scalar field validation pattern** (`cap-n8n-plugin/lib/annotations/AnnotationParser.js` lines 187-229):

```js
function isScalarElement(element) {
  if (!element || typeof element !== 'object') return false
  if (element.target || element.items || element.elements) return false
  if (element.type === 'cds.Association' || element.type === 'cds.Composition') return false
  return true
}

function normalizeScalarPath(path, field, entity, annotation) {
  if (typeof path !== 'string' || !path.trim()) {
    throw createAnnotationError('n8n workflow annotation mapping must be a non-empty scalar field path.', {
      annotation,
      field,
      entity: entityName(entity)
    })
  }

  const normalizedPath = path.trim()
  const segments = normalizedPath.split('.')
  if (segments.length !== 1) {
    throw createAnnotationError('n8n workflow annotation mapping only supports single scalar fields.', {
      annotation,
      field,
      path: normalizedPath,
      entity: entityName(entity)
    })
  }

  const element = entity?.elements?.[normalizedPath]
  if (!isScalarElement(element)) {
    throw createAnnotationError('n8n workflow annotation mapping references a missing or non-scalar field.', {
      annotation,
      field,
      path: normalizedPath,
      entity: entityName(entity)
    })
  }

  return {
    path: normalizedPath,
    key: element.key === true,
    type: element.type
  }
}
```

**Apply to Phase 5:** sidecar schema validation should use the same strict helper style: normalize input names, validate supported scalar types, reject unsupported nested/full JSON Schema constructs in Phase 5, and return structured details.

**Generated CDS style analog** (`cap-n8n-plugin/index.cds` lines 1-18):

```cds
namespace cap.n8n;

entity WorkflowExecutions {
  key executionId    : UUID;
      n8nExecutionId : String(128);
      correlationId  : String(255);
      workflowId     : String(500);
      status         : String(32);
      businessKey    : String(255);
      tag            : String(255);
      attempts       : Integer default 0;
      createdAt      : Timestamp;
      startedAt      : Timestamp;
      finishedAt     : Timestamp;
      updatedAt      : Timestamp;
      result         : LargeString;
      error          : LargeString;
}
```

**Apply to Phase 5:** generated CDS should use CDS/CDL syntax, semicolon terminators, aligned fields, and a namespace. Use app-local namespace names that avoid collision with `cap.n8n` runtime entities.

**CSN compile helper pattern** (`test/integration/n8n-annotation-contract.test.js` lines 19-24):

```js
function compileEntity(source, name = 'test.Books') {
  const csn = cds.compile.to.csn(source)
  return {
    name,
    ...csn.definitions[name]
  }
}
```

**Apply to Phase 5:** generated CDS tests should compile the generated source with `cds.compile.to.csn` or `cds.load` and assert the generated workflow input type definitions are present.

**Model load assertion pattern** (`test/integration/n8n-execution-store.test.js` lines 267-286):

```js
describe('n8n execution model integration contract', () => {
  it('loads the plugin-owned WorkflowExecutions model with first-class fields', async () => {
    const csn = await cds.load(pluginModel)
    const execution = csn.definitions['cap.n8n.WorkflowExecutions']
    const dispatch = csn.definitions['cap.n8n.WorkflowDispatches']

    expect(execution).toBeDefined()
    expect(dispatch).toBeDefined()
    expect(Object.keys(execution.elements)).toEqual(expect.arrayContaining([
      ...firstClassFields,
      'n8nExecutionId',
      'result',
      'error'
    ]))
    expect(execution.elements.executionId.key).toBe(true)
    expect(execution.elements.executionId.type).toBe('cds.UUID')
    expect(execution.elements.attempts.type).toBe('cds.Integer')
    expect(execution.elements.result.type).toBe('cds.LargeString')
    expect(execution.elements.error.type).toBe('cds.LargeString')
  })
```

**Apply to Phase 5:** assert generated `demo-app/n8n/index.cds` contributes expected CSN definitions and scalar types for each sidecar input.

### `cap-n8n-plugin/lib/workflows/validate.js`, `diagnostics.js`, `BuildValidationPlugin.js`, and `cap-n8n-plugin/cds-plugin.js`

**Role:** validation service, diagnostics utility, CAP build plugin, plugin bootstrap
**Data flow:** batch/build validation + event-driven registration

**Analogs:**

- `cap-n8n-plugin/lib/annotations/AnnotationParser.js`
- `demo-app/srv/admin-service.cds`
- `cap-n8n-plugin/cds-plugin.js`
- `node_modules/@sap/cds-dk/lib/build/plugins/plugin.js`
- `node_modules/@sap/cds-dk/lib/build/util.js`

**Annotation shape to validate** (`demo-app/srv/admin-service.cds` lines 10-27):

```cds
annotate AdminService.Books with @n8n.workflow.start: {
  workflowId: 'webhook-test/cap-test-trigger',
  on: ['CREATE', 'UPDATE'],
  inputs: {
    bookId: 'ID',
    title: 'title'
  },
  if: 'stock > 0',
  businessKey: 'ID',
  tag: 'admin-books'
};

annotate AdminService.Books with @n8n.workflow.cancel: {
  workflowId: 'webhook-test/cap-test-trigger',
  on: ['DELETE'],
  businessKey: 'ID',
  tag: 'admin-books'
};
```

**Apply to Phase 5:** validate `start.workflowId` and `start.inputs` against generated workflow manifests/schemas. Build reference aliases from manifest data so `cap-test-trigger`, `webhook/cap-test-trigger`, and `webhook-test/cap-test-trigger` can resolve to the same imported workflow when appropriate.

**Parser output pattern** (`cap-n8n-plugin/lib/annotations/AnnotationParser.js` lines 236-268 and 271-324):

```js
function normalizeInputs(value, events, annotation, entity) {
  if (value === undefined || value === null) return undefined
  assertObject(value, 'inputs', {
    annotation,
    entity: entityName(entity)
  })

  const inputs = {}
  for (const [name, path] of Object.entries(value)) {
    if (!name || /^\d+$/.test(name)) {
      throw createAnnotationError('n8n workflow input names must be non-empty strings.', {
        annotation,
        field: 'inputs',
        entity: entityName(entity)
      })
    }
    inputs[name] = normalizeScalarPath(path, `inputs.${name}`, entity, annotation)
  }

  if (events.includes('DELETE')) {
    for (const [name, mapping] of Object.entries(inputs)) {
      if (!mapping.key) {
        throw createAnnotationError('n8n workflow DELETE annotations only support key input mappings.', {
          annotation,
          field: `inputs.${name}`,
          path: mapping.path,
          entity: entityName(entity)
        })
      }
    }
  }

  return inputs
}

function normalizeStart(config, entity) {
  assertAllowedFields(config, START_FIELDS, START_PREFIX, entity)
  const on = normalizeEvents(config.on, ['CREATE'], START_PREFIX, entity)
  const start = {
    workflowId: normalizeWorkflowId(config.workflowId, START_PREFIX, entity),
    on
  }
  ...
  return start
}

function readWorkflowAnnotations(definition, context = {}) {
  const entity = context.entity || definition
  const rawStart = readRawConfig(definition, START_PREFIX, entity)
  const rawCancel = readRawConfig(definition, CANCEL_PREFIX, entity)

  return {
    start: rawStart ? normalizeStart(rawStart, entity) : undefined,
    cancel: rawCancel ? normalizeCancel(rawCancel, entity) : undefined
  }
}
```

**Apply to Phase 5:** do not parse CDS text. Load CSN, iterate `csn.definitions`, call `readWorkflowAnnotations(definition, { entity: definition, name })`, then compare `start.inputs` to generated sidecar contracts.

**Runtime plugin lifecycle pattern** (`cap-n8n-plugin/cds-plugin.js` lines 39-57):

```js
cds.on('served', (services) => {
  for (const srv of servedServices(services)) {
    registerN8nAnnotations(srv);
  }
});

cds.once('bootstrap', () => {
  const n8nConfig = registerModel();
  if (n8nConfig.impl) {
    cds.log('n8n').info('cap-n8n-plugin loaded. Preserving explicit n8n service implementation.');
    return;
  }

  const resolvedConfig = resolveN8nConfig(n8nConfig);
  n8nConfig.kind = n8nConfig.kind || resolvedConfig.kind;
  n8nConfig.impl = implementationForKind(resolvedConfig.kind);

  cds.log('n8n').info(`cap-n8n-plugin loaded. Registered ${resolvedConfig.kind} n8n service implementation.`);
});
```

**Apply to Phase 5:** extend this file carefully. Preserve runtime registration and explicit implementation override behavior. Register the build plugin only when `cds.build` and `cds.build.register` exist so normal runtime bootstrap is not broken.

**CAP build plugin API pattern** (`node_modules/@sap/cds-dk/lib/build/plugins/plugin.js` lines 35-83):

```js
module.exports = class Plugin {
    static INFO = SEVERITY_INFO
    static WARNING = SEVERITY_WARNING
    static ERROR = SEVERITY_ERROR
    ...
    /**
     * Determines whether a task of this type will be created when cds build is executed,
     * returns true by default.
     */
    static hasTask() {
        return true
    }
```

**Build model/messages pattern** (`node_modules/@sap/cds-dk/lib/build/plugins/plugin.js` lines 211-230):

```js
pushMessage(message, severity) {
    this.messages.push(new BuildMessage(message, severity))
}

async model() {
    const { src, options: { model }, for: type } = this.task
    const files = cds.resolve(model || src)
    if (!files || files.length === 0) {
        console.log(`no CDS model found for [${type}] build task [${src}] - nothing to be done`)
        return
    }
    DEBUG?.(`model: ${relativePaths(cds.root, files).join(", ")}`)

    const options = { ...this.options(), cwd: cds.root }
    return cds.load(files, options)
}
```

**Apply to Phase 5:** `BuildValidationPlugin.build()` should call `await this.model()`, pass the CSN and app root to the shared validator, push warnings/errors as messages, and throw a `BuildError` when errors exist.

**BuildError pattern** (`node_modules/@sap/cds-dk/lib/build/util.js` lines 465-501):

```js
class BuildError extends Error {
    messages

    constructor(message, messages = []) {
        super(message)
        this.name = "BuildError"
        this.messages = Array.isArray(messages) ? messages : [messages]
    }

    get errors() {
        return this.messages
    }

    toString() {
        return this.message + (this.messages.length > 0 ? '\n' + this.messages.map(m => m.toString()).join('\n') : '')
    }
}
...
    BuildMessage,
    BuildError
}
```

**Apply to Phase 5:** build validation warnings should not fail the build, but missing required inputs and type mismatches should produce messages and a thrown `BuildError`.

### `test/integration/n8n-workflow-import.test.js`

**Role:** integration test
**Data flow:** file-I/O + deterministic transform

**Analogs:**

- `test/integration/n8n-annotation-contract.test.js`
- `test/smoke/package-boundaries.test.js`
- `test/integration/n8n-execution-store.test.js`

**Vitest + CommonJS bridge pattern** (`test/integration/n8n-annotation-contract.test.js` lines 1-13):

```js
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')
const {
  readWorkflowAnnotations,
  createAnnotationError
} = require('../../cap-n8n-plugin/lib/annotations/AnnotationParser.js')
const {
  compileCondition,
  evaluateCondition
} = require('../../cap-n8n-plugin/lib/annotations/ConditionEvaluator.js')
```

**Apply to Phase 5:** integration tests can remain ESM for Vitest while requiring CommonJS package modules through `createRequire`.

**Package JSON read helper pattern** (`test/smoke/package-boundaries.test.js` lines 12-14):

```js
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}
```

**Apply to Phase 5:** use Node `fs` helpers to inspect generated `workflow.json`, `schema.json`, and `manifest.json`; do not require Docker n8n for offline import tests.

**Forbidden public fields helper** (`test/integration/n8n-execution-store.test.js` lines 80-95):

```js
function expectNoForbiddenFields(value) {
  if (!value || typeof value !== 'object') return

  for (const field of forbiddenPublicFields) {
    expect(value).not.toHaveProperty(field)
  }

  if (Array.isArray(value)) {
    for (const item of value) expectNoForbiddenFields(item)
    return
  }

  for (const child of Object.values(value)) {
    expectNoForbiddenFields(child)
  }
}
```

**Apply to Phase 5:** scan generated artifacts recursively for forbidden fields and known fixture-only metadata. Also assert repeated imports produce byte-stable JSON.

### `test/integration/n8n-workflow-live-import.test.js`

**Role:** integration test
**Data flow:** fake HTTP request-response

**Analog:** `test/integration/n8n-webhook-runtime.test.js`

**Fake server pattern** (`test/integration/n8n-webhook-runtime.test.js` lines 58-99):

```js
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
    if (response === undefined) return

    res.statusCode = response.statusCode ?? 200
    res.setHeader('content-type', response.contentType ?? 'application/json')
    res.end(response.body ?? JSON.stringify({ received: true, executionId: 'exec-1' }))
  })
  ...
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const { port } = server.address()
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve, reject) => {
      for (const socket of sockets) socket.destroy()
      server.close((err) => err ? reject(err) : resolve())
    })
  }
}
```

**Apply to Phase 5:** adapt this to fake `/api/v1/workflows/:id` and `/api/v1/workflows`. Assert `X-N8N-API-KEY` is present only when configured, and verify `excludePinnedData=true` if implemented.

**API key assertion pattern** (`test/integration/n8n-webhook-runtime.test.js` lines 117-148):

```js
it('sends X-N8N-API-KEY only when an apiKey is configured', async () => {
  await deployExecutionModel()
  const secretApiKey = 'test-secret-api-key'
  const authedServer = await createWebhookServer(() => ({
    body: JSON.stringify({ received: true })
  }))
  ...
  expect(authedServer.requests[0].headers['x-n8n-api-key']).toBe(secretApiKey)
  ...
  expect(anonymousServer.requests[0].headers).not.toHaveProperty('x-n8n-api-key')
})
```

**Apply to Phase 5:** test live import auth behavior without a live n8n instance.

### `test/integration/n8n-workflow-build-validation.test.js`

**Role:** integration test
**Data flow:** CAP model compile/build + diagnostics

**Analogs:**

- `test/integration/n8n-annotations-start.test.js`
- `test/integration/n8n-annotations-demo.test.js`
- `test/integration/n8n-execution-store.test.js`

**Temp CAP service/model pattern** (`test/integration/n8n-annotations-start.test.js` lines 41-91):

```js
function annotationsModel(annotations = '') {
  return `
    namespace test.annotations;

    entity SourceBooks {
      key ID : Integer;
      title : String;
      stock : Integer;
      archived : Boolean default false;
    }

    service AnnotationStartService {
      entity Books as projection on SourceBooks;
    }

    ${annotations}
  `
}

async function loadModel(annotations) {
  const executionCsn = await cds.load(pluginModel)
  const appCsn = cds.compile.to.csn(annotationsModel(annotations))

  return {
    ...executionCsn,
    $sources: [
      ...(executionCsn.$sources || []),
      ...(appCsn.$sources || [])
    ],
    definitions: {
      ...executionCsn.definitions,
      ...appCsn.definitions
    }
  }
}

async function serveAnnotatedService(annotations) {
  const csn = await loadModel(annotations)
  db = await cds.deploy(csn).to('sqlite::memory:')
  const srv = await cds.serve(serviceName).from(csn)

  ensurePluginLifecycle()
  await cds.emit('served', cds.services)

  return srv
}
```

**Apply to Phase 5:** build-validation tests should create temp app roots with minimal `db`, `srv`, and `n8n` artifacts. Use `cds.load` or `cds compile` for direct validator tests, then `cds build --project <tmp-app>` for build plugin tests.

**Demo annotation CSN assertion pattern** (`test/integration/n8n-annotations-demo.test.js` lines 218-240):

```js
describe('demo AdminService n8n annotations', () => {
  it('compiles n8n start and cancel annotations on the AdminService.Books projection only', async () => {
    const csn = await loadDemoModel()
    const adminBooks = csn.definitions['AdminService.Books']
    const domainBooks = csn.definitions[sourceBooks]
    const catalogBooks = csn.definitions['CatalogService.Books']

    expect(adminBooks).toMatchObject({
      '@n8n.workflow.start.workflowId': workflowId,
      '@n8n.workflow.start.on': ['CREATE', 'UPDATE'],
      '@n8n.workflow.start.inputs.bookId': 'ID',
      '@n8n.workflow.start.inputs.title': 'title',
      '@n8n.workflow.start.if': 'stock > 0',
      '@n8n.workflow.start.businessKey': 'ID',
      '@n8n.workflow.start.tag': 'admin-books',
      '@n8n.workflow.cancel.workflowId': workflowId,
      '@n8n.workflow.cancel.on': ['DELETE'],
      '@n8n.workflow.cancel.businessKey': 'ID',
      '@n8n.workflow.cancel.tag': 'admin-books'
    })
    expect(Object.keys(domainBooks).filter((key) => key.startsWith('@n8n.workflow'))).toEqual([])
    expect(Object.keys(catalogBooks).filter((key) => key.startsWith('@n8n.workflow'))).toEqual([])
  })
```

**Apply to Phase 5:** assert validation reads annotations from the projection where they are defined, not from the persistence entity or unrelated services.

**Sanitized side-effect failure assertion pattern** (`test/integration/n8n-annotations-start.test.js` lines 436-495):

```js
it('keeps CREATE UPDATE and DELETE writes committed when n8n side effects fail', async () => {
  const server = await createWebhookServer(() => ({
    statusCode: 503,
    body: JSON.stringify({
      error: 'temporary failure',
      apiKey: 'annotation-test-api-key',
      requestBody: 'request-body-secret',
      stack: 'stack trace should not be exposed'
    })
  }))
  ...
  expect(result.items).toHaveLength(3)
  for (const item of result.items) {
    expect(item).toMatchObject({
      workflowId: 'annotation-failed-dispatch',
      status: 'failed',
      attempts: 1,
      error: {
        source: 'n8n',
        statusCode: 503,
        retryable: true,
        code: 'ERR_N8N_RETRYABLE_STATUS',
        message: 'n8n webhook request failed with status 503.'
      }
    })
    expectPublicDtoIsSanitized(item)
  }
})
```

**Apply to Phase 5:** build and CLI validator outputs should be sanitized and specific. Assert diagnostics include entity, workflow reference/key, input name, and reason, while excluding raw secrets or response bodies.

## Shared Patterns

### CommonJS and Local Style

**Source:** `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/lib/annotations/*.js`
**Apply to:** all new `cap-n8n-plugin/lib/workflows/*.js` files and package CLI internals

Use CommonJS, two-space indentation, single quotes, camelCase helpers, and mostly no semicolons in `lib/**`.

### Authentication and Credential Handling

**Source:** `cap-n8n-plugin/lib/config.js` lines 150-214 and `cap-n8n-plugin/lib/N8nWorkflowService.js` lines 475-485
**Apply to:** live import client, CLI validation/import config loading, tests

Credentials should flow through CAP config/environment and optional service options. Do not write API keys to manifests, generated JSON, diagnostics, or committed fixtures.

### Annotation Interpretation

**Source:** `cap-n8n-plugin/lib/annotations/AnnotationParser.js`
**Apply to:** `validate.js`, `BuildValidationPlugin.js`, `cap-n8n validate`

The validator must consume CSN and `readWorkflowAnnotations`; do not regex-scan `.cds` source.

### Sanitized Diagnostics

**Source:** `cap-n8n-plugin/lib/errors.js` and `cap-n8n-plugin/lib/result.js`
**Apply to:** import errors, live HTTP errors, validator diagnostics, build plugin messages, generated result objects

Use structured errors and recursive sanitization. Any diagnostic model should carry `source`, `code`, `message`, `statusCode` where applicable, and details that have been scrubbed.

### Generated Artifact Layout

**Source:** Phase context and research; no existing app-local `n8n/` artifact directory
**Apply to:** `artifacts.js`, `manifest.js`, generated `demo-app/n8n/**`

Keep generated artifacts in the consuming CAP app under `n8n/`. Use stable workflow keys and put source n8n IDs, names, webhook path, accepted aliases, source type, and provenance in manifests.

### Build Validation

**Source:** `node_modules/@sap/cds-dk/lib/build/plugins/plugin.js` and `node_modules/@sap/cds-dk/lib/build/util.js`
**Apply to:** `BuildValidationPlugin.js`, `cds-plugin.js`

Push warnings/errors as build messages. Throw `BuildError` only when validation has errors. Warnings for extra inputs, unknown artifacts, and untyped references should not fail the build.

### Integration Tests

**Source:** `test/integration/*.test.js`
**Apply to:** all Phase 5 tests

Use Vitest integration tests, `createRequire` for CommonJS modules, fake HTTP servers with Node `http`, temp CAP models/apps, and no Docker dependency for automated tests.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `cap-n8n-plugin/bin/cap-n8n.js` | controller | CLI request-response | No package CLI or `bin` entry exists yet. Use package export style and child-process test patterns. |
| `cap-n8n-plugin/lib/workflows/BuildValidationPlugin.js` | build plugin | batch/build | No project-local CAP build plugin exists. Use installed `@sap/cds-dk` plugin API patterns and keep project registration in `cds-plugin.js`. |
| `demo-app/n8n/workflows/<workflow-key>/schema.json` | generated artifact | validation model | No sidecar workflow schema exists yet. Implement from Phase 5 scalar subset decisions, not from existing n8n workflow JSON inference. |

## Metadata

**Analog search scope:** `cap-n8n-plugin/`, `demo-app/`, `test/integration/`, `test/smoke/`, `test-workflows/`, root package manifests, targeted `node_modules/@sap/cds-dk/lib/build/*` API files
**Files scanned:** 60+ repository files via `rg --files`, 16 analog/source files read with line numbers, plus 3 targeted CAP build API files
**Pattern extraction date:** 2026-06-03

