---
phase: 07-n8n-mutations-and-cap-actions-functions
plan: 02
subsystem: n8n-node
tags: [n8n, sap-cap, odata, crud, mutations, composite-keys, vitest]

requires:
  - phase: 07-01
    provides: Metadata-derived key descriptors and type-aware OData key predicate helpers
  - phase: 06-n8n-credentials-metadata-discovery-and-read-operations
    provides: SAP CAP credentials, Query/Read runtime, response cleanup, and sanitized n8n error helpers
provides:
  - SAP CAP n8n node Create, Update, and Delete operation metadata
  - Strict explicit JSON Body parsing for Create and Update
  - CRUD request builders for POST, PATCH, and DELETE with hybrid key handling
  - Mutation response cleanup and Delete confirmation/not-found semantics
  - Fake CAP integration and smoke coverage for Phase 7 CRUD behavior
affects: [07-03-actions-functions, 07-04-docs-showcase, NODE-07, NODE-08, NODE-09, NODE-13, VERIFY-04]

tech-stack:
  added: []
  patterns:
    - Explicit JSON object fields for mutation Body input
    - CRUD request construction remains centralized in GenericFunctions.ts
    - Runtime keyed operations support metadata-derived key parts plus manual key predicate fallback

key-files:
  created: []
  modified:
    - cap-n8n-node/nodes/SapCap/SapCap.node.ts
    - cap-n8n-node/nodes/SapCap/GenericFunctions.ts
    - cap-n8n-node/nodes/SapCap/ODataResponse.ts
    - test/integration/n8n-node-read-operations.test.js
    - test/integration/n8n-node-response-cleanup.test.js
    - test/smoke/package-boundaries.test.js

key-decisions:
  - "Create and Update use one visible Body (JSON) parameter, parsed locally as a non-array JSON object before any CAP request."
  - "Delete requests use the keyed entity URL with no request body and return a local confirmation item after CAP accepts the DELETE."
  - "Keyed CRUD operations expose a Key Input selector with metadata-derived Key Parts JSON and Manual Key Predicate fallback."
  - "Create and Update require a returned entity representation for output; empty metadata-only mutation responses are response-shape errors."

patterns-established:
  - "TDD-style RED/GREEN commits for CRUD helper, node metadata/runtime, and response cleanup behavior."
  - "Fake CAP integration tests assert outbound method, URL, headers, bodies, sanitized failures, and paired item metadata."
  - "Smoke tests assert built n8n node metadata from dist rather than source-only expectations."

requirements-completed: [NODE-07, NODE-08, NODE-09, NODE-13, VERIFY-04]

duration: 12min
completed: 2026-06-03
---

# Phase 07 Plan 02: CRUD Mutations Runtime Summary

**SAP CAP n8n node Create, Update, and Delete support with explicit JSON Body input, hybrid keys, cleaned mutation output, and sanitized error gates**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-03T17:56:20Z
- **Completed:** 2026-06-03T18:08:01Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added Create, Update, and Delete as visible SAP CAP node operations while keeping Action/Function and trigger work deferred.
- Added strict Body JSON parsing plus POST/PATCH/DELETE request builders with `Prefer: return=representation` for Create/Update and no body for Delete.
- Wired CRUD execution through the shared request builders, runtime metadata key descriptors, manual key fallback, response cleanup, continueOnFail, and NodeOperationError helpers.
- Expanded integration and smoke coverage for fake CAP CRUD behavior, composite-key paths, Delete confirmation, Delete 404, and source gates against unsafe/raw controls.

## Task Commits

Each task was committed atomically with RED and GREEN gates:

1. **Task 1: Add strict JSON Body parsing and CRUD request builders**
   - `0d13e1c` test: add failing CRUD request builder coverage
   - `428996c` feat: add CRUD request builders
2. **Task 2: Wire Create, Update, and Delete into SapCap node metadata and execute**
   - `b3854f5` test: add failing node CRUD metadata coverage
   - `f36f6b3` feat: wire CRUD operations into SAP CAP node
3. **Task 3: Extend mutation response cleanup, not-found behavior, and aggregate CRUD gates**
   - `2f47fbc` test: add failing CRUD response cleanup coverage
   - `289a8a1` feat: enforce CRUD response semantics

**Plan metadata:** committed after this summary.

## Files Created/Modified

