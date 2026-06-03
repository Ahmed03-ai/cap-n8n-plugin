---
phase: 05-workflow-import-and-build-validation
verified: 2026-06-03T10:33:31Z
status: human_needed
score: 24/24 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run live workflow import against a real local or cloud n8n instance using configured CAP/environment credentials."
    expected: "`npm run n8n:workflow:import -- --app demo-app --live --workflow <workflow-id> --schema demo-app/n8n/workflows/cap-test-trigger/schema.json` fetches from n8n, writes sanitized app-local artifacts, does not print or commit the API key, and `npm run n8n:workflow:validate -- --app demo-app` still exits 0."
    why_human: "Automated tests verify the live API contract with a fake HTTP server, but verifier contract classifies real external-service integration as requiring human testing."
---

# Phase 5: Workflow Import and Build Validation Verification Report

**Phase Goal:** CAP developers can import n8n workflows into deterministic typed local artifacts and catch mapping problems during `cds build`.
**Verified:** 2026-06-03T10:33:31Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CAP developer can import a local workflow JSON file offline and receive generated CDS artifacts with typed workflow inputs. | VERIFIED | `cap-n8n-plugin/bin/cap-n8n.js` dispatches `import` to `importWorkflows`; `import.js` reads local JSON, `selection.js` applies one/all selection, and `artifacts.js` writes `n8n/index.cds`. Focused integration command passed all 16 integration files / 103 tests, including local import and generated CDS tests. |
| 2 | CAP developer can import a workflow definition from live n8n using configured credentials and save the same sanitized local artifact layout. | VERIFIED | `live-client.js` fetches `/api/v1/workflows...excludePinnedData=true`, sends `X-N8N-API-KEY` only when resolved from CAP config/env, and live import routes through `writeWorkflowArtifacts`. Fake-live integration tests passed. Real n8n service UAT is listed under human verification. |
| 3 | CAP developer can rely on deterministic generated workflow files and manifests that avoid committed secrets or instance-specific metadata. | VERIFIED | `sanitizeWorkflow` and stable JSON writers produce byte-stable artifacts. Direct comparison confirmed sanitizing `test-workflows/workflows.json` equals checked-in `demo-app/n8n/workflows/cap-test-trigger/workflow.json`. Secret scans over docs, generated artifacts, CLI output, and implementation sources found no blocking leaks. |
| 4 | `cds build` reports clear errors for missing inputs and type mismatches in workflow trigger annotations. | VERIFIED | `BuildValidationPlugin.js` invokes `validateWorkflowAnnotations` and throws `BuildError` for error diagnostics. Integration tests run `cds build --project <tmp-app>` and assert `ERR_N8N_WORKFLOW_REQUIRED_INPUT` and `ERR_N8N_WORKFLOW_TYPE_MISMATCH` failures with entity, workflow, input, field, and CAP type context. |
| 5 | `cds build` reports warnings for extra inputs or untyped workflow references without blocking incremental adoption. | VERIFIED | Validator emits `WARN_N8N_WORKFLOW_EXTRA_INPUT`, `WARN_N8N_WORKFLOW_UNKNOWN_REFERENCE`, and `WARN_N8N_WORKFLOW_UNTYPED`; build tests assert warning-only fixtures exit 0 and create `gen`. |

**Score:** 24/24 must-haves verified (5 roadmap truths plus 19 detailed PLAN frontmatter truths).

### Detailed Plan Truths

