# Phase 7: n8n Mutations and CAP Actions/Functions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-03T18:49:57.8362921+02:00
**Phase:** 7-n8n Mutations and CAP Actions/Functions
**Areas discussed:** Mutation Body UX, Composite Key Handling, Delete Safety and Output, Actions and Functions UX

---

## Mutation Body UX

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How should Create and Update accept entity payloads in Phase 7? | JSON Body | Use one n8n JSON/body field first; fastest, matches existing raw OData controls, and satisfies the user stories cleanly. | Yes |
| How should Create and Update accept entity payloads in Phase 7? | Derived Fields | Generate editable fields from metadata; nicer UI, but needs much richer metadata parsing and field typing now. | |
| How should Create and Update accept entity payloads in Phase 7? | Hybrid | Offer JSON body plus optional metadata-derived helpers; more ergonomic, but increases Phase 7 scope and test surface. | |
| What should the JSON Body field use as its default payload source? | Explicit JSON Field | User enters the payload in a Body field; predictable, visible in the node, and easiest to validate. | Yes |
| What should the JSON Body field use as its default payload source? | Input Item JSON | Use the incoming n8n item JSON as the request body by default; convenient, but easier to send accidental fields. | |
| What should the JSON Body field use as its default payload source? | Selectable Source | Let the user choose Body field or Input item JSON; flexible, but adds more UI and tests. | |
| How strict should the Body field be before the node sends Create/Update requests? | Strict JSON Object | Parse/validate before sending; Body must be a JSON object, arrays/strings/empty values fail as node validation errors. | Yes |
| How strict should the Body field be before the node sends Create/Update requests? | Loose JSON Value | Allow any valid JSON value; simpler internally, but CAP entity writes normally expect an object. | |
| How strict should the Body field be before the node sends Create/Update requests? | Let CAP Decide | Send whatever the user entered and surface CAP's validation error; less pre-validation, but worse feedback. | |
| After Create/Update succeeds, what response should the node expect/output? | Return Entity | Expect and output the created/updated entity as one cleaned n8n item, including server-generated fields. | Yes |
| After Create/Update succeeds, what response should the node expect/output? | Entity or Confirmation | Output entity when CAP returns one, otherwise output a generic success object; more tolerant of `204 No Content`. | |
| After Create/Update succeeds, what response should the node expect/output? | Confirmation Only | Always output `{ success: true }` for writes; predictable, but loses server-generated data and conflicts with Create story. | |

**User's choice:** JSON Body, Explicit JSON Field, Strict JSON Object, Return Entity.
**Notes:** Planner can choose the OData mechanics needed to obtain returned entities for Create/Update.

---

## Composite Key Handling

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How should Phase 7 represent entity keys for Read/Update/Delete? | Keep Key Predicate | Continue the Phase 6 manual OData key predicate field, e.g. `ID=201,IsActiveEntity=true`; already works for composite keys, but less friendly. | |
| How should Phase 7 represent entity keys for Read/Update/Delete? | Metadata Key Fields | Parse key properties from `$metadata` and show one field per key; nicer UX, but requires deeper metadata parsing than Phase 6. | |
| How should Phase 7 represent entity keys for Read/Update/Delete? | Hybrid | Keep manual key predicate as the reliable fallback, and add metadata-derived key fields where parsing is available; good UX without making metadata parsing a single point of failure. | Yes |
| When metadata-derived key fields are available, what should happen for composite keys? | Require All Key Fields | Show each key field and require all parts before sending; clearest for composite keys and avoids malformed OData URLs. | Yes |
| When metadata-derived key fields are available, what should happen for composite keys? | Allow Partial Keys | Let users omit some key fields and rely on CAP/OData errors; looser, but less helpful. | |
| When metadata-derived key fields are available, what should happen for composite keys? | Manual Only for Composite | Use derived fields only for single-key entities and keep composite keys manual; simpler but less aligned with `NODE-13`. | |
| How should key values be formatted into OData key predicates? | Type-Aware Formatting | Use metadata key types when available to quote strings/UUIDs/dates and leave numbers/booleans unquoted, with manual fallback. | Yes |
| How should key values be formatted into OData key predicates? | Raw Values Only | User enters exactly the OData literal value for each field; simpler, but easier to get wrong. | |
| How should key values be formatted into OData key predicates? | String Quote Everything | Quote every value except obvious numbers; convenient but can break booleans and typed CAP keys. | |
| If metadata cannot be loaded or key parsing fails, what should the node do? | Fall Back to Manual Predicate | Show/use the existing Key Predicate field and surface a clear metadata warning only in the editor path. | Yes |
| If metadata cannot be loaded or key parsing fails, what should the node do? | Block Keyed Operations | Fail until metadata loads; safer, but would make manual CAP/OData use impossible during metadata outages. | |
| If metadata cannot be loaded or key parsing fails, what should the node do? | Infer from Input JSON | Try to build keys from item/body fields; convenient, but too implicit for destructive/update operations. | |

