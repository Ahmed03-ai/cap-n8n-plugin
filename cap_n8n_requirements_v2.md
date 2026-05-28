# CAP n8n Integration Requirements

## Introduction

This document describes the requirements for `cap-n8n-plugin`, an integration between SAP CAP applications and n8n workflow automation.

The primary user is a CAP developer building business applications on SAP BTP or locally. Because the user is a developer, the requirements include some technical detail where it is necessary to define behavior precisely. The user stories themselves stay focused on user goals, while implementation-specific details are captured in the acceptance criteria.

The project has two main parts:

- **CAP -> n8n:** A CAP plugin that lets CAP applications trigger, monitor, and manage n8n workflows.
- **n8n -> CAP:** An n8n community node that lets n8n workflows interact with CAP OData services.

The requirements are organized as epics and user stories. The bullet points under each user story are acceptance criteria and should be kept as part of the requirements.

## Mockups

Mockups are provided for the n8n-specific user stories in `mockups/n8n-node-mockup.html`.

The mockups cover:

- SAP CAP credential configuration.
- Query mode versus Read mode.
- Create, Update, and Delete modes.

For the CAP plugin stories, separate visual mockups are not required because the main users interact with the plugin through CAP project configuration, annotations, generated artifacts, and service APIs rather than through a dedicated UI.

## Epic 1: Programmatic API and Local Mocking (CAP -> n8n)

Providing a programmatic interface and local development support.

### US 1.1: Programmatic Workflow Triggering

**As a** CAP developer,  
**I want to** connect to an n8n service from my business logic and trigger workflows programmatically,  
**So that** business events in CAP reliably start automation in n8n.

#### Acceptance Criteria

- [ ] A CDS service `N8nWorkflowService` is provided by the plugin and can be connected to via `cds.connect.to('n8n')`.
- [ ] The service exposes a `start(workflowId, inputs)` action that triggers an n8n workflow execution.
- [ ] The `start` action returns the n8n execution ID on success.
- [ ] The service authenticates against n8n using credentials from the CAP `cds.requires.n8n` configuration.
- [ ] Errors from the n8n API are propagated as standard CDS errors.
- [ ] Integration tests cover successful triggering, authentication, and error propagation.

### US 1.2: Cancel Workflows Programmatically

**As a** CAP developer,  
**I want to** cancel running workflows programmatically,  
**So that** obsolete processes can be stopped automatically.

#### Acceptance Criteria

- [ ] The `N8nWorkflowService` exposes a `cancel(executionId)` action.
- [ ] Calling `cancel` invokes the n8n API to stop the specified execution.
- [ ] The action returns a confirmation status, for example `{ status: 'cancelled' }`.
- [ ] If the execution does not exist or has already completed, the API returns a meaningful error or no-op result.
- [ ] Integration tests cover successful cancellation, already-completed execution, and API error cases.

### US 1.3: Find Running Executions

**As a** CAP developer,  
**I want to** look up and filter running workflow executions by ID or label,  
**So that** I can display workflow progress in applications.

#### Acceptance Criteria

- [ ] The `N8nWorkflowService` exposes an action such as `query(filters)` to retrieve execution data from n8n.
- [ ] Filtering by tags or business keys is supported.
- [ ] Filtering by execution ID is supported.
- [ ] The returned data includes at minimum: execution ID, status, workflow ID, started-at timestamp, and finished-at timestamp.
- [ ] Pagination is supported for large result sets.
- [ ] Integration tests cover tag-based filtering, ID-based lookup, empty results, and pagination.

### US 1.4: Local Mock Implementation

**As a** CAP developer,  
**I want to** use a local mock implementation of n8n execution,  
**So that** I can develop without a live n8n instance.

#### Acceptance Criteria

- [ ] A mock implementation of `N8nWorkflowService` is provided by the plugin.
- [ ] The mock stores executions in memory.
- [ ] The mock supports start, cancel, and lookup behavior against the in-memory store.
- [ ] The mock is activated automatically in the `[development]` profile or when no real n8n credentials are configured.
- [ ] Mock executions transition through states, for example from `running` to `success`, after a configurable delay.
- [ ] Console output or debug logs indicate that the mock is active.
- [ ] Integration tests verify that the mock correctly simulates start, cancel, and lookup operations.

