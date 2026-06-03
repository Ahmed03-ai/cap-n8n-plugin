# Coding Conventions

**Analysis Date:** 2026-06-03

**Last mapped commit:** fa456e23c97b9349257019c15ca7723aa8a3352d

## Naming Patterns

**Files:**
- Use lowercase package and folder names with hyphens for npm workspace packages: `cap-n8n-plugin/`, `cap-n8n-node/`, `demo-app/`.
- Use `.js` for Node.js service implementations: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`, `demo-app/srv/cat-service.js`.
- Use `.ts` for n8n community-node source files under `cap-n8n-node/nodes/SapCap/` and `cap-n8n-node/credentials/`; build output belongs in `cap-n8n-node/dist/`.
- Use `.cds` for CAP models, services, access rules, constraints, and Fiori annotations: `demo-app/db/schema.cds`, `demo-app/srv/admin-service.cds`, `demo-app/app/common.cds`.
- Use `Component.js` for SAP Fiori Elements app components under each app webapp folder: `demo-app/app/browse/webapp/Component.js`, `demo-app/app/admin-books/webapp/Component.js`.
- Use `manifest.json` for SAP UI5/Fiori app manifests: `demo-app/app/browse/webapp/manifest.json`, `demo-app/app/admin-authors/webapp/manifest.json`.
- Use `.http` for manual request scenarios: `demo-app/test.http`.

**Functions:**
- Use camelCase for local JavaScript functions and handlers: `assignNextBookId` in `demo-app/srv/admin-service.js`.
- Use `async` handler functions for CAP events that perform I/O: `this.on('submitOrder', async req => ...)` in `demo-app/srv/cat-service.js`, `this.after('CREATE', Books, async (data, req) => ...)` in `demo-app/srv/admin-service.js`.
- Prefix internal helper methods on service classes with `_`: `_triggerWebhook(workflowId, inputs)` in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Use CAP event names as string literals in service registration calls: `this.on('start', ...)` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, `this.before('NEW', ...)` in `demo-app/srv/admin-service.js`.

**Variables:**
- Use camelCase for JavaScript variables and destructured aliases: `safeBaseUrl`, `safePath`, `workflowId`, `responseText` in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Use capitalized entity variables for CAP entities: `Books`, `ListOfBooks` in `demo-app/srv/cat-service.js`.
- Use concise CAP request variable names in handlers: `req` in `demo-app/srv/cat-service.js` and `demo-app/srv/admin-service.js`.
- Use CDS-style snake suffixes for generated foreign key fields and localized text fields: `author_ID`, `genre_ID`, `currency_code`, `ID_texts` in `demo-app/app/common.cds` and `demo-app/app/admin-books/fiori-service.cds`.

**Types:**
- Use PascalCase for JavaScript classes extending CAP services: `N8nWorkflowService` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, `AdminService` in `demo-app/srv/admin-service.js`, `CatalogService` in `demo-app/srv/cat-service.js`.
- Use PascalCase for CAP entities and types: `Books`, `Authors`, `Genres`, `Price` in `demo-app/db/schema.cds`.
- Use SAP namespace-style qualified names for CAP domains: `sap.capire.bookshop` in `demo-app/db/schema.cds`.
- Use Fiori annotation vocabulary names exactly as provided by CAP/UI vocabularies: `UI.LineItem`, `Common.SemanticKey`, `ValueList`, `Core.Computed` in `demo-app/app/common.cds` and `demo-app/app/admin-books/fiori-service.cds`.

## Code Style

**Formatting:**
- Formatting tool: Not detected. No `.prettierrc*`, `biome.json`, or `jsconfig.json` files are present.
- JavaScript service files use two-space indentation: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`, `demo-app/srv/cat-service.js`.
- n8n node TypeScript uses the `cap-n8n-node/tsconfig.json` compiler settings (`strict`, Node16 modules, ES2022 target) and package-local `cap-n8n-node/eslint.config.mjs`.
- The dominant JavaScript style omits semicolons: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`, `demo-app/srv/cat-service.js`, `demo-app/app/browse/webapp/Component.js`.
- `cap-n8n-plugin/cds-plugin.js` uses semicolons; keep new plugin-service code aligned with the no-semicolon style in `cap-n8n-plugin/lib/N8nWorkflowService.js` unless editing `cap-n8n-plugin/cds-plugin.js` directly.
- Use single quotes for Node.js string literals: `require('@sap/cds')` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cds.connect.to('n8n')` in `demo-app/srv/admin-service.js`.
- UI5 `Component.js` files use double quotes for SAP module dependency arrays and single quotes inside metadata: `demo-app/app/admin-books/webapp/Component.js`.
- CDS files use semicolon terminators for declarations and annotations: `demo-app/db/schema.cds`, `demo-app/srv/admin-service.cds`, `demo-app/app/common.cds`.
- Align CDS entity fields and annotations for readability where existing files use column alignment: `demo-app/db/schema.cds`, `demo-app/app/common.cds`.

**Linting:**
- Lint tool: n8n community-node linting is present for `cap-n8n-node` via `npm run lint --workspace n8n-nodes-sap-cap`, which delegates to `n8n-node lint`.
- Root `package.json` declares `eslint` and `@eslint/js`; `cap-n8n-node/eslint.config.mjs` imports the config from `@n8n/node-cli/eslint`.
- Do not assume lint rules beyond existing runtime syntax. Match the local JavaScript and CDS style in the file being edited.

## Import Organization

