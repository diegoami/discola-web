import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CHECKSUM_FILE, sha256, parseChecksums, formatChecksums,
  writeChecksums, readChecksums, verifyChecksums,
} from './checksums.mjs';

const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);

function tempDir(){
  return mkdtempSync(path.join(os.tmpdir(), 'discola-checksums-'));
}

function withDir(fn){
  const dir = tempDir();
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('format and parse round-trip, sorted by name', () => {
  const text = formatChecksums(new Map([['b.apk', H2], ['a.exe', H1]]));
  assert.equal(text, `${H1}  a.exe\n${H2}  b.apk\n`);
  assert.deepEqual([...parseChecksums(text)], [['a.exe', H1], ['b.apk', H2]]);
});

test('an empty string parses to an empty manifest', () => {
  assert.equal(parseChecksums('').size, 0);
  assert.equal(formatChecksums(new Map()), '');
});

test('rejects a hash that is not 64 lowercase hex', () => {
  for (const bad of ['a'.repeat(63), 'A'.repeat(64), 'g'.repeat(64), `${'a'.repeat(64)} `])
    assert.throws(() => parseChecksums(`${bad}  a.apk\n`), /is not "<64-hex>  <name>"/);
});

test('rejects a single space between hash and name', () => {
  assert.throws(() => parseChecksums(`${H1} a.apk\n`), /is not "<64-hex>  <name>"/);
});

test('rejects paths, "..", and other non-basenames', () => {
  assert.throws(() => parseChecksums(`${H1}  ../escape.apk\n`), /is not "<64-hex>  <name>"/);
  assert.throws(() => parseChecksums(`${H1}  sub\/a.apk\n`), /is not "<64-hex>  <name>"/);
  assert.throws(() => parseChecksums(`${H1}  ..\n`), /is not a file name/);
});

test('rejects duplicate names', () => {
  assert.throws(() => parseChecksums(`${H1}  a.apk\n${H2}  a.apk\n`), /duplicate name/);
});

test('rejects lines that are not in sorted order', () => {
  assert.throws(() => parseChecksums(`${H2}  b.apk\n${H1}  a.apk\n`), /out of order: a\.apk after b\.apk/);
});

test('rejects CRLF, a missing final newline, and blank lines', () => {
  assert.throws(() => parseChecksums(`${H1}  a.apk\r\n`), /is not "<64-hex>  <name>"/);
  assert.throws(() => parseChecksums(`${H1}  a.apk`), /does not end with a newline/);
  assert.throws(() => parseChecksums(`${H1}  a.apk\n\n`), /is not "<64-hex>  <name>"/);
});

test('writeChecksums and readChecksums agree', () => {
  withDir((dir) => {
    writeChecksums(dir, new Map([['a.apk', H1]]));
    assert.deepEqual([...readChecksums(dir)], [['a.apk', H1]]);
  });
});

test('verifyChecksums accepts a complete, correct directory', () => {
  withDir((dir) => {
    writeFileSync(path.join(dir, 'a.apk'), 'one');
    writeFileSync(path.join(dir, 'b.exe'), 'two');
    writeChecksums(dir, new Map([['a.apk', sha256('one')], ['b.exe', sha256('two')]]));
    assert.deepEqual([...verifyChecksums(dir)], [['a.apk', sha256('one')], ['b.exe', sha256('two')]]);
  });
});

test('verifyChecksums allows the same hash under two names', () => {
  withDir((dir) => {
    writeFileSync(path.join(dir, 'a.apk'), 'same');
    writeFileSync(path.join(dir, 'b.exe'), 'same');
    writeChecksums(dir, new Map([['a.apk', sha256('same')], ['b.exe', sha256('same')]]));
    assert.equal(verifyChecksums(dir).size, 2);
  });
});

test('verifyChecksums rejects a listed file that is missing', () => {
  withDir((dir) => {
    writeChecksums(dir, new Map([['a.apk', H1]]));
    assert.throws(() => verifyChecksums(dir), /listed but missing: a\.apk/);
  });
});

test('verifyChecksums rejects an unlisted file', () => {
  withDir((dir) => {
    writeFileSync(path.join(dir, 'a.apk'), 'one');
    writeFileSync(path.join(dir, 'extra.exe'), 'two');
    writeChecksums(dir, new Map([['a.apk', sha256('one')]]));
    assert.throws(() => verifyChecksums(dir), /present but not listed: extra\.exe/);
  });
});

test('verifyChecksums rejects a wrong hash', () => {
  withDir((dir) => {
    writeFileSync(path.join(dir, 'a.apk'), 'one');
    writeChecksums(dir, new Map([['a.apk', H1]]));
    assert.throws(() => verifyChecksums(dir), /a\.apk does not match its recorded hash/);
  });
});

test('verifyChecksums rejects a directory where a file is listed', () => {
  withDir((dir) => {
    mkdirSync(path.join(dir, 'a.apk'));
    writeChecksums(dir, new Map([['a.apk', H1]]));
    assert.throws(() => verifyChecksums(dir), /a\.apk is not a regular file/);
  });
});

test('verifyChecksums rejects an empty or missing manifest', () => {
  withDir((dir) => {
    writeFileSync(path.join(dir, CHECKSUM_FILE), '');
    assert.throws(() => verifyChecksums(dir), /lists no files/);
  });
  withDir((dir) => {
    writeFileSync(path.join(dir, 'a.apk'), 'one');
    assert.throws(() => verifyChecksums(dir), /SHA256SUMS\.txt is missing/);
  });
});
