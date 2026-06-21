# Phase 06: n8n Credentials, Metadata Discovery, and Read Operations - Research

**Researched:** 2026-06-03
**Domain:** n8n community node credentials, design-time metadata discovery, SAP CAP OData V4 read operations
**Confidence:** HIGH for Basic Auth/read/query implementation, MEDIUM for n8n 2.22.x compatibility and OAuth2 scaffold behavior

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### the agent's Discretion

- Planner may choose the exact module split inside `cap-n8n-node` as long as it follows n8n community-node conventions and keeps reusable OData helpers testable.
- Planner may decide whether to keep existing Create/Update/Delete skeleton options hidden, removed from Phase 6 UI, or left inert only if that choice avoids false claims that Phase 7 behavior is implemented.

### Deferred Ideas (OUT OF SCOPE)
- Full OAuth2 Client Credentials behavior and deeper integration coverage.
- Guided Query builder UI with fields/operators.
- Dynamic key-field generation and richer composite-key UX.
- Raw OData response toggle or debug/raw metadata mode.
- Create, Update, Delete, CAP actions/functions, and comprehensive mutation response cleanup.
- Polling trigger node.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NODE-02 | n8n user can configure SAP CAP credentials with Basic Auth, OAuth2 Client Credentials, and service Base URL. | Use the existing `SapCapApi` credential file, make Basic Auth the production path, keep OAuth2 fields as visible scaffold, and validate credential fields with integration tests. [VERIFIED: .planning/REQUIREMENTS.md; VERIFIED: cap-n8n-node/credentials/SapCapApi.credentials.ts; CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/] |
| NODE-03 | n8n user can test CAP credentials against the CAP service `$metadata` endpoint. | Keep the credential test as a GET request to the configured metadata path and ensure Basic Auth credentials are injected by n8n credential authentication or a single shared request helper. [VERIFIED: cap-n8n-node/credentials/SapCapApi.credentials.ts; CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/; CITED: https://cap.cloud.sap/docs/advanced/odata] |
| NODE-04 | n8n workflow designer can select CAP entity sets from a dynamically loaded dropdown. | Implement `methods.loadOptions.getEntitySets` and bind an `options` property through `typeOptions.loadOptionsMethod`. [VERIFIED: node_modules/n8n-workflow/dist/esm/interfaces.d.ts; CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/] |
| NODE-05 | n8n workflow designer can use Query mode to retrieve a filtered, sorted, paginated collection of CAP entities. | Query mode should issue GET collection requests with raw OData `$filter`, `$orderby`, `$select`, `$top`, and `$skip` query options. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts; CITED: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html] |
| NODE-06 | n8n workflow designer can use Read mode to retrieve one CAP entity by known key. | Read mode should issue GET requests to `{entitySet}({manualKeyPredicate})` and report 404 as a sanitized not-found node error. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts; CITED: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html; CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/] |
| NODE-10 | n8n workflow designer receives plain n8n item data instead of raw OData wrapper structures. | Query responses unwrap OData `value` arrays, Read responses return the entity object, and all `@odata.*` properties are stripped by default. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts; CITED: https://docs.oasis-open.org/odata/odata-json-format/v4.01/os/odata-json-format-v4.01-os.html] |
| NODE-11 | n8n workflow designer receives n8n-native errors for CAP authentication, validation, not-found, and server failures. | Use `NodeOperationError` for sanitized operational and HTTP-status category failures, and return structured error items when `continueOnFail()` is enabled. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/; VERIFIED: node_modules/n8n-workflow/dist/esm/interfaces.d.ts] |
</phase_requirements>

## Summary

Phase 6 should be a narrow read-only n8n node slice: keep `cap-n8n-node` as the implementation owner, make Basic Auth and `$metadata` testing work first, load CAP entity sets from OData V4 metadata at design time, and expose only Query and Read operations in the visible node operation list. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts] The current skeleton already has credential fields, Query/Read code, OData cleanup helpers, and mutation options; the main Phase 6 work is hardening credentials, adding load-options metadata discovery, sanitizing errors, and removing or hiding Create/Update/Delete from the Phase 6 UI surface. [VERIFIED: cap-n8n-node/credentials/SapCapApi.credentials.ts; VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]

The recommended implementation is to split reusable helpers inside `cap-n8n-node/nodes/SapCap/` only when it improves integration-testability: one transport/auth helper, one metadata/entity-set helper, one OData response/error helper, and the node class as the n8n UI/execution adapter. [ASSUMED] This keeps CAP OData behavior reusable without creating a generic OData SDK. [VERIFIED: .planning/REQUIREMENTS.md]

**Primary recommendation:** Implement `sapCapApiRequest`, `getEntitySets`, `normalizeODataItems`, and `toNodeOperationError` helpers; expose only Query and Read; verify with deterministic Vitest integration tests using fake HTTP servers and repo-local `npm run build --workspace n8n-nodes-sap-cap`. [VERIFIED: test/integration/n8n-webhook-runtime.test.js; VERIFIED: cap-n8n-node/package.json]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| SAP CAP credential fields and credential test | n8n credential layer | CAP OData service | n8n owns credential storage, form fields, and credential-test request execution; CAP only answers `$metadata`. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/; CITED: https://cap.cloud.sap/docs/advanced/odata] |
| Entity-set discovery | n8n node design-time load-options | CAP OData `$metadata` | n8n `loadOptions` renders dynamic options in the editor; CAP metadata supplies the entity-set names. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/; CITED: https://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/cs02/odata-csdl-xml-v4.01-cs02.html] |
| Query collection reads | n8n node execute runtime | CAP OData service | The node builds authenticated GET requests and converts OData collection responses into n8n items; CAP executes the OData query. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-execute-method/; CITED: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html] |
| Read by key predicate | n8n node execute runtime | CAP OData service | The node accepts the manual key predicate and maps 404 responses to node errors; CAP owns entity lookup and authorization. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts; CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/] |
| Response cleanup | n8n node execute runtime | - | n8n items should expose plain `json` objects; OData protocol wrappers are transport details. [CITED: https://docs.oasis-open.org/odata/odata-json-format/v4.01/os/odata-json-format-v4.01-os.html] |
| Sanitized error handling and `continueOnFail()` | n8n node execute runtime | - | n8n provides `NodeOperationError` and a documented item-level continue-on-fail pattern. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/] |
| Phase 6 integration tests | Repository test harness | Fake HTTP CAP-like service | Existing tests already use Node HTTP fake servers with Vitest, so Phase 6 should reuse that deterministic pattern. [VERIFIED: test/integration/n8n-webhook-runtime.test.js; VERIFIED: package.json] |

