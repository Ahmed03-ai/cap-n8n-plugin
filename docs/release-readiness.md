# Release Readiness Evidence

This document is the Phase 8 traceability and evidence map. It separates automated review evidence from browser/manual UAT so reviewers can see what is proven, what is ready to run, and what must not be closed yet.

Allowed evidence states:

- `automated verified` - deterministic local command or test evidence passed without Docker browser state or secrets.
- `browser/manual verified` - a reviewer completed the named browser/manual checklist and recorded evidence.
- `manual UAT required` - the runbook exists, but browser/manual evidence has not been completed in the current review environment.

GitHub project/user-story statuses move only after evidence is documented. If a row still says `manual UAT required`, do not claim closure for that browser or deployment story.

## Automated Review Command

Run from the repository root:

```bash
npm run review:local
```

The command runs deterministic checks only: workspace tests, workflow annotation validation for `demo-app`, and CAP model compile including generated workflow artifacts. It does not start Docker, log in to n8n, run browser UAT, or read local `.env` files.

Current warning classification:

| Classification | Evidence | Release action |
|----------------|----------|----------------|
| `accepted tooling warning` | `DEP0190` from current n8n node tooling when `npm run review:local` passes | Accepted for this milestone; track with tooling upgrades. |
| `fix before release` | Any unclassified warning-like stderr, failing command, real defect warning, secret leak, or broken generated artifact | Fix before release. |
| `manual/UAT evidence required` | Real n8n custom-node browser proof, cancellation browser proof, Cloud Foundry/Kyma runtime validation | Complete the checklist before moving the story to verified. |

## Phase 8 Requirement Traceability

| Requirement | Evidence state | Implementation and evidence |
|-------------|----------------|-----------------------------|
| DOCS-01 | automated verified | `README.md`, `docs/manual-visual-showcase.md`, `docker-compose.yml`, `test-workflows/workflows.json`, and `npm run review:local` document and check the local CAP plus local n8n path. |
| DOCS-02 | manual UAT required | `README.md`, `.env.example`, and `docs/btp-deployment-guide.md` document cloud n8n placeholders and connectivity decisions; no cloud n8n runtime validation is claimed. |
| DOCS-03 | manual UAT required | `docker-compose.n8n-node.yml`, `scripts/prepare-n8n-custom-node.js`, and `docs/local-n8n-custom-node-e2e.md` provide the real installed custom-node runbook. Browser execution remains manual UAT until recorded. |
| DOCS-04 | automated verified | `.env.example` covers CAP demo/mock, local n8n webhook, real n8n custom-node E2E, cancellation stop API, cloud n8n, and BTP advisory placeholders. |
| DOCS-05 | manual UAT required | `docs/btp-deployment-guide.md` covers Cloud Foundry and Kyma advisory considerations, with no runtime validation claim. |
| DOCS-06 | automated verified | See the dedicated DOCS-06 mapping below for `mockups/n8n-node-mockup.html`, workflow fixtures, and manual runbooks mapped to n8n-specific user stories. |
| DOCS-07 | automated verified | `test/smoke/release-readiness.test.js`, `test/integration/n8n-release-readiness.test.js`, `.env.example`, docs gates, and sanitized workflow fixtures check placeholder-only release artifacts. |
| VERIFY-05 | manual UAT required | `docs/manual-visual-showcase.md` documents the local CAP plus n8n visual path and cancellation checklist; browser evidence must be recorded when run. |
| VERIFY-06 | automated verified | `npm run review:local` is the repeatable local readiness command and is protected by `test/smoke/release-readiness.test.js`. |
| VERIFY-07 | manual UAT required | `docs/local-n8n-custom-node-e2e.md` documents installed SAP CAP node browser E2E for Test Connection, metadata options, Query, Read, Create, Update, Delete, and Action/Function. |

## Roadmap Success Criteria Traceability

| Phase 8 success criterion | Evidence state | Evidence |
|---------------------------|----------------|----------|
| Run CAP demo with local n8n, cloud n8n, mock mode, and n8n node against CAP | manual UAT required | README run paths plus `.env.example`; cloud and real-node browser paths still require manual evidence. |
| Configure supported environment variables safely | automated verified | `.env.example` and smoke tests check required groups and placeholder-only values. |
| Follow SAP BTP guidance for credentials and connectivity | manual UAT required | `docs/btp-deployment-guide.md`; no Cloud Foundry or Kyma runtime validation. |
| Trace n8n mockups and fixtures to user stories | automated verified | DOCS-06 mapping below. |
| Run documented smoke/review command | automated verified | `npm run review:local`. |
| Run cancellation visual showcase with stoppable fixture | manual UAT required | `test-workflows/cancellation-workflows.json`, `scripts/cancellation-showcase.js`, and `docs/manual-visual-showcase.md`. |
| Run real n8n custom-node E2E | manual UAT required | `docker-compose.n8n-node.yml`, `scripts/prepare-n8n-custom-node.js`, and `docs/local-n8n-custom-node-e2e.md`. |

## GitHub Story Traceability

