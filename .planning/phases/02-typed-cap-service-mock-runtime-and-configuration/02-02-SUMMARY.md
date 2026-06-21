---
phase: 02-typed-cap-service-mock-runtime-and-configuration
plan: 02
subsystem: runtime
tags: [sap-cap, n8n, mock-runtime, configuration, vitest]

requires:
  - phase: 02-01
    provides: Typed CAP service start contract and shared start result envelope
provides:
  - CAP-native `kind: 'mock' | 'webhook'` runtime resolver with sanitized webhook config validation
  - Deterministic offline `MockN8nWorkflowService` with in-memory start records
  - Package bootstrap selection for mock or webhook service implementations
affects: [phase-02, phase-03, cap-n8n-plugin, demo-app, integration-tests]

tech-stack:
  added: []
  patterns:
    - CAP service runtime selection through `cds.requires.n8n.kind`
    - Deterministic CAP test double with future-compatible execution record shape
    - Sanitized configuration errors that omit credential values

key-files:
  created:
    - cap-n8n-plugin/lib/config.js
    - cap-n8n-plugin/lib/MockN8nWorkflowService.js
    - test/integration/n8n-mock-and-profiles.test.js
  modified:
    - cap-n8n-plugin/cds-plugin.js
    - cap-n8n-plugin/lib/N8nWorkflowService.js
    - cap-n8n-plugin/index.js
    - cap-n8n-plugin/package.json
    - demo-app/package.json

key-decisions:
  - "Runtime selection uses `kind: 'mock' | 'webhook'`, while explicit `cds.env.requires.n8n.impl` always wins."
  - "The webhook service validates `baseUrl` through the shared resolver instead of silently defaulting to localhost."
  - "Mock executions are process-memory start records only; query/cancel remain Phase 3 scope."

patterns-established:
  - "Config-first runtime selection: resolve config in a pure helper, then let bootstrap and services consume it."
  - "Mock failure is explicit opt-in through `mock.failWorkflows` or `failWorkflows`."

requirements-completed: [RUNTIME-01, RUNTIME-02, RUNTIME-03, CAPAPI-01, CAPAPI-02, CAPAPI-03]

duration: 6 min
completed: 2026-05-31
---

# Phase 02 Plan 02: Mock Runtime and Configuration Summary

**CAP-native mock/webhook runtime selection with deterministic offline workflow starts and sanitized webhook configuration validation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-31T22:14:17Z
- **Completed:** 2026-05-31T22:20:14Z
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments

- Added `resolveN8nConfig` and `assertWebhookConfig` for `kind: 'mock' | 'webhook'`, development mock fallback, optional API keys, timeout/retry defaults, and sanitized missing-`baseUrl` errors.
- Added `MockN8nWorkflowService`, a CAP service test double that returns deterministic `mock-exec-*` IDs and stores future-compatible in-memory start records.
- Wired bootstrap selection so missing `impl` resolves to mock or webhook based on config, while explicit implementation overrides remain untouched.
- Refreshed the demo binding to declare `kind: "webhook"` without removing `impl`, `baseUrl`, `apiKey`, or port `3000`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add config/profile resolver tests** - `73cfc62` (test, RED)
2. **Task 2: Implement runtime configuration resolution** - `1777758` (feat, GREEN)
3. **Task 3: Add deterministic mock workflow service** - `c32b95b` (test, RED) and `56a3779` (feat, GREEN)
4. **Task 4: Wire mock/webhook selection into package bootstrap and demo config** - `f870338` (feat)

## Files Created/Modified

- `cap-n8n-plugin/lib/config.js` - Pure runtime resolver and sanitized webhook config assertion.
- `cap-n8n-plugin/lib/MockN8nWorkflowService.js` - Offline deterministic CAP mock service.
- `test/integration/n8n-mock-and-profiles.test.js` - Integration coverage for config/profile behavior, mock runtime behavior, and bootstrap selection.
- `cap-n8n-plugin/cds-plugin.js` - Runtime implementation selection by resolved kind.
- `cap-n8n-plugin/lib/N8nWorkflowService.js` - Webhook service now validates config through the resolver.
- `cap-n8n-plugin/index.js` - Public package entry exports the mock service.
- `cap-n8n-plugin/package.json` - Adds `cap-n8n-plugin/mock-service` export.
- `demo-app/package.json` - Declares local real n8n binding as `kind: "webhook"`.

## Verification

- `npx vitest run test/integration/n8n-mock-and-profiles.test.js` - PASS, 7 tests after Task 3.
- `npx vitest run test/integration/n8n-mock-and-profiles.test.js test/smoke/package-boundaries.test.js` - PASS, 12 tests.
- `npx vitest run test/integration/n8n-service-contract.test.js test/integration/n8n-mock-and-profiles.test.js test/smoke/package-boundaries.test.js` - PASS, 15 tests.
- `node -e "const {resolveN8nConfig}=require('./cap-n8n-plugin/lib/config'); if(resolveN8nConfig({kind:'mock'}).kind!=='mock') process.exit(1); if(resolveN8nConfig({credentials:{baseUrl:'http://x'}}).kind!=='webhook') process.exit(1)"` - PASS.

## Decisions Made

- `kind` is the runtime selector because it aligns with CAP service configuration vocabulary and the Phase 2 context.
- Webhook mode requires `baseUrl` even when the concrete webhook service is explicitly selected; development fallback belongs to bootstrap/runtime selection, not to the webhook transport itself.
- The mock runtime records only start attempts in process memory and intentionally does not add query or cancel methods in Phase 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Enforced baseUrl validation in the concrete webhook service**
- **Found during:** Task 4 (Wire mock/webhook selection into package bootstrap and demo config)
- **Issue:** The resolver enforced missing-`baseUrl` errors, but an app that explicitly selected `cap-n8n-plugin/service` could still use the old webhook service default and silently target localhost.
- **Fix:** Updated `N8nWorkflowService` to resolve webhook config through `resolveN8nConfig({ ...options, kind: 'webhook' })`, removing the silent default.
- **Files modified:** `cap-n8n-plugin/lib/N8nWorkflowService.js`
- **Verification:** Existing service-contract tests plus mock/profile and package-boundary tests passed.
- **Committed in:** `f870338`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required for RUNTIME-03 correctness. Scope stayed inside the planned runtime/config files.

## Issues Encountered

None.

## Known Stubs

None - stub scan found no TODO/FIXME placeholders or UI-rendered empty mock data in files changed by this plan.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - new runtime selection, config validation, and mock memory behavior were already covered by the plan threat model.

## Next Phase Readiness

Ready for Plan 02-03 to add timeout/retry and structured transport errors on top of the shared config defaults and webhook service validation.

## Self-Check: PASSED

- Created files found: `cap-n8n-plugin/lib/config.js`, `cap-n8n-plugin/lib/MockN8nWorkflowService.js`, `test/integration/n8n-mock-and-profiles.test.js`.
- Modified files found: `cap-n8n-plugin/cds-plugin.js`, `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/index.js`, `cap-n8n-plugin/package.json`, `demo-app/package.json`.
- Task commits found: `73cfc62`, `1777758`, `c32b95b`, `56a3779`, `f870338`.
- Final plan verification passed: `npx vitest run test/integration/n8n-mock-and-profiles.test.js test/smoke/package-boundaries.test.js`.

---
*Phase: 02-typed-cap-service-mock-runtime-and-configuration*
*Completed: 2026-05-31*
