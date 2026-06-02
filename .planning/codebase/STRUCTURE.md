# Codebase Structure

**Analysis Date:** 2026-05-28

## Directory Layout

```text
cap-n8n-plugin/
|-- .planning/                  # GSD planning and generated codebase maps
|-- cap-n8n-plugin/             # CAP plugin package for CAP -> n8n integration
|   |-- lib/                    # Reusable CAP service implementations
|   |   `-- annotations/        # Declarative annotation helper contracts
|   |-- cds-plugin.js           # CAP bootstrap hook
|   |-- index.js                # Empty package main entry
|   `-- package.json            # Plugin package metadata
|-- cap-n8n-node/               # n8n community node package placeholder
|   |-- index.js                # Empty package main entry
|   `-- package.json            # n8n node package metadata
|-- demo-app/                   # SAP CAP demo application
|   |-- app/                    # Fiori Elements app annotations and UI5 shells
|   |-- db/                     # CAP persistence model and seed data
|   |-- srv/                    # CAP service models and JavaScript handlers
|   |-- _i18n/                  # Demo-level translations
|   |-- package.json            # Demo app dependencies and CAP configuration
|   |-- readme.md               # Demo-specific notes
|   `-- test.http               # Manual admin OData request for n8n trigger
|-- mockups/                    # Static n8n UI mockup artifact
|-- test-workflows/             # Shared exported n8n workflows
|-- docker-compose.yml          # Local n8n orchestration config
|-- package.json                # npm workspace root
|-- README.md                   # Project usage guide
|-- N8N_REQUIREMENTS.md         # Requirements document
`-- cap_n8n_requirements_v2.md  # Requirements document
```

## Directory Purposes

**`.planning/`:**
- Purpose: Stores GSD planning artifacts and codebase maps.
- Contains: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, and other mapper-owned documents.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

**`cap-n8n-plugin/`:**
- Purpose: Package boundary for the reusable CAP plugin that lets CAP applications trigger n8n workflows.
- Contains: CAP bootstrap hook, service implementation, package metadata.
- Key files: `cap-n8n-plugin/cds-plugin.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/package.json`, `cap-n8n-plugin/index.js`

**`cap-n8n-plugin/lib/`:**
- Purpose: Holds plugin-owned implementation modules.
- Contains: Reusable CAP service classes and helper modules.
- Key files: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/lib/ExecutionStore.js`

**`cap-n8n-plugin/lib/annotations/`:**
- Purpose: Holds package-owned declarative annotation helper contracts.
- Contains: Served-service annotation registration, flattened CSN annotation parsing, safe condition compilation/evaluation, scalar payload construction, and declarative cancellation matching.
- Key files: `cap-n8n-plugin/lib/annotations/AnnotationRegistrar.js`, `cap-n8n-plugin/lib/annotations/AnnotationParser.js`, `cap-n8n-plugin/lib/annotations/ConditionEvaluator.js`, `cap-n8n-plugin/lib/annotations/PayloadBuilder.js`, `cap-n8n-plugin/lib/annotations/CancellationResolver.js`

**`cap-n8n-node/`:**
- Purpose: Package boundary for n8n community node functionality.
- Contains: Package metadata and empty package entry.
- Key files: `cap-n8n-node/package.json`, `cap-n8n-node/index.js`

**`demo-app/`:**
- Purpose: Runnable SAP CAP demo app that consumes `cap-n8n-plugin` and demonstrates Book creation triggering n8n.
- Contains: CAP app model, service definitions, JavaScript handlers, Fiori Elements apps, translations, and manual HTTP request file.
- Key files: `demo-app/package.json`, `demo-app/readme.md`, `demo-app/test.http`

**`demo-app/db/`:**
- Purpose: Owns persistence model and seed data.
- Contains: CDS entities, CDS extensions for currencies, and CSV data files.
- Key files: `demo-app/db/schema.cds`, `demo-app/db/currencies.cds`, `demo-app/db/data/sap.capire.bookshop-Books.csv`, `demo-app/db/data/sap.capire.bookshop-Authors.csv`, `demo-app/db/data/sap.capire.bookshop-Genres.csv`

