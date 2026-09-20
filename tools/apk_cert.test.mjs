import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCertSha256, normalizeSha256 } from './apk_cert.mjs';

const HEX = 'a'.repeat(48) + '0123456789abcdef';   // 64 characters
const COLON = HEX.match(/../g).join(':').toUpperCase();

test('parses a colon-separated fingerprint into the full 64 hex characters', () => {
  const out = `Signer #1 certificate DN: CN=Discola\n` +
    `Signer #1 certificate SHA-256 digest: ${COLON}\n` +
    `Signer #1 certificate SHA-1 digest: 00:11:22\n`;
  assert.equal(parseCertSha256(out), HEX);
});

test('parses a plain lowercase fingerprint', () => {
  assert.equal(parseCertSha256(`Signer #1 certificate SHA-256 digest: ${HEX}\n`), HEX);
});

test('rejects a truncated fingerprint rather than comparing it', () => {
  // What the old ([0-9a-f]+) capture produced from a colon-separated line.
  assert.equal(parseCertSha256(`Signer #1 certificate SHA-256 digest: ${COLON.split(':')[0]}\n`), null);
});

test('returns null when there is no digest line at all', () => {
  assert.equal(parseCertSha256('Signer #1 certificate DN: CN=Discola\n'), null);
});

test('normalizeSha256 accepts either form and rejects short values', () => {
  assert.equal(normalizeSha256(COLON), HEX);
  assert.equal(normalizeSha256(HEX), HEX);
  assert.equal(normalizeSha256('aa:bb'), null);
});