## Project Constraints (from AGENTS.md)

- Use JavaScript CommonJS, SAP CAP, CDS/CDL, npm workspaces, Docker Compose, and n8n community-node conventions already present in the repo. [VERIFIED: AGENTS.md]
- Use Node.js 20+ for CAP compatibility; the n8n node workspace currently declares `node >=22.16 <25`. [VERIFIED: AGENTS.md; VERIFIED: cap-n8n-node/package.json]
- Use integration-test wording and integration-test evidence rather than unit-test wording in requirements and planning artifacts. [VERIFIED: AGENTS.md]
- Keep secrets in environment or n8n credential storage; do not commit API keys, private keys, auth headers, tokens, or production credentials in docs or fixtures. [VERIFIED: AGENTS.md]
- Keep reusable n8n node behavior in `cap-n8n-node`, not in `demo-app` or mockup HTML. [VERIFIED: AGENTS.md]
- Match the existing TypeScript/n8n node skeleton style in `cap-n8n-node` and the existing Vitest integration-test style under `test/integration`. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts; VERIFIED: test/integration/n8n-webhook-runtime.test.js]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@n8n/node-cli` | 0.32.1 installed/latest, modified 2026-06-02 | Builds and lints the community-node package through `npm run build --workspace n8n-nodes-sap-cap`. | Existing package script uses `n8n-node build` and npm registry confirms 0.32.1 is current. [VERIFIED: cap-n8n-node/package.json; VERIFIED: npm registry; VERIFIED: slopcheck] |
| `n8n-workflow` | 2.16.0 installed/latest, npm `stable` tag 2.22.3, modified 2026-06-03 | Provides n8n node, credential, execution, load-options, HTTP helper, and error type definitions. | Existing package depends on 2.16.0 and local type definitions verify `httpRequestWithAuthentication`, `ILoadOptionsFunctions`, `loadOptionsMethod`, `continueOnFail`, and `NodeOperationError`. [VERIFIED: cap-n8n-node/package.json; VERIFIED: npm registry; VERIFIED: codebase grep; VERIFIED: slopcheck] |
| TypeScript | 6.0.3 installed/latest, modified 2026-04-16 | Compiles the n8n community-node TypeScript files. | Existing package depends on TypeScript and `@n8n/node-cli` builds the TypeScript node files. [VERIFIED: cap-n8n-node/package.json; VERIFIED: npm registry; VERIFIED: slopcheck] |
| Vitest | 4.1.7 installed, 4.1.8 latest, modified 2026-06-01 | Runs existing smoke and integration tests. | Existing root scripts use Vitest for smoke and integration suites; slopcheck flags `vitest` as SUS due name similarity to `vite`, but it is already present and high-download. [VERIFIED: package.json; VERIFIED: npm registry; VERIFIED: slopcheck] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `http` module | Runtime built-in in Node 24.16.0 local environment | Deterministic fake CAP/OData servers for integration tests. | Use for credential-test, metadata, Query, Read, error-category, and continue-on-fail integration tests. [VERIFIED: test/integration/n8n-webhook-runtime.test.js; VERIFIED: environment probe] |
| `@sap/cds` | 9.9.1 installed/latest, modified 2026-05-21 | Optional local CAP service verification if the planner adds a live CAP integration-test slice. | Use only if fake HTTP evidence is insufficient; do not make Phase 6 depend on global `cds`. [VERIFIED: package-lock.json; VERIFIED: npm registry; VERIFIED: environment probe] |
| `@cap-js/sqlite` | 2.4.0 installed/latest, modified 2026-06-01 | Optional in-memory CAP persistence for local CAP integration tests. | Use with `@sap/cds` only for optional local CAP verification. [VERIFIED: demo-app/package.json; VERIFIED: npm registry; VERIFIED: slopcheck] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fake HTTP server integration tests | Live n8n plus live CAP demo app | Live end-to-end tests provide stronger editor/runtime confidence but are slower and require Docker/n8n state; fake servers are deterministic and match existing repo integration style. [VERIFIED: test/integration/n8n-webhook-runtime.test.js; VERIFIED: docker-compose.yml] |
| Targeted entity-set extractor over `$metadata` XML | Add an XML parser package | A parser package would reduce XML edge-case risk, but no new dependency is required if Phase 6 only extracts `EntitySet Name` attributes and tests namespace/multiple-container cases. [ASSUMED] |
| Raw OData query fields | Guided query builder | The user locked raw OData fields for Phase 6 and deferred guided query-builder UI. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |

**Installation:**

No new package install is recommended for Phase 6. [VERIFIED: cap-n8n-node/package.json; VERIFIED: package.json]

```bash
npm install
npm run build --workspace n8n-nodes-sap-cap
```

**Version verification commands used:**

```bash
npm view @n8n/node-cli version time.created time.modified repository.url scripts.postinstall --json
npm view n8n-workflow version dist-tags time.created time.modified repository.url scripts.postinstall --json
npm view typescript version time.created time.modified repository.url scripts.postinstall --json
npm view vitest version time.created time.modified repository.url scripts.postinstall --json
npm view @sap/cds version time.created time.modified repository.url scripts.postinstall --json
npm view @cap-js/sqlite version time.created time.modified repository.url scripts.postinstall --json
```

## Package Legitimacy Audit

> Phase 6 should not add external packages. This audit covers existing packages the planner is likely to rely on. [VERIFIED: cap-n8n-node/package.json; VERIFIED: package.json]

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@n8n/node-cli` | npm | Created 2025-08-21 | 6,218/week for 2026-05-27..2026-06-02 | github.com/n8n-io/n8n | OK | Existing dependency approved for build/lint. [VERIFIED: npm registry; VERIFIED: npm downloads API; VERIFIED: slopcheck] |
| `n8n-workflow` | npm | Created 2019-06-21 | 320,951/week for 2026-05-27..2026-06-02 | github.com/n8n-io/n8n | OK | Existing dependency approved; do not upgrade to npm `stable` 2.22.3 without explicit compatibility task. [VERIFIED: npm registry; VERIFIED: npm downloads API; VERIFIED: slopcheck] |
| `typescript` | npm | Created 2012-10-01 | 205,759,155/week for 2026-05-27..2026-06-02 | github.com/microsoft/TypeScript | OK | Existing dependency approved. [VERIFIED: npm registry; VERIFIED: npm downloads API; VERIFIED: slopcheck] |
| `vitest` | npm | Created 2021-12-03 | 64,617,933/week for 2026-05-27..2026-06-02 | github.com/vitest-dev/vitest | SUS | Existing dependency only; slopcheck flagged name similarity to `vite`, so planner should not add or upgrade it without a human checkpoint. [VERIFIED: npm registry; VERIFIED: npm downloads API; VERIFIED: slopcheck] |
| `@sap/cds` | npm | Created 2020-06-11 | 307,544/week for 2026-05-27..2026-06-02 | none in npm metadata | OK with source-repo note | Existing CAP dependency; use only through repo-local installs. [VERIFIED: npm registry; VERIFIED: npm downloads API; VERIFIED: slopcheck] |
| `@cap-js/sqlite` | npm | Created 2023-04-04 | 245,165/week for 2026-05-27..2026-06-02 | github.com/cap-js/cds-dbs | OK | Existing optional CAP integration-test dependency. [VERIFIED: npm registry; VERIFIED: npm downloads API; VERIFIED: slopcheck] |

