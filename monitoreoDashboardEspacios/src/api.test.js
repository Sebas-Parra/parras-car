import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CABINA_CAMIONETA_LABELS,
  CLASIFICACION_LABELS,
  ESTADO_TICKET_LABELS,
  TIPO_ESPACIO_LABELS,
  TIPO_ESPACIO_OPTIONS,
  fetchTicketsActivos,
  getAvailableTicketSpaces,
  normalizeListResponse,
  toEnumLabel,
} from './api.js';

test('normalizeListResponse wraps array responses with pagination defaults', () => {
  const result = normalizeListResponse([{ id: 1 }, { id: 2 }]);

  assert.deepEqual(result, {
    data: [{ id: 1 }, { id: 2 }],
    total: 2,
  });
});

test('normalizeListResponse keeps paginated data responses', () => {
  const result = normalizeListResponse({ data: [{ id: 1 }], total: 25 });

  assert.deepEqual(result, {
    data: [{ id: 1 }],
    total: 25,
  });
});

test('normalizeListResponse accepts common items/results payloads', () => {
  assert.deepEqual(normalizeListResponse({ items: [{ id: 1 }] }), {
    data: [{ id: 1 }],
    total: 1,
  });
  assert.deepEqual(normalizeListResponse({ results: [{ id: 2 }], count: 7 }), {
    data: [{ id: 2 }],
    total: 7,
  });
});

test('toEnumLabel displays Spanish labels while preserving unknown values', () => {
  assert.equal(toEnumLabel('GASOLINE', CLASIFICACION_LABELS), 'Gasolina');
  assert.equal(toEnumLabel('ACTIVO', ESTADO_TICKET_LABELS), 'Activo');
  assert.equal(toEnumLabel('EXTENDED', CABINA_CAMIONETA_LABELS), 'Extendida');
  assert.equal(toEnumLabel('UNMAPPED_VALUE', CLASIFICACION_LABELS), 'UNMAPPED_VALUE');
});

test('space creation options exclude bus while preserving the display label', () => {
  assert.deepEqual(TIPO_ESPACIO_OPTIONS, ['CAR', 'BIKE']);
  assert.equal(TIPO_ESPACIO_LABELS.BUS, 'Bus');
});

test('getAvailableTicketSpaces excludes occupied spaces and spaces with an active ticket', () => {
  const spaces = [
    { id: 'available-1', estado: 'DISPONIBLE' },
    { id: 'occupied-by-state', estado: 'OCUPADO' },
    { id: 'occupied-by-ticket', estado: 'DISPONIBLE' },
    { id: 'maintenance', estado: 'MANTENIMIENTO' },
  ];
  const activeTickets = [{ idEspacio: 'occupied-by-ticket', estado: 'ACTIVO' }];

  assert.deepEqual(getAvailableTicketSpaces(spaces, activeTickets), [{ id: 'available-1', estado: 'DISPONIBLE' }]);
});

test('fetchTicketsActivos asks for the full active ticket catalog', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ id: 'ticket-1' }], total: 1 }),
    };
  };

  try {
    const tickets = await fetchTicketsActivos('token');

    assert.deepEqual(tickets, [{ id: 'ticket-1' }]);
    assert.match(requestedUrl, /estado=ACTIVO/);
    assert.match(requestedUrl, /pageSize=500/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
