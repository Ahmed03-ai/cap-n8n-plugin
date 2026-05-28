# Architecture Research: CAP/n8n Integration

**Project:** CAP n8n Integration
**Dimension:** Architecture
**Researched:** 2026-05-28
**Overall confidence:** HIGH for CAP and n8n packaging conventions; MEDIUM for exact n8n execution-response semantics because webhook workflows vary by workflow design.

## Executive Recommendation

Evolve the prototype into two product packages with a shared demo and test fixture layer:

1. `cap-n8n-plugin`: a CAP plugin package that contributes a typed CDS service model, runtime implementation, mock implementation, annotation registrar, workflow import CLI, build-time validator, and optional execution persistence model.
2. `cap-n8n-node`: an n8n community-node package that follows n8n's TypeScript package structure, with credentials, an SAP CAP action node, shared OData helpers, metadata discovery, and a later optional polling trigger node.

Keep the demo app as a consumer, not as the integration owner. The current hard-coded `after CREATE Books` hook in `demo-app/srv/admin-service.js` should become a minimal example of calling `cds.connect.to('n8n')` or, preferably, an annotation-only demo. Reusable behavior belongs under `cap-n8n-plugin` and `cap-n8n-node`.

## Current Prototype Shape

```text
demo-app/srv/admin-service.js
  -> cds.connect.to('n8n')
  -> cap-n8n-plugin/lib/N8nWorkflowService.js
  -> POST /webhook-test/cap-test-trigger
  -> local n8n container workflow fixture
```

This proves the basic transport path, but it is not yet a maintainable architecture because:

- `cap-n8n-plugin/index.js` exports nothing.
- There is no plugin-owned CDS service contract.
- `cds-plugin.js` mutates `cds.env.requires.n8n` during bootstrap instead of relying primarily on package-level CAP auto-configuration.
- The only declarative workflow behavior is still requirements text.
- The n8n node package is empty and cannot be loaded by n8n.
- There is no execution store, so cancel/query/business-key lookup cannot be reliable.

## Target Component Boundaries

| Component | Package | Responsibility | Must Not Own |
|-----------|---------|----------------|--------------|
| CAP plugin bootstrap | `cap-n8n-plugin/cds-plugin.js` | Register CAP plugin hooks, build plugin, and runtime annotation registration. | Business-domain event code from the demo app. |
| CAP service model | `cap-n8n-plugin/srv/n8n-workflow-service.cds` | Typed `N8nWorkflowService` contract for `start`, `cancel`, and `query`. | n8n node editor metadata. |
| CAP runtime service | `cap-n8n-plugin/lib/N8nWorkflowService.js` | Real n8n webhook/API HTTP calls, retries, timeouts, CDS error normalization. | Annotation scanning, workflow import, test-only mock state. |
| CAP mock service | `cap-n8n-plugin/lib/MockN8nWorkflowService.js` | In-memory deterministic start/cancel/query behavior for local development and integration tests. | Real network calls. |
| Execution store | `cap-n8n-plugin/lib/ExecutionStore.js` plus plugin CDS model | Persist correlation IDs, execution IDs, business keys, statuses, payload summaries, errors, and timestamps. | Durable business state owned by the consumer app. |
| Annotation registrar | `cap-n8n-plugin/lib/annotations/register.js` | Scan CSN annotations, validate referenced entities/elements, attach CAP handlers to served services. | Transport implementation details. |
| Mapping/condition engine | `cap-n8n-plugin/lib/annotations/*` | Evaluate safe CDS annotation expressions and map entity data to workflow inputs. | JavaScript `eval` or app-specific assumptions. |
| Workflow import CLI | `cap-n8n-plugin/bin/cap-n8n.js` | Import local or remote workflow JSON and generate typed CDS artifacts in the consuming app. | Running during every `cds build` by default. |
| CAP build plugin | `cap-n8n-plugin/lib/build.js` | Validate annotations against generated workflow CDS types during `cds build`. | Network fetches or mutation of source workflows. |
| Demo app | `demo-app` | Show programmatic and declarative usage against Bookshop services. | Reusable plugin logic. |
| n8n credentials | `cap-n8n-node/credentials/SapCapApi.credentials.ts` | Base URL, Basic Auth, OAuth2 client credentials, `$metadata` test request. | CAP plugin credentials. |
| n8n action node | `cap-n8n-node/nodes/SapCap/SapCap.node.ts` | Query, Read, Create, Update, Delete, Action/Function operation modes. | Polling trigger state. |
| n8n metadata helpers | `cap-n8n-node/nodes/SapCap/methods` and shared helpers | Fetch/cache/parse OData `$metadata`, populate dropdowns, build key predicates. | Workflow execution state in CAP plugin. |
| n8n trigger node | `cap-n8n-node/nodes/SapCapTrigger/SapCapTrigger.node.ts` | Optional polling trigger after the action node is stable. | First milestone table-stakes action behavior. |

