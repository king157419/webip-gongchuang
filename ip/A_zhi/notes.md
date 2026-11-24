# Zhi mascot image generation notes

Tool: built-in `image_gen.imagegen`. Images are generated individually and copied into this folder under the exact requested filenames. The existing `ref_logo.png` is the identity reference for the hero; the accepted `main.png` is the character reference for every subsequent image.

## Design and brief interpretation

- Four character colors: sky blue `#4FC3F7`, cobalt `#1565C0`, navy `#1A1F5C`, cyan `#00E5FF`, with white highlights and light neutral backgrounds.
- One egg-shaped head/body, broad attached headphone discs, short thick ball-tipped antennae, stubby arms, stable rounded feet, navy pixel-face visor, cyan blush, and one chest light.
- The requested floating question mark is an expression-sheet graphic only, not a component of the printable mascot. The no-text rule is interpreted to permit this explicitly requested pictogram, while excluding typography, captions, labels, brands and watermarks.
- Images describe a printable visual concept; they do not constitute a checked 3D mesh or manufacturing file.

## main.png — attempt 1

Reference: `ref_logo.png` (existing logo; robot shape only, excluding its lettering).

Exact prompt:

```text
Use case: stylized-concept.
Asset type: main.png, the definitive hero image and design master for an original Shanghai University AI Club mascot called Zhi.

Input image 1 is a REFERENCE ONLY: the club's existing logo. Evolve the recognizable blue robot HEAD into a complete very cute designer toy mascot. Use the logo's sky-blue oval mass, two ball-tipped antennae, chunky blue headphone discs, dark rounded rectangular face screen and cyan pixel eyes. DO NOT reproduce any Chinese writing, roman letters, typography or logo lockup from the input.

Create ONE full-body character, centered, standing in a three-quarter front view. Square 1:1 image. Entire silhouette including antenna balls and feet visible, generous clean margins, plain near-white studio background, gentle contact shadow on the floor. High-quality matte soft-vinyl / resin designer-toy 3D render, softly rounded surfaces, subtle soft studio highlights, not shiny chrome. Warm, earnest, helpful university study-buddy personality.

LOCKED GEOMETRY: The head and body are ONE uninterrupted smooth upright egg/bean mass, slightly wider at the bottom; no separate head, neck, torso or waist. Body egg height about 1.15 times its width, excluding ears, antennae and feet. Two tiny rounded mitten-like arms emerge directly from the lower sidewalls, resting close to the body with broad fused roots. Exactly two short rounded sky-blue feet with flat-ish soles nestle directly under the body, no long legs, stable standing stance. Two chunky deep-cobalt cylindrical headphone discs attach directly to the upper sides, with a simple smaller cyan circular inset on each outward-facing disc; no headband. Exactly two SHORT THICK deep-cobalt sprout antennae at the crown, each a short broad nub ending in a round ball; each complete antenna is only about 15% of body height and has no slender stem. A wide deep-navy rounded-rectangle visor spans the upper front, with a shallow cobalt rim. On the visor use glowing cyan rounded PIXEL shapes: the viewer-left eye is a cute five-tile diagonal cross and the viewer-right eye is a short two-tile horizontal dash, echoing the source logo. Add one tiny cyan pixel blush tile below each eye. No mouth. Center one tiny recessed circular cyan chest-light button below the visor, flush and robust.

PALETTE ONLY: sky blue #4FC3F7 main body, arms and feet; deep cobalt #1565C0 headphones, visor rim and antennae; navy #1A1F5C face screen; cyan #00E5FF eye pixels, blush, inset circles and tiny chest light. White studio highlights are allowed; softly shaded versions of these colors only. No pink, red, yellow, green or metallic accents.

PRINT-FRIENDLY DESIGN: imagine a 6-8 cm tall FDM/resin figurine, chunky simple closed silhouette, broad joined parts and thick antennae, stubby limbs fused into the body, no fingers, no floating parts, no wires, no delicate ornaments; at most five simple assembly parts. Do not add clothing, accessories, props, a base, text, labels, logos or watermarks. Original character; avoid resemblance to famous franchise characters.
```

Status: accepted and locked as the design master on attempt 1. Visual verdict: 96/100. PNG copied without modification from the built-in tool output. No regeneration.

## turnaround.png — attempt 1

Reference: `main.png`.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: turnaround.png, a three-view orthographic character reference sheet for 3D modeling.
IDENTITY LOCK: Input image 1 is main.png, the accepted design master, not a loose inspiration. Depict exactly this same mascot with the same proportions, face-screen size and placement, ear-disc construction, short thick antennae and ball tips, cyan cheek tiles, centered cyan circular chest light, short fused mitten arms and two rounded sky-blue feet. Head and body are one uninterrupted upright egg/bean mass with no neck, waist or separate torso. Retain the four character colors: sky blue #4FC3F7 body/arms/feet, deep cobalt #1565C0 ear discs/visor rim/antennae, navy #1A1F5C visor, cyan #00E5FF pixels/ear insets/chest light; white highlights and light neutral backgrounds allowed. Broad thick joined parts, flat-ish stable foot soles, no fingers or delicate projections. Original earnest, helpful university study-buddy personality. No added clothing, extra body panels, seams, headband or decorative accessories. No typography, words, letters, numbers, branding, watermarks or captions anywhere.
Create a true 16:9 WIDE landscape image, 1536 x 864 pixels or another exact 16:9 size, plain white background. Three full-body orthographic views of this identical character arranged left to right: FRONT view, exact 90-degree SIDE profile facing toward the left of the sheet, exact BACK view. Do not write those view names. Render all three at exactly the same scale with crown-ball heights and flat foot soles aligned on the same baseline. Give each figure an equal-width column with ample clean gutters and safe outer margins. Neutral standing pose, arms down and close to the body, identical antenna length, feet, ear discs, and body dimensions in all views. Straight orthographic camera, no perspective, no three-quarter view, no dramatic camera angles.
Front view: symmetrical ear positions, both short ball antennae visible, navy visor with viewer-left five rounded cyan pixels in a diagonal cross, viewer-right two-tile horizontal dash, one cyan cheek tile under each eye, cyan chest button. Side profile: show the chunky cylinder's outward circular cyan inset as in main.png; the face visor hugs the front surface and is only visible edge-on if physically visible. Antennae and limbs may occlude each other naturally in true profile; do not spread them to expose hidden parts. Back view: smooth unmarked sky-blue egg back, symmetrical thick cobalt ears with correctly placed cyan outward-facing insets where visible, two antennae and attached arms/feet; NO rear face, NO back chest button, NO invented back panels or tail.
Matte soft resin/toy material matching the hero, soft even studio lighting, almost no cast shadows. All three are the same physical object viewed from different sides. No extra inset views, arrows, measurement marks, grids, text or labels. This must be a coherent model sheet, not a set of pose variations.
```

Status: accepted on attempt 1. Visual verdict: 94/100. Native image is 1672 x 941 pixels (16:9 within one-pixel native rounding). No character regeneration needed.

## expressions.png — attempt 1

Reference: `main.png`.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: expressions.png, square 2x2 expression and action sheet.
IDENTITY LOCK: Input image 1 is main.png, the accepted design master, not a loose inspiration. Depict exactly this same mascot with the same proportions, face-screen size and placement, ear-disc construction, short thick antennae and ball tips, cyan cheek tiles, centered cyan circular chest light, short fused mitten arms and two rounded sky-blue feet. Head and body are one uninterrupted upright egg/bean mass with no neck, waist or separate torso. Retain the four character colors: sky blue #4FC3F7 body/arms/feet, deep cobalt #1565C0 ear discs/visor rim/antennae, navy #1A1F5C visor, cyan #00E5FF pixels/ear insets/chest light; white highlights and light neutral backgrounds allowed. Broad thick joined parts, flat-ish stable foot soles, no fingers or delicate projections. Original earnest, helpful university study-buddy personality. No added clothing, extra body panels, seams, headband or decorative accessories. No typography, words, letters, numbers, branding, watermarks or captions anywhere.
Create a square 1:1 image on a plain near-white background with four equal quadrants, generous outer margin, clean whitespace gutters, and NO grid lines, labels or panel borders. Show exactly four complete copies of the SAME full-body matte resin mascot, one per quadrant, identical camera distance and size, natural soft studio shadows. Keep the hero's geometry and colors absolutely consistent; only eye pixel configuration, body tilt and tiny attached arm pose change.
TOP LEFT: happy waving hello, both cyan eyes are cute stepped pixel upward chevrons (happy closed eyes), tiny cyan square blush under each, one short rounded mitten arm raised to wave while remaining broadly attached to the body. Friendly welcoming lean, both feet present.
TOP RIGHT: thinking/puzzled, one cyan pixel eye shaped like a small question pictogram and the other a small dash, short mitten close to the lower visor in a thinking gesture, slight head/body tilt. Add exactly ONE small cyan floating question-mark SHAPE in the clean space beside the head as the explicitly requested expression pictogram. Treat it as a flat graphic annotation, not a physical appendage or printable floating component. No other written marks.
BOTTOM LEFT: cheering a win, both eyes are bright cyan blocky pixel stars, two tiny mitten arms raised outward and upward in a joyful celebration while remaining stout, rounded and directly attached to the body. Both feet grounded, no jumping. No confetti or trophy, no extra colors.
BOTTOM RIGHT: sleepy/apologetic, both eyes are two short low horizontal cyan pixel dashes, tiny square cyan blush, arms resting down, slight sleepy forward tilt, stable feet.
Every eye symbol is built from rounded square pixels rather than conventional human eyes; preserve the navy visor, cobalt ear discs with cyan insets, thick ball-tipped sprout antennae and chest button. No mouths. No stretched limbs, hands, separated joints, props, extra floating parts or famous-character resemblance.
```

Status: accepted on attempt 1. Visual verdict: 96/100. Happy waving, puzzled thinking with the requested question pictogram, star-eyed cheering, and sleepy variants are present; no regeneration.

## flat.png — attempt 1

Reference: `main.png`.

Exact prompt:

```text
Use case: illustration-story.
Asset type: flat.png, a flat 2D vector-style avatar illustration delivered as a PNG.
IDENTITY LOCK: Input image 1 is main.png, the accepted design master, not a loose inspiration. Depict exactly this same mascot with the same proportions, face-screen size and placement, ear-disc construction, short thick antennae and ball tips, cyan cheek tiles, centered cyan circular chest light, short fused mitten arms and two rounded sky-blue feet. Head and body are one uninterrupted upright egg/bean mass with no neck, waist or separate torso. Retain the four character colors: sky blue #4FC3F7 body/arms/feet, deep cobalt #1565C0 ear discs/visor rim/antennae, navy #1A1F5C visor, cyan #00E5FF pixels/ear insets/chest light; white highlights and light neutral backgrounds allowed. Broad thick joined parts, flat-ish stable foot soles, no fingers or delicate projections. Original earnest, helpful university study-buddy personality. No added clothing, extra body panels, seams, headband or decorative accessories. No typography, words, letters, numbers, branding, watermarks or captions anywhere.
Translate the exact mascot in main.png into ONE clear front-view flat illustration, centered on a plain pure-white SQUARE 1:1 canvas. This is a style translation of the locked 3D mascot, not a redesign. Whole body and both antenna balls/feet visible, character fills about 80% of the square height with generous white margin. Strong cute, simple symmetrical silhouette that remains recognizable as a 48-pixel avatar.
Use clean THICK smooth deep-navy outlines with rounded joins, flat sky-blue fills, flat cobalt headphone cylinders and thick ball-tipped antennae, solid navy rounded rectangular visor with cobalt rim, solid cyan pixel eyes and cheek tiles, cyan ear inset circles and tiny cyan chest button. The viewer-left eye is five small rounded-square cyan tiles in a diagonal cross, the viewer-right eye is the same short two-tile cyan horizontal dash as the hero; two tiny cyan cheek pixels below. Exactly two attached stubby mitten arms and two short sky-blue flat-bottom feet, all matching the hero. Keep enough dark-screen separation around the eyes.
NO gradients, glow haze, photorealistic texture, 3D render, drop shadow or background decoration. At most one simple darker-blue flat shading shape per large form, and small white highlight shapes only if needed. Prioritize the four-color identity, broad robust shapes and clarity at small size. No badges, lettering, symbols outside the visor, extra expression variants, mockup objects or text.
```

Status: rejected for subtle continuous surface shading; geometry and identity matched. Visual verdict: 86/100. Regenerated with stricter solid-fill instructions; the rejected original remains only in the tool generation folder.

## scene_poster.png — attempt 1

Reference: `main.png`.

Exact prompt:

```text
Use case: ads-marketing.
Asset type: scene_poster.png, a text-free university AI club recruitment poster background.
IDENTITY LOCK: Input image 1 is main.png, the accepted design master, not a loose inspiration. Depict exactly this same mascot with the same proportions, face-screen size and placement, ear-disc construction, short thick antennae and ball tips, cyan cheek tiles, centered cyan circular chest light, short fused mitten arms and two rounded sky-blue feet. Head and body are one uninterrupted upright egg/bean mass with no neck, waist or separate torso. Retain the four character colors: sky blue #4FC3F7 body/arms/feet, deep cobalt #1565C0 ear discs/visor rim/antennae, navy #1A1F5C visor, cyan #00E5FF pixels/ear insets/chest light; white highlights and light neutral backgrounds allowed. Broad thick joined parts, flat-ish stable foot soles, no fingers or delicate projections. Original earnest, helpful university study-buddy personality. No added clothing, extra body panels, seams, headband or decorative accessories. No typography, words, letters, numbers, branding, watermarks or captions anywhere.
Create a VERTICAL portrait image with an exact 3:4 aspect ratio, for example 1152 x 1536 pixels. A polished matte resin / soft-vinyl 3D scene, same material and character as main.png.
CRITICAL LAYOUT: the entire TOP 35% of the canvas is a completely EMPTY calm pale icy-blue field reserved for a headline to be added later. No character, antenna, props, icons, shapes, highlights, sparkles, text, decorative objects or visual distractions within that top 35%. The background can have an almost imperceptible light-blue tonal gradient. Keep the whole composition calm and uncluttered.
Place the complete mascot LARGE in the LOWER-MIDDLE, centered slightly below the midpoint: antenna tips around 40% of canvas height, feet around 90%, with comfortable bottom margin. Three-quarter front camera matching the hero. Cheerful inviting cyan pixel-chevron eyes, cyan cheek squares, no mouth. One short rounded mitten reaches toward the viewer in a welcoming come-join-us gesture while staying stout and attached; the other rests against the body. Beside its lower body, within the bottom half only, place a small chunky navy study tablet propped upright on the floor and close to its mitten; screen shows only three simple connected cyan node-dots, no text, no keyboard, no thin cables. This is a separate scene prop, not a modification of the figurine or its parts. Both feet planted and full silhouette visible.
Use only the locked blue/cyan/navy palette plus near-white neutral studio surfaces. Low soft platform-free floor, gentle grounding shadows, restrained depth and soft natural studio lighting. Friendly campus study-buddy energy for university students. No extra characters, confetti, books with writing, circuitry wallpaper, floating parts or crowded background. Absolutely no text, letters, numbers, club logo or watermark anywhere.
```

