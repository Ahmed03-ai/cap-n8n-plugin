# Feature Landscape

**Domain:** Developer-facing SAP CAP plugin and n8n community node
**Project:** CAP n8n Integration
**Researched:** 2026-05-28
**Research focus:** Features only
**Overall confidence:** HIGH for CAP and n8n platform expectations; MEDIUM for prioritization because product scope is supervisor-driven and not market-validated.

## Executive Takeaway

The product has two user-facing surfaces and they should be scoped separately. The CAP plugin must first feel like a normal CAP integration: a typed `N8nWorkflowService`, `cds.connect.to('n8n')`, `cds.requires.n8n` configuration, profile-aware local mock and production credentials, and structured errors with integration tests. The n8n side must first feel like a normal n8n action node: installable community-node package metadata, credential type, dynamic entity set discovery, Query/Read/Create/Update/Delete operations, clean n8n items, and n8n-native errors.

The strongest differentiator is not "CAP can call a webhook" because the prototype already proves that and any CAP developer can hand-code it. The differentiator is typed, declarative, build-validated workflow integration: CDS annotations, workflow import from JSON or live n8n, generated CDS typings, and validation during `cds build`.

The optional polling trigger node should stay out of the first version. CAP already has a stronger trigger path through the plugin, while polling from n8n adds state tracking, deduplication, and performance risk before the action node is stable.

## Table Stakes

Features users expect. Missing means the project feels incomplete for a developer-facing CAP/n8n integration.

