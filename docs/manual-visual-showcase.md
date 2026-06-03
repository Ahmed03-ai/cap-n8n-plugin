# Manual Visual Showcase Guide

This guide is for someone who has not worked in this codebase before and needs to demonstrate the implemented functionality manually. It is written as a presenter runbook: what to open, what to click, what command to run, what should appear on screen, and what not to claim yet.

The strongest current visual showcase is:

1. Open n8n and put the imported Webhook workflow into test/listening mode.
2. Open the CAP demo app and create or update a Book.
3. Watch n8n receive the webhook payload produced by CDS annotations, not by custom service-handler glue.

## What You Can Showcase Today

Implemented and demoable from the current repository:

- CAP plugin package and n8n node package are loadable from npm workspace boundaries.
- CAP developers can call `cds.connect.to('n8n')` and start workflows through the plugin service.
- Mock n8n runtime works without Docker.
- Webhook runtime can call local n8n.
- Execution tracking, query, duplicate metadata, and cancellation APIs exist and are covered by integration tests.
- CDS annotations can start workflows on `CREATE` and `UPDATE` for the demo `AdminService.Books` projection.
- CDS annotations can map scalar fields into the workflow payload.
- CDS annotations can apply a condition, currently `stock > 0` in the demo.
- CDS annotations can declare cancellation on `DELETE`, and the cancellation behavior is covered by integration tests.
- Local and live n8n workflow import are available through the package CLI.
- Generated `demo-app/n8n` artifacts provide sanitized workflow JSON, a sidecar input schema, manifests, and generated CDS.
- `cap-n8n validate` checks CDS annotations against generated workflow artifacts and returns sanitized text or JSON diagnostics.
- CAP build validation uses the same workflow annotation validator.
- Browser-first cancellation evidence is available through the dedicated `CAP n8n Cancellation Test` fixture and `scripts/cancellation-showcase.js`.
- The SAP CAP n8n community node package builds and includes the Phase 7 node slice: SAP CAP API credentials, Basic Auth, OAuth2 Client Credentials, `$metadata` Test Connection, dynamic entity-set discovery, Query, Read, Create, Update, Delete, composite-key handling, Action/Function mode, JSON Body input, JSON Parameters input, OData response cleanup, and sanitized errors.

## What Not To Showcase As Finished Yet

Be precise about these limitations:

- The current local n8n fixture is intentionally minimal. It contains one Webhook workflow named `CAP n8n Test`.
- The visual n8n demo proves "CAP sent an annotated payload to n8n"; it does not show a rich downstream workflow.
- The cancellation fixture is intentionally separate from the happy-path `CAP n8n Test` fixture and exists only to prove the stop path.
- The SAP CAP n8n community node is not installed or mounted into the default Docker n8n container. Do not claim that the SAP CAP node appears automatically in the Docker n8n UI.
- Real installed n8n custom-node E2E in a live n8n editor/runtime remains Phase 8 release-readiness evidence. Phase 7 has deterministic built-node integration verification.
- Polling triggers are not implemented in the current n8n community node surface.
- To-one and to-many annotation input mappings are deferred. Scalar mappings are implemented.
- The Phase 5 package CLI is implemented, but there is no deep `cds import --from n8n` command yet.
- Live workflow import requires a reachable n8n API and credentials from CAP config/environment. Do not pass or display literal API keys.

## Presenter Setup

Use three terminals and two browser tabs.

Terminal 1:

```bash
npm install
npm test
```

Expected result:

- Smoke tests pass.
- Integration tests pass.
- The n8n node build may print Node `DEP0190`; that warning is expected from the current n8n node tooling path.

Terminal 2 will run n8n.

Terminal 3 will run the CAP demo app.

Browser tab 1:

```text
http://localhost:5678
```

Browser tab 2:

```text
http://localhost:3000/app/fiori-apps.html
```

If CAP asks for credentials in the browser, use:

```text
Username: alice
Password: leave empty
```

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

Open the Webhook node. For the demo app annotation, the workflow ID is:

```text
webhook-test/cap-test-trigger
```

That means the Webhook node must be in test/listening mode. In n8n, click the Webhook node's test/listen control before triggering CAP.

Expected visual:

