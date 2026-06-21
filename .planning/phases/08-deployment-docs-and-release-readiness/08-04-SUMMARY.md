---
phase: 08-deployment-docs-and-release-readiness
plan: 04
subsystem: docs-release-readiness
tags: [docs, env, btp, release-readiness, smoke, manual-uat]

requires:
  - phase: 08-deployment-docs-and-release-readiness
    provides: review:local command, custom-node E2E runbook, and cancellation showcase artifacts from plans 08-01 through 08-03
provides:
  - Root placeholder-only environment reference for local, real n8n, cancellation, cloud, and BTP run paths
  - README entry point for Phase 8 review and setup paths
  - Concrete local-CAP-to-cloud-n8n runbook with supported CAP config mapping
  - Advisory Cloud Foundry and Kyma BTP deployment guide
  - Release-readiness traceability matrix for Phase 8 requirements, GitHub stories, evidence states, mockups, fixtures, commands, and manual UAT
  - Final smoke gates for docs/env/readiness evidence and fixture secret checks
affects: [phase-08, release-readiness, docs, manual-uat]

tech-stack:
  added: []
  patterns:
    - Placeholder-only root environment example grouped by review workflow
    - Evidence-state traceability with automated and browser/manual evidence separated
    - Static gates for owned release artifacts and workflow fixtures

key-files:
  created:
    - .env.example
    - docs/cloud-n8n-runbook.md
    - docs/btp-deployment-guide.md
    - docs/release-readiness.md
  modified:
    - README.md
    - cap-n8n-plugin/lib/config.js
    - docs/manual-visual-showcase.md
    - test/integration/n8n-mock-and-profiles.test.js
    - test/smoke/release-readiness.test.js

key-decisions:
  - "README is the Phase 8 entry point; focused runbooks hold the detailed local, real n8n, cancellation, BTP, and release-readiness paths."
  - "BTP guidance remains advisory and explicitly claims no Cloud Foundry or Kyma runtime validation."
  - "Release readiness uses only automated verified, browser/manual verified, and manual UAT required evidence states."
  - "Workflow fixtures are sanitized and covered by release-readiness metadata/secret gates."

patterns-established:
  - "Final readiness docs must separate automated review evidence from browser/manual UAT before GitHub statuses move."
  - "Secret gates should cover docs/env/scripts and both committed workflow fixtures."

requirements-completed: [DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, DOCS-07, VERIFY-05, VERIFY-06, VERIFY-07]

duration: 35min
completed: 2026-06-03T22:54:20Z
---

# Phase 08 Plan 04: Deployment Docs and Release Readiness Summary

**README-centered release readiness with root env placeholders, BTP advisory guidance, traceability evidence, and final static gates**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-03T22:19:00Z
- **Completed:** 2026-06-03T22:54:20Z
- **Tasks:** 3 completed
- **Files modified:** 10

## Accomplishments

- Added `.env.example` grouped by CAP demo/mock, local n8n webhook, real n8n custom-node E2E, cancellation stop API, cloud n8n, and BTP advisory placeholders.
- Updated `README.md` as the Phase 8 entry point with `npm run review:local`, `.env.example`, and focused runbook links.
- Added `docs/cloud-n8n-runbook.md` so local CAP can be configured against a reachable cloud n8n webhook through `CDS_CONFIG`.
- Updated n8n config resolution to support exact `{env.NAME}` placeholders in CAP runtime configuration, including `credentials.baseUrl` and `credentials.apiKey`.
- Added `docs/btp-deployment-guide.md` as advisory-only Cloud Foundry and Kyma guidance with no runtime validation claim.
- Added `docs/release-readiness.md` mapping Phase 8 requirements, roadmap criteria, GitHub issues #16 through #18, #19 through #27, #29, #30, DOCS-06 mockups/fixtures, warning classifications, and manual UAT states.
- Extended `test/smoke/release-readiness.test.js` to enforce final README/env/docs/evidence/fixture secret gates.

## Task Commits

Per the execution request and prior Phase 8 close-out pattern, all task outputs and this summary are captured in one atomic `08-04` plan commit. `STATE.md` and roadmap updates were intentionally not staged or modified because phase-start bookkeeping is owned by the orchestrator.