## Recommended Package Layout

### CAP Plugin Package

```text
cap-n8n-plugin/
  package.json
  index.js
  cds-plugin.js
  bin/
    cap-n8n.js
  srv/
    n8n-workflow-service.cds
    n8n-execution-store.cds
  lib/
    N8nWorkflowService.js
    MockN8nWorkflowService.js
    HttpClient.js
    ExecutionStore.js
    errors.js
    config.js
    annotations/
      register.js
      scan.js
      validate.js
      mapInputs.js
      evaluateCondition.js
    import/
      local.js
      remote.js
      generateCds.js
    build.js
```

`index.js` should export public programmatic APIs:

```js
module.exports = {
  N8nWorkflowService: require('./lib/N8nWorkflowService'),
  MockN8nWorkflowService: require('./lib/MockN8nWorkflowService'),
  registerAnnotations: require('./lib/annotations/register'),
}
```

The package should declare `@sap/cds` as a peer dependency and `@sap/cds-dk` as a dev dependency for build-plugin development/testing. The current demo depends on `@sap/cds` `^9.9.1`, so plan around Node.js 20+ and current CAP 9 behavior.

### n8n Node Package

Keep the workspace folder name if useful, but change the package name before publish to a valid community-node name such as `n8n-nodes-sap-cap` or `@<scope>/n8n-nodes-sap-cap`.

```text
cap-n8n-node/
  package.json
  tsconfig.json
  eslint.config.mjs
  credentials/
    SapCapApi.credentials.ts
  nodes/
    SapCap/
      SapCap.node.ts
      SapCap.node.json
      actions/
        query.operation.ts
        read.operation.ts
        create.operation.ts
        update.operation.ts
        delete.operation.ts
        invoke.operation.ts
      methods/
        loadOptions.ts
      transport/
        capRequest.ts
        metadata.ts
        normalizeResponse.ts
        odataUrl.ts
    SapCapTrigger/
      SapCapTrigger.node.ts
      SapCapTrigger.node.json
  dist/
```

Use TypeScript for this package. n8n's current community-node conventions expect `*.node.ts`, `*.credentials.ts`, compiled `dist` output, and a `package.json` `n8n` block pointing to compiled node and credential files. This is a deliberate exception to the CAP plugin's CommonJS style because it follows n8n's official package shape.

## Typed CAP Service Model

Add a plugin-owned CDS model and bind it to the runtime implementation. The exact CDS syntax should be validated in the first implementation phase, but the contract should be shaped like this:

```cds
namespace cap.n8n;

type WorkflowStatus : String enum {
  running;
  waiting;
  success;
  error;
  cancelled;
  unknown;
}

type ExecutionResult {
  executionId   : String;
  correlationId : UUID;
  workflowId    : String;
  status        : WorkflowStatus;
  businessKey   : String;
  startedAt     : Timestamp;
  finishedAt    : Timestamp;
  output        : Map;
  error         : String;
}

type ExecutionQuery {
  executionId : String;
  workflowId  : String;
  businessKey : String;
  status      : WorkflowStatus;
  top         : Integer default 100;
  skip        : Integer default 0;
}

service N8nWorkflowService {
  action start(workflowId: String, inputs: Map, businessKey: String, tags: array of String) returns ExecutionResult;
  action cancel(executionId: String, reason: String) returns ExecutionResult;
  action query(filter: ExecutionQuery) returns many ExecutionResult;
}
```

