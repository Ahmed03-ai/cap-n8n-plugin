# Project Research Summary

**Project:** CAP n8n Integration
**Domain:** Developer-facing SAP CAP plugin plus n8n community node
**Researched:** 2026-05-28
**Confidence:** HIGH for foundation and architecture; MEDIUM for n8n version-specific lifecycle details

## Executive Summary

CAP n8n Integration is a two-surface developer product: a CAP plugin that lets CAP applications start, query, cancel, and declaratively trigger n8n workflows, and an n8n community node that lets n8n workflows read and write SAP CAP OData services. Experts should build this as two real packages in one npm workspace, not as demo-app logic: `cap-n8n-plugin` owns CAP service contracts, runtime behavior, annotations, import, validation, and execution state; `cap-n8n-node` owns n8n credentials, metadata discovery, OData operations, and n8n-native errors.

The recommended approach is to stabilize package boundaries and tooling first, then build a typed `N8nWorkflowService` with real and mock runtimes, then add transaction-safe declarative annotations, workflow import and build validation, and finally complete the n8n community-node surface. Use Node.js 22.16+, SAP CAP 9.9.x, pinned n8n 2.22.x, npm workspaces, CAP CommonJS for the plugin, TypeScript for the n8n node, Vitest integration tests, native `fetch`, and official n8n node tooling.

The highest risks are mistaking the Bookshop demo for the product, getting CAP transaction semantics wrong, leaking secrets through docs or fixtures, confusing n8n test webhooks with production webhooks, and overpromising cancel/query without durable execution correlation. Mitigate these by making package-owned artifacts the deliverables, using explicit blocking versus post-commit semantics, validating production credentials early, modeling webhook mode explicitly, and adding an execution store before lifecycle features and retries.

## Key Findings

### Recommended Stack

The stack should stay close to the current brownfield repository: npm workspaces, CommonJS CAP plugin code, Docker Compose for local n8n, and the existing CAP demo app. The major correction is to pin and localize tooling: Node.js `>=22.16 <25`, npm 11 lockfile v3, `@sap/cds@^9.9.1`, `@sap/cds-dk@^9.9.1`, `@cap-js/sqlite@^2.4.0`, `n8nio/n8n:2.22.4`, `@n8n/node-cli@0.32.1`, and `vitest@^4.1.7`.

**Core technologies:**
- Node.js 22.16+: satisfies both current CAP 9 and n8n 2.22 runtime requirements.
- npm workspaces: keeps CAP plugin, demo app, and n8n node in one repo without changing package management.
- SAP CAP 9.9.x: target framework for typed CDS service models, plugin bootstrap, profiles, and integration tests.
- n8n 2.22.x pinned runtime: prevents weekly release drift from breaking local workflows and node tooling.
- Vitest plus `cds.test()`: default integration test stack for CAP plugin behavior and demo smoke tests.
- Native `fetch` plus `AbortController`: sufficient for CAP-to-n8n HTTP calls, timeouts, and retry wrappers.
- `@n8n/node-cli` with TypeScript: required shape for n8n community-node build, lint, dev, credentials, and package metadata.
- `fast-xml-parser`: practical parser for CAP OData `$metadata` in the n8n node.

### Expected Features

The product must first feel native on both sides. For CAP, that means installable plugin packaging, `cds.connect.to('n8n')`, a typed `N8nWorkflowService`, profiles, mock mode, retries, structured errors, and integration tests. For n8n, that means a valid community-node package with `SAP CAP API` credentials, `$metadata` discovery, CRUD operations, response cleanup, and n8n-native error handling.

**Must have (table stakes):**
- Installable CAP plugin package with public entry point, peer dependency, and CAP auto-configuration.
- Typed CDS `N8nWorkflowService` exposing `start`, `cancel`, and `query`.
- Programmatic `start(workflowId, inputs)` with structured CDS errors.
- Local mock runtime for offline development and deterministic integration tests.
- Profile-aware configuration for development mock, local n8n, hybrid/cloud, and production.
- Timeout, retry classification, sanitized logging, and credential validation.
- Declarative `@n8n.workflow.start` for CREATE first, then UPDATE and DELETE.
- Scalar input mapping from CAP entities to workflow payloads.
- Installable n8n community-node package with valid metadata, build, lint, and dev scripts.
- n8n `SAP CAP API` credential type with Basic Auth, OAuth2 Client Credentials, and `$metadata` test.
- Dynamic entity discovery, Query, Read, Create, Update, Delete, OData response cleanup, and n8n-native errors.
- Integration tests as the primary verification language and quality gate.

