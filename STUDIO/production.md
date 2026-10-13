# Production, look tests, and distribution

## Production hypothesis (NOT validated)

Start with a **hybrid illustrated/motion-comic workflow**. Consistent character references and reusable backgrounds; controlled movement, camera pans, narration, captions and sound; selectively use generated full-motion/performance shots only when a scene benefits. Visual quality and viewer comprehension beat showcase animation.

Reference alternatives we discussed: generative-video systems, AI assistants inside editing systems, and editable/programmatic video tools such as Runway, Seedance/Higgsfield, Remotion. **None is a required stack or proven cheapest option.** Confirm current capabilities and prices before buying.

## Selected visual directions for first style test

Psychology:
- **A:** original mature cel-shaded adult spy/crime cartoon, crisp character design, subtle noir, conversational performance. Broad inspiration: adult animated spy shows such as Archer.
- **B:** original simple expressive explanatory cartoon, flatter colors, readable visual gags, low-complexity movement. Broad inspiration: OverSimplified.

Survival:
- **A:** mostly white canvas, thin black stick figures, sparse props, tiny accent colors, strong movement and situational diagrams. Inspired by minimalist stick-figure web animation.
- **B:** original flat-cutout adult-cartoon recurring cast with personality, facial comedy and simple movable parts. Broad inspiration: South Park's limited animation, not its characters or plots.

Christian Character:
- **A:** ordinary warm, grounded adult family cartoon. Simple shapes, expressive but understated father and son, plausible home settings. Broad inspiration: King of the Hill / F Is for Family.
- **B:** serious, clean cel-shaded adult drama, realistic enough for courage and historical parables, with heroic framing but sustainable reuse. Broad inspiration: Young Justice / Invincible.

These are *aesthetic references*, not requests to reproduce copyrighted characters or signature frames. `VISUAL-REFERENCES/` contains compressed original concept images for discussion; they are not final assets or consistent character sheets.

## Selected The Setup generation method (working practice, 2026-10-13)

- **GitHub = operating source of truth**, Higgsfield = one available live generation workspace. Tool and model choice are not a permanent lock.
- For **The Setup**, always follow [`SHOWS/psychology/the-setup-style-guide.md`](../SHOWS/psychology/the-setup-style-guide.md), [`the-setup-base-prompt.md`](../SHOWS/psychology/the-setup-base-prompt.md), [`the-setup-negative-prompt.md`](../SHOWS/psychology/the-setup-negative-prompt.md) and character-specific dossiers.
- **Separate references:** user-supplied animated TV frame screenshots specify only visual grammar; photographs of the **actual real person** specify identity. Every new character must have real identity references and the same reusable style inputs. No generic recurring presenter or invented facial archetypes.
- **Real result over aspirational prompt:** visually inspect a candidate next to source frames before acceptance. Favor sparse black contours, flat fills, limited angular cel-shadows and likeness. Don't turn “premium” into over-rendered concept art. Record tool/model, exact references/job ID, founder time, credit cost and **approved vs candidate** status.
- Current Oobah candidate from Higgsfield Seedream 5 Lite improved substantially with two real-person photo references. It was only rated **“much better”**, not accepted as final. See dossier. Do not assume one successful result proves consistency across scenes.

## Bake-off before full production

1. **First lock character-image quality within chosen The Setup Style A**, then approve a **single** 15–30-second scene for continuity and efficiency testing.
2. Make the chosen Style A scene as a rough but credible production proof. A matched Psychology Style B version is an **optional subsequent comparison**, not a prerequisite for creating/approving the Style A characters.
3. Time total active founder minutes (single timer), capture tool credit cost, note number of rerolls, and review creative appeal / emotional clarity / continuity / repeatability.
4. Select a baseline method or revise the hypothesis. Do not generate a full 2-styles x 6-formats x 2-episodes factorial matrix. Those combinations would be expensive and uninformative at this stage.
5. When this workflow works, produce the remaining first episodes and second distinct executions of each format, publishing and measuring actual reactions.

## Episode asset plan

Script and research -> shot/beat list -> rough animatic -> reusable characters/settings/props -> generated stills/camera treatment -> narration/dialogue -> sound -> edit -> caption/QA -> publish -> log. A simple shot may need only one still image plus pan/crop or a match cut. Full generated motion is Tier C, not the default.

- **Tier A:** flat shapes, illustrated stills, pans/zooms, prop layers, diagrams, captions; default production.
- **Tier B:** limited expressions, character poses or short controlled performance/lip movement.
- **Tier C:** generative video / complex action / highly atmospheric scene; only when the narrative pays for it.

Before long productions, establish a mini style bible: reference sheet, 1-2 settings, voice direction, caption font, scene lighting, recurring props. Don't make a giant world bible for a losing pilot.

## Two distribution experiments

- **Native short:** self-contained vertical story, 30-90 seconds as a starting design range; adjust length to content.
- **Modular story:** one coherent 3-5-minute story with designed internal hooks, mini-payoffs and transitions; publish parts on Reels/Shorts/TikTok and full version on YouTube when suitable. The long-form-first method is **not yet validated** and may cost too much early on.

A platform's specific length, disclosure, monetization, reuse and music rules must be checked before publishing. Clearly distinguish fictional/AI-recreated scenes from authentic historical footage or evidence, particularly when realistic.

## Final on-phone gate

First 3 seconds muted; check legibility and hook. Watch with audio; does action change, voices sound human, story pay off? Jump in at midpoint; can a newcomer follow? Check names/dates/sources, captions, safe practices, AI continuity, release rights and technical export. Stop if severe misleading or safety issue.