---
quick_id: 260622-e2e
slug: replace-demo-workflow-fixture
status: complete
completed: 2026-06-22
---

# Quick Task 260622-e2e Summary

Replaced the older demo workflow fixture with the manually verified end-to-end export from `C:/Users/leonk/Downloads/e2e demo workflow.json`.

Updated artifacts:

- `test-workflows/workflows.json`
- `test-workflows/stock update discord msg test workflow.json`
- `demo-app/n8n/workflows/cap-test-trigger/workflow.json`
- `demo-app/n8n/workflows/cap-test-trigger/manifest.json`
- `demo-app/n8n/workflows/cap-test-trigger/schema.json`

The workflow export was sanitized before committing. Runtime-only n8n fields such as credentials, owner/share metadata, pin data, version ids, webhook ids, and active state were removed from the checked-in artifacts.

The workflow tests now expect the new workflow name and the richer CAP event payload contract, including `description`, `authorId`, `genreId`, `stock`, `price`, and `currencyCode`.

Verification:

- `npm run n8n:workflow:validate -- --app demo-app --json`
- `npx vitest run test/integration/n8n-workflow-artifacts.test.js test/integration/n8n-workflow-import.test.js test/integration/n8n-workflow-phase5.test.js test/integration/n8n-workflow-build-validation.test.js`
- `npx vitest run test/integration/n8n-webhook-runtime.test.js`
- `npm run test:integration`
- `npm run smoke`
- `npm run cap:compile`
