# Phase 5: Workflow Import and Build Validation - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 turns n8n workflow definitions into deterministic local CAP artifacts. CAP developers must be able to import n8n workflows from a local JSON export or a live n8n instance, store sanitized workflow artifacts inside the consuming CAP app, generate CDS input definitions from a sidecar schema, and catch workflow annotation mapping problems during `cds build`.

This phase owns workflow import, sanitized local artifact layout, sidecar input schemas, generated CDS artifacts, CAP build validation, and a direct CLI validator for tests and demos. It does not implement full JSON Schema support, to-one/to-many annotation mapping, n8n community-node operations, deployment documentation, or production release packaging.

</domain>

<decisions>
## Implementation Decisions

### Workflow Input Shape

- **D-01:** Phase 5 uses a sidecar schema as the primary source of workflow input requirements. n8n workflow JSON is imported, but it is not trusted to fully describe required body fields or scalar types.
- **D-02:** The sidecar schema format is JSON and lives beside the sanitized workflow artifact.
- **D-03:** Phase 5 supports a core scalar schema subset: `String`, `Integer`, `Decimal`, `Boolean`, `Date`, `DateTime`, and `JSON`, plus required-field metadata.
- **D-04:** Full JSON Schema support is explicitly deferred until the scalar sidecar contract is stable.
- **D-05:** If a workflow is imported without a sidecar schema, import continues and generates an untyped artifact. Build validation warns for untyped workflow references instead of failing.

### Generated Artifact Layout

- **D-06:** Imported artifacts belong inside the consuming CAP app, not in `cap-n8n-plugin`.
- **D-07:** The artifact folder is an app-root `n8n/` directory, for example `demo-app/n8n/...`.
- **D-08:** Git should commit sanitized workflow JSON, the JSON sidecar schema, a manifest, and generated CDS artifacts so builds are deterministic and offline.
- **D-09:** Generated artifacts use a stable local workflow key as the folder/key. The manifest stores source n8n workflow IDs, workflow name, webhook path, source type, and other provenance separately.
- **D-10:** Sanitization must remove secrets and instance-specific metadata such as owners, shared project metadata, personal emails, credentials, and runtime-only version noise from committed workflow artifacts.

### Import Command UX

- **D-11:** Phase 5 uses a package CLI with npm script wrapper rather than relying on a deep `cds import --from n8n` extension in the first implementation.
- **D-12:** Local import supports importing one selected workflow by default and optional `--all` bulk import. Multi-workflow imports should not happen by accident.
- **D-13:** If a local workflow export contains exactly one workflow and no selector is provided, auto-selecting that workflow is acceptable.
- **D-14:** Live n8n import mirrors local import: one workflow by ID/key by default and optional `--all`.
- **D-15:** Live import reads `baseUrl` and credentials from CAP config/environment by default. CLI overrides are allowed for local routing and showcase convenience, but secrets should come from environment/config rather than literal command arguments.

### Build Validation Strictness

- **D-16:** For workflow references that have generated typed artifacts, validation is strict: missing required inputs and type mismatches are build errors.
- **D-17:** Extra annotated inputs that are not defined in the imported workflow schema are warnings, not build errors.
- **D-18:** Annotation references to workflows without generated schema/artifact support warn and do not fail, preserving incremental adoption and existing untyped `workflowId` usage.
- **D-19:** Scalar type compatibility is conservative. Numeric workflow inputs require numeric CAP fields, Boolean requires Boolean, dates require CAP date/time fields, and `JSON` can accept any mapped scalar/object fallback supported by the implementation.
- **D-20:** Validation must run through CAP build integration and through a direct package CLI command such as `cap-n8n validate --app demo-app` for focused tests, debugging, and manual showcase.

### the agent's Discretion

- Planner may choose exact CLI binary names, npm script names, helper/module boundaries, generated file names, manifest field names, and generated CDS namespace, provided the behavior above is preserved.
- Planner may choose the exact app-root `n8n/` subfolder shape, provided workflow artifacts are grouped by stable local key and sanitized JSON, schema, manifest, and generated CDS are all easy to inspect.
- Planner may choose exact build warning/error wording, provided messages identify the entity, annotation, workflow key, input name, and reason when applicable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GSD Scope

