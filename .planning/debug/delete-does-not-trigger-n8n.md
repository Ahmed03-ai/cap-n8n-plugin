---
status: investigating
trigger: "POST and PATCH are working and lead to json files at the endpoint, however, DELETE doesn't lead to that."
created: 2026-06-21
updated: 2026-06-21
---

# Debug Session: delete-does-not-trigger-n8n

## Symptoms

### Expected Behavior

DELETE should trigger the same n8n workflow path as POST and PATCH, and the workflow should create a JSON file at the endpoint.

### Actual Behavior

POST and PATCH create JSON files at the endpoint, but DELETE does not.

### Error Messages

No specific error message reported yet.

### Timeline

Reported on 2026-06-21 during local n8n workflow visual debugging.

### Reproduction

Run the local CAP demo plus n8n review profile, open the n8n workflow, then compare POST, PATCH, and DELETE requests against the CAP Books endpoint and the resulting workflow output.

## Current Focus

- hypothesis: DELETE may not be reaching the annotated workflow because CAP DELETE handlers only receive key fields, while the current annotation, payload builder, or workflow expects body fields such as title and stock.
- test: Start CAP and n8n, confirm the workflow is loaded, reproduce DELETE with CAP and n8n logs visible, and inspect annotation handling for DELETE.
- expecting: POST and PATCH produce an n8n execution or endpoint JSON file; DELETE either does not dispatch, dispatches with an incomplete payload, or fails inside the workflow.
- next_action: verify running services and reproduce DELETE with logs
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- 2026-06-21: Started the local stack with `npm run agent:startup -- --skip-prepare --open`; n8n health, Admin metadata, and Catalog metadata all returned 200.
- 2026-06-21: Startup imported `test-workflows\stock update discord msg test workflow.json` and selected `stock update discord msg test workflow`.
- 2026-06-21: Opened `http://localhost:5678/workflow/cap-test-trigger` for visual workflow inspection.
- 2026-06-21: In-app browser reached `http://localhost:5678/signin?redirect=%252Fworkflow%252Fcap-test-trigger`, so visual inspection inside Codex requires n8n UI login first.
- 2026-06-21: Exported n8n state confirmed workflow `cap-test-trigger: stock update discord msg test workflow`, inactive, Webhook node method `POST`, path `cap-test-trigger`.
- 2026-06-21: `demo-app/srv/admin-service.cds` has `@n8n.workflow.start` only on `['CREATE', 'UPDATE']`.
- 2026-06-21: `demo-app/srv/admin-service.cds` has `@n8n.workflow.cancel` on `['DELETE']` for the same workflow ID and business key.
- 2026-06-21: Reproduction with Book ID `999901` returned CAP OData statuses `CREATE:201`, `PATCH:200`, `DELETE:204`.
- 2026-06-21: CAP log for DELETE did not show a workflow start. It logged `No active n8n executions matched annotated cancellation` for service `db` and `AdminService`.
- 2026-06-21: n8n log showed `Received request for unknown webhook: The requested webhook "cap-test-trigger" is not registered` when the workflow was not in test/listening mode.
- 2026-06-21: `test/integration/n8n-annotations-demo.test.js` explicitly expects demo `CREATE` and `UPDATE` to send webhook starts, then expects `DELETE` to cancel a queued execution while webhook request count stays unchanged.
- 2026-06-21: `test/integration/n8n-annotations-start.test.js` proves DELETE can start a workflow when a start annotation is configured with `on: ['DELETE']`, but its payload is key-only by design.
- 2026-06-21: `test/integration/n8n-annotation-contract.test.js` rejects DELETE start mappings to non-key fields such as `title`, so the current stock-alert workflow would not receive `title` or `stock` from DELETE without a design change.

## Eliminated

- hypothesis: DELETE fails at the CAP OData layer.
  - reason: The DELETE request returned HTTP 204 for the throwaway Book ID.
- hypothesis: The selected n8n workflow is missing from local n8n.
  - reason: n8n export confirmed `cap-test-trigger: stock update discord msg test workflow`.

## Current Root Cause Candidate

The demo app currently treats DELETE as cancellation, not as a workflow start. That means DELETE intentionally queries and cancels active executions, but does not call the Webhook workflow that creates endpoint JSON. If the expected demo behavior is "CREATE, UPDATE, and DELETE all generate endpoint JSON", the annotation should use `@n8n.workflow.start` for DELETE as well, likely with a key-only DELETE payload or a pre-delete read if title/stock are required by the workflow.

## Resolution

- root_cause:
- fix:
- verification:
- files_changed:
