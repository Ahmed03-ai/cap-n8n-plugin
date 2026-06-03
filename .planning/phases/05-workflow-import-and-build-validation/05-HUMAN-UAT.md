---
status: partial
phase: 05-workflow-import-and-build-validation
source: [05-VERIFICATION.md]
started: 2026-06-03T12:35:53.6268880+02:00
updated: 2026-06-03T12:35:53.6268880+02:00
---

## Current Test

[awaiting human testing]

## Tests

### 1. Run live workflow import against a real local or cloud n8n instance using configured CAP/environment credentials.
expected: `npm run n8n:workflow:import -- --app demo-app --live --workflow <workflow-id> --schema demo-app/n8n/workflows/cap-test-trigger/schema.json` fetches from n8n, writes sanitized app-local artifacts, does not print or commit the API key, and `npm run n8n:workflow:validate -- --app demo-app` still exits 0.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
