# Instructions for AI agents and collaborators

**Codex entry point:** When Codex is working inside this checked-out repository, this root `AGENTS.md` is its navigation contract. **Every content task must begin by reading** `README.md`, `STUDIO/decisions.md`, the relevant `SHOWS/<account>/README.md`, the episode brief (if any), and the stage-specific documents below. State which sources were actually read and the current production stage. Never rely on remembered snippets or silently claim a file was consulted. **Do not dump the entire `ARCHIVE/` into prompts.**

**Mandatory routing:**
- **Episode ideas / commissioning:** read `STUDIO/audience-research.md`, `STUDIO/editorial-workflow.md`, the relevant account brief, and `STUDIO/strategy.md` when buyer fit is relevant. Clear the **Audience Value Gate** *before* drafting a script.
- **True-story research:** also read `RESEARCH/source-register.md`, verify the originals and log claims/uncertainty.
- **Story architecture, scripts, edits:** read `STUDIO/creative-os.md`, `STUDIO/editorial-workflow.md`, `TEMPLATES/episode-brief.md`, the account and episode briefs. Also read `STUDIO/writing/README.md` and every module required by its task-routing table; full scripts and substantive rewrites require all five craft modules plus `STUDIO/writing/testing.md`, and the evidence review conclusions/limits on the first relevant task in a revision session. Separate research findings, platform guidance and editorial hypotheses; do not claim a dopamine-maximizing formula. **Develop the complete story, then a complete script, then a separate editorial review before founder script approval.** A 15–30-second animation proof is an *extract*, not a substitute for a full episode.
- **Character/image generation:** also read the applicable show style guide, prompts, real-person dossier, and reference asset index; for The Setup these are in `SHOWS/psychology/`.
- **Production:** read `STUDIO/production.md` and only generate assets for understood story/shot requirements.

**Important:** A source-of-truth link or a previous ChatGPT discussion does *not* prove the file was loaded. Identify gaps; do not silently improvise.

## Source-of-truth priority

1. Current user instruction for the specific task.
2. `README.md` and dated **LOCKED** entries in `STUDIO/decisions.md`.
3. Relevant account mini-bible and active pilot brief.
4. Active `STUDIO/*.md` playbooks.
5. `ARCHIVE/` (historical, may be superseded).

Do not silently promote a brainstorm, a price example, a style reference, or a hypothetical persona to a validated business fact. Record contradictions and ask once if they affect the deliverable.

## Creative working rules

- Script around one central dramatic promise, not a bag of techniques.
- Study the ICP's full emotional world, including loss, pride, fear, grievance, aspiration and perceived antagonists. Use perspective-faithful language; do not treat unverified accusations as established facts.
- Ground the story with plausible, specific actions, objects, people, places and cultural references. Do not force names or references into every line.
- **Instagram clarity:** default to familiar words and connected speech that a distracted first-time listener understands immediately. Preserve connective language; short fragments are not automatically clearer. Use `STUDIO/writing/narration.md` and repair actual comprehension problems before delivery.
- Natural dialogue can include fragments, associative leaps, silence, juxtaposition and abrupt edits; use them only if they serve the point and remain understandable.
- SHOW when an action conveys the meaning better; TELL when narration clearly saves time or adds comprehension.
- Audit the *whole* script for one coherent throughline. Cut even a great line if it doesn't belong.
- Distinguish documented fact, illustration, opinion, dramatization, and metaphysical/interpretive claim.
- Do not fabricate interviews, research findings, historical quotations, conversion rates, or source details.
- For safety scenarios, verify advice with current credible emergency guidance; never reward a dangerous action as if it were generally safe.
- Treat true tragedies, religious differences and identifiable people seriously; dramatize without manufacturing victim dialogue.

## What outputs should look like

For a pilot script, deliver: `1-sentence promise`, `episode beat sheet`, `30-90s script or justified length`, `visual/shot table`, `source notes/unknowns`, `asset list`, `one optional cut suggestion`. Do not always force 5 beats, 7 hooks, a villain, or a cliffhanger.

For research, deliver: verified source links, supported facts, contested/unknown facts, 2-3 credible angle options, ICP-to-offer relationship, and reason to test or reject.

For production, deliver the minimum viable editable asset plan, work-time estimate labeled as assumption until measured, budget guardrail, and measurable acceptance criteria.

## The Setup visual generation rule

For every character in **The Setup**, use the approved visual direction and reference-driven workflow recorded in [`SHOWS/psychology/the-setup-style-guide.md`](SHOWS/psychology/the-setup-style-guide.md), [`the-setup-base-prompt.md`](SHOWS/psychology/the-setup-base-prompt.md) and [`the-setup-negative-prompt.md`](SHOWS/psychology/the-setup-negative-prompt.md). For Oobah, see [`oobah-butler-character-dossier.md`](SHOWS/psychology/oobah-butler-character-dossier.md); create a similarly brief dossier for each new identifiable real person. Style screenshots are **style-only**; actual photos are **identity-only**. Do not infer a face from the TV show, recycle rejected sheets, create a visible narrator, or declare a candidate approved because it rendered successfully. Compare actual results to reference images; reject excessive detailing, poor likeness or turnarounds with inconsistent faces. Save exact job IDs/reference links and user approval status. GitHub is the operating memory; Higgsfield is a generation tool, not the source of truth. Avoid costly retries without changing the failure mode.

## Operating principles

Eight founder-hours a week total. Web design remains the cash business. Prefer fewer excellent pilots to template sludge. Pilot output is an input measure; audience response determines whether to continue; purchases decide commercial value. Avoid building products/funnels/accounts endlessly before content tests.

No external publishing, account mutations, purchases, contractor hiring or repo changes outside the approved scope without explicit approval.