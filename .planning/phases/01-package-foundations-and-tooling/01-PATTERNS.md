# Phase 01: Package Foundations and Tooling - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 14
**Analogs found:** 11 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` | config | batch | `package.json` current workspace/scripts | exact |
| `package-lock.json` | config | batch | `package-lock.json` workspace package entries | exact |
| `demo-app/package-lock.json` | config | batch | `demo-app/package-lock.json` linked plugin entries | exact |
| `docker-compose.yml` | config | request-response | `docker-compose.yml` current n8n service | exact |
| `cap-n8n-plugin/package.json` | config | batch | `cap-n8n-plugin/package.json` current manifest plus `N8nWorkflowService.js` runtime imports | exact |
| `cap-n8n-plugin/index.js` | utility | transform | `cap-n8n-plugin/lib/N8nWorkflowService.js` module export | role-match |
| `cap-n8n-plugin/cds-plugin.js` | provider | event-driven | `cap-n8n-plugin/cds-plugin.js` current CAP bootstrap | exact |
| `cap-n8n-plugin/lib/N8nWorkflowService.js` | service | request-response | same file current CAP service implementation | exact |
| `cap-n8n-node/package.json` | config | batch | `cap-n8n-node/package.json` current manifest plus research n8n manifest target | role-match |
| `cap-n8n-node/index.js` | utility | transform | `cap-n8n-node/index.js` empty entry and `cap-n8n-plugin/index.js` intended pattern | partial |
| `cap-n8n-node/nodes/SapCap/SapCap.node.ts` | component | CRUD | none in codebase; use research n8n skeleton pattern | no-analog |
| `cap-n8n-node/credentials/SapCapApi.credentials.ts` | config | request-response | none in codebase; use research credential skeleton pattern | no-analog |
| `cap-n8n-node/tsconfig.json` | config | transform | none in codebase; only add if n8n CLI/manual TS skeleton requires it | no-analog |
| `test/smoke/package-boundaries.test.js` | test | batch | `.planning/codebase/TESTING.md` absence pattern plus research smoke example | role-match |

## Pattern Assignments

### `package.json` (config, batch)

**Analog:** current root `package.json`

**Workspace pattern** (`package.json` lines 1-13):
```json
{
  "name": "cap-n8n-plugin-workspace",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "demo-app",
    "cap-n8n-plugin",
    "cap-n8n-node"
  ],
  "scripts": {
    "n8n:export": "docker compose exec n8n n8n export:workflow --all --output=/test-workflows/workflows.json",
    "n8n:import": "docker compose exec n8n n8n import:workflow --input=/test-workflows/workflows.json"
  }
}
```

**Target script pattern** (`01-RESEARCH.md` lines 423-437):
```json
{
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "smoke": "vitest run test/smoke",
    "test": "npm run smoke",
    "cap:serve": "npm run start --workspace demo-app",
    "n8n:up": "docker compose up -d n8n",
    "n8n:import": "docker compose exec n8n n8n import:workflow --input=/test-workflows/workflows.json",
    "n8n:export": "docker compose exec n8n n8n export:workflow --all --output=/test-workflows/workflows.json"
  }
}
```

**Copy guidance:** Preserve the workspace array exactly unless a package is intentionally renamed at the package metadata level. Add repo-local build/smoke/test/CAP/n8n scripts here, not as hidden global CLI assumptions.

---

### `package-lock.json` and `demo-app/package-lock.json` (config, batch)

**Analog:** current lockfile workspace package sections

**Root lock workspace pattern** (`package-lock.json` lines 1-23, 300-305):
```json
{
  "name": "cap-n8n-plugin-workspace",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "cap-n8n-plugin-workspace",
      "version": "1.0.0",
      "workspaces": [
        "demo-app",
        "cap-n8n-plugin",
        "cap-n8n-node"
      ]
    },
    "cap-n8n-node": {
      "version": "1.0.0",
      "license": "ISC"
    },
    "cap-n8n-plugin": {
      "version": "1.0.0",
      "license": "ISC"
    },
    "node_modules/cap-n8n-node": {
      "resolved": "cap-n8n-node",
      "link": true
    },
    "node_modules/cap-n8n-plugin": {
      "resolved": "cap-n8n-plugin"
    }
  }
}
```

**Drift to fix** (`demo-app/package-lock.json` grep lines 21-25; `package-lock.json` grep lines 20-22):
```text
demo-app/package-lock.json: "../cap-n8n-plugin" has "license": "MIT" and peer "@sap/cds": ">=7"
package-lock.json: "cap-n8n-plugin" has "license": "ISC" and no peer dependency metadata
```

**Copy guidance:** Regenerate lockfiles after manifest changes. The source of truth should be workspace package manifests, especially `cap-n8n-plugin/package.json` for `license`, `peerDependencies`, `engines`, `files`, `main`, and `exports`.

---

### `docker-compose.yml` (config, request-response)

**Analog:** current n8n Compose service

**Infrastructure pattern** (`docker-compose.yml` lines 1-17):
```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n_local
    ports:
      - "5678:5678"
    volumes:
      - ./.n8n-data:/home/node/.n8n
      - ./test-workflows:/test-workflows
    environment:
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - NODE_ENV=production
      - WEBHOOK_URL=http://localhost:5678/
      # Optional: Disable user management for simple local dev
      - N8N_USER_MANAGEMENT_DISABLED=true
