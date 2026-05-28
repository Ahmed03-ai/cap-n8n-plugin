# Codebase Concerns

**Analysis Date:** 2026-05-28

## Tech Debt

**CAP plugin package surface:**
- Issue: The published package entry point is empty while the usable code lives in `cap-n8n-plugin/cds-plugin.js` and `cap-n8n-plugin/lib/N8nWorkflowService.js`. `cap-n8n-plugin/package.json` points `"main"` at `index.js`, and `cap-n8n-plugin/index.js` has no exports.
- Files: `cap-n8n-plugin/package.json`, `cap-n8n-plugin/index.js`, `cap-n8n-plugin/cds-plugin.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Impact: Consumers importing `cap-n8n-plugin` receive no API, and package behavior depends on CAP discovering `cds-plugin.js` by convention. This makes programmatic use, documentation, and testing brittle.
- Fix approach: Export the service/client API from `cap-n8n-plugin/index.js`, keep `cds-plugin.js` for CAP auto-registration, and add a package-level smoke test that verifies both `require('cap-n8n-plugin')` and `cds.connect.to('n8n')`.

**Missing plugin service model:**
- Issue: Requirements define a `N8nWorkflowService` CDS service with `start`, `cancel`, and `query` actions, but the repo only implements a JavaScript subclass with a `start` handler and no `.cds` service contract.
- Files: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `N8N_REQUIREMENTS.md`, `cap_n8n_requirements_v2.md`
- Impact: CAP clients have no typed service definition for the n8n API. Missing model artifacts block validation, generated clients, and contract-level tests.
- Fix approach: Add a plugin-owned service definition such as `cap-n8n-plugin/srv/n8n-workflow-service.cds`, expose `start`, `cancel`, and `query` with typed payloads, and bind `N8nWorkflowService.js` to that contract.

**Declarative annotation system absent:**
- Issue: Requirements specify `@n8n.workflow.start`, `@n8n.workflow.cancel`, lifecycle event selection, input mapping, and conditional triggers. The codebase contains no annotation scanner or generic entity hook registration.
- Files: `N8N_REQUIREMENTS.md`, `cap_n8n_requirements_v2.md`, `cap-n8n-plugin/cds-plugin.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`
- Impact: The demo proves one hard-coded imperative trigger, but the central declarative CAP plugin value proposition is not implemented.
- Fix approach: Add a registration pass in `cap-n8n-plugin/cds-plugin.js` that scans compiled CDS definitions for n8n annotations, validates them at startup, and attaches `after CREATE/UPDATE/DELETE` handlers per annotated entity.

**n8n community node package is a placeholder:**
- Issue: The `cap-n8n-node` workspace has package metadata and an empty `index.js`, while requirements define credentials, query/read/create/update/delete modes, metadata discovery, and action/function invocation.
- Files: `cap-n8n-node/package.json`, `cap-n8n-node/index.js`, `cap_n8n_requirements_v2.md`, `N8N_REQUIREMENTS.md`, `mockups/n8n-node-mockup.html`
- Impact: Half of the documented product direction, n8n-to-CAP access, has no implementation scaffold that n8n can load.
- Fix approach: Scaffold the n8n node using n8n community-node conventions, add credential classes and operation descriptions, and keep mockup fields aligned with real node properties.

**Package metadata drift:**
- Issue: The root lockfile records `cap-n8n-plugin` as ISC with no peer dependencies, while `demo-app/package-lock.json` records the linked package as MIT with `@sap/cds >=7` peer dependency metadata. `cap-n8n-plugin/package.json` itself has no `peerDependencies`.
- Files: `package-lock.json`, `demo-app/package-lock.json`, `cap-n8n-plugin/package.json`
- Impact: Different install roots see different package metadata, which can hide missing peer dependencies and create inconsistent install behavior.
- Fix approach: Make `cap-n8n-plugin/package.json` the source of truth for `license`, `peerDependencies`, `engines`, and package files, then regenerate the root and demo lockfiles from the workspace root.

**Global tooling dependency:**
- Issue: The demo start script uses `cds-serve`, and README setup lists `@sap/cds-dk` as a prerequisite instead of declaring local dev tooling. Running `npx cds compile demo-app/srv --to csn` from the repo failed because npm could not determine an executable.
- Files: `demo-app/package.json`, `README.md`, `package.json`
- Impact: Build and validation commands depend on globally installed tools, making CI and fresh developer machines unreliable.
- Fix approach: Add local dev dependencies and scripts, for example `@sap/cds-dk` plus `npm run compile --workspace demo-app`, and document only repo-local commands.

## Known Bugs

**Missing workflow ID crashes before CAP error normalization:**
- Symptoms: `start` calls `_triggerWebhook(workflowId, inputs)`, and `_triggerWebhook` immediately calls `workflowId.replace(...)`. Missing or non-string `workflowId` throws a JavaScript `TypeError`.
- Files: `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Trigger: Call `n8n.send('start', { inputs: {} })` or pass a non-string `workflowId`.
- Workaround: Validate callers manually before invoking `start`.

