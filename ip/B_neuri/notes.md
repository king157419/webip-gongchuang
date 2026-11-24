# Neuri / 元元 — image-generation notes

## Saved deliverables

All six final PNG files are saved directly in `D:\desk\webip\ip\B_neuri`.

| File | Native pixel dimensions | Format |
| --- | --- | --- |
| main.png | 1254 × 1254 | 1:1 |
| turnaround.png | 1672 × 941 | 16:9 target; native raster rounding |
| expressions.png | 1254 × 1254 | 1:1 |
| flat.png | 1254 × 1254 | 1:1 |
| scene_poster.png | 1086 × 1448 | 3:4 |
| scene_merch.png | 1448 × 1086 | 4:3 |

Method: built-in `image_gen.imagegen` tool, with an opaque background (`transparent_background: false`) on every call. Eight generations total: six selected final images plus two rejected first attempts. Images were copied from the tool's generated-images directory without external visual editing, recoloring, cropping or resampling.

## Design lock and interpretation

- `main.png` was generated first. Its second attempt was selected as the final three-quarter hero and the authoritative character reference for every other deliverable.
- The character is one mint mochi body with two fused arm nubs, two fused feet, one thick curl with a yellow tip, exactly three forehead nodes joined into a triangle, black oval eyes, pink cheeks and a cream belly.
- The brief says “3–4 colours” but explicitly prescribes five named colors plus black eyes and white highlights. The prompts preserve every explicitly named color, treating deep teal as the shadow/outline tone of the mint body and pink/cream as small accents.
- The requested floating question-mark shape appears only in the puzzled expression panel as a pictorial overlay. It is not a floating component of the physical figurine.
- The merchandise generation references both `main.png` for the sculpt and final `flat.png` for printed keychain/sticker artwork.
- `flat.png` is a PNG of vector-style artwork, as requested; it is not an editable SVG.
- The turnaround targets 16:9. The tool returned a native 1672 × 941 raster, approximately 0.053% narrower than mathematically exact 16:9 because of pixel rounding. The image was preserved without external resizing.
- Rendered colors include material lighting and small raster variations; the supplied hex values are the explicit palette targets in the prompts.
- Figurine proportions and fused features are intended for printing. No 3D mesh, STL or physical print was part of this image-only delivery, so manufacturing tolerances remain for the modeller to verify.

## Problems and regenerations

1. **main.png, attempt 1:** the output was essentially frontal despite the requested three-quarter view. Visual verdict: revise, 83/100. Regenerated with a targeted camera correction using that first image as the identity/edit reference. Attempt 2 passed, 96/100, and became `main.png`. Rejected image retained at `.omx/state/neuri/main-attempt-1.png`.
2. **flat.png, attempt 1:** the avatar matched the design but had unwanted soft gradients and shading. Visual verdict: revise, 87/100. Regenerated with main.png and the first flat image as references, specifying solid fills. Attempt 2 passed. Rejected image retained at `.omx/state/neuri/flat-attempt-1.png`.
3. No on-model regenerations were needed for the turnaround, expressions, poster or merchandise image. An independent visual reviewer passed the turnaround, expression sheet, flat avatar and poster. The same independent reviewer also passed the final merchandise image: all three product types, matching character features, and no text.

## Verification

- All six requested filenames exist in this folder and decode as PNG images.
- Square hero, expressions and flat avatar; exact 3:4 poster; exact 4:3 merchandise; turnaround raster rounding is disclosed above.
- Turnaround: front, side and back in the requested order, common baseline, neutral pose, no view labels.
- Expression sheet: waving, puzzled with one requested question-mark pictogram, cheering with both arms up, and sleepy.
- Flat avatar: clean thick outline, flat color regions, readable silhouette and face at icon scale. Pixel samples from several body-fill regions differed only by a few raster RGB values, consistent with nearly uniform fills.
- Poster: top approximately 37% is clear, exceeding the requested empty top 35%; inviting mascot in the lower middle with a supported learning tile.
- Merchandise: figurine, clear acrylic keychain and a four-sticker sheet, on a clean desk in natural light.
- No added words, letters, logos or watermarks. The expression sheet's requested question-mark pictogram is the deliberate exception.
- No source code, dependencies or build configuration were changed; code lint/typecheck/test tasks are not applicable to these PNG/Markdown deliverables.
- Visual verdicts are persisted under `.omx/state/neuri/ralph-progress.json`.

