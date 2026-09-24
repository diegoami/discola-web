#!/usr/bin/env node
/**
 * UI check for Discola. Run it after any UI change.
 *
 *   node tools/check_ui.mjs [path-to-index.html]   # defaults to public/index.html
 *
 * Needs playwright-core and a Chromium binary:
 *   npm i playwright-core && npx playwright install chromium
 *   CHROME=/path/to/chrome node tools/check_ui.mjs
 *
 * Two passes, because the failures this project actually shipped came in two
 * different shapes.
 *
 * 1. SCREENS — every screen and both dialogs, at a handful of real device
 *    shapes. Catches things that are wrong anywhere: more than one screen
 *    visible at once, text set too small to read, clipped labels, tap targets
 *    below the thumb, sideways scroll, script errors.
 *
 * 2. TABLE — the card table only, at every viewport and in all six decks.
 *    The card size is a budget, (viewport height - chrome) / rows, and when
 *    that budget is wrong nothing throws and nothing looks broken in review:
 *    the cards quietly overlap, or your hand slides below the fold, or the
 *    rows drift apart until the table stops reading as one surface. Each of
 *    those shipped once. They are assertions now.
 *
 * Every threshold below is calibrated against a real defect, not taste. If you
 * relax one, check it still fails the commit that introduced the bug it names.
 */
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

// fileURLToPath, not URL.pathname: on Windows the latter yields "/C:/..." and
// path.resolve then prefixes the cwd drive letter, doubling it.
const FILE = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../public/index.html', import.meta.url)));
// Whatever 'npx playwright install chromium' put on this machine: the path
// differs per OS and per Playwright revision, so do not hard-code one.
const CHROME = process.env.CHROME || chromium.executablePath();
const URL_ = pathToFileURL(FILE).href;

/* ---- viewports ------------------------------------------------------------ */

// Real device shapes. The tall ones in the middle are where the table drifted
// apart: big enough for the cards to hit their cap, after which the leftover
// height had to go somewhere.
const VIEWPORTS = [
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
  ['desktop window',   1280,  800],   // the Tauri wrapper's default window
  ['phone landscape',   980,  385],
  ['phone desktop-mode',1045, 2265],
  ['laptop',           1440,  900],
  ['laptop short',     1366,  700],
  ['desktop',          1920, 1080],
];

// Enough shapes to cover the ways a screen can go wrong, without visiting all
// eight screens at all nineteen sizes.
const SCREEN_VIEWPORTS = ['Android small', 'iPhone Pro Max', 'tablet portrait',
                          'phone landscape', 'laptop'];

// The tightest ones; worth re-running the table budget against inflated spacing.
const TIGHT = ['phone landscape', 'laptop short', 'iPad', 'tablet portrait', 'Android small'];

const DECKS = ['Trevisane', 'Romagnole', 'Napoletane', 'Piacentine', 'Francesi', 'Bresciane'];

/* ---- getting to each screen ----------------------------------------------- */

const seedHistory = async page => page.evaluate(() => {
  const now = Date.now(), day = 864e5;
  localStorage.setItem('discola.history', JSON.stringify([
    { t: now - day,     o: 'Franco',   d: 'Trevisane',  y: 44, a: 76 },
    { t: now - day,     o: 'Valerio',  d: 'Trevisane',  y: 68, a: 52 },
    { t: now - 2 * day, o: 'Valerio',  d: 'Piacentine', y: 60, a: 60 },
    { t: now - 3 * day, o: 'Graziano', d: 'Napoletane', y: 81, a: 39 },
  ]));
});

// End the match where it stands rather than playing forty cards.
const endMatch = async p => {
  await p.click('#startPlay');
  await p.evaluate(() => {
    state.scores = [68, 52];
    state.hands = [[null, null, null], [null, null, null]];
    finish();
  });
};

