// Rutas relativas: en dev, vite.config.js las proxea a cada servicio;
// en producción, el Ingress de k8s las enruta a Kong bajo el mismo host
// que sirve el dashboard (sin necesidad de CORS).
//
// Ojo: en vehicles/tickets/assignments el prefijo de Kong coincide con el
// path interno del propio controller (ambos se llaman igual), así que la
// ruta externa termina duplicando el segmento (ej. /api/vehicles/vehicles).
// Confirmado contra parras-car-crud-completo.postman_collection.json.
const API_BASE = '/api';

const API_ZONAS = `${API_BASE}/zones/api/v1/zones`;
const API_ESPACIOS = `${API_BASE}/zones/api/v1/places`;
const API_LOGIN = `${API_BASE}/users/auth/login`;
const API_PERSONS = `${API_BASE}/users/persons`;
const API_USERS = `${API_BASE}/users/users`;
const API_ROLES = `${API_BASE}/users/roles`;
const API_VEHICULOS = `${API_BASE}/vehicles/vehicles`;
const API_ASIGNACIONES = `${API_BASE}/assignments/assignments`;
const API_TICKETS = `${API_BASE}/tickets/tickets`;
const API_AUDITORIA = `${API_BASE}/audit/api/v1/audit`;
export const SSE_URL = `${API_BASE}/tickets/sse/espacios`;
export { API_ESPACIOS };

// El microservicio de zonas responde en inglés (code/nameZone/type/status);
// el dashboard se construyó en español, así que traducimos aquí.
export const ESTADO_MAP = {
  AVAILABLE: 'DISPONIBLE',
  OCCUPIED: 'OCUPADO',
  RESERVED: 'RESERVADO',
  MAINTENANCE: 'MANTENIMIENTO',
};
export const ESTADO_MAP_INVERSE = Object.fromEntries(Object.entries(ESTADO_MAP).map(([en, es]) => [es, en]));
export const ESTADO_OPTIONS = Object.entries(ESTADO_MAP).map(([value, label]) => ({ value, label }));

export const TIPO_ZONA_OPTIONS = ['VIP', 'REGULAR', 'INTERNAL', 'EXTERNAL', 'PREFERENTIAL'];
export const TIPO_ESPACIO_OPTIONS = ['CAR', 'BIKE', 'BUS'];
export const TIPO_VEHICULO_OPTIONS = ['car', 'motocicleta', 'pickupTruck'];
export const TIPO_VEHICULO_LABELS = { car: 'Auto', motocicleta: 'Motocicleta', pickupTruck: 'Camioneta' };
export const CLASIFICACION_OPTIONS = ['ELECTRIC', 'HYBRID', 'GASOLINE', 'DIESEL'];
export const TIPO_MOTO_OPTIONS = ['ENDURO', 'SPORT', 'CRUISER', 'SCOOTER', 'TOURING'];

export const mapEspacio = (place) => ({
  id: place.id,
  nombre: place.code,
  nombreZona: place.nameZone,
  tipo: place.type,
  estado: ESTADO_MAP[place.status] ?? place.status,
});

const parseErrorMessage = async (response) => {
  try {
    const body = await response.json();
    if (Array.isArray(body.message)) return body.message.join(', ');
    // FastAPI/Pydantic (users, assignments): errores 422 vienen como un array
    // de objetos {msg, loc, ...}, no de strings — hay que extraer "msg" de
    // cada uno. Pydantic v2 antepone "Value error, " a los ValueError propios.
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((e) => (typeof e === 'string' ? e : (e.msg ?? JSON.stringify(e)).replace(/^Value error,\s*/, '')))
        .join(', ');
    }
    // "message" trae el motivo específico (ej. NestJS ConflictException); "error"
    // en NestJS es solo la frase genérica del status ("Conflict", "Bad Request").
    return body.message || body.detail || body.error || `Error HTTP ${response.status}`;
  } catch {
    return `Error HTTP ${response.status}`;
  }
};

