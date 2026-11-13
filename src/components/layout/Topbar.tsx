import React, { useState, useEffect } from 'react';
import { Search, Bell, WifiOff } from 'lucide-react';
import { Profile } from '../../types';

interface TopbarProps {
  title: string;
  onQuickSearch: (query: string) => void;
  profile: Profile | null;
  onOpenProfile?: () => void;
  onOpenConfig?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  onQuickSearch,
  profile,
  onOpenProfile,
  onOpenConfig,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [istTime, setIstTime] = useState('');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(now);
      setIstTime(`${formatted} IST`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.getElementById('global-search-input');
        input?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onQuickSearch(searchQuery.trim());
      setSearchQuery('');
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'GG';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div>
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-[#D92D20] text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 tracking-wide">
          <WifiOff className="w-4 h-4" />
          <span>OFFLINE MODE: You are currently disconnected. Gate booking actions are disabled until connection restores.</span>
        </div>
      )}

      <header className="h-[70px] bg-white border-b border-[#ECECEC] px-8 flex items-center justify-between gap-6 select-none">
        {/* Page Title */}
        <div>
          <h1 className="text-[22px] font-semibold text-[#163300] tracking-tight">
            {title}
          </h1>
        </div>

        {/* Center / Search bar with Ctrl+K */}
        <div className="flex-1 max-w-md mx-4">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-[#8C8C8C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="global-search-input"
              type="text"
              placeholder="Search vehicle number or spot (e.g. KA22AB1234, T-02)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-full pl-10 pr-16 py-2 text-xs focus:outline-none focus:bg-white focus:border-[#9FE870] focus:ring-1 focus:ring-[#9FE870] transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <span className="text-[10px] font-semibold text-[#8C8C8C] bg-white border border-[#E0E0E0] rounded px-1.5 py-0.5 shadow-2xs">
                ⌘K
              </span>
            </div>
          </form>
        </div>

        {/* Right Section: IST Clock + Bell + User Chip */}
        <div className="flex items-center gap-5">
          {/* Live IST clock */}
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-[12.5px] font-semibold text-[#163300] tabular-nums">
              {istTime}
            </span>
            <span className="text-[10px] text-[#8C8C8C] font-medium">Gate 1 Terminal</span>
          </div>

          <div className="h-7 w-[1px] bg-[#ECECEC] hidden lg:block" />

          {/* Decorative Bell */}
          <div className="relative">
            <button
              title="Notifications"
              className="w-9 h-9 rounded-full border border-[#ECECEC] flex items-center justify-center text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F7F7F6] transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
            </button>
            <span className="w-2 h-2 rounded-full bg-[#9FE870] absolute top-1.5 right-1.5 ring-2 ring-white" />
          </div>

          {/* User profile chip */}
          <div
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full border border-[#ECECEC] hover:bg-[#F7F7F6] transition-colors cursor-pointer"
            title="Click to view operator profile details"
          >
            <div className="w-7 h-7 rounded-full bg-[#9FE870] text-[#163300] font-bold text-xs flex items-center justify-center">
              {getInitials(profile?.full_name || 'Guard')}
            </div>
            <div className="text-left text-xs leading-tight">
              <div className="font-semibold text-[#1A1A1A] max-w-[120px] truncate">
                {profile?.full_name || 'Security Guard'}
              </div>
              <div className="text-[10px] text-[#8C8C8C] uppercase font-bold tracking-wider">
                {profile?.role || 'guard'}
              </div>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};
