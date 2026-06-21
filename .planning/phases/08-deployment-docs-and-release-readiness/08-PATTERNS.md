# Phase 8: Deployment, Docs, and Release Readiness - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 11 planned new/modified files
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` | config | batch | `package.json` | exact |
| `docker-compose.n8n-node.yml` | config | request-response, event-driven | `docker-compose.yml` | role-match |
| `.env.example` | config | request-response | `README.md`, `demo-app/package.json`, `cap-n8n-plugin/lib/config.js` | partial |
| `README.md` | docs | request-response | `README.md` | exact |
| `docs/manual-visual-showcase.md` | docs | manual E2E | `docs/manual-visual-showcase.md` | exact |
| `docs/local-n8n-custom-node-e2e.md` | docs | manual E2E | `README.md`, `docs/manual-visual-showcase.md` | role-match |
| `docs/btp-deployment-guide.md` | docs | config guidance | `README.md` runtime config section | partial |
| `docs/release-readiness.md` | docs | traceability, batch evidence | `docs/manual-visual-showcase.md` reviewer checklist | role-match |
| `test-workflows/cancellation-workflows.json` | fixture | event-driven | `test-workflows/workflows.json`, `test/integration/n8n-workflow-artifacts.test.js` | role-match |
| `test/smoke/release-readiness.test.js` | test | batch | `test/smoke/package-boundaries.test.js` | role-match |
| `test/integration/n8n-release-readiness.test.js` | test | batch, request-response | `test/integration/n8n-workflow-phase5.test.js`, `test/integration/n8n-workflow-live-import.test.js` | role-match |

## Pattern Assignments

### `package.json` (config, batch)

**Analog:** `package.json`

**Script naming and aggregation pattern** (lines 10-22):
```json
"scripts": {
  "build": "npm run build --workspaces --if-present",
  "cap:serve": "npm run start --workspace demo-app",
  "cap:compile": "cds compile demo-app/db demo-app/srv demo-app/app --to csn",
  "smoke": "npm run build --workspace n8n-nodes-sap-cap && vitest run test/smoke",
  "test:integration": "npm run build --workspace n8n-nodes-sap-cap && vitest run test/integration",
  "test": "npm run smoke && npm run test:integration",
  "n8n:up": "docker compose up -d n8n",
  "n8n:export": "docker compose exec n8n n8n export:workflow --all --output=/test-workflows/workflows.json",
  "n8n:import": "docker compose exec n8n n8n import:workflow --input=/test-workflows/workflows.json"
}
```

**Planner recommendation:**
- Add the local review/release command at root, not inside a workspace. Use existing colon names, e.g. `review:local` or `release:check`.
- The command must aggregate only deterministic checks: `npm run build`, `npm run cap:compile`, `npm test`, `npm test --workspaces --if-present`, and `npm run n8n:workflow:validate -- --app demo-app`.
- Do not include `docker compose`, live n8n browser login, manual credentials, or custom-node UI checks in the local release command.

**Script assertion pattern** (from `test/integration/n8n-workflow-phase5.test.js` lines 496-502):
```js
it('keeps npm test wired through the integration suite that includes Phase 5 tests', () => {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))

  expect(packageJson.scripts.test).toContain('npm run test:integration')
  expect(packageJson.scripts['test:integration']).toContain('npm run build --workspace n8n-nodes-sap-cap')
  expect(packageJson.scripts['test:integration']).toContain('vitest run test/integration')
  expect(packageJson.scripts['n8n:workflow:validate']).toContain('cap-n8n.js validate')
})
```

Apply this style to assert the new local review/release command exists and excludes Docker/browser-only steps.

---

### `docker-compose.n8n-node.yml` (config, request-response/event-driven)

**Analog:** `docker-compose.yml`

**Base Compose shape** (lines 1-17):
```yaml
services:
  n8n:
    image: n8nio/n8n:2.22.5
    container_name: n8n_local
    ports:
      - "5678:5678"
    volumes:
      - ./.n8n-data:/home/node/.n8n
      - ./test-workflows:/test-workflows
    environment:
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=production
      - WEBHOOK_URL=http://localhost:5678/
      - N8N_USER_MANAGEMENT_DISABLED=true