## Exact image-generation prompts

The blocks below are the complete strings submitted to the image tool, without omitted shared prompt fragments. References are listed in the same order used in each call.

### main.png — attempt 1

Outcome: revised: camera too frontal.

Reference images:
None; new hero design.

Exact prompt:

```text
Use case: stylized-concept / product-mockup.
Create the definitive hero image of an original university AI-club mascot called Neuri: a cute neuron that learns. Square 1:1 canvas, full body in a three-quarter FRONT view, centered with comfortable margins, camera at its eye level. Plain very light cream-white seamless studio background, soft studio lighting and a gentle contact shadow. Premium matte soft-vinyl / painted resin designer-toy render, with smooth rounded surfaces and subtle realistic material texture.

CHARACTER DESIGN TO LOCK:
One softly squashed round mint-teal mochi/dumpling body, a single continuous head-and-body mass, broader than tall, with a flat-ish underside. Two short thick rounded arm nubs fused directly to the sides and two small chunky foot nubs fused to the bottom, both feet resting flat on the floor. No hands or fingers. Exactly ONE short thick mint-teal curl/cowlick on the top center of its head, gently curling toward the character's left (viewer-right in a front view) and ending in one small warm-yellow round glowing node. The curl is very compact and sturdy, with no long thin stem. Exactly THREE additional small warm-yellow circular nodes are embedded into the upper forehead, arranged as a compact shallow triangular constellation, linked by subtle low-relief mint/deep-teal embossed lines on the body surface. These three forehead nodes and their connecting lines are surface decoration, never detached pieces. Two large simple glossy BLACK vertical oval eyes, each with a small white catchlight, a tiny happy curved mouth, two soft pink cheeks. A simple small cream-white oval belly patch is placed below the face on the lower front, leaving the face and forehead constellation fully visible. Friendly curious beginner personality, extremely cute, soft and welcoming, while original.

PALETTE: body mint-teal #5ED6C1; deep teal #127C74 only for shadow accents, subtle embossed connections and mouth; warm yellow #FFD54A for the four node circles total (three forehead + one curl tip); soft pink #FF9AA8 only for cheeks; cream-white #F6FFF9 belly and background; black eyes with white highlights. These specified accents are the only colors; do not invent any new hues. Glow is restrained, preserving crisp round nodes and matte body.

MANUFACTURING CONSTRAINTS: plausible sturdy single-piece approximately 7 cm tall FDM/resin-printable collectible; chunky silhouette, fused limbs, stable flat feet, thick attached curl, all decorative marks painted or shallow embossed; at most five physical parts, preferably one continuous sculpt. No thin wires, floating components, long antennae, separate fingers, accessories, clothes, platforms or display bases.
NO text, letters, numbers, typography, logos, labels, signatures or watermarks anywhere. Do not imitate any famous existing character. Render exactly one character. Output a high-resolution square PNG.
```

### main.png — attempt 2

Outcome: accepted.

Reference images:
1. `C:\Users\king\.codex\generated_images\01a1bb78-8318-7b10-abe2-ff7515f37241\exec-60eb0dd4-1f66-4baa-93d4-281a45ad7799.png`

Exact prompt:

