# Tong image generation notes

All six final PNGs are saved directly in this folder. Generated with the built-in image_gen tool; no API/CLI generation fallback was used.

## Saved deliverables

| File | Native pixel dimensions | Aspect | Final selection |
| --- | --- | --- | --- |
| main.png | 1254 x 1254 | 1:1 | Hero, corrected camera; attempt 2 |
| turnaround.png | 1672 x 941 | nominal 16:9 | Front, side and back; attempt 1 |
| expressions.png | 1254 x 1254 | 1:1 | 2x2 hello, puzzled, cheering, sleepy; attempt 1 |
| flat.png | 1254 x 1254 | 1:1 | Front-view flat illustration; attempt 2 |
| scene_poster.png | 1086 x 1448 | 3:4 | Inviting pose, top 35% empty; attempt 1 |
| scene_merch.png | 1448 x 1086 | 4:3 | Figurine, acrylic keychain, sticker sheet; attempt 2 |

## Locked design

The accepted second main.png generation is the visual identity reference for every derivative. The chosen accessory is the plain cobalt circular message-bubble chest badge with a short lower-right nub; no satchel or strap. The body is one round cream mass with tiny fused wings, two short orange flat-soled feet and a single connected coral Wi-Fi fin whose three arc ridges are defined by recessed curved channels. The design uses the brief's cream, coral, cobalt and light grey-beige palette, with eye neutrals and coral-tinted cheeks.

All follow-up prompts used main.png as an image reference. The merchandise prompts additionally used the accepted flat.png artwork.

## Problems and regenerations

1. main.png: attempt 1 was almost frontal. Attempt 2 preserved the design and made the three-quarter front view clear. Attempt 2 is final.
2. flat.png: attempt 1 retained visible gradient shading. Attempt 2 requested uniform flat ink fills and retained the front-view silhouette and bold cobalt outlines. Attempt 2 is final.
3. scene_merch.png: attempt 1 added sleep letters, a question mark and action marks to the sticker sheet. Attempt 2 removed those exterior marks while preserving all three products, the lighting and the character. Attempt 2 is final.
4. turnaround.png, expressions.png and scene_poster.png were accepted on their first generation.
5. expressions.png intentionally contains the small question-mark-shaped overlay explicitly requested for the puzzled panel. It is an editorial expression symbol, not a floating anatomical or printable part. The other images contain no lettering or caption typography.
6. The built-in tool returned turnaround.png at 1672 x 941 pixels: nominal 16:9 with less than one pixel of vertical ratio rounding (exact 16:9 at this width would be 940.5 pixels tall). This native output was preserved. The poster and merchandise output ratios are exactly 3:4 and 4:3.

## Verification

Each final image was visually checked against the brief and main.png for character identity, composition, pose, palette, attached chunky anatomy and unwanted text. The turnaround contains aligned front, side and back views; the expressions sheet has four requested actions; the poster leaves its top 35% clear; the merchandise image contains a figurine, acrylic keychain and sticker sheet. PNG signatures, decoding, dimensions and distinct file hashes were checked locally. These are visual design and printing references; no mesh, slicer or physical print was part of this image task.

The prompts below are recorded verbatim, including the unsuccessful first attempts. All image_gen calls used transparent_background=false. Input references are listed in their actual supplied order. Relative main.png and flat.png references resolve to this folder; discarded candidates remain at their original generated-image paths and are not extra deliverables.

## main.png — attempt 1 (superseded)

Image references: none; brand-new generation.

