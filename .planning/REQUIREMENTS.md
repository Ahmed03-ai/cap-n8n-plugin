# Requirements: CAP n8n Integration

**Defined:** 2026-05-28
**Core Value:** CAP developers can add reliable n8n workflow automation to CAP applications without repeatedly hand-writing integration glue.
**Detailed source:** `cap_n8n_requirements_v2.md`

## v1 Requirements

Requirements for the initial project roadmap. Each requirement maps to exactly one roadmap phase. Detailed user stories and acceptance criteria remain in `cap_n8n_requirements_v2.md`.

### Foundations

- [x] **FOUND-01**: Developer can install and consume `cap-n8n-plugin` through a package-level public entry point.
- [x] **FOUND-02**: Developer can rely on declared package metadata, including CAP peer dependencies, Node engine constraints, and package license.
- [x] **FOUND-03**: Developer can run repo-local CAP, n8n, and test tooling without relying on undocumented global installs.
- [x] **FOUND-04**: Developer can run a passing smoke test proving the CAP plugin package and n8n node package are loadable.
- [x] **FOUND-05**: Developer can use pinned local development infrastructure so n8n and CAP behavior do not drift unexpectedly.

### CAP Programmatic API

- [x] **CAPAPI-01**: CAP developer can connect to a typed `N8nWorkflowService` through `cds.connect.to('n8n')`.
- [x] **CAPAPI-02**: CAP developer can start an n8n workflow programmatically with `workflowId` and input payload.
- [x] **CAPAPI-03**: CAP developer receives a workflow execution identifier or clear result object after a successful start.
- [x] **CAPAPI-04**: CAP developer can cancel a running workflow execution by execution ID.
- [x] **CAPAPI-05**: CAP developer can query workflow executions by execution ID, workflow ID, business key, tag, or status.
- [x] **CAPAPI-06**: CAP developer can page through large execution query results.

### CAP Runtime Reliability

- [x] **RUNTIME-01**: CAP developer can use a local mock n8n runtime without starting a live n8n instance.
- [x] **RUNTIME-02**: CAP developer can switch between mock, local n8n, cloud n8n, and production configuration through CAP profiles.
- [x] **RUNTIME-03**: Production startup fails clearly when required n8n base URL or credentials are missing.
- [x] **RUNTIME-04**: CAP developer receives structured, sanitized CDS errors for n8n communication failures.
- [x] **RUNTIME-05**: Transient n8n HTTP failures use configurable timeout and retry behavior.
- [x] **RUNTIME-06**: Workflow starts and retries are correlated so duplicate or ambiguous executions can be detected.
- [x] **RUNTIME-07**: Workflow execution state is persisted or otherwise tracked enough to support query, cancellation, retry, and business-key lookup.

### CAP Declarative Triggers

- [x] **ANNO-01**: CAP developer can annotate a CDS entity to start an n8n workflow after a successful CREATE.
- [x] **ANNO-02**: CAP developer can configure annotated workflow starts for UPDATE and DELETE events.
- [x] **ANNO-03**: CAP developer can map selected scalar entity fields into the workflow input payload.
- [x] **ANNO-04**: CAP developer receives startup or registration-time errors for invalid annotations or missing mapped fields.
- [x] **ANNO-05**: CAP developer can configure a conditional expression that decides whether a workflow should start.
- [x] **ANNO-06**: CAP developer can declaratively cancel obsolete workflow executions when configured data events occur.
- [x] **ANNO-07**: Declarative trigger failures are logged without rolling back the original CAP write by default.

### Workflow Import and Build Validation

- [x] **IMPORT-01**: CAP developer can import a local n8n workflow JSON file without connecting to a live n8n instance.
- [x] **IMPORT-02**: CAP developer can import a workflow definition from a live n8n instance using configured credentials.
- [x] **IMPORT-03**: Imported workflow definitions generate CDS artifacts with typed workflow inputs.
- [x] **IMPORT-04**: Imported workflow artifacts are stored locally in a deterministic, sanitized layout.
- [x] **IMPORT-05**: `cds build` validates workflow trigger annotations against generated workflow input definitions.
- [x] **IMPORT-06**: Build validation reports clear errors for missing inputs and type mismatches.
- [x] **IMPORT-07**: Build validation reports warnings for extra inputs or untyped workflow references.

