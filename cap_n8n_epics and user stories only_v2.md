# Proposed Epics & User Stories

The project is split into two distinct parts: **CAP → n8n** (The CAP Plugin) and **n8n → CAP** (The n8n Node).

---

## Epic 1: CAP Declarative Workflow Triggers (CAP → n8n)

*Enabling CAP developers to start n8n workflows automatically via annotations.*

- **US 1.1:** As a CAP developer, I want to annotate my CDS entities with `@n8n.workflow.start` so that an n8n workflow is automatically triggered via the n8n API when an entity is created.

- **US 1.2:** As a CAP developer, I want to annotate my CDS entities with `@n8n.workflow.start` so that an n8n workflow is automatically triggered via the n8n API when an entity is updated and deleted.

- **US 1.3:** As a CAP developer, I want to cancel running workflows declaratively so that obsolete processes can be stopped automatically.

- **US 1.4:** As a CAP developer, I want to use the `inputs` array in the annotation to map my entity attributes and associations to the JSON payload expected by the n8n workflow.

- **US 1.5:** As a CAP developer, I want to use the `if:` annotation expression to conditionally trigger n8n workflows only when specific data conditions are met.

---

## Epic 2: Programmatic API & Local Mocking (CAP → n8n)

*Providing a programmatic interface and local development support.*

- **US 2.1:** As a CAP developer, I want to connect to a generic `N8nWorkflowService` so I can programmatically trigger workflows from my custom Node.js event handlers.

- **US 2.2:** As a CAP developer, I want to cancel running workflows programmatically so that obsolete processes can be stopped automatically.

- **US 2.3:** As a CAP developer, I want to query running n8n executions using tags and execution IDs (representing business keys) via the programmatic API so that I can display workflow progress in applications.

- **US 2.4:** As a CAP developer, I want a local mock implementation of n8n execution so that I can develop without a live n8n instance.

- **US 2.5:** As a CAP developer, I want to use configuration profiles (e.g., `[development]`, `[production]`) in `package.json` to seamlessly switch between the local mock service and a real n8n instance.

---

## Epic 3: Workflow Import and Typings (CAP → n8n)

*Bringing type safety and build-time validation to n8n workflows.*

- **US 3.1:** As a CAP developer, I want to import local workflow JSON files so that offline development is possible.

- **US 3.2:** As a CAP developer, I want to import workflow definitions from n8n so that typed integration artifacts are generated automatically.

- **US 3.3:** As a CAP developer, I want the `cds build` process to validate my `@n8n.workflow.start` inputs against the imported CDS service, throwing errors if required inputs are missing or typed incorrectly.

---

## Epic 4: SAP CAP Action Node (n8n → CAP)

*Building the n8n Community Node to interact with CAP OData services.*

- **US 4.1:** As an n8n user, I want to configure an SAP CAP Credential Type (Basic Auth & OAuth2) so my workflow can securely authenticate against a BTP-deployed or local CAP service.

- **US 4.2:** As an n8n workflow designer, I want to use the CAP node in **Query mode** to fetch a collection of entities from a CAP OData service with optional filtering, sorting, and pagination, so that I can retrieve a relevant subset of records to drive decisions or iteration in my workflow.

- **US 4.3:** As an n8n workflow designer, I want to use the CAP node in **Read mode** to fetch a specific entity by its primary key, so that I can look up individual records to drive downstream decisions in my workflow.

- **US 4.4:** As an n8n workflow designer, I want to use the CAP node in **Create mode** to POST a new entity to a CAP OData service, so that workflows can store data back into CAP without custom HTTP nodes.

- **US 4.5:** As an n8n workflow designer, I want to use the CAP node in **Update mode** to PATCH an existing entity in a CAP OData service, so that workflows can write computed data back to the correct record in CAP.

- **US 4.6:** As an n8n workflow designer, I want to use the CAP node in **Delete mode** to remove an entity from a CAP OData service by key, so that workflows can clean up or archive records in CAP as part of automated processes.

- **US 4.7:** As an n8n user, I want the Action Node to dynamically fetch the `$metadata` of the CAP service to populate a dropdown of available Entity Sets in the n8n UI.

- **US 4.8:** As an n8n user, I want to invoke CAP actions/functions so that workflows can execute business logic.

---

## Epic 5: SAP CAP Trigger Node (n8n → CAP) [Optional]

*Reacting to CAP changes directly from n8n.*

- **US 5.1:** As an n8n user, I want an SAP CAP Trigger Node that periodically polls a CAP OData endpoint to detect new or changed records, triggering my workflow automatically.

---

## Epic 6: Deployment & Configuration

- **US 6.1:** As a platform engineer, I want CAP+n8n integration to work on SAP BTP so that cloud deployments are supported.

- **US 6.2:** As a developer, I want hybrid local/cloud testing so that I can iterate quickly.
