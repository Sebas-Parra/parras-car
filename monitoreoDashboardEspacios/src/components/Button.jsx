const VARIANT_CLASS = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800 disabled:hover:bg-slate-900',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:hover:bg-white',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:hover:bg-transparent',
  // Sin fondo ni padding propios: hereda el color del contenedor (ej. banners de error/éxito).
  link: 'font-medium underline underline-offset-2 hover:opacity-75',
};

const SIZE_CLASS = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  none: '',
};

const Button = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
    {...rest}
  >
    {Icon && <Icon className="h-4 w-4 shrink-0" />}
    {children}
  </button>
);

export default Button;