```

**n8n package metadata that the override/helper must load** (from `cap-n8n-node/package.json` lines 7-39):
```json
"scripts": {
  "build": "n8n-node build",
  "lint": "n8n-node lint",
  "dev": "n8n-node dev",
  "test": "npm run lint && npm run build"
},
"engines": {
  "node": ">=22.16 <25"
},
"files": [
  "dist",
  "index.js"
],
"n8n": {
  "n8nNodesApiVersion": 1,
  "nodes": [
    "dist/nodes/SapCap/SapCap.node.js"
  ],
  "credentials": [
    "dist/credentials/SapCapApi.credentials.js"
  ]
}
```

**Planner recommendation:**
- Add a separate override such as `docker-compose.n8n-node.yml`; keep default `docker-compose.yml` as plain local n8n unless a plan explicitly chooses otherwise.
- Add root scripts like `n8n:up:custom-node` using `docker compose -f docker-compose.yml -f docker-compose.n8n-node.yml up -d n8n`.
- The override/helper must build or mount the local `n8n-nodes-sap-cap` package so live n8n sees the manifest `dist/nodes/SapCap/SapCap.node.js` and `dist/credentials/SapCapApi.credentials.js`.
- Do not commit generated install output, `.n8n-data/`, n8n login values, or credential exports.

**Manual caveat to preserve** (from `docs/manual-visual-showcase.md` lines 565-567):
```text
But do not run a live n8n UI demo of the SAP CAP node from the default Docker setup unless you have separately installed or mounted the local community node into n8n. The repository's `docker-compose.yml` currently starts plain n8n with workflow fixtures; it does not install `cap-n8n-node` into that container.

Do not present the default Docker container as real installed custom-node E2E evidence.
```

---

### `.env.example` (config, request-response)

**Analogs:** `README.md`, `demo-app/package.json`, `cap-n8n-plugin/lib/config.js`, `.gitignore`

**CAP/n8n config placeholder pattern** (from `README.md` lines 434-445):
```json
{
  "kind": "webhook",
  "impl": "cap-n8n-plugin/service",
  "credentials": {
    "baseUrl": "http://localhost:5678",
    "apiKey": "{env.N8N_API_KEY}"
  },
  "timeoutMs": 10000,
  "retries": 3,
  "retryDelayMs": 250
}
```

**Demo package uses environment interpolation** (from `demo-app/package.json` lines 18-25):
```json
"requires": {
  "n8n": {
    "impl": "cap-n8n-plugin/service",
    "kind": "webhook",
    "credentials": {
      "baseUrl": "http://localhost:5678",
      "apiKey": "{env.N8N_API_KEY}"
    }
  }
}
```

**Cancellation config keys to document as placeholders** (from `cap-n8n-plugin/lib/config.js` lines 151-211):
```js
const cancelOptions = options.cancel || options.cancellation || options.stop || {}
const cancelCredentials = credentials.cancel || credentials.cancellation || credentials.stop || {}
const baseUrl = firstConfiguredValue(credentials.baseUrl, options.baseUrl)
const apiKey = firstConfiguredValue(credentials.apiKey, options.apiKey)
const cancelSupported = normalizeBoolean(firstConfiguredValue(
  cancelOptions.supported,
  cancelOptions.enabled,
  cancelCredentials.supported,
  cancelCredentials.enabled,
  false
), false)
const cancelApiBaseUrl = firstConfiguredValue(
  cancelOptions.apiBaseUrl,
  cancelCredentials.apiBaseUrl,
  cancelOptions.baseUrl,
  cancelCredentials.baseUrl,
  options.apiBaseUrl,
  credentials.apiBaseUrl,
  cancelSupported ? baseUrl : undefined
)
```

**Ignore pattern** (from `.gitignore` lines 3 and 6):
```gitignore
.env
.n8n-data/
```

**Planner recommendation:**
- Create root `.env.example`, not a real `.env`.
- Group placeholders by run path: CAP demo, local n8n, real custom-node E2E, cancellation stop API, and BTP/cloud advisory placeholders.
- Use empty or placeholder values only, e.g. `N8N_API_KEY=`, `N8N_CANCEL_SUPPORTED=false`, `N8N_CANCEL_API_BASE_URL=http://localhost:5678`, `N8N_REVIEW_EMAIL=<local-review-email>`.
- Do not include n8n login passwords, encoded Basic Auth headers, OAuth client secrets, API keys, private keys, or production tenant metadata.