### US 1.5: Configuration Profiles

**As a** CAP developer,  
**I want to** switch between a local mock and a real n8n instance using environment profiles,  
**So that** environment-specific behavior is managed without changing code.

#### Acceptance Criteria

- [ ] The plugin reads n8n connection settings from `cds.requires.n8n` in `package.json`.
- [ ] A `[development]` profile automatically activates the mock service described in US 1.4.
- [ ] A `[production]` profile requires real n8n API credentials such as `apiKey` and `baseUrl`.
- [ ] Missing credentials in a non-development profile cause a clear startup error.
- [ ] Profile switching works via standard CAP mechanisms such as `CDS_ENV`, `NODE_ENV`, and profile-specific `cds.requires.n8n` settings.
- [ ] Documentation explains the configuration options.

### US 1.6: Retry Logic for HTTP Requests

**As a** CAP developer,  
**I want to** have the integration automatically retry failed HTTP requests caused by temporary errors,  
**So that** short outages do not permanently break workflow execution.

#### Acceptance Criteria

- [ ] Transient errors, including network timeouts and HTTP 502, 503, and 504 responses, are retried up to a configurable number of times.
- [ ] The default retry count is 3.
- [ ] Each retry waits longer than the previous one.
- [ ] Non-retryable errors, including HTTP 400, 401, 403, and 404 responses, are surfaced immediately without retrying.
- [ ] Every retry attempt is logged with the attempt number and the reason for retrying.
- [ ] Integration tests cover successful retry, max retries exceeded, and non-retryable error scenarios.

### US 1.7: Runtime Error Handling

**As a** CAP developer,  
**I want to** receive clear, structured error messages when communication between CAP and n8n fails,  
**So that** I can quickly understand what went wrong without reading stack traces.

#### Acceptance Criteria

- [ ] All errors include the source system, the HTTP status code if available, and a plain-language description.
- [ ] A failed n8n trigger, for example when n8n is unreachable or returns HTTP 500, throws a CDS error with a meaningful message in the CAP layer.
- [ ] n8n API errors such as rate limits or invalid payloads are surfaced with their original error message when appropriate.
- [ ] CAP OData error responses, such as validation failures, are unpacked and included in the error detail.
- [ ] Stack traces are not exposed to end users in production.
- [ ] Integration tests cover network failure, 4xx, and 5xx error scenarios.

## Epic 2: CAP Declarative Workflow Triggers (CAP -> n8n)

Enabling CAP developers to start n8n workflows automatically from their CAP data model.

### US 2.1: Trigger Workflow on Entity Creation

**As a** CAP developer,  
**I want to** automatically trigger a workflow when a record is created,  
**So that** workflow automation starts without writing imperative trigger code.

#### Acceptance Criteria

- [ ] A CDS entity annotated with `@n8n.workflow.start` triggers an n8n workflow execution when a `CREATE` event occurs.
- [ ] The annotation accepts a workflow identifier to specify which n8n workflow to start.
- [ ] The workflow starts after the new CAP record has been persisted.
- [ ] A successful n8n API call does not block or roll back the original CDS transaction.
- [ ] Errors from the n8n API are logged and do not prevent the CDS entity from being persisted.
- [ ] Integration tests cover the happy path and the error path where the n8n API is unreachable.

### US 2.2: Trigger Workflow on Entity Update and Delete

**As a** CAP developer,  
**I want to** declaratively trigger workflows from my data model when records are updated or deleted,  
**So that** workflow automation can react to data changes without custom imperative code.

#### Acceptance Criteria