**Should have (differentiators):**
- Workflow import from local JSON before live n8n import.
- Generated CDS typings for workflow inputs.
- `cds build` validation of annotation mappings against imported workflow types.
- Execution correlation store with business keys, tags, statuses, and pagination.
- Idempotency guidance and correlation IDs for workflow starts.
- CAP action/function invocation mode in the n8n node.
- Composite-key-aware n8n UI and OData path helpers.
- BTP and hybrid deployment guidance once runtime contracts stabilize.

**Defer (v2+ or later phase):**
- n8n polling trigger node, because it adds state, deduplication, and timestamp semantics.
- Conditional trigger expressions beyond basic annotation mapping.
- Declarative cancellation until execution correlation is durable.
- Live workflow import until local import and generation are stable.
- BTP staging end-to-end tests until local integration tests pass.
- Verified n8n community-node submission until package UX and metadata are stable.
- Bulk destructive operations, broad generic OData coverage, OData V2-first support, and managed n8n hosting.

### Architecture Approach

Build two package-owned product surfaces with the demo app as a consumer and proof point. `cap-n8n-plugin` should provide the CDS service model, real/mock runtimes, HTTP client, config resolver, error model, execution store, annotation registrar, workflow import CLI, build plugin, and public exports. `cap-n8n-node` should follow n8n's TypeScript package layout with credentials, one SAP CAP action node, metadata helpers, OData URL builders, response normalization, and optional later trigger node.

**Major components:**
1. CAP plugin bootstrap: registers CAP hooks, build plugin, and annotation handlers without overwriting consumer config.
2. Typed CAP service model: defines `start`, `cancel`, `query`, execution results, and query filters.
3. CAP real runtime: performs n8n webhook/API calls, retry/timeout handling, and CDS error normalization.
4. CAP mock runtime: stores deterministic in-memory executions for development and integration tests.
5. Execution store: persists correlation ID, execution ID, business key, source entity, status, attempts, timestamps, payload summaries, and errors.
6. Annotation registrar and mapper: scans CSN annotations, validates mapped paths, attaches handlers, and dispatches post-commit by default.
7. Workflow import CLI and build validator: imports local or remote workflow JSON, generates CDS types, and validates annotations during `cds build` without network access.
8. n8n credential type: stores CAP base URL and auth in n8n credentials with a `$metadata` test request.
9. n8n action node: implements Query, Read, Create, Update, Delete, and later Action/Function operations.
10. OData metadata and transport helpers: parse `$metadata`, build structured paths, handle composite keys, clean responses, and map CAP/OData errors.

### Critical Pitfalls

1. **Mistaking the demo for a finished plugin** - make phases deliver package-owned artifacts and smoke tests, not only Bookshop behavior.
2. **Getting CAP transaction semantics wrong** - programmatic calls may block and throw; declarative annotations should dispatch after successful persistence and must not roll back writes by default.
3. **Treating secrets as optional config** - require production HTTPS and credentials, use env/service bindings/n8n credentials, redact errors, and sanitize workflow fixtures.
4. **Confusing n8n test webhooks with production webhooks** - model webhook mode explicitly and validate paths before import, retry, or documentation.
5. **Overpromising execution lifecycle control** - add an execution store and n8n API permission model before cancel/query, business-key lookup, pagination, and retry promises.
6. **Retrying non-idempotent workflow starts without correlation** - add correlation IDs and attempt tracking before enabling broad retries.
7. **Building the n8n node outside n8n conventions** - scaffold metadata, credentials, TypeScript files, lint/dev scripts, and package naming before OData operations.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Package Foundations and Tooling

**Rationale:** The current repo proves one demo path but has empty or incomplete package surfaces. Reliable development requires local CLIs, pinned versions, public entry points, package metadata, and smoke tests first.
**Delivers:** Node/npm engines, pinned n8n Docker image, local `@sap/cds-dk`, Vitest, root scripts, CAP plugin public exports, CAP peer dependency, n8n community-node scaffold metadata, and smoke tests for package consumption.
**Addresses:** Installable CAP plugin package, installable n8n community-node package, integration test harness foundation.
**Avoids:** Mistaking the demo for the product; building outside n8n conventions; late publishing surprises.

### Phase 2: Typed CAP Service, Mock Runtime, and Configuration

