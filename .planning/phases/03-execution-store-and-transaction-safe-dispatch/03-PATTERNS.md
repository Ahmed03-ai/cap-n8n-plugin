# Phase 3: Execution Store and Transaction-Safe Dispatch - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 14 recommended new/modified files
**Analogs found:** 12 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `cap-n8n-plugin/lib/N8nWorkflowService.js` | service | request-response, event-driven | `cap-n8n-plugin/lib/N8nWorkflowService.js` | exact |
| `cap-n8n-plugin/lib/MockN8nWorkflowService.js` | service, store | CRUD, event-driven | `cap-n8n-plugin/lib/MockN8nWorkflowService.js` | exact |
| `cap-n8n-plugin/lib/ExecutionStore.js` | service, store | CRUD | `cap-n8n-plugin/lib/MockN8nWorkflowService.js`; `demo-app/srv/cat-service.js` | role-match |
| `cap-n8n-plugin/lib/ExecutionDispatcher.js` | service, utility | queued dispatch, retry | `cap-n8n-plugin/lib/N8nWorkflowService.js` | role-match |
| `cap-n8n-plugin/lib/result.js` | utility | transform | `cap-n8n-plugin/lib/result.js` | exact |
| `cap-n8n-plugin/lib/errors.js` | utility | transform | `cap-n8n-plugin/lib/errors.js` | exact |
| `cap-n8n-plugin/lib/config.js` | config | transform | `cap-n8n-plugin/lib/config.js` | exact |
| `cap-n8n-plugin/db/schema.cds` or equivalent plugin model | model | CRUD | `demo-app/db/schema.cds` | role-match |
| `cap-n8n-plugin/index.js` | package export | transform | `cap-n8n-plugin/index.js` | exact |
| `cap-n8n-plugin/package.json` | package config | config | `cap-n8n-plugin/package.json` | exact |
| `test/integration/n8n-execution-store.test.js` | test | CRUD, request-response | `test/integration/n8n-service-contract.test.js` | role-match |
| `test/integration/n8n-dispatch-and-duplicates.test.js` | test | queued dispatch, retry | `test/integration/n8n-webhook-runtime.test.js` | role-match |
| `test/integration/n8n-query-cancel.test.js` | test | CRUD, request-response | `test/integration/n8n-mock-and-profiles.test.js` | role-match |
| `test/smoke/package-boundaries.test.js` | test | package boundary | `test/smoke/package-boundaries.test.js` | exact |

## Pattern Assignments

### `cap-n8n-plugin/lib/N8nWorkflowService.js` (service, request-response/event-driven)

**Analog:** `cap-n8n-plugin/lib/N8nWorkflowService.js`

**Imports pattern** (lines 1-4):
```javascript
const cds = require('@sap/cds')
const { resolveN8nConfig } = require('./config')
const { createN8nError, isRetryableStatus } = require('./errors')
const { createStartResult, normalizeWebhookPath } = require('./result')
```

**CAP service event compatibility** (lines 34-45):
```javascript
class N8nWorkflowService extends cds.Service {
  async init() {
    this.config = resolveN8nConfig({ ...(this.options || {}), kind: 'webhook' })

    this.on('start', (req) => this.start(req.data.workflowId, req.data.inputs, req.data.options || req.data))

    await super.init()
  }
}
```

**Copy guidance:** Add `this.on('getExecution', ...)`, `this.on('queryExecutions', ...)`, and `this.on('cancel', ...)` beside `start`. Preserve `start(workflowId, inputs = {}, options = {})` as the public method and keep `n8n.send('start', ...)` compatible.

**Transport/retry pattern** (lines 64-115):
```javascript
const maxAttempts = Math.max(1, this.retries || 1)
let lastError

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    const response = await this._fetchWebhook(url, headers, inputs)
    const responseText = await response.text()

    if (!response.ok) {
      throw this._createHttpError({ response, responseText, workflowId, options, attempt, maxAttempts })
    }

    const result = parseWebhookResponse(responseText)
    return createStartResult({ workflowId, executionId: result?.executionId, correlationId: options.correlationId, businessKey: options.businessKey, result })
  } catch (err) {
    lastError = this._normalizeTransportError(err, { workflowId, options, attempt, maxAttempts })
    if (!lastError.retryable || attempt >= maxAttempts) throw lastError
    await delay(this._retryDelay(attempt))
  }
}
```