**`demo-app/srv/`:**
- Purpose: Owns CAP OData service definitions and runtime business behavior.
- Contains: Service `.cds` files, JavaScript service implementations, authorization annotations, and validation constraints.
- Key files: `demo-app/srv/admin-service.cds`, `demo-app/srv/admin-service.js`, `demo-app/srv/cat-service.cds`, `demo-app/srv/cat-service.js`, `demo-app/srv/admin-constraints.cds`, `demo-app/srv/access-control.cds`

**`demo-app/app/`:**
- Purpose: Owns Fiori Elements app definitions, annotations, manifests, and app-level translations.
- Contains: Shared annotations, Fiori app service composition, app-specific annotation modules, UI5 component shells, and `manifest.json` files.
- Key files: `demo-app/app/services.cds`, `demo-app/app/common.cds`, `demo-app/app/fiori-apps.html`

**`demo-app/app/admin-books/`:**
- Purpose: Fiori Elements app for managing Books through `AdminService`.
- Contains: Book-specific annotations and UI5 app shell.
- Key files: `demo-app/app/admin-books/fiori-service.cds`, `demo-app/app/admin-books/webapp/Component.js`, `demo-app/app/admin-books/webapp/manifest.json`

**`demo-app/app/admin-authors/`:**
- Purpose: Fiori Elements app for managing Authors through `AdminService`.
- Contains: Author-specific annotations and UI5 app shell.
- Key files: `demo-app/app/admin-authors/fiori-service.cds`, `demo-app/app/admin-authors/webapp/Component.js`, `demo-app/app/admin-authors/webapp/manifest.json`

**`demo-app/app/browse/`:**
- Purpose: Fiori Elements app for browsing CatalogService Books.
- Contains: Catalog browsing annotations and UI5 app shell.
- Key files: `demo-app/app/browse/fiori-service.cds`, `demo-app/app/browse/webapp/Component.js`, `demo-app/app/browse/webapp/manifest.json`

**`demo-app/app/genres/`:**
- Purpose: Fiori Elements app and annotations for Genre hierarchy/value-help behavior.
- Contains: Genre annotations, tree-view annotations, value-help annotations, and UI5 app shell.
- Key files: `demo-app/app/genres/fiori-service.cds`, `demo-app/app/genres/tree-view.cds`, `demo-app/app/genres/value-help.cds`, `demo-app/app/genres/webapp/Component.js`, `demo-app/app/genres/webapp/manifest.json`

**`demo-app/_i18n/` and `demo-app/app/**/webapp/i18n/`:**
- Purpose: Stores translations for CAP/Fiori text.
- Contains: `.properties` files for English, German, and French at demo level; app-local `.properties` files for UI5 apps.
- Key files: `demo-app/_i18n/messages_en.properties`, `demo-app/app/admin-books/webapp/i18n/i18n.properties`, `demo-app/app/browse/webapp/i18n/i18n.properties`

**`mockups/`:**
- Purpose: Stores static UI mockups for the n8n node package requirements.
- Contains: HTML mockup artifact.
- Key files: `mockups/n8n-node-mockup.html`

**`test-workflows/`:**
- Purpose: Stores exported n8n workflows that can be imported into a local n8n instance.
- Contains: Workflow JSON.
- Key files: `test-workflows/workflows.json`

## Key File Locations

**Entry Points:**
- `package.json`: npm workspace root and n8n workflow import/export script entry.
- `demo-app/package.json`: CAP app start script, dependencies, server port, and `cds.requires.n8n` binding.
- `cap-n8n-plugin/cds-plugin.js`: CAP plugin bootstrap hook.
- `cap-n8n-plugin/lib/N8nWorkflowService.js`: Reusable CAP service adapter entry.
- `demo-app/srv/admin-service.js`: Admin service runtime behavior and Book-create n8n trigger.
- `demo-app/srv/cat-service.js`: Catalog service runtime behavior and `submitOrder` implementation.
- `demo-app/app/*/webapp/Component.js`: UI5 app component entry points.

**Configuration:**
- `package.json`: Root npm workspaces and scripts.
- `demo-app/package.json`: CAP `requires.n8n` implementation path, credentials reference, and server port.
- `.gitignore`: Ignored generated and local files (`node_modules/`, `.env`, `.cds-services.json`, `*.log`, `.n8n-data/`).
- `docker-compose.yml`: Local n8n orchestration config; contents not inspected for secret-safety.
- `demo-app/app/*/webapp/manifest.json`: UI5/Fiori data sources, routing, models, and app metadata.

