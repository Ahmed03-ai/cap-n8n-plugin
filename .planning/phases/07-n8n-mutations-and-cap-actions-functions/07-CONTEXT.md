# Phase 7: n8n Mutations and CAP Actions/Functions - Context

**Gathered:** 2026-06-03T18:49:57.8362921+02:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 completes the SAP CAP n8n node's write and business-operation surface. It adds Create, Update, Delete, composite-key support, and CAP action/function invocation on top of the Phase 6 credential, metadata-discovery, Query, Read, response-cleanup, and sanitized-error foundation.

This phase owns deterministic integration coverage for the n8n node runtime and metadata helpers. The real installed custom-node E2E check in a live n8n instance remains Phase 8 release-readiness work.

</domain>

<decisions>
## Implementation Decisions

### Mutation Body UX

- **D-01:** Create and Update use one explicit JSON Body field in Phase 7. Do not build metadata-derived entity property fields yet.
- **D-02:** The Body field is user-authored in the node parameters, not implicitly sourced from incoming n8n item JSON by default.
- **D-03:** Body input must parse as a non-array JSON object before sending CAP requests. Invalid JSON, arrays, strings, empty values, or unsupported values fail locally as sanitized validation errors.
- **D-04:** Create and Update success output should be the returned CAP entity as one cleaned n8n item, including server-generated fields. Planner may choose the OData mechanics needed to request/obtain a representation, but confirmation-only output is not the desired Phase 7 behavior.

### Composite Key Handling

- **D-05:** Phase 7 uses hybrid key handling for Read, Update, Delete, and bound actions/functions: metadata-derived key fields when metadata parsing can provide them, with the existing manual OData Key Predicate field as reliable fallback.
- **D-06:** When metadata-derived key fields are used for composite-key entities, every key part is required before sending the request.
- **D-07:** Key predicate construction should be type-aware when metadata key types are available: quote string-like values and leave numeric/boolean values unquoted according to OData expectations.
- **D-08:** If metadata cannot be loaded or key parsing fails, keyed operations fall back to the manual Key Predicate field rather than blocking the operation.

### Delete Safety and Output

- **D-09:** Delete returns one confirmation item on success, for example `{ deleted: true, entitySet, key }`.
- **D-10:** Delete does not require an extra confirmation checkbox. Selecting Delete plus providing an explicit key is enough for Phase 7.
- **D-11:** Delete treats `404 Not Found` as a clear n8n-native not-found error by default.
- **D-12:** Delete sends `DELETE` to the keyed entity URL with no request body.

### Actions and Functions UX

- **D-13:** CAP actions and functions appear as one combined `Action/Function` operation mode with a metadata-backed operation dropdown.
- **D-14:** Available actions/functions should be parsed from `$metadata`, including bound and unbound actions, functions, action imports, and function imports. Manual fallback remains available when metadata parsing cannot provide operation choices.
- **D-15:** Action/function parameters use one explicit JSON Parameters object field in Phase 7.
- **D-16:** Actions can send JSON parameters as a request body; functions can map JSON parameters to query parameters as needed for OData conventions.
- **D-17:** Bound actions/functions reuse the same hybrid key handling as Read, Update, and Delete.

### the agent's Discretion

- Planner may choose exact TypeScript module boundaries, helper names, and n8n property names as long as the existing `SapCap.node.ts`, `GenericFunctions.ts`, `ODataMetadata.ts`, and `ODataResponse.ts` separation stays understandable and testable.
- Planner may choose the exact metadata parser depth and internal operation descriptor shape, provided the Phase 7 user-visible behavior above is preserved.
- Planner may choose the exact sanitized validation/error messages, provided they remain n8n-native and do not expose credentials, auth headers, tokens, raw response bodies, request bodies, stack traces, or secret values.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements

- `.planning/ROADMAP.md` - Phase 7 goal, dependency on Phase 6, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` - `NODE-07`, `NODE-08`, `NODE-09`, `NODE-12`, `NODE-13`, and `VERIFY-04`.
- `.planning/PROJECT.md` - product boundary, brownfield constraints, n8n node ownership, security constraints, and developer UX.
- `.planning/STATE.md` - current project position and accumulated Phase 6 decisions.
- `.planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md` - Phase 6 credential, metadata, Query, Read, response cleanup, and deferred mutation/action decisions.

### Requirements Source

- `cap_n8n_requirements_v2.md` - Epic 4 SAP CAP Action Node, especially US 4.4 Create, US 4.5 Update, US 4.6 Delete, US 4.8 actions/functions, and composite-key acceptance criteria from US 4.3.
- `N8N_REQUIREMENTS.md` - Original CAP Action Node requirements for Create, Update, Delete, actions/functions, and OData response unwrapping.

### n8n Node Source

- `cap-n8n-node/nodes/SapCap/SapCap.node.ts` - current Phase 6 operation UI, execute loop, Query/Read wiring, and read-only operation guard.
- `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` - current URL/path validation, credential auth, Query/Read request builders, key predicate handling, and HTTP wrapper.
- `cap-n8n-node/nodes/SapCap/ODataMetadata.ts` - current `$metadata` entity-set extraction and load-options path; likely extension point for key and action/function metadata.
- `cap-n8n-node/nodes/SapCap/ODataResponse.ts` - response cleanup and sanitized error helper contracts to extend beyond Query/Read.
- `cap-n8n-node/credentials/SapCapApi.credentials.ts` - Basic Auth and OAuth2 Client Credentials fields reused by Phase 7.
- `cap-n8n-node/package.json` - n8n node package scripts, build/lint expectations, and engine constraints.

### Existing Tests and Demo CAP Operations

- `test/integration/n8n-node-read-operations.test.js` - current runtime test harness, fake CAP server, Basic/OAuth credential paths, continueOnFail behavior, and deferred-operation guard to replace in Phase 7.
- `test/integration/n8n-node-metadata-discovery.test.js` - metadata helper tests and credential Test Connection coverage to extend for keys and operations.
- `test/integration/n8n-node-response-cleanup.test.js` - response cleanup and sanitized error expectations to keep consistent across mutations and actions/functions.
- `test/smoke/package-boundaries.test.js` - package boundary and node metadata smoke expectations to update when Phase 7 operations become visible.
- `demo-app/srv/admin-service.cds` - editable `AdminService` entity sets usable for mutation examples.
- `demo-app/srv/cat-service.cds` - `submitOrder` action usable as a CAP action/function example.
- `demo-app/srv/cat-service.js` - `submitOrder` handler behavior and error responses for action integration tests.

### UI and User Story Tracking

- `mockups/n8n-node-mockup.html` - n8n node mockup that should be updated to show Phase 7 mutation and action/function modes.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/22` - US 4.4 Create Mode.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/23` - US 4.5 Update Mode.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/24` - US 4.6 Delete Mode.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/26` - US 4.8 Invoke CAP Actions and Functions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `SapCap.node.ts` already has a clear operation selector, shared service/entity controls, per-item execute loop, `continueOnFail()` handling, and metadata load-options integration.
- `GenericFunctions.ts` already normalizes Base URL, Metadata Path, Service Path, entity-set names, key predicates, and credential-based HTTP requests for Basic Auth and OAuth2 Client Credentials.
- `ODataMetadata.ts` already fetches `$metadata` and extracts EntitySets without adding a parser dependency. Phase 7 can extend this carefully for key fields and action/function descriptors.
- `ODataResponse.ts` already strips `@odata.*` fields, turns OData payloads into n8n items, and maps CAP/OData failures to sanitized `NodeOperationError` or continue-on-fail items.
- The Phase 6 fake-server integration tests provide a deterministic pattern for HTTP method/path/body/header assertions without requiring Docker n8n or a live CAP instance.

### Established Patterns

- The n8n node package is TypeScript, while CAP plugin runtime code is CommonJS JavaScript.
- Phase 6 intentionally hid mutation, action/function, raw response, and trigger controls; Phase 7 should make only Create, Update, Delete, and Action/Function visible.
- Raw OData controls are acceptable for CAP-oriented users when they keep the node simple and honest.
- Secrets and raw transport details must not appear in errors, logs, fixtures, docs, or planning artifacts.
- Root verification flows through `npm test`, which builds the n8n node package before integration tests.

### Integration Points

- Create should build `POST {servicePath}/{entitySet}` with a strict JSON object body.
- Update should build `PATCH {servicePath}/{entitySet}({keyPredicate})` with a strict JSON object body and one cleaned entity item as output.
- Delete should build `DELETE {servicePath}/{entitySet}({keyPredicate})` with no body and one confirmation item on success.
- Metadata-derived key fields should augment, not replace, the existing manual Key Predicate path.
- Action/Function mode should share credentials, service path, metadata loading, key handling for bound operations, JSON parameter parsing, response cleanup, and sanitized error handling with the CRUD modes.

</code_context>

<specifics>
## Specific Ideas

- Keep Phase 7 aligned with the Phase 6 philosophy: a pragmatic CAP/OData node, not a generic HTTP node and not a full visual OData query builder.
- For Create/Update, prefer node-visible explicit JSON over using the entire incoming item JSON by default.
- For action/function parameters, generated parameter fields are desirable later, but the first stable behavior should be an explicit JSON Parameters object.
- For composite keys, make the friendly path metadata-derived when possible, but never remove the reliable manual predicate fallback.

</specifics>

<deferred>
## Deferred Ideas

- Generated action/function parameter fields from metadata after the explicit JSON Parameters object field is stable.
- Full metadata-derived entity property editors for Create/Update after the JSON Body path is stable.
- Real installed custom-node E2E verification in a live n8n instance remains Phase 8 (`VERIFY-07`).

</deferred>

---

*Phase: 7-n8n Mutations and CAP Actions/Functions*
*Context gathered: 2026-06-03T18:49:57.8362921+02:00*
