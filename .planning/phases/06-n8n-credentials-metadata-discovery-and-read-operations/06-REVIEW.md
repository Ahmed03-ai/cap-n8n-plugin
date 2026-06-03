---
phase: 06-n8n-credentials-metadata-discovery-and-read-operations
reviewed: 2026-06-03T14:13:41Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - cap-n8n-node/credentials/SapCapApi.credentials.ts
  - cap-n8n-node/nodes/SapCap/GenericFunctions.ts
  - cap-n8n-node/nodes/SapCap/ODataMetadata.ts
  - cap-n8n-node/nodes/SapCap/ODataResponse.ts
  - cap-n8n-node/nodes/SapCap/SapCap.node.ts
  - test/integration/n8n-node-metadata-discovery.test.js
  - test/integration/n8n-node-read-operations.test.js
  - test/integration/n8n-node-response-cleanup.test.js
  - test/smoke/package-boundaries.test.js
findings:
  critical: 3
  warning: 2
  info: 0
  total: 5
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-03T14:13:41Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the Phase 06 n8n credential, metadata discovery, OData cleanup, and Query/Read runtime sources plus their smoke and integration tests. The TypeScript build and the existing smoke/integration suite pass, but the implementation still has shippable behavior defects around the advertised OAuth2 credential mode, Read URL construction, and OData annotation cleanup.

Validation run:

```text
npm test
# 1 smoke test file passed, 19 integration test files passed, 126 tests passed
```

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Advertised OAuth2 credentials cannot execute or test successfully

**Classification:** BLOCKER

**File:** `cap-n8n-node/credentials/SapCapApi.credentials.ts:45`
**File:** `cap-n8n-node/credentials/SapCapApi.credentials.ts:140`
**File:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:255`

**Issue:** The credential UI exposes `OAuth2 Client Credentials` and collects `tokenUrl`, `clientId`, `clientSecret`, and `scope`, but runtime authentication throws immediately for `authType === 'oauth2'` before any metadata, Query, or Read request is sent. The credential type also defines a single generic Basic Auth `authenticate` block, so n8n Test Connection cannot validate OAuth2 either; it will apply username/password fields regardless of the selected auth mode. This is a functional regression for OAuth2-backed CAP services and a selectable credential mode that cannot work.

**Fix:** Either remove the OAuth2 option and fields until the phase that implements it, or restore token retrieval and make both runtime and credential test paths honor `authType`. For example, make authentication asynchronous and fetch a bearer token for OAuth2:

```ts
async function applyAuthentication(
  context: SapCapRequestContext,
  headers: IDataObject,
  credentials: ICredentialDataDecryptedObject
) {
  if (credentials.authType === 'basicAuth') {
    headers.Authorization = `Basic ${Buffer.from(`${credentials.username || ''}:${credentials.password || ''}`).toString('base64')}`
    return
  }

  if (credentials.authType === 'oauth2') {
    headers.Authorization = `Bearer ${await fetchOAuth2Token(context, credentials)}`
    return
  }

  throw createSapCapRequestError('SAP CAP authentication must use Basic Auth or OAuth2 Client Credentials.', {
    category: 'configuration',
  })
}
```

Also replace the unconditional generic Basic `authenticate` definition with an OAuth-aware credential test path, or hide OAuth2 until that test path is implemented.

### CR-02: Read key predicates can inject query strings or path segments

**Classification:** BLOCKER

**File:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:103`
**File:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:137`

**Issue:** `normalizeKeyPredicate()` only trims and wraps the user-controlled value in parentheses. Unlike `servicePath` and `entitySetName`, it does not reject `/`, `?`, or `#`. Because `buildReadRequest()` concatenates the normalized predicate directly into the URL path, an expression-driven value such as `ID=201)?$expand=SensitiveNav` or `ID=201)/$value` can escape the intended key predicate and change the final CAP request. That bypasses the node's own request-shape validation and can send unintended OData query options or path segments.

**Fix:** Reject URL boundary characters in raw key predicates, or replace this raw field with structured key fields that are encoded before URL construction. A narrow fix consistent with the existing validators is:

```ts
export function normalizeKeyPredicate(value: unknown) {
  const keyPredicate = requireString(value, 'Key Predicate is required for Read.')

  if (/[/?#]/.test(keyPredicate)) {
    throw createSapCapRequestError('Key Predicate must not include /, ?, or #.', {
      category: 'validation',
    })
  }

  return keyPredicate.startsWith('(') && keyPredicate.endsWith(')')
    ? keyPredicate
    : `(${keyPredicate})`
}
```

Add integration coverage proving malicious predicates do not produce requests.

### CR-03: OData cleanup leaves property-level annotations in output items

**Classification:** BLOCKER

**File:** `cap-n8n-node/nodes/SapCap/ODataResponse.ts:44`

**Issue:** `stripODataMetadata()` removes keys that start with `@odata.`, but OData responses can also include property-level annotations such as `title@odata.type`, `Items@odata.count`, or `Authors@odata.navigationLink`. Those keys do not start with `@odata.`, so they are forwarded into n8n item JSON even though this phase is meant to clean OData metadata from Query and Read responses. Current tests only cover top-level and nested keys that start with `@odata.`, so this defect is not exercised.

**Fix:** Treat property-level annotation keys as metadata too, while leaving normal values untouched:

```ts
for (const [key, childValue] of Object.entries(value)) {
  if (key.startsWith('@odata.') || key.includes('@odata.')) continue

  cleaned[key] = stripODataMetadata(childValue) as IDataObject[keyof IDataObject]
}
```

Add a response-cleanup test with fields like `title@odata.type` and `Books@odata.count`.

## Warnings

### WR-01: Metadata discovery uses a regex parser that misses valid XML variants

**Classification:** WARNING

**File:** `cap-n8n-node/nodes/SapCap/ODataMetadata.ts:23`
**File:** `cap-n8n-node/nodes/SapCap/ODataMetadata.ts:61`

**Issue:** Entity-set discovery parses XML with regexes and the attribute parser only recognizes double-quoted attributes. XML also permits single-quoted attributes, and non-metadata HTML/XML responses that start with `<` will be treated as valid input and can silently return an empty option list. That makes metadata discovery brittle and can hide bad responses as "no entity sets" instead of surfacing a response-shape error.

**Fix:** Use a real XML parser if the package can take that dependency. If not, harden the fallback by validating the Edmx/DataServices/EntityContainer shape and accepting both quote styles:

```ts
const attributePattern = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
// decoded value is match[2] ?? match[3]
```

Add tests for single-quoted attributes and for an HTML login page returned with HTTP 200.

### WR-02: JSON parse failures are reported as network outages

**Classification:** WARNING

**File:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:158`
**File:** `cap-n8n-node/nodes/SapCap/GenericFunctions.ts:178`

**Issue:** `sapCapApiRequest()` asks n8n to parse JSON inside `helpers.httpRequest()`. If CAP responds with HTTP 200 and malformed JSON, HTML, or another non-JSON body, the helper can throw before `normalizeODataItems()` performs response-shape validation. The catch block then converts that parse failure into `category: 'network'` and a "Could not reach CAP service" message, even though the service was reachable and returned an invalid response.

**Fix:** Preserve the distinction between transport failures and bad response bodies. One option is to request text for JSON operations, parse manually after the HTTP status check, and throw a `responseShape` error on JSON parse failure:

```ts
const response = await context.helpers.httpRequest({
  method: input.method ?? 'GET',
  url,
  headers,
  body: input.body,
  encoding: 'text',
  returnFullResponse: true,
  ignoreHttpStatusErrors: true,
}) as FullHttpResponse

if (response.statusCode >= 400) throw createHttpStatusError(response.statusCode, input.errorContext ?? 'odata')

try {
  return responseFormat === 'json' ? JSON.parse(String(response.body ?? '')) : response.body
} catch {
  throw createSapCapRequestError('CAP response did not match the expected OData shape.', {
    category: 'responseShape',
  })
}
```

---

_Reviewed: 2026-06-03T14:13:41Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
