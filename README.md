# S-CUBE 1 · SCOS virtual demo

A design prototype of **SCOS**, the interface for the S-CUBE 1 handheld (Waveshare ESP32-S3-Touch-AMOLED-2.16,
480×480 AMOLED). It talks to a fake **SCODE AI** (model: General Ultra). There's no network: replies are canned.

**Live demo:** https://driftlinegame.github.io/S-CUBE/

## Controls
- **PWR** (top right of the frame): press to power on. Tap = sleep/wake, hold = power off. You can also tap the screen to power on.
- **BOOT** (top): back.
- **Side button** (right edge, violet): hold to talk from anywhere. You can change it in Account → Side button (Talk / New chat / Home).
- **Voice:** hold anywhere on the bubble to talk, then release to send. X closes and opens the conversation in Chat.
- **Chat:** tap the message field to open the keyboard. Swipe to scroll.

## URL options
- `?skipboot`: start on Home.
- `?bare`: only the 480×480 screen at 1:1, with no device frame (used for screenshots).
- `?look=device` / `?look=concept`: pick the look (default: Device, which only uses what the real S-CUBE can draw at 30 fps).
- `?nogl`: force the CSS fallback for the Concept bubble and glow.
- `?lowfx`: render shaders at 1× resolution.
- `?nosr`: skip speech recognition and use the demo transcript.

## Files
- `index.html`: the whole demo (HTML/CSS/JS). GSAP 3.12.5 comes from jsDelivr, with a built-in fallback.
- `PORTING.md`: which effects need a cheaper approach on the ESP32-S3 / LVGL.
- `tools/shots.cjs`: Playwright capture script: `node tools/shots.cjs out/ [local-gsap.min.js]`.

## Versions
- **v0.1**: first build. Boot, Home, Voice (liquid bubble, hold to talk, thinking morph, spoken reply), Chat (custom keyboard, edge glow, streamed replies), Chats history, Account and Settings.
- **v0.2**: fixed flicker in the liquid-glass bubble (phase jumps when the speed changed, 16-bit float precision on iPhone, per-word glow spikes).
- **v0.3**: new **Device** look, now the default: everything maps to LVGL on the ESP32-S3 and animates at 30 fps (see PORTING.md). The original shader/glass look stays under Account → Look → Concept.
