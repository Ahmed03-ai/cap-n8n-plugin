# Phase 8: Deployment, Docs, and Release Readiness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-03T22:33:35+02:00
**Phase:** 08-deployment-docs-and-release-readiness
**Areas discussed:** Real n8n custom-node E2E, Cancellation visual showcase, Documentation and environment setup, BTP and cloud deployment guidance, Traceability and review readiness, Smoke/CI/release evidence

---

## Real n8n Custom-Node E2E

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How should Phase 8 make the SAP CAP node available in real n8n? | Docker override mount/install | Use a repo-owned Docker override/helper path so real n8n loads the local `cap-n8n-node` package. | Yes |
| How should Phase 8 make the SAP CAP node available in real n8n? | Manual install guide only | Document manual installation without repo-owned helper support. | |
| How should Phase 8 make the SAP CAP node available in real n8n? | CI-style automated E2E harness | Build automation first around real n8n. | |
| How much should the E2E be automated vs manual once that harness exists? | Scripted setup plus manual browser checklist | Required setup scripts/docs with reviewer-driven n8n browser checks. | Yes |
| How much should the E2E be automated vs manual once that harness exists? | Mostly manual runbook | Keep setup and verification mostly manual. | |
| How much should the E2E be automated vs manual once that harness exists? | Playwright/browser automation now | Automate n8n editor checks in Phase 8. | |
| What should the real n8n E2E checklist prove? | Full node surface | Node appears, Test Connection works, metadata loads, and Query/Read/Create/Update/Delete/Action-Function execute. | Yes |
| What should the real n8n E2E checklist prove? | Core read path first | Only prove credentials, metadata, Query, and Read. | |
| What should the real n8n E2E checklist prove? | Smoke only | Only prove the node loads in n8n. | |
| How should the E2E harness handle local state and credentials? | Ephemeral review profile | Use runtime/operator-provided local credentials and keep all real secrets out of files. | Yes |
| How should the E2E harness handle local state and credentials? | Persistent local profile | Reuse a persistent n8n profile. | |
| How should the E2E harness handle local state and credentials? | Preseed as much as possible | Seed more credentials/workflows automatically. | |

**User's choice:** Docker override/helper path, scripted setup plus manual browser checklist, full node surface, ephemeral review profile.
**Notes:** User considered Playwright but chose the scripted/manual path, with Playwright kept in mind as a later stretch. A local non-production login may be supplied during execution but must not be committed or written into artifacts.

---

## Cancellation Visual Showcase

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| What should Phase 8 build for the visual cancellation proof? | Dedicated stoppable demo workflow | Create a separate cancellation fixture designed for long-running/stoppable behavior. | Yes |
| What should Phase 8 build for the visual cancellation proof? | Extend existing CAP n8n Test workflow | Add cancellation behavior to the current happy-path fixture. | |
| What should Phase 8 build for the visual cancellation proof? | Docs-only cancellation walkthrough | Document the idea without a committed fixture. | |
| What should be the primary cancellation evidence? | Browser-first visual proof | Lead with n8n UI state plus CAP/demo app actions. | Yes |
| What should be the primary cancellation evidence? | Command-first proof | Lead with npm/curl output and make browser checks optional. | |
| What should be the primary cancellation evidence? | Both browser and command proof | Full UI walkthrough plus full command transcript. | |
| How strict should the real cancellation behavior be for Phase 8? | Real stop path required | Prove a running n8n execution can be cancelled through CAP/plugin integration. | Yes |
| How strict should the real cancellation behavior be for Phase 8? | Best-effort stop path accepted | Document expected behavior even if local n8n limits full proof. | |
| How strict should the real cancellation behavior be for Phase 8? | Manual n8n UI cancellation accepted | Start from CAP but cancel directly in n8n UI. | |
| How should Phase 8 handle n8n cancellation configuration in committed docs and examples? | Env placeholders | Use `.env.example` and docs with placeholders only. | Yes |
| How should Phase 8 handle n8n cancellation configuration in committed docs and examples? | Runtime prompts | Helper scripts ask for local-only values at runtime. | |
| How should Phase 8 handle n8n cancellation configuration in committed docs and examples? | Docs only | Document config without example environment variables. | |