- [ ] A CDS entity annotated with `@n8n.workflow.start` can trigger an n8n workflow execution on `UPDATE` events.
- [ ] A CDS entity annotated with `@n8n.workflow.start` can trigger an n8n workflow execution on `DELETE` events.
- [ ] The annotation supports an event selection property, for example `on: ['update', 'delete']`, to specify which events activate the trigger.
- [ ] If no event selection property is specified, the default behavior from US 2.1 applies.
- [ ] The entity data, or the entity key for deletes, is included in the n8n API call payload.
- [ ] Integration tests cover `UPDATE` and `DELETE` triggers independently and combined.

### US 2.3: Cancel Running Workflows Declaratively

**As a** CAP developer,  
**I want to** cancel running workflows declaratively from my data model,  
**So that** obsolete processes can be stopped automatically.

#### Acceptance Criteria

- [ ] A new annotation `@n8n.workflow.cancel` can be applied to CDS entities.
- [ ] When the relevant CDS event occurs, the plugin calls the n8n API to stop the corresponding execution.
- [ ] The mapping between a CDS entity instance and its n8n execution is resolved via a stored execution ID, business key, or tag.
- [ ] If no running execution is found for the entity, the cancellation is a no-op and logged as a warning.
- [ ] Errors during cancellation are logged but do not roll back the CDS transaction.
- [ ] Integration tests cover cancellation success, no-op when no execution is found, and n8n API error scenarios.

### US 2.4: Map Entity Attributes to Workflow Inputs

**As a** CAP developer,  
**I want to** control which data from my entity is passed to the workflow,  
**So that** the workflow receives exactly the information it needs.

#### Acceptance Criteria

- [ ] The `@n8n.workflow.start` annotation supports an `inputs` configuration that maps CDS element names to workflow input keys.
- [ ] Scalar attributes such as `String`, `Integer`, and `Date` are correctly serialized in the JSON payload.
- [ ] Managed to-one associations can be expanded and included in the payload.
- [ ] Composition or to-many associations can be expanded and included as arrays in the payload.
- [ ] If a mapped element does not exist on the entity, the plugin throws a clear error at startup or registration time.
- [ ] Integration tests validate scalar mapping, association expansion, and missing-element error cases.

### US 2.5: Conditional Workflow Triggers

**As a** CAP developer,  
**I want to** specify conditions for when a workflow should be triggered using an expression language,  
**So that** workflows are not started unnecessarily for every data change.

#### Acceptance Criteria

- [ ] The workflow trigger annotation supports a conditional expression.
- [ ] The expression is evaluated against the current entity data before calling the n8n API.
- [ ] If the expression evaluates to `false`, the n8n API call is skipped without an error.
- [ ] If the expression evaluates to `true`, the workflow trigger proceeds as normal.
- [ ] Invalid expressions produce a clear error at plugin registration time.
- [ ] Integration tests cover true evaluation, false evaluation, complex expressions, and invalid expression errors.

## Epic 3: Workflow Import and Typings (CAP -> n8n)

Bringing type safety and build-time validation to n8n workflow integration.

### US 3.1: Import Local Workflow JSON Files

**As a** CAP developer,  
**I want to** import local workflow JSON files,  
**So that** I can work on the integration without needing an active n8n connection.

#### Acceptance Criteria

- [ ] The plugin supports a command or mechanism to import a local n8n workflow JSON file.
- [ ] The import parses the workflow JSON and generates a corresponding CDS service definition with typed inputs.
- [ ] The generated CDS model reflects the trigger node's expected inputs, such as webhook body or parameters.
- [ ] The imported workflow ID is stored in the generated CDS model for reference.
- [ ] Import works fully offline without n8n instance connectivity.
- [ ] Integration tests cover import of valid workflow JSON, generation of correct CDS types, and error handling for malformed JSON.

### US 3.2: Import Workflow Definitions from n8n

**As a** CAP developer,  
**I want to** import workflow definitions from n8n,  
**So that** typed integration artifacts are generated automatically.

#### Acceptance Criteria

- [ ] The plugin supports a command or mechanism to fetch a workflow definition from a live n8n instance.
- [ ] The command authenticates using the configured n8n API credentials.
- [ ] The fetched workflow JSON is saved locally for offline use.
- [ ] A CDS service definition is generated from the fetched workflow, identical in structure to a local import.
- [ ] The command provides clear error messages if the workflow ID is not found or authentication fails.
- [ ] Integration tests cover remote fetch, CDS generation, and error scenarios.