```text
Use case: stylized-concept.
Asset: main.png, the master design for Tong, an original signal-bird messenger mascot for Shanghai University AI Club. Produce one finished square 1:1 PNG, ideally 1536 x 1536 or higher.
A premium matte soft-vinyl / painted resin designer-toy hero render, full body in a three-quarter front view, standing on its own two feet, centered with generous clear margins on a plain very light warm-white studio background. Soft large-area studio lighting, gentle contact shadow, no pedestal.
Character: a perfectly round, chubby single ball-shaped bird body, almost spherical, no separate neck or separate head, no tail. Two tiny rounded stubby wings fused closely to the sides, with broad roots and no fingers. Two very short coral-orange feet with broad flat soles and blunt rounded fronts, joined directly to the underside, no thin ankles or fine toes. Body warm cream-white #FFF6E8, with a very subtle light grey-beige #E9DCC8 belly area.
Signature crest: a clearly recognizable Wi-Fi signal-wave crown, coral-orange #FF7A45, centered on the top of the head and facing forward in the same plane as the face. THREE nested rounded rainbow-like arches, but built as ONE thick continuous chunky solid fin: join all three arches with a substantial common basal web and side bridges; separate their faces with shallow recessed curved channels, never open unsupported gaps. Broad fin-to-head attachment, rounded edges. The solid crest must remain physically connected everywhere and easy to print at 7 cm figurine scale.
Face: two big round glossy near-black eyes with small white highlights, a tiny simple triangular coral-orange beak, soft rosy cheeks made with a light tint of the same coral-orange. Friendly bright cheerful expression.
The ONE accessory is a small cobalt-blue #2F5BEA circular message-bubble badge with a short rounded integral lower-right nub, fused as shallow relief to the center of the chest. Badge is completely plain, with no writing or marks. No bag or strap.
Lock proportions: body diameter about 70 percent of overall height; crest about 20 percent; short feet about 10 percent. Tiny wings about one quarter of body height. Eyes widely spaced on upper front, tiny beak between them, badge below beak.
Use only the four specified character hues, with near-black/white reserved for eyes and lighting. Smooth tactile matte surfaces, not actual feathers or fur. The construction reads as one fused printable object with at most five major volumes, no fragile appendages.
No text, letters, digits, labels, logos, watermark, border, props, floating parts, wires, thin antennae, long fingers, extra head tuft or famous-character imitation. Original design.
```

## main.png — attempt 2 (final)

Image references, in order:

1. `C:\Users\king\.codex\generated_images\01a1bb78-832b-7573-8658-901d4c6ae14c\exec-40be9a1f-9c83-42e0-ae2e-ad89f674ca64.png`

```text
Use case: identity-preserve.
Asset: corrected main.png master hero, square 1:1.
Input image 1 is the character identity and material reference. Preserve this exact original bird: the spherical cream single body, broad joined coral three-arc Wi-Fi fin with recessed grooves, two glossy dark eyes, triangular orange beak, coral cheeks, plain cobalt circular message-bubble chest badge with lower-right nub, tiny fused wings, subtle beige belly, two short orange flat-soled feet. Preserve the exact shape, scale, colors and matte soft-vinyl / resin material. No redesign.
Change only the viewpoint: show an unmistakable THREE-QUARTER FRONT view. Rotate the whole standing character about 30 degrees toward the viewer's right, with the nearer left side clearly visible. Its beak points diagonally toward the right edge; the far eye and far wing are foreshortened; the fin and chest badge have matching perspective. Keep both eyes visible. Do not use an almost frontal or orthographic front view.
Full body with every part visible, centered, soft studio lighting, plain very light warm-white background and gentle floor contact shadow, no pedestal. Maintain a cute cheerful neutral standing pose, smooth matte surfaces. No text, labels, numbers, logos, watermark, props or detached parts. Original design, safe chunky 7 cm print silhouette. Output one finished square PNG.
```

## turnaround.png — attempt 1 (final)

Image references, in order:

1. `main.png`

