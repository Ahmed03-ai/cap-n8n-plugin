# Phase 3: Execution Store and Transaction-Safe Dispatch - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 turns Phase 2's typed programmatic workflow start into a durable execution layer. CAP developers must be able to track, query, page, cancel, and correlate workflow executions without relying only on n8n webhook responses. The phase owns persisted execution records, transaction-safe queued dispatch, retryable after-commit delivery, duplicate detection, query APIs, cancellation semantics, and mock-runtime parity for these behaviors.

This phase does not implement declarative CDS annotations, workflow import/build validation, n8n community-node metadata discovery, n8n CRUD/action operations, or deployment documentation. Phase 4 consumes the post-commit/outbox path from this phase for declarative triggers and cancellation.

</domain>

<decisions>
## Implementation Decisions

### Execution Record Contract

- **D-01:** Use a full execution lifecycle: `queued`, `dispatching`, `running`, `succeeded`, `failed`, `cancel_requested`, `cancelled`, and `unknown`.
- **D-02:** Store these fields as first-class queryable data: `executionId`, `correlationId`, `workflowId`, `status`, `businessKey`, `tag`, `attempts`, `createdAt`, `startedAt`, `finishedAt`, and `updatedAt`.
- **D-03:** Store `result` and `error` as sanitized structured JSON envelopes. Continue the Phase 2 secret-safety policy: no secrets, auth headers, request payloads, stack traces, or configured secret values in exposed execution data.
- **D-04:** Always create a CAP/plugin-owned `executionId`. If n8n returns its own ID, store it separately as `n8nExecutionId`.

### Dispatch And Duplicate Policy

- **D-05:** Persist a `queued` execution intent inside the CAP transaction, then dispatch only after commit or through an outbox worker.
- **D-06:** If dispatch fails after commit, keep the CAP write committed, retry from the persisted execution record, increment `attempts`, and store sanitized errors.
- **D-07:** Detect active duplicates by `workflowId` plus `correlationId` or `businessKey`/`tag`. Expose a duplicate or ambiguous signal, but do not block all starts by default.
- **D-08:** Duplicate handling is configurable per call. The default policy is `warn`; stricter callers may request policies such as `reject` or `reuseActive`.

### Query And Paging API

- **D-09:** Expose `getExecution(executionId)` for single-record lookup and `queryExecutions(filters, page)` for filtered lists.
- **D-10:** Initial filters are `executionId`, `workflowId`, `businessKey`, `tag`, and `status`, plus paging.
- **D-11:** `queryExecutions()` returns `{ items, pageInfo: { limit, offset, nextOffset, hasMore } }`.
- **D-12:** Default query ordering is `updatedAt desc`, then `createdAt desc`.

### Cancellation And Mock Parity

- **D-13:** `cancel(executionId)` is state-aware. Active statuses such as `queued`, `dispatching`, and `running` cancel or request cancellation; `cancel_requested` returns already requested; terminal statuses such as `succeeded`, `failed`, and `cancelled` return meaningful no-op results; missing executions return not found.
- **D-14:** If real n8n cannot cancel a webhook-triggered execution, return or record an unsupported no-op with a clear reason. Do not pretend cancellation happened.
- **D-15:** Mock mode should use deterministic state transitions: running records, optional configurable completion delay or explicit test helper, and cancel/query support against the in-memory store.
- **D-16:** The local execution store is the source of truth. Phase 3 should call real n8n only for minimal cancel/status integration where supported, and keep unsupported webhook cases explicit.

### the agent's Discretion

- Planner may choose exact helper/module names, CAP model names, and test file names, provided behavior stays package-owned under `cap-n8n-plugin`, follows CommonJS/CAP conventions, and preserves Phase 2 public start behavior.
- Planner may decide whether the outbox worker is implemented as an explicit service method, internal helper, CAP event hook, or testable module, as long as execution intent is persisted transactionally and dispatch occurs after commit.
- Planner may choose exact result envelope property names for duplicate/no-op/unsupported responses, provided the semantics above are visible to CAP developers and integration tests.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GSD Scope

- `.planning/ROADMAP.md` - Phase 3 goal, requirements, success criteria, and dependencies.
- `.planning/REQUIREMENTS.md` - `CAPAPI-04`, `CAPAPI-05`, `CAPAPI-06`, `RUNTIME-06`, and `RUNTIME-07`.
- `.planning/PROJECT.md` - core value, constraints, brownfield context, and project-level decisions.
- `.planning/STATE.md` - current project position and Phase 2 decisions affecting Phase 3.
- `.planning/phases/02-typed-cap-service-mock-runtime-and-configuration/02-CONTEXT.md` - Phase 2 decisions that defer durable tracking, query, duplicate detection, and cancellation to Phase 3.

