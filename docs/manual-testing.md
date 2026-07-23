# Manual Testing

Use this README as the entry point, then follow the focused Phase 8 docs for each run path:

- [Manual Visual Showcase Guide](docs/manual-visual-showcase.md) - local CAP demo, local n8n webhook, annotation-driven starts, cancellation showcase, and presenter checklist.
- Demo app quick test: see `demo-app/readme.md` for a copyable PowerShell `Invoke-RestMethod` and `curl.exe` example to create a `Books` entry and trigger the annotated n8n workflow.
- [Local n8n Custom-Node E2E Runbook](docs/local-n8n-custom-node-e2e.md) - real n8n custom-node E2E with the local `SAP CAP` node installed in the isolated review profile.
- [Cloud n8n Runbook](docs/cloud-n8n-runbook.md) - local CAP demo configured through `CDS_CONFIG` to send annotation webhooks to a reachable cloud n8n instance.
- [SAP BTP Deployment Advisory Guide](docs/btp-deployment-guide.md) - Cloud Foundry and Kyma considerations for routing, credentials, connectivity, and secrets.
- [Release Readiness Evidence](docs/release-readiness.md) - requirement, GitHub story, mockup, fixture, command, and manual evidence traceability.

Configuration starts from the root [.env.example](.env.example). It is grouped by run path: CAP demo/mock, local n8n webhook, real n8n custom-node E2E, cancellation stop API, cloud n8n, and BTP advisory placeholders. Copy values into your shell or ignored local environment files only; do not commit real API keys, Basic auth headers, OAuth client secrets, n8n owner/login values, or production tenant metadata.

Run paths are intentionally separate:

- Local CAP demo and mock/test commands are automated and local-first.
- `npm run review:local` is automated review evidence only.
- Real n8n custom-node E2E and cancellation browser checks remain checklist evidence until a reviewer completes them. If they have not been run in the current review environment, record `manual UAT required`.
- Cloud n8n has a concrete local-CAP-to-cloud-n8n runbook, but runtime validation remains manual UAT until a reviewer completes it against a real cloud n8n instance.
- BTP guidance is advisory and does not claim Cloud Foundry or Kyma runtime validation.

## 0. Agent Startup Routine

Use this first when a reviewer, colleague, or agent needs the local CAP app plus the n8n custom-node review profile:

```bash
npm run agent:startup
```

The helper performs these steps:

- checks the git position, supported Node version, npm availability, dependency install state, Docker daemon access, and Compose command shape
- runs `scripts/prepare-n8n-custom-node.js` so n8n sees the local `n8n-nodes-sap-cap` package
- starts `docker-compose.n8n-node.yml` with either `docker compose` or `docker-compose`
- imports the selected n8n workflow fixture. By default this is `stock update discord msg test workflow` from `test-workflows/stock update discord msg test workflow.json`
- starts CAP through `npm run cap:serve`
- waits for `http://localhost:5678/healthz`, `http://localhost:5678`, `http://localhost:3000/odata/v4/admin/$metadata`, and `http://localhost:3000/odata/v4/catalog/$metadata`
- uses the local mocked CAP user `alice` for the Admin metadata probe

Useful variants:

```bash
npm run agent:startup -- --check
npm run agent:startup -- --plain-n8n
npm run agent:startup -- --workflow "stock update discord msg test workflow"
npm run agent:startup -- --workflow-file test-workflows/workflows.json
npm run agent:startup -- --skip-workflow-import
npm run agent:startup -- --skip-n8n
npm run agent:startup -- --stop
```

Behavior notes:

- Default n8n profile: `docker-compose.n8n-node.yml`, which is the review profile with the local custom node installed.
- Default imported workflow: `stock update discord msg test workflow`. It keeps workflow ID and Webhook path `cap-test-trigger`, so it still matches the demo app annotation `webhook/cap-test-trigger`.
- `--workflow` selects a workflow by workflow name, ID, Webhook path, or fixture file name.
- `--workflow-file` imports a specific JSON file under `test-workflows/`. Single workflow exports and array exports are both supported.
- `--plain-n8n` uses `docker-compose.yml` and skips the custom-node install step.
- `--skip-workflow-import` starts n8n without seeding the selected workflow.
- The Discord HTTP step reads `DISCORD_WEBHOOK_URL` from the n8n container environment. Set it in your shell before startup if you want the imported workflow to send a real Discord message.
- `npm run start:local-review` remains as a backwards-compatible alias, but new docs should use `npm run agent:startup`.
- If Docker is installed but the current user cannot reach the daemon, the helper reports the Docker blocker and still starts CAP unless `--strict` is passed.
- CAP stays attached to the terminal. Press `Ctrl+C` to stop CAP, or use `npm run agent:startup -- --stop` to stop CAP started by the helper and the selected n8n profile.

## 1. Baseline Verification

Use this first after pulling changes:

```bash
npm install
npm run build
npm test
npm run cap:compile
npm test --workspaces --if-present
```

Expected result: all commands exit with code 0. The n8n node tooling currently prints a Node DEP0190 warning from its CLI dependency; that warning is expected during the build/lint path.

## 2. Test Package Exports

```bash
node -e "const plugin=require('cap-n8n-plugin'); if(typeof plugin.N8nWorkflowService!=='function') process.exit(1); if(typeof plugin.MockN8nWorkflowService!=='function') process.exit(1); console.log('CAP plugin exports OK')"
```

Expected result: `CAP plugin exports OK`.

## 3. Test Mock Runtime Without Docker n8n

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

## 4. Test Production Config Failure

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

## 5. Test Live n8n Webhook With Docker

Start n8n and import the shared workflow:

```bash
npm run n8n:up
npm run n8n:import
```

Open [http://localhost:5678](http://localhost:5678) and find the `CAP n8n Test` workflow. Its Webhook path is `cap-test-trigger`.

The current demo app uses `workflowId: "webhook/cap-test-trigger"` in `demo-app/srv/admin-service.cds`, which targets the production webhook URL. Activate the `cap-test-trigger` workflow in n8n (**Active** toggle) before sending the CAP request below.

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

You can also trigger the same activated workflow directly from a script, using the workflow ID without a prefix:

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

If you prefer to test without activating the workflow, change the annotation to the `webhook-test/cap-test-trigger` path and click **Listen for test event** on the Webhook node instead. Note that the test webhook is one-shot: it catches a single request, so re-arm it before each trigger.

## 6. Test Workflow Import And Direct Validation

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

## 7. Test n8n -> CAP With The SAP CAP Node

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

