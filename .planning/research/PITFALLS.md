# Domain Pitfalls

**Domain:** SAP CAP plugin plus n8n community node integration
**Project:** CAP n8n Integration
**Researched:** 2026-05-28
**Overall confidence:** HIGH for CAP/n8n lifecycle and packaging constraints from official docs; MEDIUM for project-specific priorities inferred from local requirements and codebase audits.

## Critical Pitfalls

### Pitfall 1: Mistaking the Demo for a Finished Plugin

**Priority:** P0
**What goes wrong:** Roadmap phases validate the existing Bookshop demo path and call the milestone complete while the reusable CAP plugin and n8n node remain incomplete.
**Warning signs:** Acceptance criteria mention `demo-app/srv/admin-service.js` instead of plugin-owned registration; tests only create demo books; `cap-n8n-node/index.js` stays empty; package import behavior is not verified; requirements keep saying "already works" because one webhook fires locally.
**Why it happens:** The brownfield repo has a useful manual demo, but the central deliverables are package surfaces: `cap-n8n-plugin` and `cap-n8n-node`.
**Consequences:** Supervisor review sees a prototype rather than an integration product; implementation logic is trapped in the demo app; publishing and reuse fail even if the demo looks convincing.
**Prevention:** Make every roadmap phase name the package-owned artifact it completes. Require smoke tests for `require('cap-n8n-plugin')`, `cds.connect.to('n8n')`, CAP annotation registration in a temporary model, and n8n loading the community node package.
**Phase/planning implication:** Phase 1 should harden package skeletons and public contracts before expanding features. Demo updates are evidence, not deliverables.

### Pitfall 2: Getting CAP Transaction Semantics Wrong

**Priority:** P0
**What goes wrong:** Workflow side effects run in an `after CREATE/UPDATE/DELETE` handler and are assumed to be after-commit, non-rollback work. In CAP, `after` handlers can still abort request processing; request-level `succeeded`, `failed`, and `done` handlers run after the transaction has ended and cannot veto the commit.
**Warning signs:** Code awaits n8n HTTP calls inside `after CREATE`; requirements say "does not roll back" without specifying `req.on('succeeded')` or an outbox; tests only cover the happy path; n8n failure behavior differs between programmatic and declarative calls.
**Why it happens:** "After" sounds like "after commit", but CAP's event phases and transaction completion hooks are different concepts.
**Consequences:** A temporary n8n outage can increase CAP request latency or accidentally fail business writes. Conversely, moving work to post-commit without a transaction-aware persistence strategy can lose side effects after process crashes.
**Prevention:** Define two explicit semantics. Programmatic `start()` is blocking and returns/throws. Declarative annotations schedule side effects after successful persistence using `req.on('succeeded')` plus an execution/outbox record where reliability matters. Any database work inside post-commit hooks must use an explicit transaction.
**Detection:** Tests should prove that a declarative n8n outage does not roll back the entity, and that an explicit programmatic call surfaces errors as CDS errors.
**Phase/planning implication:** Add a dedicated "transaction and dispatch semantics" phase before retry/cancel/query polish. Do not add annotation breadth until rollback behavior is nailed down.

### Pitfall 3: Treating Secrets as Optional Configuration

**Priority:** P0
**What goes wrong:** Local defaults (`http://localhost:5678`, optional API key, disabled n8n user management, hard-coded Basic auth examples) leak into production guidance or generated artifacts.
**Warning signs:** Production profile starts without `baseUrl` and authentication; webhook auth is disabled; API keys appear in README, request files, workflow exports, logs, screenshots, or fixtures; `.env.example` is missing; error logs include upstream response bodies.
**Why it happens:** Webhook demos are easiest with no auth, but production n8n API calls use `X-N8N-API-KEY`, scoped API keys are available on enterprise instances, and n8n credentials are designed to be encrypted and hidden by the platform.
**Consequences:** Leaked credentials, unauthenticated workflow triggers, non-reproducible supervisor review, and a package that encourages insecure deployment.
**Prevention:** Require `[production]` startup validation for HTTPS `baseUrl` and credentials. Keep all secret values in environment variables, service bindings, n8n credential storage, or BTP user-provided services. Redact response bodies by default. Sanitize n8n exports by removing owner/project/user IDs and any credential references not needed for tests.
**Detection:** Add secret scanning over docs, fixtures, `.http` files, workflow JSON, and generated artifacts. Add tests for missing production credentials and sanitized errors.
**Phase/planning implication:** Security/profile validation belongs in the first implementation phase, before documentation and workflow import produce more files that can leak secrets.

