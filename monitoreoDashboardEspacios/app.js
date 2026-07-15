const API_ESPACIOS = 'http://localhost:8080/api/v1/places';
const SSE_URL = 'http://localhost:3001/sse/espacios';

// El microservicio de zonas responde en inglés (code/nameZone/type/status);
// el dashboard se construyó en español, así que traducimos aquí.
const ESTADO_MAP = {
    AVAILABLE: 'DISPONIBLE',
    OCCUPIED: 'OCUPADO',
    RESERVED: 'RESERVADO',
    MAINTENANCE: 'MANTENIMIENTO',
};

const mapEspacio = (place) => ({
    id: place.id,
    nombre: place.code,
    nombreZona: place.nameZone,
    tipo: place.type,
    estado: ESTADO_MAP[place.status] ?? place.status,
});

const container = document.getElementById('espaciosContainer');
const totalSpan = document.getElementById('totalEspacios');
const lastUpdateSpan = document.getElementById('lastUpdate');
const indicator = document.getElementById('indicator');
const statusText = document.getElementById('statusText');

const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleString('es-ES', { hour12: false });
};

const setConnectionStatus = (connected) => {
    if (connected) {
        indicator.className = 'w-3 h-3 bg-green-500 rounded-full inline-block';
        statusText.textContent = 'Conectado';
    } else {
        indicator.className = 'w-3 h-3 bg-red-500 rounded-full inline-block';
        statusText.textContent = 'Desconectado';
    }
};

const fetchEspacios = async () => {
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

const renderizarEspacios = (espacios) => {
    if (!espacios || espacios.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-500">
                <p class="text-xl">No hay espacios disponibles</p>
            </div>
        `;
        totalSpan.textContent = '0 espacios';
        return;
    }

    // Construir HTML de las tarjetas
    const html = espacios.map((esp) => {
        const estadoClass = `bg-${esp.estado.toLowerCase()}`;
        return `
            <div class="espacio-card ${estadoClass} rounded-lg shadow p-4 flex flex-col">
                <div class="font-bold text-lg text-gray-800">${esp.nombre || 'Sin nombre'}</div>
                <div class="text-sm text-gray-600">Zona: ${esp.nombreZona || 'N/A'}</div>
                <div class="text-sm text-gray-600">Tipo: ${esp.tipo || 'N/A'}</div>
                <div class="mt-2 flex items-center justify-between">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full 
                        ${esp.estado === 'DISPONIBLE' ? 'bg-green-200 text-green-800' :
                esp.estado === 'OCUPADO' ? 'bg-red-200 text-red-800' :
                    esp.estado === 'MANTENIMIENTO' ? 'bg-gray-200 text-gray-800' :
                        'bg-yellow-200 text-yellow-800'}">
                        ${esp.estado}
                    </span>
                    <span class="text-xs text-gray-400">ID: ${esp.id.slice(0, 8)}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    totalSpan.textContent = `${espacios.length} espacios`;
    lastUpdateSpan.textContent = formatDate(new Date());
};


const cargarEspacios = async () => {
    const data = await fetchEspacios();
    if (data) {
        renderizarEspacios(data);
        setConnectionStatus(true);
    } else {
        setConnectionStatus(false);
    }
};

//sse
const conectarSSE = () => {
    const eventSource = new EventSource(SSE_URL);

    eventSource.onopen = () => {
        console.log('SSE: conexión establecida');
        setConnectionStatus(true);
    };

    eventSource.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            console.log('SSE recibido:', payload);
            // Cada vez que recibimos un evento, recargamos todos los espacios
            // (también sirve para reflejar nuevos espacios insertados)
            cargarEspacios();
        } catch (e) {
            console.error('Error al parsear evento SSE:', e);
        }
    };

    eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setConnectionStatus(false);
        eventSource.close();
        // Reintentar después de 5 segundos
        setTimeout(conectarSSE, 5000);
    };

    return eventSource;
};


(async () => {
    // Cargar espacios al inicio
    await cargarEspacios();

    // Conectar SSE
    conectarSSE();

    // Actualización periódica cada 30 segundos por si el SSE falla
    setInterval(cargarEspacios, 30000);
})();