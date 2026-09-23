import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSource, parseSource, tagCommit } from './source_tag.mjs';

const C = 'e888af0ab9dcfb28a4e1123f336cceb90ae3d80a';
const T = 'cb297cd4667fe4190aea0e56acc1fa111517222d';

test('a source record round-trips', () => {
  const text = formatSource({ commit: C, tree: T });
  assert.equal(text, `commit ${C}\ntree ${T}\n`);
  assert.deepEqual(parseSource(text), { commit: C, tree: T });
});

test('a malformed source record is refused, not half-read', () => {
  assert.throws(() => parseSource(''));
  assert.throws(() => parseSource(`commit ${C}\n`));                   // no tree
  assert.throws(() => parseSource(`commit ${C}\r\ntree ${T}\r\n`));    // CRLF
  assert.throws(() => parseSource(`commit ${C.slice(0, 7)}\ntree ${T}\n`)); // short id
  assert.throws(() => parseSource(`tree ${T}\ncommit ${C}\n`));        // swapped
  assert.throws(() => formatSource({ commit: C, tree: '' }));
});

// Real output for the pushed v1.0.4 annotated tag, plus neighbours that a
// suffix or prefix match would wrongly accept.
const LS = [
  `20577668ba2c2484a7be4f85afe6b810c1c3c6ef\trefs/tags/v1.0.4`,
  `${C}\trefs/tags/v1.0.4^{}`,
  `1111111111111111111111111111111111111111\trefs/tags/v1.0.40`,
  `2222222222222222222222222222222222222222\trefs/tags/old/v1.0.5`,
].join('\n') + '\n';

test('an annotated tag resolves to its peeled commit, not the tag object', () => {
  assert.equal(tagCommit(LS, 'v1.0.4'), C);
});

test('a lightweight tag resolves to the commit it names', () => {
  assert.equal(tagCommit(`${C}\trefs/tags/v2.0.0\r\n`, 'v2.0.0'), C);
});

test('a missing tag is null, and near-miss refs do not count', () => {
  assert.equal(tagCommit(LS, 'v1.0.5'), null);  // only old/v1.0.5 exists
  assert.equal(tagCommit(LS, 'v1.0'), null);
  assert.equal(tagCommit('', 'v1.0.4'), null);
});
