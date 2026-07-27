import { useCallback, useEffect, useRef, useState } from 'react';
import { SSE_URL, ZONES_SSE_URL, fetchEspacios } from '../api';

const POLL_INTERVAL_MS = 30000;
const SSE_RETRY_MS = 5000;
// Dos streams: tickets emite cuando un ticket ocupa/libera un espacio, zones
// emite cuando se crea/edita/elimina un espacio o cambia su estado a mano.
const SSE_SOURCES = [SSE_URL, ZONES_SSE_URL];

export const useEspacios = () => {
  const [espacios, setEspacios] = useState(null);
  const [connected, setConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const cargarEspaciosRef = useRef(() => {});

  const cargarEspacios = useCallback(async () => {
    const data = await fetchEspacios();
    if (data) {
      setEspacios(data);
      setLastUpdate(new Date());
      setConnected(true);
    } else {
      setConnected(false);
    }
  }, []);

  cargarEspaciosRef.current = cargarEspacios;

  const removeEspacio = useCallback((id) => {
    setEspacios((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
  }, []);

  useEffect(() => {
    const cleanups = SSE_SOURCES.map((url) => {
      let eventSource;
      let retryTimeout;

      const conectarSSE = () => {
        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          console.log(`SSE: conexión establecida (${url})`);
          setConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            JSON.parse(event.data);
            // Cada vez que recibimos un evento, recargamos todos los espacios
            // (también sirve para reflejar nuevos espacios insertados)
            cargarEspaciosRef.current();
          } catch (e) {
            console.error('Error al parsear evento SSE:', e);
          }
        };

        eventSource.onerror = (error) => {
          console.error(`SSE error (${url}):`, error);
          eventSource.close();
          retryTimeout = setTimeout(conectarSSE, SSE_RETRY_MS);
        };
      };

      conectarSSE();

      return () => {
        eventSource?.close();
        clearTimeout(retryTimeout);
      };
    });

    cargarEspacios();
    const interval = setInterval(cargarEspacios, POLL_INTERVAL_MS);

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      clearInterval(interval);
    };
  }, [cargarEspacios]);

  return { espacios, connected, lastUpdate, refetch: cargarEspacios, removeEspacio };
};
