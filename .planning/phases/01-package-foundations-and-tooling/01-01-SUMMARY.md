---
phase: 01-package-foundations-and-tooling
plan: 01
subsystem: packaging
tags: [npm, commonjs, sap-cap, package-boundary]

requires: []
provides:
  - cap-n8n-plugin public CommonJS export for N8nWorkflowService
  - cap-n8n-plugin package metadata for Node, CAP peer, exports, and publish files
  - demo app n8n service binding through the package service subpath
affects: [phase-01, cap-n8n-plugin, demo-app]

tech-stack:
  added: []
  patterns:
    - CommonJS package entry exports public service classes
    - npm exports map exposes both package root and service implementation subpath

key-files:
  created:
    - .planning/phases/01-package-foundations-and-tooling/01-01-SUMMARY.md
  modified:
    - cap-n8n-plugin/index.js
    - cap-n8n-plugin/package.json
    - demo-app/package.json

key-decisions:
  - "Expose N8nWorkflowService from the package root while keeping the implementation class in lib/N8nWorkflowService.js."
  - "Expose ./service as a public package subpath so CAP impl binding no longer needs a relative internal file path."
  - "Leave package-lock.json untouched because this executor was explicitly restricted from editing lockfiles."

patterns-established:
  - "Package consumers should use require('cap-n8n-plugin').N8nWorkflowService for programmatic access."
  - "CAP service bindings may target cap-n8n-plugin/service instead of ../cap-n8n-plugin/lib/N8nWorkflowService.js."

requirements-completed: [FOUND-01, FOUND-02]

duration: 12min
completed: 2026-05-31
---

# Phase 01 Plan 01: Package Boundary Summary

**CAP plugin package boundary with a public N8nWorkflowService export and package-owned service subpath**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-31T12:01:00Z
- **Completed:** 2026-05-31T12:13:13Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added a CommonJS package entry that exports `N8nWorkflowService`.
- Added `description`, `keywords`, `engines.node`, `peerDependencies.@sap/cds`, `files`, and `exports` metadata to `cap-n8n-plugin/package.json`.
- Added the public `cap-n8n-plugin/service` export and updated the demo app `cds.requires.n8n.impl` binding to use it.
- Preserved the demo app n8n `baseUrl`, env-backed `apiKey`, workspace dependency, and server port.

## Task Commits

No commits were created. The user explicitly requested that this parallel executor leave changes unstaged and uncommitted.

## Files Created/Modified

- `cap-n8n-plugin/index.js` - Public CommonJS export surface for `N8nWorkflowService`.
- `cap-n8n-plugin/package.json` - Package metadata, publish allowlist, Node/CAP compatibility, and export map.
- `demo-app/package.json` - Demo n8n service binding through `cap-n8n-plugin/service`.
- `.planning/phases/01-package-foundations-and-tooling/01-01-SUMMARY.md` - Execution summary.

## Decisions Made

- Added `exports["./service"]` because CAP `impl` binding needs a direct service implementation target while the package root returns an object.
- Kept `license: "ISC"` because no project-wide replacement license decision was present.
- Did not update lockfiles because `package-lock.json` and `demo-app/package-lock.json` are outside this executor's owned write set.

## Deviations from Plan

### Auto-fixed Issues

None.

### Execution-Protocol Deviations

- Per explicit user instruction, skipped per-task commits, staging, STATE.md updates, ROADMAP.md updates, and final metadata commit.
- The exact Task 1 verification command could not run in the initial repo state because no `node_modules` directory exists and `@sap/cds` is unavailable to Node resolution. A mocked `@sap/cds` load check was run instead to verify the CommonJS export identity without changing dependency files.

## Issues Encountered

- `npm ci --ignore-scripts` failed before installing dependencies because the current root `package.json` and `package-lock.json` are already out of sync for `@sap/cds-dk`. Those files are outside this plan's write set, so no lockfile repair was attempted.
- Existing concurrent changes were observed in `package.json`, `docker-compose.yml`, and `.planning/phases/01-package-foundations-and-tooling/01-03-SUMMARY.md`; this executor did not modify or revert them.

## Verification

- `node -e "const Module=require('module'); ... require('./cap-n8n-plugin') ..."` - PASS with mocked `@sap/cds`; verified `plugin.N8nWorkflowService === require('./cap-n8n-plugin/lib/N8nWorkflowService.js')`.
- `node -e "const p=require('./cap-n8n-plugin/package.json'); if(!p.exports['.']||!p.exports['./service']||!p.peerDependencies['@sap/cds']||!p.engines.node||!p.files.includes('cds-plugin.js')) process.exit(1)"` - PASS.
- `node -e "const p=require('./demo-app/package.json'); if(!p.dependencies['cap-n8n-plugin']||!p.cds.requires.n8n.impl) process.exit(1); if(!p.cds.requires.n8n.credentials.baseUrl) process.exit(1); if(p.cds.requires.n8n.impl !== 'cap-n8n-plugin/service') process.exit(1)"` - PASS.
- `$env:NODE_PATH=(Get-Location).Path; node -e "console.log(require.resolve('cap-n8n-plugin/service'))"` - PASS; resolved to `cap-n8n-plugin/lib/N8nWorkflowService.js`.
- `npm pack --workspace cap-n8n-plugin --dry-run` - PASS; dry-run tarball contained `index.js`, `cds-plugin.js`, `lib/N8nWorkflowService.js`, and `package.json`.
- Original exact Task 1 command - BLOCKED by missing `@sap/cds` install state.
- `npm ci --ignore-scripts` - BLOCKED by pre-existing package/lock mismatch for `@sap/cds-dk`.

## Known Stubs

- `cap-n8n-plugin/package.json` retains the existing placeholder `scripts.test` command (`Error: no test specified`). This does not block Plan 01-01 package-boundary goals; the phase plan set assigns non-failing package test scripts to later tooling/smoke work.

## Threat Flags

None.

## Self-Check: PASSED

- Created summary file exists.
- Modified files are limited to the assigned plan files plus this summary.
- No package-lock, root package, n8n node, Docker, or unrelated planning files were edited by this executor.

## Next Phase Readiness

Plan 04 smoke coverage can now assert package-level CAP plugin consumption through the root export and `cap-n8n-plugin/service`. Lockfile refresh remains necessary in the appropriate tooling plan because this executor was not allowed to edit lockfiles.

---
*Phase: 01-package-foundations-and-tooling*
*Completed: 2026-05-31*