```text
Use case: identity-preserve / product-mockup.
Input image 1 is the character identity reference and the hero edit target. Keep this EXACT original Neuri mascot: same mint-teal single mochi body, same two fused thick arm nubs and flat foot nubs, same one thick curled teal cowlick with one yellow end-node, same exactly three yellow forehead nodes linked by a shallow embossed triangle, same black oval eyes with white highlights, pink cheeks, happy small mouth, cream oval belly, matte resin surface, colors and proportions.

Make ONE targeted correction: rotate the complete sculpt to a visibly three-quarter FRONT view, approximately 35 degrees of yaw. The character faces diagonally toward the left side of the image. The camera sees the front and the character's left side; the near-side cheek, arm and foot are visibly closer/larger, the opposite side recedes, the belly oval is foreshortened, the forehead constellation wraps with the curved surface. This must be a clear three-dimensional three-quarter view with asymmetric perspective, not a symmetric straight-on front view. Keep both eyes visible and friendly. Do not merely shift the lighting on a front view.

Square 1:1 high-resolution PNG, full body with all feet and curl in frame, centered with comfortable margins, eye-level camera, plain very light cream-white studio background, soft diffused studio light and contact shadow, premium matte soft-vinyl / painted resin designer-toy render.
Exact palette remains #5ED6C1 mint body, #127C74 deep-teal shadow/embossed/mouth accents, #FFD54A four yellow nodes total, #FF9AA8 cheeks, #F6FFF9 belly; glossy black eyes with white catchlights. No new hues, garments, props, extra limbs, extra nodes, base or decorative symbols. All limbs and the short thick curl remain attached, chunky and plausible for a stable approximately 7 cm one-piece printed figurine. NO text, letters, labels, numbers, logos, signatures or watermarks. Exactly one character.
```

### turnaround.png — attempt 1

Outcome: accepted; independent visual review passed.

Reference images:
1. `D:\desk\webip\ip\B_neuri\main.png`

Exact prompt:

```text
Use case: stylized-concept / scientific-educational.
Asset: a professional model-sheet PNG for 3D modelling and printing, EXACT 16:9 landscape canvas (for example 2048 by 1152 pixels). Plain pure white background.
Input image 1 is main.png, the authoritative character design reference. Reproduce EXACTLY that original Neuri design, not a reinterpretation: a single squashed round mint-teal mochi head/body; two short thick arm nubs attached at the sides; two chunky flat-bottom foot nubs fused at the bottom; exactly ONE thick compact curl bending toward the character's left (viewer-right in a front view), with ONE yellow round node at its tip; exactly THREE additional yellow round nodes on the front forehead, one above two others, connected by three shallow embossed teal lines into a triangle. These forehead nodes and lines occur only on the front. Two glossy black oval eyes with white catchlights, small happy mouth, pink cheek ovals, cream oval belly below the face. Keep the same feature placement, body-to-curl scale, nub anatomy and proportions. No neck, ears, tail, hair, clothes or fingers. The back is plain mint-teal, without a belly patch, face or extra nodes. Exact palette: mint #5ED6C1, deep teal #127C74 accents/outlines/shadows, yellow #FFD54A nodes, pink #FF9AA8 cheeks, cream #F6FFF9 belly, black eyes and white catchlights; no extra hues. The yellow nodes can glow softly but stay clearly delineated. All physical character features are sturdy, fused, thick and suitable for an approximately 7 cm stable single-piece figurine; no thin wires, long antennae, detached components or floating physical parts. Original university AI-club mascot, curious, friendly, very cute.

Show exactly THREE orthographic views side by side, in this left-to-right order: FRONT at 0 degrees, a true LEFT SIDE profile at exactly 90 degrees, and BACK at exactly 180 degrees. Same single sculpt, neutral standing pose, arms relaxed, equal scale, equal total height, curl tips aligned on a common top line, all feet on one common floor baseline. Generous equal spacing and margins. Orthographic projection: NO perspective and NO three-quarter view in any column. Complete body and curl are visible in all views; do not crop.

FRONT shows both eyes, both cheeks, the little smile, the three-node forehead triangle, cream belly, both side arm nubs and both feet. The curl tip bends toward viewer-right in the front view, precisely matching the reference. SIDE is a genuine profile: one eye and cheek near the front edge, cream belly visible only as a narrow curved front edge; near arm projects from the side, far arm/foot largely occluded; the front forehead decoration is correspondingly edge-on rather than drawn as another frontal face. BACK shows the smooth undecorated mint back and backs of attached arms and feet, with no eye, cheek, mouth, forehead triangle or belly; the curl direction reverses in the rear projection because it is the same three-dimensional sculpt. Do not mirror a front view to invent the back.
Match the reference matte resin / soft vinyl finish, with soft neutral studio lighting and very faint ground contact shading. No pedestal, no scale bars, no annotation arrows, no headings or captions. NO text, numbers, letters, view labels, logos or watermarks. Output exactly one wide sheet, not a collage with extra angles.
```

