import test from 'node:test';
import assert from 'node:assert/strict';

import { createToast } from './toastUtils.js';

test('createToast builds an error toast with a stable message', () => {
  const toast = createToast({
    type: 'error',
    message: new Error('No se pudo cargar'),
    duration: 1000,
  });

  assert.equal(toast.type, 'error');
  assert.equal(toast.message, 'No se pudo cargar');
  assert.equal(toast.duration, 1000);
  assert.match(toast.id, /^toast-/);
});

test('createToast falls back to info for unknown variants', () => {
  const toast = createToast({ type: 'rare', message: '' });

  assert.equal(toast.type, 'info');
  assert.equal(toast.message, 'Algo ocurrió. Intenta nuevamente.');
});