**Packages removed due to slopcheck [SLOP] verdict:** none. [VERIFIED: slopcheck]
**Packages flagged as suspicious [SUS]:** `vitest` was flagged by slopcheck for name similarity to `vite`; it is already installed and should not be newly installed or upgraded without a checkpoint. [VERIFIED: slopcheck]

## Architecture Patterns

### System Architecture Diagram

```text
n8n editor credential form
  -> SapCapApi credential test
  -> GET {baseUrl}{metadataPath}
  -> CAP OData V4 $metadata
  -> sanitized credential success/failure

n8n editor entity-set dropdown
  -> SapCap.methods.loadOptions.getEntitySets()
  -> sapCapApiRequest(GET metadataPath)
  -> parse CSDL EntitySet names
  -> dynamic options or manual fallback/error

n8n workflow execution item
  -> SapCap.execute()
  -> operation? Query or Read
  -> build CAP OData GET URL
  -> sapCapApiRequest()
  -> CAP OData JSON response
  -> normalizeODataItems()
  -> plain n8n json items with pairedItem

CAP/OData error response
  -> classify by status 401/403, 404, 400, 5xx, network
  -> sanitize message/context
  -> continueOnFail? structured error item : NodeOperationError
```

### Recommended Project Structure

```text
cap-n8n-node/
├── credentials/
│   └── SapCapApi.credentials.ts        # credential fields, Basic Auth credential test, OAuth scaffold
├── nodes/
│   └── SapCap/
│       ├── SapCap.node.ts              # n8n UI description, loadOptions binding, execute adapter
│       ├── GenericFunctions.ts         # sapCapApiRequest, URL/path validation, auth routing
│       ├── ODataMetadata.ts            # metadata fetch/extract entity-set options
│       └── ODataResponse.ts            # cleanup, item shaping, sanitized error classification
└── index.js                            # existing package boundary

test/
├── smoke/
│   └── package-boundaries.test.js      # update visible Phase 6 operation/credential metadata checks
└── integration/
    └── n8n-node-read-operations.test.js # fake-server credentials, metadata, Query, Read, errors
```

This structure is recommended because the current node class contains credentials-adjacent transport, OAuth, response cleanup, mutation behavior, and execution logic in one file. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts] Keeping helpers inside `nodes/SapCap/` avoids a broad shared SDK boundary while making fake-server integration tests call the same code paths as `execute()` and `loadOptions`. [ASSUMED]

### Pattern 1: Credential-Owned Basic Auth and Metadata Test

**What:** Add credential authentication for Basic Auth and keep the credential test as a GET to `metadataPath`. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/]

**When to use:** Use for Phase 6 Basic Auth, because it is the first fully working credential path and `$metadata` is the locked safe test endpoint. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]

**Example:**

```typescript
// Source: n8n credentials docs.
import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
} from 'n8n-workflow'

export class SapCapApi implements ICredentialType {
  name = 'sapCapApi'

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      auth: {
        username: '={{$credentials.username}}',
        password: '={{$credentials.password}}',
      },
    },
  }

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '={{$credentials.metadataPath}}',
      method: 'GET',
    },
  }
}
```

**Implementation note:** If the planner keeps `authType: none` or selectable OAuth2 in the same credential type, it must prevent unconditional empty Basic Auth from being sent for non-Basic modes. [ASSUMED] The safest Phase 6 route is to make Basic Auth the only fully active request-auth path, keep OAuth2 visible/scaffolded, and test Basic Auth thoroughly. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]

### Pattern 2: Dynamic Entity-Set Load Options with Manual Fallback

**What:** Add `methods.loadOptions.getEntitySets()` and bind a node property with `typeOptions.loadOptionsMethod: 'getEntitySets'`. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/; VERIFIED: node_modules/n8n-workflow/dist/esm/interfaces.d.ts]

**When to use:** Use when `entitySelectionMode` is `metadata`; show `entitySetManual` string when `entitySelectionMode` is `manual`. [ASSUMED]

**Example:**

```typescript
// Source: n8n loadOptions docs and n8n-workflow local typings.
methods = {
  loadOptions: {
    async getEntitySets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
      const metadataXml = await sapCapApiRequest.call(this, {
        method: 'GET',
        servicePath: '',
        endpointPath: getMetadataPathFromCredentials(this),
        responseFormat: 'text',
      })

      return extractEntitySetOptions(metadataXml).map((entitySet) => ({
        name: entitySet.name,
        value: entitySet.name,
        description: entitySet.entityType,
      }))
    },
  },
}
```

**Implementation note:** The entity-set extractor should only extract CSDL `EntitySet` names and optional `EntityType` values in Phase 6; key discovery, actions, functions, and composite-key UI are Phase 7 or later. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; CITED: https://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/cs02/odata-csdl-xml-v4.01-cs02.html]

