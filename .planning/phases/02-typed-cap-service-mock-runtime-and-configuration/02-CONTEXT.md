# Phase 2: Typed CAP Service, Mock Runtime, and Configuration - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 turns the package-owned CAP plugin runtime into a developer-usable n8n service contract. CAP developers must be able to connect with `cds.connect.to('n8n')`, call an ergonomic typed-ish `start` API, run offline through a deterministic mock runtime, switch between mock and real webhook implementations through CAP profiles, and receive reliable timeout, retry, and sanitized CDS error behavior.

This phase covers programmatic workflow start, mock/profile/runtime reliability, and integration-testable behavior. It does not implement durable execution storage, full cancel/query semantics, declarative CDS annotations, workflow import, build-time mapping validation, or n8n community-node metadata discovery; those remain later phases.

</domain>

<decisions>
## Implementation Decisions

### Start Contract And Workflow Identity

- **D-01:** In Phase 2, `workflowId` means an n8n webhook path, not a real n8n workflow ID or generated alias. Short names should normalize to `/webhook/{name}`, while explicit paths such as `webhook-test/...` remain possible for n8n canvas debugging.
- **D-02:** `start()` should return a structured result with optional `executionId`, not require every n8n webhook to return one. The result should include `accepted`, `workflowId`, optional `executionId`, optional `correlationId`, and a normalized `result` payload from the webhook response.
- **D-03:** The developer-facing API should include `await n8n.start(workflowId, inputs)`, while `n8n.send('start', { workflowId, inputs })` remains compatible underneath for CAP service semantics.
- **D-04:** Phase 2 should allow only light call metadata such as optional `correlationId` and `businessKey`. Durable tracking, duplicate detection, query, and cancel behavior stay in Phase 3.

### Mock Runtime Semantics

- **D-05:** The mock runtime should be a deterministic CAP test double for the plugin contract, not a fake n8n HTTP server.
- **D-06:** Phase 2 mock state should store start records only, using a future-compatible execution shape: generated mock execution ID, `workflowId`, `inputs`, timestamps, correlation/business key, and status. Phase 3 must expand this into full query/cancel semantics.
- **D-07:** Mock failures should be explicit opt-in only, for example configured by workflow ID or input. The default mock path should succeed deterministically for offline development and integration tests.
- **D-08:** Developers should be able to select the mock through profile/config, with a development fallback when real n8n settings are absent. Explicit local-real n8n must still be possible under a development profile.

### Profile And Credential Defaults

- **D-09:** Phase 2 should use standard CAP profile mechanics plus an explicit plugin config field such as `kind` or `mode`, rather than environment-specific service names.
- **D-10:** Prefer runtime-oriented config vocabulary, especially `kind: 'mock' | 'webhook'`, so the setting describes the implementation path rather than deployment environment.
- **D-11:** Missing real n8n configuration may fall back to mock in development only. Production or other non-development profiles must fail clearly unless `kind: 'mock'` is explicitly configured.
- **D-12:** Real webhook mode requires `baseUrl`. API key/auth remains optional unless configured, so local unauthenticated n8n webhook development stays usable without forcing secrets into development config.

### Retry, Timeout, And CDS Errors

- **D-13:** Real webhook mode should use a conservative retry policy by default: 3 attempts for transient network errors and HTTP `502`, `503`, and `504`; short exponential backoff; no retries for `400`, `401`, `403`, or `404`.
- **D-14:** The default `start()` timeout should be short, around 10 seconds, and globally configurable.
- **D-15:** Phase 2 should warn about retry ambiguity, pass/expose correlation metadata when provided, and leave durable duplicate detection to Phase 3.
- **D-16:** Failed `start()` calls should expose structured sanitized CDS errors with source system `n8n`, status code if available, retryable flag, plain message, and safe details. Stack traces, secrets, and sensitive payloads must not be exposed.

### Cross-Direction Data Contract

- **D-17:** Phase 2 runtime envelopes should stay schema-friendly so later phases can bridge CAP's stronger CDS/OData type system with n8n's dynamic item model. Avoid committing to arbitrary permanent blobs where a stable input/result/error envelope can preserve future typing.
- **D-18:** CAP-side CDS and OData metadata should remain the strongest source of truth where possible. Later workflow import/build validation and n8n-node metadata discovery should translate that metadata into generated CDS artifacts, validation hints, dropdowns, request shaping, and cleaned n8n item data.
- **D-19:** The full shared data-definition system is not Phase 2 scope. Phase 5 owns typed workflow import/build validation for CAP -> n8n, while Phases 6 and 7 own CAP metadata discovery and typed operation behavior for n8n -> CAP.

### the agent's Discretion

- **D-20:** Planner may choose exact helper names, module boundaries, and test file names, provided the work stays package-owned under `cap-n8n-plugin`, follows CommonJS/CAP conventions, and keeps integration-test language.
- **D-21:** Planner may choose whether the config field is named `kind` or `mode`, but `kind: 'mock' | 'webhook'` is preferred by the discussion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GSD Scope

