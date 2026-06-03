---
status: partial
phase: 08-deployment-docs-and-release-readiness
source: [08-VERIFICATION.md]
started: 2026-06-03T23:30:12Z
updated: 2026-06-03T23:30:12Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real n8n Custom-Node E2E
expected: SAP CAP node appears in n8n, SAP CAP API credentials Test Connection passes, metadata options load, and Query, Read, Create, Update, Delete, and Action/Function execute successfully.
result: [pending]

### 2. Local n8n Visual Showcase and Cancellation Proof
expected: Local n8n receives the CAP demo workflow request, the dedicated cancellation workflow shows a running/waiting execution, n8n.cancel(executionId) is called, and the browser shows the execution stopped or cancelled.
result: [pending]

### 3. Cloud n8n Runtime UAT
expected: Local CAP uses CDS_CONFIG with N8N_CLOUD_BASE_URL and N8N_CLOUD_API_KEY, then a CAP create/update sends one request to the cloud n8n webhook without committing secrets.
result: [pending]

### 4. BTP Runtime Validation
expected: CAP and n8n routes, auth, destinations/connectivity, secrets, webhook reachability, and stop API reachability are validated in a target Cloud Foundry or Kyma landscape.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
