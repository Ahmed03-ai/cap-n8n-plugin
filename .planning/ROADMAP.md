# Roadmap: CAP n8n Integration

## Overview

This roadmap turns the brownfield prototype into two package-owned integration surfaces: a CAP plugin for reliable workflow start, tracking, cancellation, annotations, import, and build validation; and an n8n community node for secure CAP OData reads, writes, and business-operation invocation. The phase order follows the research-backed dependency chain: stabilize package boundaries first, establish typed CAP runtime behavior, add execution correlation, layer declarative annotations and workflow typing, then complete the n8n node and deployment evidence.

**Granularity:** coarse config, with eight retained phases because the requirements and research identify distinct dependency boundaries that should not be compressed without losing verifiability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Package Foundations and Tooling** - Developers can consume both packages and run pinned local tooling without hidden global dependencies.
- [ ] **Phase 2: Typed CAP Service, Mock Runtime, and Configuration** - CAP developers can use a typed n8n service with mock/profile/runtime reliability.
- [ ] **Phase 3: Execution Store and Transaction-Safe Dispatch** - CAP developers can track, query, and cancel correlated workflow executions safely.
- [ ] **Phase 4: Declarative CAP Annotations** - CAP developers can trigger and cancel workflows declaratively from CDS models.
- [ ] **Phase 5: Workflow Import and Build Validation** - CAP developers can import workflows into typed local artifacts and validate mappings during build.
- [ ] **Phase 6: n8n Credentials, Metadata Discovery, and Read Operations** - n8n workflow designers can securely discover and read CAP OData data.
- [ ] **Phase 7: n8n Mutations and CAP Actions/Functions** - n8n workflow designers can write CAP data and invoke CAP business operations.
- [ ] **Phase 8: Deployment, Docs, and Release Readiness** - Developers and reviewers can run, configure, verify, and assess the integration without hidden setup.

## Phase Details

### Phase 1: Package Foundations and Tooling
**Goal**: Developers can consume the CAP plugin and n8n node package through real package boundaries and repeatable repo-local tooling.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, NODE-01
**Success Criteria** (what must be TRUE):
  1. Developer can install or require `cap-n8n-plugin` through its public package entry point without importing internal implementation paths.
  2. Developer can load the SAP CAP community-node package in a local n8n-compatible package shape.
  3. Developer can run repo-local CAP, n8n, node-build, and test commands using declared dependencies and pinned runtime versions.
  4. Developer can run a smoke test that proves the CAP plugin package and n8n node package are both loadable.
  5. Package metadata clearly declares engines, CAP peer dependencies, package files, and license expectations.
**Plans**: 4 plans
Plans:
- [ ] 01-01-PLAN.md — Repair CAP plugin public package boundary and metadata.
- [ ] 01-02-PLAN.md — Create n8n community-node package loadability baseline.
- [ ] 01-03-PLAN.md — Add repo-local tooling scripts and pin local n8n infrastructure.
- [ ] 01-04-PLAN.md — Add gated smoke verification and refresh install state.

### Phase 2: Typed CAP Service, Mock Runtime, and Configuration
**Goal**: CAP developers can connect to a typed `N8nWorkflowService`, start workflows reliably, and switch between mock and real n8n profiles.
**Depends on**: Phase 1
**Requirements**: CAPAPI-01, CAPAPI-02, CAPAPI-03, RUNTIME-01, RUNTIME-02, RUNTIME-03, RUNTIME-04, RUNTIME-05, VERIFY-01
**Success Criteria** (what must be TRUE):
  1. CAP developer can connect with `cds.connect.to('n8n')`, call typed `start` with `workflowId` and inputs, and receive a clear execution result or correlation result.
  2. CAP developer can use a local mock runtime offline and see deterministic mock execution behavior for development and integration tests.
  3. CAP developer can switch between mock, local n8n, cloud n8n, and production profiles without changing application code.
  4. Production startup fails with a clear sanitized error when required n8n base URL or credentials are missing.
  5. CAP developer receives structured sanitized CDS errors and configurable timeout/retry behavior for n8n communication failures.
**Plans**: TBD

### Phase 3: Execution Store and Transaction-Safe Dispatch
**Goal**: CAP developers can track, query, cancel, and correlate workflow executions without relying only on webhook responses.
**Depends on**: Phase 2
**Requirements**: CAPAPI-04, CAPAPI-05, CAPAPI-06, RUNTIME-06, RUNTIME-07
**Success Criteria** (what must be TRUE):
  1. CAP developer can inspect a stored workflow execution record with correlation ID, workflow ID, status, business key or tag, attempts, and timestamps.
  2. CAP developer can cancel a running workflow execution by execution ID and receive a meaningful result for completed, missing, or unsupported executions.
  3. CAP developer can query and page workflow executions by execution ID, workflow ID, business key, tag, or status.
  4. CAP developer can detect duplicate or ambiguous workflow start attempts through persisted correlation rather than raw logs alone.
  5. CAP workflow dispatch has a clear post-commit or outbox-style path for later declarative triggers.
**Plans**: TBD

### Phase 4: Declarative CAP Annotations
**Goal**: CAP developers can define workflow start, cancellation, input mapping, and conditional behavior in CDS annotations.
**Depends on**: Phase 3
**Requirements**: ANNO-01, ANNO-02, ANNO-03, ANNO-04, ANNO-05, ANNO-06, ANNO-07, VERIFY-02
**Success Criteria** (what must be TRUE):
  1. CAP developer can annotate a CDS entity so successful CREATE operations trigger a workflow without custom service-handler code.
  2. CAP developer can select UPDATE and DELETE events for annotated workflow starts and see the correct entity data or keys delivered.
  3. CAP developer can map selected scalar entity fields into the workflow input payload.
  4. CAP developer receives clear startup or registration-time errors for invalid annotations, missing mapped fields, or invalid conditions.
  5. CAP developer can declare conditional starts and cancellation behavior, with trigger or cancellation failures logged without rolling back the original CAP write by default.
