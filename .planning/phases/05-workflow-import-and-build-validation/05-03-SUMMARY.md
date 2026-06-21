---
phase: 05-workflow-import-and-build-validation
plan: 03
subsystem: workflow-build-validation
tags: [sap-cap, cds-build, n8n, workflow-validation, integration-tests, commonjs]

requires:
  - phase: 05-workflow-import-and-build-validation
    provides: deterministic app-root n8n artifacts, manifest accepted references, scalar sidecar schemas, and generated CDS contracts
provides:
  - shared workflow annotation validator for generated typed workflow schemas
  - sanitized deterministic workflow validation diagnostics
  - CAP build plugin registration for workflow mapping validation
  - integration coverage for strict errors and warning-only adoption cases
affects: [05-workflow-import-and-build-validation, 08-deployment-docs-release-readiness]

tech-stack:
  added: []
  patterns:
    - Workflow validation consumes CAP CSN plus Phase 4 annotation parser output, not CDS text
    - Generated manifests are matched through acceptedReferences before typed schema comparison
    - CAP build validation pushes warnings/errors as build messages and throws BuildError only for error diagnostics

key-files:
  created:
    - cap-n8n-plugin/lib/workflows/diagnostics.js
    - cap-n8n-plugin/lib/workflows/validate.js
    - cap-n8n-plugin/lib/workflows/BuildValidationPlugin.js
    - test/integration/n8n-workflow-build-validation.test.js
  modified:
    - cap-n8n-plugin/cds-plugin.js
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/TESTING.md

key-decisions:
  - "Workflow annotation validation matches artifacts by manifest acceptedReferences so cap-test-trigger, webhook/cap-test-trigger, and webhook-test/cap-test-trigger resolve consistently."
  - "CAP build validation is registered only when cds.build.register is available, preserving normal runtime bootstrap and explicit n8n implementation overrides."
  - "Validation diagnostics use allowlisted sanitized context fields and never include raw workflow JSON, request bodies, auth headers, API keys, stack traces, or .env values."

patterns-established:
  - "validateWorkflowAnnotations returns deterministic { errors, warnings, diagnostics } sorted by entity, workflow reference/key, input, and code."
  - "BuildValidationPlugin calls the shared validator from CAP build and turns error diagnostics into BuildError failures."

requirements-completed: [IMPORT-05, IMPORT-06, IMPORT-07]

duration: 10 min
completed: 2026-06-03
---

# Phase 05 Plan 03: Workflow Build Validation Summary

**CAP build validation for generated n8n workflow input contracts with strict typed errors and warning-only incremental adoption**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-03T09:53:27Z
- **Completed:** 2026-06-03T10:03:24Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added RED integration coverage for missing required inputs, scalar type mismatches, extra inputs, unknown workflow references, untyped artifacts, and CAP build output sanitization.
- Implemented `validateWorkflowAnnotations({ appRoot, csn })` with manifest accepted-reference matching, conservative scalar compatibility, warning/error classification, and deterministic sanitized diagnostics.
- Added `BuildValidationPlugin` and guarded `cds-plugin.js` registration so `cds build` fails for typed mapping errors while warning-only cases pass.
- Refreshed the codebase architecture/testing maps with the new workflow build-validation layer.

## Task Commits

1. **Task 1: Add build-validation integration tests** - `57f117e` (test, RED)
2. **Task 2: Implement shared workflow annotation validator and diagnostics** - `a0443ab` (feat, GREEN)
3. **Task 3: Register workflow validation with CAP build** - `add220e` (feat, GREEN)

## Files Created/Modified

- `cap-n8n-plugin/lib/workflows/diagnostics.js` - Creates sanitized validation diagnostics and summarizes deterministic error/warning lists.
- `cap-n8n-plugin/lib/workflows/validate.js` - Reads generated workflow artifacts, scans CSN annotations through `readWorkflowAnnotations`, and validates mapped inputs.
- `cap-n8n-plugin/lib/workflows/BuildValidationPlugin.js` - CAP build plugin that pushes workflow validation messages and throws `BuildError` for typed errors.
- `cap-n8n-plugin/cds-plugin.js` - Registers the build plugin only when the CAP build API is available.
- `test/integration/n8n-workflow-build-validation.test.js` - Temp-app integration coverage for shared validator and CAP build behavior.
- `.planning/codebase/ARCHITECTURE.md` - Adds workflow build validation to the package architecture map.
- `.planning/codebase/TESTING.md` - Adds the workflow build validation integration-test pattern.

