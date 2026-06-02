# Phase 04: Declarative CAP Annotations - Research

**Researched:** 2026-06-02
**Domain:** SAP CAP CDS annotations, CAP service handlers, transaction-safe n8n dispatch
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

Source: `.planning/phases/04-declarative-cap-annotations/04-CONTEXT.md`. [VERIFIED: codebase grep]

### Locked Decisions

- **D-01:** `@n8n.workflow.start` uses a structured object as the primary Phase 4 shape: `{ workflowId, on, inputs, if, businessKey, tag }`.
- **D-02:** Phase 4 supports one `@n8n.workflow.start` object per entity. Multiple different workflow starts on one entity are deferred beyond Phase 4.
- **D-03:** Canonical property names stay aligned with the existing plugin API: `workflowId`, `inputs`, `if`, `businessKey`, and `tag`.
- **D-04:** Event values use CAP event vocabulary: `CREATE`, `UPDATE`, and `DELETE`.
- **D-05:** `@n8n.workflow.cancel` uses a matching structured object: `{ workflowId, on, businessKey, tag }`.
- **D-06:** CREATE and UPDATE starts send mapped inputs only. If `inputs` is omitted, send key fields plus event metadata rather than a full entity row.
- **D-07:** DELETE starts send keys plus event metadata only by default.
- **D-08:** Annotated workflow starts always include minimal CAP event metadata: event name, entity name, service name when available, keys, and timestamp.
- **D-09:** Annotated trigger and cancellation failures are best-effort and non-blocking by default. They should be logged and persisted through the execution/dispatch state where applicable, but must not roll back the original CREATE, UPDATE, or DELETE by default.
- **D-10:** `inputs` uses an object map where keys are workflow input names and values are CDS element paths, for example `inputs: { bookId: 'ID', title: 'title' }`.
- **D-11:** Phase 4 supports scalar field mappings only.
- **D-12:** To-one association mapping and to-many association/composition expansion are explicitly deferred beyond Phase 4.
- **D-13:** Invalid `inputs` mappings fail at startup or service registration time when a mapped field does not exist or is not supported.
- **D-14:** Conditional starts use a small safe CQN-like string expression against scalar data, for example `if: "stock > 0 and title != null"`.
- **D-15:** Invalid condition expressions fail at startup or service registration time.
- **D-16:** Declarative cancellation matches active executions by annotated `workflowId` plus resolved `businessKey` and/or `tag`, using the Phase 3 execution query model.
- **D-17:** If multiple active executions match, cancel all matches.
- **D-18:** If no active execution matches, treat it as a non-blocking no-op warning.
- **D-19:** If `on` is omitted from `@n8n.workflow.cancel`, the default event is `DELETE`.

### the agent's Discretion

- Planner may choose exact helper/module names, annotation scanner structure, parser internals, and test file names, provided behavior stays package-owned under `cap-n8n-plugin`.
- Planner may choose the internal payload envelope shape, provided mapped inputs and minimal CAP event metadata are both visible to n8n and no full-row payload is sent by default.
- Planner may choose the exact safe expression subset for `if`, provided it is scalar-only, CQN-like, validation fails at registration time, and no arbitrary JavaScript evaluation is introduced.
- Planner may choose the CAP hook registration mechanism, provided starts and cancellations use the Phase 3 post-commit/outbox-safe path and remain non-blocking by default.

### Deferred Ideas (OUT OF SCOPE)

