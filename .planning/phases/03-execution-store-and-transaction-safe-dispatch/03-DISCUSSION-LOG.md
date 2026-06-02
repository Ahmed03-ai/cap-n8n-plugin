# Phase 3: Execution Store and Transaction-Safe Dispatch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 3-Execution Store and Transaction-Safe Dispatch
**Areas discussed:** Execution Record Contract, Dispatch And Duplicate Policy, Query And Paging API, Cancellation And Mock Parity

---

## Execution Record Contract

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Status lifecycle | Full lifecycle | `queued`, `dispatching`, `running`, `succeeded`, `failed`, `cancel_requested`, `cancelled`, `unknown`. | yes |
| Status lifecycle | Simple lifecycle | `running`, `succeeded`, `failed`, `cancelled`. | |
| Status lifecycle | Mirror n8n only | Store whatever n8n returns. | |
| First-class fields | Correlation-focused | `executionId`, `correlationId`, `workflowId`, `status`, `businessKey`, `tag`, `attempts`, `createdAt`, `startedAt`, `finishedAt`, `updatedAt`. | yes |
| First-class fields | Minimal required fields | `executionId`, `workflowId`, `status`, `createdAt`, `updatedAt`, with details elsewhere. | |
| First-class fields | Expanded audit fields | Correlation-focused fields plus source and last-error audit fields. | |
| Result/error storage | Sanitized envelopes | Store structured `result` and `error` JSON without secrets or sensitive payload data. | yes |
| Result/error storage | Result only, errors as text | Store result JSON and text error fields. | |
| Result/error storage | No payload storage | Store only status/timestamps/error code. | |
| Execution IDs | Plugin-owned execution ID plus optional n8n ID | Always create local `executionId`; store external ID as `n8nExecutionId` when available. | yes |
| Execution IDs | Use n8n ID when available, generate fallback | `executionId` may be local or external. | |
| Execution IDs | Require n8n execution ID | Mark unknown/failed when n8n does not provide an ID. | |

**User's choice:** Full lifecycle, correlation-focused fields, sanitized envelopes, and plugin-owned execution IDs.
**Notes:** These decisions preserve Phase 2's flexible webhook response handling while giving Phase 3 stable query/cancel identity.

---

## Dispatch And Duplicate Policy

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Dispatch timing | Create before dispatch, send only after commit | Persist `queued` intent transactionally, then dispatch after commit/outbox. | yes |
| Dispatch timing | Create and dispatch immediately inside handler | Simpler, but workflows may fire before rollback. | |
| Dispatch timing | Dispatch first, record afterward | Captures only real n8n attempts, but weakens transaction safety. | |
| Dispatch failure | Retry from persisted execution record | Keep CAP write committed, increment attempts, store sanitized error, retry later. | yes |
| Dispatch failure | Fail only the execution, no automatic retry | Store failure and expose it through query. | |
| Dispatch failure | Try to roll back CAP write | Stronger consistency attempt after commit, but unsafe. | |
| Duplicate strictness | Warn and expose ambiguity | Detect active duplicates and signal them without blocking by default. | yes |
| Duplicate strictness | Block duplicates by default | Refuse starts when same workflow/business key is active. | |
| Duplicate strictness | Allow duplicates, only query later | Store everything and let developers inspect manually. | |
| Duplicate configurability | Yes: default warn, optional reject or reuse | Allow per-call policies such as `warn`, `reject`, `reuseActive`. | yes |
| Duplicate configurability | No: one global behavior | Use one fixed duplicate behavior. | |
| Duplicate configurability | Configuration only, not per call | Use workflow/config defaults only. | |

**User's choice:** Transactional queued intent plus after-commit/outbox dispatch; retry failed dispatch; warn by default on duplicates; allow per-call duplicate policies.
**Notes:** This is the main Phase 4 dependency because annotations need reliable post-commit behavior.

---

## Query And Paging API

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| API shape | `getExecution()` plus `queryExecutions()` | One method for single lookup, one for filtered lists. | yes |
| API shape | Single `query()` method only | One overloaded method for all lookups. | |
| API shape | CAP entity only, no JS helpers | Expose executions only through CAP/OData reads. | |
| Filters | Roadmap filters only | `executionId`, `workflowId`, `businessKey`, `tag`, `status`, plus paging. | yes |
| Filters | Roadmap filters plus time ranges | Add created/updated time ranges. | |
| Filters | Free-form CAP query support | Let consumers query any exposed field. | |
| Paging shape | Items plus cursor/page metadata | `{ items, pageInfo: { limit, offset, nextOffset, hasMore } }`. | yes |
| Paging shape | Items plus total count | `{ items, total, limit, offset }`. | |
| Paging shape | Raw array only | Return only execution records. | |
| Default ordering | Newest updated first | `updatedAt desc`, then `createdAt desc`. | yes |
| Default ordering | Newest created first | `createdAt desc`. | |
| Default ordering | Caller must specify ordering | No hidden default. | |

**User's choice:** `getExecution()` plus `queryExecutions()`, roadmap filters, page metadata without total count, newest updated first.
**Notes:** This matches CAPAPI-05 and CAPAPI-06 without broadening into arbitrary analytics.

---

## Cancellation And Mock Parity

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Cancel by status | State-aware results | Active statuses cancel/request cancellation; terminal statuses no-op; missing returns not found. | yes |
| Cancel by status | Throw unless running | Only active executions can be cancelled. | |
| Cancel by status | Always no-op if not active | Quiet no-op for non-active records. | |
| Unsupported real cancel | Mark CAP record and report unsupported | Return/record unsupported no-op with a clear reason. | yes |
| Unsupported real cancel | Always mark cancelled locally | Simpler, but may be false. | |
| Unsupported real cancel | Always throw | Clear failure, noisier for declarative cancellation. | |
| Mock state | Deterministic state transitions | Running records, optional completion delay/test helper, cancel/query support. | yes |
| Mock state | Immediate terminal records only | Keep Phase 2 immediate success/failure behavior. | |
| Mock state | Manual test hooks only | Tests explicitly set statuses. | |
| Real n8n API scope | Minimal cancel/query integration plus local store | Local store is source of truth; call n8n only where supported. | yes |
| Real n8n API scope | Full n8n execution API integration | Query/cancel primarily from n8n API. | |
| Real n8n API scope | No real n8n API yet | Local store/query/mock only. | |

**User's choice:** State-aware cancellation, explicit unsupported webhook cancellation, deterministic mock transitions, and local-store-first real n8n integration.
**Notes:** Cancellation should be useful for both programmatic callers and later declarative Phase 4 cancellation.

---

## the agent's Discretion

- Exact helper names, module boundaries, CAP model names, and test file names.
- Exact worker/outbox implementation mechanism, provided dispatch occurs after commit.
- Exact response envelope field names for duplicate, no-op, and unsupported results.

## Deferred Ideas

- Declarative annotations remain Phase 4.
- Workflow import/build validation remains Phase 5.
- n8n community-node metadata discovery/actions/functions remain Phases 6 and 7.
- Deployment and release docs remain Phase 8.
