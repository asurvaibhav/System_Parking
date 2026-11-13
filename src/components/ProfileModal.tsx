import React from 'react';
import {
  ShieldCheck,
  Clock,
  MapPin,
  CheckCircle2,
  LogOut,
  KeyRound,
  IdCard,
  AtSign,
} from 'lucide-react';
import { Profile } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Pill } from './ui/Pill';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onLogout: () => void;
  onRefreshProfile?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onLogout,
}) => {
  if (!isOpen) return null;

  const fullName = profile?.full_name || 'Gate Operator';
  const role = profile?.role || 'guard';
  const roleLabel = role === 'admin' ? 'System Administrator' : 'Security Guard';

  const getInitials = (name: string) => {
    if (!name) return 'OP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Operator Profile Details" maxWidth="md">
      <div className="space-y-6">
        {/* Profile Card Header */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F7F7F6] border border-[#ECECEC]">
          <div className="w-16 h-16 rounded-2xl bg-[#9FE870] text-[#163300] font-bold text-xl flex items-center justify-center shrink-0 shadow-xs">
            {getInitials(fullName)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-[#163300] truncate tracking-tight">
                {fullName}
              </h3>
              <Pill variant={role === 'admin' ? 'purple' : 'success'} size="sm">
                {roleLabel}
              </Pill>
            </div>
            {profile?.username && (
              <p className="text-xs text-[#6B6B6B] mt-0.5 font-medium flex items-center gap-1">
                <AtSign className="w-3 h-3 text-[#8C8C8C]" />
                <span>{profile.username}</span>
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#1F9D55] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#1F9D55] animate-pulse" />
              <span>Active Duty · {profile?.gate_name || 'Campus Gate Terminal'}</span>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl border border-[#ECECEC] bg-white space-y-1">
            <div className="text-[11px] font-semibold text-[#8C8C8C] flex items-center gap-1.5 uppercase tracking-wider">
              <IdCard className="w-3.5 h-3.5 text-[#163300]" />
              <span>Operator ID</span>
            </div>
            <div className="text-xs font-bold text-[#1A1A1A] font-mono">
              CPVTS-{(profile?.id || 'OPERATOR').slice(0, 10).toUpperCase()}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[#ECECEC] bg-white space-y-1">
            <div className="text-[11px] font-semibold text-[#8C8C8C] flex items-center gap-1.5 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-[#163300]" />
              <span>Station Assigned</span>
            </div>
            <div className="text-xs font-bold text-[#1A1A1A]">
              {profile?.gate_name ? profile.gate_name : 'Campus Gate'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[#ECECEC] bg-white space-y-1">
            <div className="text-[11px] font-semibold text-[#8C8C8C] flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-[#163300]" />
              <span>Gate Operation</span>
            </div>
            <div className="text-xs font-bold text-[#1A1A1A] capitalize">
              {profile?.gate_type ? `${profile.gate_type} Gate` : 'All Gates'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[#ECECEC] bg-white space-y-1">
            <div className="text-[11px] font-semibold text-[#8C8C8C] flex items-center gap-1.5 uppercase tracking-wider">
              <KeyRound className="w-3.5 h-3.5 text-[#163300]" />
              <span>Access Level</span>
            </div>
            <div className="text-xs font-bold text-[#1A1A1A] capitalize">
              {role === 'admin' ? 'Level 2 (Administrator)' : 'Level 1 (Gate Guard)'}
            </div>
          </div>
        </div>

        {/* Responsibilities & Permissions */}
        <div className="p-4 rounded-xl border border-[#ECECEC] bg-white">
          <div className="text-xs font-bold text-[#163300] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#1F9D55]" />
            <span>Station Responsibilities</span>
          </div>

          <ul className="space-y-2 text-xs text-[#4A4A4A]">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1F9D55] shrink-0" />
              <span>Real-time gate barrier check-in and check-out operation</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1F9D55] shrink-0" />
              <span>Parking slot allocation and occupancy monitoring</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1F9D55] shrink-0" />
              <span>Ticket QR code generation &amp; soft-copy receipt generation</span>
            </li>
            {role === 'admin' && (
              <li className="flex items-center gap-2 font-medium text-[#7C3AED]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
                <span>Admin Authority: Tariff matrix hourly rates &amp; free minute editing</span>
              </li>
            )}
          </ul>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#ECECEC]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#D92D20] hover:text-[#B42318] px-3 py-2 rounded-lg hover:bg-[#FEECEB] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out of Terminal</span>
          </button>

          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