```

**Copy guidance:** Keep ports, volumes, and local environment shape. Replace only the floating image with the pinned target from research: `n8nio/n8n:2.22.5` or a digest-pinned equivalent (`01-RESEARCH.md` lines 116, 172, 298, 311).

---

### `cap-n8n-plugin/package.json` (config, batch)

**Analog:** current plugin manifest plus existing runtime dependency on CAP

**Current manifest** (`cap-n8n-plugin/package.json` lines 1-12):
```json
{
  "name": "cap-n8n-plugin",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": ""
}
```

**Runtime import basis** (`cap-n8n-plugin/lib/N8nWorkflowService.js` lines 1-7):
```javascript
const cds = require('@sap/cds')

class N8nWorkflowService extends cds.Service {
  async init() {
    // Read config from cds.requires.n8n
    this.baseUrl = this.options.credentials?.baseUrl || this.options.baseUrl || 'http://localhost:5678'
    this.apiKey = this.options.credentials?.apiKey || this.options.apiKey
```

**Target metadata pattern** (`01-RESEARCH.md` lines 369-393):
```json
{
  "name": "cap-n8n-plugin",
  "version": "1.0.0",
  "description": "SAP CAP plugin for triggering n8n workflows",
  "main": "index.js",
  "exports": {
    ".": "./index.js"
  },
  "files": [
    "index.js",
    "cds-plugin.js",
    "lib/"
  ],
  "engines": {
    "node": ">=20"
  },
  "peerDependencies": {
    "@sap/cds": ">=9 <10"
  },
  "keywords": ["sap", "cap", "cds", "n8n", "workflow"],
  "license": "ISC"
}
```

**Copy guidance:** Do not add `@sap/cds` as a normal dependency in this package. It is a host CAP runtime peer. Replace failing placeholder `test` with a meaningful smoke-safe command.

---

### `cap-n8n-plugin/index.js` (utility, transform)

**Analog:** `cap-n8n-plugin/lib/N8nWorkflowService.js`

**Current export source** (`cap-n8n-plugin/lib/N8nWorkflowService.js` lines 3-4, 70):
```javascript
class N8nWorkflowService extends cds.Service {
  async init() {
    // ...
  }
}

module.exports = N8nWorkflowService
```

**Target public entry pattern** (`01-RESEARCH.md` lines 164-165):
```text
cap-n8n-plugin/index.js should export { N8nWorkflowService } from ./lib/N8nWorkflowService.js through the package-level API.
```

**Copy guidance:** Keep CommonJS. Preferred shape:
```javascript
const N8nWorkflowService = require('./lib/N8nWorkflowService.js')

module.exports = {
  N8nWorkflowService
}
```

---

### `cap-n8n-plugin/cds-plugin.js` (provider, event-driven)

**Analog:** same file current CAP bootstrap

**Bootstrap pattern** (`cap-n8n-plugin/cds-plugin.js` lines 1-19):
```javascript
const cds = require('@sap/cds');

cds.once('bootstrap', () => {
  cds.log('n8n').info('cap-n8n-plugin loaded. Registering n8n service implementation.');
  
  if (!cds.env.requires) cds.env.requires = {};
  
  // Provide default configuration for n8n requires
  if (cds.env.requires.n8n) {
    if (!cds.env.requires.n8n.impl) {
      cds.env.requires.n8n.impl = require.resolve('./lib/N8nWorkflowService.js');
    }
  } else {
    // Even if not explicitly declared, we can register the default kind mapping
    cds.env.requires.n8n = {
      impl: require.resolve('./lib/N8nWorkflowService.js')
    };
  }
});
```

**Copy guidance:** Keep this file beside `package.json` for CAP plugin auto-discovery. If edited, preserve explicit app config and only fill a missing `impl`; do not move full runtime behavior into Phase 1.

---

### `cap-n8n-plugin/lib/N8nWorkflowService.js` (service, request-response)

**Analog:** same file current CAP service implementation

**Service registration pattern** (`cap-n8n-plugin/lib/N8nWorkflowService.js` lines 13-20):
```javascript
// Programmatic start method
this.on('start', async (req) => {
  const { workflowId, inputs } = req.data
  return this._triggerWebhook(workflowId, inputs)
})

await super.init()
```

**HTTP/error pattern** (`cap-n8n-plugin/lib/N8nWorkflowService.js` lines 43-66):
```javascript
try {
  cds.log('n8n').info(`Triggering n8n workflow at ${url}`)
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(inputs || {})
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`n8n responded with status ${response.status}: ${errorText}`)
  }

