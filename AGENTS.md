<!-- GSD:project-start source:PROJECT.md -->
## Project

**CAP n8n Integration**

CAP n8n Integration is a developer-focused project that connects SAP CAP applications with n8n workflow automation. It has two product surfaces: a CAP plugin for triggering and managing n8n workflows from CAP, and an n8n community node for reading from and writing to CAP OData services.

The current repository is a brownfield prototype: it already contains a CAP demo app, a minimal CAP-to-n8n service implementation, local n8n Docker setup, exported workflow fixtures, n8n-node mockups, and a requirements document prepared for supervisor review.

**Core Value:** CAP developers can add reliable n8n workflow automation to CAP applications without repeatedly hand-writing integration glue.

### Constraints

- **Tech stack**: Use JavaScript CommonJS, SAP CAP, CDS/CDL, npm workspaces, Docker Compose, and n8n community-node conventions already present in the repo.
- **Runtime**: Use Node.js 20+ because the locked `@sap/cds` dependency requires a modern Node runtime.
- **Testing**: Supervisor feedback requires integration tests rather than unit-test wording in requirements and planning artifacts.
- **Developer UX**: The primary user is a CAP developer, so technical detail is acceptable when it clarifies expected behavior.
- **n8n UI influence**: The project can influence node modes, field labels, credential fields, validation, descriptions, dropdowns, and node properties, but it should stay within n8n node-editor conventions.
- **Security**: Secrets must stay in environment configuration; generated docs and fixtures must not commit API keys, private keys, or real production credentials.
- **Brownfield state**: Existing demo behavior should not be mistaken for finished plugin behavior. Reusable behavior belongs in `cap-n8n-plugin` and `cap-n8n-node`, not only in `demo-app`.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript CommonJS - Runtime code in `cap-n8n-plugin/cds-plugin.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`, and `demo-app/srv/cat-service.js`.
- CDS / CDL - SAP CAP domain, service, authorization, and Fiori annotation models in `demo-app/db/schema.cds`, `demo-app/srv/*.cds`, and `demo-app/app/**/*.cds`.
- JSON - npm manifests and SAP UI5/Fiori manifests in `package.json`, `demo-app/package.json`, `demo-app/app/*/webapp/manifest.json`, and `test-workflows/workflows.json`.
- HTML - Local SAP Fiori launchpad sandbox and mockups in `demo-app/app/fiori-apps.html` and `mockups/n8n-node-mockup.html`.
- Properties files - UI text bundles in `demo-app/_i18n/*.properties` and `demo-app/app/*/webapp/i18n/*.properties`.
- HTTP request file - Manual workflow trigger request in `demo-app/test.http`.
## Runtime
- Node.js - The installed local runtime during analysis is `v24.16.0`; `@sap/cds` 9.9.1 declares `node >=20` in `package-lock.json`.
- README prerequisite says Node.js `v18+` in `README.md`; use Node 20+ to satisfy the locked CAP dependency.
- Docker Engine / Docker Compose - Required for the local n8n service in `docker-compose.yml` and documented in `README.md`.
- npm `11.13.0` observed locally.
- Lockfile: `package-lock.json` present at repo root with lockfileVersion 3.
- Additional lockfile: `demo-app/package-lock.json` is present and locks the same CAP demo dependencies.
- Workspaces: root `package.json` declares npm workspaces `demo-app`, `cap-n8n-plugin`, and `cap-n8n-node`.
## Frameworks
- SAP Cloud Application Programming Model `@sap/cds` 9.9.1 - CAP services, CDS model compilation, OData endpoints, service handlers, and logging. Used by `demo-app/package.json`, `demo-app/srv/*.js`, `demo-app/**/*.cds`, `cap-n8n-plugin/cds-plugin.js`, and `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Express 5.2.1 - Transitive HTTP server dependency of `@sap/cds`, locked in `package-lock.json`.
- SAP Fiori Elements / SAPUI5 - UI layer using `sap.fe.templates.ListReport` and `sap.fe.templates.ObjectPage` in `demo-app/app/browse/webapp/manifest.json`, `demo-app/app/admin-books/webapp/manifest.json`, `demo-app/app/admin-authors/webapp/manifest.json`, and `demo-app/app/genres/webapp/manifest.json`.
- n8n Docker image `n8nio/n8n:latest` - Local workflow automation runtime in `docker-compose.yml`.
- No automated test runner detected in `package.json`, `demo-app/package.json`, `cap-n8n-plugin/package.json`, or `cap-n8n-node/package.json`.
- Manual HTTP testing uses `demo-app/test.http`.
- Shared n8n workflow fixtures live in `test-workflows/workflows.json`.
- CAP CLI commands - `demo-app/package.json` uses `cds-serve`; `README.md` instructs running `cds watch`, which requires `@sap/cds-dk` installed globally or otherwise available.
- Docker Compose - root `package.json` scripts `n8n:import` and `n8n:export` call `docker compose exec n8n ...` to sync `test-workflows/workflows.json`.
- SAP UI5 CDN - `demo-app/app/fiori-apps.html` loads `https://ui5.sap.com/test-resources/sap/ushell/bootstrap/sandbox.js` and `https://ui5.sap.com/resources/sap-ui-core.js` for the local launchpad shell.
## Key Dependencies
- `@sap/cds` `^9.9.1` / locked `9.9.1` - Required for CAP services, CDS models, OData V4 exposure, service connection via `cds.connect.to('n8n')`, and `cds.log('n8n')`.
- `cap-n8n-plugin` `*` - Local workspace dependency consumed by `demo-app/package.json`; implements CAP-to-n8n workflow triggering in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Global `fetch` - Used directly in `cap-n8n-plugin/lib/N8nWorkflowService.js`; requires a Node runtime with built-in Fetch support.
- `@cap-js/sqlite` `^2.4` / locked `2.4.0` - CAP development persistence adapter declared in `demo-app/package.json`.
- `better-sqlite3` locked `12.10.0` - Transitive native SQLite driver through `@cap-js/sqlite`, locked in `package-lock.json`.
- `express` locked `5.2.1` - HTTP transport dependency through `@sap/cds`, locked in `package-lock.json`.
- `n8nio/n8n:latest` - Dockerized n8n runtime in `docker-compose.yml`.
## Configuration
- CAP configuration lives in `demo-app/package.json` under `cds.requires.n8n`.
- The n8n service binding uses `baseUrl: "http://localhost:5678"` and `apiKey: "{env.N8N_API_KEY}"` in `demo-app/package.json`.
- The plugin provides a fallback CAP service implementation by setting `cds.env.requires.n8n.impl` in `cap-n8n-plugin/cds-plugin.js`.
- `cap-n8n-plugin/lib/N8nWorkflowService.js` defaults `baseUrl` to `http://localhost:5678` if no credential or option is configured.
- `.env` files are not present in the repo scan; `.gitignore` excludes `.env`.
- `package.json` - npm workspaces and n8n import/export scripts.
- `demo-app/package.json` - CAP app dependencies, `cds-serve` start script, CAP `cds.requires.n8n` configuration, and server port `3000`.
- `docker-compose.yml` - local n8n container, port `5678`, local data mount `.n8n-data`, and workflow fixture mount `test-workflows`.
- No `tsconfig.json`, bundler config, ESLint config, Prettier config, Vite config, Jest config, or Vitest config detected.
## Platform Requirements
- Use Node.js 20+ for compatibility with locked `@sap/cds` 9.9.1.
- Use npm workspaces from root `package.json`.
- Install CAP CLI tooling such as `@sap/cds-dk` for `cds watch` and `cds-serve` workflows referenced by `README.md` and `demo-app/package.json`.
- Use Docker Compose to run local n8n at `http://localhost:5678` from `docker-compose.yml`.
- Keep local n8n persistence under `.n8n-data/`; `.gitignore` excludes this directory.
- Production deployment target is not implemented in repository config.
- Requirements documents mention SAP BTP deployment patterns in `N8N_REQUIREMENTS.md` and `cap_n8n_requirements_v2.md`, but no `mta.yaml`, Cloud Foundry manifest, Helm chart, or production Dockerfile is present.
- The implemented runtime assumes CAP OData endpoints plus an externally reachable n8n webhook base URL configured through `cds.requires.n8n`.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Use lowercase package and folder names with hyphens for npm workspace packages: `cap-n8n-plugin/`, `cap-n8n-node/`, `demo-app/`.
- Use `.js` for Node.js service implementations: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`, `demo-app/srv/cat-service.js`.
- Use `.cds` for CAP models, services, access rules, constraints, and Fiori annotations: `demo-app/db/schema.cds`, `demo-app/srv/admin-service.cds`, `demo-app/app/common.cds`.
- Use `Component.js` for SAP Fiori Elements app components under each app webapp folder: `demo-app/app/browse/webapp/Component.js`, `demo-app/app/admin-books/webapp/Component.js`.
- Use `manifest.json` for SAP UI5/Fiori app manifests: `demo-app/app/browse/webapp/manifest.json`, `demo-app/app/admin-authors/webapp/manifest.json`.
- Use `.http` for manual request scenarios: `demo-app/test.http`.
- Use camelCase for local JavaScript functions and handlers: `assignNextBookId` in `demo-app/srv/admin-service.js`.
- Use `async` handler functions for CAP events that perform I/O: `this.on('submitOrder', async req => ...)` in `demo-app/srv/cat-service.js`, `this.after('CREATE', Books, async (data, req) => ...)` in `demo-app/srv/admin-service.js`.
- Prefix internal helper methods on service classes with `_`: `_triggerWebhook(workflowId, inputs)` in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Use CAP event names as string literals in service registration calls: `this.on('start', ...)` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, `this.before('NEW', ...)` in `demo-app/srv/admin-service.js`.
- Use camelCase for JavaScript variables and destructured aliases: `safeBaseUrl`, `safePath`, `workflowId`, `responseText` in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Use capitalized entity variables for CAP entities: `Books`, `ListOfBooks` in `demo-app/srv/cat-service.js`.
- Use concise CAP request variable names in handlers: `req` in `demo-app/srv/cat-service.js` and `demo-app/srv/admin-service.js`.
- Use CDS-style snake suffixes for generated foreign key fields and localized text fields: `author_ID`, `genre_ID`, `currency_code`, `ID_texts` in `demo-app/app/common.cds` and `demo-app/app/admin-books/fiori-service.cds`.
- Use PascalCase for JavaScript classes extending CAP services: `N8nWorkflowService` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, `AdminService` in `demo-app/srv/admin-service.js`, `CatalogService` in `demo-app/srv/cat-service.js`.
- Use PascalCase for CAP entities and types: `Books`, `Authors`, `Genres`, `Price` in `demo-app/db/schema.cds`.
- Use SAP namespace-style qualified names for CAP domains: `sap.capire.bookshop` in `demo-app/db/schema.cds`.
- Use Fiori annotation vocabulary names exactly as provided by CAP/UI vocabularies: `UI.LineItem`, `Common.SemanticKey`, `ValueList`, `Core.Computed` in `demo-app/app/common.cds` and `demo-app/app/admin-books/fiori-service.cds`.
## Code Style
- Formatting tool: Not detected. No `.prettierrc*`, `.eslintrc*`, `eslint.config.*`, `biome.json`, `tsconfig.json`, or `jsconfig.json` files are present.
- JavaScript service files use two-space indentation: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`, `demo-app/srv/cat-service.js`.
- The dominant JavaScript style omits semicolons: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`, `demo-app/srv/cat-service.js`, `demo-app/app/browse/webapp/Component.js`.
- `cap-n8n-plugin/cds-plugin.js` uses semicolons; keep new plugin-service code aligned with the no-semicolon style in `cap-n8n-plugin/lib/N8nWorkflowService.js` unless editing `cap-n8n-plugin/cds-plugin.js` directly.
- Use single quotes for Node.js string literals: `require('@sap/cds')` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cds.connect.to('n8n')` in `demo-app/srv/admin-service.js`.
- UI5 `Component.js` files use double quotes for SAP module dependency arrays and single quotes inside metadata: `demo-app/app/admin-books/webapp/Component.js`.
- CDS files use semicolon terminators for declarations and annotations: `demo-app/db/schema.cds`, `demo-app/srv/admin-service.cds`, `demo-app/app/common.cds`.
- Align CDS entity fields and annotations for readability where existing files use column alignment: `demo-app/db/schema.cds`, `demo-app/app/common.cds`.
- Lint tool: Not detected.
- `@eslint/js` appears only as a transitive/peer package inside `package-lock.json` and `demo-app/package-lock.json`; no project lint script or ESLint config is present.
- Do not assume lint rules beyond existing runtime syntax. Match the local JavaScript and CDS style in the file being edited.
## Import Organization
- No JavaScript path aliases are configured.
- Use relative CommonJS paths for local JavaScript modules: `require.resolve('./lib/N8nWorkflowService.js')` in `cap-n8n-plugin/cds-plugin.js`.
- Use CDS relative imports between model layers: `using {sap.capire.bookshop as my} from '../db/schema';` in `demo-app/srv/admin-service.cds`, `using { AdminService } from '../../srv/admin-service';` in `demo-app/app/admin-books/fiori-service.cds`.
- Use SAP package imports directly in CDS: `using { sap } from '@sap/cds/common';` in `demo-app/db/currencies.cds`, `using { sap.common } from '@sap/cds/common';` in `demo-app/app/common.cds`.
## Error Handling
- Use `req.error(status, message)` for CAP request validation failures that should become protocol errors: `demo-app/srv/cat-service.js`.
- Throw `Error` after enriching failed external HTTP responses with status and response text: `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Log and rethrow failures in reusable service implementations so callers can observe failure: `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Log and suppress non-critical side-effect failures when the primary CAP mutation should complete: `demo-app/srv/admin-service.js` catches n8n notification failures after `CREATE`.
- Return fallback success objects for accepted non-JSON n8n webhook responses: `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Keep validation close to the CAP handler that owns the business operation: stock and quantity checks live in `demo-app/srv/cat-service.js`.
## Logging
- Use namespaced CAP loggers for integration logs: `cds.log('n8n')` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/cds-plugin.js`, and `demo-app/srv/admin-service.js`.
- Use `.info()` for successful lifecycle and integration events: plugin bootstrap in `cap-n8n-plugin/cds-plugin.js`, n8n notification success in `demo-app/srv/admin-service.js`.
- Use `.warn()` for degraded configuration: missing n8n `baseUrl` in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Use `.error()` before throwing or when side-effect notification fails: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`.
- No `console.*` logging is present in source files; use `cds.log(...)` for new runtime code.
## Comments
- Comment non-obvious integration behavior and compatibility choices: webhook path normalization in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Comment CAP/Fiori workarounds where the model needs context: draft-enabled localized text handling in `demo-app/db/schema.cds`, UUID create popup workaround in `demo-app/app/admin-books/fiori-service.cds`.
- Use section dividers in large annotation files to separate UI areas: `demo-app/app/common.cds`, `demo-app/app/admin-books/fiori-service.cds`, `demo-app/app/browse/fiori-service.cds`.
- Keep comments short and tied to the nearby behavior; avoid restating simple assignments.
- JSDoc is used as short block comments for CAP handler intent, not for type documentation: `demo-app/srv/admin-service.js`.
- TSDoc is not applicable because the repo contains JavaScript and CDS, not TypeScript.
- Use JSDoc-style comments only when they label a handler group or workflow behavior, such as `Generate IDs for new Books drafts` in `demo-app/srv/admin-service.js`.
## Function Design
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
|                    npm workspace root                       |
|                    `package.json`                           |
| CAP plugin        | Demo CAP app      | n8n node package    |
| `cap-n8n-plugin`  | `demo-app`        | `cap-n8n-node`      |
| CAP runtime and OData services                              |
| `demo-app/db/schema.cds`, `demo-app/srv/*.cds`,             |
| `demo-app/srv/*.js`, `demo-app/app/**/fiori-service.cds`    |
| n8n webhook service adapter                                  |
| `cap-n8n-plugin/lib/N8nWorkflowService.js`                  |
| Local n8n workflow endpoint and shared workflow JSON         |
| `test-workflows/workflows.json`                             |
```
## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| Workspace root | Declares npm workspaces and root workflow import/export scripts. | `package.json` |
| CAP plugin bootstrap | Registers a default `cds.env.requires.n8n.impl` during CAP bootstrap when the plugin is loaded. | `cap-n8n-plugin/cds-plugin.js` |
| n8n workflow service | Implements the CAP service class used by `cds.connect.to('n8n')`, exposes a `start` event, normalizes webhook paths, posts JSON to n8n, and returns parsed webhook responses. | `cap-n8n-plugin/lib/N8nWorkflowService.js` |
| Plugin package entry | Package `main` target; currently an empty file, so plugin behavior comes from `cds-plugin.js` or explicit service binding. | `cap-n8n-plugin/index.js` |
| n8n node package entry | Package `main` target for the planned n8n community node; currently empty. | `cap-n8n-node/index.js` |
| Demo app configuration | Binds the demo app to the plugin service implementation, configures n8n credentials, and sets the CAP server port. | `demo-app/package.json` |
| Domain model | Owns Bookshop persistence entities, localized fields, associations, code lists, and Fiori draft annotations. | `demo-app/db/schema.cds` |
| Admin OData model | Exposes editable projections of `Authors`, `Books`, and `Genres`. | `demo-app/srv/admin-service.cds` |
| Admin OData implementation | Generates book IDs and notifies n8n after Book creation. | `demo-app/srv/admin-service.js` |
| Catalog OData model | Exposes read-oriented book projections and the `submitOrder` action. | `demo-app/srv/cat-service.cds` |
| Catalog OData implementation | Applies list display enrichment, validates orders, updates stock, and emits `OrderedBook`. | `demo-app/srv/cat-service.js` |
| Fiori app annotations | Adds UI annotations and app-specific draft/value-help behavior for Fiori Elements apps. | `demo-app/app/**/fiori-service.cds` |
| UI5 app shells | Minimal Fiori Elements `AppComponent` definitions that load manifests. | `demo-app/app/**/webapp/Component.js` |
| UI5 manifests | Bind UI apps to `odata/v4/admin/` or `odata/v4/catalog/` and define ListReport/ObjectPage routing. | `demo-app/app/**/webapp/manifest.json` |
| Shared workflow artifact | Stores exported n8n workflow definitions used by root import/export scripts. | `test-workflows/workflows.json` |
## Pattern Overview
- Keep persistence definitions in CDS under `demo-app/db/`, expose OData projections in `demo-app/srv/`, and place behavior in matching `.js` service implementations.
- Treat `cap-n8n-plugin/lib/N8nWorkflowService.js` as the reusable integration boundary from CAP to n8n.
- Bind the reusable service through CAP configuration in `demo-app/package.json` using `cds.requires.n8n.impl`.
- Keep UI behavior declarative through Fiori annotations in `demo-app/app/**/fiori-service.cds` and manifests in `demo-app/app/**/webapp/manifest.json`.
- Keep demo n8n workflows as exported JSON under `test-workflows/`.
## Layers
- Purpose: Coordinates the three packages and shared local n8n workflow scripts.
- Location: `package.json`
- Contains: npm workspace declarations for `demo-app`, `cap-n8n-plugin`, and `cap-n8n-node`; workflow import/export scripts.
- Depends on: npm workspaces and Docker Compose command availability.
- Used by: Local development workflows and package installs.
- Purpose: Provides the reusable CAP-to-n8n service implementation.
- Location: `cap-n8n-plugin/`
- Contains: CAP bootstrap hook in `cap-n8n-plugin/cds-plugin.js`, service implementation in `cap-n8n-plugin/lib/N8nWorkflowService.js`, package entry in `cap-n8n-plugin/index.js`.
- Depends on: `@sap/cds` at runtime from the consuming CAP app and global `fetch` from the Node runtime.
- Used by: `demo-app/package.json` through `cds.requires.n8n.impl` and by `demo-app/srv/admin-service.js` through `cds.connect.to('n8n')`.
- Purpose: Reserves the package boundary for n8n-to-CAP node functionality.
- Location: `cap-n8n-node/`
- Contains: `cap-n8n-node/package.json` and empty `cap-n8n-node/index.js`.
- Depends on: Not detected in current package metadata.
- Used by: Root npm workspace only.
- Purpose: Defines the Bookshop entities persisted by CAP.
- Location: `demo-app/db/`
- Contains: `demo-app/db/schema.cds`, `demo-app/db/currencies.cds`, and CSV seed data under `demo-app/db/data/`.
- Depends on: `@sap/cds/common` and CAP model compiler.
- Used by: `demo-app/srv/admin-service.cds`, `demo-app/srv/cat-service.cds`, and app annotations under `demo-app/app/`.
- Purpose: Defines OData service surfaces and service-level constraints.
- Location: `demo-app/srv/`
- Contains: `demo-app/srv/admin-service.cds`, `demo-app/srv/cat-service.cds`, `demo-app/srv/admin-constraints.cds`, `demo-app/srv/access-control.cds`.
- Depends on: `demo-app/db/schema.cds`.
- Used by: CAP runtime, UI5 manifests, and Fiori annotation files.
- Purpose: Adds imperative behavior around CAP lifecycle events and actions.
- Location: `demo-app/srv/*.js`
- Contains: `demo-app/srv/admin-service.js` and `demo-app/srv/cat-service.js`.
- Depends on: `@sap/cds`, CAP query APIs (`SELECT`, `UPDATE`), and the configured n8n service.
- Used by: CAP runtime when serving `AdminService` and `CatalogService`.
- Purpose: Describes Fiori Elements UIs and binds them to OData services.
- Location: `demo-app/app/`
- Contains: shared annotations in `demo-app/app/common.cds`, app registration in `demo-app/app/services.cds`, app-specific annotations under `demo-app/app/*/fiori-service.cds`, UI5 manifests and components under `demo-app/app/*/webapp/`.
- Depends on: `demo-app/srv/admin-service.cds`, `demo-app/srv/cat-service.cds`, and `demo-app/db/schema.cds`.
- Used by: SAP Fiori launch/sandbox and CAP app serving.
- Purpose: Stores n8n workflow exports for local import.
- Location: `test-workflows/`
- Contains: `test-workflows/workflows.json`.
- Depends on: Root scripts in `package.json`.
- Used by: `npm run n8n:import` and `npm run n8n:export`.
## Data Flow
### Primary Request Path
### Catalog Order Flow
### Fiori App Flow
- Persistent business state lives in CAP entities from `demo-app/db/schema.cds` and CSV seeds in `demo-app/db/data/`.
- Draft state is managed by CAP/Fiori through `@odata.draft.enabled` and `@fiori.draft.enabled` annotations in `demo-app/app/admin-books/fiori-service.cds:79`, `demo-app/app/admin-authors/fiori-service.cds:3`, and `demo-app/db/schema.cds:48`.
- Runtime n8n configuration is stored on each service instance as `this.baseUrl` and `this.apiKey` in `cap-n8n-plugin/lib/N8nWorkflowService.js:6`.
- `cds.env.requires.n8n` is module-level CAP runtime configuration mutated by `cap-n8n-plugin/cds-plugin.js:3`.
## Key Abstractions
- Purpose: Encapsulate outbound n8n webhook calls behind a CAP service interface.
- Examples: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/package.json`, `demo-app/srv/admin-service.js`.
- Pattern: Extend `cds.Service`, register event handlers in `init()`, and call through `cds.connect.to('n8n')`.
- Purpose: Pair declarative service definitions with imperative event/action handlers.
- Examples: `demo-app/srv/admin-service.cds` with `demo-app/srv/admin-service.js`, and `demo-app/srv/cat-service.cds` with `demo-app/srv/cat-service.js`.
- Pattern: Define projections/actions in CDS and export a class extending `cds.ApplicationService`.
- Purpose: Shape persistence entities into OData-facing service models.
- Examples: `demo-app/srv/admin-service.cds`, `demo-app/srv/cat-service.cds`.
- Pattern: `entity X as projection on my.X` with selective exclusions and annotations.
- Purpose: Keep UI layout, value help, hierarchy, draft, and field metadata declarative.
- Examples: `demo-app/app/common.cds`, `demo-app/app/admin-books/fiori-service.cds`, `demo-app/app/genres/tree-view.cds`, `demo-app/app/genres/value-help.cds`.
- Pattern: `annotate` and `extend` existing CAP entities/services rather than placing UI metadata in JavaScript.
- Purpose: Minimal UI components that defer UI composition to manifest routing and annotations.
- Examples: `demo-app/app/admin-books/webapp/Component.js`, `demo-app/app/browse/webapp/Component.js`, `demo-app/app/admin-authors/webapp/Component.js`, `demo-app/app/genres/webapp/Component.js`.
- Pattern: `sap.ui.define(["sap/fe/core/AppComponent"], ac => ac.extend(...))` with manifest metadata.
## Entry Points
- Location: `package.json`
- Triggers: `npm install`, `npm run n8n:import`, `npm run n8n:export`.
- Responsibilities: Declares package workspaces and n8n workflow import/export commands.
- Location: `cap-n8n-plugin/cds-plugin.js`
- Triggers: CAP plugin loading and `cds.once('bootstrap')`.
- Responsibilities: Registers the default n8n service implementation in `cds.env.requires.n8n`.
- Location: `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Triggers: `cds.connect.to('n8n')` and `n8n.send('start', ...)`.
- Responsibilities: Reads `cds.requires.n8n` options, exposes `start`, constructs webhook URLs, sends HTTP POST requests to n8n, and handles response parsing/errors.
- Location: `demo-app/package.json`
- Triggers: `npm start` in `demo-app` or `cds watch`/`cds-serve`.
- Responsibilities: Starts CAP on port 3000 and binds the n8n service implementation.
- Location: `demo-app/srv/admin-service.cds` and `demo-app/srv/admin-service.js`
- Triggers: Admin OData requests under `odata/v4/admin/`.
- Responsibilities: Exposes editable bookshop projections, enforces admin access, generates IDs, and triggers n8n on Book creation.
- Location: `demo-app/srv/cat-service.cds` and `demo-app/srv/cat-service.js`
- Triggers: Catalog OData requests under `odata/v4/catalog/`.
- Responsibilities: Exposes read-oriented book projections and handles `submitOrder`.
- Location: `demo-app/app/*/webapp/Component.js` and `demo-app/app/*/webapp/manifest.json`
- Triggers: UI5 application launch.
- Responsibilities: Load Fiori Elements apps for browsing, administering books/authors, and displaying genres.
- Location: `cap-n8n-node/index.js`
- Triggers: Package entry if required by a consumer.
- Responsibilities: Not detected; file is empty.
## Architectural Constraints
- **Threading:** JavaScript executes on the Node.js event loop; asynchronous CAP handlers and `fetch()` calls are used in `demo-app/srv/*.js` and `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- **Global state:** `cap-n8n-plugin/cds-plugin.js` mutates `cds.env.requires.n8n`; `cap-n8n-plugin/lib/N8nWorkflowService.js` stores service configuration on each service instance.
- **Circular imports:** No JavaScript circular imports detected. CDS annotations intentionally import service/model definitions across `demo-app/app/**` and `demo-app/srv/**`.
- **Service binding:** The demo app explicitly binds `n8n.impl` to `../cap-n8n-plugin/lib/N8nWorkflowService.js` in `demo-app/package.json:20`; new consumers must provide the same CAP service binding or rely on plugin bootstrap.
- **Runtime fetch:** `cap-n8n-plugin/lib/N8nWorkflowService.js` uses global `fetch`, so runtime must provide it.
- **Secret handling:** `demo-app/package.json:23` references `{env.N8N_API_KEY}`; secrets must stay in environment configuration such as `.env`, which is ignored by `.gitignore`.
- **Generated/local data:** `node_modules/`, `.cds-services.json`, `*.log`, and `.n8n-data/` are ignored by `.gitignore` and should not be treated as source.
## Anti-Patterns
### Empty Package Entry Points
### Demo-Specific Workflow Trigger in Business Service
### Swallowed n8n Notification Errors
## Error Handling
- Use `req.error(status, message)` for OData validation in `demo-app/srv/cat-service.js:18`, `demo-app/srv/cat-service.js:19`, and `demo-app/srv/cat-service.js:20`.
- Throw normal `Error` objects for n8n HTTP failures in `cap-n8n-plugin/lib/N8nWorkflowService.js:53`.
- Log n8n transport failures with `cds.log('n8n').error(...)` in `cap-n8n-plugin/lib/N8nWorkflowService.js:65`.
- Catch and suppress best-effort notification failures in `demo-app/srv/admin-service.js:42`.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
