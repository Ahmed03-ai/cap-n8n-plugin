---
phase: 02-typed-cap-service-mock-runtime-and-configuration
plan: 03
subsystem: runtime
tags: [sap-cap, n8n, webhook, retry, timeout, sanitized-errors, vitest]

requires:
  - phase: 02-01
    provides: Typed CAP service start contract and schema-friendly start result envelope
  - phase: 02-02
    provides: Runtime selection and shared n8n configuration resolver
provides:
  - Deterministic webhook reliability integration tests using local HTTP servers
  - Sanitized structured n8n transport errors for CAP callers
  - Configurable webhook timeout, retry count, and retry delay defaults
  - Webhook transport with optional API-key header, AbortController timeout, transient retries, and safe retry logging
affects: [phase-02, phase-03, cap-n8n-plugin, integration-tests]

tech-stack:
  added: []
  patterns:
    - Local HTTP-server Vitest coverage for webhook transport behavior
    - Structured n8n Error objects with enumerable safe fields
    - Bounded retry loop using config-resolved total attempts and exponential backoff

key-files:
  created:
    - cap-n8n-plugin/lib/errors.js
    - test/integration/n8n-webhook-runtime.test.js
  modified:
    - cap-n8n-plugin/lib/N8nWorkflowService.js
    - cap-n8n-plugin/lib/config.js

key-decisions:
  - "Webhook retries treat `retries` as total attempts, with a minimum of one request."
  - "HTTP 502, 503, and 504 plus network/timeout failures are retryable; HTTP 400, 401, 403, 404, and 500 are not retried by default."
  - "Transport errors expose sanitized machine-readable fields while omitting headers, API keys, request payloads, stack traces, and configured secret values."

patterns-established:
  - "Transport failures are normalized through `createN8nError` before reaching CAP callers."
  - "Retry ambiguity is logged with workflow ID, attempt metadata, status/code, and correlation ID when supplied."
  - "Webhook config resolves `timeoutMs`, `retries`, and `retryDelayMs` at service initialization rather than per call."

requirements-completed: [RUNTIME-04, RUNTIME-05, CAPAPI-02, CAPAPI-03]

duration: 5 min
completed: 2026-05-31
---

# Phase 02 Plan 03: Webhook Reliability Runtime Summary

**Webhook runtime with bounded timeout, transient retries, optional n8n API-key forwarding, and sanitized CAP-visible transport errors**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-31T22:26:45Z
- **Completed:** 2026-05-31T22:31:50Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- Added deterministic webhook reliability integration tests backed by local `node:http` servers, with no Docker or live n8n dependency.
- Added `cap-n8n-plugin/lib/errors.js` for structured sanitized n8n errors and retryable status classification.
- Extended `resolveN8nConfig` with explicit `timeoutMs`, `retries`, and `retryDelayMs` defaults and overrides.
- Updated real webhook mode to use `AbortController`, optional `X-N8N-API-KEY`, transient retries, safe retry logging, and schema-friendly success envelopes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add webhook reliability integration tests** - `eb59d4f` (test, RED)
2. **Task 2: Implement sanitized n8n error helpers** - `2473cb5` (feat)
3. **Task 3: Add timeout and retry configuration defaults** - `47677fd` (feat)
4. **Task 4: Implement webhook timeout, retry, auth, and sanitized failures** - `efa1b43` (feat)

## Files Created/Modified

- `test/integration/n8n-webhook-runtime.test.js` - Integration coverage for optional auth headers, retry behavior, non-retryable status handling, timeout aborts, and sanitized errors.
- `cap-n8n-plugin/lib/errors.js` - Error factory and retryable status helper for safe CAP-visible n8n failures.
- `cap-n8n-plugin/lib/config.js` - Reliability defaults and normalized overrides for timeout, retries, and retry delay.
- `cap-n8n-plugin/lib/N8nWorkflowService.js` - Reliable webhook transport with timeout, bounded retry, safe logging, and structured error conversion.

## Decisions Made

- `retries` is interpreted as total attempts, not extra retries, so `retries: 1` means one bounded request.
- HTTP 502/503/504 and network/timeout failures are retryable because they are transient; HTTP 400/401/403/404 and HTTP 500 are surfaced immediately as non-retryable structured errors.
- Error details preserve safe diagnostics such as workflow ID, status, attempt count, timeout, and correlation ID, while omitting request payloads, headers, API keys, stack traces, and configured secret values.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first RED run exposed a new test helper merge issue where `credentials` overrides replaced `baseUrl`. The helper was corrected before the Task 1 commit so the RED failure represented the intended missing runtime behavior.

## Verification

- `npx vitest run test/integration/n8n-webhook-runtime.test.js` - RED gate failed as expected after helper correction: retry, timeout, and structured-error assertions failed against the old runtime.
- `node -e "const e=require('./cap-n8n-plugin/lib/errors'); if(!e.isRetryableStatus(502)||e.isRetryableStatus(400)) process.exit(1); const err=e.createN8nError({message:'failed',statusCode:500,retryable:true,details:{apiKey:'secret',safe:'ok'}}); if(err.source!=='n8n'||err.details.apiKey||err.details.safe!=='ok') process.exit(1)"` - PASS.
- `node -e "const {resolveN8nConfig}=require('./cap-n8n-plugin/lib/config'); const c=resolveN8nConfig({kind:'webhook',credentials:{baseUrl:'http://x'}}); if(c.timeoutMs!==10000||c.retries!==3) process.exit(1)"` - PASS.
- `npx vitest run test/integration/n8n-webhook-runtime.test.js test/integration/n8n-service-contract.test.js` - PASS, 2 files and 8 tests.
- `npx vitest run test/integration/n8n-webhook-runtime.test.js test/integration/n8n-service-contract.test.js test/integration/n8n-mock-and-profiles.test.js test/smoke/package-boundaries.test.js` - PASS, 4 files and 20 tests.

## Known Stubs

None - stub scan found no TODO/FIXME placeholders or UI-rendered empty mock data in files changed by this plan. Empty object/array defaults in helpers and tests are intentional function defaults or local request capture state.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - the new outbound webhook timeout/retry/error surface is the planned trust boundary for this plan and is covered by mitigations T-02-07 through T-02-10.

## Next Phase Readiness

Plan 02-03 satisfies RUNTIME-04 and RUNTIME-05 for real webhook mode. Phase 2 can proceed to VERIFY-01 coverage consolidation in Plan 02-04, while durable duplicate detection and persisted execution tracking remain Phase 3 scope.

## Self-Check: PASSED

- Created files found: `cap-n8n-plugin/lib/errors.js`, `test/integration/n8n-webhook-runtime.test.js`, and this SUMMARY file.
- Modified files found: `cap-n8n-plugin/lib/N8nWorkflowService.js` and `cap-n8n-plugin/lib/config.js`.
- Task commits found: `eb59d4f`, `2473cb5`, `47677fd`, and `efa1b43`.
- Final plan verification passed: `npx vitest run test/integration/n8n-webhook-runtime.test.js test/integration/n8n-service-contract.test.js`.

---
*Phase: 02-typed-cap-service-mock-runtime-and-configuration*
*Completed: 2026-05-31*
