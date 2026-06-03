---
phase: 07-n8n-mutations-and-cap-actions-functions
reviewed: 2026-06-03T18:50:30Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - README.md
  - cap-n8n-node/nodes/SapCap/GenericFunctions.ts
  - cap-n8n-node/nodes/SapCap/ODataMetadata.ts
  - cap-n8n-node/nodes/SapCap/ODataResponse.ts
  - cap-n8n-node/nodes/SapCap/SapCap.node.ts
  - docs/manual-visual-showcase.md
  - mockups/n8n-node-mockup.html
  - test/integration/n8n-node-metadata-discovery.test.js
  - test/integration/n8n-node-read-operations.test.js
  - test/integration/n8n-node-response-cleanup.test.js
  - test/smoke/package-boundaries.test.js
findings:
  critical: 4
  warning: 1
  info: 0
  total: 5
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-06-03T18:50:30Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the SAP CAP n8n node implementation, metadata parsing, response cleanup, documentation, mockup, and integration/smoke coverage. The mutation/action slice has correctness and security defects in response cleanup, successful empty-response handling, Action/Function entity binding, and OData function URL construction. The tests also have a reliability gap because they exercise ignored build artifacts.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Response cleanup allows prototype pollution

**Severity:** BLOCKER
**File:** `cap-n8n-node/nodes/SapCap/ODataResponse.ts:42`
**Issue:** `stripODataMetadata()` copies untrusted CAP response keys into a normal `{}` object. Assigning keys such as `__proto__` mutates the returned object's prototype instead of creating a safe data property, so a malicious or compromised CAP service can make downstream n8n items inherit attacker-controlled properties. This is not covered by `test/integration/n8n-node-response-cleanup.test.js`.
**Fix:**
```ts
const unsafeObjectKeys = new Set(['__proto__', 'constructor', 'prototype'])
const cleaned: IDataObject = Object.create(null)

for (const [key, childValue] of Object.entries(value)) {
  if (unsafeObjectKeys.has(key) || key.startsWith('@odata.') || key.includes('@odata.')) continue
  cleaned[key] = stripODataMetadata(childValue) as IDataObject[keyof IDataObject]
}
```

### CR-02: Successful empty mutation/action responses are reported as failures

**Severity:** BLOCKER
**File:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:545`
**Issue:** `sapCapApiRequest()` parses every successful JSON response with `JSON.parse(String(response.body ?? ''))`. `SapCap.execute()` sends Create, Update, and Action/Function through this JSON path, so a valid `204 No Content` PATCH response, a CAP action with no return value, or any successful empty body becomes `responseShape`. The README explicitly promises an Update fallback on empty mutation responses at `README.md:382`, but no fallback exists.
**Fix:** Add explicit empty-body handling for operations that can legally return no representation. For Update, either perform a follow-up `GET` to the keyed URL or return a documented confirmation item. For void actions, return a deterministic success item instead of parsing an empty string.
```ts
if (responseFormat === 'json') {
  const bodyText = String(response.body ?? '')
  if (!bodyText.trim()) return undefined
  return JSON.parse(bodyText)
}
```

### CR-03: Action/Function uses the wrong entity set for bound metadata operations

**Severity:** BLOCKER
**File:** `cap-n8n-node/nodes/SapCap/SapCap.node.ts:470`
**Issue:** `execute()` resolves the global Entity Set before it knows whether the selected Action/Function is bound or unbound, and `buildBoundActionFunctionPath()` later uses `input.entitySetName` instead of the `entitySet` already discovered in the metadata descriptor. A user can select a metadata option labelled `Action: Books/restock` while the stale Entity Set field is `Authors`, causing the node to send `/Authors(...)/CatalogService.restock`. Unbound actions/functions also incorrectly require an unrelated entity set, making services with operations but no entity sets unusable.
**Fix:** Resolve the action/function descriptor before resolving entity inputs. Use `descriptor.entitySet` for metadata-backed bound operations, require manual entity set only for manual bound operations, and do not require entity fields for unbound operations.
```ts
const descriptor = resolveActionFunctionDescriptor(actionFunctionInput)
const boundEntitySet = descriptor.isBound
  ? descriptor.entitySet ?? resolveEntitySetName(selection)
  : undefined
```

### CR-04: Function calls are built with query parameters instead of OData function-call syntax

**Severity:** BLOCKER
**File:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:335`
**Issue:** `buildActionFunctionRequest()` builds function paths as `/bookAvailability?book=201` and `/Books(ID=201)/CatalogService.inventoryValue?currency=USD`. OData V4/CAP function invocation uses function-call segments such as `/bookAvailability(book=201)` or a parameter-alias form, with string parameters encoded as OData literals. The current URL shape is accepted only by the mocked test server and will not route reliably against a real CAP OData service.
**Fix:** Build the parameter list into the function segment and format values with OData literal rules, reusing metadata parameter types where available.
```ts
const parameterList = Object.entries(parameters)
  .map(([name, value]) => `${normalizeFunctionParameterName(name)}=${formatODataLiteral(value, parameterTypes.get(name))}`)
  .join(',')
return `${operationPath}(${parameterList})`
```

## Warnings

### WR-01: n8n-node integration tests can pass stale ignored build output

**Severity:** WARNING
**File:** `test/integration/n8n-node-read-operations.test.js:90`
**Issue:** The integration tests import `cap-n8n-node/dist/...` files, and `dist/` is ignored. The root `test:integration` script does not build the n8n package first, so a clean checkout can fail before running these tests, while a dirty workspace with stale `dist/` can pass tests without exercising the changed TypeScript sources.
**Fix:** Make the integration test entry point build the n8n package before importing `dist`, or import/execute the TypeScript source through a test-time transpiler so the tests always cover the reviewed source.
```json
{
  "scripts": {
    "test:integration": "npm run build --workspace n8n-nodes-sap-cap && vitest run test/integration"
  }
}
```

---

_Reviewed: 2026-06-03T18:50:30Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
