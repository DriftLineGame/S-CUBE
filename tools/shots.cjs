// Screenshot + frame-strip capture for the SCOS demo.
// Usage: [LOOK=device|concept] node tools/shots.cjs <outDir> [path/to/gsap.min.js]
// If a local gsap file is given, CDN requests for GSAP are served from it (useful offline / in CI).
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');

const OUT = path.resolve(process.argv[2] || 'shots');
const GSAP = process.argv[3];
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const LOOK = 'look=' + (process.env.LOOK || 'device'); // LOOK=concept for the shader/glass look
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));

async function prep(ctx){
  if (GSAP) await ctx.route(/cdn\.jsdelivr\.net\/npm\/gsap/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(GSAP) }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.continue().catch(() => r.abort()));
}
async function strip(page, name, frames, gap, sel = '#screen'){
  const dir = path.join(OUT, '_' + name); fs.mkdirSync(dir, { recursive: true });
  const el = await page.$(sel);
  for (let i = 0; i < frames; i++) { await el.screenshot({ path: path.join(dir, `f${String(i).padStart(2, '0')}.png`) }); await wait(gap); }
  execSync(`ffmpeg -loglevel error -y -i "${dir}/f%02d.png" -vf "scale=240:-1,tile=${frames}x1:padding=6:color=0x222222" "${path.join(OUT, 'strip-' + name + '.png')}"`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  /* ---------- 480×480 bare screen ---------- */
  const ctx = await browser.newContext({ viewport: { width: 480, height: 480 }, deviceScaleFactor: 1 });
  await prep(ctx);
  const p = await ctx.newPage();
  const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await p.goto(URL + '?bare&' + LOOK);
  await p.evaluate(() => document.fonts.ready);
  const shot = n => p.screenshot({ path: path.join(OUT, n + '.png') });
  await shot('01-off');
  await p.click('#screen');
  await wait(1000); await shot('02-boot-a');
  await wait(1100); await shot('03-boot-b');
  await wait(2400); await shot('04-home');
  // voice grow
  // slow the GSAP timeline 4x so the grow animation is visible frame by frame
  await p.evaluate(() => { window.gsap && gsap.globalTimeline.timeScale(.25); });
  await p.click('.hb.voice');
  await strip(p, 'voice-grow', 8, 160);
  await p.evaluate(() => { window.gsap && gsap.globalTimeline.timeScale(1); });
  await wait(800); await shot('05-voice-idle');
  // hold to talk (real pointer path)
  await p.mouse.move(240, 300); await p.mouse.down();
  await wait(900); await shot('06-voice-listening');
  await p.mouse.up();
  await wait(1500); await shot('07-voice-thinking-a');
  await strip(p, 'voice-thinking', 6, 400);
  await wait(2600); await shot('09-voice-reply-a');
  await wait(4500); await shot('10-voice-reply-b');
  // X -> chat
  await p.click('#vX'); await wait(1100); await shot('11-chat-from-voice');
  // keyboard
  await p.click('#field'); await wait(800);
  await p.evaluate(() => SCOS.type('Tell me a joke about space'));
  await wait(200); await shot('12-keyboard');
  await p.click('.k[data-k="mode"]'); await wait(200); await shot('13-keyboard-numbers'); await p.click('.k[data-k="mode"]');
  await p.click('.k[data-k="send"]');
  await wait(900); await shot('14-chat-thinking-glow');
  await strip(p, 'chat-glow', 6, 300);
  await wait(1300); await shot('15-chat-streaming');
  await wait(4000); await shot('16-chat-reply');
  // back to home, chats, account
  await p.click('#chatHdr [data-back]'); await wait(900);
  await p.click('.hb[data-go="chats"]'); await wait(1200); await shot('17-chats');
  await p.click('#clist .row:nth-child(2)'); await wait(1000); await shot('18-chat-history');
  await p.click('#chatHdr [data-back]'); await wait(900);
  await p.click('#chats [data-back]'); await wait(900);
  await p.click('.hb[data-go="account"]'); await wait(1300); await shot('19-account');
  await p.evaluate(() => { const a = document.querySelector('#acct'); a.scrollTop = a.scrollHeight; }); await wait(300); await shot('20-account-settings');
  fs.writeFileSync(path.join(OUT, 'console.txt'), logs.join('\n'));
  await ctx.close();

  /* ---------- iPhone 15 with device frame + video ---------- */
  const ictx = await browser.newContext({ ...devices['iPhone 15'], recordVideo: { dir: path.join(OUT, '_video'), size: { width: 393, height: 659 } } });
  await prep(ictx);
  const ip = await ictx.newPage();
  await ip.goto(URL + '?' + LOOK);
  await ip.evaluate(() => document.fonts.ready);
  const ishot = n => ip.screenshot({ path: path.join(OUT, n + '.png') });
  await ishot('i01-off');
  await ip.tap('#hwPwr'); await wait(4900); await ishot('i02-home');
  await ip.tap('.hb.voice'); await wait(1200); await ishot('i03-voice');
  await ip.evaluate(() => SCOS.voiceAsk('Tell me a joke', false)); await wait(2500); await ishot('i04-voice-thinking');
  await wait(4800); await ishot('i05-voice-reply');
  await ip.tap('#vX'); await wait(1100);
  await ip.tap('#field'); await wait(700); await ip.evaluate(() => SCOS.type('Plan my day')); await ishot('i06-keyboard');
  await ip.tap('.k[data-k="send"]'); await wait(1400); await ishot('i07-chat-glow');
  await wait(5000); await ishot('i08-chat-reply');
  await ictx.close();
  const vdir = path.join(OUT, '_video'); const vid = fs.readdirSync(vdir).find(f => f.endsWith('.webm'));
  if (vid) execSync(`ffmpeg -loglevel error -y -i "${path.join(vdir, vid)}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${path.join(OUT, 'demo-iphone.mp4')}"`);
  await browser.close();
  console.log('done ->', OUT);
})().catch(e => { console.error(e); process.exit(1); });
