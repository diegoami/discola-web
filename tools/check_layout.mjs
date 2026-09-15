#!/usr/bin/env node
/**
 * Layout regression check for Discola.
 *
 * The card size is a budget: (viewport height - chrome) / rows. Three separate
 * bugs came from that budget being wrong, and none of them threw an error or
 * looked broken in code review — the cards just quietly overlapped, or the
 * player's hand slid below the fold. So the budget gets asserted instead.
 *
 * For every viewport and every deck it checks that:
 *   - the trick does not overlap either hand
 *   - your own hand is fully on screen without scrolling
 *   - nothing overflows the table or scrolls sideways
 *
 * It then re-runs the tightest viewports with the spacing tokens deliberately
 * inflated. --chrome is derived from those tokens, so the card budget must
 * absorb the change on its own; if someone ever replaces that derivation with
 * a hard-coded number again, this pass is what fails.
 *
 *   node tools/check_layout.mjs [path-to-index.html]
 *
 * Needs playwright-core and a Chromium binary:
 *   npm i playwright-core && npx playwright install chromium
 *   CHROME=/path/to/chrome node tools/check_layout.mjs
 */
import { chromium } from 'playwright-core';
import path from 'node:path';

const FILE = path.resolve(process.argv[2] ?? new URL('../index.html', import.meta.url).pathname);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const VIEWPORTS = [
  ['tablet portrait',   600,  853],
  ['tablet 768',        768, 1024],
  ['tablet iPad Air',   820, 1180],
  ['tablet iPad Pro',  1024, 1366],
  ['tablet landscape', 1180,  820],
  ['phone landscape',   980,  385],
  ['phone portrait',    412,  915],
  ['phone small',       360,  640],
  ['phone desktop-mode',1045, 2265],
  ['laptop',           1440,  900],
  ['laptop short',     1366,  700],
  ['desktop',          1920, 1080],
];

// The viewports with the least headroom; these are the ones worth re-running
// against inflated spacing.
const TIGHT = ['phone landscape', 'laptop short', 'tablet 768', 'tablet portrait', 'phone small'];

const DECKS = ['Trevisane', 'Romagnole', 'Napoletane', 'Piacentine', 'Francesi'];

const measure = () => {
  const r = s => document.querySelector(s).getBoundingClientRect();
  const opp = r('.hand--opp'), trick = r('.trick'), you = r('.hand--you');
  const table = r('.table'), card = r('.hand--you .card');
  return {
    gapTop: Math.round(trick.top - opp.bottom),          // >= 0
    gapBot: Math.round(you.top - trick.bottom),          // >= 0
    belowFold: Math.round(you.bottom - window.innerHeight), // <= 0
    overflow: Math.round(you.bottom - table.bottom),     // <= 0
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
    cw: Math.round(card.width), ch: Math.round(card.height),
  };
};

async function run(browser, { width, height }, inflate) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto('file://' + FILE);
  if (inflate) {
    await page.addStyleTag({ content: ':root{ --pad-block: 1.5rem; --step: 1.25rem; --slack: 16px; }' });
  }
  await page.waitForTimeout(400);
  const out = [];
  for (const deck of DECKS) {
    await page.selectOption('#deckSel', deck);
    await page.waitForTimeout(90);
    out.push({ deck, ...(await page.evaluate(measure)) });
  }
  await page.close();
  return out;
}

const failures = r =>
  [ r.gapTop  <  0 && `trick overlaps opponent hand by ${-r.gapTop}px`,
    r.gapBot  <  0 && `trick overlaps your hand by ${-r.gapBot}px`,
    r.belowFold > 0 && `your hand is ${r.belowFold}px below the fold`,
    r.overflow  > 0 && `your hand overflows the table by ${r.overflow}px`,
    r.hScroll      && 'page scrolls horizontally',
  ].filter(Boolean);

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let failed = 0;

for (const [pass, only, inflate] of [['layout', null, false], ['inflated spacing', TIGHT, true]]) {
  console.log(`\n${pass}`);
  for (const [name, width, height] of VIEWPORTS) {
    if (only && !only.includes(name)) continue;
    const rows = await run(browser, { width, height }, inflate);
    const bad = rows.flatMap(r => failures(r).map(f => `${r.deck}: ${f}`));
    if (bad.length) failed++;
    const worst = Math.min(...rows.map(r => Math.min(r.gapTop, r.gapBot, -r.belowFold)));
    console.log(`  ${bad.length ? 'FAIL' : 'pass'}  ${name.padEnd(18)} ` +
      `${String(width).padStart(4)}x${String(height).padStart(4)}  ` +
      `card ${String(rows[0].cw).padStart(3)}x${String(rows[0].ch).padStart(3)}  ` +
      `margin ${String(worst).padStart(4)}px`);
    bad.forEach(f => console.log(`        ${f}`));
  }
}

await browser.close();
console.log(failed ? `\n${failed} viewport(s) failed` : '\nAll viewports pass.');
process.exit(failed ? 1 : 0);
