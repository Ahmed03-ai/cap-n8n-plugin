---
phase: 03-execution-store-and-transaction-safe-dispatch
plan: 01
subsystem: cap-plugin-runtime
tags: [sap-cap, cds, execution-store, vitest, commonjs]

requires:
  - phase: 02-typed-cap-service-mock-runtime-and-configuration
    provides: typed n8n start contract, runtime selection, retry/error sanitization helpers
provides:
  - plugin-owned cap.n8n.WorkflowExecutions persistence model
  - internal cap.n8n.WorkflowDispatches retry payload storage model
  - CAP-backed ExecutionStore with lifecycle status validation
  - sanitized execution, query, and cancel DTO helpers
  - integration tests for model/store/result contract
affects: [03-execution-store-and-transaction-safe-dispatch, phase-04-declarative-annotations]

tech-stack:
  added: []
  patterns:
    - CAP CDS package model registered through cds-plugin.js
    - CAP persistence wrapper using cds.ql INSERT, SELECT, and UPDATE
    - sanitized LargeString JSON envelopes for result and error data

key-files:
  created:
    - cap-n8n-plugin/index.cds
    - cap-n8n-plugin/lib/ExecutionStore.js
    - test/integration/n8n-execution-store.test.js
  modified:
    - cap-n8n-plugin/cds-plugin.js
    - cap-n8n-plugin/package.json
    - cap-n8n-plugin/lib/result.js
    - cap-n8n-plugin/lib/errors.js

key-decisions:
  - "Execution IDs are plugin-owned UUIDs; n8n-returned IDs are stored separately as n8nExecutionId."
  - "Raw dispatch payloads are stored only in internal WorkflowDispatches records and are omitted from public execution DTOs."
  - "The plugin registers index.cds as a consumer model while preserving explicit consumer impl and model overrides."

patterns-established:
  - "Execution DTOs are allowlisted first-class fields plus parsed sanitized result/error envelopes."
  - "D-01 lifecycle status validation is centralized in ExecutionStore."
  - "Configured secret values can be passed into the shared sanitizer for stored execution envelopes."

requirements-completed: [RUNTIME-07]

duration: 9 min
completed: 2026-06-02
---

# Phase 03 Plan 01: Execution Store Model and Result Contract Summary

**Plugin-owned CAP execution persistence with sanitized public DTOs and internal retry payload storage**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-02T14:51:28Z
- **Completed:** 2026-06-02T14:59:56Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `cap.n8n.WorkflowExecutions` with D-02 first-class query fields, local `executionId`, separate `n8nExecutionId`, and sanitized `result`/`error` envelope storage.
- Added internal `cap.n8n.WorkflowDispatches` for durable retry payload storage without exposing raw inputs through execution DTOs.
- Implemented `ExecutionStore` with queued creation, status helpers, result/error persistence, D-01 validation, and sanitized DTO conversion.
- Extended `result.js` with execution/query/cancel helpers while preserving Phase 2 `createStartResult`.
- Added integration coverage proving model visibility, CAP SQLite persistence, consumer effective-model registration, ID separation, dispatch storage, and secret redaction.

## Task Commits

1. **Task 1: Add execution store integration tests** - `ef8c1fa` (test)
2. **Task 2: Add plugin-owned execution model and package inclusion** - `4e4d355` (feat)
3. **Task 3: Implement ExecutionStore and sanitized DTO helpers** - `e5ef279` (feat)

## Files Created/Modified

- `cap-n8n-plugin/index.cds` - Defines package-owned `WorkflowExecutions` and internal `WorkflowDispatches` CDS entities.
- `cap-n8n-plugin/cds-plugin.js` - Registers the plugin model for consumers and preserves explicit implementation overrides.
- `cap-n8n-plugin/package.json` - Includes and exports `index.cds` and declares package CDS model metadata.
- `cap-n8n-plugin/lib/ExecutionStore.js` - Adds CAP persistence wrapper for execution records and dispatch payload rows.
- `cap-n8n-plugin/lib/result.js` - Adds sanitized execution, query, and cancel DTO helpers.
- `cap-n8n-plugin/lib/errors.js` - Exports reusable sanitizer with configured secret value support.
- `test/integration/n8n-execution-store.test.js` - Adds deterministic integration tests for the execution store/model/result contract.

## Verification

- `npx vitest run test/integration/n8n-execution-store.test.js` - PASS, 6 tests.
- `npx cds compile cap-n8n-plugin/index.cds --to csn` - PASS, CSN includes `cap.n8n.WorkflowExecutions` and `cap.n8n.WorkflowDispatches`.
- `node -e "const path=require('path'); const cds=require('@sap/cds'); cds.root=path.resolve('demo-app'); Promise.resolve(cds.plugins).then(()=>cds.load('*')).then(csn=>{ if(!csn.definitions['cap.n8n.WorkflowExecutions']) process.exit(1) }).catch(err=>{ console.error(err); process.exit(1) })"` - PASS.
- `npx vitest run test/integration/n8n-service-contract.test.js test/integration/n8n-mock-and-profiles.test.js test/integration/n8n-webhook-runtime.test.js test/smoke/package-boundaries.test.js` - PASS, 24 tests.

## Decisions Made

- The internal dispatch payload row is intentionally separate from public execution DTOs so later retry dispatch can reload payloads without leaking raw inputs through query results.
- The package exposes `./index.cds` because the required CAP compile command resolves the model as a package subpath on Windows.
- `ExecutionStore` returns plain DTOs through `createExecutionResult` instead of raw CAP rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exposed CDS model as package subpath**
- **Found during:** Task 2
- **Issue:** `npx cds compile cap-n8n-plugin/index.cds --to csn` could not resolve the model while package exports hid `./index.cds`.
- **Fix:** Added `./index.cds` to `cap-n8n-plugin/package.json` exports while also keeping `index.cds` in package files and CDS model metadata.
- **Files modified:** `cap-n8n-plugin/package.json`
- **Verification:** Required CAP compile command passed.
- **Committed in:** `4e4d355`

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking)
**Impact on plan:** Required for package/model resolution. No scope expansion beyond package inclusion.

## Issues Encountered

- Context7 CLI fallback was unavailable locally, so CAP API behavior was verified against installed `@sap/cds` commands and integration tests.

## Known Stubs

None - scan found only normal empty-object/default-parameter patterns, not placeholders or unwired UI data.

## Threat Flags

None - new persistence and payload boundaries were already covered by the plan threat model and verified with sanitizer assertions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 03-02. The execution model and store contract are in place for transaction-safe start wrapping, internal outbox dispatch, and post-commit retry behavior.

## Self-Check: PASSED

- Found created files: `cap-n8n-plugin/index.cds`, `cap-n8n-plugin/lib/ExecutionStore.js`, `test/integration/n8n-execution-store.test.js`, and this summary.
- Found task commits: `ef8c1fa`, `4e4d355`, and `e5ef279`.

---
*Phase: 03-execution-store-and-transaction-safe-dispatch*
*Completed: 2026-06-02*
