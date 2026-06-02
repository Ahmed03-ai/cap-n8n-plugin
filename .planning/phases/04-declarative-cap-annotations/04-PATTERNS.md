# Phase 04: Declarative CAP Annotations - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `cap-n8n-plugin/cds-plugin.js` | config/provider | event-driven | `cap-n8n-plugin/cds-plugin.js` | exact |
| `cap-n8n-plugin/lib/annotations/AnnotationRegistrar.js` | provider/service | event-driven, request-response | `cap-n8n-plugin/lib/N8nWorkflowService.js` | role-match |
| `cap-n8n-plugin/lib/annotations/AnnotationParser.js` | utility | transform | `cap-n8n-plugin/lib/config.js` | role-match |
| `cap-n8n-plugin/lib/annotations/ConditionEvaluator.js` | utility | transform | `cap-n8n-plugin/lib/config.js` | role-match |
| `cap-n8n-plugin/lib/annotations/PayloadBuilder.js` | utility | CRUD, transform | `demo-app/srv/cat-service.js` | data-flow-match |
| `cap-n8n-plugin/lib/annotations/CancellationResolver.js` | service/utility | event-driven, CRUD | `cap-n8n-plugin/lib/N8nWorkflowService.js` | exact behavior analog |
| `demo-app/srv/admin-service.cds` | route/model | CRUD | `demo-app/app/admin-books/fiori-service.cds` | role-match |
| `demo-app/srv/admin-service.js` | service | event-driven, CRUD | `demo-app/srv/admin-service.js` | exact |
| `test/integration/n8n-annotations.test.js` | test | CRUD, event-driven, request-response | `test/integration/n8n-dispatch-and-duplicates.test.js` | exact test style |

## Pattern Assignments

### `cap-n8n-plugin/cds-plugin.js` (config/provider, event-driven)

**Analog:** `cap-n8n-plugin/cds-plugin.js`

**Imports/config pattern** (lines 1-8):

```javascript
const cds = require('@sap/cds');
const { resolveN8nConfig } = require('./lib/config');

function ensureN8nConfig() {
  if (!cds.env.requires) cds.env.requires = {};
  if (!cds.env.requires.n8n) cds.env.requires.n8n = {};

  return cds.env.requires.n8n;
}
```

**Model registration pattern** (lines 19-29):

```javascript
function registerModel() {
  const n8nConfig = ensureN8nConfig();

  if (!n8nConfig.model) {
    n8nConfig.model = require.resolve('./index.cds');
  }

  return n8nConfig;
}

registerModel();
```

**Lifecycle pattern** (lines 31-42):

```javascript
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

**Apply to Phase 4:** Load the annotation registrar from this plugin lifecycle file. Keep semicolons in `cds-plugin.js` because this file already uses them. Preserve explicit `n8n.impl` overrides.

---

### `cap-n8n-plugin/lib/annotations/AnnotationRegistrar.js` (provider/service, event-driven)

**Analogs:** `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`

**Imports pattern** from `N8nWorkflowService.js` (lines 1-12):

```javascript
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

**CAP handler registration pattern** from `N8nWorkflowService.js` (lines 75-108):

```javascript
class N8nWorkflowService extends cds.Service {
  async init() {
    this.config = resolveN8nConfig({ ...(this.options || {}), kind: 'webhook' })
    this.baseUrl = this.config.baseUrl

    this.on('start', (req) => this.start(req.data.workflowId, req.data.inputs, {
      ...publicStartOptions(req.data),
      _req: req
    }))
    this.on('queryExecutions', (req) => this.queryExecutions(
      publicQueryFilters(req.data || {}),
      req.data?.page || {}
    ))
    this.on('cancel', (req) => this.cancel(publicCancelExecutionId(req.data)))

    await super.init()
  }
}
```

**Service event analog** from `demo-app/srv/admin-service.js` (lines 29-45):