### expressions.png — attempt 1

Outcome: accepted; independent visual review passed.

Reference images:
1. `D:\desk\webip\ip\B_neuri\main.png`

Exact prompt:

```text
Use case: stylized-concept / illustration-story.
Asset: a square 1:1 PNG expression sheet in a clean equally spaced 2x2 grid. Four full-body depictions of the SAME locked Neuri character, one per quadrant, all at the same scale, all curls and feet completely in frame. Plain very light cream-white background with no borders, separators or panel labels. Match the premium matte soft-vinyl / resin 3D appearance of the reference.
Input image 1 is main.png, the authoritative character design reference. Reproduce EXACTLY that original Neuri design, not a reinterpretation: a single squashed round mint-teal mochi head/body; two short thick arm nubs attached at the sides; two chunky flat-bottom foot nubs fused at the bottom; exactly ONE thick compact curl bending toward the character's left (viewer-right in a front view), with ONE yellow round node at its tip; exactly THREE additional yellow round nodes on the front forehead, one above two others, connected by three shallow embossed teal lines into a triangle. These forehead nodes and lines occur only on the front. Two glossy black oval eyes with white catchlights, small happy mouth, pink cheek ovals, cream oval belly below the face. Keep the same feature placement, body-to-curl scale, nub anatomy and proportions. No neck, ears, tail, hair, clothes or fingers. The back is plain mint-teal, without a belly patch, face or extra nodes. Exact palette: mint #5ED6C1, deep teal #127C74 accents/outlines/shadows, yellow #FFD54A nodes, pink #FF9AA8 cheeks, cream #F6FFF9 belly, black eyes and white catchlights; no extra hues. The yellow nodes can glow softly but stay clearly delineated. All physical character features are sturdy, fused, thick and suitable for an approximately 7 cm stable single-piece figurine; no thin wires, long antennae, detached components or floating physical parts. Original university AI-club mascot, curious, friendly, very cute.

Only expression and the angle of the short fused arm nubs vary:
TOP LEFT: happy, warmly waving hello with one thick arm nub raised at the shoulder, big open friendly eyes, small joyful smile.
TOP RIGHT: thinking/puzzled, one short nub resting beside its cheek, subtly asymmetric inquisitive eyes and a tiny unsure mouth. Beside its head show one small warm-yellow three-dimensional QUESTION-MARK-SHAPED pictorial thought symbol with a round dot. This is the only allowed floating pictogram and only in this panel; it is a graphic overlay, not part of the printable sculpt. No words or other text.
BOTTOM LEFT: cheering after learning something, both short thick arm nubs raised upward while still fused to the body, excited eyes, joyful open smile. No extra celebration objects or sparkles.
BOTTOM RIGHT: sleepy, eyelids closed in two soft curves, a small relaxed mouth, slightly drooping attached arm nubs; no tears, sleeping letters, cloud, hat, pillow or extra symbols.

Across every panel keep the same exact body silhouette and scale, four yellow nodes total on the character, same curl direction and thickness, same three forehead-node locations and triangle, same cream belly, same cheeks, same two legs and two arms; do not add fingers or lengthen limbs. Standing feet remain flat and attached in each pose. Poses must still look like variants of the same chunky printable toy. Soft even studio light and understated contact shadows. NO written text, lettering, numbers, labels, logos or watermarks. The single requested question-mark-shaped pictogram is the sole exception to the no-symbol rule.
```

### flat.png — attempt 1

Outcome: revised: gradients instead of flat fills.

Reference images:
1. `D:\desk\webip\ip\B_neuri\main.png`

Exact prompt:

```text
Use case: logo-brand / style-transfer.
Asset: square 1:1 high-resolution PNG, a flat 2D vector-style mascot illustration for an avatar, centered and facing exactly FRONT. Plain white background. This must look like clean polished vector artwork, not a 3D render, photograph, pencil drawing or textured painting.
Input image 1 is main.png, the authoritative character design reference. Reproduce EXACTLY that original Neuri design, not a reinterpretation: a single squashed round mint-teal mochi head/body; two short thick arm nubs attached at the sides; two chunky flat-bottom foot nubs fused at the bottom; exactly ONE thick compact curl bending toward the character's left (viewer-right in a front view), with ONE yellow round node at its tip; exactly THREE additional yellow round nodes on the front forehead, one above two others, connected by three shallow embossed teal lines into a triangle. These forehead nodes and lines occur only on the front. Two glossy black oval eyes with white catchlights, small happy mouth, pink cheek ovals, cream oval belly below the face. Keep the same feature placement, body-to-curl scale, nub anatomy and proportions. No neck, ears, tail, hair, clothes or fingers. The back is plain mint-teal, without a belly patch, face or extra nodes. Exact palette: mint #5ED6C1, deep teal #127C74 accents/outlines/shadows, yellow #FFD54A nodes, pink #FF9AA8 cheeks, cream #F6FFF9 belly, black eyes and white catchlights; no extra hues. The yellow nodes can glow softly but stay clearly delineated. All physical character features are sturdy, fused, thick and suitable for an approximately 7 cm stable single-piece figurine; no thin wires, long antennae, detached components or floating physical parts. Original university AI-club mascot, curious, friendly, very cute.

Translate the SAME locked reference character into simple flat geometry: one round squashed mochi silhouette, same fused thick arm and foot nubs, same thick top curl ending in yellow, the same triangular constellation of exactly three yellow forehead dots joined by teal lines, same oval black eyes with simple white highlights, same small smile, pink cheeks and cream oval belly. Strong clean deep-teal #127C74 outline with consistent thick stroke, approximately 1.3 percent of image width; rounded joins and caps. Preserve the curl's orientation: toward viewer-right when seen from the front. Keep silhouette and facial features large and clean so this avatar remains immediately readable at 48 by 48 pixels. Simple mint flat fill, no more than two restrained teal shading tones, no gradients, glow haze, texture or realistic lighting. The three small forehead dots remain distinguishable and the face stays expressive. Full body with comfortable white margins; feet share a flat standing baseline. Do not add a sticker border, circular badge frame, accessories, extra symbols, extra nodes or another mascot. NO text, letters, numbers, logos, labels, signatures or watermarks.
```

### flat.png — attempt 2

Outcome: accepted; solid fills verified by pixel samples (only small raster variation), and independent visual review passed.

Reference images:
1. `D:\desk\webip\ip\B_neuri\main.png`
2. `C:\Users\king\.codex\generated_images\01a1bb78-8318-7b10-abe2-ff7515f37241\exec-ce068b54-4b74-4af4-a886-95a996b8ddc6.png`

Exact prompt:

```text
Use case: style-transfer / identity-preserve.
Input image 1 is main.png, the authoritative original Neuri character identity. Input image 2 is a nearly correct flat-avatar candidate and is the edit target. Preserve image 2's exact front-view silhouette, layout, facial feature placement, one thick curl toward viewer-right with one yellow tip node, three yellow forehead nodes and their connected triangle, fused arm and foot nubs, pink cheeks, white catchlights and cream belly. Preserve all reference identity features and colors.

Make one targeted correction: convert ALL COLOR REGIONS to STRICTLY UNIFORM SOLID FLAT FILLS. No gradients anywhere, no airbrush, no soft highlights or shadows, no light falloff, no noise or texture, no volumetric rendering, no shadows on the white background. The mint body is one solid #5ED6C1 fill. At most TWO discrete hard-edged teal shadow shapes in #127C74 or a single intermediate mint shadow tone are allowed, confined to the lower side of the body and nubs; each shape is a solid single color. Yellow node circles are exactly solid #FFD54A disks; cheek ovals exactly solid #FF9AA8; belly exactly solid #F6FFF9; eyes solid black with solid white highlights; outlines and smile solid deep-teal #127C74. Uniform thick clean outlines, smooth rounded joins. Every region reads like a closed vector shape filled with a paint-bucket tool. Keep yellow forehead nodes distinct at 48px, smile and eyes bold, all anatomy chunky.

Output one square 1:1 high-resolution PNG of this polished flat 2D vector-style illustration, full body FRONT view centered with clean white margins and plain pure white background. No 3D depth, realistic materials or studio lighting. No extra nodes, characters, props, sticker border, text, letters, digits, labels, logos or watermarks.
```

