# Technology Stack

**Analysis Date:** 2026-05-28

## Languages

**Primary:**
- JavaScript CommonJS - Runtime code in `cap-n8n-plugin/cds-plugin.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/lib/MockN8nWorkflowService.js`, `cap-n8n-plugin/lib/config.js`, `demo-app/srv/admin-service.js`, and `demo-app/srv/cat-service.js`.
- CDS / CDL - SAP CAP domain, service, authorization, and Fiori annotation models in `demo-app/db/schema.cds`, `demo-app/srv/*.cds`, and `demo-app/app/**/*.cds`.

**Secondary:**
- JSON - npm manifests and SAP UI5/Fiori manifests in `package.json`, `demo-app/package.json`, `demo-app/app/*/webapp/manifest.json`, and `test-workflows/workflows.json`.
- HTML - Local SAP Fiori launchpad sandbox and mockups in `demo-app/app/fiori-apps.html` and `mockups/n8n-node-mockup.html`.
- Properties files - UI text bundles in `demo-app/_i18n/*.properties` and `demo-app/app/*/webapp/i18n/*.properties`.
- HTTP request file - Manual workflow trigger request in `demo-app/test.http`.

## Runtime

**Environment:**
- Node.js - The installed local runtime during analysis is `v24.16.0`; `@sap/cds` 9.9.1 declares `node >=20` in `package-lock.json`.
- README prerequisite says Node.js `v18+` in `README.md`; use Node 20+ to satisfy the locked CAP dependency.
- Docker Engine / Docker Compose - Required for the local n8n service in `docker-compose.yml` and documented in `README.md`.

**Package Manager:**
- npm `11.13.0` observed locally.
- Lockfile: `package-lock.json` present at repo root with lockfileVersion 3.
- Additional lockfile: `demo-app/package-lock.json` is present and locks the same CAP demo dependencies.
- Workspaces: root `package.json` declares npm workspaces `demo-app`, `cap-n8n-plugin`, and `cap-n8n-node`.

## Frameworks

**Core:**
- SAP Cloud Application Programming Model `@sap/cds` 9.9.1 - CAP services, CDS model compilation, OData endpoints, service handlers, and logging. Used by `demo-app/package.json`, `demo-app/srv/*.js`, `demo-app/**/*.cds`, `cap-n8n-plugin/cds-plugin.js`, and `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Express 5.2.1 - Transitive HTTP server dependency of `@sap/cds`, locked in `package-lock.json`.
- SAP Fiori Elements / SAPUI5 - UI layer using `sap.fe.templates.ListReport` and `sap.fe.templates.ObjectPage` in `demo-app/app/browse/webapp/manifest.json`, `demo-app/app/admin-books/webapp/manifest.json`, `demo-app/app/admin-authors/webapp/manifest.json`, and `demo-app/app/genres/webapp/manifest.json`.
- n8n Docker image `n8nio/n8n:latest` - Local workflow automation runtime in `docker-compose.yml`.

**Testing:**
- Vitest 4.1.7 - Root smoke and integration tests run through `npm run smoke`, `npm run test:integration`, and aggregate `npm test`. Integration coverage includes `test/integration/n8n-service-contract.test.js`, `test/integration/n8n-mock-and-profiles.test.js`, and `test/integration/n8n-webhook-runtime.test.js`; smoke coverage lives in `test/smoke/package-boundaries.test.js`.
- Manual HTTP testing uses `demo-app/test.http`.
- Shared n8n workflow fixtures live in `test-workflows/workflows.json`.

**Build/Dev:**
- CAP CLI commands - `demo-app/package.json` uses `cds-serve`; `README.md` instructs running `cds watch`, which requires `@sap/cds-dk` installed globally or otherwise available.
- Docker Compose - root `package.json` scripts `n8n:import` and `n8n:export` call `docker compose exec n8n ...` to sync `test-workflows/workflows.json`.
- SAP UI5 CDN - `demo-app/app/fiori-apps.html` loads `https://ui5.sap.com/test-resources/sap/ushell/bootstrap/sandbox.js` and `https://ui5.sap.com/resources/sap-ui-core.js` for the local launchpad shell.

## Key Dependencies

**Critical:**
- `@sap/cds` `^9.9.1` / locked `9.9.1` - Required for CAP services, CDS models, OData V4 exposure, service connection via `cds.connect.to('n8n')`, and `cds.log('n8n')`.
- `cap-n8n-plugin` `*` - Local workspace dependency consumed by `demo-app/package.json`; implements CAP-to-n8n workflow triggering in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Global `fetch` - Used directly in `cap-n8n-plugin/lib/N8nWorkflowService.js`; requires a Node runtime with built-in Fetch support.
- `@cap-js/sqlite` `^2.4` / locked `2.4.0` - CAP development persistence adapter declared in `demo-app/package.json`.

**Infrastructure:**
- `better-sqlite3` locked `12.10.0` - Transitive native SQLite driver through `@cap-js/sqlite`, locked in `package-lock.json`.
- `express` locked `5.2.1` - HTTP transport dependency through `@sap/cds`, locked in `package-lock.json`.
- `n8nio/n8n:latest` - Dockerized n8n runtime in `docker-compose.yml`.

## Configuration

**Environment:**
- CAP configuration lives in `demo-app/package.json` under `cds.requires.n8n`.
- The n8n service binding uses `kind: "webhook"`, `baseUrl: "http://localhost:5678"`, and `apiKey: "{env.N8N_API_KEY}"` in `demo-app/package.json`.
- The plugin provides a fallback CAP service implementation by resolving `cds.env.requires.n8n.kind` to mock or webhook in `cap-n8n-plugin/cds-plugin.js`.
- `cap-n8n-plugin/lib/N8nWorkflowService.js` validates webhook configuration through `cap-n8n-plugin/lib/config.js`; webhook mode requires `baseUrl`.
- `.env` files are not present in the repo scan; `.gitignore` excludes `.env`.

**Build:**
- `package.json` - npm workspaces and n8n import/export scripts.
- `demo-app/package.json` - CAP app dependencies, `cds-serve` start script, CAP `cds.requires.n8n` configuration, and server port `3000`.
- `docker-compose.yml` - local n8n container, port `5678`, local data mount `.n8n-data`, and workflow fixture mount `test-workflows`.
- No `tsconfig.json`, bundler config, ESLint config, Prettier config, Vite config, Jest config, or Vitest config detected; Vitest is invoked directly from root scripts/commands.

## Platform Requirements

**Development:**
- Use Node.js 20+ for compatibility with locked `@sap/cds` 9.9.1.
- Use npm workspaces from root `package.json`.
- Install CAP CLI tooling such as `@sap/cds-dk` for `cds watch` and `cds-serve` workflows referenced by `README.md` and `demo-app/package.json`.
- Use Docker Compose to run local n8n at `http://localhost:5678` from `docker-compose.yml`.
- Keep local n8n persistence under `.n8n-data/`; `.gitignore` excludes this directory.

**Production:**
- Production deployment target is not implemented in repository config.
- Requirements documents mention SAP BTP deployment patterns in `N8N_REQUIREMENTS.md` and `cap_n8n_requirements_v2.md`, but no `mta.yaml`, Cloud Foundry manifest, Helm chart, or production Dockerfile is present.
- The implemented runtime assumes CAP OData endpoints plus an externally reachable n8n webhook base URL configured through `cds.requires.n8n`.

---

*Stack analysis: 2026-05-28*