const SCREENS = [
  { name: 'start', open: async () => {},
    // The primary action has to be reachable without hunting for it. Readable
    // type pushed it past the fold once; a pinned footer is the fix, and this
    // is what stops it drifting back.
    check: () => {
      const r = document.querySelector('#startPlay').getBoundingClientRect();
      return (r.bottom > window.innerHeight + 1 || r.top < -1)
        ? [`Gioca is off screen (bottom ${Math.round(r.bottom)} vs viewport ${window.innerHeight})`]
        : [];
    } },
  { name: 'table',         open: async p => { await p.click('#startPlay'); } },
  { name: 'settings',      open: async p => { await p.click('#startPlay'); await p.click('#btnSettings'); } },
  { name: 'history empty', open: async p => { await p.click('#startPlay'); await p.click('#btnHistory'); } },
  { name: 'history full',  open: async p => { await p.click('#startPlay'); await p.click('#btnHistory'); },
                           seed: seedHistory },
  // Parsed storage is untrusted. These records are the shapes that used to
  // throw during render: null, a missing score, and a timestamp outside the
  // Date range (Intl.DateTimeFormat.format -> RangeError). One valid record
  // rides along to prove the sanitizer keeps what it can.
  { name: 'history malformed', open: async p => { await p.click('#startPlay'); await p.click('#btnHistory'); },
    seed: async p => p.evaluate(() => localStorage.setItem('discola.history', JSON.stringify([
      null,
      42,
      { y: 'x', a: 2, t: Date.now(), o: 'Valerio', d: 'Trevisane' },
      { t: 1e20, o: 'Franco', d: 'Trevisane', y: 44, a: 76 },
      { y: 44, a: 76, o: 'Nobody', d: 'Trevisane', t: Date.now() },
      { y: 60, a: 60, o: 'Valerio', d: 'NotADeck', t: Date.now() },
    ]))) },
  { name: 'about',         open: async p => { await p.click('#startPlay'); await p.click('#btnAbout'); } },
  { name: 'confirm',       open: async p => { await p.click('#startPlay'); await p.click('#btnNew'); } },
  // An abandoned hand must stop counting as "in play". `abandon()` cancels the
  // queued timers but used to leave `state.dealt` true, so Back from a sheet
  // walked back into the dead table — playable if it was your turn, stalled if
  // an opponent timer had been cancelled.
  { name: 'abandoned',     open: async p => {
      await p.click('#startPlay');
      await p.click('#btnNew');
      await p.click('#confirmYes');
      await p.click('#viewStart [data-nav="settings"]');
      await p.click('#viewSettings [data-back]');
    },
    check: () => {
      const start = document.querySelector('#viewStart');
      return start && !start.hidden ? [] : ['Back after abandoning did not return to Start'];
    } },
  // The end of the match is a screen over the table, not a popup over the page
  // (#42): inside #table, covering it, its actions in view at every size, and
  // the table it covers unreachable while it is up.
  { name: 'result',        open: endMatch, check: () => {
      const out = [];
      const panel = document.querySelector('#result');
      const table = document.querySelector('#table');
      if (!panel || panel.hidden) return ['the end screen is not showing'];
      if (panel.parentElement !== table) out.push('the end screen is not a child of #table');
      const p = panel.getBoundingClientRect(), t = table.getBoundingClientRect();
      if (Math.abs(p.top - t.top) > 1 || Math.abs(p.bottom - t.bottom) > 1 ||
          Math.abs(p.left - t.left) > 1 || Math.abs(p.right - t.right) > 1)
        out.push(`the end screen does not cover the table (${Math.round(p.width)}x${Math.round(p.height)} `
          + `vs ${Math.round(t.width)}x${Math.round(t.height)})`);
      for (const id of ['playAgain', 'resultSettings']) {
        const r = document.getElementById(id).getBoundingClientRect();
        if (r.bottom > window.innerHeight + 1 || r.top < -1 || r.height === 0)
          out.push(`#${id} is off screen (bottom ${Math.round(r.bottom)} vs ${window.innerHeight})`);
      }
      const open = [...document.querySelectorAll('#viewTable .topbar, #table > :not(.result)')]
        .filter(n => !n.inert);
      if (open.length) out.push(`${open.length} covered node(s) are not inert, e.g. ${open[0].className}`);
      if (document.activeElement?.id !== 'playAgain') out.push('Ancora does not have the focus');
      return out;
    } },
  // Impostazioni from the end screen, then Back: the finished table and its
  // end screen, not the start screen and not a bare table.
  { name: 'result settings back', open: async p => {
      await endMatch(p);
      await p.click('#resultSettings');
      await p.click('#viewSettings [data-back]');
    },
    check: () => {
      const table = document.querySelector('#viewTable'), panel = document.querySelector('#result');
      return table.hidden || panel.hidden
        ? ['Back from Impostazioni did not return to the end screen'] : [];
    } },
  // A pick made on the end screen is the one the next hand uses, and the start
  // screen's copy of the picker agrees; Ancora takes the screen and the inert
  // cover down together.
  { name: 'result again',  open: async p => {
      await endMatch(p);
      await p.click('#resultOpponents .chip[data-name="Franco"]');
      await p.click('#resultDecks .deck-opt[data-deck="Napoletane"]');
      await p.click('#playAgain');
    },
    check: () => {
      const out = [];
      if (!document.querySelector('#result').hidden) out.push('Ancora left the end screen up');
      const stuck = [...document.querySelectorAll('#viewTable .topbar, #table > *')].filter(n => n.inert);
      if (stuck.length) out.push(`${stuck.length} table node(s) still inert after Ancora`);
      if (state.opponent !== 'Franco' || state.deck !== 'Napoletane')
        out.push(`the next hand is ${state.opponent} / ${state.deck}, not Franco / Napoletane`);
      const pressed = sel => document.querySelector(sel)?.getAttribute('aria-pressed');
      if (pressed('#opponents .chip[data-name="Franco"]') !== 'true' ||
          pressed('#decks .deck-opt[data-deck="Napoletane"]') !== 'true')
        out.push("the start screen's picker does not show the pick made on the end screen");
      if (state.over || state.hands[0].filter(Boolean).length !== 3) out.push('no fresh hand was dealt');
      return out;
    } },
];

