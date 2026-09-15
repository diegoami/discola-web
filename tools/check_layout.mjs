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
  // Real device shapes, not invented ones. The tall ones in the middle are the
  // shapes that exposed the spread-apart table: big enough for the cards to hit
  // their cap, after which the leftover height had to go somewhere.
  ['Android small',     360,  800],
  ['iPhone 15',         393,  852],
  ['Pixel',             412,  915],
  ['iPhone Pro Max',    430,  932],
  ['narrow and tall',   360, 1200],
  ['big phone',         600, 1200],
  ['tall phone A',      700, 1400],
  ['tall phone B',      770, 1475],
  ['tall phone C',      800, 1600],
  ['tablet portrait',   600,  853],
  ['iPad',              768, 1024],
  ['iPad Air',          820, 1180],
  ['iPad Pro',         1024, 1366],
  ['tablet landscape', 1180,  820],
  ['phone landscape',   980,  385],
  ['phone desktop-mode',1045, 2265],
  ['laptop',           1440,  900],
  ['laptop short',     1366,  700],
  ['desktop',          1920, 1080],
];

// The viewports with the least headroom; these are the ones worth re-running
// against inflated spacing.
const TIGHT = ['phone landscape', 'laptop short', 'iPad', 'tablet portrait', 'Android small'];

const DECKS = ['Trevisane', 'Romagnole', 'Napoletane', 'Piacentine', 'Francesi'];

const measure = () => {
  const r = s => document.querySelector(s).getBoundingClientRect();
  const oppHand = r('.hand--opp'), trick = r('.trick'), tallone = r('.tallone');
  const youHand = r('.hand--you'), table = r('.table'), card = r('.hand--you .card');

  // Landscape puts the trick and the tallone side by side; portrait stacks
  // them. Sort the four content boxes by position and measure the gaps between
  // whatever actually ends up adjacent, so the same numbers mean the same thing
  // in both layouts. Measuring a fixed pair counted the tallone as empty space
  // in portrait — a metric that failed every good layout and passed the bad one.
  const boxes = [oppHand, trick, tallone, youHand].sort((a, b) => a.top - b.top);
  const gaps = [];
  for (let i = 1; i < boxes.length; i++) gaps.push(boxes[i].top - boxes[i - 1].bottom);

  return {
    // the first and last gaps are the ones a row could overlap across
    gapTop: Math.round(trick.top - oppHand.bottom),
    gapBot: Math.round(youHand.top - Math.max(trick.bottom, tallone.bottom)),
    belowFold: Math.round(youHand.bottom - window.innerHeight), // <= 0
    overflow: Math.round(youHand.bottom - table.bottom),        // <= 0
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
    // The widest gap between adjacent content, against the card height. Nothing
    // overlaps or falls off when this goes wrong; the table just drifts apart
    // and stops reading as one surface. It hit half a card height on a tall
    // phone while every other assertion passed, which is why it is asserted.
    maxGap: Math.round(Math.max(0, ...gaps)),
    gapRatio: Math.max(0, ...gaps) / card.height,
    cw: Math.round(card.width), ch: Math.round(card.height),
  };
};

async function run(browser, { width, height }, inflate) {
  const page = await browser.newPage({ viewport: { width, height } });
  const out = [];
  // The table is only on screen once a hand is dealt, so each deck goes through
  // the real flow: pick it on the start screen, then press Gioca.
  for (const deck of DECKS) {
    await page.goto('file://' + FILE);
    if (inflate) {
      await page.addStyleTag({ content: ':root{ --pad-block: 1.5rem; --step: 1.25rem; --slack: 16px; }' });
    }
    await page.click(`.deck-opt[data-deck="${deck}"]`);
    await page.click('#startPlay');
    await page.waitForTimeout(260);
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
    // Both terms are needed. The ratio alone misjudges a viewport so tight the
    // card is pinned to its floor, where an ordinary gap is a large fraction of
    // a small card; the absolute alone misjudges a big screen, where a wide gap
    // next to a tall card is just breathing room.
    (r.gapRatio > 0.25 && r.maxGap > 48) &&
      `rows drift apart: widest gap is ${r.maxGap}px, ${r.gapRatio.toFixed(2)} of a card height`,
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
      `margin ${String(worst).padStart(4)}px  ` +
      `gap ${Math.max(...rows.map(r => r.gapRatio)).toFixed(2)}`);
    bad.forEach(f => console.log(`        ${f}`));
  }
}

await browser.close();
console.log(failed ? `\n${failed} viewport(s) failed` : '\nAll viewports pass.');
process.exit(failed ? 1 : 0);
