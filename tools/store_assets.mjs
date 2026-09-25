#!/usr/bin/env node
/**
 * Render the store assets from the real page (STORES.md 1.5).
 *
 *   node tools/store_assets.mjs        # writes dist-store/ (gitignored)
 *
 * Everything comes from public/ as it is, so the assets can be regenerated from
 * any tagged commit and always show the game that ships:
 *
 *   dist-store/play/{it,en}/NN-*.png   phone screenshots, 1080x2160, for Google
 *                                      Play; Bresciane is hidden, because the
 *                                      Play build leaves it out (STORES.md)
 *   dist-store/itch/{it,en}/NN-*.png   the same with all six decks, for itch.io
 *   dist-store/feature-graphic-{it,en}.png   1024x500, Play's feature graphic
 *   dist-store/itch-cover.png          630x500, itch.io's cover image
 *   dist-store/icon-512.png            Play's hi-res icon (public/icons, as is)
 *
 * The deal is seeded, so the same commit renders the same screenshots. Every
 * PNG is read back and its size checked, and a script or console error while
 * capturing fails the run: an asset of a broken page is worse than none.
 *
 * Needs playwright-core and Chromium, like tools/check_ui.mjs.
 */
import { chromium } from 'playwright-core';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist-store');
const PAGE = pathToFileURL(path.join(PUBLIC, 'index.html')).href;
const asset = rel => pathToFileURL(path.join(PUBLIC, rel)).href;

const fail = msg => { console.error(`\nstore_assets: ${msg}`); process.exit(1); };

// A 360x720 layout at 3x is 1080x2160: the tallest shape Play accepts (2:1),
// and tall enough that the start screen's deck row clears the pinned footer.
// 360x640 cropped it.
const PHONE = { viewport: { width: 360, height: 720 }, deviceScaleFactor: 3 };
const SHOT = [1080, 2160];
const LOCALES = { it: 'it-IT', en: 'en-US' };