Use `Map` for untyped JSON payloads and generated structured types for imported workflows. CAP's current built-in type list includes `Map` as a JSON-like type, but the implementation phase should include an OData/runtime smoke test because typed action payload behavior is exactly where CAP version differences show up.

Generated workflow types should extend this baseline rather than replace it:

```cds
namespace cap.n8n.imported;

type BookCreatedInputs {
  event  : String;
  bookId : Integer;
  title  : String;
}

extend service cap.n8n.N8nWorkflowService with {
  action startBookCreated(inputs: BookCreatedInputs, businessKey: String) returns cap.n8n.ExecutionResult;
}
```

## CAP Configuration and Plugin Registration

Prefer CAP package auto-configuration over bootstrap-time mutation. CAP plugin packages are detected through a root `cds-plugin.js`, and package-level `cds` configuration is merged into `cds.env` by CAP-supported CLI flows including `cds-serve`, `cds watch`, `cds build`, and `cds.test()`.

Recommended package-level configuration direction:

```jsonc
{
  "cds": {
    "requires": {
      "kinds": {
        "n8n": {
          "model": "cap-n8n-plugin/srv/n8n-workflow-service",
          "impl": "cap-n8n-plugin/lib/N8nWorkflowService.js"
        },
        "n8n-mock": {
          "model": "cap-n8n-plugin/srv/n8n-workflow-service",
          "impl": "cap-n8n-plugin/lib/MockN8nWorkflowService.js"
        }
      }
    }
  }
}
```

Consumer app configuration should then be explicit:

```jsonc
{
  "cds": {
    "requires": {
      "n8n": {
        "kind": "n8n",
        "credentials": {
          "webhookBaseUrl": "{env.N8N_WEBHOOK_BASE_URL}",
          "apiBaseUrl": "{env.N8N_API_BASE_URL}",
          "apiKey": "{env.N8N_API_KEY}"
        },
        "[development]": {
          "kind": "n8n-mock"
        },
        "[production]": {
          "kind": "n8n"
        }
      }
    }
  }
}
```

Keep `cds-plugin.js` for hooks:

- Register the CAP build plugin with `cds.build.register('n8n', ...)`.
- Register annotation handlers during server bootstrapping after the model is loaded and services are being served.
- Preserve explicit app-level configuration. Do not overwrite a consumer's `cds.requires.n8n.impl`.
- Fail fast in production when `apiBaseUrl` or `apiKey` is missing.

## Data Flow

### Programmatic Start

```text
CAP service handler
  -> const n8n = await cds.connect.to('n8n')
  -> n8n.send('start', { workflowId, inputs, businessKey, tags })
  -> N8nWorkflowService validates request
  -> ExecutionStore creates local correlation record
  -> HttpClient POSTs to n8n webhook URL
  -> response parser extracts executionId/status if present
  -> ExecutionStore updates record
  -> CDS action returns ExecutionResult
```

This is allowed to be blocking because the CAP developer called it programmatically. It should propagate structured CDS errors.

### Declarative Start

```text
CAP model annotation
  -> plugin scans compiled CSN
  -> plugin attaches after CREATE/UPDATE/DELETE handler
  -> business transaction persists entity
  -> handler builds workflow payload and correlation record
  -> queued/outboxed dispatch calls N8nWorkflowService.start
  -> original transaction does not roll back on n8n failure
  -> failure is stored/logged against correlation record
```

