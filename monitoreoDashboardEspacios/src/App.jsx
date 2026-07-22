import { useMemo, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import StatsRow from './components/StatsRow.jsx';
import FilterBar from './components/FilterBar.jsx';
import EspaciosTable from './components/EspaciosTable.jsx';
import { useEspacios } from './hooks/useEspacios.js';

const ESTADOS = ['DISPONIBLE', 'OCUPADO', 'RESERVADO', 'MANTENIMIENTO'];

function App() {
  const { espacios, connected, lastUpdate } = useEspacios();
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS');
  const [zonaFiltro, setZonaFiltro] = useState('TODAS');

  const zonas = useMemo(() => {
    if (!espacios) return [];
    return [...new Set(espacios.map((e) => e.nombreZona).filter(Boolean))].sort();
  }, [espacios]);

  const stats = useMemo(() => {
    const base = { TOTAL: espacios?.length ?? 0 };
    ESTADOS.forEach((estado) => {
      base[estado] = espacios?.filter((e) => e.estado === estado).length ?? 0;
    });
    return base;
  }, [espacios]);

  const espaciosFiltrados = useMemo(() => {
    if (!espacios) return [];
    const term = search.trim().toLowerCase();
    return espacios.filter((e) => {
      const matchesSearch =
        !term || e.nombre?.toLowerCase().includes(term) || e.nombreZona?.toLowerCase().includes(term);
      const matchesEstado = estadoFiltro === 'TODOS' || e.estado === estadoFiltro;
      const matchesZona = zonaFiltro === 'TODAS' || e.nombreZona === zonaFiltro;
      return matchesSearch && matchesEstado && matchesZona;
    });
  }, [espacios, search, estadoFiltro, zonaFiltro]);

  const hayFiltrosActivos = search !== '' || estadoFiltro !== 'TODOS' || zonaFiltro !== 'TODAS';

  const limpiarFiltros = () => {
    setSearch('');
    setEstadoFiltro('TODOS');
    setZonaFiltro('TODAS');
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar connected={connected} lastUpdate={lastUpdate} />
        <main className="flex-1 space-y-6 p-6">
          <StatsRow stats={stats} />
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            estado={estadoFiltro}
            onEstadoChange={setEstadoFiltro}
            zona={zonaFiltro}
            onZonaChange={setZonaFiltro}
            zonas={zonas}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiar={limpiarFiltros}
          />
          <EspaciosTable espacios={espaciosFiltrados} cargando={espacios === null} />
        </main>
      </div>
    </div>
  );
}

export default App;
