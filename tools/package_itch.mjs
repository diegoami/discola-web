#!/usr/bin/env node
/**
 * Build the itch.io HTML5 build: a zip of public/ with index.html at its root.
 *
 *   node tools/package_itch.mjs            # dry run: prints the plan, writes nothing
 *   node tools/package_itch.mjs --confirm  # actually writes the zip
 *
 * The version comes from mobile/android/app/build.gradle's versionName — the
 * same source tools/package_release.mjs reads. The cross-check that every
 * other version declaration agrees with it is package_release.mjs's job; this
 * script trusts the single source and does not duplicate it.
 *
 * Output lands in dist-release/vX.Y.Z/ next to the APK and Windows exe. The
 * SHA256SUMS.txt there is *appended to* rather than rewritten: an existing APK
 * line is preserved so publish_release.mjs can read the directory as one
 * release. If the file does not exist, it is created with just the new line,
 * in the same single-line format as the existing entries.
 *
 * Node standard library only. The zip encoder is hand-rolled because node:zip
 * does not exist; the precedent in this repo is tools/pack_cards.py, which
 * writes its own PNG. This is the one place the stdlib-only rule is bent, and
 * the comment is the marker for it.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChecksums, writeChecksums } from './checksums.mjs';

// --- zip encoder (defined up top so the const is initialised before main runs) ---
// Format per APPNOTE.TXT: per-entry local file header + data, then central
// directory, then end-of-central-directory record. UTF-8 names (general-purpose
// bit 11 set), DOS time 0 (1980-01-01 00:00:00) for deterministic output.
// CRC-32 is the IEEE 802.3 polynomial 0xEDB88320 (reflected); the table is
// precomputed once. zlib.crc32 (Node 22.2+) would be enough, but encoding it
// here keeps the script working on older Nodes and makes the dependency on
// the file format visible.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function buildZip(entries) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const e of entries) {
    const data = readFileSync(e.abs);
    const nameBuf = Buffer.from(e.rel, 'utf8');
    const crc = crc32(data);
    // deflateRawSync is the raw DEFLATE bitstream, which is what zip wants
    // (no zlib header). If it would not shrink the file, store it instead.
    const deflated = deflateRawSync(data);
    const method = deflated.length < data.length ? 0x08 : 0x00;
    const payload = method === 0x08 ? deflated : data;
    const compressedSize = payload.length;
    const uncompressedSize = data.length;

    // Local file header: 30 bytes + name + extra
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);           // version needed to extract (2.0)
    local.writeUInt16LE(0x0800, 6);       // general purpose bit flag (UTF-8)
    local.writeUInt16LE(method, 8);       // compression method
    local.writeUInt16LE(0, 10);           // last mod file time (midnight)
    local.writeUInt16LE(0x0021, 12);      // last mod file date (1980-01-01)
    local.writeUInt32LE(crc, 14);         // crc-32
    local.writeUInt32LE(compressedSize, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(nameBuf.length, 26); // file name length
    local.writeUInt16LE(0, 28);           // extra field length
    localChunks.push(local, nameBuf, payload);

    // Central directory record: 46 bytes + name + extra + comment
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header signature
    central.writeUInt16LE(0x031e, 4);     // version made by (UNIX, 3.0)
    central.writeUInt16LE(20, 6);         // version needed to extract
    central.writeUInt16LE(0x0800, 8);     // general purpose bit flag
    central.writeUInt16LE(method, 10);    // compression method
    central.writeUInt16LE(0, 12);         // last mod file time (midnight)
    central.writeUInt16LE(0x0021, 14);     // last mod file date (1980-01-01)
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressedSize, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);         // extra field length
    central.writeUInt16LE(0, 32);         // file comment length
    central.writeUInt16LE(0, 34);         // disk number start
    central.writeUInt16LE(0, 36);         // internal file attributes
    central.writeUInt32LE(0, 38);         // external file attributes
    central.writeUInt32LE(offset, 42);    // relative offset of local header
    centralChunks.push(central, nameBuf);

    offset += 30 + nameBuf.length + payload.length;
  }

  // End of central directory record: 22 bytes + comment
  const cdSize = centralChunks.reduce((n, c) => n + c.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);     // EOCD signature
  eocd.writeUInt16LE(0, 4);              // number of this disk
  eocd.writeUInt16LE(0, 6);              // disk where CD starts
  eocd.writeUInt16LE(entries.length, 8); // number of CD records on this disk
  eocd.writeUInt16LE(entries.length, 10);// total number of CD records
  eocd.writeUInt32LE(cdSize, 12);        // size of central directory
  eocd.writeUInt32LE(offset, 16);        // offset of start of CD
  eocd.writeUInt16LE(0, 20);             // comment length

  return Buffer.concat([...localChunks, ...centralChunks, eocd]);
}

// --- main flow ---

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist-release');

const fail = (msg) => { console.error(`\npackage_itch: ${msg}`); process.exit(1); };
const confirm = process.argv.includes('--confirm');

// --- 0: read the version ---
const gradlePath = path.join(ROOT, 'mobile/android/app/build.gradle');
if (!existsSync(gradlePath))
  fail('mobile/android/app/build.gradle is missing — cannot read versionName.');
const gradle = readFileSync(gradlePath, 'utf8');
const version = /versionName\s+["']([^"']+)["']/.exec(gradle)?.[1];
if (!version) fail('could not read versionName from mobile/android/app/build.gradle');
const tag = `v${version}`;
const outDir = path.join(DIST, tag);
const zipName = `Discola-${version}-itch-html5.zip`;
const zipPath = path.join(outDir, zipName);
const sumsPath = path.join(outDir, 'SHA256SUMS.txt');

// --- 1: pre-flight on public/ ---
if (!existsSync(PUBLIC)) fail('public/ is missing — the game source is gone.');
const indexPath = path.join(PUBLIC, 'index.html');
if (!existsSync(indexPath))
  fail('public/index.html is missing — itch.io needs index.html at the zip root.');

// --- 2: walk public/ ---
// Entries are { rel, abs, size }. rel is the path from public/ using forward
// slashes — ZIP's archive paths are forward-slash regardless of host OS.
// Directories are not added as zip entries; only files. The walk is recursive
// (public/decks, public/fonts, public/icons, public/engine.js, …).
function* walk(dir, prefix = '') {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = statSync(abs);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (st.isDirectory()) yield* walk(abs, rel);
    else yield { rel, abs, size: st.size };
  }
}
const entries = [...walk(PUBLIC)].sort((a, b) => a.rel.localeCompare(b.rel));
if (!entries.length) fail('public/ is empty — nothing to package.');

// --- 3: print the plan ---
console.log(`\nitch.io build for Discola ${tag}`);
console.log(`  source:    public/`);
console.log(`  entries:   ${entries.length}`);
console.log(`  output:    dist-release/${tag}/${zipName}`);
console.log(`  sums file: dist-release/${tag}/SHA256SUMS.txt (append)`);
console.log('  files:');
for (const e of entries) console.log(`    ${e.rel}  (${e.size} bytes)`);

if (!confirm) {
  console.log('\nDry run. Re-run with --confirm to write.');
  process.exit(0);
}

// --- 4: preflight the existing SHA256SUMS.txt ---
// Parse any existing manifest first so a malformed one fails before we
// touch the output directory (#86). sumsMap is empty if the file doesn't
// exist yet — that is the first-run case where package_release.mjs hasn't
// staged APK and exe entries; the zip line is then the only entry.
let sumsMap = new Map();
if (existsSync(sumsPath)) {
  try { sumsMap = parseChecksums(readFileSync(sumsPath, 'utf8')); }
  catch (e) { fail(`SHA256SUMS.txt is malformed: ${e.message}`); }
}

// --- 5: write the zip ---
mkdirSync(outDir, { recursive: true });
const zipBuf = buildZip(entries);
writeFileSync(zipPath, zipBuf);
const zipHash = createHash('sha256').update(zipBuf).digest('hex');
console.log(`\n  wrote ${zipBuf.length} bytes to ${zipPath}`);

// --- 6: write SHA256SUMS.txt (canonical order, idempotent for this zip's filename) ---
// Replace this zip's entry in sumsMap and rewrite via the canonical helpers
// — the same path tools/package_release.mjs takes. This keeps the file
// sorted by name so verifyChecksums is happy with the APK, exe and zip in
// any order they're added. A rerun replaces the zip line; the APK and exe
// lines, if present, are preserved. The preflight above (#86) keeps a
// malformed manifest from leaving an unverified zip in the output dir.
sumsMap.set(zipName, zipHash);
writeChecksums(outDir, sumsMap);
console.log(`  wrote SHA256SUMS.txt: ${zipHash}  ${zipName}`);

console.log('\nDone.');