Declarative triggers should be best-effort by default and should not make the original OData request wait on the remote workflow unless the annotation explicitly asks for `mode: 'blocking'`. For transactional safety, use CAP's queued/outbox pattern or a plugin-owned dispatch table plus `cds.spawn` worker. The first durable implementation should use one mechanism consistently; do not mix inline `await fetch()` with queued dispatch for annotations.

### Cancel

```text
CAP code or annotation
  -> resolve executionId from request, local execution store, businessKey, or tag
  -> call n8n API POST /api/v1/executions/{id}/stop
  -> update local status to cancelled or no-op status
```

The n8n API key must include execution stop/read/list scopes where scoped API keys are available. Local execution state is required because n8n execution history can be pruned and because business-key lookup is a CAP integration concern, not an n8n primitive.

### Query

```text
N8nWorkflowService.query(filter)
  -> query local ExecutionStore first
  -> optionally enrich by n8n API execution read/list when executionId is known or refresh=true
  -> return paginated ExecutionResult list
```

Do not rely only on n8n's execution list for product behavior. n8n can prune execution data, workflows may not save successful execution payloads, and webhook responses are workflow-configurable. The CAP plugin should own its correlation index.

### n8n to CAP Action Node

```text
n8n workflow item(s)
  -> SAP CAP node operation mode
  -> credential test/fetch against CAP service $metadata
  -> metadata parser resolves entity sets, keys, actions, functions
  -> OData request to CAP service
  -> response cleanup strips OData wrappers/metadata
  -> n8n returns one item per entity or one item per action result
```

## Persistence and Execution State

Add a plugin-owned persistence model for integration state. Minimum recommended entity:

```cds
namespace cap.n8n;

entity WorkflowExecutions {
  key correlationId : UUID;
  executionId       : String;
  workflowId        : String not null;
  businessKey       : String;
  status            : String;
  sourceService     : String;
  sourceEntity      : String;
  sourceEvent       : String;
  sourceKeys        : Map;
  input             : Map;
  response          : Map;
  error             : String;
  attempts          : Integer default 0;
  createdAt         : Timestamp;
  startedAt         : Timestamp;
  finishedAt        : Timestamp;
}
```

Implications:

- This creates consumer-app database artifacts when the plugin model is included. That is acceptable because cancel/query/declarative correlation need durable state.
- Mock executions can use the same contract but an in-memory store.
- Declarative failures should update this table and log through `cds.log('n8n')`.
- Retried webhook calls must use an idempotency/correlation value in the payload or headers where possible. Without that, transient retry can create duplicate workflow runs.
- Keep full payload storage configurable. Production systems may want only selected fields or redacted payload summaries.

## Annotation Model and Registration

Use custom CDS annotations on entities or projections:

```cds
annotate AdminService.Books with @n8n.workflow.start: {
  workflow: 'book-created',
  on: ['CREATE'],
  mode: 'queued',
  businessKey: (ID),
  when: (title is not null),
  inputs: {
    event: 'BookCreated',
    bookId: (ID),
    title: (title)
  }
};
```

Recommended behavior:

- Scan `cds.model.definitions` for `@n8n.workflow.start` and `@n8n.workflow.cancel`.
- Attach handlers to served application services, not to the database service.
- Register `after CREATE`, `after UPDATE`, and `before/after DELETE` as needed. DELETE often needs a before-hook snapshot because the after-hook may only have keys.
- Treat draft entities deliberately. The default should trigger only for active entity changes, not draft `NEW` events, unless the annotation opts into draft behavior.
- Validate mapped element paths against CSN at startup and again during `cds build`.
- Use CDS expression annotation values for `when`, `businessKey`, and mapped input references where possible. Current CAP docs say expression annotation paths are compiler-checked, which is better than free-text expressions.
- Implement a tiny safe evaluator for allowed expression/CXN operations. Do not use JavaScript `eval`.

Start with scalar mapping, then add to-one association expansion, then to-many/composition expansion. Association expansion requires additional SELECTs and should be budgeted as its own implementation slice.

