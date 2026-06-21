---
phase: 07-n8n-mutations-and-cap-actions-functions
plan: 03
subsystem: n8n-node
tags: [n8n, sap-cap, odata, actions, functions, metadata, composite-keys, vitest]

requires:
  - phase: 07-01
    provides: Metadata-derived key descriptors and type-aware OData key predicate helpers
  - phase: 07-02
    provides: SAP CAP node CRUD runtime, explicit JSON input parsing, response cleanup, and smoke gates
provides:
  - Combined SAP CAP Action/Function operation mode for the n8n node
  - Metadata-derived action/function descriptors and load-options dropdown values
  - Manual Action/Function fallback controls with explicit JSON Parameters input
  - Action POST body and Function GET query request construction
  - Bound Action/Function invocation through hybrid metadata/manual key handling
  - Action/Function response cleanup, safe primitive/array wrapping, and sanitized errors
affects: [07-04-docs-showcase, NODE-12, NODE-13, VERIFY-04, Phase-08-real-n8n-e2e]

tech-stack:
  added: []
  patterns:
    - Dependency-free targeted CSDL extraction for Action, Function, ActionImport, and FunctionImport metadata
    - One visible `actionFunction` node operation maps internally to action POSTs or function GETs
    - Action/Function descriptor dropdown values serialize allowlisted fields only
    - Functions encode primitive JSON Parameters as query parameters; actions send JSON Parameters as the request body

key-files:
  created: []
  modified:
    - cap-n8n-node/nodes/SapCap/SapCap.node.ts
    - cap-n8n-node/nodes/SapCap/GenericFunctions.ts
    - cap-n8n-node/nodes/SapCap/ODataMetadata.ts
    - cap-n8n-node/nodes/SapCap/ODataResponse.ts
    - test/integration/n8n-node-metadata-discovery.test.js
    - test/integration/n8n-node-read-operations.test.js
    - test/integration/n8n-node-response-cleanup.test.js
    - test/smoke/package-boundaries.test.js

key-decisions:
  - "CAP actions and functions are exposed as one visible `Action/Function` operation value, while action/function kind is resolved from metadata or manual fallback fields."
  - "Metadata option values carry only allowlisted descriptor fields: kind, name, qualifiedName, importName, isBound, bindingType, entitySet, and parameters."
  - "Bound Action/Function requests reuse the same metadata key parts and manual Key Predicate path as Read, Update, and Delete."
  - "Action/Function output is always one n8n item; object returns are cleaned directly and primitive or array returns are wrapped under `value`."

patterns-established:
  - "Action/Function metadata discovery parses schema operations plus container imports without adding XML parser dependencies."
  - "Runtime operation selection is metadata-first with manual operation kind/name/binding fallback."
  - "Action/Function errors use the same allowlisted safe-error and continueOnFail item shape as existing node operations."

requirements-completed: [NODE-12, NODE-13, VERIFY-04]

duration: 12min
completed: 2026-06-03
---

# Phase 07 Plan 03: Combined Action/Function Runtime Summary

**SAP CAP n8n node Action/Function invocation with metadata-backed discovery, explicit JSON Parameters, bound hybrid keys, cleaned output, and sanitized error handling**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-03T18:15:24Z
- **Completed:** 2026-06-03T18:27:04Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added Action/Function metadata parsing for unbound imports and bound schema operations, including parameter descriptors and entity-set matching.
- Exposed one combined `Action/Function` node mode with metadata and manual fallback controls.
- Added `buildActionFunctionRequest` for action POST bodies, function query parameters, and bound operation paths using existing hybrid key handling.
- Extended response cleanup so Action/Function returns become one cleaned n8n item, with non-object values wrapped under `value`.
- Expanded fake CAP integration, response cleanup, smoke, and VERIFY-04 aggregate coverage across credentials, metadata discovery, Query, Read, Create, Update, Delete, response cleanup, Action/Function, and composite keys.

## Task Commits

Each task was committed atomically with RED and GREEN gates:

1. **Task 1: Parse Action/Function metadata descriptors and dropdown options**
   - `329bf2f` test: add failing action function metadata coverage
   - `bf43bbf` feat: parse action function metadata descriptors