- `.planning/ROADMAP.md` - Phase 2 goal, requirements, success criteria, and dependencies.
- `.planning/REQUIREMENTS.md` - `CAPAPI-01` through `CAPAPI-03`, `RUNTIME-01` through `RUNTIME-05`, and `VERIFY-01`.
- `.planning/PROJECT.md` - core value, constraints, brownfield context, and project-level decisions.
- `.planning/phases/01-package-foundations-and-tooling/01-CONTEXT.md` - package boundary decisions and Phase 1 exclusions that Phase 2 now builds on.

### Requirements Source

- `cap_n8n_requirements_v2.md` - Epic 1 user stories, especially US 1.1, US 1.4, US 1.5, US 1.6, and US 1.7.

### Codebase Map

- `.planning/codebase/STACK.md` - runtime, CAP, npm workspace, Docker, and testing context.
- `.planning/codebase/INTEGRATIONS.md` - current n8n webhook, CAP OData, credentials, and local n8n integration points.
- `.planning/codebase/ARCHITECTURE.md` - reusable CAP service adapter, package layer, data flow, and known anti-patterns.

### Local Source Files

- `cap-n8n-plugin/lib/N8nWorkflowService.js` - current minimal service adapter and primary Phase 2 implementation target.
- `cap-n8n-plugin/index.js` - public package entry that exports `N8nWorkflowService`.
- `cap-n8n-plugin/package.json` - package exports, peer dependency, engine, and package metadata.
- `cap-n8n-plugin/cds-plugin.js` - CAP plugin bootstrap and default service implementation registration.
- `demo-app/package.json` - demo CAP binding for `cds.requires.n8n`, currently using `cap-n8n-plugin/service`.
- `demo-app/srv/admin-service.js` - existing demo workflow trigger caller that should keep working while reusable behavior moves into the plugin.
- `test/smoke/package-boundaries.test.js` - Phase 1 smoke coverage that should remain passing.

### External n8n References

- `https://docs.n8n.io/workflows/executions/` - n8n execution concepts and execution lists.
- `https://docs.n8n.io/code/cookbook/builtin/execution/` - `$execution.id` availability inside n8n workflows.
- `https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/` - webhook response shaping context.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `cap-n8n-plugin/lib/N8nWorkflowService.js` already extends `cds.Service`, registers a `start` handler, normalizes webhook paths, sends JSON with `fetch`, and parses webhook responses.
- `cap-n8n-plugin/index.js` and `cap-n8n-plugin/package.json` now expose the service through package boundaries, including `cap-n8n-plugin/service`.
- `demo-app/package.json` already binds the demo app to the plugin service through CAP configuration, giving Phase 2 a concrete consumer to verify.
- `test/smoke/package-boundaries.test.js` provides a loadability baseline that new runtime tests should preserve.

### Established Patterns

- Runtime code uses JavaScript CommonJS, two-space indentation, single quotes, and mostly no semicolons in service files.
- CAP integration logs should use `cds.log('n8n')`.
- Reusable outbound transport belongs in `cap-n8n-plugin`; demo service handlers should consume it rather than own generic integration behavior.
- Secrets must stay in environment/CAP config. Planning and fixtures must not commit real credentials.

### Integration Points

- `cds.connect.to('n8n')` is the developer entry point.
- `this.on('start', ...)` in `N8nWorkflowService` is the CAP event compatibility path.
- The current real runtime path is n8n webhooks, not the broader n8n REST API.
- Mock and webhook implementations should be selectable without application code changes.

</code_context>

<specifics>
## Specific Ideas

- Keep `webhook-test/...` support because it is useful while debugging workflows in the n8n editor.
- Return a stable result envelope even when n8n sends an empty or non-JSON webhook response.
- Mock records should be shaped so Phase 3 can naturally add query/cancel behavior without replacing the mock contract.
- Use integration tests to cover package-level CAP service behavior, mock mode, real webhook transport with fake HTTP endpoints where appropriate, retry behavior, timeout behavior, auth header behavior, and sanitized error propagation.
- Treat the CAP/n8n type mismatch as a design constraint: CAP has stronger typing, while n8n is more dynamic. Phase 2 should keep data envelopes ready for later generated/metadata-driven validation in both directions.

</specifics>

<deferred>
## Deferred Ideas

- Full cancel/query APIs, execution store, duplicate detection, correlation persistence, and business-key lookup remain Phase 3.
- Declarative CAP annotations remain Phase 4.
- Workflow import, generated CDS typings, and build-time mapping validation remain Phase 5.
- n8n community-node metadata discovery, dropdowns, OData request shaping, response cleanup, actions/functions, and composite-key behavior remain Phases 6 and 7.
- Deployment documentation, `.env.example` completeness, SAP BTP guidance, and final review readiness remain Phase 8.

</deferred>

---

*Phase: 02-typed-cap-service-mock-runtime-and-configuration*
*Context gathered: 2026-05-31*