/* ---- what counts as a defect ---------------------------------------------- */

// Runs in the page. Returns a list of strings; empty means clean.
const audit = () => {
  const out = [];
  const name = el => el.id ? '#' + el.id
    : (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/)[0]
        : el.tagName.toLowerCase());

  const shown = el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };

  // Exactly one screen. An author `display` rule beats the UA stylesheet's
  // [hidden]{display:none}, which once left every screen stacked on top of one
  // another with an invisible scrim swallowing every click.
  const open = [...document.querySelectorAll('.view')].filter(v => !v.hidden);
  if (open.length !== 1) out.push(`${open.length} screens visible at once`);

  if (document.documentElement.scrollWidth > window.innerWidth + 1)
    out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${window.innerWidth})`);

  // Sideways scroll is not enough on its own. The table sets `overflow: hidden
  // auto`, so anything too wide is clipped rather than scrollable and the
  // document width never betrays it — the opponent's third card was being cut
  // off a phone screen while that assertion passed. Ask the elements directly.
  const past = [...document.querySelectorAll('.hand, .trick, .tallone, .plate, .chips, .decks')]
    .filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
    });
  for (const el of past.slice(0, 3)) {
    const r = el.getBoundingClientRect();
    out.push(`${name(el)} runs off the screen (${Math.round(r.left)}…${Math.round(r.right)} `
      + `vs 0…${window.innerWidth})`);
  }

  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();

    // Text this element owns directly, not what its children hold.
    const text = [...el.childNodes]
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim()).join(' ').trim();

    if (text) {
      const size = parseFloat(cs.fontSize);
      // Two tiers: a short uppercase label can run smaller than a sentence
      // somebody has to read. Body copy sat at 12.5px until it was measured.
      const floor = text.length > 40 ? 14.5 : 12.5;
      if (size < floor - 0.05)
        out.push(`${name(el)} text ${size.toFixed(1)}px, want ${floor} — "${text.slice(0, 32)}"`);

      // Clipped by a container that cannot scroll, so nobody can reach it.
      if (cs.overflowX === 'hidden' && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll'
          && el.scrollWidth > el.clientWidth + 1)
        out.push(`${name(el)} clips its text (${el.scrollWidth} > ${el.clientWidth})`);
    }

    // Thumb-sized targets. Two exclusions: cards, whose size is the table's
    // budget and is asserted by the second pass; and links flowing inline in a
    // sentence, which cannot be 32px tall without wrecking the paragraph they
    // sit in. Standalone controls have no such excuse.
    const inlineLink = el.tagName === 'A' && cs.display.startsWith('inline');
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && !el.classList.contains('card') && !inlineLink) {
      const small = Math.min(r.width, r.height);
      if (small < 32)
        out.push(`${name(el)} tap target ${Math.round(r.width)}x${Math.round(r.height)}, want 32`);
    }
  }

  // The select's popup is drawn by the OS and is not in the document, so its
  // legibility cannot be measured. What decides it is in the document: the
  // select and its options must carry an opaque background. Transparent ones
  // let Windows draw light text on a white system menu.
  for (const sel of document.querySelectorAll('select, select option')) {
    const bg = getComputedStyle(sel).backgroundColor;
    const alpha = bg.startsWith('rgba') ? Number(bg.slice(bg.lastIndexOf(',') + 1, -1)) : 1;
    if (!(alpha >= 1))
      out.push(`${name(sel)} has a transparent background (${bg}) — the system popup will be unreadable`);
  }

  // The deck picker is one row by construction (--deck-cols comes from JS). A
  // seventh deck, or a hard-coded repeat(6, 1fr) creeping back, wraps it in
  // half — with no overflow, clipped text or small tap target for the rules
  // above to catch.
  const deckOpts = [...document.querySelectorAll('.deck-opt')].filter(shown);
  if (deckOpts.length) {
    const tops = [...new Set(deckOpts.map(o => Math.round(o.getBoundingClientRect().top)))];
    if (tops.length > 1)
      out.push(`the deck picker is on ${tops.length} rows, not one `
        + `(${deckOpts.length} decks at tops ${tops.sort((a, b) => a - b).join(', ')})`);
  }
  // Each swatch inside its own tile. The tiles are equal and one row, so the
  // rule above passes, while the cards inside spilled over their neighbours:
  // stretched to the tallest deck's height, a shorter deck took its width from
  // its aspect ratio and outgrew the tile (87-115px cards in 98px tiles at
  // 1440x900). Nothing overflowed the page, so no other rule saw it.
  for (const o of deckOpts) {
    const t = o.getBoundingClientRect(), c = o.querySelector('.card')?.getBoundingClientRect();
    if (c && (c.left < t.left - 1 || c.right > t.right + 1 || c.top < t.top - 1 || c.bottom > t.bottom + 1)) {
      out.push(`the ${o.dataset.deck} swatch spills out of its tile `
        + `(card ${Math.round(c.width)}x${Math.round(c.height)} in a ${Math.round(t.width)}x${Math.round(t.height)} tile)`);
      break;
    }
  }
  return out;
};