---

### `README.md` (docs, request-response)

**Analog:** `README.md`

**Command entry point pattern** (lines 23-52):
````markdown
## Important Commands

Run these from the repository root unless noted otherwise.

```bash
npm run build
npm run cap:compile
npm run smoke
npm run test:integration
npm test
npm test --workspaces --if-present
npm run n8n:workflow:import -- --app demo-app --from test-workflows/workflows.json --workflow cap-test-trigger --schema demo-app/n8n/workflows/cap-test-trigger/schema.json
npm run n8n:workflow:validate -- --app demo-app
npm run n8n:up
npm run n8n:import
npm run n8n:export
```
````

**Focused-doc link pattern** (lines 54-56):
```markdown
## Manual Testing

For a presenter-oriented walkthrough, see [Manual Visual Showcase Guide](docs/manual-visual-showcase.md).
```

**Documentation maintenance contract** (lines 502-511):
```markdown
README.md must stay current with important developer instructions. Update it in the same change whenever you add or change:

- root npm scripts or workspace commands
- CAP/n8n configuration fields
- required environment variables
- manual setup steps
- manual or automated verification commands
- local n8n workflow import/export behavior
```

**Planner recommendation:**
- Keep README as the entry point. Link focused docs rather than embedding every Phase 8 runbook.
- Add links for local custom-node E2E, cancellation showcase, BTP/cloud guidance, and release-readiness evidence.
- Add the new local review/release command to Important Commands with a one-line explanation.
- Keep browser/manual evidence explicitly separate from automated command evidence.

---

### `docs/manual-visual-showcase.md` (docs, manual E2E)

**Analog:** `docs/manual-visual-showcase.md`

**Current limitations that Phase 8 must update honestly** (lines 30-42):
```markdown
- Declarative cancellation is implemented, but there is no no-harness visual demo that seeds a long-running/stoppable n8n execution and shows cancellation in the n8n UI.
- The SAP CAP n8n community node is not installed or mounted into the default Docker n8n container. Do not claim that the SAP CAP node appears automatically in the Docker n8n UI.
- Real installed n8n custom-node E2E in a live n8n editor/runtime remains Phase 8 release-readiness evidence.
- Live workflow import requires a reachable n8n API and credentials from CAP config/environment. Do not pass or display literal API keys.
```

**Manual setup style** (lines 86-113):
````markdown
## Step 1: Start Local n8n And Import The Demo Workflow

In Terminal 2:

```bash
npm run n8n:up
npm run n8n:import
```

Open n8n:

```text
http://localhost:5678
```

Find the workflow named:

```text
CAP n8n Test
```
````

**Cancellation evidence style** (lines 421-449):
```markdown
## Step 8: Explain Cancellation Without Overclaiming The Visual Demo

Declarative cancellation is implemented:

- `@n8n.workflow.cancel` exists on `AdminService.Books`.
- It runs on `DELETE`.
- It matches executions by `workflowId`, `businessKey`, and `tag`.
- It cancels all eligible queued/running/cancel-requested matches through the Phase 3 query/cancel APIs.
- It logs no-match and failure cases without rolling back the CAP delete.
```

**Planner recommendation:**
- Convert the cancellation section from "not yet visual" to a browser-first runbook only after the stoppable workflow fixture and stop API config are in place.
- Preserve the style: terminal number, command, browser URL, visible expected result, presenter wording, and cleanup/troubleshooting notes.
- Do not store screenshots or secrets by default; capture manual evidence as checklist items in `docs/release-readiness.md`.

---

### `docs/local-n8n-custom-node-e2e.md` (docs, manual E2E)

**Analogs:** `README.md`, `docs/manual-visual-showcase.md`

**Current n8n -> CAP manual coverage to expand** (from `docs/manual-visual-showcase.md` lines 493-523):
````markdown
The n8n node package is buildable and has deterministic Phase 7 verification:

```bash
npm run build --workspace n8n-nodes-sap-cap
npx vitest run test/integration/n8n-node-read-operations.test.js test/integration/n8n-node-metadata-discovery.test.js test/integration/n8n-node-response-cleanup.test.js test/smoke/package-boundaries.test.js
npm test
```

Current implemented code includes:

- SAP CAP API credential fields with Basic Auth and OAuth2 Client Credentials.
- `$metadata` Test Connection with OData metadata validation.
- Dynamic entity-set discovery from CAP `$metadata`.
- Query mode.
- Read mode.
- Create mode with one explicit Body (JSON) field.
- Update mode with one explicit Body (JSON) field and metadata/manual key input.
- Delete mode with metadata/manual key input, no request body, and no extra confirmation checkbox.
- Composite-key handling through metadata-derived Key Parts JSON plus Manual Key Predicate fallback.
- Combined Action/Function mode with metadata-backed operation choices, manual fallback, bound key input, and one explicit Parameters (JSON) field.
- Plain n8n item output with OData metadata stripped.
- Sanitized n8n-native errors for authentication, authorization, validation, not-found, server, network, configuration, and response-shape failures.
````

**Visible live-node checklist pattern** (from `docs/manual-visual-showcase.md` lines 525-556):
```markdown
If the local community node has been separately installed or mounted into live n8n, open an SAP CAP node and check that the operation selector visibly offers:

- Query
- Read
- Create
- Update
- Delete
- Action/Function

Presenter checks for the visible node controls:

- Create shows a single Body (JSON) field.
- Update shows key input plus a single Body (JSON) field.
- Delete shows key input only. It sends no body, has no confirmation checkbox, returns one success confirmation, and reports not-found as a concise n8n-native error by default.
- Action/Function shows metadata/manual operation selection and one Parameters (JSON) field.
```

**Planner recommendation:**
- This doc should be the exact real installed custom-node E2E runbook.
- Include commands for build, Docker override/helper startup, CAP startup, n8n URL, credential setup, Test Connection, metadata dropdowns, Query/Read/Create/Update/Delete/Action/Function execution, cleanup, and troubleshooting.
- Use `http://host.docker.internal:3000` for n8n container to CAP host access when documenting local Docker credentials.
- Treat n8n login values as operator-entered runtime values only. Do not put them in `.env.example`, docs examples, fixtures, or tests.

---

### `docs/btp-deployment-guide.md` (docs, config guidance)

**Analog:** `README.md` runtime config section

**Runtime config shape to map to BTP guidance** (from `README.md` lines 430-452):
```json
{
  "kind": "webhook",
  "impl": "cap-n8n-plugin/service",
  "credentials": {
    "baseUrl": "http://localhost:5678",
    "apiKey": "{env.N8N_API_KEY}"
  },
  "timeoutMs": 10000,
  "retries": 3,
  "retryDelayMs": 250
}
```

**Planner recommendation:**
- Keep BTP guidance advisory. Do not add `mta.yaml`, Cloud Foundry manifests, Helm charts, Kyma deployment files, or production Dockerfiles in Phase 8 unless a later plan explicitly justifies them.
- Cover Cloud Foundry and Kyma considerations: routing, auth, destinations/connectivity, secret storage, webhook reachability, stop API reachability, and operational caveats.
- Use placeholders only. Map config names (`baseUrl`, `apiKey`, `cancel.supported`, `cancel.apiBaseUrl`, timeout/retry fields) to service bindings or secret stores without claiming validated deployment.

---

### `docs/release-readiness.md` (docs, traceability/batch evidence)

**Analog:** `docs/manual-visual-showcase.md`

**Reviewer checklist pattern** (lines 643-659):
```markdown
## Reviewer Checklist

The presenter can claim:

- CAP-to-n8n workflow starts are package-owned and annotation-driven.
- Demo Book `CREATE` and `UPDATE` can be shown visually in n8n.
- Execution tracking/query/cancel infrastructure is implemented and integration-tested.
- Declarative cancellation is implemented and integration-tested.
- Workflow import writes deterministic sanitized app-root artifacts.
- Phase 6 and Phase 7 integration tests cover SAP CAP credentials, OAuth2 Client Credentials, metadata discovery, Query, Read, Create, Update, Delete, Action/Function, composite keys, OData response cleanup, and sanitized n8n errors.
- Real installed custom-node E2E in live n8n remains separate Phase 8 evidence unless the local community node has been mounted or installed for the demo.
```