- n8n shows the workflow canvas.
- The workflow contains a Webhook node.
- The Webhook node is waiting for a test event.

## Step 2: Start The CAP Demo App

In Terminal 3:

```bash
npm run cap:serve
```

Expected terminal output:

- CAP starts on port `3000`.
- OData services are available under `/odata/v4/admin/` and `/odata/v4/catalog/`.

Open the Fiori launchpad:

```text
http://localhost:3000/app/fiori-apps.html
```

Click:

```text
Manage Books
```

Expected visual:

- The Bookshop launchpad appears.
- The Administration group contains a `Manage Books` tile.
- The Manage Books app shows a list of books.

## Step 3: Show The CDS Annotation That Drives The Demo

Before triggering anything, show the annotation file:

```text
demo-app/srv/admin-service.cds
```

Point out this block:

```cds
annotate AdminService.Books with @n8n.workflow.start: {
  workflowId: 'webhook-test/cap-test-trigger',
  on: ['CREATE', 'UPDATE'],
  inputs: {
    bookId: 'ID',
    title: 'title'
  },
  if: 'stock > 0',
  businessKey: 'ID',
  tag: 'admin-books'
};
```

What this proves:

- The workflow trigger is declarative CDS metadata.
- `CREATE` and `UPDATE` are selected explicitly.
- Only scalar fields `ID` and `title` are mapped into the n8n payload.
- The trigger is conditional on `stock > 0`.
- The business key and tag are persisted with workflow execution metadata.

Also point out:

```cds
annotate AdminService.Books with @n8n.workflow.cancel: {
  workflowId: 'webhook-test/cap-test-trigger',
  on: ['DELETE'],
  businessKey: 'ID',
  tag: 'admin-books'
};
```

What this proves:

- Delete cancellation is declared in CDS.
- The visual cancellation fixture is not yet polished enough for a no-harness demo. Use the integration test evidence for cancellation until the later showcase fixture exists.

## Step 4: Show The Phase 5 Workflow Artifacts And Validator

Open this folder in the editor or file explorer:

```text
demo-app/n8n
```

Expected filesystem view:

```text
demo-app/n8n/manifest.json
demo-app/n8n/index.cds
demo-app/n8n/workflows/cap-test-trigger/workflow.json
demo-app/n8n/workflows/cap-test-trigger/schema.json
demo-app/n8n/workflows/cap-test-trigger/manifest.json
```

What to point out:

- `workflow.json` is sanitized n8n workflow structure for review.
- `schema.json` defines the typed scalar inputs `bookId`, `title`, and optional `event`.
- `manifest.json` records accepted references, including `webhook-test/cap-test-trigger`, without storing removed secret or personal metadata values.
- `index.cds` contains the generated `cap.n8n.workflows` input contract that CAP can compile.

Run direct validation:

```bash
npm run n8n:workflow:validate -- --app demo-app
```

Expected terminal output:

```text
n8n workflow validation passed for .../demo-app.
```

Run JSON validation for machine-readable diagnostics:

```bash
node cap-n8n-plugin/bin/cap-n8n.js validate --app demo-app --json
```

Expected JSON shape:

```json
{
  "appRoot": ".../demo-app",
  "errors": [],
  "warnings": [],
  "diagnostics": []
}
```

Run local import if you need to regenerate the same artifact set from the checked-in fixture:

```bash
npm run n8n:workflow:import -- --app demo-app --from test-workflows/workflows.json --workflow cap-test-trigger --schema demo-app/n8n/workflows/cap-test-trigger/schema.json
```

Expected import output:

```text
Imported 1 local n8n workflow(s) into .../demo-app/n8n
- cap-test-trigger (local) -> .../demo-app/n8n/workflows/cap-test-trigger/workflow.json
```

Live import uses the same artifact layout, but it requires a reachable n8n API and CAP config/environment credentials:

```bash
npm run n8n:workflow:import -- --app demo-app --live --workflow <workflow-id> --base-url http://localhost:5678 --schema demo-app/n8n/workflows/cap-test-trigger/schema.json
```

Presenter wording:

```text
The import command creates deterministic app-local artifacts. The validate command reads the same generated manifests and CAP CSN annotations as the build validator, so the demo annotation can be checked without starting n8n.
```

Do not claim:

- The command accepts a literal API key flag.
- The sanitized workflow JSON is a full-fidelity n8n export.
- Full JSON Schema or association mapping is implemented.

## Step 5: Trigger CREATE From CAP And Watch n8n Receive It

Keep n8n Webhook test/listening mode active.

You can trigger from Fiori by creating a Book in Manage Books. If draft handling or browser authentication slows down the demo, use this reliable OData command from another terminal while Fiori remains open for visual context.

PowerShell:

```powershell
curl.exe -X POST "http://localhost:3000/odata/v4/admin/Books" `
  -H "Content-Type: application/json" `
  -H "Authorization: Basic <base64-demo-basic-auth>" `
  -d '{"ID":1021,"IsActiveEntity":true,"title":"Manual n8n Trigger Book","author_ID":101,"genre_ID":"10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","price":25.50,"stock":100}'
```

Bash:

```bash
curl -X POST "http://localhost:3000/odata/v4/admin/Books" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic <base64-demo-basic-auth>" \
  -d '{"ID":1021,"IsActiveEntity":true,"title":"Manual n8n Trigger Book","author_ID":101,"genre_ID":"10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","price":25.50,"stock":100}'
```

Expected CAP result:

- The request succeeds.
- The book appears in the Admin Books service.
- If Fiori is open, refresh the Manage Books list and look for `Manual n8n Trigger Book`.

Expected n8n result:

- The Webhook node receives one request.
- The visible request body contains mapped fields:

```json
{
  "bookId": 1021,
  "title": "Manual n8n Trigger Book"
}
```

- The request body also contains event metadata similar to:

```json
{
  "event": {
    "name": "CREATE",
    "entity": "AdminService.Books",
    "service": "AdminService",
    "keys": {
      "ID": 1021
    }
  }
}
```

Talking point:

The old hard-coded `cds.connect.to('n8n')` trigger was removed from `demo-app/srv/admin-service.js`. The create side effect now comes from the CDS annotation and plugin registrar.

## Step 6: Trigger UPDATE And Watch n8n Receive It

Put the n8n Webhook node back into test/listening mode.

PowerShell:

```powershell
curl.exe -X PATCH "http://localhost:3000/odata/v4/admin/Books(ID=1021,IsActiveEntity=true)" `
  -H "Content-Type: application/json" `
  -H "Authorization: Basic <base64-demo-basic-auth>" `
  -d '{"stock":101}'
```

Bash:

```bash
curl -X PATCH "http://localhost:3000/odata/v4/admin/Books(ID=1021,IsActiveEntity=true)" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic <base64-demo-basic-auth>" \
  -d '{"stock":101}'
```

Expected n8n result:

- The Webhook node receives one request.
- The payload still contains the mapped scalar inputs:

```json
{
  "bookId": 1021,
  "title": "Manual n8n Trigger Book"
}
```

- The event metadata now says:

```json
{
  "event": {
    "name": "UPDATE"
  }
}
```

Talking point:

The annotation maps selected fields, not the whole database row. Updating `stock` triggers the workflow, but `stock` is not sent because the annotation maps only `ID` and `title`.

## Step 7: Show Condition Behavior Honestly

The implemented condition is:

```cds
if: 'stock > 0'
```

In this demo app, AdminService also validates `stock` as greater than zero. That means the "false condition" path is not a clean Fiori showcase today, because the demo service rejects invalid stock before the annotation condition becomes the visible story.

Use this explanation:

- The condition parser and evaluator are implemented.
- The true path is shown by creating or updating a Book with positive stock.
- The false path is covered by integration tests.
- A later showcase fixture should add a data shape where a condition can be false without violating unrelated CAP validation.

To show the test evidence:

```bash
npx vitest run test/integration/n8n-annotations-start.test.js
```

Expected result:

- The test named `honors true and false start conditions without creating skipped execution rows` passes.

## Step 8: Show Browser-First Cancellation Through The CAP/plugin Stop Path

This step proves cancellation with visible n8n UI state first and terminal output second. The acceptance path is a real execution stop: `scripts/cancellation-showcase.js` starts a dedicated workflow through the CAP/plugin `start` API, waits while the reviewer confirms the n8n execution is waiting/running in the browser, then calls `n8n.cancel(executionId)` through the plugin API. The plugin cancellation path uses `cap-n8n-plugin/lib/annotations/CancellationResolver.js` for declarative matching and the service stop path for direct cancellation.