**Copy guidance:** Split webhook dispatch enough that queued after-commit delivery can reuse the same URL/header/fetch/error behavior without changing the Phase 2 `start()` result shape. Persist plugin-owned `executionId` first; store any n8n-returned execution ID separately as `n8nExecutionId`.

### `cap-n8n-plugin/lib/ExecutionStore.js` (store, CRUD)

**Analogs:** `cap-n8n-plugin/lib/MockN8nWorkflowService.js`; `demo-app/srv/cat-service.js`

**In-memory execution record shape** (lines 45-68):
```javascript
const executionId = `mock-exec-${this._nextExecution++}`
const startedAt = new Date().toISOString()
const record = {
  executionId,
  workflowId,
  inputs: inputs || {},
  status: 'success',
  startedAt
}

addOptionalValue(record, 'correlationId', options.correlationId)
addOptionalValue(record, 'businessKey', options.businessKey)
```

**CAP query/update style** (`demo-app/srv/cat-service.js` lines 14-25):
```javascript
this.on('submitOrder', async req => {
  let { book:id, quantity } = req.data
  let book = await SELECT.one.from (Books, id, b => b.stock)

  if (!book) return req.error (404, `Book #${id} doesn't exist`)

  await UPDATE (Books, id) .with ({ stock: book.stock -= quantity })
  return book
})
```

**Copy guidance:** Use a package-owned store abstraction instead of writing persistence logic directly in `N8nWorkflowService`. Support `createQueued`, `markDispatching`, `markRunning`, `markSucceeded`, `markFailed`, `getExecution`, `queryExecutions`, `findActiveDuplicates`, and `requestCancel`-style methods. Do not expose `inputs` or request payloads in query results; Phase 3 requires sanitized `result` and `error` envelopes.

### `cap-n8n-plugin/lib/ExecutionDispatcher.js` (dispatcher, queued retry/outbox)

**Analog:** `cap-n8n-plugin/lib/N8nWorkflowService.js`

**Fetch/timeout pattern** (lines 121-137):
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

**Retry log pattern** (lines 187-195):
```javascript
cds.log('n8n').warn('Retrying n8n workflow start after transient failure', {
  workflowId,
  attempt,
  attempts: maxAttempts,
  reason: error.code,
  statusCode: error.statusCode,
  correlationId: options.correlationId
})
```

**Copy guidance:** There is no existing after-commit/outbox implementation in the repo. Keep the dispatcher small and testable: load queued records from `ExecutionStore`, increment attempts, call the existing webhook transport path, and persist status/error transitions. Logs must include workflow ID, execution ID, attempt metadata, and correlation ID when present, but no inputs, auth headers, or configured secret values.

### `cap-n8n-plugin/lib/result.js` (result helper, transform)

**Analog:** `cap-n8n-plugin/lib/result.js`

**Optional envelope pattern** (lines 25-47):
```javascript
function addOptionalValue(target, key, value) {
  if (value !== undefined && value !== null) {
    target[key] = value
  }
}

function createStartResult({ workflowId, executionId, correlationId, businessKey, result, mock }) {
  const startResult = {
    accepted: true,
    workflowId
  }

  addOptionalValue(startResult, 'executionId', executionId)
  addOptionalValue(startResult, 'correlationId', correlationId)
  addOptionalValue(startResult, 'businessKey', businessKey)
  addOptionalValue(startResult, 'result', result)
}
```

**Copy guidance:** Extend this helper or add adjacent result helpers for `createExecutionResult`, `createQueryResult`, `createCancelResult`, and duplicate/no-op signals. Keep plain objects, optional metadata, and schema-friendly fields. Preserve Phase 2 `createStartResult` behavior.

### `cap-n8n-plugin/lib/errors.js` (error helper, sanitization)

**Analog:** `cap-n8n-plugin/lib/errors.js`

**Sensitive-key and sanitizer pattern** (lines 1-14, 75-99):
```javascript
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

