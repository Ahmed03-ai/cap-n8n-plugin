# CAP ↔ n8n Integration — Implementation Plan

This document provides the full set of Epics and User Stories for the CAP ↔ n8n integration project. The project is split into two distinct parts: **CAP → n8n** (The CAP Plugin) and **n8n → CAP** (The n8n Node).

---

## Overview

The existing `@cap-js/process` plugin tightly integrates SAP Build Process Automation (BPA) into the CAP framework. Our goal is to replicate this developer experience but targeting **n8n** instead of SAP BPA, while also providing an **n8n Community Node** that allows n8n to call back into CAP OData services.

---


## Epic 1: Programmatic API & Local Mocking (CAP → n8n)

*Providing a programmatic interface and local development support.*

---

### US 1.1 — Programmatic Workflow Triggering

**As a** CAP developer,
**I want to** have an n8n service I can connect to from my business logic to trigger workflows programmatically
**So that** business events in CAP reliably kick off automation in n8n.


#### Acceptance Criteria

- [ ] A CDS service `N8nWorkflowService` is provided by the plugin and can be connected to via `cds.connect.to('n8n')`.
- [ ] The service exposes a `start(workflowId, inputs)` action that triggers an n8n workflow execution.
- [ ] The `start` action returns the n8n execution ID on success.
- [ ] The service authenticates against n8n using credentials from the CAP `cds.requires.n8n` configuration.
- [ ] Errors from the n8n API are propagated as standard CDS errors.
- [ ] Integration tests cover successful triggering, authentication, and error propagation.

---

### US 1.2 — Cancel Workflows Programmatically

**As a** CAP developer,
**I want to** cancel running workflows programmatically
**So that** obsolete processes can be stopped automatically.

#### Acceptance Criteria

- [ ] The `N8nWorkflowService` exposes a `cancel(executionId)` action.
- [ ] Calling `cancel` invokes the n8n API to stop the specified execution.
- [ ] The action returns a confirmation status (e.g., `{ status: 'cancelled' }`).
- [ ] If the execution does not exist or has already completed, the API returns a meaningful error or no-op result.
- [ ] Integration tests cover successful cancellation, already-completed execution, and API error cases.

---

### US 1.3 — Query Running Executions

**As a** CAP developer,
**I want to** look up and filter running workflow executions by ID or label
**So that** I can display workflow progress in applications.

#### Acceptance Criteria

- [ ] The `N8nWorkflowService` exposes a `query(filters)` action that retrieves execution data from n8n.
- [ ] Filtering by tags (business keys) is supported.
- [ ] Filtering by execution ID is supported.
- [ ] The returned data includes at minimum: execution ID, status, workflow ID, started at, and finished at timestamps.
- [ ] Pagination is supported for large result sets.
- [ ] Integration tests cover tag-based filtering, ID-based lookup, empty results, and pagination.

---

### US 1.4 — Local Mock Implementation

**As a** CAP developer,
**I want to** have a local mock implementation of n8n execution
**So that** I can develop without a live n8n instance.

#### Acceptance Criteria

- [ ] A mock implementation of `N8nWorkflowService` is provided by the plugin.
- [ ] The mock stores executions in memory (start, cancel, query all work against the in-memory store).
- [ ] The mock is activated automatically when running in the `[development]` profile (or when no real n8n credentials are configured).
- [ ] Mock executions transition through states (e.g., `running` → `success`) after a configurable delay.
- [ ] Console output or debug logs indicate that the mock is active.
- [ ] Integration tests verify that the mock correctly simulates start, cancel, and query operations.

---

### US 1.5 — Configuration Profiles


**As a** CAP developer,
**I want to** switch between a local mock and a real n8n instance using environment profiles
**So that** environment-specific behavior is managed without changing code.

#### Acceptance Criteria

- [ ] The plugin reads n8n connection settings from `cds.requires.n8n` in `package.json`.
- [ ] A `[development]` profile automatically activates the mock service (US 2.4).
- [ ] A `[production]` profile requires real n8n API credentials (`apiKey`, `baseUrl`) and connects to a live instance.
- [ ] Missing credentials in a non-development profile cause a clear startup error.
- [ ] Profile switching works via standard CAP mechanisms (`CDS_ENV`, `NODE_ENV`, `cds.requires.n8n.[profile]`).
- [ ] Documentation and inline comments explain the configuration options.

