import test from 'node:test';
import assert from 'node:assert/strict';

import { getPhoneValidationError, normalizeOptionalPhone } from './validation.js';

test('getPhoneValidationError accepts empty optional phone numbers', () => {
  assert.equal(getPhoneValidationError(''), '');
  assert.equal(getPhoneValidationError('   '), '');
});

test('getPhoneValidationError rejects non-digit phone numbers', () => {
  assert.equal(
    getPhoneValidationError('099abc4567'),
    'El teléfono solo puede contener números',
  );
  assert.equal(getPhoneValidationError('-1'), 'El teléfono solo puede contener números');
});

test('normalizeOptionalPhone trims valid values and omits empty values', () => {
  assert.equal(normalizeOptionalPhone(' 0991234567 '), '0991234567');
  assert.equal(normalizeOptionalPhone('   '), undefined);
});
