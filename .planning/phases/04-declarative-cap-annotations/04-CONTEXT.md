# Phase 4: Declarative CAP Annotations - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 turns the package-owned CAP runtime from Phases 2 and 3 into a declarative CDS annotation layer. CAP developers must be able to annotate CDS entities so successful CREATE, UPDATE, and DELETE operations can start n8n workflows, map scalar entity data into workflow inputs, conditionally skip starts, and cancel obsolete executions without writing imperative service-handler code.

This phase owns annotation discovery, registration-time validation, CAP event hook registration, non-blocking post-write workflow starts, and declarative cancellation backed by the Phase 3 execution store. It does not implement workflow import, generated workflow input typings, build-time validation against imported workflows, n8n community-node operations, deployment documentation, or multi-workflow annotation fan-out.

</domain>

<decisions>
## Implementation Decisions

### Annotation Shape

- **D-01:** `@n8n.workflow.start` uses a structured object as the primary Phase 4 shape: `{ workflowId, on, inputs, if, businessKey, tag }`.
- **D-02:** Phase 4 supports one `@n8n.workflow.start` object per entity. Multiple different workflow starts on one entity are deferred beyond Phase 4.
- **D-03:** Canonical property names stay aligned with the existing plugin API: `workflowId`, `inputs`, `if`, `businessKey`, and `tag`.
- **D-04:** Event values use CAP event vocabulary: `CREATE`, `UPDATE`, and `DELETE`.
- **D-05:** `@n8n.workflow.cancel` uses a matching structured object: `{ workflowId, on, businessKey, tag }`.

### Event Payloads

- **D-06:** CREATE and UPDATE starts send mapped inputs only. If `inputs` is omitted, send key fields plus event metadata rather than a full entity row.
- **D-07:** DELETE starts send keys plus event metadata only by default.
- **D-08:** Annotated workflow starts always include minimal CAP event metadata: event name, entity name, service name when available, keys, and timestamp.
- **D-09:** Annotated trigger and cancellation failures are best-effort and non-blocking by default. They should be logged and persisted through the execution/dispatch state where applicable, but must not roll back the original CREATE, UPDATE, or DELETE by default.

### Mappings And Conditions

- **D-10:** `inputs` uses an object map where keys are workflow input names and values are CDS element paths, for example `inputs: { bookId: 'ID', title: 'title' }`.
- **D-11:** Phase 4 supports scalar field mappings only.
- **D-12:** To-one association mapping and to-many association/composition expansion are explicitly deferred beyond Phase 4.
- **D-13:** Invalid `inputs` mappings fail at startup or service registration time when a mapped field does not exist or is not supported.
- **D-14:** Conditional starts use a small safe CQN-like string expression against scalar data, for example `if: "stock > 0 and title != null"`.
- **D-15:** Invalid condition expressions fail at startup or service registration time.

### Cancellation Matching

- **D-16:** Declarative cancellation matches active executions by annotated `workflowId` plus resolved `businessKey` and/or `tag`, using the Phase 3 execution query model.
- **D-17:** If multiple active executions match, cancel all matches.
- **D-18:** If no active execution matches, treat it as a non-blocking no-op warning.
- **D-19:** If `on` is omitted from `@n8n.workflow.cancel`, the default event is `DELETE`.

### the agent's Discretion

- Planner may choose exact helper/module names, annotation scanner structure, parser internals, and test file names, provided behavior stays package-owned under `cap-n8n-plugin`.
- Planner may choose the internal payload envelope shape, provided mapped inputs and minimal CAP event metadata are both visible to n8n and no full-row payload is sent by default.
- Planner may choose the exact safe expression subset for `if`, provided it is scalar-only, CQN-like, validation fails at registration time, and no arbitrary JavaScript evaluation is introduced.
- Planner may choose the CAP hook registration mechanism, provided starts and cancellations use the Phase 3 post-commit/outbox-safe path and remain non-blocking by default.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GSD Scope

- `.planning/ROADMAP.md` - Phase 4 goal, requirements, success criteria, and dependency on Phase 3.
- `.planning/REQUIREMENTS.md` - `ANNO-01` through `ANNO-07` and `VERIFY-02`.
- `.planning/PROJECT.md` - core value, brownfield constraints, validated prior work, and project-level decisions.
- `.planning/STATE.md` - current project position and prior decisions affecting Phase 4.
- `.planning/phases/03-execution-store-and-transaction-safe-dispatch/03-CONTEXT.md` - Phase 3 execution store, duplicate, outbox, query, and cancellation decisions that Phase 4 must consume.

### Requirements Source

- `cap_n8n_requirements_v2.md` - Epic 2 CAP Declarative Workflow Triggers, especially US 2.1 through US 2.5.
- `N8N_REQUIREMENTS.md` - Original declarative annotation examples and acceptance criteria for start, cancel, mapping, and conditional triggers.

### Codebase Map

