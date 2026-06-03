---
phase: 06-n8n-credentials-metadata-discovery-and-read-operations
plan: 01
subsystem: n8n-node
tags: [n8n, sap-cap, odata, credentials, metadata-discovery, vitest]

requires:
  - phase: 01-package-foundations-and-tooling
    provides: n8n community-node package metadata and TypeScript source layout
provides:
  - SAP CAP API credential surface with Basic Auth metadata test and visible OAuth2 scaffold
  - CAP OData metadata EntitySet discovery helpers for n8n load options
  - Query/Read-only SAP CAP node editor metadata with manual entity-set fallback
  - deterministic fake-server integration and package-boundary smoke coverage
affects: [06-02-response-cleanup, 06-03-query-read-runtime, 07-n8n-mutations, NODE-02, NODE-03, NODE-04, NODE-11]

tech-stack:
  added: []
  patterns: [n8n credential authenticate metadata, n8n methods.loadOptions, targeted CSDL EntitySet extraction, URLSearchParams OData query builders, sanitized helper errors]

key-files:
  created:
    - cap-n8n-node/nodes/SapCap/GenericFunctions.ts
    - cap-n8n-node/nodes/SapCap/ODataMetadata.ts
    - test/integration/n8n-node-metadata-discovery.test.js
  modified:
    - cap-n8n-node/credentials/SapCapApi.credentials.ts
    - cap-n8n-node/nodes/SapCap/SapCap.node.ts
    - test/smoke/package-boundaries.test.js

key-decisions:
  - "Basic Auth is the Phase 6 working credential, metadata test, and entity discovery path; OAuth2 Client Credentials remains a visible scaffold with sanitized configuration failure behavior."
  - "Phase 6 node metadata exposes only Query and Read, with mutation, action/function, raw response, and trigger controls absent from the visible operation surface."
  - "Metadata discovery uses targeted EntitySet extraction without adding an XML parser dependency."

patterns-established:
  - "Shared n8n-node request helpers validate base URLs, service paths, metadata paths, entity-set names, and Read key predicates before constructing outbound CAP OData requests."
  - "CAP metadata load options return native n8n option objects from EntitySet Name and EntityType attributes only."
  - "Package-boundary smoke tests inspect built dist metadata for credential and node editor contracts."

requirements-completed: [NODE-02, NODE-03, NODE-04, NODE-11]

duration: 15min
completed: 2026-06-03
---

# Phase 06 Plan 01: SAP CAP Credentials and Metadata Discovery Summary

**Basic Auth SAP CAP credentials with safe `$metadata` testing, EntitySet load-options discovery, and a Query/Read-only n8n node surface**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-03T13:14:00Z
- **Completed:** 2026-06-03T13:29:23Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Updated `SapCapApi` credential metadata to expose Base URL, Metadata Path, Basic Auth, and visible OAuth2 Client Credentials fields with no unauthenticated option.
- Added shared CAP OData helper modules for sanitized n8n HTTP requests, URL/path validation, Query/Read request construction, and targeted `$metadata` EntitySet extraction.
- Replaced the visible SAP CAP node operation surface with Query and Read only, including metadata-backed Entity Set dropdown and manual fallback fields.
- Added deterministic fake CAP integration coverage for Basic Auth metadata discovery, namespace-prefixed CSDL, HTTP error categories, invalid metadata, and credential leak prevention.

## Task Commits

Each task was committed atomically with RED and GREEN gates:

1. **Task 1: Align SAP CAP API credential fields and metadata test**
   - `38867c3` test: add failing credential metadata smoke test
   - `2d88255` feat: align SAP CAP credential metadata
2. **Task 2: Add shared request and metadata discovery helpers**
   - `ee5c264` test: add failing metadata discovery integration test
   - `2d6c909` feat: add metadata discovery helpers
3. **Task 3: Bind Query/Read-only node properties to metadata load options**
   - `68736c8` test: add failing Query Read node metadata smoke test
   - `b689ae7` feat: bind Query Read node metadata to entity discovery

**Plan metadata:** pending docs close-out commit.

## Files Created/Modified

- `cap-n8n-node/credentials/SapCapApi.credentials.ts` - SAP CAP API credential fields, Basic Auth authentication metadata, OAuth2 scaffold, and `$metadata` credential test target.
- `cap-n8n-node/nodes/SapCap/GenericFunctions.ts` - Shared request, path validation, entity-set, Query builder, Read builder, key predicate, and sanitized error helpers.
- `cap-n8n-node/nodes/SapCap/ODataMetadata.ts` - Targeted CSDL `EntitySet` extraction and `loadEntitySetOptions` implementation for n8n load options.
- `cap-n8n-node/nodes/SapCap/SapCap.node.ts` - Query/Read-only node editor metadata, metadata/manual entity controls, and `getEntitySets` load-options binding.
- `test/integration/n8n-node-metadata-discovery.test.js` - Fake CAP HTTP integration coverage for Basic Auth metadata discovery and helper validation.
- `test/smoke/package-boundaries.test.js` - Built package-boundary assertions for credential and node metadata.

## Decisions Made

- Basic Auth is the only Phase 6 success-path credential for metadata loading and node requests; OAuth2 Client Credentials stays visible but returns a sanitized configuration error from shared helpers until later scope completes it.
- EntitySet discovery intentionally extracts only `EntitySet` names and optional `EntityType` descriptions from CSDL XML; keys, actions, functions, and composite-key UI metadata remain deferred.
- The node editor surface now removes visible Create, Update, Delete, CAP action/function, raw response, and trigger controls to avoid implying Phase 7 behavior exists.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope changes.

## Issues Encountered

None.

## Verification

- `npm run build --workspace n8n-nodes-sap-cap` - passed.
- `npx vitest run test/integration/n8n-node-metadata-discovery.test.js` - passed.
- `npx vitest run test/smoke/package-boundaries.test.js` - passed.

## Known Stubs

None. Stub scan matches were n8n `placeholder` field metadata and normal empty test/helper initialization, not UI-rendered mock data or unwired runtime stubs.

## Authentication Gates

None.

## Threat Flags

None. The new credential, request helper, metadata XML, and node-parameter trust boundaries were covered by the plan threat model and mitigated with URL/path validation, Basic Auth sanitization, targeted XML extraction, and removal of non-Phase-6 write/trigger controls.

## TDD Gate Compliance

PASS. Each `tdd="true"` task has a failing `test(06-01)` commit followed by a passing `feat(06-01)` implementation commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 06-02 response cleanup and sanitized n8n error helpers. Plan 06-03 can reuse `GenericFunctions.ts` and `ODataMetadata.ts` for Query/Read runtime wiring.

## Self-Check: PASSED

- Created files exist: `GenericFunctions.ts`, `ODataMetadata.ts`, and `n8n-node-metadata-discovery.test.js`.
- Modified files exist: `SapCapApi.credentials.ts`, `SapCap.node.ts`, and `package-boundaries.test.js`.
- Task commits exist: `38867c3`, `2d88255`, `ee5c264`, `2d6c909`, `68736c8`, and `b689ae7`.
- Plan-level verification commands passed.

---
*Phase: 06-n8n-credentials-metadata-discovery-and-read-operations*
*Completed: 2026-06-03*