function sanitizeValue(value, sensitiveValues, depth = 0) {
  if (depth > MAX_DETAIL_DEPTH) return '[omitted]'
  if (value === undefined || value === null) return value
  if (typeof value === 'string') return sanitizeString(value, sensitiveValues)
  if (typeof value !== 'object') return value
}
```

**Error factory pattern** (lines 102-113):
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

**Copy guidance:** Store execution errors using the same safe fields: `source`, `statusCode`, `retryable`, `code`, `message`, and sanitized `details`. If the store needs direct sanitization, expose a helper from `errors.js` rather than duplicating the redaction list.

### `cap-n8n-plugin/lib/config.js` (config resolver)

**Analog:** `cap-n8n-plugin/lib/config.js`

**Normalization pattern** (lines 6-20, 23-40):
```javascript
function firstConfiguredValue(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (value !== undefined && value !== null && typeof value !== 'string') return value
  }
}

function createConfigError(message, details = {}) {
  const error = new Error(message)
  error.code = 'ERR_N8N_CONFIG'
  error.source = 'n8n'
  error.statusCode = 500
  error.retryable = false
  error.details = details
  return error
}
```

**Retry config pattern** (lines 65-99):
```javascript
function normalizeRetry(options = {}) {
  const retryOptions = options.retry || {}
  const retryCredentials = options.credentials?.retry || {}

  return {
    attempts: retries,
    minDelayMs: retryDelayMs,
    maxDelayMs: normalizeNonNegativeInteger(firstConfiguredValue(
      retryOptions.maxDelayMs,
      retryCredentials.maxDelayMs,
      Math.max(retryDelayMs, DEFAULT_RETRY_DELAY_MS * 4)
    ), Math.max(retryDelayMs, DEFAULT_RETRY_DELAY_MS * 4)),
    retries,
    retryDelayMs
  }
}
```

**Copy guidance:** Add execution-store, duplicate-policy, dispatch, and mock-completion settings using this resolver style. Default duplicate policy should be `warn`; stricter per-call options can request `reject` or `reuseActive`.

### `cap-n8n-plugin/lib/MockN8nWorkflowService.js` (mock service/store)

**Analog:** `cap-n8n-plugin/lib/MockN8nWorkflowService.js`

**Mock setup and event compatibility** (lines 34-42):
```javascript
class MockN8nWorkflowService extends cds.Service {
  async init() {
    this.config = resolveN8nConfig({ ...(this.options || {}), kind: 'mock' })
    this.executions = []
    this._nextExecution = 1

    this.on('start', (req) => this.start(req.data.workflowId, req.data.inputs, req.data.options || req.data))

    await super.init()
  }
}
```

**Copy guidance:** Keep deterministic execution IDs, but change status vocabulary from `success` to Phase 3 lifecycle values such as `running`, `succeeded`, `failed`, `cancel_requested`, and `cancelled`. Add `getExecution`, `queryExecutions`, and `cancel` methods plus matching `this.on(...)` handlers. Existing tests currently assert no query/cancel APIs; update those assertions to prove the new APIs exist.

### `cap-n8n-plugin/db/schema.cds` or equivalent plugin model (model, CRUD)

**Analog:** `demo-app/db/schema.cds`

**CAP model import/entity pattern** (lines 1-19):
```cds
using {
  Currency,
  cuid,
  managed,
  sap
} from '@sap/cds/common';

namespace sap.capire.bookshop;

entity Books : managed {
  key ID       : Integer;
      author   : Association to Authors @mandatory;
      title    : localized String       @mandatory;
}
```

**Copy guidance:** Use a plugin-owned namespace such as `cap.n8n` and a durable execution entity with first-class fields from Phase 3: `executionId`, `n8nExecutionId`, `correlationId`, `workflowId`, `status`, `businessKey`, `tag`, `attempts`, `createdAt`, `startedAt`, `finishedAt`, `updatedAt`, `result`, and `error`. No exact package-owned CDS model analog exists, so treat the demo schema as role-match only.

### `cap-n8n-plugin/index.js` and `cap-n8n-plugin/package.json` (package boundary)

**Analogs:** `cap-n8n-plugin/index.js`; `cap-n8n-plugin/package.json`

**Export pattern** (`index.js` lines 1-7):
```javascript
const N8nWorkflowService = require('./lib/N8nWorkflowService.js')
const MockN8nWorkflowService = require('./lib/MockN8nWorkflowService.js')

