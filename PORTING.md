# Porting SCOS to the real S-CUBE 1 (ESP32-S3 + LVGL)

The web demo uses browser features that the ESP32-S3 (240 MHz dual-core, ~512 KB SRAM + 8 MB PSRAM,
no GPU) can't run as-is. This list shows what to swap for each effect when building the LVGL version.
Target: 480×480 AMOLED (CO5300 driver, QSPI), 16-bit colour, double buffers in PSRAM.

## Device look (v0.3+): build this one

The demo now defaults to **Account → Look → Device**. Every element in it maps to a stock LVGL 9 widget or
style property, and it animates at **30 fps**, a realistic full-screen rate for 480×480 RGB565 over QSPI.
**Concept** is still there for comparison, but it is *not* device-ready. The table further down explains why.

### Rules the Device look follows
- Only these properties are animated: `x`, `y`, `width`, `height`, `radius`, `opa`, and colours (`bg_color`, `bg_grad_color`, `border_color`, `text_color`, `img_recolor`).
- Gradients have ≤ 2 stops, vertical or horizontal only.
- No backdrop blur, shaders, masks, text gradients, per-glyph effects, or full-screen scale/zoom transitions.
- Soft shapes (glows, blobs) are **pre-rendered images** that move or recolour. Nothing is blurred at runtime.
- Animation phases are integrated per frame (`phase += dt × speed`). Never use `time × speed`, because changing the speed then makes the phase jump. That was the v0.1 flicker.

### Element → LVGL mapping
| Element | LVGL implementation |
|---|---|
| Glass buttons (Home, back, X) | `lv_button`, radius = LV_RADIUS_CIRCLE, `bg_color` white `bg_opa` 10 %, `border_width` 1–2 px white `border_opa` 16 %. Pressed state: `bg_opa` 18 % (no scaling). |
| Home background colour | One static 480×480 image (pre-rendered soft pink/violet/blue blobs, dithered). Not animated. |
| Voice button tint | 2-stop vertical gradient pink → blue, `bg_opa` ~50 %. |
| **Voice bubble** | `lv_obj` with `bg_color`/`bg_grad_color` (vertical) at 50 %/32 % opa, `border_width` 2 white at 32 %, `clip_corner = true`. The wobble animates `width`/`height` ±4 px (±14 px while thinking) in opposite phase, plus `radius` ±18 px while thinking, via `lv_anim`. Colours slowly rotate pink → violet → blue (custom `exec_cb` setting both gradient colours). |
| Bubble rim highlight | Child `lv_obj`, inset 3 px, transparent, `border_side = LV_BORDER_SIDE_TOP`, 2–3 px white at 55 %. |
| Bubble glow | One pre-rendered **soft ring image** (A8, hollow centre) at the bubble's resting size, `img_recolor` to the current colour. Only `opa` animates; it fades out while thinking. |
| Living colour inside the bubble | 3 × **220 px soft-circle images** (A8, recoloured pink/violet/blue) that move on Lissajous paths inside the clipped bubble. Opacity rises while thinking and talking. |
| Voice level → bubble | Mic RMS (I2S, smoothed) → bubble grows up to +18 px, glow `opa` up. |
| Grow from button → bubble | Animate `x/y/width/height/radius` from the button's circle to the full rounded square (inset 24 px), with an overshoot path (`lv_anim_path_overshoot`). |
| Release → thinking → reply | The bubble shrinks to 140 px and fades out (`opa`), then the **thin edge gradient** (below) fades in for ~5 s. The transcript (34 px) and then the reply (33 px) use the whole screen. The ring dims to 40 % while the reply is spoken, then fades out. Holding again regrows the bubble from the centre. |
| **Thin edge gradient** (the loading animation in Chat *and* Voice) | 2 full-screen transparent `lv_obj`s with `radius` 44 and border only: 4 px @ 90 % plus a faint 10 px band @ 20 %. `border_color` cycles pink → violet → blue. Border-only objects only redraw edge pixels, and no sprites are used. |
| Words appearing | `lv_spangroup`: each new word is added as a span coloured pink, then its colour fades to white over 400 ms. No opacity or blur per word. |
| "Thinking…" label | `lv_label`, `text_opa` pulses 35 % ↔ 100 %. |
| User message bubble | `lv_obj`, 2-stop horizontal gradient pink → violet, radius 30. |
| Keyboard | Custom `lv_buttonmatrix` (or `lv_keyboard` with a custom map). Solid #16151B panel, keys 41×58 px, key preview popup as a small `lv_obj`. |
| Screen transitions | `lv_screen_load_anim` with **FADE_IN** (300–350 ms) for Home ↔ apps and **MOVE_LEFT/RIGHT** for list → chat. The keyboard and toast use `y` moves. |
| Home intro | Buttons move up 36 px and fade in, staggered 70 ms, overshoot path. |
| Brand text ("SCODE AI", "SCODE", "Ask anything") | Static pre-rendered gradient-text images. |
| Lists (Chats, Account, messages) | Scrollable `lv_obj` with `LV_SCROLL_MOMENTUM`. Solid black header, no fade masks. |
| Toggle / segmented control | `lv_switch` / `lv_buttonmatrix` (one-checked mode). |

### Image assets to export (all small, A8 alpha so they can be recoloured)
| Asset | Size | Approx. memory |
|---|---|---|
| Home background | 480×480 RGB565 | 460 KB (PSRAM) |
| Soft circle (bubble blobs) | 220×220 A8 | 48 KB |
| Bubble glow ring | 480×480 A8 (hollow) | 230 KB (PSRAM) |
| Boot orb | 480×480 A8 | 230 KB (PSRAM) |
| Gradient wordmarks | ~300×60 ARGB8565 each | ~50 KB each |