/* ---- pass 0: the document itself ------------------------------------------- */

// A layout assertion cannot catch a missing viewport meta: Playwright's
// `viewport` option sets the layout viewport directly, and the tag is only
// consulted under mobile emulation. So the page measures identically with or
// without it here, while a real phone lays it out at ~980px and scales the
// result down. These are document facts instead, checked once — cheap, and the
// only thing that would have caught it.
async function checkDocument(browser) {
  console.log('\ndocument');
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.goto(URL_);
  const bad = await page.evaluate(() => {
    const out = [];
    const vp = document.querySelector('meta[name="viewport"]');
    if (!vp) out.push('no viewport meta — a phone will lay the page out at ~980px and scale it down');
    else if (!/width\s*=\s*device-width/.test(vp.content))
      out.push(`viewport meta does not set width=device-width: "${vp.content}"`);
    if (document.compatMode !== 'CSS1Compat')
      out.push('quirks mode — no doctype, so box sizing and table layout differ from every browser default');
    if (document.characterSet !== 'UTF-8')
      out.push(`charset is ${document.characterSet}, not UTF-8 — accented Italian will render as mojibake over file://`);
    if (!document.documentElement.lang)
      out.push('no lang on <html> — screen readers and hyphenation have no language to work from');
    return out;
  });
  await page.close();
  console.log(`  ${bad.length ? 'FAIL' : 'pass'}  head tags`);
  bad.forEach(b => console.log(`        ${b}`));
  return bad.length ? 1 : 0;
}

/* ---- fonts: the page must not need the internet ---------------------------- */

// The three faces used to be a <link> to fonts.googleapis.com. Nothing failed
// when they did not load: the browser fell back to a generic serif and the
// wordmark set 12% narrower than every threshold below was calibrated against.
// This check never saw it, because this check has always had the network up.
// An APK is meant to run with the radio off, so that fallback is what it would
// have shipped. These assertions are why it cannot come back.

// The latin subset the woff2 files were cut to. A character outside it has no
// glyph in what we ship and falls back on its own, mid-word.
const LATIN = (cp) =>
  cp <= 0xFF || cp === 0x131 || (cp >= 0x152 && cp <= 0x153) || (cp >= 0x2BB && cp <= 0x2BC) ||
  cp === 0x2C6 || cp === 0x2DA || cp === 0x2DC || cp === 0x304 || cp === 0x308 || cp === 0x329 ||
  (cp >= 0x2000 && cp <= 0x206F) || cp === 0x20AC || cp === 0x2122 || cp === 0x2191 ||
  cp === 0x2193 || cp === 0x2212 || cp === 0x2215 || cp === 0xFEFF || cp === 0xFFFD;

