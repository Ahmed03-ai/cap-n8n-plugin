---
phase: 05-workflow-import-and-build-validation
plan: 04
subsystem: workflow-import-validation
tags: [sap-cap, n8n, workflow-validation, cli, integration-tests, documentation, commonjs]

requires:
  - phase: 05-workflow-import-and-build-validation
    provides: deterministic app-root workflow artifacts, package import CLI, shared validator, and CAP build validation plugin
provides:
  - direct `cap-n8n validate` CLI command backed by the shared workflow annotation validator
  - npm wrapper for repo-local workflow validation
  - public package export for `validateWorkflowAnnotations`
  - aggregate Phase 5 integration suite and source/artifact sanitization gates
  - README and manual showcase documentation for Phase 5 import, validate, and artifact workflows
affects: [05-workflow-import-and-build-validation, 08-deployment-docs-release-readiness]

tech-stack:
  added: []
  patterns:
    - CLI validation loads CAP app model roots `db`, `srv`, `app`, and `n8n` before calling the shared validator
    - Validation diagnostics support deterministic text output and machine-readable JSON output
    - Aggregate Phase 5 tests use temp CAP apps, local workflow fixtures, CAP compile/build, and source/artifact gates without Docker

key-files:
  created:
    - cap-n8n-plugin/lib/workflows/validate-command.js
    - test/integration/n8n-workflow-phase5.test.js
    - .planning/phases/05-workflow-import-and-build-validation/05-04-SUMMARY.md
  modified:
    - cap-n8n-plugin/bin/cap-n8n.js
    - cap-n8n-plugin/index.js
    - package.json
    - README.md
    - docs/manual-visual-showcase.md

key-decisions:
  - "Direct CLI validation loads generated app-local workflow artifacts and CAP CSN model roots, then delegates to `validateWorkflowAnnotations` so CLI and CAP build diagnostics stay aligned."
  - "The repo-local `n8n:workflow:validate` wrapper uses `node cap-n8n-plugin/bin/cap-n8n.js validate`, preserving the Plan 05-02 wrapper decision while package consumers still get the `cap-n8n` bin."
  - "Aggregate source gates look for literal sample secrets, unsafe `.env` ingestion, and logged concrete auth headers while allowing legitimate credential identifiers required by live import code."

patterns-established:
  - "Task-level CLI tests execute `cap-n8n-plugin/bin/cap-n8n.js` through `process.execPath` and assert sanitized output plus exit codes."
  - "Phase-level aggregate tests verify local import, direct validate, generated CDS compile, CAP build validation, warning/error fixtures, npm test wiring, and sanitization gates in one suite."

requirements-completed: [IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, VERIFY-03]

duration: 12 min
completed: 2026-06-03
---

# Phase 05 Plan 04: Workflow Import Validation Summary

**Direct workflow annotation validation CLI with aggregate Phase 5 import/build/source-gate evidence**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-03T10:10:53Z
- **Completed:** 2026-06-03T10:22:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `cap-n8n validate --app <cap-app>` with sanitized text diagnostics, `--json` machine output, and exit code 1 only for error diagnostics.
- Exposed `validateWorkflowAnnotations` from the package entry and wired `npm run n8n:workflow:validate -- --app demo-app`.
- Added aggregate Phase 5 integration coverage for local import, generated CDS compile, direct validation, CAP build validation, warning/error fixtures, npm-test wiring, and secret/source gates.
- Updated README and manual showcase docs with exact import/validate commands, expected output shapes, app-root artifact layout, and reviewer guidance.

## Task Commits

1. **Task 1: Wire cap-n8n validate to the shared validator** - `486c6ec` (test, RED)
2. **Task 1: Wire cap-n8n validate to the shared validator** - `499574e` (feat, GREEN)
3. **Task 2: Add aggregate Phase 5 integration and source gates** - `47a4c2f` (test)
4. **Task 3: Update developer docs and manual visual showcase** - `c34b336` (docs)

## Files Created/Modified

- `cap-n8n-plugin/lib/workflows/validate-command.js` - CLI adapter that resolves `--app`, loads CAP model roots, calls the shared validator, and formats diagnostics.
- `cap-n8n-plugin/bin/cap-n8n.js` - Adds `validate`, `--json`, known-option rejection, and help text for import/validate without literal API-key flags.
- `cap-n8n-plugin/index.js` - Exports `validateWorkflowAnnotations` directly and under `workflowTools`.
- `package.json` - Adds the repo-local `n8n:workflow:validate` wrapper.
- `test/integration/n8n-workflow-phase5.test.js` - Aggregate Phase 5 integration and sanitization evidence.
- `README.md` - Documents Phase 5 import/validate commands, expected outputs, and artifact layout.
- `docs/manual-visual-showcase.md` - Adds reviewer-facing Phase 5 showcase steps and caveats.

## Verification