### Pitfall 4: Confusing n8n Test Webhooks with Production Webhooks

**Priority:** P0
**What goes wrong:** The integration hard-codes `webhook-test/...` or relies on the n8n editor's "Listen for Test Event" state, then fails when the workflow is active, published, imported, or run outside the UI.
**Warning signs:** Workflow IDs contain `webhook-test`; README tells users to click "Test step" for normal operation; tests require the n8n editor to be open; production docs do not explain active workflow state; no test covers imported inactive workflows.
**Why it happens:** n8n Webhook nodes expose separate test and production URLs. Test URLs are registered only during manual testing; production URLs are registered when the workflow is published/active.
**Consequences:** Local demos pass inconsistently, deployed CAP apps trigger 404s, and users cannot tell whether the problem is CAP, n8n activation, or URL selection.
**Prevention:** Model webhook mode explicitly: `test` only for local/manual development, `production` for real profiles. Store the full webhook path or imported workflow metadata rather than guessing prefixes. Validate and encode path segments; reject absolute URLs, query strings, fragments, `..`, and unrecognized modes.
**Detection:** Integration tests should cover inactive/test mode, active/production mode, bad path, and imported workflow deactivation. Documentation should show separate test and production setup paths.
**Phase/planning implication:** Webhook lifecycle and URL validation should be completed before workflow import and before retry logic, because retries cannot fix an invalid lifecycle state.

### Pitfall 5: Overpromising n8n Execution Lifecycle Control

**Priority:** P0
**What goes wrong:** Requirements say start, cancel, query, tags, business keys, and pagination, but implementation only fires webhooks and assumes n8n will always return a useful execution ID.
**Warning signs:** `start()` returns raw webhook response; cancel is implemented without persisted execution IDs; query filters are documented before correlation strategy exists; no API scopes are listed; completed or missing executions are not specified.
**Why it happens:** Webhook triggering and n8n Public API execution management are different surfaces. Stopping or listing executions requires API access and, on scoped enterprise keys, the appropriate execution scopes.
**Consequences:** Cancel/query cannot be reliable; users cannot link CAP records to n8n executions; pagination and status displays are impossible to test honestly.
**Prevention:** Add an execution store abstraction with workflow ID, n8n execution ID when available, CAP entity key, business key/tag, status, timestamps, correlation ID, and source mode. Define best-effort behavior for webhook response modes that do not return execution IDs. Require API key scopes for `execution:read`, `execution:list`, and `execution:stop` when those features are enabled.
**Detection:** Tests should cover start without an execution ID, completed execution cancellation, missing execution, paginated execution list, and insufficient API permissions.
**Phase/planning implication:** Split lifecycle features into a phase after the execution store. Do not promise cancel/query in the same phase as first webhook triggering unless persistence and API permissions are in scope.

### Pitfall 6: Retrying Non-Idempotent Side Effects Without a Correlation Strategy

**Priority:** P0
**What goes wrong:** Retry logic resends webhook POSTs after timeouts or 502/503/504 responses, creating duplicate n8n workflow runs or duplicate CAP writes from the n8n node.
**Warning signs:** Default retry count exists but no correlation ID; tests assert retry count but not duplicate prevention; workflow payloads lack business keys; create/update/delete operations do not document idempotency.
**Why it happens:** HTTP retry policies are easy to add mechanically, but workflow starts and OData writes are side effects.
**Consequences:** Duplicate approvals, duplicate external notifications, inconsistent CAP data, and hard-to-debug supervisor demos.
**Prevention:** Include a stable correlation ID in every CAP-to-n8n payload and persist dispatch attempts. Retry only classified transient failures. Document that receiving workflows should deduplicate by correlation/business key where possible. For n8n-to-CAP create/update, support explicit keys or upsert-like workflow patterns instead of blindly retrying creates.
**Detection:** Tests should simulate timeout-after-remote-acceptance and verify the outbox/correlation behavior. Include duplicate webhook delivery in integration tests.
**Phase/planning implication:** Implement retries after transaction semantics and execution tracking, not before.

### Pitfall 7: Building the n8n Community Node Outside n8n Conventions

