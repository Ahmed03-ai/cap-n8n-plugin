# Testing Patterns

**Analysis Date:** 2026-06-03

**Last mapped commit:** fa456e23c97b9349257019c15ca7723aa8a3352d

## Test Framework

**Runner:**
- Vitest 4.1.7 is declared in root `package.json` and invoked with `vitest run`.
- Config: No `vitest.config.*`, `jest.config.*`, `nyc.config.*`, or `c8.config.*` files are present; tests use default Vitest behavior.

**Assertion Library:**
- Vitest `expect` is used in smoke and integration tests.

**Run Commands:**
```bash
npm run smoke                         # Builds n8n-nodes-sap-cap, then runs smoke tests
npm run test:integration              # Builds n8n-nodes-sap-cap, then runs all integration tests
npm test                              # Runs smoke plus integration tests
npm test --workspaces --if-present    # Runs package-level checks where scripts exist
npm start --workspace demo-app        # Starts the CAP demo app for manual verification
```

## Test File Organization

**Location:**
- Automated test files live under `test/smoke/` and `test/integration/`.
- Current integration coverage includes CAP service contracts, mock/profile behavior, webhook runtime behavior, execution tracking, query/cancel behavior, transaction-safe dispatch, annotation helper contracts, annotated CREATE/UPDATE/DELETE start behavior, and declarative annotation cancellation behavior.
- Workflow artifact coverage includes scalar sidecar normalization, sanitizer output, generated CDS compilation, manifest aliases, deterministic app-root writes, missing sidecar warnings, and path containment in `test/integration/n8n-workflow-artifacts.test.js`.
- Workflow build validation coverage includes shared validator diagnostics plus temp-app `cds build` success/failure behavior for typed required-input errors, type mismatches, extra-input warnings, unknown references, and untyped artifacts in `test/integration/n8n-workflow-build-validation.test.js`.
- n8n community-node coverage includes package-boundary build metadata, SAP CAP API credentials, `$metadata` entity/action/function discovery, Basic Auth, OAuth2 Client Credentials, Query, Read, Create, Update, Delete, Action/Function, composite keys, JSON Body/Parameters inputs, OData response cleanup, continue-on-fail, and sanitized errors in `test/integration/n8n-node-metadata-discovery.test.js`, `test/integration/n8n-node-read-operations.test.js`, `test/integration/n8n-node-response-cleanup.test.js`, and `test/smoke/package-boundaries.test.js`.
- Manual request verification lives in `demo-app/test.http`.
- Manual visual showcase guidance lives in `docs/manual-visual-showcase.md`.
- Shared n8n workflow fixtures live in `test-workflows/workflows.json`.

**Naming:**
- Automated integration tests use descriptive `n8n-*.test.js` filenames under `test/integration/`.
- Manual REST verification uses descriptive request comments in `demo-app/test.http`.
- Workflow fixture naming uses a plural JSON file: `test-workflows/workflows.json`.

**Structure:**
```text
cap-n8n-plugin/
  lib/N8nWorkflowService.js    # CAP plugin service implementation to cover with service/unit tests
cap-n8n-node/
  index.js                     # n8n node package registration metadata export
  nodes/SapCap/*.ts            # n8n SAP CAP node implementation covered through built dist imports and HTTP harness tests
  credentials/*.ts             # n8n SAP CAP credential definitions covered by smoke and metadata-discovery tests
demo-app/
  test.http                    # Manual CAP create request that triggers n8n
docs/
  manual-visual-showcase.md    # Manual presenter runbook and deterministic verification guide
test-workflows/
  workflows.json               # Committed n8n workflow export used for local/manual integration setup
```

## Test Structure

**Suite Organization:**
- `test/smoke/package-boundaries.test.js` verifies package exports, n8n package metadata, and generated build artifacts.
- `test/integration/n8n-service-contract.test.js`, `n8n-webhook-runtime.test.js`, `n8n-mock-and-profiles.test.js`, and related suites verify CAP plugin runtime behavior without requiring Docker n8n.
- `test/integration/n8n-workflow-*.test.js` verifies workflow artifact import, live-import clients, generated CDS, and build validation.
- `test/integration/n8n-node-*.test.js` builds/imports `cap-n8n-node/dist/**` helpers and exercises the n8n SAP CAP node through local HTTP harnesses.