### US 3.3: Build-Time Validation of Workflow Inputs

**As a** CAP developer,  
**I want to** have my project build validate that the data I send to workflows matches what the workflow expects,  
**So that** integration errors are caught before runtime.

#### Acceptance Criteria

- [ ] During `cds build`, the plugin validates all workflow trigger annotations against their corresponding imported CDS service definitions.
- [ ] Missing required inputs produce a build error with a clear message identifying the entity, annotation, and missing input.
- [ ] Type mismatches produce a build error.
- [ ] Extra inputs that are not defined in the imported schema produce a build warning.
- [ ] If no imported CDS service exists for a referenced workflow, a build warning is emitted rather than a hard error to support untyped usage.
- [ ] Integration tests cover missing inputs, type mismatches, extra inputs, and missing import scenarios.

## Epic 4: SAP CAP Action Node (n8n -> CAP)

Building an n8n community node that can interact with CAP OData services.

The n8n node UI follows n8n's standard node editor patterns. The project can influence the available node modes, field labels, dropdowns, descriptions, validation behavior, and credential fields.

### US 4.1: SAP CAP Credential Type

**As an** n8n user,  
**I want to** configure an SAP CAP credential type,  
**So that** my workflow can securely authenticate against a BTP-deployed or local CAP service.

#### Acceptance Criteria

- [ ] A custom n8n credential type named `SAP CAP API` or similar is registered in the n8n node package.
- [ ] The credential supports Basic Auth configuration.
- [ ] The credential supports OAuth2 Client Credentials configuration.
- [ ] The credential includes a Base URL field for the CAP service root.
- [ ] A Test button in the n8n UI verifies connectivity by calling the service's `$metadata` endpoint.
- [ ] Credential values are stored securely by n8n's built-in encryption.
- [ ] Integration tests validate credential configuration and test connectivity logic.
- [ ] The credential UI is represented in the n8n mockups.

### US 4.2: Query Mode (Fetch Collection)

**As an** n8n workflow designer,  
**I want to** use the CAP node in Query mode to search and retrieve a list of entities when I do not know the exact ID upfront,  
**So that** I can browse or filter records to drive downstream decisions in my workflow.

#### Acceptance Criteria

- [ ] The CAP Action Node offers a Query operation mode.
- [ ] Query mode is clearly described as fetching a collection or list of records.
- [ ] The user can select an Entity Set from a dynamically populated dropdown.
- [ ] Optional `$filter` parameter is available as a free-text field for OData filter expressions.
- [ ] Optional `$orderby` parameter is available.
- [ ] Optional `$top` and `$skip` parameters are available for pagination.
- [ ] Optional `$select` parameter allows choosing specific fields.
- [ ] The node outputs the result array as individual n8n items for downstream processing.
- [ ] HTTP errors are surfaced as n8n node errors with descriptive messages.
- [ ] Integration tests cover query with filters, sorting, pagination, and error responses.
- [ ] Query mode is represented in the n8n mockups and visually distinguished from Read mode.

### US 4.3: Read Mode (Fetch Single Entity)

**As an** n8n workflow designer,  
**I want to** use the CAP node in Read mode to fetch exactly one entity by providing its known primary key,  
**So that** I can look up a single specific record directly without searching through a list.

#### Acceptance Criteria

- [ ] The CAP Action Node offers a Read operation mode.
- [ ] Read mode is clearly described as fetching one specific record by known key.
- [ ] The user can select an Entity Set from a dynamically populated dropdown.
- [ ] A Key field, or multiple fields for composite keys, is available to specify the entity's primary key.
- [ ] The node outputs the single entity as one n8n item.
- [ ] A `404 Not Found` response from the CAP service produces a clear node error.
- [ ] Integration tests cover successful read, not-found, and composite key scenarios.
- [ ] Read mode is represented in the n8n mockups and visually distinguished from Query mode.

### US 4.4: Create Mode (POST New Entity)