```javascript
this.after ('CREATE', Books, async (data, req) => {
  try {
    const n8n = await cds.connect.to('n8n')
    await n8n.send('start', {
      workflowId: 'webhook-test/cap-test-trigger',
      inputs: {
        event: 'BookCreated',
        bookId: data.ID,
        title: data.title
      }
    })
    cds.log('n8n').info('Successfully notified n8n about new Book')
  } catch (err) {
    cds.log('n8n').error('Could not notify n8n about new Book:', err.message)
  }
})
```

**Apply to Phase 4:** Register `after('CREATE'|'UPDATE'|'DELETE', entity, async (data, req) => ...)` handlers from annotations. Keep runtime side effects best-effort: catch errors, log through `cds.log('n8n')`, and do not throw from annotation handlers by default.

---

### `cap-n8n-plugin/lib/annotations/AnnotationParser.js` (utility, transform)

**Analogs:** `cap-n8n-plugin/lib/config.js`, `cap-n8n-plugin/lib/ExecutionStore.js`

**Validation constants and typed error pattern** from `config.js` (lines 1-23):

```javascript
const VALID_KINDS = new Set(['mock', 'webhook'])
const VALID_DUPLICATE_POLICIES = new Set(['warn', 'reject', 'reuseActive'])

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

**Normalizer pattern** from `config.js` (lines 53-77):

```javascript
function normalizeKind(kind) {
  if (kind === undefined || kind === null || kind === '') return undefined

  const normalizedKind = String(kind).trim().toLowerCase()
  if (!VALID_KINDS.has(normalizedKind)) {
    throw createConfigError('Invalid n8n runtime kind. Expected kind to be mock or webhook.', {
      field: 'kind',
      allowed: ['mock', 'webhook']
    })
  }

  return normalizedKind
}
```

**Filter validation pattern** from `ExecutionStore.js` (lines 77-93):

```javascript
function normalizeQueryFilters(filters = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw createFilterError('filters')
  }

  const normalized = {}
  for (const [field, value] of Object.entries(filters)) {
    if (!QUERY_FILTERS.has(field)) throw createFilterError(field)
    if (!hasValue(value)) continue
    if (field === 'status' && !EXECUTION_STATUSES.has(value)) {
      throw createStatusError(value)
    }
    normalized[field] = value
  }

  return normalized
}
```

**Apply to Phase 4:** Parse flattened CSN annotation keys into `{ workflowId, on, inputs, if, businessKey, tag }`, validate events against `CREATE`, `UPDATE`, `DELETE`, reject unsupported/missing scalar paths at registration time, and throw typed `source = 'n8n'` errors with safe details.

---

### `cap-n8n-plugin/lib/annotations/ConditionEvaluator.js` (utility, transform)

**Analog:** `cap-n8n-plugin/lib/config.js`

**Small helper style** from `config.js` (lines 35-51):

```javascript
function normalizeNonNegativeInteger(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.trunc(number))
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'off'].includes(normalized)) return false
  }

  return Boolean(value)
}
```

**Validation error style** from `ExecutionStore.js` (lines 42-58):

```javascript
function createStatusError(status) {
  const error = new Error(`Invalid n8n execution status "${status}"`)
  error.code = 'ERR_N8N_EXECUTION_STATUS'
  error.statusCode = 400
  error.source = 'n8n'
  error.allowed = [...EXECUTION_STATUSES]
  return error
}
```

**Apply to Phase 4:** Use the research recommendation `cds.parse.expr()` for `if` strings, then whitelist CXN node shapes/operators. No existing local expression evaluator exists, so copy the project error/normalizer style rather than inventing a broad parser. Never use `eval`, `Function`, or arbitrary JavaScript execution.

---

### `cap-n8n-plugin/lib/annotations/PayloadBuilder.js` (utility, CRUD/transform)

**Analogs:** `demo-app/srv/cat-service.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`

**CAP request data/query pattern** from `cat-service.js` (lines 14-25):

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

**Queued payload storage pattern** from `N8nWorkflowService.js` (lines 235-253):

```javascript
async _createQueuedExecution({ workflowId, workflowPath, inputs, options, req }) {
  const entry = {
    workflowId,
    correlationId: options.correlationId,
    businessKey: options.businessKey,
    tag: options.tag,
    inputs,
    dispatch: {
      workflowPath,
      payload: inputs
    }
  }

  if (isPostCommitRequest(req)) {
    return this.store.forRequest(req).createQueued(entry)
  }

  return this.store.transaction((store) => store.createQueued(entry))
}
```

**Apply to Phase 4:** Build scalar-only mapped inputs plus minimal event metadata. For CREATE/UPDATE use mapped fields; when `inputs` is omitted send keys plus metadata. For DELETE, default to keys plus metadata. If non-key DELETE mappings are attempted, planner should either reject them or add an explicit pre-delete snapshot task.

---

### `cap-n8n-plugin/lib/annotations/CancellationResolver.js` (service/utility, event-driven/CRUD)

**Analogs:** `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/lib/ExecutionStore.js`

**Public query/cancel service pattern** from `N8nWorkflowService.js` (lines 165-233):

```javascript
async queryExecutions(filters = {}, page = {}) {
  return this.store.queryExecutions(filters, page)
}