module.exports = {
  N8nWorkflowService,
  MockN8nWorkflowService
}
```

**Package subpath/files pattern** (`package.json` lines 6-17):
```json
"exports": {
  ".": "./index.js",
  "./service": "./lib/N8nWorkflowService.js",
  "./mock-service": "./lib/MockN8nWorkflowService.js",
  "./cds-plugin": "./cds-plugin.js",
  "./cds-plugin.js": "./cds-plugin.js"
},
"files": [
  "index.js",
  "cds-plugin.js",
  "lib/"
]
```

**Copy guidance:** Keep store/dispatcher helpers internal unless consumers need a supported API. If adding a plugin CDS model directory, include it in `"files"`. If adding public subpaths, update `test/smoke/package-boundaries.test.js`.

## Testing Patterns

### CAP service contract tests

**Source:** `test/integration/n8n-service-contract.test.js`

**Setup/reset pattern** (lines 8-33):
```javascript
const originalN8nConfig = cds.env.requires?.n8n

function configureN8n(baseUrl) {
  cds.env.requires ??= {}
  cds.env.requires.n8n = {
    impl: 'cap-n8n-plugin/service',
    credentials: { baseUrl }
  }
}

async function resetN8nService() {
  try {
    await cds.disconnect('n8n')
  } catch (err) {
    // Service may not have been connected yet.
  }
  delete cds.services.n8n
}
```

**Service call/assertion pattern** (lines 91-118, 132-148):
```javascript
const n8n = await cds.connect.to('n8n')
const result = await n8n.start('cap-test-trigger', { event: 'BookCreated' }, {
  correlationId: 'corr-1',
  businessKey: 'book-1'
})

const sendResult = await n8n.send('start', {
  workflowId: 'cap-test-trigger',
  inputs: { event: 'BookCreated' }
})
```

**Apply to:** Execution store, `getExecution`, `queryExecutions`, `cancel`, and send-compatible event tests.

### Webhook dispatch/retry tests

**Source:** `test/integration/n8n-webhook-runtime.test.js`

**Local HTTP server pattern** (lines 40-80):
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
    if (response === undefined) return
    res.statusCode = response.statusCode ?? 200
    res.end(response.body ?? JSON.stringify({ received: true, executionId: 'exec-1' }))
  })
}
```

**Retry and sanitization assertions** (lines 130-163, 220-267): Copy this style for after-commit dispatch failure visibility, attempts incrementing, and persisted sanitized errors. Tests should assert no API key, input secret, stack trace, headers, or request payload appears in stored execution data.

### Mock query/cancel tests

**Source:** `test/integration/n8n-mock-and-profiles.test.js`

**Mock config pattern** (lines 18-25):
```javascript
function configureMockN8n(options = {}) {
  cds.env.requires ??= {}
  cds.env.requires.n8n = {
    kind: 'mock',
    impl: require.resolve('../../cap-n8n-plugin/lib/MockN8nWorkflowService.js'),
    ...options
  }
}
```

**Mock record assertions** (lines 147-172):
```javascript
expect(result).toMatchObject({
  accepted: true,
  workflowId: 'cap-test-trigger',
  executionId: 'mock-exec-1',
  correlationId: 'corr-1',
  businessKey: 'book-1',
  mock: true
})
expect(n8n.executions[0]).toMatchObject({
  executionId: 'mock-exec-1',
  workflowId: 'cap-test-trigger',
  status: 'success'
})
```

**Apply to:** Deterministic running/completion delay, explicit completion helper if implemented, state-aware cancellation, query paging, and duplicate detection in mock mode.

### Package boundary tests

