import { clsx } from 'clsx';
import { InputHTMLAttributes, forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, hint, className, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
        <div className="relative">
          {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
          <input
            ref={ref}
            type={type}
            className={clsx(
              'w-full px-3 py-2 border border-gray-300 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 focus:border-transparent',
              icon && 'pl-10',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
          {error && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />}
        </div>
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        {hint && !error && <p className="text-gray-500 text-sm mt-1">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