**User's choice:** Dedicated stoppable workflow, browser-first proof, real stop path required, env placeholders.
**Notes:** User clarified that manual setup must be documented well enough to know every step required to run the cancellation proof.

---

## Documentation and Environment Setup

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| What should be the main documentation shape for Phase 8? | README as entry point, docs as deep dives | README is the front door; focused docs contain deeper setup and evidence. | Yes |
| What should be the main documentation shape for Phase 8? | README-heavy documentation | Put most setup and review details directly in README. | |
| What should be the main documentation shape for Phase 8? | Docs-only update | Keep README mostly unchanged and put details elsewhere. | |
| How should `.env.example` be structured? | Single root `.env.example` | One repo-level example grouped by workflow. | Yes |
| How should `.env.example` be structured? | Split examples by surface | Separate examples under demo app, node package, and root. | |
| How should `.env.example` be structured? | Minimal root example | Include only basic local-demo variables. | |
| Which run paths must be documented as first-class workflows? | Local, mock, real n8n, cancellation, and BTP guidance | Cover all reviewer and platform-engineer paths. | Yes |
| Which run paths must be documented as first-class workflows? | Local and real n8n only | Focus on the two most important review paths. | |
| Which run paths must be documented as first-class workflows? | Everything including CI internals | Include all paths plus CI internals in detail. | |
| How detailed should the manual setup instructions be? | Exact step-by-step runbook | Commands, terminals, URLs, expected results, cleanup, and troubleshooting. | Yes |
| How detailed should the manual setup instructions be? | Compact checklist | Short ordered steps and success markers. | |
| How detailed should the manual setup instructions be? | Reference-style docs | Explain concepts and let readers derive commands. | |

**User's choice:** README entry point with docs deep dives, single root `.env.example`, all key run paths first-class, exact step-by-step runbooks.
**Notes:** README and visual showcase docs must be included in Phase 8 planning.

---

## BTP and Cloud Deployment Guidance

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| What depth should Phase 8 target for BTP/cloud deployment? | Guidance and configuration mapping | Document BTP considerations without deployable manifests. | Yes |
| What depth should Phase 8 target for BTP/cloud deployment? | Runnable Cloud Foundry scaffold | Add initial `mta.yaml` or manifest-style deployment files. | |
| What depth should Phase 8 target for BTP/cloud deployment? | Runnable Kyma/container scaffold | Add container/Kyma deployment files. | |
| Which BTP runtime paths should the guidance cover? | Cloud Foundry and Kyma at consideration level | Cover both runtimes with routing, auth, connectivity, secrets, reachability, and caveats. | Yes |
| Which BTP runtime paths should the guidance cover? | Cloud Foundry first | Go deeper on Cloud Foundry and mention Kyma as future work. | |
| Which BTP runtime paths should the guidance cover? | Kyma first | Go deeper on Kyma and mention Cloud Foundry as future work. | |
| How should the docs handle secrets and production credentials for BTP? | Strict placeholder and secret-store guidance | Use placeholders and platform secret storage guidance only. | Yes |
| How should the docs handle secrets and production credentials for BTP? | Developer convenience examples | Include pasteable local-style env examples. | |
| How should the docs handle secrets and production credentials for BTP? | Minimal security wording | Say configure secrets securely and leave details to the operator. | |
| What should be the acceptance bar for BTP guidance? | Review-ready advisory guide | State decisions, env vars, reachability constraints, and unresolved deployment work. | Yes |
| What should be the acceptance bar for BTP guidance? | Deployment checklist only | Concise checklist with fewer explanations. | |
| What should be the acceptance bar for BTP guidance? | Architecture note only | High-level explanation without operator-facing steps. | |

**User's choice:** Advisory guidance and configuration mapping for both Cloud Foundry and Kyma, with strict placeholder/secret-store guidance and no untested deployment claims.
**Notes:** Runnable deployment scaffolding is deferred.

---