---

### US 1.6 — Retry Logic for HTTP Requests

**As a** CAP developer,
**I want to** have the integration layer automatically retry failed HTTP requests on transient errors
**So that** temporary outages do not cause permanent workflow failures.

#### Acceptance Criteria

- [ ] Transient errors (network timeout, 502, 503, 504) are retried up to a configurable number of times (default: 3).
- [ ] Each retry waits longer than the previous one (exponential backoff).
- [ ] Non-retryable errors (400, 401, 403, 404) are surfaced immediately without retrying.
- [ ] Every retry attempt is logged with the attempt number and the reason for retrying.
- [ ] Integration tests cover successful retry, max retries exceeded, and non-retryable error scenarios.

---

### US 1.7 — Runtime Error Handling

**As a** CAP developer,
**I want to** receive a clear, structured error message when an HTTP call between CAP and n8n fails at runtime
**So that** I can quickly understand what went wrong without reading stack traces.

#### Acceptance Criteria

- [ ] All errors include: the source (CAP or n8n), the HTTP status code, and a plain-language description.
- [ ] A failed n8n trigger (e.g. n8n unreachable, returns 500) throws a CDS error with a meaningful message in the CAP layer.
- [ ] n8n API errors such as rate limits or invalid payloads are surfaced with their original error message.
- [ ] CAP OData error responses (e.g. validation failures) are unpacked and included in the error detail.
- [ ] Stack traces are not exposed to end users in production.
- [ ] Integration tests cover network failure, 4xx, and 5xx error scenarios.

---

## Epic 2: CAP Declarative Workflow Triggers (CAP → n8n)

*Enabling CAP developers to start n8n workflows automatically via annotations.*

---

### US 2.1 — Trigger Workflow on Entity Creation

**As a** CAP developer,
**I want to** automatically trigger a workflow when a record is created
**So that** workflow starts without writing any imperative code.


#### Acceptance Criteria

- [ ] A CDS entity annotated with `@n8n.workflow.start` triggers an n8n workflow execution when a `CREATE` event occurs.
- [ ] The annotation accepts a `workflowId` (or equivalent identifier) to specify which n8n workflow to start.
- [ ] The plugin intercepts the `CREATE` handler in the `AFTER` phase and invokes the n8n REST API (`POST /executions`).
- [ ] A successful n8n API call does not block or roll back the original CDS transaction.
- [ ] Errors from the n8n API are logged and do not prevent the CDS entity from being persisted.
- [ ] Integration tests cover the happy path (workflow triggered) and error path (n8n API unreachable).

---

### US 2.2 — Trigger Workflow on Entity Update and Delete

**As a** CAP developer,
**I want to** declaratively trigger workflows from my data model
**So that** a workflow starts automatically when a record is updated or deleted.

I want to automatically trigger a workflow when a record is updated or deleted, so that a workflow starts without writing any imperative code.

#### Acceptance Criteria

- [ ] A CDS entity annotated with `@n8n.workflow.start` triggers an n8n workflow execution on `UPDATE` events.
- [ ] A CDS entity annotated with `@n8n.workflow.start` triggers an n8n workflow execution on `DELETE` events.
- [ ] The annotation supports an `on` property (e.g., `on: ['update', 'delete']`) to specify which events activate the trigger.
- [ ] If no `on` property is specified, the default behavior from US 1.1 (create only) applies.
- [ ] The entity data (or key for deletes) is included in the n8n API call payload.
- [ ] Integration tests cover `UPDATE` and `DELETE` triggers independently and combined.

---

### US 2.3 — Cancel Running Workflows Declaratively

**As a** CAP developer,
**I want to** cancel running workflows declaratively
**So that** obsolete processes can be stopped automatically.

#### Acceptance Criteria

- [ ] A new annotation `@n8n.workflow.cancel` can be applied to CDS entities.
- [ ] When the annotated CDS event fires (e.g., on `DELETE` or a status change), the plugin calls the n8n API to stop the corresponding execution.
- [ ] The mapping between a CDS entity instance and its n8n execution is resolved via a stored execution ID or business key / tag.
- [ ] If no running execution is found for the entity, the cancellation is a no-op and logged as a warning.
- [ ] Errors during cancellation are logged but do not roll back the CDS transaction.
- [ ] Integration tests cover cancellation success, no-op (no execution found), and n8n API error scenarios.

