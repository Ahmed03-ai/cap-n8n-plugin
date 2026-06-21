---
phase: 02-typed-cap-service-mock-runtime-and-configuration
verified: 2026-05-31T22:50:10Z
status: passed
score: 18/18 must-haves verified
overrides_applied: 0
---

# Phase 2: Typed CAP Service, Mock Runtime, and Configuration Verification Report

**Phase Goal:** CAP developers can connect to a typed `N8nWorkflowService`, start workflows reliably, and switch between mock and real n8n profiles.
**Verified:** 2026-05-31T22:50:10Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

Merged from ROADMAP success criteria and PLAN frontmatter; duplicate requirement restatements were deduplicated while preserving the roadmap contract.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CAP developer can connect with `cds.connect.to('n8n')`, call typed `start` with `workflowId` and inputs, and receive a clear execution result or correlation result. | VERIFIED | `N8nWorkflowService` extends `cds.Service`, registers `start`, and implements `async start(...)` in `cap-n8n-plugin/lib/N8nWorkflowService.js:34`, `:43`, `:48`; integration test connects through CAP and asserts `start` at `test/integration/n8n-service-contract.test.js:91-115`. |
| 2 | CAP developer can use a local mock runtime offline and see deterministic mock execution behavior for development and integration tests. | VERIFIED | `MockN8nWorkflowService` extends `cds.Service`, resolves `kind: 'mock'`, creates deterministic `mock-exec-*` IDs, and stores execution records in `cap-n8n-plugin/lib/MockN8nWorkflowService.js:34-72`; tests assert deterministic results and records at `test/integration/n8n-mock-and-profiles.test.js:131-173`. |
| 3 | CAP developer can switch between mock, local n8n, cloud n8n, and production profiles without changing application code. | VERIFIED | Config resolver selects `mock` or `webhook` from CAP options/env in `cap-n8n-plugin/lib/config.js:114-144`; plugin bootstrap selects implementation by resolved kind in `cap-n8n-plugin/cds-plugin.js:4-24`; tests cover mock/webhook selection at `test/integration/n8n-mock-and-profiles.test.js:216-251`. |
| 4 | Production startup fails with a clear sanitized error when required n8n base URL or credentials are missing. | VERIFIED | `assertWebhookConfig` throws `ERR_N8N_CONFIG` without credential values when webhook base URL is absent in `cap-n8n-plugin/lib/config.js:101-109`; bootstrap fails for plugin-selected webhook mode, and explicit webhook service binding fails at `cds.connect.to('n8n')` with the same sanitized error in spot-checks. |
| 5 | CAP developer receives structured sanitized CDS-compatible errors and configurable timeout/retry behavior for n8n communication failures. | VERIFIED | `N8nWorkflowService` uses `AbortController`, retry counts/delay, retryable status checks, and `createN8nError` in `cap-n8n-plugin/lib/N8nWorkflowService.js:64`, `:122-143`, `:164-191`; tests cover auth, 502 retry, 400 no retry, timeout, and sanitized 500 errors at `test/integration/n8n-webhook-runtime.test.js:93-267`. |
| 6 | `start(workflowId, inputs)` treats workflowId as webhook path per D-01 and preserves `webhook-test/...` paths. | VERIFIED | `normalizeWebhookPath` prefixes short names and preserves `webhook/` or `webhook-test/` in `cap-n8n-plugin/lib/result.js:8-25`; tests assert `/webhook/cap-test-trigger` and `/webhook-test/cap-test-trigger` at `test/integration/n8n-service-contract.test.js:103-108`, `:176-191`. |
| 7 | `n8n.start(workflowId, inputs)` is ergonomic while `n8n.send('start', ...)` remains compatible. | VERIFIED | Event handler delegates to `this.start(...)` at `cap-n8n-plugin/lib/N8nWorkflowService.js:43`; compatibility test calls `n8n.send('start', ...)` at `test/integration/n8n-service-contract.test.js:124-150`; mock service has the same event delegation at `cap-n8n-plugin/lib/MockN8nWorkflowService.js:40`. |
| 8 | Start result envelope is schema-friendly, includes optional `executionId`, and supports light metadata only. | VERIFIED | `createStartResult` emits `accepted`, `workflowId`, optional `executionId`, `correlationId`, `businessKey`, `result`, and optional `mock` without durable status/query fields in `cap-n8n-plugin/lib/result.js:31-46`; tests assert present and absent `executionId` at `test/integration/n8n-service-contract.test.js:83-170`. |
| 9 | Phase 2 does not implement durable tracking/query/cancel/type systems reserved for later phases. | VERIFIED | `MockN8nWorkflowService` stores process-memory start records only and tests assert no `query` or `cancel` APIs at `test/integration/n8n-mock-and-profiles.test.js:175-212`; no persistence model or query/cancel methods were introduced in phase-owned plugin files. |
| 10 | Mock runtime is a deterministic CAP test double, not a fake n8n HTTP server. | VERIFIED | Mock service is a `cds.Service` subclass with in-memory `executions` and no HTTP listener in `cap-n8n-plugin/lib/MockN8nWorkflowService.js:34-72`; tests connect with CAP service config, not a network port, at `test/integration/n8n-mock-and-profiles.test.js:132-173`. |
| 11 | Mock failures are explicit opt-in only and recorded deterministically. | VERIFIED | Failures come only from `mock.failWorkflows` / `failWorkflows` in `cap-n8n-plugin/lib/MockN8nWorkflowService.js:19-22`, then write a failed record before throwing at `:61-64`; tests assert opt-in failure and `status: 'failed'` at `test/integration/n8n-mock-and-profiles.test.js:175-208`. |
| 12 | CAP profiles use `kind: 'mock' | 'webhook'`; webhook requires baseUrl and auth is optional unless configured. | VERIFIED | `resolveN8nConfig` handles kind/profile fallback, base URL, optional API key, and webhook assertion in `cap-n8n-plugin/lib/config.js:53-144`; tests cover explicit mock, dev fallback, webhook baseUrl, optional apiKey, and production missing baseUrl at `test/integration/n8n-mock-and-profiles.test.js:46-127`. |
| 13 | Default retry policy uses 3 attempts for transient network/HTTP 502/503/504 and does not retry 400/401/403/404. | VERIFIED | Defaults and retryable statuses are defined in `cap-n8n-plugin/lib/config.js:2-4`, `:65-99` and `cap-n8n-plugin/lib/errors.js:1`, `:18-19`; tests assert 502 retry and 400 no retry at `test/integration/n8n-webhook-runtime.test.js:130-188`. |
| 14 | Default start timeout is around 10 seconds and globally configurable. | VERIFIED | `DEFAULT_TIMEOUT_MS = 10000` and normalized overrides are in `cap-n8n-plugin/lib/config.js:2`, `:119-125`; webhook timeout uses `AbortController` in `cap-n8n-plugin/lib/N8nWorkflowService.js:122-134`; timeout test overrides to 25ms at `test/integration/n8n-webhook-runtime.test.js:194-214`. |
| 15 | Retry ambiguity is logged/exposed with correlation metadata; durable duplicate detection remains Phase 3. | VERIFIED | Retry logging includes workflow ID, attempts, status/code, and correlation ID without inputs/secrets at `cap-n8n-plugin/lib/N8nWorkflowService.js:187-198`; retry test preserves `correlationId` on success at `test/integration/n8n-webhook-runtime.test.js:130-163`. |
| 16 | Errors include source, status when available, retryable flag, code/message, and safe details without stacks or secrets. | VERIFIED | `createN8nError` attaches enumerable safe fields and sanitizes detail keys/values in `cap-n8n-plugin/lib/errors.js:2-19`, `:97-113`; HTTP 500 test asserts API key, payload secret, and stack text are absent at `test/integration/n8n-webhook-runtime.test.js:220-267`. |
| 17 | Developers can run integration tests for CAP API, authentication, errors, retry behavior, and mock runtime without live Docker n8n. | VERIFIED | Root scripts define `test:integration` and aggregate it into `npm test` at `package.json:15-16`; local `npm run test:integration` passed with 3 files / 21 tests. |
| 18 | All Phase 2 requirement IDs are accounted for and covered by repeatable local verification. | VERIFIED | PLAN frontmatter declares CAPAPI-01, CAPAPI-02, CAPAPI-03, RUNTIME-01, RUNTIME-02, RUNTIME-03, RUNTIME-04, RUNTIME-05, VERIFY-01; `.planning/REQUIREMENTS.md:21-34`, `:86`, `:140-150`, `:187` maps all nine to Phase 2; `npm test` passed smoke + integration. |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `cap-n8n-plugin/lib/N8nWorkflowService.js` | Package-owned CAP service with `start`, event compatibility, webhook transport, timeout/retry/auth/errors | VERIFIED | Exists/substantive per `gsd-sdk verify.artifacts`; key logic at lines 2-4, 34-48, 54-91, 122-191. |
| `cap-n8n-plugin/lib/result.js` | Shared webhook path normalization and start-result envelope helper | VERIFIED | Exports `createStartResult` and `normalizeWebhookPath` at lines 8-46. |
| `cap-n8n-plugin/lib/config.js` | Runtime/profile resolver and webhook config assertion | VERIFIED | Exports `resolveN8nConfig` and `assertWebhookConfig`; defaults and resolution at lines 2-4, 101-151. |
| `cap-n8n-plugin/lib/MockN8nWorkflowService.js` | Deterministic offline CAP mock service | VERIFIED | CAP service class with deterministic records and opt-in failures at lines 34-76. |
| `cap-n8n-plugin/lib/errors.js` | Sanitized n8n error factory and retryable-status helper | VERIFIED | Retry status and sanitizer at lines 1-19, 97-119. |
| `cap-n8n-plugin/cds-plugin.js` | Bootstrap implementation selector | VERIFIED | Selects mock/webhook implementation by resolved kind at lines 4-24. |
| `cap-n8n-plugin/index.js` and `cap-n8n-plugin/package.json` | Public package exports for service and mock service | VERIFIED | Index exports both classes; package export map exposes `./service` and `./mock-service` at `cap-n8n-plugin/package.json:6-9`. |
| `package.json` | Root integration and aggregate test commands | VERIFIED | `test:integration` and aggregate `test` at lines 15-16. |
| `demo-app/package.json` | Demo binding remains package-bound and webhook-configured | VERIFIED | Uses `impl: "cap-n8n-plugin/service"`, `kind: "webhook"`, baseUrl, and env apiKey at lines 20-24. |
| `test/integration/*.test.js` and `test/smoke/package-boundaries.test.js` | Deterministic integration and package-boundary coverage | VERIFIED | Integration suite passed 3 files / 21 tests; smoke suite passed 1 file / 2 tests. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `N8nWorkflowService.js` | `result.js` | CommonJS require | WIRED | Automated exact-pattern check missed destructuring, but source imports `{ createStartResult, normalizeWebhookPath } = require('./result')` at `N8nWorkflowService.js:4` and uses them at `:54`, `:86`. |
| `n8n-service-contract.test.js` | `cap-n8n-plugin/service` | package subpath import | WIRED | Automated exact-pattern check missed `createRequire`, but test calls `require('cap-n8n-plugin/service')` at `test/integration/n8n-service-contract.test.js:77`. |
| `cds-plugin.js` | `MockN8nWorkflowService.js` / `N8nWorkflowService.js` | config-selected implementation | WIRED | `implementationForKind` returns the correct resolved implementation at `cds-plugin.js:4-9`; tests assert mock/webhook selection at `n8n-mock-and-profiles.test.js:216-239`. |
| `MockN8nWorkflowService.js` | `result.js` | shared result envelope | WIRED | Imports `createStartResult` at line 2 and returns it at lines 70-77. |
| `N8nWorkflowService.js` | `config.js` / `errors.js` | resolver plus sanitized transport errors | WIRED | Imports at lines 2-3; uses config in init and errors in HTTP/network paths at lines 36-41, 141-174. |
| `package.json` | `test/integration` | npm script | WIRED | `test:integration` invokes `vitest run test/integration` at `package.json:15`; `npm test` invokes it at line 16. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `N8nWorkflowService.js` | `workflowId`, `inputs`, `options` | `start(...)` / `send('start')` event data -> `_triggerWebhook` -> `fetch` JSON body -> HTTP response text | Yes | FLOWING: test server captures posted input and response is wrapped into result envelope. |
| `N8nWorkflowService.js` | `config`, `baseUrl`, `apiKey`, timeout/retry | CAP service options -> `resolveN8nConfig` -> init fields -> headers/timeout/retry loop | Yes | FLOWING: tests assert auth header only when apiKey is configured, timeout, retry, and missing config. |
| `MockN8nWorkflowService.js` | `executions`, `executionId`, `status` | CAP service start call -> in-memory record -> `createStartResult` result | Yes | FLOWING: tests assert `mock-exec-1`, `mock-exec-2`, success and failed records. |
| `errors.js` | sanitized error details | HTTP/network error details -> sensitive-value collection -> sanitizer -> Error fields | Yes | FLOWING: tests serialize errors and assert secrets/stacks/payloads are absent. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Integration suite is runnable and covers Phase 2 runtime behavior | `npm run test:integration` | Exit 0; 3 files / 21 tests passed | PASS |
| CAP model still compiles after runtime changes | `npm run cap:compile` | Exit 0; CSN emitted | PASS |
| Package-boundary smoke test still passes | `npm run smoke` | Exit 0; n8n-node build successful; 1 smoke file / 2 tests passed; existing DEP0190 warning only | PASS |
| Aggregate local verification runs smoke plus integration | `npm test` | Exit 0; smoke passed and 3 integration files / 21 tests passed | PASS |
| Workspace build still succeeds | `npm run build` | Exit 0; n8n-node build successful | PASS |
| Workspace package tests still pass | `npm test --workspaces --if-present` | Exit 0; CAP plugin package test and n8n-node lint/build passed | PASS |
| Production webhook config fails cleanly at plugin bootstrap when no baseUrl exists | `node -e "... require('./cap-n8n-plugin/cds-plugin'); cds.emit('bootstrap') ..."` | Exit 0; emitted `ERR_N8N_CONFIG n8n webhook runtime requires credentials.baseUrl or baseUrl.` | PASS |
| Explicit webhook service binding fails cleanly on CAP connect when no baseUrl exists | `node -e "... cds.env.requires.n8n={impl:'cap-n8n-plugin/service',kind:'webhook'}; cds.connect.to('n8n') ..."` | Exit 0; emitted `ERR_N8N_CONFIG n8n webhook runtime requires credentials.baseUrl or baseUrl.` | PASS |

### Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| Conventional/declared probes | `Get-ChildItem scripts -Recurse -Filter 'probe-*.sh'` and `rg 'probe-.*\.sh' phase artifacts` | No probes discovered | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CAPAPI-01 | 02-01, 02-02, 02-04 | CAP developer can connect to a typed `N8nWorkflowService` through `cds.connect.to('n8n')`. | SATISFIED | Service class/start method in `N8nWorkflowService.js:34-48`; CAP connect test at `n8n-service-contract.test.js:91-95`. |
| CAPAPI-02 | 02-01, 02-02, 02-03, 02-04 | CAP developer can start an n8n workflow programmatically with `workflowId` and input payload. | SATISFIED | `start(...)` posts JSON to normalized path; tests assert body/path at `n8n-service-contract.test.js:95-108`. |
| CAPAPI-03 | 02-01, 02-02, 02-03, 02-04 | CAP developer receives an execution identifier or clear result object after successful start. | SATISFIED | `createStartResult` optional fields at `result.js:31-46`; tests assert executionId present/absent at `n8n-service-contract.test.js:83-170`. |
| RUNTIME-01 | 02-02, 02-04 | CAP developer can use local mock n8n runtime without live n8n. | SATISFIED | Mock service is CAP/in-memory only; tests at `n8n-mock-and-profiles.test.js:131-173`; no Docker required by `npm run test:integration`. |
| RUNTIME-02 | 02-02, 02-04 | CAP developer can switch between mock, local n8n, cloud n8n, and production configuration through CAP profiles. | SATISFIED | Resolver and bootstrap select by CAP config/env at `config.js:114-144`, `cds-plugin.js:22-24`; tests at `n8n-mock-and-profiles.test.js:46-127`, `:216-251`. |
| RUNTIME-03 | 02-02, 02-04 | Production startup fails clearly when required n8n base URL or credentials are missing. | SATISFIED | `assertWebhookConfig` error at `config.js:101-109`; production bootstrap and explicit-connect spot-checks both emitted sanitized `ERR_N8N_CONFIG`. |
| RUNTIME-04 | 02-03, 02-04 | CAP developer receives structured, sanitized CDS-compatible errors for n8n communication failures. | SATISFIED | `createN8nError` in `errors.js:102-113`; HTTP 500 sanitization test at `n8n-webhook-runtime.test.js:220-267`. |
| RUNTIME-05 | 02-03, 02-04 | Transient n8n HTTP failures use configurable timeout and retry behavior. | SATISFIED | Defaults in `config.js:2-4`; retry/timeout transport at `N8nWorkflowService.js:64`, `:122-191`; tests at `n8n-webhook-runtime.test.js:130-214`. |
| VERIFY-01 | 02-04 | Developer can run integration tests for CAP API, authentication, errors, retry behavior, and mock runtime. | SATISFIED | `package.json:15-16`; `npm run test:integration` passed with 3 files / 21 tests and `npm test` passed smoke + integration. |

No orphaned Phase 2 requirements were found: `.planning/REQUIREMENTS.md` maps exactly these nine IDs to Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `cap-n8n-plugin/lib/errors.js` | 98 | `return {}` | INFO | Intentional sanitizer fallback for invalid/empty details; not user-visible stub data. |
| `cap-n8n-plugin/lib/config.js` | 45 | `return []` | INFO | Intentional no-profile fallback; populated when CAP profile env exists. |

Debt-marker scan found no unreferenced `TBD`, `FIXME`, or `XXX` markers in phase-touched source/test files.

### Human Verification Required

None. Phase 2 behavior is API/runtime code with deterministic local integration coverage. Live n8n/cloud end-to-end smoke remains later roadmap scope, not a Phase 2 blocker.

### Gaps Summary

No blocking gaps found. The phase goal is achieved in the codebase: the package exposes typed CAP service entry points, supports deterministic mock and real webhook profiles through CAP config, validates missing production webhook configuration, handles timeout/retry/auth safely, and provides repeatable integration verification.

---

_Verified: 2026-05-31T22:50:10Z_
_Verifier: the agent (gsd-verifier)_
