# cap-n8n-plugin

CAP n8n Integration connects SAP CAP applications with n8n workflow automation.

This repository is an npm workspace with two product surfaces:

- `cap-n8n-plugin/` - CAP plugin and service implementations for CAP to n8n workflow starts.
- `cap-n8n-node/` - n8n community node package skeleton for n8n to CAP OData access.
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
npm run n8n:up
npm run n8n:import
npm run n8n:export
```

What they do:

- `npm run build` - builds workspace packages that define a build script.
- `npm run cap:compile` - compiles the CAP demo app models with repo-local CAP tooling.
- `npm run smoke` - builds the n8n node package and verifies package boundaries.
- `npm run test:integration` - runs Phase 2 CAP plugin integration tests without Docker n8n.
- `npm test` - runs smoke plus integration tests.
- `npm test --workspaces --if-present` - runs workspace package-level checks.
- `npm run n8n:up` - starts local n8n through Docker Compose.
- `npm run n8n:import` / `npm run n8n:export` - sync shared workflow fixtures in `test-workflows/`.

## Manual Testing

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

### 5. Test Live n8n Webhook Through the Demo App

Start n8n and import the shared workflow:

```bash
npm run n8n:up
npm run n8n:import
```

Open [http://localhost:5678](http://localhost:5678), find the `cap-test-trigger` workflow, and either activate it or put its Webhook node into test mode.

Start the CAP demo app:

```bash
npm run cap:serve
```

Send a book create request. PowerShell:

```powershell
curl.exe -X POST "http://localhost:3000/odata/v4/admin/Books" `
  -H "Content-Type: application/json" `
  -H "Authorization: Basic YWxpY2U6" `
  -d '{"IsActiveEntity":true,"title":"Manual n8n Trigger Book","author_ID":101,"genre_ID":"10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","price":25.50,"stock":100}'
```

Expected result:

- CAP returns a successful create response.
- The n8n webhook receives the event payload.
- The CAP service uses `demo-app/package.json` configuration: `kind: "webhook"` with `credentials.baseUrl` set to `http://localhost:5678`.

If n8n deactivates workflows during import, re-open the workflow and activate it or run the Webhook node in test mode before sending the CAP request.

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
