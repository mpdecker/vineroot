import { clsx } from 'clsx';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, icon, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
    const variants = {
      primary: 'bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-500',
      secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-brand-500',
      ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-400',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    };
    const sizes = {
      xs: 'text-xs px-2.5 py-1 gap-1',
      sm: 'text-sm px-3 py-1.5 gap-2',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2',
    };
    return (
      <button ref={ref} disabled={disabled || loading} className={clsx(base, variants[variant], sizes[size], className)} {...props}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {icon && !loading && icon}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