  const responseText = await response.text()
  try {
    return responseText ? JSON.parse(responseText) : { success: true }
  } catch (e) {
    return { success: true, message: responseText }
  }
} catch (err) {
  cds.log('n8n').error(`Failed to trigger n8n workflow: ${err.message}`)
  throw err
}
```

**Copy guidance:** Phase 1 should not add cancel/query/retry/mock behavior here. Only adjust if package-boundary exports require a safer import shape.

---

### `demo-app/package.json` (config, request-response)

**Analog:** current demo CAP binding

**Dependency and binding pattern** (`demo-app/package.json` lines 7-24):
```json
"dependencies": {
  "@sap/cds": "^9.9.1",
  "cap-n8n-plugin": "*"
},
"devDependencies": {
  "@cap-js/sqlite": "^2.4"
},
"scripts": {
  "start": "cds-serve"
},
"cds": {
  "requires": {
    "n8n": {
      "impl": "../cap-n8n-plugin/lib/N8nWorkflowService.js",
      "credentials": {
        "baseUrl": "http://localhost:5678",
        "apiKey": "{env.N8N_API_KEY}"
      }
    }
  }
}
```

**Runtime consumption pattern** (`demo-app/srv/admin-service.js` lines 29-44):
```javascript
this.after ('CREATE', Books, async (data, req) => {
  try {
    const n8n = await cds.connect.to('n8n')
    await n8n.send('start', { 
      workflowId: 'webhook-test/cap-test-trigger', 
      inputs: { 
        event: 'BookCreated',
        bookId: data.ID,
        title: data.title
      } 
    })
    cds.log('n8n').info('Successfully notified n8n about new Book')
  } catch (err) {
    cds.log('n8n').error('Could not notify n8n about new Book:', err.message)
  }
})
```

**Copy guidance:** Preserve `cds.requires.n8n.credentials` and the demo proof. Prefer package-level consumption where safe, but do not regress `cds.connect.to('n8n')`.

---

### `cap-n8n-node/package.json` (config, batch)

**Analog:** current n8n package manifest plus research target

**Current manifest** (`cap-n8n-node/package.json` lines 1-12):
```json
{
  "name": "cap-n8n-node",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": ""
}
```

**Target n8n manifest pattern** (`01-RESEARCH.md` lines 398-418):
```json
{
  "name": "n8n-nodes-sap-cap",
  "version": "1.0.0",
  "description": "n8n community node for SAP CAP OData services",
  "main": "dist/index.js",
  "scripts": {
    "build": "n8n-node build",
    "lint": "n8n-node lint",
    "dev": "n8n-node dev",
    "test": "npm run build"
  },
  "keywords": ["n8n-community-node-package", "sap", "cap", "odata"],
  "n8n": {
    "nodes": ["dist/nodes/SapCap/SapCap.node.js"],
    "credentials": ["dist/credentials/SapCapApi.credentials.js"]
  },
  "license": "ISC"
}
```

**Copy guidance:** Keep folder `cap-n8n-node/`. Rename package metadata only if planner/product accepts `n8n-nodes-sap-cap` or a scoped `@scope/n8n-nodes-*` name. Add `@n8n/node-cli` scripts or matching generated structure.

---

### `cap-n8n-node/index.js` (utility, transform)

**Analog:** current empty entry and n8n package manifest target

**Current state:** `cap-n8n-node/index.js` is empty; requiring the package currently proves only syntax loadability, not useful package shape.

**n8n package boundary pattern** (`01-RESEARCH.md` lines 167, 189-192):
```text
cap-n8n-node/package.json owns n8n manifest entries.
nodes/SapCap/SapCap.node.ts is the minimal loadable action node.
credentials/SapCapApi.credentials.ts is the minimal credential skeleton.
```

**Copy guidance:** If `main` becomes `dist/index.js`, do not rely on source `index.js` as the n8n load target. Either remove it from package flow or make it a minimal CommonJS metadata bridge only if the chosen build path needs it.

---

### `cap-n8n-node/nodes/SapCap/SapCap.node.ts` (component, CRUD)

**Analog:** no in-repo n8n node implementation

**Research target** (`01-RESEARCH.md` lines 167-168):
```text
cap-n8n-node/package.json should include n8n.nodes manifest paths.
cap-n8n-node/nodes/SapCap/SapCap.node.ts should be a minimal action node class with metadata and no real OData operations yet.
```

**UI vocabulary cue** (`mockups/n8n-node-mockup.html` grep lines 411-431, 486-510):
```text
SAP CAP Node
Credential
Operation
Read
Create
Update
Delete
```

**Copy guidance:** Keep this loadability-only. Define node metadata and basic operations, but do not implement rich CAP OData read/create/update/delete behavior in Phase 1.

---

### `cap-n8n-node/credentials/SapCapApi.credentials.ts` (config, request-response)

**Analog:** no in-repo n8n credential implementation

**Research target** (`01-RESEARCH.md` lines 167-169):
```text
cap-n8n-node/package.json should include n8n.credentials manifest paths.
cap-n8n-node/credentials/SapCapApi.credentials.ts should be a minimal credential class skeleton.
Defer auth modes and $metadata credential test to Phase 6 unless needed for loadability.
```

**UI vocabulary cue** (`mockups/n8n-node-mockup.html` grep lines 290-308, 334-392):
```text
SAP CAP API
Credential Name
Base URL
Authentication Type
Basic Auth
OAuth2
```

**Copy guidance:** Provide only the minimal fields required for package loadability. Do not add real production credentials, API keys, private keys, or working BTP OAuth behavior in this phase.

---

### `cap-n8n-node/tsconfig.json` (config, transform)

**Analog:** no TypeScript config exists in repo

**Research basis** (`01-RESEARCH.md` lines 125-128, 307):
```text
n8n-workflow provides n8n TypeScript interfaces if manually creating TypeScript skeleton files.
typescript is needed if not fully delegated to @n8n/node-cli generated scaffold.
Use @n8n/node-cli or matching generated structure.
```

**Copy guidance:** Prefer the generated or documented n8n-node CLI configuration. If a manual `tsconfig.json` is added, keep it package-local under `cap-n8n-node/` and avoid introducing repo-wide TypeScript assumptions for CAP plugin code.

---

### `test/smoke/package-boundaries.test.js` (test, batch)

**Analog:** no existing automated test; use testing audit and research smoke example

**Current testing baseline** (`.planning/codebase/TESTING.md` lines 5-21):
```text
Runner: Not detected.
No Jest, Vitest, Mocha, node:test, CAP test runner config, or dedicated test dependency is declared.
npm test --workspace cap-n8n-plugin   # Placeholder command; exits with "Error: no test specified"
npm test --workspace cap-n8n-node     # Placeholder command; exits with "Error: no test specified"
```

**Smoke assertion pattern** (`01-RESEARCH.md` lines 275-293):
```javascript
const assert = require('node:assert/strict')

