---
status: planned
created: 2026-06-21
---

# Quick Task 260621-mrg: Merge community node branch into port branch

## Goal

Merge `n8n-community-node` into `n8n-community-node-port` without regressing the automated local startup routine or the SAP CAP n8n community node.

## Constraints

- Keep `n8n-community-node-port` as the conflict-resolution baseline because it contains the newer node-cli package, helper modules, test coverage, and local review harness.
- Do not commit generated local artifacts such as `.n8n-data/`, `.n8n-review-data/`, `dist/`, or packed `.tgz` files.
- Preserve support for SAP CAP node operations: create, delete, invoke action/function, query, read, and update.
- Preserve the automated agentic startup routine and the test workflow created by that setup.

## Tasks

1. Merge `n8n-community-node` into `n8n-community-node-port` in an isolated worktree.
2. Resolve known conflicts by keeping the port branch implementation for `cap-n8n-node` package files and `.gitignore`.
3. Remove weaker duplicate files introduced only by the older community-node branch when the port branch already has newer equivalents.
4. Run focused verification for the n8n community node build, package boundaries, and local startup setup.

## Verification

- `npm run build --workspace n8n-nodes-sap-cap`
- `npx vitest run test/integration/n8n-node-metadata-discovery.test.js test/integration/n8n-node-read-operations.test.js test/integration/n8n-node-response-cleanup.test.js test/smoke/package-boundaries.test.js`
- `npm run agent:startup -- --check`
- `git ls-files | rg '(^|/)(dist|\\.n8n-data|\\.n8n-review-data|\\.n8n)(/|$)|\\.tgz$'`
