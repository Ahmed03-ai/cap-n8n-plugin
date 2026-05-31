# Testing Patterns

**Analysis Date:** 2026-05-28

## Test Framework

**Runner:**
- Vitest 4.1.7 is declared in root `package.json` and invoked with `vitest run`.
- Config: No `vitest.config.*`, `jest.config.*`, `nyc.config.*`, or `c8.config.*` files are present; tests use default Vitest behavior.

**Assertion Library:**
- Vitest `expect` is used in smoke and integration tests.

**Run Commands:**
```bash
npm test                              # Runs root smoke workflow
npx vitest run test/integration       # Runs CAP plugin integration tests
npm start --workspace demo-app        # Starts the CAP demo app for manual verification
```

## Test File Organization

**Location:**
- Automated test files live under `test/smoke/` and `test/integration/`.
- Current integration coverage includes `test/integration/n8n-service-contract.test.js` and `test/integration/n8n-mock-and-profiles.test.js`.
- Manual request verification lives in `demo-app/test.http`.
- Shared n8n workflow fixtures live in `test-workflows/workflows.json`.

**Naming:**
- Automated test naming pattern: Not detected.
- Manual REST verification uses descriptive request comments in `demo-app/test.http`.
- Workflow fixture naming uses a plural JSON file: `test-workflows/workflows.json`.

**Structure:**
```text
cap-n8n-plugin/
  lib/N8nWorkflowService.js    # CAP plugin service implementation to cover with service/unit tests
cap-n8n-node/
  index.js                     # n8n node package entry point; no implementation tests present
demo-app/
  test.http                    # Manual CAP create request that triggers n8n
test-workflows/
  workflows.json               # Committed n8n workflow export used for local/manual integration setup
```

## Test Structure

**Suite Organization:**
```javascript
// Not detected in the current repo.
// Add package-local suites beside the package they verify until a shared pattern exists.
```

**Patterns:**
- Setup pattern: Manual setup is documented in `README.md`; start n8n with Docker Compose, import workflows with root npm scripts, start `demo-app`, then send `demo-app/test.http`.
- Teardown pattern: Not detected for automated tests.
- Assertion pattern: Manual verification relies on HTTP response inspection and n8n workflow observation; no automated assertions are present.
- CAP integration surface to test first: `cap-n8n-plugin/lib/N8nWorkflowService.js` because it owns configuration, webhook URL construction, authentication header behavior, fetch handling, response parsing, and error propagation.
- CAP demo trigger surface to test first: `demo-app/srv/admin-service.js` because it connects to `n8n` after `CREATE` and logs side-effect failures without failing the create request.

## Mocking

**Framework:** Not detected.

**Patterns:**
```javascript
// Not detected.
// The code uses global fetch directly in cap-n8n-plugin/lib/N8nWorkflowService.js,
// so automated tests need to stub global.fetch or wrap HTTP calls in an injectable helper.
```

**What to Mock:**
- Mock external n8n HTTP calls made by `fetch(url, ...)` in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Mock or stub `cds.connect.to('n8n')` when unit-testing `demo-app/srv/admin-service.js`.
- Use in-memory SQLite through `@cap-js/sqlite` from `demo-app/package.json` for CAP service integration tests.
- Use fixture workflow JSON from `test-workflows/workflows.json` when testing workflow import/export behavior.

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
- Implemented for package boundaries, CAP service start contract, mock runtime, profile/config behavior, and bootstrap runtime selection.
- Manual integration path: `demo-app/test.http` sends `POST http://localhost:3000/odata/v4/admin/Books`, which exercises `demo-app/srv/admin-service.js` and the configured n8n service in `demo-app/package.json`.
- Root scripts support n8n workflow import/export for integration setup: `npm run n8n:import` and `npm run n8n:export` in `package.json`.
- Requirements documents repeatedly call for integration coverage across CAP-to-n8n and n8n-to-CAP flows: `N8N_REQUIREMENTS.md`, `cap_n8n_requirements_v2.md`.

**E2E Tests:**
- Automated E2E framework: Not used.
- Manual E2E assets exist for local n8n plus CAP demo verification: `docker-compose.yml`, `test-workflows/workflows.json`, `demo-app/test.http`, `README.md`.

## Common Patterns

**Async Testing:**
```javascript
// No automated async test pattern exists.
// Service code to cover uses async/await throughout:
// await n8n.send('start', { workflowId, inputs }) in demo-app/srv/admin-service.js
// await fetch(url, { method: 'POST', headers, body }) in cap-n8n-plugin/lib/N8nWorkflowService.js
```

**Error Testing:**
```javascript
// No automated error test pattern exists.
// Cover these current error paths:
// req.error(404|400|409, ...) in demo-app/srv/cat-service.js
// throw new Error(`n8n responded with status ${response.status}: ${errorText}`) in cap-n8n-plugin/lib/N8nWorkflowService.js
// catch-and-log side-effect failure in demo-app/srv/admin-service.js
```

---

*Testing analysis: 2026-05-28*
