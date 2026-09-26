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
 * releases repo. It also refuses, dry run included, unless vX.Y.Z is tagged on
 * origin, on origin/main, at the commit recorded in dist-release/vX.Y.Z.source,
 * and the notes name that commit, so every published binary names its source.
 * Outward-facing and hard to take back
 * once the tag is public, so it does nothing without --confirm.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions } from './versions.mjs';
import { CHECKSUM_FILE, verifyChecksums } from './checksums.mjs';
import { buildNotes } from './release_notes.mjs';
import { branchHead, parseSource, tagRef } from './source_tag.mjs';

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

// --- the source must be tagged: vX.Y.Z on origin/main, at the packaged commit ---
// A release is a milestone (CLAUDE.md): the reviewed candidate on main is
// packaged, smoke-tested, then tagged, so the tag and the build name one commit.
const sourceFile = path.join(distRoot, `${tag}.source`);
if (!existsSync(sourceFile))
  fail(`dist-release/${tag}.source is missing — package again with tools/package_release.mjs.`);
let source;
try { source = parseSource(readFileSync(sourceFile, 'utf8')); }
catch (e) { fail(`dist-release/${tag}.source: ${e.message}`); }
const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
// Unfiltered: with a ref pattern, ls-remote omits the peeled ^{} line. One call
// reads origin's tags and its main as they are now, not as last fetched (#41).
const remote = git(['ls-remote', 'origin']);
if (remote.status !== 0) fail(`git ls-remote origin failed:\n${remote.stderr}`);
const ref = tagRef(remote.stdout, tag);
const tagged = ref?.commit;
if (!tagged)
  fail(`${tag} is not tagged on origin. After the milestone review's AGREE, tag the ` +
       `packaged commit, then publish:\n` +
       `  git tag -a ${tag} ${source.commit} -m "Discola ${version}"\n  git push origin ${tag}`);
if (!ref.annotated)
  fail(`origin's ${tag} is a lightweight tag; a milestone is an annotated tag (CLAUDE.md). Replace it:\n` +
       `  git tag -d ${tag} && git push origin :refs/tags/${tag}\n` +
       `  git tag -a ${tag} ${tagged} -m "Discola ${version}" && git push origin ${tag}`);
if (tagged !== source.commit)
  fail(`origin's ${tag} is not the commit that was packaged.\n` +
       `  packaged ${source.commit}\n  tagged   ${tagged}\n` +
       'Package again from the tagged commit, or, if the tag is wrong, fix it on origin.');
// On main: an ancestor of origin's main as it is now (the candidate may have
// been passed since). Not the local origin/main, which is only the last fetch
// and can be behind (a valid tag refused) or ahead (an invalid one passed, #41).
const main = branchHead(remote.stdout, 'main');
if (!main) fail('origin has no main branch.');
const onMain = git(['merge-base', '--is-ancestor', tagged, main]);
if (onMain.status === 1) fail(`${tag} (${tagged}) is not on origin's main (${main}). A milestone tag goes on main.`);
if (onMain.status !== 0)
  fail(`origin's main (${main}) is not in this clone — git fetch origin, then retry:\n${onMain.stderr}`);

// --- release notes, in Italian to match the game ---
// The subtitle and the changes are the release-specific part: what changed,
// set with each version bump, so the milestone's candidate carries the notes
// that ship and its reviewer reads them. 1.0.5 had neither (no game change).
let notes;
try {
  notes = buildNotes(version, platforms, {
    subtitle: 'anche in inglese',
    changes: [
      'Il gioco è anche in inglese: segue la lingua del dispositivo, e si cambia in Impostazioni.',
      'A fine partita, una schermata sul tavolo invece di una finestra, con avversario e mazzo da scegliere per la partita successiva.',
      'Android: il tasto Indietro torna alla schermata precedente, e dalla schermata iniziale c\'è il pulsante Esci.',
      'Le carte del selettore dei mazzi non escono più dal loro riquadro.',
      'Un\'informativa sulla privacy, in Informazioni. Su Android storico e impostazioni restano fuori anche dal trasferimento tra telefoni.',
    ],
    commit: tagged,
  });
} catch (e) { fail(e.message); }

console.log(`publish ${tag} to ${RELEASES_REPO}`);
for (const name of names) console.log(`  ${name}`);
console.log(`  ${CHECKSUM_FILE}`);
console.log(`source ${tag} on origin → ${tagged}`);

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
