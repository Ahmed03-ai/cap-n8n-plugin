# Phase 1: Package Foundations and Tooling - Research

**Researched:** 2026-05-28
**Domain:** npm workspace packaging, SAP CAP plugin packaging, n8n community-node scaffolding, repo-local tooling
**Confidence:** HIGH for CAP/npm/package-boundary guidance; MEDIUM for exact n8n scaffold dependency set because `@n8n/node-cli` should generate the final package shape during implementation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

## Implementation Decisions

### GitHub Issue Access

- [D-01] GitHub issues are accessible from this environment through the public GitHub API for `Ahmed03-ai/cap-n8n-plugin`.
- [D-02] Leon's GitHub assignee login is `Koerbser`.
- [D-03] Planning should use open issues assigned to `Koerbser` as contextual constraints, but Phase 1 scope remains governed by `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`.

### Leon-Assigned Issue Scope

- [D-04] Issues assigned to `Koerbser` are #2, #5-#18, #29, and #30.
- [D-05] No `Koerbser`-assigned GitHub issue directly maps to Phase 1 requirements `FOUND-01` through `FOUND-05` and `NODE-01`.
- [D-06] GitHub Epic 1 is not the same as GSD Phase 1. GitHub Epic 1 is runtime/API behavior; GSD Phase 1 is package/tooling foundation.
- [D-07] Phase 1 should enable future work on Leon-assigned issues by fixing package entry points, metadata, tooling, and smoke tests.
- [D-08] Phase 1 should not close or claim completion of #2, #5-#18, #29, or #30 unless a separate foundation issue is created and assigned.

### Include in Phase 1

- [D-09] Add or repair the public package entry for `cap-n8n-plugin` so consumers do not import `cap-n8n-plugin/lib/N8nWorkflowService.js` directly.
- [D-10] Align `cap-n8n-plugin` package metadata with actual runtime needs: CAP peer dependency, Node engine, package files, description, keywords, and license.
- [D-11] Add repo-local commands and dependencies for CAP CLI/build/test/smoke workflows instead of relying on undocumented global tools.
- [D-12] Replace intentionally failing placeholder package test scripts with meaningful smoke or no-op-safe commands.
- [D-13] Pin local n8n Docker infrastructure instead of using `n8nio/n8n:latest`.
- [D-14] Create an n8n community-node package skeleton/loadability baseline for `NODE-01`; detailed n8n node operations remain later work.
- [D-15] Add smoke tests proving both `cap-n8n-plugin` and `cap-n8n-node` are loadable through package-level boundaries.
- [D-16] Keep the demo app's existing CAP-to-n8n book-create proof working while moving it away from internal package paths where possible.

### Exclude from Phase 1

- [D-17] Do not implement full `start(workflowId, inputs)` semantics, execution ID guarantees, auth behavior, or CDS error propagation for issue #2; this belongs to GSD Phase 2.
- [D-18] Do not implement cancel/query/execution lookup for issues #5 and #6; this belongs to GSD Phase 3.
- [D-19] Do not implement local mock, profiles, retry/backoff, or runtime error behavior for issues #7-#10; these belong to GSD Phase 2.
- [D-20] Do not implement declarative CAP annotations for issues #11-#15; these belong to GSD Phase 4.
- [D-21] Do not implement workflow import or build validation for issues #16-#18; these belong to GSD Phase 5.
- [D-22] Do not implement BTP deployment or hybrid-cloud documentation for issues #29 and #30; these belong to GSD Phase 8.

### the agent's Discretion

- [D-23] Planner may split Phase 1 into multiple independent plans or waves if that improves parallel execution.
- [D-24] Planner may choose exact test file names, script names, and package skeleton file names, provided they are conventional for npm, SAP CAP, and n8n community-node development.
- [D-25] Planner may decide whether demo app consumption of the plugin package is fully fixed in Phase 1 or limited to a smoke-testable bridge, as long as no future work is blocked.

### Deferred Ideas (OUT OF SCOPE)