**Patterns:**
- Setup pattern: Root test scripts build `n8n-nodes-sap-cap` first so smoke/integration tests can import generated `dist/` files. Many integration suites create temporary app roots or local HTTP servers instead of requiring a live n8n container.
- Teardown pattern: Integration tests close local HTTP servers and use temporary directories/app roots for isolated artifacts.
- Assertion pattern: Vitest assertions inspect CAP service results, outgoing HTTP requests, generated files, built n8n package metadata, OData response cleanup, and redacted error serialization.
- CAP integration surface to test first: `cap-n8n-plugin/lib/N8nWorkflowService.js` because it owns configuration, webhook URL construction, authentication header behavior, fetch handling, response parsing, and error propagation.
- CAP demo trigger surface to test first: `demo-app/srv/admin-service.js` because it connects to `n8n` after `CREATE` and logs side-effect failures without failing the create request.

## Mocking

**Framework:** Vitest plus local HTTP harnesses and controlled CAP/test app fixtures.

**Patterns:**
- Stub `global.fetch` or run local HTTP servers for CAP-to-n8n transport and workflow import clients.
- Import built n8n node helpers from `cap-n8n-node/dist/**` after running `npm run build --workspace n8n-nodes-sap-cap`.
- Exercise n8n node request behavior through fake `IExecuteFunctions`/load-options contexts and local HTTP servers rather than a live n8n editor.

**What to Mock:**
- Mock external n8n HTTP calls made by `fetch(url, ...)` in `cap-n8n-plugin/lib/N8nWorkflowService.js` or provide local HTTP endpoints for deterministic integration checks.
- Mock or stub `cds.connect.to('n8n')` when unit-testing `demo-app/srv/admin-service.js`.
- Use in-memory SQLite through `@cap-js/sqlite` from `demo-app/package.json` for CAP service integration tests.
- Use fixture workflow JSON from `test-workflows/workflows.json` when testing workflow import/export behavior.
- Use local HTTP harnesses for n8n node OData requests, `$metadata` loading, OAuth2 token exchange, and error redaction checks.

**What NOT to Mock:**
- Do not mock CAP request validation paths when testing `demo-app/srv/cat-service.js`; exercise `req.error(404|400|409, ...)` through CAP service calls so protocol behavior is covered.
- Do not mock URL normalization inside `_triggerWebhook()` in `cap-n8n-plugin/lib/N8nWorkflowService.js`; assert the outgoing URL for plain workflow names, `webhook/...`, and `webhook-test/...`.
- Do not mock CDS model loading for service-level integration tests; use the actual models in `demo-app/db/schema.cds`, `demo-app/srv/admin-service.cds`, and `demo-app/srv/cat-service.cds`.

## Fixtures and Factories

**Test Data:**
```json
{
  "ID": 1021,
  "IsActiveEntity": true,
  "title": "My Successful Trigger Book",
  "author_ID": 101,
  "genre_ID": "10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "price": 25.50,
  "stock": 100
}
```

**Location:**
- Manual create payload: `demo-app/test.http`.
- CAP seed data: `demo-app/db/data/sap.capire.bookshop-Books.csv`, `demo-app/db/data/sap.capire.bookshop-Authors.csv`, `demo-app/db/data/sap.capire.bookshop-Genres.csv`.
- Local n8n workflow fixture: `test-workflows/workflows.json`.
- Requirement-level test expectations: `N8N_REQUIREMENTS.md` and `cap_n8n_requirements_v2.md`.

## Coverage

**Requirements:** None enforced.

**View Coverage:**
```bash
# Not detected. No coverage tool or coverage script is configured.
```

## Test Types

