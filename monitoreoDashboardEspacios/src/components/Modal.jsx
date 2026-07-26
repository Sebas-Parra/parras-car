import Button from './Button.jsx';
import { IconX } from './icons.jsx';

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} className="!p-1.5" aria-label="Cerrar">
          <IconX className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </div>
  </div>
);

export default Modal;
