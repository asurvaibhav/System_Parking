import React from 'react';
import {
  LayoutDashboard,
  LogIn,
  LogOut,
  Grid3X3,
  Search,
  History,
  Receipt,
  HelpCircle,
  LogOut as SignOutIcon,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Profile } from '../../types';

export type NavPage =
  | 'dashboard'
  | 'checkin'
  | 'checkout'
  | 'slots'
  // --- VIP RESERVATION FEATURE START ---
  | 'vip_reserve'
  // --- VIP RESERVATION FEATURE END ---
  | 'finder'
  | 'history'
  | 'tariffs'
  | 'settings';

interface SidebarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  onLogout: () => void;
  onOpenHelp: () => void;
  profile: Profile | null;
  onOpenProfile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  onLogout,
  onOpenHelp,
  profile,
  onOpenProfile,
}) => {
  const navItems: { id: NavPage; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'checkin', label: 'Check-In', icon: <LogIn className="w-4 h-4" /> },
    { id: 'checkout', label: 'Check-Out', icon: <LogOut className="w-4 h-4" /> },
    { id: 'slots', label: 'Slots', icon: <Grid3X3 className="w-4 h-4" /> },
    // --- VIP RESERVATION FEATURE START ---
    { id: 'vip_reserve', label: 'Reserve VIP Slot', icon: <Shield className="w-4 h-4" /> },
    // --- VIP RESERVATION FEATURE END ---
    { id: 'finder', label: 'Vehicle Finder', icon: <Search className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
    { id: 'tariffs', label: 'Tariffs', icon: <Receipt className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-[260px] min-w-[260px] bg-[#F7F7F6] border-r border-[#ECECEC] flex flex-col justify-between p-4 h-screen sticky top-0 select-none">
      {/* Top Brand Logo */}
      <div>
        <div className="flex items-center gap-3 px-3 py-2 mb-6">
          <div className="w-10 h-10 rounded-[12px] bg-[#9FE870] flex items-center justify-center shadow-xs">
            {/* Custom geometric logo mark similar to Ramtabs clover mark */}
            <div className="w-5 h-5 flex flex-wrap items-center justify-center gap-0.5">
              <div className="w-2 h-2 rounded-xs bg-[#163300]" />
              <div className="w-2 h-2 rounded-xs bg-[#163300]" />
              <div className="w-2 h-2 rounded-xs bg-[#163300]" />
              <div className="w-2 h-2 rounded-xs bg-[#163300]" />
            </div>
          </div>
          <div>
            <div className="text-[17px] font-bold text-[#163300] tracking-tight leading-tight">
              CPVTS
            </div>
            <div className="text-[11px] font-medium text-[#6B6B6B] leading-tight">
              Campus Parking Gate
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[13.5px] transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#9FE870] text-[#163300] font-semibold shadow-xs'
                    : 'text-[#4A4A4A] hover:text-[#163300] hover:bg-[#EFEFEF]'
                }`}
              >
                <span className={isActive ? 'text-[#163300]' : 'text-[#6B6B6B]'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="pt-4 border-t border-[#E8E8E6] space-y-1">


        <button
          onClick={onOpenHelp}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-full text-[13.5px] text-[#4A4A4A] hover:text-[#163300] hover:bg-[#EFEFEF] transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-[#6B6B6B]" />
          <span>Help &amp; Guide</span>
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-full text-[13.5px] text-[#D92D20] hover:bg-[#FEECEB] transition-colors cursor-pointer"
        >
          <SignOutIcon className="w-4 h-4 text-[#D92D20]" />
          <span>Log Out</span>
        </button>

        {profile && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="w-full pt-2 px-3 pb-1 text-[11px] text-[#888888] flex items-center justify-between hover:bg-[#EFEFEF] rounded-lg transition-colors cursor-pointer text-left"
            title="View operator profile details"
          >
            <span className="truncate font-medium text-[#1A1A1A]">{profile.full_name || 'Gate Guard'}</span>
            <span className="uppercase text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#EAF9DD] text-[#163300]">
              {profile.role}
            </span>
          </button>
        )}
      </div>
    </aside>
  );
};