---

### US 2.4 — Map Entity Attributes to Workflow Inputs

**As a** CAP developer,
**I want to** control which data from my entity is passed to the workflow
**So that** the workflow receives exactly the information it needs.

#### Acceptance Criteria

- [ ] The `@n8n.workflow.start` annotation supports an `inputs` array that maps CDS element names to workflow input keys.
- [ ] Scalar attributes (e.g., `String`, `Integer`, `Date`) are correctly serialized in the JSON payload.
- [ ] Managed associations (to-one) are expanded and included in the payload.
- [ ] Composition / to-many associations are expanded (deep read) and included as arrays in the payload.
- [ ] If a mapped element does not exist on the entity, the plugin throws a clear error at startup / registration time.
- [ ] Integration tests validate scalar mapping, association expansion, and missing-element error cases.

---

### US 2.5 — Conditional Workflow Triggers

**As a** CAP developer,
**I want to** specify conditions for when a workflow should be triggered
**So that** workflows are not started unnecessarily for every data change.

#### Acceptance Criteria

- [ ] The `@n8n.workflow.start` annotation supports an `if:` expression (CDS expression or simple predicate).
- [ ] The expression is evaluated against the current entity data at runtime, before calling the n8n API.
- [ ] If the expression evaluates to `false`, the n8n API call is skipped silently (no error, optional debug log).
- [ ] If the expression evaluates to `true`, the workflow trigger proceeds as normal.
- [ ] Invalid expressions produce a clear error at plugin registration time.
- [ ] Integration tests cover true/false evaluation, complex expressions (e.g., `status = 'approved' AND amount > 1000`), and invalid expression errors.

---

## Epic 3: Workflow Import and Typings (CAP → n8n)

*Bringing type safety and build-time validation to n8n workflows.*

---

### US 3.1 — Import Local Workflow JSON Files

**As a** CAP developer,
**I want to** import local workflow JSON files
**So that** I can work on the integration without needing an active n8n connection.

#### Acceptance Criteria

- [ ] The plugin supports a command or mechanism (e.g., `cds import --from n8n <path-to-json>`) to import a local n8n workflow JSON file.
- [ ] The import parses the workflow JSON and generates a corresponding CDS service definition (`.cds` file) with typed inputs.
- [ ] The generated CDS model reflects the trigger node's expected inputs (webhook body, parameters, etc.).
- [ ] The imported workflow ID is stored in the generated CDS model for reference.
- [ ] Import works fully offline without any n8n instance connectivity.
- [ ] Integration tests cover import of valid workflow JSON, generation of correct CDS types, and error handling for malformed JSON.

---

### US 3.2 — Import Workflow Definitions from n8n

**As a** CAP developer,
**I want to** import workflow definitions from n8n
**So that** typed integration artifacts are generated automatically.

#### Acceptance Criteria

- [ ] The plugin supports a command (e.g., `cds import --from n8n <workflow-id>`) to fetch a workflow definition from a live n8n instance.
- [ ] The command authenticates using the configured n8n API credentials.
- [ ] The fetched workflow JSON is saved locally (for offline use per US 3.1).
- [ ] A CDS service definition (`.cds` file) is generated from the fetched workflow, identical in structure to a local import.
- [ ] The command provides clear error messages if the workflow ID is not found or authentication fails.
- [ ] Integration tests cover remote fetch, CDS generation, and error scenarios.

---

### US 3.3 — Build-Time Validation of Workflow Inputs

**As a** CAP developer,
**I want to** have my project build automatically validate that the data I am sending to workflows matches what the workflow expects
**So that** integration errors are caught at build time rather than at runtime.

#### Acceptance Criteria

