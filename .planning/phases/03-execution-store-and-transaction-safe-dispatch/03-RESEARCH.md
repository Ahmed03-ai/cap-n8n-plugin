# Phase 03: Execution Store and Transaction-Safe Dispatch - Research

**Researched:** 2026-06-02
**Domain:** SAP CAP Node.js service persistence, queued dispatch, n8n execution tracking
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

Source for this entire section: copied from `.planning/phases/03-execution-store-and-transaction-safe-dispatch/03-CONTEXT.md`. [VERIFIED: codebase grep]

### Locked Decisions

#### Execution Record Contract

- **D-01:** Use a full execution lifecycle: `queued`, `dispatching`, `running`, `succeeded`, `failed`, `cancel_requested`, `cancelled`, and `unknown`.
- **D-02:** Store these fields as first-class queryable data: `executionId`, `correlationId`, `workflowId`, `status`, `businessKey`, `tag`, `attempts`, `createdAt`, `startedAt`, `finishedAt`, and `updatedAt`.
- **D-03:** Store `result` and `error` as sanitized structured JSON envelopes. Continue the Phase 2 secret-safety policy: no secrets, auth headers, request payloads, stack traces, or configured secret values in exposed execution data.
- **D-04:** Always create a CAP/plugin-owned `executionId`. If n8n returns its own ID, store it separately as `n8nExecutionId`.

#### Dispatch And Duplicate Policy

- **D-05:** Persist a `queued` execution intent inside the CAP transaction, then dispatch only after commit or through an outbox worker.
- **D-06:** If dispatch fails after commit, keep the CAP write committed, retry from the persisted execution record, increment `attempts`, and store sanitized errors.
- **D-07:** Detect active duplicates by `workflowId` plus `correlationId` or `businessKey`/`tag`. Expose a duplicate or ambiguous signal, but do not block all starts by default.
- **D-08:** Duplicate handling is configurable per call. The default policy is `warn`; stricter callers may request policies such as `reject` or `reuseActive`.

#### Query And Paging API

- **D-09:** Expose `getExecution(executionId)` for single-record lookup and `queryExecutions(filters, page)` for filtered lists.
- **D-10:** Initial filters are `executionId`, `workflowId`, `businessKey`, `tag`, and `status`, plus paging.
- **D-11:** `queryExecutions()` returns `{ items, pageInfo: { limit, offset, nextOffset, hasMore } }`.
- **D-12:** Default query ordering is `updatedAt desc`, then `createdAt desc`.

#### Cancellation And Mock Parity

- **D-13:** `cancel(executionId)` is state-aware. Active statuses such as `queued`, `dispatching`, and `running` cancel or request cancellation; `cancel_requested` returns already requested; terminal statuses such as `succeeded`, `failed`, and `cancelled` return meaningful no-op results; missing executions return not found.
- **D-14:** If real n8n cannot cancel a webhook-triggered execution, return or record an unsupported no-op with a clear reason. Do not pretend cancellation happened.
- **D-15:** Mock mode should use deterministic state transitions: running records, optional configurable completion delay or explicit test helper, and cancel/query support against the in-memory store.
- **D-16:** The local execution store is the source of truth. Phase 3 should call real n8n only for minimal cancel/status integration where supported, and keep unsupported webhook cases explicit.

### the agent's Discretion

- Planner may choose exact helper/module names, CAP model names, and test file names, provided behavior stays package-owned under `cap-n8n-plugin`, follows CommonJS/CAP conventions, and preserves Phase 2 public start behavior.
- Planner may decide whether the outbox worker is implemented as an explicit service method, internal helper, CAP event hook, or testable module, as long as execution intent is persisted transactionally and dispatch occurs after commit.
- Planner may choose exact result envelope property names for duplicate/no-op/unsupported responses, provided the semantics above are visible to CAP developers and integration tests.

### Deferred Ideas (OUT OF SCOPE)