| Feature | Surface | Why Expected | Complexity | Status | Dependencies | Notes |
|---------|---------|--------------|------------|--------|--------------|-------|
| Installable CAP plugin package surface | CAP plugin | CAP developers expect package entry points, peer dependencies, and plugin auto-registration to work without importing internal files. | Medium | Partial | Package metadata cleanup, exported public API, `cds-plugin.js` bootstrap tests | Current package behavior depends on `cds-plugin.js` and an internal service path; `index.js` is empty. |
| Typed CDS `N8nWorkflowService` contract | CAP plugin | CAP services normally expose typed CDS actions/functions and implementations; a JavaScript-only handler is not enough for generated clients or build-time validation. | Medium | Missing | Service `.cds` file, implementation binding, integration tests | Include `start`, `cancel`, and `query` in the service model. |
| Programmatic `start(workflowId, inputs)` | CAP plugin | This is the minimal CAP-to-n8n use case and is already the prototype's value proof. | Medium | Partial | Typed service contract, credential config, webhook/API transport | Current implementation posts to webhook and returns parsed response, but does not guarantee execution ID or CDS-normalized errors. |
| Programmatic cancel execution | CAP plugin | Lifecycle management is part of the supervisor requirements and n8n's public API includes execution stop endpoints. | Medium | Missing | Execution ID capture, n8n API client, error model | Must distinguish unsupported/completed/not-found results from transport failures. |
| Execution query and pagination | CAP plugin | Developers need status/progress lookup by execution ID, workflow ID, tag, or business key to build CAP UIs around workflow progress. | High | Missing | n8n API client, execution store/correlation model, pagination normalization | Filtering by business key depends on custom execution data/tags or plugin-side state. |
| Local mock service | CAP plugin | Offline development and deterministic integration tests are expected in a developer tool. | Medium | Missing | Same CDS service contract as real adapter, profile selection, in-memory execution store | Should support start/cancel/query and configurable state transitions. |
| Profile-aware configuration | CAP plugin | CAP supports profile-specific configuration via `[development]`, `[production]`, `NODE_ENV`, and `CDS_ENV`; the plugin should use those conventions. | Medium | Partial | `cds.requires.n8n` schema, startup validation, `.env.example` | Development should default to mock when credentials are absent; production should fail clearly without `baseUrl` and `apiKey`. |
| Credential handling without committed secrets | CAP plugin | CAP docs explicitly keep service credentials in environment/service bindings rather than hard-coded project config. | Low | Partial | Config docs, redacted fixtures, production checks | The demo references env for API key, but README/test examples still include static Basic auth material. |
| HTTP timeout, retry, and retryable status classification | CAP plugin | Integrations need resilience for transient 502/503/504 and network failures. | Medium | Missing | HTTP client wrapper, AbortController, structured logs, tests | Default retry count from requirements is 3; avoid retrying non-idempotent starts unless idempotency/correlation is addressed. |
| Structured CAP error propagation | CAP plugin | CAP callers should receive standard CDS errors, not raw stack traces or unsanitized remote bodies. | Medium | Partial | Error class/helper, response sanitization, production log policy | Current code throws normal `Error` and can include remote response text in logs. |
| Declarative CREATE trigger annotation | CAP plugin | Supervisor requirements make annotation-driven triggers central; CAP developers expect reusable model-level behavior instead of hard-coded app handlers. | High | Missing | Annotation scanner, service registration hooks, non-blocking dispatch, mapping defaults | `@n8n.workflow.start` on CREATE should trigger after persistence and should not roll back the CAP transaction when n8n fails. |
| Declarative UPDATE/DELETE trigger selection | CAP plugin | A data-change integration is incomplete if only CREATE is supported. | High | Missing | Same scanner as CREATE, event selector syntax, delete key payload rules | Default should remain CREATE to avoid surprising workflow volume. |
| Input mapping from CDS data to workflow payload | CAP plugin | Workflows need controlled payloads instead of blindly sending full records. | High | Missing | Annotation schema, mapping resolver, association expansion, validation | Support scalars first; association and to-many expansion are higher risk. |
| Integration tests, not unit-test-only coverage | Both | Supervisor feedback explicitly requires integration-test language and behavior. | Medium | Missing | Test harness, mock n8n endpoint, demo CAP runtime, n8n node test utilities | Plan should avoid "unit tests" as the primary acceptance wording. |
| Installable n8n community-node package | n8n node | n8n community nodes are discovered through package metadata, compiled `dist` files, and `n8n` entries for nodes and credentials. | Medium | Missing | n8n node scaffold, TypeScript build, package metadata, local n8n dev loop | Current `cap-n8n-node/index.js` is empty. |
| SAP CAP credential type | n8n node | n8n users expect reusable credentials, encrypted storage, and a Test button. | Medium | Missing | Credential class, Basic Auth, OAuth2 client credentials, `$metadata` test request | Basic Auth and OAuth2 match mockups and BTP/local expectations. |
| Query operation for CAP entity collections | n8n node | OData collection reads with `$filter`, `$orderby`, `$top`, `$skip`, and `$select` are basic table-stakes for workflow automation. | Medium | Missing | Credential type, metadata discovery, OData URL builder, response cleanup | Should emit each collection item as an n8n item. |
| Read operation for one CAP entity | n8n node | Users need direct lookup when they already have the key from a previous n8n step. | Medium | Missing | Entity metadata, key parser, composite key handling, error handling | Must distinguish Read from Query in labels and behavior. |
| Create operation | n8n node | n8n workflows commonly write records back to business systems. | Medium | Missing | Entity set selection, JSON body field, POST request, response cleanup | Return created record with server-generated fields. |
| Update operation | n8n node | Workflows need to patch existing CAP entities after enrichment or approval. | Medium | Missing | Key handling, JSON body field, PATCH request, error handling | Use PATCH, not PUT, for partial updates. |
| Delete operation | n8n node | Delete by key is part of a complete CRUD action node and is already in mockups. | Medium | Missing | Key handling, DELETE request, confirmation output | Keep confirmation simple; avoid destructive bulk delete. |
| Dynamic `$metadata` entity discovery | n8n node | A developer-facing n8n node should not require typing entity set names manually. | High | Missing | Credential test, XML parser, load options/cache, failure display | This is essential to make the n8n node feel first-class. |
| OData response cleanup | n8n node | n8n users expect plain item JSON, not OData wrappers and metadata fields. | Medium | Missing | Response normalizer, date/time formatting rules, integration tests | Remove `value`, `@odata.context`, and `@odata.etag` where appropriate. |
| n8n-native error handling | n8n node | n8n docs expect `NodeApiError` for external API failures and `NodeOperationError` for validation/configuration failures. | Medium | Missing | Error helper, HTTP wrapper, per-operation validation | Surface 401, 404, validation errors, and CAP OData errors clearly. |
| Local developer docs | Both | The repo targets CAP developers and n8n workflow designers; setup must cover local mock, local real n8n, cloud n8n, and local CAP-to-n8n-node testing. | Medium | Partial | Stable scripts, `.env.example`, Docker Compose, sanitized workflow fixtures | README has local n8n setup but not the full target configuration matrix. |

## Differentiators

Features that set the project apart. They are valuable, but should follow the table-stakes foundation unless called out as MVP-critical.