### scene_poster.png — attempt 1

Outcome: accepted.

Reference images:
1. `D:\desk\webip\ip\B_neuri\main.png`

Exact prompt:

```text
Use case: ads-marketing / stylized-concept.
Asset: a vertical recruitment-poster scene for a university artificial-intelligence club, EXACT 3:4 portrait aspect ratio (for example 1536 by 2048 pixels). No typography is to be generated; the user will add it later.
Input image 1 is main.png, the authoritative character design reference. Reproduce EXACTLY that original Neuri design, not a reinterpretation: a single squashed round mint-teal mochi head/body; two short thick arm nubs attached at the sides; two chunky flat-bottom foot nubs fused at the bottom; exactly ONE thick compact curl bending toward the character's left (viewer-right in a front view), with ONE yellow round node at its tip; exactly THREE additional yellow round nodes on the front forehead, one above two others, connected by three shallow embossed teal lines into a triangle. These forehead nodes and lines occur only on the front. Two glossy black oval eyes with white catchlights, small happy mouth, pink cheek ovals, cream oval belly below the face. Keep the same feature placement, body-to-curl scale, nub anatomy and proportions. No neck, ears, tail, hair, clothes or fingers. The back is plain mint-teal, without a belly patch, face or extra nodes. Exact palette: mint #5ED6C1, deep teal #127C74 accents/outlines/shadows, yellow #FFD54A nodes, pink #FF9AA8 cheeks, cream #F6FFF9 belly, black eyes and white catchlights; no extra hues. The yellow nodes can glow softly but stay clearly delineated. All physical character features are sturdy, fused, thick and suitable for an approximately 7 cm stable single-piece figurine; no thin wires, long antennae, detached components or floating physical parts. Original university AI-club mascot, curious, friendly, very cute.

Composition is crucial: the TOP 35 PERCENT of the entire canvas is completely EMPTY clean pale cream #F6FFF9 negative space suitable for a large headline. No character curl, shapes, floating nodes, texture, horizon, objects, decorative lines or light flares may intrude into this top 35 percent. Keep this area visually quiet and uninterrupted.

Place one large full-body Neuri in the LOWER MIDDLE, with its tallest curl safely below the 38-percent line, and feet near the bottom 90-percent line. The mascot faces the viewer in a slight friendly three-quarter angle, warmly inviting new members: one short thick rounded arm reaches outward in a welcoming gesture; the other thick fused arm rests against and supports a small cream square learning tile beside its belly, the tile bearing only a simple embossed teal branching-node diagram made from three round dots and two thick lines, without text or letters. Keep the entire cream belly and the three-node forehead constellation identifiable. All fingers are absent and arms stay short and chunky. The tile is visibly supported, never floating.

Premium matte resin / soft-vinyl 3D render with gentle soft studio-like lighting and a restrained glow on the four yellow character nodes. Calm uncluttered environment: a pale cream backdrop and at most two very low rounded mint/teal stepped shapes along the bottom corners that suggest a shared learning space. These background shapes remain below the character's shoulder line, leaving generous open breathing room. Colors only from the specified palette. No extra characters, scattered tech icons, screen interfaces, circuitry clutter, poster borders or display plinth under the character. Stable flat feet and chunky printable character anatomy match the reference. NO text, numbers, letters, punctuation, logos, watermarks or signatures anywhere. Output exactly one portrait scene.
```

### scene_merch.png — attempt 1

Outcome: accepted.

