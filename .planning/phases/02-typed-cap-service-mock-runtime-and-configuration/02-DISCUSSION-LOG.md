# Phase 2: Typed CAP Service, Mock Runtime, and Configuration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 2-Typed CAP Service, Mock Runtime, and Configuration
**Areas discussed:** Start Contract And Workflow Identity, Mock Runtime Semantics, Profile And Credential Defaults, Retry, Timeout, And CDS Errors, Cross-Direction Data Contract

---

## Start Contract And Workflow Identity

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| What should `workflowId` mean to CAP developers in Phase 2? | Webhook path; Real n8n workflow ID; Plugin workflow alias; Other | Webhook path |
| What should `start()` return when the webhook response does not include an n8n execution ID? | Structured result with optional `executionId`; Strict execution ID required; Raw webhook response; Other | Structured result with optional `executionId` |
| How should CAP developers call it? | Convenience method plus CAP event; CAP event only; Object-only method; Other | Convenience method plus CAP event |
| Which extra call metadata should Phase 2 allow now? | Minimal options only; Retry/timeout overrides per call; Business tracking fields now; Other | Minimal options only |

**Notes:** Phase 2 keeps workflow identity as a webhook path because that matches the current implementation and works before workflow import exists. The result envelope should tolerate missing n8n execution IDs.

---

## Mock Runtime Semantics

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| What should the Phase 2 mock primarily guarantee? | Deterministic CAP test double; Webhook-like fake n8n; Mini execution simulator; Other | Deterministic CAP test double |
| How far should in-memory execution state go in Phase 2? | Start records only with future-compatible shape; Start plus auto-complete state transition; Full start/query/cancel mock now; Other | Start records only with future-compatible shape |
| Should the mock support deterministic failure paths in Phase 2? | Explicit opt-in failures only; Always success in Phase 2; Realistic random/timed failures; Other | Explicit opt-in failures only |
| How should developers select the mock? | Profile/config selected, with development fallback; Always mock in development; Explicit mock only; Other | Profile/config selected, with development fallback |

**Notes:** User explicitly approved the minimal Phase 2 mock state only if the Phase 3 expansion is not forgotten. CONTEXT.md captures this as a Phase 3 handoff.

---

## Profile And Credential Defaults

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| What config vocabulary should Phase 2 prefer? | `cds.requires.n8n.kind` / `mode` with standard CAP profiles; Separate service names per runtime; Environment variables only; Other | `cds.requires.n8n.kind` / `mode` with standard CAP profiles |
| Which vocabulary should the config expose? | Runtime-oriented names; Environment-oriented names; Boolean mock flag; Other | Runtime-oriented names |
| When should startup fail instead of falling back to mock? | Fail outside development unless explicitly mock; Always fallback to mock if config is missing; Never fallback automatically; Other | Fail outside development unless explicitly mock |
| Which credential fields should Phase 2 treat as required for real webhook mode? | `baseUrl` required, auth optional unless configured; `baseUrl` and `apiKey` always required; `baseUrl`, `apiKey`, and workflow mapping required; Other | `baseUrl` required, auth optional unless configured |

**Notes:** The preferred vocabulary is `kind: 'mock' | 'webhook'`, with normal CAP profile mechanics handling development, production, and other environments.

---

## Retry, Timeout, And CDS Errors

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| What should real webhook mode do by default? | Conservative retry policy; No retries by default; Aggressive retries; Other | Conservative retry policy |
| What should the default timeout be for `start()` calls? | Short request timeout; Longer workflow-style timeout; No plugin timeout; Other | Short request timeout |
| How should Phase 2 handle retry ambiguity? | Warn and expose correlation metadata; Disable retries unless `correlationId` is provided; Generate and persist dedupe records now; Other | Warn and expose correlation metadata |
| What should failed `start()` calls expose to CAP callers? | Structured sanitized CDS errors; Original n8n error body where available; Generic CAP error only; Other | Structured sanitized CDS errors |

**Notes:** Retries are useful but ambiguous for side-effecting workflow starts. Phase 2 exposes correlation metadata and warnings; Phase 3 owns durable duplicate detection.

---

## Cross-Direction Data Contract

**User's question:** Have we thought about a data definition that makes sure both directions work when CAP and n8n speak to each other? CAP has much stronger type safety than n8n.

**Captured decision:** Treat this as a cross-phase design constraint. Phase 2 should define schema-friendly runtime envelopes, while Phase 5 handles typed workflow import/build validation and Phases 6/7 handle CAP OData metadata discovery and n8n-side validation/UI guidance.

---

## the agent's Discretion

- Choose exact helper/module/test names.
- Choose exact config field name if needed, with `kind` preferred.
- Design implementation details within CAP CommonJS conventions.

## Deferred Ideas

- Full execution store, query, cancel, and duplicate detection are deferred to Phase 3.
- Workflow import/generated typings/build validation are deferred to Phase 5.
- n8n node metadata discovery and operation typing are deferred to Phases 6 and 7.
