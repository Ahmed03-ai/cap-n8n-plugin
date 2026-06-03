# Codebase Concerns

**Analysis Date:** 2026-06-03

**Last mapped commit:** fa456e23c97b9349257019c15ca7723aa8a3352d

## Tech Debt

**Runtime service contract is still event-first:**
- Issue: `N8nWorkflowService` exposes `start`, `dispatchPending`, `getExecution`, `queryExecutions`, and `cancel` as JavaScript service handlers, while `cap-n8n-plugin/index.cds` currently defines persistence entities but not a public typed service/action contract.
- Files: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/index.cds`
- Impact: Programmatic CAP callers can use the service, and tests cover behavior, but generated clients and model-level action validation remain weaker than a CDS-defined service contract.
- Fix approach: Add a plugin-owned CDS service definition for workflow actions/results and bind the current JavaScript implementation to that public model.

**Default Docker n8n does not install the local community node:**
- Issue: `cap-n8n-node` now builds a real `n8n-nodes-sap-cap` package, but `docker-compose.yml` starts plain `n8nio/n8n:latest` and does not mount/install the local package.
- Files: `docker-compose.yml`, `cap-n8n-node/package.json`, `docs/manual-visual-showcase.md`, `README.md`
- Impact: Deterministic tests verify the built node package, but the default local n8n UI will not show the SAP CAP node unless the package is separately installed or mounted.
- Fix approach: Add a Phase 8-style local custom-node harness or documented Docker override that installs/mounts `cap-n8n-node`, then run live editor/runtime E2E verification.

**Generated agent context can drift after codebase-map changes:**
- Issue: `AGENTS.md` embeds snapshots from `.planning/codebase/` documents and can become stale after incremental codebase maps unless the generated agent context is refreshed.
- Files: `AGENTS.md`, `.planning/codebase/*.md`
- Impact: Future agent sessions may see old stack/convention/architecture facts even after mapper docs have been corrected.
- Fix approach: Regenerate or refresh `AGENTS.md` after this incremental map is accepted, especially because it still contains older "placeholder" and "no automated test runner" wording.

**No CI pipeline yet:**
- Issue: The repo has passing local scripts (`npm run smoke`, `npm run test:integration`, `npm test`, and package-level workspace checks) but no `.github/workflows` or equivalent CI configuration.
- Files: `package.json`, `cap-n8n-node/package.json`
- Impact: Regressions can be caught locally, but there is no remote quality gate for PRs or releases.
- Fix approach: Add CI on Node versions compatible with both CAP and `n8n-nodes-sap-cap`, run root tests, workspace tests, and optionally a Docker-backed n8n smoke job.

## Known Bugs and Behavioral Caveats

**Race-prone integer ID generation:**
- Symptoms: New book IDs are assigned by reading `max(ID)` from active and draft tables and adding one.
- Files: `demo-app/srv/admin-service.js`, `demo-app/db/schema.cds`
- Trigger: Concurrent `NEW` or `CREATE` requests for `Books` can compute the same next ID.
- Workaround: Avoid concurrent creates in the demo or provide explicit unique IDs in requests.

**Best-effort workflow starts do not fail the primary CAP mutation:**
- Symptoms: Demo/declarative n8n dispatch failures can be logged while the Book mutation still succeeds.
- Files: `demo-app/srv/admin-service.js`, `cap-n8n-plugin/lib/annotations/AnnotationRegistrar.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Trigger: n8n is down, unauthorized, returns a non-2xx response, or dispatch fails after the CAP transaction succeeds.
- Workaround: Check CAP logs and execution query results; choose blocking/non-best-effort semantics for callers that require workflow delivery guarantees.

**Manual visual demo depends on n8n test webhook mode:**
- Symptoms: The default demo annotation uses `webhook-test/cap-test-trigger`, which only receives events while the n8n Webhook node is listening in test mode.
- Files: `demo-app/srv/admin-service.cds`, `docs/manual-visual-showcase.md`, `test-workflows/workflows.json`
- Trigger: Follow the visual demo without first opening the workflow and putting the Webhook node into test/listening mode.
- Workaround: Use the runbook in `docs/manual-visual-showcase.md` and keep active production webhook paths separate from test-mode demo paths.

**n8n node tooling warning is expected for now:**
- Symptoms: The n8n node build/lint path may print Node `DEP0190` from current n8n node tooling dependencies.
- Files: `cap-n8n-node/package.json`, `docs/manual-visual-showcase.md`, `README.md`
- Trigger: Run `npm run build --workspace n8n-nodes-sap-cap`, `npm run smoke`, `npm run test:integration`, or `npm test`.
- Workaround: Treat it as a tooling warning while commands exit successfully; revisit when upgrading `@n8n/node-cli`.

## Security Considerations

**Production credential policy is not fully enforced:**
- Risk: Webhook mode validates `baseUrl`, but API keys are optional and local HTTP is still supported for development.
- Files: `cap-n8n-plugin/lib/config.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/package.json`
- Current mitigation: Demo config references `N8N_API_KEY` through CAP environment interpolation; `.env` is ignored.
- Recommendations: Define production-profile rules for required API keys, allowed protocols, and startup failure behavior, then cover them with integration tests.

**Raw workflow fixture should stay minimal and sanitized:**
- Risk: `test-workflows/workflows.json` is an n8n export fixture. Even when credentials are absent, workflow exports can carry owner/project/webhook IDs or other instance metadata.
- Files: `test-workflows/workflows.json`, `cap-n8n-plugin/lib/workflows/sanitize.js`, `demo-app/n8n/**`
- Current mitigation: Generated app-local workflow artifacts are sanitized and tested; docs warn not to commit real credentials.
- Recommendations: Keep committed fixtures small, scrub instance metadata before commit, and prefer sanitized app-local artifacts for documentation and tests.

**Live n8n node credentials must remain outside the repo:**
- Risk: The SAP CAP n8n node supports Basic Auth and OAuth2 Client Credentials, so manual live testing can involve real CAP usernames, passwords, token URLs, client IDs, and client secrets.
- Files: `cap-n8n-node/credentials/SapCapApi.credentials.ts`, `README.md`, `docs/manual-visual-showcase.md`
- Current mitigation: Docs use placeholders for Basic Authorization examples and warn not to display literal API keys.
- Recommendations: Keep all real credential values in n8n credential storage or local environment configuration; do not add captured credential exports to fixtures.

## Scaling Limits

**No metadata cache for n8n-to-CAP discovery:**
- Current capacity: Entity sets, keys, actions, and functions are loaded from `$metadata` through n8n load-options helpers.
- Limit: Large CAP services may repeatedly parse metadata during editor usage and tests do not yet exercise cache invalidation behavior.
- Scaling path: Add a bounded metadata cache keyed by credential/base URL/service metadata path, with invalidation when credential fields change.

**Polling triggers are not implemented:**
- Current capacity: The n8n community node supports operations for querying, reading, mutating, and invoking CAP actions/functions.
- Limit: n8n trigger-node workflows that poll CAP OData changes are outside the current package surface.
- Scaling path: Add a separate trigger node only after defining cursor semantics, auth reuse, paging behavior, and duplicate suppression.

**Single local n8n workflow fixture:**
- Current capacity: `test-workflows/workflows.json` contains a minimal webhook workflow used for the CAP-to-n8n demo path.
- Limit: It cannot visually demonstrate rich downstream workflow behavior, long-running cancellable executions, or multiple workflow contracts.
- Scaling path: Add curated sanitized fixtures for representative showcase scenarios while keeping deterministic integration tests small.

## Dependencies at Risk

**n8n community-node tooling pins a narrow Node range:**
- Risk: `cap-n8n-node/package.json` declares `node >=22.16 <25`, while the CAP plugin itself supports Node `>=20`.
- Impact: A developer can run CAP/plugin code on Node 20 but fail n8n node build/lint/test commands until they switch to a compatible Node version.
- Migration plan: Keep README/visual-showcase prerequisites explicit and track `@n8n/node-cli` compatibility before widening the package engine range.

**Transitive deprecated tooling remains in the lockfile:**
- Risk: The root lockfile includes deprecated transitive packages from CAP/n8n tooling chains, including native-install and ESLint compatibility packages.
- Impact: Fresh installs may show warnings even when tests pass.
- Migration plan: Track upstream `@cap-js/sqlite`, `@n8n/node-cli`, `better-sqlite3`, and ESLint-related updates; only pin overrides if warnings become install or runtime failures.

## Test Coverage Gaps

**Live installed custom-node E2E:**
- What's not tested: Installing or mounting `cap-n8n-node` into a real n8n instance, opening the SAP CAP node in the live editor, saving credentials, selecting metadata-backed fields, and running the node through n8n runtime.
- Files: `cap-n8n-node/**`, `docker-compose.yml`, `docs/manual-visual-showcase.md`
- Risk: Built-node contracts can pass while a packaging/editor integration issue remains undiscovered.
- Priority: High for release readiness.

**Production profile/security policy:**
- What's not tested: Production-profile credential enforcement, HTTP/HTTPS policy, and startup failure semantics for missing API keys or unsafe webhook configuration.
- Files: `cap-n8n-plugin/lib/config.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/package.json`
- Risk: Local-friendly defaults may leak into production app configuration.
- Priority: Medium.

**Association-rich annotation mappings:**
- What's not tested: To-one/to-many mapped workflow inputs from CAP associations.
- Files: `cap-n8n-plugin/lib/annotations/PayloadBuilder.js`, `cap-n8n-plugin/lib/workflows/validate.js`, `demo-app/srv/admin-service.cds`
- Risk: Current scalar mapping coverage does not prove richer object/collection payloads.
- Priority: Medium.

**Manual showcase remains partly no-harness:**
- What's not tested: A complete no-harness visual path for cancellation and installed SAP CAP n8n node usage in the n8n UI.
- Files: `docs/manual-visual-showcase.md`, `README.md`, `docker-compose.yml`
- Risk: Presenter claims can outrun verified evidence unless the runbook caveats are followed exactly.
- Priority: Medium.

---

*Concerns audit: 2026-06-03*
