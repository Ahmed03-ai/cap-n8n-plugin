---
phase: 05-workflow-import-and-build-validation
plan: 01
subsystem: workflow-artifacts
tags: [sap-cap, n8n, generated-cds, workflow-import, sanitizer, integration-tests, commonjs]

requires:
  - phase: 04-declarative-cap-annotations
    provides: AdminService.Books workflow annotations and scalar input mapping contract
provides:
  - sidecar workflow schema normalization for Phase 5 scalar input types
  - deterministic workflow sanitizer with redaction path provenance
  - app-root n8n artifact writer and reader with path containment
  - generated CDS workflow input contract for cap-test-trigger
  - checked-in demo-app n8n artifacts for future import and validation plans
affects: [05-workflow-import-and-build-validation, 08-deployment-docs-release-readiness]

tech-stack:
  added: []
  patterns:
    - Workflow artifacts are generated under the consuming app root at n8n/
    - Sidecar schemas are the typed input source and stay limited to Phase 5 scalar types
    - Sanitized workflow JSON preserves reviewable workflow structure while manifests store redaction path provenance

key-files:
  created:
    - cap-n8n-plugin/lib/workflows/schema.js
    - cap-n8n-plugin/lib/workflows/sanitize.js
    - cap-n8n-plugin/lib/workflows/manifest.js
    - cap-n8n-plugin/lib/workflows/generate-cds.js
    - cap-n8n-plugin/lib/workflows/artifacts.js
    - demo-app/n8n/manifest.json
    - demo-app/n8n/index.cds
    - demo-app/n8n/workflows/cap-test-trigger/workflow.json
    - demo-app/n8n/workflows/cap-test-trigger/schema.json
    - demo-app/n8n/workflows/cap-test-trigger/manifest.json
    - test/integration/n8n-workflow-artifacts.test.js
  modified:
    - cap-n8n-plugin/index.js

key-decisions:
  - "Generated CDS action assertions use CAP CSN action definitions such as cap.n8n.workflows.WorkflowInputContracts.capTestTrigger instead of parsing CDS text."
  - "Workflow helper exports are grouped under cap-n8n-plugin workflowTools to preserve existing package exports."
  - "Sanitizer manifests record removed path names only; removed values are never written to generated artifacts."

patterns-established:
  - "writeWorkflowArtifacts writes workflow.json, schema.json, manifest.json, aggregate manifest.json, and index.cds deterministically under appRoot/n8n."
  - "normalizeWorkflowSchema rejects full JSON Schema constructs and returns warning diagnostics for missing sidecars."

requirements-completed: [IMPORT-03, IMPORT-04]

duration: 9 min
completed: 2026-06-03
---

# Phase 05 Plan 01: Workflow Artifact Contract Summary

**Scalar sidecar schemas, deterministic sanitized workflow artifacts, and compile-tested generated CDS for cap-test-trigger**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-03T09:17:08Z
- **Completed:** 2026-06-03T09:26:18Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added package-owned workflow artifact helpers for sidecar schema normalization, workflow sanitization, manifest aliases, generated CDS, and app-root artifact read/write.
- Added Vitest integration coverage for D-01 through D-10 behavior, including generated CDS compilation, deterministic writes, source-gated sanitization, missing sidecar warnings, unsupported schema rejection, and path traversal rejection.
- Generated checked-in `demo-app/n8n/` artifacts for stable workflow key `cap-test-trigger` with typed `bookId`, `title`, and optional JSON `event` inputs.

## Task Commits

1. **Task 1: Prove the workflow artifact and generated CDS contract** - `dea313f` (test, RED)
2. **Task 2: Implement sidecar schema, sanitizer, manifest, CDS generator, and artifact writer** - `5b5fb74` (feat, GREEN)
3. **Task 3: Commit demo-app cap-test-trigger artifacts from the generator contract** - `d3de896` (feat)

## Files Created/Modified

- `cap-n8n-plugin/lib/workflows/schema.js` - Normalizes Phase 5 scalar sidecar schemas and emits missing-sidecar warnings.
- `cap-n8n-plugin/lib/workflows/sanitize.js` - Produces deterministic sanitized n8n workflow JSON and redaction path provenance.
- `cap-n8n-plugin/lib/workflows/manifest.js` - Resolves safe workflow keys, webhook aliases, source metadata, and workflow manifests.
- `cap-n8n-plugin/lib/workflows/generate-cds.js` - Generates `cap.n8n.workflows` CDS input types and `WorkflowInputContracts` actions.
- `cap-n8n-plugin/lib/workflows/artifacts.js` - Writes and reads deterministic app-root `n8n/` artifacts with path containment.
- `cap-n8n-plugin/index.js` - Exposes workflow helpers under `workflowTools`.
- `test/integration/n8n-workflow-artifacts.test.js` - Integration suite for artifact contract, sanitizer source gates, and CDS compile assertions.
- `demo-app/n8n/**` - Checked-in demo artifact set for `cap-test-trigger`.