### Pattern 3: Read-Only OData Request Builder

**What:** Build only GET requests for Query and Read. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]

**When to use:** Use Query for collection endpoints and Read for a manual OData key predicate. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; CITED: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html]

**Example:**

```typescript
// Source: OData URL conventions and existing node skeleton.
function buildQueryUrl(baseUrl: string, servicePath: string, entitySet: string, params: QueryParams) {
  const url = new URL(`${trimSlashes(servicePath)}/${encodeURIComponent(entitySet)}`, normalizeBaseUrl(baseUrl))
  if (params.filter) url.searchParams.set('$filter', params.filter)
  if (params.orderBy) url.searchParams.set('$orderby', params.orderBy)
  if (params.select) url.searchParams.set('$select', params.select)
  if (params.top !== undefined && params.top !== '') url.searchParams.set('$top', String(params.top))
  if (params.skip !== undefined && params.skip !== '') url.searchParams.set('$skip', String(params.skip))
  return url.toString().replace(/\+/g, '%20')
}

function buildReadUrl(baseUrl: string, servicePath: string, entitySet: string, rawKey: string) {
  const keyPredicate = normalizeEntityKey(rawKey)
  return `${normalizeBaseUrl(baseUrl)}${trimTrailingSlash(servicePath)}/${encodeURIComponent(entitySet)}${keyPredicate}`
}
```

**Implementation note:** Do not URL-encode the complete manual key predicate because OData expressions such as `ID=201,IsActiveEntity=true` and quoted strings need OData syntax preservation; validate presence and trim wrapping parentheses only. [ASSUMED]

### Pattern 4: Plain n8n Item Normalization

**What:** Convert OData JSON into n8n `INodeExecutionData` items with `json` and `pairedItem`. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-execute-method/]

**When to use:** Use for every successful Query and Read response. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]

**Example:**

```typescript
// Source: OData JSON format and n8n execute docs.
function stripODataMetadata(value: IDataObject): IDataObject {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith('@odata.'))
      .map(([key, child]) => [
        key,
        Array.isArray(child)
          ? child.map((entry) => isDataObject(entry) ? stripODataMetadata(entry) : entry)
          : isDataObject(child) ? stripODataMetadata(child) : child,
      ]),
  )
}

function normalizeQueryItems(response: IDataObject, itemIndex: number): INodeExecutionData[] {
  const rows = Array.isArray(response.value) ? response.value : []
  return rows.map((row) => ({
    json: stripODataMetadata(row as IDataObject),
    pairedItem: { item: itemIndex },
  }))
}
```

**Implementation note:** Preserve ordinary CAP fields exactly as returned; only remove keys with the `@odata.` prefix. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]

### Pattern 5: Sanitized Node Errors and `continueOnFail`

**What:** Convert CAP/OData failures to concise `NodeOperationError`s or structured error items. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/]

**When to use:** Use for request failures, invalid node parameters, metadata-load failures, and unexpected response shapes. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/]

**Example:**

```typescript
// Source: n8n error handling docs.
function handleItemError(context: IExecuteFunctions, err: unknown, itemIndex: number, returnData: INodeExecutionData[]) {
  const safeError = classifySapCapError(err)

  if (context.continueOnFail()) {
    returnData.push({
      json: {
        error: safeError.message,
        statusCode: safeError.statusCode,
        category: safeError.category,
      },
      pairedItem: { item: itemIndex },
    })
    return
  }

  throw new NodeOperationError(context.getNode(), safeError.message, {
    itemIndex,
    description: safeError.description,
  })
}
```

**Implementation note:** Do not pass raw HTTP errors or response bodies directly into `NodeOperationError` when they may contain request options, headers, tokens, or CAP response bodies. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/]

### Anti-Patterns to Avoid

- **Visible mutation operations in Phase 6:** Create, Update, Delete, actions, and functions are Phase 7; exposing them in the operation dropdown falsely claims unsupported behavior. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]
- **Full OData query builder:** `$filter`, `$orderby`, `$select`, `$top`, and `$skip` are raw expert fields in Phase 6; guided operators/field builders are deferred. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]
- **Full metadata model parser:** Phase 6 needs entity-set names, not keys/actions/functions/entity graph semantics. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]
- **Raw error forwarding:** n8n errors must be sanitized and must not include auth headers, tokens, credentials, or full CAP response bodies. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]
- **Global CLI dependency:** Global `cds` and global `n8n-node` are not available in the local environment; use repo-local npm scripts. [VERIFIED: environment probe; VERIFIED: cap-n8n-node/package.json]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| n8n credential UI and Basic Auth injection | Custom credential storage or ad hoc secret files | n8n `ICredentialType`, `authenticate`, and `test` request | n8n already provides credential fields, secret masking, and credential-test request flow. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/] |
| HTTP request execution with n8n credentials | Raw `fetch` and manually logged headers in node code | `this.helpers.httpRequestWithAuthentication.call(this, 'sapCapApi', options)` when credential-level auth can be used, or one centralized `sapCapApiRequest` helper | n8n helper is the documented path and local typings expose it; a central helper is the fallback for multi-auth conditional logic. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/http-helpers/; VERIFIED: node_modules/n8n-workflow/dist/esm/interfaces.d.ts] |
| Dynamic option rendering | Static entity list or mockup-only dropdown | n8n `methods.loadOptions` and `loadOptionsMethod` | n8n supports design-time option loading for service-backed choices. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/; VERIFIED: node_modules/n8n-workflow/dist/esm/interfaces.d.ts] |
| OData query syntax parsing | Custom `$filter` parser or guided query builder | Raw OData text fields sent as query parameters | OData already defines query option syntax, and the phase locks raw controls. [CITED: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html; VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |
| OData response wrapper semantics | Generic response flattening that guesses all `@` keys | Targeted `@odata.*` stripping and `value` unwrapping | OData JSON defines collection wrappers with `value` and control information; CAP fields must otherwise be preserved. [CITED: https://docs.oasis-open.org/odata/odata-json-format/v4.01/os/odata-json-format-v4.01-os.html] |
| Error classification | Raw `Error.message` passthrough | Sanitized status-code category mapping plus `NodeOperationError` or structured continue-on-fail items | n8n has documented error classes and continue-on-fail item handling. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/] |

**Key insight:** The hard parts are n8n integration contracts, credential safety, OData edge cases, and deterministic testing; a custom generic OData client or query builder would add scope without satisfying any Phase 6 locked decision. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]