Start local n8n in Terminal 2:

```bash
npm run n8n:up
```

If you are using the custom-node review profile instead of the default local n8n container, start that profile first, then use the same fixture import and browser checklist below.

Import the dedicated cancellation fixture:

```bash
docker compose exec n8n n8n import:workflow --input=/test-workflows/cancellation-workflows.json
```

Open n8n:

```text
http://localhost:5678
```

Find and activate:

```text
CAP n8n Cancellation Test
```

Expected workflow shape:

- Webhook path: `cap-cancel-stoppable`
- Respond to Webhook returns JSON with `executionId` from n8n `$execution.id`
- The response includes the explicit running webhook response contract: `status: "running"` and `keepRunning: true`
- A Wait node keeps the execution visible long enough for browser evidence

Create a local n8n API key in the n8n UI under Settings -> n8n API. Where scopes are available, use the minimum execution stop/list scope needed for local review.

Set local placeholder environment variables in Terminal 4:

PowerShell:

```powershell
$env:N8N_BASE_URL="http://localhost:5678"
$env:N8N_CANCEL_SUPPORTED="true"
$env:N8N_CANCEL_API_BASE_URL="http://localhost:5678"
$env:N8N_API_KEY="<local-n8n-api-key>"
$env:N8N_CANCEL_WORKFLOW_ID="cap-cancel-stoppable"
```

Bash:

```bash
export N8N_BASE_URL=http://localhost:5678
export N8N_CANCEL_SUPPORTED=true
export N8N_CANCEL_API_BASE_URL=http://localhost:5678
export N8N_API_KEY=<local-n8n-api-key>
export N8N_CANCEL_WORKFLOW_ID=cap-cancel-stoppable
```

Preview the runner without contacting n8n:

```bash
node scripts/cancellation-showcase.js --dry-run
```

Run the showcase:

```bash
node scripts/cancellation-showcase.js
```

Expected terminal result before cancellation:

- The script prints the CAP/plugin `executionId`
- The script prints the n8n `n8nExecutionId`
- The script prints status `running`
- The script does not print the API key

Expected browser result before pressing Enter:

- n8n shows an execution for `CAP n8n Cancellation Test`
- The execution is waiting/running at the Wait node
- The visible execution ID matches the `n8nExecutionId` printed by the script

Press Enter in the script only after the browser shows the execution is waiting/running.

Expected terminal result after cancellation:

- The script calls `n8n.cancel(executionId)`
- The cancellation result says `cancelled: true`
- The result includes the same CAP/plugin execution ID and n8n execution ID

Expected browser result after cancellation:

- Refresh the n8n execution view if needed
- The execution state is stopped or cancelled
- The stopped/cancelled state matches the script output

Checklist to capture as browser/manual evidence:

- Browser URL: `http://localhost:5678`
- Workflow name: `CAP n8n Cancellation Test`
- Webhook path: `cap-cancel-stoppable`
- n8n execution ID
- CAP/plugin execution ID
- CAP/plugin start response with status `running`
- Browser-visible waiting/running execution before cancellation
- Cancellation result from `n8n.cancel(executionId)`
- Browser-visible stopped/cancelled n8n state after cancellation
- Cleanup confirmation

This path depends on the explicit running webhook response contract. Without `status: "running"` or `keepRunning: true` plus an n8n execution ID, normal webhook starts remain terminal successes and cancellation is a no-op by design.

Automated evidence:

```bash
npx vitest run test/integration/n8n-cancellation-stop-api.test.js test/integration/n8n-release-readiness.test.js
```

Expected result:

- The fake stop API proves `n8n.cancel(executionId)` calls `POST /api/v1/executions/<n8nExecutionId>/stop`
- The fixture, runner, docs, and output are checked for placeholder-only secret handling

Cleanup:

- Deactivate `CAP n8n Cancellation Test` if it should not keep listening locally
- Delete or stop only local review executions created for this run
- Remove the local n8n API key from the n8n UI when review is complete
- Do not delete checked-in workflow fixtures or generated docs

If this browser path has not been run in the current review environment, record it as `manual UAT required` rather than claiming browser/manual verification.