**Rationale:** CAP-side features depend on a stable service contract and predictable profile behavior.
**Delivers:** Plugin-owned CDS `N8nWorkflowService`, CommonJS real runtime, local mock runtime, profile resolver, production credential validation, structured errors, timeout/retry wrapper without unsafe duplicate behavior, and integration tests for start/auth/error/mock/profile cases.
**Addresses:** Programmatic `start`, local mock, profile-aware configuration, structured errors, baseline retry/timeout handling.
**Avoids:** Secret leakage, global CAP config mutation, manual test environment dependence.

### Phase 3: Execution Store and Transaction-Safe Dispatch

**Rationale:** Cancel/query, retries, declarative triggers, and business-key lookup need durable correlation and clear transaction semantics.
**Delivers:** Workflow execution persistence model, store abstraction, correlation IDs, business keys/tags, attempt tracking, post-commit dispatch semantics for declarative work, and tests proving declarative n8n outages do not roll back CAP writes.
**Addresses:** Execution query foundation, cancel foundation, idempotency foundation, observable failures.
**Avoids:** Wrong CAP transaction behavior; retrying side effects blindly; overpromising lifecycle control.

### Phase 4: Declarative CAP Annotations

**Rationale:** Declarative triggers are the CAP-side differentiator, but they should use the stable runtime and dispatch semantics from earlier phases.
**Delivers:** `@n8n.workflow.start` scanner, startup validation, CREATE trigger first, UPDATE/DELETE support, scalar input mapping, delete key handling, sanitized logs, and integration tests against demo and temporary models.
**Addresses:** Annotation-driven CREATE/UPDATE/DELETE triggers, scalar mapping, best-effort non-blocking dispatch.
**Avoids:** Demo-only hooks, rollback surprises, unsafe association expansion.

### Phase 5: Workflow Import and Build Validation

**Rationale:** Generated typings and `cds build` validation need a stable annotation schema and runtime contract.
**Delivers:** `cap-n8n import --file`, generated CDS input types, deterministic workflow fixture layout, sanitizer, manifest, build plugin validation, warnings for untyped workflows, and later live n8n import as an extension.
**Addresses:** Local workflow import, generated CDS typings, build-time input validation.
**Avoids:** Network-dependent builds, unsanitized workflow exports, generator churn from unstable annotations.

### Phase 6: n8n Credentials, Metadata Discovery, and Read Operations

**Rationale:** The n8n node should become loadable and useful before mutation behavior increases risk.
**Delivers:** TypeScript n8n package, `SAP CAP API` credentials, `$metadata` credential test, metadata parser/cache, entity dropdowns, OData URL helpers, Query and Read operations, response cleanup, and `NodeApiError`/`NodeOperationError`.
**Addresses:** Credential type, dynamic entity discovery, Query, Read, OData cleanup, n8n-native errors.
**Avoids:** Secrets in node fields, string-built OData URLs, poor n8n editor UX.

### Phase 7: n8n Mutations and CAP Actions/Functions

**Rationale:** Mutations and business operations should reuse credential, metadata, key, transport, and error foundations.
**Delivers:** Create, Update, Delete, composite key support, validation error handling, Action/Function invocation, optional metadata refresh behavior, and integration tests against the CAP demo server.
**Addresses:** Full CAP action-node table stakes and high-value differentiator for CAP business operations.
**Avoids:** Broad generic OData scope, bulk destructive operations, mutation retries without idempotency guidance.

### Phase 8: Deployment, Docs, and Optional Trigger Node

**Rationale:** Production guidance and optional polling should wait until runtime contracts, credentials, tests, and node operations are stable.
**Delivers:** Local/hybrid/BTP setup docs, `.env.example`, sanitized examples, Docker n8n smoke suite, package tarball checks, docs-vs-code review, and optional `SAP CAP Trigger` polling node only if still needed.
**Addresses:** Deployment/configuration requirements, hybrid testing, supervisor-ready evidence, optional trigger node.
**Avoids:** Docs overstating readiness, UI-state-dependent tests, premature polling complexity.

### Phase Ordering Rationale

