---
phase: 08-deployment-docs-and-release-readiness
plan: 01
subsystem: testing
tags: [release-readiness, smoke, npm, cap, n8n]

requires:
  - phase: 05-workflow-import-and-build-validation
    provides: n8n workflow validation command and demo-app generated workflow artifacts
  - phase: 07-n8n-mutations-and-cap-actions-functions
    provides: deterministic n8n node build and integration test coverage
provides:
  - Root review:local command for deterministic local release readiness checks
  - Warning classification for automated review command output
  - Smoke gates protecting the review command and secret-safe source boundary
affects: [phase-08, release-readiness, local-review]

tech-stack:
  added: []
  patterns:
    - Fixed child-process command arrays through node/npm CLI resolution
    - Bounded CAP CSN stdout summaries for review commands
    - Static source gates for review-command determinism and credential safety

key-files:
  created:
    - scripts/review-local.js
    - test/smoke/release-readiness.test.js
  modified:
    - package.json

key-decisions:
  - "review:local runs npm test, n8n workflow validation, and CAP compile including demo-app/n8n only."
  - "CAP compile stdout is summarized by byte and line count while stderr and exit code remain visible."
  - "Node DEP0190 output from current n8n node tooling is classified as accepted tooling warning; unclassified warning-like stderr fails the command."

patterns-established:
  - "Release review helpers should use fixed command arrays and avoid shell interpolation."
  - "Smoke tests should guard release command scope and source-level credential boundaries."

requirements-completed: [DOCS-07, VERIFY-06]

duration: 8min
completed: 2026-06-03T22:13:28Z
---

# Phase 8 Plan 1: Local Release Readiness Summary

**Deterministic local release review command with bounded CAP compile output, warning classification, and secret-safe smoke gates**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-03T22:05:41Z
- **Completed:** 2026-06-03T22:13:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `npm run review:local` as the root deterministic review command.
- Added `scripts/review-local.js` to run `npm test`, workflow annotation validation, and CAP compile including `demo-app/n8n`.
- Added smoke coverage that fails if the review command is removed, widened into live/manual n8n work, loses D-24 warning labels, or embeds credential-like source material.

## Task Commits

Per the execution request, both plan tasks and this summary are captured in one atomic 08-01 plan commit rather than separate per-task commits.

1. **Task 1: Add deterministic review:local command** - included in final plan commit.
2. **Task 2: Add static release-readiness smoke gates** - included in final plan commit.

## Files Created/Modified

- `package.json` - Added the root `review:local` npm script.
- `scripts/review-local.js` - Added the deterministic command runner with D-24 warning classification and bounded CAP CSN stdout.
- `test/smoke/release-readiness.test.js` - Added static gates for the root script, deterministic command list, excluded manual/live surfaces, warning labels, and credential-like source patterns.
- `.planning/phases/08-deployment-docs-and-release-readiness/08-01-SUMMARY.md` - Captures execution evidence.

## Decisions Made

- `review:local` resolves npm through the npm CLI JavaScript entry when possible so Windows execution stays shell-free and reliable.
- Live n8n UI evidence remains labeled `manual/UAT evidence required` and is not part of `review:local`.
- The known `DEP0190` warning from current n8n node tooling is accepted explicitly; other warning-like stderr is treated as `fix before release`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Windows npm launcher failure**
- **Found during:** Task 1 verification
- **Issue:** Spawning `npm.cmd` directly returned `EINVAL` on this Windows shell.
- **Fix:** Resolve `process.env.npm_execpath` or the adjacent npm CLI file and spawn it through `node` with fixed arguments, falling back to the platform npm launcher only when needed.
- **Files modified:** `scripts/review-local.js`
- **Verification:** `npm run review:local` passes.

**2. [Rule 1 - Bug] Prevented smoke source gates from matching their own token patterns**
- **Found during:** Task 2 focused smoke verification
- **Issue:** The new credential-source gate initially matched literal forbidden patterns declared inside the test itself.
- **Fix:** Build those regexes from split fragments so the test can detect bad source values without embedding them contiguously.
- **Files modified:** `test/smoke/release-readiness.test.js`
- **Verification:** `npx vitest run test/smoke/release-readiness.test.js` passes.

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were required for deterministic local verification. No scope was added beyond the planned files.

## Issues Encountered

- `npm run review:local` observes Node `DEP0190` from current n8n node tooling and classifies it as `accepted tooling warning`.
- `.planning/STATE.md` had pre-existing phase-start changes before this plan execution and was not staged with the plan-owned files.

## Known Stubs

None.

## Threat Flags

None. The new developer-shell command runner and release-evidence output surfaces are covered by the plan threat model.

## Verification

- `npx vitest run test/smoke/release-readiness.test.js` - passed
- `node scripts/review-local.js --list` - passed
- `npm run review:local` - passed
- `npm run smoke -- --run test/smoke/package-boundaries.test.js test/smoke/release-readiness.test.js` - passed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Phase 08 Plan 02. The automated local review command is available; real n8n UI and cancellation evidence remain separate manual/UAT artifacts for later Phase 8 plans.

## Self-Check: PASSED

- Created files exist: `scripts/review-local.js`, `test/smoke/release-readiness.test.js`, `.planning/phases/08-deployment-docs-and-release-readiness/08-01-SUMMARY.md`
- Modified root script exists: `package.json` contains `review:local`
- Required verification commands passed.

---
*Phase: 08-deployment-docs-and-release-readiness*
*Completed: 2026-06-03T22:13:28Z*
