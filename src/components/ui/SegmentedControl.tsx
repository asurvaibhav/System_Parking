import React from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex items-center p-1 bg-[#F2F2F0] rounded-[12px] border border-[#ECECEC] w-full ${className}`}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-[9px] font-medium transition-all duration-150 cursor-pointer select-none whitespace-nowrap ${
              size === 'sm' ? 'py-1 px-2.5 text-xs' : 'py-2 px-3 text-sm'
            } ${
              isSelected
                ? 'bg-white text-[#163300] font-semibold shadow-xs'
                : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
            }`}
          >
            {option.icon && <span className="shrink-0">{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
