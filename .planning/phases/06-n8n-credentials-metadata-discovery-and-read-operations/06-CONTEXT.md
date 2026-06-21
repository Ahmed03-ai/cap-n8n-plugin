# Phase 6: n8n Credentials, Metadata Discovery, and Read Operations - Context

**Gathered:** 2026-06-03T11:28:19.2916915Z
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers the first production-useful n8n community node slice for reading SAP CAP OData V4 services. It covers Basic Auth credentials, a `$metadata` credential test, dynamic entity-set discovery, Query mode, Read mode, plain n8n item output, and safe n8n-native error handling.

It does not deliver Create, Update, Delete, CAP actions/functions, advanced composite-key UI, or the optional polling trigger node. Those stay in later phases.

</domain>

<decisions>
## Implementation Decisions

### GitHub User Story Scope
- **D-01:** Phase 6 implements GitHub issues `#19`, `#20`, `#21`, `#25`, and `#27`: SAP CAP credential type, Query mode, Read mode, dynamic metadata discovery, and OData response cleanup.
- **D-02:** Phase 6 covers requirements `NODE-02`, `NODE-03`, `NODE-04`, `NODE-05`, `NODE-06`, `NODE-10`, and the cross-cutting `NODE-11`.
- **D-03:** GitHub issues `#22`, `#23`, `#24`, and `#26` stay out of Phase 6 because Create, Update, Delete, and actions/functions belong to Phase 7.

### Credential Strategy
- **D-04:** Basic Auth is the first fully working credential path for Phase 6.
- **D-05:** OAuth2 Client Credentials should remain visible/scaffolded in the credential UI for later completion, but Phase 6 should not depend on deep OAuth2 behavior or exhaustive OAuth2 integration coverage.
- **D-06:** Credential testing should use the CAP service `$metadata` endpoint and should be safe: no credential values, auth headers, or tokens in logs, errors, fixtures, or planning artifacts.

### Metadata Discovery
- **D-07:** Entity sets should load dynamically from the CAP `$metadata` endpoint at design time.
- **D-08:** The dynamic entity-set dropdown should have a manual fallback or clear error path when metadata cannot be loaded.
- **D-09:** Metadata discovery should work with the Phase 6 Basic Auth path first. OAuth2 should not block entity discovery in this phase.

### Query Mode
- **D-10:** Query mode starts with raw OData controls: `$filter`, `$orderby`, `$select`, `$top`, and `$skip`.
- **D-11:** The node should use clear n8n labels, descriptions, and examples for these raw OData fields instead of building a guided query-builder UI in Phase 6.
- **D-12:** Query mode should return one n8n item per returned CAP entity.

### Read Mode
- **D-13:** Read mode starts with a manual OData key predicate field, such as `ID=201` or `ID=201,IsActiveEntity=true`.
- **D-14:** Dynamic key-field generation and richer composite-key UI are deferred to a later phase.
- **D-15:** Read mode should return one n8n item for the fetched entity and should raise a clear n8n-native not-found error when the entity does not exist.

### Response Cleanup
- **D-16:** Default output should be cleaned plain n8n item data.
- **D-17:** Query responses should unwrap OData `value` arrays into one item per row.
- **D-18:** Read responses should return the entity object directly.
- **D-19:** Strip `@odata.*` metadata fields by default while preserving normal CAP entity fields exactly as returned.
- **D-20:** Do not add a raw OData response toggle in Phase 6.

### Error Handling
- **D-21:** CAP/OData failures should become n8n-native `NodeOperationError`s with concise messages and sanitized context.
- **D-22:** Error categories should distinguish `401/403` credential/auth errors, `404` not-found errors for Read, `400` validation/query errors, and `5xx` CAP/server errors.
- **D-23:** Error messages must not include raw auth headers, tokens, credential values, or full response bodies.
- **D-24:** When n8n `continueOnFail()` is enabled, failed items should return structured item JSON such as `{ error, statusCode, category }`.