**Plans**: TBD

### Phase 5: Workflow Import and Build Validation
**Goal**: CAP developers can import n8n workflows into deterministic typed local artifacts and catch mapping problems during `cds build`.
**Depends on**: Phase 4
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, VERIFY-03
**Success Criteria** (what must be TRUE):
  1. CAP developer can import a local workflow JSON file offline and receive generated CDS artifacts with typed workflow inputs.
  2. CAP developer can import a workflow definition from live n8n using configured credentials and save the same sanitized local artifact layout.
  3. CAP developer can rely on deterministic generated workflow files and manifests that avoid committed secrets or instance-specific metadata.
  4. `cds build` reports clear errors for missing inputs and type mismatches in workflow trigger annotations.
  5. `cds build` reports warnings for extra inputs or untyped workflow references without blocking incremental adoption.
**Plans**: TBD

### Phase 6: n8n Credentials, Metadata Discovery, and Read Operations
**Goal**: n8n workflow designers can configure CAP credentials, discover CAP metadata, and read CAP OData data as plain n8n items.
**Depends on**: Phase 1
**Requirements**: NODE-02, NODE-03, NODE-04, NODE-05, NODE-06, NODE-10, NODE-11
**Success Criteria** (what must be TRUE):
  1. n8n user can configure SAP CAP API credentials with Base URL, Basic Auth, OAuth2 Client Credentials, and a `$metadata` test in the n8n UI.
  2. n8n workflow designer can select CAP entity sets from a dynamically loaded dropdown with refresh or cache behavior and clear failure messages.
  3. n8n workflow designer can use Query mode with filter, sort, pagination, and selection options and receive one item per returned entity.
  4. n8n workflow designer can use Read mode to retrieve one CAP entity by key and receives a clear n8n-native not-found error when appropriate.
  5. n8n workflow designer receives plain item data and n8n-native errors instead of raw OData wrappers or unsanitized CAP responses.
**Plans**: TBD
**UI hint**: yes

### Phase 7: n8n Mutations and CAP Actions/Functions
**Goal**: n8n workflow designers can create, update, delete, and invoke CAP business operations through the SAP CAP node.
**Depends on**: Phase 6
**Requirements**: NODE-07, NODE-08, NODE-09, NODE-12, NODE-13, VERIFY-04
**Success Criteria** (what must be TRUE):
  1. n8n workflow designer can create a CAP entity and receive the created entity, including server-generated fields, as an n8n item.
  2. n8n workflow designer can update and delete CAP entities by key, including composite keys, with clear validation and not-found errors.
  3. n8n workflow designer can invoke bound and unbound CAP actions/functions from metadata-backed operation choices.
  4. n8n workflow designer receives consistent response cleanup and n8n-native errors across Query, Read, Create, Update, Delete, and Action/Function modes.
  5. Developer can run integration tests covering credentials, metadata discovery, CRUD, response cleanup, actions/functions, and composite keys.
**Plans**: TBD
**UI hint**: yes

### Phase 8: Deployment, Docs, and Release Readiness
**Goal**: Developers, platform engineers, and reviewers can run, configure, verify, and assess the integration using documented repeatable commands.
**Depends on**: Phase 7
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, DOCS-07, VERIFY-05, VERIFY-06
**Success Criteria** (what must be TRUE):
  1. Developer can follow documentation to run the CAP demo app with local n8n, cloud n8n, mock mode, and the n8n node against a CAP service.
  2. Developer can configure every supported environment variable using a checked-in `.env.example` without committing secrets.
  3. Platform engineer can follow SAP BTP deployment guidance for credentials, connectivity, and Cloud Foundry or Kyma deployment considerations.
  4. Reviewer can trace n8n mockups, workflow fixtures, and documentation examples to implemented n8n-specific user stories.
  5. Developer can run a documented smoke test and repeatable local or CI command that reports whether the project is ready for review.
**Plans**: TBD

## Deferred Scope

Optional v2 SAP CAP Trigger Node work remains deferred. It is not mapped to any v1 phase unless explicitly promoted later through a roadmap change.

## Coverage

| Phase | Requirement Count |
|-------|-------------------|
| Phase 1: Package Foundations and Tooling | 6 |
| Phase 2: Typed CAP Service, Mock Runtime, and Configuration | 9 |
| Phase 3: Execution Store and Transaction-Safe Dispatch | 5 |
| Phase 4: Declarative CAP Annotations | 8 |
| Phase 5: Workflow Import and Build Validation | 8 |
| Phase 6: n8n Credentials, Metadata Discovery, and Read Operations | 7 |
| Phase 7: n8n Mutations and CAP Actions/Functions | 6 |
| Phase 8: Deployment, Docs, and Release Readiness | 9 |
| **Total** | **58** |

All 58 v1 requirements map to exactly one phase. No v2 requirements are included in v1 coverage.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Package Foundations and Tooling | 0/TBD | Not started | - |
| 2. Typed CAP Service, Mock Runtime, and Configuration | 0/TBD | Not started | - |
| 3. Execution Store and Transaction-Safe Dispatch | 0/TBD | Not started | - |
| 4. Declarative CAP Annotations | 0/TBD | Not started | - |
| 5. Workflow Import and Build Validation | 0/TBD | Not started | - |
| 6. n8n Credentials, Metadata Discovery, and Read Operations | 0/TBD | Not started | - |
| 7. n8n Mutations and CAP Actions/Functions | 0/TBD | Not started | - |
| 8. Deployment, Docs, and Release Readiness | 0/TBD | Not started | - |
