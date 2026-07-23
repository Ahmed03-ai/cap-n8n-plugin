# Codebase Structure

**Analysis Date:** 2026-06-03

**Last mapped commit:** fa456e23c97b9349257019c15ca7723aa8a3352d

## Directory Layout

```text
cap-n8n-plugin/
|-- docs/                       # User and contributor documentation, incl. codebase maps
|-- cap-n8n-plugin/             # CAP plugin package for CAP -> n8n integration
|   |-- lib/                    # Reusable CAP service implementations
|   |   `-- annotations/        # Declarative annotation helper contracts
|   |   `-- workflows/          # Workflow artifact schema, sanitizer, manifest, CDS, and writer helpers
|   |-- cds-plugin.js           # CAP bootstrap hook
|   |-- index.js                # Package main entry and workflowTools export
|   `-- package.json            # Plugin package metadata
|-- cap-n8n-node/               # n8n community node package for SAP CAP OData access
|   |-- credentials/            # SAP CAP API credential type and icon
|   |-- nodes/SapCap/           # SAP CAP node, OData metadata, request, and response helpers
|   |-- eslint.config.mjs       # n8n community-node lint config
|   |-- index.js                # Package registration metadata export
|   |-- tsconfig.json           # TypeScript build config for node and credential sources
|   `-- package.json            # n8n node package metadata
|-- demo-app/                   # SAP CAP demo application
|   |-- app/                    # Fiori Elements app annotations and UI5 shells
|   |-- db/                     # CAP persistence model and seed data
|   |-- n8n/                    # App-local generated workflow artifacts and CDS contracts
|   |-- srv/                    # CAP service models and JavaScript handlers
|   |-- _i18n/                  # Demo-level translations
|   |-- package.json            # Demo app dependencies and CAP configuration
|   |-- readme.md               # Demo-specific notes
|   `-- test.http               # Manual admin OData request for n8n trigger
|-- mockups/                    # Static n8n UI mockup artifact
|-- docs/                       # Maintainer and manual showcase documentation
|   `-- manual-visual-showcase.md
|-- test/                       # Vitest smoke and integration tests
|-- test-workflows/             # Shared exported n8n workflows
|-- docker-compose.yml          # Local n8n orchestration config
|-- package-lock.json           # Root npm workspace lockfile
|-- package.json                # npm workspace root
|-- README.md                   # Project usage guide
|-- N8N_REQUIREMENTS.md         # Requirements document
`-- cap_n8n_requirements_v2.md  # Requirements document
```

## Directory Purposes

**`docs/`:**
- Purpose: Stores user and contributor documentation, including the codebase maps.
- Contains: `docs/codebase/ARCHITECTURE.md`, `docs/codebase/STRUCTURE.md`, manual testing and deployment runbooks.
- Key files: `docs/codebase/ARCHITECTURE.md`, `docs/codebase/STRUCTURE.md`, `docs/manual-testing.md`

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

**`cap-n8n-plugin/lib/workflows/`:**
- Purpose: Holds package-owned workflow artifact contracts for Phase 5 import and validation.
- Contains: Sidecar schema normalization, recursive n8n workflow sanitization, manifest/key helpers, generated CDS helpers, and app-root artifact read/write helpers.
- Key files: `cap-n8n-plugin/lib/workflows/schema.js`, `cap-n8n-plugin/lib/workflows/sanitize.js`, `cap-n8n-plugin/lib/workflows/manifest.js`, `cap-n8n-plugin/lib/workflows/generate-cds.js`, `cap-n8n-plugin/lib/workflows/artifacts.js`

**`cap-n8n-node/`:**
- Purpose: Package boundary for n8n community node functionality.
- Contains: Package metadata, package registration export, TypeScript node implementation, credential definition, SVG icons, TypeScript config, and n8n CLI lint config.
- Key files: `cap-n8n-node/package.json`, `cap-n8n-node/index.js`, `cap-n8n-node/nodes/SapCap/SapCap.node.ts`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts`, `cap-n8n-node/nodes/SapCap/ODataMetadata.ts`, `cap-n8n-node/nodes/SapCap/ODataResponse.ts`, `cap-n8n-node/credentials/SapCapApi.credentials.ts`, `cap-n8n-node/tsconfig.json`, `cap-n8n-node/eslint.config.mjs`

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

