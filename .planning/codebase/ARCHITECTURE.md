<!-- refreshed: 2026-05-28 -->
# Architecture

**Analysis Date:** 2026-05-28

## System Overview

```text
+-------------------------------------------------------------+
|                    npm workspace root                       |
|                    `package.json`                           |
+-------------------+-------------------+---------------------+
| CAP plugin        | Demo CAP app      | n8n node package    |
| `cap-n8n-plugin`  | `demo-app`        | `cap-n8n-node`      |
+---------+---------+---------+---------+----------+----------+
          |                   |                       |
          v                   v                       v
+-------------------------------------------------------------+
| CAP runtime and OData services                              |
| `demo-app/db/schema.cds`, `demo-app/srv/*.cds`,             |
| `demo-app/srv/*.js`, `demo-app/app/**/fiori-service.cds`    |
+-----------------------------+-------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| n8n webhook service adapter                                  |
| `cap-n8n-plugin/lib/N8nWorkflowService.js`                  |
+-----------------------------+-------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Local n8n workflow endpoint and shared workflow JSON         |
| `test-workflows/workflows.json`                             |
+-------------------------------------------------------------+
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Workspace root | Declares npm workspaces and root workflow import/export scripts. | `package.json` |
| CAP plugin bootstrap | Preserves explicit `cds.env.requires.n8n.impl` values and fills missing implementations from resolved `kind: 'mock' | 'webhook'`. | `cap-n8n-plugin/cds-plugin.js` |
| Runtime config resolver | Resolves mock/webhook mode, credentials, timeout/retry defaults, and sanitized missing-`baseUrl` errors. | `cap-n8n-plugin/lib/config.js` |
| n8n workflow service | Implements the webhook CAP service used by `cds.connect.to('n8n')`, validates webhook config, exposes a `start` event, normalizes webhook paths, posts JSON to n8n, and returns parsed webhook responses. | `cap-n8n-plugin/lib/N8nWorkflowService.js` |
| Annotation registrar | Scans served CAP entities for `@n8n.workflow.start` and `@n8n.workflow.cancel`, registers configured CREATE/UPDATE/DELETE after-handlers, routes starts through the transaction-safe n8n service path, and keeps cancellation side effects non-blocking. | `cap-n8n-plugin/lib/annotations/AnnotationRegistrar.js` |
| Cancellation resolver | Queries active workflow executions by workflowId plus business key/tag and cancels all matches through Phase 3 query/cancel APIs. | `cap-n8n-plugin/lib/annotations/CancellationResolver.js` |
| Workflow artifact helpers | Normalize scalar sidecar schemas, sanitize n8n workflow JSON, build manifests, generate CDS input contracts, and write/read app-root n8n artifacts. | `cap-n8n-plugin/lib/workflows/*.js` |
| Mock n8n workflow service | Implements deterministic offline `start` behavior with in-memory start records and explicit opt-in failures. | `cap-n8n-plugin/lib/MockN8nWorkflowService.js` |
| Plugin package entry | Public package entry that exports `N8nWorkflowService`, `MockN8nWorkflowService`, and `workflowTools`; package subpaths expose webhook and mock services. | `cap-n8n-plugin/index.js` |
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
| Demo workflow artifacts | Stores deterministic sanitized workflow artifacts, scalar sidecar schema, manifest metadata, and generated CDS input contracts for the demo app. | `demo-app/n8n/**` |

## Pattern Overview

**Overall:** SAP CAP layered application with a reusable custom CAP service adapter and a demo Fiori Elements app.

**Key Characteristics:**
- Keep persistence definitions in CDS under `demo-app/db/`, expose OData projections in `demo-app/srv/`, and place behavior in matching `.js` service implementations.
- Treat `cap-n8n-plugin/lib/N8nWorkflowService.js` as the reusable integration boundary from CAP to n8n.
- Bind the reusable service through CAP configuration in `demo-app/package.json` using `cds.requires.n8n.impl`.
- Keep UI behavior declarative through Fiori annotations in `demo-app/app/**/fiori-service.cds` and manifests in `demo-app/app/**/webapp/manifest.json`.
- Keep demo n8n workflows as exported JSON under `test-workflows/`.

## Layers

**Workspace Layer:**
- Purpose: Coordinates the three packages and shared local n8n workflow scripts.
- Location: `package.json`
- Contains: npm workspace declarations for `demo-app`, `cap-n8n-plugin`, and `cap-n8n-node`; workflow import/export scripts.
- Depends on: npm workspaces and Docker Compose command availability.
- Used by: Local development workflows and package installs.

**CAP Plugin Layer:**
- Purpose: Provides the reusable CAP-to-n8n service implementation.
- Location: `cap-n8n-plugin/`
- Contains: CAP bootstrap hook in `cap-n8n-plugin/cds-plugin.js`, config resolver in `cap-n8n-plugin/lib/config.js`, webhook service implementation in `cap-n8n-plugin/lib/N8nWorkflowService.js`, declarative annotation registration under `cap-n8n-plugin/lib/annotations/`, workflow artifact helpers under `cap-n8n-plugin/lib/workflows/`, mock service implementation in `cap-n8n-plugin/lib/MockN8nWorkflowService.js`, and package entry in `cap-n8n-plugin/index.js`.
- Depends on: `@sap/cds` at runtime from the consuming CAP app and global `fetch` from the Node runtime.
- Used by: `demo-app/package.json` through `cds.requires.n8n.impl` and by `demo-app/srv/admin-service.js` through `cds.connect.to('n8n')`.

**n8n Node Layer:**
- Purpose: Reserves the package boundary for n8n-to-CAP node functionality.
- Location: `cap-n8n-node/`
- Contains: `cap-n8n-node/package.json` and empty `cap-n8n-node/index.js`.
- Depends on: Not detected in current package metadata.
- Used by: Root npm workspace only.

**Persistence Model Layer:**
- Purpose: Defines the Bookshop entities persisted by CAP.
- Location: `demo-app/db/`
- Contains: `demo-app/db/schema.cds`, `demo-app/db/currencies.cds`, and CSV seed data under `demo-app/db/data/`.
- Depends on: `@sap/cds/common` and CAP model compiler.
- Used by: `demo-app/srv/admin-service.cds`, `demo-app/srv/cat-service.cds`, and app annotations under `demo-app/app/`.

**Service Model Layer:**
- Purpose: Defines OData service surfaces and service-level constraints.
- Location: `demo-app/srv/`
- Contains: `demo-app/srv/admin-service.cds`, `demo-app/srv/cat-service.cds`, `demo-app/srv/admin-constraints.cds`, `demo-app/srv/access-control.cds`.
- Depends on: `demo-app/db/schema.cds`.
- Used by: CAP runtime, UI5 manifests, and Fiori annotation files.

**Service Implementation Layer:**
- Purpose: Adds imperative behavior around CAP lifecycle events and actions.
- Location: `demo-app/srv/*.js`
- Contains: `demo-app/srv/admin-service.js` and `demo-app/srv/cat-service.js`.
- Depends on: `@sap/cds`, CAP query APIs (`SELECT`, `UPDATE`), and the configured n8n service.
- Used by: CAP runtime when serving `AdminService` and `CatalogService`.

**Fiori Annotation and UI Layer:**
- Purpose: Describes Fiori Elements UIs and binds them to OData services.
- Location: `demo-app/app/`
- Contains: shared annotations in `demo-app/app/common.cds`, app registration in `demo-app/app/services.cds`, app-specific annotations under `demo-app/app/*/fiori-service.cds`, UI5 manifests and components under `demo-app/app/*/webapp/`.
- Depends on: `demo-app/srv/admin-service.cds`, `demo-app/srv/cat-service.cds`, and `demo-app/db/schema.cds`.
- Used by: SAP Fiori launch/sandbox and CAP app serving.

**Workflow Artifact Layer:**
- Purpose: Stores raw exported workflow fixtures plus sanitized app-local workflow artifacts and generated CAP input contracts.
- Location: `test-workflows/` and app-root `n8n/` directories such as `demo-app/n8n/`.
- Contains: `test-workflows/workflows.json`, sanitized `workflow.json`, sidecar `schema.json`, workflow `manifest.json`, aggregate `manifest.json`, and generated `index.cds`.
- Depends on: Root scripts in `package.json` for raw fixture import/export and `cap-n8n-plugin/lib/workflows/` for deterministic generated artifacts.
- Used by: `npm run n8n:import`, `npm run n8n:export`, future workflow import CLI, and future build validation.

## Data Flow

### Primary Request Path

1. A client creates a Book through the admin OData endpoint configured in `demo-app/app/admin-books/webapp/manifest.json:14` and exercisable through `demo-app/test.http:2`.
2. CAP routes the request to `AdminService.Books`, declared in `demo-app/srv/admin-service.cds:6`.
3. The admin service generates a missing Book ID in `assignNextBookId` and registers it for drafts and creates in `demo-app/srv/admin-service.js:7`, `demo-app/srv/admin-service.js:17`, and `demo-app/srv/admin-service.js:22`.
4. After Book creation, the admin service connects to the configured `n8n` service in `demo-app/srv/admin-service.js:29` and `demo-app/srv/admin-service.js:31`.
5. The demo app resolves the `n8n` service implementation from `demo-app/package.json:19` and `demo-app/package.json:20`.
6. `N8nWorkflowService` handles the `start` event in `cap-n8n-plugin/lib/N8nWorkflowService.js:14`.
7. `_triggerWebhook` normalizes the base URL and workflow path, adds JSON headers and optional API-key auth, then posts to n8n in `cap-n8n-plugin/lib/N8nWorkflowService.js:22` and `cap-n8n-plugin/lib/N8nWorkflowService.js:45`.
8. The n8n workflow receiving path `cap-test-trigger` is represented in `test-workflows/workflows.json:1`.
9. The service parses the webhook response or returns a success wrapper in `cap-n8n-plugin/lib/N8nWorkflowService.js:57`.

### Catalog Order Flow

1. `CatalogService` exposes the `submitOrder` action in `demo-app/srv/cat-service.cds:30`.
2. `demo-app/srv/cat-service.js:14` validates the book ID, quantity, and stock.
3. `demo-app/srv/cat-service.js:25` updates the persisted Book stock.
4. `demo-app/srv/cat-service.js:29` emits `OrderedBook` with the book, quantity, and user ID.

### Fiori App Flow

1. `demo-app/app/services.cds:5` imports the app-specific Fiori service annotations.
2. Each UI5 `Component.js` extends `sap/fe/core/AppComponent` and loads a JSON manifest, for example `demo-app/app/admin-books/webapp/Component.js:1`.
3. Manifests bind apps to CAP OData services, for example admin apps to `odata/v4/admin/` in `demo-app/app/admin-books/webapp/manifest.json:14` and catalog browse to `odata/v4/catalog/` in `demo-app/app/browse/webapp/manifest.json:14`.
4. Fiori Elements ListReport/ObjectPage routes use entity sets from the manifests, for example `Books` in `demo-app/app/admin-books/webapp/manifest.json:80` and `demo-app/app/admin-books/webapp/manifest.json:98`.

**State Management:**
- Persistent business state lives in CAP entities from `demo-app/db/schema.cds` and CSV seeds in `demo-app/db/data/`.
- Draft state is managed by CAP/Fiori through `@odata.draft.enabled` and `@fiori.draft.enabled` annotations in `demo-app/app/admin-books/fiori-service.cds:79`, `demo-app/app/admin-authors/fiori-service.cds:3`, and `demo-app/db/schema.cds:48`.
- Runtime n8n configuration is resolved by `cap-n8n-plugin/lib/config.js`; webhook services store it on each instance as `this.config`, `this.baseUrl`, and `this.apiKey`.
- `cds.env.requires.n8n` is module-level CAP runtime configuration mutated by `cap-n8n-plugin/cds-plugin.js` only when no explicit `impl` exists.

## Key Abstractions

**CAP Service Adapter:**
- Purpose: Encapsulate outbound n8n webhook calls behind a CAP service interface.
- Examples: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/package.json`, `demo-app/srv/admin-service.js`.
- Pattern: Extend `cds.Service`, register event handlers in `init()`, and call through `cds.connect.to('n8n')`.

**Workflow Artifact Helpers:**
- Purpose: Turn n8n workflow definitions plus scalar sidecar schemas into deterministic app-local artifacts.
- Examples: `cap-n8n-plugin/lib/workflows/schema.js`, `cap-n8n-plugin/lib/workflows/sanitize.js`, `cap-n8n-plugin/lib/workflows/artifacts.js`, `demo-app/n8n/index.cds`.
- Pattern: Normalize sidecar input objects, sanitize workflow JSON recursively, write stable JSON under `appRoot/n8n/`, and compile generated CDS for validation.

**CAP Application Services:**
- Purpose: Pair declarative service definitions with imperative event/action handlers.
- Examples: `demo-app/srv/admin-service.cds` with `demo-app/srv/admin-service.js`, and `demo-app/srv/cat-service.cds` with `demo-app/srv/cat-service.js`.
- Pattern: Define projections/actions in CDS and export a class extending `cds.ApplicationService`.

**CDS Projections:**
- Purpose: Shape persistence entities into OData-facing service models.
- Examples: `demo-app/srv/admin-service.cds`, `demo-app/srv/cat-service.cds`.
- Pattern: `entity X as projection on my.X` with selective exclusions and annotations.

**Fiori Annotation Modules:**
- Purpose: Keep UI layout, value help, hierarchy, draft, and field metadata declarative.
- Examples: `demo-app/app/common.cds`, `demo-app/app/admin-books/fiori-service.cds`, `demo-app/app/genres/tree-view.cds`, `demo-app/app/genres/value-help.cds`.
- Pattern: `annotate` and `extend` existing CAP entities/services rather than placing UI metadata in JavaScript.

**UI5 Fiori Elements Shells:**
- Purpose: Minimal UI components that defer UI composition to manifest routing and annotations.
- Examples: `demo-app/app/admin-books/webapp/Component.js`, `demo-app/app/browse/webapp/Component.js`, `demo-app/app/admin-authors/webapp/Component.js`, `demo-app/app/genres/webapp/Component.js`.
- Pattern: `sap.ui.define(["sap/fe/core/AppComponent"], ac => ac.extend(...))` with manifest metadata.

## Entry Points

**npm workspace root:**
- Location: `package.json`
- Triggers: `npm install`, `npm run n8n:import`, `npm run n8n:export`.
- Responsibilities: Declares package workspaces and n8n workflow import/export commands.

**CAP plugin bootstrap:**
- Location: `cap-n8n-plugin/cds-plugin.js`
- Triggers: CAP plugin loading and `cds.once('bootstrap')`.
- Responsibilities: Registers the default n8n service implementation in `cds.env.requires.n8n`.

**n8n workflow CAP service:**
- Location: `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Triggers: `cds.connect.to('n8n')` and `n8n.send('start', ...)`.
- Responsibilities: Reads `cds.requires.n8n` options, exposes `start`, constructs webhook URLs, sends HTTP POST requests to n8n, and handles response parsing/errors.

**Workflow artifact tools:**
- Location: `cap-n8n-plugin/index.js` `workflowTools` and `cap-n8n-plugin/lib/workflows/*.js`
- Triggers: Future package CLI/import flows, tests, and build validation.
- Responsibilities: Produce sanitized workflow artifacts and generated CDS contracts under a consuming app's `n8n/` directory.

**Demo CAP server:**
- Location: `demo-app/package.json`
- Triggers: `npm start` in `demo-app` or `cds watch`/`cds-serve`.
- Responsibilities: Starts CAP on port 3000 and binds the n8n service implementation.

**Admin service:**
- Location: `demo-app/srv/admin-service.cds` and `demo-app/srv/admin-service.js`
- Triggers: Admin OData requests under `odata/v4/admin/`.
- Responsibilities: Exposes editable bookshop projections, enforces admin access, generates IDs, and triggers n8n on Book creation.

**Catalog service:**
- Location: `demo-app/srv/cat-service.cds` and `demo-app/srv/cat-service.js`
- Triggers: Catalog OData requests under `odata/v4/catalog/`.
- Responsibilities: Exposes read-oriented book projections and handles `submitOrder`.

**Fiori apps:**
- Location: `demo-app/app/*/webapp/Component.js` and `demo-app/app/*/webapp/manifest.json`
- Triggers: UI5 application launch.
- Responsibilities: Load Fiori Elements apps for browsing, administering books/authors, and displaying genres.

**n8n node package:**
- Location: `cap-n8n-node/index.js`
- Triggers: Package entry if required by a consumer.
- Responsibilities: Not detected; file is empty.

## Architectural Constraints

- **Threading:** JavaScript executes on the Node.js event loop; asynchronous CAP handlers and `fetch()` calls are used in `demo-app/srv/*.js` and `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- **Global state:** `cap-n8n-plugin/cds-plugin.js` mutates `cds.env.requires.n8n`; `cap-n8n-plugin/lib/N8nWorkflowService.js` stores service configuration on each service instance.
- **Circular imports:** No JavaScript circular imports detected. CDS annotations intentionally import service/model definitions across `demo-app/app/**` and `demo-app/srv/**`.
- **Service binding:** The demo app explicitly binds `n8n.impl` to `cap-n8n-plugin/service` with `kind: "webhook"` in `demo-app/package.json`; new consumers can provide the same binding, choose `kind: "mock"`, or rely on plugin bootstrap selection.
- **Runtime fetch:** `cap-n8n-plugin/lib/N8nWorkflowService.js` uses global `fetch`, so runtime must provide it.
- **Secret handling:** `demo-app/package.json:23` references `{env.N8N_API_KEY}`; secrets must stay in environment configuration such as `.env`, which is ignored by `.gitignore`.
- **Workflow artifact safety:** Generated `workflow.json` files must be sanitized before commit; manifests may record removed path names but not removed values.
- **Generated/local data:** `node_modules/`, `.cds-services.json`, `*.log`, and `.n8n-data/` are ignored by `.gitignore` and should not be treated as source.

## Anti-Patterns

### Empty Package Entry Points

**What happens:** `cap-n8n-plugin/package.json` and `cap-n8n-node/package.json` both point `main` at empty `index.js` files.
**Why it's wrong:** Consumers requiring the package entry receive no API, and package behavior depends on CAP-specific plugin loading or explicit service implementation paths.
**Do this instead:** Put public exports or package initialization in `cap-n8n-plugin/index.js` and implement n8n node registration in `cap-n8n-node/index.js` when those package boundaries are used.

### Demo-Specific Workflow Trigger in Business Service

**What happens:** The n8n trigger is hard-coded in `demo-app/srv/admin-service.js:34` using workflow path `webhook-test/cap-test-trigger`.
**Why it's wrong:** Reusable workflow-trigger behavior lives in demo business logic instead of a reusable plugin abstraction or declarative model convention.
**Do this instead:** Keep reusable outbound transport in `cap-n8n-plugin/lib/N8nWorkflowService.js`; add generic trigger registration or annotations in plugin-owned files before duplicating this pattern across app services.

### Swallowed n8n Notification Errors

**What happens:** `demo-app/srv/admin-service.js:43` logs n8n failures and allows Book creation to complete.
**Why it's wrong:** This is useful for non-blocking demo behavior, but it hides integration failures from callers that need workflow delivery guarantees.
**Do this instead:** Choose error semantics per use case in the service handler and document whether n8n notification is best-effort or required; use `req.error(...)` when the CAP transaction must fail.

## Error Handling

**Strategy:** CAP business validation errors are returned through CAP request errors; outbound n8n transport errors are logged and rethrown by the reusable service, then optionally handled by caller code.

**Patterns:**
- Use `req.error(status, message)` for OData validation in `demo-app/srv/cat-service.js:18`, `demo-app/srv/cat-service.js:19`, and `demo-app/srv/cat-service.js:20`.
- Throw normal `Error` objects for n8n HTTP failures in `cap-n8n-plugin/lib/N8nWorkflowService.js:53`.
- Log n8n transport failures with `cds.log('n8n').error(...)` in `cap-n8n-plugin/lib/N8nWorkflowService.js:65`.
- Catch and suppress best-effort notification failures in `demo-app/srv/admin-service.js:42`.

## Cross-Cutting Concerns

**Logging:** Use CAP logging via `cds.log('n8n')` in `cap-n8n-plugin/cds-plugin.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, and `demo-app/srv/admin-service.js`.

**Validation:** Use CDS annotations for structural validation in `demo-app/srv/admin-constraints.cds`; use imperative CAP request validation in `demo-app/srv/cat-service.js`; use manifest/entity metadata for Fiori UI behavior in `demo-app/app/**`.

**Authentication:** `demo-app/srv/access-control.cds` requires `admin` for `AdminService`; `demo-app/srv/cat-service.cds` requires `authenticated-user` for `submitOrder`; `cap-n8n-plugin/lib/N8nWorkflowService.js` adds `X-N8N-API-KEY` when configured.

---

*Architecture analysis: 2026-05-28*
