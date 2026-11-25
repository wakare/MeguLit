// SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
/* fork (wakare): a fullscreen game whose dialogue sits low on the screen. A long sentence's translation under the
   anchored line must stay on screen: after the usual 15 % shrink the whole line moves up, never above the client top. */
const assert = require('node:assert'), fs = require('node:fs'), path = require('node:path');
let chromium;
try { ({ chromium } = require(process.env.MEGULIT_PLAYWRIGHT || 'H:/MeguLit-Work/pw/node_modules/playwright-core')); } catch { console.log('SKIP text-place long translation (no playwright-core)'); process.exit(0); }
const code = fs.readFileSync(path.join(__dirname, '..', 'web', 'reader', 'modules', 'text-place.js'), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
.sentence-window{position:fixed;left:100px;bottom:20px;width:1700px;height:150px}
.tomoyo-cn-row{display:block;font-size:30px;width:1600px}</style></head><body>
<main><div class="sentence-window tomoyo-hook-reader"><div class="sentence-text"><span class="char-token">ヒ</span><span class="char-token">ト</span><span class="char-token">の</span><span class="char-token">生</span><span class="char-token">息</span></div><div class="tomoyo-cn-row">人类</div></div></main>
<script>window.__tomoyoChinese={};</script></body></html>`;
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setContent(html); await page.addScriptTag({ content: code });
    const frame = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const rects = () => page.evaluate(() => { const r = document.querySelector('.tomoyo-cn-row').getBoundingClientRect(), t = document.querySelector('.sentence-text').getBoundingClientRect(); return { cnTop: Math.round(r.top), cnBottom: Math.round(r.bottom), jpTop: Math.round(t.top) }; });
    const at = (y, text) => page.evaluate(([y, text]) => { document.querySelector('.tomoyo-cn-row').textContent = text; window.__tomoyoChinese.textPlace({ text: 'ヒトの生息', client: [1920, 1080], rects: [0, 1, 2, 3, 4].map(i => [200 + i * 48, y, 48, 48]) }); }, [y, text]);
    await page.evaluate(() => { const b = window.__tomoyoChinese; b.galLayoutInfo = () => ({ clientX: 0, clientY: 0, clientWidth: 1920, clientHeight: 1080, workBottom: 1080 }); b.textPlaceMode({ on: true }); b.textPlaceAnchor(true); });
    /* a short translation: the Japanese stays on the game's own place */
    await at(880, '人类的栖息地。'); await frame();
    const a = await rects(); assert.ok(Math.abs(a.jpTop - 880) <= 12, 'short line stays on its place ' + JSON.stringify(a));
    /* a long translation that cannot fit under the Japanese: the line moves up and the translation is fully visible */
    await at(990, '人类的栖息地被迫收缩，处于巅峰的科学技术渐渐流失。'.repeat(8)); await frame();
    const b = await rects(); const hidden = await page.evaluate(() => { const r = document.querySelector('.tomoyo-cn-row'); return r.scrollHeight - r.clientHeight; }); assert.ok(hidden <= 1, 'nothing scrolled away ' + hidden); assert.ok(b.cnBottom <= 1072 + 1, 'translation fully on screen ' + JSON.stringify(b)); assert.ok(b.jpTop < 990, 'the line moved up ' + JSON.stringify(b)); assert.ok(b.jpTop >= 0, 'never above the client top ' + JSON.stringify(b));
    /* the next short sentence goes back to the game's place */
    await at(880, '谢谢。'); await frame();
    const c = await rects(); assert.ok(Math.abs(c.jpTop - 880) <= 12, 'back on its place ' + JSON.stringify(c));
    assert.deepStrictEqual(errors, []);
    console.log('ok text-place long translation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