Status: accepted on attempt 1. Visual verdict: 95/100. Exact native 3:4 canvas, clear headline space exceeds 35%, large lower-middle mascot and a simple study-tablet prop. The eyes retain the hero cross-and-dash expression instead of the prompted chevrons; the welcoming arm gesture meets the requested invitation action. No regeneration.

## scene_merch.png — attempt 1

Reference: `main.png` plus `flat.png`.

Exact prompt:

```text
Use case: product-mockup.
Asset type: scene_merch.png, realistic product photo of coordinated mascot merchandise.
IDENTITY LOCK: Input image 1 is main.png, the accepted design master, not a loose inspiration. Depict exactly this same mascot with the same proportions, face-screen size and placement, ear-disc construction, short thick antennae and ball tips, cyan cheek tiles, centered cyan circular chest light, short fused mitten arms and two rounded sky-blue feet. Head and body are one uninterrupted upright egg/bean mass with no neck, waist or separate torso. Retain the four character colors: sky blue #4FC3F7 body/arms/feet, deep cobalt #1565C0 ear discs/visor rim/antennae, navy #1A1F5C visor, cyan #00E5FF pixels/ear insets/chest light; white highlights and light neutral backgrounds allowed. Broad thick joined parts, flat-ish stable foot soles, no fingers or delicate projections. Original earnest, helpful university study-buddy personality. No added clothing, extra body panels, seams, headband or decorative accessories. No typography, words, letters, numbers, branding, watermarks or captions anywhere.
Input image 2 is flat.png, the exact flat-art master for the keychain and stickers. Use this flat artwork faithfully; do not invent another mascot or change its palette.
Create an exact 4:3 HORIZONTAL landscape realistic product photograph, for example 1536 x 1152 pixels. Clean pale near-white desk, plain softly blurred neutral background, gentle natural window light and soft believable shadows, modest depth of field but all three products legible. Calm tasteful university club merchandise presentation, no packaging typography or brand marks.
Include exactly these three product groups, arranged with breathing room:
LEFT / CENTER-LEFT: one real-looking approximately 7 cm tall 3D-printed resin figurine of the exact main.png mascot, full body in a gentle three-quarter front view. Matte hand-finished sky-blue resin, cobalt discs/short thick ball antennae/visor rim, navy screen and cyan cross-and-dash pixel eyes with cyan blush and chest light. Identical stout limbs and feet, stands independently with no display base. Real miniature scale conveyed by the adjacent ordinary keychain hardware. Keep chunky print-friendly joined geometry, subtle physical manufacturing texture, no long wires or delicate fingers.
RIGHT UPPER: one clear die-cut acrylic keychain about 5 cm high lying on the desk at a slight angle, printed with the exact flat.png front-facing art, clean transparent acrylic border, one simple small attachment tab with a realistic silver split ring and a SHORT sturdy connector. The metallic ring is external keychain hardware, not part of the mascot anatomy; no thin chains or decorative dangling charms.
RIGHT LOWER / FOREGROUND: one small white sticker sheet lying flat, containing six neatly separated die-cut stickers of the same front-view flat character in a simple 2-column x 3-row arrangement with subtle cut borders; all use the flat.png master, same palette and recognizable design. No sheet title, no written labels, no branded backing.
The figurine, keychain art and sticker art are clearly the SAME character, with identical rounded body silhouette, headphones, thick two ball antennae, visor, pixel cheeks and chest button. No hands or people, no mugs, pens, electronics, extra toys, duplicate sheets, additional characters or text. No watermarks.
```

Status: accepted on attempt 1. Visual verdict: 96/100. One matte resin figurine, one acrylic keychain using the flat-art master, and one six-sticker sheet appear on the clean desk. Exact native 4:3 canvas. No regeneration.

## flat.png — attempt 2

Reference: `main.png`.

Exact prompt:

```text
Use case: illustration-story.
Asset type: flat.png, final square flat 2D character avatar PNG.
Input image 1 is main.png and is the CHARACTER IDENTITY REFERENCE. Translate this exact single egg-body mascot into one centered FRONT VIEW with the same body/arm/foot proportions, navy visor size and position, two short thick cobalt antenna nubs ending in balls, two cobalt cylindrical headphone discs with cyan center insets, and cyan circular chest button. The body, tiny mitten arms and two flat-bottom feet are sky blue. No separate head, neck or torso, no long arms, fingers, thin antennae or extra parts.
Rendering correction: STRICTLY FLAT CEL ART WITH SOLID UNIFORM FILLS. Four flat inks ONLY: sky blue #4FC3F7, deep cobalt #1565C0, navy #1A1F5C, cyan #00E5FF; plus pure white #FFFFFF background. Absolutely ZERO gradients, ZERO lighting, ZERO smooth color variation, ZERO texture, ZERO volumetric shading, ZERO shadows, ZERO gloss. Treat this like a silkscreen vector decal. Use thick uniform navy outlines with round caps/joins and crisp antialiased edges. Interiors of all shapes must be a single constant solid fill. Do not carry over ANY of the 3D reference's rendered lighting or surface gradients.
Navy rounded rectangular visor with simple cobalt rim. Viewer-left eye is five rounded cyan square pixels arranged as a diagonal cross; viewer-right eye is two cyan blocks forming a short horizontal dash; one small cyan square cheek pixel under each eye. No mouth. Keep those face features large, uncluttered and recognizable at 48-pixel avatar size. Strong simple symmetric silhouette. Main character occupies 80-85% of the height, all extremities inside generous white margins. Square 1:1 pure-white canvas, no other objects, no letters, words, labels, logo, watermark, frame or decoration. Same original helpful study-buddy character; not a redesign.
```

Status: accepted. Visual verdict: 94/100. Flat vector-style fills, clear thick outlines, original cross-and-dash pixel face, and full silhouette retained. Delivered as the requested PNG, not an editable SVG.

## Final files and verification

| File | Native dimensions | Layout |
| --- | --- | --- |
| `main.png` | 1254 x 1254 | Square hero; design master |
| `turnaround.png` | 1672 x 941 | Wide 16:9 sheet, within one-pixel native rounding |
| `expressions.png` | 1254 x 1254 | Square 2 x 2 expression sheet |
| `flat.png` | 1254 x 1254 | Square flat avatar |
| `scene_poster.png` | 1086 x 1448 | Exact 3:4; upper 35% clear |
| `scene_merch.png` | 1448 x 1086 | Exact 4:3 product mockup |

All six PNGs were saved directly into the requested current folder. Their PNG signatures, successful decoding, native dimensions and complete file set were checked. All final pixels are from the built-in image-generation tool; no manual compositing, cropping, recoloring or code-drawn replacement was used.

Seven image-generation calls total: six initial deliverables plus one regeneration of the flat illustration. No off-model character variants remain among the final files. The first flat attempt was simplified to clearer solid-color regions and thick outlines. No new code, dependencies or changes to the original club logo were needed.

An independent native subagent visually reviewed the first five final images against the brief and the locked hero and found no material character drift, unwanted text, or layout defects. The merchandise mockup was additionally checked against both its hero and flat-art references.

Native aspect ratios: the tool rounded the wide turnaround canvas to 1672 x 941 (ratio 1.776833 instead of 1.777778, a 0.5-pixel height difference); this is the only aspect-ratio limitation. Square, poster and merchandise ratios are exact.

Remaining practical limitation: these PNGs are visual design references and merchandise mockups. Wall thickness, actual part count, support needs and stability must be validated in the eventual 3D model before physical printing.



## Round 2

Completed 2026-11-08 using the built-in `image_gen` tool. `main.png` remained the locked, unmodified character reference. All eight final PNGs are saved directly in this folder with the exact requested filenames. Nine image-generation calls: eight initial outputs and one targeted poster regeneration. Every final image was inspected against `main.png` and `prompt_v2.md`; an independent native subagent also visually reviewed all eight final outputs.

The lenticular series uses `lenti_1.png` as its frozen image-edit target for each of frames 2-4. Those three calls were separate face-only edits of the same master, avoiding accumulated drift. No manual compositing, cropping, recolouring or code-drawn image replacement was performed. Python/Pillow were used only for decoding, dimensions and pixel-based verification; no new dependencies were installed.

### scene_poster_v2.png — attempt 1

Reference image, in tool-input order: `main.png`.

Exact prompt:

```text
Use case: ads-marketing.
Asset type: scene_poster_v2.png, recruitment poster ARTWORK without typography.
Input image 1: main.png, locked character identity reference.
IDENTITY LOCK: main.png is the approved character master, not inspiration. Depict EXACTLY this same original mascot with the same proportions: one uninterrupted chubby upright egg-shaped sky-blue #4FC3F7 body with no separate head, neck, waist or torso; broad cobalt #1565C0 cylindrical headphone discs with cyan center insets; two short thick cobalt antenna stalks with large round ball tips; a wide navy #1A1F5C rounded visor with thick cobalt rim, glowing cyan #00E5FF rounded-square pixel eyes and two tiny square cheek pixels; one tiny round cyan chest light; two short stubby attached mitten arms with no fingers; two small rounded sky-blue feet. Preserve the characteristic silhouette, visor size and placement, round belly and stout limbs. Same softly textured matte-vinyl 3D material as main.png unless a flat printed acrylic version is explicitly requested. No added clothing, accessories, headband, extra panels or extra anatomy. NO text, letters, numbers, logos, labels, captions, signatures or watermarks anywhere in the image.
Create ONE vertical image in EXACT 3:4 aspect ratio (for example 1152 x 1536). Background is ONE perfectly uniform flat solid deep cobalt #1565C0 from edge to edge. No gradient, vignette, room, desk, scenery, props, texture or decorative clutter. Omit optional signal arcs to prioritize absolute simplicity and readable contrast.
Composition is critical: leave the entire TOP 38% of the canvas completely empty uninterrupted solid #1565C0 for a future headline. No part of the mascot, shadow, glow or decoration may enter that zone. Place the complete mascot BIG and centered horizontally in the lower portion: top antenna balls at about 40% of image height, soles at about 95%, so the whole character occupies about 55% of the poster height. Full body and antenna tips visible. Short viewer-right mitten arm raised in a friendly hello wave toward the viewer; preserve stout limb length and the locked proportions. Happy face: two cyan stepped-pixel upward chevrons, visually ^ ^, plus the two tiny cheek pixels. No mouth. Bright sky-blue body should have strong contrast against cobalt. Crisp clean premium 3D render with a subtle soft grounding shadow near the feet only. High-impact simple silhouette readable from five metres. No text of any kind.
```

Status: superseded by attempt 2. The character, wave, size, lower layout and empty headline area passed, but pixel sampling identified slight background texture/tint variation. A targeted background-only correction was requested. Visual verdict: 88/100, revise. The rejected initial generation remains in the tool's generation folder only; the final filename contains attempt 2.

### scene_poster_v2.png — attempt 2

Reference images, in tool-input order: `scene_poster_v2.png`, `main.png`.

Exact prompt:

```text
Use case: precise-object-edit.
Asset type: corrected scene_poster_v2.png, exact vertical 3:4 text-free recruitment poster.
Input image 1: current scene_poster_v2.png, edit target. Input image 2: main.png, identity lock reference.
Correct ONLY the BACKGROUND COLOR and its flatness. Replace the existing slightly textured blue background with a single perfectly uniform SOLID DEEP COBALT COLOR #1565C0, RGB(21,101,192). Treat the backdrop as a flat digital graphic color swatch, not a lit 3D surface. It must be the SAME exact RGB color all across the entire top 38% and every visible background area, with zero grain, zero noise, zero gradient, zero vignette, zero light falloff and zero texture. Preserve a subtle short soft grounding shadow immediately under the feet only.
Keep the existing mascot's character, pose, happy ^ ^ pixel face, proportions, material, wave arm, size, position, camera and lighting completely unchanged. Its top antenna tips remain around y=40%, feet around y=95%, filling about 55% of the image height. Preserve the whole front-view same locked blue egg-body character from main.png, both cobalt ball-tipped antennae and headphone discs, navy visor/cobalt rim, cyan eyes/cheeks/chest light, sky-blue stubby arms and round feet. Full character stays within the lower 62% of image.
The ENTIRE TOP 38% must remain completely EMPTY and exactly flat #1565C0. No arcs, props, room, desk, ornaments, light spots, texture, words, letters, numbers, logos or watermark. One character only. Do not alter the composition, proportions, canvas size or 3:4 aspect ratio.
```

Status: accepted on attempt 2. Independent visual verdict: 94/100. The top 38% is entirely free of objects; the waving mascot occupies about 56% of image height. The backdrop reads visually as flat cobalt. Native rendering still has minute colour variation and is not a mathematically exact #1565C0 swatch; see measured verification below.

### lenti_1.png — attempt 1

Reference image, in tool-input order: `main.png`.

Exact prompt:

```text
Use case: identity-preserve.
Asset type: lenti_1.png, first square lenticular flip-card frame and alignment master.
Input image 1: main.png, locked character identity reference.
IDENTITY LOCK: main.png is the approved character master, not inspiration. Depict EXACTLY this same original mascot with the same proportions: one uninterrupted chubby upright egg-shaped sky-blue #4FC3F7 body with no separate head, neck, waist or torso; broad cobalt #1565C0 cylindrical headphone discs with cyan center insets; two short thick cobalt antenna stalks with large round ball tips; a wide navy #1A1F5C rounded visor with thick cobalt rim, glowing cyan #00E5FF rounded-square pixel eyes and two tiny square cheek pixels; one tiny round cyan chest light; two short stubby attached mitten arms with no fingers; two small rounded sky-blue feet. Preserve the characteristic silhouette, visor size and placement, round belly and stout limbs. Same softly textured matte-vinyl 3D material as main.png unless a flat printed acrylic version is explicitly requested. No added clothing, accessories, headband, extra panels or extra anatomy. NO text, letters, numbers, logos, labels, captions, signatures or watermarks anywhere in the image.
Create ONE exact square 1:1 image. The character stands neutral, perfectly front-facing with bilateral centered framing, both stubby arms DOWN in their relaxed original positions, both feet on the ground. Camera at visor level, zero roll, no body tilt or turn, no perspective exaggeration. Whole character centered at x=50%; highest antenna point at y=8%, soles at y=92%. Generous equal side margins. Plain uniform very light near-white #FAFBFD studio background, one soft diffuse shadow directly beneath feet, soft neutral broad studio light from upper left. Sharp full-body matte-vinyl render faithfully matching main.png's body and construction.
Face for FRAME 1: exactly two bright cyan happy closed eyes, each built as a small stepped upward chevron made of rounded square pixels, visually ^ ^. Keep the two tiny cyan cheek squares under the eyes and the round chest light. No mouth. No other glowing shapes.
This image will be the frozen master for three subsequent face-only edits. Favor precise clean stable geometry, a straight frontal pose and uncomplicated neutral light. No movement, wave, props, floor seam, colored backdrop, text, symbols outside the visor, or additional characters. One character only. Exact square image.
```

Status: accepted on attempt 1. Independent visual verdict: 97/100. Requested expression is clear and the full neutral character remains closely registered with the master. No regeneration.

### lenti_2.png — attempt 1

Reference image, in tool-input order: `lenti_1.png`.

Exact prompt:

```text
Use case: precise-object-edit.
Asset type: lenti_2.png, one exact square lenticular animation frame.
Input image 1: lenti_1.png, the EDIT TARGET and frozen master of this frame sequence. This is a surgical face-only edit of that image, not a new render of a similar robot.
FRAME 2 / WINK: keep the viewer-left cyan stepped upward-chevron eye exactly as in the target; replace ONLY the viewer-right chevron eye with ONE bright cyan rounded-square dot, centered in that eye's existing eye area. Keep both cheek pixels unchanged.
CRITICAL INVARIANTS: preserve EVERY pixel outside the two cyan EYE SYMBOLS and their immediate glow on the navy visor. Copy the entire rest of the edit target unchanged. Keep exactly the same pixel dimensions, crop, camera, camera angle, framing, full-body neutral arms-down pose, character size and position, silhouette, proportions, antennae, headphone discs, visor rim, cheek squares, chest light, both feet, material grain, lighting, background and contact shadow. Preserve the exact original navy screen shading around the eye edits. Do not alter the character's geometry or introduce any movement, tilt, zoom, relocation, different light or new shadow. This frame must overlay precisely with lenti_1.png for lenticular interlacing. One full-body mascot only; plain very light background remains untouched. No text, letters, numbers, logos, labels, watermarks, extra glyphs, mouths or decorations. Output ONE image only, square 1:1, not a grid or sheet.
```

Status: accepted on attempt 1. Independent visual verdict: 97/100. Requested expression is clear and the full neutral character remains closely registered with the master. No regeneration.

### lenti_3.png — attempt 1

Reference image, in tool-input order: `lenti_1.png`.

Exact prompt:

```text
Use case: precise-object-edit.
Asset type: lenti_3.png, one exact square lenticular animation frame.
Input image 1: lenti_1.png, the EDIT TARGET and frozen master of this frame sequence. This is a surgical face-only edit of that image, not a new render of a similar robot.
FRAME 3 / LOVE: replace ONLY the two happy chevron eyes with TWO equally sized bright cyan pixel HEARTS, one centered on each original eye position. Make each heart from a crisp symmetrical square-pixel grid with a notch between two upper lobes and a tapered point below. Keep both cheek pixels unchanged.
CRITICAL INVARIANTS: preserve EVERY pixel outside the two cyan EYE SYMBOLS and their immediate glow on the navy visor. Copy the entire rest of the edit target unchanged. Keep exactly the same pixel dimensions, crop, camera, camera angle, framing, full-body neutral arms-down pose, character size and position, silhouette, proportions, antennae, headphone discs, visor rim, cheek squares, chest light, both feet, material grain, lighting, background and contact shadow. Preserve the exact original navy screen shading around the eye edits. Do not alter the character's geometry or introduce any movement, tilt, zoom, relocation, different light or new shadow. This frame must overlay precisely with lenti_1.png for lenticular interlacing. One full-body mascot only; plain very light background remains untouched. No text, letters, numbers, logos, labels, watermarks, extra glyphs, mouths or decorations. Output ONE image only, square 1:1, not a grid or sheet.
```

Status: accepted on attempt 1. Independent visual verdict: 97/100. Requested expression is clear and the full neutral character remains closely registered with the master. No regeneration.

### lenti_4.png — attempt 1

Reference image, in tool-input order: `lenti_1.png`.

Exact prompt:

```text
Use case: precise-object-edit.
Asset type: lenti_4.png, one exact square lenticular animation frame.
Input image 1: lenti_1.png, the EDIT TARGET and frozen master of this frame sequence. This is a surgical face-only edit of that image, not a new render of a similar robot.
FRAME 4 / STARS: replace ONLY the two happy chevron eyes with TWO equally sized bright cyan pixel STARS, one centered on each original eye position. Each is a readable compact five-point star silhouette with stair-stepped pixel edges, not a plus or cross. Keep both cheek pixels unchanged.
CRITICAL INVARIANTS: preserve EVERY pixel outside the two cyan EYE SYMBOLS and their immediate glow on the navy visor. Copy the entire rest of the edit target unchanged. Keep exactly the same pixel dimensions, crop, camera, camera angle, framing, full-body neutral arms-down pose, character size and position, silhouette, proportions, antennae, headphone discs, visor rim, cheek squares, chest light, both feet, material grain, lighting, background and contact shadow. Preserve the exact original navy screen shading around the eye edits. Do not alter the character's geometry or introduce any movement, tilt, zoom, relocation, different light or new shadow. This frame must overlay precisely with lenti_1.png for lenticular interlacing. One full-body mascot only; plain very light background remains untouched. No text, letters, numbers, logos, labels, watermarks, extra glyphs, mouths or decorations. Output ONE image only, square 1:1, not a grid or sheet.
```

Status: accepted on attempt 1. Independent visual verdict: 97/100. Requested expression is clear and the full neutral character remains closely registered with the master. No regeneration.

### merch_keychain.png — attempt 1

Reference images, in tool-input order: `main.png`, `flat.png`.

Exact prompt:

```text
Use case: product-mockup.
Asset type: merch_keychain.png, realistic natural-light product photograph in exact horizontal 4:3 aspect ratio (for example 1536 x 1152).
Input image 1: main.png, locked character identity. Input image 2: flat.png, supporting master for the flat printed illustration on the keychain, not a 3D toy.
IDENTITY LOCK: main.png is the approved character master, not inspiration. Depict EXACTLY this same original mascot with the same proportions: one uninterrupted chubby upright egg-shaped sky-blue #4FC3F7 body with no separate head, neck, waist or torso; broad cobalt #1565C0 cylindrical headphone discs with cyan center insets; two short thick cobalt antenna stalks with large round ball tips; a wide navy #1A1F5C rounded visor with thick cobalt rim, glowing cyan #00E5FF rounded-square pixel eyes and two tiny square cheek pixels; one tiny round cyan chest light; two short stubby attached mitten arms with no fingers; two small rounded sky-blue feet. Preserve the characteristic silhouette, visor size and placement, round belly and stout limbs. Same softly textured matte-vinyl 3D material as main.png unless a flat printed acrylic version is explicitly requested. No added clothing, accessories, headband, extra panels or extra anatomy. NO text, letters, numbers, logos, labels, captions, signatures or watermarks anywhere in the image.
On a clean light neutral desk in natural soft window light, show a real approximately 5 cm clear acrylic LENTICULAR keychain of the exact mascot. A person's natural hand gently holds it by its short silver keychain attachment next to an ordinary unbranded smartphone for scale. The palm and fingers must look anatomically natural. The charm is a THIN FLAT die-cut acrylic slab with a clear polished border and silver split ring; inside it is the flat 2D illustration of the exact reference mascot with the same sky-blue body, cobalt discs/ball-tipped antennae, navy visor, cyan eyes/chest button, stubby limbs and round feet. Show it slightly tilted, with a subtle believable rainbow sheen across its fine lenticular lens surface; a faint view-changing overlap only within the face conveys the flip effect. It is not a molded figurine. The smartphone has a completely blank dark screen with no icons or writing and is clearly adjacent to the held keychain.
On the desk in the foreground lies a SECOND matching clear acrylic mascot-shaped keychain, FACE DOWN: its reverse has a small clearly visible ROUND WHITE NFC STICKER, plain unprinted white, about 15-20 mm across, on the back. Its reverse and hardware must be visibly distinct from the upright held charm. Exactly two keychains total. Gentle realistic reflections, clean minimal composition, soft contact shadows, restrained depth of field with both charm faces/reverse legible. No additional gadgets, loose components, packaging, typography, letters, numbers, labels, logos or watermarks anywhere, including on phone, hardware and sticker.
```

Status: accepted on attempt 1. Independent visual verdict: 97/100. Two clear acrylic charms: one held beside a blank smartphone with a lenticular rainbow sheen; a second face-down with a plain round white NFC sticker. No regeneration.

### desk_bot.png — attempt 1

Reference image, in tool-input order: `main.png`.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: desk_bot.png, realistic desktop electronics prototype concept render, exact horizontal 4:3 aspect ratio (for example 1536 x 1152).
Input image 1: main.png, locked character identity reference.
IDENTITY LOCK: main.png is the approved character master, not inspiration. Depict EXACTLY this same original mascot with the same proportions: one uninterrupted chubby upright egg-shaped sky-blue #4FC3F7 body with no separate head, neck, waist or torso; broad cobalt #1565C0 cylindrical headphone discs with cyan center insets; two short thick cobalt antenna stalks with large round ball tips; a wide navy #1A1F5C rounded visor with thick cobalt rim, glowing cyan #00E5FF rounded-square pixel eyes and two tiny square cheek pixels; one tiny round cyan chest light; two short stubby attached mitten arms with no fingers; two small rounded sky-blue feet. Preserve the characteristic silhouette, visor size and placement, round belly and stout limbs. Same softly textured matte-vinyl 3D material as main.png unless a flat printed acrylic version is explicitly requested. No added clothing, accessories, headband, extra panels or extra anatomy. NO text, letters, numbers, logos, labels, captions, signatures or watermarks anywhere in the image.
Show a larger desktop physical version of this SAME mascot, approximately 28 cm tall, standing on a university electronics club workbench. It must still have exactly the original egg-body proportions, big blue headphone discs and stubby ball antennae, tiny attached arms and small round feet. Three-quarter FRONT view close to main.png, whole mascot visible and dominant in the composition, taking about 75% of image height.
The navy visor is a REAL small glowing LCD display physically installed within the original rounded cobalt rim, with convincing dark glass, slight screen reflection and faint visible pixel structure. On it show the original cyan left five-pixel diagonal cross and right short pixel dash, plus tiny cyan cheek pixels. Keep the tiny circular cyan chest light; discretely hide a fine small speaker grille within its surrounding blue recess so the chest still reads as the original little cyan button, not a new large grille or body panel.
Beside the bot are one ordinary unbranded open laptop, a plain silicone soldering mat and only a few small unmarked electronics parts. These props establish its 28 cm scale; the laptop is about the height of its upper body. Warm soft indoor university workshop light, subtle believable shadows, high-quality matte sky-blue molded shell and cobalt accents, quiet shallow-background workshop setting. Clean restrained composition with the bot fully in focus. Laptop screen has only a soft blank glow; no text on screen, keyboard keys, mat or components, no logos, no rulers, no measurements or typography anywhere. Do not add humanoid joints, separate torso, long arms, wheels, clothes or additional robots.
```

Status: accepted on attempt 1. Independent visual verdict: 95/100. Same larger character, real-looking glowing LCD and subtle chest speaker detail, laptop, soldering mat and a few electronic parts in warm workshop lighting. No regeneration.

### family.png — attempt 1

Reference images, in tool-input order: `main.png`, `desk_bot.png`, `flat.png`, `merch_keychain.png`.

Exact prompt:

```text
Use case: product-mockup.
Asset type: family.png, exact square 1:1 character family product concept.
Input image 1: main.png, locked character identity master. Input image 2: desk_bot.png, exact large desktop bot to reuse. Input image 3: flat.png, matching flat printed illustration for the mini acrylic avatars. Input image 4: merch_keychain.png, acrylic material and hardware reference only.
IDENTITY LOCK: main.png is the approved character master, not inspiration. Depict EXACTLY this same original mascot with the same proportions: one uninterrupted chubby upright egg-shaped sky-blue #4FC3F7 body with no separate head, neck, waist or torso; broad cobalt #1565C0 cylindrical headphone discs with cyan center insets; two short thick cobalt antenna stalks with large round ball tips; a wide navy #1A1F5C rounded visor with thick cobalt rim, glowing cyan #00E5FF rounded-square pixel eyes and two tiny square cheek pixels; one tiny round cyan chest light; two short stubby attached mitten arms with no fingers; two small rounded sky-blue feet. Preserve the characteristic silhouette, visor size and placement, round belly and stout limbs. Same softly textured matte-vinyl 3D material as main.png unless a flat printed acrylic version is explicitly requested. No added clothing, accessories, headband, extra panels or extra anatomy. NO text, letters, numbers, logos, labels, captions, signatures or watermarks anywhere in the image.
Scene/backdrop: a plain very light near-white seamless studio background and floor, soft neutral light with gentle grounding shadows. Clean minimal product photograph/concept render; no workshop, props, phone, hand, laptop, or scene clutter.
Composition: exactly ONE LARGE 28 cm desktop mascot from desk_bot.png standing in the BACK CENTRE, fully visible including both ball antennae and round feet, filling about 70-75% of square image height. Same matte shell, rounded cobalt visor rim, dark-glass real glowing LCD with original cyan left diagonal five-pixel cross and right short dash plus cheek pixels; original tiny round chest light with discreet grille detail. This must be the same desktop model, not a redesigned character.
In front of it arrange EXACTLY FIVE separate SMALL 5 cm clear acrylic KEYCHAINS in a shallow arc, all completely inside the frame with space between them. Five total: far left, inner left, front centre, inner right, far right. They are printed thin flat die-cut acrylic slabs with a clear polished edge and a small silver split ring each, not 3D miniature robots. Their mascot artwork is the same flat version as flat.png, with the locked antennae, discs, visor, blue body, stubby arms and feet. Keep scale honest: each printed mascot is about 5/28 (18%) as tall as the large bot. Pose the five clear charms slightly canted/leaning to make the acrylic edges and flatness visible. Front-facing artwork remains readable. Arrange like the original and its five little avatars, with the original behind and the small charms in front; do not hide its full silhouette. Modest expression variations on the small cyan visor eyes are allowed, with no extra symbols outside screens. Exactly six depictions total: one desktop bot and five keychains. No duplicate toys, additional charms, lettering, labels, logos, watermarks, captions, or typography.
```

Status: accepted on attempt 1. Independent visual verdict: 96/100. Exactly one matching desktop bot at the back centre and five clear acrylic avatar keychains in a front arc on a plain light background. Foreground perspective enlarges their apparent size. No regeneration.

### Round 2 final verification

| File | Native dimensions | Aspect ratio |
| --- | --- | --- |
| `scene_poster_v2.png` | 1086 x 1448 | Exact 3:4 |
| `lenti_1.png` | 1254 x 1254 | Square |
| `lenti_2.png` | 1254 x 1254 | Square |
| `lenti_3.png` | 1254 x 1254 | Square |
| `lenti_4.png` | 1254 x 1254 | Square |
| `merch_keychain.png` | 1448 x 1086 | Exact 4:3 |
| `desk_bot.png` | 1448 x 1086 | Exact 4:3 |
| `family.png` | 1254 x 1254 | Square |

All eight files decoded successfully as RGB PNGs. Their dimensions and aspect ratios passed. No text, letters, logos or watermarks were found during visual review. `main.png` SHA-256 before and after: `3fb584dc161cdbfab79e006aad31c908fe836aa3bf893e2fed513ecb6db7f634`.

Lenticular registration: a blue-character threshold mask measured bounds (left, top, right-exclusive, bottom-exclusive) of (190, 90, 1062, 1171) for frames 1 and 2; (190, 89, 1062, 1171) for frames 3 and 4. Thus gross silhouette bounds match within one pixel. These are generated face edits, not pixel-identical layers: outside the eye-edit rectangle (370, 430, 810, 580), full-canvas-normalized average absolute RGB differences against frame 1 are approximately (3.00, 3.46, 2.33), (3.09, 3.45, 2.38), and (2.65, 2.52, 1.45) for frames 2, 3 and 4 respectively. Small surface, colour and glow differences remain; no geometry or framing drift was found by visual review. This bounds test does not imply every contour is identical. Interlacing is outside this deliverable set.

Final poster upper-38% mean RGB: (10.94, 95.78, 188.40); channel standard deviations: (0.65, 0.73, 0.77) on a 0-255 scale. The field is visually flat and clear for a headline, with tiny native raster variation and a slight colour offset from the specified swatch. Exact print colour and mathematically identical lenticular pixels are the remaining output limitations of this image-generation workflow.

The main simplification is the poster's single cobalt field with no optional arcs, scenery or props. All earlier Round 1 files and the locked reference are preserved. No code or dependency changes were needed. Detailed verdicts and measurements are recorded in `.omx/state/round-2/`.


## Round 3

Completed: 2026-11-08 23:53:15 UTC.

Tool: built-in `image_gen.imagegen`, with local reference image paths and `transparent_background: false` on all three calls. Two final deliverables, three generation calls total: the sheet was accepted on its first attempt; the rear view was regenerated once to make the rear-facing look-back pose clearer. The character identity remains locked to `main.png`.

The sole shape change is a gently rounded front belly and modest, completely fused lower-back bulge, specified at about 8-10% of body depth, with a smooth transition up the back. The front proportions, original neutral sheet expression, palette, visor, headphone discs, antennae, arms and feet are preserved. The rear view has the requested happy cyan pixel `^ ^` expression.

### turnaround_v2.png - attempt 1, accepted

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` - locked character master.
2. `D:/desk/webip/ip/A_zhi/turnaround.png` - previous sheet / edit target.

