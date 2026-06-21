# Phase 5: Workflow Import and Build Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 05-workflow-import-and-build-validation
**Areas discussed:** Workflow Input Shape, Generated Artifact Layout, Import Command UX, Build Validation Strictness

---

## Workflow Input Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Sidecar schema first | Import workflow JSON, but use a developer-maintained/generated sidecar schema as the source of required fields and scalar types. | yes |
| Infer from workflow JSON only | Use webhook node parameters and discoverable workflow metadata only. | |
| Hybrid: infer what we can, sidecar fills gaps | Generate best-effort drafts from workflow JSON and rely on a sidecar for gaps. | |
| You decide | Planner chooses the smallest implementation satisfying import requirements. | |

**User's choice:** Sidecar schema first.
**Notes:** The sidecar should be JSON. Phase 5 should support a core scalar subset plus required fields. Full JSON Schema support is useful later but deferred. Missing sidecar schema should warn and generate an untyped artifact rather than fail import.

---

## Generated Artifact Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Inside consuming CAP app | Store imported workflow artifacts with the app that owns the CAP model and build. | yes |
| Inside cap-n8n-plugin package | Centralized plugin-owned storage for imported artifacts. | |
| Root-level workspace folder | Store generated workflow artifacts at repository root. | |
| You decide | Planner chooses the CAP-compatible layout. | |

**User's choice:** Inside consuming CAP app.
**Notes:** Use an app-root `n8n/` folder. Commit sanitized workflow JSON, schema, manifest, and generated CDS. Use stable local workflow keys and store source n8n IDs, names, webhook path, and provenance in the manifest.

---

## Import Command UX

| Option | Description | Selected |
|--------|-------------|----------|
| Package CLI with npm script wrapper | Provide a reusable package CLI and optionally friendly npm scripts for this repo. | yes |
| CAP-style `cds import --from n8n` | Match the original requirement wording through CAP CLI extension mechanics. | |
| Root npm scripts only | Keep command behavior local to this repository. | |
| You decide | Planner chooses the smallest credible command surface. | |

**User's choice:** Package CLI with npm script wrapper.
**Notes:** User asked whether importing one specific workflow or all workflows should both be possible. Decision: support one selected workflow by default and optional `--all`; single-workflow exports may auto-select. Live import mirrors local import. Credentials come from CAP config/env by default, with CLI overrides for test/demo routing and secret-safe handling.

---

## Build Validation Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Strict for known typed workflows | Missing required inputs and type mismatches are build errors; extra inputs are warnings. | yes |
| Warnings only | Avoid hard build failures. | |
| Configurable severity from day one | Let users configure validation severity early. | |
| You decide | Planner chooses based on requirements. | |

**User's choice:** Strict for known typed workflows.
**Notes:** Unknown or untyped workflow references warn instead of failing. Type compatibility should be conservative for Phase 5 scalar mappings. Validation should run through a CAP build plugin and through a direct CLI validator for tests, debugging, and visual showcase.

---

## the agent's Discretion

- Choose exact CLI binary names, npm script names, helper/module boundaries, generated file names, manifest field names, generated CDS namespace, and validation message wording within the locked decisions.

## Deferred Ideas

- Extend workflow input schemas to fuller JSON Schema support after the Phase 5 scalar sidecar contract is stable.
