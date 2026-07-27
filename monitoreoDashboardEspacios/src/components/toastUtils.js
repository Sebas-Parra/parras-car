const VALID_TYPES = new Set(['success', 'error', 'warning', 'info']);
const DEFAULT_DURATION = 4500;

const DEFAULT_TITLES = {
  success: 'Listo',
  error: 'Error',
  warning: 'Atención',
  info: 'Información',
};

const messageFrom = (message) => {
  if (message instanceof Error) return message.message;
  if (typeof message === 'string') return message.trim();
  if (message == null) return '';
  return String(message).trim();
};

export const createToast = ({ type = 'info', message, title, duration = DEFAULT_DURATION } = {}) => {
  const safeType = VALID_TYPES.has(type) ? type : 'info';
  return {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: safeType,
    title: title || DEFAULT_TITLES[safeType],
    message: messageFrom(message) || 'Algo ocurrió. Intenta nuevamente.',
    duration,
  };
};