- [ ] During `cds build`, the plugin's build plugin validates all `@n8n.workflow.start` annotations against their corresponding imported CDS service definitions.
- [ ] Missing required inputs produce a build error with a clear message identifying the entity, annotation, and missing input.
- [ ] Type mismatches (e.g., mapping a `String` to an `Integer` input) produce a build error.
- [ ] Extra inputs (not defined in the imported schema) produce a build warning.
- [ ] If no imported CDS service exists for a referenced workflow, a build warning is emitted (not a hard error, to support untyped usage).
- [ ] Integration tests cover missing inputs, type mismatches, extra inputs, and missing import scenarios.

---

## Epic 4: SAP CAP Action Node (n8n → CAP)

*Building the n8n Community Node to interact with CAP OData services.*

---

### US 4.1 — SAP CAP Credential Type

**As an** n8n user,
**I want to** configure an SAP CAP Credential Type (Basic Auth & OAuth2)
**So that** my workflow can securely authenticate against a BTP-deployed or local CAP service.

#### Acceptance Criteria

- [ ] A custom n8n Credential Type named `SAP CAP API` (or similar) is registered in the n8n node package.
- [ ] The credential supports **Basic Auth** (username + password) configuration.
- [ ] The credential supports **OAuth2 Client Credentials** configuration (client ID, client secret, token URL).
- [ ] The credential includes a `Base URL` field for the CAP service root.
- [ ] A **Test** button in the n8n UI verifies connectivity by calling the service's `$metadata` endpoint.
- [ ] Credential values are stored securely by n8n's built-in encryption.
- [ ] Integration tests validate credential configuration and test connectivity logic.

---

### US 4.2 — Query Mode (Fetch Collection)

**As an** n8n workflow designer,
**I want to** use CAP node in Query mode to search and retrieve a list of entities — when I don't know the exact ID upfront — with optional filtering, sorting and pagination
**So that** I can browse or filter records to drive downstream decisions in my workflow.


#### Acceptance Criteria

- [ ] The CAP Action Node offers a **Query** operation mode.
- [ ] The user can select an Entity Set from a dynamically populated dropdown (see US 4.7).
- [ ] Optional `$filter` parameter is available as a free-text field for OData filter expressions.
- [ ] Optional `$orderby` parameter is available.
- [ ] Optional `$top` and `$skip` parameters are available for pagination.
- [ ] Optional `$select` parameter allows choosing specific fields.
- [ ] The node outputs the result array as individual n8n items for downstream processing.
- [ ] HTTP errors (4xx, 5xx) are surfaced as n8n node errors with descriptive messages.
- [ ] Integration tests cover query with filters, sorting, pagination, and error responses.

---

### US 4.3 — Read Mode (Fetch Single Entity)

**As an** n8n workflow designer,
**I want to** use the CAP node in read mode to fetch exactly one entity by providing its known primary key
**So that** I can look up a single specific record directly without searching through a list.


#### Acceptance Criteria

- [ ] The CAP Action Node offers a **Read** operation mode.
- [ ] The user can select an Entity Set from a dynamically populated dropdown.
- [ ] A **Key** field (or fields for composite keys) is available to specify the entity's primary key.
- [ ] The node outputs the single entity as one n8n item.
- [ ] A `404 Not Found` response from the CAP service produces a clear node error.
- [ ] Integration tests cover successful read, not-found, and composite key scenarios.

---

### US 4.4 — Create Mode (POST New Entity)

**As an** n8n workflow designer,
**I want to** use the CAP node in Create mode to POST a new entity to a CAP OData service
**So that** workflows can store data back into CAP without custom HTTP nodes.

#### Acceptance Criteria

- [ ] The CAP Action Node offers a **Create** operation mode.
- [ ] The user can select an Entity Set from a dynamically populated dropdown.
- [ ] A **Body** field (JSON) accepts the entity payload to be created.
- [ ] The node sends a `POST` request to the OData entity set URL.
- [ ] The node outputs the created entity (including server-generated fields like `ID`) as one n8n item.
- [ ] Validation errors (e.g., missing required fields) from the CAP service are surfaced as clear node errors.
- [ ] Integration tests cover successful creation, validation errors, and server errors.

---

### US 4.5 — Update Mode (PATCH Existing Entity)

**As an** n8n workflow designer,
**I want to** use the CAP node in Update mode to PATCH an existing entity in a CAP OData service
**So that** workflows can write computed data back to the correct record in CAP.