**n8n failures are swallowed in the demo create hook:**
- Symptoms: The demo catches any n8n error, logs it, and still returns a successful CAP create. This matches the desired non-rollback behavior for declarative triggers, but it hides integration failures from programmatic callers of the demo behavior.
- Files: `demo-app/srv/admin-service.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Trigger: Create a book while n8n is down, unauthorized, or returning a non-2xx response.
- Workaround: Check CAP logs after creating books; no response-level signal is returned by the demo hook.

**Race-prone integer ID generation:**
- Symptoms: New book IDs are assigned by reading `max(ID)` from active and draft tables and adding one.
- Files: `demo-app/srv/admin-service.js`, `demo-app/db/schema.cds`
- Trigger: Concurrent `NEW` or `CREATE` requests for `Books` can compute the same next ID.
- Workaround: Avoid concurrent creates in the demo or provide explicit unique IDs in requests.

**Demo request contradicts README:**
- Symptoms: `demo-app/readme.md` says the book ID is generated automatically, while `demo-app/test.http` still sends an explicit `ID`.
- Files: `demo-app/readme.md`, `demo-app/test.http`
- Trigger: Follow the demo request file as the source of truth.
- Workaround: Remove `ID` from `demo-app/test.http` when testing generated IDs.

**Workspace test command fails by design:**
- Symptoms: `npm test --workspaces --if-present` exits with failing placeholder scripts in `cap-n8n-plugin` and `cap-n8n-node`.
- Files: `cap-n8n-plugin/package.json`, `cap-n8n-node/package.json`, `package.json`
- Trigger: Run the workspace test command.
- Workaround: There is no passing automated test command in the current repo.

## Security Considerations

**No production credential enforcement:**
- Risk: `N8nWorkflowService` defaults to `http://localhost:5678` and treats `apiKey` as optional. Requirements say production should require real `apiKey` and `baseUrl`.
- Files: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/package.json`, `cap_n8n_requirements_v2.md`, `N8N_REQUIREMENTS.md`
- Current mitigation: `demo-app/package.json` references `N8N_API_KEY` through CAP environment interpolation.
- Recommendations: Detect production profiles through CAP environment settings, require `baseUrl` and `apiKey`, reject plain HTTP outside local development, and fail startup with a clear CAP error when credentials are missing.

**Unvalidated outbound URL construction:**
- Risk: User-provided `workflowId` is appended to `baseUrl` after only trimming a leading slash. The code accepts arbitrary path segments and automatically prefixes `webhook/`.
- Files: `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Current mitigation: Requests are constrained to the configured base URL.
- Recommendations: Validate `workflowId` against an allowlist-style path pattern, reject `..`, query strings, fragments, and absolute URLs, and encode path segments before building the webhook URL.

**Sensitive and personal metadata in committed workflow export:**
- Risk: The exported n8n workflow includes owner/project metadata, personal identifying information, workflow IDs, webhook IDs, and project/user IDs.
- Files: `test-workflows/workflows.json`
- Current mitigation: No credentials were detected in the export.
- Recommendations: Strip `shared`, `project`, owner, creator, and instance-specific IDs before committing workflow fixtures; keep only deterministic workflow structure needed for tests.

**Hard-coded Basic authorization sample:**
- Risk: Demo docs and request files include a literal Basic Authorization header. Even demo credentials normalize copying static auth material into local and shared files.
- Files: `README.md`, `demo-app/test.http`
- Current mitigation: The value appears to be a local demo credential, not a production secret.
- Recommendations: Replace the literal header with a REST Client variable or documented placeholder and keep example credentials out of committed request files.