| GitHub issue | Evidence state | Evidence |
|--------------|----------------|----------|
| #16 | automated verified | Workflow import/export and generated artifacts are covered by `npm run n8n:workflow:validate -- --app demo-app`, `demo-app/n8n`, and Phase 5 tests. |
| #17 | manual UAT required | Live n8n import still requires a reachable n8n API and local operator credentials; do not close until evidence is recorded. |
| #18 | automated verified | Build validation and direct validation are covered by `npm run review:local` and `cap-n8n validate`. |
| #19 | manual UAT required | SAP CAP node installed in real n8n is covered by `docs/local-n8n-custom-node-e2e.md`; browser proof remains open. |
| #20 | manual UAT required | SAP CAP API credential Test Connection is in the real custom-node E2E checklist. |
| #21 | manual UAT required | Metadata-backed entity options are in the real custom-node E2E checklist. |
| #22 | manual UAT required | Create mode browser proof is in the real custom-node E2E checklist; deterministic integration evidence exists from Phase 7. |
| #23 | manual UAT required | Update mode browser proof is in the real custom-node E2E checklist; deterministic integration evidence exists from Phase 7. |
| #24 | manual UAT required | Delete mode browser proof is in the real custom-node E2E checklist; deterministic integration evidence exists from Phase 7. |
| #25 | manual UAT required | n8n item cleanup and safe errors are deterministic Phase 6/7 evidence; real editor/runtime proof remains manual. |
| #26 | manual UAT required | Action/Function browser proof is in the real custom-node E2E checklist. |
| #27 | manual UAT required | Composite-key behavior is deterministic Phase 7 evidence and included in real E2E manual checks. |
| #29 | manual UAT required | BTP deployment guidance is advisory in `docs/btp-deployment-guide.md`; no runtime validation is claimed. |
| #30 | manual UAT required | Hybrid local/cloud guidance is documented through `.env.example`, README, and BTP guide; cloud runtime proof remains open. |

## DOCS-06 n8n Mockup and Story Mapping

DOCS-06 is about helping reviewers distinguish implemented node behavior, mockup coverage, workflow fixture coverage, and manual evidence for n8n-specific user stories.

| Story area | GitHub issues | Mockup/runbook/fixture | Evidence state | Notes |
|------------|---------------|------------------------|----------------|-------|
| Credentials and Test Connection | Issue #19, Issue #20 | `mockups/n8n-node-mockup.html`, `docs/local-n8n-custom-node-e2e.md` | manual UAT required | Mockup shows fields; runbook proves the installed node only after browser checklist completion. |
| Metadata discovery and Query/Read | Issue #21 | `mockups/n8n-node-mockup.html`, `docs/local-n8n-custom-node-e2e.md` | manual UAT required | Phase 6/7 integration tests are automated, but real n8n editor dropdown proof is manual. |
| Create, Update, Delete | Issue #22, Issue #23, Issue #24 | `mockups/n8n-node-mockup.html`, `docs/local-n8n-custom-node-e2e.md` | manual UAT required | Mockup shows Body (JSON), key input, and Delete without a body. |
| Response cleanup and safe errors | Issue #25 | `mockups/n8n-node-mockup.html`, Phase 6/7 integration tests | automated verified | Browser proof can supplement this but is not required for deterministic behavior. |
| Action/Function and composite keys | Issue #26, Issue #27 | `mockups/n8n-node-mockup.html`, `docs/local-n8n-custom-node-e2e.md` | manual UAT required | Runbook checks metadata/manual operation selection and Parameters (JSON). |
| CAP-to-n8n happy-path fixture | Issue #16, Issue #18 | `test-workflows/workflows.json`, `docs/manual-visual-showcase.md` | automated verified | Fixture supports local webhook evidence and generated artifacts with owner/project/shared metadata removed. |
| Cancellation stop fixture | VERIFY-05 | `test-workflows/cancellation-workflows.json`, `scripts/cancellation-showcase.js`, `docs/manual-visual-showcase.md` | manual UAT required | Fixture and fake stop API are automated; real browser visible start/stop remains manual. |

## Manual Evidence Checklist

Record browser/manual evidence here or in project tracking before moving related stories:

| Manual check | Evidence state | Required proof |
|--------------|----------------|----------------|
| Real custom-node E2E | manual UAT required | n8n URL, SAP CAP node visible, credential Test Connection result, metadata options, Query, Read, Create, Update, Delete, Action/Function, cleanup. |
| Cancellation showcase | manual UAT required | `CAP n8n Cancellation Test`, visible waiting/running execution, CAP/plugin execution ID, n8n execution ID, `n8n.cancel(executionId)` result, stopped/cancelled browser state, cleanup. |
| Cloud n8n path | manual UAT required | CAP can reach cloud n8n webhook; n8n can reach CAP OData URL; secrets supplied by runtime config only. |
| Cloud Foundry/Kyma deployment | manual UAT required | Target route, auth mode, service binding or secret store, destination/connectivity decision, runtime start evidence, rollback/cleanup notes. |

When a reviewer completes one of these rows, update the state to `browser/manual verified` and attach or reference the local evidence without committing secrets.

## Warning Register

| Warning | Classification | Evidence state | Action |
|---------|----------------|----------------|--------|
| n8n node tooling emits `DEP0190` while `npm run review:local` passes | accepted tooling warning | automated verified | Accept for this milestone; revisit on n8n/node-tooling upgrade. |
| Workflow fixture owner/project/shared metadata | fix before release | automated verified | Fixed during Phase 8 close-out: `test-workflows/workflows.json` and `test-workflows/cancellation-workflows.json` are covered by fixture metadata gates. |
| Missing real browser evidence for installed node and cancellation | manual/UAT evidence required | manual UAT required | Complete the runbooks before closing browser-dependent stories. |

## Final Gate Commands

```bash
npm run review:local
npx vitest run test/smoke/release-readiness.test.js test/integration/n8n-release-readiness.test.js
rg -n "automated verified|browser/manual verified|manual UAT required|fix before release|accepted tooling warning|manual/UAT evidence required" docs/release-readiness.md
```

Keep real n8n browser login, custom-node editor checks, and cancellation UAT outside automated readiness until a dedicated browser automation phase exists.