| Feature | Surface | Value Proposition | Complexity | Status | Dependencies | Recommendation |
|---------|---------|-------------------|------------|--------|--------------|----------------|
| Workflow import from local n8n JSON | CAP plugin | Converts n8n workflow artifacts into CAP-facing typed integration contracts while staying offline. | High | Missing | Workflow parser, trigger-node conventions, CDS generator, file layout | Build after typed service and basic annotations. |
| Workflow import from live n8n | CAP plugin | Lets developers sync real n8n workflow definitions without manually exporting JSON. | High | Missing | n8n API credentials, workflow API client, local artifact writer | Build after local import so remote fetch is only an input source. |
| Generated CDS typings for workflow inputs | CAP plugin | Gives CAP developers type safety and IDE discoverability instead of stringly typed workflow payloads. | High | Missing | Import pipeline, CDS generator, naming/version strategy | Strong differentiator for supervisor-facing value. |
| `cds build` validation of workflow mappings | CAP plugin | Catches missing inputs, type mismatches, and invalid annotations before runtime. | High | Missing | Build plugin, generated workflow model, annotation scanner | Use warnings for untyped workflows so adoption is incremental. |
| Conditional workflow trigger expressions | CAP plugin | Reduces noisy workflows by starting automation only when CAP data meets business conditions. | High | Missing | Safe expression parser/evaluator, registration-time validation | Implement after basic trigger mapping; keep expression language narrow. |
| Declarative cancellation annotations | CAP plugin | Lets model changes stop obsolete workflows without imperative code. | High | Missing | Execution correlation store, cancel API, annotations, no-op semantics | Valuable but depends on lifecycle foundation and should not precede query/cancel API. |
| Correlation IDs and business keys | CAP plugin | Makes CAP records, n8n executions, logs, retries, and cancellation linkable. | High | Missing | Execution store, payload conventions, logging, query filters | Treat as foundational for reliable retry/cancel rather than optional polish. |
| Idempotent workflow start support | CAP plugin | Prevents duplicate workflow executions when CAP retries or n8n/network failures occur. | High | Missing | Correlation key, execution store, retry policy, workflow conventions | Important before aggressive retry defaults for `start`. |
| CAP action/function invocation mode | n8n node | Moves beyond CRUD by exposing CAP business operations to workflows. | High | Missing | `$metadata` parser for bound/unbound actions/functions, parameter UI, URL builder | Differentiator because CAP value often lives in actions/functions. |
| Composite-key-aware UI | n8n node | Makes the node practical for real CAP services where keys are not always a single `ID`. | Medium | Missing | Metadata parser, dynamic properties, key serializer | Include early if metadata parser already exposes keys. |
| Metadata cache and refresh behavior | n8n node | Improves UX and avoids repeated `$metadata` calls while editing workflows. | Medium | Missing | Load options cache keyed by credential/base URL, invalidation hooks | Needed for a polished node, but can be simple in v1. |
| BTP deployment guidance | Both | Makes the project credible for SAP users deploying on Cloud Foundry/Kyma and managing credentials through BTP mechanisms. | Medium | Missing | Production config validation, docs, sample snippets | Documentation feature first; only automate after runtime paths are stable. |
| Hybrid local/cloud setup | Both | Lets developers run CAP locally against cloud n8n or n8n locally against CAP. | Medium | Partial | Profiles, `.env.example`, docs, credential testing | Good v1 documentation target because it reduces evaluation friction. |
| Sanitized workflow fixture management | Both | Keeps n8n workflow examples useful without leaking owner/project IDs or credentials. | Medium | Partial | Import/export scripts, sanitizer, test fixtures | Existing workflow export should be sanitized before it becomes a long-term sample. |
| n8n verified-community-node readiness | n8n node | Improves trust, discoverability, and possibly cloud availability after initial self-hosted use. | Medium | Missing | n8n-node CLI scaffold, lint, docs, package metadata, verification checklist | Do not block early local development, but avoid package structure that prevents verification later. |

## Anti-Features