**Core Logic:**
- `cap-n8n-plugin/lib/N8nWorkflowService.js`: Outbound webhook transport to n8n.
- `cap-n8n-plugin/lib/annotations/AnnotationRegistrar.js`: Served CAP entity scanner and after-handler registration for declarative n8n starts.
- `cap-n8n-plugin/lib/annotations/AnnotationParser.js`: Declarative n8n annotation reconstruction and validation.
- `cap-n8n-plugin/lib/annotations/ConditionEvaluator.js`: Safe scalar CXN condition parsing and evaluation.
- `cap-n8n-plugin/lib/annotations/PayloadBuilder.js`: Scalar workflow payload and CAP event metadata construction.
- `cap-n8n-plugin/lib/annotations/CancellationResolver.js`: Declarative cancellation matching through Phase 3 execution query and cancel APIs.
- `cap-n8n-plugin/cds-plugin.js`: Runtime default binding of the n8n service implementation.
- `demo-app/db/schema.cds`: Bookshop domain model.
- `demo-app/srv/admin-service.cds`: Admin service OData model.
- `demo-app/srv/admin-service.js`: Admin service event handlers.
- `demo-app/srv/cat-service.cds`: Catalog service OData model.
- `demo-app/srv/cat-service.js`: Catalog service event/action handlers.
- `demo-app/srv/admin-constraints.cds`: Admin service validation annotations.
- `demo-app/srv/access-control.cds`: Admin service authorization annotation.

**UI and App Composition:**
- `demo-app/app/services.cds`: Imports app-specific Fiori service annotation modules.
- `demo-app/app/common.cds`: Shared Fiori annotations for Bookshop entities and common code lists.
- `demo-app/app/admin-books/fiori-service.cds`: Book management Fiori annotations and draft behavior.
- `demo-app/app/admin-authors/fiori-service.cds`: Author management Fiori annotations and virtual fields.
- `demo-app/app/browse/fiori-service.cds`: Catalog browsing Fiori annotations.
- `demo-app/app/genres/fiori-service.cds`: Genre app annotations.
- `demo-app/app/genres/tree-view.cds`: Recursive hierarchy annotations for Genre tree display.
- `demo-app/app/genres/value-help.cds`: Tree value-help presentation annotations.

**Testing and Manual Verification:**
- `demo-app/test.http`: Manual HTTP request for creating a Book through `AdminService`.
- `test/integration/n8n-annotation-contract.test.js`: Annotation parser, condition, and payload contract integration tests.
- `test/integration/n8n-annotations-start.test.js`: Annotated CREATE/UPDATE/DELETE start integration tests.
- `test/integration/n8n-annotations-cancel.test.js`: Declarative cancellation integration tests for default DELETE, explicit UPDATE, no-match, and non-rollback behavior.
- `test-workflows/workflows.json`: Imported n8n webhook workflow used by the demo trigger.
- `mockups/n8n-node-mockup.html`: Static mockup for n8n node UI requirements.
- Automated test directories/files: Not detected.

**Documentation:**
- `README.md`: Root package overview and local development flow.
- `demo-app/readme.md`: Demo app-specific workflow-trigger notes.
- `N8N_REQUIREMENTS.md`: Requirements for CAP-to-n8n and n8n-to-CAP integration.
- `cap_n8n_requirements_v2.md`: Requirements version with user stories and acceptance criteria.

## Naming Conventions

**Files:**
- CAP service models use lowercase kebab names ending in `-service.cds`: `demo-app/srv/admin-service.cds`, `demo-app/srv/cat-service.cds`.
- CAP service implementations use matching `-service.js` names beside their `.cds` service definitions: `demo-app/srv/admin-service.js`, `demo-app/srv/cat-service.js`.
- Fiori annotation modules use `fiori-service.cds` within each app directory: `demo-app/app/admin-books/fiori-service.cds`.
- UI5 app entry files use `Component.js` under `webapp/`: `demo-app/app/browse/webapp/Component.js`.
- UI5 app manifests use `manifest.json` under `webapp/`: `demo-app/app/browse/webapp/manifest.json`.
- Translation files use `.properties` with optional locale suffixes: `demo-app/app/admin-books/webapp/i18n/i18n_de.properties`.
- Seed files follow CAP CSV naming for fully qualified entities: `demo-app/db/data/sap.capire.bookshop-Books.csv`.