## Step 9: Show Execution Tracking, Build Validation, Phase 7 Node Verification, And Non-Rollback Behavior

Run the aggregate integration suite:

```bash
npm run test:integration
```

Expected result:

- The Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, and Phase 7 integration tests pass.
- The suite includes execution storage, dispatch retry, duplicate handling, query/paging, cancellation, annotation start, annotation cancel, demo annotation evidence, workflow import, generated CDS, direct validation, CAP build validation, SAP CAP node credentials, metadata discovery, Query, Read, Create, Update, Delete, Action/Function, composite keys, response cleanup, and sanitized errors.

For a shorter Phase 5 check:

```bash
npx vitest run test/integration/n8n-workflow-phase5.test.js
```

Expected result:

- Local workflow import writes app-root artifacts.
- Direct `cap-n8n validate` passes for `demo-app`.
- `cds compile` and CAP build validation pass for the temp app fixture.
- Warning-only validation cases exit 0, while typed error cases exit 1.
- Source, CLI output, and generated artifact sanitization gates pass.

For a shorter Phase 4-only check:

```bash
npx vitest run test/integration/n8n-annotation-contract.test.js test/integration/n8n-annotations-start.test.js test/integration/n8n-annotations-cancel.test.js test/integration/n8n-annotations-demo.test.js
```

Expected result:

- All Phase 4 annotation tests pass.

Talking point:

The integration tests use CAP, CDS models, SQLite, and fake HTTP webhook servers. They are not just plain object tests.

## Step 10: Show The n8n Community Node Status Carefully

The n8n node package is buildable and has deterministic Phase 7 verification:

```bash
npm run build --workspace n8n-nodes-sap-cap
npx vitest run test/integration/n8n-node-read-operations.test.js test/integration/n8n-node-metadata-discovery.test.js test/integration/n8n-node-response-cleanup.test.js test/smoke/package-boundaries.test.js
npm test
```

Expected result:

- `n8n-node build` succeeds.
- The build may print the known Node `DEP0190` warning.
- The focused integration and smoke suites pass.
- `npm test` passes and proves `VERIFY-04` through the default local verification path.

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

If the local community node has been separately installed or mounted into live n8n, open an SAP CAP node and check that the operation selector visibly offers:

- Query
- Read
- Create
- Update
- Delete
- Action/Function

Presenter checks for the visible node controls:

- Create shows a single Body (JSON) field. Example:

```json
{
  "title": "Workflow Demo Book",
  "price": 19.99,
  "stock": 25
}
```

- Update shows key input plus a single Body (JSON) field. Example key: `ID=201,IsActiveEntity=true`. Example body:

```json
{
  "price": 24.99
}
```

- Read, Update, Delete, and bound Action/Function can use metadata-derived Key Parts JSON such as `{"ID":201,"IsActiveEntity":true}` or Manual Key Predicate fallback such as `ID=201,IsActiveEntity=true`.
- Delete shows key input only. It sends no body, has no confirmation checkbox, returns one success confirmation, and reports not-found as a concise n8n-native error by default.
- Action/Function shows metadata/manual operation selection and one Parameters (JSON) field. Example:

```json
{
  "book": 201,
  "quantity": 1
}
```

But do not run a live n8n UI demo of the SAP CAP node from the default Docker setup unless you have separately installed or mounted the local community node into n8n. The repository's `docker-compose.yml` currently starts plain n8n with workflow fixtures; it does not install `cap-n8n-node` into that container.

Do not present the default Docker container as real installed custom-node E2E evidence. That remains Phase 8 release-readiness work, where the local community node is mounted or installed into n8n and exercised through the live editor/runtime.

Presenter wording:

```text
The package builds and the Phase 7 node slice is implemented: credentials, metadata discovery, Query, Read, Create, Update, Delete, composite keys, Action/Function, cleanup, and safe errors. The default Docker n8n does not install the custom node, so real installed custom-node E2E remains Phase 8 evidence.
```

## Recommended Five-Minute Demo Script

Use this when time is short.

