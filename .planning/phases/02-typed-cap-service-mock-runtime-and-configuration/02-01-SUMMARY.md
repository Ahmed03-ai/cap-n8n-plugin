---
phase: 02-typed-cap-service-mock-runtime-and-configuration
plan: 01
subsystem: cap-service
tags: [sap-cap, n8n, webhook, vitest, commonjs]

# Dependency graph
requires:
  - phase: 01-package-foundations-and-tooling
    provides: Package exports, workspace tooling, and Vitest smoke-test baseline
provides:
  - Package-owned N8nWorkflowService.start contract for CAP consumers
  - Shared webhook path normalization and start-result envelope helpers
  - Integration tests for cds.connect.to('n8n'), start(), send('start'), and webhook path behavior
affects: [phase-02-runtime, phase-03-execution-store, phase-04-annotations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CAP service method delegates to existing CAP event compatibility path
    - Schema-friendly start result envelope shared by webhook and future mock runtimes

key-files:
  created:
    - cap-n8n-plugin/lib/result.js
    - test/integration/n8n-service-contract.test.js
  modified:
    - cap-n8n-plugin/lib/N8nWorkflowService.js

key-decisions:
  - "Keep workflowId caller-facing in start results while normalizing only outbound webhook paths."
  - "Wrap webhook responses in accepted/result envelopes and extract executionId only when the webhook response provides it."

patterns-established:
  - "N8nWorkflowService.start(workflowId, inputs, options) is the ergonomic API; send('start') delegates to the same method."
  - "normalizeWebhookPath() strips one leading slash, preserves webhook/webhook-test paths, and prefixes short names with webhook/."
  - "createStartResult() returns accepted, workflowId, optional executionId/correlation metadata, and optional result without durable status fields."

requirements-completed: [CAPAPI-01, CAPAPI-02, CAPAPI-03]

# Metrics
duration: 5 min
completed: 2026-05-31
---

# Phase 02 Plan 01: Typed CAP Service Start Contract Summary

**Programmatic CAP n8n start contract with webhook path normalization, schema-friendly result envelopes, and integration coverage**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-31T22:06:00Z
- **Completed:** 2026-05-31T22:10:45Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added a Vitest integration contract proving CAP resolves `cds.connect.to('n8n')`, exposes `start()`, preserves `send('start')`, posts to normalized webhook paths, and returns the expected result metadata.
- Extracted shared CommonJS helpers for webhook path normalization and schema-friendly start-result envelopes.
- Updated `N8nWorkflowService` so direct `start(workflowId, inputs, options)` and CAP event dispatch use the same webhook transport/result path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add integration tests for the start contract** - `2d7898f` (test)
2. **Task 2: Extract schema-friendly result and path helpers** - `861d1c9` (feat)
3. **Task 3: Implement the convenience start method and event compatibility** - `cd05e4a` (feat)

## Files Created/Modified

- `test/integration/n8n-service-contract.test.js` - Integration contract using CAP service resolution and a local HTTP webhook server.
- `cap-n8n-plugin/lib/result.js` - Shared `normalizeWebhookPath` and `createStartResult` helpers.
- `cap-n8n-plugin/lib/N8nWorkflowService.js` - Public `start()` method, CAP event delegation, helper-backed path normalization, and result-envelope wrapping.

## Decisions Made

- Kept `workflowId` as the caller-provided identifier in returned envelopes while normalizing only the outbound webhook path. This preserves the developer contract while supporting n8n webhook and webhook-test paths.
- Treated top-level `executionId` as optional and sourced only from the webhook response when present. Phase 3 still owns durable execution storage, query, cancel, and duplicate detection.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- `npx vitest run test/integration/n8n-service-contract.test.js` failed during the RED gate as expected before runtime changes.
- `node -e "const r=require('./cap-n8n-plugin/lib/result'); if(r.normalizeWebhookPath('x')!=='webhook/x') process.exit(1); if(r.normalizeWebhookPath('webhook-test/x')!=='webhook-test/x') process.exit(1); const out=r.createStartResult({workflowId:'x',correlationId:'c'}); if(!out.accepted||out.correlationId!=='c'||'status' in out) process.exit(1)"` passed.
- `npx vitest run test/integration/n8n-service-contract.test.js test/smoke/package-boundaries.test.js` passed with 2 files and 5 tests.

## Known Stubs

None - stub scan found no placeholder text or UI-facing empty mock data. Empty object/array defaults in runtime and test helpers are intentional function defaults or local request capture state.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02-01 satisfies CAPAPI-01, CAPAPI-02, and CAPAPI-03 for the base start contract. The contract is ready for the remaining Phase 2 work on mock runtime selection, configuration profiles, timeout/retry behavior, and sanitized errors.

## Self-Check

PASSED

- **Created files exist:** `cap-n8n-plugin/lib/result.js`, `test/integration/n8n-service-contract.test.js`, and this SUMMARY file.
- **Commits exist:** `2d7898f`, `861d1c9`, and `cd05e4a` found in git log.
- **Verification rerun:** `npx vitest run test/integration/n8n-service-contract.test.js test/smoke/package-boundaries.test.js` passed with 2 files and 5 tests.

---
*Phase: 02-typed-cap-service-mock-runtime-and-configuration*
*Completed: 2026-05-31*