**Priority:** P0
**What goes wrong:** The node package is a generic JavaScript package rather than an n8n community node that n8n can discover, lint, build, install, and eventually verify.
**Warning signs:** Package name does not start with `n8n-nodes-` or `@scope/n8n-nodes-`; keyword `n8n-community-node-package` is absent; `package.json` lacks the `n8n` attribute listing nodes and credentials; code is CommonJS-only when n8n scaffolding expects TypeScript patterns; no `npm run lint`, `npm run dev`, or node linter.
**Why it happens:** The repo started as a monorepo prototype, but n8n community nodes are npm packages with specific metadata and developer tooling.
**Consequences:** The node cannot be installed through n8n, cannot pass community-node checks, and cannot be submitted for verification.
**Prevention:** Scaffold or align `cap-n8n-node` with the official `n8n-node`/`@n8n/create-node` structure. Keep package metadata, credentials, nodes, icons, build output, lint, and dev scripts consistent with n8n expectations.
**Detection:** CI must run the n8n node build, community node linter, local load/dev smoke test, and package tarball inspection.
**Phase/planning implication:** Treat n8n package scaffolding as an early foundation phase, before implementing OData operations.

## Moderate Pitfalls

### Pitfall 8: Publishing Without Current npm and n8n Verification Requirements

**Priority:** P1
**What goes wrong:** The roadmap leaves publishing until the end, then discovers package metadata, provenance, dependency, license, and engine constraints are incompatible with n8n verification or clean CAP consumption.
**Warning signs:** `n8n-node` package has placeholder metadata; CAP plugin lacks `peerDependencies` for `@sap/cds`; root and demo lockfiles disagree on license/peer metadata; docs say Node 18+ while current n8n npm docs require Node 20.19-24.x and the project context says Node 20+ for CAP; release is manual from a laptop.
**Why it happens:** Publishing feels operational, but package metadata drives installability and community-node discovery.
**Consequences:** Broken installs, hidden dependency assumptions, rejected n8n verification, and supervisor confusion about what is actually distributable.
**Prevention:** Add `engines`, `peerDependencies`, `files`, `license`, package entry points, and tarball checks early. For verified n8n community-node ambitions, plan GitHub Actions npm publishing with provenance; n8n docs state that verified submissions from May 1, 2026 require GitHub Actions provenance.
**Detection:** Run `npm pack --dry-run`, clean consumer install tests, n8n local install tests, and package metadata assertions.
**Phase/planning implication:** Add a packaging/readiness phase before feature-complete polish, not after.

### Pitfall 9: Assuming Global CAP Configuration Is the Right Plugin API

**Priority:** P1
**What goes wrong:** The plugin mutates `cds.env.requires` during bootstrap and relies on app-local configuration order instead of using CAP plugin package auto-configuration cleanly.
**Warning signs:** `cds-plugin.js` writes broad defaults at runtime; app settings are overwritten; tests fail depending on load order; no package-level `cds` schema/config contribution exists; production/mock behavior is inferred from missing values.
**Why it happens:** Direct mutation is quick in a demo, but CAP plugin packages can contribute configuration through package metadata and lifecycle hooks.
**Consequences:** Host apps cannot predict override behavior, profile switching is brittle, and plugin tests become order-dependent.
**Prevention:** Put defaults in package `cds` config where possible, preserve explicit app config, and centralize profile resolution in a small tested helper. Support `[development]`, `[hybrid]`, and `[production]` deliberately.
**Detection:** Tests should cover absent config, partial config, explicit app override, development mock activation, hybrid binding, and production startup failure.
**Phase/planning implication:** Configuration should be separated from service behavior in the roadmap so profile semantics are testable before broad feature work.

### Pitfall 10: Making Test Environments Depend on Manual UI State

**Priority:** P1
**What goes wrong:** Tests require Docker Compose, `n8nio/n8n:latest`, imported workflows, an active editor test listener, global `cds-dk`, and manual REST Client clicks.
**Warning signs:** CI has no passing `npm test`; README uses global `cds watch`; workflow import may deactivate workflows; tests do not pin n8n version; no mock service exists; `.n8n-data` state affects results.
**Why it happens:** Manual integration setup is useful for exploration but unreliable for regression testing.
**Consequences:** Flaky verification, stale local state, and failures that cannot be reproduced by the supervisor or CI.
**Prevention:** Add deterministic tiers: offline mock integration tests, local HTTP stub tests for CAP-to-n8n, n8n node tests against a local CAP test server, and a separately tagged Docker n8n integration suite. Pin Docker image versions for CI and isolate n8n data directories per run.
**Detection:** A fresh clone should pass the default test command without opening n8n UI. Docker tests should log versions and clean state.
**Phase/planning implication:** Build the mock and test harness before importing more workflow fixtures or implementing optional trigger nodes.

