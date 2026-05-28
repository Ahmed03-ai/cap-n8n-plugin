# External Integrations

**Analysis Date:** 2026-05-28

## APIs & External Services

**Workflow Automation:**
- n8n - CAP business events trigger n8n workflows through HTTP webhook calls.
  - SDK/Client: Native `fetch` in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
  - Auth: Optional `N8N_API_KEY` via `demo-app/package.json` `cds.requires.n8n.credentials.apiKey`, sent as `X-N8N-API-KEY` by `cap-n8n-plugin/lib/N8nWorkflowService.js`.
  - Base URL: `cds.requires.n8n.credentials.baseUrl` in `demo-app/package.json`, with fallback `http://localhost:5678` in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
  - Local runtime: `docker-compose.yml` runs `n8nio/n8n:latest` on port `5678`.

**SAP CAP / OData:**
- CAP OData V4 services - The demo app exposes `AdminService` and `CatalogService`.
  - SDK/Client: `@sap/cds` in `demo-app/package.json`.
  - Auth: CAP authorization annotations in `demo-app/srv/access-control.cds` and `demo-app/srv/cat-service.cds`.
  - Endpoints: `demo-app/app/*/webapp/manifest.json` references `odata/v4/admin/` and `odata/v4/catalog/`.

**SAP UI5 CDN:**
- SAPUI5 and Fiori launchpad sandbox - Local HTML shell loads SAP-hosted resources.
  - SDK/Client: Browser scripts from `https://ui5.sap.com` in `demo-app/app/fiori-apps.html`.
  - Auth: Not applicable.

## Data Storage

**Databases:**
- CAP development SQLite
  - Connection: CAP default development persistence through `@cap-js/sqlite` in `demo-app/package.json`; no explicit database URL or external database binding detected.
  - Client: `@cap-js/sqlite` locked at `2.4.0` in `package-lock.json` and `demo-app/package-lock.json`.
  - Schema: `demo-app/db/schema.cds`.
  - Seed data: CSV files in `demo-app/db/data/*.csv`.

**File Storage:**
- Local n8n data directory - `docker-compose.yml` mounts `./.n8n-data:/home/node/.n8n`; `.gitignore` excludes `.n8n-data/`.
- Shared workflow fixtures - `docker-compose.yml` mounts `./test-workflows:/test-workflows`; root `package.json` imports and exports `test-workflows/workflows.json`.

**Caching:**
- None detected.

## Authentication & Identity

**Auth Provider:**
- CAP built-in authorization annotations
  - Implementation: `demo-app/srv/access-control.cds` annotates `AdminService` with `@requires: 'admin'`; `demo-app/srv/cat-service.cds` marks `submitOrder` with `@requires: 'authenticated-user'`.
  - No XSUAA, Passport, OAuth middleware, or external identity provider configuration detected.

**n8n Authentication:**
- Optional API key header for webhook calls.
  - Implementation: `cap-n8n-plugin/lib/N8nWorkflowService.js` adds `X-N8N-API-KEY` when `apiKey` is configured.
  - Configuration: `demo-app/package.json` maps `apiKey` to `{env.N8N_API_KEY}`.
  - Local Docker: `docker-compose.yml` sets `N8N_USER_MANAGEMENT_DISABLED=true` for the local n8n container.

**Manual Testing Authentication:**
- `demo-app/test.http` sends a Basic Auth header to the CAP admin endpoint for local manual testing.

## Monitoring & Observability

**Error Tracking:**
- None detected.

**Logs:**
- CAP logging via `cds.log('n8n')` in `cap-n8n-plugin/cds-plugin.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, and `demo-app/srv/admin-service.js`.
- n8n container logs are available through Docker Compose runtime, but no log aggregation or external observability service is configured.

## CI/CD & Deployment

**Hosting:**
- Local development only in repository configuration.
- CAP app runs locally on port `3000` from `demo-app/package.json`.
- n8n runs locally on port `5678` from `docker-compose.yml`.
- SAP BTP is referenced in `N8N_REQUIREMENTS.md` and `cap_n8n_requirements_v2.md`, but deployment descriptors are not present.

**CI Pipeline:**
- None detected. No `.github` workflow files or other CI configuration were found.

## Environment Configuration

**Required env vars:**
- `N8N_API_KEY` - Optional n8n API key referenced by `demo-app/package.json`; required only when the target n8n webhook expects the `X-N8N-API-KEY` header.

**Configuration keys:**
- `cds.requires.n8n.impl` - Service implementation path in `demo-app/package.json`, defaulted by `cap-n8n-plugin/cds-plugin.js`.
- `cds.requires.n8n.credentials.baseUrl` - n8n base URL in `demo-app/package.json`.
- `cds.requires.n8n.credentials.apiKey` - n8n API key expression in `demo-app/package.json`.
- `cds.server.port` - CAP server port `3000` in `demo-app/package.json`.
- `N8N_HOST`, `N8N_PORT`, `N8N_PROTOCOL`, `WEBHOOK_URL`, and `N8N_USER_MANAGEMENT_DISABLED` - local n8n container settings in `docker-compose.yml`.

**Secrets location:**
- Secret values are expected from environment variables, especially `N8N_API_KEY`.
- `.env` is not present; `.gitignore` excludes `.env`.
- No `.env.example` file detected.

## Webhooks & Callbacks

**Incoming:**
- CAP OData endpoint `POST /odata/v4/admin/Books` is used by `demo-app/test.http` to create a book and trigger the integration.
- n8n webhook path `webhook-test/cap-test-trigger` is sent from `demo-app/srv/admin-service.js`.

**Outgoing:**
- CAP to n8n HTTP POST from `cap-n8n-plugin/lib/N8nWorkflowService.js`.
  - URL construction: `${baseUrl}/${workflowId}` with automatic `webhook/` prefix unless the path starts with `webhook/` or `webhook-test/`.
  - Payload: JSON `inputs` from `demo-app/srv/admin-service.js`, including `event`, `bookId`, and `title`.
  - Headers: `Content-Type: application/json` and optional `X-N8N-API-KEY`.

**Workflow Synchronization:**
- Root `package.json` imports workflows with `npm run n8n:import`.
- Root `package.json` exports workflows with `npm run n8n:export`.
- Workflow fixture: `test-workflows/workflows.json`.

---

*Integration audit: 2026-05-28*
