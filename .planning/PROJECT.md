# CAP n8n Integration

## What This Is

CAP n8n Integration is a developer-focused project that connects SAP CAP applications with n8n workflow automation. It has two product surfaces: a CAP plugin for triggering and managing n8n workflows from CAP, and an n8n community node for reading from and writing to CAP OData services.

The current repository is a brownfield prototype: it already contains a CAP demo app, a minimal CAP-to-n8n service implementation, local n8n Docker setup, exported workflow fixtures, n8n-node mockups, and a requirements document prepared for supervisor review.

## Core Value

CAP developers can add reliable n8n workflow automation to CAP applications without repeatedly hand-writing integration glue.

## Requirements

### Validated

- [x] Repository is structured as an npm workspace with separate packages for the CAP plugin, demo app, and n8n node.
- [x] Demo CAP application exposes Bookshop OData services with service handlers and Fiori Elements annotations.
- [x] CAP demo app can call an `n8n` service through `cds.connect.to('n8n')`.
- [x] Minimal `N8nWorkflowService` can trigger an n8n webhook using configured base URL and optional API key.
- [x] Local n8n runtime is available through Docker Compose.
- [x] Exported n8n workflow fixture exists for local workflow import/export scripts.
- [x] n8n-specific UI mockups exist for credentials and Query, Read, Create, Update, and Delete modes.
- [x] Supervisor-ready requirements source exists in `cap_n8n_requirements_v2.md`.

### Active

- [ ] Provide a typed CAP `N8nWorkflowService` contract with programmatic start, cancel, and execution lookup capabilities.
- [ ] Add a local mock implementation for offline development and deterministic integration tests.
- [ ] Support configuration profiles for local mock, local real n8n, cloud n8n, and production deployment.
- [ ] Add retry, timeout, and structured error handling for CAP-to-n8n HTTP calls.
- [ ] Implement declarative CAP annotations for workflow start, cancellation, event selection, input mapping, and conditional execution.
- [ ] Implement workflow import from local JSON and live n8n, including generated CDS typings.
- [ ] Validate workflow input mappings at build time.
- [ ] Implement the n8n community node with SAP CAP credentials, Query, Read, Create, Update, Delete, metadata discovery, action/function invocation, and OData response cleanup.
- [ ] Add integration tests across the CAP plugin, demo app, workflow import, and n8n node behavior.
- [ ] Document local, hybrid, and SAP BTP deployment setups.

### Out of Scope

- Replacing n8n's workflow engine - n8n remains the automation runtime.
- Building a custom workflow designer - n8n already provides workflow design and execution UI.
- Building a new CAP sample domain beyond the existing Bookshop demo - the demo exists to validate integration behavior.
- Mobile or end-user application UI work - the main users are developers and n8n workflow designers.
- Full production hosting of n8n itself - deployment guidance may explain connectivity, but the plugin does not operate n8n as a managed service.

## Context

The codebase currently contains three npm workspaces: `cap-n8n-plugin`, `demo-app`, and `cap-n8n-node`. The root `package.json` also provides scripts to import and export local n8n workflows through Docker Compose.

The CAP plugin surface currently lives mainly in `cap-n8n-plugin/lib/N8nWorkflowService.js` and `cap-n8n-plugin/cds-plugin.js`. It supports a single `start` event that posts JSON to an n8n webhook. The implementation does not yet provide the full service model, cancel/query APIs, local mock, retry policy, timeout behavior, annotation scanning, workflow import, or build-time validation described in the requirements.

The demo app under `demo-app` is a SAP CAP Bookshop-style application with CDS domain models, OData services, service handlers, Fiori annotations, and sample data. It demonstrates one hard-coded workflow trigger in `demo-app/srv/admin-service.js`.

The n8n node package under `cap-n8n-node` is currently a placeholder. The desired n8n-node behavior is described in `cap_n8n_requirements_v2.md` and partially visualized in `mockups/n8n-node-mockup.html`.

Detailed brownfield mapping lives in `.planning/codebase/` and should be consulted before planning implementation phases.

## Constraints

- **Tech stack**: Use JavaScript CommonJS, SAP CAP, CDS/CDL, npm workspaces, Docker Compose, and n8n community-node conventions already present in the repo.
- **Runtime**: Use Node.js 20+ because the locked `@sap/cds` dependency requires a modern Node runtime.
- **Testing**: Supervisor feedback requires integration tests rather than unit-test wording in requirements and planning artifacts.
- **Developer UX**: The primary user is a CAP developer, so technical detail is acceptable when it clarifies expected behavior.
- **n8n UI influence**: The project can influence node modes, field labels, credential fields, validation, descriptions, dropdowns, and node properties, but it should stay within n8n node-editor conventions.
- **Security**: Secrets must stay in environment configuration; generated docs and fixtures must not commit API keys, private keys, or real production credentials.
- **Brownfield state**: Existing demo behavior should not be mistaken for finished plugin behavior. Reusable behavior belongs in `cap-n8n-plugin` and `cap-n8n-node`, not only in `demo-app`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use `cap_n8n_requirements_v2.md` as the current requirements source | It merges the supervisor-facing wording with the implementation plan's acceptance criteria. | Pending |
| Treat the project as brownfield | The repo already contains code, mockups, workflow fixtures, and requirements artifacts. | Good |
| Map the existing codebase before project initialization | The initial GSD check detected existing code with no map, and the user chose to map first. | Good |
| Keep CAP plugin and n8n node in one monorepo | The current workspace structure already separates the two deliverables while sharing demo and workflow assets. | Pending |
| Prefer integration tests in requirements and planning language | Supervisor explicitly requested switching unit-test references to integration tests. | Good |
| Do not require CAP plugin UI mockups | The CAP plugin is developer-facing through service APIs, annotations, generated artifacts, and configuration. | Good |
| Include n8n node mockups where the node editor exposes functionality | Supervisor feedback said mockups are useful for n8n-specific user stories. | Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

After each phase transition:

1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. What This Is still accurate? Update if the product has drifted.

After each milestone:

1. Review all sections.
2. Check whether the Core Value is still the right priority.
3. Audit Out of Scope reasons.
4. Update Context with current code, feedback, and verification state.

---
*Last updated: 2026-05-28 after initialization*
