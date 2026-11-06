# Porting SCOS to the real S-CUBE 1 (ESP32-S3 + LVGL)

The web demo uses browser features that the ESP32-S3 (240 MHz dual-core, ~512 KB SRAM + 8 MB PSRAM,
no GPU) can't run as-is. This list shows what to swap for each effect when building the LVGL version.
Target: 480×480 AMOLED (CO5300 driver, QSPI), 16-bit colour, double buffers in PSRAM.

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
