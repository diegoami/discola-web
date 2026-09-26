import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotes } from './release_notes.mjs';

const BOTH = buildNotes('1.0.4', ['android', 'windows'], { subtitle: 'la prima versione per Windows, e Android aggiornato' });

test('both platforms: title, both sections, both warnings, shared history line', () => {
  assert.match(BOTH, /^Discola 1\.0\.4 — la prima versione per Windows, e Android aggiornato\./);
  assert.match(BOTH, /Discola-1\.0\.4-windows-x64\.exe/);
  assert.match(BOTH, /Windows ha protetto il PC/);
  assert.match(BOTH, /Discola-1\.0\.4-android\.apk/);
  assert.match(BOTH, /installazione da questa fonte/);
  assert.match(BOTH, /In entrambe le versioni lo storico delle partite resta sul dispositivo/);
  assert.match(BOTH, /https:\/\/discola\.netlify\.app\//);
  assert.match(BOTH, /Checksum SHA-256 in `SHA256SUMS\.txt`\./);
});

test('platform order is fixed: Windows before Android regardless of input order', () => {
  const reversed = buildNotes('1.0.4', ['android', 'windows']);
  assert.ok(reversed.indexOf('**Windows:**') < reversed.indexOf('**Android:**'));
});

test('windows only: no Android section, singular history line', () => {
  const notes = buildNotes('1.0.4', ['windows']);
  assert.ok(!notes.includes('**Android:**'));
  assert.match(notes, /Lo storico delle partite resta sul dispositivo/);
  assert.ok(!notes.includes('In entrambe le versioni'));
  assert.match(notes, /^Discola 1\.0\.4\./);
});

test('android only: no SmartScreen paragraph', () => {
  const notes = buildNotes('1.0.4', ['android']);
  assert.ok(!notes.includes('Windows ha protetto il PC'));
  assert.match(notes, /\*\*Android:\*\*/);
});

test('duplicate platform entries do not duplicate sections', () => {
  const notes = buildNotes('1.0.4', ['android', 'android']);
  assert.equal(notes.match(/\*\*Android:\*\*/g).length, 1);
  assert.ok(!notes.includes('In entrambe le versioni'));
});

test('an unknown or empty platform list is an error', () => {
  assert.throws(() => buildNotes('1.0.4', ['linux']), /unknown platform: linux/);
  assert.throws(() => buildNotes('1.0.4', []), /at least one platform/);
});

test('the notes name the tagged commit when given, and refuse a short one', () => {
  const sha = 'e888af0ab9dcfb28a4e1123f336cceb90ae3d80a';
  const notes = buildNotes('1.0.5', ['android'], { commit: sha });
  assert.ok(notes.endsWith(`\nCompilato dal commit \`${sha}\` (tag \`v1.0.5\`).\n`), notes);
  assert.doesNotMatch(buildNotes('1.0.5', ['android']), /Compilato/);
  assert.throws(() => buildNotes('1.0.5', ['android'], { commit: 'e888af0' }), /full object id/);
});

test('a changes list renders as the "Novità" block, after the title and before the platforms', () => {
  const notes = buildNotes('1.0.6', ['android'], { subtitle: 'anche in inglese', changes: ['Uno.', 'Due.'] });
  assert.ok(notes.startsWith('Discola 1.0.6 — anche in inglese.\n\n**Novità in questa versione**\n- Uno.\n- Due.\n\n**Android:**'), notes);
  assert.doesNotMatch(buildNotes('1.0.6', ['android']), /Novità/);
  assert.throws(() => buildNotes('1.0.6', ['android'], { changes: ['Uno.', ' '] }), /non-empty/);
});