**Error logging can expose remote response bodies:**
- Risk: Non-2xx n8n responses are read as text and included in thrown errors. The demo logs `err.message`, which can include remote response bodies.
- Files: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`
- Current mitigation: API keys are sent only in headers and are not directly logged by the service.
- Recommendations: Structure errors with status, source, and sanitized message fields; redact response bodies by default and expose full details only under debug logging.

## Performance Bottlenecks

**No HTTP timeout, retry, or cancellation:**
- Problem: `fetch` calls can wait indefinitely and transient 502/503/504/network failures are not retried.
- Files: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap_n8n_requirements_v2.md`, `N8N_REQUIREMENTS.md`
- Cause: `_triggerWebhook` calls `fetch` directly without `AbortController`, retry policy, or exponential backoff.
- Improvement path: Add configurable timeout, retry count, backoff, retryable status classification, and tests for timeout, retry success, max retry failure, and non-retryable 4xx.

**Synchronous n8n notification in create hook:**
- Problem: Book creation waits for the n8n webhook call before the `after CREATE` handler completes.
- Files: `demo-app/srv/admin-service.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Cause: The demo awaits `n8n.send('start', ...)` inline inside the request lifecycle.
- Improvement path: Move non-blocking declarative triggers to an outbox/background dispatch pattern or explicitly document request latency tradeoffs for programmatic blocking calls.

**Max-ID scan per create:**
- Problem: Every new book creation performs aggregate reads on active and draft book tables.
- Files: `demo-app/srv/admin-service.js`
- Cause: IDs are generated with `SELECT max(ID)` instead of database-generated keys or UUIDs.
- Improvement path: Use CAP `cuid`, a database sequence, or a transaction-safe number range; if integer IDs are required, centralize allocation behind a locked service.

## Fragile Areas

**Demo hard-codes workflow path and test-mode webhook:**
- Files: `demo-app/srv/admin-service.js`, `README.md`, `test-workflows/workflows.json`
- Why fragile: The demo sends `workflowId: 'webhook-test/cap-test-trigger'`, which depends on n8n canvas test mode unless the workflow and path setup match exactly.
- Safe modification: Move workflow paths into `cds.requires.n8n` configuration or entity annotations, and keep active webhook paths separate from test-mode paths.
- Test coverage: No automated test verifies the demo hook against a mocked n8n endpoint.

**Plugin mutates global CAP environment on bootstrap:**
- Files: `cap-n8n-plugin/cds-plugin.js`
- Why fragile: The plugin writes to `cds.env.requires` during `bootstrap`, which can conflict with app-level configuration ordering and makes side effects hard to isolate in tests.
- Safe modification: Preserve explicit app configuration, register defaults in a narrow helper, and test behavior for absent, partial, and explicit `cds.requires.n8n` settings.
- Test coverage: No unit or integration tests cover bootstrap registration.

**Service implementation has no input schema validation:**
- Files: `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Why fragile: `workflowId`, `inputs`, `baseUrl`, and API response shape are trusted. Invalid inputs produce generic runtime exceptions or pass malformed payloads to n8n.
- Safe modification: Validate request data at the CDS action boundary and return standard CAP errors for invalid arguments.
- Test coverage: No tests cover missing workflow IDs, malformed inputs, non-JSON responses, empty responses, or n8n error payloads.