- `.planning/codebase/STACK.md` - JavaScript CommonJS, SAP CAP, CDS/CDL, npm workspace, Docker, and Vitest context.
- `.planning/codebase/ARCHITECTURE.md` - package boundaries, CAP service adapter pattern, demo-app anti-pattern, and plugin ownership rules.
- `.planning/codebase/INTEGRATIONS.md` - n8n webhook integration, CAP OData service flow, credentials, and local n8n fixture setup.

### Local Source Files

- `cap-n8n-plugin/cds-plugin.js` - plugin bootstrap and model registration point that planners must preserve.
- `cap-n8n-plugin/index.cds` - Phase 3 execution and dispatch model used by declarative starts/cancellations.
- `cap-n8n-plugin/lib/N8nWorkflowService.js` - real webhook service, tracked `start`, `dispatchPending`, `getExecution`, `queryExecutions`, and `cancel` APIs.
- `cap-n8n-plugin/lib/ExecutionStore.js` - execution query, duplicate lookup, dispatch persistence, and cancellation state helpers.
- `cap-n8n-plugin/lib/ExecutionDispatcher.js` - durable outbox dispatcher and post-commit retry behavior.
- `cap-n8n-plugin/lib/MockN8nWorkflowService.js` - mock runtime parity that annotation tests should preserve where practical.
- `cap-n8n-plugin/lib/result.js` - public result envelopes and webhook path normalization.
- `demo-app/srv/admin-service.js` - current hard-coded demo `after CREATE` workflow trigger to replace with declarative behavior as evidence.
- `demo-app/srv/admin-service.cds` - AdminService projections where demo annotations can be added.
- `demo-app/db/schema.cds` - Bookshop domain model and scalar fields available for Phase 4 demo mappings.
- `test/integration/n8n-dispatch-and-duplicates.test.js` - post-commit/outbox and duplicate behavior to preserve.
- `test/integration/n8n-query-and-duplicates.test.js` - execution query behavior used by declarative cancellation matching.
- `test/integration/n8n-cancel-and-mock.test.js` - cancellation and mock parity behavior to preserve.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `N8nWorkflowService.start()` already creates tracked execution records and dispatches after CAP transaction success when a request context is supplied.
- `ExecutionStore` already supports active duplicate lookup and query by `executionId`, `workflowId`, `businessKey`, `tag`, and `status`.
- `ExecutionDispatcher` already drains persisted dispatch payloads and records attempts, success, and sanitized errors.
- `N8nWorkflowService.cancel()` already implements state-aware cancellation and honest unsupported/no-op behavior.
- `MockN8nWorkflowService` already exposes start/query/cancel behavior for deterministic integration tests.

### Established Patterns

- Runtime code uses JavaScript CommonJS, two-space indentation, single quotes, and no semicolons in service/lib files.
- CAP integration logs use `cds.log('n8n')`.
- Reusable behavior belongs in `cap-n8n-plugin`; the demo app should demonstrate usage but not own generic trigger logic.
- Integration tests are the required verification language. Avoid planning around unit-test-only coverage.
- Public execution DTOs must stay sanitized: no secrets, auth headers, request payloads, stack traces, or configured secret values.

### Integration Points

- Annotation discovery should inspect the effective CAP model and register handlers for annotated entities.
- Annotated starts should call the existing `n8n.start(workflowId, inputs, options)` path with request context when available so Phase 3 post-commit dispatch is reused.
- Declarative cancellation should use Phase 3 `queryExecutions` and `cancel` behavior rather than a second cancellation implementation.
- Demo evidence can move the hard-coded book-create trigger from `demo-app/srv/admin-service.js` into CDS annotations on the Book projection or model.

</code_context>

<specifics>
## Specific Ideas

- Example start annotation:

```cds
@n8n.workflow.start: {
  workflowId: 'cap-test-trigger',
  on: ['CREATE', 'UPDATE'],
  inputs: {
    bookId: 'ID',
    title: 'title'
  },
  if: "stock > 0",
  businessKey: 'ID',
  tag: 'admin-books'
}
```

- Example cancel annotation:

```cds
@n8n.workflow.cancel: {
  workflowId: 'cap-test-trigger',
  on: ['DELETE'],
  businessKey: 'ID',
  tag: 'admin-books'
}
```

- Developers should see CAP-style event names in annotations because this is a CAP-facing feature.
- `workflowId` stays canonical because it matches the existing `n8n.start(workflowId, ...)` API.

</specifics>

<deferred>
## Deferred Ideas

- Multiple different workflow starts on one entity are deferred beyond Phase 4.
- To-one association mapping and to-many association/composition expansion are deferred beyond Phase 4.
- Workflow import, generated CDS workflow typings, and build-time validation against imported workflow definitions remain Phase 5.
- n8n community-node credentials, metadata discovery, reads, writes, actions/functions, and response cleanup remain Phases 6 and 7.
- Deployment documentation, `.env.example`, SAP BTP guidance, and final release readiness remain Phase 8.

</deferred>

---

*Phase: 04-declarative-cap-annotations*
*Context gathered: 2026-06-02*