**Order:**
1. Runtime/framework imports first: `const cds = require('@sap/cds')` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`, `demo-app/srv/cat-service.js`.
2. Class/module declaration next: `class N8nWorkflowService extends cds.Service` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, `module.exports = class AdminService ...` in `demo-app/srv/admin-service.js`.
3. CAP entity destructuring inside `init()` or handlers after the service context exists: `const { Books } = this.entities` in `demo-app/srv/admin-service.js`, `const { Books } = cds.entities('sap.capire.bookshop')` in `demo-app/srv/cat-service.js`.
4. CDS `using` statements at the top before service/entity/annotation bodies: `demo-app/db/schema.cds`, `demo-app/srv/cat-service.cds`, `demo-app/app/services.cds`.

**Path Aliases:**
- No JavaScript path aliases are configured.
- Use relative CommonJS paths for local JavaScript modules: `require.resolve('./lib/N8nWorkflowService.js')` in `cap-n8n-plugin/cds-plugin.js`.
- Use relative TypeScript imports inside the n8n node package: `SapCap.node.ts` imports `./GenericFunctions`, `./ODataMetadata`, and `./ODataResponse`.
- Use CDS relative imports between model layers: `using {sap.capire.bookshop as my} from '../db/schema';` in `demo-app/srv/admin-service.cds`, `using { AdminService } from '../../srv/admin-service';` in `demo-app/app/admin-books/fiori-service.cds`.
- Use SAP package imports directly in CDS: `using { sap } from '@sap/cds/common';` in `demo-app/db/currencies.cds`, `using { sap.common } from '@sap/cds/common';` in `demo-app/app/common.cds`.

## Error Handling

**Patterns:**
- Use `req.error(status, message)` for CAP request validation failures that should become protocol errors: `demo-app/srv/cat-service.js`.
- Throw `Error` after enriching failed external HTTP responses with status and response text: `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Log and rethrow failures in reusable service implementations so callers can observe failure: `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Log and suppress non-critical side-effect failures when the primary CAP mutation should complete: `demo-app/srv/admin-service.js` catches n8n notification failures after `CREATE`.
- Return fallback success objects for accepted non-JSON n8n webhook responses: `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Keep validation close to the CAP handler that owns the business operation: stock and quantity checks live in `demo-app/srv/cat-service.js`.

## Logging

**Framework:** CAP logger via `cds.log`

**Patterns:**
- Use namespaced CAP loggers for integration logs: `cds.log('n8n')` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/cds-plugin.js`, and `demo-app/srv/admin-service.js`.
- Use `.info()` for successful lifecycle and integration events: plugin bootstrap in `cap-n8n-plugin/cds-plugin.js`, n8n notification success in `demo-app/srv/admin-service.js`.
- Use `.warn()` for degraded configuration: missing n8n `baseUrl` in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Use `.error()` before throwing or when side-effect notification fails: `cap-n8n-plugin/lib/N8nWorkflowService.js`, `demo-app/srv/admin-service.js`.
- No `console.*` logging is present in source files; use `cds.log(...)` for new runtime code.

## Comments

**When to Comment:**
- Comment non-obvious integration behavior and compatibility choices: webhook path normalization in `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- Comment CAP/Fiori workarounds where the model needs context: draft-enabled localized text handling in `demo-app/db/schema.cds`, UUID create popup workaround in `demo-app/app/admin-books/fiori-service.cds`.
- Use section dividers in large annotation files to separate UI areas: `demo-app/app/common.cds`, `demo-app/app/admin-books/fiori-service.cds`, `demo-app/app/browse/fiori-service.cds`.
- Keep comments short and tied to the nearby behavior; avoid restating simple assignments.

**JSDoc/TSDoc:**
- JSDoc is used as short block comments for CAP handler intent, not for type documentation: `demo-app/srv/admin-service.js`.
- TSDoc is not established in the n8n TypeScript package; keep types explicit through TypeScript aliases/interfaces and add comments only for non-obvious behavior.
- Use JSDoc-style comments only when they label a handler group or workflow behavior, such as `Generate IDs for new Books drafts` in `demo-app/srv/admin-service.js`.

## Function Design

**Size:** Keep service methods focused around one CAP lifecycle responsibility. `N8nWorkflowService.init()` registers configuration and events, while `_triggerWebhook()` owns URL construction, HTTP call, response parsing, logging, and error propagation in `cap-n8n-plugin/lib/N8nWorkflowService.js`.

**Parameters:** Use CAP handler signatures as provided by the framework: `async req => ...` for `this.on(...)`, `(data, req) => ...` for `this.after('CREATE', ...)`, and `(_, req) => ...` when the first argument is intentionally unused in `demo-app/srv/cat-service.js`.

**Return Values:** Return CAP-compatible plain objects or request errors. Examples include returning updated `book` state from `demo-app/srv/cat-service.js`, returning parsed n8n response JSON or `{ success: true }` from `cap-n8n-plugin/lib/N8nWorkflowService.js`, and returning `super.init()` from CAP service `init()` methods in `demo-app/srv/admin-service.js` and `demo-app/srv/cat-service.js`.

## Module Design

**Exports:** Use CommonJS exports for Node.js modules: `module.exports = N8nWorkflowService` in `cap-n8n-plugin/lib/N8nWorkflowService.js`, inline `module.exports = class ...` in `demo-app/srv/admin-service.js` and `demo-app/srv/cat-service.js`.

**Package Entries:** `cap-n8n-plugin/index.js` exports the reusable service classes and workflow tools. `cap-n8n-node/index.js` exports package registration metadata derived from `cap-n8n-node/package.json`; the runtime n8n node implementation lives under `cap-n8n-node/nodes/SapCap/`.

---

*Convention analysis: 2026-06-03*
