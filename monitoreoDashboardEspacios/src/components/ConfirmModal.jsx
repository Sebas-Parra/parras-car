import { useCallback, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';

export const useConfirm = () => {
  const [state, setState] = useState(null); // { message, danger }
  const resolver = useRef(null);

  const confirm = useCallback((message, { danger = false } = {}) => {
    setState({ message, danger });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handle = (result) => {
    setState(null);
    resolver.current?.(result);
    resolver.current = null;
  };

  const confirmModal = state ? (
    <Modal title="Confirmar" onClose={() => handle(false)}>
      <p className="text-sm text-slate-600">{state.message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => handle(false)}>
          Cancelar
        </Button>
        <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => handle(true)}>
          Confirmar
        </Button>
      </div>
    </Modal>
  ) : null;

  return { confirm, confirmModal };
};
