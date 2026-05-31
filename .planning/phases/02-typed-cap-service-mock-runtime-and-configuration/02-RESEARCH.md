# Phase 2: Typed CAP Service, Mock Runtime, and Configuration - Research

**Researched:** 2026-05-31
**Status:** Complete

## Research Question

What do we need to know to plan Phase 2 well: package-owned CAP service contract, mock/runtime selection, webhook response semantics, retry/timeout behavior, sanitized CDS errors, and integration-test coverage?

## Key Findings

### CAP Service Contract

- CAP custom service implementations can be explicit required-service implementations via `cds.requires.<service>.impl`, which matches the demo app's current `cds.requires.n8n.impl = "cap-n8n-plugin/service"` shape. Official CAP docs describe the `impl` config property for required services and service subclasses that register handlers in `init()`.
- CAP service subclasses can also expose method-style implementations for actions/functions. That supports a package-owned convenience method `n8n.start(workflowId, inputs, options)` while preserving the CAP event handler `this.on('start', ...)` and existing `n8n.send('start', ...)` compatibility.
- The current `N8nWorkflowService` already provides the right anchor: `cds.Service`, `init()`, `this.on('start', ...)`, webhook path normalization, optional API-key header, JSON POST, and response parsing. Phase 2 should refactor around this class rather than replace the package boundary.

### CAP Configuration And Profiles

- CAP loads effective configuration through `cds.env` from package/project config, `.env`/profile env files, process env, and service bindings. This supports standard CAP profile mechanics for mock/local/cloud/production without application code branching.
- CAP profile precedence includes production/profile flags, `NODE_ENV`, and `CDS_ENV`; CAP automatically enables the development profile when the profile is not production. Phase 2 can use this to allow development fallback to mock while failing in non-development profiles unless `kind: 'mock'` is explicit.
- `kind` is already a CAP-style configuration key in `cds.requires.*`. Using `cds.requires.n8n.kind = 'mock' | 'webhook'` is more CAP-native and future-proof than separate service names or a boolean `mock` flag.

### n8n Webhook Runtime Behavior

- n8n webhook responses are workflow-controlled. The Respond to Webhook node can return JSON, text, no data, redirects, files, status codes, and custom headers. Workflows can also finish without that node and still return a standard successful response.
- n8n exposes `$execution.id` inside workflow expressions/code, but CAP cannot assume a webhook response includes it. If CAP needs an execution ID, the workflow must return it explicitly. Phase 2 should therefore use a structured result envelope with optional `executionId`.
- n8n webhook credentials support no auth, basic auth, header auth, and JWT auth. The existing plugin's `X-N8N-API-KEY` header can remain as a configured header path, but Phase 2 should not require an API key for local webhook mode.

### Retry, Timeout, And Idempotency

- `fetch` in Node 20+ supports `AbortController`, making a package-local timeout wrapper feasible without adding a dependency.
- Retrying webhook starts is useful for transient network and `502/503/504` failures, but ambiguous because each retry may trigger a new workflow execution if the first request reached n8n but the response was lost. Phase 2 should surface this ambiguity through logs/result metadata and leave durable duplicate detection to Phase 3.
- A short default timeout around 10 seconds is appropriate for CAP request ergonomics. Longer workflow completion waits should be workflow-specific and globally configurable, not the default.

### Error Model

- Current errors are raw `Error` objects with n8n response text. Phase 2 should produce sanitized CAP-friendly errors that carry source system, status code when available, retryable flag, and safe detail fields.
- Avoid leaking stack traces, secrets, API keys, auth headers, or full request payloads in thrown messages or logs. Keep detailed diagnostics in safe fields only where they are scrubbed.

### Mock Runtime

- The mock should be a deterministic CAP service/test double, not an HTTP server. It can share a common result envelope with webhook mode and store in-memory start records for assertions.
- Mock records should include generated mock execution ID, workflow ID, inputs, timestamps, status, and optional correlation/business key. That shape is intentionally future-compatible with Phase 3 query/cancel work.
- Explicit opt-in mock failures give integration tests deterministic error coverage without random/timed behavior.