- Full CAP workflow start/cancel/query runtime behavior remains deferred to Phases 2 and 3.
- Declarative CAP annotations remain deferred to Phase 4.
- Workflow import and build-time validation remain deferred to Phase 5.
- Rich n8n node operations and credentials remain deferred to Phases 6 and 7.
- BTP deployment, hybrid-cloud docs, `.env.example` completeness, and optional trigger node work remain deferred to Phase 8 or v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Developer can install and consume `cap-n8n-plugin` through a package-level public entry point. | Public CommonJS exports from `cap-n8n-plugin/index.js`, package `main`, `exports`, and smoke tests prove package-level consumption. [VERIFIED: codebase grep] [CITED: https://docs.npmjs.com/files/package.json/] |
| FOUND-02 | Developer can rely on declared package metadata, including CAP peer dependencies, Node engine constraints, and package license. | `@sap/cds` is a host runtime dependency and should be a peer dependency; Node engines should reflect CAP `>=20` and n8n dev runtime `>=22.16`. [VERIFIED: npm registry] [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins] |
| FOUND-03 | Developer can run repo-local CAP, n8n, and test tooling without relying on undocumented global installs. | Add workspace scripts using local `@sap/cds-dk`, `@n8n/node-cli`, Docker Compose, and a test runner instead of hidden global `cds` or `n8n-node` commands. [VERIFIED: local command audit] [CITED: https://cap.cloud.sap/docs/node.js/cds-server] [CITED: https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/] |
| FOUND-04 | Developer can run a passing smoke test proving the CAP plugin package and n8n node package are loadable. | Existing package entry points load as empty objects and workspace tests fail by design; add smoke tests that assert meaningful exports and n8n package metadata. [VERIFIED: local command audit] |
| FOUND-05 | Developer can use pinned local development infrastructure so n8n and CAP behavior do not drift unexpectedly. | Replace `n8nio/n8n:latest` with a pinned `n8nio/n8n:2.22.5` tag or digest-backed image reference. [VERIFIED: codebase grep] [VERIFIED: npm registry] [CITED: https://docs.docker.com/dhi/core-concepts/digests/] |
| NODE-01 | n8n workflow designer can install and load an SAP CAP community node package. | Use n8n community-node package metadata, `n8n` manifest entries, a `nodes` directory, a `credentials` directory, and `@n8n/node-cli` build/lint/dev scripts. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/] [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-file-structure/] |
</phase_requirements>

## Summary

Phase 1 should turn the brownfield prototype into a stable npm workspace foundation without implementing later workflow runtime behavior. The CAP plugin already has useful code in `cap-n8n-plugin/lib/N8nWorkflowService.js`, but `cap-n8n-plugin/index.js` is empty and package metadata does not declare the CAP peer, Node engine, package files, or consistent license. [VERIFIED: codebase grep] The n8n package is also an empty workspace package, while n8n's current community-node standards require package metadata, a `nodes` directory, a `credentials` directory, and package-level `n8n` manifest entries. [VERIFIED: codebase grep] [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-file-structure/]

The implementation plan should be packaging-first: repair public exports, align package metadata, add repo-local scripts, add smoke tests, pin Docker n8n, and create the minimum conventional n8n node skeleton. [VERIFIED: .planning/phases/01-package-foundations-and-tooling/01-CONTEXT.md] Do not add real workflow start guarantees, execution IDs, cancel/query, retries, mock runtime, declarative annotations, OData operations, credential modes, or BTP docs in this phase. [VERIFIED: .planning/phases/01-package-foundations-and-tooling/01-CONTEXT.md]

**Primary recommendation:** Use npm workspaces as the boundary, keep `cap-n8n-plugin` CommonJS, keep the folder `cap-n8n-node/`, but set the n8n node package metadata to n8n community-node conventions and verify both packages with a root smoke command. [VERIFIED: codebase grep] [CITED: https://docs.npmjs.com/cli/using-npm/workspaces/] [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/]

## Project Constraints (from AGENTS.md)

- Use JavaScript CommonJS, SAP CAP, CDS/CDL, npm workspaces, Docker Compose, and n8n community-node conventions already present in the repository. [VERIFIED: AGENTS.md]
- Use Node.js 20+ for CAP compatibility; Phase 1 repo-level tooling should use Node.js `>=22.16` if running local n8n/node tooling because current n8n declares `node >=22.16`. [VERIFIED: AGENTS.md] [VERIFIED: npm registry]
- Use integration-test or smoke-test language in planning artifacts, not unit-test framing as the primary requirement language. [VERIFIED: AGENTS.md]
- Keep secrets in environment configuration and do not commit API keys, private keys, or real production credentials. [VERIFIED: AGENTS.md]
- Put reusable behavior in `cap-n8n-plugin` and `cap-n8n-node`, not only in `demo-app`. [VERIFIED: AGENTS.md]
- Match local code style: CommonJS, two-space indentation, no semicolons in service files, single quotes in Node.js code, CAP `cds.log('n8n')` for runtime logs. [VERIFIED: AGENTS.md] [VERIFIED: codebase grep]
- Do not make direct repo edits outside a GSD workflow; this research was generated through the Phase 1 GSD research flow. [VERIFIED: AGENTS.md]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| CAP plugin public consumption | API / Backend package | npm workspace root | CAP application code consumes a package-level CommonJS API and CAP auto-loads `cds-plugin.js` during server bootstrap. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins] |
| CAP peer/runtime metadata | npm package boundary | API / Backend package | Package metadata tells host CAP apps which CAP and Node runtimes are compatible before runtime code executes. [CITED: https://docs.npmjs.com/files/package.json/] |
| Repo-local CAP CLI tooling | npm workspace root | demo app | Root scripts should call local package bins and route workspace commands; the demo app remains a consumer proof. [CITED: https://docs.npmjs.com/cli/using-npm/workspaces/] [CITED: https://cap.cloud.sap/docs/node.js/cds-server] |
| n8n community-node skeleton | n8n node package | npm workspace root | n8n package loadability is owned by `cap-n8n-node` metadata, `nodes/`, `credentials/`, and `@n8n/node-cli` scripts. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/] |
| Local n8n infrastructure | Docker Compose | npm workspace root | Local workflow runtime is started by Compose and import/export scripts; it should be pinned to prevent runtime drift. [VERIFIED: docker-compose.yml] [CITED: https://docs.docker.com/dhi/core-concepts/digests/] |
| Smoke verification | npm workspace root | package workspaces | A single root command should verify both package boundaries in a repeatable way. [VERIFIED: .planning/REQUIREMENTS.md] |

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Node.js | `>=22.16 <25` for repo tooling; `>=20` acceptable for CAP plugin consumers | Runtime for npm workspaces, CAP, tests, and n8n node tooling | CAP 9.9.1 declares `node >=20`; n8n 2.22.5 declares `node >=22.16`; local Node is `v24.16.0`. [VERIFIED: npm registry] [VERIFIED: local command audit] |
| npm workspaces | npm `11.13.0` local | Links `demo-app`, `cap-n8n-plugin`, and `cap-n8n-node` from one root install | npm workspaces auto-symlink nested packages during install. [VERIFIED: local command audit] [CITED: https://docs.npmjs.com/cli/using-npm/workspaces/] |
| `@sap/cds` | `9.9.1` | Host CAP runtime and `cds.Service` base class | Existing code requires `@sap/cds`; registry latest is 9.9.1 and it declares Node `>=20`. [VERIFIED: npm registry] [VERIFIED: codebase grep] |
| `@sap/cds-dk` | `9.9.1` | Repo-local CAP CLI for `cds serve`, `cds watch`, and compile/build commands | CAP docs identify `cds serve/run/watch` as normal local server commands and `@sap/cds-dk` provides the `cds` CLI. [VERIFIED: npm registry] [CITED: https://cap.cloud.sap/docs/node.js/cds-server] |
| `@n8n/node-cli` | `0.32.1` | Official n8n community-node scaffold/build/lint/dev CLI | n8n docs call `n8n-node` the official CLI for community-node development. [VERIFIED: npm registry] [CITED: https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/] |
| `n8nio/n8n` Docker image | `2.22.5` tag, optionally digest-pinned | Local n8n runtime for demo import/export smoke workflows | Current `docker-compose.yml` uses `latest`; registry current n8n stable/latest is `2.22.5`. [VERIFIED: docker-compose.yml] [VERIFIED: npm registry] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `vitest` | `4.1.7` [WARNING: slopcheck flagged as suspicious due name similarity to `vite`; verify before install.] | Test runner for smoke/integration tests | Use for root smoke tests and later CAP `cds.test()` integration tests; CAP docs recommend migrating to Vitest. [VERIFIED: npm registry] [CITED: https://cap.cloud.sap/docs/node.js/cds-test] |
| `@cap-js/sqlite` | `2.4.0` | In-memory/local persistence adapter for CAP demo tests | Already used by `demo-app`; keep for CAP integration smoke paths. [VERIFIED: npm registry] [VERIFIED: demo-app/package.json] |
| `n8n-workflow` | `2.16.0` | n8n TypeScript interfaces such as `INodeType` and `INodeTypeDescription` | Use only if manually creating TypeScript skeleton files; official n8n docs import node interfaces from `n8n-workflow`. [VERIFIED: npm registry] [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/structure/] |
| `typescript` | `6.0.3` | TypeScript compiler/runtime types for n8n node source | Use if not fully delegated to `@n8n/node-cli` generated scaffold. [VERIFIED: npm registry] [ASSUMED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@n8n/node-cli` scaffold | Hand-written `nodes/` and `credentials/` files | Hand-writing risks missing n8n package conventions; official docs recommend `n8n-node` for structure, linting, testing, and verification alignment. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/] |
| Vitest | Node built-in `node:test` | `node:test` avoids adding a runner, but CAP docs explicitly recommend Vitest for current `cds.test()` usage. [CITED: https://cap.cloud.sap/docs/node.js/cds-test] |
| Docker tag pin | Digest pin | A tag is easier for local developers; a digest is more reproducible because Docker identifies exact image content by SHA-256 digest. [CITED: https://docs.docker.com/dhi/core-concepts/digests/] |

**Installation:**

```bash
npm install --save-dev --workspace cap-n8n-node @n8n/node-cli n8n-workflow typescript
npm install --save-dev @sap/cds-dk vitest
```

Use a human verification checkpoint before installing `vitest` because slopcheck flagged it as suspicious even though CAP docs recommend Vitest and npm metadata shows a mature package with high downloads. [WARNING: slopcheck flagged as suspicious — verify before using.] [VERIFIED: slopcheck] [CITED: https://cap.cloud.sap/docs/node.js/cds-test]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@sap/cds-dk` | npm | created 2020-06-11 | 175,275/week | none reported by npm metadata | OK | Approved; package name is documented by SAP CAP docs. [VERIFIED: npm registry] [CITED: https://cap.cloud.sap/docs/tools/cds-cli] |
| `vitest` | npm | created 2021-12-03 | 58,903,915/week | github.com/vitest-dev/vitest | SUS | Flagged; planner must add `checkpoint:human-verify` before install. [VERIFIED: npm registry] [VERIFIED: slopcheck] |
| `@n8n/node-cli` | npm | created 2025-08-21 | 6,146/week | github.com/n8n-io/n8n | OK | Approved; package name is documented by n8n docs. [VERIFIED: npm registry] [CITED: https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/] |
| `n8n-workflow` | npm | created 2019-06-21 | 315,751/week | github.com/n8n-io/n8n | OK | Approved if manual TS skeleton imports n8n interfaces. [VERIFIED: npm registry] [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/structure/] |
| `typescript` | npm | created 2012-10-01 | 198,427,208/week | github.com/microsoft/TypeScript | OK | Approved if not already supplied by n8n scaffold. [VERIFIED: npm registry] [ASSUMED] |

**Packages removed due to slopcheck [SLOP] verdict:** none. [VERIFIED: slopcheck]

**Packages flagged as suspicious [SUS]:** `vitest`; planner should insert `checkpoint:human-verify` before install. [VERIFIED: slopcheck]

**Postinstall script check:** `@sap/cds-dk`, `vitest`, and `@n8n/node-cli` reported no `scripts.postinstall` value through `npm view`. [VERIFIED: npm registry]

## Package Metadata Target State

| File | Target State | Rationale |
|------|--------------|-----------|
| `cap-n8n-plugin/package.json` | Add `description`, `keywords`, `engines.node: >=20`, `peerDependencies.@sap/cds`, `files`, `main`, `exports`, and consistent `license`. | Existing plugin code requires `@sap/cds`; npm `main` controls `require('pkg')`; `exports` defines public entry points. [VERIFIED: codebase grep] [CITED: https://docs.npmjs.com/files/package.json/] |
| `cap-n8n-plugin/index.js` | Export `{ N8nWorkflowService }` from `./lib/N8nWorkflowService.js` through package-level API. | Current entry is empty, so package consumers receive no useful API. [VERIFIED: local command audit] |
| `cap-n8n-plugin/cds-plugin.js` | Keep next to `package.json`; avoid breaking CAP auto-discovery. | CAP docs say `cds-plugin.js` beside package metadata is auto-detected during CAP server bootstrap. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins] |
| `cap-n8n-node/package.json` | Keep folder boundary, but use n8n community-node metadata: package name should start `n8n-nodes-` or be scoped as `@scope/n8n-nodes-*`, include `n8n-community-node-package` keyword, and include `n8n.nodes` / `n8n.credentials` manifest paths. | n8n community-node standards require the package-name prefix, keyword, and `n8n` package attribute. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/] |
| `cap-n8n-node/nodes/SapCap/SapCap.node.ts` | Minimal action node class with metadata and no real OData operations yet. | n8n requires a base file in `nodes` named `<node-name>.node.ts`. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-file-structure/] |
| `cap-n8n-node/credentials/SapCapApi.credentials.ts` | Minimal credential class skeleton; defer auth modes and `$metadata` credential test to Phase 6 unless needed for loadability. | n8n requires credentials files under `credentials`; credential test details are later requirements. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/] [VERIFIED: .planning/REQUIREMENTS.md] |
| `package-lock.json` | Regenerate from root after package metadata/dependency changes. | npm workspaces and package-lock are root-level install state for linked packages. [CITED: https://docs.npmjs.com/cli/using-npm/workspaces/] |
| `demo-app/package.json` | Prefer package boundary for plugin consumption; avoid direct `../cap-n8n-plugin/lib/...` if Phase 1 planner chooses full fix. | Context says keep demo proof working while moving away from internal package paths where possible. [VERIFIED: .planning/phases/01-package-foundations-and-tooling/01-CONTEXT.md] |
| `docker-compose.yml` | Replace `n8nio/n8n:latest` with `n8nio/n8n:2.22.5` or a digest-pinned equivalent. | Current file uses floating `latest`; pinned images reduce drift. [VERIFIED: docker-compose.yml] [VERIFIED: npm registry] |

**License note:** License selection is a project/legal decision; absent a new user decision, keep the current `ISC` consistently across package manifests and lockfiles rather than silently switching to MIT. [ASSUMED]

**n8n package name note:** Recommended package name is `n8n-nodes-sap-cap` while retaining the `cap-n8n-node/` workspace folder. The exact public npm name is a product decision, but the `n8n-nodes-` prefix requirement is documented by n8n. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/] [ASSUMED]

## Architecture Patterns

### System Architecture Diagram

```text
Developer install / npm workspace install
  -> root package.json workspaces
     -> cap-n8n-plugin package
        -> index.js public CommonJS export
        -> cds-plugin.js CAP bootstrap auto-discovery
        -> lib/N8nWorkflowService.js existing service implementation
     -> cap-n8n-node package
        -> package.json n8n manifest
        -> nodes/SapCap/SapCap.node.ts minimal loadable action node
        -> credentials/SapCapApi.credentials.ts minimal credential skeleton
     -> demo-app package
        -> consumes cap-n8n-plugin through package boundary or preserved bridge
  -> root smoke command
     -> require/import CAP plugin package boundary
     -> inspect/build n8n node package boundary
     -> report pass/fail without live n8n unless explicitly running Docker smoke
  -> docker compose
     -> pinned n8n image
     -> existing workflow import/export scripts
```

### Recommended Project Structure

```text
cap-n8n-plugin/
├── index.js                         # Public CommonJS exports
├── cds-plugin.js                    # CAP auto-plugin hook
├── lib/
│   └── N8nWorkflowService.js        # Existing implementation, no Phase 2 behavior expansion
└── package.json                     # Peer deps, engines, files, exports, license

cap-n8n-node/
├── credentials/
│   └── SapCapApi.credentials.ts     # Minimal n8n credential skeleton
├── nodes/
│   └── SapCap/
│       ├── SapCap.node.ts           # Minimal action node skeleton
│       └── SapCap.node.json         # Optional codex metadata
├── package.json                     # n8n community-node metadata and scripts
└── tsconfig.json                    # If generated by n8n-node scaffold

test/
└── smoke/
    └── package-load.test.js         # Root package loadability smoke test
```

### Pattern 1: CAP Plugin Package Boundary

**What:** Keep CAP auto-loading in `cds-plugin.js`, but export the reusable service from `index.js` so consumers and tests can use `require('cap-n8n-plugin')`. [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins] [CITED: https://docs.npmjs.com/files/package.json/]

**When to use:** Use in Phase 1 because `FOUND-01` is package-level consumption, not new runtime semantics. [VERIFIED: .planning/REQUIREMENTS.md]

**Example:**

```javascript
// Source: local CommonJS style + npm main behavior
const N8nWorkflowService = require('./lib/N8nWorkflowService')

module.exports = {
  N8nWorkflowService
}
```

### Pattern 2: n8n Node Skeleton Through Official Package Shape

**What:** Use `@n8n/node-cli` scaffolding or match its output closely: TypeScript node base file under `nodes/`, credential file under `credentials/`, and `package.json` `n8n` entries. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/] [CITED: https://docs.n8n.io/integrations/creating-nodes/build/reference/node-file-structure/]

**When to use:** Use in Phase 1 to satisfy `NODE-01` loadability while deferring credential auth modes and OData operations to Phases 6 and 7. [VERIFIED: .planning/ROADMAP.md]

**Example:**

```typescript
// Source: n8n node base file docs
import { INodeType, INodeTypeDescription } from 'n8n-workflow';

export class SapCap implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SAP CAP',
    name: 'sapCap',
    icon: 'file:sapCap.svg',
    group: ['transform'],
    version: 1,
    description: 'Connect to SAP CAP OData services',
    defaults: { name: 'SAP CAP' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'sapCapApi', required: false }],
    properties: []
  };
}
```

### Pattern 3: Root Smoke Test as Integration-Style Gate

**What:** Run one root smoke command that verifies package boundaries without needing a live n8n container. [VERIFIED: .planning/REQUIREMENTS.md]

**When to use:** Use per task and phase gate for `FOUND-04`; keep live Docker n8n import/start as a separate optional smoke command because the container may be stopped. [VERIFIED: local command audit]

**Example:**

```javascript
// Source: local smoke strategy
const assert = require('node:assert/strict')

const plugin = require('cap-n8n-plugin')
assert.equal(typeof plugin.N8nWorkflowService, 'function')

const nodePackage = require('../../cap-n8n-node/package.json')
assert.ok(nodePackage.n8n)
assert.ok(Array.isArray(nodePackage.n8n.nodes))
```

### Anti-Patterns to Avoid

- **Internal-path demo dependency:** Do not make `../cap-n8n-plugin/lib/N8nWorkflowService.js` the long-term consumption story; use the package boundary where possible. [VERIFIED: .planning/codebase/CONCERNS.md]
- **Floating local n8n image:** Do not keep `n8nio/n8n:latest` for Phase 1 success because it can change local behavior without repo changes. [VERIFIED: docker-compose.yml] [CITED: https://docs.docker.com/dhi/core-concepts/digests/]
- **Full runtime behavior creep:** Do not implement start result semantics, cancel/query, retries, mock runtime, annotations, or OData operations in Phase 1. [VERIFIED: .planning/phases/01-package-foundations-and-tooling/01-CONTEXT.md]
- **Placeholder failing tests:** Do not leave workspace `test` scripts as `echo "Error: no test specified" && exit 1`; current root workspace test fails by design. [VERIFIED: local command audit]
- **Hand-written n8n package conventions:** Do not invent package layout where `@n8n/node-cli` and official docs already define it. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| n8n community-node scaffolding | Custom folder and metadata conventions | `@n8n/node-cli` or matching generated structure | n8n docs recommend this CLI for correct structure, linting, testing, and verification alignment. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/] |
| CAP CLI availability | Hidden global `cds` dependency | Local `@sap/cds-dk` plus npm scripts | Local `cds` was not found, while CAP docs describe `cds serve/run/watch` CLI usage. [VERIFIED: local command audit] [CITED: https://cap.cloud.sap/docs/node.js/cds-server] |
| Package linking | Manual `npm link` setup | npm workspaces | npm workspaces auto-symlink local packages during install. [CITED: https://docs.npmjs.com/cli/using-npm/workspaces/] |
| Test harness | Bespoke shell checks only | Vitest smoke/integration tests, with human verification for package install | CAP docs recommend Vitest for current `cds.test()` usage; slopcheck requires explicit verification before install. [CITED: https://cap.cloud.sap/docs/node.js/cds-test] [VERIFIED: slopcheck] |
| Image reproducibility | Floating Docker tags | Pinned n8n tag or digest | Docker digests identify exact image content; tags can point to manifests. [CITED: https://docs.docker.com/dhi/core-concepts/digests/] |

**Key insight:** Phase 1's risk is not business logic complexity; it is false confidence from empty package entries, hidden global tooling, floating infrastructure, and smoke tests that do not prove real package boundaries. [VERIFIED: local command audit] [VERIFIED: .planning/codebase/CONCERNS.md]

## Common Pitfalls

### Pitfall 1: n8n Package Name Violates Community-Node Standards

**What goes wrong:** The workspace folder `cap-n8n-node/` stays valid locally, but the npm package name `cap-n8n-node` does not meet n8n community-node naming standards. [VERIFIED: cap-n8n-node/package.json] [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/]

**Why it happens:** Developers conflate repository folder names with public npm package names. [ASSUMED]

**How to avoid:** Keep the folder if desired, but set the package name to a n8n-compatible name such as `n8n-nodes-sap-cap`, pending product approval of the exact name. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/] [ASSUMED]

**Warning signs:** `package.json` lacks `n8n-community-node-package` keyword or `n8n` manifest entries. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/]

### Pitfall 2: Lockfile Drift Across Root and Demo App

**What goes wrong:** Root and nested lockfiles can preserve old package metadata after `cap-n8n-plugin/package.json` changes. [VERIFIED: .planning/codebase/CONCERNS.md]

**Why it happens:** The repo currently has both root `package-lock.json` and `demo-app/package-lock.json`, and prior scans found inconsistent plugin license/peer metadata. [VERIFIED: .planning/codebase/CONCERNS.md]

**How to avoid:** Regenerate lockfiles deliberately from the root after metadata changes, then decide whether the nested demo lockfile remains necessary. [ASSUMED]

**Warning signs:** `package-lock.json` package entries for workspace packages do not match workspace package manifests. [VERIFIED: package-lock.json]

### Pitfall 3: Smoke Tests Only Prove Empty Requires

**What goes wrong:** `require('./cap-n8n-plugin')` and `require('./cap-n8n-node')` currently succeed but return empty objects. [VERIFIED: local command audit]

**Why it happens:** Empty CommonJS entry files are syntactically loadable. [VERIFIED: local command audit]

**How to avoid:** Assert meaningful exports and metadata, not just "does not throw". [ASSUMED]

**Warning signs:** Smoke output reports `{ "keys": [] }` for either package. [VERIFIED: local command audit]

### Pitfall 4: CLI Probes Accidentally Depend on Global Installs

**What goes wrong:** `cds` and `n8n-node` were not available as global commands locally, so plans that call them directly will fail on fresh machines. [VERIFIED: local command audit]

**Why it happens:** README-style commands often assume globally installed CLIs. [VERIFIED: .planning/codebase/CONCERNS.md]

**How to avoid:** Add local dev dependencies and call scripts through npm workspaces. [CITED: https://docs.npmjs.com/cli/using-npm/workspaces/]

**Warning signs:** Commands pass on one developer machine but fail with "command not found" elsewhere. [ASSUMED]

### Pitfall 5: Live n8n Smoke Depends on Running Container

**What goes wrong:** `npm run n8n:import` fails when the `n8n` Compose service is not running. [VERIFIED: local command audit]

**Why it happens:** Current import/export scripts use `docker compose exec n8n`, which requires a running service. [VERIFIED: package.json]

**How to avoid:** Keep package-load smoke independent of live Docker; add a separate `smoke:n8n` that starts/checks the service when needed. [ASSUMED]

**Warning signs:** Smoke command fails with `service "n8n" is not running`. [VERIFIED: local command audit]

## Code Examples

### CAP Plugin `package.json` Target

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

Source basis: npm package `main`, `exports`, `files`, and `engines` docs; CAP plugin auto-discovery docs; current local package name and service code. [CITED: https://docs.npmjs.com/files/package.json/] [CITED: https://cap.cloud.sap/docs/node.js/cds-plugins] [VERIFIED: codebase grep]

### n8n Node `package.json` Minimum

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

Source basis: n8n community-node package standards and `n8n-node` CLI docs. Exact package name is recommended but not user-confirmed. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/] [ASSUMED]

### Root Scripts Target

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

Source basis: current root scripts, npm workspace scripts, CAP start behavior, and Docker Compose command usage. [VERIFIED: package.json] [CITED: https://docs.npmjs.com/cli/using-npm/workspaces/] [CITED: https://cap.cloud.sap/docs/node.js/cds-server]

## State of the Art

| Old Approach | Current Approach | When Changed / Verified | Impact |
|--------------|------------------|--------------------------|--------|
| Empty package entries that merely load | Package entries that export meaningful public API/metadata | Verified current empty entries on 2026-05-28 | Smoke tests must assert exports and n8n manifest entries, not just load success. [VERIFIED: local command audit] |
| Global CAP CLI assumptions | Local `@sap/cds-dk` dev dependency and npm scripts | Verified local `cds` missing on 2026-05-28 | Fresh developer machines and CI should not need undocumented global installs. [VERIFIED: local command audit] |
| Floating `n8nio/n8n:latest` | Pinned `n8nio/n8n:2.22.5` or digest | Verified registry current n8n `2.22.5` on 2026-05-28 | Local n8n behavior becomes more repeatable. [VERIFIED: npm registry] |
| Legacy Jest-oriented CAP tests | Vitest with `cds.test()` | CAP docs currently recommend Vitest | Use integration/smoke tests compatible with CAP's current test guidance. [CITED: https://cap.cloud.sap/docs/node.js/cds-test] |
| Manual n8n node package conventions | `@n8n/node-cli` scaffold/build/lint/dev | n8n docs currently recommend official CLI | Reduces risk of package shape rejection by n8n conventions. [CITED: https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/] |

**Deprecated/outdated:**
- `n8nio/n8n:latest` in local Compose is inappropriate for requirement `FOUND-05` because it allows unplanned runtime drift. [VERIFIED: docker-compose.yml]
- Placeholder `test` scripts that exit `1` are incompatible with `FOUND-04`. [VERIFIED: local command audit]
- Direct demo binding to `../cap-n8n-plugin/lib/N8nWorkflowService.js` is a bridge only; Phase 1 should prefer package-level consumption where safe. [VERIFIED: demo-app/package.json] [VERIFIED: .planning/phases/01-package-foundations-and-tooling/01-CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Keep license as `ISC` unless the user chooses a different license. | Package Metadata Target State | Legal/publishing mismatch if maintainers expect MIT or another license. |
| A2 | Use `n8n-nodes-sap-cap` as the npm package name while retaining folder `cap-n8n-node/`. | Package Metadata Target State | Package rename may conflict with user branding or future npm availability. |
| A3 | Add `typescript` manually only if the `@n8n/node-cli` scaffold does not add it. | Standard Stack | Duplicate or missing compiler dependency if scaffold behavior differs. |
| A4 | Regenerate the nested demo lockfile or remove it by explicit plan decision. | Common Pitfalls | Lockfile churn or install inconsistency if nested lockfile policy is unclear. |
| A5 | Separate package-load smoke from live n8n smoke. | Common Pitfalls | Phase gate may be weaker than expected if reviewers require Docker n8n in the same command. |
| A6 | Folder/package-name confusion is the likely reason the current n8n workspace name does not follow n8n community-node naming. | Common Pitfalls | Root cause may be intentional branding, not accidental mismatch. |
| A7 | Meaningful smoke assertions should check exports and metadata rather than load success only. | Common Pitfalls | Planner may choose a different smoke threshold. |
| A8 | Direct global CLI commands are likely to fail across machines if not routed through local npm scripts. | Common Pitfalls | Some target environments may provide global CLIs intentionally. |
| A9 | Package metadata/script validation is sufficient V5 input-validation scope for Phase 1. | Security Domain | Security reviewer may require additional manifest-schema validation. |

## Open Questions

1. **What exact public npm name should the n8n node use?**
   - What we know: n8n community-node package names must start with `n8n-nodes-` or `@scope/n8n-nodes-`. [CITED: https://docs.n8n.io/integrations/community-nodes/build-community-nodes/]
   - What's unclear: Whether maintainers want `n8n-nodes-sap-cap`, a scoped package, or a temporary private workspace name. [ASSUMED]
   - Recommendation: Plan a checkpoint before renaming `cap-n8n-node/package.json` `name`; use `n8n-nodes-sap-cap` as the default implementation target. [ASSUMED]

2. **Should the nested `demo-app/package-lock.json` remain?**
   - What we know: Root workspaces already have a root lockfile, and codebase concerns found metadata drift between root and demo lockfiles. [VERIFIED: .planning/codebase/CONCERNS.md]
   - What's unclear: Whether the team intentionally wants demo-app to remain independently installable. [ASSUMED]
   - Recommendation: Planner should include a lockfile policy task before regenerating lockfiles. [ASSUMED]

3. **Should Phase 1 require live Docker n8n in the phase gate?**
   - What we know: `FOUND-04` only requires package loadability smoke; `FOUND-05` requires pinned infrastructure; `VERIFY-05` is Phase 8. [VERIFIED: .planning/REQUIREMENTS.md]
   - What's unclear: Whether reviewers expect live n8n import smoke during Phase 1. [ASSUMED]
   - Recommendation: Make package-load smoke mandatory and live Docker n8n smoke optional/non-blocking in Phase 1. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | npm workspace scripts, CAP plugin, n8n node tooling | yes | `v24.16.0` | None needed. [VERIFIED: local command audit] |
| npm | workspace install/scripts | yes | `11.13.0` | None needed. [VERIFIED: local command audit] |
| Docker Engine | local n8n Compose service | yes | `29.5.2` | None needed for Docker smoke; package smoke can run without Docker. [VERIFIED: local command audit] |
| Docker Compose | local n8n Compose service | yes | `v5.1.4` | None needed for Docker smoke; package smoke can run without Docker. [VERIFIED: local command audit] |
| CAP `cds` CLI | CAP build/serve scripts | no global CLI | unavailable globally | Add `@sap/cds-dk` as local dev dependency and call through npm scripts. [VERIFIED: local command audit] [CITED: https://cap.cloud.sap/docs/node.js/cds-server] |
| `n8n-node` CLI | n8n community-node build/lint/dev | no global CLI | unavailable globally | Add `@n8n/node-cli` as local dev dependency and call through npm scripts. [VERIFIED: local command audit] [CITED: https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/] |
| n8n Compose service | workflow import/export scripts | service not running | image currently `latest` in config | Add `n8n:up`; keep package smoke independent from service state. [VERIFIED: local command audit] |

**Missing dependencies with no fallback:** none for package-load smoke. [VERIFIED: local command audit]

**Missing dependencies with fallback:** global `cds`, global `n8n-node`, and running n8n service; all should be handled through local dev dependencies or separate service-start scripts. [VERIFIED: local command audit]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no for Phase 1 runtime behavior | Do not implement credential/auth modes in Phase 1; keep secrets in env/config only. [VERIFIED: .planning/REQUIREMENTS.md] [VERIFIED: AGENTS.md] |
| V3 Session Management | no | No session behavior is in Phase 1. [VERIFIED: .planning/ROADMAP.md] |
| V4 Access Control | no | No protected runtime endpoint behavior is in Phase 1. [VERIFIED: .planning/ROADMAP.md] |
| V5 Input Validation | yes for package metadata/scripts | Validate package metadata and scripts through smoke/build commands, not user-input validators. [ASSUMED] |
| V6 Cryptography | yes for secrets handling boundaries | Do not commit API keys/private keys; do not add real credentials to fixtures. [VERIFIED: AGENTS.md] |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Dependency confusion / slopsquatting | Tampering | Use official docs for package discovery, npm registry verification, slopcheck, and human verification for `vitest` before install. [VERIFIED: slopcheck] |
| Secret leakage in fixtures/docs | Information Disclosure | Keep `.env` ignored and do not commit API keys or real production credentials. [VERIFIED: AGENTS.md] |
| Floating infrastructure images | Tampering | Pin n8n image tag or digest. [CITED: https://docs.docker.com/dhi/core-concepts/digests/] |
| Over-broad package files | Information Disclosure | Use package `files` allowlists for publishable packages. [CITED: https://docs.npmjs.com/files/package.json/] |

## Verification Commands

Run these after Phase 1 implementation:

```bash
node --version
npm --version
npm install
npm run build --workspaces --if-present
npm run smoke
npm test --workspaces --if-present
npm pack --workspace cap-n8n-plugin --dry-run
npm pack --workspace cap-n8n-node --dry-run
docker compose config
docker compose pull n8n
```

Optional live n8n smoke if Docker service is expected in the phase gate:

```bash
npm run n8n:up
npm run n8n:import
```

Expected current baseline before implementation: `npm test --workspaces --if-present` fails because both package test scripts intentionally exit `1`; `npm run n8n:import` fails when the n8n service is stopped; requiring both package folders returns empty exports. [VERIFIED: local command audit]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/01-package-foundations-and-tooling/01-CONTEXT.md` - locked scope, exclusions, GitHub issue constraints, and Phase 1 decisions.
- `.planning/REQUIREMENTS.md` - `FOUND-01` through `FOUND-05` and `NODE-01`.
- `.planning/ROADMAP.md` - Phase 1 goal and success criteria.
- `AGENTS.md` - project constraints and conventions.
- `package.json`, `package-lock.json`, `docker-compose.yml`, package manifests, and package entry files - current implementation state.
- SAP CAP docs: `https://cap.cloud.sap/docs/node.js/cds-plugins`, `https://cap.cloud.sap/docs/node.js/cds-server`, `https://cap.cloud.sap/docs/node.js/cds-test`.
- n8n docs: `https://docs.n8n.io/integrations/community-nodes/build-community-nodes/`, `https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/`, `https://docs.n8n.io/integrations/creating-nodes/build/reference/node-file-structure/`, `https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/`.
- npm registry metadata checked on 2026-05-28 for `@sap/cds`, `@sap/cds-dk`, `@cap-js/sqlite`, `vitest`, `@n8n/node-cli`, `n8n`, `n8n-workflow`, and `typescript`.

### Secondary (MEDIUM confidence)

- npm docs: `https://docs.npmjs.com/cli/using-npm/workspaces/` and `https://docs.npmjs.com/files/package.json/`.
- Docker docs: `https://docs.docker.com/dhi/core-concepts/digests/`.
- npm downloads API checked on 2026-05-28 for package download volumes.

### Tertiary (LOW confidence)

- Assumptions in this file about exact package name, license policy, nested lockfile policy, and optional live Docker smoke gate.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions were checked through npm registry and local command probes; `vitest` is flagged for human verification because slopcheck reported SUS.
- Architecture: HIGH - package boundaries and current empty entries were verified in the local repo, and CAP/n8n package conventions were checked against official docs.
- Pitfalls: HIGH - current baseline failures were reproduced locally; n8n name/package-shape risk is documented by official n8n docs.

**Research date:** 2026-05-28
**Valid until:** 2026-06-04 for n8n/tooling versions; 2026-06-27 for CAP/npm packaging guidance.
