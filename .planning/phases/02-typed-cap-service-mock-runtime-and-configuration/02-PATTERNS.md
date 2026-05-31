# Phase 02: Typed CAP Service, Mock Runtime, and Configuration - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 10
**Analogs found:** 9 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `cap-n8n-plugin/lib/N8nWorkflowService.js` | service | request-response | same file current CAP service adapter | exact |
| `cap-n8n-plugin/lib/MockN8nWorkflowService.js` | service | in-memory request-response | `N8nWorkflowService.js` CAP service shape | role-match |
| `cap-n8n-plugin/lib/config.js` | utility | transform | `N8nWorkflowService.js` option reads and `demo-app/package.json` CAP config | role-match |
| `cap-n8n-plugin/lib/errors.js` | utility | transform | `CatalogService` use of CAP request errors and current n8n transport errors | role-match |
| `cap-n8n-plugin/index.js` | utility | transform | Phase 1 public export bridge | exact |
| `cap-n8n-plugin/package.json` | config | batch | Phase 1 package export map | exact |
| `cap-n8n-plugin/cds-plugin.js` | provider | event-driven | current CAP bootstrap default implementation registration | exact |
| `demo-app/package.json` | config | request-response | current `cds.requires.n8n` binding | exact |
| `test/integration/*.test.js` | test | request-response | `test/smoke/package-boundaries.test.js` Vitest style | role-match |
| `package.json` | config | batch | root smoke/test script pattern | exact |

## Pattern Assignments

### CAP Service Runtime

**Analog:** `cap-n8n-plugin/lib/N8nWorkflowService.js`

```javascript
const cds = require('@sap/cds')

class N8nWorkflowService extends cds.Service {
  async init() {
    this.on('start', async (req) => {
      const { workflowId, inputs } = req.data
      return this._triggerWebhook(workflowId, inputs)
    })

    await super.init()
  }
}

module.exports = N8nWorkflowService
```

**Copy guidance:** Keep the class-based `cds.Service` implementation. Add a developer-facing `start(workflowId, inputs, options)` method on the service class, and have the `this.on('start', ...)` handler delegate to that method so `n8n.send('start', ...)` remains compatible.

### Demo CAP Consumer

**Analog:** `demo-app/srv/admin-service.js`

```javascript
const n8n = await cds.connect.to('n8n')
await n8n.send('start', {
  workflowId: 'webhook-test/cap-test-trigger',
  inputs: {
    event: 'BookCreated',
    bookId: data.ID,
    title: data.title
  }
})
```

**Copy guidance:** Preserve this compatibility path. A later demo cleanup may use `await n8n.start(...)`, but Phase 2 must not break the existing `send('start', ...)` call.

### CAP Config Binding

**Analog:** `demo-app/package.json`

```json
{
  "cds": {
    "requires": {
      "n8n": {
        "impl": "cap-n8n-plugin/service",
        "credentials": {
          "baseUrl": "http://localhost:5678",
          "apiKey": "{env.N8N_API_KEY}"
        }
      }
    }
  }
}
```

**Copy guidance:** Keep `impl: "cap-n8n-plugin/service"` loadable. Add config support around `cds.requires.n8n.kind`, `credentials.baseUrl`, optional API key/header auth, timeout, retries, and mock fallback. Avoid service-name branching such as `n8n-local` or `n8n-mock`.

### Package Export Map

**Analog:** `cap-n8n-plugin/package.json` and `cap-n8n-plugin/index.js`

```json
"exports": {
  ".": "./index.js",
  "./service": "./lib/N8nWorkflowService.js",
  "./cds-plugin": "./cds-plugin.js",
  "./cds-plugin.js": "./cds-plugin.js"
}
```

```javascript
const N8nWorkflowService = require('./lib/N8nWorkflowService.js')

module.exports = {
  N8nWorkflowService
}
```

**Copy guidance:** If new package-owned modules are added, export only intentionally public surfaces. Keep mock/config/error helpers internal unless tests or consumers need a documented subpath.

### Error Handling

**Analogs:** `demo-app/srv/cat-service.js` and current n8n service errors

```javascript
if (!book) return req.error(404, `Book #${id} doesn't exist`)
```

```javascript
if (!response.ok) {
  const errorText = await response.text()
  throw new Error(`n8n responded with status ${response.status}: ${errorText}`)
}
```

**Copy guidance:** Replace raw n8n errors with structured sanitized CDS-compatible errors. Preserve enough machine-readable fields for tests: `source: 'n8n'`, `statusCode`, `retryable`, and safe detail text. Do not include stack traces, auth headers, API keys, or full request payloads.

### Vitest Integration Tests

**Analog:** `test/smoke/package-boundaries.test.js`

```javascript
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

describe('package boundaries', () => {
  it('loads the CAP plugin through its package name', () => {
    const plugin = require('cap-n8n-plugin')
    const service = require('cap-n8n-plugin/service')

    expect(plugin).toHaveProperty('N8nWorkflowService')
    expect(plugin.N8nWorkflowService).toBe(service)
  })
})
```

**Copy guidance:** Use Vitest for integration tests. Prefer local HTTP servers and package imports over live Docker n8n so retry, timeout, auth, and error behavior is deterministic.

## Shared Patterns

### Runtime Style

- JavaScript CommonJS in `cap-n8n-plugin`.
- Two-space indentation.
- Single quotes.
- No semicolons in service runtime files.
- `cds.log('n8n')` for integration logs.

### Stable Envelope Shape

Apply context decisions D-02, D-04, D-17, and D-18:

```text
{
  accepted: boolean,
  workflowId: string,
  executionId?: string,
  correlationId?: string,
  businessKey?: string,
  result?: object|string|null,
  mock?: boolean
}
```

**Copy guidance:** The exact object can evolve during implementation, but plans must keep it schema-friendly and avoid treating inputs/results/errors as unbounded permanent blobs.

### Phase Boundary

Do not implement:

- persisted execution store,
- query/cancel APIs,
- duplicate detection records,
- declarative CDS annotations,
- workflow import,
- generated CDS typings,
- n8n-node OData metadata discovery or operation behavior.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `cap-n8n-plugin/lib/config.js` | utility | transform | No dedicated config resolver exists; it should be extracted from current inline option reads and CAP profile requirements. |

## Metadata

**Analog search scope:** CAP plugin runtime, package exports, demo CAP services, root test scripts, smoke tests, Phase 1 pattern map, and Phase 2 context/research.

**Pattern extraction date:** 2026-05-31

## PATTERN MAPPING COMPLETE