| Plan | Count | Status | Evidence |
|------|-------|--------|----------|
| 05-01 artifact contract | 4/4 | VERIFIED | Schema normalization, unsupported schema rejection, missing sidecar warnings, app-root artifacts, sanitized `cap-test-trigger` workflow, generated `CapTestTriggerInputs`, and manifest accepted references are implemented and tested. |
| 05-02 import CLI | 5/5 | VERIFIED | `cap-n8n import`, local selection, explicit `--all`, live fake-server import, env/config credentials, no `--api-key` help flag, and artifact-helper delegation are implemented and tested. |
| 05-03 build validation | 5/5 | VERIFIED | Shared validator, sanitized diagnostics, CAP build plugin registration, strict typed errors, warning-only cases, and annotation parser/artifact manifest wiring are implemented and tested. |
| 05-04 direct validation/docs | 5/5 | VERIFIED | `cap-n8n validate`, npm wrapper, aggregate Phase 5 tests, package exports, README, and manual showcase documentation are implemented and verified. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cap-n8n-plugin/lib/workflows/schema.js` | Sidecar scalar schema normalization | VERIFIED | Exports `SUPPORTED_WORKFLOW_INPUT_TYPES` and `normalizeWorkflowSchema`; supports String, Integer, Decimal, Boolean, Date, DateTime, JSON. |
| `cap-n8n-plugin/lib/workflows/sanitize.js` | Recursive workflow sanitizer | VERIFIED | Exports `sanitizeWorkflow`; removes unsafe fields and records removed path names. |
| `cap-n8n-plugin/lib/workflows/generate-cds.js` | Generated CDS workflow input types | VERIFIED | Exports `generateWorkflowCds` and `workflowTypeName`; maps JSON to `LargeString`. |
| `cap-n8n-plugin/lib/workflows/artifacts.js` | App-root artifact writer/reader | VERIFIED | Exports `writeWorkflowArtifacts` and `readWorkflowArtifacts`; enforces app-root `n8n/` containment. |
| `cap-n8n-plugin/lib/workflows/import.js` | Local/live import orchestration | VERIFIED | Exports `importWorkflows`; local and live paths both call `writeWorkflowArtifacts`. |
| `cap-n8n-plugin/lib/workflows/live-client.js` | n8n public API client | VERIFIED | Exports `fetchWorkflow` and `fetchWorkflows`; normalizes API URLs and credential header behavior. |
| `cap-n8n-plugin/lib/workflows/selection.js` | Workflow selector and `--all` rules | VERIFIED | Exports `selectWorkflows`; rejects ambiguous multi-workflow imports unless `--workflow` or `--all` is explicit. |
| `cap-n8n-plugin/lib/workflows/validate.js` | Shared workflow annotation validator | VERIFIED | Exports `validateWorkflowAnnotations`; consumes CSN annotations and app-local workflow artifacts. |
| `cap-n8n-plugin/lib/workflows/diagnostics.js` | Sanitized diagnostics | VERIFIED | Exports `createDiagnostic` and `summarizeDiagnostics`; deterministic ordering and allowlisted context. |
| `cap-n8n-plugin/lib/workflows/BuildValidationPlugin.js` | CAP build plugin | VERIFIED | Exports `BuildValidationPlugin`; `npx cds build --project demo-app` showed `n8n-workflow-validation` task registered. |
| `cap-n8n-plugin/lib/workflows/validate-command.js` | Direct CLI validation adapter | VERIFIED | Exports `runValidateCommand`; loads `db`, `srv`, `app`, and `n8n` model roots. |
| `cap-n8n-plugin/bin/cap-n8n.js` | Import and validate package CLI | VERIFIED | Dispatches `import` and `validate`; help contains no literal `--api-key`. |
| `demo-app/n8n/index.cds` | Generated demo workflow CDS | VERIFIED | Compiles; contains `namespace cap.n8n.workflows`, `CapTestTriggerInputs`, and `WorkflowInputContracts.capTestTrigger`. |
| `demo-app/n8n/workflows/cap-test-trigger/*.json` | Sanitized workflow, schema, manifest | VERIFIED | Schema has required `bookId` Integer and `title` String plus optional JSON `event`; workflow JSON contains no unsafe metadata fields. |
| `test/integration/n8n-workflow-*.test.js` | Phase 5 integration coverage | VERIFIED | `npm test` passed smoke plus all 16 integration files / 103 tests. |
| `README.md`, `docs/manual-visual-showcase.md` | Developer docs and showcase guide | VERIFIED | Document import/validate commands, artifact layout, expected output, and manual Phase 5 flow. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `test-workflows/workflows.json` | `demo-app/n8n/workflows/cap-test-trigger/workflow.json` | `sanitizeWorkflow` plus `writeWorkflowArtifacts` | VERIFIED | Direct Node comparison confirmed sanitized fixture equals checked-in workflow artifact. |
| `schema.json` | `demo-app/n8n/index.cds` | `generateWorkflowCds` | VERIFIED | Generated CDS contains `CapTestTriggerInputs` fields for `bookId`, `event`, and `title`. |
| `manifest.json` | `demo-app/srv/admin-service.cds` | accepted references | VERIFIED | Manifest accepts `webhook-test/cap-test-trigger`; `AdminService.Books` uses that reference. |
| `cap-n8n.js` | `import.js` | import subcommand dispatch | VERIFIED | CLI requires `importWorkflows` and calls it for `import`. |
| `import.js` | `artifacts.js` | `writeWorkflowArtifacts` | VERIFIED | Local and live import paths both delegate artifact writes. |
| `live-client.js` | `config.js` | resolved CAP config/env | VERIFIED | `import.js` uses `resolveN8nConfig`; live tests assert API-key placeholder resolution. |
| `validate.js` | `AnnotationParser.js` | `readWorkflowAnnotations` | VERIFIED | Validator scans CSN through Phase 4 annotation parser. |
| `validate.js` | `demo-app/n8n/manifest.json` | `readWorkflowArtifacts` | VERIFIED | Validator indexes artifact `acceptedReferences`. |
| `BuildValidationPlugin.js` | `validate.js` | `validateWorkflowAnnotations` | VERIFIED | Build plugin invokes shared validator and converts diagnostics to build messages/errors. |
| `cap-n8n.js` | `validate-command.js` | validate subcommand dispatch | VERIFIED | CLI requires `runValidateCommand` and returns its exit code. |
| `validate-command.js` | `validate.js` | shared validator | VERIFIED | Direct CLI validation delegates to `validateWorkflowAnnotations`. |
| `package.json` | `cap-n8n.js` | npm wrappers | VERIFIED | Root scripts include `cap-n8n`, `n8n:workflow:import`, and `n8n:workflow:validate`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `cap-n8n-plugin/lib/workflows/import.js` | selected workflow list | Local JSON file or live API response | Yes - parsed local exports or `fetchWorkflow(s)` response are passed to `selectWorkflows` and `writeWorkflowArtifacts`. | VERIFIED |
| `cap-n8n-plugin/lib/workflows/artifacts.js` | workflow/schema entries | `importWorkflows` or generator calls | Yes - writes sanitized workflow JSON, sidecar schema, per-workflow manifest, aggregate manifest, and generated CDS. | VERIFIED |
| `cap-n8n-plugin/lib/workflows/validate.js` | annotation diagnostics | CAP CSN plus `readWorkflowArtifacts(appRoot)` | Yes - reads generated manifests/schemas and Phase 4 parsed annotations, then returns deterministic errors/warnings. | VERIFIED |
| `cap-n8n-plugin/lib/workflows/BuildValidationPlugin.js` | build diagnostics | `this.model()` CSN during CAP build | Yes - `npx cds build --project demo-app` registered the `n8n-workflow-validation` build task; temp build tests verify error and warning output. | VERIFIED |
| `cap-n8n-plugin/lib/workflows/validate-command.js` | CLI diagnostics | `cds.load()` over app model roots | Yes - `node cap-n8n-plugin/bin/cap-n8n.js validate --app demo-app --json` returned parseable empty diagnostics. | VERIFIED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Direct validation passes for demo app | `node cap-n8n-plugin/bin/cap-n8n.js validate --app demo-app` | Exit 0; printed validation passed. | PASS |
| JSON validation output is parseable and sanitized | `node cap-n8n-plugin/bin/cap-n8n.js validate --app demo-app --json` | Exit 0; `errors`, `warnings`, `diagnostics` arrays all empty. | PASS |
| Generated CDS compiles with app model | `npx cds compile demo-app/db demo-app/srv demo-app/app demo-app/n8n --to csn` | Exit 0; CSN includes `AdminService.Books` workflow annotations and generated n8n definitions. | PASS |
| CAP build plugin is registered in demo build | `npx cds build --project demo-app --log-level warn` | Exit 0; tasks include `for: n8n-workflow-validation`. Existing unrelated value-help warnings only. | PASS |
| Focused Phase 5 integration coverage | `npm run test:integration -- --run ...n8n-workflow-*.test.js` | Exit 0; current script ran 16 integration files / 103 tests. | PASS |
| Full regression command | `npm test` | Exit 0; smoke 1 file / 3 tests, integration 16 files / 103 tests. | PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| None discovered | `scripts/**/probe-*.sh` and phase PLAN/SUMMARY probe references | No probe files or declared probe paths found. | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| IMPORT-01 | 05-02, 05-04 | CAP developer can import a local n8n workflow JSON file without connecting to live n8n. | SATISFIED | Local import CLI and integration tests passed; ambiguous imports rejected; explicit `--all` supported. |
| IMPORT-02 | 05-02, 05-04 | CAP developer can import a workflow definition from live n8n using configured credentials. | SATISFIED AUTOMATED; HUMAN UAT REQUIRED | Fake-live tests verify API path, `excludePinnedData=true`, env/config API-key header, routing overrides, and redaction. Real n8n UAT remains external-service human check. |
| IMPORT-03 | 05-01, 05-04 | Imported workflow definitions generate CDS artifacts with typed workflow inputs. | SATISFIED | `demo-app/n8n/index.cds` and generated temp artifacts compile with `CapTestTriggerInputs`. |
| IMPORT-04 | 05-01, 05-02, 05-04 | Imported workflow artifacts are stored locally in deterministic, sanitized layout. | SATISFIED | `writeWorkflowArtifacts` writes deterministic `appRoot/n8n`; sanitized checked-in workflow matches sanitized source fixture. |
| IMPORT-05 | 05-03, 05-04 | `cds build` validates workflow trigger annotations against generated input definitions. | SATISFIED | Build plugin registered and integration tests run `cds build --project <tmp-app>`. |
| IMPORT-06 | 05-03, 05-04 | Build validation reports clear errors for missing inputs and type mismatches. | SATISFIED | Tests assert `ERR_N8N_WORKFLOW_REQUIRED_INPUT` and `ERR_N8N_WORKFLOW_TYPE_MISMATCH` with context. |
| IMPORT-07 | 05-03, 05-04 | Build validation reports warnings for extra inputs or untyped workflow references. | SATISFIED | Tests assert warning-only build passes for extra inputs and untyped/unknown cases. |
| VERIFY-03 | 05-04 | Developer can run integration tests for workflow import and build-time validation. | SATISFIED | `npm test` passed smoke plus all integration tests; Phase 5 test files exist and are included in `test:integration`. |

No orphaned Phase 5 requirement IDs were found in `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Phase 5 source/docs scan | n/a | `TODO/FIXME/XXX`, placeholders, unsafe `.env` ingestion, literal API keys/private keys, raw auth logging | None | No blocker patterns found. False positives were README example `console.log` snippets and normal empty-object/array defaults in implementation code. |

### Human Verification Required

### 1. Real Live n8n Import

**Test:** Run live workflow import against an actual local or cloud n8n instance using configured CAP/environment credentials.
**Expected:** `npm run n8n:workflow:import -- --app demo-app --live --workflow <workflow-id> --schema demo-app/n8n/workflows/cap-test-trigger/schema.json` fetches the workflow, writes sanitized artifacts under `demo-app/n8n`, does not print or commit the API key, and `npm run n8n:workflow:validate -- --app demo-app` exits 0.
**Why human:** Automated tests use a fake HTTP server to verify request path, selection, auth header behavior, and redaction; the verifier contract routes real external-service integration to human verification.

### Gaps Summary

No implementation, test, documentation, artifact, wiring, or requirement-coverage gaps were found. Automated verification passed all must-haves. Status is `human_needed` only because the live n8n path requires real external-service UAT under the verifier contract.

Planning metadata note: `ROADMAP.md` still displays Phase 5 as 3/4 plans and in progress, while `roadmap.analyze` reports Phase 5 `disk_status: complete` with 4 plans and 4 summaries. This is metadata drift, not an implementation gap for the Phase 5 goal.

---

_Verified: 2026-06-03T10:33:31Z_
_Verifier: the agent (gsd-verifier)_
