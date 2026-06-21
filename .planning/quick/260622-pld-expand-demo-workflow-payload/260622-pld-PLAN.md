---
quick_id: 260622-pld
slug: expand-demo-workflow-payload
status: in_progress
created: 2026-06-22
---

# Quick Task 260622-pld: Expand demo workflow payload

## Goal

Give n8n more useful book data when `AdminService.Books` triggers the annotated workflow, especially fields needed for AI enrichment and CAP node write-back testing.

## Tasks

1. Expand `demo-app/srv/admin-service.cds` workflow inputs with scalar and foreign-key book fields.
2. Keep `demo-app/n8n/workflows/cap-test-trigger/schema.json` and `demo-app/n8n/index.cds` aligned with the emitted payload.
3. Update focused tests and run validation/compile checks.