```text
Use case: stylized-concept.
Asset: turnaround.png, a modeling reference sheet, WIDE LANDSCAPE canvas, EXACT aspect ratio 16:9, ideally 2048 x 1152. One image only.
Input image 1 (main.png) is the LOCKED character identity reference. Depict exactly that same original Tong bird toy; change only the viewing direction. Preserve its proportions, round cream single-mass body, no neck, no separate head, no tail, same eye spacing, tiny triangular orange beak, rosy coral-tinted cheeks, tiny fused rounded wings, two orange short flat-soled feet, the plain cobalt round message-bubble badge with short lower-right nub, and the broad one-piece coral Wi-Fi crest. Same four hues: #FFF6E8 body, #FF7A45 crest/beak/feet/cheek tint, #2F5BEA badge, subtle #E9DCC8 belly. Near-black and white only for eyes.
Composition: THREE full-body true ORTHOGRAPHIC views evenly spaced side by side in one horizontal row, all at exactly the same scale and baseline, with plenty of blank margin. LEFT: exact straight FRONT view with symmetrical face, both eyes, both wings and both feet. CENTER: exact 90-degree SIDE PROFILE facing right, only one visible eye and one visible wing; the beak and shallow chest badge project slightly at front. RIGHT: exact straight BACK view with both wings and feet and smooth blank cream back, no face and NO badge on the back. No perspective or three-quarter view anywhere.
Crest geometry must be consistent in all three views: one thick fin in the frontal plane with THREE nested rounded coral arc ridges connected by a solid basal web and side bridges; shallow grooves, never detached arcs. In side profile it is a narrow rounded thick plate seen edge-on; its broad arch face is NOT visible in true profile. Back shows the same fin's smoothly rounded rear and consistent silhouette, no new shapes. Feet soles share one horizontal floor line. No extra tail.
Matte soft-vinyl / resin rendering with gentle almost shadowless diffuse studio light. Pure white background, no dividers, no labels, no text, no letters, no numbers, no logos or watermark. This is a clean printing reference, not a perspective collage. Stubby fused limbs, no thin appendages, no floating parts, no pedestal. All three views fully inside the canvas. Output a 16:9 PNG.
```

## expressions.png — attempt 1 (final)

Image references, in order:

1. `main.png`

```text
Use case: stylized-concept.
Asset: expressions.png, square 1:1 character expression sheet, a clean evenly spaced TWO BY TWO GRID with FOUR complete full-body versions of exactly the same character. No panel labels or border lines.
Input image 1 (main.png) is the LOCKED character identity reference. Preserve this exact Tong design in all four cells: perfectly round warm cream #FFF6E8 single ball-bird body, subtle #E9DCC8 belly, no neck or tail; broad chunky solid coral-orange #FF7A45 crest formed by THREE nested curved arc ridges joined by a solid basal web and side bridges with shallow grooves; tiny coral triangular beak; coral-tinted rosy cheeks; glossy near-black round eyes or closed versions of those same eyes; plain cobalt #2F5BEA circular message-bubble badge with a short lower-right nub fixed on chest; tiny rounded fused wings without hands or fingers; two very short broad orange flat-soled feet. Same anatomy, body proportions, crest size, badge position and colors in every panel, matching main.png.
TOP LEFT: cheerful hello, big open bright eyes, one tiny wing lifted beside the body in a friendly wave; the wing stays short and broadly attached to body.
TOP RIGHT: thinking / puzzled, one tiny wing touching the cheek, eyes glancing upward, one slightly raised brow. Place ONE small floating coral question-mark-shaped PICTOGRAM beside the head, built visually as a rounded curved hook and separate dot. This is the brief's required editorial expression symbol in the background, not a physical part of the figurine. No other punctuation.
BOTTOM LEFT: celebrating a win with BOTH tiny wings lifted in a joyful V, eyes happily squeezed into smiling arcs; wings remain short, thick, softly rounded and broadly fused to sides. No long arms or fingers. Both feet remain standing.
BOTTOM RIGHT: sleepy, relaxed closed curved eyes and a slight gentle head/body lean, tiny wings resting at sides; feet flat, body still spherical. No sleep letters or extra symbols.
Style: the same high-quality matte soft-vinyl / resin toy rendering as main.png, soft diffuse studio lighting, plain very light warm-white background, gentle contact shadows. Same figure scale and baseline within each cell, ample white gutters, all crests, wings and feet completely inside their own cells.
No words, letters, numbers, labels, logos, watermark, props, wires or detached anatomical parts. The only floating graphic is the explicitly requested puzzled-expression pictogram. Original character, no imitation. Output one finished square PNG.
```