**As an** n8n workflow designer,  
**I want to** use the CAP node in Create mode to add a new entity to a CAP OData service,  
**So that** workflows can store data back into CAP without custom HTTP nodes.

#### Acceptance Criteria

- [ ] The CAP Action Node offers a Create operation mode.
- [ ] The user can select an Entity Set from a dynamically populated dropdown.
- [ ] A Body field accepts the entity payload to be created.
- [ ] The node sends a `POST` request to the OData entity set URL.
- [ ] The node outputs the created entity, including server-generated fields such as `ID`, as one n8n item.
- [ ] Validation errors from the CAP service are surfaced as clear node errors.
- [ ] Integration tests cover successful creation, validation errors, and server errors.
- [ ] Create mode is represented in the n8n mockups.

### US 4.5: Update Mode (PATCH Existing Entity)

**As an** n8n workflow designer,  
**I want to** use the CAP node in Update mode to update an existing entity in a CAP OData service,  
**So that** workflows can write computed data back to the correct record in CAP.

#### Acceptance Criteria

- [ ] The CAP Action Node offers an Update operation mode.
- [ ] The user can select an Entity Set from a dynamically populated dropdown.
- [ ] A Key field is available to identify the entity to update.
- [ ] A Body field accepts the partial entity payload for the update.
- [ ] The node sends a `PATCH` request to the entity's OData URL.
- [ ] The node outputs the updated entity as one n8n item.
- [ ] If the entity does not exist, the CAP service error is surfaced as a clear node error.
- [ ] Integration tests cover successful update, partial update, not-found, and server error scenarios.
- [ ] Update mode is represented in the n8n mockups.

### US 4.6: Delete Mode (Remove Entity by Key)

**As an** n8n workflow designer,  
**I want to** use the CAP node in Delete mode to remove an entity from a CAP OData service by key,  
**So that** workflows can clean up or archive records in CAP as part of automated processes.

#### Acceptance Criteria

- [ ] The CAP Action Node offers a Delete operation mode.
- [ ] The user can select an Entity Set from a dynamically populated dropdown.
- [ ] A Key field is available to identify the entity to delete.
- [ ] The node sends a `DELETE` request to the entity's OData URL.
- [ ] The node outputs a confirmation status, for example `{ deleted: true }`.
- [ ] If the entity does not exist, the error is surfaced as a clear node error.
- [ ] Integration tests cover successful deletion, not-found, and server error scenarios.
- [ ] Delete mode is represented in the n8n mockups.

### US 4.7: Dynamic Metadata Discovery

**As an** n8n user,  
**I want to** have available entities loaded automatically from the CAP service into a dropdown in the n8n UI,  
**So that** I do not have to type entity names manually.

#### Acceptance Criteria

- [ ] When the CAP Action Node is opened in the n8n editor, it fetches the OData `$metadata` document using the configured credentials.
- [ ] The `$metadata` XML is parsed to extract all available Entity Sets.
- [ ] Entity Sets are presented in a dropdown for the user to select from.
- [ ] The dropdown refreshes when the credential or base URL changes.
- [ ] If the `$metadata` fetch fails, a clear error message is shown in the n8n UI.
- [ ] Caching is implemented to avoid redundant `$metadata` calls during a single editing session.
- [ ] Integration tests cover metadata parsing, dropdown population, and error handling.
- [ ] Metadata-loaded dropdown behavior is reflected in the n8n mockups for the operation modes.

### US 4.8: Invoke CAP Actions and Functions

**As an** n8n user,  
**I want to** trigger custom business logic operations exposed by my CAP service,  
**So that** workflows can do more than just read and write data.

#### Acceptance Criteria

- [ ] The CAP Action Node offers an Action/Function operation mode.
- [ ] Available actions and functions are parsed from `$metadata` and shown in a dropdown.
- [ ] Bound actions are invoked with the correct entity key in the URL path.
- [ ] Unbound actions and functions are invoked at the service root.
- [ ] Parameters for the action or function can be provided as a JSON body or query parameters depending on the OData convention.
- [ ] The node outputs the action or function result as one n8n item.
- [ ] Integration tests cover bound actions, unbound actions, function imports, and error scenarios.