// Only the ones the page uses; an unknown entity is left alone and will read as
// ASCII, which is harmless here because ASCII is inside the subset anyway.
const ENTITIES = {
  rsquo: 0x2019, lsquo: 0x2018, ldquo: 0x201C, rdquo: 0x201D, laquo: 0xAB, raquo: 0xBB,
  middot: 0xB7, nbsp: 0xA0, mdash: 0x2014, ndash: 0x2013, hellip: 0x2026,
};

async function checkFonts(browser) {
  console.log('\nfonts');
  let failed = 0;

  const source = readFileSync(FILE, 'utf8')
    .replace(/&([a-z]+);/gi, (m, name) => (ENTITIES[name] ? String.fromCodePoint(ENTITIES[name]) : m))
    // Numeric entities too: &#8594; is U+2192, outside the subset, and without
    // this it would read as ASCII and pass.
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)));
  const outside = new Map();
  for (const ch of source) {
    const cp = ch.codePointAt(0);
    if (cp > 0x7F && !LATIN(cp)) outside.set(ch, 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'));
  }
  console.log(`  ${outside.size ? 'FAIL' : 'pass'}  every character is in the latin subset`);
  if (outside.size) {
    failed++;
    for (const [ch, cp] of outside)
      console.log(`        ${cp} ${ch} — no glyph in fonts/; widen the subset or do not use it`);
  }

  // Everything but the page itself is cut off, which is what an APK sees.
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const external = [];
  await page.route('**', (route) => {
    const url = route.request().url();
    if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    external.push(url);
    return route.abort();
  });
  await page.goto(URL_);
  // Ask for each face explicitly. A browser only fetches a face when something
  // on the current screen uses it, so reading .status after load tells you
  // which weights the start screen happens to draw with — not whether the
  // files are there. load() is the question we actually mean.
  const faces = await page.evaluate(async () => {
    const declared = [...document.fonts];
    return Promise.all(declared.map(async (f) => {
      try { await f.load(); } catch { /* status below carries the verdict */ }
      return { family: f.family, weight: f.weight, status: f.status };
    }));
  });
  await page.close();

  const unloaded = faces.filter((f) => f.status !== 'loaded');
  const ok = faces.length > 0 && unloaded.length === 0;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  all ${faces.length} @font-face rules load with the network down`);
  if (!ok) {
    failed++;
    if (!faces.length) console.log('        no @font-face rules at all — the page is on system fonts');
    unloaded.forEach((f) => console.log(`        ${f.family} ${f.weight}: ${f.status}`));
  }

  console.log(`  ${external.length ? 'FAIL' : 'pass'}  no subresource comes from the network`);
  if (external.length) {
    failed++;
    [...new Set(external)].forEach((u) => console.log(`        ${u}`));
  }
  return failed;
}

/* ---- pass 1: every screen -------------------------------------------------- */

async function checkScreens(browser) {
  console.log('\nscreens');
  let failed = 0;
  for (const vname of SCREEN_VIEWPORTS) {
    const [, width, height] = VIEWPORTS.find(v => v[0] === vname);
    for (const screen of SCREENS) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errs = [];
      page.on('pageerror', e => errs.push('script error: ' + e.message));
      // Every request the page makes is file:// now that the fonts are
      // self-hosted, so a console network error is a defect, not local noise.
      page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

      await page.goto(URL_);
      await page.evaluate(() => localStorage.removeItem('discola.history'));
      if (screen.seed) await screen.seed(page);
      await page.goto(URL_);
      await page.waitForTimeout(350);
      await screen.open(page);
      await page.waitForTimeout(350);

      const issues = [
        ...(await page.evaluate(audit)),
        ...(screen.check ? await page.evaluate(screen.check) : []),
        ...errs,
      ];
      if (issues.length) failed++;
      console.log(`  ${issues.length ? 'FAIL' : 'pass'}  ${vname.padEnd(16)} ${screen.name}`);
      issues.forEach(i => console.log(`        ${i}`));
      await page.close();
    }
  }
  return failed;
}

/* ---- pass 2: the card table ----------------------------------------------- */

const measure = () => {
  const r = s => document.querySelector(s).getBoundingClientRect();
  const oppHand = r('.hand--opp'), trick = r('.trick'), tallone = r('.tallone');
  const youHand = r('.hand--you'), table = r('.table'), card = r('.hand--you .card');

  // Landscape puts the trick and the tallone side by side; portrait stacks
  // them. Sort the content boxes and measure whatever ends up adjacent, so the
  // numbers mean the same thing in both. Measuring a fixed pair counted the
  // tallone as empty space in portrait — a metric that failed every good
  // layout and passed the bad one.
  const boxes = [oppHand, trick, tallone, youHand].sort((a, b) => a.top - b.top);
  const gaps = [];
  for (let i = 1; i < boxes.length; i++) gaps.push(boxes[i].top - boxes[i - 1].bottom);

  return {
    gapTop: Math.round(trick.top - oppHand.bottom),
    gapBot: Math.round(youHand.top - Math.max(trick.bottom, tallone.bottom)),
    belowFold: Math.round(youHand.bottom - window.innerHeight),
    overflow: Math.round(youHand.bottom - table.bottom),
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
    maxGap: Math.round(Math.max(0, ...gaps)),
    gapRatio: Math.max(0, ...gaps) / card.height,
    cw: Math.round(card.width), ch: Math.round(card.height),
  };
};

const tableFaults = r => [
  r.gapTop < 0 && `trick overlaps the opponent's hand by ${-r.gapTop}px`,
  r.gapBot < 0 && `trick overlaps your hand by ${-r.gapBot}px`,
  r.belowFold > 0 && `your hand is ${r.belowFold}px below the fold`,
  r.overflow > 0 && `your hand overflows the table by ${r.overflow}px`,
  r.hScroll && 'table scrolls sideways',
  // Both terms are needed. The ratio alone misjudges a viewport so tight the
  // card sits on its floor, where an ordinary gap is a large share of a small
  // card; the absolute alone misjudges a big screen, where a wide gap beside a
  // tall card is breathing room.
  (r.gapRatio > 0.25 && r.maxGap > 48) &&
    `rows drift apart: widest gap ${r.maxGap}px, ${r.gapRatio.toFixed(2)} of a card`,
].filter(Boolean);

