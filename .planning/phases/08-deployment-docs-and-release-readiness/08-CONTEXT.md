# Phase 8: Deployment, Docs, and Release Readiness - Context

**Gathered:** 2026-06-03T22:33:35+02:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 makes the CAP n8n Integration reviewable and runnable by developers, platform engineers, and reviewers. It owns documentation, environment examples, release-readiness evidence, a real installed n8n custom-node E2E path, and a browser-first cancellation showcase.

This phase does not own new product behavior beyond the minimum harnesses, fixtures, scripts, and docs needed to prove the existing Phase 1-7 surfaces. Runnable Cloud Foundry or Kyma deployment manifests are out of scope unless a later plan proves they are low-risk and directly required by the agreed guidance.

</domain>

<decisions>
## Implementation Decisions

### Real n8n Custom-Node E2E

- **D-01:** Phase 8 must provide a repo-owned Docker override or helper path so a real local n8n instance loads the local `cap-n8n-node` package.
- **D-02:** The required E2E shape is scripted setup plus a manual browser checklist. Playwright/browser automation is optional stretch work only after the Docker/custom-node harness is stable.
- **D-03:** The manual E2E checklist must prove the full Phase 7 node surface in real n8n: node appears, SAP CAP credentials Test Connection passes, metadata-backed entity options load, and Query, Read, Create, Update, Delete, and Action/Function execute against the CAP demo app.
- **D-04:** The real n8n E2E uses an ephemeral review profile. Local n8n login values may be supplied by the operator at runtime, but real credentials must not be committed to docs, fixtures, tests, examples, or planning artifacts.

### Cancellation Visual Showcase

- **D-05:** Phase 8 must add or document a dedicated stoppable demo workflow fixture for cancellation evidence instead of modifying the existing happy-path workflow fixture.
- **D-06:** Cancellation evidence is browser-first: the visual showcase should lead with visible n8n UI execution state and CAP/demo-app actions, with terminal commands supporting the walkthrough.
- **D-07:** The cancellation acceptance bar is a real stop path. A running local n8n execution must be cancelled through the CAP/plugin integration, not only by manually pressing stop in the n8n UI.
- **D-08:** Cancellation configuration uses committed placeholders only. `.env.example` and docs must cover local n8n base URL, API key, stop/cancel settings, and review credentials without storing real secrets.

### Documentation and Environment Setup

- **D-09:** `README.md` is the entry point for running and reviewing the project. Detailed setup, visual showcase, BTP, and release-readiness material belongs in focused docs linked from the README.
- **D-10:** Phase 8 must add one root `.env.example`, grouped by workflow, covering the CAP demo, local n8n, real n8n custom-node E2E, cancellation, and BTP/cloud placeholders.
- **D-11:** The documentation must treat these as first-class run paths: local CAP demo, mock/test commands, real installed n8n custom-node E2E, cancellation showcase, and BTP/cloud guidance.
- **D-12:** Manual setup instructions must be exact step-by-step runbooks with commands, required terminals, browser URLs, expected visible results, cleanup steps, and troubleshooting notes.

### BTP and Cloud Deployment Guidance

- **D-13:** BTP scope is guidance and configuration mapping, not runnable deployment scaffolding. Do not add `mta.yaml`, Cloud Foundry manifests, Helm charts, or Kyma deployment files unless separately justified as low-risk.
- **D-14:** The guide must cover Cloud Foundry and Kyma at consideration level: routing, authentication, destinations/connectivity, secrets, webhook reachability, and operational caveats.
- **D-15:** BTP examples must use strict placeholders and secret-store/service-binding guidance. Do not commit API keys, private keys, n8n credentials, or production metadata.
- **D-16:** The BTP acceptance bar is a review-ready advisory guide that states required decisions, environment variables, network reachability constraints, and unresolved deployment work without claiming BTP runtime validation.

### Traceability and Review Readiness

- **D-17:** Add a dedicated release-readiness doc for traceability and evidence, linked from `README.md`.
- **D-18:** The release-readiness traceability matrix must map Phase 8 requirements and success criteria plus relevant GitHub user stories to implementation files, docs, commands, workflow fixtures, and manual evidence.
- **D-19:** Evidence states must be explicit: `automated verified`, `browser/manual verified`, or `manual UAT required`. Do not collapse these into a vague ready/not-ready label.
- **D-20:** GitHub project/user-story statuses should only be closed or moved after evidence is documented. If manual UAT is still required, the release-readiness doc must say so instead of overclaiming closure.

### Smoke, CI, and Release Evidence

- **D-21:** Require a reliable local release/review command first. Add GitHub Actions only if CI is low-risk and does not depend on secrets, local browser state, or flaky n8n runtime setup.
- **D-22:** The local release/review command should include reliable automated checks only: package/build validation, unit/integration/smoke tests, and static validation that does not require real n8n browser login or manual credentials.
- **D-23:** Real n8n and cancellation evidence remains browser/manual-first and must be recorded through a checklist in the release-readiness doc. The checklist should name URLs, visible n8n node/editor state, execution status, CAP response, cancellation result, and cleanup confirmation to capture.
- **D-24:** Warnings from test/build/review commands must be classified. Fix warnings that indicate real defects; document accepted warnings with rationale in release-readiness evidence.

### the agent's Discretion

