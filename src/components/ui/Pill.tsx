import React from 'react';

export type PillVariant = 'success' | 'info' | 'warning' | 'danger' | 'purple' | 'neutral';

interface PillProps {
  variant?: PillVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Pill: React.FC<PillProps> = ({
  variant = 'neutral',
  children,
  size = 'md',
  className = '',
  dot = false,
}) => {
  const variants = {
    success: 'bg-[#E8F7EE] text-[#1F9D55] border-[#D1F2DE]',
    info: 'bg-[#EEF2FF] text-[#3B5BDB] border-[#D9E2FF]',
    warning: 'bg-[#FFF4E5] text-[#D9730D] border-[#FFE2BA]',
    danger: 'bg-[#FEECEB] text-[#D92D20] border-[#FCD5D2]',
    purple: 'bg-[#F3E8FF] text-[#7C3AED] border-[#E5CEFD]',
    neutral: 'bg-[#F2F2F0] text-[#555555] border-[#E3E3E0]',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  const dotColors = {
    success: 'bg-[#1F9D55]',
    info: 'bg-[#3B5BDB]',
    warning: 'bg-[#D9730D]',
    danger: 'bg-[#D92D20]',
    purple: 'bg-[#7C3AED]',
    neutral: 'bg-[#6B6B6B]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-solid select-none whitespace-nowrap shrink-0 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      <span>{children}</span>
    </span>
  );
};