// mulberry32, installed before the page's own script runs, so the shuffle is
// the same on every run.
const seeded = seed => {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pngSize = file => {
  const b = readFileSync(file);
  if (b.toString('ascii', 1, 4) !== 'PNG') fail(`${file} is not a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const expectSize = (file, w, h) => {
  const [W, H] = pngSize(file);
  if (W !== w || H !== h) fail(`${path.relative(ROOT, file)} is ${W}x${H}, not ${w}x${h}`);
  console.log(`  ${W}x${H}  ${path.relative(ROOT, file)}`);
};

// The Play build ships five decks; hide the sixth from both pickers and the
// settings list so no screenshot shows what the app does not have.
const hideBresciane = () => {
  for (const n of document.querySelectorAll('.deck-opt[data-deck="Bresciane"], #deckSel option[value="Bresciane"]')) n.remove();
  for (const box of document.querySelectorAll('.decks')) box.style.setProperty('--deck-cols', 5);
};

const HISTORY = () => {
  const now = Date.now(), day = 864e5;
  localStorage.setItem('discola.history', JSON.stringify([
    { t: now - day / 2, o: 'Valerio',  d: 'Trevisane',  y: 71, a: 49 },
    { t: now - day,     o: 'Franco',   d: 'Napoletane', y: 58, a: 62 },
    { t: now - day,     o: 'Graziano', d: 'Trevisane',  y: 67, a: 53 },
    { t: now - 2 * day, o: 'Piero',    d: 'Piacentine', y: 60, a: 60 },
    { t: now - 3 * day, o: 'Valerio',  d: 'Romagnole',  y: 81, a: 39 },
  ]));
};

// Each shot: how to reach it from a fresh page. Names order the listing.
const SHOTS = [
  ['01-start', async () => {}],
  ['02-table', async p => {
    await p.click('#startPlay');
    await p.evaluate(() => { state.speed = 120; });
    // Two tricks in, so the table has a history: scores, a smaller stock.
    for (let i = 0; i < 2; i++) {
      await p.waitForFunction(() => state.deveGiocare === 0 && !state.played[0] && !state.over);
      await p.evaluate(() => humanPlay(0));
      await p.waitForFunction(() => !state.played[0] && !state.played[1]);
    }
    await p.waitForFunction(() => state.deveGiocare === 0 && !state.played[0]);
    await p.waitForTimeout(300);
  }],
  ['03-end', async p => {
    await p.click('#startPlay');
    await p.evaluate(() => {
      state.scores = [71, 49];
      state.hands = [[null, null, null], [null, null, null]];
      finish();
    });
  }],
  ['04-history', async p => { await p.click('#viewStart [data-nav="history"]'); }, HISTORY],
];

async function screenshots(browser, set, lang) {
  const dir = path.join(OUT, set, lang);
  mkdirSync(dir, { recursive: true });
  for (const [name, reach, seed] of SHOTS) {
    const page = await browser.newPage({ ...PHONE, locale: LOCALES[lang] });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.addInitScript(seeded, 1997);
    if (seed) await page.addInitScript(seed);
    await page.goto(PAGE);
    if (set === 'play') await page.evaluate(hideBresciane);
    await page.waitForTimeout(250);
    await reach(page);
    await page.waitForTimeout(250);
    if (errs.length) fail(`${set}/${lang}/${name}: ${errs[0]}`);
    const file = path.join(dir, `${name}.png`);
    await page.screenshot({ path: file });
    expectSize(file, ...SHOT);
    await page.close();
  }
}

// The feature graphic and the cover: the wordmark, one line, and three cards
// from the Trevisane sheet, on the game's own felt. No price, rank or "free"
// claim: Play's metadata policy keeps those out of graphics.
//
// The cards are the 1997 bitmaps, 60x125 per cell, so they are scaled by a
// whole number with nearest-neighbour sampling, as tools/make_icons.py does
// for the icon: smoothing blurs them and bleeds the neighbouring cells' edges
// in, and interpolation is redrawing by another name.
const CELL = [60, 125], SHEET = [660, 500];
const card = (col, row, rot, x, s) =>
  `<div class="c" style="width:${CELL[0] * s}px;height:${CELL[1] * s}px;` +
  `background-size:${SHEET[0] * s}px ${SHEET[1] * s}px;` +
  `background-position:${-col * CELL[0] * s}px ${-row * CELL[1] * s}px;` +
  `border-radius:${3 * s}px;--rot:${rot}deg;--x:${x}px"></div>`;
// The corner radius grows with the scale: the cells' corners carry the 1997
// bitmaps' green background, which a fixed small radius left showing.
const fan = s => card(2, 1, -14, -CELL[0] * s * 0.62, s) + card(0, 0, 0, 0, s) + card(9, 2, 14, CELL[0] * s * 0.62, s);
// Wide (the feature graphic): words left, cards right. Narrow (the cover):
// words above, cards below, so the fan never covers the wordmark.
const art = ({ w, h, line, scale, wide }) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{ font-family:'Bodoni Moda'; font-weight:400 700; src:url(${asset('fonts/bodoni-moda.woff2')}) format('woff2'); }
@font-face{ font-family:'Barlow Condensed'; font-weight:600; src:url(${asset('fonts/barlow-condensed-600.woff2')}) format('woff2'); }
html,body{ margin:0; width:${w}px; height:${h}px; overflow:hidden; }
body{ background: radial-gradient(ellipse 80% 90% at ${wide ? '70% 45%' : '50% 70%'}, #2a6b54 0%, #1e5140 55%, #12332a 100%);
  color:#f2ebdc; display:grid; ${wide ? `grid-template-columns: 1fr ${Math.round(w * 0.46)}px; align-items:center;`
    : 'grid-template-rows: auto 1fr; justify-items:center;'} }
.t{ ${wide ? `padding-left:${Math.round(w * 0.07)}px;` : 'padding-top:28px; text-align:center;'} }
h1{ font-family:'Bodoni Moda', serif; font-weight:700; font-size:${wide ? 110 : 84}px; line-height:1; margin:0; }
p{ font-family:'Barlow Condensed', sans-serif; font-weight:600; letter-spacing:.14em; text-transform:uppercase;
  color:#c8a24a; font-size:${wide ? 28 : 24}px; margin:14px 0 0; }
.fan{ position:relative; width:100%; height:100%; }
.c{ position:absolute; top:${wide ? 50 : 56}%; left:${wide ? 44 : 50}%;
  background-image:url(${asset('decks/trevisane.png')}); background-repeat:no-repeat;
  image-rendering: pixelated; box-shadow:0 10px 28px rgba(0,0,0,.5);
  transform: translate(calc(-50% + var(--x)), -50%) rotate(var(--rot)); transform-origin: 50% 120%; }
</style></head><body>
<div class="t"><h1>Discola</h1><p>${line}</p></div>
<div class="fan">${fan(scale)}</div>
</body></html>`;

async function graphic(browser, file, spec) {
  const html = path.join(os.tmpdir(), `discola-art-${process.pid}.html`);
  writeFileSync(html, art(spec));
  const page = await browser.newPage({ viewport: { width: spec.w, height: spec.h } });
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: file });
  await page.close();
  rmSync(html, { force: true });
  expectSize(file, spec.w, spec.h);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || chromium.executablePath() });
try {
  console.log('screenshots');
  for (const set of ['play', 'itch']) for (const lang of ['it', 'en']) await screenshots(browser, set, lang);
  console.log('graphics');
  await graphic(browser, path.join(OUT, 'feature-graphic-it.png'), { w: 1024, h: 500, line: 'Briscola a due', scale: 3, wide: true });
  await graphic(browser, path.join(OUT, 'feature-graphic-en.png'), { w: 1024, h: 500, line: 'Two-player Briscola', scale: 3, wide: true });
  await graphic(browser, path.join(OUT, 'itch-cover.png'), { w: 630, h: 500, line: 'Briscola a due', scale: 2, wide: false });
  copyFileSync(path.join(PUBLIC, 'icons', 'icon-512.png'), path.join(OUT, 'icon-512.png'));
  expectSize(path.join(OUT, 'icon-512.png'), 512, 512);
} finally {
  await browser.close();
}
console.log(`\ndone: ${path.relative(ROOT, OUT)}/`);