### n8n CAP Action Node

- [x] **NODE-01**: n8n workflow designer can install and load an SAP CAP community node package.
- [ ] **NODE-02**: n8n user can configure SAP CAP credentials with Basic Auth, OAuth2 Client Credentials, and service Base URL.
- [ ] **NODE-03**: n8n user can test CAP credentials against the CAP service `$metadata` endpoint.
- [ ] **NODE-04**: n8n workflow designer can select CAP entity sets from a dynamically loaded dropdown.
- [ ] **NODE-05**: n8n workflow designer can use Query mode to retrieve a filtered, sorted, paginated collection of CAP entities.
- [ ] **NODE-06**: n8n workflow designer can use Read mode to retrieve one CAP entity by known key.
- [ ] **NODE-07**: n8n workflow designer can use Create mode to create a CAP entity.
- [ ] **NODE-08**: n8n workflow designer can use Update mode to patch an existing CAP entity by key.
- [ ] **NODE-09**: n8n workflow designer can use Delete mode to remove a CAP entity by key.
- [ ] **NODE-10**: n8n workflow designer receives plain n8n item data instead of raw OData wrapper structures.
- [ ] **NODE-11**: n8n workflow designer receives n8n-native errors for CAP authentication, validation, not-found, and server failures.
- [ ] **NODE-12**: n8n workflow designer can invoke CAP actions and functions exposed by a CAP OData service.
- [ ] **NODE-13**: n8n workflow designer can work with CAP entities that use composite keys.

### Documentation and Deployment

- [ ] **DOCS-01**: Developer can follow documentation to run the CAP demo app with local n8n.
- [ ] **DOCS-02**: Developer can follow documentation to run CAP locally against a cloud n8n instance.
- [ ] **DOCS-03**: Developer can follow documentation to run the n8n community node locally against a CAP service.
- [ ] **DOCS-04**: Developer can configure supported environment variables using a checked-in `.env.example`.
- [ ] **DOCS-05**: Platform engineer can follow SAP BTP deployment guidance for credentials and connectivity.
- [ ] **DOCS-06**: Reviewer can understand which n8n mockups correspond to n8n-specific user stories.
- [ ] **DOCS-07**: Workflow fixtures and documentation examples avoid committed secrets or personal production metadata.

### Verification

- [x] **VERIFY-01**: Developer can run integration tests for the CAP programmatic API, authentication, errors, retry behavior, and mock runtime.
- [x] **VERIFY-02**: Developer can run integration tests for declarative CAP annotations and non-rollback behavior.
- [x] **VERIFY-03**: Developer can run integration tests for workflow import and build-time validation.
- [ ] **VERIFY-04**: Developer can run integration tests for n8n credential handling, metadata discovery, Query, Read, Create, Update, Delete, and response cleanup.
- [ ] **VERIFY-05**: Developer can run a documented smoke test covering the demo CAP app, local n8n, and exported workflow fixture.
- [ ] **VERIFY-06**: CI or an equivalent repeatable local command reports whether the project is ready for review.

## v2 Requirements

Deferred to future release. Tracked but not required for the initial roadmap unless explicitly promoted.

### Optional Trigger Node

- **TRIGGER-01**: n8n user can configure an SAP CAP Trigger Node that polls a CAP OData endpoint for new or changed records.
- **TRIGGER-02**: n8n user can configure first-run behavior for polling triggers.
- **TRIGGER-03**: n8n user receives deduplicated n8n items for newly detected CAP records.

### Extended OData and Operations

- **ODATA-01**: n8n workflow designer can perform safe bulk operations with explicit guardrails.
- **ODATA-02**: n8n workflow designer can use advanced OData capabilities beyond CAP OData V4 CRUD, actions, and functions.
- **ODATA-03**: Developer can evaluate OData V2 support if a concrete CAP compatibility need emerges.

### Release and Ecosystem

