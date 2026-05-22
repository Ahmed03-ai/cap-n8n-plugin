# Proposed Epics & User Stories
Intro: This document describes the requirements for the cap-n8n-plugin, a CAP plugin that integrates n8n workflow automation into SAP CAP applications.

The primary user is a *CAP developer* building business applications on SAP BTP who wants to automate workflows without writing complex integration code.

The project is split into two distinct parts: **CAP → n8n** (The CAP Plugin) and **n8n → CAP** (The n8n Node).


---
## Epic 1: Programmatic API & Local Mocking (CAP → n8n)

*Providing a programmatic interface and local development support.*

- **US 1.1:** As a CAP developer, I want to have an n8n service I can connect to from my business logic to trigger workflows programmatically, so that business events in CAP reliably kick off automation in n8n.

- **US 1.2:** As a CAP developer, I want to cancel running workflows programmatically so that obsolete processes can be stopped automatically.

- **US 1.3:** As a CAP developer, I want to look up and filter running workflow executions by ID or label, so that I can display workflow progress in applications.

- **US 1.4:** As a CAP developer, I want to have a local mock implementation of n8n execution so that I can develop without a live n8n instance.

- **US 1.5:** As a CAP developer, I want to switch between a local mock and a real n8n instance using environment profiles, so that environment-specific behavior is managed without changing code.

- **US 1.6:** As a CAP developer, I want to have the integration layer automatically retry failed HTTP requests on transient errors, so that temporary outages do not cause permanent workflow failures.

- **US 1.7:** As a CAP developer, I want to receive a clear, structured error message when an HTTP call between CAP and n8n fails at runtime, so that I can quickly understand what went wrong without reading stack traces.

---

## Epic 2: CAP Declarative Workflow Triggers (CAP → n8n)

*Enabling CAP developers to start n8n workflows automatically via annotations.*

- **US 2.1:** As a CAP developer, I want to automatically trigger a workflow when a record is created, so that a workflow starts without writing any imperative code.

- **US 2.2:** As a CAP developer, I want to declaratively trigger workflows from my data model, so that a workflow starts automatically when a record is updated or deleted.

- **US 2.3:** As a CAP developer, I want to cancel running workflows declaratively so that obsolete processes can be stopped automatically.

- **US 2.4:** As a CAP developer, I want to control which data from my entity is passed to the workflow, so that the workflow receives exactly the information it needs.

- **US 2.5:** As a CAP developer, I want to specify conditions for when a workflow should be triggered, so that workflows are not started unnecessarily for every data change.

---



## Epic 3: Workflow Import and Typings (CAP → n8n)

*Bringing type safety and build-time validation to n8n workflows.*

- **US 3.1:** As a CAP developer, I want to import local workflow JSON files so that I can work on the integration without needing an active n8n connection.

- **US 3.2:** As a CAP developer, I want to import workflow definitions from n8n so that typed integration artifacts are generated automatically.

- **US 3.3:** As a CAP developer, I want to have my project build automatically validate that the data I am sending to workflows matches what the workflow expects, so that integration errors are caught at build time rather than at runtime.

---

## Epic 4: SAP CAP Action Node (n8n → CAP)

*Building the n8n Community Node to interact with CAP OData services.*

- **US 4.1:** As an n8n user, I want to configure an SAP CAP Credential Type (Basic Auth & OAuth2) so my workflow can securely authenticate against a BTP-deployed or local CAP service.

- **US 4.2:** As an n8n workflow designer, I want to use the CAP node in **Query mode** to search and retrieve a list of entities — when I don't know the exact ID upfront — with optional filtering, sorting and pagination, so that I can browse or filter records to drive downstream decisions in my workflow.

- **US 4.3:** As an n8n workflow designer, I want to use the CAP node in **Read mode** to fetch exactly one entity by providing its known primary key, so that I can look up a single specific record directly without searching through a list.

- **US 4.4:** As an n8n workflow designer, I want to use the CAP node in **Create mode** to POST a new entity to a CAP OData service, so that workflows can store data back into CAP without custom HTTP nodes.

- **US 4.5:** As an n8n workflow designer, I want to use the CAP node in **Update mode** to PATCH an existing entity in a CAP OData service, so that workflows can write computed data back to the correct record in CAP.

- **US 4.6:** As an n8n workflow designer, I want to use the CAP node in **Delete mode** to remove an entity from a CAP OData service by key, so that workflows can clean up or archive records in CAP as part of automated processes.

- **US 4.7:** As an n8n user, I want to have available entities loaded automatically from the service into a dropdown within the n8n UI, so that I don't have to type entity names manually.

- **US 4.8:** As an n8n user, I want to trigger custom business logic operations exposed by my CAP service, so that workflows can do more than just read and write data.

- **US 4.9:** As an n8n workflow designer, I want to have the CAP community node automatically clean up the OData response format, so that I receive plain usable data without needing to know anything about OData conventions.

---

## Epic 5: SAP CAP Trigger Node (n8n → CAP) [Optional]

*Reacting to CAP changes directly from n8n.*

- **US 5.1:** As an n8n user, I want to have an SAP CAP Trigger Node that periodically polls a CAP OData endpoint to detect new or changed records, triggering my workflow automatically, so that my n8n workflows can react to data changes in CAP without manual intervention.

---

## Epic 6: Deployment & Configuration

- **US 6.1:** As a platform engineer, I want to have the CAP+n8n integration work on SAP BTP, so that the integration works when deployed to SAP's cloud platform.

- **US 6.2:** As a developer, I want to run and test the integration locally against a cloud n8n instance, so that I can test changes without setting up a full cloud environment.