### Pitfall 11: Implementing OData Operations as String Concatenation

**Priority:** P1
**What goes wrong:** The n8n CAP node builds URLs and parses responses with ad hoc string logic, missing OData key syntax, composite keys, bound actions, functions, `$metadata`, pagination, and error shapes.
**Warning signs:** Entity names are free text only; composite keys are out of scope; `$filter` is blindly appended; `value` unwrapping strips too much; action/function invocation is documented but not metadata-driven; CAP OData errors are displayed as raw JSON.
**Why it happens:** Query/read/create/update/delete look like simple HTTP methods until CAP OData conventions and metadata discovery are included.
**Consequences:** Works only for Bookshop happy paths, fails on real CAP services, and gives n8n users poor error feedback.
**Prevention:** Parse `$metadata` for Entity Sets, keys, actions, and functions. Build OData paths with structured helpers. Return n8n items consistently and wrap external failures in `NodeApiError`, using `NodeOperationError` for validation/configuration mistakes.
**Detection:** Integration tests should cover composite keys, collection pagination, validation errors, bound/unbound actions, functions, empty collections, and OData metadata fields.
**Phase/planning implication:** Metadata discovery should precede operation breadth. Query/read can ship before mutations if metadata and error handling are solid.

### Pitfall 12: Weak Credential UX in the n8n Node

**Priority:** P1
**What goes wrong:** Credentials are implemented as plain node fields or environment variables rather than an n8n credential type with test behavior and encrypted storage.
**Warning signs:** Base URL, username, password, token URL, or client secret appear as regular node properties; no credential test request to `$metadata`; OAuth2 Client Credentials is hand-coded inconsistently; docs tell users to paste secrets into workflow JSON.
**Why it happens:** Plain fields are faster to prototype, but n8n credential files exist to define auth UI, injection behavior, encryption, and test requests.
**Consequences:** Workflows leak secrets, copied workflow JSON becomes unsafe, and users lose standard n8n credential sharing behavior.
**Prevention:** Implement a dedicated `SAP CAP API` credential type with Basic Auth and OAuth2 Client Credentials variants, a Base URL, and a Test button that calls `$metadata`. Use n8n helper APIs for authenticated HTTP requests.
**Detection:** Tests should inspect credential class metadata, validate test request behavior, and ensure node operations use credentials rather than manual secret fields.
**Phase/planning implication:** Credential type comes before CAP operation modes in the n8n node roadmap.

### Pitfall 13: Supervisor-Facing Docs Overstate Product Readiness

**Priority:** P1
**What goes wrong:** Requirements, README, mockups, and roadmap read as if the integration is complete or production-ready when key surfaces are still prototype-only.
**Warning signs:** "Integration tests" are named but no test runner exists; mockups imply implemented n8n fields; README installation says `npm install cap-n8n-plugin` without package publishing proof; local manual demo instructions dominate production guidance; unsupported lifecycle operations are not clearly labeled.
**Why it happens:** Supervisor-facing language tends to smooth over uncertainty, but this project needs honest gap tracking.
**Consequences:** Reviewers evaluate the wrong state, phases are planned in the wrong order, and the team inherits undocumented risk.
**Prevention:** Mark each documented feature as implemented, planned, or optional. Keep README focused on current demo; keep requirements focused on target behavior. Add a roadmap note that n8n is not SAP Build Process Automation and unsupported lifecycle operations such as suspend/resume must warn rather than simulate.
**Detection:** Documentation review should compare claims against code and tests before each phase closes.
**Phase/planning implication:** Add a docs alignment task to every phase, but avoid broad public docs until package surfaces and tests exist.

## Minor Pitfalls

### Pitfall 14: Committing Instance-Specific Workflow Exports

**Priority:** P2
**What goes wrong:** n8n export files contain owner, project, workflow IDs, webhook IDs, timestamps, or environment-specific data.
**Warning signs:** Workflow fixtures include `shared`, `project`, `createdBy`, real IDs, or machine-specific fields; exported fixtures churn on every local change.
**Prevention:** Normalize workflow fixtures through a sanitizer that keeps only deterministic structure needed for tests. Store separately named fixtures for test-mode and production-mode webhook cases.
**Phase/planning implication:** Add fixture sanitation before workflow import/generation phases.

