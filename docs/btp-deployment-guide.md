# SAP BTP Deployment Advisory Guide

This guide is advisory. Phase 8 documents how a platform engineer should reason about SAP BTP deployment, connectivity, and credentials for CAP n8n Integration, but it provides no runtime validation and does not ship runnable deployment scaffolding.

Phase 8 does not add or validate a committed `mta.yaml`, Cloud Foundry manifest, Helm chart, Kyma descriptor, or production Dockerfile. Treat this document as a checklist for the future deployment plan that will own those files.

## Scope

Use this guide to map the existing CAP and n8n configuration to a BTP landscape:

- CAP application route and authentication.
- n8n base URL and webhook reachability from CAP.
- n8n stop API reachability for cancellation.
- Secret storage through service binding, environment configuration, destination, or platform secret manager.
- Timeout and retry settings for cross-service network behavior.

Do not treat this guide as proof that the app has run on Cloud Foundry or Kyma. The current evidence is local automated verification plus manual UAT checklists.

## Shared Configuration Map

| Runtime concern | Local key or CAP option | BTP mapping |
|-----------------|-------------------------|-------------|
| CAP base URL for n8n node calls | `SAP_CAP_BASE_URL` | Deployed CAP route such as `BTP_CAP_BASE_URL=https://<cap-app-route>` |
| n8n webhook base | `credentials.baseUrl`, `N8N_BASE_URL` | Reachable n8n route such as `BTP_N8N_BASE_URL=https://<n8n-route>` |
| n8n API key | `credentials.apiKey`, `N8N_API_KEY` | Secret from service binding, platform secret store, or injected environment variable |
| Cancellation enabled | `cancel.supported`, `N8N_CANCEL_SUPPORTED` | Enable only when the n8n stop API is reachable and scoped credentials exist |
| n8n stop API base | `cancel.apiBaseUrl`, `N8N_CANCEL_API_BASE_URL` | API route for the same n8n instance or a controlled internal route |
| Retry timeout | `timeoutMs`, `retries`, `retryDelayMs` | Tune per network latency and route policy |
| Destination name | `BTP_DESTINATION_NAME` | Destination service entry if CAP reaches n8n through SAP connectivity |

Keep real values in BTP configuration and secret stores. Commit only placeholders such as `<cap-app-route>`, `<n8n-route>`, or `<btp-destination-name>`.

## Cloud Foundry Considerations

Cloud Foundry guidance is consideration-level only:

- Choose whether CAP calls n8n through a public route, a private route, or an SAP destination.
- Confirm routing and webhook reachability from the CAP app instance to `credentials.baseUrl`.
- Store `credentials.apiKey` and any OAuth client secret in environment configuration or a service binding, not in source control.
- If cancellation is required, confirm `cancel.supported=true` only after `cancel.apiBaseUrl` can reach `POST /api/v1/executions/<execution-id>/stop` on the target n8n route.
- Use least-scope n8n API keys where the n8n edition exposes execution scopes.
- Validate CAP authentication separately from this repo. The local demo Basic Auth path is not production guidance.
- Tune `timeoutMs`, `retries`, and `retryDelayMs` for the route and load balancer behavior.

Open work before Cloud Foundry runtime validation:

- Pick the deployment descriptor strategy.
- Provision CAP persistence and authentication services.
- Decide whether n8n is hosted inside the same BTP subaccount, another account, or externally.
- Run a deployed CAP-to-n8n webhook start and cancellation stop path in the target landscape.

## Kyma Considerations

Kyma guidance is also advisory:

- Decide how CAP and n8n are packaged as container workloads, and whether n8n is in-cluster or external.
- Confirm service-to-service routing, ingress, TLS, and DNS before setting `credentials.baseUrl`.
- Store `credentials.apiKey`, OAuth values, and n8n owner credentials in Kubernetes secrets or a managed secret store.
- Use network policy and gateway rules so CAP can reach n8n webhooks and, when enabled, the n8n stop API.
- Keep cancellation disabled until `cancel.apiBaseUrl` is reachable from the CAP workload and the n8n API key has the required stop permission.
- Use readiness/liveness checks for each runtime, but do not fold browser login or manual n8n workflow activation into automated CAP readiness.

Open work before Kyma runtime validation:

- Build production container images.
- Create Kubernetes resources or Helm charts in a future deployment phase.
- Validate CAP service bindings, secrets, route certificates, and n8n persistence.
- Run browser/manual evidence for installed custom-node E2E if n8n runs in the target cluster.

## Connectivity Checklist

Before claiming BTP readiness, verify these outside this Phase 8 advisory guide:

- CAP app can resolve and reach the configured n8n webhook host.
- n8n can reach the CAP OData base URL used by the SAP CAP node.
- CAP and n8n authentication modes are explicit and least-privilege.
- Secret values are injected at runtime and are absent from source, docs, fixtures, logs, and exported workflows.
- `npm run review:local` still passes locally as automated evidence.
- Manual UAT for real custom-node E2E and cancellation is recorded in `docs/release-readiness.md`.

## Current Evidence State

| Evidence | State | Notes |
|----------|-------|-------|
| Local automated review command | automated verified | `npm run review:local` is the repeatable command. |
| Cloud Foundry deployment | manual UAT required | No Cloud Foundry runtime validation in Phase 8. |
| Kyma deployment | manual UAT required | No Kyma runtime validation in Phase 8. |
| BTP secret and destination configuration | manual UAT required | Advisory mapping only. |