Exact prompt:

```text
Use case: precise-object-edit.
Asset type: turnaround_v2.png, a character reference sheet in exact horizontal 16:9 aspect ratio, ideally 1792 x 1008.
Input image 1: main.png, the LOCKED character identity and material master. Input image 2: turnaround.png, the EDIT TARGET and previous orthographic sheet. Preserve its composition, views, neutral pose and character identity. The sole geometry revision is a gentle belly-and-lower-back S-curve in body depth.
IDENTITY LOCK: reproduce exactly the same original sky-blue mascot as main.png: one continuous chubby body with no separate head, neck or waist; sky-blue #4FC3F7 softly textured matte vinyl; two thick short cobalt #1565C0 antenna stalks with round ball tips; large cobalt headphone discs with bright cyan #00E5FF circular insets; wide navy #1A1F5C visor with thick rounded cobalt rim; original glowing cyan left five-square diagonal X eye, right short pixel dash eye and two tiny square cheek pixels; one tiny round cyan chest light; two short attached mitten arms without fingers; two small round sky-blue feet. Keep every feature, colour, front-view proportion, accessory size and placement identical to the references.
COMPOSITION: exactly three complete depictions side by side: straight FRONT at left, strict SIDE facing LEFT at centre, straight BACK at right. Orthographic cameras with no perspective distortion; same height, scale, baseline and neutral arms-down standing pose in all views. Full antennae and feet visible with white margin, no cropping or overlap. Plain pure white seamless background, soft neutral studio lighting, subtle ground-contact shadows, same matte-vinyl finish as main.png. No text, labels, arrows, guide lines, logos or watermarks.
ONLY GEOMETRY CHANGE: in the centre left-facing side view, give the front contour a slightly rounded belly below the small chest light. Give the lower BACK contour, on the RIGHT of this centre figure, a small softly rounded perky bottom sitting immediately above the feet. Its outward projection is only about 8-10% of the original body depth. Ease the back gently inward above this modest low bulge, then flow smoothly up into the rounded head, producing a clear but gentle S-curve rather than the previous plain ellipse. This is ONE smooth fused body mass, a continuous molded silhouette: no added part, tail, bump stuck onto the surface, seam, anatomical cleft, paired buttocks, sharp waist, exaggerated hip or human anatomy. Keep the feet beneath the body's weight. The subtle added depth must also be consistent in the BACK view while leaving the FRONT silhouette and proportions unchanged. Keep the visor, discs, antennae, arms and feet from the previous sheet unchanged. Retain the original neutral pixel expression in the front; only the natural thin visor edge is visible in strict side profile and the back has no face. Output ONE 16:9 sheet only.
```

Status: accepted on attempt 1. Independent visual verdict: 96/100. The front, left-facing side and back share a neutral pose, scale and baseline. The side clearly shows the rounded belly and modest fused lower-back S-curve. No regeneration.

Native generation: `C:/Users/king/.codex/generated_images/01a1bd8e-84e0-79e0-a012-84fd5fe4d0fc/exec-41765bfd-3608-4253-956c-dcce88ccd063.png`, 1672 x 941. For exact 16:9 delivery, a white canvas margin of 4 pixels on the left/right and 2 pixels on the top/bottom was added using System.Drawing, giving 1680 x 945. No character pixels were scaled or changed; a decoded RGB comparison confirms that the complete native image is pixel-identical within the final canvas. The native source is retained in `.omx/state/round-3/turnaround_v2-attempt-1-native.png`.

### rear34.png - attempt 1, rejected

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` - locked character master.
2. `D:/desk/webip/ip/A_zhi/turnaround_v2.png` - accepted Round 3 shape reference; at this call it was still the native 1672 x 941 canvas.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: rear34.png, ONE exact square 1:1 character studio render.
Input image 1: main.png, LOCKED identity, proportions, colours and material master. Input image 2: turnaround_v2.png, the approved Round 3 geometry reference: copy the modest belly-and-lower-back S-curve in its centre side view. These are the SAME original mascot, not inspiration for a redesign.
SCENE: plain very light near-white seamless background and floor, soft neutral studio lighting with a gentle grounding shadow. Match main.png's softly textured matte-vinyl material, saturation and gentle highlights.
COMPOSITION AND POSE: a full-body THREE-QUARTER REAR view, showing the broad smooth back and one side. The little rounded lower-back bottom must be clearly visible from behind-side just above the feet. The body faces away from the camera, while the visor-bearing upper part gently turns back over the near shoulder toward the viewer, so part of the original navy visor is visible at the upper side of the silhouette. Show a readable happy face made of TWO bright cyan stepped square-pixel chevrons, ^ ^, on that partly visible visor, foreshortened naturally, with the original tiny square cheek pixels. This is a cute soft-vinyl toy looking back; preserve ONE continuous body with no separate head, neck, waist, collar or swivel joint. Keep both short mitten arms down in a relaxed standing pose and both small feet on the floor. Show the whole character, antenna tips and feet uncut, centered and large in the square with comfortable margin.
IDENTITY LOCK: same chubby sky-blue #4FC3F7 body and exact front proportions as main.png; two short thick cobalt #1565C0 stalk antennae with large round ball tips; original large cobalt headphone discs with bright cyan #00E5FF circular insets; the same wide navy #1A1F5C visor and thick rounded cobalt rim; short stubby attached mitten arms with no fingers; two original small rounded blue feet. The tiny cyan chest light remains at the front and may naturally be hidden by this rear angle; do not move it to the back. Keep the original accessory dimensions and placement.
ONLY GEOMETRY REVISION: a slightly rounded front belly below the chest light and a small modest perky lower-back bottom, projecting only about 8-10% of body depth and sitting directly above the feet. The back above the little bulge eases inward gently and flows smoothly up toward the head, creating the same gentle S-curve as the new sheet. The lower-back volume is completely fused into the body as ONE smooth uninterrupted molded mass, no anatomical cleft, paired buttocks, seam, separate piece, tail, added sphere, sharp waist, human anatomy or exaggerated projection. Keep it cute and restrained. The camera and slight look-back pose reveal the approved shape; do not reshape or slim the character for the pose.
No additional characters, props, clothing, text, labels, arrows, symbols outside the visor, letters, numbers, logos or watermarks. Output ONE square image only, not a sheet or collage.
```

Status: rejected after independent visual review, 82/100. The identity, happy expression and fused bottom were retained, but the exposed visor and camera angle read too much as a side/front-three-quarter view. The regeneration needed a centered, dominant back with only a smaller happy visor glimpse over the shoulder.

Native generation: `C:/Users/king/.codex/generated_images/01a1bd8e-84e0-79e0-a012-84fd5fe4d0fc/exec-5cf2ce8d-e6cc-4f3a-9c9a-a4d163cf8fb7.png`. Rejected attempt retained as `.omx/state/round-3/rear34-attempt-1.png`; it is not the final deliverable.

### rear34.png - attempt 2, accepted; one regeneration

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` - locked character master.
2. `D:/desk/webip/ip/A_zhi/turnaround_v2.png` - accepted sheet, now with its final 1680 x 945 white canvas.
3. `D:/desk/webip/ip/A_zhi/.omx/state/round-3/rear34-attempt-1.png` - edit target for the camera/pose correction.

Exact prompt:

```text
Use case: precise-object-edit.
Asset type: rear34.png, ONE square 1:1 matte-vinyl character studio render.
Input image 1: main.png, the LOCKED identity, accessory dimensions, front proportions, palette and material master. Input image 2: turnaround_v2.png, approved Round 3 body geometry. Input image 3: rear34-attempt-1.png, EDIT TARGET. Correct ONLY its viewing direction and look-back pose; preserve its exact character, happy cyan pixel eyes, modest fused bottom, matte surface and studio treatment.
REQUIRED CORRECTION: the edit target reads too much as a side/front view. Move the camera substantially farther AROUND BEHIND the character to an unmistakable THREE-QUARTER REAR view, about 135 degrees around from straight front. The body and both feet face AWAY from us. The uninterrupted BACK must be centered and fill most of the visible body, approximately three quarters of its surface. Show the BACKS of the heels and both relaxed mitten arms beside the back. The broad rear silhouette and the modest little lower-back bulge above the feet are the main subject.
LOOK BACK: the visor-bearing upper region glances back over the LEFT shoulder of the image, with a gentle seamless twist of the original continuous body. Allow only a SMALL NARROW FORESHORTENED SLICE of the navy visor to peek around the upper LEFT outer contour. Most of the front visor is OCCLUDED by this rear angle and the near headphone. In the small visible screen region, retain TWO happy bright cyan stepped square-pixel chevrons, ^ ^, naturally compressed by perspective; cheek pixels only where naturally visible. Keep the large headphone disc near the upper LEFT edge of the back, not centered in front of the torso. The farther disc may peek out at the right edge. Keep the rear of the rounded head and back dominant. This is a toy turning to look over its shoulder, without adding a neck, head joint, collar, separate torso or human anatomy.
LOCKED CHARACTER: same continuous chubby sky-blue #4FC3F7 body, two thick short cobalt #1565C0 stalks with round ball antenna tips, broad cobalt headphone discs with cyan #00E5FF circular insets, original navy #1A1F5C visor and thick cobalt rim, short attached blue mitten arms without fingers, two small rounded blue feet. Same tiny cyan front chest light remains hidden on the FRONT; no button on the back. No redesign, slimming, elongated limbs, new parts, accessories or clothing.
SHAPE: preserve the sheet's modest gentle S-curve: a slightly rounded front belly and a SMALL rounded perky bottom at the lower BACK immediately above the feet, with only 8-10% of body depth in outward projection. Above it, the back eases inward gently and continues smoothly to the head. ONE smooth fused vinyl body mass, no separate lump, tail, seam, cleft, paired buttocks, exaggerated projection or sharp waist.
Plain very light near-white background, soft neutral studio light, subtle grounding shadow, same softly textured matte vinyl as main.png. Full character centered in square, antennae and feet uncut with margin. No text, labels, arrows, letters, numbers, logos, watermarks, props, extra characters or extra panels. Output ONE square image only.
```

Status: accepted on attempt 2. Independent visual verdict: 95/100. The broad back now dominates, with the happy pixel chevrons visible on a narrow foreshortened visor over the shoulder. The modest lower-back volume remains one smooth fused body mass, with no tail, cleft or separate part. No further regeneration.

Native generation: `C:/Users/king/.codex/generated_images/01a1bd8e-84e0-79e0-a012-84fd5fe4d0fc/exec-60aa171d-3dc7-4427-92a2-89a6080868cc.png`. Copied directly to `rear34.png` without resizing or image changes.

### Round 3 final verification

| Final file | Dimensions | Format | Aspect ratio |
| --- | --- | --- | --- |
| `turnaround_v2.png` | 1680 x 945 | RGB PNG | Exact 16:9 |
| `rear34.png` | 1254 x 1254 | RGB PNG | Exact square |

Both PNGs decoded successfully. Independent visual review checked the locked character identity, colours, matte vinyl material, requested camera views, fused modest bottom, happy rear expression and absence of text, labels, arrows and watermarks. Final sheet content was also rechecked after canvas padding.

Original references preserved byte-for-byte:
- `main.png` SHA-256: `3fb584dc161cdbfab79e006aad31c908fe836aa3bf893e2fed513ecb6db7f634`.
- `turnaround.png` SHA-256: `faf086f1b835fb183613dc923744f0e8fea60705d1fb249b8725ede10c724d3e`.

Simplification: the silhouette revision stays within one continuous molded body; no extra geometry, tail or separate bottom piece was introduced. No code or dependency changes were needed. These are rendered visual references; the specified 8-10% bulge is visually interpreted, and physical center of mass / 3D-print stability has not been measured. Detailed prompts, rejected rear attempt, verdicts and technical checks are retained under `.omx/state/round-3/`.


## Round 4 — four side-profile options

Brief: `prompt_v4.md`. Tool: built-in `image_gen.imagegen`; one separate call per image/attempt, `transparent_background: false`. Direct execution with independent visual review. No CLI/API fallback or new dependencies.

The user's Round 4 feedback REJECTS Round 3's forward belly and split/two-cheek bottom. Earlier acceptance statements above are historical and are superseded by that feedback. Neither `turnaround_v2.png` nor `rear34.png` was used as a reference in Round 4. `main.png` remains the locked character identity/material master. Only the four explicitly requested silhouette alternatives were varied.

All four finals contain, left to right, a left-facing side profile, three-quarter rear view and three-quarter front view of the same option, at matching scale and a shared foot baseline. White background, domed crown, matte vinyl, original palette/accessories/pixel expression, restrained flat or concave front, one smooth fused rear mass, no cleft, paired cheeks, lettering, labels, logos or watermark. The variants stay within one continuous body surface rather than introducing extra body parts.

### Final selection and regenerations

| File | Option | Accepted attempt | Regenerations | Independent visual score | Final dimensions |
| --- | --- | --- | --- | --- | --- |
| `option_A.png` | Jelly bean | 3 | 2 | 95/100 | 1680 × 945, exact 16:9 |
| `option_B.png` | Water drop leaning back | 1 | 0 | 95/100 | 1680 × 945, exact 16:9 |
| `option_C.png` | Duckling tail | 1 | 0 | 95/100 | 1680 × 945, exact 16:9 |
| `option_D.png` | Big dome head | 3 | 2 | 92/100 | 1680 × 945, exact 16:9 |

Eight images were generated in total: four initial sheets and four targeted regenerations (two each for A and D). Pass threshold: 90/100. Rejected attempts remain only in the Round 4 evidence directory, not as top-level deliverables.

### option_A.png — Jelly bean

#### Attempt 1 — rejected

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` — locked character identity and material master.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: one 16:9 landscape character silhouette-option sheet, 1792 x 1008 pixels.
Input image 1: main.png, the LOCKED character identity and material master. Use only this reference, not any previous turnaround. The authorized change is the side-depth silhouette described below; retain every other feature of the master.