- `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` - Adds strict `parseJsonObjectParameter`, `buildCreateRequest`, `buildUpdateRequest`, `buildDeleteRequest`, and request-header passthrough.
- `cap-n8n-node/nodes/SapCap/SapCap.node.ts` - Exposes CRUD operation metadata and executes Query/Read/Create/Update/Delete through shared helpers.
- `cap-n8n-node/nodes/SapCap/ODataResponse.ts` - Extends cleanup and error handling for Create, Update, and Delete.
- `test/integration/n8n-node-read-operations.test.js` - Adds fake CAP CRUD runtime coverage, hybrid key coverage, and aggregate source gates.
- `test/integration/n8n-node-response-cleanup.test.js` - Adds mutation cleanup, Delete confirmation, Delete 404, and safe continueOnFail assertions.
- `test/smoke/package-boundaries.test.js` - Updates built-node metadata expectations for Phase 7 CRUD controls.

## Decisions Made

- Kept Create/Update body UX as one explicit `Body (JSON)` field and did not add generated entity property editors.
- Used runtime metadata loading only when `Key Input` is set to metadata key parts; manual `Key Predicate` remains the default fallback.
- Implemented Delete output as a local confirmation item because successful OData DELETE commonly returns no body.
- Required Create/Update to output a cleaned returned CAP entity rather than accepting metadata-only or confirmation-only responses.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Harness Bug] Fixed malformed Body secret-leak test setup**
- **Found during:** Task 1 GREEN
- **Issue:** The initial secret-leak Body case was valid JSON, so it did not exercise local validation.
- **Fix:** Changed the fixture to malformed JSON containing fake secrets so the sanitized validation path is tested.
- **Files modified:** `test/integration/n8n-node-read-operations.test.js`
- **Verification:** `npx vitest run test/integration/n8n-node-read-operations.test.js`
- **Committed in:** `428996c`

**2. [Rule 1 - Test Harness Bug] Narrowed Delete builder source extraction**
- **Found during:** Task 3 RED verification
- **Issue:** The source-gate helper overmatched functions after `buildDeleteRequest`, falsely detecting later body-handling code.
- **Fix:** Stopped extraction at the next exported or local function declaration.
- **Files modified:** `test/integration/n8n-node-read-operations.test.js`
- **Verification:** `npx vitest run test/integration/n8n-node-response-cleanup.test.js test/integration/n8n-node-read-operations.test.js test/smoke/package-boundaries.test.js`
- **Committed in:** `2f47fbc`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 test-harness bugs).
**Impact on plan:** No product-scope changes. Both fixes kept the planned acceptance gates accurate.

## Issues Encountered

- `n8n-node build` continues to emit the existing Node `DEP0190` warning from the n8n node CLI. The build succeeds.
- No unresolved issues.

## Verification

- `npm run build --workspace n8n-nodes-sap-cap` - PASS.
- `npx vitest run test/integration/n8n-node-response-cleanup.test.js test/integration/n8n-node-read-operations.test.js` - PASS, 30 tests.
- `npx vitest run test/smoke/package-boundaries.test.js` - PASS, 3 tests.
- `npm test` - PASS, smoke suite plus 19 integration files / 144 integration tests.

## Known Stubs

None. Stub scan hits in changed files are n8n editor placeholder metadata, normal initialized arrays/objects, and null checks; no unwired UI data source or placeholder runtime behavior was added.

## Authentication Gates

None.

## TDD Gate Compliance

PASS. Each `tdd="true"` task has a RED `test(07-02)` commit followed by a GREEN `feat(07-02)` commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 07-03. Action/Function mode can build on the same explicit JSON parameter, hybrid key, response cleanup, and sanitized error patterns without changing CRUD behavior.

## Self-Check: PASSED

- Modified files exist: `SapCap.node.ts`, `GenericFunctions.ts`, `ODataResponse.ts`, `n8n-node-read-operations.test.js`, `n8n-node-response-cleanup.test.js`, and `package-boundaries.test.js`.
- Task commits exist: `0d13e1c`, `428996c`, `b3854f5`, `f36f6b3`, `2f47fbc`, and `289a8a1`.
- Post-commit deletion checks found no deleted tracked files.
- Plan-level verification commands passed.

---
*Phase: 07-n8n-mutations-and-cap-actions-functions*
*Completed: 2026-06-03*
