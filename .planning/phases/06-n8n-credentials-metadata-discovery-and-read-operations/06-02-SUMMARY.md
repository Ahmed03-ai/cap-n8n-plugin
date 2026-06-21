---
phase: 06-n8n-credentials-metadata-discovery-and-read-operations
plan: 02
subsystem: n8n-node
tags: [n8n, sap-cap, odata, response-cleanup, nodeoperationerror, vitest]

# Dependency graph
requires:
  - phase: 06-01
    provides: SAP CAP n8n credential and metadata discovery package baseline
provides:
  - Recursive OData metadata stripping for Query and Read outputs
  - Strict Query and Read response-shape validation
  - Sanitized CAP/OData error classification helpers
  - n8n continueOnFail item and NodeOperationError helper contracts for Plan 06-03
affects: [06-03, phase-07, n8n-node-runtime]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Built-helper integration tests import from cap-n8n-node/dist after workspace build
    - OData helper returns allowlisted safe errors before n8n item or thrown-error conversion

key-files:
  created:
    - cap-n8n-node/nodes/SapCap/ODataResponse.ts
    - test/integration/n8n-node-response-cleanup.test.js
  modified: []

key-decisions:
  - "OData response helpers return allowlisted safe-error objects instead of carrying raw HTTP details."
  - "ODataResponse remains a standalone helper module for Plan 06-03 to wire into SapCap.execute()."

patterns-established:
  - "Response cleanup: Query requires an OData value array; Read requires one entity object; both produce paired n8n items."
  - "Error handling: classify first into a safe category/message/status shape, then convert to continueOnFail JSON or NodeOperationError."

requirements-completed: [NODE-10, NODE-11]

# Metrics
duration: 11min
completed: 2026-06-03
---

# Phase 06 Plan 02: OData Response Cleanup and Sanitized Error Helpers Summary

**Built OData Query/Read cleanup plus allowlisted n8n error helpers for SAP CAP responses**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-03T13:36:28Z
- **Completed:** 2026-06-03T13:47:55Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Added `ODataResponse.ts` with recursive `@odata.*` stripping and strict Query/Read item normalization.
- Added sanitized CAP/OData error classification for authentication, authorization, not-found, validation, server, network, configuration, and response-shape failures.
- Added reusable `continueOnFail` item and `NodeOperationError` helpers for Plan 06-03 runtime wiring.
- Added built-helper integration coverage with 8 assertions against compiled `cap-n8n-node/dist` output.

## Task Commits

Each task was committed through TDD RED/GREEN gates:

1. **Task 1: Normalize Query and Read responses into plain n8n items**
   - `df14c72` test: add failing OData response cleanup tests
   - `9706ad3` feat: implement OData response cleanup helpers
2. **Task 2: Classify sanitized CAP/OData errors**
   - `759e769` test: add failing sanitized CAP error tests
   - `f1cf85c` feat: classify sanitized SAP CAP errors
3. **Task 3: Produce NodeOperationError and continueOnFail item helpers**
   - `db020a4` test: add failing n8n error helper tests
   - `fa36db4` feat: add n8n error output helpers

**Plan metadata:** committed after this summary.

## Files Created/Modified

- `cap-n8n-node/nodes/SapCap/ODataResponse.ts` - Reusable cleanup, validation, classification, continueOnFail, and NodeOperationError helpers.
- `test/integration/n8n-node-response-cleanup.test.js` - Built-helper integration tests for cleanup, response shapes, sanitized categories, secret stripping, and n8n error output contracts.

## Decisions Made

- OData response helpers return allowlisted safe-error objects instead of carrying raw HTTP details. This keeps auth headers, tokens, passwords, client secrets, stack traces, request bodies, and full response bodies out of node-visible errors.
- `ODataResponse.ts` remains a standalone helper module for Plan 06-03 to wire into `SapCap.execute()`. This preserves the declared 06-02 scope while still compiling the built helper for integration tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced unsupported Vitest matcher**
- **Found during:** Task 1 GREEN verification
- **Issue:** `toThrowErrorMatchingObject` is not available in the current Vitest assertion API.
- **Fix:** Added `expectResponseShapeFailure()` helper using explicit try/catch plus `toMatchObject`.
- **Files modified:** `test/integration/n8n-node-response-cleanup.test.js`
- **Verification:** `npx vitest run test/integration/n8n-node-response-cleanup.test.js`
- **Committed in:** `9706ad3`

**2. [Rule 1 - Bug] Narrowed overbroad secret-leak assertions**
- **Found during:** Task 2 GREEN verification
- **Issue:** The test initially rejected allowed safe strings such as the `authorization` category and approved "OData request" copy.
- **Fix:** Adjusted assertions to reject raw header names/values and fake secrets instead of approved category or user-facing copy.
- **Files modified:** `test/integration/n8n-node-response-cleanup.test.js`
- **Verification:** `npx vitest run test/integration/n8n-node-response-cleanup.test.js`
- **Committed in:** `f1cf85c`

**3. [Rule 1 - Bug] Aligned NodeOperationError test import with built helper runtime**
- **Found during:** Task 3 GREEN verification
- **Issue:** The test imported `NodeOperationError` through the ESM path while the built helper used the CommonJS package entry, producing different class instances for `instanceof`.
- **Fix:** Used `createRequire()` to import `n8n-workflow` the same way the built helper resolves it.
- **Files modified:** `test/integration/n8n-node-response-cleanup.test.js`
- **Verification:** `npx vitest run test/integration/n8n-node-response-cleanup.test.js`
- **Committed in:** `fa36db4`

---

**Total deviations:** 3 auto-fixed (3 Rule 1 test-harness bugs)
**Impact on plan:** No scope expansion. Fixes were required for deterministic integration evidence against the existing toolchain.

## Issues Encountered

None unresolved. The `n8n-node build` command emits an existing Node deprecation warning from the build tool invocation, but the build succeeds.

## Known Stubs

None. Changed-file stub scan found no TODO, FIXME, placeholder, coming-soon, not-available, or empty-data rendering stubs.

## Authentication Gates

None.

## Verification

- `npm run build --workspace n8n-nodes-sap-cap` - PASS
- `npx vitest run test/integration/n8n-node-response-cleanup.test.js` - PASS, 8 tests

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 06-03. The next plan can import `normalizeODataItems`, `classifySapCapError`, `toContinueOnFailItem`, and `toNodeOperationError` into `SapCap.execute()` to wire Query and Read runtime behavior.

## Self-Check: PASSED

- Found `cap-n8n-node/nodes/SapCap/ODataResponse.ts`
- Found `test/integration/n8n-node-response-cleanup.test.js`
- Found task commits `df14c72`, `9706ad3`, `759e769`, `f1cf85c`, `db020a4`, and `fa36db4`
- Re-ran plan-level verification successfully.

---
*Phase: 06-n8n-credentials-metadata-discovery-and-read-operations*
*Completed: 2026-06-03*