Features to explicitly not build. These either duplicate CAP/n8n platform capabilities, increase security risk, or distract from the integration product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom workflow engine in CAP | n8n is the workflow runtime; duplicating execution semantics creates a competing product and major maintenance burden. | Trigger, query, cancel, and correlate n8n executions. |
| Custom workflow designer UI | n8n already provides workflow design and execution UI. | Provide imports, typings, annotations, and n8n node configuration inside platform conventions. |
| CAP plugin visual mockups | The CAP plugin is used through code, CDS, config, generated artifacts, and docs. | Keep mockups only for the n8n node editor surface. |
| Broad generic OData client | A generic OData node can become endless: batch, deep insert, media streams, delta, aggregation, V2 quirks, ETags, and vendor-specific behavior. | Target CAP OData V4 CRUD, actions/functions, metadata discovery, and response cleanup. |
| OData V2-first support | CAP defaults to OData V4 and OData V2 is legacy/deprecated for new Node.js CAP apps. | Support OData V4 first; document V2 as out of scope unless a later phase proves demand. |
| Managed n8n hosting or deployment automation | Operating n8n is infrastructure work outside the plugin's value proposition. | Provide configuration and connectivity guidance for local, cloud, and BTP environments. |
| Secret management replacement | CAP, BTP, and n8n already have environment/service-binding/credential storage mechanisms. | Integrate with existing mechanisms and validate missing secrets. |
| Swallowing all integration errors silently | Silent failures make production workflows unobservable and hard to debug. | Separate best-effort declarative triggers from blocking programmatic calls; always log structured sanitized errors. |
| Raw stack traces or full remote response bodies in user-facing errors | Can leak internal details or sensitive payloads. | Surface source, status, code, and sanitized description; put verbose details behind debug logging. |
| Bulk destructive operations in v1 n8n node | Bulk delete/update increases blast radius and requires safeguards not present in the current requirements. | Support single-key delete/update first; add bulk operations only after explicit requirements and guardrails. |
| Full CAP sample domain expansion | The Bookshop demo already validates integration behavior. | Improve demo only where it proves plugin/node behavior or supports integration tests. |
| Mobile/end-user app UI | The primary users are CAP developers and n8n workflow designers. | Spend effort on APIs, annotations, generated artifacts, n8n node UX, and docs. |
| Simulated unsupported n8n lifecycle operations such as suspend/resume | n8n does not match SAP Build Process Automation lifecycle semantics. Fake support would mislead users. | Return clear warnings/errors and document supported lifecycle operations: start, stop/cancel where supported, query. |
| Mandatory live n8n for all development | This slows CAP developers and makes integration tests flaky. | Provide mock service and offline workflow JSON import. |
| Retrying workflow starts without idempotency guidance | Webhook retries can create duplicate executions from n8n's perspective. | Pair retries with correlation/idempotency strategy or limit retries to clearly safe cases. |

## Feature Dependencies

```text
CAP package surface -> Typed N8nWorkflowService -> start/cancel/query -> local mock -> profile docs

Typed N8nWorkflowService -> declarative annotation scanner -> CREATE trigger -> UPDATE/DELETE trigger -> input mapping -> conditional triggers

Workflow import -> generated CDS typings -> cds build validation -> safer annotations

start/cancel/query -> execution correlation store -> declarative cancellation -> idempotent retries

n8n package scaffold -> SAP CAP credential type -> metadata test request -> entity discovery -> Query/Read/Create/Update/Delete -> response cleanup

metadata parser -> composite keys -> action/function invocation -> polished dynamic UI

structured errors -> integration tests -> publishable/verified-node readiness
```

## MVP Recommendation

Prioritize:

1. CAP package surface plus typed `N8nWorkflowService` with `start`, structured errors, config profiles, and local mock.
2. n8n community-node scaffold plus SAP CAP credentials, `$metadata` test, dynamic entity set dropdown, Query and Read.
3. Create/Update/Delete plus OData response cleanup and n8n-native errors.
4. Basic declarative CREATE trigger annotation with scalar input mapping.
5. Integration test harness covering CAP plugin, mock, n8n transport, and n8n node operations.

Defer:

| Feature | Defer Until | Reason |
|---------|-------------|--------|
| Live workflow import | After local JSON import | Remote fetch should not be entangled with generator correctness. |
| Build-time validation | After generated typings | Validation needs a stable typed model to validate against. |
| Conditional trigger expressions | After basic annotations | Expression syntax/evaluation can become a separate risk area. |
| Declarative cancellation | After execution correlation store | It cannot be reliable without execution lookup/business-key mapping. |
| n8n polling trigger node | After action node maturity | Polling adds dedup/state/performance complexity and overlaps with CAP-driven triggers. |
| BTP staging E2E tests | After local integration tests pass | Cloud tests are expensive to debug before local contracts stabilize. |
| Verified n8n community-node submission | After package and UX stabilize | Verification should not drive early prototype mechanics, but structure should remain compatible. |