### Frame budget (to measure on hardware)
- Voice bubble frame: one ~430 px rounded rect + 3 sprites + border, about 60–70 % of the screen redrawn. This is the heaviest scene and should be measured first. If it misses 30 fps, drop the blobs to 2 and lower the wobble rate to 20 fps.
- Thin edge gradient (all loading states): border pixels only, so it's very cheap. While thinking, the bubble is hidden, so Voice thinking costs about the same as Chat thinking.
- The idle Home screen is static and costs nothing.

---

## Concept look: why it can't run on the device as-is


| Demo effect | Why it won't port directly | Cheaper LVGL approach |
|---|---|---|
| **Backdrop blur / frosted glass** (`backdrop-filter: blur`) on buttons, keyboard, toast | Real-time Gaussian blur of what's behind every frame is far too slow on the CPU | Fake it: draw glass as a **semi-transparent fill** (`lv_obj_set_style_bg_opa` ~20–30 %) with a **1 px light top border** and a soft **pre-rendered highlight PNG** (A8 or ARGB8565). Keep the backgrounds behind glass mostly static so nothing needs to be blurred. |
| **Liquid-glass voice bubble** (WebGL shader: wobbly rounded square, flowing gradient, specular rim) | No GPU and no shaders. A full-screen per-pixel effect at 60 fps is impossible | (1) Pre-render a **sprite sheet** of 24–32 bubble frames (idle wobble, thinking morph) at 240×240 and scale them 2× with `lv_image` zoom. Or (2) draw a rounded rect with `lv_obj` radius and animate **width/height/radius** with `lv_anim` (spring path) for the wobble, plus a pre-rendered gradient image inside it that slowly rotates (`lv_image_set_rotation`). Drive the mic level into the scale factor. |
| **Bubble reacting to voice** (Web Audio analyser) | Fine on the device, but the visuals are the hard part | Compute RMS from the I2S mic buffer on core 1. Map it to the bubble's scale (1.00–1.06) and the glow opacity. Update at 30 Hz with smoothing. |
| **Thinking morph (~5 s)** | Same as the shader above | Loop the "thinking" sprite frames, or use 3 overlapping blurred circle PNGs (pink, violet, blue) moving on `lv_anim` paths inside a clipped rounded container (a metaball look without real metaballs). |
| **Chat edge glow** (shader: flowing gradient band around the screen edge) | Per-pixel shader | Pre-render **one ring image** (480×480, A8 alpha, ~230 KB in PSRAM; or just 4 edge strips plus 4 corners). Colour it with `img_recolor`, and cycle the hue by animating the recolour between pink, violet and blue. For the "flow", rotate a 2-colour conic gradient image that's masked to the ring, or move a bright highlight sprite along the edge path. |
| **Large gradients** (pink → violet → blue backgrounds, user bubbles, Send key) | LVGL gradients are cheap for simple 2-stop vertical/horizontal ones, but big diagonal multi-stop gradients cause banding and redraw cost in RGB565 | Use LVGL's **2-stop linear gradients** (`bg_grad_dir`), or pre-rendered **dithered** gradient images for large areas. Cache them; don't redraw every frame. |
| **Ambient drifting colour blobs** on Home | Large soft radial gradients moving each frame means full-screen redraws | A static pre-rendered background image, or move 2–3 small blurred-circle PNGs very slowly (≤ 15 fps). Or drop it on battery saver. |
| **Word fade-in with blur** (CSS `filter: blur`) | No per-element blur | Fade in only (`lv_obj_fade_in`, 150 ms) plus a 4 px upward slide. Reveal text in chunks per label, not per glyph, to keep redraw areas small. |
| **Spring animations** (GSAP elastic/back easing) | — (this ports well) | `lv_anim` with `lv_anim_path_overshoot` / `lv_anim_path_bounce`, or a custom spring path callback. Keep animated areas small to limit invalidation. |
| **Scale-in screen transitions** (whole screen scaling) | Scaling a full screen means resampling every pixel | Use `lv_screen_load_anim` with **fade / move** animations instead of zoom, or zoom only one small element (e.g. the tapped button). |
| **Shadows** (`box-shadow` with large blur) | LVGL shadows are expensive for big radii | Small shadow widths (≤ 8 px), or bake shadows into images. On AMOLED black, glows read better than shadows anyway. |
| **Inter font at many sizes** | Each size is a separate bitmap font in flash | Generate 3–4 sizes with `lv_font_conv` (e.g. 20, 26, 30, 76 px, Latin only, 4 bpp). Tabular numbers come from Inter's `tnum` glyphs; include digits for the clock. |
| **Speech recognition / speech synthesis** (browser APIs) | Not on the device | Stream mic audio (I2S → Opus/PCM) over Wi-Fi to the SCODE AI service for speech-to-text, and play returned TTS audio via the I2S speaker amp. |
| **localStorage chat history** | — | NVS for settings, LittleFS/SD for chat history (JSON or a small binary log). Sync with the account on the server. |
| **Custom keyboard** | — (ports well) | `lv_keyboard` with a custom map and styles, sized 41×58 px keys like the demo. |

## Performance rules of thumb for the device
- Aim for 30–60 fps on small areas. Full-screen 60 fps redraws over QSPI are borderline, so keep big
  animated areas rare (the voice bubble is the one exception: use sprites).
- Put frame buffers and large images in PSRAM. Enable LVGL's draw-buffer DMA and partial refresh.
- AMOLED black pixels are off: true-black backgrounds save battery. Keep the design black-first.