## Files Created/Modified

- `.env.example` - Root placeholder-only environment reference grouped by supported review and deployment run path.
- `README.md` - Phase 8 entry point with automated review command, focused docs, `.env.example` usage, and manual UAT boundary.
- `cap-n8n-plugin/lib/config.js` - Resolves exact `{env.NAME}` placeholders in n8n CAP config before validating webhook/cancellation settings.
- `docs/cloud-n8n-runbook.md` - Local CAP to cloud n8n webhook manual-UAT checklist with `CDS_CONFIG` mapping and cleanup.
- `docs/btp-deployment-guide.md` - Advisory BTP Cloud Foundry and Kyma guidance for routing, auth, destinations/connectivity, service binding/secret storage, webhook reachability, stop API reachability, and unresolved validation work.
- `docs/release-readiness.md` - Traceability matrix for requirements, roadmap criteria, GitHub stories, DOCS-06 mockup/fixture mapping, warning classification, and final gates.
- `docs/manual-visual-showcase.md` - Added links to focused Phase 8 docs and corrected stale cancellation wording now that the 08-03 fixture/runner exists.
- `test/integration/n8n-mock-and-profiles.test.js` - Added runtime config coverage for cloud n8n env placeholder resolution.
- `test/smoke/release-readiness.test.js` - Added final docs/env/evidence-state/DOCS-06/BTP/fixture secret gates.
- `.planning/phases/08-deployment-docs-and-release-readiness/08-04-SUMMARY.md` - This execution summary.

## Decisions Made

- Kept BTP content advisory and did not add deployment descriptors, manifests, Helm charts, Kyma resources, or production Dockerfiles.
- Treated cloud n8n as a concrete local-CAP run path with manual runtime proof, separate from advisory BTP deployment validation.
- Kept real n8n custom-node E2E and cancellation browser checks as `manual UAT required` until a reviewer records browser/manual evidence.
- Classified current `DEP0190` output as an `accepted tooling warning` only because `npm run review:local` passed with that warning.
- Used secret and metadata gates for release artifacts plus both workflow fixtures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Bug] Fixed release smoke secret gate self-match**
- **Found during:** Task 3 TDD RED
- **Issue:** The new smoke test initially scanned itself for literal metadata patterns it needed to name.
- **Fix:** Split personal metadata patterns from the original source self-scan and applied them only to release artifact files.
- **Files modified:** `test/smoke/release-readiness.test.js`
- **Verification:** RED rerun failed only on missing docs/env artifacts; final focused smoke passed.
- **Committed in:** final 08-04 plan commit

**2. [Rule 1 - Test Bug] Allowed angle-bracket API-key placeholders**
- **Found during:** Task 3 GREEN verification
- **Issue:** The smoke test rejected the required `N8N_API_KEY=<local-n8n-api-key>` placeholder because the regex looked beyond the leading angle bracket.
- **Fix:** Tightened the gate to reject `N8N_API_KEY=` only when the value starts with an alphanumeric real-looking token.
- **Files modified:** `test/smoke/release-readiness.test.js`
- **Verification:** `npx vitest run test/smoke/release-readiness.test.js` passed.
- **Committed in:** final 08-04 plan commit

---

**Total deviations:** 2 auto-fixed (2 test bugs).
**Impact on plan:** Both fixes made the intended inverted secret checks precise without weakening the placeholder policy.

## Issues Encountered

- The exact broad plan secret scan over `test-workflows/` initially failed on pre-existing `test-workflows/workflows.json`. Phase 8 close-out sanitized that happy-path fixture and expanded the smoke fixture metadata gate so both workflow fixtures are covered.
- Initial phase verification found DOCS-02 partial because cloud n8n had placeholders but no runnable local-CAP-to-cloud-n8n path; close-out added the cloud runbook and runtime env-placeholder mapping.
- `npm run review:local` observes Node `DEP0190` from current n8n node tooling and classifies it as `accepted tooling warning`.
- `.planning/STATE.md` had pre-existing phase-start changes before this plan execution and was not staged or modified by this executor.