LAYOUT: plain pure white seamless background, exactly THREE full-body views of ONE identical option, evenly spaced left to right: strict 90-degree SIDE PROFILE facing LEFT; THREE-QUARTER REAR view facing away with the broad smooth back dominant; THREE-QUARTER FRONT view with the face clearly readable. All three show the SAME physical design, same body dimensions and surface details, same scale and foot baseline. Complete antenna tips and feet visible, generous white margins and clear gutters, no overlapping figures. Neutral standing pose, short arms resting close to sides. No extra views, panel dividers, outlines, arrows, labels, typography, letters, numbers, logos or watermarks. Do not put the option name in the image.

IDENTITY: same sky-blue #4FC3F7 body, arms and rounded short feet; cobalt #1565C0 chunky headphone discs, short thick antenna stalks with round ball tips, and thick rounded visor rim; navy #1A1F5C wide rounded-rectangle face screen; cyan #00E5FF eye pixels, little cheek pixels, circular headphone insets and small recessed circular FRONT chest light. Preserve master proportions and placement of these features, exact original expression: viewer-left eye five small rounded-square cyan tiles in a diagonal X, viewer-right a short two-tile horizontal dash, one tiny cyan cheek square below each eye, no mouth. Screen hugs upper front, never wraps onto the back. No rear face, no rear chest light. Headphone discs attach directly without a headband. Exactly two stubby mitten arms without fingers and two small round feet without legs. In strict profile, far-side parts occlude naturally; do not spread antennae or feet artificially. Same softly textured MATTE soft-vinyl designer-toy render and soft neutral studio light as master, very subtle contact shadows, no glossy plastic, no metallic or extra colors.

ESSENTIAL BODY RULES: Head and body are ONE seamless smooth molded mass, no neck, collar, waist seam, separate head ball or separate torso. Crown has a clearly ROUND HELMET-DOME ARC, not a flat top. In the left-facing SIDE view the FRONT is on image LEFT: from just below visor/chest to the lower front it is FLAT or slightly CONCAVE, with a gentle inward sweep. This line must never bow outward into a belly. Lower-body depth extends toward image RIGHT at the BACK only. The lower back forms ONE modest unified rounded rump just above the feet, smoothly fused into the same bean surface across its entire width. The rear view is a single uninterrupted rounded cap: absolutely no central groove, cleft, seam, paired cheek volumes, anatomical buttocks, split bottom, separately attached tail, separate sphere or sharp projection. Any gap between the two feet stops below the body and does not continue up into it. Keep the silhouette cute and non-anatomical, gently bent and lively, robustly joined and printable.

OPTION A — JELLY BEAN (name is instruction only, no lettering).
The head is slightly wider than the lower body. Make the whole continuous head/body a softly BENT JELLY BEAN rather than an upright ellipse. In the left-facing profile, the smoothly domed upper head reaches subtly forward; below the visor the front sweeps gently inward in a clearly visible shallow concavity, then rounds under into the feet without an abdominal bulge. The back follows a long smooth curve down into ONE soft low rounded rump that sits slightly BEHIND the feet. Restrained projection and clean continuous surfaces. The rear three-quarter view must show the identical single broad seamless low rear cap, and front three-quarter must preserve the master's face/accessories. This option should be recognizable by the gentle concave bean front and slightly top-heavy proportions.
```

Status: rejected after independent visual review, 88/100. There is no obvious potbelly or split rear, but A needs a more readable concave jelly-bean front to satisfy its specific silhouette requirement.

Observed differences:
- The side-view front below the visor slopes inward but remains slightly convex through the lower torso; it lacks the requested clearly gentle concavity.
- The remaining identity, domed crown, single rear mass, material and three-view arrangement match.

Required regeneration:
- Tuck the middle of the front contour inward slightly between the chest light and lower-front rounding, creating a shallow concave arc.
- Preserve the head width, rear sweep, feet, accessories and other two views, updating their geometry consistently.

Native generation: `C:\Users\king\.codex\generated_images\01a1bd9d-d283-7161-a512-86c1f0342ade\exec-f9cf7e7c-a6e3-4a89-abc8-636c68c90de3.png`, 1672 × 941. Retained as `.omx/state/round-4/option_A-attempt-1-native.png`. Exact prompt and independent verdict are also retained under `.omx/state/round-4/`.

#### Attempt 2 — rejected; regeneration 1

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` — locked character identity and material master.
2. `D:/desk/webip/ip/A_zhi/.omx/state/round-4/option_A-attempt-1-native.png` — edit target for the targeted silhouette correction.

Exact prompt:

```text
Use case: precise-object-edit.
Asset type: option_A.png, one 16:9 white-background three-view matte-vinyl character sheet.
Input image 1: main.png, LOCKED identity, palette, face, material and accessory master.
Input image 2: option_A-attempt-1-native.png, EDIT TARGET. Preserve this sheet's layout, scale, cameras, domed head, gentle low rear sweep, accessories, colors, face and lighting. Correct ONLY the front body contour as follows, coherently across views.

REQUIRED TARGETED CORRECTION: In the LEFTMOST left-facing side profile, below the visor and front chest light, the FRONT contour is currently a little convex. Sculpt this line into a clearly visible but SHALLOW CONCAVE ARC: tuck the mid-front inward toward the back by a small amount (about 5-8% of body depth), with the inward-most point halfway between chest light and feet. Curve it softly back outward only at the very bottom where it rounds underneath to the feet. The contour should look like the concave inner curve of a softly BENT JELLY BEAN. No belly, no convex abdomen. Head stays slightly wider than the lower body. Keep the long smooth back sweep and ONE modest low rounded rump slightly behind the feet. This is a subtle cute bean bend, no sharp waist, no neck, no body seam. Update the front-three-quarter volume consistently; do not add or delete parts.

LOCKED identity: master sky-blue #4FC3F7 single fused head/body, short mitten arms and small round feet; thick short cobalt #1565C0 ball-tipped antennae, chunky headphone discs with cyan circular insets, cobalt visor rim; navy #1A1F5C wide rounded-rectangle visor with glowing cyan #00E5FF five-tile X at viewer-left and two-tile dash at viewer-right, small cyan square blush beneath each eye, no mouth; one small recessed cyan FRONT chest light. Same softly textured matte vinyl and soft neutral studio light. No rear face or rear button. Crown remains a round helmet dome. Back is ONE continuous molded surface across its width, with no groove, cleft, two cheeks, seam, separate sphere or tail.

Exactly three complete same-scale views left to right: SIDE facing LEFT, THREE-QUARTER REAR with broad smooth back dominant, THREE-QUARTER FRONT. Same foot baseline, generous white outer margins and clear gutters, full antennae and feet visible. Plain pure-white background with subtle contact shadows. No text, option names, letters, numbers, logos, labels, captions, arrows or watermark. Output ONE horizontal 16:9 sheet, ideally 1792 x 1008.
```

Status: rejected after independent visual review, 89/100. The correction removed the lower-front convexity and preserved the successful bean back and character identity. The remaining issue is specific to A: its front reads flat, not gently concave.

Observed differences:
- The front is now nearly straight and has no belly, but the requested shallow concavity is still not clearly visible.

Required regeneration:
- Move the middle front contour inward slightly more while retaining the existing endpoints below the visor and above the feet. Create a visible shallow inward arc rather than a straight diagonal.

Native generation: `C:\Users\king\.codex\generated_images\01a1bd9d-d283-7161-a512-86c1f0342ade\exec-dfe59060-b008-4a41-8271-4467baa82305.png`, 1672 × 941. Retained as `.omx/state/round-4/option_A-attempt-2-native.png`. Exact prompt and independent verdict are also retained under `.omx/state/round-4/`.

#### Attempt 3 — accepted; regeneration 2

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` — locked character identity and material master.
2. `D:/desk/webip/ip/A_zhi/.omx/state/round-4/option_A-attempt-2-native.png` — edit target for the targeted silhouette correction.

Exact prompt:

```text
Use case: precise-object-edit.
Create ONE horizontal 16:9 white-background three-view sheet. Input image 1 main.png is the locked character identity/material reference. Input image 2 option_A-attempt-2-native.png is the edit target, with the correct layout, pose, head, rear and accessories.

CHANGE ONLY THE FRONT BODY CURVATURE, consistently in all three views. This is the third attempt because the previous result has a flat diagonal front rather than the specified concave jelly-bean front. Make the difference CLEARLY VISIBLE in the leftmost LEFT-FACING PROFILE.

GEOMETRY INSTRUCTION: identify two points on its LEFT/front outline: the body contour just BELOW THE CHEST LIGHT, and the start of the lower-front roundover just ABOVE THE FOOT. Keep these endpoints. In the MIDDLE between them, push the outline BACKWARD toward image RIGHT by about 12% of the body depth, creating one long SHALLOW INWARD C-SHAPED CURVE. The middle of this curve must lie BEHIND the straight line joining the endpoints. It must visually scoop INWARD, never outward. Do not leave a straight diagonal. Do not move the bottom endpoint farther backward to cancel the curvature. The entire head/body is a soft BENT JELLY BEAN, head slightly wider than lower body, front hollowed gently below visor, back sweeping smoothly into a single low rounded rump slightly behind the feet. This is a broad gentle concavity, not a sharp waist or cut-out, no neck or seam. Keep the middle body thick and toy-like. Keep the exact current single smooth rear volume and domed helmet crown.

All other identity features remain exactly as master and target: sky-blue #4FC3F7 one-piece body, short mitten arms and small rounded feet; short THICK cobalt #1565C0 ball-tipped antennae, chunky headphones with cyan circular insets, cobalt visor rim; navy #1A1F5C wide rounded-rectangle screen; cyan #00E5FF five-square diagonal X eye at viewer-left, two-tile dash at viewer-right, tiny square blush beneath each, no mouth; one small cyan recessed chest light on FRONT only. No rear face or rear chest light. Same softly textured matte soft-vinyl material and neutral soft studio lighting.

Preserve target's exact composition: three complete same-scale depictions left to right SIDE PROFILE FACING LEFT, THREE-QUARTER REAR with broad back dominant, THREE-QUARTER FRONT. Same neutral arms-down stance and foot baseline; generous white margins and gutters. Update the front concavity consistently across rotations. Full antenna tips and feet visible. Back remains one uninterrupted molded mass with no central cleft, paired cheeks, anatomical details, seam, added sphere or separate tail. Plain pure white background, subtle grounding shadows, no props. No words, letters, numbers, option names, labels, logos, arrows or watermarks. Output one 16:9 landscape image, ideally 1792 x 1008.
```

Status: accepted after independent visual review, 95/100. The side profile now has a visible shallow inward curve below the chest, followed by restrained lower-front rounding without a belly. The domed crown, slightly top-heavy bean proportions and single smooth rear sweep remain consistent across the views.

Native generation: `C:\Users\king\.codex\generated_images\01a1bd9d-d283-7161-a512-86c1f0342ade\exec-823875d9-24a9-4f15-8f2f-51ac0f8a47b9.png`, 1672 × 941. Retained as `.omx/state/round-4/option_A-attempt-3-native.png`. Exact prompt and independent verdict are also retained under `.omx/state/round-4/`.

### option_B.png — Water drop leaning back

#### Attempt 1 — accepted

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` — locked character identity and material master.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: one 16:9 landscape character silhouette-option sheet, 1792 x 1008 pixels.
Input image 1: main.png, the LOCKED character identity and material master. Use only this reference, not any previous turnaround. The authorized change is the side-depth silhouette described below; retain every other feature of the master.

