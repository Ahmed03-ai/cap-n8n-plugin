---
phase: 07-n8n-mutations-and-cap-actions-functions
plan: 01
subsystem: n8n-node
tags: [n8n, sap-cap, odata, metadata, composite-keys, vitest]

requires:
  - phase: 06-n8n-credentials-metadata-discovery-and-read-operations
    provides: SAP CAP credentials, metadata entity-set discovery, Query/Read request helpers, and built-node integration test patterns
provides:
  - Metadata-derived EntitySet descriptors with key names and EDM types
  - Type-aware OData key predicate helpers for composite keys
  - Hybrid Read request construction using manual predicates or metadata key parts
  - Built-helper integration coverage for metadata keys, key literals, validation, and sanitization
affects: [07-02-crud-runtime, 07-03-actions-functions, NODE-13, VERIFY-04]

tech-stack:
  added: []
  patterns:
    - Dependency-free targeted CSDL extraction for EntityType Key and Property Type metadata
    - Metadata key descriptors use name/type pairs that downstream CRUD and bound operation builders can consume
    - Key predicates are built from descriptor order, with manual Key Predicate fallback preserved

key-files:
  created: []
  modified:
    - cap-n8n-node/nodes/SapCap/ODataMetadata.ts
    - cap-n8n-node/nodes/SapCap/GenericFunctions.ts
    - test/integration/n8n-node-metadata-discovery.test.js

key-decisions:
  - "Metadata key descriptors use a compact `{ name, type }` contract per EntitySet so later CRUD and bound Action/Function plans can consume the same helper output."
  - "Unknown EDM key types use the conservative quoted literal path, while numeric and boolean EDM types are emitted unquoted."
  - "Manual Key Predicate input remains the fallback path whenever metadata key descriptors are not provided."

patterns-established:
  - "Built integration tests import compiled modules from `cap-n8n-node/dist` after workspace build."
  - "Metadata-derived composite-key helpers reject missing parts, duplicate names, and URL boundary characters before request construction."
  - "Validation and metadata errors expose allowlisted messages/categories only, without raw metadata, key values, credentials, or response bodies."

requirements-completed: [NODE-13, VERIFY-04]

duration: 8min
completed: 2026-06-03
---

# Phase 07 Plan 01: Metadata-Derived Composite-Key Helper Contracts Summary

**Dependency-free OData metadata key extraction plus type-aware composite-key predicate builders for downstream CRUD and CAP Action/Function requests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-03T17:42:34Z
- **Completed:** 2026-06-03T17:49:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended `ODataMetadata.ts` to extract EntitySet descriptors with key property names and EDM types from namespace-prefixed and default-namespace metadata.
- Added `GenericFunctions.ts` key helpers for OData literal formatting, metadata-derived composite-key predicates, hybrid key resolution, and Read request construction.
- Expanded built-helper integration coverage to prove descriptor extraction, manual fallback, composite keys, type-aware literal formatting, missing/duplicate key validation, and sanitized errors.

## Task Commits

Each task was committed atomically with RED and GREEN gates:

1. **Task 1: Extract metadata key descriptors for entity sets**
   - `cd1d14e` test: add failing metadata key descriptor coverage
   - `918fb52` feat: extract metadata key descriptors
2. **Task 2: Build type-aware key predicates with manual fallback intact**
   - `6539de8` test: add failing metadata key predicate coverage
   - `bdc7761` feat: add type-aware key predicate helpers

**Plan metadata:** committed after this summary.

## Files Created/Modified

- `cap-n8n-node/nodes/SapCap/ODataMetadata.ts` - Adds EntitySet descriptor and key descriptor extraction while preserving existing EntitySet option loading.
- `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` - Adds type-aware key literal formatting, metadata-derived key predicate construction, hybrid key resolution, and Read request support for metadata key parts.
- `test/integration/n8n-node-metadata-discovery.test.js` - Adds built-dist integration coverage for metadata key descriptors, composite-key predicate behavior, manual fallback, and sanitized failures.

## Decisions Made

- Metadata descriptors stay narrow: EntitySet name, optional EntityType, and ordered key `{ name, type }` entries only.
- Type-aware key formatting treats numeric and boolean EDM types as unquoted and all unknown/custom types as quoted strings.
- `buildReadRequest` accepts metadata key descriptors only as an additive path; existing `keyPredicate` callers continue through `normalizeKeyPredicate`.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope changes.

## Issues Encountered

- A parallel final verification attempt started Vitest before the package build finished, so the first Vitest run could not find `dist` files. The commands were rerun sequentially and passed.
- `n8n-node build` continues to emit the known Node `DEP0190` warning from the n8n node CLI, but the build succeeds.

## Verification

- `npm run build --workspace n8n-nodes-sap-cap` - PASS.
- `npx vitest run test/integration/n8n-node-metadata-discovery.test.js` - PASS, 11 tests.
- `npm run build --workspace n8n-nodes-sap-cap && npx vitest run test/integration/n8n-node-metadata-discovery.test.js` equivalent sequential PowerShell run - PASS.

## Known Stubs

None. Stub scan found no TODO/FIXME/placeholder text or hardcoded empty UI data in the files modified by this plan.

## Authentication Gates

None.

## Threat Flags

None. The touched trust boundaries were already covered by the plan threat model: remote metadata to descriptors, user-supplied key values to URL path segments, and helper errors to n8n-visible output.

## TDD Gate Compliance

PASS. Both `tdd="true"` tasks have RED `test(07-01)` commits followed by GREEN `feat(07-01)` commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 07-02. CRUD runtime work can consume `extractEntityKeyDescriptors`, `buildKeyPredicateFromParts`, `formatODataKeyLiteral`, and `resolveKeyPredicate` while preserving manual Key Predicate fallback.

## Self-Check: PASSED

- Modified files exist: `ODataMetadata.ts`, `GenericFunctions.ts`, and `n8n-node-metadata-discovery.test.js`.
- Task commits exist: `cd1d14e`, `918fb52`, `6539de8`, and `bdc7761`.
- Post-commit deletion checks found no deleted tracked files.
- Plan-level verification commands passed.

---
*Phase: 07-n8n-mutations-and-cap-actions-functions*
*Completed: 2026-06-03*