async cancel(executionId) {
  const execution = await this.store.getExecution(executionId)

  if (!execution) {
    return createCancelResult({
      executionId,
      notFound: true,
      noOp: true,
      reason: 'n8n execution not found.'
    })
  }

  if (execution.status === 'queued') {
    const result = createCancelResult({
      executionId: execution.executionId,
      status: 'cancelled',
      cancelled: true,
      reason: 'Queued n8n execution cancelled before dispatch.'
    })

    await this.store.markCancelled(execution.executionId, { result })
    return result
  }
}
```

**Active status lookup pattern** from `ExecutionStore.js` (lines 427-449):

```javascript
async _findActiveExecutions(filter) {
  const records = []

  for (const status of ACTIVE_STATUSES) {
    const rows = await this.db.run(
      SELECT.from(EXECUTIONS)
        .where({ ...filter, status })
        .orderBy('updatedAt desc', 'createdAt desc')
        .limit(MAX_DUPLICATE_MATCHES)
    )

    records.push(...rows)
    if (records.length >= MAX_DUPLICATE_MATCHES) return records.slice(0, MAX_DUPLICATE_MATCHES)
  }

  return records
}

module.exports = {
  ExecutionStore,
  ACTIVE_STATUSES: [...ACTIVE_STATUSES],
  EXECUTION_STATUSES: [...EXECUTION_STATUSES]
}
```

**Apply to Phase 4:** Resolve `workflowId`, `businessKey`, and `tag` from annotation/data, query active executions through `n8n.queryExecutions`, deduplicate by `executionId`, and call `n8n.cancel(executionId)` for all matches. If no matches exist, log a non-blocking warning and return no-op metadata.

---

### `demo-app/srv/admin-service.cds` (route/model, CRUD)

**Analogs:** `demo-app/app/admin-books/fiori-service.cds`, `demo-app/srv/admin-constraints.cds`

**Service import/projection pattern** from `admin-service.cds` (lines 1-8):

```cds
using {sap.capire.bookshop as my} from '../db/schema';

service AdminService {
  entity Authors as projection on my.Authors;
  @odata.draft.bypass
  entity Books   as projection on my.Books;
  entity Genres  as projection on my.Genres;
}
```

**Service projection annotation pattern** from `admin-books/fiori-service.cds` (lines 1-12):

```cds
using { AdminService } from '../../srv/admin-service';
using from '../common'; // to help UI linter get the complete annotations

