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
- `?nogl`: force the CSS fallback for the bubble and glow.
- `?lowfx`: render shaders at 1× resolution.
- `?nosr`: skip speech recognition and use the demo transcript.

## Files
- `index.html`: the whole demo (HTML/CSS/JS). GSAP 3.12.5 comes from jsDelivr, with a built-in fallback.
- `PORTING.md`: which effects need a cheaper approach on the ESP32-S3 / LVGL.
- `tools/shots.cjs`: Playwright capture script: `node tools/shots.cjs out/ [local-gsap.min.js]`.

## Versions
- **v0.1**: first build. Boot, Home, Voice (liquid bubble, hold to talk, thinking morph, spoken reply), Chat (custom keyboard, edge glow, streamed replies), Chats history, Account and Settings.