2. **Task 2: Build and execute Action/Function requests**
   - `eeb6900` test: add failing action function runtime coverage
   - `4c63cd4` feat: wire action function runtime requests
3. **Task 3: Normalize Action/Function output and run aggregate Phase 7 gates**
   - `e0e4570` test: add failing action function response gates
   - `0a94428` feat: normalize action function responses

**Plan metadata:** committed after this summary.

## Files Created/Modified

- `cap-n8n-node/nodes/SapCap/ODataMetadata.ts` - Adds Action/Function descriptor extraction and `loadActionFunctionOptions`.
- `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` - Adds Action/Function descriptor validation, request building, function query encoding, and action body handling.
- `cap-n8n-node/nodes/SapCap/SapCap.node.ts` - Exposes combined Action/Function UI controls and executes metadata/manual operation requests.
- `cap-n8n-node/nodes/SapCap/ODataResponse.ts` - Adds Action/Function item normalization and operation-specific not-found messaging.
- `test/integration/n8n-node-metadata-discovery.test.js` - Covers operation metadata descriptors, dropdown values, loading, and sanitization.
- `test/integration/n8n-node-read-operations.test.js` - Covers request builders, runtime fake CAP calls, manual fallback, bound keys, local validation, and VERIFY-04 coverage.
- `test/integration/n8n-node-response-cleanup.test.js` - Covers Action/Function output cleanup and sanitized errors.
- `test/smoke/package-boundaries.test.js` - Updates built-node metadata assertions for Query, Read, Create, Update, Delete, and Action/Function.

## Decisions Made

- Kept Action/Function as one user-visible operation value (`actionFunction`) to satisfy D-13 while resolving action vs. function behavior internally.
- Encoded metadata dropdown values as compact JSON descriptors instead of raw metadata XML.
- Required one explicit `Parameters (JSON)` object for both actions and functions; functions reject nested object/array parameter values because Phase 7 supports primitive query parameters only.
- Preserved the manual Key Predicate fallback and metadata key parts path for bound operations.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope changes.

## Issues Encountered

- `n8n-node build` continues to emit the existing Node `DEP0190` warning from the n8n node CLI. The build succeeds.
- No unresolved issues.

## Verification

- `npm run build --workspace n8n-nodes-sap-cap` - PASS.
- `npx vitest run test/integration/n8n-node-metadata-discovery.test.js test/integration/n8n-node-response-cleanup.test.js test/integration/n8n-node-read-operations.test.js test/smoke/package-boundaries.test.js` - PASS, 52 tests.
- `npm test` - PASS, smoke suite plus 19 integration files / 152 integration tests.
- Source key-link check for `getActionFunctions|loadAction` and `buildActionFunctionRequest` - PASS.

## Known Stubs

None. Stub scan hits in changed files are n8n editor placeholders, initialized arrays/objects, null checks, and test fixtures; no unwired runtime data source or placeholder behavior was added.

## Authentication Gates

None.

## Threat Flags

None. The touched trust boundaries were already covered by the plan threat model: remote CAP metadata to dropdown descriptors, user JSON Parameters to operation requests, bound keys to URLs, and CAP operation output/errors to n8n-visible items.

## TDD Gate Compliance

PASS. Each `tdd="true"` task has a RED `test(07-03)` commit followed by a GREEN `feat(07-03)` commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 07-04. Documentation, manual visual showcase, and the mockup can now describe the implemented Query, Read, Create, Update, Delete, and Action/Function node surface while keeping real installed n8n custom-node E2E verification in Phase 8.

## Self-Check: PASSED

- Modified files exist: `SapCap.node.ts`, `GenericFunctions.ts`, `ODataMetadata.ts`, `ODataResponse.ts`, and the four scoped test files.
- Task commits exist: `329bf2f`, `bf43bbf`, `eeb6900`, `4c63cd4`, `e0e4570`, and `0a94428`.
- Post-commit deletion checks found no deleted tracked files.
- Required verification commands passed.
- Source key-link patterns are present.

---
*Phase: 07-n8n-mutations-and-cap-actions-functions*
*Completed: 2026-06-03*
