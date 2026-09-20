import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, parseVersion } from './versions.mjs';

// The fixture the release scripts need and nothing else will exercise until a
// component reaches two digits.
test('release tags sort numerically, not as strings', () => {
  const tags = ['v2.0.0', 'v1.9.0', 'v1.10.0', 'v1.10.1', 'v1.2.0', 'v10.0.0'];
  assert.deepEqual(tags.sort(compareVersions),
    ['v1.2.0', 'v1.9.0', 'v1.10.0', 'v1.10.1', 'v2.0.0', 'v10.0.0']);
  // The whole point: the newest staged directory is the one that wins.
  assert.equal(tags.sort(compareVersions).at(-1), 'v10.0.0');
});

test('build-tools versions sort numerically', () => {
  assert.deepEqual(['9.0.0', '35.0.0', '36.0.0', '100.0.0'].sort(compareVersions),
    ['9.0.0', '35.0.0', '36.0.0', '100.0.0']);
});

test('parseVersion strips a leading v and pads missing components', () => {
  assert.deepEqual(parseVersion('v1.10.0'), [1, 10, 0]);
  assert.deepEqual(parseVersion('35'), [35]);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
});