- `npx vitest run test/integration/n8n-workflow-phase5.test.js` - PASS, 8 tests.
- `node cap-n8n-plugin/bin/cap-n8n.js validate --app demo-app` - PASS.
- `node cap-n8n-plugin/bin/cap-n8n.js validate --app demo-app --json` - PASS and parseable.
- `npm run n8n:workflow:validate -- --app demo-app` - PASS.
- `npm run test:integration -- --run test/integration/n8n-workflow-artifacts.test.js test/integration/n8n-workflow-import.test.js test/integration/n8n-workflow-live-import.test.js test/integration/n8n-workflow-build-validation.test.js test/integration/n8n-workflow-phase5.test.js` - PASS, 16 files and 103 tests.
- `npx cds compile demo-app/db demo-app/srv demo-app/app demo-app/n8n --to csn` - PASS.
- `npm test` - PASS, smoke plus 16 integration files and 103 integration tests.
- Documentation presence scan for `n8n:workflow:validate`, `cap-n8n validate`, `demo-app/n8n`, and manual showcase terms - PASS.
- Secret/sanitization gates over docs, CLI help, CLI JSON output, implementation sources, and `demo-app/n8n` generated artifacts - PASS.

## Requirement Coverage

| Requirement | Evidence |
|-------------|----------|
| IMPORT-01 | Aggregate tests import a local workflow fixture into a temp CAP app through the package CLI. |
| IMPORT-02 | Existing fake-live import tests remain part of the focused Phase 5 integration command. |
| IMPORT-03 | Aggregate tests compile generated `n8n/index.cds` contracts after import. |
| IMPORT-04 | Aggregate and artifact tests verify deterministic sanitized `appRoot/n8n` artifacts. |
| IMPORT-05 | Aggregate tests run CAP build validation against temp app artifacts. |
| IMPORT-06 | Validate CLI and build-validation tests fail typed missing-input fixtures with clear sanitized errors. |
| IMPORT-07 | Validate CLI and build-validation tests pass warning-only extra/untyped/unknown cases. |
| VERIFY-03 | `npm test` and focused Phase 5 integration commands cover import, generated CDS, validate CLI, build validation, and sanitization gates. |

## Decisions Made

- Direct CLI validation uses `cds.load()` over existing `db`, `srv`, `app`, and `n8n` app-root directories so the direct command sees the same generated artifacts and CSN annotation data as CAP build validation.
- Text diagnostics deliberately include stable key/value context fields (`severity`, `code`, `entity`, `annotation`, `workflow`, `key`, `input`, `reason`) before the human-readable message.
- The root validate wrapper follows the working repo-local `node cap-n8n-plugin/bin/cap-n8n.js ...` pattern from Plan 05-02 instead of relying on a workspace package bin being exposed in `node_modules/.bin`.

## TDD Gate Compliance

- RED gate commit exists for Task 1 validate CLI coverage: `486c6ec`.
- GREEN implementation commit exists after the RED commit: `499574e`.
- Task 2 was a test-gate task; the aggregate suite passed immediately because the underlying behavior was already implemented by Task 1 and dependency plans 05-01 through 05-03, so no separate GREEN source commit was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Preserved runnable repo-local npm validate wrapper**
- **Found during:** Task 1 (Wire cap-n8n validate to the shared validator)
- **Issue:** The plan text requested a literal `cap-n8n validate` root script, but Plan 05-02 already established that the private workspace does not reliably expose the package bin for root npm wrappers.
- **Fix:** Added `n8n:workflow:validate` as `node cap-n8n-plugin/bin/cap-n8n.js validate`, preserving package `bin` metadata for consumers while keeping repo-local validation runnable.
- **Files modified:** `package.json`
- **Verification:** `npm run n8n:workflow:validate -- --app demo-app` passed.
- **Committed in:** `499574e`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The public package command shape remains `cap-n8n validate`, and the repo-local npm wrapper now works in the current workspace.

## Issues Encountered

- The first `npm test` run failed once in an existing timeout-sensitive webhook-runtime test where the single aborted request was not recorded before the assertion. The targeted failing case passed on its own, and the full `npm test` rerun passed without code changes.
- Task 2 was test-only despite `tdd="true"`; the added aggregate tests passed because Tasks 1 and dependency plans had already supplied the runtime behavior under test.

## Known Stubs

None. The touched files contain no TODO/FIXME/placeholder text and no unwired UI or mock-data stubs. Empty object/array literals in source and tests are normal accumulators, option defaults, or expected diagnostic arrays.

## Threat Flags

None. The plan threat register covered the new CLI output, app-root artifacts, aggregate test scans, and docs trust boundaries. Final gates verified no literal API-key CLI flag, unsafe `.env` ingestion, concrete auth-header logging, raw workflow payloads, stack traces, private keys, GitHub/OpenAI-style tokens, or personal production metadata in generated artifacts, docs, CLI output, or touched implementation sources.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required for automated verification. Live import still requires a reachable n8n API and environment/config-backed credentials when used manually.

## Next Phase Readiness

Plan 05-04 is complete and Phase 5 has aggregate import/build/validation evidence. Whole-phase completion and outer verifier handling are intentionally left to the orchestrator per the execution prompt.

## Self-Check: PASSED

- Found key files: validate command adapter, aggregate Phase 5 integration test, CLI binary, README, manual showcase guide, and this summary.
- Found task commits: `486c6ec`, `499574e`, `47a4c2f`, and `c34b336`.
- Plan-level verification commands and sanitization gates passed after all task commits.

---
*Phase: 05-workflow-import-and-build-validation*
*Completed: 2026-06-03*