**Warning/evidence classification test pattern** (from `test/integration/n8n-workflow-phase5.test.js` lines 437-462):
```js
it('passes warning-only fixtures and fails typed error fixtures with sanitized diagnostics', async () => {
  const warning = await runCli(['validate', '--app', warningApp])
  const error = await runCli(['validate', '--app', errorApp])

  expect(warning.exitCode).toBe(0)
  expect(warning.stdout).toContain('severity=warning')
  expect(error.exitCode).toBe(1)
  expect(output(error)).toContain('severity=error')
  expectSafeOutput(warning)
  expectSafeOutput(error)
})
```

**Planner recommendation:**
- Use explicit evidence states: `automated verified`, `browser/manual verified`, and `manual UAT required`.
- Map Phase 8 decisions, `.planning/REQUIREMENTS.md` DOCS/VERIFY items, and relevant GitHub issues to files, commands, fixtures, and manual checklist evidence.
- Include accepted warnings with rationale. Do not claim issue closure when manual UAT is still required.

---

### `test-workflows/cancellation-workflows.json` (fixture, event-driven)

**Analogs:** `test-workflows/workflows.json`, `test/integration/n8n-workflow-artifacts.test.js`

**Existing fixture location and import/export commands** (from `README.md` lines 484-500):
````markdown
Shared local workflow fixtures live in `test-workflows/`.

Import fixtures after pulling from Git:

```bash
npm run n8n:import
```

Export local workflow changes:

```bash
npm run n8n:export
```

Commit updated files under `test-workflows/` when workflow fixtures change. Do not commit `.n8n-data/` or secrets.
````

**Sanitized reviewable workflow shape** (from `test/integration/n8n-workflow-artifacts.test.js` lines 237-260):
```js
expect(workflow).toEqual({
  name: 'CAP n8n Test',
  nodes: [
    expect.objectContaining({
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      parameters: {
        httpMethod: 'POST',
        path: 'cap-test-trigger',
        options: {}
      }
    })
  ],
  connections: {},
  settings: {
    executionOrder: 'v1'
  }
})
```

**Path containment guard for workflow keys** (from `test/integration/n8n-workflow-artifacts.test.js` lines 397-405):
```js
await expect(writeWorkflowArtifacts({
  appRoot,
  workflows: [{
    workflow: fixtureWorkflow(),
    workflowKey: '../escape',
    sourceType: 'local',
    schema: capTestSchema
  }]
})).rejects.toThrow(/workflow key/i)
```

**Planner recommendation:**
- Add a dedicated fixture under `test-workflows/`, e.g. `test-workflows/cancellation-workflows.json`, rather than modifying `test-workflows/workflows.json`.
- The fixture should be a sanitized n8n export array containing a stoppable workflow named clearly, e.g. `CAP n8n Cancellation Test`, with stable webhook path such as `cap-cancel-stoppable`.
- Avoid owner/project/shared metadata, credentials, pinned data, static data, request/response bodies, stack traces, API keys, and local user metadata.
- Add a dedicated import script if needed, e.g. `n8n:import:cancellation`, instead of changing the happy-path `n8n:import` behavior without documenting it.

---

### `test/smoke/release-readiness.test.js` (test, batch)

**Analog:** `test/smoke/package-boundaries.test.js`

**Smoke import/assertion style** (lines 46-74):
```js
describe('package boundaries', () => {
  it('loads the CAP plugin through its package name', () => {
    const plugin = require('cap-n8n-plugin')
    const service = require('cap-n8n-plugin/service')
    const mockService = require('cap-n8n-plugin/mock-service')

    expect(plugin).toHaveProperty('N8nWorkflowService')
    expect(plugin.N8nWorkflowService).toBe(service)
    expect(plugin.MockN8nWorkflowService).toBe(mockService)
  })

  it('loads every n8n manifest-referenced node and credential module after build', async () => {
    const packageJson = readJson(resolve(n8nPackageDir, 'package.json'))
    const nodeManifestPaths = packageJson.n8n?.nodes ?? []
    const credentialManifestPaths = packageJson.n8n?.credentials ?? []

    expect(nodeManifestPaths.length).toBeGreaterThan(0)
    expect(credentialManifestPaths.length).toBeGreaterThan(0)
  })
})
```

**n8n node surface assertion style** (lines 88-126 and 130-162):
```js
expect(node.methods.loadOptions.getEntitySets).toEqual(expect.any(Function))
expect(node.methods.loadOptions.getActionFunctions).toEqual(expect.any(Function))
expect(node.methods.credentialTest.sapCapApiCredentialTest).toEqual(expect.any(Function))
expect(operationValues).toEqual([
  'query',
  'read',
  'create',
  'update',
  'delete',
  'actionFunction',
])
```