- **REL-01**: Maintainer can prepare the n8n node for verified community-node submission.
- **REL-02**: Maintainer can publish package artifacts with provenance and release notes.

## Out of Scope

Explicit exclusions for this project scope.

| Feature | Reason |
|---------|--------|
| Custom workflow engine in CAP | n8n remains the workflow execution runtime. |
| Custom workflow designer UI | n8n already provides workflow design and execution UI. |
| CAP plugin visual mockups | CAP plugin users interact through APIs, CDS, annotations, generated artifacts, and docs. |
| Managed n8n hosting | Operating n8n is infrastructure work outside the plugin's value proposition. |
| Secret management replacement | CAP, BTP, and n8n already provide environment, service-binding, and credential mechanisms. |
| Broad generic OData client | The first release targets CAP OData V4 behavior needed by the SAP CAP node. |
| Mobile or end-user application UI | The primary users are CAP developers and n8n workflow designers. |
| Simulated suspend/resume lifecycle | n8n does not match SAP Build Process Automation lifecycle semantics for these operations. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| CAPAPI-01 | Phase 2 | Complete |
| CAPAPI-02 | Phase 2 | Complete |
| CAPAPI-03 | Phase 2 | Complete |
| CAPAPI-04 | Phase 3 | Complete |
| CAPAPI-05 | Phase 3 | Complete |
| CAPAPI-06 | Phase 3 | Complete |
| RUNTIME-01 | Phase 2 | Complete |
| RUNTIME-02 | Phase 2 | Complete |
| RUNTIME-03 | Phase 2 | Complete |
| RUNTIME-04 | Phase 2 | Complete |
| RUNTIME-05 | Phase 2 | Complete |
| RUNTIME-06 | Phase 3 | Complete |
| RUNTIME-07 | Phase 3 | Complete |
| ANNO-01 | Phase 4 | Complete |
| ANNO-02 | Phase 4 | Complete |
| ANNO-03 | Phase 4 | Complete |
| ANNO-04 | Phase 4 | Complete |
| ANNO-05 | Phase 4 | Complete |
| ANNO-06 | Phase 4 | Complete |
| ANNO-07 | Phase 4 | Complete |
| IMPORT-01 | Phase 5 | Complete |
| IMPORT-02 | Phase 5 | Complete |
| IMPORT-03 | Phase 5 | Complete |
| IMPORT-04 | Phase 5 | Complete |
| IMPORT-05 | Phase 5 | Complete |
| IMPORT-06 | Phase 5 | Complete |
| IMPORT-07 | Phase 5 | Complete |
| NODE-01 | Phase 1 | Complete |
| NODE-02 | Phase 6 | Pending |
| NODE-03 | Phase 6 | Pending |
| NODE-04 | Phase 6 | Pending |
| NODE-05 | Phase 6 | Pending |
| NODE-06 | Phase 6 | Pending |
| NODE-07 | Phase 7 | Pending |
| NODE-08 | Phase 7 | Pending |
| NODE-09 | Phase 7 | Pending |
| NODE-10 | Phase 6 | Pending |
| NODE-11 | Phase 6 | Pending |
| NODE-12 | Phase 7 | Pending |
| NODE-13 | Phase 7 | Pending |
| DOCS-01 | Phase 8 | Pending |
| DOCS-02 | Phase 8 | Pending |
| DOCS-03 | Phase 8 | Pending |
| DOCS-04 | Phase 8 | Pending |
| DOCS-05 | Phase 8 | Pending |
| DOCS-06 | Phase 8 | Pending |
| DOCS-07 | Phase 8 | Pending |
| VERIFY-01 | Phase 2 | Complete |
| VERIFY-02 | Phase 4 | Complete |
| VERIFY-03 | Phase 5 | Complete |
| VERIFY-04 | Phase 7 | Pending |
| VERIFY-05 | Phase 8 | Pending |
| VERIFY-06 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 58 total
- Mapped to phases: 58
- Unmapped: 0

---
*Requirements defined: 2026-05-28*
*Last updated: 2026-05-28 after roadmap creation*
