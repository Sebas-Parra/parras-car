import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import StatsRow from '../components/StatsRow.jsx';
import FilterBar from '../components/FilterBar.jsx';
import EspaciosTable from '../components/EspaciosTable.jsx';
import EspaciosGridView from '../components/EspaciosGridView.jsx';
import NewPlaceModal from '../components/NewPlaceModal.jsx';
import Button from '../components/Button.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { IconPlus } from '../components/icons.jsx';
import { useEspacios } from '../hooks/useEspacios.js';
import { useAuth } from '../context/AuthContext.jsx';
import { updateEspacioStatus, deleteEspacio, fetchTicketsActivos } from '../api.js';

const formatDate = (date) => (date ? date.toLocaleString('es-ES', { hour12: false }) : '--');
const ESTADOS = ['DISPONIBLE', 'OCUPADO', 'RESERVADO', 'MANTENIMIENTO'];

const EspaciosPage = () => {
  const { espacios, connected, lastUpdate, refetch, removeEspacio } = useEspacios();
  const { token, hasRole } = useAuth();
  const toast = useToast();
  const { confirm, confirmModal } = useConfirm();
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS');
  const [zonaFiltro, setZonaFiltro] = useState('TODAS');
  const [showNewPlace, setShowNewPlace] = useState(false);
  const [espaciosConTicketActivo, setEspaciosConTicketActivo] = useState(new Set());
  const [viewMode, setViewMode] = useState('grid');

  const canManage = hasRole('admin', 'root');
  const canEditStatus = hasRole('admin', 'root', 'recaudador');
  const canDelete = hasRole('root');

  // Un espacio con ticket ACTIVO no se puede liberar a mano desde acá —
  // hay que pagar o anular el ticket (pantalla Tickets), que es lo que
  // realmente actualiza el estado del espacio en zones.
  useEffect(() => {
    if (!token) return;
    fetchTicketsActivos(token)
      .then((data) => {
        setEspaciosConTicketActivo(new Set(data.map((t) => t.idEspacio)));
      })
      .catch(() => {});
  }, [token, lastUpdate]);

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

  const handleStatusChange = async (id, status) => {
    try {
      await updateEspacioStatus(id, status, token);
      toast.success('Estado del espacio actualizado.');
      refetch();
    } catch (err) {
      toast.error(err.message || 'No se pudo actualizar el estado');
    }
  };

  const handleDeleteEspacio = async (espacio) => {
    if (espaciosConTicketActivo.has(espacio.id)) {
      toast.warning(`No se puede eliminar ${espacio.nombre}: tiene un ticket activo.`);
      return;
    }
    const ok = await confirm(
      `¿Eliminar el espacio "${espacio.nombre}"? Esta acción no se puede deshacer.`,
      { danger: true },
    );
    if (!ok) return;
    try {
      await deleteEspacio(espacio.id, token);
      toast.success('Espacio eliminado correctamente.');
      removeEspacio(espacio.id);
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el espacio');
    }
  };

  return (
    <>
      <PageHeader title="Espacios de Estacionamiento" subtitle="Estado en tiempo real de los espacios registrados">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-400">Última actualización: {formatDate(lastUpdate)}</span>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
              connected ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-red-50 text-red-700 ring-red-600/10'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {connected ? 'Conectado' : 'Desconectado'}
          </span>

          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              title="Vista de grid"
            >
              ⊞
            </Button>
            <Button
              variant={viewMode === 'table' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              title="Vista de tabla"
            >
              ≡
            </Button>
          </div>

          {canManage && (
            <Button variant="primary" icon={IconPlus} onClick={() => setShowNewPlace(true)}>
              Nuevo espacio
            </Button>
          )}
        </div>
      </PageHeader>

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

      {viewMode === 'grid' ? (
        <EspaciosGridView
          espacios={espaciosFiltrados}
          cargando={espacios === null}
          canEditStatus={canEditStatus}
          onStatusChange={handleStatusChange}
          espaciosConTicketActivo={espaciosConTicketActivo}
          canDelete={canDelete}
          onDelete={handleDeleteEspacio}
        />
      ) : (
        <EspaciosTable
          espacios={espaciosFiltrados}
          cargando={espacios === null}
          canEditStatus={canEditStatus}
          onStatusChange={handleStatusChange}
          espaciosConTicketActivo={espaciosConTicketActivo}
          canDelete={canDelete}
          onDelete={handleDeleteEspacio}
        />
      )}

      {showNewPlace && <NewPlaceModal onClose={() => setShowNewPlace(false)} onCreated={refetch} />}
      {confirmModal}
    </>
  );
};

export default EspaciosPage;