1. Show `demo-app/srv/admin-service.cds`.
2. Point at `@n8n.workflow.start` and explain `CREATE`, `UPDATE`, scalar mapping, condition, business key, and tag.
3. Point at `@n8n.workflow.cancel` and explain delete cancellation uses query/cancel matching through `cap-n8n-plugin/lib/annotations/CancellationResolver.js`.
4. Show `demo-app/n8n`, then run `npm run n8n:workflow:validate -- --app demo-app`.
5. Open n8n at `http://localhost:5678`, open `CAP n8n Test`, and start Webhook test/listening mode.
6. Open Fiori at `http://localhost:3000/app/fiori-apps.html`, click `Manage Books`.
7. Run the create command for book `1021`.
8. Show the n8n Webhook request payload.
9. Run the update command for book `1021`.
10. Show the second n8n Webhook request payload.
11. If cancellation evidence is part of the review, import `test-workflows/cancellation-workflows.json`, activate `CAP n8n Cancellation Test`, run `node scripts/cancellation-showcase.js`, and show the waiting/running execution become stopped/cancelled.
12. Run the Phase 7 focused node verification command, or show the latest passing output for `VERIFY-04`.
13. Run the Phase 5, Phase 4, or Phase 8 focused tests, or show the latest passing output for validation, cancellation, release-readiness, and non-rollback behavior.

## Troubleshooting

### n8n Does Not Receive The Webhook

Check:

- `npm run n8n:up` has started the container.
- `npm run n8n:import` imported the workflow.
- The `CAP n8n Test` workflow is open.
- The Webhook node is in test/listening mode.
- CAP uses `workflowId: 'webhook-test/cap-test-trigger'`, so active workflow mode alone is not enough for this demo.

### CAP Create Fails With Authorization

Use Basic auth:

```text
Authorization: Basic <base64-demo-basic-auth>
```

This placeholder represents the local demo user `alice` with an empty password. Generate the value locally when running curl; do not commit encoded credentials.

### CAP Create Fails With Validation

Use existing sample IDs:

```json
{
  "author_ID": 101,
  "genre_ID": "10aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "price": 25.50,
  "stock": 100
}
```

The demo service validates author, genre, price, and stock.

### You Need A Clean n8n State

Use the existing Docker volume intentionally. Do not commit `.n8n-data/`.

If you manually reset local n8n data, re-run:

```bash
npm run n8n:import
```

### The n8n Node Does Not Appear In The n8n UI

That is expected with the default Docker setup. The container does not install the local community node package. Show the package build instead, or wait for the later n8n-node showcase setup.

## Reviewer Checklist

The presenter can claim:

- CAP-to-n8n workflow starts are package-owned and annotation-driven.
- Demo Book `CREATE` and `UPDATE` can be shown visually in n8n.
- Scalar input mapping is implemented.
- Conditions are implemented and integration-tested.
- Execution tracking/query/cancel infrastructure is implemented and integration-tested.
- Declarative cancellation is implemented and integration-tested.
- Browser-first cancellation evidence has a dedicated stoppable fixture and CAP/plugin runner when the Step 8 manual path has been completed in the current review environment.
- Non-rollback behavior is integration-tested.
- Workflow import writes deterministic sanitized app-root artifacts.
- `cap-n8n validate` and CAP build validation use generated workflow manifests and typed sidecar schemas.
- Phase 5 integration tests cover local import, fake-live import, generated CDS, direct validation, CAP build validation, and sanitization gates.
- Phase 6 and Phase 7 integration tests cover SAP CAP credentials, OAuth2 Client Credentials, metadata discovery, Query, Read, Create, Update, Delete, Action/Function, composite keys, OData response cleanup, and sanitized n8n errors.
- The SAP CAP n8n node supports Create and Update through explicit Body JSON, Delete through explicit key input with no body, and Action/Function through explicit Parameters JSON.
- Real installed custom-node E2E in live n8n remains separate Phase 8 evidence unless the local community node has been mounted or installed for the demo.

The presenter should not claim yet:

- To-one/to-many annotation mappings are implemented.
- The SAP CAP n8n node is automatically installed in local Docker n8n.
- The default Docker n8n container proves real installed SAP CAP custom-node E2E.
- The SAP CAP n8n node supports polling triggers.
- Local n8n fixtures demonstrate a rich workflow beyond receiving a webhook.
- A deep `cds import --from n8n` command exists.
- Literal API-key CLI flags are supported for live import.