**Generated/demo application code is mixed with plugin behavior:**
- Files: `demo-app/srv/admin-service.js`, `demo-app/db/schema.cds`, `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Why fragile: The only end-to-end trigger lives in the demo app, not in plugin-owned registration code. Changes to demo service logic can accidentally be mistaken for plugin functionality.
- Safe modification: Keep demo hooks minimal and shift reusable trigger behavior into `cap-n8n-plugin`.
- Test coverage: No plugin-level integration test creates a temporary CAP model and verifies trigger registration.

## Scaling Limits

**No execution state storage:**
- Current capacity: The service can issue one webhook request and return its immediate response.
- Limit: Cancel, query, status tracking, business-key lookup, and pagination cannot work because execution IDs are not persisted or indexed.
- Scaling path: Add an execution store abstraction with CAP persistence for workflow ID, execution ID, business key/tag, status, timestamps, and correlation ID.

**No metadata cache for n8n-to-CAP node:**
- Current capacity: Not implemented.
- Limit: Requirements for CAP entity dropdowns and action/function discovery depend on `$metadata` parsing and caching, but `cap-n8n-node/index.js` is empty.
- Scaling path: Implement metadata fetch/cache in the node package and add invalidation when credentials or base URLs change.

**Single local workflow fixture:**
- Current capacity: `test-workflows/workflows.json` contains one webhook-only workflow fixture.
- Limit: It cannot validate cancel/query/import/typed input behavior, multi-node workflows, credentials, or OData operations.
- Scaling path: Add sanitized fixtures for representative workflow types and keep them small enough for deterministic integration tests.

## Dependencies at Risk

**`prebuild-install`:**
- Risk: Both lockfiles include `prebuild-install@7.1.3`, which is marked deprecated in the lockfile as a transitive dependency of `better-sqlite3`.
- Impact: Local SQLite setup can inherit unsupported native-install tooling through `@cap-js/sqlite`.
- Migration plan: Track `@cap-js/sqlite` and `better-sqlite3` updates, and keep CI on supported Node versions to catch native install failures early.

**Undeclared `@sap/cds` peer for plugin:**
- Risk: `cap-n8n-plugin/lib/N8nWorkflowService.js` and `cap-n8n-plugin/cds-plugin.js` require `@sap/cds`, but `cap-n8n-plugin/package.json` does not declare it.
- Impact: The plugin only works when the host app happens to provide `@sap/cds`; package managers cannot warn about incompatible or missing CAP versions.
- Migration plan: Add `peerDependencies` for `@sap/cds`, add an `engines.node` range aligned with CAP, and test install behavior from a clean consumer app.

## Missing Critical Features

**Programmatic cancel and query APIs:**
- Problem: Requirements define `cancel(executionId)` and `query(filters)`, but only `start` is registered.
- Blocks: Workflow lifecycle management, progress displays, cancellation, pagination, and execution lookup by business key.

**Local mock implementation:**
- Problem: Requirements define a development mock with in-memory executions, automatic activation, and state transitions. No mock service exists.
- Blocks: Offline development and deterministic tests without a live n8n container.

**Workflow import and typed CDS generation:**
- Problem: Requirements define local and remote workflow import plus typed CDS generation and build-time validation. No import command or generator exists.
- Blocks: Type-safe workflow inputs and build-time validation of annotations.

**n8n community node implementation:**
- Problem: The n8n-to-CAP package contains no credential, node, operation, or metadata-discovery implementation.
- Blocks: CAP reads/writes from n8n, credential validation, OData response cleanup, polling triggers, and action/function invocation.

**CI pipeline and quality gates:**
- Problem: No CI config, lint config, formatter config, or passing test command is present.
- Blocks: Automated regression detection and repeatable verification before publishing.

## Test Coverage Gaps

**Plugin service behavior:**
- What's not tested: Successful start, authentication header behavior, non-2xx responses, empty response bodies, non-JSON bodies, network failures, missing workflow IDs, timeout, retry, and sanitized errors.
- Files: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/package.json`
- Risk: Core integration behavior can break without any failing test.
- Priority: High

**CAP plugin bootstrap:**
- What's not tested: Default `cds.requires.n8n` registration, preservation of explicit app configuration, partial configuration, and missing credential handling.
- Files: `cap-n8n-plugin/cds-plugin.js`
- Risk: Plugin loading behavior can change silently across CAP versions or app profiles.
- Priority: High

**Declarative annotations:**
- What's not tested: Create/update/delete triggers, cancellation annotations, input mapping, association expansion, conditional expressions, and registration-time validation.
- Files: `N8N_REQUIREMENTS.md`, `cap_n8n_requirements_v2.md`
- Risk: Large requirement surface has no implementation or executable safety net.
- Priority: High

**Demo app n8n hook:**
- What's not tested: Book creation invoking n8n, n8n unavailable behavior, request latency, and generated ID behavior.
- Files: `demo-app/srv/admin-service.js`, `demo-app/test.http`
- Risk: The documented demo can regress or fail on fresh machines.
- Priority: Medium

**n8n community node:**
- What's not tested: Credentials, metadata discovery, query/read/create/update/delete, action/function invocation, response cleanup, and polling trigger behavior.
- Files: `cap-n8n-node/index.js`, `cap-n8n-node/package.json`, `mockups/n8n-node-mockup.html`
- Risk: The package is currently non-functional while requirements and mockups imply a substantial user-facing integration.
- Priority: High

---

*Concerns audit: 2026-05-28*
