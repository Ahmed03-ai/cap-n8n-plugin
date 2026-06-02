---
phase: 04-declarative-cap-annotations
plan: 02
subsystem: cap-plugin-runtime
tags: [sap-cap, cds-annotations, transaction-safe-dispatch, vitest, commonjs]

requires:
  - phase: 04-declarative-cap-annotations
    provides: annotation parser, condition evaluator, and payload builder contracts from Plan 04-01
  - phase: 03-execution-store-and-transaction-safe-dispatch
    provides: tracked n8n start, execution store, and post-commit outbox dispatch
provides:
  - package-owned served-service annotation registrar for `@n8n.workflow.start`
  - CREATE, UPDATE, and DELETE annotation start handlers using `n8n.start(..., { _req: req })`
  - best-effort annotated dispatch failure handling with persisted failed execution evidence
  - integration coverage for mapped payloads, key-only defaults, conditions, invalid registration, and non-rollback behavior
affects: [04-declarative-cap-annotations, phase-04-declarative-cancellation, phase-08-documentation]

tech-stack:
  added: []
  patterns:
    - CAP `cds.on('served')` registration for package-owned annotation handlers
    - idempotent per-service annotation registration guarded by a symbol
    - annotation starts reuse Phase 3 request-context outbox dispatch with best-effort failure semantics

key-files:
  created:
    - cap-n8n-plugin/lib/annotations/AnnotationRegistrar.js
    - test/integration/n8n-annotations-start.test.js
  modified:
    - cap-n8n-plugin/cds-plugin.js
    - cap-n8n-plugin/lib/N8nWorkflowService.js
    - cap-n8n-plugin/lib/annotations/PayloadBuilder.js
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/TESTING.md

key-decisions:
  - "Annotated starts pass a bestEffort option into the Phase 3 request-context start path so post-commit n8n failures persist failure evidence without rejecting the CAP write."
  - "Annotation registration is idempotent per served CAP service via a symbol guard to avoid duplicate handlers on repeated served lifecycle emissions."
  - "Service-projection UPDATE and DELETE keys are resolved from CAP req.subject where clauses so mapped payloads and business keys work for normal service requests."

patterns-established:
  - "registerN8nAnnotations(srv) scans served service entities and registers after handlers for parsed start events."
  - "Annotation runtime logs only workflow metadata and never logs payloads, headers, API keys, request bodies, or stack traces."
  - "Annotated non-rollback behavior is verified through real CAP service writes, in-memory SQLite, and local HTTP webhook servers."

requirements-completed: [ANNO-01, ANNO-02, ANNO-03, ANNO-05, ANNO-07, VERIFY-02]

duration: 12 min
completed: 2026-06-02
---

# Phase 04 Plan 02: Annotation Start Runtime Summary

**Served CAP entity annotations now queue transaction-safe n8n starts for CREATE, UPDATE, and DELETE**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-02T22:15:43Z
- **Completed:** 2026-06-02T22:27:51Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added `AnnotationRegistrar.js` to scan served CAP service entities and register `after` handlers for `@n8n.workflow.start` CREATE, UPDATE, and DELETE events.
- Wired the registrar into `cds-plugin.js` with the CAP `served` lifecycle while preserving explicit `cds.env.requires.n8n.impl` behavior.
- Routed annotated starts through `n8n.start(workflowId, payload, { businessKey, tag, bestEffort: true, _req: req })` so Phase 3 execution/outbox persistence is reused.
- Extended payload resolution to derive service-projection keys from `req.subject`, enabling UPDATE and DELETE payload metadata and business keys.
- Added integration coverage for mapped payloads, key-only defaults, condition true/false, invalid registration, and failed n8n side effects that do not roll back CAP writes.

## Task Commits

1. **Task 1: Add annotated start integration tests** - `6a027f5` (test, RED)
2. **Task 2: Register annotated start handlers through the CAP plugin lifecycle** - `104674e` (feat, GREEN)

## Files Created/Modified

