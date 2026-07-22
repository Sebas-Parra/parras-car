export const API_ESPACIOS = 'http://localhost:8080/api/v1/places';
export const SSE_URL = 'http://localhost:3001/sse/espacios';

// El microservicio de zonas responde en inglés (code/nameZone/type/status);
// el dashboard se construyó en español, así que traducimos aquí.
export const ESTADO_MAP = {
  AVAILABLE: 'DISPONIBLE',
  OCCUPIED: 'OCUPADO',
  RESERVED: 'RESERVADO',
  MAINTENANCE: 'MANTENIMIENTO',
};

export const mapEspacio = (place) => ({
  id: place.id,
  nombre: place.code,
  nombreZona: place.nameZone,
  tipo: place.type,
  estado: ESTADO_MAP[place.status] ?? place.status,
});

export const fetchEspacios = async () => {
  try {
    const response = await fetch(API_ESPACIOS);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.map(mapEspacio);
  } catch (error) {
    console.error('Error al obtener espacios:', error);
    return null;
  }
};