## Traceability and Review Readiness

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Where should Phase 8 put the traceability matrix? | Dedicated release-readiness doc | Map requirements/stories to evidence in a focused doc linked from README. | Yes |
| Where should Phase 8 put the traceability matrix? | README section | Put the matrix directly in README. | |
| Where should Phase 8 put the traceability matrix? | Planning artifact only | Keep traceability only under `.planning`. | |
| What should the traceability matrix map? | Requirements plus GitHub user stories | Map requirements/success criteria and relevant GitHub stories to evidence. | Yes |
| What should the traceability matrix map? | Requirements only | Map only roadmap/requirements items. | |
| What should the traceability matrix map? | User stories only | Map only GitHub issues/user stories. | |
| Should the release-readiness doc explicitly separate automated verified from manual UAT required before final closure? | Separate evidence states | Mark automated verified, browser/manual verified, or manual UAT required. | Yes |
| Should the release-readiness doc explicitly separate automated verified from manual UAT required before final closure? | Single ready/not-ready status | Use one overall status per item. | |
| Should the release-readiness doc explicitly separate automated verified from manual UAT required before final closure? | No status labels | Link evidence and let reviewers decide. | |
| How should Phase 8 handle GitHub project/user-story status updates? | Only close after evidence is documented | Move/close stories only after evidence or UAT requirement is documented. | Yes |
| How should Phase 8 handle GitHub project/user-story status updates? | Close when implementation exists | Close stories when code/docs exist even if UAT is pending. | |
| How should Phase 8 handle GitHub project/user-story status updates? | Leave GitHub status unchanged | Do not update project/story status in Phase 8. | |

**User's choice:** Dedicated release-readiness doc, map requirements plus GitHub user stories, separate evidence states, and only update GitHub statuses after evidence is documented.
**Notes:** This directly addresses the earlier concern about not closing stories before enough evidence exists.

---

## Smoke, CI, and Release Evidence

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How much automation should Phase 8 require for release readiness? | Local release command first, CI optional if low-risk | Use a reliable local command; add CI only if it is secret-free and stable. | Yes |
| How much automation should Phase 8 require for release readiness? | GitHub Actions required now | Add CI workflow files in Phase 8. | |
| How much automation should Phase 8 require for release readiness? | No new automation | Only document existing commands and manual steps. | |
| What should the local release/review command include? | Automated reliable checks only | Run checks that do not require real n8n browser login or manual credentials. | Yes |
| What should the local release/review command include? | Everything including real n8n E2E | Include Docker n8n and real browser E2E in the command. | |
| What should the local release/review command include? | Smoke tests only | Keep the command minimal and fast. | |
| How should Phase 8 record the real n8n and cancellation evidence if those remain manual/browser-first? | Manual evidence checklist in release-readiness doc | List exact evidence to capture for URLs, UI state, execution status, CAP response, cancellation, and cleanup. | Yes |
| How should Phase 8 record the real n8n and cancellation evidence if those remain manual/browser-first? | Screenshots committed to repo | Add captured screenshots to docs. | |
| How should Phase 8 record the real n8n and cancellation evidence if those remain manual/browser-first? | No evidence capture format | Provide instructions only. | |
| What should Phase 8 do with existing warnings from test/build commands? | Classify and document warnings | Fix real-defect warnings and document accepted warnings with rationale. | Yes |
| What should Phase 8 do with existing warnings from test/build commands? | Fix all warnings before completion | Treat every warning as a blocker. | |
| What should Phase 8 do with existing warnings from test/build commands? | Ignore warnings if tests pass | Do not spend Phase 8 time on warnings unless commands fail. | |

**User's choice:** Local release command first, reliable automated checks only, manual evidence checklist, classify and document warnings.
**Notes:** User asked why CI/release automation was necessary; the decision was reframed as repeatable local verification first, with CI only if low-risk.

---

## the agent's Discretion

- Exact file/script names for docs, helper commands, and Docker override support.
- Whether low-risk GitHub Actions belong in Phase 8 after planning inspects the actual command surface.
- Exact release-readiness table shape, as long as evidence states stay explicit.

## Deferred Ideas

- Playwright/browser automation for the n8n editor/runtime after the manual real-n8n harness is stable.
- Runnable Cloud Foundry or Kyma deployment scaffolding.
- Committed screenshot evidence by default.

---

*Phase: 08-deployment-docs-and-release-readiness*
*Discussion log generated: 2026-06-03T22:33:35+02:00*