## Common Pitfalls

### Pitfall 1: Credential Test Does Not Actually Send Basic Auth

**What goes wrong:** The credential test performs `GET $metadata` without credentials and appears broken against secured CAP services. [VERIFIED: cap-n8n-node/credentials/SapCapApi.credentials.ts]

**Why it happens:** The current `SapCapApi.credentials.ts` defines `test.request` but does not define `authenticate`. [VERIFIED: cap-n8n-node/credentials/SapCapApi.credentials.ts]

**How to avoid:** Add Basic Auth credential authentication or route credential-test-equivalent integration coverage through the same centralized request helper used by load options and execute. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/; ASSUMED]

**Warning signs:** Fake metadata server receives no `Authorization` header for Basic Auth tests, or secured `$metadata` returns 401 despite valid username/password. [ASSUMED]

### Pitfall 2: Multi-Auth Credential Field Becomes Unconditional Basic Auth

**What goes wrong:** `authenticate.properties.auth` sends empty Basic Auth when the user selected OAuth2 or no auth. [ASSUMED]

**Why it happens:** n8n generic `authenticate` applies to the credential type; the docs show `auth` as Basic Auth but do not describe per-option conditional authentication in the credential snippet. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/]

**How to avoid:** Treat Basic Auth as the only production path in Phase 6, keep OAuth2 visibly scaffolded but not required for passing integration evidence, and ensure non-Basic selections either use explicit guarded code or return a sanitized configuration error. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; ASSUMED]

**Warning signs:** OAuth2-selected test calls include `Authorization: Basic Og==`, or Basic-auth integration tests pass only because the fake server ignores auth. [ASSUMED]

### Pitfall 3: Entity Discovery Parses Too Much Metadata

**What goes wrong:** The implementation expands into key parsing, action/function parsing, navigation properties, or composite-key UI. [ASSUMED]

**Why it happens:** OData CSDL metadata is rich, but Phase 6 only needs entity-set selection. [CITED: https://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/cs02/odata-csdl-xml-v4.01-cs02.html; VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]

**How to avoid:** Extract only `EntitySet Name` and optional `EntityType`, test namespace-prefixed XML, and leave key/action/function UX for Phase 7. [ASSUMED]

**Warning signs:** New code or tests mention CAP actions, functions, `NODE-12`, or dynamic key fields in Phase 6. [VERIFIED: .planning/REQUIREMENTS.md]

### Pitfall 4: `$top=0` and `$skip=0` Are Dropped Accidentally

**What goes wrong:** Numeric OData query options are omitted because `0` is falsey. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]

**Why it happens:** The current skeleton uses `if (top)` and `if (skip)`. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]

**How to avoid:** Include numeric options when the parameter is not `undefined`, `null`, or empty string, and validate nonnegative integers. [ASSUMED]

**Warning signs:** Integration tests for `$top=0` or `$skip=0` show no corresponding query parameter. [ASSUMED]

### Pitfall 5: Read Key Predicate Is Over-Encoded

**What goes wrong:** `ID=201,IsActiveEntity=true` becomes a literal encoded string that CAP cannot parse as an OData key predicate. [ASSUMED]

**Why it happens:** Manual OData key predicates are syntax, not ordinary path segment text. [CITED: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html]

**How to avoid:** Validate nonempty key predicate, wrap with parentheses when missing, preserve the internal predicate syntax, and let advanced users supply OData quoting. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; ASSUMED]

**Warning signs:** Fake server receives `/Books(ID%3D201%2CIsActiveEntity%3Dtrue)` instead of `/Books(ID=201,IsActiveEntity=true)`. [ASSUMED]

### Pitfall 6: Error Sanitizer Re-Exposes Secrets Through Raw Error Objects

**What goes wrong:** `NodeOperationError` serializes the raw HTTP error, including request headers or response bodies. [ASSUMED]

**Why it happens:** The current skeleton throws `new NodeOperationError(this.getNode(), err as Error, { itemIndex })` and continue-on-fail returns `err.message` directly. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]

**How to avoid:** Convert unknown errors into a safe `{ message, statusCode, category, description }` object before throwing or returning error items. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/]

**Warning signs:** Integration tests can find password, `Authorization`, bearer token, or raw CAP body text in serialized thrown errors. [ASSUMED]

## Code Examples

Verified patterns from official sources and local type definitions:

### Basic Auth Credential Test

```typescript
// Source: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/
authenticate: IAuthenticateGeneric = {
  type: 'generic',
  properties: {
    auth: {
      username: '={{$credentials.username}}',
      password: '={{$credentials.password}}',
    },
  },
}

test: ICredentialTestRequest = {
  request: {
    baseURL: '={{$credentials.baseUrl}}',
    url: '={{$credentials.metadataPath}}',
    method: 'GET',
  },
}
```

### Load Entity Sets for Dynamic Options

```typescript
// Source: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/
methods = {
  loadOptions: {
    async getEntitySets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
      const metadata = await fetchSapCapMetadata.call(this)
      return extractEntitySetOptions(metadata)
    },
  },
}
```

### Query Mode Request Parameters

```typescript
// Source: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html
const qs: Record<string, string> = {}
if (filter) qs.$filter = filter
if (orderBy) qs.$orderby = orderBy
if (select) qs.$select = select
if (top !== undefined && top !== '') qs.$top = String(top)
if (skip !== undefined && skip !== '') qs.$skip = String(skip)
```

### OData Collection Cleanup

```typescript
// Source: https://docs.oasis-open.org/odata/odata-json-format/v4.01/os/odata-json-format-v4.01-os.html
function queryResponseToItems(response: IDataObject, itemIndex: number): INodeExecutionData[] {
  if (!Array.isArray(response.value)) {
    throw new Error('CAP Query response did not contain an OData value array.')
  }

  return response.value.map((record) => ({
    json: stripODataMetadata(record as IDataObject),
    pairedItem: { item: itemIndex },
  }))
}
```

### Continue-On-Fail Error Item

