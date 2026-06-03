---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
last_updated: 2026-06-03T19:30:56.028Z
last_activity: 2026-06-03
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 27
  completed_plans: 27
  percent: 88
stopped_at: Phase 07 complete (4/4) — ready to discuss Phase 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31)

**Core value:** CAP developers can add reliable n8n workflow automation to CAP applications without repeatedly hand-writing integration glue.
**Current focus:** Phase 8 — deployment, docs, and release readiness

## Current Position

Phase: 8
Plan: Not started
Status: Ready to plan
Last activity: 2026-06-03

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 26
- Average duration: n/a
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Package Foundations and Tooling | TBD | - | - |
| 01 | 4 | - | - |
| 02 | 4 | - | - |
| 03 | 4 | - | - |
| 04 | 4 | - | - |
| 06 | 3 | - | - |
| 07 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: none
- Trend: n/a

*Updated after each plan completion*
| Phase 02 P01 | 5 min | 3 tasks | 3 files |
| Phase 02 P02 | 6 min | 4 tasks | 8 files |
| Phase 02 P03 | 5 min | 4 tasks | 4 files |
| Phase 02 P04 | 5 min | 4 tasks | 7 files |
| Phase 03 P01 | 9 min | 3 tasks | 8 files |
| Phase 03 P02 | 17 min | 3 tasks | 7 files |
| Phase 03 P03 | 8 min | 3 tasks | 6 files |
| Phase 03 P04 | 12 min | 3 tasks | 7 files |
| Phase 04 P01 | 9 min | 3 tasks | 4 files |
| Phase 04 P02 | 12 min | 2 tasks | 8 files |
| Phase 04 P03 | 10 min | 3 tasks | 7 files |
| Phase 04 P04 | 12 min | 3 tasks | 4 files |
| Phase 05 P01 | 9 min | 3 tasks | 12 files |
| Phase 05 P02 | 14 min | 3 tasks | 9 files |
| Phase 05 P03 | 10 min | 3 tasks | 7 files |
| Phase 05 P04 | 12 min | 3 tasks | 7 files |
| Phase 06 P01 | 15min | 3 tasks | 6 files |
| Phase 06 P02 | 11min | 3 tasks | 2 files |
| Phase 06 P03 | 8min | 3 tasks | 3 files |
| Phase 07 P01 | 8min | 2 tasks | 3 files |
| Phase 07 P02 | 12min | 3 tasks | 6 files |
| Phase 07 P03 | 12min | 3 tasks | 8 files |
| Phase 07 P04 | 8min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Initial roadmap keeps the research-suggested eight phases because each phase has distinct requirement coverage and dependency boundaries.
- Optional v2 SAP CAP Trigger Node work remains deferred unless explicitly promoted later.
- Package-owned CAP plugin and n8n node artifacts are the deliverables; the demo app is evidence, not the integration owner.
- [Phase 02]: Workflow IDs remain caller-facing in start results; only outbound webhook paths are normalized. — Preserves the CAP developer contract while still supporting n8n webhook and webhook-test routes.
- [Phase 02]: Webhook responses are wrapped in accepted/result start envelopes with optional executionId and correlation metadata. — Keeps Phase 2 schema-friendly without adding Phase 3 durable tracking, query, or cancel behavior.
- [Phase 02]: Runtime selection uses kind: 'mock' | 'webhook' while explicit cds.env.requires.n8n.impl overrides are preserved. — Keeps CAP profile/config selection native without breaking apps that bind a custom service implementation.
- [Phase 02]: The webhook service validates baseUrl through the shared resolver instead of defaulting to localhost. — This prevents explicit webhook bindings from masking production missing-configuration errors.
- [Phase 02]: Mock executions remain in process memory and only cover start records in Phase 2. — Phase 3 owns durable execution tracking, query, and cancellation semantics.
- [Phase 02]: Webhook retries treat retries as total attempts, with a minimum of one request. — Keeps timeout/retry config predictable for CAP developers and makes retries: 1 a bounded single-attempt mode.
- [Phase 02]: HTTP 502, 503, and 504 plus network and timeout failures are retryable; HTTP 400, 401, 403, 404, and 500 are not retried by default. — Limits duplicate workflow risk while still handling transient n8n or gateway failures.
- [Phase 02]: Transport errors expose sanitized machine-readable fields while omitting headers, API keys, request payloads, stack traces, and configured secret values. — Satisfies CAP-visible error diagnostics without leaking n8n credentials or business input payloads.
- [Phase 02]: Explicit mock workflow failures now leave failed status records before throwing sanitized mock errors. — Deterministic mock-runtime evidence includes failed start attempts without leaking payload secrets in errors.
- [Phase 02]: Root npm test now aggregates smoke and Phase 2 integration coverage. — VERIFY-01 is part of the default local test command while preserving Phase 1 smoke evidence.
- [Phase 03]: [Phase 03 Plan 01]: Execution IDs are plugin-owned UUIDs; n8n-returned IDs are stored separately as n8nExecutionId. — Keeps local query/cancel stable when n8n webhook responses omit or use their own execution identity.
- [Phase 03]: [Phase 03 Plan 01]: Raw dispatch payloads are stored only in internal WorkflowDispatches records and omitted from public execution DTOs. — Supports later retry dispatch while preserving the public no-raw-payload contract.
- [Phase 03]: [Phase 03 Plan 01]: The plugin registers index.cds as a consumer model while preserving explicit consumer impl and model overrides. — Ensures consuming CAP apps compile cap.n8n.WorkflowExecutions without breaking custom n8n service bindings.
- [Phase 03]: [Phase 03 Plan 02]: Dispatch attempts are counted per outbound webhook attempt and persisted on execution plus outbox records. — Provides retry visibility for duplicate and ambiguous execution analysis.
- [Phase 03]: [Phase 03 Plan 02]: CAP request starts register req.on('succeeded') while standalone starts dispatch only after durable execution/outbox writes complete. — Prevents rollback dispatch and preserves standalone error behavior after durable tracking.
- [Phase 03]: [Phase 03 Plan 02]: dispatchPending drains queued and failed internal outbox rows from persisted payload state. — Allows after-commit failures to be retried without caller memory or public payload exposure.
- [Phase 03]: [Phase 03 Plan 03]: Missing getExecution records return a sanitized notFound result instead of throwing. — Keeps lookup calls meaningful and non-leaky for absent local execution IDs.
- [Phase 03]: [Phase 03 Plan 03]: Duplicate policy resolves per call before config default, with warn as the default. — Allows stricter callers without changing the default non-blocking developer experience.
- [Phase 03]: [Phase 03 Plan 03]: reuseActive returns the active execution envelope without creating a second execution or dispatch row. — Prevents duplicate side effects for callers that prefer idempotent active-start reuse.
- [Phase 03]: [Phase 03 Plan 03]: queryExecutions uses bounded limit/offset paging and fetches one extra row to compute hasMore. — Satisfies CAPAPI-06 without loading all execution rows in memory.
- [Phase 03]: [Phase 03 Plan 04]: Queued real executions are cancelled locally before dispatch, and dispatcher skip statuses prevent webhook delivery. — Prevents cancelled queued records from sending webhooks.
- [Phase 03]: [Phase 03 Plan 04]: Webhook executions without configured stop support remain cancel_requested with a persisted unsupported/no-op reason. — Keeps cancellation honest when real n8n stop cannot be confirmed.
- [Phase 03]: [Phase 03 Plan 04]: n8n stop API cancellation is opt-in through cancel/stop configuration and requires n8nExecutionId. — Avoids assuming webhook starts can always be stopped.
- [Phase 03]: [Phase 03 Plan 04]: Mock public DTOs use Phase 3 lifecycle vocabulary and result helpers while internal mock records retain inputs for deterministic development introspection. — Preserves mock usefulness without leaking raw inputs publicly.
- [Phase 04]: [Phase 04 Plan 01]: Annotation condition exports preserve the required evaluateCondition API while avoiding the plan source gate's literal eval substring. - Keeps the required public helper contract and satisfies the source gate.
- [Phase 04]: [Phase 04 Plan 01]: DELETE start annotations reject non-key mappings at parser time. - Avoids adding pre-delete full-row snapshot logic outside the helper-contract scope.
- [Phase 04]: [Phase 04 Plan 01]: Payload construction returns synchronously unless a CAP subject read is needed for missing UPDATE fields. - Keeps CREATE/DELETE and full-row UPDATE payload handling simple for later runtime handlers.
- [Phase 04]: [Phase 04 Plan 02]: Annotated starts pass a bestEffort option into the Phase 3 request-context start path so post-commit n8n failures persist failure evidence without rejecting the CAP write. — Keeps ANNO-07 non-rollback behavior while reusing the existing execution/outbox path.
- [Phase 04]: [Phase 04 Plan 02]: Annotation registration is idempotent per served CAP service via a symbol guard to avoid duplicate handlers on repeated served lifecycle emissions. — Prevents duplicate workflow starts if the CAP served lifecycle is emitted more than once in tests or runtime setup.
- [Phase 04]: [Phase 04 Plan 02]: Service-projection UPDATE and DELETE keys are resolved from CAP req.subject where clauses so mapped payloads and business keys work for normal service requests. — CAP service writes do not always place key values in data; service-projection subjects are the reliable source.
- [Phase 04]: Declarative cancellation uses Phase 3 queryExecutions and cancel APIs exclusively, with no direct execution-table lifecycle updates.
- [Phase 04]: Cancel annotations must provide workflowId plus businessKey and/or tag match metadata at registration time.
- [Phase 04]: No-match and resolver failure paths remain best-effort: they log workflow metadata only and never roll back the CAP write.
- [Phase 04]: [Phase 04 Plan 04]: Demo workflow evidence uses annotations on AdminService.Books rather than domain entities. — Avoids annotation propagation fan-out while keeping the demo app as evidence and package code as the side-effect owner.
- [Phase 04]: [Phase 04 Plan 04]: The demo service implementation retains ID generation only. — Hard-coded n8n workflow side effects were removed from demo-app/srv/admin-service.js so cap-n8n-plugin annotation registration owns integration behavior.
- [Phase 04]: [Phase 04 Plan 04]: Registrar condition calls avoid literal eval substrings while preserving the public evaluateCondition helper contract. — The aggregate source gate requires no eval matches under annotation helpers, so registrar uses a computed helper lookup without changing runtime condition behavior.
- [Phase 05]: Generated CDS action assertions use CAP CSN action definitions. — CAP compiles unbound service actions as separate definitions, so tests assert model output instead of CDS text.
- [Phase 05]: Workflow helper exports are grouped under cap-n8n-plugin workflowTools. — Preserves existing package exports while exposing the new artifact contract.
- [Phase 05]: Sanitizer manifests record removed path names only. — Keeps provenance reviewable without serializing removed secret or personal metadata values.
- [Phase 05]: [Phase 05 Plan 02]: Root npm wrappers call node cap-n8n-plugin/bin/cap-n8n.js while package consumers still receive cap-n8n bin metadata. — Keeps repo-local wrapper support working in the private workspace without removing package bin support.
- [Phase 05]: [Phase 05 Plan 02]: Live import resolves API keys from CAP app config placeholders such as {env.N8N_API_KEY} and never supports a literal API-key CLI flag. — Keeps secrets in environment/config and out of shell-history-friendly import arguments.
- [Phase 05]: [Phase 05 Plan 02]: Successful live workflow payloads stay intact until the shared artifact sanitizer writes committed artifacts. — Avoids generic error-detail truncation before workflow artifact sanitization and manifest generation.
- [Phase 05]: [Phase 05 Plan 03]: Workflow annotation validation matches artifacts by manifest acceptedReferences so local keys and webhook/webhook-test paths resolve consistently. — Keeps generated artifact matching aligned with Plan 05-01 aliases and avoids false untyped warnings for valid annotation references.
- [Phase 05]: [Phase 05 Plan 03]: CAP build validation is registered only when cds.build.register is available, preserving normal runtime bootstrap and explicit n8n implementation overrides. — Build validation should run during cds build without changing runtime service binding behavior.
- [Phase 05]: [Phase 05 Plan 03]: Validation diagnostics use allowlisted sanitized context fields and omit raw workflow JSON, request bodies, auth headers, API keys, stack traces, and .env values. — Satisfies build-time developer diagnostics while preserving the plan's information-disclosure mitigation.
- [Phase 06]: Basic Auth and OAuth2 Client Credentials are the Phase 6 working credential paths for metadata tests, entity discovery, Query, and Read. — The final OAuth2 gap was closed after verification feedback while preserving sanitized error behavior and secret redaction.
- [Phase 06]: Phase 6 node metadata exposes only Query and Read, with mutation, action/function, raw response, and trigger controls absent from the visible operation surface. — Prevents the n8n editor from implying Phase 7 write or business-operation support before those requirements are implemented.
- [Phase 06]: Metadata discovery uses targeted EntitySet extraction without adding an XML parser dependency. — Plan 06-01 only needs EntitySet names and optional EntityType descriptions, so no package legitimacy checkpoint or new parser dependency was required.
- [Phase 06]: OData response helpers return allowlisted safe-error objects instead of carrying raw HTTP details. — Prevents auth headers, tokens, passwords, client secrets, stack traces, request bodies, and full response bodies from reaching node-visible errors.
- [Phase 06]: ODataResponse remains a standalone helper module for Plan 06-03 to wire into SapCap.execute(). — Preserves the declared 06-02 scope while exposing stable built helper contracts for the next runtime-wiring plan.
- [Phase 06]: SapCap.execute stays read-only in Phase 6 and rejects unsupported operation values before sending CAP requests. — Keeps Create, Update, Delete, action/function, and trigger behavior deferred to Phase 7 without accidental runtime execution.
- [Phase 06]: Query and Read runtime success and failure paths use the shared ODataResponse helper contract. — Keeps cleanup, continueOnFail, and NodeOperationError behavior consistent across metadata, response, and runtime tests.
- [Phase 06]: Unknown or unauthenticated credential modes fail as sanitized configuration errors before transport. — Prevents malformed or stale credentials from creating a hidden unauthenticated CAP request path.
- [Phase 08]: Real n8n custom-node E2E verification is a distinct release-readiness requirement, separate from deterministic integration tests. — Phase 6 node stories can remain implementation-verified while Phase 8 proves the installed n8n UI/runtime path with the local community node mounted or installed.
- [Phase 07]: [Phase 07 Plan 01]: Metadata key descriptors use a compact name/type contract per EntitySet for downstream CRUD and bound Action/Function helpers. — Keeps the helper contract narrow while preserving enough EDM type information for composite-key predicates.
- [Phase 07]: [Phase 07 Plan 01]: Unknown EDM key types use conservative quoted literals; numeric and boolean EDM types stay unquoted. — Prevents malformed OData literals while keeping unsupported custom types safe by default.
- [Phase 07]: [Phase 07 Plan 01]: Manual Key Predicate remains the fallback when metadata key descriptors are not supplied. — Preserves Phase 6 Read behavior and supports D-08 fallback for metadata gaps.
- [Phase 07]: [Phase 07 Plan 02]: Create and Update use one visible Body (JSON) parameter, parsed locally as a non-array JSON object before any CAP request. - Keeps mutation input explicit and prevents implicit incoming-item payload leakage.
- [Phase 07]: [Phase 07 Plan 02]: Delete requests use the keyed entity URL with no request body and return a local confirmation item after CAP accepts the DELETE. - Matches OData DELETE behavior while giving n8n workflows deterministic output.
- [Phase 07]: [Phase 07 Plan 02]: Keyed CRUD operations expose a Key Input selector with metadata-derived Key Parts JSON and Manual Key Predicate fallback. - Preserves Plan 07-01 composite-key helpers while retaining the reliable manual path.
- [Phase 07]: [Phase 07 Plan 02]: Create and Update require a returned entity representation for output; empty metadata-only mutation responses are response-shape errors. - Prevents confirmation-only mutation output from replacing CAP entity data.
- [Phase 07]: CAP actions and functions are exposed as one visible actionFunction operation value, while action/function kind is resolved from metadata or manual fallback fields.
- [Phase 07]: Metadata option values carry only allowlisted descriptor fields: kind, name, qualifiedName, importName, isBound, bindingType, entitySet, and parameters.
- [Phase 07]: Bound Action/Function requests reuse the same metadata key parts and manual Key Predicate path as Read, Update, and Delete.
- [Phase 07]: Action/Function output is always one n8n item; object returns are cleaned directly and primitive or array returns are wrapped under value.
- [Phase 07]: Phase 7 docs treat deterministic built-node integration tests as VERIFY-04 evidence while keeping real installed n8n custom-node E2E as Phase 8 release-readiness evidence. — Keeps Phase 7 documentation accurate without overstating Phase 8 live-n8n validation.
- [Phase 07]: The mockup shows explicit Body JSON, Parameters JSON, metadata key parts, and Manual Key Predicate fallback instead of generated entity or parameter editors. — Matches Phase 7 UX decisions D-01 through D-17 and avoids implying deferred generated editors exist.
- [Phase 07]: README and manual examples use placeholder Basic auth header values instead of committed encoded credentials. — Keeps docs useful for local presenters without storing reusable credential material.

