import { useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import {
  createVehiculo,
  updateVehiculo,
  TIPO_VEHICULO_OPTIONS,
  TIPO_VEHICULO_LABELS,
  CLASIFICACION_OPTIONS,
  TIPO_MOTO_OPTIONS,
} from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

const VehicleFormModal = ({ vehiculo, onClose, onSaved }) => {
  const { token } = useAuth();
  const isEdit = !!vehiculo;
  const [tipo, setTipo] = useState(vehiculo?.tipo ?? TIPO_VEHICULO_OPTIONS[0]);
  const [plate, setPlate] = useState(vehiculo?.plate ?? '');
  const [brand, setBrand] = useState(vehiculo?.brand ?? '');
  const [model, setModel] = useState(vehiculo?.model ?? '');
  const [color, setColor] = useState(vehiculo?.color ?? '');
  const [year, setYear] = useState(vehiculo?.year ?? new Date().getFullYear());
  const [clasification, setClasification] = useState(vehiculo?.clasification ?? CLASIFICACION_OPTIONS[0]);
  const [numberOfDoors, setNumberOfDoors] = useState(vehiculo?.numberOfDoors ?? 4);
  const [trunkCapacity, setTrunkCapacity] = useState(vehiculo?.trunkCapacity ?? 300);
  const [typeOfMotorbike, setTypeOfMotorbike] = useState(vehiculo?.typeOfMotorbike ?? TIPO_MOTO_OPTIONS[0]);
  const [payloadCapacity, setPayloadCapacity] = useState(vehiculo?.payloadCapacity ?? 500);
  const [cab, setCab] = useState(vehiculo?.cab ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const base = { plate, brand, model, color, year: Number(year), clasification };
    let datos = base;
    if (tipo === 'car') datos = { ...base, numberOfDoors: Number(numberOfDoors), trunkCapacity: Number(trunkCapacity) };
    if (tipo === 'motocicleta') datos = { ...base, typeOfMotorbike };
    if (tipo === 'pickupTruck') datos = { ...base, payloadCapacity: Number(payloadCapacity), cab };

    try {
      if (isEdit) {
        await updateVehiculo(vehiculo.id, { tipo, datos }, token);
      } else {
        await createVehiculo({ tipo, datos }, token);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el vehículo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Editar vehículo' : 'Nuevo vehículo'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={isEdit} className={inputClass}>
            {TIPO_VEHICULO_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {TIPO_VEHICULO_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Placa</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Año</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Marca</label>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Modelo</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Color</label>
            <input value={color} onChange={(e) => setColor(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Clasificación</label>
            <select value={clasification} onChange={(e) => setClasification(e.target.value)} className={inputClass}>
              {CLASIFICACION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {tipo === 'car' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>N° de puertas</label>
              <input
                type="number"
                min={2}
                max={6}
                value={numberOfDoors}
                onChange={(e) => setNumberOfDoors(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Capacidad baúl (L)</label>
              <input
                type="number"
                min={0}
                max={2000}
                value={trunkCapacity}
                onChange={(e) => setTrunkCapacity(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {tipo === 'motocicleta' && (
          <div>
            <label className={labelClass}>Tipo de moto</label>
            <select value={typeOfMotorbike} onChange={(e) => setTypeOfMotorbike(e.target.value)} className={inputClass}>
              {TIPO_MOTO_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        {tipo === 'pickupTruck' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Capacidad de carga (kg)</label>
              <input
                type="number"
                min={0}
                max={50000}
                value={payloadCapacity}
                onChange={(e) => setPayloadCapacity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cabina</label>
              <input value={cab} onChange={(e) => setCab(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear vehículo'}
        </Button>
      </form>
    </Modal>
  );
};

export default VehicleFormModal;