LAYOUT: plain pure white seamless background, exactly THREE full-body views of ONE identical option, evenly spaced left to right: strict 90-degree SIDE PROFILE facing LEFT; THREE-QUARTER REAR view facing away with the broad smooth back dominant; THREE-QUARTER FRONT view with the face clearly readable. All three show the SAME physical design, same body dimensions and surface details, same scale and foot baseline. Complete antenna tips and feet visible, generous white margins and clear gutters, no overlapping figures. Neutral standing pose, short arms resting close to sides. No extra views, panel dividers, outlines, arrows, labels, typography, letters, numbers, logos or watermarks. Do not put the option name in the image.

IDENTITY: same sky-blue #4FC3F7 body, arms and rounded short feet; cobalt #1565C0 chunky headphone discs, short thick antenna stalks with round ball tips, and thick rounded visor rim; navy #1A1F5C wide rounded-rectangle face screen; cyan #00E5FF eye pixels, little cheek pixels, circular headphone insets and small recessed circular FRONT chest light. Preserve master proportions and placement of these features, exact original expression: viewer-left eye five small rounded-square cyan tiles in a diagonal X, viewer-right a short two-tile horizontal dash, one tiny cyan cheek square below each eye, no mouth. Screen hugs upper front, never wraps onto the back. No rear face, no rear chest light. Headphone discs attach directly without a headband. Exactly two stubby mitten arms without fingers and two small round feet without legs. In strict profile, far-side parts occlude naturally; do not spread antennae or feet artificially. Same softly textured MATTE soft-vinyl designer-toy render and soft neutral studio light as master, very subtle contact shadows, no glossy plastic, no metallic or extra colors.

ESSENTIAL BODY RULES: Head and body are ONE seamless smooth molded mass, no neck, collar, waist seam, separate head ball or separate torso. Crown has a clearly ROUND HELMET-DOME ARC, not a flat top. In the left-facing SIDE view the FRONT is on image LEFT: from just below visor/chest to the lower front it is FLAT or slightly CONCAVE, with a gentle inward sweep. This line must never bow outward into a belly. Lower-body depth extends toward image RIGHT at the BACK only. The lower back forms ONE modest unified rounded rump just above the feet, smoothly fused into the same bean surface across its entire width. The rear view is a single uninterrupted rounded cap: absolutely no central groove, cleft, seam, paired cheek volumes, anatomical buttocks, split bottom, separately attached tail, separate sphere or sharp projection. Any gap between the two feet stops below the body and does not continue up into it. Keep the silhouette cute and non-anatomical, gently bent and lively, robustly joined and printable.

OPTION B — WATER DROP LEANING BACK (name is instruction only, no lettering).
Make one asymmetric soft WATER-DROP silhouette leaning slightly backward: a rounded dome at the upper end, and the heavier round end at the LOWER BACK, not at the abdomen. The front below the visor remains a nearly straight or gently concave line, while the extra lower-body volume is entirely behind that line. The rounded head/visor tilts a LITTLE upward as if curiously looking up; keep its dome round and visor fully consistent with the master. This curious upward angle should be evident in side and front-three-quarter views without creating a neck. The single heavy low rear lobe rounds gently backward and slightly up above the short feet. Feet remain beneath the weight. Rear three-quarter shows ONE uninterrupted rounded rear surface with no paired lobes or central cleft. Keep the leaning-back water-drop shape distinct from the slimmer jelly-bean option.
```

Status: accepted after independent visual review, 95/100. The upward-curious tilt and heavier lower-back drop distinguish this option. The restrained front, rounded dome, unified rump and locked character features are consistent across the three views.

Native generation: `C:\Users\king\.codex\generated_images\01a1bd9d-d283-7161-a512-86c1f0342ade\exec-ed5a4b5b-5819-4299-988c-c961e06e3473.png`, 1672 × 941. Retained as `.omx/state/round-4/option_B-attempt-1-native.png`. Exact prompt and independent verdict are also retained under `.omx/state/round-4/`.

### option_C.png — Duckling tail

#### Attempt 1 — accepted

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` — locked character identity and material master.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: one 16:9 landscape character silhouette-option sheet, 1792 x 1008 pixels.
Input image 1: main.png, the LOCKED character identity and material master. Use only this reference, not any previous turnaround. The authorized change is the side-depth silhouette described below; retain every other feature of the master.

LAYOUT: plain pure white seamless background, exactly THREE full-body views of ONE identical option, evenly spaced left to right: strict 90-degree SIDE PROFILE facing LEFT; THREE-QUARTER REAR view facing away with the broad smooth back dominant; THREE-QUARTER FRONT view with the face clearly readable. All three show the SAME physical design, same body dimensions and surface details, same scale and foot baseline. Complete antenna tips and feet visible, generous white margins and clear gutters, no overlapping figures. Neutral standing pose, short arms resting close to sides. No extra views, panel dividers, outlines, arrows, labels, typography, letters, numbers, logos or watermarks. Do not put the option name in the image.

IDENTITY: same sky-blue #4FC3F7 body, arms and rounded short feet; cobalt #1565C0 chunky headphone discs, short thick antenna stalks with round ball tips, and thick rounded visor rim; navy #1A1F5C wide rounded-rectangle face screen; cyan #00E5FF eye pixels, little cheek pixels, circular headphone insets and small recessed circular FRONT chest light. Preserve master proportions and placement of these features, exact original expression: viewer-left eye five small rounded-square cyan tiles in a diagonal X, viewer-right a short two-tile horizontal dash, one tiny cyan cheek square below each eye, no mouth. Screen hugs upper front, never wraps onto the back. No rear face, no rear chest light. Headphone discs attach directly without a headband. Exactly two stubby mitten arms without fingers and two small round feet without legs. In strict profile, far-side parts occlude naturally; do not spread antennae or feet artificially. Same softly textured MATTE soft-vinyl designer-toy render and soft neutral studio light as master, very subtle contact shadows, no glossy plastic, no metallic or extra colors.

ESSENTIAL BODY RULES: Head and body are ONE seamless smooth molded mass, no neck, collar, waist seam, separate head ball or separate torso. Crown has a clearly ROUND HELMET-DOME ARC, not a flat top. In the left-facing SIDE view the FRONT is on image LEFT: from just below visor/chest to the lower front it is FLAT or slightly CONCAVE, with a gentle inward sweep. This line must never bow outward into a belly. Lower-body depth extends toward image RIGHT at the BACK only. The lower back forms ONE modest unified rounded rump just above the feet, smoothly fused into the same bean surface across its entire width. The rear view is a single uninterrupted rounded cap: absolutely no central groove, cleft, seam, paired cheek volumes, anatomical buttocks, split bottom, separately attached tail, separate sphere or sharp projection. Any gap between the two feet stops below the body and does not continue up into it. Keep the silhouette cute and non-anatomical, gently bent and lively, robustly joined and printable.

OPTION C — DUCKLING TAIL CURVE (name is instruction only, no lettering).
Keep the compact upright egg proportions of main.png, with a more clearly rounded helmet dome at the crown. Below the visor the front is restrained and near-VERTICAL, flat or very gently concave, never potbellied. At the very LOWER BACK, sculpt a SMALL upturned lift in the continuous body contour like the back silhouette of a duckling: a subtle soft rounded point or upward-curving tip, entirely FUSED into the body, not a tail appendage. The low back sweep lifts slightly before rounding under toward the feet. This is a single broad continuous vinyl mass across the back, no crease or pair of cheeks. The small upturned lift must be readable in the left-facing profile and consistent in the rear-three-quarter view. Preserve master's compact egg width/height, face and accessory proportions. Distinguish this option through the small upward lift, not a big pear-shaped rear.
```

Status: accepted after independent visual review, 95/100. The compact egg silhouette has a domed crown, near-flat front and readable small upturned rear lift. The lift stays fused into one uninterrupted rear surface without a cleft or paired cheeks.

Native generation: `C:\Users\king\.codex\generated_images\01a1bd9d-d283-7161-a512-86c1f0342ade\exec-a0566d1a-c5e0-4d19-90e1-a791aa8a2835.png`, 1672 × 941. Retained as `.omx/state/round-4/option_C-attempt-1-native.png`. Exact prompt and independent verdict are also retained under `.omx/state/round-4/`.

### option_D.png — Big dome head

#### Attempt 1 — rejected

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` — locked character identity and material master.

Exact prompt:

```text
Use case: stylized-concept.
Asset type: one 16:9 landscape character silhouette-option sheet, 1792 x 1008 pixels.
Input image 1: main.png, the LOCKED character identity and material master. Use only this reference, not any previous turnaround. The authorized change is the side-depth silhouette described below; retain every other feature of the master.

LAYOUT: plain pure white seamless background, exactly THREE full-body views of ONE identical option, evenly spaced left to right: strict 90-degree SIDE PROFILE facing LEFT; THREE-QUARTER REAR view facing away with the broad smooth back dominant; THREE-QUARTER FRONT view with the face clearly readable. All three show the SAME physical design, same body dimensions and surface details, same scale and foot baseline. Complete antenna tips and feet visible, generous white margins and clear gutters, no overlapping figures. Neutral standing pose, short arms resting close to sides. No extra views, panel dividers, outlines, arrows, labels, typography, letters, numbers, logos or watermarks. Do not put the option name in the image.

IDENTITY: same sky-blue #4FC3F7 body, arms and rounded short feet; cobalt #1565C0 chunky headphone discs, short thick antenna stalks with round ball tips, and thick rounded visor rim; navy #1A1F5C wide rounded-rectangle face screen; cyan #00E5FF eye pixels, little cheek pixels, circular headphone insets and small recessed circular FRONT chest light. Preserve master proportions and placement of these features, exact original expression: viewer-left eye five small rounded-square cyan tiles in a diagonal X, viewer-right a short two-tile horizontal dash, one tiny cyan cheek square below each eye, no mouth. Screen hugs upper front, never wraps onto the back. No rear face, no rear chest light. Headphone discs attach directly without a headband. Exactly two stubby mitten arms without fingers and two small round feet without legs. In strict profile, far-side parts occlude naturally; do not spread antennae or feet artificially. Same softly textured MATTE soft-vinyl designer-toy render and soft neutral studio light as master, very subtle contact shadows, no glossy plastic, no metallic or extra colors.

ESSENTIAL BODY RULES: Head and body are ONE seamless smooth molded mass, no neck, collar, waist seam, separate head ball or separate torso. Crown has a clearly ROUND HELMET-DOME ARC, not a flat top. In the left-facing SIDE view the FRONT is on image LEFT: from just below visor/chest to the lower front it is FLAT or slightly CONCAVE, with a gentle inward sweep. This line must never bow outward into a belly. Lower-body depth extends toward image RIGHT at the BACK only. The lower back forms ONE modest unified rounded rump just above the feet, smoothly fused into the same bean surface across its entire width. The rear view is a single uninterrupted rounded cap: absolutely no central groove, cleft, seam, paired cheek volumes, anatomical buttocks, split bottom, separately attached tail, separate sphere or sharp projection. Any gap between the two feet stops below the body and does not continue up into it. Keep the silhouette cute and non-anatomical, gently bent and lively, robustly joined and printable.

OPTION D — BIG DOME HEAD (name is instruction only, no lettering).
Make a chibi version approximately TWO HEADS TALL overall: the upper head region is a large ROUND HELMET-LIKE DOME with the master's wide visor on it, flowing seamlessly into a SMALLER bean-shaped lower body. This is one continuous molded mass: no detached spherical head, neck, head seam or stacked snowman structure. The large domed upper region occupies about half the total height excluding antennae; keep the master headphone discs, thick ball-tipped antennae, face pixels and cyan chest light in their correct places. The smaller lower body's front falls nearly straight or gently inward below the visor; no belly. Its back gently kicks out into ONE modest smooth rounded rump over very short rounded feet. No cleft, paired volumes or separate tail. Make the head-dominant proportions clearly different from options A/B/C while retaining the same recognizable master character.
```

Status: rejected after independent visual review, 88/100. The head-dominant proportions, character identity and single rump work, but the pinched fusion needs smoothing to meet the seamless-body requirement.

Observed differences:
- The back transition from the large head into the smaller body narrows abruptly, creating a shoulder-like pinch.
- This transition makes the silhouette read somewhat as stacked rounded forms rather than one smoothly fused mass.

Required regeneration:
- Broaden and soften the rear head-to-body transition into one long continuous curve without a localized notch.
- Retain the large helmet dome, smaller lower bean, restrained front and single low rear kick.

Native generation: `C:\Users\king\.codex\generated_images\01a1bd9d-d283-7161-a512-86c1f0342ade\exec-adb870eb-6ad0-4f8b-ae77-3603483a53f0.png`, 1672 × 941. Retained as `.omx/state/round-4/option_D-attempt-1-native.png`. Exact prompt and independent verdict are also retained under `.omx/state/round-4/`.

#### Attempt 2 — rejected; regeneration 1

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` — locked character identity and material master.
2. `D:/desk/webip/ip/A_zhi/.omx/state/round-4/option_D-attempt-1-native.png` — edit target for the targeted silhouette correction.

Exact prompt:

```text
Use case: precise-object-edit.
Asset type: option_D.png, one 16:9 white-background three-view matte-vinyl character sheet.
Input image 1: main.png, LOCKED identity, palette, face, material and accessory master.
Input image 2: option_D-attempt-1-native.png, EDIT TARGET. Preserve this sheet's layout, cameras, same scale, large dome, smaller lower bean, face, accessories and material. Correct ONLY the abrupt rear head/body transition, coherently in every view.

