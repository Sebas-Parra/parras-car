import test from 'node:test';
import assert from 'node:assert/strict';

import { getCreatedUsername } from './registerResponse.js';

test('getCreatedUsername reads the generated username from the person response', () => {
  assert.equal(getCreatedUsername({ user: { username: 'pmdiaz' } }), 'pmdiaz');
});

test('getCreatedUsername falls back to a top-level username when present', () => {
  assert.equal(getCreatedUsername({ username: 'cliente1' }), 'cliente1');
});
