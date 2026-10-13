# Codex studio workspace MVP — PROPOSAL, not approved implementation
**Proposed 2026-10-13.** Motivation: manage multiple accounts, stories, ICPs, research sources, scripts, style assets, generations and editorial stages without relying on chat memory or manually recreating prompts.

## Working principle
Build **on this existing repo** (`RabbitHoleStudios`), not a second knowledge base. Git-tracked Markdown/source files remain the long-term record; Codex can work inside the checked-out repository and load root `AGENTS.md` automatically in supported Codex environments. This improves instruction routing but **does not guarantee** that deeper documents are consulted without clear routing and verification. GitHub is the truth; the UI is a view/editor of it, not a competing database.

## Proposed thin vertical-slice MVP
- **Accounts:** Psychology, Survival, Christian. One landing page shows active shows, current episodes and stages, not fabricated performance stats.
- **Episode workspace:** select account → show → episode; see current stage, **ICP/value gate**, research notes/source links, alternative story treatment, complete script versions, editorial notes, approval state, shot plan and asset list.
- **Reference library:** searchable/filterable links and local paths for style vs identity vs environment/prop reference assets; show which is approved/candidate/rejected and the actual generation job URL/model/credits when known. Never pretend remote URLs are licensed or durable binaries.
- **Workflow actions:** clearly expose six editorial tasks: audience alignment → research → story treatment → full script → independent critique → source check/approval → storyboard. For the MVP, actions can generate an exact **Codex task instruction/context packet** and produce Markdown artifacts; no need for background worker orchestration or an LLM-powered web backend initially.
- **Approvals:** explicit human approval controls for premise, script, visual character references and final output. Generation success does not imply acceptance.
- **One real vertical-slice fixture:** `PSY-A-01` The Shed at Dulwich. It should correctly load `STUDIO/audience-research.md`, `STUDIO/creative-os.md`, the show mini-bible, pilot brief and visual style pack without duplicating their text.

## Minimal technical posture (choose during build, not locked now)
A small **local-first single-user interface** built by Codex (simple React/Next.js or comparable), reading/editing Markdown and a tiny file index/manifest in the repository. No external database at MVP scale; no auth if truly local; remote hosting needs separate access controls. Prefer relative repo paths as canonical IDs. Add automated basic checks for broken references, missing required stage files and invalid approval transitions, but don't pretend software can score story quality.

## Explicitly NOT in v0
Autonomous multi-agent loops; vector database/RAG service; new SaaS back end; billing; posting to social networks; analytics ingestion; paid subscriptions; Higgsfield API job submission/integration; full-video editing/rendering; a second global CMS; scrapers; forced multi-stage agent prompts on every action.

## Definition of done
1. Open the existing repo in Codex; agent reads root `AGENTS.md` and follows the reference routing before editing.
2. View all 3 accounts and select Psychology → The Setup → PSY-A-01.
3. App shows the audience-value gate and linked source files, and distinguishes `candidate` from `approved` assets.
4. Create/edit a complete episode brief and stage-specific docs **as files in the same repo**, with diff and commit review.
5. A repeat session or different task reopens the saved project and finds the files and current stage **without user retelling the history**.
6. No generated script becomes approved or transitions to storyboard automatically.

## Sequence
**Now:** fix repo editorial governance and first audience-value gate → **then:** ask Codex to build only the vertical slice above → **then:** run an actual Oobah research-to-full-script episode through it and measure whether it prevented the mistakes. Expand features only if the user actually needs them.

**Potential alternative:** If a UI doesn't solve a real bottleneck, start even leaner: Codex + repo docs + scripts for task preparation, and postpone the interface. The user can choose after seeing this spec.

## Usage guardrails
- Eight founder-hours per week cap still applies to studio work. Avoid building the control panel instead of publishing.
- Use role-specific source references; never pull a 50-section archive for every task.
- Mark audience fit and buyer overlap as **hypotheses**, not validated demand.
- Respect source copyright and image licenses; links/media IDs are not permissions.
- Keep user-facing creative approvals with the founder, not the agent.