REQUIRED TARGETED CORRECTION: The current large head dome narrows too abruptly into the lower bean at its lower-back edge, creating a shoulder-like pinch that resembles stacked rounded forms. Fill and soften that localized indentation so the outline flows from the large head into the smaller lower body in ONE LONG, CONTINUOUS, SHALLOW CURVE with no notch, ledge or shoulder. Blend across a broad area, not a narrow bridge. The body must read as a single sculpted bent-bean mass with a large round HELMET DOME above it, never a ball balanced on another ball. Retain about TWO-HEADS-TALL chibi proportions and a smaller lower region. Preserve the nearly straight/gently concave front below the visor, no belly. Keep ONE modest low rounded rear kick above the short feet. That rear shape is integrated into the same uninterrupted surface, no anatomical cleft, no two cheeks, seam, separate lobe or tail. Do not add a neck, collar, waist, joint, clothing or body panel.

LOCKED identity: master sky-blue #4FC3F7 single smooth head/body, two short mitten arms without fingers and two small round feet; thick short cobalt #1565C0 ball-tipped antennae, chunky headphone discs with cyan circular insets, cobalt visor rim; navy #1A1F5C wide rounded-rectangle visor with glowing cyan #00E5FF five-tile X at viewer-left and two-tile dash at viewer-right, small cyan square blush beneath each eye, no mouth; one small recessed cyan FRONT chest light. Same softly textured matte vinyl and soft neutral studio light. No rear face or rear button.

Exactly three complete same-scale views left to right: SIDE facing LEFT, THREE-QUARTER REAR with broad smooth back dominant, THREE-QUARTER FRONT. Same foot baseline, generous white outer margins and clear gutters, full antennae and feet visible. Plain pure-white background with subtle contact shadows. No text, option names, letters, numbers, logos, labels, captions, arrows or watermark. Output ONE horizontal 16:9 sheet, ideally 1792 x 1008.
```

Status: rejected after independent visual review, 89/100. The large dome and smaller body now read as one seamless mass, with no belly or cleft. A small lower-back kick is still needed to complete D's requested silhouette.

Observed differences:
- The head-to-body transition is successfully smooth, but the lower back now tapers continuously toward the feet without the requested modest outward rump kick.

Required regeneration:
- Preserve the smooth head-to-body transition and add a small broad outward sweep at the lower back just above the feet, followed by the rounded underside. Keep it one fused surface without a notch or separate lobe.

Native generation: `C:\Users\king\.codex\generated_images\01a1bd9d-d283-7161-a512-86c1f0342ade\exec-87111518-22d6-4188-bb8c-8263693e7d8e.png`, 1672 × 941. Retained as `.omx/state/round-4/option_D-attempt-2-native.png`. Exact prompt and independent verdict are also retained under `.omx/state/round-4/`.

#### Attempt 3 — accepted; regeneration 2

Reference images in exact tool-input order:
1. `D:/desk/webip/ip/A_zhi/main.png` — locked character identity and material master.
2. `D:/desk/webip/ip/A_zhi/.omx/state/round-4/option_D-attempt-2-native.png` — edit target for the targeted silhouette correction.

Exact prompt:

```text
Use case: precise-object-edit.
Create ONE horizontal 16:9 white-background three-view sheet. Input image 1 main.png is the locked character identity/material reference. Input image 2 option_D-attempt-2-native.png is the edit target, with the correct seamless big helmet dome and smaller lower bean body.

CHANGE ONLY THE VERY LOWER BACK to restore the requested SMALL single rounded rump. Keep the successful LONG SMOOTH transition from the large head dome into the smaller body exactly as in the target; do NOT restore any shoulder, neck notch, stacked-ball shape or localized pinch.

GEOMETRY INSTRUCTION: in the leftmost LEFT-FACING PROFILE, the BACK is image RIGHT. From below the arm toward the feet, that contour currently tapers continuously inward. At the LOWER THIRD of the body, immediately above the feet, gently sweep the outline OUTWARD toward image RIGHT into ONE BROAD LOW ROUNDED REAR KICK, then round underneath to meet the feet. The projection is small, about 8-10% of body depth, but unmistakable in profile. Make the lower-back silhouette a very soft shallow S instead of an uninterrupted taper. It is simply the back curvature of a single bent bean, broadly fused across its full width. Absolutely no attached tail, extra sphere, seam, cleft, pair of cheeks or anatomical buttocks. Carry the same small broad rear sweep into the middle rear-three-quarter and right front-three-quarter views. Do not alter the front to create a belly: front below visor remains flat or gently concave.

Preserve big-dome approximately TWO-HEADS-TALL chibi proportions: large ROUND helmet dome with the visor on it, flowing in ONE SMOOTH UNINTERRUPTED MASS into a smaller lower bean and very short feet. No separate head/body parts, neck, collar, waist, joint or body panel. Preserve master's identity: sky-blue #4FC3F7 body/short mitten arms/feet; cobalt #1565C0 thick short ball-tipped antennae, headphones with cyan circular insets and rounded visor rim; navy #1A1F5C wide rounded-rectangle screen with cyan #00E5FF original five-tile diagonal X at viewer-left and two-tile dash at viewer-right, tiny square cheek pixels and no mouth; small recessed cyan chest light on FRONT only. No back face or back button. Same softly textured matte soft-vinyl material and soft neutral studio light.

Exactly three complete same-scale views left to right SIDE FACING LEFT, THREE-QUARTER REAR with broad smooth back dominant, THREE-QUARTER FRONT. Same foot baseline, neutral arms-down standing pose, full antennae and feet visible, generous white margins and clear gutters. Pure white seamless background, subtle contact shadows. No text, option names, labels, letters, numbers, arrows, logos, watermark, props or extra views. Output one 16:9 landscape image, ideally 1792 x 1008.
```

Status: accepted after independent visual review, 92/100. The large dome flows smoothly into the smaller lower bean, and the low rear now reads as a modest rounded kick behind the feet. The projection stays subtle and fused, with no shoulder notch, separate tail, cleft or paired cheek volumes; the locked character features remain intact.

Native generation: `C:\Users\king\.codex\generated_images\01a1bd9d-d283-7161-a512-86c1f0342ade\exec-2d120887-a59b-422d-ab86-516120397a37.png`, 1672 × 941. Retained as `.omx/state/round-4/option_D-attempt-3-native.png`. Exact prompt and independent verdict are also retained under `.omx/state/round-4/`.

### Round 4 final verification

- All four final files decode as PNG and measure 1680 × 945, exactly 16:9 (`width × 9 = height × 16`).
- Native outputs were 1672 × 941. Technical canvas formatting added only white margins: 4 pixels on the left and right, 2 pixels on the top and bottom. No scaling, cropping or character-pixel changes. Decoded ARGB SHA-256 comparison confirms that each native image is pixel-identical inside its delivered canvas.
- Independent visual checks passed on the accepted native content: A 95/100, B 95/100, C 95/100, D 92/100. The tiny added white margins do not alter any reviewed content.
- A's third attempt has the required shallow concave jelly-bean front; B has the upward-curious lean and low-back drop; C has a compact domed egg and small fused upturned lift; D has the large smooth helmet dome, smaller lower bean and modest single low rear kick.
- `main.png` was preserved byte-for-byte: SHA-256 `3fb584dc161cdbfab79e006aad31c908fe836aa3bf893e2fed513ecb6db7f634`.
- Changed deliverables: `option_A.png`, `option_B.png`, `option_C.png`, `option_D.png`; this Round 4 section was appended to `notes.md`. Prompts, native/rejected images, reviews, pixel-preservation evidence and the canvas-formatting script are retained in `.omx/state/round-4/`.
- No application code changed, so lint/typecheck/test suites do not apply. Verification was visual and PNG/pixel validation. These are rendered silhouette concepts; no 3D mesh or physical print was produced or tested.



## Round 5

Date: 2026-11-08.

### Scope and method

- Read and carried out `prompt_v5.md`, with the Round 4 silhouette rules from `prompt_v4.md`.
- Used the built-in `image_gen` tool for all four assets. Four calls total, one attempt per asset; zero regenerations. No CLI/API fallback or substitute renderer.
- `main.png` was the locked identity/material reference. `option_A.png` supplied A's design and layout; `option_C.png` supplied C's geometry. The accepted generated C front was an additional reference for C left and back so proportions and accessory levels stayed aligned.
- A2 and C front were generated first; both passed independent visual review before the dependent C left/back generation. All three C views then passed an independent consistency review.
- No round-4 B or D image was used as a reference.

### `option_A2.png` — attempt 1, accepted

Balanced 1:1 jelly-bean revision of A: fuller lower blue region of about the same width and height as the upper region, restrained front, and one gentle rounded rear curve. Side facing left / rear three-quarter / front three-quarter.

Reference images in exact tool-input order:

1. `D:/desk/webip/ip/A_zhi/main.png`
2. `D:/desk/webip/ip/A_zhi/option_A.png`

Tool parameters: `referenced_image_paths` as listed above; `transparent_background: false`; no `num_last_images_to_include`.

Exact prompt sent to `image_gen`:

```text
Use case: precise-object-edit.
Asset type: option_A2.png, a single landscape 16:9 three-view matte soft-vinyl character sheet.
Input image 1 main.png: LOCKED character identity, facial features, colours, accessories and material.
Input image 2 option_A.png: EDIT TARGET for the jelly-bean silhouette and sheet layout. Revise this A design; do not invent a different mascot.

CHANGE ONLY THE HEAD-TO-BODY PROPORTION, consistently in all three views. In option_A the upper head/visor/headphones region is too large and wide compared with the small lower body. Make the upper half and lower half about the SAME HEIGHT AND THE SAME WIDTH: a balanced 1:1 jelly bean. Count the smooth blue main mass from dome top to underside above the feet; its halfway height is around the bottom edge of the visor/headphones. The head from dome to this midpoint and lower body from there to its underside each occupy about half that blue mass. The lower blue body should be approximately as broad as the blue head, with a full soft lower-back curve; accessories and antennae do not count in the width/height comparison. Keep the visor and headphones in the upper half. Let the blue torso below them have equally substantial height and width, including arms and one gentle rounded rump. Preserve the compact cute scale of the original accessories and feet.

The head and body remain ONE seamless sculpted bean with a clearly DOMED top: a generous round helmet-like arc. The FRONT below the visor is nearly straight or gently concave, NEVER convex or pot-bellied. Gain the balanced lower volume across the body and the LOWER BACK, without adding a belly, neck, waist, shoulder notch, horizontal seam or separate head. In the left-facing profile the BACK is image RIGHT: sweep smoothly into ONE GENTLE BROAD ROUNDED RUMP a little behind the feet, then smoothly round underneath. Keep it restrained and natural, no exaggerated backward lean or deliberately thrust-out bottom. A's rump is a soft bean curve, NOT option C's upturned duckling tip. Absolutely no buttock cleft, two cheeks, anatomical butt, separate tail, extra sphere or paired lobes.

LOCKED identity: sky-blue #4FC3F7 blue mass, small mitten-like arms down and two small round feet; cobalt #1565C0 thick short ball-tipped antennae, chunky headphone discs with bright cyan circular insets and cobalt rounded visor rim; navy #1A1F5C wide horizontal rounded-rectangle visor with glowing cyan #00E5FF five-square diagonal X at viewer-left and two-tile horizontal dash at viewer-right, small square cheek light under each eye, no mouth; one small recessed cyan chest light on FRONT only. Match main.png's softly textured matte soft-vinyl finish, saturated palette and soft neutral studio light. No rear face or rear button.

COMPOSITION: match option_A.png's 16:9 sheet, exactly three full-body views left to right: exact SIDE facing LEFT; THREE-QUARTER REAR showing a broad smooth back; THREE-QUARTER FRONT. All three depict the SAME revised A2 geometry, same scale, upright neutral arms-down pose and foot baseline. Generous white margins, clear white gutters, full antennae and feet visible. Plain white background, at most faint contact shadows. No text, names, labels, letters, numbers, arrows, logos or watermark. Output one landscape 16:9 image, ideally 1792 x 1008.
```

Native output: `C:\Users\king\.codex\generated_images\01a1bdb4-f49a-71f1-91e7-7443854c6d09\exec-c5f1270b-9191-4a18-822a-90f44db87984.png`.

Retained native: `D:/desk/webip/ip/A_zhi/.omx/state/round-5/option_A2-attempt-1-native.png`.

Independent native visual verdict: **95/100, pass**. The lower blue region closely matches the head in width and approximately matches its height. The seamless balanced bean, requested view ordering, locked features, domed top, restrained front and single gentle rear curve are preserved.

Regenerations: **0**. No geometry or identity mismatch warranted regeneration.

### `C_front.png` — attempt 1, accepted

Exact front elevation of C; original visor pixels and chest light retained, neutral arms down, rear lift naturally hidden in the frontal silhouette.

Reference images in exact tool-input order:

1. `D:/desk/webip/ip/A_zhi/main.png`
2. `D:/desk/webip/ip/A_zhi/option_C.png`

Tool parameters: `referenced_image_paths` as listed above; `transparent_background: false`; no `num_last_images_to_include`.

Exact prompt sent to `image_gen`:

```text
Use case: identity-preserve.
Asset type: C_front.png, a single SQUARE exact FRONT ORTHOGRAPHIC character reconstruction reference.
Input image 1 main.png: locked identity, palette, visor pixels, accessories and matte soft-vinyl material.
Input image 2 option_C.png: definitive GEOMETRY AND PROPORTIONS reference. Reproject that SAME option C design into a front view; do not redesign it, do not use option A or a large-head chibi proportion.

SAME OPTION C DESIGN: one smoothly fused compact egg/bean-shaped sky-blue mass with a clearly round DOMED head top. Preserve option C's body length, widths, small low arms, stubby feet, antenna size/spacing, headphones, visor size/height and chest-light position. Lower back has ONE small fused upturned lift like the soft curve of a duckling tail; it is a single broad shallow rear sweep, never a separate appendage, pair of cheeks, cleft or anatomical butt. In exact FRONT projection the rear lift is mostly hidden behind the broad lower body; do not spread it into two side fins. Front below the visor remains nearly straight or gently concave in depth: NO belly.

LOCKED features: sky-blue #4FC3F7 blue mass, two short mitten arms without fingers held down, two round feet; cobalt #1565C0 short thick antennae topped by two round balls and chunky headphone discs with cyan circular insets; cobalt thick rounded visor rim; dark navy #1A1F5C wide horizontal rounded-rectangle screen with glowing cyan #00E5FF original five-square diagonal X eye at VIEWER-LEFT, two-tile horizontal dash eye at VIEWER-RIGHT, one tiny square cheek pixel beneath each eye, no mouth. One small recessed circular cyan FRONT chest light. Same fine matte soft-vinyl surface and soft neutral diffuse studio illumination as the references.