- Declarative CAP start/cancel annotations remain Phase 4.
- Workflow import and build-time validation remain Phase 5.
- n8n community-node metadata discovery, dropdowns, OData request shaping, response cleanup, actions/functions, and composite-key behavior remain Phases 6 and 7.
- Deployment documentation, `.env.example` completeness, SAP BTP guidance, and final review readiness remain Phase 8.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAPAPI-04 | CAP developer can cancel a running workflow execution by execution ID. [VERIFIED: codebase grep] | Use state-aware local cancellation first, call n8n `POST /api/v1/executions/{id}/stop` only when `n8nExecutionId` and API credentials are available, and return unsupported no-op otherwise. [CITED: https://docs.n8n.io/api/api-reference/][VERIFIED: codebase grep] |
| CAPAPI-05 | CAP developer can query workflow executions by execution ID, workflow ID, business key, tag, or status. [VERIFIED: codebase grep] | Add a plugin-owned execution store with first-class fields for those filters and sanitize query DTOs. [VERIFIED: codebase grep] |
| CAPAPI-06 | CAP developer can page through large execution query results. [VERIFIED: codebase grep] | Implement `limit`/`offset` paging and return `{ limit, offset, nextOffset, hasMore }` with default `updatedAt desc`, `createdAt desc` ordering. [VERIFIED: codebase grep] |
| RUNTIME-06 | Workflow starts and retries are correlated so duplicate or ambiguous executions can be detected. [VERIFIED: codebase grep] | Enforce duplicate scans over active statuses by `workflowId + correlationId` or `workflowId + businessKey/tag`, with policies `warn`, `reject`, and `reuseActive`. [VERIFIED: codebase grep] |
| RUNTIME-07 | Workflow execution state is persisted or otherwise tracked enough to support query, cancellation, retry, and business-key lookup. [VERIFIED: codebase grep] | Use CAP persistence for real mode and in-memory parity for mock mode; CAP persistent queue stores queued messages in the database within the current transaction. [CITED: https://cap.cloud.sap/docs/node.js/queue][VERIFIED: codebase grep] |
</phase_requirements>

## Summary

Phase 3 should add a package-owned execution layer around the existing `N8nWorkflowService.start(workflowId, inputs, options)` and `send('start', ...)` compatibility path instead of replacing it. [VERIFIED: codebase grep] The current real service already owns webhook dispatch, retry, timeout, API-key header, and sanitized errors, while the mock service already owns deterministic in-memory start records. [VERIFIED: codebase grep]

Use a plugin-owned CAP persistence model for `WorkflowExecutions`, plus either CAP's persistent queue (`cds.queued`) for the after-commit dispatch event or a small internal dispatch table if `cds.queued` cannot be made deterministic in tests. [CITED: https://cap.cloud.sap/docs/node.js/queue][VERIFIED: codebase grep] CAP docs state queued messages are stored in the database within the current transaction and that `req.on('succeeded')` handlers run after commit and outside the managed transaction. [CITED: https://cap.cloud.sap/docs/node.js/queue][CITED: https://cap.cloud.sap/docs/node.js/events]

**Primary recommendation:** implement `WorkflowExecutions` as the source of truth, enqueue dispatch after the execution record is committed, preserve the Phase 2 start envelope, and expose `getExecution`, `queryExecutions`, and `cancel` with explicit duplicate/no-op/unsupported result fields. [VERIFIED: codebase grep][CITED: https://cap.cloud.sap/docs/node.js/queue]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Execution record persistence | Database / Storage | API / Backend | Query, duplicate detection, and cancellation require durable local state owned by the CAP plugin. [VERIFIED: codebase grep] |
| Programmatic start API | API / Backend | Database / Storage | `cds.connect.to('n8n')` is the developer entry point and must create/store execution intent before dispatch. [VERIFIED: codebase grep] |
| Transaction-safe dispatch | API / Backend | Database / Storage | CAP queued services and post-commit hooks are backend transaction mechanisms that rely on database-backed persistence for durability. [CITED: https://cap.cloud.sap/docs/node.js/queue][CITED: https://cap.cloud.sap/docs/node.js/events] |
| Duplicate detection | API / Backend | Database / Storage | Duplicate policy is call-specific behavior, but active duplicate lookup depends on stored execution fields. [VERIFIED: codebase grep] |
| Query and paging | API / Backend | Database / Storage | Filtering and ordering should be implemented against first-class store fields, not by scanning logs or payloads. [VERIFIED: codebase grep] |
| Real n8n cancellation bridge | API / Backend | External n8n API | n8n exposes execution stop/list/read APIs, but local records decide whether cancellation is supported for a given execution. [CITED: https://docs.n8n.io/api/api-reference/][VERIFIED: codebase grep] |
| Mock runtime parity | API / Backend | In-memory Store | Mock mode is a CAP service test double and should mirror query/cancel semantics without Docker n8n. [VERIFIED: codebase grep] |

## Project Constraints (from AGENTS.md)

- Use JavaScript CommonJS, SAP CAP, CDS/CDL, npm workspaces, Docker Compose, and n8n community-node conventions already present in the repo. [VERIFIED: codebase grep]
- Use Node.js 20+ because `@sap/cds` 9.9.1 requires `node >=20`; the local runtime is Node `v24.16.0`. [VERIFIED: npm registry][VERIFIED: command output]
- Use integration-test wording and integration coverage; do not plan Phase 3 around unit-test-only acceptance. [VERIFIED: codebase grep]
- Keep reusable behavior under `cap-n8n-plugin`; do not implement generic execution tracking in `demo-app`. [VERIFIED: codebase grep]
- Keep secrets in environment/CAP configuration and exclude API keys, auth headers, request payloads, stack traces, and configured secret values from generated docs, fixtures, errors, and exposed execution data. [VERIFIED: codebase grep]
- Match local style: CommonJS, two-space indentation, single quotes, CAP logging via `cds.log('n8n')`, and no broad refactors. [VERIFIED: codebase grep]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sap/cds` | locked/current 9.9.1; npm modified 2026-05-21 | CAP service runtime, CDS model loading, transactions, `cds.connect.to`, `cds.queued`, `cds.spawn`, and logging. | It is the existing CAP runtime and peer dependency; official docs cover the queue, transactions, service plugins, and required-service configuration. [VERIFIED: npm registry][CITED: https://cap.cloud.sap/docs/node.js/queue][CITED: https://cap.cloud.sap/docs/node.js/cds-tx] |
| `@cap-js/sqlite` | locked/current 2.4.0; npm modified 2026-06-01 | Local CAP persistence for demo and integration tests. | It is already installed and used by `demo-app`; no new database adapter is needed for Phase 3 local tests. [VERIFIED: npm registry][VERIFIED: codebase grep] |
| `cap-n8n-plugin` | local workspace 1.0.0 | Package-owned CAP service, config, result, error, mock, execution store, and dispatcher code. | Phase 3 deliverables belong in this workspace package, not in `demo-app`. [VERIFIED: codebase grep] |
| Node.js Fetch / `AbortController` | Node `v24.16.0` local; package engines require `>=20` | Existing webhook transport and timeout support. | Phase 2 already uses global `fetch` and `AbortController`; keep the same transport path for dispatcher reuse. [VERIFIED: command output][VERIFIED: codebase grep] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Vitest | locked 4.1.7; current npm 4.1.8 | Integration test runner. | Keep locked 4.1.7 to avoid lockfile churn; use existing `test/integration` patterns. [VERIFIED: npm registry][VERIFIED: command output][VERIFIED: codebase grep] |
| `@sap/cds-dk` / `npx cds` | 9.9.1 local | CAP compile and model verification. | Use `npx cds compile ... --to csn` because `cds` is not on PATH but the local CLI works through `npx`. [VERIFIED: command output] |
| Docker Compose | Docker 29.5.2, Compose v5.1.4 | Optional manual local n8n runtime. | Not required for deterministic Phase 3 integration tests; useful for later manual verification. [VERIFIED: command output][VERIFIED: codebase grep] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CAP persistent queue / `cds.queued` | Hand-built timer worker only | CAP queue is current official outbox-style support and stores messages in the DB within the transaction; a custom timer should only be a fallback for deterministic test control. [CITED: https://cap.cloud.sap/docs/node.js/queue] |
| Plugin-owned execution store | Query n8n executions directly | n8n can list/read executions, but Phase 3 needs CAP business keys, duplicate policy, unsupported webhook cancellation semantics, and local source-of-truth records. [CITED: https://docs.n8n.io/api/api-reference/][VERIFIED: codebase grep] |
| Existing `createStartResult` envelope | New raw persisted-record response | The Phase 2 contract already returns `accepted`, `workflowId`, optional `executionId`, correlation metadata, and `result`; preserve that shape and add optional status/duplicate fields. [VERIFIED: codebase grep] |

**Installation:** no new external packages are recommended for Phase 3. [VERIFIED: codebase grep]

```bash
# No npm install required.
npm run test:integration
```

## Package Legitimacy Audit

No new external package installation is recommended, so the Package Legitimacy Gate is not required for this phase. [VERIFIED: codebase grep] Existing recommended packages were verified on npm and no `scripts.postinstall` output was returned for `@sap/cds`, `@cap-js/sqlite`, or `vitest`. [VERIFIED: npm registry]

| Package | Registry | Version Checked | Source Repo | postinstall | Disposition |
|---------|----------|-----------------|-------------|-------------|-------------|
| `@sap/cds` | npm | 9.9.1 | SAP CAP package | none reported | Existing dependency only. [VERIFIED: npm registry] |
| `@cap-js/sqlite` | npm | 2.4.0 | SAP CAP package | none reported | Existing dependency only. [VERIFIED: npm registry] |
| `vitest` | npm | locked 4.1.7, current 4.1.8 | Vitest package | none reported | Existing dev dependency only. [VERIFIED: npm registry] |

**Packages removed due to slopcheck [SLOP] verdict:** none; no new packages proposed. [VERIFIED: codebase grep]
**Packages flagged as suspicious [SUS]:** none; no new packages proposed. [VERIFIED: codebase grep]

## Architecture Patterns

### System Architecture Diagram

```text
CAP caller / future annotation trigger
  |
  v
N8nWorkflowService.start(workflowId, inputs, options)
  |
  +--> validate workflowId/options + duplicate policy lookup
  |
  +--> WorkflowExecutions create: status=queued, plugin executionId, correlation/business/tag
  |
  +--> enqueue dispatch after commit
        |        \
        |         \ no ambient transaction: commit store record, then dispatch immediately or via queued worker
        v
    ExecutionDispatcher
        |
        +--> mark dispatching, increment attempts
        +--> call existing webhook transport/retry/error sanitizer
        +--> persist running/succeeded/failed + n8nExecutionId if returned
        v
    query/cancel APIs read local source-of-truth records
        |
        +--> cancel queued locally
        +--> stop n8n only when n8nExecutionId and API stop support are available
        +--> unsupported no-op when webhook execution cannot be stopped
```

This data flow keeps CAP execution records local, preserves the existing webhook transport, and creates the Phase 4 post-commit path without adding declarative annotations in Phase 3. [VERIFIED: codebase grep][CITED: https://cap.cloud.sap/docs/node.js/queue]

### Recommended Project Structure

```text
cap-n8n-plugin/
+-- index.cds                    # plugin-owned execution model, auto-loaded through package cds config
+-- lib/
|   +-- ExecutionStore.js         # CAP persistence wrapper for execution metadata and query/cancel
|   +-- ExecutionDispatcher.js    # queued dispatch worker using existing webhook transport semantics
|   +-- N8nWorkflowService.js     # public service methods/events: start/getExecution/queryExecutions/cancel
|   +-- MockN8nWorkflowService.js # in-memory parity for start/query/cancel/state transitions
|   +-- config.js                 # duplicate, dispatch, and mock timing options
|   +-- errors.js                 # sanitizer reused for stored errors
|   +-- result.js                 # start/query/cancel/duplicate/no-op envelopes
+-- package.json                  # include index.cds/model config and files entry

test/integration/
+-- n8n-execution-store.test.js
+-- n8n-dispatch-and-duplicates.test.js
+-- n8n-query-cancel.test.js
```

CAP plugin packages can provide `cds-plugin.js` and package `cds` auto-configuration, and CAP can load models from package references such as a package `index.cds`. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins][CITED: https://cap.cloud.sap/docs/guides/databases/initial-data] The current package has no plugin-owned CDS model yet, so the planner should include a Wave 0 compile check that verifies `index.cds` is included in the consuming app's effective model. [VERIFIED: codebase grep]

### Pattern 1: Execution Store Shape

**What:** use a first-class CAP entity for exposed execution metadata and keep any dispatch payload internal to the queue/outbox path. [VERIFIED: codebase grep][CITED: https://cap.cloud.sap/docs/cds/types]

**Recommended model sketch:**

```cds
namespace cap.n8n;

entity WorkflowExecutions {
  key executionId   : UUID;
      n8nExecutionId: String(128);
      correlationId : String(255);
      workflowId    : String(500);
      status        : String(32);
      businessKey   : String(255);
      tag           : String(255);
      attempts      : Integer default 0;
      createdAt     : Timestamp;
      startedAt     : Timestamp;
      finishedAt    : Timestamp;
      updatedAt     : Timestamp;
      result        : LargeString;
      error         : LargeString;
}
```

Use `UUID`, `Timestamp`, `String`, `Integer`, and `LargeString` because CAP documents these as built-in CDS types and `LargeString` maps to large textual data. [CITED: https://cap.cloud.sap/docs/cds/types] Store `result` and `error` as JSON strings or `Map` only after verifying compile/runtime behavior against SQLite and the target CAP version; `LargeString` is the conservative cross-database choice for structured envelopes in this repo. [CITED: https://cap.cloud.sap/docs/cds/types][VERIFIED: codebase grep]

### Pattern 2: DTO and Envelope Contract

**What:** return sanitized DTOs that omit internal dispatch payloads and preserve Phase 2 start shape. [VERIFIED: codebase grep]

```javascript
// Source: cap-n8n-plugin/lib/result.js and Phase 3 context. [VERIFIED: codebase grep]
{
  accepted: true,
  workflowId,
  executionId,        // plugin-owned ID
  n8nExecutionId,     // optional, only when n8n returned/provided it
  correlationId,
  businessKey,
  tag,
  status,             // queued/running/succeeded/failed/etc.
  duplicate: {
    policy: 'warn',
    activeExecutionIds: ['...'],
    ambiguous: false
  },
  result              // sanitized webhook result, if dispatch already completed
}
```

`getExecution()` should return one sanitized execution DTO or a not-found result; `queryExecutions()` should return `{ items, pageInfo: { limit, offset, nextOffset, hasMore } }`; `cancel()` should return `{ executionId, status, cancelled, noOp, unsupported, reason }`-style plain objects. [VERIFIED: codebase grep]

### Pattern 3: Transaction-Safe Dispatch

**What:** create the execution record first, then dispatch after commit through CAP queue or post-commit worker. [CITED: https://cap.cloud.sap/docs/node.js/queue][CITED: https://cap.cloud.sap/docs/node.js/events]

```javascript
// Source: CAP queue/events docs plus existing service style. [CITED: https://cap.cloud.sap/docs/node.js/queue]
async start(workflowId, inputs = {}, options = {}) {
  const execution = await this.store.createQueued({ workflowId, inputs, options })
  await this._enqueueDispatch(execution.executionId)
  return createStartResult({ ...execution, status: execution.status })
}
```

Use `cds.queued(this).send('dispatchExecution', { executionId })` where possible because CAP documents persistent queue messages as transactionally stored in the database. [CITED: https://cap.cloud.sap/docs/node.js/queue] If a direct Phase 2-style call is outside an ambient CAP request transaction, the service may commit the local execution record and then dispatch immediately or via the queued worker while keeping the same start result fields. [VERIFIED: codebase grep][CITED: https://cap.cloud.sap/docs/node.js/cds-tx]

### Pattern 4: Duplicate Detection

**What:** detect active duplicates before creating or dispatching a new execution. [VERIFIED: codebase grep]

Active statuses should be `queued`, `dispatching`, `running`, and `cancel_requested`; terminal statuses should be `succeeded`, `failed`, and `cancelled`; `unknown` should be treated as active for duplicate warnings until explicitly resolved. [VERIFIED: codebase grep]

Policy behavior:

| Policy | Behavior | Result |
|--------|----------|--------|
| `warn` | Create and dispatch a new execution but include duplicate metadata. | Default behavior from Phase 3 context. [VERIFIED: codebase grep] |
| `reject` | Do not create a new execution when active duplicates are found. | Throw/return a sanitized `ERR_N8N_DUPLICATE_EXECUTION` with active IDs. [VERIFIED: codebase grep] |
| `reuseActive` | Return the active execution when exactly one match exists. | Do not dispatch a duplicate; return `reused: true`. [VERIFIED: codebase grep] |
| `reuseActive` with multiple matches | Return an ambiguous duplicate result or sanitized error. | Do not choose one arbitrarily. [VERIFIED: codebase grep] |

### Pattern 5: Query and Paging

**What:** build CAP queries over first-class fields, not over serialized payloads. [VERIFIED: codebase grep]

Use defaults `limit = 50`, `offset = 0`, `maxLimit = 250`, and ordering `updatedAt desc`, then `createdAt desc`; validate `status` against the Phase 3 lifecycle list. [VERIFIED: codebase grep] The n8n public API also uses a `limit` parameter with max 250 for list endpoints, so the same cap is familiar for execution queries. [CITED: https://docs.n8n.io/api/api-reference/]

### Pattern 6: Cancellation

**What:** make cancellation state-aware and honest about unsupported webhook cases. [VERIFIED: codebase grep]

| Current Status | Action | Returned Semantics |
|----------------|--------|--------------------|
| missing | No store record to update. | `{ noOp: true, reason: 'not_found' }`. [VERIFIED: codebase grep] |
| queued | Mark local record `cancelled` and prevent dispatch. | `{ cancelled: true, status: 'cancelled' }`. [VERIFIED: codebase grep] |
| dispatching | Mark/request cancellation and let dispatcher check before/after HTTP response. | `{ cancelled: false, status: 'cancel_requested' }`. [VERIFIED: codebase grep] |
| running with `n8nExecutionId` and API stop enabled | Call n8n `POST /api/v1/executions/{id}/stop`. | Stop result, sanitized n8n response, and local state update. [CITED: https://docs.n8n.io/api/api-reference/] |
| running without `n8nExecutionId` | Do not mark cancelled. | `{ unsupported: true, noOp: true, reason: 'n8n_execution_id_unavailable' }`. [CITED: https://docs.n8n.io/code/cookbook/builtin/execution/][VERIFIED: codebase grep] |
| succeeded/failed/cancelled | Do not change terminal status. | meaningful terminal no-op. [VERIFIED: codebase grep] |

n8n exposes `$execution.id` inside workflows and an OpenAPI stop endpoint, but the current Phase 2 webhook response does not require an execution ID and tests already cover successful starts without one. [CITED: https://docs.n8n.io/code/cookbook/builtin/execution/][CITED: https://docs.n8n.io/api/api-reference/][VERIFIED: codebase grep]

### Anti-Patterns to Avoid

- Do not use n8n's returned execution ID as the local `executionId`; store it as `n8nExecutionId`. [VERIFIED: codebase grep]
- Do not expose `inputs`, dispatch payloads, auth headers, API keys, stack traces, or raw request bodies in query results or stored exposed envelopes. [VERIFIED: codebase grep]
- Do not put generic execution store, duplicate detection, dispatch, or cancel behavior in `demo-app`. [VERIFIED: codebase grep]
- Do not treat unsupported webhook cancellation as success. [VERIFIED: codebase grep][CITED: https://docs.n8n.io/api/api-reference/]
- Do not update existing Phase 2 tests by removing coverage for optional absent `executionId`; Phase 3 must still tolerate n8n responses without external IDs. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| After-commit dispatch | A raw `setTimeout` that sends webhooks from inside the CAP transaction. | CAP `cds.queued` persistent queue first; `req.on('succeeded')` + `cds.spawn/cds.tx` only as fallback. | CAP docs state queue messages are stored in the database within the transaction, and post-commit hooks run outside managed transactions. [CITED: https://cap.cloud.sap/docs/node.js/queue][CITED: https://cap.cloud.sap/docs/node.js/events] |
| Webhook retry/timeout/error path | A second HTTP client implementation. | Reuse/refactor `N8nWorkflowService` transport, retry, and sanitizer helpers. | Phase 2 tests already verify retry, timeout, auth header, and sanitized errors. [VERIFIED: codebase grep] |
| Secret redaction | A new ad hoc redaction list in store/query code. | Export/reuse the sanitizer from `errors.js`. | The existing sanitizer already filters API keys, headers, stack, inputs, payload, and request body fields. [VERIFIED: codebase grep] |
| Paging | Load every execution and slice arrays in memory. | CAP query `limit`/`offset` against indexed first-class fields. | CAPAPI-06 requires paging through large result sets. [VERIFIED: codebase grep] |
| Execution IDs | Hand-maintained counters in real mode. | `crypto.randomUUID()` or CAP UUID values for real persisted records; keep counters only for mock determinism. | Phase 3 requires plugin-owned IDs, and Phase 2 mock already uses deterministic counters for tests. [VERIFIED: codebase grep] |

**Key insight:** the plugin can own correlation, duplicate policy, query, and unsupported cancellation semantics locally while still using n8n as the workflow runtime. [VERIFIED: codebase grep][CITED: https://docs.n8n.io/workflows/executions/]

## Common Pitfalls

### Pitfall 1: Changing `start()` Into a Raw Store Insert

**What goes wrong:** existing callers and tests lose the Phase 2 `accepted/workflowId/executionId/correlationId/businessKey/result` envelope. [VERIFIED: codebase grep]
**How to avoid:** add status, duplicate, and local execution fields as optional envelope extensions and keep `n8n.start(...)` plus `n8n.send('start', ...)` compatibility. [VERIFIED: codebase grep]
**Warning signs:** tests in `n8n-service-contract.test.js` are deleted instead of updated for durable tracking. [VERIFIED: codebase grep]

### Pitfall 2: Dispatching Before Commit

**What goes wrong:** n8n can receive a workflow start for a CAP write that later rolls back. [CITED: https://cap.cloud.sap/docs/node.js/queue]
**How to avoid:** write the execution intent in the transaction and dispatch through CAP persistent queue or post-commit worker. [CITED: https://cap.cloud.sap/docs/node.js/queue][CITED: https://cap.cloud.sap/docs/node.js/events]
**Warning signs:** a service handler calls `_triggerWebhook()` before the execution record has committed. [VERIFIED: codebase grep]

### Pitfall 3: Persisting Payloads as Exposed Execution Data

**What goes wrong:** business input payloads or secrets leak through query/cancel APIs or docs. [VERIFIED: codebase grep]
**How to avoid:** keep dispatch payloads internal to the queue/outbox path and expose only sanitized `result` and `error` envelopes. [VERIFIED: codebase grep]
**Warning signs:** `queryExecutions()` returns `inputs`, `headers`, `apiKey`, `request`, or raw `payload` fields. [VERIFIED: codebase grep]

### Pitfall 4: Pretending n8n Cancellation Always Works

**What goes wrong:** CAP records show `cancelled` even when the plugin only has a webhook path and no n8n execution ID. [CITED: https://docs.n8n.io/api/api-reference/][VERIFIED: codebase grep]
**How to avoid:** call the n8n stop endpoint only with `n8nExecutionId` and API credentials; otherwise return `unsupported: true` and preserve honest status. [CITED: https://docs.n8n.io/api/api-reference/]
**Warning signs:** cancellation marks a running real-webhook execution as `cancelled` when `n8nExecutionId` is absent. [VERIFIED: codebase grep]

### Pitfall 5: Flaky Mock State Transitions

**What goes wrong:** timer-based tests intermittently observe `running` versus `succeeded`. [VERIFIED: codebase grep]
**How to avoid:** keep immediate mock success as the default for Phase 2 compatibility and add deterministic controls such as `mock.holdRunning`, `mock.completionDelayMs`, or explicit `completeMockExecution(executionId)`. [VERIFIED: codebase grep]
**Warning signs:** integration tests sleep arbitrary milliseconds to wait for mock completion. [VERIFIED: codebase grep]

## Code Examples

### CAP Queue Dispatch Registration

```javascript
// Source: CAP queue docs and existing CommonJS service style. [CITED: https://cap.cloud.sap/docs/node.js/queue]
async init() {
  this.on('start', (req) => this.start(req.data.workflowId, req.data.inputs, req.data.options || req.data))
  this.on('dispatchExecution', (req) => this.dispatcher.dispatch(req.data.executionId))
  this.on('getExecution', (req) => this.getExecution(req.data.executionId))
  this.on('queryExecutions', (req) => this.queryExecutions(req.data.filters || {}, req.data.page || {}))
  this.on('cancel', (req) => this.cancel(req.data.executionId))

  await super.init()
}

async _enqueueDispatch(executionId) {
  const queued = cds.queued(this)
  await queued.send('dispatchExecution', { executionId })
}
```

### Query Result Shape

```javascript
// Source: Phase 3 context. [VERIFIED: codebase grep]
{
  items: [
    {
      executionId: '...',
      workflowId: 'cap-test-trigger',
      status: 'running',
      businessKey: 'book-1',
      tag: 'admin-create',
      attempts: 1,
      createdAt: '2026-06-02T12:00:00.000Z',
      updatedAt: '2026-06-02T12:00:01.000Z'
    }
  ],
  pageInfo: {
    limit: 50,
    offset: 0,
    nextOffset: 50,
    hasMore: true
  }
}
```

### Duplicate Policy Envelope

```javascript
// Source: Phase 3 context. [VERIFIED: codebase grep]
{
  accepted: true,
  workflowId: 'cap-test-trigger',
  executionId: '...',
  status: 'queued',
  duplicate: {
    policy: 'warn',
    activeExecutionIds: ['...'],
    ambiguous: false
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct webhook POST as the only source of execution truth. | Local execution store plus queued after-commit dispatch. | Phase 3 planning scope, after Phase 2 completion on 2026-05-31. [VERIFIED: codebase grep] | Enables query, cancellation semantics, duplicate detection, retry visibility, and future annotations. [VERIFIED: codebase grep] |
| Optional n8n execution ID in webhook response. | Plugin-owned `executionId` with optional separate `n8nExecutionId`. | Locked Phase 3 decision. [VERIFIED: codebase grep] | Query/cancel remains stable even when n8n returns no execution ID. [VERIFIED: codebase grep] |
| CAP post-commit behavior as custom timing logic. | CAP `cds.queued` persistent queue for outbox-style service events. | CAP docs current as of research date. [CITED: https://cap.cloud.sap/docs/node.js/queue] | Reduces risk of remote calls before commit. [CITED: https://cap.cloud.sap/docs/node.js/queue] |
| Real n8n cancellation assumed through webhook path. | n8n OpenAPI stop endpoint only when execution ID/API scope exists; unsupported no-op otherwise. | n8n OpenAPI checked on 2026-06-02. [CITED: https://docs.n8n.io/api/api-reference/] | Prevents false `cancelled` status for unsupported webhook starts. [CITED: https://docs.n8n.io/api/api-reference/][VERIFIED: codebase grep] |

**Deprecated/outdated:**
- Treating mock `status: 'success'` as the final Phase 3 status vocabulary is outdated; Phase 3 status vocabulary is `queued`, `dispatching`, `running`, `succeeded`, `failed`, `cancel_requested`, `cancelled`, and `unknown`. [VERIFIED: codebase grep]
- Treating absence of n8n `executionId` as failure is outdated; Phase 2 explicitly accepts successful webhook responses without one. [VERIFIED: codebase grep]

## Integration Test Plan

| Test File | Coverage |
|-----------|----------|
| `test/integration/n8n-execution-store.test.js` | Store creates plugin-owned IDs, keeps `n8nExecutionId` separate, persists lifecycle fields, returns sanitized DTOs, and omits inputs/secrets. [VERIFIED: codebase grep] |
| `test/integration/n8n-dispatch-and-duplicates.test.js` | Queued dispatch calls the fake HTTP server after store creation, attempts increment on retry/failure, duplicate policies `warn`, `reject`, and `reuseActive` behave deterministically. [VERIFIED: codebase grep] |
| `test/integration/n8n-query-cancel.test.js` | `getExecution`, `queryExecutions`, paging, default order, missing execution, terminal no-op, queued cancellation, running unsupported cancellation, and n8n stop-call path. [VERIFIED: codebase grep][CITED: https://docs.n8n.io/api/api-reference/] |
| Existing Phase 2 integration tests | Update expected `executionId` to plugin-owned ID while preserving `accepted`, `workflowId`, correlation/business metadata, `send('start')`, optional absent n8n ID behavior, retry, timeout, and sanitizer coverage. [VERIFIED: codebase grep] |

Use the existing fake HTTP server pattern from `n8n-service-contract.test.js` and `n8n-webhook-runtime.test.js` instead of Docker n8n for automated integration tests. [VERIFIED: codebase grep] Keep Docker/manual n8n only as optional smoke evidence because local ports 3000 and 5678 were not running during research. [VERIFIED: command output]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Consuming CAP apps will have a database service when durable tracking is enabled. [ASSUMED] | Standard Stack / Architecture Patterns | If a CAP app has no persistence, Phase 3 must fail clearly or fall back to mock/in-memory mode rather than pretending durable query/cancel is available. |

## Open Questions (RESOLVED)

1. **Model auto-loading verification**
   - What we know: CAP plugin packages can auto-configure `cds` settings and package `index.cds` models can be loaded by consuming apps. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins][CITED: https://cap.cloud.sap/docs/guides/databases/initial-data]
   - What's unclear: this repo has no package-owned CDS model analog yet. [VERIFIED: codebase grep]
   - Recommendation: planner should add a first Wave 0 task that compiles the demo app with the plugin model loaded and fails if `cap.n8n.WorkflowExecutions` is absent from CSN. [VERIFIED: codebase grep]
   - Resolution: `03-01-PLAN.md` now requires `cds-plugin.js` model registration plus a consumer/demo effective-model verification that fails if `cap.n8n.WorkflowExecutions` is absent.

2. **Queue determinism in tests**
   - What we know: CAP documents persistent queue as transactional and database-backed by default. [CITED: https://cap.cloud.sap/docs/node.js/queue]
   - What's unclear: this repo has no existing queued-service tests or queue table setup. [VERIFIED: codebase grep]
   - Recommendation: planner should first prove a queued `dispatchExecution` event can be awaited or flushed deterministically in Vitest; if not, use a small internal `ExecutionDispatcher.dispatchPending()` helper for integration tests while keeping production dispatch queued. [VERIFIED: codebase grep]
   - Resolution: `03-01-PLAN.md` now requires an internal durable `WorkflowDispatches` outbox model, and `03-02-PLAN.md` now requires `req.on('succeeded')` post-commit dispatch plus deterministic `dispatchPending` drains with rollback/no-dispatch and commit/after-dispatch integration tests.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime and tests | yes | 24.16.0 | Node 20+ per package engines. [VERIFIED: command output][VERIFIED: npm registry] |
| npm | Workspaces and tests | yes | 11.13.0 | none needed. [VERIFIED: command output] |
| `npx cds` | CAP compile/model checks | yes | cds-dk 9.9.1 | Use `npx cds`, because direct `cds` command was not on PATH. [VERIFIED: command output] |
| Vitest | Integration tests | yes | 4.1.7 | none needed. [VERIFIED: command output] |
| Docker | Optional manual n8n | yes | 29.5.2 | Automated tests use fake HTTP server. [VERIFIED: command output][VERIFIED: codebase grep] |
| Docker Compose | Optional manual n8n | yes | v5.1.4 | Automated tests use fake HTTP server. [VERIFIED: command output][VERIFIED: codebase grep] |
| Local n8n on 5678 | Manual real-n8n smoke | no | port closed | Use fake HTTP server for automated tests. [VERIFIED: command output][VERIFIED: codebase grep] |
| CAP demo on 3000 | Manual CAP smoke | no | port closed | Use CAP service integration tests. [VERIFIED: command output][VERIFIED: codebase grep] |

**Missing dependencies with no fallback:** none for implementation-ready integration tests. [VERIFIED: command output]

**Missing dependencies with fallback:**
- Local n8n and CAP demo servers are not running; deterministic integration tests should not depend on them. [VERIFIED: command output][VERIFIED: codebase grep]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | n8n API keys stay in CAP/environment credentials and are never stored in exposed execution DTOs. [VERIFIED: codebase grep] |
| V3 Session Management | no | Phase 3 does not add browser/session behavior. [VERIFIED: codebase grep] |
| V4 Access Control | yes | Keep execution query/cancel as CAP service methods for application code; if served over OData later, protect with CAP authorization before exposure. [VERIFIED: codebase grep] |
| V5 Input Validation | yes | Validate workflow ID, execution ID, status filters, page bounds, duplicate policy, business key, and tag before queries/dispatch. [VERIFIED: codebase grep] |
| V6 Cryptography | yes | Use standard UUID generation for local IDs and do not implement custom crypto or secret storage. [VERIFIED: codebase grep] |

### Known Threat Patterns for CAP/n8n Execution Store

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret leakage through execution query results | Information Disclosure | Reuse `errors.js` sanitization and exclude inputs, headers, API keys, payloads, request bodies, and stack traces from exposed DTOs. [VERIFIED: codebase grep] |
| Duplicate side effects from retries | Repudiation / Tampering | Persist correlation fields and apply duplicate policies before dispatch. [VERIFIED: codebase grep] |
| Unauthorized cancellation | Elevation of Privilege | Keep cancel as backend CAP service behavior and require CAP auth if exposed through a served model. [VERIFIED: codebase grep] |
| False cancellation success | Repudiation | Return unsupported/no-op when `n8nExecutionId` or stop API credentials are absent. [CITED: https://docs.n8n.io/api/api-reference/][VERIFIED: codebase grep] |
| Payload persistence risk | Information Disclosure | Prefer CAP queue payload isolation and do not expose dispatch payloads through query/cancel APIs. [CITED: https://cap.cloud.sap/docs/node.js/queue][VERIFIED: codebase grep] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/03-execution-store-and-transaction-safe-dispatch/03-CONTEXT.md` - locked Phase 3 decisions, discretion, deferred scope. [VERIFIED: codebase grep]
- `.planning/REQUIREMENTS.md` - CAPAPI-04, CAPAPI-05, CAPAPI-06, RUNTIME-06, RUNTIME-07. [VERIFIED: codebase grep]
- `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/STATE.md` - phase goal, dependencies, current project position, Phase 2 decisions. [VERIFIED: codebase grep]
- `cap-n8n-plugin/lib/N8nWorkflowService.js`, `MockN8nWorkflowService.js`, `config.js`, `result.js`, `errors.js` - current runtime contracts and sanitization behavior. [VERIFIED: codebase grep]
- `test/integration/n8n-service-contract.test.js`, `n8n-mock-and-profiles.test.js`, `n8n-webhook-runtime.test.js` - existing integration patterns and Phase 2 assertions. [VERIFIED: codebase grep]
- SAP CAP queue docs: https://cap.cloud.sap/docs/node.js/queue - `cds.queued`, persistent queue, outbox-style deferred operations. [CITED: https://cap.cloud.sap/docs/node.js/queue]
- SAP CAP events docs: https://cap.cloud.sap/docs/node.js/events - `req.on('succeeded')`, `failed`, `done`, and post-transaction behavior. [CITED: https://cap.cloud.sap/docs/node.js/events]
- SAP CAP transaction docs: https://cap.cloud.sap/docs/node.js/cds-tx - `cds.tx`, `cds.spawn`, background jobs, and transaction behavior. [CITED: https://cap.cloud.sap/docs/node.js/cds-tx]
- SAP CAP plugin docs: https://cap.cloud.sap/docs/node.js/cds-plugins - `cds-plugin.js` loading and package auto-configuration. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins]
- n8n OpenAPI document loaded from `https://docs.n8n.io/api/v1/openapi.yml` via API reference page - execution list/read/stop endpoints. [CITED: https://docs.n8n.io/api/api-reference/]
- n8n execution docs: https://docs.n8n.io/workflows/executions/ and https://docs.n8n.io/code/cookbook/builtin/execution/ - execution concept and `$execution.id`. [CITED: https://docs.n8n.io/workflows/executions/][CITED: https://docs.n8n.io/code/cookbook/builtin/execution/]

### Secondary (MEDIUM confidence)

- `.planning/phases/03-execution-store-and-transaction-safe-dispatch/03-PATTERNS.md` - local pattern map for recommended files and tests. [VERIFIED: codebase grep]
- `.planning/codebase/ARCHITECTURE.md`, `INTEGRATIONS.md`, `TESTING.md` - codebase maps for package boundaries, local n8n integration, and test infrastructure. [VERIFIED: codebase grep]
- npm registry checks for `@sap/cds`, `@cap-js/sqlite`, and `vitest`. [VERIFIED: npm registry]

### Tertiary (LOW confidence)

- A1 in Assumptions Log: durable tracking assumes a consuming CAP app has a database service when durable real-mode tracking is enabled. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package versions were verified locally and through npm, and no new packages are recommended. [VERIFIED: npm registry][VERIFIED: command output]
- Architecture: HIGH - Phase 3 decisions are locked and CAP queue/transaction docs directly support the recommended after-commit path. [VERIFIED: codebase grep][CITED: https://cap.cloud.sap/docs/node.js/queue]
- Pitfalls: HIGH - risks map to existing Phase 2 tests, sanitizer code, and official CAP/n8n execution behavior. [VERIFIED: codebase grep][CITED: https://docs.n8n.io/api/api-reference/]

**Research date:** 2026-06-02
**Valid until:** 2026-07-02
