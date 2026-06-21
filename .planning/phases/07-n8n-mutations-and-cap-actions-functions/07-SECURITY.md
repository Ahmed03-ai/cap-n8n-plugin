---
phase: 07
slug: n8n-mutations-and-cap-actions-functions
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-03
---

# Phase 07 - Security

Per-phase security contract: verify plan-time threat mitigations for Phase 07. Implementation files were treated as read-only during this audit.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|-----------|-------------|---------------|
| n8n parameters to OData requests | User-provided service paths, entity sets, keys, bodies, parameters, and operation names become outbound CAP HTTP requests. | OData paths, JSON bodies, action/function parameters |
| CAP metadata to node descriptors | Remote CAP `$metadata` controls entity-set, key, and action/function dropdown data. | XML metadata to n8n option descriptors |
| CAP responses/errors to n8n output | CAP success and failure payloads become n8n items, thrown errors, or continue-on-fail items. | OData JSON, HTTP status, sanitized error categories |
| Docs and mockups to repository | Examples and verification claims become committed user-facing artifacts. | Example URLs, request snippets, security/verification claims |
| Package manifests and lockfile | Package metadata changes can introduce new supply-chain dependencies. | `package.json`, `cap-n8n-node/package.json`, `package-lock.json` |

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status | Evidence |
|-----------|----------|-----------|-------------|------------|--------|----------|
| T-07-01-01 | Information Disclosure | `ODataMetadata.ts` and metadata tests | mitigate | Sanitized metadata/response-shape errors and tests excluding credentials, tokens, auth headers, metadata bodies, and stack-bearing internals. | closed | `cap-n8n-node/nodes/SapCap/ODataMetadata.ts:145`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:612`, `test/integration/n8n-node-metadata-discovery.test.js:388`, `test/integration/n8n-node-metadata-discovery.test.js:595`, `test/integration/n8n-node-response-cleanup.test.js:482` |
| T-07-01-02 | Tampering | `buildKeyPredicateFromParts` and `normalizeKeyPredicate` | mitigate | URL boundary rejection, required composite key parts, and type-aware OData literal formatting. | closed | `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:178`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:192`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:216`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:714`, `test/integration/n8n-node-metadata-discovery.test.js:679` |
| T-07-01-03 | Information Disclosure | Key validation errors | mitigate | Key validation errors use allowlisted messages and tests assert raw key values/secrets are not serialized. | closed | `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:200`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:225`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:732`, `test/integration/n8n-node-metadata-discovery.test.js:773`, `test/integration/n8n-node-metadata-discovery.test.js:792` |
| T-07-01-04 | Tampering | Destructive Delete behavior | transfer | Transferred to Plan 07-02; downstream Delete requires a key, sends no body, returns confirmation, and tests not-found/no-body behavior. | closed | `.planning/phases/07-n8n-mutations-and-cap-actions-functions/07-02-PLAN.md:193`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:310`, `cap-n8n-node/nodes/SapCap/SapCap.node.ts:679`, `test/integration/n8n-node-read-operations.test.js:643`, `test/integration/n8n-node-response-cleanup.test.js:364` |
| T-07-01-SC | Tampering | npm installs | mitigate | No Phase 7 dependency install or lockfile change; one Phase 7 root manifest edit was script-only. | closed | `package.json:10`, `package.json:24`, `cap-n8n-node/package.json:40`, `package-lock.json:15`; `git show d6cad07 -- package.json` changed only `test:integration` script |
| T-07-02-01 | Information Disclosure | `SapCap.execute`, `ODataResponse.ts`, tests | mitigate | CRUD execution catches failures through `classifySapCapError`, `toContinueOnFailItem`, and `toNodeOperationError`; tests reject leaked credentials, auth headers, response bodies, and stacks. | closed | `cap-n8n-node/nodes/SapCap/SapCap.node.ts:469`, `cap-n8n-node/nodes/SapCap/ODataResponse.ts:139`, `cap-n8n-node/nodes/SapCap/ODataResponse.ts:157`, `cap-n8n-node/nodes/SapCap/ODataResponse.ts:178`, `test/integration/n8n-node-response-cleanup.test.js:482`, `test/integration/n8n-node-read-operations.test.js:1638` |
| T-07-02-02 | Tampering | CRUD URL construction | mitigate | CRUD builders use normalized service path/entity set plus shared manual/metadata key helpers; tests cover boundary rejection and composite keys before HTTP. | closed | `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:158`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:240`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:295`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:310`, `test/integration/n8n-node-read-operations.test.js:1094`, `test/integration/n8n-node-read-operations.test.js:1465` |
| T-07-02-03 | Information Disclosure | JSON Body validation | mitigate | Body is parsed locally as a JSON object and failures return static validation copy; tests ensure raw body values and secrets are not serialized. | closed | `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:288`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:303`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:353`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:963`, `test/integration/n8n-node-read-operations.test.js:877`, `test/integration/n8n-node-read-operations.test.js:925` |
| T-07-02-04 | Tampering | Delete request builder | mitigate | Delete requires key input through shared key controls, has no confirmation checkbox, sends no body, returns confirmation, and maps not-found errors. | closed | `cap-n8n-node/nodes/SapCap/SapCap.node.ts:339`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:310`, `cap-n8n-node/nodes/SapCap/SapCap.node.ts:679`, `test/smoke/package-boundaries.test.js:311`, `test/integration/n8n-node-read-operations.test.js:1007`, `test/integration/n8n-node-response-cleanup.test.js:364` |
| T-07-02-05 | Denial of Service | Malformed successful mutation responses | mitigate | Invalid JSON and unexpected mutation shapes become sanitized response-shape errors, with no retry loop or raw output path. | closed | `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:616`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:623`, `cap-n8n-node/nodes/SapCap/ODataResponse.ts:64`, `cap-n8n-node/nodes/SapCap/ODataResponse.ts:229`, `test/integration/n8n-node-response-cleanup.test.js:222`, `test/integration/n8n-node-response-cleanup.test.js:382` |
| T-07-02-SC | Tampering | npm installs | mitigate | No Phase 7 dependency install or lockfile change; package-lock still reflects existing dependencies only. | closed | `package.json:24`, `cap-n8n-node/package.json:40`, `package-lock.json:15`, `package-lock.json:26`; `git log --oneline --all --grep='07' -- package-lock.json cap-n8n-node/package.json package.json` returned only script-only commit `d6cad07` |
| T-07-03-01 | Information Disclosure | Action/Function errors and tests | mitigate | Action/Function uses the same sanitized response helpers and tests assert safe errors/continue-on-fail without credentials, auth headers, bodies, or stack traces. | closed | `cap-n8n-node/nodes/SapCap/SapCap.node.ts:521`, `cap-n8n-node/nodes/SapCap/SapCap.node.ts:653`, `cap-n8n-node/nodes/SapCap/ODataResponse.ts:139`, `test/integration/n8n-node-response-cleanup.test.js:482`, `test/integration/n8n-node-response-cleanup.test.js:523`, `test/integration/n8n-node-read-operations.test.js:1355` |
| T-07-03-02 | Tampering | Action/Function URL construction | mitigate | Service paths, operation names, entity sets, manual predicates, metadata key parts, function parameter names, and function values are normalized or formatted before URL construction. | closed | `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:321`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:471`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:483`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:495`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:549`, `test/integration/n8n-node-read-operations.test.js:700` |
| T-07-03-03 | Information Disclosure | Parameters JSON validation | mitigate | Parameters JSON is parsed locally with the shared object parser and validation returns allowlisted messages without raw parameter content. | closed | `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:324`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:353`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:963`, `cap-n8n-node/nodes/SapCap/ODataResponse.ts:332`, `test/integration/n8n-node-read-operations.test.js:861`, `test/integration/n8n-node-read-operations.test.js:1446` |
| T-07-03-04 | Tampering | Bound destructive or mutating actions | mitigate | Bound Action/Function requests resolve the entity set and require the same hybrid key path as Update/Delete before invocation. | closed | `cap-n8n-node/nodes/SapCap/SapCap.node.ts:531`, `cap-n8n-node/nodes/SapCap/SapCap.node.ts:586`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:483`, `test/integration/n8n-node-read-operations.test.js:1175`, `test/integration/n8n-node-read-operations.test.js:1310` |
| T-07-03-05 | Repudiation | Action/Function mode semantics | mitigate | Node exposes one combined mode, while tests capture POST action bodies, GET function call segments, operation values, and rejection of separate action/function modes. | closed | `cap-n8n-node/nodes/SapCap/SapCap.node.ts:104`, `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:321`, `test/integration/n8n-node-read-operations.test.js:700`, `test/integration/n8n-node-read-operations.test.js:1175`, `test/integration/n8n-node-read-operations.test.js:1744`, `test/smoke/package-boundaries.test.js:160` |
| T-07-03-SC | Tampering | npm installs | mitigate | No Phase 7 dependency install or lockfile change for Action/Function work. | closed | `cap-n8n-node/package.json:40`, `package-lock.json:26`; `git log --oneline --all --grep='07' -- package-lock.json cap-n8n-node/package.json package.json` returned no dependency/lockfile change |
| T-07-04-01 | Information Disclosure | README, manual showcase, mockup | mitigate | Docs/mockups use placeholders/fake values and source gates found no concrete bearer/basic tokens, private keys, API keys, OAuth secrets, or production credentials. | closed | `README.md:171`, `docs/manual-visual-showcase.md:42`, `docs/manual-visual-showcase.md:609`, `mockups/n8n-node-mockup.html:340`, `mockups/n8n-node-mockup.html:398`; secret-pattern `rg` found placeholders only |
| T-07-04-02 | Tampering | Documented URLs and key examples | mitigate | Docs describe normalized service paths, explicit keys, composite-key Key Parts JSON, and Manual Key Predicate fallback without unsafe path concatenation examples. | closed | `README.md:327`, `README.md:344`, `README.md:349`, `docs/manual-visual-showcase.md:554`, `mockups/n8n-node-mockup.html:545`, `mockups/n8n-node-mockup.html:666` |
| T-07-04-03 | Information Disclosure | Body and Parameters examples | mitigate | Body and Parameters examples are small business-generic fixtures without tokens, real request bodies, or customer secrets. | closed | `README.md:351`, `README.md:369`, `README.md:403`, `docs/manual-visual-showcase.md:536`, `docs/manual-visual-showcase.md:556`, `mockups/n8n-node-mockup.html:621`, `mockups/n8n-node-mockup.html:790` |
| T-07-04-04 | Tampering | Destructive Delete documentation | mitigate | Docs and mockup state explicit key, no request body, no extra confirmation checkbox/control, confirmation output, and not-found behavior. | closed | `README.md:384`, `README.md:391`, `README.md:401`, `docs/manual-visual-showcase.md:519`, `docs/manual-visual-showcase.md:555`, `mockups/n8n-node-mockup.html:721`, `mockups/n8n-node-mockup.html:729` |
| T-07-04-05 | Repudiation | Verification claims | mitigate | README/manual distinguish deterministic Phase 7 integration verification from Phase 8 real installed n8n custom-node E2E and name exact commands. | closed | `README.md:296`, `README.md:306`, `docs/manual-visual-showcase.md:38`, `docs/manual-visual-showcase.md:495`, `docs/manual-visual-showcase.md:567`, `docs/manual-visual-showcase.md:572` |
| T-07-04-SC | Tampering | npm installs | mitigate | Docs/showcase updates did not add dependencies or lockfile changes. | closed | `package.json:24`, `cap-n8n-node/package.json:40`, `package-lock.json:15`, `package-lock.json:26`; `git show d6cad07 -- package.json` showed script-only package edit |

## Accepted Risks Log

No accepted risks.

## Unregistered Flags

None. Plan-time summaries reported no unmapped threat flags; 07-02 had no separate Threat Flags section, so verification used the plan register and implementation evidence directly.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-03 | 23 | 23 | 0 | gsd-security-auditor |

## Sign-Off

- [x] All threats have a disposition: mitigate, accept, or transfer.
- [x] Accepted risks documented in Accepted Risks Log.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-06-03
