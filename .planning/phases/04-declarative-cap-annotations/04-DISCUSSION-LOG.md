# Phase 4: Declarative CAP Annotations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-06-02T21:05:36.097Z
**Phase:** 4-declarative-cap-annotations
**Areas discussed:** Annotation shape, Event payloads, Mappings and conditions, Cancellation matching

---

## Annotation Shape

### Start Annotation Form

| Option | Description | Selected |
|--------|-------------|----------|
| Structured object | Use `@n8n.workflow.start: { workflowId, on, inputs, if, businessKey, tag }`. | Yes |
| Short alias plus object | Allow simple `@n8n.workflow.start: 'workflow'` plus full object form. | |
| Array of triggers | Make the primary shape an array. | |

**User's choice:** Structured object.
**Notes:** The structured object is the primary Phase 4 shape.

### Multiple Starts Per Entity

| Option | Description | Selected |
|--------|-------------|----------|
| Single start object | One `@n8n.workflow.start` object per entity. | Yes |
| Object or array | Allow `@n8n.workflow.start: [{...}, {...}]`. | |
| Separate named annotations | Use variants such as `@n8n.workflow.start #BookCreated`. | |

**User's choice:** Single start object.
**Notes:** Multiple different workflow starts on one entity are deferred beyond Phase 4.

### Canonical Vocabulary

| Option | Description | Selected |
|--------|-------------|----------|
| Requirements vocabulary | `workflowId`, `on`, `inputs`, `if`, `businessKey`, `tag` with lowercase events. | |
| CAP event vocabulary | `id`, `on`, `inputs`, `if` with uppercase events. | |
| Dual aliases | Accept `workflowId` or `id` and normalize event casing. | |
| Hybrid canonical | `workflowId`, `inputs`, `if`, `businessKey`, `tag` with `CREATE`, `UPDATE`, `DELETE`. | Yes |

**User's choice:** Hybrid canonical.
**Notes:** User noted CAP event vocabulary makes sense. Final decision keeps `workflowId` aligned with the existing API while using CAP event names.

### Cancel Annotation Form

| Option | Description | Selected |
|--------|-------------|----------|
| Matching structured object | `@n8n.workflow.cancel: { workflowId, on, businessKey, tag }`. | Yes |
| Execution-id only | `@n8n.workflow.cancel: { executionId: 'fieldName', on }`. | |
| Policy object | `@n8n.workflow.cancel: { match: { workflowId, businessKey, tag }, on, if }`. | |

**User's choice:** Matching structured object.
**Notes:** Cancellation annotation mirrors the start annotation style.

---

## Event Payloads

### CREATE And UPDATE Payloads

| Option | Description | Selected |
|--------|-------------|----------|
| Mapped inputs only | Send only fields declared in `inputs`; fallback to keys plus event metadata. | Yes |
| Full entity row by default | Send complete current entity data unless `inputs` narrows it. | |
| Event envelope plus row | Always send `{ event, entity, data }`. | |

**User's choice:** Mapped inputs only.
**Notes:** If `inputs` is omitted, send key fields plus event metadata.

### DELETE Payloads

| Option | Description | Selected |
|--------|-------------|----------|
| Keys plus metadata | Send entity keys and event metadata only. | Yes |
| Pre-delete snapshot when available | Try to load/send full entity before deletion. | |
| Same mapping rules as CREATE/UPDATE | Allow `inputs` mappings for DELETE. | |

**User's choice:** Keys plus metadata.
**Notes:** Avoid unreliable full-row assumptions for DELETE.

### Event Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal CAP metadata | Event name, entity name, service name, keys, and timestamp. | Yes |
| Correlation metadata too | Include generated correlation ID, business key, tag, and local execution ID. | |
| No automatic metadata | Only explicitly mapped inputs. | |

**User's choice:** Minimal CAP metadata.
**Notes:** Metadata is always included when an annotated workflow starts.

