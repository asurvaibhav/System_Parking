import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-6 border-b border-[#ECECEC] ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`pb-3 text-sm font-medium transition-all relative flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              isActive
                ? 'text-[#163300] font-semibold'
                : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${
                  isActive
                    ? 'bg-[#EAF9DD] text-[#163300]'
                    : 'bg-[#F2F2F0] text-[#6B6B6B]'
                }`}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#163300] rounded-t-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};
