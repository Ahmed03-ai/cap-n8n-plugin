# cap-n8n-plugin

CAP n8n Integration connects SAP CAP applications with n8n workflow automation.

This repository is an npm workspace with two product surfaces:

- `cap-n8n-plugin/` - CAP plugin and service implementations for CAP to n8n workflow starts.
- `cap-n8n-node/` - n8n community node package for CAP OData access: credentials, metadata discovery, Query, Read, Create, Update, Delete, Action/Function, composite keys, response cleanup, and sanitized errors.
- `demo-app/` - demo SAP CAP Bookshop application used as integration evidence.

## Prerequisites

- Node.js 20 or 24 (recommended). The locked `@sap/cds` dependency requires Node 20–24; Node 25+ or newer may cause native addon incompatibilities (for example `better-sqlite3`).
  
Note: If you are running a newer Node.js (25/26+), native modules such as `better-sqlite3` may be incompatible with prebuilt binaries. Prefer switching to Node 20 or 24 (using nvm or similar). As a fallback you can attempt to rebuild the native module locally (Windows users need the appropriate build tools):

```bash
npm rebuild better-sqlite3 --build-from-source
```

If rebuild fails or you prefer not to build native addons, install Node 20 or 24 and re-run `npm install`.
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
npm run agent:startup
npm run agent:startup -- --check
npm run agent:startup -- --workflow "stock update discord msg test workflow"
npm run review:local
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
- `npm run agent:startup` - runs the agent startup routine. It checks Node/npm/Docker, prepares the local n8n custom node, starts the custom-node n8n review profile, imports `stock update discord msg test workflow`, starts CAP, polls CAP and n8n endpoints, and prints the browser handoff.
- `npm run agent:startup -- --check` - runs the same prerequisite checks without starting services.
- `npm run review:local` - runs the deterministic automated release-readiness command. It covers tests, workflow annotation validation, CAP compile with generated workflow artifacts, and warning classification. It does not run browser/manual n8n UAT.
- `npm run smoke` - builds the n8n node package and verifies package boundaries.
- `npm run test:integration` - runs CAP plugin integration tests without Docker n8n.
- `npm test` - runs smoke plus integration tests.
- `npm test --workspaces --if-present` - runs workspace package-level checks.
- `npm run n8n:workflow:import -- ...` - imports sanitized workflow artifacts into a CAP app through the package CLI.
- `npm run n8n:workflow:validate -- --app demo-app` - validates CAP workflow annotations against generated app-local n8n artifacts.
- `npm run n8n:up` - starts local n8n through Docker Compose.
- `npm run n8n:import` / `npm run n8n:export` - sync shared workflow fixtures in `test-workflows/`.

## Manual Testing

Step-by-step manual test procedures and the local review environment setup live in
[docs/manual-testing.md](docs/manual-testing.md).

Configuration starts from the root [.env.example](.env.example). It is grouped by run path: CAP demo/mock, local n8n webhook, real n8n custom-node E2E, cancellation stop API, cloud n8n, and BTP advisory placeholders. Copy values into your shell or ignored local environment files only; do not commit real API keys, Basic auth headers, OAuth client secrets, n8n owner/login values, or production tenant metadata.

Focused guides per run path:

- [Manual Visual Showcase Guide](docs/manual-visual-showcase.md) - local CAP demo, local n8n webhook, annotation-driven starts, cancellation showcase, and presenter checklist.
- [Local n8n Custom-Node E2E Runbook](docs/local-n8n-custom-node-e2e.md) - real n8n custom-node E2E with the local `SAP CAP` node.
- [Cloud n8n Runbook](docs/cloud-n8n-runbook.md) - local CAP demo sending annotation webhooks to a reachable cloud n8n instance.
- [SAP BTP Deployment Advisory Guide](docs/btp-deployment-guide.md) - Cloud Foundry and Kyma considerations for routing, credentials, connectivity, and secrets.
- [Release Readiness Evidence](docs/release-readiness.md) - requirement, story, fixture, command, and manual evidence traceability.

Run paths are intentionally separate:

- Local CAP demo and mock/test commands are automated and local-first.
- `npm run review:local` is automated review evidence only.
- Real n8n custom-node E2E and cancellation browser checks remain checklist evidence until a reviewer completes them. If they have not been run in the current review environment, record `manual UAT required`.
- Cloud n8n has a concrete local-CAP-to-cloud-n8n runbook, but runtime validation remains manual UAT until a reviewer completes it against a real cloud n8n instance.
- BTP guidance is advisory and does not claim Cloud Foundry or Kyma runtime validation.

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

## Enabling Workflow Cancellation

To cancel a running workflow (via `@n8n.workflow.cancel` or `n8n.cancel()`), the plugin needs the n8n **execution ID**. n8n only provides that ID if the workflow returns it in the webhook response.

**Required setup in n8n:** add a **Respond to Webhook** node to the workflow and return the execution ID:

```json
{ "executionId": "{{ $execution.id }}" }
```

Without this node, starting workflows still works normally — but a cancel has no execution to stop and is logged as a no-op warning.

A ready-made example workflow is included: import [test-workflows/cap-stock-alert-discord-ai-cancellable.json](test-workflows/cap-stock-alert-discord-ai-cancellable.json) through **Import from File** in the n8n editor. It sends a low-stock Discord alert via an AI agent, and it already responds with the execution ID and waits, so cancellation can be tested with the same workflow. Add your own Google Gemini and Discord credentials to those nodes before running it.

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

README.md covers installation, configuration, and usage. Step-by-step manual test procedures live in [docs/manual-testing.md](docs/manual-testing.md) - update whichever file the change belongs to.

Keep the docs current in the same change whenever you add or change:

- root npm scripts or workspace commands
- CAP/n8n configuration fields
- required environment variables
- manual setup steps
- manual or automated verification commands
- local n8n workflow import/export behavior
