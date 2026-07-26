import { useEffect, useRef, useState } from 'react';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';

// Combobox de búsqueda: escribís y filtra las opciones, en vez de desplegar
// todas de una como un <select> nativo.
const SearchSelect = ({ options, value, onChange, getLabel = (o) => o.name, getId = (o) => o.id, placeholder = 'Buscar...' }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = options.find((o) => getId(o) === value);

  useEffect(() => {
    setQuery(selected ? getLabel(selected) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(selected ? getLabel(selected) : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const filtered =
    query.trim() === '' ? options : options.filter((o) => getLabel(o).toLowerCase().includes(query.trim().toLowerCase()));

  const handleSelect = (option) => {
    onChange(getId(option));
    setQuery(getLabel(option));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputClass}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">Sin resultados</li>
          ) : (
            filtered.map((option) => (
              <li key={getId(option)}>
                <button
                  type="button"
                  onClick={() => handleSelect(option)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  {getLabel(option)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchSelect;