## Workflow Import and Build Plugin Boundaries

Split import and build responsibilities:

| Responsibility | Owner | Runs When | Network Allowed |
|----------------|-------|-----------|-----------------|
| Import local JSON | CLI `cap-n8n import --file` | Developer command | No |
| Import remote workflow | CLI `cap-n8n import --workflow <id>` | Developer command | Yes |
| Save sanitized workflow fixture | CLI import layer | Developer command | Yes for remote only |
| Generate CDS workflow types | CLI generation layer | Developer command | No after JSON is available |
| Validate annotations vs generated types | CAP build plugin | `cds build` | No |
| Runtime annotation registration | CAP plugin runtime | `cds serve`/deployment start | No network during registration |

Do not fetch live n8n workflows inside `cds build`. Builds should be deterministic and CI-friendly. Remote workflow import should be an explicit command that saves a local workflow JSON and generated CDS artifacts.

Recommended generated locations in the consuming app:

```text
demo-app/
  external/
    n8n/
      workflows/
        book-created.workflow.json
      generated/
        book-created.cds
      manifest.json
```

The build plugin should read `external/n8n/manifest.json`, generated CDS, and app annotations, then emit:

- Errors for missing required inputs and type mismatches.
- Warnings for extra inputs.
- Warnings, not errors, when a workflow has no imported typed definition, so untyped usage remains possible.

## n8n Community Node Architecture

Use a programmatic-style action node despite the REST surface because this node needs dynamic metadata discovery, OData key serialization, response cleanup, item splitting, and eventually action/function invocation. n8n recommends declarative style for most REST nodes, but programmatic style is appropriate when a node needs custom transformations or trigger behavior.

Credentials:

- `SapCapApi.credentials.ts`
- Fields: base URL, auth type, username/password for Basic, OAuth2 client credentials fields, optional default service path.
- Test request: `GET <baseUrl>/$metadata`.
- Mark secrets as password fields.
- Rely on n8n credential encryption instead of custom encryption.

Action node:

- Operations: `query`, `read`, `create`, `update`, `delete`, `invoke`.
- Dynamic dropdowns: entity set list, key fields, action/function list.
- OData helpers: build collection URLs, key predicates, query options, bound/unbound action paths.
- Response cleanup: remove `value` wrapper for collections, strip `@odata.*`, emit one n8n item per collection row.
- Error handling: convert CAP/OData errors into descriptive n8n node errors with status and CAP error message where available.

Optional trigger node:

- Build after action node stability.
- Polls an entity set using `$filter` on modified timestamp where available.
- Stores last poll timestamp in n8n workflow static data.
- Requires deduplication by key because CAP models may not expose uniform update timestamps.

## Suggested Build Order

| Order | Phase | Why This First | Depends On | Unlocks |
|-------|-------|----------------|------------|---------|
| 1 | Package boundaries and local tooling | Empty entry points and placeholder test scripts block reliable development. | Existing workspace. | Smoke tests, clean imports, future package publishing. |
| 2 | Typed `N8nWorkflowService` plus real/mock runtime | All CAP features depend on a stable service contract. | Package metadata. | Programmatic start/cancel/query, mock development, retry/error tests. |
| 3 | Execution store and queued dispatch | Declarative triggers and cancel/query need durable correlation state. | Service contract. | Non-rollback annotation delivery, business-key lookup, retry tracking. |
| 4 | Annotation registrar with scalar mappings | Moves value proposition out of demo hard-coded handlers. | Runtime service and execution store. | `@n8n.workflow.start` for CREATE/UPDATE/DELETE with safe conditions. |
| 5 | Workflow import and build validation | Type safety requires a stable annotation shape first. | Annotation model. | Generated CDS inputs and `cds build` validation. |
| 6 | Demo migration and integration fixtures | Proves the CAP package works as a consumer would use it. | Phases 2-5. | Supervisor-visible end-to-end proof. |
| 7 | n8n node scaffold, credentials, metadata discovery | n8n package is currently empty and needs official structure before operations. | Package tooling. | n8n can load the community node and test CAP connectivity. |
| 8 | n8n query/read/create/update/delete/invoke operations | Core n8n-to-CAP product surface. | Credentials and metadata helpers. | Functional n8n workflows against CAP OData. |
| 9 | Optional polling trigger and deployment hardening | Trigger polling and BTP/hybrid guidance depend on stable runtime semantics. | Action node and CAP runtime. | Optional Epic 5 and production docs. |

