# The Setup — reusable character-generation prompt (v1)
**Use for:** Every new real-person character in The Setup. **Do not regenerate from memory alone.** Read [style guide](the-setup-style-guide.md), [negative prompt](the-setup-negative-prompt.md) and the person's dossier before generating.

## Inputs to attach for each generation
- **REAL PERSON PHOTOS** (1–3) for identity; ideally contemporaneous with the episode's events. Label explicitly **IDENTITY ONLY**.
- **THE SETUP STYLE FRAMES** (2–3 from the style guide) for rendering technique. Label explicitly **STYLE ONLY**.
- An existing **approved sheet** of that **same** person ONLY for continuity iterations; don't feed back failed character sheets that contain the wrong face/style.

## Copy/paste prompt block
> Create ONE original **[REAL PERSON NAME]** model sheet for **The Setup**, a true-story mature 2D animated TV anthology. IMAGE INPUTS LABELED IDENTITY are actual photos of the person: preserve their **specific recognizable haircut and hairline, face/head shape, nose, eyes and brows, mouth, chin, jaw, body build and authentic asymmetries**. No generic idealized beauty, spy/hero anatomy or borrowed Archer facial identity.
>
> IMAGE INPUTS LABELED STYLE are television-frame examples: reproduce **their ECONOMY OF DRAWING**, not their characters. Use smooth, confident dark-black outer contours; sparse interior facial linework; believable adult proportions; simple matte FLAT color shapes; 1–2 clean angular HARD-EDGED CEL SHADOW regions per facial plane; hair drawn in a few solid blocks and minimal highlights. The result should look like a clean frame from a mature 2D television animation production, **not** an over-rendered character illustration. Reference the provided frames visually, not the word “Archer” alone. The illustrated character must remain an original drawing of [REAL PERSON NAME], recognizable from the identity photos.
>
> **Character-specific identity constraints:** [COPY PHOTOGRAPHIC OBSERVATIONS FROM THE CURRENT CHARACTER DOSSIER: face, age/era, hair, clothing, body proportions, distinguishing features; avoid assumptions].
>
> **Sheet layout:** ONE human character only, consistent [OUTFIT], standing FRONT / THREE-QUARTER / TRUE SIDE PROFILE; below, neutral / slightly amused / skeptical expression head closeups. Maintain identical facial proportions, haircut, clothing and shape language across all views. Neutral clean background; almost no text; full body visible including shoes; no props/scene.
>
> **Failure avoidance:** [PASTE negative-prompt block from `the-setup-negative-prompt.md`]. Prioritize **(1) actual real-person likeness; (2) exact graphic simplicity / flat line-and-fill style; (3) multiple-view consistency**. **If likeness and style conflict, don't transform the person into a lookalike of an existing TV character.**

## Repeatable generation procedure
1. Read the three show style documents and the person's dossier. Confirm whether they have a relevant contemporary photo, and attach the actual files/available media references.
2. Attach at least **one identity photograph and two style frames** as distinct inputs, preserving their roles in the prompt. If the connector only has a generic image-reference role, label them unambiguously in the prompt.
3. Generate **one** sheet, then inspect the actual output next to the person photo and style frame **before** telling the user it matches.
4. Apply [QA checklist](the-setup-style-guide.md#qa-gate--required-for-each-new-character). Correct just the failing aspect; use an approved same-person sheet when refining continuity. Avoid a costly loop of undifferentiated “try again.”
5. Record model, reference IDs, job ID, approximate credits, notes, and **CANDIDATE vs APPROVED** status in the character dossier.

**Current model evidence, not a software lock:** In this Oobah test, a **Seedream 5 Lite** run with two real Oobah photos + Archer TV frames produced the closest liked output. Earlier GPT Image/Nano Banana passes repeatedly drifted to generic, over-rendered leading-man faces; a FLUX Kontext pass simplified the rendering but missed hair and view variety. Some Nano Banana jobs failed. Start future comparisons with the successful reference combination; don't assume any model guarantees likeness/consistency.

**Copyright/IP discipline:** Use style examples for broad visual grammar and create original portrayals. Do not reproduce copyrighted TV characters, frame compositions, costumes or show branding.
