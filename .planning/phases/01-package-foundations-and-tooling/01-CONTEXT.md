# Phase 1: Package Foundations and Tooling - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning
**Source:** `$gsd-plan-phase 1` with GitHub issue review

<domain>

## Phase Boundary

Phase 1 establishes the package and tooling foundation for the brownfield CAP n8n Integration repo. It must make the CAP plugin and n8n node packages consumable through real package boundaries, pin local development infrastructure, add repo-local tooling, and provide smoke tests that prove both packages load.

Phase 1 must not implement the full Epic 1 runtime behavior from GitHub issues. Programmatic `start`, cancel/query, mock runtime, configuration profiles, retry/error behavior, declarative annotations, workflow import, BTP deployment, and hybrid-cloud docs are later GSD phases.

</domain>

<decisions>

## Implementation Decisions

### GitHub Issue Access

- [D-01] GitHub issues are accessible from this environment through the public GitHub API for `Ahmed03-ai/cap-n8n-plugin`.
- [D-02] Leon's GitHub assignee login is `Koerbser`.
- [D-03] Planning should use open issues assigned to `Koerbser` as contextual constraints, but Phase 1 scope remains governed by `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`.

### Leon-Assigned Issue Scope

- [D-04] Issues assigned to `Koerbser` are #2, #5-#18, #29, and #30.
- [D-05] No `Koerbser`-assigned GitHub issue directly maps to Phase 1 requirements `FOUND-01` through `FOUND-05` and `NODE-01`.
- [D-06] GitHub Epic 1 is not the same as GSD Phase 1. GitHub Epic 1 is runtime/API behavior; GSD Phase 1 is package/tooling foundation.
- [D-07] Phase 1 should enable future work on Leon-assigned issues by fixing package entry points, metadata, tooling, and smoke tests.
- [D-08] Phase 1 should not close or claim completion of #2, #5-#18, #29, or #30 unless a separate foundation issue is created and assigned.

### Include in Phase 1

- [D-09] Add or repair the public package entry for `cap-n8n-plugin` so consumers do not import `cap-n8n-plugin/lib/N8nWorkflowService.js` directly.
- [D-10] Align `cap-n8n-plugin` package metadata with actual runtime needs: CAP peer dependency, Node engine, package files, description, keywords, and license.
- [D-11] Add repo-local commands and dependencies for CAP CLI/build/test/smoke workflows instead of relying on undocumented global tools.
- [D-12] Replace intentionally failing placeholder package test scripts with meaningful smoke or no-op-safe commands.
- [D-13] Pin local n8n Docker infrastructure instead of using `n8nio/n8n:latest`.
- [D-14] Create an n8n community-node package skeleton/loadability baseline for `NODE-01`; detailed n8n node operations remain later work.
- [D-15] Add smoke tests proving both `cap-n8n-plugin` and `cap-n8n-node` are loadable through package-level boundaries.
- [D-16] Keep the demo app's existing CAP-to-n8n book-create proof working while moving it away from internal package paths where possible.

### Exclude from Phase 1

- [D-17] Do not implement full `start(workflowId, inputs)` semantics, execution ID guarantees, auth behavior, or CDS error propagation for issue #2; this belongs to GSD Phase 2.
- [D-18] Do not implement cancel/query/execution lookup for issues #5 and #6; this belongs to GSD Phase 3.
- [D-19] Do not implement local mock, profiles, retry/backoff, or runtime error behavior for issues #7-#10; these belong to GSD Phase 2.
- [D-20] Do not implement declarative CAP annotations for issues #11-#15; these belong to GSD Phase 4.
- [D-21] Do not implement workflow import or build validation for issues #16-#18; these belong to GSD Phase 5.
- [D-22] Do not implement BTP deployment or hybrid-cloud documentation for issues #29 and #30; these belong to GSD Phase 8.

### the agent's Discretion

