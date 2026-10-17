#!/usr/bin/env node
/**
 * Upload the itch.io HTML5 zip with butler.
 *
 *   node tools/publish_itch.mjs            # dry run: check everything, print the command
 *   node tools/publish_itch.mjs --confirm  # actually push
 *
 * Takes the newest dist-release/vX.Y.Z/ (tools/package_itch.mjs wrote the zip,
 * tools/smoke_itch_zip.mjs opened it). Like publish_release.mjs it refuses,
 * dry run included, unless every staged file verifies against SHA256SUMS.txt
 * and vX.Y.Z is an annotated tag on origin, on origin/main, at the commit
 * recorded in dist-release/vX.Y.Z.source. A push to itch.io is public and
 * cannot be taken back, so it does nothing without --confirm.
 *
 * Needs butler (https://itch.io/docs/butler/) on PATH, or BUTLER set to its
 * path, and an API key in BUTLER_API_KEY (or a prior `butler login`). The key
 * stays in the environment: this script never reads it, prints it or writes it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions } from './versions.mjs';
import { verifyChecksums } from './checksums.mjs';
import { branchHead, parseSource, tagRef } from './source_tag.mjs';

const TARGET = 'diegoami/discola:html5';          // itch.io user/game:channel
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIRM = process.argv.includes('--confirm');
const BUTLER = process.env.BUTLER || 'butler';

const fail = (msg) => { console.error(`\npublish_itch: ${msg}`); process.exit(1); };

// --- which version: the newest dist-release/vX.Y.Z/, by number not by string ---
const distRoot = path.join(ROOT, 'dist-release');
if (!existsSync(distRoot)) fail('no dist-release/ — run tools/package_itch.mjs first.');
const tags = readdirSync(distRoot).filter((d) => /^v\d+\.\d+\.\d+$/.test(d)).sort(compareVersions);
if (!tags.length) fail('dist-release/ has no vX.Y.Z directory — run tools/package_itch.mjs first.');
const tag = tags[tags.length - 1];
const version = tag.slice(1);
const dir = path.join(distRoot, tag);

// --- and it must be the version being released, not a stale leftover (#115) ---
// The newest directory by name is only the version being released when this
// checkout's own versionName agrees; a clone that has not packaged yet would
// otherwise upload an older release's zip.
const gradlePath = path.join(ROOT, 'mobile/android/app/build.gradle');
if (!existsSync(gradlePath)) fail('mobile/android/app/build.gradle is missing — cannot read versionName.');
const current = /versionName\s+["']([^"']+)["']/.exec(readFileSync(gradlePath, 'utf8'))?.[1];
if (!current) fail('could not read versionName from mobile/android/app/build.gradle');
if (current !== version)
  fail(`the newest dist-release/ directory is ${tag}, but this checkout is version ${current}. ` +
       `Package ${current} first (tools/package_itch.mjs --confirm), or check out the tagged commit of ${tag}.`);

// --- the zip must be there, and every staged file must verify ---
const zipName = `Discola-${version}-itch-html5.zip`;
let assets;
try { assets = verifyChecksums(dir); } catch (e) { fail(e.message); }
if (!assets.has(zipName)) fail(`${zipName} is not in dist-release/${tag}/ — run tools/package_itch.mjs --confirm.`);
const zip = path.join(dir, zipName);

// --- the source must be tagged: vX.Y.Z on origin/main, at the packaged commit ---
const sourceFile = path.join(distRoot, `${tag}.source`);
if (!existsSync(sourceFile))
  fail(`dist-release/${tag}.source is missing — package again with tools/package_release.mjs.`);
let source;
try { source = parseSource(readFileSync(sourceFile, 'utf8')); }
catch (e) { fail(`dist-release/${tag}.source: ${e.message}`); }
const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const remote = git(['ls-remote', 'origin']);
if (remote.status !== 0) fail(`git ls-remote origin failed:\n${remote.stderr}`);
const ref = tagRef(remote.stdout, tag);
if (!ref?.commit) fail(`${tag} is not tagged on origin. Tag the packaged commit first:\n  git tag -a ${tag} ${source.commit} -m "Discola ${version}" && git push origin ${tag}`);
if (!ref.annotated) fail(`origin's ${tag} is a lightweight tag; a milestone is an annotated tag (AGENTS.md).`);
if (ref.commit !== source.commit)
  fail(`origin's ${tag} is not the commit that was packaged.\n  packaged ${source.commit}\n  tagged   ${ref.commit}`);
const main = branchHead(remote.stdout, 'main');
if (!main) fail('origin has no main branch.');
const onMain = git(['merge-base', '--is-ancestor', ref.commit, main]);
if (onMain.status === 1) fail(`${tag} (${ref.commit}) is not on origin's main (${main}).`);
if (onMain.status !== 0) fail(`origin's main (${main}) is not in this clone — git fetch origin, then retry:\n${onMain.stderr}`);

// --- butler must be usable ---
const args = ['push', zip, TARGET, '--userversion', version];
const have = spawnSync(BUTLER, ['--version'], { encoding: 'utf8' });
if (have.error || have.status !== 0)
  fail(`butler is not installed or not on PATH (set BUTLER to its path): https://itch.io/docs/butler/`);

console.log(`\nitch.io upload for Discola ${tag}`);
console.log(`  zip:     dist-release/${tag}/${zipName}`);
console.log(`  commit:  ${source.commit}`);
console.log(`  target:  ${TARGET}  (version ${version})`);
console.log(`  command: butler ${args.map((a) => (a === zip ? `dist-release/${tag}/${zipName}` : a)).join(' ')}`);
if (!CONFIRM) {
  console.log('\nDry run. Re-run with --confirm to push.');
  process.exit(0);
}

const run = spawnSync(BUTLER, args, { stdio: 'inherit' });
if (run.status !== 0) fail(`butler exited with ${run.status ?? run.error?.message}.`);
console.log('\nPushed. Check the page, then tick the channel as the one to play in the browser if it is not already.');
