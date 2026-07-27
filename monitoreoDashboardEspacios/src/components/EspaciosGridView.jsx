import { useEffect, useState } from 'react';
import EstadoSelect from './EstadoSelect.jsx';
import Button from './Button.jsx';
import { IconTrash } from './icons.jsx';
import { ESTADO_MAP_INVERSE, TIPO_ESPACIO_LABELS, toEnumLabel } from '../api.js';

const ESTADO_ICONS = {
  DISPONIBLE: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  OCUPADO: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6 6a2 2 0 11-4 0 2 2 0 014 0zM12 6a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 11-4 0 2 2 0 014 0zM5.172 14.172a3 3 0 015.656 0M9 16a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  ),
  RESERVADO: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5 2a1 1 0 011-1h8a1 1 0 011 1v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H6v1a1 1 0 11-2 0v-1H2a2 2 0 01-2-2v-2H1a1 1 0 110-2h1V9H1a1 1 0 110-2h1V5a2 2 0 012-2h2V2zM4 5h12v10H4V5z" clipRule="evenodd" />
    </svg>
  ),
  MANTENIMIENTO: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
};

const TIPO_ICON = {
  CAR: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M5 9V7a2 2 0 012-2h6a2 2 0 012 2v2M5 9c0 1 .5 3 5 3s5-2 5-3m-10 0a7 7 0 1114 0M9 9h2m-6 4h12a2 2 0 002-2v-2a2 2 0 00-2-2H3a2 2 0 00-2 2v2a2 2 0 002 2z" />
    </svg>
  ),
  BIKE: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6.707 6.707a1 1 0 10-1.414-1.414l-3 3a1 1 0 001.414 1.414l3-3zM12.707 12.707a1 1 0 10-1.414-1.414l-3 3a1 1 0 001.414 1.414l3-3zM7 7a1 1 0 100-2 1 1 0 000 2zm6 6a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  ),
  BUS: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
    </svg>
  ),
};

const ESTADO_CONFIG = {
  DISPONIBLE: {
    icon: ESTADO_ICONS.DISPONIBLE,
    bgColor: 'from-emerald-50 to-emerald-100',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-900',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    iconColor: 'text-emerald-600',
    label: 'Disponible',
  },
  OCUPADO: {
    icon: ESTADO_ICONS.OCUPADO,
    bgColor: 'from-red-50 to-red-100',
    borderColor: 'border-red-300',
    textColor: 'text-red-900',
    badgeColor: 'bg-red-100 text-red-700',
    iconColor: 'text-red-600',
    label: 'Ocupado',
  },
  RESERVADO: {
    icon: ESTADO_ICONS.RESERVADO,
    bgColor: 'from-amber-50 to-amber-100',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-900',
    badgeColor: 'bg-amber-100 text-amber-700',
    iconColor: 'text-amber-600',
    label: 'Reservado',
  },
  MANTENIMIENTO: {
    icon: ESTADO_ICONS.MANTENIMIENTO,
    bgColor: 'from-slate-100 to-slate-200',
    borderColor: 'border-slate-400',
    textColor: 'text-slate-700',
    badgeColor: 'bg-slate-200 text-slate-700',
    iconColor: 'text-slate-600',
    label: 'Mantenimiento',
  },
};

