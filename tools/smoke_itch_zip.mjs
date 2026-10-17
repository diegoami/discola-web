#!/usr/bin/env node
/**
 * Smoke test the itch.io HTML5 zip that tools/package_itch.mjs wrote.
 *
 *   node tools/smoke_itch_zip.mjs [path-to-zip]
 *
 * The default is the zip for the version in mobile/android/app/build.gradle,
 * in dist-release/vX.Y.Z/. Run it after `package_itch.mjs --confirm` and
 * before the tag (DESKTOP.md, Releasing). It checks, in order:
 *
 *   1. the zip's SHA-256 matches its line in SHA256SUMS.txt;
 *   2. an extractor that is not ours (tar or unzip) opens it, and index.html
 *      is at the root;
 *   3. the extracted files are exactly public/'s files, byte for byte — the
 *      packager's zip writer is hand-rolled, and this is its only check;
 *   4. the extracted page, served over http as itch.io would, loads with no
 *      script or console errors, shows all six decks, Gioca is on screen, and
 *      the start sheet does not scroll at the 640x480 embed.
 *
 * Nothing here touches the live itch.io page.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKSUM_FILE, parseChecksums, sha256 } from './checksums.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

const fail = msg => { console.error(`\nsmoke_itch_zip: ${msg}`); process.exit(1); };

function defaultZip() {
  const gradle = readFileSync(path.join(ROOT, 'mobile/android/app/build.gradle'), 'utf8');
  const version = /versionName\s+["']([^"']+)["']/.exec(gradle)?.[1];
  if (!version) fail('could not read versionName from mobile/android/app/build.gradle');
  return path.join(ROOT, 'dist-release', `v${version}`, `Discola-${version}-itch-html5.zip`);
}
const ZIP = path.resolve(process.argv[2] ?? defaultZip());
if (!existsSync(ZIP)) fail(`zip not found: ${ZIP}`);

const checks = [];
const check = (name, ok, detail = '') => checks.push([name, ok, detail]);

// 1. The hash the release will publish.
const zipBytes = readFileSync(ZIP);
const sumsPath = path.join(path.dirname(ZIP), CHECKSUM_FILE);
if (!existsSync(sumsPath)) fail(`${CHECKSUM_FILE} is missing next to the zip`);
const recorded = parseChecksums(readFileSync(sumsPath, 'utf8')).get(path.basename(ZIP));
check('zip hash matches SHA256SUMS.txt', recorded === sha256(zipBytes),
  recorded ? 'hash differs' : 'no line for this zip');

// 2. Extract with a tool that did not write the archive: bsdtar reads zip on
// Windows and macOS, and Linux has unzip.
const SCRATCH = mkdtempSync(path.join(tmpdir(), 'discola-itch-smoke-'));
const SITE = path.join(SCRATCH, 'site');
// On Windows that is System32's tar.exe by full path: Git Bash puts GNU tar
// first on PATH, which cannot read zip and treats "C:" as a remote host.
const [cmd, args] = process.platform === 'linux'
  ? ['unzip', ['-q', ZIP, '-d', SITE]]
  : [process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar',
     ['-xf', ZIP, '-C', SITE]];
mkdirSync(SITE);
const ex = spawnSync(cmd, args, { encoding: 'utf8' });
check(`${path.basename(cmd)} extracts the zip`, ex.status === 0, (ex.stderr || ex.error?.message || '').trim());
check('index.html is at the zip root', existsSync(path.join(SITE, 'index.html')));

// 3. Exactly public/, byte for byte.
function* walk(dir, prefix = '') {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(abs).isDirectory()) yield* walk(abs, rel);
    else yield rel;
  }
}
if (existsSync(SITE)) {
  const want = [...walk(PUBLIC)].sort();
  const got = [...walk(SITE)].sort();
  check('same file list as public/', JSON.stringify(want) === JSON.stringify(got),
    `missing: ${want.filter(f => !got.includes(f)).join(', ') || '-'}; extra: ${got.filter(f => !want.includes(f)).join(', ') || '-'}`);
  const differ = want.filter(f => !got.includes(f)
    || !readFileSync(path.join(PUBLIC, f)).equals(readFileSync(path.join(SITE, f))));
  check('every file is byte-identical to public/', differ.length === 0, differ.join(', '));
}

// 4. The page, from the extracted tree, over http.
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(SITE, '.' + rel);
  if (!file.startsWith(SITE) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || chromium.executablePath() });
try {
  if (existsSync(path.join(SITE, 'index.html'))) {
    const page = await browser.newPage({ viewport: { width: 640, height: 480 }, locale: 'it-IT' });
    const errs = [];
    page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
    page.on('requestfailed', r => errs.push(`request failed: ${r.url()}`));
    page.on('response', r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
    await page.goto(base);
    await page.waitForTimeout(500);

    check('html lang is it', (await page.getAttribute('html', 'lang')) === 'it');
    const decks = await page.$$eval('#viewStart .deck-opt', els => els.map(e => e.dataset.deck));
    check('six decks on the start screen', decks.length === 6, decks.join(','));
    const art = await page.$eval('#viewStart .deck-opt .card', el => ({ w: el.offsetWidth, h: el.offsetHeight }));
    check('deck art is drawn', art.w > 0 && art.h > 0, `${art.w}x${art.h}`);
    const view = await page.evaluate(() => {
      const b = document.querySelector('#startPlay').getBoundingClientRect();
      const s = document.querySelector('#viewStart .sheet-body');
      return { bottom: b.bottom, vh: innerHeight, scroll: s.scrollHeight, client: s.clientHeight };
    });
    check('Gioca is on screen at 640x480', view.bottom <= view.vh + 1, `${view.bottom} vs ${view.vh}`);
    check('start sheet does not scroll at 640x480', view.scroll <= view.client + 1, `${view.scroll} in ${view.client}`);
    check('no script, console or network errors', errs.length === 0, errs.join(' | '));
  }
} finally {
  await browser.close();
  server.close();
  rmSync(SCRATCH, { recursive: true, force: true });
}

let failed = 0;
for (const [name, ok, detail] of checks) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
  if (!ok) failed++;
}
if (failed) fail(`${failed} check(s) failed`);
console.log('\nsmoke ok.');