## Verification

- `npm run test:integration -- --run test/integration/n8n-workflow-artifacts.test.js` - PASS, 12 files and 80 tests.
- `npx cds compile demo-app/n8n --to csn` - PASS, includes `CapTestTriggerInputs` and `WorkflowInputContracts.capTestTrigger`.
- Structured secret gate over `demo-app/n8n/**/*.json` - PASS, no leaked secret values and no forbidden fields in sanitized `workflow.json`.
- `node -e "const plugin=require('./cap-n8n-plugin'); if (!plugin.workflowTools || typeof plugin.workflowTools.writeWorkflowArtifacts !== 'function') process.exit(1)"` - PASS.

## Requirement Coverage

| Requirement | Evidence |
|-------------|----------|
| IMPORT-03 | `demo-app/n8n/index.cds` compiles and exposes typed workflow inputs plus the contract action. |
| IMPORT-04 | `demo-app/n8n/` contains deterministic sanitized workflow JSON, sidecar schema, manifests, and generated CDS. |

## Decisions Made

- Used the compiled CSN action definition `cap.n8n.workflows.WorkflowInputContracts.capTestTrigger` for generated CDS assertions because CAP represents unbound service actions as separate CSN definitions.
- Grouped public workflow helpers under `workflowTools` instead of adding many top-level package exports, preserving the existing package entry shape.
- Kept manifests value-safe by storing source workflow ID/name, accepted aliases, and removed path names only; removed metadata values are not serialized.

## TDD Gate Compliance

- RED gate commit exists: `dea313f`.
- GREEN implementation commit exists after RED: `5b5fb74`.
- Task 3 generated artifact commit exists after GREEN: `d3de896`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed normalized schema idempotency**
- **Found during:** Task 2 (Implement sidecar schema, sanitizer, manifest, CDS generator, and artifact writer)
- **Issue:** `generateWorkflowCds` re-normalized already-normalized schema entries, but the sidecar validator correctly rejected the normalized-only `name` field as unsupported sidecar input metadata.
- **Fix:** Normalized typed entries by passing only `type` and `required` back through the sidecar validator while keeping the input name as structured metadata.
- **Files modified:** `cap-n8n-plugin/lib/workflows/schema.js`
- **Verification:** `npm run test:integration -- --run test/integration/n8n-workflow-artifacts.test.js` passed.
- **Committed in:** `5b5fb74`

**2. [Rule 1 - Bug] Corrected generated CDS CSN action assertion**
- **Found during:** Task 2 (Implement sidecar schema, sanitizer, manifest, CDS generator, and artifact writer)
- **Issue:** The RED test initially expected unbound actions under `service.actions`, but CAP compiles service actions as separate definitions.
- **Fix:** Updated the test to assert `cap.n8n.workflows.WorkflowInputContracts.capTestTrigger` in the compiled CSN.
- **Files modified:** `test/integration/n8n-workflow-artifacts.test.js`
- **Verification:** `npm run test:integration -- --run test/integration/n8n-workflow-artifacts.test.js` passed.
- **Committed in:** `5b5fb74`

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were required for correctness and kept the plan's generated CDS and strict sidecar behavior intact.

## Issues Encountered

- PowerShell rejected POSIX `||` in two local scan commands; the scans were rerun with PowerShell-compatible handling and found no placeholder/stub markers.

## Known Stubs

None. The touched files contain no TODO/FIXME/placeholder text and no unwired UI or mock-data stubs.

## Threat Flags

None. The new filesystem writer, schema input boundary, sanitizer, and generated demo artifacts are covered by the plan threat register and verified by path containment and secret-gate tests.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 05-02. The package now exposes stable workflow artifact helpers and the demo app has deterministic `cap-test-trigger` artifacts that local/live import and validation plans can consume.

## Self-Check: PASSED

- Found key files: workflow helper modules, package export, integration test, demo-app `n8n/` artifacts, and this summary.
- Found task commits: `dea313f`, `5b5fb74`, and `d3de896`.
- Plan-level verification commands passed after all task commits.

---
*Phase: 05-workflow-import-and-build-validation*
*Completed: 2026-06-03*
