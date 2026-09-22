/**
 * The `SHA256SUMS.txt` contract for `dist-release/vX.Y.Z/`.
 *
 * Both the packager and the publisher touch this file, so its format lives in
 * one place instead of being re-derived at each end. The rules are deliberately
 * strict: the file is what the release page tells a user to compare against, and
 * a malformed or partial manifest must stop a publish rather than produce a
 * release whose checksums cannot be trusted.
 *
 * Canonical form, one line per file, LF endings:
 *
 *     <64 lowercase hex>  <basename>          (exactly two spaces)
 *
 * A manifest is only meaningful against a directory: `verifyChecksums` requires
 * the listed set and the directory's files to be exactly equal, every name to be
 * a plain basename that is a regular file, and every hash to match the bytes.
 */

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const CHECKSUM_FILE = 'SHA256SUMS.txt';

const LINE = /^([0-9a-f]{64})  ([A-Za-z0-9._-]+)$/;
const NAME = /^[A-Za-z0-9._-]+$/;

/** SHA-256 of a Buffer or string, as 64 lowercase hex characters. */
export function sha256(data){
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Parse a manifest into a Map(name → hash). Throws on anything that is not
 * canonical: a short or uppercase digest, one space instead of two, CRLF
 * endings, a path instead of a basename, `.`/`..`, a duplicate name, lines out
 * of order, or a missing final newline. An empty string parses to an empty Map.
 */
export function parseChecksums(text){
  const entries = new Map();
  if (text === '') return entries;
  if (!text.endsWith('\n')) throw new Error('the manifest does not end with a newline');
  const lines = text.slice(0, -1).split('\n');
  let previous = '';
  lines.forEach((line, i) => {
    const m = LINE.exec(line);
    if (!m) throw new Error(`line ${i + 1} is not "<64-hex>  <name>": ${JSON.stringify(line)}`);
    const [, hash, name] = m;
    // The charset alone would allow "..", which would resolve outside the dir.
    if (name === '.' || name === '..') throw new Error(`line ${i + 1} is not a file name: ${name}`);
    if (entries.has(name)) throw new Error(`duplicate name on line ${i + 1}: ${name}`);
    if (previous && name < previous)
      throw new Error(`line ${i + 1} is out of order: ${name} after ${previous}`);
    previous = name;
    entries.set(name, hash);
  });
  return entries;
}

/** Serialize a Map(name → hash) in canonical form: sorted by name, LF, two spaces. */
export function formatChecksums(entries){
  const names = [...entries.keys()].sort();
  return names.map((name) => {
    const hash = entries.get(name);
    if (!/^[0-9a-f]{64}$/.test(hash))
      throw new Error(`${name} does not have a 64-hex lowercase hash`);
    if (!NAME.test(name) || name === '.' || name === '..')
      throw new Error(`${name} is not a plain file name`);
    return `${hash}  ${name}`;
  }).join('\n') + (names.length ? '\n' : '');
}

/** Write the manifest for `entries` into `dir`. */
export function writeChecksums(dir, entries){
  writeFileSync(path.join(dir, CHECKSUM_FILE), formatChecksums(entries));
}

/** Read and parse `dir`'s manifest. */
export function readChecksums(dir){
  return parseChecksums(readFileSync(path.join(dir, CHECKSUM_FILE), 'utf8'));
}

/**
 * Verify a release directory against its manifest and return the entries.
 * Throws if the manifest is missing or malformed, if the listed set and the
 * directory's files are not exactly equal, if a listed name is not a regular
 * file (no directories, no symlinks), or if any hash does not match the bytes.
 * An empty release — no assets at all — is an error, not a pass.
 */
export function verifyChecksums(dir){
  const manifestPath = path.join(dir, CHECKSUM_FILE);
  if (!existsSync(manifestPath)) throw new Error(`${CHECKSUM_FILE} is missing from ${dir}`);
  const entries = parseChecksums(readFileSync(manifestPath, 'utf8'));
  if (!entries.size) throw new Error(`${CHECKSUM_FILE} lists no files`);
  const listed = [...entries.keys()].sort();
  const present = readdirSync(dir).filter((n) => n !== CHECKSUM_FILE).sort();
  const missing = listed.filter((n) => !present.includes(n));
  const extra = present.filter((n) => !entries.has(n));
  if (missing.length) throw new Error(`listed but missing: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`present but not listed: ${extra.join(', ')}`);
  for (const [name, hash] of entries){
    const file = path.join(dir, name);
    if (!lstatSync(file).isFile()) throw new Error(`${name} is not a regular file`);
    const actual = sha256(readFileSync(file));
    if (actual !== hash) throw new Error(`${name} does not match its recorded hash`);
  }
  return entries;
}