CAMERA IS CRITICAL: true orthographic FRONT elevation, yaw 0, roll 0, pitch 0; camera optical axis HORIZONTAL at the blue mass's mid-body height. Character stands upright and faces camera squarely. Bilaterally symmetric body, feet and accessory placement apart from asymmetric eye pixels. Both headphone outer cylinders are seen edge-on equally; do not turn to show one cyan ear disc. No top-down view, visible top planes, foreshortening, perspective convergence, 3/4 angle, lens distortion or cinematic framing. Foot bottoms share one perfectly horizontal baseline.

FRAMING FOR A MATCHED THREE-IMAGE SET: ONE character only on an opaque PURE WHITE #FFFFFF square canvas, ideally 1536 x 1536. Centre at x=50%; highest antenna pixel at y=10%, foot soles at y=90%, leaving 10% top and bottom margins. Total antenna-to-sole figure height EXACTLY 80% of canvas. Maintain those same vertical landmarks and scale for subsequent exact left and back elevations. Full body and all antennae/feet visible, neutral standing pose, arms down. Lighting reveals form but casts NO GROUND SHADOW, no grey floor, gradient, horizon, pedestal or ambient floor glow. No labels, text, letters, numbers, measurements, logos or watermarks. Output exactly one square front image, no multi-view sheet.
```

Native output: `C:\Users\king\.codex\generated_images\01a1bdb4-f49a-71f1-91e7-7443854c6d09\exec-ed334ab7-f180-4d3d-855d-3406f159b125.png`.

Retained native: `D:/desk/webip/ip/A_zhi/.omx/state/round-5/C_front-attempt-1-native.png`.

Independent native visual verdict: **94/100, pass**. The compact domed C design, original facial/accessory identity, level symmetric front elevation, neutral arms and absence of ground shadow are preserved.

Framing-only observation: The native figure height is approximately 84% rather than the prompt target of 80%. Addressed by the technical export described below.

Regenerations: **0**. No geometry or identity mismatch warranted regeneration.

### `C_left.png` — attempt 1, accepted

Exact left-facing elevation of C; circular near headphone, occluded far-side parts, domed head, restrained front, and the small fused upturned lower-back lift.

Reference images in exact tool-input order:

1. `D:/desk/webip/ip/A_zhi/main.png`
2. `D:/desk/webip/ip/A_zhi/option_C.png`
3. `D:/desk/webip/ip/A_zhi/.omx/state/round-5/C_front-attempt-1-native.png`

Tool parameters: `referenced_image_paths` as listed above; `transparent_background: false`; no `num_last_images_to_include`.

Exact prompt sent to `image_gen`:

```text
Use case: identity-preserve.
Input image 1 main.png: LOCKED character identity, colours, facial pixels, accessories and matte soft-vinyl material.
Input image 2 option_C.png: DEFINITIVE option C geometry, including its compact domed egg body and small upturned duckling-tail lift.
Input image 3 C_front-attempt-1-native.png: MATCHED FRONT ELEVATION establishing the exact character proportions, accessory heights, standing pose, material, lighting and pixel scale for this reconstruction set. Render another elevation of that SAME model; do not redesign it or change its relative dimensions.

SAME OPTION C: one smooth sky-blue #4FC3F7 head/body mass, continuously round DOMED top, no neck/waist/seam; no front belly. Match C's compact egg proportions, arm attachment level, low mitten-like arms down, short rounded feet, high cobalt #1565C0 headphone discs with cyan #00E5FF circular insets, two short thick cobalt ball-tipped antennae. The front alone has the cobalt-rimmed navy #1A1F5C horizontal visor with original five-tile diagonal X and two-tile dash eyes, two tiny square cheek pixels, and one recessed round cyan chest light. No mouth. Same very fine matte soft-vinyl texture and soft neutral diffuse studio shading.

LOWER BACK GEOMETRY: exactly option_C's ONE small gentle upturned duckling-tail LIFT, fused into the full-width lower-back surface just above the feet. The back outline is mostly upright, then at the low back rounds outward and slightly upward in a soft short shallow curve, then rounds under into the body. This is ONE continuous bean surface, not a separate tail, glued-on bump, sharp point, pelvis, two cheeks, cleft, split or anatomical bottom. Keep the character upright rather than leaning back or thrusting its bottom out.

RECONSTRUCTION CAMERA: true ORTHOGRAPHIC projection, optical axis perfectly HORIZONTAL at mid-body height; pitch 0 and roll 0; no perspective, top-down angle, visible top planes, foreshortening or lens distortion. Neutral upright standing, arms down. Same absolute scale and vertical positions as reference image 3: on the 1254 x 1254 square, antenna tops approximately y=100, dome top y=240, headphone tops y=381, visor level y=398..671 where visible, arm ends y=904, blue-body underside y=1088, foot soles y=1154. Rotation changes only horizontal projection/occlusion, never vertical position or body dimensions. The figure's horizontal bounding-box centre lies at canvas x=627. Full body visible with generous margin. ONE character only.

OPAQUE PURE WHITE #FFFFFF background, flat white all the way to every edge and between limbs, no paper grain or background texture, no grey floor, horizon, gradient or ground shadow. The model surface keeps soft form shading, but there is no shadow outside its silhouette. No text, letters, labels, numbers, measurements, arrows, captions, logos or watermark. Exactly ONE square image, not a sheet.

Asset type: C_left.png, EXACT LEFT SIDE ORTHOGRAPHIC elevation with the character facing the VIEWER'S LEFT.
Set yaw to exactly 90 degrees from the supplied front: FRONT at image LEFT, BACK at image RIGHT. Show a true flat profile. The near headphone's circular cyan inset faces camera and is a perfectly round disc; its centre is at the same height as both headphones in image 3. The far headphone is hidden directly behind the near one. The pair of left/right antennae align in projection and mostly occlude each other; do not separate them horizontally like a 3/4 view. The far arm and far foot are mostly occluded directly by the near arm/foot. Feet point left and share the same baseline. Show only the slim protruding side edge of the FRONT visor and a small edge of the chest button, not a broad front face.
Most important silhouette: a clearly DOMED head arc, a flat or slightly concave front below the visor (NO BELLY), and a SMALL unmistakable soft upturned lower-back lift on image RIGHT, matching option_C.png. Do not turn toward or away from camera. Output one square, ideally 1254 x 1254.
```

Native output: `C:\Users\king\.codex\generated_images\01a1bdb4-f49a-71f1-91e7-7443854c6d09\exec-00d8ca91-a94d-4f91-a4f6-5e89e7539495.png`.

Retained native: `D:/desk/webip/ip/A_zhi/.omx/state/round-5/C_left-attempt-1-native.png`.

Independent native visual verdict: **95/100, pass**. Exact left-facing profile with a circular near headphone and aligned occluded far-side parts. The dome, restrained front, neutral arm and small fused upturned lower-back lift match C.

Regenerations: **0**. No geometry or identity mismatch warranted regeneration.

### `C_back.png` — attempt 1, accepted

Exact back elevation of C; matched dome, accessories and feet, uninterrupted blue back and one smooth lower volume without rear face or controls.

Reference images in exact tool-input order:

1. `D:/desk/webip/ip/A_zhi/main.png`
2. `D:/desk/webip/ip/A_zhi/option_C.png`
3. `D:/desk/webip/ip/A_zhi/.omx/state/round-5/C_front-attempt-1-native.png`

Tool parameters: `referenced_image_paths` as listed above; `transparent_background: false`; no `num_last_images_to_include`.

Exact prompt sent to `image_gen`:

```text
Use case: identity-preserve.
Input image 1 main.png: LOCKED character identity, colours, facial pixels, accessories and matte soft-vinyl material.
Input image 2 option_C.png: DEFINITIVE option C geometry, including its compact domed egg body and small upturned duckling-tail lift.
Input image 3 C_front-attempt-1-native.png: MATCHED FRONT ELEVATION establishing the exact character proportions, accessory heights, standing pose, material, lighting and pixel scale for this reconstruction set. Render another elevation of that SAME model; do not redesign it or change its relative dimensions.

SAME OPTION C: one smooth sky-blue #4FC3F7 head/body mass, continuously round DOMED top, no neck/waist/seam; no front belly. Match C's compact egg proportions, arm attachment level, low mitten-like arms down, short rounded feet, high cobalt #1565C0 headphone discs with cyan #00E5FF circular insets, two short thick cobalt ball-tipped antennae. The front alone has the cobalt-rimmed navy #1A1F5C horizontal visor with original five-tile diagonal X and two-tile dash eyes, two tiny square cheek pixels, and one recessed round cyan chest light. No mouth. Same very fine matte soft-vinyl texture and soft neutral diffuse studio shading.

LOWER BACK GEOMETRY: exactly option_C's ONE small gentle upturned duckling-tail LIFT, fused into the full-width lower-back surface just above the feet. The back outline is mostly upright, then at the low back rounds outward and slightly upward in a soft short shallow curve, then rounds under into the body. This is ONE continuous bean surface, not a separate tail, glued-on bump, sharp point, pelvis, two cheeks, cleft, split or anatomical bottom. Keep the character upright rather than leaning back or thrusting its bottom out.

RECONSTRUCTION CAMERA: true ORTHOGRAPHIC projection, optical axis perfectly HORIZONTAL at mid-body height; pitch 0 and roll 0; no perspective, top-down angle, visible top planes, foreshortening or lens distortion. Neutral upright standing, arms down. Same absolute scale and vertical positions as reference image 3: on the 1254 x 1254 square, antenna tops approximately y=100, dome top y=240, headphone tops y=381, visor level y=398..671 where visible, arm ends y=904, blue-body underside y=1088, foot soles y=1154. Rotation changes only horizontal projection/occlusion, never vertical position or body dimensions. The figure's horizontal bounding-box centre lies at canvas x=627. Full body visible with generous margin. ONE character only.

OPAQUE PURE WHITE #FFFFFF background, flat white all the way to every edge and between limbs, no paper grain or background texture, no grey floor, horizon, gradient or ground shadow. The model surface keeps soft form shading, but there is no shadow outside its silhouette. No text, letters, labels, numbers, measurements, arrows, captions, logos or watermark. Exactly ONE square image, not a sheet.

Asset type: C_back.png, EXACT BACK ORTHOGRAPHIC elevation.
Set yaw to exactly 180 degrees from the supplied front. Back faces camera squarely, perfectly symmetric body/antennae/accessories/feet around x=627. Both headphones appear equally edge-on at the same height and size; no broad cyan ear face aimed at the camera and no 3/4 rotation. Two antennae and two feet have the same spacing/heights as front image 3. Arms hang down equally at the same height.
The BACK IS A PLAIN CONTINUOUS BLUE SURFACE: no visor, no eyes, no chest button, no circle or control panel on the back. Option C's fused low rear lift spans the width as ONE gently upturned rounded surface; from this exact back elevation it reads as a single smooth lower volume above both feet, never two lobes or a central seam. No separate tail or spine. No duplicated frontal features. Output one square, ideally 1254 x 1254.
```

Native output: `C:\Users\king\.codex\generated_images\01a1bdb4-f49a-71f1-91e7-7443854c6d09\exec-6baca9c3-5dcb-4cb5-bce5-218c8194ff9f.png`.

Retained native: `D:/desk/webip/ip/A_zhi/.omx/state/round-5/C_back-attempt-1-native.png`.

Independent native visual verdict: **95/100, pass**. Level bilaterally aligned back elevation preserves front proportions and accessory levels. Back remains one uninterrupted blue surface without controls, face, cleft or paired rump volumes.

Regenerations: **0**. No geometry or identity mismatch warranted regeneration.

### Round 5 technical export and verification

- `option_A2.png`: **1680 × 945**, exactly 16:9 and matching the Round 4 sheet canvas. The native 1672 × 941 render gained only 4 white pixels on each horizontal side and 2 on each vertical side. Its entire native region is pixel-identical to the generated source (ImageMagick absolute pixel error **0**). No scaling, warping or creative geometry edits.
- `C_front.png`, `C_left.png`, `C_back.png`: **1254 × 1254** each. Each final figure is exactly **1004 pixels high**, begins at **y=125**, and has **125-pixel top and bottom margins**; its horizontal bounding box is centred to within half a pixel.
- All three C renders use neutral standing poses, arms down, level orthographic elevations and no ground shadows. The plain back has no added visor/button. The single fused rear lift is most clearly visible in C left; no cleft or paired cheek volumes were introduced.
- The image generator's native white background had tiny near-white RGB fluctuations. Technical export flood-filled only the connected near-white exterior to exact **#FFFFFF**, trimmed white exterior only, resized each image uniformly to the common figure height, and placed it on a square white canvas. No anisotropic stretching, sculpting, feature replacement or silhouette redesign was performed. Native non-white bounds were front `744x1058+254+99`, left `524x1063+373+95`, back `740x1058+257+99`.
- Final non-white bounds: front `706x1004+274+125`; left `495x1004+379+125`; back `702x1004+276+125`. Side width naturally differs from front/back in orthographic projection.
- The native C consistency review passed **94/100**. Canvas/height differences were handled during export rather than regenerating otherwise accepted geometry.
- The original references remain byte-for-byte unchanged: `main.png` SHA-256 `3fb584dc161cdbfab79e006aad31c908fe836aa3bf893e2fed513ecb6db7f634`; `option_A.png` SHA-256 `4265258b071a422cc9d23f385f848c07c5722a5fdd4ba05d13383c3b53594ed1`; `option_C.png` SHA-256 `b3c89ff04dc1661782c24513bb646cb55dd2f9a62f0baf6d3013d2dfd57a0936`.
- Deliverables added in the current folder: `option_A2.png`, `C_front.png`, `C_left.png`, `C_back.png`. This Round 5 section was appended to `notes.md`; all prior notes are preserved byte-for-byte.
- Prompts, native outputs, independent verdicts, technical export script and verification data are retained in `.omx/state/round-5/`.
- Simplification: retained each accepted first-generation design and applied only technical white-background/canvas normalization; no extra creative variants or dependencies were introduced.
- Verification limits: these are AI-generated 2D reconstruction references. Identical global figure height and canvas alignment are measured; a calibrated shared 3D mesh and exact local 3D correspondence were not produced or tested. No application code changed, so lint, typecheck and application tests do not apply.
- Final independent export review: **95/100, pass**. All four exported files preserve the reviewed geometry, palette and features without visible edge damage, clipping, distortion or background artifacts; C's height and margins match across all three images.