const plugin = require('cap-n8n-plugin')
assert.equal(typeof plugin.N8nWorkflowService, 'function')

const nodePackage = require('../../cap-n8n-node/package.json')
assert.ok(nodePackage.n8n)
assert.ok(Array.isArray(nodePackage.n8n.nodes))
```

**Copy guidance:** The smoke gate should prove meaningful exports and n8n package metadata. Keep live Docker n8n import/start separate from package-load smoke unless the planner explicitly makes it an optional smoke command.

## Shared Patterns

### Package Metadata

**Source:** `01-RESEARCH.md` lines 160-176 and package manifests

**Apply to:** `cap-n8n-plugin/package.json`, `cap-n8n-node/package.json`, `package-lock.json`, `demo-app/package-lock.json`

```text
Use package manifests as source of truth.
Keep `license` consistently `ISC` unless a project/legal decision changes it.
Declare host runtime dependencies as peers where appropriate.
Regenerate lockfiles after manifest and dependency changes.
```

### CommonJS Runtime Style

**Source:** `cap-n8n-plugin/lib/N8nWorkflowService.js` lines 1-3, 70

**Apply to:** `cap-n8n-plugin/index.js`, smoke tests if written in `.js`, any CAP plugin runtime edits

```javascript
const cds = require('@sap/cds')

