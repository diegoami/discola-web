#!/usr/bin/env node
/**
 * Build a release — the Android APK and the Windows desktop executable — and
 * stage both for publishing.
 *
 *   node tools/package_release.mjs
 *
 * Steps, in order, stopping at the first failure:
 *   1. cross-check every version declaration (Android, Tauri, Cargo, npm and
 *      both lockfiles) — the shared version line is enforced here, before
 *      anything is built
 *   2. cap sync android   — copy public/ into the Android project
 *   3. gradlew assembleRelease
 *   4. refuse an unsigned APK (a silently unsigned build is worse than none)
 *   5. apksigner verify    — the signature must actually check out
 *   6. desktop: npm ci, then tauri build --no-bundle
 *   7. refuse an implausible executable (missing, truncated, not a PE binary)
 *   8. stage dist-release/vX.Y.Z/ with both assets and SHA256SUMS.txt, then
 *      re-read and verify what was just staged
 *
 * The version comes from mobile/android/app/build.gradle's versionName, and the
 * step 1 cross-check is what keeps every desktop declaration honest against it.
 * Both targets stage together so a half-built release can never be published;
 * a rerun replaces the directory rather than merging into it.
 *
 * Node standard library only. It shells out to the Android toolchain and to
 * npm/cargo, which is the tooling a packaging step is allowed to need; nothing
 * here is imported by the game or the web build.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions } from './versions.mjs';
import { parseCertSha256, normalizeSha256 } from './apk_cert.mjs';
import { sha256, writeChecksums, verifyChecksums } from './checksums.mjs';

const WIN = process.platform === 'win32';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = path.join(ROOT, 'mobile');
const ANDROID = path.join(MOBILE, 'android');
const DESKTOP = path.join(ROOT, 'desktop');

const fail = (msg) => { console.error(`\npackage_release: ${msg}`); process.exit(1); };

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
  (WIN ? path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
       : path.join(os.homedir(), 'Android', 'Sdk'));
if (!existsSync(sdk)) fail(`Android SDK not found (looked in ${sdk}). Set ANDROID_HOME.`);

const javaHome = process.env.JAVA_HOME;
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };

// Node 24 refuses to spawn a .cmd/.bat without shell:true (a Windows security
// change), and returns status null rather than an error. So on Windows every
// external command goes through the shell, and its arguments are quoted here
// because the shell would otherwise split them on spaces — the SDK and JDK can
// sit under "Program Files".
const quote = (a) => (WIN && /[\s&()[\]{}^=;!'+,`~]/.test(a) ? `"${a}"` : a);
function run(cmd, args, opts = {}) {
  if (WIN) return spawnSync([cmd, ...args].map(quote).join(' '), { shell: true, env, ...opts });
  return spawnSync(cmd, args, { env, ...opts });
}

function step(label, cmd, args, opts = {}) {
  console.log(`\n> ${label}`);
  const res = run(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) fail(`${label} failed (exit ${res.status ?? res.signal}).`);
}

// --- version: one line across both targets, enforced before anything builds ---
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const gradle = read('mobile/android/app/build.gradle');
const version = /versionName\s+["']([^"']+)["']/.exec(gradle)?.[1];
if (!version) fail('could not read versionName from mobile/android/app/build.gradle');
const tag = `v${version}`;
console.log(`packaging Discola ${tag}`);

// Every declaration the version appears in, both lockfiles included: a bump
// that misses one would ship an exe whose metadata disagrees with the tag, or
// leave cargo to rewrite a committed lockfile during the release build.
const tauriConf = JSON.parse(read('desktop/src-tauri/tauri.conf.json'));
const desktopPkg = JSON.parse(read('desktop/package.json'));
const desktopLock = JSON.parse(read('desktop/package-lock.json'));
const declarations = {
  'mobile/android/app/build.gradle versionName': version,
  'desktop/src-tauri/tauri.conf.json version': tauriConf.version,
  'desktop/src-tauri/Cargo.toml version':
    /^version\s*=\s*"([^"]+)"/m.exec(read('desktop/src-tauri/Cargo.toml'))?.[1],
  'desktop/package.json version': desktopPkg.version,
  'desktop/package-lock.json version': desktopLock.version,
  'desktop/package-lock.json packages[""].version': desktopLock.packages?.['']?.version,
  'desktop/src-tauri/Cargo.lock discola version':
    /\[\[package\]\]\r?\nname = "discola"\r?\nversion = "([^"]+)"/.exec(read('desktop/src-tauri/Cargo.lock'))?.[1],
};
const disagreements = Object.entries(declarations).filter(([, value]) => value !== version);
if (disagreements.length) {
  fail(`the version declarations disagree with Android's ${version}:\n` +
    disagreements.map(([where, value]) => `  ${where}: ${value ?? '(missing)'}`).join('\n') +
    '\n\nBump every declaration and refresh both lockfiles (see DESKTOP.md).');
}

// --- a signing key must be configured, or the whole exercise is pointless ---
if (!existsSync(path.join(ANDROID, 'keystore.properties')))
  fail('mobile/android/keystore.properties is missing — no signing key configured. ' +
       'Copy keystore.properties.example and fill it in (see ANDROID.md §4).');

// --- 2 & 3: sync the web assets, then build ---
const apkDir = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'release');
rmSync(apkDir, { recursive: true, force: true }); // never mistake a stale APK for this one
step('cap sync android', 'npx', ['cap', 'sync', 'android'], { cwd: MOBILE });
step('gradlew assembleRelease', path.join(ANDROID, WIN ? 'gradlew.bat' : 'gradlew'),
     ['assembleRelease', '--console=plain'], { cwd: ANDROID });

// --- 4: refuse an unsigned APK ---
if (existsSync(path.join(apkDir, 'app-release-unsigned.apk')))
  fail('Gradle produced app-release-unsigned.apk — keystore.properties is not being applied.');
const apk = path.join(apkDir, 'app-release.apk');
if (!existsSync(apk)) fail(`expected ${path.relative(ROOT, apk)}, but it is not there.`);

// --- 5: the signature must verify, or nothing is staged ---
// A build that cannot be checked is not a build to ship. The step above exists
// because a silently unsigned artifact is worse than a failed build; a
// verification that is allowed to not happen undoes exactly that.
const buildTools = path.join(sdk, 'build-tools');
if (!existsSync(buildTools)) fail(`no Android build-tools under ${buildTools}.`);
// Newest installed version by number: string order puts 9.0.0 after 35.0.0.
const apksigner = readdirSync(buildTools).sort(compareVersions).reverse()
  .map(v => path.join(buildTools, v, WIN ? 'apksigner.bat' : 'apksigner'))
  .find(p => existsSync(p));
if (!apksigner) fail(`apksigner not found in any version under ${buildTools}.`);

console.log('\n> apksigner verify');
const res = run(apksigner, ['verify', '--print-certs', apk],
  { encoding: 'utf8', ...(javaHome ? { env: { ...env, JAVA_HOME: javaHome } } : {}) });
if (res.status !== 0) fail(`the APK does not verify:\n${res.stdout ?? ''}${res.stderr ?? ''}`);
process.stdout.write(res.stdout);
// accept both plain and colon-separated prints, and reject a truncated one
const digest = parseCertSha256(res.stdout);
if (!digest) fail('apksigner verify printed no complete SHA-256 digest — the signer cannot be confirmed.');

// The certificate decides whether this APK can upgrade an installed copy.
// When the expected fingerprint is recorded, a differently-signed APK fails
// here instead of installing nowhere and being noticed by a player.
const expectedFile = path.join(ANDROID, 'cert.sha256');
if (existsSync(expectedFile)) {
  const expected = normalizeSha256(readFileSync(expectedFile, 'utf8'));
  if (!expected) fail(`${path.relative(ROOT, expectedFile)} is not a 64-hex-character SHA-256.`);
  if (digest !== expected)
    fail(`the APK is signed by the wrong key.\n  expected ${expected}\n  got      ${digest}`);
} else {
  console.log('\n  note: mobile/android/cert.sha256 is not recorded yet. Save this fingerprint');
  console.log(`  so future builds refuse a different key:  ${digest}`);
}
const signer = digest;

// --- 6: the desktop executable, from the wrapper's pinned CLI ---
step('npm ci (desktop)', 'npm', ['ci', '--no-audit', '--no-fund'], { cwd: DESKTOP });
step('tauri build --no-bundle', 'npm', ['run', 'build'], { cwd: DESKTOP });

// --- 7: refuse an implausible executable ---
// The desktop equivalent of the unsigned-APK refusal: a missing, truncated or
// non-Windows file must never reach dist-release/.
const exe = path.join(DESKTOP, 'src-tauri', 'target', 'release', 'discola.exe');
if (!existsSync(exe)) fail(`expected ${path.relative(ROOT, exe)}, but it is not there.`);
const exeBytes = readFileSync(exe);
if (exeBytes.length < 1024 * 1024)
  fail(`the desktop executable is only ${exeBytes.length} bytes — that is not a build.`);
if (exeBytes[0] !== 0x4d || exeBytes[1] !== 0x5a)
  fail('the desktop executable does not start with the PE magic "MZ" — not a Windows binary.');

// --- 8: stage both, replacing any earlier directory ---
const outDir = path.join(ROOT, 'dist-release', tag);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const apkName = `Discola-${version}-android.apk`;
const exeName = `Discola-${version}-windows-x64.exe`;
copyFileSync(apk, path.join(outDir, apkName));
copyFileSync(exe, path.join(outDir, exeName));
writeChecksums(outDir, new Map([
  [apkName, sha256(readFileSync(path.join(outDir, apkName)))],
  [exeName, sha256(readFileSync(path.join(outDir, exeName)))],
]));
// Read back what was just written, before claiming success.
const staged = [...verifyChecksums(outDir)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

console.log(`\ndone.`);
console.log(`  dist-release/${tag}/`);
for (const [name, hash] of staged) console.log(`  ${hash}  ${name}`);
console.log(`  cert   ${signer}`);
console.log(`\nnext: node tools/publish_release.mjs   (dry run; --confirm to publish)`);