#### Acceptance Criteria

- [ ] The CAP Action Node offers an **Update** operation mode.
- [ ] The user can select an Entity Set from a dynamically populated dropdown.
- [ ] A **Key** field is available to identify the entity to update.
- [ ] A **Body** field (JSON) accepts the partial entity payload for the update.
- [ ] The node sends a `PATCH` request to the entity's OData URL.
- [ ] The node outputs the updated entity as one n8n item.
- [ ] If the entity does not exist, the CAP service error is surfaced as a clear node error.
- [ ] Integration tests cover successful update, partial update, not-found, and server error scenarios.

---

### US 4.6 — Delete Mode (Remove Entity by Key)

**As an** n8n workflow designer,
**I want to** use the CAP node in Delete mode to remove an entity from a CAP OData service by key
**So that** workflows can clean up or archive records in CAP as part of automated processes.

#### Acceptance Criteria

- [ ] The CAP Action Node offers a **Delete** operation mode.
- [ ] The user can select an Entity Set from a dynamically populated dropdown.
- [ ] A **Key** field is available to identify the entity to delete.
- [ ] The node sends a `DELETE` request to the entity's OData URL.
- [ ] The node outputs a confirmation status (e.g., `{ deleted: true }`).
- [ ] If the entity does not exist, the error is surfaced as a clear node error.
- [ ] Integration tests cover successful deletion, not-found, and server error scenarios.

---

### US 4.7 — Dynamic Metadata Discovery

**As an** n8n user,
**I want to** have available entities loaded automatically from the service into a dropdown within the n8n UI
**So that** I don't have to type entity names manually.

#### Acceptance Criteria

- [ ] When the CAP Action Node is opened in the n8n editor, it fetches the OData `$metadata` document using the configured credentials.
- [ ] The `$metadata` XML is parsed to extract all available Entity Sets.
- [ ] Entity Sets are presented in a dropdown for the user to select from (used by US 4.2–4.6).
- [ ] The dropdown refreshes when the credential or base URL changes.
- [ ] If the `$metadata` fetch fails (network error, auth error), a clear error message is shown in the n8n UI.
- [ ] Caching is implemented to avoid redundant `$metadata` calls during a single editing session.
- [ ] Integration tests cover metadata parsing, dropdown population, and error handling.

---

### US 4.8 — Invoke CAP Actions and Functions

**As an** n8n user,
**I want to** trigger custom business logic operations exposed by my CAP service
**So that** workflows can do more than just read and write data.

#### Acceptance Criteria

- [ ] The CAP Action Node offers an **Action/Function** operation mode.
- [ ] Available actions and functions are parsed from the `$metadata` and shown in a dropdown.
- [ ] Bound actions are invoked with the correct entity key in the URL path.
- [ ] Unbound actions/functions are invoked at the service root.
- [ ] Parameters for the action/function can be provided as a JSON body or query parameters (depending on the OData convention).
- [ ] The node outputs the action/function result as one n8n item.
- [ ] Integration tests cover bound actions, unbound actions, function imports, and error scenarios.

---

### US 4.9 — OData Response Unwrapping

**As an** n8n workflow designer,
**I want to** have the CAP community node automatically clean up the OData response format
**So that** I receive plain usable data without needing to know anything about OData conventions.

#### Acceptance Criteria

- [ ] The OData `value` wrapper is removed — results are returned as a direct array of items, not nested inside `{ value: [...] }`.
- [ ] OData metadata fields (e.g. `@odata.context`, `@odata.etag`) are stripped from the output.
- [ ] CAP date and time fields are correctly formatted to ISO 8601, which is the standard n8n expects.
- [ ] The node handles both `application/json` and `application/json;odata.metadata=minimal` response types without extra configuration.
- [ ] Integration tests cover collection responses, single entity responses, and empty result sets.

---

## Epic 5: SAP CAP Trigger Node (n8n → CAP) [Optional]

*Reacting to CAP changes directly from n8n.*

---

### US 5.1 — Polling Trigger Node

**As an** n8n user,
**I want to** have an SAP CAP Trigger Node that periodically polls a CAP OData endpoint to detect new or changed records, triggering my workflow automatically
**So that** my n8n workflows can react to data changes in CAP without manual intervention.

