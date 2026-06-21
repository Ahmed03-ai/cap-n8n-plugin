---
status: complete
quick_id: 260621-nt4
completed: 2026-06-21
commit: pending
---

# Quick Task 260621-nt4 Summary

## Outcome

Added an agentic local startup routine for reviewers and agents:

- `scripts/agent-startup-routine.js`
- `npm run agent:startup`
- backwards-compatible alias: `npm run start:local-review`
- README startup instructions under `Manual Testing`

The helper now checks the local environment, prepares the custom n8n node package, starts the custom-node n8n compose profile, imports the demo workflow fixture, starts CAP, waits for n8n health/UI, verifies both CAP metadata endpoints, and can stop CAP plus n8n through `--stop`.

## Verification

- `node --check scripts\agent-startup-routine.js`
- `npm run agent:startup -- --check`
- `npm run agent:startup`
- `npm run agent:startup -- --skip-prepare`
- `npm run agent:startup -- --stop`
- `docker compose -f docker-compose.n8n-node.yml exec -T n8n n8n import:workflow --input=/test-workflows/.agent-startup-routine-workflows.json`
- `docker compose -f docker-compose.n8n-node.yml exec -T n8n n8n export:workflow --all --output=/test-workflows/.agent-startup-routine-export.json`

Observed startup evidence:

- n8n health returned `200` at `http://localhost:5678/healthz`
- n8n UI returned `200` at `http://localhost:5678`
- normalized demo workflow import succeeded and repeated import exported as one workflow: `cap-test-trigger: CAP n8n Test`
- Admin metadata returned `200` at `http://localhost:3000/odata/v4/admin/$metadata` using local mock user `alice`
- Catalog metadata returned `200` at `http://localhost:3000/odata/v4/catalog/$metadata`
- custom package install shape passed for `.n8n-review-data/custom/node_modules/n8n-nodes-sap-cap`

## Notes

- The machine initially used Node `26.2.0`, and the helper correctly rejected it.
- Installed and switched to Node `24.16.0` through local nvm for verification.
- The n8n node build still prints the known `DEP0190` warning from the n8n node CLI dependency.
- CAP and n8n were stopped after verification; ports `3000` and `5678` were clear and no Docker containers were running.
- The CAP PID file was removed after `--stop`, so repeated start/stop runs do not leave stale process state.
- After verification, the local review app was restarted in the background for handoff. CAP and n8n both returned `200` on the expected readiness endpoints.
- The checked-in `test-workflows/workflows.json` has no workflow-level `id`, and n8n 2.22 rejects that shape with `workflow_entity.id` NOT NULL. The helper now writes a temporary normalized import file with a stable ID derived from the webhook path, imports that file, and removes it afterward.
- Renamed the visible startup command to `npm run agent:startup` and the script to `scripts/agent-startup-routine.js` so colleagues can find it more easily. `npm run start:local-review` remains as a compatibility alias.