**`demo-app/n8n/`:**
- Purpose: Stores deterministic app-local n8n workflow artifacts consumed by future import and build validation.
- Contains: Aggregate workflow manifest, generated CDS input contracts, sanitized workflow JSON, scalar sidecar schemas, and per-workflow manifests.
- Key files: `demo-app/n8n/index.cds`, `demo-app/n8n/manifest.json`, `demo-app/n8n/workflows/cap-test-trigger/workflow.json`, `demo-app/n8n/workflows/cap-test-trigger/schema.json`, `demo-app/n8n/workflows/cap-test-trigger/manifest.json`

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

**`docs/`:**
- Purpose: Stores human-facing project documentation that is not package-local runtime code.
- Contains: Presenter-oriented manual showcase runbook, including what is implemented, what not to claim, local n8n/CAP demo steps, deterministic verification commands, and Phase 8 custom-node E2E limitations.
- Key files: `docs/manual-visual-showcase.md`

**`test/`:**
- Purpose: Stores Vitest smoke and integration coverage for package boundaries, CAP plugin behavior, workflow artifacts/import/build validation, and the n8n community node slice.
- Contains: `test/smoke/package-boundaries.test.js`, CAP plugin integration suites, workflow artifact/import/build-validation suites, and n8n node metadata/read/response cleanup suites.
- Key files: `test/smoke/package-boundaries.test.js`, `test/integration/n8n-node-metadata-discovery.test.js`, `test/integration/n8n-node-read-operations.test.js`, `test/integration/n8n-node-response-cleanup.test.js`

**`test-workflows/`:**
- Purpose: Stores exported n8n workflows that can be imported into a local n8n instance.
- Contains: Workflow JSON.
- Key files: `test-workflows/workflows.json`

## Key File Locations

**Entry Points:**
- `package.json`: npm workspace root and n8n workflow import/export script entry.
- `package-lock.json`: root npm workspace dependency lock, including `@n8n/node-cli`, `n8n-workflow`, TypeScript, ESLint, CAP, Vitest, and workspace package metadata.
- `demo-app/package.json`: CAP app start script, dependencies, server port, and `cds.requires.n8n` binding.
- `cap-n8n-plugin/cds-plugin.js`: CAP plugin bootstrap hook.
- `cap-n8n-plugin/lib/N8nWorkflowService.js`: Reusable CAP service adapter entry.
- `cap-n8n-node/index.js`: n8n community-node package metadata export for nodes and credentials.
- `cap-n8n-node/nodes/SapCap/SapCap.node.ts`: SAP CAP n8n node definition and execution entry.
- `demo-app/srv/admin-service.js`: Admin service runtime behavior and Book-create n8n trigger.
- `demo-app/srv/cat-service.js`: Catalog service runtime behavior and `submitOrder` implementation.
- `demo-app/app/*/webapp/Component.js`: UI5 app component entry points.

**Configuration:**
- `package.json`: Root npm workspaces and scripts.
- `package-lock.json`: Locked root install graph and workspace package metadata.
- `cap-n8n-node/package.json`: n8n package metadata, Node engine range, n8n node/credential build artifact registration, and `n8n-node` scripts.
- `cap-n8n-node/tsconfig.json`: TypeScript compiler configuration for n8n node sources.
- `cap-n8n-node/eslint.config.mjs`: n8n CLI-provided ESLint config.
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
- `cap-n8n-plugin/lib/workflows/*.js`: Sidecar schema, sanitizer, manifest, generated CDS, and artifact read/write helpers for app-local workflow artifacts.
- `cap-n8n-plugin/cds-plugin.js`: Runtime default binding of the n8n service implementation.
- `cap-n8n-node/nodes/SapCap/SapCap.node.ts`: n8n node property definitions, credential test registration, load-options registration, and per-operation execution dispatch.
- `cap-n8n-node/nodes/SapCap/GenericFunctions.ts`: Base URL/service path/key normalization, OData request builders, JSON parameter parsing, auth request helpers, and CAP request errors.
- `cap-n8n-node/nodes/SapCap/ODataMetadata.ts`: `$metadata` entity-set, key, action, and function extraction plus n8n load-options helpers.
- `cap-n8n-node/nodes/SapCap/ODataResponse.ts`: OData response unwrapping, metadata cleanup, continue-on-fail item shape, and sanitized error conversion.
- `cap-n8n-node/credentials/SapCapApi.credentials.ts`: SAP CAP API credential fields for Basic Auth and OAuth2 Client Credentials plus metadata path configuration.
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
- `test/integration/n8n-workflow-artifacts.test.js`: Workflow artifact contract integration tests for scalar sidecars, sanitizer output, generated CDS, manifest aliases, and app-root containment.
- `test/integration/n8n-node-metadata-discovery.test.js`: n8n SAP CAP node credential test, metadata entity/action/function discovery, auth handling, and sanitized error integration coverage.
- `test/integration/n8n-node-read-operations.test.js`: n8n SAP CAP node Query, Read, Create, Update, Delete, Action/Function, composite-key, JSON input, and validation integration coverage against local HTTP harnesses.
- `test/integration/n8n-node-response-cleanup.test.js`: OData metadata cleanup, item normalization, continue-on-fail, and error redaction coverage against built n8n node helpers.
- `test-workflows/workflows.json`: Imported n8n webhook workflow used by the demo trigger.
- `mockups/n8n-node-mockup.html`: Static mockup for n8n node UI requirements.
- `docs/manual-visual-showcase.md`: Presenter runbook for local manual showcase, deterministic verification commands, and current live n8n custom-node limitations.

**Documentation:**
- `README.md`: Root package overview and local development flow.
- `docs/manual-visual-showcase.md`: Manual demo/showcase runbook that separates implemented evidence from Phase 8 live custom-node E2E work.
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

**New Workflow Artifact or Import Behavior:**
- Primary code: `cap-n8n-plugin/lib/workflows/`
- Public package access: `cap-n8n-plugin/index.js` `workflowTools`
- Consuming app artifacts: `demo-app/n8n/` or another app-root `n8n/` directory
- Integration tests: `test/integration/n8n-workflow-*.test.js`

**New n8n Community Node Behavior:**
- Primary code: `cap-n8n-node/nodes/SapCap/*.ts` and `cap-n8n-node/credentials/SapCapApi.credentials.ts`
- Package entry/metadata: `cap-n8n-node/index.js`, `cap-n8n-node/package.json`
- Build/lint config: `cap-n8n-node/tsconfig.json`, `cap-n8n-node/eslint.config.mjs`
- Package metadata: `cap-n8n-node/package.json`
- UI/reference mockups: `mockups/n8n-node-mockup.html`
- Integration tests: `test/integration/n8n-node-*.test.js`, `test/smoke/package-boundaries.test.js`
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

**`docs/codebase/`:**
- Purpose: Codebase map documents describing architecture, structure, stack, conventions, testing, and integrations.
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

**`demo-app/n8n/`:**
- Purpose: Deterministic generated workflow artifacts for the demo CAP app.
- Generated: Yes, by `cap-n8n-plugin/lib/workflows/artifacts.js`
- Committed: Yes

**`mockups/`:**
- Purpose: Static design/reference artifacts for n8n node UI requirements and historical mockup alignment.
- Generated: No
- Committed: Yes

**`demo-app/.vscode/`:**
- Purpose: Editor-local workspace settings if present.
- Generated: No
- Committed: Depends on contained files; no files inspected for architecture mapping.

---

*Structure analysis: 2026-06-03*
