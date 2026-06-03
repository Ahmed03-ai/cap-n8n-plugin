---
phase: 05-workflow-import-and-build-validation
plan: 02
subsystem: workflow-import-cli
tags: [sap-cap, n8n, workflow-import, cli, live-import, integration-tests, commonjs]

requires:
  - phase: 05-workflow-import-and-build-validation
    provides: deterministic app-root n8n artifact writer, sanitizer, manifests, generated CDS, and cap-test-trigger demo artifacts
provides:
  - package CLI entry point for `cap-n8n import`
  - local workflow export import with explicit single/all selection rules
  - live n8n public API import with env/config-backed API key handling
  - deterministic import path that writes through the Plan 05-01 artifact helpers
  - integration coverage for local and fake-live workflow imports
affects: [05-workflow-import-and-build-validation, 08-deployment-docs-release-readiness]

tech-stack:
  added: []
  patterns:
    - CLI tests execute `cap-n8n-plugin/bin/cap-n8n.js` through `process.execPath`
    - Live import uses Node built-in `fetch`, `AbortController`, and fake HTTP server integration tests
    - CAP app package config supports exact `{env.NAME}` placeholders without reading `.env` files

key-files:
  created:
    - cap-n8n-plugin/bin/cap-n8n.js
    - cap-n8n-plugin/lib/workflows/import.js
    - cap-n8n-plugin/lib/workflows/live-client.js
    - cap-n8n-plugin/lib/workflows/selection.js
    - test/integration/n8n-workflow-import.test.js
    - test/integration/n8n-workflow-live-import.test.js
  modified:
    - cap-n8n-plugin/package.json
    - package.json
    - package-lock.json
    - .planning/codebase/STACK.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "Root npm wrappers call `node cap-n8n-plugin/bin/cap-n8n.js` while package consumers still receive the `cap-n8n` bin metadata."
  - "Live import resolves API keys from CAP app config placeholders such as `{env.N8N_API_KEY}` and never supports a literal API-key CLI flag."
  - "Successful live workflow payloads remain intact until the shared artifact sanitizer writes committed workflow artifacts."

patterns-established:
  - "selectWorkflows centralizes one-workflow, selector, and explicit --all rules for local and live imports."
  - "fetchWorkflow and fetchWorkflows normalize n8n public API URLs and always request `excludePinnedData=true`."

requirements-completed: [IMPORT-01, IMPORT-02, IMPORT-04]

duration: 14 min
completed: 2026-06-03
---

# Phase 05 Plan 02: Workflow Import CLI Summary

**Offline and fake-live `cap-n8n import` CLI with deterministic app-local workflow artifacts and secret-safe diagnostics**

## Performance

- **Duration:** 14 min
- **Started:** 2026-06-03T09:32:54Z
- **Completed:** 2026-06-03T09:46:35Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added the `cap-n8n import` package CLI and root npm wrappers for importing n8n workflow artifacts into a CAP app.
- Implemented local export selection rules: auto-select one-workflow exports, reject ambiguous multi-workflow imports, support `--workflow`, `--key`, and explicit `--all`.
- Added a live n8n API client that fetches selected workflows or explicit all-workflow lists using CAP config/env credentials, timeout control, and sanitized errors.
- Added integration tests for local and fake-live imports without requiring Docker or a real n8n instance.

## Task Commits

1. **Task 1: Add local import CLI integration coverage** - `fd02a96` (test, RED)
2. **Task 2: Implement cap-n8n local import and npm wrappers** - `705a0bf` (feat, GREEN)
3. **Task 3: Add live n8n import client and coverage** - `c05cfdd` (test, RED)
4. **Task 3: Add live n8n import client and coverage** - `279d950` (feat, GREEN)
5. **Auto-fix: Make root workflow import wrappers runnable** - `84d01c2` (fix)

## Files Created/Modified

- `cap-n8n-plugin/bin/cap-n8n.js` - CommonJS CLI dispatcher for `cap-n8n import`, help output, argument parsing, and sanitized process output.
- `cap-n8n-plugin/lib/workflows/import.js` - Local/live import orchestration, CAP app config placeholder resolution, schema loading, and artifact-helper delegation.
- `cap-n8n-plugin/lib/workflows/live-client.js` - n8n public API workflow fetch client with API base normalization, optional `X-N8N-API-KEY`, timeout, and sanitized HTTP errors.
- `cap-n8n-plugin/lib/workflows/selection.js` - Workflow selector and explicit `--all` rules using Plan 05-01 manifest/key helpers.
- `cap-n8n-plugin/package.json` - Adds package `bin` metadata and includes `bin/` in published files.
- `package.json` - Adds working root wrappers for `cap-n8n` and `n8n:workflow:import` while preserving Docker n8n scripts.
- `package-lock.json` - Records the package bin metadata after npm reified existing workspace metadata.
- `test/integration/n8n-workflow-import.test.js` - Child-process local import coverage for D-11, D-12, D-13, D-08, deterministic writes, and secret-safe output.
- `test/integration/n8n-workflow-live-import.test.js` - Fake-server live import coverage for D-14 and D-15, auth header behavior, routing overrides, list import, and redaction.
- `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/ARCHITECTURE.md` - Refresh codebase map entries for the new package CLI, live import client, and root wrapper scripts.