class N8nWorkflowService extends cds.Service {
  // ...
}

module.exports = N8nWorkflowService
```

### CAP Logging and Error Handling

**Source:** `cap-n8n-plugin/lib/N8nWorkflowService.js` lines 43-66 and `demo-app/srv/admin-service.js` lines 41-44

**Apply to:** CAP plugin runtime and demo integration preservation

```javascript
cds.log('n8n').info(`Triggering n8n workflow at ${url}`)
// ...
cds.log('n8n').error(`Failed to trigger n8n workflow: ${err.message}`)
throw err
```

```javascript
cds.log('n8n').info('Successfully notified n8n about new Book')
cds.log('n8n').error('Could not notify n8n about new Book:', err.message)
```

### Tooling Commands

**Source:** `package.json` lines 10-13, `01-RESEARCH.md` lines 423-437

**Apply to:** root `package.json`, package `scripts`, verification plans

```json
"n8n:export": "docker compose exec n8n n8n export:workflow --all --output=/test-workflows/workflows.json",
"n8n:import": "docker compose exec n8n n8n import:workflow --input=/test-workflows/workflows.json"
```

Add repo-local scripts for build/smoke/test/CAP serve rather than relying on global `cds` or `n8n-node`.

### Phase Boundaries

**Source:** `01-CONTEXT.md` decisions D-17 through D-22; `01-RESEARCH.md` lines 295-301

**Apply to:** all Phase 1 files

```text
Do not implement full start semantics, execution IDs, cancel/query, retries, mock runtime, declarative annotations, OData operations, workflow import, BTP deployment, or hybrid-cloud docs in Phase 1.
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `cap-n8n-node/nodes/SapCap/SapCap.node.ts` | component | CRUD | No n8n node implementation exists; use `@n8n/node-cli` or research target structure. |
| `cap-n8n-node/credentials/SapCapApi.credentials.ts` | config | request-response | No credential class exists; use minimal n8n credential skeleton only. |
| `cap-n8n-node/tsconfig.json` | config | transform | No TypeScript config exists; add only if required by n8n CLI/manual skeleton. |

## Metadata

**Analog search scope:** root package manifests, package entry files, CAP plugin runtime, demo CAP service/configuration, Docker Compose, codebase testing/concerns docs, n8n mockup labels.

**Files scanned:** 22 local files plus targeted lockfile sections.

**Pattern extraction date:** 2026-05-28

