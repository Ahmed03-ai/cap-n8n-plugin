# Phase 7: n8n Mutations and CAP Actions/Functions - Research

**Researched:** 2026-06-03
**Domain:** n8n community-node execution, SAP CAP OData mutations, OData CSDL metadata parsing
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

Source for this block: `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

### Locked Decisions

#### Mutation Body UX
- **D-01:** Create and Update use one explicit JSON Body field in Phase 7. Do not build metadata-derived entity property fields yet.
- **D-02:** The Body field is user-authored in the node parameters, not implicitly sourced from incoming n8n item JSON by default.
- **D-03:** Body input must parse as a non-array JSON object before sending CAP requests. Invalid JSON, arrays, strings, empty values, or unsupported values fail locally as sanitized validation errors.
- **D-04:** Create and Update success output should be the returned CAP entity as one cleaned n8n item, including server-generated fields. Planner may choose the OData mechanics needed to request/obtain a representation, but confirmation-only output is not the desired Phase 7 behavior.

#### Composite Key Handling
- **D-05:** Phase 7 uses hybrid key handling for Read, Update, Delete, and bound actions/functions: metadata-derived key fields when metadata parsing can provide them, with the existing manual OData Key Predicate field as reliable fallback.
- **D-06:** When metadata-derived key fields are used for composite-key entities, every key part is required before sending the request.
- **D-07:** Key predicate construction should be type-aware when metadata key types are available: quote string-like values and leave numeric/boolean values unquoted according to OData expectations.
- **D-08:** If metadata cannot be loaded or key parsing fails, keyed operations fall back to the manual Key Predicate field rather than blocking the operation.

#### Delete Safety and Output
- **D-09:** Delete returns one confirmation item on success, for example `{ deleted: true, entitySet, key }`.
- **D-10:** Delete does not require an extra confirmation checkbox. Selecting Delete plus providing an explicit key is enough for Phase 7.
- **D-11:** Delete treats `404 Not Found` as a clear n8n-native not-found error by default.
- **D-12:** Delete sends `DELETE` to the keyed entity URL with no request body.

#### Actions and Functions UX
- **D-13:** CAP actions and functions appear as one combined `Action/Function` operation mode with a metadata-backed operation dropdown.
- **D-14:** Available actions/functions should be parsed from `$metadata`, including bound and unbound actions, functions, action imports, and function imports. Manual fallback remains available when metadata parsing cannot provide operation choices.
- **D-15:** Action/function parameters use one explicit JSON Parameters object field in Phase 7.
- **D-16:** Actions can send JSON parameters as a request body; functions can map JSON parameters to query parameters as needed for OData conventions.
- **D-17:** Bound actions/functions reuse the same hybrid key handling as Read, Update, and Delete.

### the agent's Discretion
- Planner may choose exact TypeScript module boundaries, helper names, and n8n property names as long as existing `SapCap.node.ts`, `GenericFunctions.ts`, `ODataMetadata.ts`, and `ODataResponse.ts` separation stays understandable and testable.
- Planner may choose exact metadata parser depth/internal operation descriptor shape, provided Phase 7 visible behavior preserved.
- Planner may choose exact sanitized validation/error messages, provided n8n-native and no credentials/auth headers/tokens/raw response bodies/request bodies/stack traces/secret values.

### Deferred Ideas (OUT OF SCOPE)
- Generated action/function parameter fields from metadata after explicit JSON Parameters object field stable.
- Full metadata-derived entity property editors for Create/Update after JSON Body path stable.
- Real installed custom-node E2E verification in live n8n remains Phase 8 (`VERIFY-07`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NODE-07 | n8n workflow designer can use Create mode to create a CAP entity. `[VERIFIED: .planning/REQUIREMENTS.md]` | Use explicit JSON Body, `POST` to entity set, `Prefer: return=representation`, cleanup into one n8n item. `[CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]` |
| NODE-08 | n8n workflow designer can use Update mode to patch an existing CAP entity by key. `[VERIFIED: .planning/REQUIREMENTS.md]` | Use hybrid key handling, `PATCH` to keyed entity URL, explicit JSON Body, and representation output or fallback read. `[CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]` |
| NODE-09 | n8n workflow designer can use Delete mode to delete an existing CAP entity by key. `[VERIFIED: .planning/REQUIREMENTS.md]` | Use `DELETE` to keyed entity URL with no body and emit one confirmation item. `[CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]` |
| NODE-12 | n8n workflow designer can invoke CAP actions/functions exposed by the OData service. `[VERIFIED: .planning/REQUIREMENTS.md]` | Parse CSDL `Action`, `Function`, `ActionImport`, and `FunctionImport`; invoke actions with `POST` and functions with `GET` URL parameters. `[CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]` |
| NODE-13 | n8n workflow designer can work with CAP entities using composite keys. `[VERIFIED: .planning/REQUIREMENTS.md]` | Parse `EntityType/Key/PropertyRef` and property types from metadata; require all key parts and build named key predicates. `[CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]` |
| VERIFY-04 | Integration tests cover n8n credential handling, metadata discovery, Query, Read, Create, Update, Delete, and response cleanup. `[VERIFIED: .planning/REQUIREMENTS.md]` | Extend existing fake-server Vitest integration suites and root `npm test` path. `[VERIFIED: package.json + test/integration/*.test.js]` |
</phase_requirements>

## Project Constraints (from AGENTS.md)

| Directive | Planning Impact |
|-----------|-----------------|
| Use JavaScript CommonJS, SAP CAP, CDS/CDL, npm workspaces, Docker Compose, and n8n community-node conventions already present. `[VERIFIED: AGENTS.md]` | Phase 7 should modify the existing npm workspace and TypeScript n8n node package without replacing the project stack. `[VERIFIED: AGENTS.md + cap-n8n-node/package.json]` |
| Use Node.js 20+ because locked `@sap/cds` requires a modern Node runtime. `[VERIFIED: AGENTS.md]` | Tests and scripts should assume Node 20+ for CAP and the local n8n node package currently constrains Node to `>=22.16 <25`. `[VERIFIED: cap-n8n-node/package.json]` |
| Supervisor feedback requires integration tests rather than unit-test wording. `[VERIFIED: AGENTS.md]` | Plan verification should name fake-server integration tests and avoid presenting isolated unit tests as the primary acceptance gate. `[VERIFIED: AGENTS.md]` |
| Primary user is a CAP developer. `[VERIFIED: AGENTS.md]` | README/manual examples may include OData/CAP-specific details when that clarifies behavior. `[VERIFIED: AGENTS.md]` |
| n8n UI changes must stay within n8n node-editor conventions. `[VERIFIED: AGENTS.md]` | Use operation modes, labels, descriptions, dropdowns, credential fields, validation, and node properties instead of custom UI outside n8n conventions. `[VERIFIED: AGENTS.md]` |
| Secrets must remain in environment or n8n credentials; docs and fixtures must not commit real secrets. `[VERIFIED: AGENTS.md]` | Error messages, tests, docs, and mockups must use fake tokens and must not echo authorization headers, API keys, raw request bodies, or raw response bodies. `[VERIFIED: AGENTS.md]` |
| Reusable behavior belongs in `cap-n8n-plugin` and `cap-n8n-node`, not only `demo-app`. `[VERIFIED: AGENTS.md]` | Phase 7 mutation/action implementation belongs in `cap-n8n-node`; demo CAP services may provide fixtures but not reusable node logic. `[VERIFIED: AGENTS.md + cap-n8n-node/nodes/SapCap/*.ts]` |

## Summary

Phase 7 should extend the existing Phase 6 n8n node rather than introduce a new OData client or XML parser dependency. `[VERIFIED: cap-n8n-node/nodes/SapCap/*.ts]` The node already has programmatic operation execution, credential-aware HTTP helpers, entity-set load options, Query/Read request builders, response cleanup, and sanitized n8n errors. `[VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts + GenericFunctions.ts + ODataMetadata.ts + ODataResponse.ts]`

The standard implementation path is: add Create, Update, Delete, and one combined Action/Function operation; validate explicit JSON Body/Parameters locally; expand metadata parsing from entity sets to entity keys and operations; build OData URLs narrowly; and keep response cleanup/error behavior in the existing helper boundary. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` OData supports `POST` to a collection for create, `PATCH` to an entity for partial update, `DELETE` to an entity edit URL for delete, and `Prefer: return=representation` to request response bodies from create/update/action invocations. `[CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]`

The highest-risk planning areas are metadata parsing depth, composite key literal formatting, action/function URL construction, and preserving sanitized errors across new modes. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` The documentation and visual showcase updates are part of Phase 7 scope, including README/manual usage docs and the n8n node mockup panels for mutation/action modes. `[VERIFIED: user instruction + .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

**Primary recommendation:** Implement a narrow, dependency-free OData v4 helper layer inside `cap-n8n-node`, backed by fake-server integration tests for Create, Update, Delete, composite keys, and Action/Function behavior. `[VERIFIED: docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/ + test/integration/*.test.js]`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Operation mode UI and parameter validation | n8n node runtime | n8n editor | The n8n node defines operation properties and validates node parameters during `execute()`. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-execute-method/]` |
| Metadata discovery for entity sets, keys, and operations | n8n node runtime | CAP OData service | n8n `loadOptions` can query remote services for dropdown values, while CAP exposes `$metadata`. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/]` |
| CAP entity Create/Update/Delete | CAP OData service | n8n node runtime | CAP owns data validation, persistence, authorization, and business semantics; the node only builds and sends OData requests. `[CITED: cap.cloud.sap/docs/guides/protocols/odata]` |
| Bound and unbound CAP actions/functions | CAP OData service | n8n node runtime | CAP defines custom operations in CDS and exposes them through OData metadata; the node discovers and invokes them. `[CITED: cap.cloud.sap/docs/guides/services/custom-actions]` |
| Composite key predicate construction | n8n node runtime | CAP OData metadata | Metadata provides key property names and types; the node formats a request URL from user values. `[CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]` |
| Response cleanup and n8n-native errors | n8n node runtime | CAP OData service | Existing node helpers already strip OData metadata and map HTTP failures into sanitized n8n errors. `[VERIFIED: cap-n8n-node/nodes/SapCap/ODataResponse.ts]` |
| README/manual/showcase updates | Repository docs | n8n mockup HTML | Phase 7 explicitly includes documentation and visual showcase updates. `[VERIFIED: user instruction]` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `n8n-workflow` | 2.16.0 pinned locally; npm latest line observed as 2.16.0 with newer dist-tags present. `[VERIFIED: cap-n8n-node/package.json + npm registry]` | Node property types, execution data, and n8n error classes. `[VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]` | Existing n8n node code imports `INodeType`, `INodeExecutionData`, and error types from this package. `[VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]` |
| `@n8n/node-cli` | 0.32.1 pinned locally; npm registry latest observed as 0.33.0. `[VERIFIED: cap-n8n-node/package.json + npm registry]` | Build/lint tooling for community nodes. `[CITED: docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/]` | n8n community-node docs direct authors to use the `n8n-node` CLI. `[CITED: docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/]` |
| `typescript` | 6.0.3 pinned locally. `[VERIFIED: cap-n8n-node/package.json + npm registry]` | Compile the n8n node package. `[VERIFIED: cap-n8n-node/tsconfig.json]` | Existing package build runs `n8n-node build`, which compiles the TypeScript node code. `[VERIFIED: cap-n8n-node/package.json]` |
| `vitest` | 4.1.7 pinned locally; slopcheck flagged it as suspicious due typosquat proximity to `vite`. `[VERIFIED: package.json + npm registry + slopcheck]` | Integration-test runner. `[VERIFIED: package.json + test/integration/*.test.js]` | Root `npm test` already runs smoke and integration suites with Vitest. `[VERIFIED: package.json]` |
| SAP CAP OData metadata | `@sap/cds` 9.9.1 pinned locally. `[VERIFIED: package-lock.json + npm registry]` | CAP service metadata, CRUD endpoints, and action/function exposure. `[CITED: cap.cloud.sap/docs/guides/protocols/odata]` | Demo services compile to OData EDMX with entity sets, composite keys, and `submitOrder` action import. `[VERIFIED: npx cds compile demo-app/db demo-app/srv --to edmx]` |

### Supporting

| Library/Tool | Version | Purpose | When to Use |
|--------------|---------|---------|-------------|
| Node.js | v24.16.0 available locally. `[VERIFIED: node --version]` | Runtime for build and tests. `[VERIFIED: cap-n8n-node/package.json]` | Use current local Node because it satisfies `cap-n8n-node` `>=22.16 <25` and CAP Node 20+ constraints. `[VERIFIED: cap-n8n-node/package.json + AGENTS.md]` |
| npm | 11.13.0 available locally. `[VERIFIED: npm --version]` | Workspace install and scripts. `[VERIFIED: package.json]` | Use root workspace commands for build and integration tests. `[VERIFIED: package.json]` |
| Docker Compose | Docker 29.5.2 and Compose v5.1.4 available locally. `[VERIFIED: docker --version + docker compose version]` | Local n8n runtime for later manual workflows. `[VERIFIED: docker-compose.yml]` | Phase 7 deterministic tests should not require live n8n because Phase 8 owns installed custom-node E2E. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dependency-free bounded CSDL extraction | Runtime XML parser package | n8n verification guidelines state verified community nodes must have no external dependencies, so a parser adds release friction and package-legitimacy work. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/]` |
| Explicit JSON Body/Parameters | Metadata-generated property/parameter fields | User decisions defer generated fields until JSON object mode is stable. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` |
| Fake-server integration tests | Live installed n8n custom-node E2E | Phase 8 owns real installed custom-node E2E verification. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` |

**Installation:** No new runtime or dev packages are recommended for Phase 7. `[VERIFIED: docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/ + cap-n8n-node/package.json]`

```bash
npm install
npm run build --workspace n8n-nodes-sap-cap
npm test
```

**Version verification:** Recommended packages and local tools were checked with `npm view`, `node --version`, `npm --version`, `docker --version`, `docker compose version`, `npx cds --version`, and `npx n8n-node --version`. `[VERIFIED: local command output]`

## Package Legitimacy Audit

No new external packages are recommended for Phase 7. `[VERIFIED: docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/]` Existing packages used by this phase were checked because the phase exercises the n8n node package and integration test runner. `[VERIFIED: package.json + cap-n8n-node/package.json]`

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@n8n/node-cli` | npm | Created 2025-08-21. `[VERIFIED: npm registry]` | 6,218 weekly downloads for 2026-05-27..2026-06-02. `[VERIFIED: npm registry]` | `github.com/n8n-io/n8n`. `[VERIFIED: npm registry]` | OK. `[VERIFIED: slopcheck]` | Approved as existing dev dependency; do not upgrade unless planner adds a separate version-change task. `[VERIFIED: cap-n8n-node/package.json]` |
| `n8n-workflow` | npm | Created 2019-06-21. `[VERIFIED: npm registry]` | 320,951 weekly downloads for 2026-05-27..2026-06-02. `[VERIFIED: npm registry]` | `github.com/n8n-io/n8n`. `[VERIFIED: npm registry]` | OK. `[VERIFIED: slopcheck]` | Approved as existing dependency. `[VERIFIED: cap-n8n-node/package.json]` |
| `typescript` | npm | Created 2012-10-01. `[VERIFIED: npm registry]` | 205,759,155 weekly downloads for 2026-05-27..2026-06-02. `[VERIFIED: npm registry]` | `github.com/microsoft/TypeScript`. `[VERIFIED: npm registry]` | OK. `[VERIFIED: slopcheck]` | Approved as existing dev dependency. `[VERIFIED: cap-n8n-node/package.json]` |
| `vitest` | npm | Created 2021-12-03. `[VERIFIED: npm registry]` | 64,617,933 weekly downloads for 2026-05-27..2026-06-02. `[VERIFIED: npm registry]` | `github.com/vitest-dev/vitest`. `[VERIFIED: npm registry]` | SUS because slopcheck marked typosquat proximity to `vite`. `[VERIFIED: slopcheck]` | Keep existing dependency; planner should not add or upgrade it without human verification. `[VERIFIED: package.json]` |
| `@sap/cds` | npm | Created 2020-06-11. `[VERIFIED: npm registry]` | 307,544 weekly downloads for 2026-05-27..2026-06-02. `[VERIFIED: npm registry]` | No npm repository field observed. `[VERIFIED: npm registry]` | OK with no-repo info. `[VERIFIED: slopcheck]` | Approved as existing CAP dependency. `[VERIFIED: package-lock.json]` |
| `@cap-js/sqlite` | npm | Created 2023-04-04. `[VERIFIED: npm registry]` | 245,165 weekly downloads for 2026-05-27..2026-06-02. `[VERIFIED: npm registry]` | `github.com/cap-js/cds-dbs`. `[VERIFIED: npm registry]` | OK. `[VERIFIED: slopcheck]` | Approved as existing demo persistence dependency. `[VERIFIED: demo-app/package.json]` |

**Packages removed due to slopcheck `[SLOP]` verdict:** none. `[VERIFIED: slopcheck]`
**Packages flagged as suspicious `[SUS]`:** `vitest` is existing and should not be newly installed or upgraded in Phase 7 without a human checkpoint. `[VERIFIED: slopcheck + package.json]`

## Architecture Patterns

### System Architecture Diagram

```text
n8n workflow item
  |
  v
SapCap.node.ts operation selector
  |-- Query/Read existing path
  |-- Create/Update/Delete new mutation path
  `-- Action/Function new business-operation path
        |
        v
Node parameter validation
  |-- explicit JSON Body/Parameters parser
  |-- metadata key fields or manual key predicate fallback
  `-- operation descriptor selection or manual fallback
        |
        v
GenericFunctions.ts OData request builder
        |
        v
CAP OData service endpoint
  |-- entity set CRUD
  |-- bound action/function
  `-- unbound action/function import
        |
        v
ODataResponse.ts cleanup and sanitized n8n result/error
        |
        v
n8n output item(s)
```

Diagram source: existing code and Phase 7 decisions. `[VERIFIED: cap-n8n-node/nodes/SapCap/*.ts + .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

### Recommended Project Structure

```text
cap-n8n-node/
|-- credentials/
|   `-- SapCapApi.credentials.ts        # existing credential surface
|-- nodes/SapCap/
|   |-- SapCap.node.ts                  # operation UI and execute loop
|   |-- GenericFunctions.ts             # URL normalization, request builders, HTTP wrapper
|   |-- ODataMetadata.ts                # entity set, key, action/function metadata extraction
|   `-- ODataResponse.ts                # response cleanup and n8n error mapping
|-- test/integration/                   # fake-server integration suites
docs/
|-- manual-visual-showcase.md           # manual mode documentation
mockups/
`-- n8n-node-mockup.html                # visible mode showcase
```

Structure source: current repository layout and Phase 7 documentation requirement. `[VERIFIED: rg --files + user instruction]`

### Pattern 1: Explicit JSON Object Parameters

**What:** Create/Update Body and Action/Function Parameters should parse into a non-array JSON object before any HTTP request is sent. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

**When to use:** Use for Create, Update, Action, and Function parameter input in Phase 7. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

**Example:**

```typescript
// Source: n8n execute methods read node parameters during execute();
// OData create/update sends one entity representation or partial entity object.
// [CITED: docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-execute-method/]
// [CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]
function parseJsonObjectParameter(value: unknown, fieldName: string): Record<string, unknown> {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${fieldName} must be a JSON object`)
  }
  return parsed as Record<string, unknown>
}
```

### Pattern 2: Hybrid Key Handling

**What:** Prefer metadata-derived key fields when key metadata is available; otherwise use the existing manual OData Key Predicate field. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

**When to use:** Use for Read, Update, Delete, and bound Action/Function operations. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

**Example:**

```typescript
// Source: OData canonical URLs use the entity set followed by a key predicate;
// CSDL EntityType keys are declared through Key/PropertyRef.
// [CITED: docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html]
// [CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]
function buildNamedKeyPredicate(parts: Array<{ name: string; type?: string; value: unknown }>): string {
  const assignments = parts.map(part => `${part.name}=${formatODataLiteral(part.value, part.type)}`)
  return `(${assignments.join(',')})`
}
```

### Pattern 3: Metadata Operation Descriptors

**What:** Parse schema-level `Action`/`Function` definitions and container-level `ActionImport`/`FunctionImport` entries into one dropdown descriptor list. `[CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]`

**When to use:** Use for the combined Action/Function operation mode. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

**Descriptor shape recommendation:** Store `kind`, `name`, `qualifiedName`, `isBound`, `bindingType`, `importName`, `parameters`, and `returnType`. `[ASSUMED]`

### Pattern 4: n8n-Native Error Boundaries

**What:** Use `NodeOperationError` for local validation/config/data-transformation failures and `NodeApiError` for external API/HTTP failures. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/]`

**When to use:** Local JSON parse errors, missing key parts, and unknown operation descriptors should be operational errors; CAP HTTP failures should be API errors after sanitization. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/]`

**Example:**

```typescript
// Source: n8n error docs recommend item-indexed errors and continueOnFail output items.
// [CITED: docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/]
if (this.continueOnFail()) {
  returnData.push({
    json: { error: sanitized.message },
    pairedItem: { item: i },
  })
  continue
}
throw toNodeOperationError(this.getNode(), sanitized, i)
```

### Anti-Patterns to Avoid

- **Adding a runtime XML parser by default:** n8n verified community-node guidelines say verified community nodes must not have external dependencies, so a parser package creates release risk. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/]`
- **Implicitly taking mutation bodies from incoming n8n item JSON:** Phase 7 explicitly requires a user-authored Body field. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`
- **Returning confirmation-only output for Create/Update:** Phase 7 requires the returned CAP entity, including server-generated fields. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`
- **Treating all keys as single `ID`:** OData CSDL supports keys with one or more `PropertyRef` entries, and the project requirements include composite keys. `[CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]`
- **Parsing only imports for actions/functions:** Bound actions/functions are schema-level operations and may not appear as container imports. `[CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full OData client SDK | Generic query compiler, batch client, or arbitrary OData expression engine | Narrow helpers for Phase 7 CRUD and action/function URLs | Phase 7 scope is concrete operations and existing raw Query remains available for advanced reads. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` |
| Entity property editors | Metadata-generated Create/Update fields | One explicit JSON Body field | User decisions explicitly defer generated entity property fields. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` |
| Action/function parameter editors | Metadata-generated parameter controls | One explicit JSON Parameters object | User decisions explicitly choose JSON Parameters for Phase 7. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` |
| Runtime XML parser dependency | New parser package in `dependencies` | Bounded CSDL extraction in `ODataMetadata.ts` plus integration fixtures | Verified n8n community-node guidance disallows external dependencies for verified nodes. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/]` |
| Live n8n installed-node E2E | Docker-installed custom-node browser workflow tests | Fake-server integration tests in Phase 7; live E2E in Phase 8 | Context defers real installed custom-node E2E to Phase 8. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` |

**Key insight:** Phase 7 is an integration-surface phase, not a general OData SDK phase; planning should keep helpers narrow, tested, and aligned to the locked UI decisions. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

## Common Pitfalls

### Pitfall 1: Create/Update Returns 204 Instead of an Entity

**What goes wrong:** The node emits confirmation-only output or empty output after Create/Update. `[ASSUMED]`

**Why it happens:** OData allows clients to request `return=representation` or `return=minimal`, and services may respond with minimal content. `[CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]`

**How to avoid:** Send `Prefer: return=representation`; if CAP still returns no body for Update, perform a follow-up Read using the same key. `[CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]`

**Warning signs:** Tests assert only `{ updated: true }` or status code output for Update/Create. `[ASSUMED]`

### Pitfall 2: Composite Keys Break Because Only One Key Field Is Modeled

**What goes wrong:** Read/Update/Delete succeeds for `Books(ID)` but fails for localized text or other composite-key entities. `[VERIFIED: npx cds compile demo-app/db demo-app/srv --to edmx]`

**Why it happens:** CSDL keys are declared as one or more `PropertyRef` entries, and CAP generated metadata includes composite keys such as `locale` plus `ID` or `code` in localized text entity types. `[CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]` `[VERIFIED: npx cds compile demo-app/db demo-app/srv --to edmx]`

**How to avoid:** Parse all key property refs, require every key part for metadata mode, and keep manual key predicate fallback. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

**Warning signs:** Integration tests cover `Books(ID)` but no composite key. `[VERIFIED: test/integration/*.test.js]`

### Pitfall 3: Key Literal Formatting Is Not Type-Aware

**What goes wrong:** The node sends `locale=en,ID=...` without string quotes or sends numeric keys as quoted strings. `[ASSUMED]`

**Why it happens:** OData key predicates need literal formatting, and user decisions require string-like values quoted while numeric/boolean values remain unquoted when type metadata is available. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

**How to avoid:** Map CSDL property types to literal formatters and escape embedded single quotes by doubling them. `[CITED: docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html]`

**Warning signs:** Tests only assert path strings for numeric IDs. `[ASSUMED]`

### Pitfall 4: Action/Function Parser Misses Bound Operations

**What goes wrong:** Unbound action imports appear in the dropdown but bound entity operations do not. `[ASSUMED]`

**Why it happens:** Bound actions/functions are schema-level operations where the first parameter is the binding parameter; imports expose unbound operations through the entity container. `[CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]`

**How to avoid:** Parse both schema operation definitions and entity-container imports, then match bound operation binding type to entity set entity types. `[CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]`

**Warning signs:** Metadata tests only use CAP `submitOrder` and no bound action fixture. `[VERIFIED: demo-app/srv/cat-service.cds]`

### Pitfall 5: Function Invocation Uses POST Body

**What goes wrong:** Functions fail because parameters are sent as a request body. `[ASSUMED]`

**Why it happens:** OData action invocations use `POST`, while function invocations use `GET` with parameter values in the URL. `[CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]`

**How to avoid:** Split action and function request builders even though the UI exposes one combined mode. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`

**Warning signs:** A single action/function builder always sets `method: 'POST'`. `[ASSUMED]`

### Pitfall 6: Sanitized Errors Regress

**What goes wrong:** CAP response bodies, request bodies, tokens, or stack traces leak into n8n errors or continue-on-fail output. `[VERIFIED: AGENTS.md]`

**Why it happens:** New operation paths bypass the existing `classifySapCapError` and `toNodeOperationError` helpers. `[VERIFIED: cap-n8n-node/nodes/SapCap/ODataResponse.ts]`

**How to avoid:** Route every new HTTP failure through the same response/error helper layer and expand tests for each operation mode. `[VERIFIED: cap-n8n-node/nodes/SapCap/ODataResponse.ts + test/integration/n8n-node-response-cleanup.test.js]`

**Warning signs:** Tests assert raw error payload text or include Authorization headers in failure fixtures. `[ASSUMED]`

### Pitfall 7: Documentation Trails Implementation

**What goes wrong:** README and visual showcase still say mutations/actions are future work after code ships. `[VERIFIED: README.md + docs/manual-visual-showcase.md + mockups/n8n-node-mockup.html]`

**Why it happens:** Docs are treated as cleanup rather than an implementation deliverable. `[VERIFIED: user instruction]`

**How to avoid:** Put README/manual/mockup updates in the same implementation wave as the node operation changes. `[VERIFIED: user instruction]`

**Warning signs:** Phase plan has code tasks but no documentation or mockup task. `[ASSUMED]`

## Code Examples

Verified patterns from official sources and local code:

### Create Request Builder

```typescript
// Source: OData create uses POST to the collection URL with one entity representation.
// Source: Prefer return=representation requests response content.
// [CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]
const request = {
  method: 'POST',
  path: `${servicePath}/${entitySet}`,
  body: parsedBody,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
}
```

### Update Request Builder

```typescript
// Source: OData update supports PATCH on an entity URL.
// [CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]
const request = {
  method: 'PATCH',
  path: `${servicePath}/${entitySet}${keyPredicate}`,
  body: parsedBody,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
}
```

### Delete Confirmation

```typescript
// Source: Phase 7 decision D-09 requires one confirmation item.
// [VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]
const item = {
  json: {
    deleted: true,
    entitySet,
    key: keyPredicate,
  },
  pairedItem: { item: itemIndex },
}
```

### CAP Unbound Action Fixture

```cds
// Source: Existing CatalogService exposes submitOrder as an unbound action.
// [VERIFIED: demo-app/srv/cat-service.cds]
service CatalogService @(path: '/catalog') {
  action submitOrder (book: Books:ID, quantity: Integer) returns {
    stock: Integer
  };
}
```

### Metadata Key Extraction Target

```xml
<!-- Source: CSDL EntityType keys use Key/PropertyRef entries. -->
<!-- [CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html] -->
<EntityType Name="Currencies_texts">
  <Key>
    <PropertyRef Name="locale"/>
    <PropertyRef Name="code"/>
  </Key>
  <Property Name="locale" Type="Edm.String" Nullable="false"/>
  <Property Name="code" Type="Edm.String" Nullable="false"/>
</EntityType>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `this.helpers.request` in n8n custom nodes | `this.helpers.httpRequest` or authenticated helpers | n8n docs state the previous helper was removed in version 1. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/http-helpers/]` | Keep using the existing `httpRequest`-based wrapper. `[VERIFIED: cap-n8n-node/nodes/SapCap/GenericFunctions.ts]` |
| Community-node packages with runtime dependencies | Verified community nodes with no external dependencies | n8n verification guidelines document no external dependencies. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/]` | Avoid adding an XML parser package in Phase 7. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/]` |
| CAP docs paths under older guide URLs | Current CAP OData and custom action/function docs under `guides/protocols/odata` and `guides/services/custom-actions` | Current docs pages were reachable during research on 2026-06-03. `[CITED: cap.cloud.sap/docs/guides/protocols/odata]` `[CITED: cap.cloud.sap/docs/guides/services/custom-actions]` | Cite current pages and verify behavior with generated EDMX. `[VERIFIED: npx cds compile demo-app/db demo-app/srv --to edmx]` |
| Phase 6 read-only n8n node | Phase 7 mutation/action operation set | Phase 7 scope. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` | Update smoke tests that currently assert mutation/action modes are absent. `[VERIFIED: test/smoke/package-boundaries.test.js]` |

**Deprecated/outdated:**
- README/manual text that says Create/Update/Delete/actions/functions are deferred is outdated for Phase 7 planning. `[VERIFIED: README.md + docs/manual-visual-showcase.md + user instruction]`
- Mockup panels labeling mutation modes as future are outdated for Phase 7 planning. `[VERIFIED: mockups/n8n-node-mockup.html + user instruction]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A bounded regex/string CSDL extractor remains sufficient for Phase 7 instead of adding an XML parser. | Standard Stack, Architecture Patterns | Complex metadata documents could fail discovery; planner should include fixtures for namespaces, imports, bound ops, composite keys, and malformed metadata. |
| A2 | Metadata-derived key UI can be represented cleanly with existing n8n node property patterns without custom editor components. | Architecture Patterns | Planner may need to adjust exact property shapes after checking local `n8n-workflow` type support. |
| A3 | Phase 7 function parameter support can focus on primitive JSON Parameters mapped to URL parameter syntax, with manual fallback for complex edge cases. | Common Pitfalls, Open Questions | Complex function parameters could be unsupported until a later phase. |
| A4 | Action/function outputs should be one cleaned n8n item, wrapping primitive or array results under `value` when needed because n8n item JSON is object-shaped. | Architecture Patterns, Code Examples | Users might expect collection-returning functions to emit multiple items; requirement wording favors one item. |
| A5 | Fake-server integration tests are sufficient for Phase 7 acceptance because live installed custom-node E2E remains Phase 8. | Standard Stack, Don't Hand-Roll | A packaging/runtime-only bug could escape until Phase 8. |

## Open Questions (RESOLVED)

1. **Exact metadata key field UI shape**
   - What we know: hybrid key handling is locked and manual fallback is required. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]`
   - RESOLVED: Phase 7 uses the smallest metadata-derived key field/helper shape needed to support metadata-backed key parts, including composite keys, while preserving the manual OData Key Predicate fallback as the reliable escape hatch. Exact n8n UI implementation details remain executor/planner discretion inside this hybrid contract. `[VERIFIED: D-05, D-06, D-08 in .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md + 07-01-PLAN.md]`

2. **Function URL parameter literal format for non-primitive parameters**
   - What we know: OData functions use `GET` with parameter values in the URL. `[CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]`
   - RESOLVED: Phase 7 supports primitive JSON Parameters for functions and maps those values to encoded OData URL parameters. Complex and collection function parameters are documented/manual fallback territory and deferred beyond the primitive Phase 7 function path. `[VERIFIED: D-15, D-16 in .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md + 07-03-PLAN.md]`

3. **Update representation fallback**
   - What we know: Create/Update must output the returned CAP entity, and OData has `Prefer: return=representation`. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` `[CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]`
   - RESOLVED: Update sends `Prefer: return=representation`; if CAP returns `204 No Content` or any successful response with no body, the node follows up with a Read by the same key so Update still returns the cleaned entity item required by D-04 instead of confirmation-only output. `[VERIFIED: D-04 in .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md + 07-02-PLAN.md]`

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Build/test runtime | yes. `[VERIFIED: node --version]` | v24.16.0. `[VERIFIED: node --version]` | None needed. `[VERIFIED: cap-n8n-node/package.json]` |
| npm | Workspace scripts | yes. `[VERIFIED: npm --version]` | 11.13.0. `[VERIFIED: npm --version]` | None needed. `[VERIFIED: package.json]` |
| n8n node CLI | n8n node build | yes via `npx n8n-node`. `[VERIFIED: npx n8n-node --version]` | @n8n/node-cli 0.32.1. `[VERIFIED: npx n8n-node --version]` | Use workspace `npm run build --workspace n8n-nodes-sap-cap`. `[VERIFIED: cap-n8n-node/package.json]` |
| CAP CLI | EDMX fixture verification | yes via `npx cds`. `[VERIFIED: npx cds --version]` | @sap/cds-dk 9.9.1 and @sap/cds 9.9.1. `[VERIFIED: npx cds --version]` | Use checked-in metadata fixtures if CAP CLI is unavailable later. `[ASSUMED]` |
| Docker | Local n8n runtime | yes. `[VERIFIED: docker --version]` | Docker 29.5.2. `[VERIFIED: docker --version]` | Fake-server tests for Phase 7. `[VERIFIED: test/integration/*.test.js]` |
| Docker Compose | Local n8n runtime scripts | yes. `[VERIFIED: docker compose version]` | v5.1.4. `[VERIFIED: docker compose version]` | Fake-server tests for Phase 7. `[VERIFIED: test/integration/*.test.js]` |
| Context7 CLI | Optional docs lookup | no. `[VERIFIED: command -v ctx7]` | unavailable. `[VERIFIED: command -v ctx7]` | Official docs and generated CAP EDMX were used. `[CITED: docs.n8n.io]` `[CITED: docs.oasis-open.org]` |

**Missing dependencies with no fallback:** none found for Phase 7 planning. `[VERIFIED: local command output]`

**Missing dependencies with fallback:** Context7 CLI was unavailable; official documentation and local generated EDMX covered the needed research. `[VERIFIED: command -v ctx7]` `[CITED: docs.oasis-open.org]`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes. `[VERIFIED: cap-n8n-node/credentials/SapCapApi.credentials.ts]` | Use n8n credentials for Basic/OAuth fields and never expose secrets in output/errors. `[VERIFIED: AGENTS.md + cap-n8n-node/credentials/SapCapApi.credentials.ts]` |
| V3 Session Management | no. `[ASSUMED]` | The node uses per-request HTTP credentials rather than browser sessions. `[VERIFIED: cap-n8n-node/credentials/SapCapApi.credentials.ts]` |
| V4 Access Control | yes. `[VERIFIED: demo-app/srv/access-control.cds]` | CAP service authorization remains server-side; the node must not bypass CAP access rules. `[CITED: cap.cloud.sap/docs/guides/protocols/odata]` |
| V5 Input Validation | yes. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` | Validate URLs, service paths, entity set names, key predicates, key parts, JSON Body, and JSON Parameters before HTTP requests. `[VERIFIED: cap-n8n-node/nodes/SapCap/GenericFunctions.ts + 07-CONTEXT.md]` |
| V6 Cryptography | yes. `[ASSUMED]` | Do not hand-roll crypto; rely on Node/n8n HTTP transport and recommend HTTPS for remote CAP services. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/http-helpers/]` |

### Known Threat Patterns for n8n CAP OData Node

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret leakage through errors | Information Disclosure | Sanitize errors and never include Authorization headers, tokens, raw request bodies, raw response bodies, stack traces, or credential values. `[VERIFIED: AGENTS.md + cap-n8n-node/nodes/SapCap/ODataResponse.ts]` |
| OData path injection through key predicates | Tampering | Continue rejecting URL boundary characters in manual key predicates and format metadata-derived key values through type-aware literal helpers. `[VERIFIED: cap-n8n-node/nodes/SapCap/GenericFunctions.ts + 07-CONTEXT.md]` |
| Wrong-row destructive mutation | Tampering | Require explicit key input for Update/Delete and require every metadata-derived composite key part. `[VERIFIED: .planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md]` |
| SSRF-style credential Base URL abuse | Spoofing / Information Disclosure | Preserve Base URL validation for HTTP(S) URLs and reject userinfo/query/hash components. `[VERIFIED: cap-n8n-node/nodes/SapCap/GenericFunctions.ts]` |
| XML external entity expansion if a parser is introduced | Information Disclosure / Denial of Service | Do not introduce a runtime XML parser by default; if a parser is later added, disable external entity resolution and run package legitimacy review. `[ASSUMED]` |
| Action/function parameter injection | Tampering | Parse JSON Parameters locally, encode URL parameter values, and never concatenate untrusted values into paths without formatting. `[CITED: docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html]` |

## Sources

### Primary (HIGH confidence)

- n8n Programmatic-style execute method: `https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-execute-method/` - execution loop, parameters, output items. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-execute-method/]`
- n8n Programmatic-style parameters: `https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/` - `loadOptions` for dynamic dropdown values. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/]`
- n8n HTTP helpers: `https://docs.n8n.io/integrations/creating-nodes/build/reference/http-helpers/` - current HTTP helper API and full response behavior. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/http-helpers/]`
- n8n Error handling: `https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/` - `NodeApiError`, `NodeOperationError`, and `continueOnFail`. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/]`
- n8n Submit community nodes: `https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/` - package conventions and `n8n-node` CLI. `[CITED: docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/]`
- n8n Verification guidelines: `https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/` - no external dependencies for verified community nodes. `[CITED: docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/]`
- OData Protocol v4.01 Part 1: `https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html` - CRUD methods, action/function invocation, and `Prefer` header. `[CITED: docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html]`
- OData URL Conventions v4.01 Part 2: `https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html` - key predicates and operation URL conventions. `[CITED: docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html]`
- OData CSDL XML v4.02: `https://docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html` - EntityType keys, actions, functions, imports, and binding parameters. `[CITED: docs.oasis-open.org/odata/odata-csdl-xml/v4.02/odata-csdl-xml-v4.02.html]`
- SAP CAP OData guide: `https://cap.cloud.sap/docs/guides/protocols/odata` - CAP OData service behavior. `[CITED: cap.cloud.sap/docs/guides/protocols/odata]`
- SAP CAP custom actions/functions guide: `https://cap.cloud.sap/docs/guides/services/custom-actions` - CAP custom operation modeling. `[CITED: cap.cloud.sap/docs/guides/services/custom-actions]`
- Local generated CAP metadata via `npx cds compile demo-app/db demo-app/srv --to edmx` - actual demo service entity keys and `submitOrder` metadata. `[VERIFIED: npx cds compile demo-app/db demo-app/srv --to edmx]`

### Secondary (MEDIUM confidence)

- Local repository files: `cap-n8n-node/nodes/SapCap/*.ts`, `test/integration/*.test.js`, `README.md`, `docs/manual-visual-showcase.md`, and `mockups/n8n-node-mockup.html` - current implementation and docs state. `[VERIFIED: rg --files + file reads]`
- npm registry metadata and weekly download API for existing packages. `[VERIFIED: npm registry]`
- slopcheck scan of existing packages. `[VERIFIED: slopcheck]`

### Tertiary (LOW confidence)

- Assumptions about exact n8n property shapes for dynamic composite-key fields and complex function parameter URL literals. `[ASSUMED]`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package versions, scripts, local tools, and official n8n docs were verified. `[VERIFIED: package.json + cap-n8n-node/package.json + npm registry + docs.n8n.io]`
- Architecture: MEDIUM - module boundaries and OData mechanics are clear, but the bounded CSDL parser shape still needs implementation proof. `[VERIFIED: cap-n8n-node/nodes/SapCap/*.ts]` `[ASSUMED]`
- Pitfalls: MEDIUM - most pitfalls are grounded in official OData/n8n docs and existing tests; complex function parameter edge cases remain uncertain. `[CITED: docs.oasis-open.org]` `[ASSUMED]`
- Security: MEDIUM - current sanitization and credential boundaries are visible, but new operations must be tested to preserve them. `[VERIFIED: cap-n8n-node/nodes/SapCap/ODataResponse.ts + AGENTS.md]`

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 for OData/CAP mechanics; 2026-06-10 for n8n package/tooling details because n8n and npm package versions are fast-moving. `[ASSUMED]`
