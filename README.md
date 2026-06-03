# cap-n8n-plugin

CAP n8n Integration connects SAP CAP applications with n8n workflow automation.

This repository is an npm workspace with two product surfaces:

- `cap-n8n-plugin/` - CAP plugin and service implementations for CAP to n8n workflow starts.
- `cap-n8n-node/` - n8n community node package for CAP OData access: credentials, metadata discovery, Query, Read, Create, Update, Delete, Action/Function, composite keys, response cleanup, and sanitized errors.
- `demo-app/` - demo SAP CAP Bookshop application used as integration evidence.

## Prerequisites

- Node.js 20 or newer. The locked `@sap/cds` dependency requires Node 20+.
- npm, using the root workspace lockfile.
- Docker Engine and Docker Compose, only when testing against a live local n8n instance.

Install dependencies from the repository root:

```bash
npm install
```

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

What they do:

- `npm run build` - builds workspace packages that define a build script.
- `npm run cap:compile` - compiles the CAP demo app models with repo-local CAP tooling.
- `npm run smoke` - builds the n8n node package and verifies package boundaries.
- `npm run test:integration` - runs CAP plugin integration tests without Docker n8n.
- `npm test` - runs smoke plus integration tests.
- `npm test --workspaces --if-present` - runs workspace package-level checks.
- `npm run n8n:workflow:import -- ...` - imports sanitized workflow artifacts into a CAP app through the package CLI.
- `npm run n8n:workflow:validate -- --app demo-app` - validates CAP workflow annotations against generated app-local n8n artifacts.
- `npm run n8n:up` - starts local n8n through Docker Compose.
- `npm run n8n:import` / `npm run n8n:export` - sync shared workflow fixtures in `test-workflows/`.

## Manual Testing

For a presenter-oriented walkthrough, see [Manual Visual Showcase Guide](docs/manual-visual-showcase.md). That guide explains how to demo the implemented CAP plugin functionality with n8n and the demo Fiori app, and it calls out which pieces are implemented but not yet polished enough for a no-harness visual showcase.

### 1. Baseline Verification

Use this first after pulling changes:

```bash
npm install
npm run build
npm test
npm run cap:compile
npm test --workspaces --if-present
```

Expected result: all commands exit with code 0. The n8n node tooling currently prints a Node DEP0190 warning from its CLI dependency; that warning is expected during the build/lint path.

### 2. Test Package Exports

```bash
node -e "const plugin=require('cap-n8n-plugin'); if(typeof plugin.N8nWorkflowService!=='function') process.exit(1); if(typeof plugin.MockN8nWorkflowService!=='function') process.exit(1); console.log('CAP plugin exports OK')"
```

Expected result: `CAP plugin exports OK`.

### 3. Test Mock Runtime Without Docker n8n

PowerShell:

```powershell
@'
const cds = require('@sap/cds')

cds.env.requires ??= {}
cds.env.requires.n8n = { kind: 'mock' }

require('cap-n8n-plugin/cds-plugin')
cds.emit('bootstrap')

cds.connect.to('n8n')
  .then(async n8n => {
    const result = await n8n.start(
      'manual-mock-workflow',
      { event: 'ManualTest' },
      { correlationId: 'manual-1', businessKey: 'book-1' }
    )

    console.log(JSON.stringify(result, null, 2))
    console.log(JSON.stringify(n8n.executions, null, 2))
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
'@ | node
```

Expected result:

- `accepted: true`
- `mock: true`
- deterministic execution ID such as `mock-exec-1`
- one in-memory execution record with `workflowId`, `inputs`, `status`, `startedAt`, and `finishedAt`

### 4. Test Production Config Failure

PowerShell:

```powershell
@'
const { resolveN8nConfig } = require('./cap-n8n-plugin/lib/config')

try {
  resolveN8nConfig({
    kind: 'webhook',
    credentials: { apiKey: 'secret-value' }
  }, { NODE_ENV: 'production' })
  process.exit(1)
} catch (err) {
  console.log(err.code)
  console.log(err.message)
  if (String(err.message).includes('secret-value')) process.exit(1)
}
'@ | node
```

Expected result:

- `ERR_N8N_CONFIG`
- message mentions missing `baseUrl`
- message does not leak the API key

### 5. Test Live n8n Webhook With Docker

Start n8n and import the shared workflow:

```bash
npm run n8n:up
npm run n8n:import
```

Open [http://localhost:5678](http://localhost:5678) and find the `CAP n8n Test` workflow. Its Webhook path is `cap-test-trigger`.

The current demo app uses `workflowId: "webhook-test/cap-test-trigger"` in `demo-app/srv/admin-service.cds`, so the demo-app create flow must be tested with the n8n Webhook node in test/listening mode. Click **Test step** on the Webhook node before sending the CAP request below.

Start the CAP demo app:

```bash
npm run cap:serve
```

Send a book create request. PowerShell:

```powershell
curl.exe -X POST "http://localhost:3000/odata/v4/admin/Books" `
  -H "Content-Type: application/json" `
  -H "Authorization: Basic <base64-demo-basic-auth>" `
  -d '{"IsActiveEntity":true,"title":"Manual n8n Trigger Book","author_ID":101,"genre_ID":"10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","price":25.50,"stock":100}'
```

Expected result:

- CAP returns a successful create response.
- The n8n webhook receives the event payload.
- The CAP service uses `demo-app/package.json` configuration: `kind: "webhook"` with `credentials.baseUrl` set to `http://localhost:5678`.

If you want to test an active n8n workflow instead of the test webhook URL, activate the `cap-test-trigger` workflow and call the service with the workflow ID without the `webhook-test/` prefix:

```powershell
@'
const cds = require('@sap/cds')

cds.env.requires ??= {}
cds.env.requires.n8n = {
  impl: 'cap-n8n-plugin/service',
  kind: 'webhook',
  credentials: { baseUrl: 'http://localhost:5678' }
}

cds.connect.to('n8n')
  .then(n8n => n8n.start('cap-test-trigger', { event: 'ManualActiveWebhook' }))
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
'@ | node
```

Use this active-workflow snippet when the n8n workflow is activated. Use the demo-app create request when the Webhook node is in test mode.

### 6. Test Workflow Import And Direct Validation

Phase 5 adds a package CLI for importing workflow artifacts and validating CDS annotations. The repo-local npm wrappers call the checked-in CLI path so they work from this private workspace. Package consumers can use the `cap-n8n` binary exposed by `cap-n8n-plugin`.

Local import from the checked-in n8n export fixture:

```bash
npm run n8n:workflow:import -- --app demo-app --from test-workflows/workflows.json --workflow cap-test-trigger --schema demo-app/n8n/workflows/cap-test-trigger/schema.json
```

Equivalent package CLI shape:

```bash
node cap-n8n-plugin/bin/cap-n8n.js import --app demo-app --from test-workflows/workflows.json --workflow cap-test-trigger --schema demo-app/n8n/workflows/cap-test-trigger/schema.json
```

Expected import output:

```text
Imported 1 local n8n workflow(s) into .../demo-app/n8n
- cap-test-trigger (local) -> .../demo-app/n8n/workflows/cap-test-trigger/workflow.json
```

Live import uses the same artifact writer and reads credentials from CAP config/environment. It does not support a literal API-key CLI flag.

```bash
npm run n8n:workflow:import -- --app demo-app --live --workflow <workflow-id> --schema demo-app/n8n/workflows/cap-test-trigger/schema.json
```

For local routing during a showcase, use a base URL override while keeping secrets in environment/config:

```bash
npm run n8n:workflow:import -- --app demo-app --live --workflow <workflow-id> --base-url http://localhost:5678 --schema demo-app/n8n/workflows/cap-test-trigger/schema.json
```

Direct validation:

```bash
npm run n8n:workflow:validate -- --app demo-app
node cap-n8n-plugin/bin/cap-n8n.js validate --app demo-app --json
```

Expected validation output:

```text
n8n workflow validation passed for .../demo-app.
```

JSON validation output has this shape:

```json
{
  "appRoot": ".../demo-app",
  "errors": [],
  "warnings": [],
  "diagnostics": []
}
```

When validation finds an error, text diagnostics include `severity`, `code`, `entity`, `annotation`, `workflow`, `key`, `input`, and `reason`. Errors exit with code 1. Warning-only diagnostics exit with code 0.

Committed app-root artifacts live under:

```text
demo-app/n8n/manifest.json
demo-app/n8n/index.cds
demo-app/n8n/workflows/cap-test-trigger/workflow.json
demo-app/n8n/workflows/cap-test-trigger/schema.json
demo-app/n8n/workflows/cap-test-trigger/manifest.json
```

Artifact roles:

- `workflow.json` - sanitized reviewable n8n workflow structure. Credentials, owners, pinned/static data, request/response bodies, stack traces, runtime counters, and personal metadata are removed.
- `schema.json` - sidecar scalar input contract used for typed workflow validation.
- `manifest.json` - per-workflow provenance, accepted workflow references such as `webhook-test/cap-test-trigger`, artifact paths, and sanitizer removed path names only.
- root `manifest.json` - aggregate index of app-local workflow artifacts.
- `index.cds` - generated CDS input contract under `cap.n8n.workflows`.

Build-time validation uses the same validator through the CAP build plugin:

```bash
npx cds compile demo-app/db demo-app/srv demo-app/app demo-app/n8n --to csn
npm run test:integration -- --run test/integration/n8n-workflow-phase5.test.js
```

### 7. Test n8n -> CAP With The SAP CAP Node

Use this path to manually validate the n8n community node against the CAP demo app after the local community node has been installed or mounted into n8n. The default `docker-compose.yml` starts plain n8n and does not install `cap-n8n-node` into the container.

This covers the current n8n -> CAP node slice for credentials, dynamic metadata discovery, Query, Read, Create, Update, Delete, Action/Function, composite keys, OData response cleanup, and sanitized errors. Polling triggers and a real installed custom-node E2E walkthrough in live n8n remain outside this Phase 7 slice.

First build and verify the node package:

```bash
npm run build --workspace n8n-nodes-sap-cap
npx vitest run test/integration/n8n-node-read-operations.test.js test/integration/n8n-node-metadata-discovery.test.js test/integration/n8n-node-response-cleanup.test.js test/smoke/package-boundaries.test.js
npm test
```

These commands are the deterministic Phase 7 `VERIFY-04` evidence. They exercise credential handling, metadata discovery, Query, Read, Create, Update, Delete, response cleanup, Action/Function, composite keys, sanitized errors, and built-node metadata. A live n8n UI run is still useful when the local community node is installed or mounted, but the default Docker Compose service does not install `cap-n8n-node` automatically.

Start the CAP demo app:

```bash
npm run cap:serve
```

In n8n, configure the `SAP CAP API` credentials:

- Base URL: `http://host.docker.internal:3000`
- Authentication: `Basic Auth`
- Username: `alice`
- Password: leave empty for the local demo user
- Metadata Path: `/odata/v4/admin/$metadata`

OAuth2 Client Credentials is also available. Configure Token URL, Client ID, Client Secret, and optional Scope when testing against a CAP service protected by an OAuth2 token endpoint.

For entity operations against the demo Admin service, use:

- Service Path: `/odata/v4/admin`
- Entity Set Source: `From Metadata` for the dropdown, or `Manual` if metadata discovery is unavailable
- Entity Set: `Books`

Query:

- Filter: `stock gt 0`
- Order By: `title asc`
- Select Fields: `ID,title,stock`
- Top: `5`
- Skip: `0`

Read:

```text
ID=201,IsActiveEntity=true
```

The same keyed operations support composite keys through either:

- Key Input: `From Metadata`, with Key Parts JSON such as `{"ID":201,"IsActiveEntity":true}`.
- Key Input: `Manual Key Predicate`, with a predicate such as `ID=201,IsActiveEntity=true`.

When metadata key descriptors are available, every key part is required and string-like values are quoted according to OData rules. If metadata is unavailable, use the manual Key Predicate fallback.

Create:

- Operation: `Create`
- Body (JSON):

```json
{
  "IsActiveEntity": true,
  "title": "Workflow Demo Book",
  "author_ID": 101,
  "genre_ID": "10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "price": 19.99,
  "stock": 25
}
```

Create uses one explicit JSON Body field. The Body must parse as a non-array JSON object, and the output is the cleaned created CAP entity, including server-generated fields returned by CAP.

Update:

- Operation: `Update`
- Key Input: metadata Key Parts JSON or Manual Key Predicate
- Body (JSON):

```json
{
  "price": 24.99,
  "stock": 30
}
```

Update sends a PATCH to the keyed entity URL with one explicit Body (JSON) object. It requests the updated representation and falls back to reading the same key when CAP returns a successful empty mutation response.

Delete:

- Operation: `Delete`
- Key Input: metadata Key Parts JSON or Manual Key Predicate
- Body: none
- Extra confirmation checkbox: none

Delete sends `DELETE` to the keyed entity URL with no request body. Success returns one confirmation item such as:

```json
{
  "deleted": true,
  "entitySet": "Books",
  "key": "(ID=201,IsActiveEntity=true)"
}
```

If CAP returns `404 Not Found`, the node reports a concise n8n-native not-found error by default.

For CAP Action/Function operation mode, switch the service path and metadata path to the Catalog service when using the demo `submitOrder` action:

- Service Path: `/odata/v4/catalog`
- Metadata Path: `/odata/v4/catalog/$metadata`
- Operation: `Action/Function`
- Operation Source: `From Metadata` when the dropdown is available, or `Manual` when metadata loading is unavailable
- Parameters (JSON):

```json
{
  "book": 201,
  "quantity": 1
}
```

Action/Function uses one combined operation mode. Metadata-backed choices cover actions, functions, imports, and bound operations. Manual fallback lets you provide the operation kind and name directly. Actions send JSON Parameters in the request body; functions encode primitive JSON Parameters into the OData function-call segment, for example `bookAvailability(book=201)`. Bound Action/Function requests reuse the same metadata key parts or manual Key Predicate path as Read, Update, and Delete.

Expected result:

- Query returns one n8n item per CAP entity.
- Read returns the selected CAP entity.
- Create and Update return one cleaned CAP entity item.
- Delete returns one confirmation item and sends no request body.
- Action/Function returns one cleaned n8n item; primitive or array results are wrapped under `value`.
- Returned items do not include raw `@odata.*` metadata fields.
- CAP/OData failures are reported with concise n8n-native errors that do not expose credentials, auth headers, tokens, stack traces, or full response bodies.

## Runtime Configuration

The CAP binding is configured under `cds.requires.n8n`.

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

Supported runtime behavior:

- `kind: "mock"` selects `cap-n8n-plugin/mock-service` and does not require n8n or `baseUrl`.
- `kind: "webhook"` selects `cap-n8n-plugin/service` and requires `baseUrl`.
- If `kind` is omitted, a configured `baseUrl` selects webhook mode.
- If `kind` and `baseUrl` are omitted in development or test profiles, mock mode is selected.
- If production resolves to webhook mode without `baseUrl`, startup fails with sanitized `ERR_N8N_CONFIG`.
- `apiKey` is optional. When set, it is sent as `X-N8N-API-KEY`.
- Webhook timeout defaults to `10000` ms.
- Retries default to `3` total attempts with `250` ms delay.
- Transient HTTP `502`, `503`, `504`, network errors, and timeouts are retryable. Client errors such as `400`, `401`, `403`, and `404` are not retried.

## Programmatic CAP Usage

```js
const cds = require('@sap/cds')

module.exports = class SomeService extends cds.ApplicationService {
  async init() {
    const n8n = await cds.connect.to('n8n')

    this.on('someAction', async req => {
      return n8n.start(
        'cap-test-trigger',
        { event: 'SomeAction', data: req.data },
        { correlationId: req.id, businessKey: req.data.ID }
      )
    })

    return super.init()
  }
}
```

Successful starts return an accepted result object containing the caller-facing `workflowId`, optional `executionId`, optional correlation metadata, and the parsed webhook or mock result.

## Shared n8n Workflows

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

## Documentation Maintenance

README.md must stay current with important developer instructions. Update it in the same change whenever you add or change:

- root npm scripts or workspace commands
- CAP/n8n configuration fields
- required environment variables
- manual setup steps
- manual or automated verification commands
- local n8n workflow import/export behavior