#### Acceptance Criteria

- [ ] A dedicated n8n Trigger Node named `SAP CAP Trigger` is registered in the node package.
- [ ] The node uses the SAP CAP credentials (US 4.1) for authentication.
- [ ] The user can select an Entity Set to poll from a dropdown (leveraging US 4.7 metadata discovery).
- [ ] A configurable polling interval (in seconds/minutes) is available.
- [ ] The node tracks the last poll timestamp and uses `$filter` (e.g., `modifiedAt gt <timestamp>`) to fetch only new/changed records.
- [ ] Each new/changed record is emitted as an individual n8n item to trigger downstream nodes.
- [ ] On first run (no previous timestamp), the node either fetches all records or starts from "now" based on a user setting.
- [ ] Integration tests cover polling logic, deduplication, first-run behavior, and error handling.

---

## Epic 6: Deployment & Configuration

*Ensuring the integration works in production and hybrid environments.*

---

### US 6.1 — SAP BTP Deployment

**As a** platform engineer,
**I want to** CAP+n8n integration to work on SAP BTP
**So that**  that the integration works when deployed to SAP's cloud platform.

#### Acceptance Criteria

- [ ] The CAP plugin can be configured via BTP environment variables or service bindings.
- [ ] n8n API credentials can be managed via BTP Destination Service or User-Provided Service Instances.
- [ ] The plugin works with both Cloud Foundry and Kyma/Kubernetes runtimes on BTP.
- [ ] A deployment guide or MTA descriptor snippet is provided for Cloud Foundry deployments.
- [ ] The plugin correctly handles BTP-specific networking (e.g., connectivity service for on-premise n8n).
- [ ] End-to-end integration tests are run on a BTP staging environment.

---

### US 6.2 — Hybrid Local/Cloud Testing

**As a** developer,
**I want to** run and test the integration locally against a cloud n8n instance
**So that** I can test changes without setting up a full cloud environment.



#### Acceptance Criteria

- [ ] A developer can run the CAP application locally while connecting to a cloud-hosted n8n instance.
- [ ] `cds bind` or `.env` file configuration allows pointing to a remote n8n API from a local machine.
- [ ] A developer can run the CAP application locally using the mock service (US 2.4) with zero external dependencies.
- [ ] The n8n community node can be tested locally against a local CAP server (`cds watch`).
- [ ] Documentation covers the hybrid setup with step-by-step instructions.
- [ ] A sample `.env.example` file is provided with all supported configuration variables.

---

## Technical Challenges

> [!NOTE]
> These challenges were identified during initial analysis and should be kept in mind during implementation.

### 1. Triggering & Schema Discovery
- **SAP BPA**: Has strongly typed process definitions with mandatory/optional inputs.
- **n8n**: Workflows are triggered via Webhook nodes accepting arbitrary JSON — no strict "input schema".
- **Mitigation**: Parse the n8n workflow JSON to locate the trigger node and generate a CDS schema. Consider a convention (e.g., a "SAP CAP Trigger" node that defines expected inputs).

### 2. Lifecycle & State Management
- **SAP BPA**: Natively supports `suspend`, `resume`, `cancel` based on a Business Key.
- **n8n**: Executes workflows directly; suspend/resume are not first-class concepts.
- **Mitigation**: Use n8n Tags to associate a CAP Business Key with an execution for querying/cancelling.

### 3. Authentication and Credentials
- **SAP BPA**: Uses standard BTP service bindings (`cds bind`).
- **n8n**: Uses API Keys or Basic Auth.
- **Mitigation**: Integrate n8n credentials into CAP's `cds.requires` configuration, supporting both `.env` and Cloud Foundry deployment.

---

## Resolved Design Decisions

1. **Repository Structure**: Monorepo approach — both `cap-n8n-plugin` and `n8n-nodes-sap-cap` live side-by-side.
2. **Execution Lifecycle**: The plugin will emit build warnings for unsupported lifecycle operations (suspend/resume) rather than attempting to simulate them.

---

## User Review Required

> [!IMPORTANT]
> Please review the epics, user stories, and acceptance criteria above. Let me know if any acceptance criteria need adjustment, or if the priority order of implementation should differ from the epic numbering.
