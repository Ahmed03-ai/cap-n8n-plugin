---
quick_id: 260622-pld
slug: expand-demo-workflow-payload
status: complete
completed: 2026-06-22
---

# Quick Task 260622-pld Summary

Expanded the demo `AdminService.Books` n8n start annotation payload with:

- `description` from `descr`
- `authorId` from `author_ID`
- `genreId` from `genre_ID`
- `price` from `price`
- `currencyCode` from `currency_code`

Kept the workflow sidecar schema and generated CDS contract aligned with the expanded payload. Validation now compiles the effective CAP Node.js model before checking annotations, so generated managed-association foreign keys used by the served OData service are accepted by the CLI validator too.

Verification:

- `npm run n8n:workflow:validate -- --app demo-app --json`
- `npx vitest run test/integration/n8n-annotations-demo.test.js test/integration/n8n-workflow-build-validation.test.js test/integration/n8n-workflow-phase5.test.js`
- `npm run test:integration`
- `npm run cap:compile`
