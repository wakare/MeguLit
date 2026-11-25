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
    /* an overlay wider than the game (two monitors): the box starting at the game's first character keeps its right edge inside the client */
    await page.evaluate(() => { window.__tomoyoChinese.galLayoutInfo = () => ({ clientX: 0, clientY: 0, clientWidth: 1200, clientHeight: 1080, workBottom: 1080 }); });
    await at(880, '人类的栖息地。'); await frame();
    const d = await page.evaluate(() => { const r = document.querySelector('.sentence-window').getBoundingClientRect(), t = [...document.querySelectorAll('.sentence-text .char-token')].map(n => n.getBoundingClientRect().right); return { right: Math.round(r.right), text: Math.round(Math.max(...t)) }; });
    assert.ok(d.right <= 1192 + 1 && d.text <= 1192 + 1, 'inside the game client ' + JSON.stringify(d));
    /* a line on the game's own rows (nowrap) whose row is wider than the game's: it wraps at the box edge instead of leaving the client */
    await page.evaluate(() => { const text = '今し方まで、確かに激痛を発していた右足だったが、もうかれこれ８年ほど前からない。'; const s = document.querySelector('.sentence-text'); s.innerHTML = [...text].map(c => `<span class="char-token">${c}</span>`).join(''); s.style.fontSize = '44px'; document.querySelector('.tomoyo-cn-row').textContent = '右腿刚才还传来剧烈疼痛。';
      const rects = [...text].map((c, i) => i < 34 ? [200 + i * 28, 700, 28, 28] : [200 + (i - 34) * 28, 742, 28, 28]); window.__tomoyoChinese.textPlace({ text, client: [1920, 1080], rects }); }); await frame();
    const e = await page.evaluate(() => ({ right: Math.round(Math.max(...[...document.querySelectorAll('.sentence-text .char-token')].map(n => n.getBoundingClientRect().right))), rows: document.querySelector('.sentence-window').classList.contains('megulit-game-rows') }));
    assert.ok(e.right <= 1196 + 1, 'game-row line stays inside the client ' + JSON.stringify(e));
    /* and it flows in full rows: no short row left where the game broke its narrower row */
    const rowsOf = await page.evaluate(() => { const tops = [...document.querySelectorAll('.sentence-text .char-token')].map(n => Math.round(n.getBoundingClientRect().top)); const rows = []; for (const t of tops) { const r = rows.find(x => Math.abs(x.t - t) < 10); if (r) r.n++; else rows.push({ t, n: 1 }); } return rows.map(r => r.n); });
    assert.ok(rowsOf.slice(0, -1).every(n => n >= rowsOf[0] - 2), 'full rows except the last ' + JSON.stringify(rowsOf));
    /* the hide check reports the game's own text still visible: a plate covers the line until the next line arrives */
    await page.evaluate(() => { window.__tomoyoChinese.galStatus = () => {}; }); await page.waitForTimeout(700);
    await page.evaluate(() => window.__tomoyoChinese.galStatus({ hookCheckState: 'visible' }));
    assert.ok(await page.evaluate(() => document.body.classList.contains('megulit-fork-cover') && getComputedStyle(document.querySelector('.sentence-text')).backgroundColor !== 'rgba(0, 0, 0, 0)'), 'covered while the game text shows');
    await page.evaluate(() => window.__tomoyoChinese.galStatus({ hookSource: '次の行' }));
    assert.equal(await page.evaluate(() => document.body.classList.contains('megulit-fork-cover')), false, 'the next line drops the cover');
    assert.deepStrictEqual(errors, []);
    console.log('ok text-place long translation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