async function checkTable(browser, only, inflate) {
  console.log(inflate ? '\ntable, inflated spacing' : '\ntable');
  let failed = 0;
  for (const [vname, width, height] of VIEWPORTS) {
    if (only && !only.includes(vname)) continue;
    const page = await browser.newPage({ viewport: { width, height } });
    const rows = [];
    // The table only exists once a hand is dealt, so each deck goes through the
    // real flow: pick it on the start screen, then press Gioca.
    for (const deck of DECKS) {
      await page.goto(URL_);
      if (inflate) await page.addStyleTag({
        content: ':root{ --pad-block: 1.5rem; --step: 1.25rem; --slack: 16px; }' });
      await page.click(`#decks .deck-opt[data-deck="${deck}"]`);
      await page.click('#startPlay');
      await page.waitForTimeout(260);
      rows.push({ deck, ...(await page.evaluate(measure)) });
    }
    await page.close();

    const bad = rows.flatMap(r => tableFaults(r).map(f => `${r.deck}: ${f}`));
    if (bad.length) failed++;
    const margin = Math.min(...rows.map(r => Math.min(r.gapTop, r.gapBot, -r.belowFold)));
    console.log(`  ${bad.length ? 'FAIL' : 'pass'}  ${vname.padEnd(18)} ` +
      `${String(width).padStart(4)}x${String(height).padStart(4)}  ` +
      `card ${String(rows[0].cw).padStart(3)}x${String(rows[0].ch).padStart(3)}  ` +
      `margin ${String(margin).padStart(4)}px  ` +
      `gap ${Math.max(...rows.map(r => r.gapRatio)).toFixed(2)}`);
    bad.forEach(f => console.log(`        ${f}`));
  }
  return failed;
}

/* ---- run ------------------------------------------------------------------ */

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let failed = 0;
failed += await checkDocument(browser);
failed += await checkFonts(browser);
failed += await checkScreens(browser);
failed += await checkTable(browser, null, false);
failed += await checkTable(browser, TIGHT, true);
await browser.close();

console.log(failed ? `\n${failed} case(s) failed` : '\nAll checks pass.');
process.exit(failed ? 1 : 0);