## Verification

- `npm run test:integration -- --run test/integration/n8n-workflow-build-validation.test.js` - PASS, 15 files and 95 tests.
- `node -e "const {validateWorkflowAnnotations}=require('./cap-n8n-plugin/lib/workflows/validate'); if (typeof validateWorkflowAnnotations !== 'function') process.exit(1)"` - PASS.
- `node -e "const cds=require('@sap/cds'); const before=cds.env.requires?.n8n?.impl; require('./cap-n8n-plugin/cds-plugin.js'); const after=cds.env.requires?.n8n?.impl; if (before && after !== before) process.exit(1)"` - PASS.
- Explicit temp `npx cds build --project <tmp-app>` probe - PASS: typed missing-input fixture failed with `ERR_N8N_WORKFLOW_REQUIRED_INPUT`; warning-only extra-input fixture passed with `WARN_N8N_WORKFLOW_EXTRA_INPUT`.
- `rg -n "console\\." cap-n8n-plugin/lib/workflows/BuildValidationPlugin.js cap-n8n-plugin/lib/workflows/validate.js cap-n8n-plugin/lib/workflows/diagnostics.js` - PASS, no console logging in build-validation modules.

## Requirement Coverage

| Requirement | Evidence |
|-------------|----------|
| IMPORT-05 | `BuildValidationPlugin` is registered from `cds-plugin.js` and invoked by temp-app CAP build tests. |
| IMPORT-06 | Missing required typed inputs and type mismatches produce error diagnostics and fail CAP build. |
| IMPORT-07 | Extra inputs, unknown workflow references, and untyped workflow artifacts produce warnings and pass CAP build when no errors exist. |

## Decisions Made

- Used generated artifact manifest `acceptedReferences` as the matching source so local workflow keys, webhook paths, and webhook-test paths resolve to the same artifact.
- Kept build plugin registration guarded by `cds.build.register`; normal runtime plugin loading still only registers the model, served annotation handlers, and bootstrap implementation fallback.
- Kept diagnostic output to an allowlisted context shape: code, severity, entity, annotation, workflow reference/key, input, mapped field, expected type, actual CAP type, and reason.

## TDD Gate Compliance

- RED gate commit exists: `57f117e`.
- GREEN shared-validator implementation commit exists after RED: `a0443ab`.
- GREEN CAP build integration commit exists after validator implementation: `add220e`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed untyped artifact test fixture setup**
- **Found during:** Task 3 (Register workflow validation with CAP build)
- **Issue:** The RED test passed `schema: undefined` to the fixture helper, but the helper's default parameter replaced it with the typed schema, causing the untyped-artifact test to see a missing required input error.
- **Fix:** Passed `schema: null` so `writeWorkflowArtifacts` intentionally writes an untyped artifact without a schema file.
- **Files modified:** `test/integration/n8n-workflow-build-validation.test.js`
- **Verification:** `npm run test:integration -- --run test/integration/n8n-workflow-build-validation.test.js` passed.
- **Committed in:** `add220e`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix corrected the test fixture without changing the planned validation behavior.

## Issues Encountered

- The repo's `test:integration` script runs the whole `test/integration` folder even when passed `--run test/integration/n8n-workflow-build-validation.test.js`; final verification passed all 15 integration files.
- The shared test file exercised Task 3's build plugin, so Task 2's full npm verification remained blocked until Task 3 added `BuildValidationPlugin.js`; Task 2 export and direct demo validation checks passed before its commit.

## Known Stubs

None. Stub scan found no TODO/FIXME/placeholder text. Empty-array/object/default-parameter matches were normal accumulators and helper defaults, not UI/data-source stubs.

## Threat Flags

None. The generated artifact, CAP CSN, and validator-to-build trust boundaries were covered by the plan threat register and verified with sanitized diagnostic assertions plus BuildError failure behavior.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required for automated verification.

## Next Phase Readiness

Ready for Plan 05-04. The shared validator and CAP build plugin now enforce typed workflow mapping errors and expose the same diagnostic model that direct CLI validation can reuse.

## Self-Check: PASSED

- Found key files: diagnostics module, shared validator, CAP build plugin, build-validation integration test, and this summary.
- Found task commits: `57f117e`, `a0443ab`, and `add220e`.
- Plan-level verification commands passed after all task commits.

---
*Phase: 05-workflow-import-and-build-validation*
*Completed: 2026-06-03*