## flat.png — attempt 1 (superseded)

Image references, in order:

1. `main.png`

```text
Use case: style-transfer.
Asset: flat.png, a square 1:1 avatar/icon illustration delivered as PNG.
Input image 1 (main.png) is the LOCKED character design reference. Translate exactly this original Tong bird to a crisp FLAT 2D VECTOR-STYLE illustration, not a 3D render. Preserve the reference character silhouette, relative crest size, eyes, beak, cheeks, wings, two feet and plain message-bubble badge. Show a perfectly straight FRONT view, centered, full body on a pure white background with clear margin.
Character: one round chubby cream #FFF6E8 ball body with no neck, no separate head and no tail; two short fused rounded wings, two short broad flat-soled coral #FF7A45 feet. On top, the same broad ONE-PIECE solid coral Wi-Fi fin, with exactly THREE nested arch bands defined by TWO bold curved channels of a darker tint of the SAME coral, all bands joined at their bases and sides with no floating strokes. Two large round near-black eyes with one white shine each, tiny orange down-pointing triangle beak, simple light-coral round cheek fills. Plain cobalt #2F5BEA circular message bubble with short lower-right nub centered on lower chest; no lettering or interior marks. A single flat light grey-beige #E9DCC8 curved belly patch matching the hero.
Style: clean thick uniform rounded cobalt-blue outlines, perfectly smooth simple curves, flat solid fills, at most one additional flat shadow tone for the body and one darker coral tone for the crest channels. NO gradients, no airbrush, no texture, no 3D light, no floor shadow, no outline in a new hue. Keep all small details bold enough to read when the full bird is reduced to a 48-pixel avatar. Wings stay stubby and fused; crest stays chunky, not separate signal lines.
Use only the specified cream, coral, cobalt and beige character palette; near-black/white solely for eyes. No text, typography, letters, numbers, logos, watermark, border, props or extra symbols. Original design, same mascot as reference. Output one finished square PNG with opaque pure white background.
```

## flat.png — attempt 2 (final)

Image references, in order:

1. `main.png`
2. `C:\Users\king\.codex\generated_images\01a1bb78-832b-7573-8658-901d4c6ae14c\exec-a047d180-4be9-4c59-91c2-ec875c67348e.png`

```text
Use case: style-transfer.
Asset: final flat.png, square PNG.
Input image 1 is main.png, the locked character identity. Input image 2 is the flat illustration EDIT TARGET. Keep image 2's centered straight-front full-body pose, proportions, thick smooth cobalt outline, round body, short wings, broad feet, plain message-bubble badge, facial layout and connected Wi-Fi crest. Correct ONLY its coloring and rendering technique.
Make a truly FLAT screen-printed / SVG-style illustration with perfectly UNIFORM SOLID COLOR FIELDS throughout. Eliminate EVERY gradient, soft shading, material rendering, texture, highlight glow and lighting effect from the body, belly, crest, feet, beak, wings, cheeks and badge. The only white highlights are simple solid white circles in the black eyes. Interior pixels of each shape should have one unchanging ink color. Edges can be normally anti-aliased.
Use exactly these flat inks: body #FFF6E8; belly patch #E9DCC8; crest, beak and feet #FF7A45; outline and plain badge #2F5BEA; cheek circles a uniform light tint of the same coral; eyes solid near-black with flat white highlight circles. The crest is ONE broad coral filled silhouette with three nested rounded arc ridges, represented by three bold solid dark-coral curved groove marks whose ends stop inside the solid fin, never separate floating orange arcs. One uniform darker coral ink for those grooves only. No other shadow tones anywhere.
Pure white background. No floor shadow, no 3D depth, no new details. Match the character anatomy in main.png, including round cream single mass without a neck or tail, tiny fused wings, two flat-soled feet and cobalt round chest badge with lower-right nub. Full character visible with clean white margin. Bold enough to read at 48px.
No text, labels, letters, digits, logo, watermark, border, props or extra symbols. Deliver one final square PNG that looks like flat vector art with no continuous shading at all.
```