**Planner recommendation:**
- Use smoke tests for fast static checks: new root script exists, README links new docs, `.env.example` exists and has placeholders, Docker override file exists, cancellation fixture file exists.
- Do not start Docker or require browser state from smoke tests.

---

### `test/integration/n8n-release-readiness.test.js` (test, batch/request-response)

**Analogs:** `test/integration/n8n-workflow-phase5.test.js`, `test/integration/n8n-workflow-live-import.test.js`, `test/integration/n8n-node-*.test.js`

**CLI execution harness pattern** (from `test/integration/n8n-workflow-live-import.test.js` lines 149-172):
```js
async function runCli(args, options = {}) {
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ...(options.env || {})
      }
    })

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr
    }
  } catch (error) {
    return {
      exitCode: error.code ?? 1,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    }
  }
}
```

**Local HTTP server pattern for deterministic request-response tests** (from `test/integration/n8n-node-metadata-discovery.test.js` lines 139-175):
```js
const requests = []
const sockets = new Set()
const server = createServer(async (req, res) => {
  let body = ''

  req.setEncoding('utf8')
  for await (const chunk of req) body += chunk

  const request = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body,
  }

  requests.push(request)
  const response = await respond(request, requests.length)
  res.statusCode = response.statusCode ?? 200
  res.setHeader('content-type', response.contentType ?? 'application/xml')
  res.end(response.body ?? metadataWithEntitySets)
})
```

**Teardown pattern** (from `test/integration/n8n-node-metadata-discovery.test.js` lines 264-267):
```js
afterEach(async () => {
  const pending = servers
  servers = []
  await Promise.all(pending.map((server) => server.close()))
})
```

**Phase 7 operation coverage pattern** (from `test/integration/n8n-node-read-operations.test.js` lines 934-1012):
```js
const result = await executeSapCap([
  defaultParameters({
    operation: 'create',
    body: JSON.stringify({ title: 'Phase 7 Created Book' }),
  }),
  defaultParameters({
    operation: 'update',
    keyPredicate: 'ID=201',
    body: JSON.stringify({ price: 24.99 }),
  }),
  defaultParameters({
    operation: 'delete',
    keyPredicate: 'ID=202',
  }),
], {
  credentials: basicCredentials(server.baseUrl),
})

expect(server.requests[0]).toMatchObject({ method: 'POST', url: '/odata/v4/admin/Books' })
expect(server.requests[1]).toMatchObject({ method: 'PATCH', url: '/odata/v4/admin/Books(ID=201)' })
expect(server.requests[2]).toMatchObject({ method: 'DELETE', url: '/odata/v4/admin/Books(ID=202)', body: '' })
expect(server.requests[2].headers['content-type']).toBeUndefined()
```

**Planner recommendation:**
- Use integration tests for deterministic file/script/doc/fixture validation and local HTTP harness checks.
- Do not automate real n8n browser login or live editor state in integration tests unless a later plan explicitly scopes stable browser automation.
- Add tests that fail on secrets in `.env.example`, docs, workflow fixtures, and command output.

## Shared Patterns

### Automated vs Manual Evidence

**Source:** `docs/manual-visual-showcase.md` lines 643-667

Apply to `README.md`, `docs/manual-visual-showcase.md`, `docs/local-n8n-custom-node-e2e.md`, and `docs/release-readiness.md`.

```markdown
The presenter can claim:
- ... integration-tested.
- ... can be shown visually in n8n.
- Real installed custom-node E2E in live n8n remains separate Phase 8 evidence unless the local community node has been mounted or installed for the demo.

The presenter should not claim yet:
- The SAP CAP n8n node is automatically installed in local Docker n8n.
- The default Docker n8n container proves real installed SAP CAP custom-node E2E.
- Declarative cancellation has a polished no-harness visual UI walkthrough.
```

Phase 8 should replace "not yet" items only when the repo-owned harness and manual checklist evidence exist.

### Secrets and Placeholder Policy

**Sources:** `.gitignore` lines 3 and 6; `test/integration/n8n-workflow-phase5.test.js` lines 466-493; `test/integration/n8n-workflow-live-import.test.js` lines 307-337 and 346-381.