## Verification

- `npm run test:integration -- --run test/integration/n8n-workflow-import.test.js` - PASS, 14 files and 89 tests.
- `npm run test:integration -- --run test/integration/n8n-workflow-live-import.test.js` - PASS, 14 files and 89 tests.
- `node cap-n8n-plugin/bin/cap-n8n.js import --app demo-app --from test-workflows/workflows.json --workflow cap-test-trigger --schema demo-app/n8n/workflows/cap-test-trigger/schema.json` - PASS.
- `npm run cap-n8n -- --help` - PASS; root wrapper works and help contains no literal `--api-key` option.
- `npm run n8n:workflow:import -- --app demo-app --from test-workflows/workflows.json --workflow cap-test-trigger --schema demo-app/n8n/workflows/cap-test-trigger/schema.json` - PASS.

## Requirement Coverage

| Requirement | Evidence |
|-------------|----------|
| IMPORT-01 | Local fixture and synthetic workflow exports import through `cap-n8n import` without Docker or live n8n. |
| IMPORT-02 | Fake n8n API tests fetch selected and explicit-all live workflows using resolved CAP config/env credentials. |
| IMPORT-04 | Local and live imports route through `writeWorkflowArtifacts`, preserving sanitized deterministic `appRoot/n8n/` layout. |

## Decisions Made

- Root npm wrapper scripts use the checked-in CLI path instead of relying on `node_modules/.bin/cap-n8n`, because the root private workspace does not expose the workspace package bin unless it also depends on that workspace.
- Live imports read exact CAP config environment placeholders such as `{env.N8N_API_KEY}` from `process.env` only; no `.env` file is read and no secret CLI option is supported.
- Live workflow responses are passed to the artifact writer as workflow source data, not through generic error-detail sanitization, so workflow structure is preserved until the dedicated artifact sanitizer writes safe output.

## TDD Gate Compliance

- RED gate commit exists for local import coverage: `fd02a96`.
- GREEN implementation commit exists after local RED: `705a0bf`.
- RED gate commit exists for live import coverage: `c05cfdd`.
- GREEN implementation commit exists after live RED: `279d950`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made root npm workflow import wrappers runnable**
- **Found during:** Close-out verification for Task 2 wrapper support
- **Issue:** The literal root scripts `cap-n8n` and `cap-n8n import` did not run in the already-installed private workspace because npm did not expose the workspace package bin in `node_modules/.bin`.
- **Fix:** Pointed root scripts at `node cap-n8n-plugin/bin/cap-n8n.js` while preserving package `bin` metadata for consumers, and reified `package-lock.json` so it records the new package bin.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm run cap-n8n -- --help` and `npm run n8n:workflow:import -- --app demo-app --from test-workflows/workflows.json --workflow cap-test-trigger --schema demo-app/n8n/workflows/cap-test-trigger/schema.json` passed.
- **Committed in:** `84d01c2`

---

**Total deviations:** 1 auto-fixed (1 blocking issue)
**Impact on plan:** The package still exposes the planned `cap-n8n` bin, and the repo-local npm wrappers now work immediately in the current workspace.

## Issues Encountered

- `npm install --ignore-scripts` was used to reify existing workspace metadata after adding the package bin. It reported pre-existing audit advisories; no new package was added and no dependency version changed.
- One PowerShell source scan falsely treated a command-state value as a `--api-key` help match; the check was rerun against the actual help text and passed.

## Known Stubs

None. The touched files contain no TODO/FIXME/placeholder text and no unwired UI or mock-data stubs. Test fixture secrets are synthetic values used only to assert redaction.

## Threat Flags

None. The new CLI filesystem boundary and live HTTP client were both covered by the plan threat register and verified with path/helper delegation, explicit selection rules, timeout usage, env-backed credentials, and redaction tests.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required for automated verification.

## Next Phase Readiness

Ready for Plan 05-03. Local and live workflow imports now write the same deterministic artifact layout that build validation can consume.

## Self-Check: PASSED

- Found key files: CLI binary, local import orchestrator, live client, selector helper, local import integration test, live import integration test, and this summary.
- Found task commits: `fd02a96`, `705a0bf`, `c05cfdd`, `279d950`, and `84d01c2`.
- Plan-level verification commands passed after all task commits.

---
*Phase: 05-workflow-import-and-build-validation*
*Completed: 2026-06-03*