## scene_poster.png — attempt 1 (final)

Image references, in order:

1. `main.png`

```text
Use case: ads-marketing.
Asset: scene_poster.png, a vertical university AI club recruitment poster SCENE with no typography, PORTRAIT exact 3:4 aspect ratio, ideally 1536 x 2048.
Input image 1 (main.png) is the LOCKED character identity reference. Reuse precisely this same original Tong bird, proportions and materials. The character is one round warm cream #FFF6E8 ball, no neck or tail; very subtle #E9DCC8 belly; tiny rounded thick wings broadly fused to its sides; two short orange flat-soled feet. Same big shiny dark eyes, tiny coral triangular beak, coral-tinted rosy cheeks, plain cobalt #2F5BEA round chest message-bubble badge with lower-right nub. Same wide solid coral #FF7A45 Wi-Fi crest with three nested arch ridges joined as one chunky fin by a basal web and side bridges. No new accessory.
Composition is critical: TOP 35 PERCENT of the whole canvas must be a completely EMPTY calm cream field for a headline to be added later. Nothing at all in that top zone: no crest, no graphic, no light flare, no objects, no marks or text. Keep at least a little extra empty space below this zone. Place the FULL-BODY character large and centered in the LOWER-MIDDLE, with crest starting around 43 percent down and feet around 90 percent down. Its overall width about 65 percent of the canvas. Give it warm engaging eye contact, a gentle three-quarter front orientation and one short rounded wing raised and extended toward the viewer in an inviting come-join-us gesture, other wing tucked beside the chest badge. No fingers, no long arms, no floating parts.
Scene: uncluttered softly lit studio-like cream environment. A broad low pale cobalt-blue floor sweep enters only the bottom 15 percent, with a very subtle pale coral curved shape behind the character confined to the lower half. Gentle grounded contact shadow. Restrained palette strictly cream, coral, cobalt and light grey-beige with near-black/white eyes. Matte soft-vinyl / resin 3D designer-toy character, clear tactile form, soft welcoming studio lighting, suitable for university students.
No text, lettering, digits, logo, watermark, headline placeholder, fake glyphs, border, confetti, extra character, computer, equipment, props, platform, satchel or detached anatomy. Keep the composition calm and top headline space entirely blank. Output one finished portrait 3:4 PNG.
```

## scene_merch.png — attempt 1 (superseded)

Image references, in order:

1. `main.png`
2. `flat.png`