## Known Stubs

None. Placeholder strings in `.env.example` and docs are intentional secret-safe configuration examples, not unwired UI/data stubs.

## Threat Flags

None. The new docs and smoke gates operate within the plan's documented docs-to-setup, docs-to-platform-guidance, evidence-to-GitHub-status, and examples-to-repository trust boundaries.

## Verification

Passed:

- `npx vitest run test/smoke/release-readiness.test.js` - passed, 11 tests.
- `rg -n "review:local|.env.example|manual-visual-showcase|local-n8n-custom-node-e2e|btp-deployment-guide|release-readiness|N8N_CANCEL_API_BASE_URL|BTP_CAP_BASE_URL" README.md .env.example` - passed.
- README/env inverted secret check - passed.
- `rg -n "Cloud Foundry|Kyma|advisory|no runtime validation|credentials.baseUrl|cancel.supported|cancel.apiBaseUrl|service binding|destination|webhook reachability" docs/btp-deployment-guide.md` - passed.
- `rg -n "DOCS-01|DOCS-02|DOCS-03|DOCS-04|DOCS-05|DOCS-06|DOCS-07|VERIFY-05|VERIFY-06|VERIFY-07|#16|#17|#18|#19|#20|#21|#22|#23|#24|#25|#26|#27|#29|#30|n8n-node-mockup.html|test-workflows/workflows.json|cancellation-workflows.json|automated verified|browser/manual verified|manual UAT required" docs/release-readiness.md` - passed.
- `npx vitest run test/smoke/release-readiness.test.js test/integration/n8n-release-readiness.test.js` - passed, 15 tests.
- `npx vitest run test/integration/n8n-mock-and-profiles.test.js test/smoke/release-readiness.test.js test/integration/n8n-release-readiness.test.js` - passed, 28 tests after the cloud n8n close-out fix.
- Direct `CDS_CONFIG` placeholder resolution check for `N8N_CLOUD_BASE_URL` and `N8N_CLOUD_API_KEY` - passed without printing the API key.
- `npm run review:local` - passed, including full smoke/integration tests, workflow annotation validation, and CAP compile with generated workflows.
- `rg -n "automated verified|browser/manual verified|manual UAT required|fix before release|accepted tooling warning|manual/UAT evidence required" docs/release-readiness.md` - passed.
- Secret and metadata gates over README, `.env.example`, docs, both workflow fixtures, and scripts - passed.

Resolved during close-out:

- Broad plan secret gate over `test-workflows/` initially failed on `test-workflows/workflows.json`; the fixture was sanitized before phase verification.

## User Setup Required

Manual UAT remains required for:

- Real installed n8n custom-node E2E in `docs/local-n8n-custom-node-e2e.md`.
- Browser-first cancellation showcase in `docs/manual-visual-showcase.md`.
- Cloud n8n runtime validation in `docs/cloud-n8n-runbook.md`.
- Cloud Foundry and Kyma runtime validation described in `docs/btp-deployment-guide.md`.

## Next Phase Readiness

Phase 8 documentation and local automated readiness gates are complete for the 08-04 scope. Remaining manual UAT must be run and recorded before moving browser-dependent GitHub stories to verified.

## TDD Gate Compliance

- RED: `npx vitest run test/smoke/release-readiness.test.js` failed before `.env.example`, BTP guide, release-readiness doc, and manual-showcase links existed.
- GREEN: `npx vitest run test/smoke/release-readiness.test.js` passed after docs/env/test fixes.
- Separate RED/GREEN commits were not created because the user requested one atomic 08-04 commit.

## Self-Check: PASSED

- Created files exist: `.env.example`, `docs/btp-deployment-guide.md`, `docs/release-readiness.md`, and this summary.
- Modified files contain required Phase 8 links, evidence states, DOCS-06 mapping, and final smoke gates.
- Verification commands pass, including fixture secret and metadata gates.
- `.planning/STATE.md` remains unstaged and is not part of this executor's commit.

---
*Phase: 08-deployment-docs-and-release-readiness*
*Completed: 2026-06-03T22:54:20Z*
