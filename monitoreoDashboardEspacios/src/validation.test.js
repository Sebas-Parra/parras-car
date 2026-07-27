import test from 'node:test';
import assert from 'node:assert/strict';

import { getPhoneValidationError, normalizeOptionalPhone } from './validation.js';

test('getPhoneValidationError accepts empty optional phone numbers', () => {
  assert.equal(getPhoneValidationError(''), '');
  assert.equal(getPhoneValidationError('   '), '');
});

test('getPhoneValidationError rejects characters outside digits/spaces/+-()', () => {
  const message = 'El teléfono solo puede contener dígitos, espacios y los caracteres: + - ( )';
  assert.equal(getPhoneValidationError('099abc4567'), message);
  assert.equal(getPhoneValidationError('099*4567'), message);
});

test('getPhoneValidationError accepts backend-allowed formats', () => {
  assert.equal(getPhoneValidationError('+593 99 123 4567'), '');
  assert.equal(getPhoneValidationError('(02) 123-4567'), '');
});

test('normalizeOptionalPhone trims valid values and omits empty values', () => {
  assert.equal(normalizeOptionalPhone(' 0991234567 '), '0991234567');
  assert.equal(normalizeOptionalPhone('   '), undefined);
});
