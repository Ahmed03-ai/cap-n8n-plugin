---
quick_id: 260601-1cn
slug: update-readme-with-phase-2-manual-testin
status: complete
completed: 2026-05-31T23:00:10.000Z
---

# Quick Task Summary: Update README with Phase 2 manual testing instructions

## What Changed

- Replaced stale README setup text with current Node 20+ prerequisites and root workspace install guidance.
- Documented current root commands: build, CAP compile, smoke, integration tests, aggregate test, workspace tests, and n8n workflow sync.
- Added manual testing instructions for package exports, mock runtime without Docker n8n, sanitized production config failure, and live n8n webhook testing through the demo app.
- Added runtime configuration notes for mock/webhook selection, default timeout/retry behavior, API key header behavior, and production missing-baseUrl failure.
- Added a README maintenance rule requiring docs updates when important setup, commands, config, or verification steps change.

## Verification

- `node -e "const plugin=require('cap-n8n-plugin'); ..."` passed and printed `CAP plugin exports OK`.
- README mock-runtime PowerShell snippet passed and produced `mock-exec-1`.
- README production-config failure snippet passed and emitted `ERR_N8N_CONFIG`.
- `npm test` passed: smoke 1 file / 2 tests and integration 3 files / 21 tests.
- `npm run cap:compile` passed.
- `npm test --workspaces --if-present` passed.

## Notes

- Live Docker n8n manual testing is documented but was not run during this docs-only quick task.
- The n8n node CLI still emits its known DEP0190 warning during build/lint; README documents this as expected.
