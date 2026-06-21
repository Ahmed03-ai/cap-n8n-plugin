---
phase: 03-execution-store-and-transaction-safe-dispatch
plan: 02
subsystem: cap-plugin-runtime
tags: [sap-cap, cds, execution-store, outbox, vitest, commonjs]

requires:
  - phase: 03-execution-store-and-transaction-safe-dispatch
    provides: plugin-owned WorkflowExecutions and internal WorkflowDispatches model/store contract
provides:
  - transaction-safe tracked n8n start path with plugin-owned execution IDs
  - reusable ExecutionDispatcher draining internal WorkflowDispatches payloads
  - post-commit dispatch through req.on('succeeded') for CAP request calls
  - deterministic dispatchPending retry path for queued and failed outbox rows
  - integration coverage for rollback no-dispatch, after-commit dispatch, attempts, and sanitized failures
affects: [03-execution-store-and-transaction-safe-dispatch, phase-04-declarative-annotations]

tech-stack:
  added: []
  patterns:
    - CAP request post-commit hook dispatch via req.on('succeeded')
    - internal durable outbox drain using WorkflowDispatches payload records
    - retry attempts persisted per outbound webhook attempt

key-files:
  created:
    - cap-n8n-plugin/lib/ExecutionDispatcher.js
    - test/integration/n8n-dispatch-and-duplicates.test.js
  modified:
    - cap-n8n-plugin/lib/N8nWorkflowService.js
    - cap-n8n-plugin/lib/ExecutionStore.js
    - cap-n8n-plugin/lib/result.js
    - test/integration/n8n-service-contract.test.js
    - test/integration/n8n-webhook-runtime.test.js

key-decisions:
  - "Dispatch attempts are counted per outbound webhook attempt and persisted on execution plus outbox records."
  - "CAP request starts register req.on('succeeded') and mutate the accepted result with dispatch outcome after commit; standalone starts dispatch only after the durable write completes."
  - "dispatchPending drains queued and failed internal outbox rows so failed dispatch can be retried from persisted payload state."

patterns-established:
  - "N8nWorkflowService writes execution and internal dispatch rows before any webhook call."
  - "ExecutionDispatcher reuses N8nWorkflowService._dispatchWebhook for URL, auth header, timeout, retry, and sanitized error semantics."
  - "Public start/execution DTOs remain allowlisted and never expose WorkflowDispatches.payload."

requirements-completed: [RUNTIME-06, RUNTIME-07]

duration: 17 min
completed: 2026-06-02
---

# Phase 03 Plan 02: Tracked Dispatch and Transaction-Safe Start Summary

**Post-commit n8n dispatch with durable local execution tracking and internal outbox retries**

## Performance

- **Duration:** 17 min
- **Started:** 2026-06-02T15:00:00Z
- **Completed:** 2026-06-02T15:13:52Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `ExecutionDispatcher` to load internal `WorkflowDispatches` rows, mark executions dispatching/running/succeeded/failed, persist attempts, and retry from durable payloads.
- Updated `N8nWorkflowService.start()` and `send('start', ...)` to create queued executions plus internal dispatch payloads before webhook calls.
- Implemented CAP request post-commit dispatch with `req.on('succeeded')`; rollback does not dispatch and standalone starts dispatch only after the execution/outbox write completes.
- Preserved Phase 2 start/send envelopes while changing public `executionId` to the plugin-owned UUID and storing n8n-returned IDs as `n8nExecutionId`.
- Added integration tests for queued start, rollback no-dispatch, commit after-dispatch, persisted attempts, sanitized failures, and `dispatchPending` retry.

## Task Commits

1. **Task 1: Add tracked dispatch integration tests** - `119c21b` (test, RED)
2. **Task 2: Implement reusable execution dispatcher** - `2df09d9` (feat, GREEN)
3. **Task 3: Wire tracked start and post-commit dispatch path** - `2df09d9` (feat, GREEN)

_Note: Task 2 and Task 3 implementation landed in the same green commit because the dispatcher can only be verified through the wired service start/outbox path required by the plan._

## Files Created/Modified

- `cap-n8n-plugin/lib/ExecutionDispatcher.js` - Drains queued/failed internal dispatch rows, records attempts, reuses webhook transport, and persists sanitized outcomes.
- `cap-n8n-plugin/lib/ExecutionStore.js` - Adds transactional store helpers, internal dispatch lookup/drain helpers, and attempt persistence on dispatch rows.
- `cap-n8n-plugin/lib/N8nWorkflowService.js` - Wires tracked start, `dispatchExecution`, `dispatchPending`, post-commit hooks, standalone durable dispatch, and reusable `_dispatchWebhook`.
- `cap-n8n-plugin/lib/result.js` - Extends start envelopes with `n8nExecutionId`, `status`, `tag`, `attempts`, and sanitized `error`.
- `test/integration/n8n-dispatch-and-duplicates.test.js` - Adds deterministic integration coverage for transaction-safe dispatch behavior.
- `test/integration/n8n-service-contract.test.js` - Updates Phase 2 compatibility assertions for plugin-owned IDs and `n8nExecutionId`.
- `test/integration/n8n-webhook-runtime.test.js` - Updates retry/runtime assertions for plugin-owned IDs while preserving webhook reliability coverage.

## Verification

- `npx vitest run test/integration/n8n-dispatch-and-duplicates.test.js test/integration/n8n-service-contract.test.js test/integration/n8n-webhook-runtime.test.js` - RED before implementation: expected failures showed immediate dispatch, n8n-owned execution IDs, and missing store/dispatchPending.
- `npx vitest run test/integration/n8n-dispatch-and-duplicates.test.js test/integration/n8n-service-contract.test.js test/integration/n8n-webhook-runtime.test.js` - PASS, 15 tests.
- `npx vitest run test/integration/n8n-execution-store.test.js` - PASS, 6 tests.
- `npm test` - PASS, smoke 3 tests and integration 32 tests.

## Decisions Made

- Attempts are incremented by the dispatcher before each outbound webhook attempt, including retry attempts inside the Phase 2 retry loop.
- Standalone `start()` preserves Phase 2 failure behavior by throwing dispatch errors after the queued execution and outbox payload have already been committed.
- CAP request starts return a queued accepted envelope first and then update that same envelope with the dispatch outcome from the post-commit `succeeded` hook.

## Deviations from Plan

None - code scope executed as planned. The only process adjustment was combining Task 2 and Task 3 implementation into one green commit because their verification path is coupled.

## Issues Encountered

- Context7 CLI fallback was unavailable locally, so CAP `succeeded` transaction behavior was verified against installed `@sap/cds` source and integration tests.

## Known Stubs

None - scan found only normal default-parameter patterns in changed files, not placeholders or unwired data.

## Threat Flags

None - new dispatch, outbox, retry, and persisted-error surfaces were covered by the plan threat model and integration assertions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 03-03. The durable start/outbox path now carries execution IDs, correlation/business metadata, attempts, status, sanitized results/errors, and internal payloads needed for duplicate policy work without exposing raw payloads publicly.

## Self-Check: PASSED

- Found created files: `cap-n8n-plugin/lib/ExecutionDispatcher.js`, `test/integration/n8n-dispatch-and-duplicates.test.js`, and this summary.
- Found task commits: `119c21b` and `2df09d9`.

---
*Phase: 03-execution-store-and-transaction-safe-dispatch*
*Completed: 2026-06-02*
