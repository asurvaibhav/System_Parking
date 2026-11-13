import React from 'react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  progress?: {
    current: number;
    total: number;
    color?: string;
  };
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  progress,
  trend,
}) => {
  const percentage = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Card className="flex flex-col justify-between hover:border-[#DFDFDF] transition-colors">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium text-[#6B6B6B]">{label}</span>
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-[#F7F7F6] flex items-center justify-center text-[#163300]">
              {icon}
            </div>
          )}
        </div>
        <div className="text-[28px] font-semibold text-[#163300] tracking-tight tabular-nums">
          {value}
        </div>
      </div>

      {progress && (
        <div className="mt-4 pt-2 border-t border-[#F7F7F6]">
          <div className="flex items-center justify-between text-xs text-[#6B6B6B] mb-1.5 font-medium">
            <span>Occupancy</span>
            <span className="tabular-nums font-semibold text-[#1A1A1A]">
              {progress.current}/{progress.total} ({percentage}%)
            </span>
          </div>
          <div className="w-full h-2 bg-[#F0F0EE] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-[#9FE870]"
              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
            />
          </div>
        </div>
      )}

      {trend && !progress && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[#6B6B6B]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#9FE870]" />
          <span>{trend.label}</span>
        </div>
      )}

      {subtitle && !progress && !trend && (
        <div className="mt-3 text-xs text-[#6B6B6B]">{subtitle}</div>
      )}
    </Card>
  );
};