```typescript
// Source: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/
if (this.continueOnFail()) {
  returnData.push({
    json: {
      error: safeError.message,
      statusCode: safeError.statusCode,
      category: safeError.category,
    },
    pairedItem: { item: itemIndex },
  })
  continue
}
```

## Files Likely to Change

| File | Expected Change | Reason |
|------|-----------------|--------|
| `cap-n8n-node/credentials/SapCapApi.credentials.ts` | Add Basic Auth authentication behavior for credential test, tighten labels/descriptions, keep OAuth2 fields as scaffold, prevent secret leakage. | Credential test currently has request metadata but no explicit auth injection. [VERIFIED: cap-n8n-node/credentials/SapCapApi.credentials.ts; CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/] |
| `cap-n8n-node/nodes/SapCap/SapCap.node.ts` | Expose Query/Read only, add `loadOptions`, bind dynamic entity-set options, call shared helpers, remove or hide mutation fields. | Current node exposes Create/Delete/Update and uses string entity set. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts] |
| `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` | New helper for base URL/path normalization, authenticated CAP requests, and request-option construction. | Centralized transport prevents duplicate auth/error behavior. [ASSUMED] |
| `cap-n8n-node/nodes/SapCap/ODataMetadata.ts` | New helper to fetch/extract entity-set options from `$metadata` XML. | Metadata discovery needs testable logic outside UI property declarations. [ASSUMED] |
| `cap-n8n-node/nodes/SapCap/ODataResponse.ts` | New helper for `@odata.*` stripping, Query/Read item shaping, and sanitized error classification. | Response cleanup and error handling are cross-cutting across Query and Read. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |
| `test/smoke/package-boundaries.test.js` | Update smoke expectations from CRUD operation metadata to Phase 6 Query/Read metadata and dynamic entity loading. | Current smoke test expects `create`, `delete`, `query`, `read`, and `update`. [VERIFIED: test/smoke/package-boundaries.test.js] |
| `test/integration/n8n-node-read-operations.test.js` | Add fake-server integration tests for Basic Auth metadata test, load options, Query, Read, cleanup, error categories, and continue-on-fail. | Existing integration tests use deterministic fake HTTP server patterns. [VERIFIED: test/integration/n8n-webhook-runtime.test.js] |

## Integration-Test Strategy

Use Vitest integration tests and fake HTTP servers built with Node `http`, matching existing repo style. [VERIFIED: test/integration/n8n-webhook-runtime.test.js; VERIFIED: package.json] The primary command should build the n8n node before importing `dist` modules, then run the targeted integration file. [VERIFIED: cap-n8n-node/package.json; VERIFIED: test/smoke/package-boundaries.test.js]

```bash
npm run build --workspace n8n-nodes-sap-cap
npx vitest run test/integration/n8n-node-read-operations.test.js
npm test
```

Recommended integration cases:

| Case | Fake Server Behavior | Expected Assertion |
|------|----------------------|--------------------|
| Basic Auth credential metadata GET | Return 200 XML only when `Authorization` is Basic for configured username/password. | Credential/load-options request path sends auth and never exposes the auth header in failures. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/] |
| Metadata entity discovery | Return CSDL XML with `Books`, `Authors`, and `Genres` entity sets. | `getEntitySets` returns n8n option objects with stable name/value pairs. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/; CITED: https://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/cs02/odata-csdl-xml-v4.01-cs02.html] |
| Metadata unavailable | Return 500 or invalid XML. | Dynamic dropdown path throws a concise sanitized error, and manual entity-set mode remains available. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |
| Query request construction | Capture `/odata/v4/admin/Books?$filter=...&$orderby=...&$select=...&$top=...&$skip=...`. | Query mode sends raw OData controls and preserves `$top=0`/`$skip=0` behavior when configured. [CITED: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html; VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts] |
| Query response cleanup | Return `{ "@odata.context": "...", "value": [{ "@odata.etag": "x", "ID": 201, "title": "Book" }] }`. | Node returns one item per row with `{ ID, title }` and `pairedItem`. [CITED: https://docs.oasis-open.org/odata/odata-json-format/v4.01/os/odata-json-format-v4.01-os.html; CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-execute-method/] |
| Read request construction | Capture `/odata/v4/admin/Books(ID=201,IsActiveEntity=true)`. | Read mode wraps missing parentheses and preserves predicate syntax. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |
| Read response cleanup | Return one entity object with `@odata.context` and normal fields. | Node returns exactly one cleaned n8n item. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |
| Read 404 | Return HTTP 404. | Node throws sanitized not-found `NodeOperationError` when `continueOnFail()` is false. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/] |
| Error categories | Return 400, 401, 403, 404, and 500 responses with bodies containing fake secrets. | Error objects have `{ statusCode, category }` and serialized errors do not include fake secrets, auth header, or full response body. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |
| `continueOnFail()` | Mock execution context returns true and fake server returns 400 or 404. | Output includes `{ error, statusCode, category }` with `pairedItem`, and execution continues. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/] |

Do not require live Docker n8n for the Phase 6 gate because this phase is testing the community-node code paths, not n8n workflow import/runtime infrastructure. [ASSUMED] Docker is available locally, but fake servers provide deterministic coverage and avoid hidden n8n editor state. [VERIFIED: environment probe; VERIFIED: test/integration/n8n-webhook-runtime.test.js]

## Edge Cases to Cover

