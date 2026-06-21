# Phase 08: Deployment Docs and Release Readiness - Research

**Researched:** 2026-06-03
**Domain:** SAP CAP + n8n local review, documentation, release evidence
**Confidence:** MEDIUM-HIGH

## Summary

Phase 08 should be a release-readiness and evidence phase, not a product-expansion phase: the locked phase context limits implementation to docs, environment examples, release traceability, a real installed n8n custom-node E2E path, and a browser-first cancellation showcase with a real stop path. [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]

Primary recommendation: split planning into four implementation tracks: (1) local review command plus warning classification, (2) isolated Docker-based real n8n custom-node E2E harness, (3) dedicated stoppable workflow and cancellation runbook, and (4) docs/readiness artifacts covering `.env.example`, README links, BTP CF/Kyma advisory guidance, traceability, and evidence states. [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md] [VERIFIED: .planning/REQUIREMENTS.md] [VERIFIED: codebase]

The safe automation boundary is clear: current automated checks can cover package build/tests, CAP model compile, static workflow validation, and helper-script setup validation; real n8n UI proof, credential Test Connection, browser node operation checks, and visible cancellation proof remain manual/browser UAT until the repo has a stable browser harness and Docker daemon access in the review environment. [VERIFIED: local command] [VERIFIED: codebase]

## External Findings

### n8n custom/community node installation

