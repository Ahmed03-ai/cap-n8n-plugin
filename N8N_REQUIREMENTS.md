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

### 1.3. n8n Workflow Import

Provide a mechanism to import n8n workflow definitions and generate typed CDS service models from them.

```bash
cds import --from n8n <workflowId|file.json>
```

This should:
- Fetch the workflow definition from the n8n API (or read from a local JSON file).
- Parse trigger nodes to determine expected input schema.
- Generate a CDS Service similar to the one above, but being specific to one workflow with typed action and events.

---

## n8n → CAP (n8n Community Node for SAP CAP)

Build a **separate npm package** that n8n users can install as a community node, giving them native access to CAP/OData services from within n8n workflows.

n8n community node docs: https://docs.n8n.io/integrations/community-nodes/

### 2.1 Credential Type

A credential configuration that allows n8n users to authenticate against CAP services. Should support the common authentication methods used by CAP applications (OAuth2, basic auth) for both BTP-deployed and locally running services.

### 2.2 SAP CAP Action Node

An n8n node that performs operations against a CAP OData service:

- **Query entities** - Read collections with optional filtering, sorting, pagination.
- **Read single entity** - Fetch a specific entity by key.
- **Create entity** - POST a new entity.
- **Update entity** - PATCH/PUT an existing entity.
- **Delete entity** - Remove an entity.
- **Call action/function** - Invoke bound or unbound OData actions and functions.

The node should allow the user to specify the service URL and entity set, with dynamic parameter loading where feasible (e.g. fetching available entity sets from the service's `$metadata`).

### 2.3 SAP CAP Trigger Node (Optional)

An n8n trigger node that starts a workflow when something happens in a CAP application:

- **Polling mode** - The node periodically queries a CAP OData endpoint for new or changed records to react on changes in the data. 

---

## 3. Non-Functional Requirements

Applying to CAP → n8n

### 3.1 Service Configuration & Credentials

The plugin should integrate cleanly into the standard CAP deployment lifecycle:

- **Credential handling** — n8n connection details (instance URL, API key) are read from service bindings or environment configuration at runtime; no hard-coded values.
- **Local development** — Usage of `cds bind` or equivalent to connect to a remote n8n instance during hybrid development.
- **Configuration profiles** — Support `[development]`, `[production]` profiles in `package.json` to switch between local mock and real n8n instance.

### 3.2 Local Development & Mocking

A local mock service for development without an n8n instance:

- In-memory execution store that simulates the start → running → completed lifecycle.
- Important so that developers can build and test annotation-driven workflows without requiring a live n8n connection during development.

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
