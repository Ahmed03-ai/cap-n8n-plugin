# CAP n8n Plugin - Requirements

Integration of n8n workflow automation into the CAP framework, enabling developers to trigger n8n workflows from CAP applications and to interact with CAP services from within n8n workflows.

n8n reference: https://docs.n8n.io/

---

## CAP → n8n (Triggering n8n Workflows from CAP)

Allow developers to start n8n workflows from their CAP application, either declaratively via annotations or programmatically via a service interface, following the [Calesi Pattern](https://cap.cloud.sap/docs/get-started/concepts#the-calesi-pattern).

### 1.1 Declarative Approach

Developers annotate their CDS entities to automatically trigger n8n workflows on entity lifecycle events (create, update, delete) or bound actions.

```cds
@n8n.workflow.start: {
    id: '...',
    on: 'CREATE',
    inputs: [
      $self.id,
      { path: $self.amount, name: 'totalAmount' },
      $self.items
    ],
    if: (amount > 1000)
}
@n8n.workflow.cancel: { ... }
entity Orders { ... }
```

#### Acceptance Criteria

**Trigger on Create**
- [ ] A CDS entity annotated with `@n8n.workflow.start` triggers an n8n workflow execution when a `CREATE` event occurs.
- [ ] The annotation accepts a `workflowId` (or equivalent identifier) to specify which n8n workflow to start.
- [ ] The plugin intercepts the `CREATE` handler in the `AFTER` phase and invokes the n8n REST API.
- [ ] A successful n8n API call does not block or roll back the original CDS transaction.
- [ ] Errors from the n8n API are logged and do not prevent the CDS entity from being persisted.
- [ ] Integration tests cover the happy path (workflow triggered) and error path (n8n API unreachable).

**Trigger on Update and Delete**
- [ ] `@n8n.workflow.start` triggers an n8n workflow execution on `UPDATE` and `DELETE` events.
- [ ] The annotation supports an `on` property (e.g., `on: ['update', 'delete']`) to specify which events activate the trigger.
- [ ] If no `on` property is specified, the default behavior (create only) applies.
- [ ] The entity data (or key for deletes) is included in the n8n API call payload.
- [ ] Integration tests cover `UPDATE` and `DELETE` triggers independently and combined.

**Cancel Workflows Declaratively**
- [ ] A new annotation `@n8n.workflow.cancel` can be applied to CDS entities.
- [ ] When the annotated CDS event fires, the plugin calls the n8n API to stop the corresponding execution.
- [ ] The mapping between a CDS entity instance and its n8n execution is resolved via a stored execution ID or business key / tag.
- [ ] If no running execution is found for the entity, the cancellation is a no-op and logged as a warning.
- [ ] Errors during cancellation are logged but do not roll back the CDS transaction.
- [ ] Integration tests cover cancellation success, no-op (no execution found), and n8n API error scenarios.

**Map Entity Attributes to Workflow Inputs**
- [ ] The `@n8n.workflow.start` annotation supports an `inputs` array that maps CDS element names to workflow input keys.
- [ ] Scalar attributes (e.g., `String`, `Integer`, `Date`) are correctly serialized in the JSON payload.
- [ ] Managed associations (to-one) and compositions (to-many) are expanded and included in the payload.
- [ ] If a mapped element does not exist on the entity, the plugin throws a clear error at startup / registration time.
- [ ] Integration tests validate scalar mapping, association expansion, and missing-element error cases.

**Conditional Triggers**
- [ ] The `@n8n.workflow.start` annotation supports an `if:` expression evaluated against the current entity data at runtime.
- [ ] If the expression evaluates to `false`, the n8n API call is skipped silently (no error, optional debug log).
- [ ] Invalid expressions produce a clear error at plugin registration time.
- [ ] Integration tests cover true/false evaluation, complex expressions (e.g., `status = 'approved' AND amount > 1000`), and invalid expression errors.

---

### 1.2 Programmatic Approach

A generic CDS service interface is provided for custom orchestration, background jobs, or freestyle UIs.

```cds
@protocol: 'none'
service N8nWorkflowService {
  event start { ... }
  event cancel { ... }
  function getExecution(...) returns {};
  function getExecutionsByTag(...) returns many {};
}
```

```js
const n8nWorkflowService = await cds.connect.to('N8nWorkflowService');
await n8nWorkflowService.emit('start', {id: "asdf"});
```

#### Acceptance Criteria

**Trigger Workflows**
- [ ] A CDS service `N8nWorkflowService` is provided by the plugin and can be connected to via `cds.connect.to('n8n')`.
- [ ] The service exposes a `start(workflowId, inputs)` action that triggers an n8n workflow execution.
- [ ] The `start` action returns the n8n execution ID on success.
- [ ] The service authenticates against n8n using credentials from the CAP `cds.requires.n8n` configuration.
- [ ] Errors from the n8n API are propagated as standard CDS errors.
- [ ] Integration tests cover successful triggering, authentication, and error propagation.

**Cancel Workflows**
- [ ] The `N8nWorkflowService` exposes a `cancel(executionId)` action.
- [ ] Calling `cancel` invokes the n8n API to stop the specified execution.
- [ ] The action returns a confirmation status (e.g., `{ status: 'cancelled' }`).
- [ ] If the execution does not exist or has already completed, the API returns a meaningful error or no-op result.
- [ ] Integration tests cover successful cancellation, already-completed execution, and API error cases.

**Query Running Executions**
- [ ] The `N8nWorkflowService` exposes a `query(filters)` action that retrieves execution data from n8n.
- [ ] Filtering by tags (business keys) and by execution ID is supported.
- [ ] The returned data includes at minimum: execution ID, status, workflow ID, started at, and finished at timestamps.
- [ ] Pagination is supported for large result sets.
- [ ] Integration tests cover tag-based filtering, ID-based lookup, empty results, and pagination.

**Retry Logic**
- [ ] Transient errors (network timeout, 502, 503, 504) are retried up to a configurable number of times (default: 3).
- [ ] Each retry waits longer than the previous one (exponential backoff).
- [ ] Non-retryable errors (400, 401, 403, 404) are surfaced immediately without retrying.
- [ ] Every retry attempt is logged with the attempt number and the reason for retrying.
- [ ] Integration tests cover successful retry, max retries exceeded, and non-retryable error scenarios.

**Runtime Error Handling**
- [ ] All errors include: the source (CAP or n8n), the HTTP status code, and a plain-language description.
- [ ] A failed n8n trigger (e.g. n8n unreachable, returns 500) throws a CDS error with a meaningful message.
- [ ] n8n API errors such as rate limits or invalid payloads are surfaced with their original error message.
- [ ] Stack traces are not exposed to end users in production.
- [ ] Integration tests cover network failure, 4xx, and 5xx error scenarios.

---

### 1.3. n8n Workflow Import

Provide a mechanism to import n8n workflow definitions and generate typed CDS service models from them.

```bash
cds import --from n8n <workflowId|file.json>
```

This should:
- Fetch the workflow definition from the n8n API (or read from a local JSON file).
- Parse trigger nodes to determine expected input schema.
- Generate a CDS Service similar to the one above, but being specific to one workflow with typed action and events.

#### Acceptance Criteria

**Import Local Workflow JSON Files**
- [ ] The plugin supports a command (e.g., `cds import --from n8n <path-to-json>`) to import a local n8n workflow JSON file.
- [ ] The import parses the workflow JSON and generates a corresponding CDS service definition (`.cds` file) with typed inputs.
- [ ] The generated CDS model reflects the trigger node's expected inputs (webhook body, parameters, etc.).
- [ ] Import works fully offline without any n8n instance connectivity.
- [ ] Integration tests cover import of valid workflow JSON, generation of correct CDS types, and error handling for malformed JSON.

**Import Workflow Definitions from n8n**
- [ ] The plugin supports a command (e.g., `cds import --from n8n <workflow-id>`) to fetch a workflow definition from a live n8n instance.
- [ ] The command authenticates using the configured n8n API credentials.
- [ ] The fetched workflow JSON is saved locally for offline use.
- [ ] A CDS service definition (`.cds` file) is generated from the fetched workflow, identical in structure to a local import.
- [ ] The command provides clear error messages if the workflow ID is not found or authentication fails.
- [ ] Integration tests cover remote fetch, CDS generation, and error scenarios.

**Build-Time Validation**
- [ ] During `cds build`, the plugin validates all `@n8n.workflow.start` annotations against their corresponding imported CDS service definitions.
- [ ] Missing required inputs produce a build error with a clear message identifying the entity, annotation, and missing input.
- [ ] Type mismatches (e.g., mapping a `String` to an `Integer` input) produce a build error.
- [ ] Extra inputs (not defined in the imported schema) produce a build warning.
- [ ] If no imported CDS service exists for a referenced workflow, a build warning is emitted (not a hard error).
- [ ] Integration tests cover missing inputs, type mismatches, extra inputs, and missing import scenarios.

---

## n8n → CAP (n8n Community Node for SAP CAP)

Build a **separate npm package** that n8n users can install as a community node, giving them native access to CAP/OData services from within n8n workflows.

n8n community node docs: https://docs.n8n.io/integrations/community-nodes/

### 2.1 Credential Type

A credential configuration that allows n8n users to authenticate against CAP services. Should support the common authentication methods used by CAP applications (OAuth2, basic auth) for both BTP-deployed and locally running services.

#### Acceptance Criteria

- [ ] A custom n8n Credential Type named `SAP CAP API` (or similar) is registered in the n8n node package.
- [ ] The credential supports **Basic Auth** (username + password) configuration.
- [ ] The credential supports **OAuth2 Client Credentials** configuration (client ID, client secret, token URL).
- [ ] The credential includes a `Base URL` field for the CAP service root.
- [ ] A **Test** button in the n8n UI verifies connectivity by calling the service's `$metadata` endpoint.
- [ ] Credential values are stored securely by n8n's built-in encryption.
- [ ] Integration tests validate credential configuration and test connectivity logic.

---

### 2.2 SAP CAP Action Node

An n8n node that performs operations against a CAP OData service:

- **Query entities** - Read collections with optional filtering, sorting, pagination.
- **Read single entity** - Fetch a specific entity by key.
- **Create entity** - POST a new entity.
- **Update entity** - PATCH/PUT an existing entity.
- **Delete entity** - Remove an entity.
- **Call action/function** - Invoke bound or unbound OData actions and functions.

The node should allow the user to specify the service URL and entity set, with dynamic parameter loading where feasible (e.g. fetching available entity sets from the service's `$metadata`).

#### Acceptance Criteria

**Dynamic Metadata Discovery**
- [ ] When the CAP Action Node is opened in the n8n editor, it fetches the OData `$metadata` document using the configured credentials.
- [ ] Available Entity Sets are presented in a dropdown for the user to select from.
- [ ] The dropdown refreshes when the credential or base URL changes.
- [ ] If the `$metadata` fetch fails, a clear error message is shown in the n8n UI.
- [ ] Caching is implemented to avoid redundant `$metadata` calls during a single editing session.

**Query Mode**
- [ ] The node offers a **Query** operation mode to retrieve a list of entities.
- [ ] Optional `$filter`, `$orderby`, `$top`, `$skip`, and `$select` parameters are available.
- [ ] The node outputs the result array as individual n8n items for downstream processing.
- [ ] HTTP errors (4xx, 5xx) are surfaced as n8n node errors with descriptive messages.

**Read Mode**
- [ ] The node offers a **Read** operation mode to fetch exactly one entity by its primary key.
- [ ] A **Key** field (or fields for composite keys) is available to specify the entity's primary key.
- [ ] A `404 Not Found` response from the CAP service produces a clear node error.

**Create Mode**
- [ ] The node offers a **Create** operation mode to POST a new entity.
- [ ] A **Body** field (JSON) accepts the entity payload to be created.
- [ ] The node outputs the created entity (including server-generated fields like `ID`) as one n8n item.
- [ ] Validation errors from the CAP service are surfaced as clear node errors.

**Update Mode**
- [ ] The node offers an **Update** operation mode to PATCH an existing entity.
- [ ] A **Key** field is available to identify the entity to update.
- [ ] A **Body** field (JSON) accepts the partial entity payload for the update.
- [ ] If the entity does not exist, the CAP service error is surfaced as a clear node error.

**Delete Mode**
- [ ] The node offers a **Delete** operation mode to remove an entity by key.
- [ ] The node outputs a confirmation status (e.g., `{ deleted: true }`).
- [ ] If the entity does not exist, the error is surfaced as a clear node error.

**Actions and Functions**
- [ ] The node offers an **Action/Function** operation mode to invoke bound or unbound OData actions and functions.
- [ ] Available actions and functions are parsed from the `$metadata` and shown in a dropdown.
- [ ] The node outputs the action/function result as one n8n item.

**OData Response Unwrapping**
- [ ] The OData `value` wrapper is removed — results are returned as a direct array of items, not nested inside `{ value: [...] }`.
- [ ] OData metadata fields (e.g. `@odata.context`, `@odata.etag`) are stripped from the output.
- [ ] CAP date and time fields are correctly formatted to ISO 8601.
- [ ] Integration tests cover collection responses, single entity responses, and empty result sets.

---

### 2.3 SAP CAP Trigger Node (Optional)

An n8n trigger node that starts a workflow when something happens in a CAP application:

- **Polling mode** - The node periodically queries a CAP OData endpoint for new or changed records to react on changes in the data. 

#### Acceptance Criteria

- [ ] A dedicated n8n Trigger Node named `SAP CAP Trigger` is registered in the node package.
- [ ] The node uses the SAP CAP credentials (see 2.1) for authentication.
- [ ] The user can select an Entity Set to poll from a dropdown.
- [ ] A configurable polling interval (in seconds/minutes) is available.
- [ ] The node tracks the last poll timestamp and uses `$filter` to fetch only new/changed records.
- [ ] Each new/changed record is emitted as an individual n8n item to trigger downstream nodes.
- [ ] On first run, the node either fetches all records or starts from "now" based on a user setting.
- [ ] Integration tests cover polling logic, deduplication, first-run behavior, and error handling.

---

## 3. Non-Functional Requirements

Applying to CAP → n8n

### 3.1 Service Configuration & Credentials

The plugin should integrate cleanly into the standard CAP deployment lifecycle:

- **Credential handling** — n8n connection details (instance URL, API key) are read from service bindings or environment configuration at runtime; no hard-coded values.
- **Local development** — Usage of `cds bind` or equivalent to connect to a remote n8n instance during hybrid development.
- **Configuration profiles** — Support `[development]`, `[production]` profiles in `package.json` to switch between local mock and real n8n instance.

#### Acceptance Criteria

**Configuration Profiles**
- [ ] The plugin reads n8n connection settings from `cds.requires.n8n` in `package.json`.
- [ ] A `[development]` profile automatically activates the mock service.
- [ ] A `[production]` profile requires real n8n API credentials (`apiKey`, `baseUrl`) and connects to a live instance.
- [ ] Missing credentials in a non-development profile cause a clear startup error.
- [ ] Profile switching works via standard CAP mechanisms (`CDS_ENV`, `NODE_ENV`, `cds.requires.n8n.[profile]`).

**SAP BTP Deployment**
- [ ] The CAP plugin can be configured via BTP environment variables or service bindings.
- [ ] n8n API credentials can be managed via BTP Destination Service or User-Provided Service Instances.
- [ ] The plugin works with both Cloud Foundry and Kyma/Kubernetes runtimes on BTP.
- [ ] A deployment guide or MTA descriptor snippet is provided for Cloud Foundry deployments.
- [ ] End-to-end integration tests are run on a BTP staging environment.

**Hybrid Local/Cloud Testing**
- [ ] A developer can run the CAP application locally while connecting to a cloud-hosted n8n instance.
- [ ] `cds bind` or `.env` file configuration allows pointing to a remote n8n API from a local machine.
- [ ] The n8n community node can be tested locally against a local CAP server (`cds watch`).
- [ ] Documentation covers the hybrid setup with step-by-step instructions.
- [ ] A sample `.env.example` file is provided with all supported configuration variables.

---

### 3.2 Local Development & Mocking

A local mock service for development without an n8n instance:

- In-memory execution store that simulates the start → running → completed lifecycle.
- Important so that developers can build and test annotation-driven workflows without requiring a live n8n connection during development.

#### Acceptance Criteria

- [ ] A mock implementation of `N8nWorkflowService` is provided by the plugin.
- [ ] The mock stores executions in memory (start, cancel, query all work against the in-memory store).
- [ ] The mock is activated automatically when running in the `[development]` profile (or when no real n8n credentials are configured).
- [ ] Mock executions transition through states (e.g., `running` → `success`) after a configurable delay.
- [ ] Console output or debug logs indicate that the mock is active.
- [ ] Integration tests verify that the mock correctly simulates start, cancel, and query operations.

--- 

## 4. Next Steps

Make sure you did everything from my _Introduction_-Message on Teams

### 4.1 Resources

- Hybrid testing: https://cap.cloud.sap/docs/tools/cds-bind#hybrid-testing
- Deployment: https://cap.cloud.sap/docs/guides/deploy/to-cf
- Local development, only cloud when needed: https://cap.cloud.sap/docs/get-started/features#growing-as-you-go
- Event Handlers: https://cap.cloud.sap/docs/node.js/core-services (before, on, after)
- Fiori Elements Feature Showcase: https://github.com/SAP-samples/fiori-elements-feature-showcase
 - CAPire Org with samples: https://github.com/capire
- cap-js Org with existing Plugins: https://github.com/cap-js
- SAP Build Process Plugin: https://github.com/cap-js/process
- Grow as you Go: https://cap.cloud.sap/docs/get-started/features#growing-as-you-go

### 4.2 Action Items

- Creating Epics and User Stories as per your requirements from TUM
- Setting up a repository
- Start playing around with CAP, CAP Plugins, N8N
- Maybe even start with some implementations around an integration. Start simple, dont overcomplicate it
- And most importantly: Have fun :)
