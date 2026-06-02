---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to discuss
last_updated: "2026-06-02T21:08:06.515Z"
last_activity: 2026-06-02
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 12
  completed_plans: 12
  percent: 38
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31)

**Core value:** CAP developers can add reliable n8n workflow automation to CAP applications without repeatedly hand-writing integration glue.
**Current focus:** Phase 4 - Declarative CAP Annotations

## Current Position

Phase: 4
Plan: Not started
Status: Ready to discuss
Last activity: 2026-06-02

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 12
- Average duration: n/a
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Package Foundations and Tooling | TBD | - | - |
| 01 | 4 | - | - |
| 02 | 4 | - | - |
| 03 | 4 | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3 should confirm CAP post-commit/outbox behavior before declarative annotation dispatch is planned in detail.
- Phase 5 should confirm n8n workflow JSON conventions and generated CDS type limits before implementation.
- Phases 6 and 7 should confirm n8n 2.22.x node scaffolding, credential-test, metadata-loading, and action/function APIs.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260601-1cn | Update README with Phase 2 manual testing instructions | 2026-05-31 | 1b69f87 | [260601-1cn-update-readme-with-phase-2-manual-testin](./quick/260601-1cn-update-readme-with-phase-2-manual-testin/) |
| 260601-2d7 | Clarify Docker n8n manual test modes in README | 2026-05-31 | c248e40 | [260601-2d7-clarify-docker-n8n-manual-test-modes-in-](./quick/260601-2d7-clarify-docker-n8n-manual-test-modes-in-/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | SAP CAP Trigger Node polling, deduplication, and first-run behavior | Deferred | Initial roadmap |

## Session Continuity

Last session: 2026-06-02T21:08:06.501Z
Stopped at: Phase 4 context gathered
Resume file: .planning/phases/04-declarative-cap-annotations/04-CONTEXT.md
