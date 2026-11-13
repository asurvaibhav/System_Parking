import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium rounded-[10px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:ring-offset-1 select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 whitespace-nowrap shrink-0 cursor-pointer';

  const variants = {
    primary:
      'bg-[#9FE870] text-[#163300] hover:bg-[#8FDB5F] font-semibold shadow-xs',
    secondary:
      'bg-[#EAF9DD] text-[#163300] hover:bg-[#d8f5c3]',
    outline:
      'bg-white border border-[#ECECEC] text-[#1A1A1A] hover:bg-[#F7F7F6] hover:border-[#DCDCDC] shadow-2xs',
    danger:
      'bg-[#FEECEB] text-[#D92D20] border border-[#FCD5D2] hover:bg-[#FDD8D5]',
    ghost:
      'text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F7F7F6]',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 h-8 gap-1.5',
    md: 'text-sm px-4 py-2 h-10 gap-2 min-h-[40px]',
    lg: 'text-base px-6 py-2.5 h-12 gap-2.5 min-h-[44px]',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