```js
expect(source, `${file} must not contain literal sample secrets`).not.toMatch(/ghp_|gho_|github_pat_|sk-[A-Za-z0-9]|BEGIN .*PRIVATE KEY|N8N_API_KEY=.*[A-Za-z0-9]/)
expect(source, `${file} must not ingest .env files`).not.toMatch(/dotenv|readFile(?:Sync)?\([^)]*\.env|\.env\.local/i)
expect(help.stdout).not.toContain('--api-key')
expect(help.stdout).not.toContain('--apikey')
```

Apply to `.env.example`, docs, workflow fixtures, Docker override/helper scripts, release command output, and tests.

### Cancellation Stop Path

**Source:** `cap-n8n-plugin/lib/N8nWorkflowService.js` lines 326-363

```js
if (!execution.n8nExecutionId) {
  return 'n8n webhook cancellation is unsupported because no n8nExecutionId is stored for this execution.'
}

return 'n8n webhook cancellation is unsupported because the n8n stop API is not enabled in configuration.'

async _stopN8nExecution(execution) {
  const safeBaseUrl = this.cancelConfig.apiBaseUrl.replace(/\/$/, '')
  const url = `${safeBaseUrl}/api/v1/executions/${encodeURIComponent(execution.n8nExecutionId)}/stop`
  const headers = {
    'Content-Type': 'application/json'
  }

  if (this.apiKey) {
    headers['X-N8N-API-KEY'] = this.apiKey
  }
}
```

The Phase 8 cancellation showcase must configure real stop support and must document how an n8n execution id is captured or correlated. Do not accept a UI-only manual stop as the CAP/plugin cancellation proof.

### Workflow Fixture Sanitization

**Source:** `test/integration/n8n-workflow-artifacts.test.js` lines 71-79 and 237-260

```js
const secretFragments = [
  /Bearer\s+/i,
  /api[_-]?key\s*[:=]/i,
  /gmail\.com/i,
  /workflow:owner/i
]

expect(workflow).toEqual({
  name: 'CAP n8n Test',
  nodes: [
    expect.objectContaining({
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      parameters: {
        httpMethod: 'POST',
        path: 'cap-test-trigger',
        options: {}
      }
    })
  ],
  connections: {},
  settings: {
    executionOrder: 'v1'
  }
})
```

Use this sanitizer mindset for the cancellation fixture. Keep the committed fixture small and scrubbed.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.env.example` | config | request-response | No committed `.env.example` exists; use runtime config and secret tests as partial analogs. |
| `docs/btp-deployment-guide.md` | docs | config guidance | No deployment guide exists; Phase 8 must stay advisory and not add deployment manifests. |
| `docker-compose.n8n-node.yml` | config | request-response/event-driven | Default Compose starts plain n8n only; use it for shape, but custom-node loading is new. |

## Planner Constraints

- Root npm scripts are the command surface. Prefer `review:local` or `release:check`; do not hide the main release check inside package workspaces.
- The local release command must be secret-free and deterministic. It must not require Docker, n8n browser login, manual credentials, screenshots, or local `.env`.
- Add the real custom-node Docker path as an explicit opt-in override/helper, not as an unannounced change to the default local n8n path.
- Keep `.env.example` placeholder-only and grouped by workflow. Never commit real n8n login values, API keys, OAuth secrets, encoded Basic Auth headers, or tenant metadata.
- Put the stoppable cancellation fixture under `test-workflows/` as a dedicated file. Do not mutate the happy-path workflow fixture to carry cancellation-only concerns.
- README links focused docs; focused docs contain runbooks. Update README whenever commands, config fields, environment variables, manual steps, verification commands, or fixture import/export behavior changes.
- Real installed custom-node E2E and cancellation UI evidence are browser/manual evidence unless the plan separately proves stable automation. Record their state as `browser/manual verified` or `manual UAT required`, not as generic "done".

## Metadata

**Analog search scope:** root `package.json`, `docker-compose.yml`, `cap-n8n-node/package.json`, `README.md`, `docs/manual-visual-showcase.md`, `test-workflows/`, `test/smoke/`, `test/integration/`, `cap-n8n-plugin/lib/config.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, `.gitignore`
**Files scanned:** 37
**Pattern extraction date:** 2026-06-03