- `.planning/ROADMAP.md` - Phase 5 goal, requirements, success criteria, dependency on Phase 4, and Phase 8 visual-showcase follow-up.
- `.planning/REQUIREMENTS.md` - `IMPORT-01` through `IMPORT-07` and `VERIFY-03`.
- `.planning/PROJECT.md` - core value, brownfield constraints, validated prior phases, and project-level package ownership decisions.
- `.planning/STATE.md` - current project position and accumulated Phase 2 through Phase 4 decisions affecting workflow IDs, annotations, and validation.
- `.planning/phases/04-declarative-cap-annotations/04-CONTEXT.md` - annotation shape, scalar mapping, CAP CRUD vocabulary, deferred association mapping, and non-blocking side-effect decisions.
- `.planning/phases/03-execution-store-and-transaction-safe-dispatch/03-CONTEXT.md` - durable execution and outbox decisions that must not be broken by generated workflow artifacts.

### Requirements Source

- `cap_n8n_requirements_v2.md` - Epic 3 Workflow Import and Typings, especially US 3.1 through US 3.3.
- `N8N_REQUIREMENTS.md` - Original workflow import command sketch and build-time validation acceptance criteria.

### Codebase Map

- `.planning/codebase/INTEGRATIONS.md` - local n8n workflow fixture, Docker Compose import/export scripts, credentials, and webhook integration context.
- `.planning/codebase/TESTING.md` - Vitest integration-test patterns and workflow fixture testing guidance.
- `.planning/codebase/ARCHITECTURE.md` - package boundaries, CAP plugin ownership, workflow artifact layer, and CAP build integration points.

### Local Source Files

- `package.json` - existing root scripts for `n8n:import`, `n8n:export`, `cap:compile`, `smoke`, and `test`.
- `test-workflows/workflows.json` - current exported n8n workflow fixture, including the need for sanitization of instance metadata.
- `cap-n8n-plugin/cds-plugin.js` - CAP plugin bootstrap and likely build/runtime extension point to preserve.
- `cap-n8n-plugin/lib/annotations/AnnotationParser.js` - existing Phase 4 annotation parser and input mapping shape to validate against generated workflow schemas.
- `demo-app/srv/admin-service.cds` - current demo workflow annotations and mapped scalar inputs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- Existing root scripts already support Docker n8n workflow import/export into `test-workflows/workflows.json`; Phase 5 can build on that fixture while adding package-owned import/generation behavior.
- `test-workflows/workflows.json` contains full n8n workflow export records with webhook node path information and instance-specific metadata, so sanitization is required before committing generated app artifacts.
- Phase 4 annotation helpers already parse `@n8n.workflow.start` and scalar `inputs` mappings; build validation should reuse or align with that contract instead of inventing a second annotation vocabulary.
- Existing integration tests use local CAP models and fake HTTP/test fixtures without requiring Docker n8n, which is the right pattern for import/generation/build-validation coverage.

### Established Patterns

- Reusable behavior belongs in `cap-n8n-plugin`; imported workflow artifacts belong in the consuming CAP app because they are app-specific.
- Runtime and plugin code use JavaScript CommonJS, two-space indentation, CAP logging, and integration-test-first verification.
- Secrets must stay in environment/CAP config. Generated docs, manifests, fixtures, and workflow artifacts must not commit API keys, private keys, credentials, or personal production metadata.
- CAP-facing terms should stay familiar to CAP developers: `workflowId`, CDS artifacts, `cds build`, and CAP CRUD annotation vocabulary.

### Integration Points

- The package CLI needs to read local n8n workflow JSON exports and optionally fetch live workflow definitions from n8n using configured `baseUrl` and API credentials.
- Generated CDS artifacts must be included by the consuming CAP app's model/build process.
- CAP build validation must inspect Phase 4 annotations and compare mapped inputs against generated workflow schemas.
- The direct CLI validator should exercise the same validation logic as the CAP build integration.

</code_context>

<specifics>
## Specific Ideas

- Example direct command shape: `npx cap-n8n import --app demo-app --from test-workflows/workflows.json --workflow cap-test-trigger`.
- Example validator command shape: `npx cap-n8n validate --app demo-app`.
- Example artifact direction: `demo-app/n8n/workflows/<workflow-key>/workflow.json`, `schema.json`, `manifest.json`, and generated CDS.
- The workflow key should be stable and readable, while manifest fields preserve original n8n source IDs and names for traceability.
- CLI overrides are useful for local demos, for example `--base-url http://localhost:5678`, but raw API keys should remain in environment/config.

</specifics>

<deferred>
## Deferred Ideas

- Extend workflow input schemas to fuller JSON Schema support after the Phase 5 scalar sidecar contract is stable.
- To-one association mapping and to-many association/composition expansion remain deferred beyond Phase 5.
- n8n community-node credential UI, metadata discovery, CRUD, actions/functions, response cleanup, and composite-key support remain Phases 6 and 7.
- No-harness visual cancellation and local n8n community-node installation/mounting showcase work remains Phase 8.

</deferred>

---

*Phase: 05-Workflow Import and Build Validation*
*Context gathered: 2026-06-03*