**User's choice:** Hybrid, Require All Key Fields, Type-Aware Formatting, Fall Back to Manual Predicate.
**Notes:** Hybrid key handling applies to Read, Update, Delete, and bound actions/functions.

---

## Delete Safety and Output

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| What should Delete output after CAP returns success? | Confirmation Object | Return one item like `{ deleted: true, entitySet, key }`; matches the user story and works with `204 No Content`. | Yes |
| What should Delete output after CAP returns success? | Empty Output | Return no items; technically clean, but awkward for downstream n8n steps. | |
| What should Delete output after CAP returns success? | Deleted Entity | Try to output the deleted entity; useful, but would require an extra read or CAP-specific behavior not guaranteed by DELETE. | |
| Should Delete require an extra explicit confirmation parameter in the node UI? | No Extra Confirmation | Delete is already an explicit operation choice plus key input; keeps the node conventional for automation. | Yes |
| Should Delete require an extra explicit confirmation parameter in the node UI? | Require Checkbox | Add a Confirm Delete checkbox before sending; safer, but noisy in every workflow. | |
| Should Delete require an extra explicit confirmation parameter in the node UI? | Only for Manual Key Predicate | Require confirmation when using raw manual predicates, but not metadata-derived key fields; targeted, but adds branching behavior. | |
| How should Delete handle `404 Not Found`? | Error by Default | Treat missing entity as a clear n8n-native not-found error, consistent with Read/Update expectations. | Yes |
| How should Delete handle `404 Not Found`? | Success Idempotently | Return `{ deleted: false }`; useful for cleanup workflows, but the user story asks for clear not-found errors. | |
| How should Delete handle `404 Not Found`? | Configurable | Add an ignore missing option; flexible, but adds scope and more tests. | |
| Should Delete send a request body? | No Body | Send `DELETE` to the keyed entity URL with no body; standard OData behavior and minimal risk. | Yes |
| Should Delete send a request body? | Optional Body | Allow an optional JSON body for custom CAP handlers; flexible, but non-standard and not needed by the story. | |
| Should Delete send a request body? | Headers/ETag Later | Keep body out of Phase 7 and defer conditional delete/ETag support; same as no body now, explicit future path. | |

**User's choice:** Confirmation Object, No Extra Confirmation, Error by Default, No Body.
**Notes:** Delete stays conventional and automation-friendly.

---

## Actions and Functions UX

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How should CAP actions and functions appear in the node operation list? | One Operation Mode | Use one Action/Function operation with metadata-backed operation dropdown; matches the story and keeps UI compact. | Yes |
| How should CAP actions and functions appear in the node operation list? | Separate Modes | Add separate Action and Function modes; clearer technically, but more branching in UI/runtime. | |
| How should CAP actions and functions appear in the node operation list? | Advanced Raw Operation | Let users type any operation path manually; powerful, but too close to a generic HTTP node. | |
| How should available actions/functions be discovered? | Metadata Parsed Dropdown | Parse bound/unbound actions, functions, action imports, and function imports from `$metadata`; manual fallback if unavailable. | Yes |
| How should available actions/functions be discovered? | Manual Operation Name Only | User types the action/function name/path; simpler, but weaker than the user story. | |
| How should available actions/functions be discovered? | Dropdown Only | Require metadata discovery; clean UI when metadata works, but fragile when parsing fails. | |
| How should parameters be entered? | JSON Parameters Field | Use one explicit JSON object field; POST actions send it as body, functions can map it to query parameters as needed. | Yes |
| How should parameters be entered? | Generated Parameter Fields | Parse operation parameter metadata and show one field per parameter; nicer, but much bigger metadata/UI scope. | |
| How should parameters be entered? | Both | Generated fields when metadata is strong, JSON fallback otherwise; best UX but larger Phase 7 surface. | |
| How should bound actions/functions get their entity key? | Reuse Key Handling | Use the same hybrid key UI as Read/Update/Delete: metadata-derived key fields when available, manual key predicate fallback. | Yes |
| How should bound actions/functions get their entity key? | Manual Bound Key Only | Bound operations always use manual key predicate; simpler, but inconsistent with composite-key handling. | |
| How should bound actions/functions get their entity key? | Input JSON Key | Infer the key from incoming item JSON; convenient, but too implicit for business operations. | |

**User's choice:** One Operation Mode, Metadata Parsed Dropdown, JSON Parameters Field, Reuse Key Handling.
**Notes:** User explicitly said to keep generated parameter fields in mind as a later enhancement.

---

## the agent's Discretion

- Exact TypeScript module split and helper names.
- Exact metadata descriptor shape.
- Exact sanitized error wording, within the established no-secret/no-raw-body constraints.

## Deferred Ideas

- Generated action/function parameter fields from metadata after the explicit JSON Parameters object field is stable.
- Full metadata-derived entity property editors for Create/Update after the JSON Body path is stable.
