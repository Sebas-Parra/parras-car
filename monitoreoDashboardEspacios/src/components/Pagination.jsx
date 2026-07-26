const buttonClass =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

const PAGE_SIZE_OPTIONS = [10, 15, 20];

const Pagination = ({ page, pageSize, total, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <div className="flex items-center gap-2">
        <span>
          Página {page} de {totalPages} — {total} resultados
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">por página</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {totalPages > 1 && (
        <div className="space-x-2">
          <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={buttonClass}>
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className={buttonClass}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