- `cap-n8n-plugin/lib/annotations/AnnotationRegistrar.js` - Scans served CAP entities, registers annotated start handlers, evaluates conditions, builds payloads, and calls the n8n service.
- `cap-n8n-plugin/cds-plugin.js` - Registers annotation scanning on the CAP `served` lifecycle.
- `cap-n8n-plugin/lib/annotations/PayloadBuilder.js` - Resolves keys and mapped values from CAP request subjects for service-projection UPDATE and DELETE events.
- `cap-n8n-plugin/lib/N8nWorkflowService.js` - Adds narrow best-effort request-context dispatch handling for annotated starts.
- `test/integration/n8n-annotations-start.test.js` - Covers annotated CREATE, UPDATE, DELETE, conditions, invalid registration, and non-rollback failed dispatch.
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/TESTING.md` - Updates the codebase map for the new registrar and integration suite.

## Verification

- `npx vitest run test/integration/n8n-annotations-start.test.js` - RED before implementation: PASS as expected failing suite, 6 tests failed because handlers were not registered and invalid annotations were not rejected.
- `npx vitest run test/integration/n8n-annotations-start.test.js` - PASS, 6 tests.
- `npx vitest run test/integration/n8n-annotation-contract.test.js test/integration/n8n-annotations-start.test.js` - PASS, 20 tests.
- `npm run test:integration -- test/integration/n8n-annotations-start.test.js` - PASS, 9 files and 62 tests.
- Explicit implementation override probe - PASS, `cds-plugin.js` preserved `cds.env.requires.n8n.impl`.

## Decisions Made

- Annotated starts use a `bestEffort` option on the existing Phase 3 request-context start path instead of implementing a separate dispatch lifecycle.
- Registrar idempotency is stored on the CAP service instance with a symbol, keeping repeated `served` emissions from adding duplicate handlers.
- UPDATE and DELETE key resolution is handled in `PayloadBuilder` because service-level CAP requests expose keys through `req.subject`, not always through `data`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Kept annotated post-commit dispatch failures non-blocking**
- **Found during:** Task 2 (Register annotated start handlers through the CAP plugin lifecycle)
- **Issue:** Phase 3 request-context dispatch failures could reject the CAP write from the `succeeded` hook, which violates D-09 and ANNO-07 for best-effort annotated handlers.
- **Fix:** Added a narrow `bestEffort` option used by the annotation registrar. When set, persisted failed execution state is retained and returned to the start result, but the post-commit dispatch error is not rethrown.
- **Files modified:** `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/lib/annotations/AnnotationRegistrar.js`
- **Verification:** `npx vitest run test/integration/n8n-annotations-start.test.js` passed, including failed CREATE/UPDATE/DELETE side effects that leave CAP writes committed.
- **Committed in:** `104674e`

**2. [Rule 1 - Bug] Resolved service-projection keys from CAP request subjects**
- **Found during:** Task 2 (Register annotated start handlers through the CAP plugin lifecycle)
- **Issue:** Real CAP service UPDATE and DELETE requests expose keys through `req.subject` where clauses, so the Plan 04-01 helper could not build key metadata or business keys for those events.
- **Fix:** Extended `PayloadBuilder.resolveKeys()` and subject fallback reads to support CQN refs and SELECT subjects.
- **Files modified:** `cap-n8n-plugin/lib/annotations/PayloadBuilder.js`
- **Verification:** UPDATE and DELETE annotation integration tests passed with correct `event.keys` and no non-key DELETE fields.
- **Committed in:** `104674e`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes were required for the planned runtime behavior. No new feature surface was added beyond best-effort annotated starts and service-projection key handling.

## Issues Encountered

- The RED suite needed a distinct persistence entity (`SourceBooks`) behind the served projection to avoid a circular self-projection in the inline CDS model.
- The test harness loads `cds-plugin.js` before per-test n8n configuration so plugin model registration does not interfere with the explicit test service binding.

## Known Stubs

None. Stub scan hits were normal default parameters, empty test harness arrays/strings, and null checks; no placeholder behavior or unwired data source was introduced.

## Threat Flags

None. The new served-service scanner, CAP event side effects, transaction/outbox reuse, and metadata-only logging are covered by the plan threat model.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 04-03. Declarative cancellation can reuse the served-service registrar pattern and Phase 3 execution query/cancel APIs without duplicating start dispatch or payload parsing.

## Self-Check: PASSED

- Found created files: `cap-n8n-plugin/lib/annotations/AnnotationRegistrar.js`, `test/integration/n8n-annotations-start.test.js`, and this summary.
- Found task commits: `6a027f5` and `104674e`.
- Verification commands from the plan passed after implementation.

---
*Phase: 04-declarative-cap-annotations*
*Completed: 2026-06-02*
