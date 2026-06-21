# Phase 6: n8n Credentials, Metadata Discovery, and Read Operations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-03T11:28:19.2916915Z
**Phase:** 6-n8n Credentials, Metadata Discovery, and Read Operations
**Areas discussed:** GitHub User Story Scope, Credential Strategy, Metadata Discovery, Query Mode, Read Mode, Response Cleanup, Error Handling

---

## GitHub User Story Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 6 = first n8n read slice | Implement credentials, metadata discovery, Query, Read, response cleanup, and cross-cutting errors. | x |
| Include all Epic 4 operations | Also include Create, Update, Delete, and actions/functions in Phase 6. | |

**User's choice:** Asked which User Stories Phase 6 implements; accepted the Phase 6 scope boundary from ROADMAP/REQUIREMENTS.
**Notes:** Phase 6 maps to GitHub issues `#19`, `#20`, `#21`, `#25`, and `#27`. Phase 7 keeps `#22`, `#23`, `#24`, and `#26`.

---

## Credential Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Basic Auth first, OAuth2 scaffold later | Make Basic Auth fully working; keep OAuth2 visible/scaffolded for a later phase. | x |
| Full Basic Auth and OAuth2 now | Complete and deeply test both credential modes in Phase 6. | |

**User's choice:** "Let's start with basic auth first and scaffold OAuth2 for later"
**Notes:** This keeps Phase 6 focused and avoids letting BTP/OAuth complexity block Query/Read functionality.

---

## Metadata Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic entity-set dropdown | Load entity sets from CAP `$metadata`, with fallback/error behavior. | x |
| Manual entity-set text first | Keep `Entity Set` as text input and add dynamic discovery later. | |

**User's choice:** User said the first option sounded nicer; recommendation was dynamic discovery.
**Notes:** Dynamic discovery directly satisfies `NODE-04` and makes the n8n node feel like a real integration.

---

## Query Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Raw OData controls | Expose `$filter`, `$orderby`, `$select`, `$top`, and `$skip` with examples. | x |
| Guided query builder | Build fields/operators UI for filtering and sorting. | |

**User's choice:** "Option 1"
**Notes:** Raw OData controls are a pragmatic fit for CAP developers and keep query-builder work out of Phase 6.

---

## Read Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Manual key predicate | Use a manual OData key predicate like `ID=201` or `ID=201,IsActiveEntity=true`. | x |
| Dynamic key fields now | Generate key fields dynamically from metadata right away. | |

**User's choice:** "If we do that later, we can keep 1"
**Notes:** Dynamic/composite key UX is deferred. The manual predicate keeps Read mode useful now.

---

## Response Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Default cleanup | Return plain n8n items, unwrap `value`, and strip `@odata.*` by default. | x |
| Raw response toggle | Add a Phase 6 toggle to keep raw OData wrappers. | |

**User's choice:** "Let's do default cleanup"
**Notes:** No raw-response toggle in Phase 6.

---

## Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Categorized n8n-native errors | Convert CAP/OData failures into `NodeOperationError`s with safe categories and `continueOnFail()` item output. | x |
| Raw HTTP-ish errors | Surface more of the original response directly. | |

**User's choice:** "Yes"
**Notes:** Error output must avoid leaking raw auth headers, tokens, credential values, and full response bodies.

---

## the agent's Discretion

- Planner may decide exact helper/module boundaries inside `cap-n8n-node`.
- Planner may decide how to handle existing mutation skeleton UI as long as Phase 6 does not claim Phase 7 behavior.

## Deferred Ideas

- Full OAuth2 Client Credentials behavior and coverage.
- Guided Query builder UI.
- Dynamic key fields and composite-key UX.
- Raw OData response/debug toggle.
- Create, Update, Delete, CAP actions/functions, and polling trigger behavior.