### Failure Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort non-blocking | Log/persist failure but do not roll back CAP write. | Yes |
| Configurable per annotation | Default non-blocking but allow blocking flag. | |
| Always blocking | Reject or roll back CAP write. | |

**User's choice:** Best-effort non-blocking.
**Notes:** This follows the project requirement that trigger failures do not roll back the original CAP write by default.

---

## Mappings And Conditions

### Inputs Syntax

| Option | Description | Selected |
|--------|-------------|----------|
| Object map | `inputs: { bookId: 'ID', title: 'title' }`. | Yes |
| Array mapping | `inputs: [{ name: 'bookId', path: 'ID' }]`. | |
| Path list | `inputs: ['ID', 'title']`. | |

**User's choice:** Object map.
**Notes:** Keys are workflow input names; values are CDS element paths.

### Mapping Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Scalars only | Support scalar fields; defer associations and compositions. | Yes |
| Scalars plus to-one associations | Support paths such as `author.name`. | |
| Scalars, to-one, and to-many | Include association and composition expansion. | |

**User's choice:** Scalars only.
**Notes:** User explicitly said to-one and to-many should not be forgotten; they are deferred for later.

### Invalid Mappings

| Option | Description | Selected |
|--------|-------------|----------|
| Registration-time error | Fail startup/service registration. | Yes |
| Runtime warning and skip | Log and omit invalid field. | |
| Runtime error but non-blocking | Create failed execution/log entry. | |

**User's choice:** Registration-time error.
**Notes:** Matches the ANNO-04 expectation for invalid annotations or missing mapped fields.

### Condition Syntax

| Option | Description | Selected |
|--------|-------------|----------|
| Simple CQN-like string | `if: "stock > 0 and title != null"`. | Yes |
| Object expression | `if: { field, op, value }`. | |
| JavaScript-like expression | `if: "data.stock > 0"`. | |

**User's choice:** Simple CQN-like string.
**Notes:** Expression support should be safe and scalar-only.

---

## Cancellation Matching

### Match Rule

| Option | Description | Selected |
|--------|-------------|----------|
| `workflowId + businessKey/tag` | Query active executions using Phase 3 execution metadata. | Yes |
| Execution ID field only | Require business entity to store execution ID. | |
| Try execution ID, then metadata | Use execution ID if configured, otherwise metadata. | |

**User's choice:** `workflowId + businessKey/tag`.
**Notes:** This uses the Phase 3 query model.

### Multiple Matches

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel all matches | Cancel every active matching execution. | Yes |
| Cancel newest only | Cancel most recently updated/created active execution. | |
| No-op with warning | Treat multiple matches as ambiguous. | |

**User's choice:** Cancel all matches.
**Notes:** Avoids leaving duplicate obsolete workflows running.

### No Match

| Option | Description | Selected |
|--------|-------------|----------|
| No-op warning | Do not fail CAP write; log warning and optionally persist no-op visibility. | Yes |
| Silent no-op | Log only at debug/info level. | |
| Registration/runtime error | Treat missing execution as error without rollback. | |

**User's choice:** No-op warning.
**Notes:** Non-blocking behavior is preserved.

### Default Cancel Events

| Option | Description | Selected |
|--------|-------------|----------|
| DELETE only | Cancel workflows when the business object is removed. | Yes |
| UPDATE and DELETE | Broader obsolete-workflow default. | |
| No default | Require `on` for cancel annotations. | |

**User's choice:** DELETE only.
**Notes:** If `on` is omitted from `@n8n.workflow.cancel`, default to `DELETE`.

---

## the agent's Discretion

- Exact helper/module names, parser internals, test file names, and scanner implementation are left to planning.
- Exact safe condition subset is left to planning within the scalar-only, CQN-like, no-arbitrary-JavaScript constraint.
- Exact payload envelope property names are left to planning as long as mapped inputs and minimal CAP metadata are present.

## Deferred Ideas

- Multiple different workflow starts on one entity are deferred beyond Phase 4.
- To-one association mapping and to-many association/composition expansion are deferred beyond Phase 4.