**Unit Tests:**
- Not implemented.
- Highest-value unit scope: `_triggerWebhook()` behavior in `cap-n8n-plugin/lib/N8nWorkflowService.js`, including base URL trimming, webhook path prefixing, `X-N8N-API-KEY` header behavior, empty response handling, JSON response parsing, non-JSON response handling, and non-OK status errors.

**Integration Tests:**
- Implemented for package boundaries, CAP service start contract, mock runtime, profile/config behavior, bootstrap runtime selection, execution tracking, query/cancel behavior, transaction-safe dispatch, Phase 4 annotation helper contracts, Phase 5 workflow import/build validation, and Phase 7 n8n community-node behavior.
- `test/integration/n8n-annotation-contract.test.js` covers flattened annotation reconstruction, scalar validation, safe CXN conditions, and deterministic payload construction without requiring Docker n8n.
- `test/integration/n8n-annotations-start.test.js` covers package-owned annotation registration for CREATE, UPDATE, DELETE starts and non-rollback failed dispatch.
- `test/integration/n8n-annotations-cancel.test.js` covers declarative cancellation matching, default DELETE registration, explicit UPDATE registration, no-match warnings, cancel-all behavior, and non-rollback failures.
- `test/integration/n8n-workflow-artifacts.test.js` covers Phase 5 workflow artifact contracts without Docker n8n by using the committed workflow fixture, temporary app roots, and CAP compile assertions.
- `test/integration/n8n-workflow-build-validation.test.js` covers Phase 5 workflow build validation without Docker n8n by creating temporary CAP app roots, writing generated `n8n/` artifacts, calling the shared validator directly, and running CAP build through the package plugin activation path.
- `test/integration/n8n-node-metadata-discovery.test.js` covers SAP CAP API credential testing, metadata entity-set loading, Action/Function option loading, Basic Auth/OAuth2 behavior, and sanitized metadata/auth errors without a live n8n editor.
- `test/integration/n8n-node-read-operations.test.js` covers Query, Read, Create, Update, Delete, Action/Function, composite keys, JSON Body/Parameters, validation failures, OData request construction, and sanitized operation errors through local HTTP harnesses.
- `test/integration/n8n-node-response-cleanup.test.js` covers OData metadata stripping, Query collection normalization, non-collection response handling, continue-on-fail item shape, node operation error conversion, and redaction of sensitive request/response details.
- Manual integration path: `demo-app/test.http` sends `POST http://localhost:3000/odata/v4/admin/Books`, which exercises `demo-app/srv/admin-service.js` and the configured n8n service in `demo-app/package.json`.
- Root scripts support n8n workflow import/export for integration setup: `npm run n8n:import` and `npm run n8n:export` in `package.json`.
- Requirements documents repeatedly call for integration coverage across CAP-to-n8n and n8n-to-CAP flows: `N8N_REQUIREMENTS.md`, `cap_n8n_requirements_v2.md`.

**E2E Tests:**
- Automated E2E framework: Not used.
- Manual E2E assets exist for local n8n plus CAP demo verification: `docker-compose.yml`, `test-workflows/workflows.json`, `demo-app/test.http`, `README.md`, and `docs/manual-visual-showcase.md`.
- Real installed custom-node E2E in a live n8n editor/runtime is not covered by the default Docker Compose setup because it starts plain n8n without mounting or installing `cap-n8n-node`.

## Common Patterns

**Async Testing:**
- Integration suites use async/await around CAP service calls, local HTTP servers, fetch stubs, temporary file writes, dynamic imports of built n8n node helpers, and n8n node `execute()`/load-options helper calls.

**Error Testing:**
- CAP/plugin tests cover invalid workflow config, transport failures, non-rollback dispatch behavior, duplicate handling, cancellation warnings, workflow validation warnings/errors, and sanitized live-import diagnostics.
- n8n node tests cover invalid service paths, invalid key predicates, malformed JSON Body/Parameters, metadata response-shape failures, authentication errors, request failures, continue-on-fail behavior, and redaction of passwords, Authorization headers, cookies, bearer tokens, client secrets, response bodies, and stacks.

---

*Testing analysis: 2026-06-03*