### Integration Testing Strategy

- Use Vitest because Phase 1 already added it and root `npm test` routes through the smoke command.
- Add integration tests under `test/integration/` or another package-level integration folder, not unit-test language. Tests should instantiate the service through CAP-compatible APIs where practical and use a local fake HTTP server for webhook transport behavior.
- Cover at minimum: package-level service connection/call shape, `n8n.start()` convenience method, `n8n.send('start', ...)` compatibility, mock fallback/explicit mock, webhook path normalization, auth header forwarding, structured result envelope, empty/text/JSON responses, non-retryable errors, transient retry success/failure, timeout abort, and sanitized error output.

## Recommended Plan Shape

1. **Contract and runtime factoring:** introduce stable result/error/config helpers and the `start(workflowId, inputs, options)` convenience API while preserving `send('start', ...)`.
2. **Mock/profile resolution:** add package-owned mock runtime and `kind: 'mock' | 'webhook'` resolution through CAP config/profile semantics.
3. **Webhook reliability:** add timeout, conservative retries, optional auth header handling, sanitized CDS errors, and retry ambiguity logging/metadata.
4. **Integration verification:** add focused integration tests plus root script wiring so `VERIFY-01` is satisfied without relying on live n8n.

## Validation Architecture

### Integration-Test Matrix

| Requirement | Verification Focus |
|-------------|--------------------|
| CAPAPI-01 | `cds.connect.to('n8n')` resolves the service implementation and exposes `start`. |
| CAPAPI-02 | `start(workflowId, inputs)` posts JSON to normalized webhook paths. |
| CAPAPI-03 | Success returns a structured result with optional `executionId` and normalized webhook result. |
| RUNTIME-01 | Mock mode works offline and records deterministic start entries. |
| RUNTIME-02 | CAP profile/config values switch between mock and webhook without app-code changes. |
| RUNTIME-03 | Non-development webhook mode without `baseUrl` fails startup/config validation clearly. |
| RUNTIME-04 | Communication failures throw sanitized structured CDS errors. |
| RUNTIME-05 | Transient failures and timeouts use configurable retry/timeout behavior. |
| VERIFY-01 | A repeatable npm command runs the integration tests above. |

### Test Harness Notes

- Prefer a local Node HTTP server in tests over Docker n8n for retry/error determinism.
- Use real package imports and CAP configuration objects where possible, so tests exercise the package boundary from Phase 1.
- Keep test fixtures free of real URLs, API keys, private keys, or production credentials.

## Risks And Constraints

- **Execution ID mismatch:** n8n has execution IDs, but webhook clients only see them if the workflow returns them. The structured result must allow absent `executionId`.
- **Duplicate starts:** Retry may duplicate workflow execution. Phase 2 can warn and pass correlation data; Phase 3 owns durable detection.
- **Profile ambiguity:** Development fallback to mock must not mask production misconfiguration. Non-development profiles should fail unless explicitly mock.
- **Scope guard:** Do not implement query/cancel/execution store, declarative annotations, workflow import, build validation, or n8n-node OData metadata behavior in Phase 2.

## Sources

- `.planning/phases/02-typed-cap-service-mock-runtime-and-configuration/02-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/STACK.md`
- `cap_n8n_requirements_v2.md`
- `cap-n8n-plugin/lib/N8nWorkflowService.js`
- `cap-n8n-plugin/package.json`
- `demo-app/package.json`
- SAP CAP custom actions/functions: https://cap.cloud.sap/docs/guides/services/custom-actions
- SAP CAP core services: https://cap.cloud.sap/docs/node.js/core-services
- SAP CAP project configuration and profiles: https://cap.cloud.sap/docs/node.js/cds-env
- n8n Respond to Webhook: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/
- n8n webhook credentials: https://docs.n8n.io/integrations/builtin/credentials/webhook/
- n8n execution built-in data: https://docs.n8n.io/code/cookbook/builtin/execution/

## RESEARCH COMPLETE

Phase 2 can be planned as package-owned CAP runtime work with deterministic integration tests and no live n8n dependency.