Do not start with workflow import or the n8n polling trigger. Both depend on stable service contracts, metadata parsing, and execution-state decisions.

## Roadmap Implications

- Put CAP runtime foundation before annotations. Otherwise annotation behavior will encode unstable transport and execution semantics.
- Put execution persistence before declarative cancellation. Cancellation cannot be reliable without a stored execution ID, business key, or tag mapping.
- Put import/build validation after the annotation schema. The validator needs the final annotation shape to avoid churn.
- Put n8n node scaffolding before operation implementation. n8n package structure and linting are not incidental; they are part of whether n8n can discover the node.
- Treat the optional polling trigger as a later phase. It introduces state, deduplication, and timestamp semantics that should not slow the action node MVP.

## Anti-Patterns to Avoid

- Do not keep adding n8n calls inside demo service handlers as the main integration mechanism.
- Do not mutate `cds.env.requires.n8n` in a way that overwrites explicit consumer configuration.
- Do not make declarative triggers await a remote webhook call by default.
- Do not rely on webhook responses as the only source of execution IDs.
- Do not fetch live n8n workflows during `cds build`.
- Do not implement n8n community-node code as a single `index.js`; n8n expects node and credential files registered in the package metadata.
- Do not parse OData URLs with string concatenation only. Centralize entity-set, key-predicate, and query-option construction.
- Do not store production secrets in workflow fixtures, generated CDS, or committed request files.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| CAP plugin package mechanics | HIGH | Verified against current CAP docs for `cds-plugin.js`, package auto-configuration, service connection, and build plugin registration. |
| CAP typed service direction | MEDIUM | CAP service/action modeling is standard, but exact `Map`/array payload exposure should be smoke-tested against `@sap/cds` 9.9.1. |
| Annotation architecture | HIGH | CAP CSN annotations and expression annotation checks are documented; implementation complexity is in evaluator and association expansion. |
| Execution persistence need | HIGH | Requirements for cancel/query/business-key lookup cannot be met reliably without local correlation state. |
| n8n community-node structure | HIGH | Verified against current n8n docs for package naming, `n8n` package block, credentials, node files, and TypeScript structure. |
| n8n execution API details | MEDIUM | n8n docs confirm API keys and execution scopes including stop/list/read; exact response shapes should be validated with a live local n8n instance. |

## Sources

- CAP CDS plugin packages: https://cap.cloud.sap/docs/node.js/cds-plugins
- CAP required services and `cds.connect.to`: https://cap.cloud.sap/docs/node.js/cds-connect
- CAP build plugin API: https://cap.cloud.sap/docs/tools/apis/cds-build
- CAP server lifecycle: https://cap.cloud.sap/docs/node.js/cds-server
- CAP queued/outbox behavior: https://cap.cloud.sap/docs/node.js/queue
- CAP transactions and `cds.spawn`: https://cap.cloud.sap/docs/node.js/cds-tx
- CAP CDS annotations and expressions: https://cap.cloud.sap/docs/cds/cdl
- CAP built-in types including `Map`: https://cap.cloud.sap/docs/cds/types
- n8n community node standards: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/
- n8n node file structure: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-file-structure/
- n8n credential files: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/
- n8n node building style guidance: https://docs.n8n.io/integrations/creating-nodes/plan/choose-node-method/
- n8n API authentication and execution scopes: https://docs.n8n.io/api/authentication/
- n8n execution data pruning: https://docs.n8n.io/hosting/scaling/execution-data/