- Multiple different workflow starts on one entity are deferred beyond Phase 4.
- To-one association mapping and to-many association/composition expansion are deferred beyond Phase 4.
- Workflow import, generated CDS workflow typings, and build-time validation against imported workflow definitions remain Phase 5.
- n8n community-node credentials, metadata discovery, reads, writes, actions/functions, and response cleanup remain Phases 6 and 7.
- Deployment documentation, `.env.example`, SAP BTP guidance, and final release readiness remain Phase 8.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANNO-01 | CAP developer can annotate a CDS entity to start an n8n workflow after a successful CREATE. | Register package-owned `after('CREATE', entity, ...)` handlers from discovered `@n8n.workflow.start.*` CSN annotations and call the Phase 3 `n8n.start(..., { _req: req })` path. [VERIFIED: codebase grep] [CITED: https://cap.cloud.sap/docs/node.js/core-services] |
| ANNO-02 | CAP developer can configure annotated workflow starts for UPDATE and DELETE events. | CAP service handlers accept `CREATE`, `UPDATE`, and `DELETE` as CRUD event names, and the locked annotation event values use the same vocabulary. [CITED: https://cap.cloud.sap/docs/node.js/core-services] [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] |
| ANNO-03 | CAP developer can map selected scalar entity fields into the workflow input payload. | Validate mapped field paths against the linked entity elements, reject associations/compositions, and build payloads from CREATE result data or single-row UPDATE `req.subject` reads. [CITED: https://cap.cloud.sap/docs/node.js/cds-reflect] [CITED: https://cap.cloud.sap/docs/node.js/events] |
| ANNO-04 | CAP developer receives startup or registration-time errors for invalid annotations or missing mapped fields. | `cds-plugin.js` can register lifecycle hooks, and service handlers can be registered through served services; the parser should throw before traffic is handled. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins] [CITED: https://cap.cloud.sap/docs/node.js/core-services] |
| ANNO-05 | CAP developer can configure a conditional expression that decides whether a workflow should start. | Use `cds.parse.expr()` to parse the string into CXN, then whitelist a scalar operator subset before runtime evaluation. [CITED: https://cap.cloud.sap/docs/cds/cxn] [VERIFIED: local node probe] |
| ANNO-06 | CAP developer can declaratively cancel obsolete workflow executions when configured data events occur. | Resolve annotated `workflowId`, `businessKey`, and `tag`, query active Phase 3 executions, then call the existing `cancel(executionId)` API for every match. [VERIFIED: codebase grep] |
| ANNO-07 | Declarative trigger failures are logged without rolling back the original CAP write by default. | CAP `after` handlers can veto requests if they throw, while `req.on('succeeded')` runs after commit; annotation handlers must catch registration/runtime side-effect failures and rely on Phase 3 post-commit dispatch. [CITED: https://cap.cloud.sap/docs/guides/services/custom-code] [CITED: https://cap.cloud.sap/docs/node.js/events] |
| VERIFY-02 | Developer can run integration tests for declarative CAP annotations and non-rollback behavior. | Existing root scripts run Vitest integration tests, and Phase 3 tests already exercise in-memory SQLite, local HTTP webhook servers, rollback/no-dispatch, and post-commit dispatch patterns. [VERIFIED: package.json] [VERIFIED: test/integration/n8n-dispatch-and-duplicates.test.js] |
</phase_requirements>

## Summary

Phase 4 should add a package-owned annotation registrar under `cap-n8n-plugin` that scans served CAP service entities, reconstructs `@n8n.workflow.start` and `@n8n.workflow.cancel` from flattened CSN annotation keys, validates scalar-only configuration at registration time, and registers service handlers for the configured CRUD events. [VERIFIED: local node probe] [CITED: https://cap.cloud.sap/docs/cds/cdl] [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md]

The runtime path should not send webhooks directly from annotation handlers; it should build the mapped payload and metadata envelope, call the existing `N8nWorkflowService.start()` with the CAP request context, and let Phase 3 create the execution/outbox row plus post-commit dispatch. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] [VERIFIED: test/integration/n8n-dispatch-and-duplicates.test.js]

The highest-risk planner decision is DELETE input mapping beyond keys: Phase 4 decisions require keys plus event metadata by default, but non-key scalar DELETE mappings require a pre-delete snapshot because `req.subject` cannot read the row after deletion. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] [CITED: https://cap.cloud.sap/docs/node.js/events] [ASSUMED]

**Primary recommendation:** Implement `cap-n8n-plugin/lib/annotations/*` helpers that parse flattened CSN annotation prefixes, validate scalar paths and safe CXN conditions at service registration, and reuse Phase 3 `start/queryExecutions/cancel` APIs for all runtime side effects. [VERIFIED: codebase grep] [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins]

## Project Constraints (from AGENTS.md)

- Keep implementation in JavaScript CommonJS, SAP CAP, CDS/CDL, npm workspaces, Docker Compose, and existing n8n community-node conventions. [VERIFIED: AGENTS.md]
- Use Node.js 20+ because the locked CAP dependency requires a modern Node runtime. [VERIFIED: AGENTS.md] [VERIFIED: npm registry]
- Use integration-test wording and coverage rather than unit-test-only planning language. [VERIFIED: AGENTS.md]
- Keep reusable behavior in `cap-n8n-plugin` and `cap-n8n-node`; demo behavior is evidence, not the integration owner. [VERIFIED: AGENTS.md]
- Keep secrets in environment configuration and do not commit API keys, private keys, or real production credentials in docs or fixtures. [VERIFIED: AGENTS.md]
- Match local code conventions: CommonJS, two-space indentation, single quotes, CAP `cds.log('n8n')`, and no semicolons in `cap-n8n-plugin/lib/*.js` unless editing a file that already uses them. [VERIFIED: AGENTS.md] [VERIFIED: codebase grep]
- No project-specific `.codex/skills/` or `.agents/skills/` directory exists, so there are no additional project skill rules to apply. [VERIFIED: local command audit]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Annotation discovery | API / Backend | CDS model layer | CAP plugin startup owns model inspection because annotations are CDS metadata consumed by service runtime. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins] |
| Annotation validation | API / Backend | CDS model layer | Invalid workflow annotation shapes, field paths, and conditions should fail while services are being registered. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] |
| CRUD hook registration | API / Backend | CDS service runtime | CAP service handlers are registered on service instances with CRUD events and served entity definitions. [CITED: https://cap.cloud.sap/docs/node.js/core-services] |
| Payload mapping | API / Backend | Database / Storage | CREATE data is available in handler results, while UPDATE mapped fields may require a transactional read from `req.subject`. [CITED: https://cap.cloud.sap/docs/node.js/events] |
| Conditional evaluation | API / Backend | CDS expression parser | `cds.parse.expr()` can parse CXN, but the plugin must enforce its own safe scalar subset. [CITED: https://cap.cloud.sap/docs/cds/cxn] |
| Workflow start dispatch | API / Backend | Database / Storage | Phase 3 `start()` persists execution/outbox state and dispatches after commit when `_req` is provided. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] |
| Declarative cancellation | API / Backend | Database / Storage | Phase 3 owns queryable execution state and cancellation transitions, so annotation cancellation should consume that API. [VERIFIED: cap-n8n-plugin/lib/ExecutionStore.js] [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] |
| Demo evidence | CAP demo service model | CAP plugin runtime | Demo annotations should show usage on `AdminService.Books`, while generic trigger behavior remains in `cap-n8n-plugin`. [VERIFIED: demo-app/srv/admin-service.cds] [VERIFIED: demo-app/srv/admin-service.js] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sap/cds` | locked `9.9.1`; npm latest `9.9.1`; published 2026-04-28 | CAP runtime, CDS parsing, service handlers, reflection, transactions, and logging. | Existing runtime dependency and official CAP API surface for annotations, handlers, request context, and CXN parsing. [VERIFIED: package.json] [VERIFIED: npm registry] [CITED: https://cap.cloud.sap/docs/node.js/core-services] |
| `cap-n8n-plugin` workspace | local `1.0.0` | Package-owned integration boundary for service implementation, model registration, execution store, and dispatcher. | Phase 4 must extend this package rather than demo app handlers. [VERIFIED: cap-n8n-plugin/package.json] [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] |
| Node.js | local `24.16.0`; required `>=20` | Runtime for CommonJS CAP plugin and global `fetch`. | Local runtime satisfies the package engine and CAP dependency requirements. [VERIFIED: local command audit] [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@sap/cds-dk` | locked/local `9.9.1`; npm latest `9.9.2`; latest published 2026-05-29 | Repo-local CAP CLI for compile/serve/test workflows. | Use existing locked tooling unless a separate dependency-update phase is created. [VERIFIED: package.json] [VERIFIED: npm registry] |
| `@cap-js/sqlite` | locked/local `2.4.0`; npm latest `2.4.0`; latest tag published 2026-04-29 | In-memory SQLite persistence for CAP integration tests. | Use for annotation integration tests that need execution/outbox records without Docker n8n. [VERIFIED: demo-app/package.json] [VERIFIED: npm registry] |
| `vitest` | locked/local `4.1.7`; npm latest `4.1.8`; latest published 2026-06-01 | Integration test runner. | Use existing root `test:integration` script and add Phase 4 suites under `test/integration/`. [VERIFIED: package.json] [VERIFIED: local command audit] [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cds.parse.expr()` | Custom expression tokenizer/parser | A custom parser duplicates CAP grammar handling and raises security risk; CAP already emits CXN objects that can be whitelisted. [CITED: https://cap.cloud.sap/docs/cds/cxn] |
| Phase 3 `start(..., { _req })` | Direct HTTP `fetch()` from annotation handlers | Direct HTTP dispatch can run before commit and bypasses execution/outbox persistence, retries, duplicate metadata, and sanitization. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] |
| `queryExecutions()` plus `cancel()` | Direct `WorkflowExecutions` table updates | Direct updates would bypass Phase 3 cancellation semantics for queued, running, terminal, missing, and unsupported executions. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] |

**Installation:**

```bash
# No new external packages should be installed for Phase 4.
npm install
```

**Version verification:** `npm view @sap/cds version`, `npm view @sap/cds-dk version`, `npm view @cap-js/sqlite version`, and `npm view vitest version` were checked on 2026-06-02. [VERIFIED: npm registry]

## Package Legitimacy Audit

No new external package installation is recommended for Phase 4, so the Package Legitimacy Gate is not required for execution. [VERIFIED: codebase grep] [ASSUMED]

`slopcheck` was not available locally, but the absence does not block this phase because the recommended plan uses existing checked-in dependencies only. [VERIFIED: local command audit]

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| none | n/a | n/a | n/a | n/a | n/a | No new installs recommended. [ASSUMED] |

**Packages removed due to slopcheck [SLOP] verdict:** none. [VERIFIED: local command audit]
**Packages flagged as suspicious [SUS]:** none. [VERIFIED: local command audit]

## Architecture Patterns

### System Architecture Diagram

```text
CAP app starts
  |
  v
cap-n8n-plugin/cds-plugin.js
  | registers model + served lifecycle hook
  v
Served CAP services
  |
  v
Annotation registrar scans srv.entities / srv.model definitions
  |
  +--> no @n8n annotations --> no handler registered
  |
  +--> @n8n.workflow.start.* / @n8n.workflow.cancel.*
          |
          v
     Normalize flattened CSN prefix keys into config objects
          |
          v
     Validate workflowId, events, scalar mappings, businessKey/tag, condition CXN
          |
          +--> invalid --> throw startup/registration error
          |
          v
     Register after CREATE/UPDATE/DELETE handlers on served entities
          |
          v
CAP write succeeds through generic/application handlers
          |
          v
Annotation handler resolves keys, mapped scalar payload, metadata, condition
          |
          +--> condition false --> log debug/info and skip
          |
          +--> start --> n8n.start(workflowId, payload, { businessKey, tag, _req: req })
          |              |
          |              v
          |          Phase 3 execution + outbox inside tx, dispatch after req succeeded
          |
          +--> cancel --> query active executions by workflowId + businessKey/tag
                         |
                         v
                    cancel all matches through Phase 3 cancel()
```

This flow keeps declarative annotations as a backend runtime concern and keeps workflow dispatch in the existing execution/outbox boundary. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] [VERIFIED: cap-n8n-plugin/lib/ExecutionStore.js]

### Recommended Project Structure

```text
cap-n8n-plugin/
├── cds-plugin.js                    # load registrar during CAP plugin lifecycle
└── lib/
    ├── annotations/
    │   ├── AnnotationRegistrar.js    # served-service scanner + handler registration
    │   ├── AnnotationParser.js       # flattened CSN prefix reconstruction + validation
    │   ├── ConditionEvaluator.js     # cds.parse.expr whitelist + scalar evaluator
    │   ├── PayloadBuilder.js         # keys, metadata, scalar input mapping
    │   └── CancellationResolver.js   # active execution query + cancel-all matching
    └── ...
test/
└── integration/
    └── n8n-annotations.test.js       # annotation CRUD, mapping, condition, cancel, rollback
```

The names above are recommended capability boundaries, while exact helper names remain planner discretion from CONTEXT.md. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] [ASSUMED]

### Pattern 1: Reconstruct Flattened Annotation Prefixes

**What:** CAP record annotation syntax compiles into flat CSN keys such as `@n8n.workflow.start.workflowId` and `@n8n.workflow.start.inputs.bookId`, not a nested `@n8n.workflow.start` object. [CITED: https://cap.cloud.sap/docs/cds/cdl] [VERIFIED: local node probe]

**When to use:** Use during scanner parsing for every served entity that has keys with the `@n8n.workflow.start.` or `@n8n.workflow.cancel.` prefix. [VERIFIED: local node probe]

**Example:**

```javascript
// Source: https://cap.cloud.sap/docs/cds/cdl
function readAnnotationConfig(definition, prefix) {
  const config = {}
  const nestedPrefix = `${prefix}.`

  for (const [key, value] of Object.entries(definition)) {
    if (!key.startsWith(nestedPrefix)) continue
    const path = key.slice(nestedPrefix.length).split('.')
    let cursor = config

    for (const segment of path.slice(0, -1)) {
      cursor[segment] ??= {}
      cursor = cursor[segment]
    }

    cursor[path.at(-1)] = value
  }

  return Object.keys(config).length > 0 ? config : undefined
}
```

### Pattern 2: Register Handlers from `cds-plugin.js`

**What:** A CAP plugin package can load `cds-plugin.js` automatically and register lifecycle hooks such as `cds.on('served', ...)`. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins]

**When to use:** Use after services are constructed but before normal application traffic, and register handlers through `srv.prepend()` or service handler APIs. [CITED: https://cap.cloud.sap/docs/node.js/core-services]

**Example:**

```javascript
// Source: https://cap.cloud.sap/docs/node.js/cds-plugins
const cds = require('@sap/cds')
const { registerAnnotations } = require('./lib/annotations/AnnotationRegistrar')

cds.on('served', () => {
  for (const srv of Object.values(cds.services)) {
    if (!srv || !srv.entities) continue
    registerAnnotations(srv)
  }
})
```

### Pattern 3: Start Through Phase 3 Post-Commit Path

**What:** Annotation handlers should call `n8n.start(workflowId, inputs, { businessKey, tag, _req: req })` so the existing service persists execution and dispatch records transactionally, then dispatches from `req.on('succeeded')`. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] [CITED: https://cap.cloud.sap/docs/node.js/events]

**When to use:** Use for all declarative starts from CREATE, UPDATE, and DELETE. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md]

**Example:**

```javascript
// Source: cap-n8n-plugin/lib/N8nWorkflowService.js
async function runStart({ req, workflowId, payload, businessKey, tag }) {
  try {
    const n8n = await cds.connect.to('n8n')
    return await n8n.start(workflowId, payload, {
      businessKey,
      tag,
      _req: req
    })
  } catch (err) {
    cds.log('n8n').error('Declarative n8n workflow start failed', {
      workflowId,
      entity: req.target?.name,
      event: req.event,
      reason: err.code || err.message
    })
  }
}
```

### Pattern 4: Parse and Whitelist Safe Conditions

**What:** `cds.parse.expr()` returns CXN structures such as `xpr`, `ref`, and `val`, but CAP intentionally preserves arbitrary operator sequences, so the plugin must reject unsupported constructs. [CITED: https://cap.cloud.sap/docs/cds/cxn]

**When to use:** Use at registration time to validate `if` strings and at runtime to evaluate against scalar data. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md]

**Recommended subset:** single-segment `ref`, `val`, nested `xpr`, operators `=`, `!=`, `<>`, `<`, `<=`, `>`, `>=`, `and`, `or`, `not`, `is`, and `null`. [CITED: https://cap.cloud.sap/docs/cds/cxn] [ASSUMED]

```javascript
// Source: https://cap.cloud.sap/docs/cds/cxn
function parseCondition(expression) {
  const cxn = cds.parse.expr(expression)
  assertSafeCondition(cxn)
  return cxn
}

function assertSafeCondition(node) {
  if (node?.val !== undefined) return
  if (node?.ref) {
    if (node.ref.length !== 1) throw new Error('n8n condition references must be scalar fields')
    return
  }
  if (node?.xpr) {
    for (const part of node.xpr) {
      if (typeof part === 'string') assertAllowedOperator(part)
      else assertSafeCondition(part)
    }
    return
  }

  throw new Error('Unsupported n8n condition expression')
}
```

### Anti-Patterns to Avoid

- **Scanning only `definition['@n8n.workflow.start']`:** CAP flattens record annotations, so this misses the locked object syntax. [CITED: https://cap.cloud.sap/docs/cds/cdl] [VERIFIED: local node probe]
- **Calling `fetch()` directly in annotation handlers:** This bypasses Phase 3 tracking, retry, duplicate metadata, and post-commit safety. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js]
- **Throwing transport errors from annotation handlers:** CAP `before` and `after` listeners can veto the request, contradicting ANNO-07. [CITED: https://cap.cloud.sap/docs/guides/services/custom-code] [VERIFIED: .planning/REQUIREMENTS.md]
- **Evaluating `if` with `new Function`, `eval`, or dynamic JavaScript:** The locked decision requires a safe CQN-like subset and forbids arbitrary JavaScript evaluation. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md]
- **Reading full rows for DELETE after generic deletion:** `req.subject` can address DELETE targets, but after the delete the row is gone; use keys by default or add an explicit pre-delete snapshot plan. [CITED: https://cap.cloud.sap/docs/node.js/events] [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Annotation object parsing | A parser that expects nested annotation objects only. | CSN prefix reconstruction for `@n8n.workflow.start.*` and `@n8n.workflow.cancel.*`. | CAP record syntax is flattened in CSN. [CITED: https://cap.cloud.sap/docs/cds/cdl] |
| Expression parsing | A custom string parser or JavaScript `eval`. | `cds.parse.expr()` plus whitelist validation and a small evaluator. | CAP already parses expressions into CXN, but plugin safety requires whitelisting. [CITED: https://cap.cloud.sap/docs/cds/cxn] |
| Post-commit workflow dispatch | Direct HTTP calls or timers from handlers. | Existing Phase 3 `n8n.start(..., { _req })` execution/outbox path. | The Phase 3 path prevents rollback dispatch and stores retryable state. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] |
| Cancellation lifecycle | Direct status updates in `WorkflowExecutions`. | Existing `queryExecutions()` and `cancel()` API. | Phase 3 already encodes queued, running, terminal, missing, and unsupported cases. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] |
| Test runtime | Docker n8n dependency for every annotation test. | Existing local HTTP server plus in-memory SQLite Vitest patterns. | Current integration tests prove webhook behavior without requiring Docker for each run. [VERIFIED: test/integration/n8n-dispatch-and-duplicates.test.js] |

**Key insight:** Phase 4 is a declarative registration layer over Phase 3, not a new workflow transport implementation. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js]

## Common Pitfalls

### Pitfall 1: Annotation Records Are Flat in CSN

**What goes wrong:** The scanner looks for `@n8n.workflow.start` as an object and finds nothing. [CITED: https://cap.cloud.sap/docs/cds/cdl] [VERIFIED: local node probe]

**Why it happens:** CAP CDL record syntax applies a common prefix to nested annotation names. [CITED: https://cap.cloud.sap/docs/cds/cdl]

**How to avoid:** Reconstruct config from keys beginning with `@n8n.workflow.start.` and `@n8n.workflow.cancel.`. [VERIFIED: local node probe]

**Warning signs:** An annotated demo entity compiles successfully but no runtime handler fires. [ASSUMED]

### Pitfall 2: `after` Is Not a Post-Commit Hook

**What goes wrong:** A workflow transport failure thrown from an `after` handler rolls back or fails the original CAP write. [CITED: https://cap.cloud.sap/docs/guides/services/custom-code]

**Why it happens:** CAP `before` and `after` listeners can veto requests when they throw. [CITED: https://cap.cloud.sap/docs/guides/services/custom-code]

**How to avoid:** Catch annotation side-effect errors, call `n8n.start(..., { _req: req })`, and let Phase 3 use `req.on('succeeded')` for post-commit dispatch. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] [CITED: https://cap.cloud.sap/docs/node.js/events]

**Warning signs:** Annotation tests expect failed n8n webhooks to reject `CREATE /Books`. [VERIFIED: .planning/REQUIREMENTS.md]

### Pitfall 3: UPDATE Payloads Are Partial

**What goes wrong:** Mapped fields missing from an UPDATE patch become `undefined` in the workflow input. [CITED: https://cap.cloud.sap/docs/node.js/events] [ASSUMED]

**Why it happens:** `req.data` contains incoming event data, which for UPDATE is the patch payload. [CITED: https://cap.cloud.sap/docs/node.js/events]

**How to avoid:** For single-row UPDATE mappings, read selected scalar columns from `req.subject` after the generic handler and before queuing the workflow. [CITED: https://cap.cloud.sap/docs/node.js/events]

**Warning signs:** UPDATE tests only patch `stock` but expect mapped `title` to be present. [ASSUMED]

### Pitfall 4: Annotation Propagation Can Create Unexpected Fan-Out

**What goes wrong:** An annotation on a domain entity propagates to multiple service projections and registers multiple triggers. [CITED: https://cap.cloud.sap/docs/cds/cdl]

**Why it happens:** CAP propagates entity-level annotations from primary source entities to projections unless stopped. [CITED: https://cap.cloud.sap/docs/cds/cdl]

**How to avoid:** Prefer annotating service projections such as `AdminService.Books` for Phase 4 demo evidence, and document propagation behavior. [VERIFIED: demo-app/srv/admin-service.cds] [ASSUMED]

**Warning signs:** One domain annotation triggers for both admin and catalog services. [ASSUMED]

### Pitfall 5: CXN Allows More Than the Safe Subset

**What goes wrong:** Conditions accept association paths, functions, `exists`, or other constructs outside the Phase 4 scalar-only scope. [CITED: https://cap.cloud.sap/docs/cds/cxn] [VERIFIED: local node probe]

**Why it happens:** CXN preserves broad expression syntax and arbitrary operator sequences. [CITED: https://cap.cloud.sap/docs/cds/cxn]

**How to avoid:** Whitelist node shapes and operators after `cds.parse.expr()` and fail registration on unsupported constructs. [CITED: https://cap.cloud.sap/docs/cds/cxn] [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md]

**Warning signs:** A condition such as `author.name = 'x'` or `substring(title,1,2) = 'AB'` parses successfully. [VERIFIED: local node probe]

### Pitfall 6: Public Execution DTOs Must Stay Sanitized

**What goes wrong:** Annotation payloads, API keys, or raw request bodies leak through query/cancel/start results. [VERIFIED: test/integration/n8n-dispatch-and-duplicates.test.js] [VERIFIED: test/integration/n8n-query-and-duplicates.test.js]

**Why it happens:** Annotation mapping introduces new payload builders and logging sites. [ASSUMED]

**How to avoid:** Store raw dispatch payloads only in internal `WorkflowDispatches` and keep public DTOs from `result.js`. [VERIFIED: cap-n8n-plugin/lib/result.js] [VERIFIED: cap-n8n-plugin/lib/ExecutionStore.js]

**Warning signs:** Integration tests can find `payload`, `inputs`, `headers`, `requestBody`, or secret fragments in public results. [VERIFIED: test/integration/n8n-dispatch-and-duplicates.test.js]

## Code Examples

Verified patterns from official and local sources:

### Service Projection Annotation

```cds
// Source: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md
annotate AdminService.Books with @n8n.workflow.start: {
  workflowId: 'webhook-test/cap-test-trigger',
  on: ['CREATE', 'UPDATE'],
  inputs: {
    bookId: 'ID',
    title: 'title'
  },
  if: "stock > 0",
  businessKey: 'ID',
  tag: 'admin-books'
};

annotate AdminService.Books with @n8n.workflow.cancel: {
  workflowId: 'webhook-test/cap-test-trigger',
  on: ['DELETE'],
  businessKey: 'ID',
  tag: 'admin-books'
};
```

### Payload Envelope Builder

```javascript
// Source: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md
function buildWorkflowPayload({ mappedInputs, metadata }) {
  return {
    ...mappedInputs,
    event: {
      name: metadata.event,
      entity: metadata.entity,
      service: metadata.service,
      keys: metadata.keys,
      timestamp: metadata.timestamp
    }
  }
}
```

### Cancellation Matching Loop

```javascript
// Source: cap-n8n-plugin/lib/N8nWorkflowService.js and cap-n8n-plugin/lib/ExecutionStore.js
const ACTIVE_STATUSES = ['queued', 'dispatching', 'running', 'cancel_requested']

async function cancelMatchingExecutions(n8n, { workflowId, businessKey, tag }) {
  const matches = new Map()

  for (const status of ACTIVE_STATUSES) {
    const result = await n8n.queryExecutions({ workflowId, businessKey, tag, status })
    for (const item of result.items) matches.set(item.executionId, item)
  }

  return Promise.all([...matches.keys()].map((executionId) => n8n.cancel(executionId)))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-coded `demo-app/srv/admin-service.js` `after CREATE` trigger. | Package-owned scanner and generic handler registration in `cap-n8n-plugin`. | Phase 4 scope decision on 2026-06-02. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] | Demo app becomes evidence rather than integration owner. [VERIFIED: AGENTS.md] |
| Direct webhook dispatch in service handlers. | Phase 3 execution/outbox path with `req.on('succeeded')` dispatch. | Phase 3 completed on 2026-06-02. [VERIFIED: .planning/STATE.md] | Failed webhook delivery should not roll back original CAP writes. [VERIFIED: test/integration/n8n-dispatch-and-duplicates.test.js] |
| Treat annotation object syntax as a nested runtime object. | Read flattened CSN annotation keys and reconstruct config. | Verified during research on 2026-06-02. [VERIFIED: local node probe] | Planner must include parser work before handler registration. [CITED: https://cap.cloud.sap/docs/cds/cdl] |
| Free-form condition evaluation. | `cds.parse.expr()` plus whitelisted scalar CXN evaluator. | Phase 4 locked decision on 2026-06-02. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] | Prevents JavaScript injection and association expansion. [CITED: https://cap.cloud.sap/docs/cds/cxn] |

**Deprecated/outdated:**

- Planning around unit-test-only coverage is outdated because project constraints and requirements require integration-test wording and coverage. [VERIFIED: AGENTS.md] [VERIFIED: .planning/REQUIREMENTS.md]
- Reading `README.md` Node 18+ as authoritative is outdated because current locked CAP dependency requires Node `>=20`. [VERIFIED: AGENTS.md] [VERIFIED: npm registry]
- Relying on the old hard-coded Book create trigger is outdated because Phase 4 requires declarative annotations without custom app-handler glue. [VERIFIED: demo-app/srv/admin-service.js] [VERIFIED: .planning/REQUIREMENTS.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Non-key scalar DELETE mappings should be rejected for Phase 4 unless planner explicitly adds a pre-delete snapshot path. | Summary, Common Pitfalls | If wrong, DELETE annotations may be less capable than expected and may need an extra before-handler capture task. |
| A2 | The recommended helper filenames under `lib/annotations/` are acceptable implementation boundaries. | Recommended Project Structure | If wrong, planner can rename modules while preserving capability boundaries. |
| A3 | Service projection annotations should be preferred for demo evidence to avoid propagation fan-out. | Common Pitfalls | If wrong, domain-level annotations may trigger on more services than intended or require deduplication policy. |

## Open Questions

1. **Should Phase 4 support non-key DELETE input mappings through pre-delete snapshots?**
   - What we know: Locked decisions require DELETE keys plus metadata by default and scalar-only mappings. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md]
   - What's unclear: The context does not explicitly say whether non-key DELETE mappings must work. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md]
   - Recommendation: Plan keys-only DELETE for Phase 4 and reject non-key DELETE mappings unless a plan task explicitly captures rows before delete. [ASSUMED]

2. **Should annotations on domain entities be supported as propagated service annotations?**
   - What we know: CAP propagates annotations to projections, and runtime handlers register on served service entities. [CITED: https://cap.cloud.sap/docs/cds/cdl] [CITED: https://cap.cloud.sap/docs/node.js/core-services]
   - What's unclear: The Phase 4 context does not lock whether domain annotations should trigger every projection or only service-level annotations. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md]
   - Recommendation: Support what appears on served entity definitions, but demo and docs should use service projection annotations to avoid accidental fan-out. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | CAP runtime and Vitest | yes | `v24.16.0` | Install Node `>=20` if absent. [VERIFIED: local command audit] |
| npm | Workspace scripts | yes | `11.13.0` | Use project lockfile through npm. [VERIFIED: local command audit] |
| CAP CLI (`cds`) | Compile/serve integration workflows | yes | `@sap/cds-dk 9.9.1`, `@sap/cds 9.9.1` | Use `npx --no-install cds` from local dev dependency. [VERIFIED: local command audit] |
| Vitest | Integration tests | yes | `4.1.7` | Use root `npm run test:integration`. [VERIFIED: local command audit] |
| Docker | Optional local n8n manual checks | yes | `29.5.2` | Annotation integration tests can use local HTTP servers instead of Docker. [VERIFIED: local command audit] [VERIFIED: test/integration/n8n-dispatch-and-duplicates.test.js] |
| Context7 CLI (`ctx7`) | Preferred docs lookup | no | n/a | Official SAP docs were fetched via web. [VERIFIED: local command audit] |
| slopcheck | New package legitimacy gate | no | n/a | No new packages recommended; if planner adds packages, insert a human verification checkpoint. [VERIFIED: local command audit] [ASSUMED] |

**Missing dependencies with no fallback:** none for recommended Phase 4 implementation. [VERIFIED: local command audit] [ASSUMED]

**Missing dependencies with fallback:** Context7 CLI is missing, with official SAP docs used as fallback; slopcheck is missing, but no new package install is recommended. [VERIFIED: local command audit]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no new auth surface | Preserve existing CAP authorization and n8n API key environment configuration. [VERIFIED: demo-app/package.json] [VERIFIED: AGENTS.md] |
| V3 Session Management | no | Phase 4 adds backend service handlers and no browser session behavior. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] |
| V4 Access Control | yes | Only react to CAP CRUD events after CAP service authorization and validation have accepted the write. [CITED: https://cap.cloud.sap/docs/node.js/core-services] [VERIFIED: demo-app/srv/access-control.cds] |
| V5 Input Validation | yes | Validate annotation shapes, scalar field paths, event names, and condition CXN at registration time. [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] [CITED: https://cap.cloud.sap/docs/cds/cxn] |
| V6 Cryptography | no new crypto | Do not implement cryptography; preserve env-based API key handling and sanitized DTO/log behavior. [VERIFIED: AGENTS.md] [VERIFIED: cap-n8n-plugin/lib/errors.js] |
| V7 Error Handling and Logging | yes | Use `cds.log('n8n')`, omit payloads/secrets, and preserve sanitized public execution DTOs. [VERIFIED: AGENTS.md] [VERIFIED: cap-n8n-plugin/lib/result.js] |

### Known Threat Patterns for CAP Annotation Runtime

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Arbitrary code execution through `if` expressions | Elevation of privilege | Parse with `cds.parse.expr()` and evaluate only a scalar whitelist; never use JavaScript `eval` or `new Function`. [CITED: https://cap.cloud.sap/docs/cds/cxn] [VERIFIED: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md] |
| Secret or payload leakage through logs/results | Information disclosure | Log workflow metadata only and reuse sanitized Phase 3 result helpers. [VERIFIED: cap-n8n-plugin/lib/result.js] [VERIFIED: test/integration/n8n-dispatch-and-duplicates.test.js] |
| Unauthorized workflow side effects | Tampering | Register only on CAP service events that have passed normal CAP request handling and authorization. [CITED: https://cap.cloud.sap/docs/node.js/core-services] [VERIFIED: demo-app/srv/access-control.cds] |
| Transaction rollback via n8n failure | Denial of service | Catch annotation runtime errors and route dispatch through post-commit execution/outbox behavior. [CITED: https://cap.cloud.sap/docs/guides/services/custom-code] [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] |
| Annotation propagation fan-out | Tampering | Prefer service projection annotations and document propagated annotation behavior. [CITED: https://cap.cloud.sap/docs/cds/cdl] [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/04-declarative-cap-annotations/04-CONTEXT.md` - locked annotation decisions, discretion, deferred scope, and local source references. [VERIFIED: codebase grep]
- `.planning/REQUIREMENTS.md` - ANNO-01 through ANNO-07 and VERIFY-02. [VERIFIED: codebase grep]
- `.planning/STATE.md` - Phase 3 completion and execution/outbox decisions. [VERIFIED: codebase grep]
- `cap-n8n-plugin/lib/N8nWorkflowService.js` - existing `start`, `queryExecutions`, `cancel`, `_req`, and post-commit dispatch behavior. [VERIFIED: codebase grep]
- `cap-n8n-plugin/lib/ExecutionStore.js` - active statuses, query filters, execution/outbox persistence, and sanitized DTO conversion. [VERIFIED: codebase grep]
- `test/integration/n8n-dispatch-and-duplicates.test.js` - transaction-safe dispatch, rollback/no-dispatch, and sanitization evidence. [VERIFIED: codebase grep]
- SAP CAP CDS CDL docs: https://cap.cloud.sap/docs/cds/cdl - annotation record flattening, annotation propagation, and expression annotation representation. [CITED: https://cap.cloud.sap/docs/cds/cdl]
- SAP CAP Node plugin docs: https://cap.cloud.sap/docs/node.js/cds-plugins - `cds-plugin.js` lifecycle and auto-configuration. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins]
- SAP CAP core service docs: https://cap.cloud.sap/docs/node.js/core-services - service `init`, `prepend`, and handler registration APIs. [CITED: https://cap.cloud.sap/docs/node.js/core-services]
- SAP CAP Events and Requests docs: https://cap.cloud.sap/docs/node.js/events - `req.data`, `req.params`, `req.subject`, and `req.on('succeeded')`. [CITED: https://cap.cloud.sap/docs/node.js/events]
- SAP CAP CXN docs: https://cap.cloud.sap/docs/cds/cxn - `cds.parse.expr()`, `ref`, `val`, and `xpr` expression notation. [CITED: https://cap.cloud.sap/docs/cds/cxn]

### Secondary (MEDIUM confidence)

- Local Node probe using installed `@sap/cds@9.9.1` - verified flattened annotation CSN and parsed CXN shapes for representative Phase 4 examples. [VERIFIED: local node probe]
- npm registry metadata for `@sap/cds`, `@sap/cds-dk`, `@cap-js/sqlite`, and `vitest` checked 2026-06-02. [VERIFIED: npm registry]
- Local environment audit for Node, npm, CAP CLI, Vitest, Docker, Context7 CLI, and slopcheck. [VERIFIED: local command audit]

### Tertiary (LOW confidence)

- DELETE non-key mapping recommendation and helper filename recommendations are planner-facing assumptions, not locked decisions. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and local availability were verified through project files, local commands, and npm registry metadata. [VERIFIED: package.json] [VERIFIED: local command audit] [VERIFIED: npm registry]
- Architecture: HIGH - CAP handler/plugin semantics were verified against official SAP docs and local Phase 3 code. [CITED: https://cap.cloud.sap/docs/node.js/core-services] [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins] [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js]
- Pitfalls: HIGH for CSN flattening, post-commit dispatch, and condition parsing; MEDIUM for DELETE non-key mapping because it is an explicit planning assumption. [CITED: https://cap.cloud.sap/docs/cds/cdl] [CITED: https://cap.cloud.sap/docs/node.js/events] [ASSUMED]

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 for CAP 9.9.x annotation/runtime guidance; re-check npm versions and SAP docs before dependency updates. [ASSUMED]
