import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-dashed border-[#ECECEC] ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-[#F7F7F6] flex items-center justify-center text-[#6B6B6B] mb-3">
          {icon}
        </div>
      )}
      <h4 className="text-base font-semibold text-[#163300] mb-1">{title}</h4>
      {description && (
        <p className="text-sm text-[#6B6B6B] max-w-sm mb-4">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};