### US 4.9: OData Response Cleanup

**As an** n8n workflow designer,  
**I want to** receive plain usable data from the CAP community node,  
**So that** I do not need to know OData response conventions to use the data in downstream workflow steps.

#### Acceptance Criteria

- [ ] The OData `value` wrapper is removed so collection results are returned as direct arrays of items.
- [ ] OData metadata fields, such as `@odata.context` and `@odata.etag`, are stripped from the output.
- [ ] CAP date and time fields are formatted consistently for n8n usage.
- [ ] The node handles both `application/json` and `application/json;odata.metadata=minimal` response types without extra configuration.
- [ ] Integration tests cover collection responses, single entity responses, and empty result sets.

## Epic 5: SAP CAP Trigger Node (n8n -> CAP) [Optional]

Reacting to CAP changes directly from n8n.

### US 5.1: Polling Trigger Node

**As an** n8n user,  
**I want to** use an SAP CAP Trigger Node that periodically checks a CAP OData endpoint for new or changed records,  
**So that** my n8n workflows can react to data changes in CAP without manual intervention.

#### Acceptance Criteria

- [ ] A dedicated n8n Trigger Node named `SAP CAP Trigger` is registered in the node package.
- [ ] The node uses the SAP CAP credentials from US 4.1 for authentication.
- [ ] The user can select an Entity Set to poll from a dropdown.
- [ ] A configurable polling interval is available.
- [ ] The node tracks the last poll timestamp and fetches only new or changed records where possible.
- [ ] Each new or changed record is emitted as an individual n8n item to trigger downstream nodes.
- [ ] On first run, when no previous timestamp exists, the node either fetches all records or starts from the current time based on a user setting.
- [ ] Integration tests cover polling logic, deduplication, first-run behavior, and error handling.

## Epic 6: Deployment and Configuration

Ensuring the integration works in production and hybrid environments.

### US 6.1: SAP BTP Deployment

**As a** platform engineer,  
**I want to** run the CAP and n8n integration on SAP BTP,  
**So that** the integration works when deployed to SAP's cloud platform.

#### Acceptance Criteria

- [ ] The CAP plugin can be configured via BTP environment variables or service bindings.
- [ ] n8n API credentials can be managed via BTP Destination Service or User-Provided Service Instances.
- [ ] The plugin works with both Cloud Foundry and Kyma/Kubernetes runtimes on BTP.
- [ ] A deployment guide or MTA descriptor snippet is provided for Cloud Foundry deployments.
- [ ] The plugin correctly handles BTP-specific networking, such as connectivity service usage for on-premise n8n.
- [ ] End-to-end integration tests are run on a BTP staging environment.

### US 6.2: Hybrid Local and Cloud Testing

**As a** developer,  
**I want to** run and test the integration locally against a cloud n8n instance,  
**So that** I can test changes without setting up a full cloud environment.

#### Acceptance Criteria

- [ ] A developer can run the CAP application locally while connecting to a cloud-hosted n8n instance.
- [ ] `cds bind` or `.env` file configuration allows pointing to a remote n8n API from a local machine.
- [ ] A developer can run the CAP application locally using the mock service from US 1.4 with zero external dependencies.
- [ ] The n8n community node can be tested locally against a local CAP server.
- [ ] Documentation covers the hybrid setup with step-by-step instructions.
- [ ] A sample `.env.example` file is provided with all supported configuration variables.

## Notes for Implementation Planning

The following points are relevant for later implementation planning but are not separate user stories:

- n8n workflows triggered through webhooks may not expose strict input schemas by default. The plugin should therefore derive useful typing information from workflow JSON where possible and document any required conventions.
- n8n does not provide the same lifecycle model as SAP Build Process Automation. Unsupported lifecycle operations such as suspend and resume should produce clear warnings rather than being silently simulated.
- The repository is expected to use a monorepo structure containing the CAP plugin, the n8n community node, demo applications, test workflows, and mockups.