- n8n manual community-node installation for Docker shells creates `~/.n8n/nodes`, installs an npm package there, and restarts n8n. [CITED: https://docs.n8n.io/integrations/community-nodes/installation/manual-install/]
- n8n local custom-node development uses build plus `npm link`, then links the package inside the n8n custom nodes directory such as `~/.n8n/custom/`; this supports a local unpublished package workflow. [CITED: https://docs.n8n.io/integrations/creating-nodes/test/run-node-locally/]
- n8n loads custom nodes from `.n8n/custom` by default and can load additional custom-node directories from `N8N_CUSTOM_EXTENSIONS`. [CITED: https://docs.n8n.io/hosting/configuration/configuration-examples/custom-nodes-location/] [CITED: https://docs.n8n.io/hosting/configuration/environment-variables/nodes/]
- n8n can manage installed community packages from environment variables with `N8N_COMMUNITY_PACKAGES_MANAGED_BY_ENV` and `N8N_COMMUNITY_PACKAGES`, but this is a registry-style package reconciliation path and can uninstall packages not listed when enabled. [CITED: https://docs.n8n.io/integrations/community-nodes/installation/env-install/]
- For this repo, prefer a Docker override/helper that builds or packs the local `cap-n8n-node` workspace and exposes it through `~/.n8n/custom`, `~/.n8n/nodes`, or `N8N_CUSTOM_EXTENSIONS`; do not rely on a public npm publish for Phase 08. [VERIFIED: cap-n8n-node/package.json] [CITED: https://docs.n8n.io/integrations/creating-nodes/test/run-node-locally/] [CITED: https://docs.n8n.io/hosting/configuration/configuration-examples/custom-nodes-location/]

### n8n execution stop/cancel capability

- n8n's public API reference lists execution operations including `GET /executions`, `GET /executions/{id}`, `DELETE /executions/{id}`, `POST /executions/{id}/retry`, `POST /executions/{id}/stop`, and `POST /executions/stop`. [CITED: https://docs.n8n.io/api/api-reference/]
- n8n API calls authenticate with an API key in the `X-N8N-API-KEY` header; API keys are created through the n8n UI under Settings > n8n API. [CITED: https://docs.n8n.io/api/authentication/]
- n8n API scopes include `execution:list` and `execution:stop`; an enterprise-scoped key should use the minimum execution scopes needed by the cancellation showcase. [CITED: https://docs.n8n.io/api/authentication/]
- Current plugin code calls `POST {apiBaseUrl}/api/v1/executions/{n8nExecutionId}/stop`, which aligns with the official stop endpoint shape. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] [CITED: https://docs.n8n.io/api/api-reference/]
- Deleting an execution is an API operation but should be documented as cleanup/history removal, not as cancellation; the Phase 08 acceptance path requires a real stop of a running or waiting execution. [CITED: https://docs.n8n.io/api/api-reference/] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]

### Stoppable workflow design

- The n8n Wait node can pause an execution, offload execution data to the database, and resume after a duration, specified time, webhook call, or form submission. [CITED: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/]
- n8n exposes `$execution.id` as the current workflow execution ID, and `$execution.resumeUrl` is available for workflows that contain a Wait node and wait for webhook response. [CITED: https://docs.n8n.io/code/cookbook/builtin/execution/]
- A dedicated cancellation fixture should return or otherwise surface the n8n execution ID to CAP before the workflow enters a Wait state, so the plugin can persist `n8nExecutionId` and later call the official stop endpoint. [CITED: https://docs.n8n.io/code/cookbook/builtin/execution/] [CITED: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/] [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js]

### n8n environment variables and secrets

- n8n deployment variables include `N8N_HOST`, `N8N_PORT`, `N8N_LISTEN_ADDRESS`, and `N8N_PROTOCOL`; endpoint configuration includes `WEBHOOK_URL` for reverse-proxy or externally visible webhook URLs. [CITED: https://docs.n8n.io/hosting/configuration/environment-variables/deployment/] [CITED: https://docs.n8n.io/hosting/configuration/configuration-examples/webhook-url/]
- n8n node/community-node variables include `N8N_COMMUNITY_PACKAGES_ENABLED`, `N8N_UNVERIFIED_PACKAGES_ENABLED`, `N8N_COMMUNITY_PACKAGES_MANAGED_BY_ENV`, `N8N_COMMUNITY_PACKAGES`, and `N8N_CUSTOM_EXTENSIONS`. [CITED: https://docs.n8n.io/hosting/configuration/environment-variables/nodes/]
- `.env.example` should contain placeholders only for n8n API keys, review login values, CAP demo base URLs, cloud n8n URLs, BTP destinations, and cancellation settings; this matches the project security constraint that secrets remain in environment configuration. [VERIFIED: AGENTS.md] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]

### SAP BTP Cloud Foundry and Kyma advisory guidance

- SAP CAP has official deployment guides for Cloud Foundry and Kyma; Phase 08 should link and summarize these as advisory guidance instead of adding deployment descriptors. [CITED: https://cap.cloud.sap/docs/guides/deploy/to-cf] [CITED: https://cap.cloud.sap/docs/guides/deploy/to-kyma] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]
- CAP Cloud Foundry deployment guidance covers production preparation, SAP HANA Cloud, authentication/authorization, MTA-based deployment, and Cloud Foundry CLI/MTA tooling. [CITED: https://cap.cloud.sap/docs/guides/deploy/to-cf]
- CAP Kyma deployment guidance describes Kyma as Kubernetes-based, requiring container images plus Kubernetes resources; prerequisites include a container registry, SAP BTP entitlements, Docker, `kubectl`, `pack`, and `helm`. [CITED: https://cap.cloud.sap/docs/guides/deploy/to-kyma]
- The BTP doc should explicitly avoid claiming runtime validation because this repo currently has no `mta.yaml`, Cloud Foundry manifest, Helm chart, Kyma descriptors, production Dockerfile, or deployed BTP environment evidence. [VERIFIED: .planning/codebase/STRUCTURE.md] [VERIFIED: .planning/codebase/CONCERNS.md] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]

## Codebase Findings

### Current local runtime and scripts

- Root npm workspaces are `demo-app`, `cap-n8n-plugin`, and `cap-n8n-node`; this is the correct boundary for Phase 08 helper scripts and docs. [VERIFIED: package.json]
- Root scripts already include `build`, `cap:serve`, `cap:compile`, `smoke`, `test:integration`, `test`, `n8n:up`, `n8n:workflow:import`, and `n8n:workflow:validate`. [VERIFIED: package.json]
- `cap-n8n-node` is named `n8n-nodes-sap-cap`, builds with `n8n-node build`, and declares Node engine `>=22.16 <25`, so the real-node E2E harness must run on the repo's current Node 24-compatible toolchain, not merely Node 20. [VERIFIED: cap-n8n-node/package.json]
- The installed local runtime observed during research was Node `v24.16.0`, npm `11.13.0`, and CAP CLI packages including `@sap/cds-dk 9.9.1` and `@sap/cds 9.9.1`. [VERIFIED: local command]

### Existing Docker/n8n state

- `docker-compose.yml` uses `n8nio/n8n:2.22.5`, exposes port `5678`, mounts `.n8n-data` and `test-workflows`, and sets local webhook host/protocol variables. [VERIFIED: docker-compose.yml]
- The current Docker Compose file does not mount, copy, link, or install the local `cap-n8n-node` package into n8n, so it cannot satisfy VERIFY-07 by itself. [VERIFIED: docker-compose.yml] [VERIFIED: .planning/REQUIREMENTS.md]
- Docker CLI and Docker Compose are installed locally, but the Docker daemon was not running during research; live n8n browser or API validation could not be performed in this session. [VERIFIED: local command]
- `.n8n-data/` is already ignored, but a new isolated review profile directory such as `.n8n-review-data/` or generated package staging directory should also be ignored if Phase 08 adds one. [VERIFIED: .gitignore]

### Current plugin cancellation support

- `N8nWorkflowService.cancel(executionId)` already branches between local cancellation state and active n8n execution stop based on execution status plus `cancelConfig.supported` and `cancelConfig.apiBaseUrl`. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js]
- `_stopN8nExecution()` sends `POST` to `/api/v1/executions/{id}/stop`, adds `X-N8N-API-KEY` when configured, applies timeout handling, and records cancelled state when n8n stop succeeds. [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js]
- `CancellationResolver` already maps business keys/tags to active workflow executions and invokes `n8n.cancel()` for matches, so Phase 08 should prove this path rather than inventing a second cancellation mechanism. [VERIFIED: cap-n8n-plugin/lib/CancellationResolver.js]
- `resolveN8nConfig()` already supports cancellation settings under `cancel`, `cancellation`, or `stop`, including `enabled`/`supported`, `apiBaseUrl`, API key, timeout, and active-status configuration. [VERIFIED: cap-n8n-plugin/lib/config.js]

### Existing docs, fixtures, and gaps

- `docs/manual-visual-showcase.md` already distinguishes completed screenshots from missing real custom-node and live cancellation proof, which is the right honesty standard for Phase 08 docs. [VERIFIED: docs/manual-visual-showcase.md]
- `.env.example` is absent and should be added at repo root with grouped placeholder-only settings for CAP demo, local n8n, real custom-node E2E, cancellation, and BTP/cloud advisory values. [VERIFIED: codebase] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]
- Existing workflow export `test-workflows/workflows.json` is a happy-path webhook fixture and should not be mutated for cancellation; add a dedicated stoppable/cancellable fixture instead. [VERIFIED: test-workflows/workflows.json] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]
- Existing exported workflow metadata includes personal author/update fields, so Phase 08 should sanitize any new or updated fixtures and docs before committing examples. [VERIFIED: test-workflows/workflows.json] [VERIFIED: AGENTS.md]

### Command evidence and warning classification

- `npm test` completed successfully during research: smoke tests and integration tests passed, with a Node `DEP0190` deprecation warning emitted during `n8n-node build`. [VERIFIED: local command]
- `npm run cap:compile` exited successfully during research but prints large CSN output, so a review command should redirect or summarize this output if used. [VERIFIED: local command]
- `npm test --workspaces --if-present` failed during research because the `cap-n8n-node` lint step reports current node-lint errors; this is a real defect/open release gap if the planner wants workspace-level tests green. [VERIFIED: local command]
- The current reliable automated release command should not include the failing workspace lint unless Phase 08 also fixes those lint errors; a lower-risk command can combine `npm test`, `npm run cap:compile`, and `npm run n8n:workflow:validate`. [VERIFIED: local command] [VERIFIED: package.json]
- `cf`, `helm`, and `mbt` were not available locally; `kubectl` was available through Docker Desktop tooling, so CF/Kyma validation should remain advisory/manual unless the user provisions those tools. [VERIFIED: local command]

## Recommended Plan Shape

### Track 1 - Local release/review command and warning classification

- Add a root `review:local` script or JS helper that runs only deterministic automated checks: `npm test`, `npm run cap:compile` with controlled output, and `npm run n8n:workflow:validate`. [VERIFIED: package.json] [VERIFIED: local command]
- Add a warning classification doc section with three buckets: `fix before release`, `accepted tooling warning`, and `manual/UAT evidence required`; classify current workspace lint failures as `fix before release` if workspace tests are part of release readiness. [VERIFIED: local command] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]
- Keep real Docker/browser n8n checks out of `review:local` until they are stable and non-interactive; document them as manual UAT commands/checklists instead. [VERIFIED: local command] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]

### Track 2 - Real installed n8n custom-node E2E harness

- Add a repo-owned Docker override/helper that starts an isolated n8n review profile and loads the local `n8n-nodes-sap-cap` package into n8n using an official custom/community node loading path. [VERIFIED: cap-n8n-node/package.json] [CITED: https://docs.n8n.io/integrations/creating-nodes/test/run-node-locally/] [CITED: https://docs.n8n.io/integrations/community-nodes/installation/manual-install/]
- Prefer generated local artifacts over registry dependency: run `npm run build --workspace n8n-nodes-sap-cap`, then install/link/copy the local package into the n8n custom-node location exposed by Docker. [VERIFIED: cap-n8n-node/package.json] [CITED: https://docs.n8n.io/hosting/configuration/configuration-examples/custom-nodes-location/]
- Use an isolated data directory and cleanup command for review evidence so existing `.n8n-data/` and developer-local n8n state are not polluted. [VERIFIED: docker-compose.yml] [VERIFIED: .gitignore]
- Write the browser checklist exactly around VERIFY-07: node appears in n8n, SAP CAP credential Test Connection passes, metadata entity options load, and Query, Read, Create, Update, Delete, Action, and Function operate against the demo CAP app. [VERIFIED: .planning/REQUIREMENTS.md] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]
- Document `host.docker.internal:3000` as the default Docker-to-host CAP base URL with a fallback note for Linux hosts where Docker host routing may differ. [ASSUMED]

### Track 3 - Browser-first cancellation showcase with real stop path

- Add a dedicated stoppable n8n workflow fixture instead of changing the existing happy-path webhook fixture. [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md] [VERIFIED: test-workflows/workflows.json]
- The fixture should expose `$execution.id` to CAP early and then enter a Wait state long enough for the reviewer to observe the running/waiting execution in the n8n UI and trigger CAP-side cancellation. [CITED: https://docs.n8n.io/code/cookbook/builtin/execution/] [CITED: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/]
- The runbook must configure `cancel.supported=true`, `cancel.apiBaseUrl=<n8n-api-base-url>`, and `N8N_API_KEY=<placeholder>` so the existing plugin calls n8n `POST /api/v1/executions/{id}/stop`. [VERIFIED: cap-n8n-plugin/lib/config.js] [VERIFIED: cap-n8n-plugin/lib/N8nWorkflowService.js] [CITED: https://docs.n8n.io/api/authentication/] [CITED: https://docs.n8n.io/api/api-reference/]
- Acceptance evidence must show the n8n UI execution state before cancellation and after CAP-triggered stop; terminal API calls may support the demo but cannot replace browser evidence. [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]

### Track 4 - Docs, `.env.example`, BTP advisory, and release traceability

- Add root `.env.example` grouped by workflow: CAP demo, local n8n, real custom-node E2E, cancellation, cloud n8n, and BTP placeholders. [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md] [VERIFIED: AGENTS.md]
- Update README as the entry point and link focused docs/runbooks for local demo, custom-node E2E, cancellation showcase, BTP advisory, release readiness, and troubleshooting. [VERIFIED: README.md] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]
- Write BTP guidance as advisory only: list CF/Kyma decisions, required tools, service bindings/secrets, webhook reachability, n8n API reachability, auth, destinations/connectivity, and unresolved production work; do not add `mta.yaml`, Cloud Foundry manifests, Helm charts, or Kyma files in this phase. [CITED: https://cap.cloud.sap/docs/guides/deploy/to-cf] [CITED: https://cap.cloud.sap/docs/guides/deploy/to-kyma] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]
- Create release-readiness traceability with evidence states exactly `automated verified`, `browser/manual verified`, or `manual UAT required`, mapping DOCS-01 through DOCS-07, VERIFY-05 through VERIFY-07, and relevant GitHub user stories to files, commands, fixtures, and evidence. [VERIFIED: .planning/REQUIREMENTS.md] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]
- Do not claim GitHub issue closure or production deployment readiness unless the evidence matrix contains matching verified evidence. [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]

## Risks/Open Questions

1. Docker daemon was unavailable during research, so real n8n startup, local node loading, API-key creation, and browser cancellation evidence remain unverified manual/UAT items. [VERIFIED: local command]
2. `npm test --workspaces --if-present` currently fails due to `cap-n8n-node` lint errors, so the planner must either fix lint before making workspace tests part of release readiness or explicitly exclude that command and document the gap. [VERIFIED: local command]
3. Returning `$execution.id` before the workflow waits is supported by n8n built-in execution variables, but the exact fixture shape still needs implementation-time validation in real n8n because webhook response timing can affect whether CAP receives the ID before the Wait node pauses. [CITED: https://docs.n8n.io/code/cookbook/builtin/execution/] [CITED: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/] [VERIFIED: .planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md]
4. The current Docker Compose file disables n8n user management, but Phase 08 may need a transient owner/login flow depending on n8n 2.22.5 runtime behavior in the isolated review profile. [VERIFIED: docker-compose.yml] [ASSUMED]
5. Linux Docker host routing for CAP at `host.docker.internal` may require additional gateway configuration, so the runbook should include a fallback probe and troubleshooting step. [ASSUMED]
6. CF/Kyma docs can be made review-ready without local CF/Kyma tooling, but any future production deployment plan must separately validate generated descriptors, service bindings, secrets, network reachability, and auth flows in the target SAP BTP subaccount. [CITED: https://cap.cloud.sap/docs/guides/deploy/to-cf] [CITED: https://cap.cloud.sap/docs/guides/deploy/to-kyma] [VERIFIED: local command]

## References

### Local project sources

- `.planning/phases/08-deployment-docs-and-release-readiness/08-CONTEXT.md` - locked Phase 08 decisions, scope, and evidence constraints.
- `.planning/REQUIREMENTS.md` - DOCS-01 through DOCS-07 and VERIFY-05 through VERIFY-07.
- `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/STATE.md` - milestone and workflow context.
- `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/TESTING.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONCERNS.md` - current codebase findings and gaps.
- `.planning/phases/07-n8n-mutations-and-cap-actions-functions/07-CONTEXT.md` - Phase 7 node-surface context.
- `README.md`, `docs/manual-visual-showcase.md`, `docker-compose.yml`, `package.json`, `cap-n8n-node/package.json` - current user docs, runtime scripts, Docker setup, and node package metadata.
- `cap-n8n-plugin/lib/N8nWorkflowService.js`, `cap-n8n-plugin/lib/config.js`, `cap-n8n-plugin/lib/CancellationResolver.js` - existing cancellation and n8n service implementation.
- `test-workflows/workflows.json` - current happy-path workflow fixture.

### Official external sources

- n8n manual community node install: https://docs.n8n.io/integrations/community-nodes/installation/manual-install/
- n8n run custom node locally: https://docs.n8n.io/integrations/creating-nodes/test/run-node-locally/
- n8n custom node locations: https://docs.n8n.io/hosting/configuration/configuration-examples/custom-nodes-location/
- n8n node/community env vars: https://docs.n8n.io/hosting/configuration/environment-variables/nodes/
- n8n managed community packages env install: https://docs.n8n.io/integrations/community-nodes/installation/env-install/
- n8n API auth: https://docs.n8n.io/api/authentication/
- n8n API reference: https://docs.n8n.io/api/api-reference/
- n8n Wait node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/
- n8n execution built-ins: https://docs.n8n.io/code/cookbook/builtin/execution/
- n8n deployment env vars: https://docs.n8n.io/hosting/configuration/environment-variables/deployment/
- n8n webhook URL config: https://docs.n8n.io/hosting/configuration/configuration-examples/webhook-url/
- SAP CAP deploy to Cloud Foundry: https://cap.cloud.sap/docs/guides/deploy/to-cf
- SAP CAP deploy to Kyma: https://cap.cloud.sap/docs/guides/deploy/to-kyma

### Assumptions to confirm during planning/execution

- `host.docker.internal:3000` is the default local Docker-to-host CAP base URL for the review environment. [ASSUMED]
- n8n 2.22.5 with the chosen review profile either honors the current user-management-disabled flow or has a documented transient owner setup path for reviewers. [ASSUMED]
- The dedicated stoppable fixture can return `$execution.id` to CAP before the workflow parks in Wait without custom n8n code. [ASSUMED]