**Directories:**
- npm workspace packages use package-oriented names: `cap-n8n-plugin/`, `cap-n8n-node/`, `demo-app/`.
- CAP layer directories follow standard CAP names: `demo-app/db/`, `demo-app/srv/`, `demo-app/app/`.
- Fiori app directories use kebab-case feature names: `demo-app/app/admin-books/`, `demo-app/app/admin-authors/`.
- UI5 web assets live under `webapp/` inside each Fiori app directory: `demo-app/app/genres/webapp/`.
- Shared generated or local dependencies must remain outside source or ignored: `node_modules/`, `.n8n-data/`.

## Where to Add New Code

**New CAP-to-n8n Transport Behavior:**
- Primary code: `cap-n8n-plugin/lib/N8nWorkflowService.js`
- Bootstrap/config defaults: `cap-n8n-plugin/cds-plugin.js`
- Demo usage: `demo-app/srv/admin-service.js`
- Manual verification: `demo-app/test.http` and `test-workflows/workflows.json`

**New Plugin Package API:**
- Primary code: `cap-n8n-plugin/index.js`
- Internal modules: `cap-n8n-plugin/lib/`
- Package metadata: `cap-n8n-plugin/package.json`

**New n8n Community Node Behavior:**
- Primary code: `cap-n8n-node/index.js`
- Package metadata: `cap-n8n-node/package.json`
- UI/reference mockups: `mockups/n8n-node-mockup.html`
- Requirements reference: `cap_n8n_requirements_v2.md`

**New CAP Entity or Domain Model:**
- Persistence model: `demo-app/db/schema.cds`
- Seed data: `demo-app/db/data/`
- Admin service exposure: `demo-app/srv/admin-service.cds`
- Catalog service exposure: `demo-app/srv/cat-service.cds`
- Shared UI annotations: `demo-app/app/common.cds`

**New Service Action or Lifecycle Behavior:**
- Service contract: `demo-app/srv/*.cds`
- Implementation: matching `demo-app/srv/*.js`
- Validation annotations: `demo-app/srv/admin-constraints.cds` when the rule is declarative.
- Authorization annotations: `demo-app/srv/access-control.cds` or action/entity annotations in the relevant service `.cds` file.

**New Fiori App:**
- App annotations: `demo-app/app/<app-name>/fiori-service.cds`
- UI5 component: `demo-app/app/<app-name>/webapp/Component.js`
- UI5 manifest: `demo-app/app/<app-name>/webapp/manifest.json`
- App translations: `demo-app/app/<app-name>/webapp/i18n/`
- App registration/import: `demo-app/app/services.cds`

**Utilities:**
- Plugin-shared helpers: add under `cap-n8n-plugin/lib/`.
- Declarative annotation helpers: add under `cap-n8n-plugin/lib/annotations/`.
- Demo app-only helpers: keep beside the consuming service in `demo-app/srv/` unless reused across multiple demo services.
- Avoid adding helpers to root unless they coordinate workspaces or developer tooling.

## Special Directories

**`node_modules/`:**
- Purpose: npm dependency installs.
- Generated: Yes
- Committed: No

**`.n8n-data/`:**
- Purpose: Local n8n container state referenced by the project README.
- Generated: Yes
- Committed: No

**`.planning/codebase/`:**
- Purpose: Generated GSD codebase map documents consumed by planning/execution workflows.
- Generated: Yes
- Committed: Yes

**`demo-app/db/data/`:**
- Purpose: CAP seed data for Bookshop entities.
- Generated: No
- Committed: Yes

**`test-workflows/`:**
- Purpose: Shared exported n8n workflow data.
- Generated: Exported from n8n by root scripts
- Committed: Yes

**`mockups/`:**
- Purpose: Static design/reference artifacts for the planned n8n node UI.
- Generated: No
- Committed: Yes

**`demo-app/.vscode/`:**
- Purpose: Editor-local workspace settings if present.
- Generated: No
- Committed: Depends on contained files; no files inspected for architecture mapping.

---

*Structure analysis: 2026-05-28*