- Base URL with trailing slash and service path with leading/trailing slashes should produce one valid URL without double slashes after the host. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]
- Metadata path defaults to `/odata/v4/admin/$metadata`; CAP docs show OData V4 metadata paths under `/odata/v4/{path}/$metadata`. [VERIFIED: cap-n8n-node/credentials/SapCapApi.credentials.ts; CITED: https://cap.cloud.sap/docs/advanced/odata]
- Metadata XML can use namespace prefixes such as `edmx:` and `edm:`; extractor tests should not depend on a prefix-free XML document. [CITED: https://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/cs02/odata-csdl-xml-v4.01-cs02.html; ASSUMED]
- Entity set names loaded from metadata should be treated as names, not arbitrary URL paths; manual fallback should reject empty strings and obvious path/query delimiters. [ASSUMED]
- `$filter`, `$orderby`, and `$select` are raw OData text fields, so the node should not parse or validate expression grammar in Phase 6. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]
- `$top` and `$skip` should be nonnegative integers; `0` should not disappear due falsey checks. [ASSUMED; VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]
- Query response without a `value` array should be classified as an unexpected CAP/OData response shape, not silently returned as one item. [CITED: https://docs.oasis-open.org/odata/odata-json-format/v4.01/os/odata-json-format-v4.01-os.html; ASSUMED]
- Read response arrays should be rejected as unexpected response shape because Read expects one entity object. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; ASSUMED]
- Recursive cleanup should remove nested `@odata.*` fields while preserving normal CAP fields and non-OData custom fields. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; ASSUMED]
- 401 and 403 should be auth/authorization category; 404 should be not-found only for Read; 400 should be validation/query; 5xx should be CAP/server. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `this.helpers.request` | `this.helpers.httpRequest` and `this.helpers.httpRequestWithAuthentication` | n8n docs state the previous helper was removed in n8n version 1. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/http-helpers/] | Use `httpRequestWithAuthentication` where possible and avoid `request-promise` era APIs. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/http-helpers/] |
| Static node option lists | `methods.loadOptions` for service-backed choices | Current n8n programmatic-style docs expose `methods.loadOptions`. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/] | Entity sets should load from `$metadata` at design time. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |
| Raw OData wrapper output | Plain n8n items with paired item metadata | Current n8n execute docs require item output and paired-item information. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-execute-method/] | Query should unwrap `value`, Read should return the object, and both should include `pairedItem`. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |
| Raw HTTP errors | `NodeApiError`/`NodeOperationError` and continue-on-fail items | Current n8n error docs describe specialized error classes and continue-on-fail pattern. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/] | Phase 6 should sanitize errors before throwing or returning item errors. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |

**Deprecated/outdated:**

- Do not use `this.helpers.request`; n8n docs mark the previous request helper as deprecated/removed in favor of newer HTTP helpers. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/http-helpers/]
- Do not use the current visible Create/Update/Delete options as acceptance evidence for Phase 6; those operations are deferred. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A targeted XML extractor for CSDL `EntitySet` names is sufficient without adding a parser package in Phase 6. | Standard Stack, Architecture Patterns, Edge Cases | Metadata parsing may fail against valid CAP metadata variants; planner may need a checkpoint to add a vetted XML parser. |
| A2 | Manual entity-set fallback via an explicit `entitySelectionMode` plus `entitySetManual` string is acceptable n8n UX for D-08. | Architecture Patterns | Planner may need to choose a different n8n-native fallback if the editor UX is awkward. |
| A3 | Fake HTTP servers are sufficient Phase 6 integration evidence without live n8n editor runtime. | Integration-Test Strategy | Reviewer may require an additional live n8n smoke test later, likely Phase 8. |
| A4 | Non-Basic auth selections can be visible/scaffolded without becoming a full Phase 6 runtime gate. | Common Pitfalls | If supervisor interprets NODE-02 as fully working OAuth2, planner must add a larger OAuth2 implementation and integration-test slice. |

## Open Questions (RESOLVED)

1. **RESOLVED: Keep `n8n-workflow` pinned at 2.16.0 for Phase 6.**
   - Decision: Phase 6 will not upgrade to the npm `stable` tag 2.22.3. The plans rely on the existing workspace dependency and local type definitions, then verify compatibility through workspace build, smoke checks, and integration tests. [VERIFIED: cap-n8n-node/package.json; VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-02-PLAN.md]
   - Rationale: Dependency alignment is not required for the Phase 6 read-only slice, and a package upgrade would expand the phase beyond credential, metadata, Query, Read, cleanup, and error behavior. If implementation later proves an upgrade is required, the executor must stop for a package legitimacy and compatibility checkpoint rather than upgrading silently. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-01-PLAN.md; VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-02-PLAN.md]

2. **RESOLVED: Basic Auth is the Phase 6 success path; OAuth2 Client Credentials stays visible/scaffolded but non-blocking.**
   - Decision: Phase 6 acceptance requires Base URL, Metadata Path, Basic Auth credential behavior, and safe `$metadata` testing. OAuth2 Client Credentials fields remain visible in the credential UI, but deep OAuth2 behavior and exhaustive OAuth2 integration coverage do not block Phase 6. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-01-PLAN.md]
   - Rationale: This matches D-04, D-05, D-06, and D-09: Basic Auth must work first, OAuth2 should not be removed from the surface, and OAuth2-related errors must stay sanitized if a user selects it before full later-phase support. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-03-PLAN.md]

3. **RESOLVED: Use a targeted OData `$metadata` EntitySet extractor with no XML parser dependency in Phase 6.**
   - Decision: Metadata discovery will extract EntitySet names from CAP OData V4 CSDL XML with a small tested helper and fake-server integration coverage for namespace-prefix and failure cases. It will not add an XML parser package in Phase 6. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-01-PLAN.md]
   - Rationale: Phase 6 only needs entity-set options, not key parsing, action/function discovery, composite-key UI generation, or a general OData metadata SDK. If implementation shows the targeted extractor is insufficient, the executor must stop and request a package legitimacy checkpoint before introducing a parser dependency. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-01-PLAN.md]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | n8n node build/test, fake HTTP integration tests | Yes | v24.16.0 | None needed. [VERIFIED: environment probe] |
| npm | Workspace scripts and registry verification | Yes | 11.13.0 | None needed. [VERIFIED: environment probe] |
| Docker | Optional live n8n/local CAP evidence | Yes | Docker 29.5.2 | Fake HTTP tests for Phase 6 core gate. [VERIFIED: environment probe; VERIFIED: docker-compose.yml] |
| `cds` global CLI | Optional manual CAP server commands | No | - | Use repo-local `@sap/cds-dk` scripts or fake HTTP tests. [VERIFIED: environment probe; VERIFIED: package.json] |
| `n8n-node` global CLI | n8n node build if global | No | - | Use workspace `npm run build --workspace n8n-nodes-sap-cap`. [VERIFIED: environment probe; VERIFIED: cap-n8n-node/package.json] |
| Context7 `ctx7` | Official library doc lookup fallback | No | - | Used official web docs and local type definitions. [VERIFIED: environment probe] |

**Missing dependencies with no fallback:** none for Phase 6 research/planning. [VERIFIED: environment probe]

**Missing dependencies with fallback:**