### Requirements Source

- `cap_n8n_requirements_v2.md` - Epic 1 user stories, especially US 1.2, US 1.3, and the remaining mock execution behavior from US 1.4.

### Codebase Map

- `.planning/codebase/ARCHITECTURE.md` - current CAP plugin service adapter, package layer, data flow, and known anti-patterns.
- `.planning/codebase/INTEGRATIONS.md` - current n8n webhook integration, credentials, CAP OData, and local n8n setup.
- `.planning/codebase/TESTING.md` - current smoke/integration test patterns and CAP/n8n verification assets.

### Local Source Files

- `cap-n8n-plugin/lib/N8nWorkflowService.js` - webhook service implementation and current `start()` behavior to extend without regression.
- `cap-n8n-plugin/lib/MockN8nWorkflowService.js` - Phase 2 mock runtime records that Phase 3 expands into query/cancel/state-transition behavior.
- `cap-n8n-plugin/lib/config.js` - runtime selection and configuration defaults to preserve.
- `cap-n8n-plugin/lib/result.js` - current start result envelope and webhook path normalization.
- `test/integration/n8n-service-contract.test.js` - typed start contract integration coverage.
- `test/integration/n8n-mock-and-profiles.test.js` - mock/profile integration coverage.
- `test/integration/n8n-webhook-runtime.test.js` - webhook reliability, retry, timeout, and sanitized error coverage.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `cap-n8n-plugin/lib/N8nWorkflowService.js` already owns real webhook dispatch, retry handling, timeout behavior, sanitized transport errors, and the public `start()` method.
- `cap-n8n-plugin/lib/MockN8nWorkflowService.js` already keeps in-memory execution-shaped records with `executionId`, `workflowId`, `inputs`, status, timestamps, `correlationId`, and `businessKey`.
- `cap-n8n-plugin/lib/result.js` already creates stable start result envelopes and should be extended or mirrored for query/cancel results.
- Existing integration tests under `test/integration/` already exercise CAP service calls without Docker n8n and can be expanded for execution store, query, cancel, duplicate policy, and mock transitions.

### Established Patterns

- Runtime code uses JavaScript CommonJS, two-space indentation, single quotes, and mostly no semicolons in service files.
- CAP integration logs use `cds.log('n8n')`.
- Reusable CAP-to-n8n behavior belongs in `cap-n8n-plugin`, not in `demo-app`.
- Phase 2 errors are sanitized and machine-readable; Phase 3 execution records must preserve that safety boundary.
- Integration tests, not unit-test wording, are the expected verification language.

### Integration Points

- `cds.connect.to('n8n')` is the developer entry point.
- `n8n.start(workflowId, inputs, options)` must keep working and should begin creating tracked executions.
- `n8n.send('start', ...)` remains the CAP service compatibility path.
- New `getExecution`, `queryExecutions`, and `cancel` behavior should be available through the service API and CAP event/action compatibility where practical.
- Phase 4 declarative annotations will need the post-commit/outbox path and business-key/tag lookup semantics established here.

</code_context>

<specifics>
## Specific Ideas

- Use plugin-owned execution IDs so query/cancel stays stable even when n8n webhook responses do not include execution IDs.
- Keep `n8nExecutionId` separate from `executionId` to avoid ambiguity between local tracking and external n8n execution identity.
- Treat local execution records as the source of truth and real n8n cancellation/status as best-effort integration where supported.
- Model unsupported webhook cancellation explicitly rather than silently marking executions cancelled.
- Preserve the current Phase 2 retry semantics while adding execution-store attempts and after-commit retry visibility.
- Mock mode should become a deterministic integration-test surface for running, completion, cancellation, query, and failure paths.

</specifics>

<deferred>
## Deferred Ideas

- Declarative CAP start/cancel annotations remain Phase 4.
- Workflow import and build-time validation remain Phase 5.
- n8n community-node metadata discovery, dropdowns, OData request shaping, response cleanup, actions/functions, and composite-key behavior remain Phases 6 and 7.
- Deployment documentation, `.env.example` completeness, SAP BTP guidance, and final review readiness remain Phase 8.

</deferred>

---

*Phase: 03-execution-store-and-transaction-safe-dispatch*
*Context gathered: 2026-06-02*