**Source:** `test/smoke/package-boundaries.test.js`

**CAP plugin boundary pattern** (lines 46-58):
```javascript
const plugin = require('cap-n8n-plugin')
const service = require('cap-n8n-plugin/service')
const mockService = require('cap-n8n-plugin/mock-service')

expect(plugin).toHaveProperty('N8nWorkflowService')
expect(plugin).toHaveProperty('MockN8nWorkflowService')
expect(plugin.N8nWorkflowService).toBe(service)
expect(plugin.MockN8nWorkflowService).toBe(mockService)
expect(require.resolve('cap-n8n-plugin/cds-plugin')).toMatch(/cds-plugin\.js$/)
```

**Apply to:** New public exports or package files only. Do not add smoke coverage for internal helper modules unless they become supported package API.

## Shared Patterns

### Public CAP Service API

**Source:** `cap-n8n-plugin/lib/N8nWorkflowService.js:43`, `cap-n8n-plugin/lib/MockN8nWorkflowService.js:40`

Register CAP event handlers in `init()` and expose plain async methods on the service class. Phase 3 methods should work as both direct calls and `n8n.send(...)` events where practical.

### Result Envelopes

**Source:** `cap-n8n-plugin/lib/result.js:31-47`

Return stable plain objects with optional fields added only when present. Preserve `accepted`, `workflowId`, optional `executionId`, correlation metadata, and `result` from Phase 2.

### Error Safety

**Source:** `cap-n8n-plugin/lib/errors.js:1-14`, `cap-n8n-plugin/lib/errors.js:97-113`

Use `createN8nError` or its sanitizer for all stored and returned execution errors. Never expose auth headers, API keys, request payloads, input objects, stack traces, or configured secret values.

### Logging

**Source:** `cap-n8n-plugin/lib/N8nWorkflowService.js:102`, `cap-n8n-plugin/lib/N8nWorkflowService.js:187-195`

Use `cds.log('n8n')` with workflow ID, execution ID, attempts, status/code, and correlation ID. Do not log payloads or secrets.

### Ownership Boundary

**Source:** `.planning/codebase/ARCHITECTURE.md`; `demo-app/srv/admin-service.js:29-44`

Reusable execution tracking, duplicate detection, queueing, and cancellation belong under `cap-n8n-plugin`. Do not copy the demo app's hard-coded workflow path or swallowed notification error as durable delivery behavior.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| `cap-n8n-plugin/lib/ExecutionDispatcher.js` after-commit hook | utility/service | queued dispatch | No existing repo code uses CAP transaction after-commit hooks or an outbox worker. Copy retry/error/logging from webhook runtime, but verify the CAP transaction hook API during implementation. |
| Plugin-owned durable CDS model | model | CRUD | Demo app has CDS entities, but no `cap-n8n-plugin` model currently exists. Keep namespace/package ownership explicit. |
| Real n8n webhook cancellation | service | request-response | Current runtime only posts to webhooks. Phase 3 should return an explicit unsupported no-op when webhook cancellation cannot be performed. |
| Active duplicate detection | store | CRUD/query | No existing duplicate-index or active-status query logic exists. Build it in `ExecutionStore` from `workflowId + correlationId` and `workflowId + businessKey/tag`. |

## Anti-Patterns To Avoid

- Do not replace the Phase 2 `start()` public shape with a persisted-record-only response.
- Do not use n8n's returned execution ID as the local `executionId`; store it as `n8nExecutionId`.
- Do not expose `inputs`, request payloads, headers, stack traces, or secrets through execution query results.
- Do not block all duplicate starts by default; the decided default policy is `warn`.
- Do not put reusable execution store or dispatch behavior in `demo-app`.
- Do not make mock query/cancel diverge from real service semantics except for explicit `mock: true` and deterministic test controls.

## Metadata

**Analog search scope:** `cap-n8n-plugin/`, `demo-app/srv/`, `demo-app/db/`, `test/integration/`, `test/smoke/`, `.planning/codebase/`
**Files scanned:** 40+ source, test, and planning files via `rg --files` and targeted reads
**Pattern extraction date:** 2026-06-02
