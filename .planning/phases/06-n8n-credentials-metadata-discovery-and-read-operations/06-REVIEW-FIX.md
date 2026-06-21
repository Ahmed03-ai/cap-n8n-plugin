---
phase: 06-n8n-credentials-metadata-discovery-and-read-operations
fixed_at: 2026-06-03T14:28:07Z
review_path: .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-06-03T14:28:07Z
**Source review:** .planning/phases/06-n8n-credentials-metadata-discovery-and-read-operations/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Advertised OAuth2 credentials cannot execute or test successfully

**Files modified:** `cap-n8n-node/credentials/SapCapApi.credentials.ts`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts`, `cap-n8n-node/nodes/SapCap/ODataResponse.ts`, `test/integration/n8n-node-read-operations.test.js`, `test/integration/n8n-node-response-cleanup.test.js`, `test/smoke/package-boundaries.test.js`
**Commit:** 79e0f40
**Applied fix:** Removed the selectable OAuth2 credential fields/options for Phase 6, kept stale unsupported auth modes rejected before outbound CAP requests, and updated credential/runtime tests for the Basic Auth-only contract.

### CR-02: Read key predicates can inject query strings or path segments

**Files modified:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts`, `test/integration/n8n-node-metadata-discovery.test.js`, `test/integration/n8n-node-read-operations.test.js`
**Commit:** 1695a2b
**Applied fix:** Added key-predicate validation that rejects `/`, `?`, and `#`, plus helper and runtime integration coverage proving malicious Read predicates send no CAP request.

### CR-03: OData cleanup leaves property-level annotations in output items

**Files modified:** `cap-n8n-node/nodes/SapCap/ODataResponse.ts`, `test/integration/n8n-node-response-cleanup.test.js`
**Commit:** d135aad
**Applied fix:** Extended OData metadata stripping to remove property-level annotation keys containing `@odata.` while preserving normal values.

### WR-01: Metadata discovery uses a regex parser that misses valid XML variants

**Files modified:** `cap-n8n-node/nodes/SapCap/ODataMetadata.ts`, `test/integration/n8n-node-metadata-discovery.test.js`
**Commit:** c7a002c
**Applied fix:** Hardened the fallback metadata parser to require an OData metadata envelope, support single-quoted attributes, and reject HTML responses returned with HTTP 200.

### WR-02: JSON parse failures are reported as network outages

**Files modified:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts`, `test/integration/n8n-node-read-operations.test.js`
**Commit:** 207dca2
**Applied fix:** Requested OData JSON responses as text, parsed them after HTTP status handling, and classified malformed successful response bodies as `responseShape` errors.

## Skipped Issues

None - all findings were fixed.

## Verification

- `npm run build --workspace n8n-nodes-sap-cap`
- `npx vitest run test/smoke/package-boundaries.test.js test/integration/n8n-node-read-operations.test.js test/integration/n8n-node-response-cleanup.test.js`
- `npx vitest run test/integration/n8n-node-metadata-discovery.test.js test/integration/n8n-node-read-operations.test.js`
- `npx vitest run test/integration/n8n-node-response-cleanup.test.js`
- `npx vitest run test/integration/n8n-node-metadata-discovery.test.js`
- `npx vitest run test/integration/n8n-node-read-operations.test.js`
- `npm test`

Note: the first `npm test` attempt failed because the temporary worktree dependency install used disabled lifecycle scripts and `better-sqlite3` native bindings were missing. After `npm rebuild better-sqlite3`, the rerun passed: 1 smoke file / 3 tests and 19 integration files / 129 tests.

---

_Fixed: 2026-06-03T14:28:07Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