- [D-23] Planner may split Phase 1 into multiple independent plans or waves if that improves parallel execution.
- [D-24] Planner may choose exact test file names, script names, and package skeleton file names, provided they are conventional for npm, SAP CAP, and n8n community-node development.
- [D-25] Planner may decide whether demo app consumption of the plugin package is fully fixed in Phase 1 or limited to a smoke-testable bridge, as long as no future work is blocked.

</decisions>

<canonical_refs>

## Canonical References

Downstream agents must read these before planning or implementing.

### GSD Scope

- `.planning/ROADMAP.md` - Phase 1 goal, requirements, success criteria, and phase dependencies.
- `.planning/REQUIREMENTS.md` - `FOUND-01` through `FOUND-05` and `NODE-01` definitions.
- `.planning/PROJECT.md` - core value, constraints, and brownfield context.
- `.planning/research/SUMMARY.md` - research-backed phase order and stack guidance.

### Codebase Map

- `.planning/codebase/STACK.md` - current stack, package manager, runtime, and dependency notes.
- `.planning/codebase/ARCHITECTURE.md` - current package boundaries and demo/plugin architecture.
- `.planning/codebase/CONCERNS.md` - known package metadata, tooling, test, and n8n-node placeholder concerns.
- `.planning/codebase/TESTING.md` - current testing gaps and lack of passing automated test command.

### Local Source Files

- `package.json` - root npm workspaces and scripts.
- `package-lock.json` - root lockfile to update when dependencies change.
- `docker-compose.yml` - local n8n image and volumes; currently a target for image pinning.
- `cap-n8n-plugin/package.json` - CAP plugin package metadata.
- `cap-n8n-plugin/index.js` - current package entry point.
- `cap-n8n-plugin/cds-plugin.js` - CAP plugin bootstrap.
- `cap-n8n-plugin/lib/N8nWorkflowService.js` - existing minimal service implementation.
- `cap-n8n-node/package.json` - n8n node package metadata.
- `cap-n8n-node/index.js` - current placeholder node package entry.
- `demo-app/package.json` - demo app CAP dependency/configuration and current n8n service binding.
- `README.md` - current local setup instructions and first CAP-to-n8n proof.

### GitHub Issues

- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/2` - US 1.1, indirectly enabled by Phase 1 but implemented in Phase 2.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/5` - US 1.2, deferred to Phase 3.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/6` - US 1.3, deferred to Phase 3.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/7` - US 1.4, deferred to Phase 2.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/8` - US 1.5, deferred to Phase 2.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/9` - US 1.6, deferred to Phase 2.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/10` - US 1.7, deferred to Phase 2.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/11` through `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/15` - Epic 2, deferred to Phase 4.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/16` through `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/18` - Epic 3, deferred to Phase 5.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/29` and `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/30` - Epic 6, deferred to Phase 8.

</canonical_refs>

<specifics>

## Specific Ideas

- Add a root smoke test command that verifies the CAP plugin package and n8n node package can be loaded from workspace package names.
- Add local dev dependencies such as CAP CLI/test tooling and a test runner according to `.planning/research/SUMMARY.md`.
- Convert the n8n node package from an empty `index.js` placeholder into the smallest conventional package shape that n8n tooling can build or inspect.
- Keep Phase 1 verification integration-style and smoke-oriented; do not use "unit tests" as the primary planning language.
- Preserve the current Docker-based proof that creating a Book can trigger n8n; Phase 1 should not regress that connection.

</specifics>

<deferred>

## Deferred Ideas

- Full CAP workflow start/cancel/query runtime behavior remains deferred to Phases 2 and 3.
- Declarative CAP annotations remain deferred to Phase 4.
- Workflow import and build-time validation remain deferred to Phase 5.
- Rich n8n node operations and credentials remain deferred to Phases 6 and 7.
- BTP deployment, hybrid-cloud docs, `.env.example` completeness, and optional trigger node work remain deferred to Phase 8 or v2.

</deferred>

---

*Phase: 01-package-foundations-and-tooling*
*Context gathered: 2026-05-28 via GitHub issue review and GSD phase planning*