- Exact names and locations for helper scripts, Docker override files, and release-readiness docs, as long as they are discoverable from `README.md`.
- Whether to add GitHub Actions in Phase 8, provided the plan first proves the workflow is low-risk, secret-free, and not dependent on manual browser state.
- Exact wording and table shape for the release-readiness traceability matrix, provided it preserves requirement/user-story mapping and evidence-state separation.
- Exact troubleshooting categories in docs, provided setup failures around Node, Docker, n8n startup, custom-node loading, CAP connectivity, credentials, and cancellation config are covered.

</decisions>

<specifics>
## Specific Ideas

- The user explicitly wants every manual step needed to get the real n8n and cancellation flows running documented clearly enough to follow without guessing.
- The local n8n login can be provided by the operator during execution. It must remain transient and must not be written into `.env.example`, docs, tests, fixtures, planning files, or commits.
- The release-readiness doc should make GitHub issue closure honest by separating automated evidence from browser/manual evidence and UAT still required.
- Documentation updates must include `README.md` and the manual visual showcase path, not only internal planning artifacts.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements

- `.planning/ROADMAP.md` - Phase 8 goal, dependencies, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` - `DOCS-01` through `DOCS-07` and `VERIFY-05` through `VERIFY-07`.
- `.planning/PROJECT.md` - product boundary, brownfield constraints, current focus, security constraints, and release-readiness context.
- `.planning/STATE.md` - current milestone state, completed Phase 1-7 decisions, pending UAT notes, and prior GitHub status context.
- `.planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md` - Phase 7 node surface that the real n8n E2E must prove.

### Codebase Maps

- `.planning/codebase/INTEGRATIONS.md` - existing Docker/n8n/CAP integration surfaces and current gaps.
- `.planning/codebase/TESTING.md` - existing smoke, integration, workspace, and verification command landscape.
- `.planning/codebase/STRUCTURE.md` - repo layout, package boundaries, and docs locations.
- `.planning/codebase/CONCERNS.md` - open concerns around real n8n custom-node loading, CI, BTP, cancellation visual proof, and docs.

### Runtime and Documentation Surfaces

- `README.md` - required first entry point for developer/reviewer setup.
- `docs/manual-visual-showcase.md` - existing visual showcase doc to update with Phase 8 evidence.
- `docker-compose.yml` - current local n8n service definition; Phase 8 may add an override/helper path for custom-node loading.
- `package.json` - root npm workspace scripts and candidate location for the local release/review command.
- `cap-n8n-node/package.json` - n8n community-node build metadata, scripts, and package shape.
- `test-workflows/workflows.json` - existing workflow fixtures; Phase 8 should add/verify a dedicated stoppable cancellation fixture without secrets.

### Requirements Source and User Stories

- `cap_n8n_requirements_v2.md` - Epic 3, Epic 4, and Epic 6 user-story context, especially workflow import, SAP CAP node, SAP BTP deployment, and hybrid local/cloud testing.
- `N8N_REQUIREMENTS.md` - original requirements and docs/release expectations to reconcile with current implementation.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/16` through `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/18` - Epic 3 workflow import/validation stories that may need release-readiness evidence.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/19` through `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/27` - Epic 4 SAP CAP node stories, including Phase 6 and Phase 7 surfaces to verify in real n8n.
- `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/29` and `https://github.com/Ahmed03-ai/cap-n8n-plugin/issues/30` - Epic 6 deployment and hybrid local/cloud testing stories.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- Root `npm` scripts already aggregate smoke/integration checks and can be wrapped by a release/review command.
- `docker-compose.yml` already runs local n8n on port `5678` with `.n8n-data/` persistence and workflow fixture mounts, but it does not currently install or mount the local `cap-n8n-node`.
- `cap-n8n-node` already implements the Phase 6/7 node surface and deterministic built-node integration tests; Phase 8 must prove installed-node behavior in real n8n.
- `docs/manual-visual-showcase.md` already exists and should become the browser-first home for real n8n and cancellation walkthrough evidence.
- Existing workflow fixtures live under `test-workflows/`; new cancellation fixture work should follow the established fixture location unless the planner identifies a cleaner repo-owned fixture path.

### Established Patterns

- Secrets are represented through environment placeholders such as `{env.N8N_API_KEY}` and ignored `.env` files; committed examples must stay placeholder-only.
- The project prefers npm workspace scripts and Docker Compose for local workflows.
- Built-node deterministic tests are valuable but do not replace manual browser/UAT evidence in a real n8n editor/runtime.
- Documentation should distinguish demo evidence from package-owned behavior: reusable behavior belongs in `cap-n8n-plugin` and `cap-n8n-node`, while `demo-app` proves usage.

### Integration Points

- The real n8n E2E path connects Docker Compose/local n8n, the local `cap-n8n-node` package, the CAP demo app, SAP CAP credentials in n8n, `$metadata` loading, and node execution.
- The cancellation showcase connects CAP plugin cancellation configuration, a long-running/stoppable n8n workflow, a real n8n execution id, and visible stopped/cancelled execution state.
- The release-readiness doc connects requirements, GitHub user stories, files, commands, fixtures, and manual UAT evidence states.
- `.env.example` connects local CAP, local n8n, real n8n E2E, cancellation stop API config, and BTP/cloud placeholders.

</code_context>

<deferred>
## Deferred Ideas

- Playwright/browser automation for n8n editor/runtime verification remains a stretch goal after the manual real-n8n harness is stable.
- Runnable Cloud Foundry or Kyma deployment scaffolding is deferred until a real target landscape or explicit deployment phase exists.
- Committed screenshots are not required by default; manual evidence checklists are the Phase 8 evidence format.

</deferred>

---

*Phase: 08-deployment-docs-and-release-readiness*
*Context gathered: 2026-06-03T22:33:35+02:00*