- Global `cds` is missing; use repo-local scripts or fake HTTP integration tests. [VERIFIED: environment probe; VERIFIED: package.json]
- Global `n8n-node` is missing; use the repo-local `@n8n/node-cli` workspace build script. [VERIFIED: environment probe; VERIFIED: cap-n8n-node/package.json]
- Context7 CLI is missing; official n8n, SAP CAP, and OData docs were checked directly. [VERIFIED: environment probe; CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/; CITED: https://cap.cloud.sap/docs/advanced/odata; CITED: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Store username/password/client credentials in n8n credentials and inject auth through n8n credential mechanisms or one sanitized helper. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/] |
| V3 Session Management | no | Phase 6 does not create application sessions; requests are stateless outbound CAP OData calls from n8n. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts] |
| V4 Access Control | yes | CAP service owns authorization; n8n node must classify 401/403 without bypassing CAP. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |
| V5 Input Validation | yes | Validate base URL, service path, metadata path, entity-set presence, manual key predicate presence, and nonnegative `$top`/`$skip`; do not parse raw OData expressions in Phase 6. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; ASSUMED] |
| V6 Cryptography | yes | Do not implement custom crypto; require HTTPS for remote CAP services in guidance and never log Basic/Bearer credentials. [VERIFIED: AGENTS.md; ASSUMED] |

### Known Threat Patterns for n8n CAP OData Node

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential disclosure through errors/logs | Information Disclosure | Sanitize raw HTTP errors, never serialize `Authorization`, passwords, bearer tokens, client secrets, or full response bodies. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md] |
| SSRF-like misuse of user-configured Base URL | Tampering/Elevation of Privilege | Validate URL scheme as `http` or `https`, reject empty/invalid URLs, and rely on n8n credential ownership/admin controls for who can configure endpoints. [ASSUMED] |
| OData query abuse through raw `$filter` | Tampering | Keep raw fields intentional and documented; send them as query parameters instead of concatenating arbitrary query strings; do not add write operations in Phase 6. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; CITED: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html] |
| XML entity expansion or external entity loading | Denial of Service/Information Disclosure | If using a parser package later, disable external entities; if using a targeted extractor, do not resolve external entities. [ASSUMED] |
| False support claims for mutations | Tampering | Remove or hide Create/Update/Delete from Phase 6 visible operation metadata. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts] |

## Sources

### Primary (HIGH confidence)

- `cap-n8n-node/credentials/SapCapApi.credentials.ts` - existing credential fields and current `$metadata` test request. [VERIFIED: codebase grep]
- `cap-n8n-node/nodes/SapCap/SapCap.node.ts` - existing Query/Read/mutation skeleton, response cleanup, manual auth helper, and error handling. [VERIFIED: codebase grep]
- `test/integration/n8n-webhook-runtime.test.js` - existing fake HTTP server integration-test pattern. [VERIFIED: codebase grep]
- `test/smoke/package-boundaries.test.js` - existing n8n package-boundary smoke expectations. [VERIFIED: codebase grep]
- `node_modules/n8n-workflow/dist/esm/interfaces.d.ts` and `node_modules/n8n-workflow/dist/esm/errors/node-operation.error.d.ts` - local n8n type definitions for `httpRequestWithAuthentication`, `ILoadOptionsFunctions`, `loadOptionsMethod`, `continueOnFail`, and `NodeOperationError`. [VERIFIED: codebase grep]
- n8n credentials docs - credential `authenticate` and `test` properties. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/]
- n8n programmatic parameters docs - `methods.loadOptions`. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-parameters/]
- n8n execute docs - programmatic `execute()` returns `INodeExecutionData` and should include paired items. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-execute-method/]
- n8n HTTP helpers docs - `httpRequestWithAuthentication` and current HTTP request options. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/http-helpers/]
- n8n error handling docs - `NodeApiError`, `NodeOperationError`, and continue-on-fail pattern. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/]
- SAP CAP OData docs - OData V4 metadata URL examples and JSON collection response example. [CITED: https://cap.cloud.sap/docs/advanced/odata]
- OASIS OData URL Conventions 4.01 - query options and key predicate semantics. [CITED: https://docs.oasis-open.org/odata/odata/v4.01/os/part2-url-conventions/odata-v4.01-os-part2-url-conventions.html]
- OASIS OData JSON Format 4.01 - collection `value` arrays and control information. [CITED: https://docs.oasis-open.org/odata/odata-json-format/v4.01/os/odata-json-format-v4.01-os.html]
- OASIS OData CSDL XML 4.01 - metadata entity container/entity set model. [CITED: https://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/cs02/odata-csdl-xml-v4.01-cs02.html]

### Secondary (MEDIUM confidence)

- npm registry metadata for `@n8n/node-cli`, `n8n-workflow`, `typescript`, `vitest`, `@sap/cds`, and `@cap-js/sqlite`. [VERIFIED: npm registry]
- npm downloads API for last-week package download counts. [VERIFIED: npm downloads API]
- slopcheck 0.6.1 output for existing dependency legitimacy. [VERIFIED: slopcheck]

### Tertiary (LOW confidence)

- Assumptions about targeted metadata extraction, manual fallback UX, and fake-server sufficiency are recorded in the Assumptions Log. [ASSUMED]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - package versions, local scripts, local typings, npm registry metadata, and slopcheck output were verified. [VERIFIED: cap-n8n-node/package.json; VERIFIED: npm registry; VERIFIED: slopcheck]
- Architecture: HIGH - phase scope, current skeleton, and n8n/CAP/OData docs align on credential test, load options, GET reads, and response cleanup. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/; CITED: https://cap.cloud.sap/docs/advanced/odata]
- Pitfalls: MEDIUM - most risks are visible in current code, but metadata parser edge cases and OAuth2 scaffold interpretation need planner/user confirmation. [VERIFIED: cap-n8n-node/nodes/SapCap/SapCap.node.ts; ASSUMED]
- Security: HIGH for secret-sanitization requirement, MEDIUM for SSRF/XML parser mitigations because final implementation choice is pending. [VERIFIED: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-CONTEXT.md; ASSUMED]

**Research date:** 2026-06-03
**Valid until:** 2026-06-10 for n8n package/API details, 2026-07-03 for OData/CAP pattern guidance.
