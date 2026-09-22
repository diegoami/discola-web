#!/usr/bin/env node
/**
 * Publish a packaged release to the public releases repo as a GitHub Release.
 *
 *   node tools/publish_release.mjs            # dry run: check everything, do nothing
 *   node tools/publish_release.mjs --confirm  # actually create the release
 *
 * Reads dist-release/vX.Y.Z/ (from tools/package_release.mjs) — every staged
 * asset, verified against SHA256SUMS.txt, including the set itself: a missing
 * or unlisted file fails the run — and needs `gh` logged in with access to the
 * releases repo. Outward-facing and hard to take back once the tag is public,
 * so it does nothing without --confirm.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions } from './versions.mjs';
import { CHECKSUM_FILE, verifyChecksums } from './checksums.mjs';
import { buildNotes } from './release_notes.mjs';

const RELEASES_REPO = 'diegoami/discola-releases';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIRM = process.argv.includes('--confirm');

const fail = (msg) => { console.error(`\npublish_release: ${msg}`); process.exit(1); };

// --- which version: the newest dist-release/vX.Y.Z/, by number not by string ---
// String order would pick v1.9.0 over v1.10.0 once a component gains a digit.
const distRoot = path.join(ROOT, 'dist-release');
if (!existsSync(distRoot)) fail('no dist-release/ — run tools/package_release.mjs first.');
const tags = readdirSync(distRoot).filter((d) => /^v\d+\.\d+\.\d+$/.test(d)).sort(compareVersions);
if (!tags.length) fail('dist-release/ has no vX.Y.Z directory — run tools/package_release.mjs first.');
const tag = tags[tags.length - 1];
const version = tag.slice(1);
const dir = path.join(distRoot, tag);

// --- every staged file must verify, and the set must be exactly the manifest ---
let assets;
try { assets = verifyChecksums(dir); } catch (e) { fail(e.message); }
const names = [...assets.keys()].sort();

// --- which platforms the notes must describe ---
const platforms = [];
if (names.some((n) => n.endsWith('-android.apk'))) platforms.push('android');
if (names.some((n) => n.endsWith('-windows-x64.exe'))) platforms.push('windows');

// --- gh must be usable and the tag must be new ---
const gh = (args, opts = {}) => spawnSync('gh', args, { encoding: 'utf8', ...opts });
if (gh(['--version']).status !== 0) fail('the GitHub CLI (gh) is not installed or not on PATH.');
const seen = gh(['release', 'view', tag, '-R', RELEASES_REPO]);
if (seen.status === 0) fail(`${tag} already exists on ${RELEASES_REPO}. Bump the version first.`);

// --- release notes, in Italian to match the game ---
// The subtitle is the one release-specific line; future releases edit or drop it.
let notes;
try {
  notes = buildNotes(version, platforms, {
    subtitle: 'la prima versione per Windows, e Android aggiornato',
  });
} catch (e) { fail(e.message); }

console.log(`publish ${tag} to ${RELEASES_REPO}`);
for (const name of names) console.log(`  ${name}`);
console.log(`  ${CHECKSUM_FILE}`);

if (!CONFIRM) {
  console.log('\n--- dry run --- nothing was published.');
  console.log('Re-run with --confirm to create the release.');
  console.log('\nNotes that would be used:\n');
  console.log(notes.split('\n').map((l) => '  ' + l).join('\n'));
  process.exit(0);
}

const notesFile = path.join(os.tmpdir(), `discola-${tag}-notes.md`);
writeFileSync(notesFile, notes);
const res = gh(['release', 'create', tag,
  ...names.map((n) => path.join(dir, n)), path.join(dir, CHECKSUM_FILE),
  '-R', RELEASES_REPO, '--title', `Discola ${version}`, '--notes-file', notesFile],
  { stdio: 'inherit' });
if (res.status !== 0) fail('gh release create failed.');
console.log(`\npublished: https://github.com/${RELEASES_REPO}/releases/tag/${tag}`);