```text
Use case: product-mockup.
Asset: scene_merch.png, one realistic product photograph, LANDSCAPE 4:3 aspect ratio, ideally 2048 x 1536.
Input image 1 (main.png) is the LOCKED Tong character identity and 3D figurine reference. Input image 2 (flat.png) is the exact printed FLAT ARTWORK reference for the keychain and stickers. Keep the same character and colors on every product.
Scene: a clean pale warm-white desk under soft natural window light from the upper left. A carefully styled realistic small merchandise collection with THREE clear product types, each fully visible and separated enough to read: a standing 7 cm 3D-printed figurine, one acrylic keychain, and one small sticker sheet. Eye-level slightly elevated tabletop product camera, subtle depth of field while all products stay readable. Calm clean pale background, no busy room details.
LEFT / middle-ground: the hero 7 cm figurine in three-quarter front view, standing directly on its two broad orange feet without a base. Painted matte resin or finely printed polymer, subtle realistic fabrication surface but no exaggerated roughness. Exactly preserve the reference bird's spherical cream #FFF6E8 single body, subtle beige #E9DCC8 belly, short fused round wings, two short coral #FF7A45 flat-soled feet, glossy near-black eyes, tiny coral triangular beak, coral rosy cheeks, plain cobalt #2F5BEA round chest message-bubble badge with lower-right nub. The signature broad coral Wi-Fi fin is ONE thick connected part with three nested curved arc ridges and recessed channels, joined by basal web and side bridges, exactly as main.png. No tail, neck, bag or extra crest. Correctly scaled as a desk-size 7 cm figure.
FRONT / right: a single clear die-cut acrylic keychain about 5 cm tall lying naturally on the desk, showing precisely the straight-front flat illustration in input image 2: bold cobalt outlines, flat cream/coral/blue/beige fills, plain chest badge and connected crest. Visible clear acrylic edge, one small sturdy attachment hole and realistic silver split-ring hardware with a short chain. Hardware belongs to the keychain product, not to the printable bird.
BACK / right: one small white rectangular sticker sheet, about postcard size, lying at a slight angle. Six neatly spaced die-cut stickers in a 2-by-3 arrangement show the SAME flat bird design, with small variations of the requested hello, puzzled, cheering and sleepy poses. All preserve the reference crest, body proportions, colors and badge. White sticker cutline borders, no written captions and no extra unrelated graphics.
All products fit fully inside frame. Soft real shadows and realistic acrylic reflections. Use the four mascot hues and neutral white/cream desk; silver only for keychain hardware, black/white only for eyes and natural photographic neutrals. No typography anywhere: no words, letters, digits, price tags, logos, watermark, branding, labels, book spines, computer screens or packaging. No extra desk props, hands or characters. Original mascot. Output one finished landscape 4:3 PNG.
```

## scene_merch.png — attempt 2 (final)

Image references, in order:

1. `C:\Users\king\.codex\generated_images\01a1bb78-832b-7573-8658-901d4c6ae14c\exec-df11c960-c8a6-4466-b49b-91f397939ecf.png`
2. `main.png`
3. `flat.png`

```text
Use case: precise-object-edit.
Asset: final scene_merch.png, landscape 4:3 product photo.
Input image 1 is the merchandise photo EDIT TARGET. Input image 2 (main.png) is the locked figurine identity. Input image 3 (flat.png) is the locked keychain and sticker artwork.
Change ONLY the printed sticker sheet in the upper-right part of input image 1. REMOVE the two blue sleep letters, the blue question mark, and EVERY yellow/orange action ray, exclamation-style dash or other isolated graphic outside the bird silhouettes. Reconstruct clean plain white sticker-sheet areas wherever those symbols were. Each of the six die-cut stickers must contain ONLY one Tong bird with its connected crest, face, fused short wings, cobalt chest badge, belly and orange feet, surrounded by a simple white cutline. NO marks outside any bird. Sleepiness is shown solely by closed eyes. Excitement is shown solely by raised short wings and curved eyes. Puzzlement is shown solely by facial expression. Six bird-only stickers, no punctuation or letters whatsoever.
Preserve EVERYTHING else: same cream desk, same natural upper-left window lighting, same camera, same 4:3 crop, same realistic 7 cm matte printed figurine on the left, same acrylic keychain and silver ring in the foreground, same layout and product sizes, same six sticker positions and plain sheet. Figurine anatomy, three joined crest arches, eye/beak positions, feet and plain cobalt message-bubble badge must stay exactly as in main.png. Printed birds must match flat.png with bold cobalt outlines and cream/coral/cobalt/beige fills.
No text, letters, digits, word-like shapes, sleep-Z marks, punctuation, logos, watermark, labels or extra graphics anywhere. Use only the four mascot hues plus natural neutral material and metal colors. Do not alter the original character or introduce props. Output one complete finished landscape 4:3 PNG product photograph.
```


## Final independent review

A second agent reviewed all six final images and reported a visual pass, including character consistency, requested compositions, poster headline space and the absence of unintended lettering. The native turnaround ratio rounding is documented above.