const EspaciosGridView = ({
  espacios,
  cargando,
  canEditStatus,
  onStatusChange,
  espaciosConTicketActivo,
  canDelete,
  onDelete,
}) => {
  const [updatingIds, setUpdatingIds] = useState(new Set());

  useEffect(() => {
    if (updatingIds.size > 0) {
      const timer = setTimeout(() => setUpdatingIds(new Set()), 600);
      return () => clearTimeout(timer);
    }
  }, [updatingIds]);

  const handleStatusChange = (id, status) => {
    setUpdatingIds((prev) => new Set([...prev, id]));
    onStatusChange(id, status);
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
          <p className="text-sm text-slate-500">Cargando espacios...</p>
        </div>
      </div>
    );
  }

  if (espacios.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <p className="text-sm text-slate-500">No hay espacios que coincidan con los filtros.</p>
      </div>
    );
  }

  return (
    <div className="grid auto-fit gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {espacios.map((espacio) => {
        const config = ESTADO_CONFIG[espacio.estado] || ESTADO_CONFIG.DISPONIBLE;
        const tipoIcon = TIPO_ICON[espacio.tipo] || '📍';
        const isUpdating = updatingIds.has(espacio.id);
        const hasActiveTicket = espaciosConTicketActivo.has(espacio.id);

        return (
          <div
            key={espacio.id}
            className={`relative overflow-hidden rounded-xl border-2 shadow-md transition-all duration-300 ${
              config.borderColor
            } ${config.bgColor} ${
              isUpdating
                ? 'animate-pulse scale-105 shadow-lg ring-2 ring-offset-2 ring-blue-400'
                : 'hover:shadow-lg hover:scale-105 transform'
            }`}
          >
            {/* Efecto de brillo */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 hover:opacity-20 transition-opacity" />

            {/* Contenedor principal */}
            <div className="relative p-5">
              {/* Header con icon y zona */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 ${config.iconColor}`}>
                    {config.icon}
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${config.textColor}`}>
                      {espacio.nombre || 'Sin nombre'}
                    </h3>
                    <p className={`text-xs ${config.textColor} opacity-70`}>
                      {espacio.nombreZona || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className={`flex-shrink-0 ${config.iconColor}`}>
                  {tipoIcon}
                </div>
              </div>

              {/* Separador */}
              <div className="mb-3 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-20" />

              {/* Info del espacio */}
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className={`${config.textColor} opacity-70 font-medium`}>Tipo:</span>
                  <span className={`${config.textColor} font-semibold`}>
                    {toEnumLabel(espacio.tipo, TIPO_ESPACIO_LABELS)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`${config.textColor} opacity-70 font-medium`}>ID:</span>
                  <span className="font-mono text-xs text-slate-400">
                    {espacio.id.slice(0, 8)}...
                  </span>
                </div>
              </div>

              {/* Estado y control */}
              <div className="space-y-3">
                {canEditStatus && !hasActiveTicket ? (
                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${config.textColor} opacity-70 block`}>
                      Cambiar estado:
                    </label>
                    <EstadoSelect
                      value={ESTADO_MAP_INVERSE[espacio.estado] ?? espacio.estado}
                      onChange={(nuevoEstado) => handleStatusChange(espacio.id, nuevoEstado)}
                    />
                  </div>
                ) : (
                  <div
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 ${config.badgeColor} font-semibold text-sm w-full justify-center`}
                  >
                    <span>{config.label}</span>
                    {hasActiveTicket && (
                      <svg
                        title="Hay un ticket activo — págalo o anúlalo en Tickets"
                        className="ml-auto w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M5 9V7a2 2 0 012-2h6a2 2 0 012 2v2M5 9c0 1 .5 3 5 3s5-2 5-3m-10 0a7 7 0 1114 0M9 9h2m-6 4h12a2 2 0 002-2v-2a2 2 0 00-2-2H3a2 2 0 00-2 2v2a2 2 0 002 2z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                )}

                {/* Botón de delete */}
                {canDelete && !hasActiveTicket && (
                  <Button variant="danger" icon={IconTrash} onClick={() => onDelete(espacio)} className="w-full">
                    Eliminar
                  </Button>
                )}

                {/* Indicador de ticket activo */}
                {hasActiveTicket && (
                  <div className="rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-700 text-center font-medium flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Ticket activo
                  </div>
                )}
              </div>
            </div>

            {/* Indicador de conexión en la esquina superior derecha */}
            <div className={`absolute top-2 right-2 h-2 w-2 rounded-full ${
              espacio.active ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>
        );
      })}
    </div>
  );
};

export default EspaciosGridView;