### the agent's Discretion
- Planner may choose the exact module split inside `cap-n8n-node` as long as it follows n8n community-node conventions and keeps reusable OData helpers testable.
- Planner may decide whether to keep existing Create/Update/Delete skeleton options hidden, removed from Phase 6 UI, or left inert only if that choice avoids false claims that Phase 7 behavior is implemented.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements
- `.planning/ROADMAP.md` - Phase 6 goal, dependencies, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` - `NODE-02`, `NODE-03`, `NODE-04`, `NODE-05`, `NODE-06`, `NODE-10`, and `NODE-11`.
- `.planning/PROJECT.md` - project constraints, active n8n-node requirements, and brownfield/product boundaries.
- `.planning/STATE.md` - current decisions and pending Phase 5 UAT note.

### Existing n8n Node Assets
- `cap-n8n-node/package.json` - n8n community-node package metadata, scripts, manifests, and Node engine constraints.
- `cap-n8n-node/credentials/SapCapApi.credentials.ts` - existing credential skeleton with Base URL, metadata path, Basic Auth, and OAuth2 fields.
- `cap-n8n-node/nodes/SapCap/SapCap.node.ts` - existing SAP CAP node skeleton, Query/Read/Create/Update/Delete options, request construction, response cleanup, and `NodeOperationError` use.
- `cap-n8n-node/index.js` - package boundary for n8n node metadata.
- `mockups/n8n-node-mockup.html` - UI intent for credentials, Query, Read, and later mutation modes.

### Codebase Maps
- `.planning/codebase/STACK.md` - TypeScript/n8n-node tooling, package scripts, Vitest, Docker, CAP runtime, and workspace constraints.
- `.planning/codebase/ARCHITECTURE.md` - current package responsibilities, n8n node layer, CAP OData services, and integration boundaries.
- `.planning/codebase/INTEGRATIONS.md` - CAP OData endpoints, auth context, local n8n, and external integration notes.

### GitHub User Stories
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/19` - US 4.1: SAP CAP Credential Type.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/20` - US 4.2: Query Mode.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/21` - US 4.3: Read Mode.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/25` - US 4.7: Dynamic Metadata Discovery.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/27` - US 4.9: OData Response Cleanup.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cap-n8n-node/credentials/SapCapApi.credentials.ts` already contains Base URL, metadata path, Basic Auth fields, OAuth2 fields, and an n8n credential test scaffold.
- `cap-n8n-node/nodes/SapCap/SapCap.node.ts` already has a first-pass SAP CAP node with operation selection, service path, entity set, raw Query fields, manual entity key, response cleanup, Basic/OAuth header helpers, and `continueOnFail()` handling.
- `demo-app/srv/admin-service.cds` and `demo-app/srv/cat-service.cds` expose CAP OData V4 services that can be used for local integration tests.
- `mockups/n8n-node-mockup.html` gives a visual reference for credential fields and Query/Read mode ergonomics.

### Established Patterns
- Runtime code in the CAP plugin is CommonJS JavaScript, but the n8n community node package uses TypeScript because that is the established n8n scaffold pattern in this repo.
- Root verification runs `npm test`, which builds the n8n node package before smoke tests and then runs Vitest integration tests.
- Existing integration tests use fake HTTP servers and local CAP services; Phase 6 should favor deterministic integration tests over live external CAP or n8n dependencies.
- Secrets stay in environment or n8n credential storage; committed docs and fixtures must not include API keys, passwords, client secrets, tokens, or auth headers.

### Integration Points
- The n8n credential test calls `Base URL + Metadata Path`, usually something like `http://host.docker.internal:3000/odata/v4/admin/$metadata`.
- Dynamic entity discovery should consume the same credential and metadata endpoint used by the credential test.
- Query and Read should call CAP OData V4 entity-set URLs under a configurable service path such as `/odata/v4/admin`.
- Plain item output should normalize CAP OData responses before they enter downstream n8n workflow nodes.

</code_context>

<specifics>
## Specific Ideas

- Make the first working authentication path Basic Auth.
- Keep OAuth2 Client Credentials visible as scaffolded future support, but do not let OAuth2 implementation complexity block Phase 6.
- Prefer dynamic entity-set dropdowns because they make the node feel like a real n8n integration instead of asking users to memorize CAP service names.
- Start Query mode with raw OData fields because CAP developers understand them and the phase should avoid building a query-builder UI too early.
- Start Read mode with a manual OData key predicate and defer dynamic key-field generation.
- Return clean plain data by default; no raw OData toggle yet.

</specifics>

<deferred>
## Deferred Ideas

- Full OAuth2 Client Credentials behavior and deeper integration coverage.
- Guided Query builder UI with fields/operators.
- Dynamic key-field generation and richer composite-key UX.
- Raw OData response toggle or debug/raw metadata mode.
- Create, Update, Delete, CAP actions/functions, and comprehensive mutation response cleanup.
- Polling trigger node.

</deferred>

---

*Phase: 6-n8n Credentials, Metadata Discovery, and Read Operations*
*Context gathered: 2026-06-03T11:28:19.2916915Z*