- Package foundations come first because empty entry points, floating images, and missing scripts make every later feature hard to verify.
- CAP runtime comes before annotations because declarative behavior must not encode unstable service, config, retry, or error semantics.
- Execution persistence comes before cancel/query, retries, declarative cancellation, and lifecycle promises because n8n webhook responses cannot be the only source of truth.
- Workflow import comes after annotation shape because generated CDS types and build validation need a stable consumer.
- n8n credential and metadata discovery come before CRUD breadth because they define secure auth, dropdowns, key handling, and response cleanup.
- Deployment and optional trigger polling come last because they add operational complexity after core product surfaces exist.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** Validate CAP post-commit hooks, outbox/queue choice, explicit transaction behavior, and persistence model impact in CAP 9.9.x.
- **Phase 5:** Validate n8n workflow JSON schema conventions, webhook input derivation limits, generated CDS syntax, and build plugin APIs.
- **Phase 6:** Validate exact n8n node scaffold versions, credential test behavior, and metadata loading APIs against n8n 2.22.x.
- **Phase 7:** Validate OData action/function metadata shapes, bound versus unbound invocation paths, composite key serialization, and CAP error bodies.
- **Phase 8:** Validate BTP Cloud Foundry/Kyma connectivity patterns, Destination/User-Provided Service guidance, and n8n verification/publishing requirements if release is in scope.

Phases with standard patterns:
- **Phase 1:** Standard npm workspace, engines, package metadata, Docker image pinning, and smoke-test setup.
- **Phase 2:** Standard CAP service implementation, profiles, mock service, native fetch wrapper, and Vitest integration tests.
- **Phase 4:** Standard CAP CSN annotation scanning and handler registration, once transaction semantics are settled.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | CAP, Node, Vitest, npm workspace, and CAP plugin guidance are verified against official docs and live metadata; exact n8n versions are MEDIUM because n8n releases frequently. |
| Features | HIGH | Table stakes align with the supervisor-ready requirements and current repo state; prioritization is MEDIUM because it has not been market-validated. |
| Architecture | HIGH | Package boundaries, CAP plugin mechanics, n8n community-node structure, and OData helper needs are well documented; exact CAP `Map` and n8n execution response behavior need smoke tests. |
| Pitfalls | HIGH | Critical risks are grounded in official CAP/n8n lifecycle docs and the brownfield codebase; project-specific priority ordering is partly inferred. |

**Overall confidence:** HIGH for roadmap structure, MEDIUM for version-specific lifecycle and import details.

### Gaps to Address

- n8n execution stop/list response semantics: validate with pinned local n8n before finalizing cancel/query return types.
- CAP CDS action payload shape for `Map`, arrays, and generated workflow types: smoke-test against `@sap/cds@9.9.1`.
- Post-commit dispatch implementation choice: decide between CAP queue/outbox pattern and plugin-owned dispatch table before annotation work.
- Workflow input schema derivation: define supported n8n workflow conventions; warn when schemas cannot be inferred from JSON.
- Association and to-many input mapping: keep out of the first annotation slice unless requirements force it.
- BTP production connectivity: treat as a documentation and validation phase, not a prerequisite for local runtime foundations.
- Publishing/verification: confirm npm provenance and n8n verified-node requirements near release planning.

## Sources

### Primary (HIGH confidence)

- `.planning/PROJECT.md` - current project definition, validated/active requirements, constraints, and brownfield state.
- `cap_n8n_requirements_v2.md` - supervisor-ready epics, user stories, and acceptance criteria.
- `.planning/research/STACK.md` - runtime, package, dependency, and test tooling recommendations.
- `.planning/research/FEATURES.md` - table stakes, differentiators, anti-features, MVP recommendation, and feature dependencies.
- `.planning/research/ARCHITECTURE.md` - package boundaries, data flow, component responsibilities, persistence, annotations, import, and build order.
- `.planning/research/PITFALLS.md` - critical and moderate implementation risks with prevention strategies.
- SAP CAP docs - plugin packages, required services, `cds.connect.to`, `cds.test`, build plugins, configuration profiles, events, transactions, queues, annotations, and types.
- n8n docs - community-node standards, `n8n-node` CLI, node file structure, credentials, HTTP helpers, error handling, webhook lifecycle, public API, and execution data.

### Secondary (MEDIUM confidence)

- Live npm metadata checked on 2026-05-28 for `@sap/cds@9.9.1`, `@sap/cds-dk@9.9.1`, `@cap-js/sqlite@2.4.0`, `n8n@2.22.4`, `@n8n/node-cli@0.32.1`, `vitest@4.1.7`, and `fast-xml-parser@5.8.0`.
- Local codebase context referenced by research files, including `.planning/codebase/`, `README.md`, workflow fixtures, and `mockups/n8n-node-mockup.html`.

---
*Research completed: 2026-05-28*
*Ready for roadmap: yes*
