import { useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { registerPerson } from '../api.js';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

const RegisterUserModal = ({ onClose, onCreated }) => {
  const [cedula, setCedula] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerPerson({
        cedula,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || undefined,
        password,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar el usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Nuevo usuario" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <p className="text-xs text-slate-500">
          Se registra con el rol <span className="font-medium">cliente</span> por defecto — el rol se puede cambiar
          después desde la tabla.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Cédula</label>
            <input value={cedula} onChange={(e) => setCedula(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Teléfono (opcional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Nombres</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Apellidos</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={inputClass}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {loading ? 'Creando...' : 'Crear usuario'}
        </Button>
      </form>
    </Modal>
  );
};

export default RegisterUserModal;