Reference images:
1. `D:\desk\webip\ip\B_neuri\main.png`
2. `D:\desk\webip\ip\B_neuri\flat.png`

Exact prompt:

```text
Use case: product-mockup / photorealistic-natural.
Asset: realistic product photo mockup, EXACT 4:3 landscape PNG (for example 2048 by 1536 pixels). Photograph a small coordinated set of university AI-club mascot merchandise on a clean cream-white desk, with natural soft window light, realistic contact shadows and subtle material detail. Uncluttered composition, no people or hands, no branding or typography.
Input image 1 is main.png, the authoritative character design reference. Reproduce EXACTLY that original Neuri design, not a reinterpretation: a single squashed round mint-teal mochi head/body; two short thick arm nubs attached at the sides; two chunky flat-bottom foot nubs fused at the bottom; exactly ONE thick compact curl bending toward the character's left (viewer-right in a front view), with ONE yellow round node at its tip; exactly THREE additional yellow round nodes on the front forehead, one above two others, connected by three shallow embossed teal lines into a triangle. These forehead nodes and lines occur only on the front. Two glossy black oval eyes with white catchlights, small happy mouth, pink cheek ovals, cream oval belly below the face. Keep the same feature placement, body-to-curl scale, nub anatomy and proportions. No neck, ears, tail, hair, clothes or fingers. The back is plain mint-teal, without a belly patch, face or extra nodes. Exact palette: mint #5ED6C1, deep teal #127C74 accents/outlines/shadows, yellow #FFD54A nodes, pink #FF9AA8 cheeks, cream #F6FFF9 belly, black eyes and white catchlights; no extra hues. The yellow nodes can glow softly but stay clearly delineated. All physical character features are sturdy, fused, thick and suitable for an approximately 7 cm stable single-piece figurine; no thin wires, long antennae, detached components or floating physical parts. Original university AI-club mascot, curious, friendly, very cute.

Show exactly these THREE merchandise types together, clearly visible and arranged with breathing room:
1. One approximately 7 cm tall painted 3D-PRINTED FIGURINE of Neuri, standing at the left-center. Exact same sculpt and colors as main.png, a friendly three-quarter front view, stable fused feet. Give its matte resin or very fine FDM surface subtle realistic manufacturing texture, not coarse ridges. Same thick curl, one yellow curl-tip node, three yellow linked forehead nodes, oval black eyes, pink cheeks and cream belly. No display base.
2. One CLEAR ACRYLIC KEYCHAIN lying flat near the front right, with realistic transparent acrylic edge thickness and one simple metal split ring attached through a small clear tab. The printed artwork is a FRONT-VIEW FLAT VECTOR version of the exact same character: deep-teal thick outline, flat mint fill, the same three-node forehead triangle, one yellow curl tip, cream belly, pink cheeks, black oval eyes. The metal split ring is ordinary neutral silver hardware, not an extra color on the mascot. The acrylic is one continuous die-cut piece around the character.
3. One small rectangular white STICKER SHEET lying on the desk at the rear right, with FOUR neatly spaced die-cut character stickers in a 2x2 arrangement. All four depict the same flat vector Neuri, same curl direction, same three forehead nodes, same belly, same proportions and colors; tiny friendly pose variations are fine. Clear subtle kiss-cut outlines, no graphic filler and no words.

Camera is a natural tabletop three-quarter perspective from modestly above, enough depth of field for all three product types to read. Realistic clear acrylic refraction, gentle metal reflections, uncoated paper texture, soft daylight. Desk and background remain clean neutral cream, keeping the mascot palette dominant; no wood grain, packaging boxes, laptops, pens, books, plants, extra figurines or unrelated merchandise. No unsupported or floating toy parts. NO text, letters, numbers, logos, labels, sticker captions or watermarks on any item or in the image.

Input image 2 is flat.png, the FINAL authoritative flat-vector artwork reference. Use image 2's exact front-view outline, face, node layout and flat illustration treatment for the acrylic keychain and each sticker; use image 1 main.png for the figurine's three-dimensional sculpt and colors. Match both references as a coherent single character collection.
```

