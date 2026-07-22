import { useCallback, useEffect, useRef, useState } from 'react';
import { SSE_URL, fetchEspacios } from '../api';

const POLL_INTERVAL_MS = 30000;
const SSE_RETRY_MS = 5000;

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

  useEffect(() => {
    let eventSource;
    let retryTimeout;

    const conectarSSE = () => {
      eventSource = new EventSource(SSE_URL);

      eventSource.onopen = () => {
        console.log('SSE: conexión establecida');
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
        console.error('SSE error:', error);
        setConnected(false);
        eventSource.close();
        retryTimeout = setTimeout(conectarSSE, SSE_RETRY_MS);
      };
    };

    cargarEspacios();
    conectarSSE();
    const interval = setInterval(cargarEspacios, POLL_INTERVAL_MS);

    return () => {
      eventSource?.close();
      clearTimeout(retryTimeout);
      clearInterval(interval);
    };
  }, [cargarEspacios]);

  return { espacios, connected, lastUpdate };
};