annotate AdminService.Books with @(
  UI: {
    Facets: [
```

**Element annotation pattern** from `admin-constraints.cds` (lines 1-16):

```cds
using { AdminService } from './admin-service.cds';
annotate AdminService.Books with {

  title @mandatory;

  author @assert: (case
    when not exists author then 'Specified Author does not exist'
  end);
}
```

**Apply to Phase 4:** Add demo `@n8n.workflow.start` and `@n8n.workflow.cancel` annotations on `AdminService.Books` or adjacent service annotation file. Prefer service projection annotations over domain annotations to avoid unexpected fan-out across services.

---

### `demo-app/srv/admin-service.js` (service, event-driven/CRUD)

**Analog:** `demo-app/srv/admin-service.js`

**Keep ID assignment pattern** (lines 3-22):

```javascript
module.exports = class AdminService extends cds.ApplicationService { init() {

  const { Books } = this.entities

  const assignNextBookId = async (req) => {
    if (req.data.ID) return
    const { ID: id1 } = await SELECT.one.from(Books).columns('max(ID) as ID')
    const { ID: id2 } = await SELECT.one.from(Books.drafts).columns('max(ID) as ID')
    req.data.ID = Math.max(id1 || 0, id2 || 0) + 1
  }

  this.before('NEW', Books.drafts, assignNextBookId)
  this.before('CREATE', Books, assignNextBookId)
```

**Hard-coded trigger to replace** (lines 25-45):

```javascript
/**
 * Proof of Concept: Programmatically trigger an n8n workflow
 * when a new Book is created.
 */
this.after ('CREATE', Books, async (data, req) => {
  try {
    const n8n = await cds.connect.to('n8n')
    await n8n.send('start', {
      workflowId: 'webhook-test/cap-test-trigger',
      inputs: {
        event: 'BookCreated',
        bookId: data.ID,
        title: data.title
      }
    })
    cds.log('n8n').info('Successfully notified n8n about new Book')
  } catch (err) {
    cds.log('n8n').error('Could not notify n8n about new Book:', err.message)
  }
})
```

**Apply to Phase 4:** Remove or disable the proof-of-concept hard-coded n8n trigger once declarative annotations demonstrate the same behavior. Preserve ID-generation handlers and `return super.init()`.

---

### `test/integration/n8n-annotations.test.js` (test, CRUD/event-driven/request-response)

**Analogs:** `test/integration/n8n-dispatch-and-duplicates.test.js`, `test/integration/n8n-cancel-and-mock.test.js`, `test/integration/n8n-query-and-duplicates.test.js`

**Imports and CAP bridge pattern** from `n8n-dispatch-and-duplicates.test.js` (lines 1-12):

```javascript
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const cds = require('@sap/cds')

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pluginModel = path.join(repoRoot, 'cap-n8n-plugin', 'index.cds')
```

**Webhook server/test harness pattern** from `n8n-dispatch-and-duplicates.test.js` (lines 73-114):

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
```

**Post-commit dispatch assertion pattern** from `n8n-dispatch-and-duplicates.test.js` (lines 158-198):

```javascript
await cds.tx(async () => {
  const req = cds.context
  result = await n8n.start('commit-workflow', {
    event: 'BookCreated',
    secret: 'raw-dispatch-input-secret'
  }, {
    correlationId: 'corr-commit-1',
    businessKey: 'book-commit-1',
    tag: 'admin-create',
    _req: req
  })

  expect(server.requests).toHaveLength(0)
  expect(result).toMatchObject({
    accepted: true,
    workflowId: 'commit-workflow',
    status: 'queued'
  })
})

expect(server.requests).toHaveLength(1)
expect(server.requests[0]).toMatchObject({
  method: 'POST',
  url: '/webhook/commit-workflow',
  body: {
    event: 'BookCreated',
    secret: 'raw-dispatch-input-secret'
  }
})
```

**Rollback/no-dispatch assertion pattern** from `n8n-dispatch-and-duplicates.test.js` (lines 226-258):

```javascript
await expect(cds.tx(async () => {
  await n8n.start('rollback-workflow', {
    event: 'BookCreated'
  }, {
    correlationId: 'corr-rollback-1',
    _req: cds.context
  })

  expect(server.requests).toHaveLength(0)
  throw new Error('force rollback after queued start')
})).rejects.toThrow('force rollback')

expect(server.requests).toHaveLength(0)
expect(executions).toHaveLength(0)
expect(dispatches).toHaveLength(0)
```

**Cancellation assertion pattern** from `n8n-cancel-and-mock.test.js` (lines 180-218):

```javascript
const queued = await n8n.store.createQueued({
  workflowId: 'queued-cancel-workflow',
  correlationId: 'corr-cancel-queued',
  inputs: {
    event: 'BookCreated',
    secret: 'raw-cancel-input-secret'
  },
  dispatch: {
    workflowPath: 'webhook/queued-cancel-workflow',
    payload: {
      event: 'BookCreated',
      secret: 'raw-cancel-input-secret'
    }
  }
})

const cancelled = await n8n.cancel(queued.executionId)
const dispatched = await n8n.dispatchPending({ executionId: queued.executionId })
expect(server.requests).toHaveLength(0)
expectPublicDtoIsSanitized(cancelled)
```

**Query filter assertion pattern** from `n8n-query-and-duplicates.test.js` (lines 222-291):

```javascript
await expect(n8n.queryExecutions({ workflowId: 'wf-alpha' })).resolves.toMatchObject({
  items: [
    expect.objectContaining({ workflowId: 'wf-alpha' }),
    expect.objectContaining({ workflowId: 'wf-alpha' })
  ]
})
await expect(n8n.queryExecutions({ businessKey: 'book-alpha' })).resolves.toMatchObject({
  items: [
    expect.objectContaining({ businessKey: 'book-alpha' }),
    expect.objectContaining({ businessKey: 'book-alpha' })
  ]
})
await expect(n8n.queryExecutions({ status: 'not-valid' })).rejects.toMatchObject({
  code: 'ERR_N8N_EXECUTION_STATUS',
  statusCode: 400
})
```

**Apply to Phase 4:** Add integration coverage for annotated CREATE/UPDATE/DELETE starts, scalar mapping, default keys-plus-metadata payloads, invalid annotation startup failures, conditional skip/start behavior, non-rollback side effects, declarative cancellation matching multiple active executions, and public DTO sanitization.

## Shared Patterns

### CommonJS Runtime Style

**Source:** `cap-n8n-plugin/lib/N8nWorkflowService.js` and `cap-n8n-plugin/lib/ExecutionStore.js`
**Apply to:** All new `cap-n8n-plugin/lib/annotations/*.js` files

```javascript
const cds = require('@sap/cds')

function addOptionalValue(target, key, value) {
  if (value !== undefined && value !== null) {
    target[key] = value
  }
}

module.exports = {
  ExecutionStore,
  ACTIVE_STATUSES: [...ACTIVE_STATUSES]
}
```

Use two-space indentation, single quotes, and no semicolons in new `lib` files.

### Authentication / Authorization

**Source:** `demo-app/srv/access-control.cds` (lines 1-3)
**Apply to:** Demo service events; no new auth surface in plugin helpers

```cds
using {AdminService} from './admin-service';

annotate AdminService with @requires: 'admin';
```

Phase 4 annotation handlers should run after normal CAP request authorization/validation. Do not add separate authentication logic to annotation utilities.

### Post-Commit Dispatch

**Source:** `cap-n8n-plugin/lib/N8nWorkflowService.js` (lines 111-153)
**Apply to:** `AnnotationRegistrar.js`, `PayloadBuilder.js`, tests

```javascript
const req = options._req || cds.context
const requestStore = isPostCommitRequest(req) ? this.store.forRequest(req) : this.store

const queued = await this._createQueuedExecution({
  workflowId,
  workflowPath,
  inputs,
  options: safeOptions,
  req
})

if (isPostCommitRequest(req)) {
  req.on('succeeded', dispatch)
  return startResult
}
```

Annotated starts must call `n8n.start(workflowId, payload, { businessKey, tag, _req: req })` and let Phase 3 dispatch after commit.

### Sanitized Errors And DTOs

**Source:** `cap-n8n-plugin/lib/errors.js` (lines 75-117), `cap-n8n-plugin/lib/result.js` (lines 91-131)
**Apply to:** Annotation errors, logs, cancellation results, tests

```javascript
function sanitizeValue(value, sensitiveValues, depth = 0) {
  if (depth > MAX_DETAIL_DEPTH) return '[omitted]'
  if (value === undefined || value === null) return value
  if (typeof value === 'string') return sanitizeString(value, sensitiveValues)
  if (typeof value !== 'object') return value

  const sanitized = {}
  for (const [key, childValue] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key)
    if (normalizedKey === 'sensitivevalues' || SENSITIVE_KEYS.has(normalizedKey)) continue
    const safeChild = sanitizeValue(childValue, sensitiveValues, depth + 1)
    if (safeChild !== undefined) sanitized[key] = safeChild
  }

  return sanitized
}
```

Do not expose raw annotation payloads, headers, API keys, request bodies, or stack traces in public results.

### Cancellation Matching

**Source:** `cap-n8n-plugin/lib/ExecutionStore.js` (lines 12-30, 194-219), `N8nWorkflowService.js` (lines 169-233)
**Apply to:** `CancellationResolver.js`, annotation tests

```javascript
const QUERY_FILTERS = new Set([
  'executionId',
  'workflowId',
  'businessKey',
  'tag',
  'status'
])
const ACTIVE_STATUSES = new Set(['queued', 'dispatching', 'running', 'cancel_requested'])
```

Query by `workflowId` plus resolved `businessKey` and/or `tag`; iterate active statuses; cancel all matched execution IDs.

### CDS Annotation Syntax

**Source:** `demo-app/app/admin-books/fiori-service.cds` (lines 11-42), `demo-app/srv/admin-constraints.cds` (lines 1-16)
**Apply to:** `demo-app/srv/admin-service.cds` or adjacent demo annotation file

```cds
annotate AdminService.Books with @(
  UI: {
    Facets: [
      {$Type: 'UI.ReferenceFacet', Label: '{i18n>General}', Target: '@UI.FieldGroup#General'},
    ]
  }
);
```

Use service projection annotations for demo evidence. Keep CDS semicolons and existing spacing conventions.

### Integration Test Harness

**Source:** `test/integration/n8n-dispatch-and-duplicates.test.js` (lines 23-56, 134-141)
**Apply to:** `test/integration/n8n-annotations.test.js`

```javascript
function configureN8n(baseUrl, options = {}) {
  const { credentials = {}, ...serviceOptions } = options

  cds.env.requires ??= {}
  cds.env.requires.n8n = {
    impl: 'cap-n8n-plugin/service',
    kind: 'webhook',
    credentials: {
      baseUrl,
      ...credentials
    },
    ...serviceOptions
  }
}

beforeEach(async () => {
  await deployExecutionModel()
})

afterEach(async () => {
  await resetN8nService()
  await disconnectDb()
})
```

Compile/deploy only the models needed for the test. Reset `cds.services.n8n` and restore `cds.env.requires.n8n` after each case.

## No Analog Found

All expected Phase 4 files have at least a role-match analog. The only partial gap is `ConditionEvaluator.js`: the codebase has validation/normalizer patterns but no expression evaluator. Planner should combine the local validation style with the research recommendation to parse conditions using `cds.parse.expr()` and whitelist safe scalar CXN.

## Metadata

**Analog search scope:** `cap-n8n-plugin/`, `demo-app/`, `test/integration/`, root package files
**Files scanned:** 92
**Strong analogs read:** `cds-plugin.js`, `N8nWorkflowService.js`, `ExecutionStore.js`, `ExecutionDispatcher.js`, `MockN8nWorkflowService.js`, `config.js`, `errors.js`, `result.js`, `admin-service.js`, `cat-service.js`, `admin-service.cds`, `admin-books/fiori-service.cds`, `admin-constraints.cds`, `access-control.cds`, `schema.cds`, `n8n-dispatch-and-duplicates.test.js`, `n8n-query-and-duplicates.test.js`, `n8n-cancel-and-mock.test.js`, `n8n-service-contract.test.js`
**Pattern extraction date:** 2026-06-02
