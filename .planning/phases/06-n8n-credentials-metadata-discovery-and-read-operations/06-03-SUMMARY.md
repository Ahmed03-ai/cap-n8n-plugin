---
phase: 06-n8n-credentials-metadata-discovery-and-read-operations
plan: 03
subsystem: n8n-node
tags: [n8n, sap-cap, odata, query, read, integration-tests, vitest]

requires:
  - phase: 06-01
    provides: SAP CAP Basic Auth credentials, metadata load options, and Query/Read node metadata
  - phase: 06-02
    provides: OData response cleanup and sanitized n8n error helper contracts
provides:
  - End-to-end Query and Read execution for the SAP CAP n8n node
  - Fake CAP/OData integration coverage for metadata, Basic Auth, Query, Read, error categories, and continueOnFail
  - Aggregate Phase 6 source and runtime gates excluding deferred mutation/action/trigger scope
affects: [phase-07, n8n-node-runtime, NODE-05, NODE-06, NODE-10, NODE-11]

tech-stack:
  added: []
  patterns:
    - Built-node integration tests instantiate SapCap from cap-n8n-node/dist and drive execute/load-options contexts directly
    - SapCap.execute delegates request construction, response cleanup, and n8n error output to shared helper modules
    - Aggregate source gates inspect comment-filtered runtime source instead of brittle unfiltered grep counts

key-files:
  created:
    - test/integration/n8n-node-read-operations.test.js
  modified:
    - cap-n8n-node/nodes/SapCap/SapCap.node.ts
    - cap-n8n-node/nodes/SapCap/GenericFunctions.ts

key-decisions:
  - "SapCap.execute stays read-only in Phase 6 and rejects unsupported operation values before sending CAP requests."
  - "Unknown or unauthenticated credential modes are treated as sanitized configuration failures instead of silently sending unauthenticated requests."
  - "Query and Read success and failure paths now use the Plan 06-02 ODataResponse helper contract rather than node-local shallow cleanup."

patterns-established:
  - "Runtime tests use fake CAP/OData HTTP servers plus minimal n8n execute/load-options contexts against built dist modules."
  - "Successful Query/Read outputs and continueOnFail outputs always carry pairedItem metadata."
  - "Phase aggregate gates live with the runtime integration test so deferred node-surface regressions fail deterministically."

requirements-completed: [NODE-02, NODE-03, NODE-04, NODE-05, NODE-06, NODE-10, NODE-11]

duration: 8min
completed: 2026-06-03
---

# Phase 06 Plan 03: Query and Read Runtime Behavior Summary

**SAP CAP n8n node Query/Read runtime with fake CAP integration coverage, cleaned OData items, and sanitized n8n error outputs**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-03T13:54:18Z
- **Completed:** 2026-06-03T14:01:48Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added a built-node fake CAP/OData integration suite covering Basic Auth metadata loading, manual entity-set execution, Query, Read, sanitized errors, continueOnFail, and OAuth2 scaffold behavior.
- Wired `SapCap.execute()` to `normalizeODataItems`, `classifySapCapError`, `toContinueOnFailItem`, and `toNodeOperationError` from `ODataResponse.ts`.
- Added aggregate Phase 6 gates that reject deferred mutation/action/trigger runtime paths, unauthenticated credential modes, raw response shapes, and read-only metadata regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fake CAP/OData integration coverage for Query and Read** - `2d63998` (test)
2. **Task 2: Wire SapCap execute to Query/Read helpers** - `c6d6ec9` (feat)
3. **Task 3: Run aggregate Phase 6 verification and source gates** - `7232e60` (test)

**Plan metadata:** committed after this summary.

## Files Created/Modified

- `test/integration/n8n-node-read-operations.test.js` - Fake CAP/OData integration coverage and aggregate Phase 6 runtime/source gates.
- `cap-n8n-node/nodes/SapCap/SapCap.node.ts` - Query/Read execute adapter now delegates to shared request, cleanup, and n8n error helpers.
- `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` - Unsupported credential modes now fail as sanitized configuration errors before transport.

## Decisions Made

- Kept `SapCap.execute()` as a thin adapter and reused the helper modules from Plans 06-01 and 06-02 instead of duplicating cleanup and error behavior in the node class.
- Treated unsupported operation values as validation failures before any CAP request, which keeps Phase 7 mutation/action work out of Phase 6 runtime behavior.
- Treated unknown or unauthenticated credential modes as configuration failures before transport, preventing a hidden unauthenticated request path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Blocked silent unauthenticated credential modes**
- **Found during:** Task 2 (Wire SapCap execute to Query/Read helpers)
- **Issue:** `applyAuthentication()` returned without adding credentials for unsupported `authType` values, which could silently send unauthenticated CAP requests if stale or malformed credential data reached runtime.
- **Fix:** Added a sanitized configuration error for any credential mode outside `basicAuth` and `oauth2`.
- **Files modified:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts`
- **Verification:** `npx vitest run test/integration/n8n-node-read-operations.test.js` includes the unauthenticated-mode gate; full `npm test` passed.
- **Committed in:** `c6d6ec9`

---

**Total deviations:** 1 auto-fixed (1 Rule 2 missing critical)
**Impact on plan:** The fix closes a security/correctness gap directly within Phase 6 read-only credential handling. No scope expansion.

## Issues Encountered

- The initial RED check was accidentally launched in parallel with the build, so Vitest raced the `dist` files. The commands were rerun sequentially and produced a valid RED failure on shallow OData cleanup before implementation.
- `n8n-node build` continues to emit an upstream Node deprecation warning about child-process shell argument handling, but the build succeeds and this warning predates the plan changes.

## Verification

- `npm run build --workspace n8n-nodes-sap-cap` - PASS.
- `npx vitest run test/integration/n8n-node-read-operations.test.js` - RED before runtime wiring, then PASS with 11 tests.
- `npx vitest run test/integration/n8n-node-metadata-discovery.test.js test/integration/n8n-node-response-cleanup.test.js test/integration/n8n-node-read-operations.test.js` - PASS, 23 tests.
- `npx vitest run test/smoke/package-boundaries.test.js` - PASS, 3 tests.
- `npm test` - PASS, 19 integration/smoke files and 126 tests.

## Known Stubs

None. Stub scan hits are n8n `placeholder` metadata and test/mockup placeholder examples, not unwired runtime data or UI stubs.

## Authentication Gates

None.

## Threat Flags

None. The touched code uses the plan-covered trust boundaries: n8n parameters to outbound CAP GET requests, CAP response cleanup to n8n items, and CAP/OData failure sanitization to thrown errors or continueOnFail items.

## TDD Gate Compliance

PASS. The Query/Read runtime feature has RED coverage in `2d63998`, GREEN implementation in `c6d6ec9`, and aggregate regression coverage in `7232e60`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 6 is complete. Phase 7 can build Create, Update, Delete, and CAP action/function behavior on the existing request builders, response cleanup contract, and sanitized error-output helpers without exposing those operations prematurely.

## Self-Check: PASSED

- Created file exists: `test/integration/n8n-node-read-operations.test.js`.
- Modified files exist: `cap-n8n-node/nodes/SapCap/SapCap.node.ts` and `cap-n8n-node/nodes/SapCap/GenericFunctions.ts`.
- Task commits exist: `2d63998`, `c6d6ec9`, and `7232e60`.
- Post-commit deletion checks found no deleted tracked files.
- Plan-level verification commands passed.

---
*Phase: 06-n8n-credentials-metadata-discovery-and-read-operations*
*Completed: 2026-06-03*
