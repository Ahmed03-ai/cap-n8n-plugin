# Phase 05: workflow-import-and-build-validation - Research

**Researched:** 2026-06-03 [VERIFIED: current_date]
**Domain:** SAP CAP build validation, n8n workflow import, deterministic generated workflow artifacts [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]
**Confidence:** MEDIUM-HIGH [VERIFIED: official SAP CAP docs, official n8n docs, local codebase inspection]

<user_constraints>
## User Constraints (from CONTEXT.md)

The following constraints are copied from `.planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md`. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

### Locked Decisions

## Decisions

### D-01: Sidecar schema is the primary typed input source

Accepted. n8n workflow JSON can reveal webhook nodes and paths, but it is not trusted to fully describe required body fields or CAP scalar types. Phase 5 import will support a workflow input sidecar schema as the authoritative source for typed workflow inputs.

### D-02: Sidecar file lives beside the sanitized workflow artifact

Accepted. The sidecar JSON should be committed beside the sanitized workflow JSON artifact so reviewers can inspect the local workflow contract without needing n8n access.

### D-03: Initial sidecar schema supports a conservative scalar subset

Accepted. Phase 5 supports only scalar inputs:
- `String`
- `Integer`
- `Decimal`
- `Boolean`
- `Date`
- `DateTime`
- `JSON`

The sidecar also supports required/optional metadata.

### D-04: Full JSON Schema is deferred

Accepted. No nested object validation, arrays, enum validation, or full JSON Schema compatibility is required in Phase 5.

### D-05: Missing sidecar produces untyped import warning, not hard failure

Accepted. Import can still create a sanitized local workflow artifact if no sidecar is provided. The generated/imported workflow is treated as untyped, and build validation emits warnings for references to it instead of blocking the build.

### D-06: Generated artifacts live in the consuming CAP app

Accepted. Workflow artifacts belong inside the CAP app that imports/uses the workflows, not in the reusable plugin package by default.

### D-07: Use an app-root `n8n/` artifact directory

Accepted. The preferred layout is an `n8n/` directory at the consuming CAP app root, for example `demo-app/n8n/...`.

### D-08: Commit generated workflow JSON, sidecar schema, manifest, and generated CDS

Accepted. Phase 5 should produce reviewable local artifacts:
- sanitized workflow JSON
- sidecar input schema JSON
- workflow manifest/provenance JSON
- generated CDS types/model file

### D-09: Workflow keys are stable local identifiers, not raw n8n IDs

Accepted. Local artifact folder names and generated type names should use a stable workflow key. The manifest can record source n8n IDs, workflow names, webhook paths, source type, and provenance separately.

### D-10: Sanitization must remove secrets and instance metadata

Accepted. Sanitized workflow JSON must avoid committing credentials, owners, project metadata, personal emails, runtime version counters, and other instance-specific metadata.

### D-11: Use a package CLI, not deep `cds import --from n8n` first

Accepted. Phase 5 should expose import/validation through a package CLI with npm script wrapper support. Deep CAP CLI extension such as `cds import --from n8n` can be deferred.

### D-12: Local import defaults to one selected workflow; `--all` is explicit

Accepted. Importing all workflows from a local export should require an explicit `--all` option, except when the export contains exactly one workflow and auto-selection is unambiguous.

### D-13: Local one-workflow export can auto-select

Accepted. If the local n8n export contains exactly one workflow, import may select it automatically without requiring an ID/name argument.

### D-14: Live import defaults to one selected workflow; `--all` is explicit

Accepted. Live import should fetch one selected workflow by ID/key by default. Bulk live import requires explicit `--all`.

### D-15: Live import reads credentials from CAP config/env by default

Accepted. Live import should use CAP/n8n configuration and environment-backed credentials by default. CLI overrides for routing/showcase are acceptable, but secrets should remain env/config based, not literal CLI arguments.

### D-16: Typed artifact validation is strict for missing required inputs and type mismatches

Accepted. If a workflow has a sidecar/generated typed contract, missing required inputs and incompatible CAP scalar mappings are build errors.

### D-17: Extra annotated inputs are warnings

Accepted. If a CAP annotation maps more inputs than the typed workflow contract declares, validation should warn, not fail.

### D-18: Workflow references without generated schema/artifact warn, not fail

Accepted. Untyped or unknown workflow references should produce warnings to support incremental adoption.

### D-19: Type compatibility is conservative

Accepted. Only obvious CAP scalar compatibility should pass automatically. Ambiguous mappings should warn or error according to whether the target workflow input is typed/required.

### D-20: Validation runs both during CAP build and via direct CLI

Accepted. Phase 5 should support validation through CAP build integration and a direct package CLI command such as `cap-n8n validate --app demo-app`.

### the agent's Discretion

## the agent's Discretion

The agent should decide:

1. Exact CLI command names and npm script names.
2. Exact generated subfolder shape under `n8n/`.
3. Exact warning/error wording.

### Deferred Ideas (OUT OF SCOPE)

## Deferred Ideas

Out of scope for Phase 5:

1. Full JSON Schema validation.
2. Association expansion in workflow input mappings.
3. n8n node operations for CAP query/create/update/delete.
4. Visual demo/mockup updates for the n8n node.
5. Production packaging/release docs beyond what is needed for local import/build validation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-01 | Local offline workflow JSON import. [VERIFIED: .planning/REQUIREMENTS.md] | Use a package CLI that reads n8n export arrays or single workflow objects from disk, selects one workflow by default when unambiguous, and writes app-local artifacts. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| IMPORT-02 | Live n8n import with credentials. [VERIFIED: .planning/REQUIREMENTS.md] | Use n8n public API workflow endpoints with `X-N8N-API-KEY`, reading credentials from CAP config/env and testing through a fake HTTP server. [CITED: https://docs.n8n.io/api/authentication/] [CITED: https://docs.n8n.io/api/api-reference/] |
| IMPORT-03 | Generated CDS typed workflow inputs. [VERIFIED: .planning/REQUIREMENTS.md] | Generate compile-tested CDS types from sidecar scalar schemas and include the generated model in the consuming CAP app. [CITED: https://cap.cloud.sap/docs/cds/types] [CITED: https://cap.cloud.sap/docs/node.js/cds-connect] |
| IMPORT-04 | Deterministic sanitized local layout. [VERIFIED: .planning/REQUIREMENTS.md] | Store sanitized workflow JSON, schema JSON, manifest JSON, and generated CDS under app-root `n8n/`, with stable local workflow keys and sorted JSON output. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| IMPORT-05 | `cds build` validates trigger annotations against generated input definitions. [VERIFIED: .planning/REQUIREMENTS.md] | Register a CAP build plugin from the package `cds-plugin.js`, load CSN through CAP build, and call the shared validator. [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds] |
| IMPORT-06 | Clear errors for missing inputs and type mismatches. [VERIFIED: .planning/REQUIREMENTS.md] | Build plugin must push diagnostic messages and throw `BuildError` when errors exist, because local CAP build source shows messages alone are not enough to guarantee build failure. [VERIFIED: local @sap/cds-dk 9.9.1 source] |
| IMPORT-07 | Warnings for extra inputs or untyped workflow references. [VERIFIED: .planning/REQUIREMENTS.md] | Validator should classify extra mapped fields and missing generated schema/artifacts as warnings so adoption can be incremental. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| VERIFY-03 | Integration tests for import/build validation. [VERIFIED: .planning/REQUIREMENTS.md] | Use existing Vitest integration patterns, temp CAP apps, fixture workflow JSON, and fake HTTP servers instead of requiring a real n8n instance in automated tests. [VERIFIED: test/integration/*.test.js] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Use JavaScript CommonJS, SAP CAP, CDS/CDL, npm workspaces, Docker Compose, and n8n community-node conventions already present in the repository. [VERIFIED: AGENTS.md]
- Use Node.js 20+ because the locked `@sap/cds` dependency requires `node >=20`. [VERIFIED: AGENTS.md] [VERIFIED: package-lock.json]
- Use integration-test wording and integration-test planning, not unit-test framing, because supervisor feedback requires it. [VERIFIED: AGENTS.md]
- Keep secrets in environment configuration; generated docs and fixtures must not commit API keys, private keys, or real production credentials. [VERIFIED: AGENTS.md]
- Reusable behavior belongs in `cap-n8n-plugin` and `cap-n8n-node`, not only in `demo-app`. [VERIFIED: AGENTS.md]
- Match local JavaScript style: CommonJS, two-space indentation, single quotes, and mostly no semicolons in `cap-n8n-plugin/lib/**`. [VERIFIED: AGENTS.md] [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js]
- Use `cds.log('n8n')` for runtime logging and avoid new `console.*` logging in source. [VERIFIED: AGENTS.md] [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js]
- Do not read or commit `.env`; `.gitignore` excludes `.env` and `.n8n-data/`. [VERIFIED: .gitignore]

## Summary

Phase 5 should be planned as a package-owned import/generation/validation system, not as demo-app glue. [VERIFIED: AGENTS.md] The narrow path is a CommonJS `cap-n8n` CLI in `cap-n8n-plugin`, shared import/sanitize/generate/validate modules under `cap-n8n-plugin/lib/workflows/`, and a CAP build plugin registered from the existing package `cds-plugin.js`. [VERIFIED: cap-n8n-plugin/cds-plugin.js] [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds]

n8n workflow JSON can identify webhook nodes, webhook paths, and source workflow metadata, but the locked decision is that typed input contracts come from a sidecar schema, not from inferred n8n node configuration. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] Official n8n docs confirm API-key authentication uses the `X-N8N-API-KEY` header and workflow endpoints exist in the public API, while workflow export/import docs warn that exported workflows can carry credential references that need careful handling. [CITED: https://docs.n8n.io/api/authentication/] [CITED: https://docs.n8n.io/api/api-reference/] [CITED: https://docs.n8n.io/workflows/export-import/]

The highest planning risk is CAP build integration. [VERIFIED: local @sap/cds-dk 9.9.1 source] CAP build plugins can push messages, but local `@sap/cds-dk` source inspection shows build failure should be forced by throwing a `BuildError` when validation errors exist. [VERIFIED: local @sap/cds-dk 9.9.1 source] The validator should therefore be a shared module used by both the build plugin and `cap-n8n validate --app demo-app`, with one diagnostic model for errors and warnings. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**Primary recommendation:** Build a package CLI plus shared validator, write deterministic app-root `n8n/` artifacts, register a CAP build plugin, and use Vitest integration tests with temp CAP apps and fake n8n HTTP servers; do not add new external packages for Phase 5. [VERIFIED: package.json] [VERIFIED: test/integration/*.test.js]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Local workflow import | CAP plugin/package CLI | Filesystem | Import is developer tooling owned by `cap-n8n-plugin`, while workflow JSON is read from local files. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Live workflow import | CAP plugin/package CLI | n8n public API | CLI fetches workflow definitions, and n8n API supplies workflow data through authenticated HTTP. [CITED: https://docs.n8n.io/api/authentication/] [CITED: https://docs.n8n.io/api/api-reference/] |
| Sanitized artifacts | Consuming CAP app filesystem | CAP plugin generator | Locked decisions place artifacts under the app-root `n8n/` directory, generated by package tooling. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Generated CDS input types | Consuming CAP app model | CAP plugin generator | Generated CDS must be part of the app model so `cds build` and annotation validation see the same contracts. [CITED: https://cap.cloud.sap/docs/node.js/cds-connect] |
| Build validation | CAP build plugin | Shared validator module | CAP build owns build-time diagnostics; the shared validator keeps CLI and build behavior identical. [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds] |
| Annotation interpretation | Existing Phase 4 annotation parser | CAP CSN model | Phase 4 already parses `@n8n.workflow.start` and produces scalar mapping metadata from CSN. [VERIFIED: cap-n8n-plugin/lib/annotations/AnnotationParser.js] |
| Integration-test execution | Repo Vitest harness | Fake HTTP server / temp CAP app | Existing tests already use Vitest, temp CAP services, and fake HTTP servers for n8n behavior. [VERIFIED: test/integration/*.test.js] |

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Node.js | Local `v24.16.0`; project requires `>=20`. [VERIFIED: local environment] [VERIFIED: package-lock.json] | Runs CLI, CAP build plugins, tests, and global `fetch`. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] | Node 20+ satisfies locked CAP dependency and supports built-in Fetch. [VERIFIED: package-lock.json] |
| `@sap/cds` | Locked `9.9.1`; npm latest checked as `9.9.1` on 2026-06-03. [VERIFIED: npm registry] | CAP services, CDS compilation, CSN loading, plugin runtime. [VERIFIED: package-lock.json] | Existing runtime dependency and the API used by service/plugin code. [VERIFIED: cap-n8n-plugin/cds-plugin.js] |
| `@sap/cds-dk` | Local `9.9.1`; npm latest checked as `9.9.2` on 2026-06-03. [VERIFIED: local environment] [VERIFIED: npm registry] | `cds build`, `cds compile`, build plugin host. [VERIFIED: local cds-dk 9.9.1 CLI] | CAP official custom-build docs define build plugins through `cds.build.Plugin` and `cds.build.register()`. [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds] |
| CAP CDS / CSN | Compiler `6.9.2` through local `@sap/cds-dk`. [VERIFIED: local environment] | Represents generated workflow input types and existing annotations. [VERIFIED: cap-n8n-plugin/lib/annotations/AnnotationParser.js] | Phase 4 parser already operates on CSN instead of raw CDS text. [VERIFIED: cap-n8n-plugin/lib/annotations/AnnotationParser.js] |
| n8n public API | Docker image pinned `n8nio/n8n:2.22.5`; npm `n8n` latest checked as `2.23.2` on 2026-06-03. [VERIFIED: docker-compose.yml] [VERIFIED: npm registry] | Live workflow fetch by ID or list. [CITED: https://docs.n8n.io/api/api-reference/] | Official API supports authenticated workflow operations; tests can fake the HTTP surface. [CITED: https://docs.n8n.io/api/authentication/] |
| Vitest | Local `4.1.7`; npm latest checked as `4.1.8` on 2026-06-03. [VERIFIED: local environment] [VERIFIED: npm registry] | Integration tests for CLI, live fetch, generated CDS, and build diagnostics. [VERIFIED: package.json] | Existing repo test suite already uses Vitest integration tests. [VERIFIED: test/integration/*.test.js] |
| Node `http` module | Built into Node.js. [VERIFIED: local environment] | Fake n8n public API server in tests. [VERIFIED: test/integration/n8n-start-integration.test.js] | Avoids new mocking dependencies and keeps live-import tests offline. [VERIFIED: test/integration/*.test.js] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Docker Compose | Docker `29.5.2`; Compose `v5.1.4`. [VERIFIED: local environment] | Manual local n8n runtime and fixture import/export scripts. [VERIFIED: docker-compose.yml] [VERIFIED: package.json] | Use for manual verification, not mandatory automated tests. [VERIFIED: test/integration/*.test.js] |
| `@cap-js/sqlite` | Locked `2.4.0`; npm latest checked as `2.4.0` on 2026-06-03. [VERIFIED: package-lock.json] [VERIFIED: npm registry] | CAP integration tests with in-memory SQLite. [VERIFIED: test/integration/*.test.js] | Existing integration tests deploy CAP models to `sqlite::memory:`. [VERIFIED: test/integration/n8n-annotations-demo.test.js] |
| Root npm workspaces | `demo-app`, `cap-n8n-plugin`, `cap-n8n-node`. [VERIFIED: package.json] | CLI exposure and scripts across packages. [VERIFIED: package.json] | Add script wrappers at root/demo-app only after package CLI exists. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Package CLI | Deep `cds import --from n8n` extension | Deferred by locked decision; package CLI is the Phase 5 target. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Sidecar scalar schema | Infer required inputs from n8n workflow JSON | Rejected because n8n workflow JSON is not trusted as the typed input source. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Scalar subset | Full JSON Schema | Deferred by locked decision; full schema support would expand validation scope. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| n8n public API with `fetch` | Installing or shelling out to a host n8n CLI | Public API is documented and existing Node runtime has `fetch`; host n8n CLI is not installed locally. [CITED: https://docs.n8n.io/api/api-reference/] [VERIFIED: local environment] |
| Shared validator | Separate build and CLI validators | Separate validators would create inconsistent diagnostics; locked decision requires both build and direct CLI validation. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |

**Installation:**

```bash
# No new external packages are recommended for Phase 5.
npm install
```

**Version verification:** Recommended stack versions were checked with local CLI probes and ecosystem registry commands on 2026-06-03. [VERIFIED: local environment] [VERIFIED: npm registry]

## Package Legitimacy Audit

No new external packages are recommended for Phase 5, so the package legitimacy gate has no new install candidates to approve or reject. [VERIFIED: package.json]

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@sap/cds` | npm | Existing dependency created in 2020. [VERIFIED: npm registry] | Not required for no-new-package decision. [VERIFIED: package.json] | SAP package used by existing code. [VERIFIED: package-lock.json] | Not run because no new install is recommended. [VERIFIED: package.json] | Existing dependency retained. [VERIFIED: package-lock.json] |
| `@sap/cds-dk` | npm | Existing dev dependency created in 2020. [VERIFIED: npm registry] | Not required for no-new-package decision. [VERIFIED: package.json] | SAP package used by existing scripts. [VERIFIED: package.json] | Not run because no new install is recommended. [VERIFIED: package.json] | Existing dependency retained. [VERIFIED: package.json] |
| `vitest` | npm | Existing dev dependency created in 2021. [VERIFIED: npm registry] | Not required for no-new-package decision. [VERIFIED: package.json] | Existing test framework. [VERIFIED: package.json] | Not run because no new install is recommended. [VERIFIED: package.json] | Existing dependency retained. [VERIFIED: package.json] |

**Packages removed due to slopcheck [SLOP] verdict:** none; no new packages are proposed. [VERIFIED: package.json]

**Packages flagged as suspicious [SUS]:** none; no new packages are proposed. [VERIFIED: package.json]

## Architecture Patterns

### System Architecture Diagram

```text
Local JSON file or n8n Public API
        |
        v
cap-n8n import CLI
        |
        +--> select one workflow or explicit --all
        |
        +--> sanitize workflow JSON
        |        |
        |        v
        |   app-root n8n/workflows/<workflow-key>/workflow.json
        |
        +--> copy or create sidecar schema
        |        |
        |        v
        |   app-root n8n/workflows/<workflow-key>/schema.json
        |
        +--> write provenance manifest
        |        |
        |        v
        |   app-root n8n/manifest.json and per-workflow manifest.json
        |
        +--> generate CDS input types
                 |
                 v
            app-root n8n/index.cds
                 |
                 v
CAP build plugin loads app CSN + generated n8n model
                 |
                 v
Existing Phase 4 annotation parser reads @n8n.workflow.start
                 |
                 v
Shared validator compares annotation inputs to sidecar contracts
        |                         |
        v                         v
Warnings: extra/untyped      Errors: missing required/type mismatch
        |                         |
        +-----------> cds build diagnostics / cap-n8n validate output
```

This diagram follows the locked Phase 5 flow from import source to generated artifacts to build-time validation. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

### Recommended Project Structure

```text
cap-n8n-plugin/
├── bin/
│   └── cap-n8n.js                 # package CLI entry point [ASSUMED]
├── lib/
│   ├── annotations/
│   │   └── AnnotationParser.js     # existing Phase 4 parser [VERIFIED: cap-n8n-plugin/lib/annotations/AnnotationParser.js]
│   └── workflows/
│       ├── cli.js                 # command dispatch [ASSUMED]
│       ├── import-local.js        # local JSON import [ASSUMED]
│       ├── import-live.js         # n8n API import [ASSUMED]
│       ├── sanitize.js            # deterministic sanitizer [ASSUMED]
│       ├── schema.js              # sidecar parsing and scalar normalization [ASSUMED]
│       ├── generate-cds.js        # generated CDS writer [ASSUMED]
│       ├── validate.js            # shared validation engine [ASSUMED]
│       └── BuildValidationPlugin.js # CAP build plugin [ASSUMED]
└── cds-plugin.js                  # registers runtime hooks and build plugin [VERIFIED: cap-n8n-plugin/cds-plugin.js]

demo-app/
└── n8n/
    ├── manifest.json
    ├── index.cds
    └── workflows/
        └── cap-test-trigger/
            ├── workflow.json
            ├── schema.json
            └── manifest.json
```

The `cap-n8n-plugin/lib/workflows/**` filenames are recommended planning names, not existing files. [ASSUMED]

### Pattern 1: Package CLI With App-Root Output

**What:** Add a `bin` entry in `cap-n8n-plugin/package.json` that exposes `cap-n8n`, with commands such as `import local`, `import live`, and `validate`. [ASSUMED]

**When to use:** Use this for all Phase 5 workflow import and direct validation work, because the locked decision defers deep `cds import --from n8n` extension. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**Example:**

```bash
cap-n8n import local --app demo-app --file test-workflows/workflows.json --workflow cap-test-trigger --schema demo-app/n8n/workflows/cap-test-trigger/schema.json
cap-n8n import live --app demo-app --workflow xS2pbMEOrVWMxiT0
cap-n8n validate --app demo-app
```

These command names are recommended under the agent's discretion and must be implemented as CommonJS package CLI commands. [ASSUMED] [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

### Pattern 2: Deterministic Workflow Artifact Layout

**What:** Store each workflow under a stable local workflow key and keep source IDs, names, webhook paths, and provenance in manifests. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**When to use:** Use for both local and live imports so committed artifacts have the same shape regardless of source. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**Example manifest:**

```json
{
  "schemaVersion": 1,
  "workflows": {
    "cap-test-trigger": {
      "workflowKey": "cap-test-trigger",
      "sourceType": "local",
      "sourceWorkflowId": "xS2pbMEOrVWMxiT0",
      "sourceWorkflowName": "CAP n8n Test",
      "webhookPath": "cap-test-trigger",
      "acceptedReferences": [
        "cap-test-trigger",
        "webhook/cap-test-trigger",
        "webhook-test/cap-test-trigger",
        "xS2pbMEOrVWMxiT0"
      ],
      "workflowPath": "workflows/cap-test-trigger/workflow.json",
      "schemaPath": "workflows/cap-test-trigger/schema.json",
      "cdsType": "CapTestTriggerInputs"
    }
  }
}
```

The accepted reference list should include the current demo annotation form `webhook-test/cap-test-trigger` so Phase 5 validation works with Phase 4 artifacts. [VERIFIED: demo-app/srv/admin-service.cds]

### Pattern 3: Sidecar Schema as Typed Contract

**What:** Use sidecar JSON to declare workflow input names, scalar types, and required flags. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**When to use:** Use whenever a workflow should participate in strict build validation. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**Example sidecar:**

```json
{
  "schemaVersion": 1,
  "workflowKey": "cap-test-trigger",
  "inputs": {
    "bookId": { "type": "Integer", "required": true },
    "title": { "type": "String", "required": true },
    "event": { "type": "JSON", "required": false }
  }
}
```

`event` should be treated specially because the Phase 4 payload builder appends event metadata to every workflow payload. [VERIFIED: cap-n8n-plugin/lib/annotations/PayloadBuilder.js]

### Pattern 4: Generated CDS Model

**What:** Generate an app-local CDS file from sidecar schemas so workflow input types and workflow-specific action signatures are reviewable and compile-checked. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**When to use:** Generate or update `demo-app/n8n/index.cds` after every successful import. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**Example CDS shape:**

```cds
namespace cap.n8n.generated;

type CapTestTriggerInputs {
  bookId : Integer;
  title  : String;
  event  : LargeString;
};

service WorkflowInputContracts {
  action capTestTrigger(inputs : CapTestTriggerInputs) returns Boolean;
}
```

The resolved Phase 5 contract uses `namespace cap.n8n.workflows`, one `<PascalWorkflowKey>Inputs` type per typed sidecar, and one `WorkflowInputContracts` service action per typed workflow. `JSON` sidecar inputs map to `LargeString` in generated CDS while remaining `JSON` in schema metadata for validator behavior. The generated actions are compile-time contracts for typed workflow inputs; workflow execution still uses the existing `N8nWorkflowService` runtime surface from prior phases. [CITED: https://cap.cloud.sap/docs/cds/types] [VERIFIED: cap-n8n-plugin/index.cds]

### Pattern 5: CAP Build Plugin Registration

**What:** Register a build plugin from package bootstrap when `cds.build.register` is available. [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds]

**When to use:** Use during `cds build` so Phase 5 errors and warnings appear in CAP's normal build path. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**Example:**

```js
const cds = require('@sap/cds')

if (cds.build?.register) {
  cds.build.register(
    'cap-n8n-validation',
    require('./lib/workflows/BuildValidationPlugin')
  )
}
```

CAP official docs show build plugins can be registered with `cds.build.register()` and can extend `cds.build.Plugin`. [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds]

### Pattern 6: Build Plugin Diagnostics Must Throw on Errors

**What:** Push warnings and errors for display, then throw a CAP build `BuildError` when validation errors exist. [VERIFIED: local @sap/cds-dk 9.9.1 source]

**When to use:** Use for missing required inputs and incompatible scalar mappings. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**Example:**

```js
class BuildValidationPlugin extends cds.build.Plugin {
  async build () {
    const result = await validateN8nWorkflows({ appRoot: this.task.src, model: await this.model() })

    for (const warning of result.warnings) {
      this.pushMessage(warning.message, this.constructor.WARNING)
    }

    if (result.errors.length) {
      for (const error of result.errors) {
        this.pushMessage(error.message, this.constructor.ERROR)
      }
      throw new cds.build.BuildError('cap-n8n workflow validation failed', result.errors)
    }
  }
}
```

This is a planning example; the final constructor signature should be verified against local `@sap/cds-dk` source during implementation. [VERIFIED: local @sap/cds-dk 9.9.1 source] [ASSUMED]

### Anti-Patterns to Avoid

- **Parsing CDS text with regex:** Use CAP CSN plus the existing Phase 4 annotation parser instead of text parsing. [VERIFIED: cap-n8n-plugin/lib/annotations/AnnotationParser.js]
- **Trusting raw n8n JSON for required input types:** The sidecar schema is the authoritative contract. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]
- **Writing generated artifacts into `cap-n8n-plugin`:** Artifacts belong in the consuming CAP app root under `n8n/`. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]
- **Failing build only by pushing an error message:** Local CAP build source indicates planner should require an explicit throw when validation errors exist. [VERIFIED: local @sap/cds-dk 9.9.1 source]
- **Using real n8n for every automated test:** Existing integration tests already demonstrate fake HTTP servers; live import can be tested offline with a fake public API. [VERIFIED: test/integration/*.test.js]
- **Accepting API keys as literal CLI flags:** Live import credentials should come from CAP config/env by default to avoid shell history and process-list leakage. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CAP annotation parsing | Custom CDS parser or regex scanner | CAP CSN plus `readWorkflowAnnotations` | Existing parser already validates Phase 4 annotation shape and scalar mappings. [VERIFIED: cap-n8n-plugin/lib/annotations/AnnotationParser.js] |
| Full workflow input schema engine | Full JSON Schema implementation | Locked scalar sidecar subset | Full JSON Schema is explicitly deferred. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Live n8n fetch transport | Shelling out to n8n CLI or installing host n8n packages | Built-in `fetch` against n8n public API | n8n API and API-key auth are official, and local host n8n CLI is unavailable. [CITED: https://docs.n8n.io/api/authentication/] [VERIFIED: local environment] |
| HTTP mocking dependency | New mock server package | Node built-in `http` fake server | Existing integration tests already use fake HTTP servers without new dependencies. [VERIFIED: test/integration/*.test.js] |
| Separate CLI/build validators | Two independent diagnostic paths | Shared `validate` module | Phase 5 requires both CAP build and direct CLI validation, so one validator prevents drift. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Secret scanner dependency | New dependency for Phase 5 | Deterministic JSON traversal with forbidden-key allowlist tests | No new package is needed for the required safety gate. [VERIFIED: package.json] |

**Key insight:** The hard part is not fetching workflows; it is making generated artifacts deterministic, safe to commit, and included in the CAP model that `cds build` actually validates. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] [VERIFIED: package.json]

## n8n Workflow Import Findings

### Export Shapes and Workflow Fields

- The current repo fixture `test-workflows/workflows.json` is an array containing one workflow object with fields including `id`, `name`, `nodes`, `connections`, `settings`, `pinData`, `staticData`, `versionId`, `versionCounter`, `shared`, and `versionMetadata`. [VERIFIED: test-workflows/workflows.json]
- The current fixture includes a webhook node with type `n8n-nodes-base.webhook`, `httpMethod: "POST"`, and `path: "cap-test-trigger"`. [VERIFIED: test-workflows/workflows.json]
- n8n's Webhook node documentation describes webhook path and HTTP method as node configuration used to build webhook URLs. [CITED: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/]
- n8n's CLI docs describe `export:workflow` and `import:workflow` commands for server-side workflow export/import, which aligns with existing root Docker Compose scripts. [CITED: https://docs.n8n.io/hosting/cli-commands/] [VERIFIED: package.json]

### Live Fetch

- n8n public API authentication uses an API key sent in the `X-N8N-API-KEY` header. [CITED: https://docs.n8n.io/api/authentication/]
- The n8n public API reference includes workflow retrieval/listing endpoints, so live import can fetch one workflow or all workflows without a host n8n CLI. [CITED: https://docs.n8n.io/api/api-reference/]
- The raw official OpenAPI document includes an `excludePinnedData` query option for workflow retrieval/listing, so live import should request pinned data exclusion and still sanitize output. [CITED: https://raw.githubusercontent.com/n8n-io/n8n-docs/main/docs/api/v1/openapi.yml]
- Live import should derive the API base from configured `baseUrl` by appending `/api/v1` unless an explicit API base override exists. [ASSUMED]

### Sanitization Rules

- Remove top-level instance/runtime metadata such as `createdAt`, `updatedAt`, `shared`, `versionId`, `activeVersionId`, `versionCounter`, `triggerCount`, `versionMetadata`, `meta`, `pinData`, `staticData`, `active`, and `isArchived` from committed workflow JSON. [VERIFIED: test-workflows/workflows.json] [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]
- Preserve workflow structure needed for review and replay, including sanitized `nodes`, `connections`, selected safe `settings`, node `type`, node `typeVersion`, webhook `parameters.path`, webhook `parameters.httpMethod`, and node positions. [VERIFIED: test-workflows/workflows.json] [CITED: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/] [ASSUMED]
- Remove node `credentials` objects and recursively remove keys that indicate secrets or personal identifiers, including credential, password, secret, token, api key, authorization, private key, client secret, and email patterns. [CITED: https://docs.n8n.io/workflows/export-import/] [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]
- Write JSON with stable object-key ordering and two-space formatting while preserving workflow array order. [ASSUMED]
- Record removed field paths in the manifest without recording secret values. [ASSUMED]

## Build Validation Findings

### Artifact-to-Annotation Matching

- Phase 4 annotations use `@n8n.workflow.start` with fields `workflowId`, `on`, `inputs`, `if`, `businessKey`, and `tag`. [VERIFIED: cap-n8n-plugin/lib/annotations/AnnotationParser.js]
- The current demo annotation references workflow ID `webhook-test/cap-test-trigger`, while the fixture webhook path is `cap-test-trigger`, so Phase 5 matching must support accepted aliases rather than exact folder-name equality only. [VERIFIED: demo-app/srv/admin-service.cds] [VERIFIED: test-workflows/workflows.json]
- The validator should build a lookup from `workflowKey`, `sourceWorkflowId`, `webhookPath`, `webhook/<path>`, and `webhook-test/<path>`. [ASSUMED]

### Diagnostic Rules

| Case | Diagnostic | Build Exit | Source |
|------|------------|------------|--------|
| Required schema input missing from annotation payload | Error | Non-zero | [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Mapped CAP field scalar is incompatible with schema type | Error | Non-zero | [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Annotation maps an input not declared in schema | Warning | Zero if no errors | [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Workflow reference has artifact but no sidecar schema | Warning | Zero if no errors | [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Workflow reference has no generated artifact | Warning | Zero if no errors | [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Sidecar contains unsupported type | Error during import or validation | Non-zero when validating | [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |

### Conservative Type Compatibility

| Sidecar Type | CAP Types That Should Pass | Notes |
|--------------|----------------------------|-------|
| `String` | `cds.String`, `cds.UUID`, `cds.LargeString` | CAP docs list string-like built-in types; planner should verify exact CSN type names in Wave 0. [CITED: https://cap.cloud.sap/docs/cds/types] [ASSUMED] |
| `Integer` | `cds.Integer`, `cds.Int16`, `cds.Int32`, `cds.Int64`, `cds.UInt8` | CAP docs list integer-family built-in types; use conservative exact matching. [CITED: https://cap.cloud.sap/docs/cds/types] [ASSUMED] |
| `Decimal` | `cds.Decimal`, integer-family types, `cds.Double` | Numeric widening is acceptable only for obvious numeric CAP scalars. [CITED: https://cap.cloud.sap/docs/cds/types] [ASSUMED] |
| `Boolean` | `cds.Boolean` | Exact scalar match. [CITED: https://cap.cloud.sap/docs/cds/types] |
| `Date` | `cds.Date` | Exact scalar match. [CITED: https://cap.cloud.sap/docs/cds/types] |
| `DateTime` | `cds.DateTime`, `cds.Timestamp` | CAP docs list temporal built-in types; planner should define whether `Timestamp` is accepted. [CITED: https://cap.cloud.sap/docs/cds/types] [ASSUMED] |
| `JSON` | Any Phase 4 scalar mapping | JSON is the escape hatch in the locked scalar subset. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] [ASSUMED] |

## Common Pitfalls

### Pitfall 1: Generated `n8n/` Model Is Not Included in CAP Build

**What goes wrong:** Import creates `demo-app/n8n/index.cds`, but `cds build` or root `cap:compile` does not load it. [VERIFIED: package.json]

**Why it happens:** Current root `cap:compile` explicitly compiles `demo-app/db demo-app/srv demo-app/app`, excluding `demo-app/n8n`. [VERIFIED: package.json]

**How to avoid:** Planner should include a task to update model inclusion through app config/scripts or generated include files, then test `cds compile` or `cds build` with `demo-app/n8n`. [CITED: https://cap.cloud.sap/docs/node.js/cds-connect] [VERIFIED: local cds-dk 9.9.1 CLI]

**Warning signs:** Generated CDS exists but validation cannot resolve generated workflow types or artifacts. [ASSUMED]

### Pitfall 2: Build Plugin Messages Do Not Fail the Build

**What goes wrong:** Missing input/type mismatch appears as a message but `cds build` exits zero. [VERIFIED: local @sap/cds-dk 9.9.1 source]

**Why it happens:** Local CAP build source collects plugin messages, but reliable failure requires throwing a build error when validation errors exist. [VERIFIED: local @sap/cds-dk 9.9.1 source]

**How to avoid:** Shared validator returns errors and warnings; build plugin pushes messages and throws `BuildError` when errors are present. [VERIFIED: local @sap/cds-dk 9.9.1 source]

**Warning signs:** Integration test for missing required inputs logs an error but observes exit code `0`. [ASSUMED]

### Pitfall 3: Sanitizing Only Top-Level Workflow Fields

**What goes wrong:** Generated workflow JSON still contains credentials, owners, pinned data, personal email metadata, or instance-specific IDs. [VERIFIED: test-workflows/workflows.json]

**Why it happens:** n8n workflow exports can include nested node credential references and sharing/provenance structures. [CITED: https://docs.n8n.io/workflows/export-import/] [VERIFIED: test-workflows/workflows.json]

**How to avoid:** Implement recursive scrub rules and an integration test that scans generated artifacts for forbidden keys and known fixture-only metadata paths. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**Warning signs:** `demo-app/n8n/**/workflow.json` contains `credentials`, `shared`, `pinData`, `staticData`, or personal identifier fields. [VERIFIED: test-workflows/workflows.json]

### Pitfall 4: Workflow Reference Alias Mismatch

**What goes wrong:** Build validation warns that the workflow is unknown even though the imported artifact exists. [VERIFIED: demo-app/srv/admin-service.cds]

**Why it happens:** Current Phase 4 demo annotation uses `webhook-test/cap-test-trigger`, while the workflow artifact key is likely `cap-test-trigger`. [VERIFIED: demo-app/srv/admin-service.cds] [VERIFIED: test-workflows/workflows.json]

**How to avoid:** Manifest should include accepted references, and validator should normalize workflow refs through that manifest. [ASSUMED]

**Warning signs:** Warnings mention unknown workflow references for imported workflows with matching webhook paths. [ASSUMED]

### Pitfall 5: Bulk Import Happens Accidentally

**What goes wrong:** A local or live import commits many workflows when the developer expected one. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**Why it happens:** n8n exports and API list endpoints can contain multiple workflows. [CITED: https://docs.n8n.io/api/api-reference/] [CITED: https://docs.n8n.io/hosting/cli-commands/]

**How to avoid:** Require explicit `--all` unless the local export contains exactly one workflow. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]

**Warning signs:** CLI import without selector writes multiple workflow folders. [ASSUMED]

## Code Examples

Verified patterns from official and local sources:

### Existing Phase 4 Annotation Shape

```cds
annotate AdminService.Books with @(
  n8n.workflow.start: {
    workflowId  : 'webhook-test/cap-test-trigger',
    on          : ['CREATE', 'UPDATE'],
    inputs      : {
      bookId : 'ID',
      title  : 'title'
    },
    if          : 'stock > 0',
    businessKey : 'ID',
    tag         : 'admin-books'
  }
);
```

The project already uses this annotation shape in `demo-app/srv/admin-service.cds`, and Phase 4 parser code accepts these fields. [VERIFIED: demo-app/srv/admin-service.cds] [VERIFIED: cap-n8n-plugin/lib/annotations/AnnotationParser.js]

### n8n Public API Fetch Shape

```js
const response = await fetch(`${apiBaseUrl}/workflows/${encodeURIComponent(workflowId)}?excludePinnedData=true`, {
  headers: {
    'X-N8N-API-KEY': apiKey
  }
})
```

n8n official docs specify `X-N8N-API-KEY` authentication, and official OpenAPI includes workflow endpoints plus an `excludePinnedData` option. [CITED: https://docs.n8n.io/api/authentication/] [CITED: https://raw.githubusercontent.com/n8n-io/n8n-docs/main/docs/api/v1/openapi.yml]

### Existing Annotation Parser Reuse

```js
const { readWorkflowAnnotations } = require('../annotations/AnnotationParser')

for (const [name, definition] of Object.entries(csn.definitions || {})) {
  const annotations = readWorkflowAnnotations(definition, { entity: definition, name })
  for (const start of annotations.start || []) {
    // Compare start.workflowId and start.inputs to generated sidecar contract.
  }
}
```

This is the preferred shape because `AnnotationParser.js` already normalizes flattened CAP annotation keys and scalar mapping metadata. [VERIFIED: cap-n8n-plugin/lib/annotations/AnnotationParser.js] [ASSUMED]

## State of the Art

| Old Approach | Current Phase 5 Approach | When Changed | Impact |
|--------------|--------------------------|--------------|--------|
| Demo-specific n8n workflow calls | Package-owned annotations, payload mapping, import, and validation | Phase 4 to Phase 5 boundary. [VERIFIED: .planning/STATE.md] | Planning must keep reusable behavior in `cap-n8n-plugin`. [VERIFIED: AGENTS.md] |
| Raw n8n workflow JSON as implicit contract | Sidecar scalar schema as authoritative typed contract | Phase 5 discussion decision D-01. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] | Import must generate artifacts even when untyped, but strict validation only applies with schema. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Deep CAP import command | Package CLI with npm script wrappers | Phase 5 discussion decision D-11. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] | Planner should not create `cds import --from n8n` tasks in this phase. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Manual workflow fixture only | Deterministic sanitized workflow artifacts plus manifests and generated CDS | Phase 5 goal. [VERIFIED: .planning/ROADMAP.md] | Planner needs artifact generation, sanitizer, manifest, CDS generation, and validation tasks. [VERIFIED: .planning/ROADMAP.md] |

**Deprecated/outdated:**

- `cds import --from n8n` is out of scope for Phase 5 because the locked decision chooses a package CLI first. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]
- Full JSON Schema validation is out of scope for Phase 5 because the locked decision chooses a scalar subset. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]
- Host n8n CLI installation is not required for automated validation because official public API and existing Docker scripts cover the needed sources. [CITED: https://docs.n8n.io/api/api-reference/] [VERIFIED: package.json]

## Integration-Test Strategy

`workflow.nyquist_validation` is explicitly `false`, so this research omits the formal Nyquist `Validation Architecture` section; Phase 5 still needs integration tests because VERIFY-03 requires them. [VERIFIED: .planning/config.json] [VERIFIED: .planning/REQUIREMENTS.md]

| Requirement | Integration Test Focus | Automated Command |
|-------------|------------------------|-------------------|
| IMPORT-01 | Offline import from `test-workflows/workflows.json`, one-workflow auto-select, multi-workflow selector requirement, deterministic output comparison. [VERIFIED: test-workflows/workflows.json] | `npm run test:integration -- --run test/integration/n8n-workflow-import.test.js` [VERIFIED: package.json] |
| IMPORT-02 | Fake HTTP server for `/api/v1/workflows/:id` and `/api/v1/workflows`, assert API key header and sanitized error handling. [CITED: https://docs.n8n.io/api/authentication/] | `npm run test:integration -- --run test/integration/n8n-workflow-live-import.test.js` [VERIFIED: package.json] |
| IMPORT-03 | Generated CDS compiles in a temp CAP app and uses sidecar scalar inputs. [CITED: https://cap.cloud.sap/docs/cds/types] | `npx cds compile <tmp-app>/db <tmp-app>/srv <tmp-app>/n8n --to csn` [VERIFIED: local cds-dk 9.9.1 CLI] |
| IMPORT-04 | Generated JSON is stable across repeated imports and contains no forbidden metadata or secret fields. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] | `npm run test:integration -- --run test/integration/n8n-workflow-import.test.js` [VERIFIED: package.json] |
| IMPORT-05 | `cds build --project <tmp-app>` invokes validation plugin and reads generated artifacts. [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds] | `npx cds build --project <tmp-app>` [VERIFIED: local cds-dk 9.9.1 CLI] |
| IMPORT-06 | Missing required and type mismatch fixtures fail build and direct CLI validation with clear diagnostics. [VERIFIED: .planning/REQUIREMENTS.md] | `npm run test:integration -- --run test/integration/n8n-workflow-build-validation.test.js` [VERIFIED: package.json] |
| IMPORT-07 | Extra inputs and untyped workflow references warn without non-zero exit when no errors exist. [VERIFIED: .planning/REQUIREMENTS.md] | `npm run test:integration -- --run test/integration/n8n-workflow-build-validation.test.js` [VERIFIED: package.json] |
| VERIFY-03 | End-to-end import plus build validation through package CLI and CAP build in temp directories. [VERIFIED: .planning/REQUIREMENTS.md] | `npm run test:integration` [VERIFIED: package.json] |

Test implementation should use temp directories, copy minimal CAP models, and avoid reading `.env`. [VERIFIED: .gitignore] [VERIFIED: test/integration/*.test.js]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | CLI, build plugin, tests | Yes [VERIFIED: local environment] | `v24.16.0` [VERIFIED: local environment] | None; project requires Node 20+. [VERIFIED: package-lock.json] |
| npm | Workspaces and scripts | Yes [VERIFIED: local environment] | `11.13.0` [VERIFIED: local environment] | None required. [VERIFIED: package.json] |
| `cds` / `@sap/cds-dk` | CAP build and compile | Yes [VERIFIED: local environment] | `9.9.1` local [VERIFIED: local environment] | None for build validation. [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds] |
| Vitest | Integration tests | Yes [VERIFIED: local environment] | `4.1.7` local [VERIFIED: local environment] | None required. [VERIFIED: package.json] |
| Docker | Manual n8n fixture import/export | Yes [VERIFIED: local environment] | `29.5.2` [VERIFIED: local environment] | Fake HTTP server for automated live-import tests. [VERIFIED: test/integration/*.test.js] |
| Docker Compose | Manual n8n fixture import/export | Yes [VERIFIED: local environment] | `v5.1.4` [VERIFIED: local environment] | Fake HTTP server for automated live-import tests. [VERIFIED: test/integration/*.test.js] |
| Host `n8n` CLI | Not required | No [VERIFIED: local environment] | `n8n` / `n8n-cli` not found [VERIFIED: local environment] | Use public API, Docker Compose scripts, and fixtures. [CITED: https://docs.n8n.io/api/api-reference/] [VERIFIED: package.json] |
| Context7 CLI | Documentation lookup fallback | No [VERIFIED: local environment] | `ctx7` not found [VERIFIED: local environment] | Official docs fetched via web. [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds] |

**Missing dependencies with no fallback:**

- None for planning and automated Phase 5 integration tests. [VERIFIED: local environment] [VERIFIED: package.json]

**Missing dependencies with fallback:**

- Host `n8n` CLI is missing; use official public API for live import and existing Docker Compose scripts for manual fixture export/import. [VERIFIED: local environment] [CITED: https://docs.n8n.io/api/api-reference/] [VERIFIED: package.json]
- Context7 CLI is missing; official SAP CAP and n8n docs were used instead. [VERIFIED: local environment] [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds]

## Security Domain

`security_enforcement` is enabled in `.planning/config.json`, so Phase 5 planning must include security controls. [VERIFIED: .planning/config.json]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Yes | Read n8n API keys from CAP config/env and send `X-N8N-API-KEY`; never write API keys to generated artifacts. [CITED: https://docs.n8n.io/api/authentication/] [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| V3 Session Management | No | Phase 5 does not add browser sessions. [VERIFIED: .planning/ROADMAP.md] |
| V4 Access Control | Yes | Restrict CLI writes to the selected app root and reject workflow keys or paths that escape `app/n8n/`. [ASSUMED] |
| V5 Input Validation | Yes | Validate workflow JSON shape, sidecar scalar types, workflow selectors, generated paths, and annotation mappings before writing or building. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| V6 Cryptography | No new crypto | Do not hand-roll crypto; no new cryptographic storage is required. [VERIFIED: .planning/ROADMAP.md] |

### Known Threat Patterns for Phase 5

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret disclosure through raw n8n exports | Information Disclosure | Recursive sanitizer, forbidden-key integration test, no `.env` reads. [CITED: https://docs.n8n.io/workflows/export-import/] [VERIFIED: .gitignore] |
| Path traversal through workflow key or CLI path | Tampering | Slug workflow keys, resolve output paths, and enforce writes under app-root `n8n/`. [ASSUMED] |
| API key exposure through CLI args or logs | Information Disclosure | Read credentials from CAP config/env; redact auth headers and response bodies in diagnostics. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] |
| Build bypass after validation error | Tampering | Throw `BuildError` when shared validator reports errors. [VERIFIED: local @sap/cds-dk 9.9.1 source] |
| Supply-chain risk from new packages | Tampering | Use existing packages and built-in Node APIs; no new package install for Phase 5. [VERIFIED: package.json] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended filenames under `cap-n8n-plugin/lib/workflows/**` are planning names, not existing files. | Architecture Patterns | Planner may choose different names, but package ownership should stay unchanged. |
| A2 | Exact CLI subcommands `import local`, `import live`, and `validate` are recommended under agent discretion. | Pattern 1 | Planner may rename commands, but tests and scripts must match final names. |
| A3 | Generated CDS structured type plus action syntax is resolved in Open Questions (RESOLVED) and still must be compile-tested in Wave 1. | Pattern 4 | If CAP compile rejects the resolved shape, Plan 05-01 must adjust the generator before validation tasks rely on it. |
| A4 | Sanitizer allowlist is resolved in Open Questions (RESOLVED) for Phase 5 fixture coverage; future workflow shapes require explicit fixture additions before widening. | Sanitization Rules | Over-widening can leak metadata; over-narrowing can remove useful workflow review data. |
| A5 | Live import derives `/api/v1` from configured n8n base URL unless an explicit API base override exists. | Live Fetch | Wrong derivation could break non-standard deployments; planner should include override tests. |
| A6 | Manifest accepted-reference aliases should include `webhook/<path>` and `webhook-test/<path>`. | Artifact-to-Annotation Matching | Wrong alias set can cause false untyped warnings for valid annotations. |
| A7 | Type compatibility table includes conservative widening choices such as integer-to-decimal and timestamp-to-DateTime. | Conservative Type Compatibility | Too-permissive compatibility can hide mismatches; planner should lock exact matrix in implementation tests. |
| A8 | CLI write controls should reject path traversal and enforce app-root `n8n/`. | Security Domain | Missing controls could let import overwrite files outside the app. |

## Open Questions (RESOLVED)

1. **Generated CDS type/action shape**
   - Resolved choice: generated CDS uses `namespace cap.n8n.workflows`, one structured type named `<PascalWorkflowKey>Inputs`, and one `WorkflowInputContracts` service action named `<camelWorkflowKey>(inputs : <PascalWorkflowKey>Inputs) returns Boolean` for each typed workflow. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]
   - Scalar mapping: `String -> String`, `Integer -> Integer`, `Decimal -> Decimal`, `Boolean -> Boolean`, `Date -> Date`, `DateTime -> DateTime`, and `JSON -> LargeString`; the sidecar still records the workflow input as `JSON` so build validation can apply D-19 JSON compatibility. [CITED: https://cap.cloud.sap/docs/cds/types]
   - Plan reflection: Plan 05-01 Task 1 and Task 2 must compile-test `demo-app/n8n/index.cds` and assert `CapTestTriggerInputs` plus `WorkflowInputContracts.capTestTrigger` exist before Plans 05-03 and 05-04 consume generated contracts. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-01-PLAN.md]

2. **Default workflow key derivation**
   - Resolved choice: key precedence is explicit CLI `--key` for a single selected workflow, then unique webhook path slug, then workflow name slug, then source n8n workflow ID slug. If the resulting key collides during `--all`, append a short deterministic source-ID suffix and fail if no deterministic disambiguator exists. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]
   - Plan reflection: Plan 05-01 artifact helpers implement the shared key derivation and Plan 05-02 import selection uses the same helper for local and live imports. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-01-PLAN.md] [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-02-PLAN.md]

3. **Sanitizer allowlist and redaction provenance**
   - Resolved choice: sanitized `workflow.json` preserves only reviewable workflow structure: workflow name, nodes, connections, selected safe settings such as execution order, node id/name/type/typeVersion/position, and recursively scrubbed node parameters. It removes credentials, credential IDs, auth headers, owners, shared/project metadata, personal email values, pinned/static data, request/response bodies, stack traces, timestamps, version IDs, and runtime counters at any depth. [CITED: https://docs.n8n.io/workflows/export-import/] [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md]
   - Redaction provenance: manifests may record removed path names under sanitizer metadata such as `removedPaths`, including sensitive field names, but must not store removed values. Structured gates parse JSON so redaction path names are allowed while leaked secret values and unsafe fields in `workflow.json` fail verification. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-01-PLAN.md]
   - Plan reflection: Plan 05-01 Task 3 uses a structured JSON sanitizer gate instead of a raw forbidden-name regex over manifests, and Plan 05-04 limits implementation source gates to literal sample secrets or unsafe `.env` reads while scanning generated artifacts and CLI output for leaked sensitive values. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-04-PLAN.md]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md` - locked Phase 5 decisions, scope, and discretion areas. [VERIFIED: codebase read]
- `.planning/REQUIREMENTS.md` - Phase requirement IDs and descriptions. [VERIFIED: codebase read]
- `.planning/STATE.md` - prior phase decisions and current workflow state. [VERIFIED: codebase read]
- `.planning/ROADMAP.md` - Phase 5 goal and success criteria. [VERIFIED: codebase read]
- `AGENTS.md` - project constraints, stack, style, and security requirements. [VERIFIED: codebase read]
- `package.json` and `package-lock.json` - workspace scripts, dependency versions, and Node requirements. [VERIFIED: codebase read]
- `test-workflows/workflows.json` - current n8n export fixture shape and metadata risk. [VERIFIED: codebase read]
- `cap-n8n-plugin/cds-plugin.js` - existing CAP plugin bootstrap pattern. [VERIFIED: codebase read]
- `cap-n8n-plugin/lib/annotations/AnnotationParser.js` - Phase 4 annotation parser and validation shape. [VERIFIED: codebase read]
- `cap-n8n-plugin/lib/annotations/PayloadBuilder.js` - Phase 4 payload mapping and event metadata. [VERIFIED: codebase read]
- `demo-app/srv/admin-service.cds` - current demo workflow annotation. [VERIFIED: codebase read]
- Local `@sap/cds-dk` 9.9.1 source - build plugin message and `BuildError` behavior. [VERIFIED: local source inspection]
- SAP CAP custom build docs - `cds.build.Plugin` and `cds.build.register()`. [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds]
- SAP CAP plugin docs - package `cds-plugin.js` lifecycle. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins]
- SAP CAP connect/model docs - service model configuration and loading. [CITED: https://cap.cloud.sap/docs/node.js/cds-connect]
- SAP CAP type docs - scalar type vocabulary. [CITED: https://cap.cloud.sap/docs/cds/types]
- n8n API authentication docs - `X-N8N-API-KEY` header. [CITED: https://docs.n8n.io/api/authentication/]
- n8n public API reference and official OpenAPI - workflow endpoints and pinned-data exclusion. [CITED: https://docs.n8n.io/api/api-reference/] [CITED: https://raw.githubusercontent.com/n8n-io/n8n-docs/main/docs/api/v1/openapi.yml]
- n8n workflow export/import docs - credential handling warning. [CITED: https://docs.n8n.io/workflows/export-import/]
- n8n webhook node docs - webhook path and method configuration. [CITED: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/]
- n8n CLI docs - server export/import workflow commands. [CITED: https://docs.n8n.io/hosting/cli-commands/]

### Secondary (MEDIUM confidence)

- npm registry version checks for `@sap/cds`, `@sap/cds-dk`, `vitest`, `@cap-js/sqlite`, and `n8n`. [VERIFIED: npm registry]

### Tertiary (LOW confidence)

- None; unsupported implementation choices are listed in the Assumptions Log. [VERIFIED: this document]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - existing dependencies, local versions, lockfiles, and registry checks align. [VERIFIED: package.json] [VERIFIED: package-lock.json] [VERIFIED: npm registry]
- Architecture: MEDIUM-HIGH - CAP build plugin mechanics and Phase 4 parser are verified, while exact generated CDS and CLI names remain implementation choices. [CITED: https://cap.cloud.sap/docs/guides/deployment/custom-builds] [VERIFIED: cap-n8n-plugin/lib/annotations/AnnotationParser.js] [ASSUMED]
- n8n import behavior: HIGH for API auth/endpoints/webhook fields; MEDIUM for sanitizer allowlist because workflow exports vary by workflow contents and n8n version. [CITED: https://docs.n8n.io/api/authentication/] [CITED: https://docs.n8n.io/api/api-reference/] [ASSUMED]
- Pitfalls: HIGH - most risks are grounded in locked decisions, current fixture shape, current scripts, or local CAP build source. [VERIFIED: .planning/phases/05-workflow-import-and-build-validation/05-CONTEXT.md] [VERIFIED: test-workflows/workflows.json] [VERIFIED: package.json] [VERIFIED: local @sap/cds-dk 9.9.1 source]

**Research date:** 2026-06-03 [VERIFIED: current_date]
**Valid until:** 2026-07-03 for CAP/n8n API and build mechanics; 2026-06-10 for latest n8n package/version details. [ASSUMED]