const request = async (path, { method = 'GET', token, body } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const fetchEspacios = async () => {
  try {
    const data = await request(API_ESPACIOS);
    return data.map(mapEspacio);
  } catch (error) {
    console.error('Error al obtener espacios:', error);
    return null;
  }
};

export const login = (username, password) => request(API_LOGIN, { method: 'POST', body: { username, password } });

// Tamaño de página "traer todo" para buscadores tipo-combobox de otras
// páginas (catálogos acotados por capacidad física/organizacional real).
export const ALL_PAGE_SIZE = 500;

// ─── Zonas ──────────────────────────────────────────────────────────────
export const fetchZonas = (token, page = 1, pageSize = ALL_PAGE_SIZE) =>
  request(`${API_ZONAS}?page=${page}&pageSize=${pageSize}`, { token });
export const createZona = (payload, token) => request(API_ZONAS, { method: 'POST', body: payload, token });
export const updateZona = (id, payload, token) => request(`${API_ZONAS}/${id}`, { method: 'PUT', body: payload, token });
export const deleteZona = (id, token) => request(`${API_ZONAS}/${id}`, { method: 'DELETE', token });

// ─── Espacios ───────────────────────────────────────────────────────────
export const createEspacio = (payload, token) => request(API_ESPACIOS, { method: 'POST', body: payload, token });
export const updateEspacio = (id, payload, token) => request(`${API_ESPACIOS}/${id}`, { method: 'PUT', body: payload, token });
export const updateEspacioStatus = (id, status, token) =>
  request(`${API_ESPACIOS}/${id}/status`, { method: 'PATCH', body: { status }, token });
export const deleteEspacio = (id, token) => request(`${API_ESPACIOS}/${id}`, { method: 'DELETE', token });

// ─── Usuarios / Personas / Roles ────────────────────────────────────────
export const registerPerson = (payload) => request(API_PERSONS, { method: 'POST', body: payload });
export const fetchPersons = (token) => request(API_PERSONS, { token });
export const fetchUsers = (token, page = 1, pageSize = ALL_PAGE_SIZE) =>
  request(`${API_USERS}?page=${page}&page_size=${pageSize}`, { token });
export const fetchUserDetail = (userId, token) => request(`${API_USERS}/${userId}`, { token });
export const activateUser = (userId, token) => request(`${API_USERS}/${userId}/activate`, { method: 'PATCH', token });
export const deactivateUser = (userId, token) => request(`${API_USERS}/${userId}/deactivate`, { method: 'PATCH', token });
export const assignRole = (userId, roleId, token) =>
  request(`${API_USERS}/${userId}/roles`, { method: 'POST', body: { role_id: roleId }, token });
export const removeRole = (userId, roleId, token) =>
  request(`${API_USERS}/${userId}/roles/${roleId}`, { method: 'DELETE', token });

export const fetchRoles = (token) => request(API_ROLES, { token });
export const createRole = (payload, token) => request(API_ROLES, { method: 'POST', body: payload, token });
export const updateRole = (roleId, payload, token) =>
  request(`${API_ROLES}/${roleId}`, { method: 'PUT', body: payload, token });
export const deleteRole = (roleId, token) => request(`${API_ROLES}/${roleId}`, { method: 'DELETE', token });

export const fetchPermissions = (token) => request(`${API_BASE}/users/permissions`, { token });

// ─── Vehículos ──────────────────────────────────────────────────────────
export const fetchVehiculos = (token, page = 1, pageSize = ALL_PAGE_SIZE) =>
  request(`${API_VEHICULOS}?page=${page}&pageSize=${pageSize}`, { token });
export const createVehiculo = (payload, token) => request(API_VEHICULOS, { method: 'POST', body: payload, token });
export const updateVehiculo = (id, payload, token) => request(`${API_VEHICULOS}/${id}`, { method: 'PATCH', body: payload, token });
export const activateVehiculo = (id, token) => request(`${API_VEHICULOS}/${id}/activate`, { method: 'PATCH', token });
export const deleteVehiculo = (id, token) => request(`${API_VEHICULOS}/${id}`, { method: 'DELETE', token });

// ─── Asignaciones ───────────────────────────────────────────────────────
export const fetchFlota = (userId, token) => request(`${API_ASIGNACIONES}/${userId}/fleet`, { token });
export const createAsignacion = (payload, token) => request(API_ASIGNACIONES, { method: 'POST', body: payload, token });
export const deleteAsignacion = (userId, vehicleId, token) =>
  request(`${API_ASIGNACIONES}/${userId}/${vehicleId}`, { method: 'DELETE', token });
export const transferAsignacion = (vehicleId, payload, token) =>
  request(`${API_ASIGNACIONES}/${vehicleId}/transfer`, { method: 'PATCH', body: payload, token });
export const fetchAsignacionesAudit = (token, page = 1, pageSize = 10) =>
  request(`${API_ASIGNACIONES}/audit?page=${page}&page_size=${pageSize}`, { token });

// GET .../by-vehicle/{id} devuelve 404 cuando no hay asignación activa —
// no es un error real, así que lo tratamos aparte (no usa el helper `request`).
export const fetchAsignacionPorVehiculo = async (vehicleId, token) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_ASIGNACIONES}/by-vehicle/${vehicleId}`, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json();
};

// ─── Tickets ────────────────────────────────────────────────────────────
export const fetchTickets = (token, page = 1, pageSize = 20) =>
  request(`${API_TICKETS}?page=${page}&pageSize=${pageSize}`, { token });
// Sin paginar — acotado por la capacidad real de estacionamiento, no por el
// historial completo. Lo usan otras páginas para saber qué está ocupado ahora.
export const fetchTicketsActivos = (token) =>
  request(`${API_TICKETS}?estado=ACTIVO`, { token }).then((r) => r.data);
export const createTicket = (payload, token) => request(API_TICKETS, { method: 'POST', body: payload, token });
export const payTicket = (id, token) => request(`${API_TICKETS}/${id}/pay`, { method: 'PATCH', token });
export const cancelTicket = (id, token) => request(`${API_TICKETS}/${id}/cancel`, { method: 'PATCH', token });

// ─── Auditoría ──────────────────────────────────────────────────────────
export const fetchAuditoria = (token, page = 1, pageSize = 20) =>
  request(`${API_AUDITORIA}?page=${page}&pageSize=${pageSize}`, { token });