## Present Prototype vs Target Behavior

| Area | Current Prototype | Target Feature State |
|------|-------------------|----------------------|
| CAP to n8n trigger | Hard-coded Book create hook calls `n8n.send('start', ...)`. | Reusable programmatic API plus declarative CDS annotations. |
| CAP service contract | JavaScript class registers `start`; no CDS service model. | Typed CDS service with start/cancel/query and consistent return/error types. |
| n8n connection | `baseUrl` and optional API key from CAP config. | Profile-aware config, production validation, mock fallback in development, sanitized errors. |
| Retry/timeout | Direct `fetch` without timeout/retry. | Configurable timeout, retry classification, logs, and idempotency guidance. |
| Local development | Docker Compose n8n plus demo app. | Mock mode, real local n8n, cloud n8n, and n8n node local test path. |
| Workflow artifacts | One exported workflow fixture. | Sanitized fixtures plus import/generation path. |
| n8n node | Empty package entry with UI mockups only. | Installable community node with credentials, operations, metadata discovery, and tests. |
| Testing | No passing workspace tests detected. | Integration tests for service, mock, annotations, import, and n8n node operations. |

## Requirements Alignment

| Requirements Epic | Feature Classification | Phase Guidance |
|-------------------|------------------------|----------------|
| Epic 1: Programmatic API and Local Mocking | Table stakes | Build first; this is the runtime foundation for later features. |
| Epic 2: CAP Declarative Workflow Triggers | Differentiator after basic CREATE; table stakes for the final product vision | Split into CREATE trigger first, then update/delete, mapping, conditions, cancellation. |
| Epic 3: Workflow Import and Typings | Differentiator | Build after annotation basics so generator output has a clear consumer. |
| Epic 4: SAP CAP Action Node | Table stakes for n8n surface | Build scaffold, credentials, metadata discovery, CRUD, cleanup, and errors before action/function invocation. |
| Epic 5: SAP CAP Trigger Node | Optional/deferred | Keep out of v1 unless action node and CAP plugin are already stable. |
| Epic 6: Deployment and Configuration | Table stakes for docs; differentiator for BTP polish | Document local/hybrid early; defer BTP staging E2E until runtime contracts are stable. |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| CAP configuration and service expectations | HIGH | Verified against current CAP docs for `cds.connect.to`, `cds.requires`, credentials, profiles, service actions, and build plugins. |
| n8n community-node expectations | HIGH | Verified against current n8n docs for custom node creation, package metadata, credentials, installation, and error classes. |
| n8n execution lifecycle API | MEDIUM | Current n8n API reference lists execution get/delete/retry/stop endpoints, but exact stop behavior should be validated against the target n8n version during implementation. |
| OData operations | HIGH | CAP OData V4 support and metadata/service paths are verified in official CAP docs; CAP-specific response cleanup details should still be tested against the demo app. |
| Feature prioritization | MEDIUM | Based on supervisor-ready requirements and repo state, not direct user research. |

## Sources

- Project requirements: `cap_n8n_requirements_v2.md` (local source, HIGH confidence)
- Project state: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `README.md`, `mockups/n8n-node-mockup.html` (local source, HIGH confidence)
- CAP required services and `cds.requires`: https://cap.cloud.sap/docs/node.js/cds-connect (HIGH confidence)
- CAP configuration profiles: https://cap.cloud.sap/docs/node.js/cds-env (HIGH confidence)
- CAP build plugins: https://cap.cloud.sap/docs/tools/apis/cds-build (HIGH confidence)
- CAP service actions/functions: https://cap.cloud.sap/docs/guides/services/custom-actions (HIGH confidence)
- CAP OData V4 and `$metadata`: https://cap.cloud.sap/docs/advanced/odata.html (HIGH confidence)
- n8n custom node creation overview: https://docs.n8n.io/integrations/creating-nodes/overview/ (HIGH confidence)
- n8n node CLI and verified-node scaffold guidance: https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/ (HIGH confidence)
- n8n community node installation constraints: https://docs.n8n.io/integrations/community-nodes/installation/ (HIGH confidence)
- n8n credential file behavior and credential test requests: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/ (HIGH confidence)
- n8n node error handling: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/ (HIGH confidence)
- n8n public API overview and reference: https://docs.n8n.io/api/ and https://docs.n8n.io/api/api-reference/ (MEDIUM confidence for exact execution stop semantics)