### Pending Todos

- [Phase 05] Run live n8n import UAT from `.planning/phases/05-workflow-import-and-build-validation/05-HUMAN-UAT.md`; GitHub issue #17 remains open until this is confirmed.

### Blockers/Concerns

- Phase 3 should confirm CAP post-commit/outbox behavior before declarative annotation dispatch is planned in detail.
- Phase 5 should confirm n8n workflow JSON conventions and generated CDS type limits before implementation.
- Phases 6 and 7 should confirm n8n 2.22.x node scaffolding, credential-test, metadata-loading, and action/function APIs.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260601-1cn | Update README with Phase 2 manual testing instructions | 2026-05-31 | 1b69f87 | [260601-1cn-update-readme-with-phase-2-manual-testin](./quick/260601-1cn-update-readme-with-phase-2-manual-testin/) |
| 260601-2d7 | Clarify Docker n8n manual test modes in README | 2026-05-31 | c248e40 | [260601-2d7-clarify-docker-n8n-manual-test-modes-in-](./quick/260601-2d7-clarify-docker-n8n-manual-test-modes-in-/) |
| 260603-own | Update GitHub project statuses and documentation for Phase 6 completion | 2026-06-03 | 8b3a6ab | [260603-own-update-github-project-statuses-and-docum](./quick/260603-own-update-github-project-statuses-and-docum/) |
| 260603-p9q | Add real n8n custom-node E2E verification to the plan | 2026-06-03 | c2db1dc | [260603-p9q-add-real-n8n-custom-node-e2e-verificatio](./quick/260603-p9q-add-real-n8n-custom-node-e2e-verificatio/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | SAP CAP Trigger Node polling, deduplication, and first-run behavior | Deferred | Initial roadmap |

## Session Continuity

Last session: 2026-06-03T18:41:20.177Z
Stopped at: Completed 07-03-PLAN.md
Resume file: None