### Pitfall 15: Logging Too Much Integration Detail

**Priority:** P2
**What goes wrong:** Logs expose API keys, Basic auth, OAuth tokens, CAP payloads, OData validation bodies, or n8n execution data.
**Warning signs:** Errors concatenate raw upstream response text; debug logs dump full request/response; test screenshots show credentials; production docs encourage verbose logs.
**Prevention:** Use structured errors with source, status, operation, correlation ID, and sanitized description. Gate raw bodies behind explicit debug flags and redact known secret fields.
**Phase/planning implication:** Error model and logging policy should be part of the first HTTP client/service phase.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Package foundations | Demo works but packages cannot be consumed | Add package entry-point, metadata, peer dependency, n8n package, and smoke-test tasks first |
| CAP service contract | JavaScript service exists without CDS model | Add typed CDS service/action model and contract integration tests before lifecycle features |
| Declarative annotations | `after` handler semantics accidentally roll back writes | Define blocking vs post-commit behavior and test n8n outage handling |
| Retry/timeouts | Duplicate workflow starts | Add correlation IDs, execution store, and retry classification first |
| Workflow import | Generates types from underspecified webhook payloads | Document workflow conventions and warn when schema cannot be derived |
| n8n node credentials | Secrets stored as node parameters | Implement credential type and `$metadata` test before operations |
| n8n node CRUD | String-built OData URLs fail outside demo | Build metadata/key/path helpers and cover composite keys/actions/functions |
| Testing | Docker/UI/manual state controls pass/fail | Make mock/stub tests default; isolate Docker n8n as an optional integration suite |
| Publishing | Verification blocked late | Add npm tarball, n8n linter, provenance, and clean install gates before release phase |
| Supervisor docs | Roadmap claims outrun implementation | Require docs-vs-code checklist at phase close |

## Roadmap Implications

1. **Foundation and Contracts** should come first: CAP plugin entry points, CDS service contract, n8n community-node scaffold, package metadata, engines, peer dependencies, and basic smoke tests.
2. **Security and Configuration** should follow immediately: profile resolution, production credential validation, secret redaction, `.env.example`, and sanitized fixtures.
3. **Transaction-Safe Triggering** should be isolated: programmatic blocking `start()` and declarative post-commit behavior need different tests and documentation.
4. **Execution Lifecycle** should wait for persistence: cancel/query, tags, business keys, and pagination need an execution store and n8n API permissions.
5. **n8n Node Operations** should start with credentials and metadata discovery, then query/read, then mutations/actions/functions.
6. **Publishing and Supervisor Docs** need continuous checks: every phase should update claims to match code and tests, but public readiness should wait for package and test gates.

## Sources

- CAP CDS plugin packages: https://cap.cloud.sap/docs/node.js/cds-plugins (HIGH)
- CAP events and request transaction hooks: https://cap.cloud.sap/docs/node.js/events (HIGH)
- CAP hybrid testing and `.cdsrc-private.json` binding behavior: https://cap.cloud.sap/docs/tools/cds-bind (HIGH)
- n8n building community nodes and publishing standards: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/ (HIGH)
- n8n `n8n-node` CLI, build, lint, dev, release workflow: https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/ (HIGH)
- n8n community node installation limits: https://docs.n8n.io/integrations/community-nodes/installation/ (HIGH)
- n8n Webhook node test vs production URL behavior and payload limits: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/ (HIGH)
- n8n Public API authentication and execution scopes: https://docs.n8n.io/api/authentication/ (HIGH)
- n8n API reference execution operations: https://docs.n8n.io/api/api-reference/ (HIGH)
- n8n credential files and credential test request pattern: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/ (HIGH)
- n8n node error handling with `NodeApiError` and `NodeOperationError`: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/ (HIGH)
- n8n execution model and data redaction: https://docs.n8n.io/workflows/executions/ (HIGH)
- Project context and local audits: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.planning/codebase/TESTING.md`, `.planning/codebase/INTEGRATIONS.md`, `cap_n8n_requirements_v2.md`, `N8N_REQUIREMENTS.md`, `README.md` (HIGH for repo state; MEDIUM for roadmap priority inference)
