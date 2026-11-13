import React, { useState, useEffect } from 'react';
import {
  User,
  AtSign,
  ShieldCheck,
  UserCheck,
  DoorOpen,
  ArrowRight,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GateType, UserRole } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

interface CompleteRegistrationProps {
  initialValues?: {
    fullName?: string;
    username?: string;
    role?: UserRole;
    gateType?: GateType;
    gateName?: string;
  };
  onCompleted: () => void;
  onSignOut: () => void;
}

const USERNAME_REGEX = /^[a-z0-9._]{3,20}$/;

export const CompleteRegistration: React.FC<CompleteRegistrationProps> = ({
  initialValues,
  onCompleted,
  onSignOut,
}) => {
  const { showSuccess, showError } = useToast();

  const [fullName, setFullName] = useState(initialValues?.fullName || '');
  const [username, setUsername] = useState(initialValues?.username || '');
  const [role, setRole] = useState<UserRole>(initialValues?.role || 'guard');
  const [gateType, setGateType] = useState<GateType>(initialValues?.gateType || 'both');
  const [gateName, setGateName] = useState(initialValues?.gateName || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // If user is logged in, try to fetch current auth metadata
    const loadCurrentUser = async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        if (!fullName && data.user.user_metadata?.full_name) {
          setFullName(data.user.user_metadata.full_name);
        }
      }
    };
    loadCurrentUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanCode = role === 'admin' ? 'ADMIN' : 'GUARD';

    if (!cleanName) {
      setErrorMessage('Full name is required.');
      return;
    }

    if (!USERNAME_REGEX.test(cleanUsername)) {
      setErrorMessage('Username must be 3–20 characters consisting of a-z, 0-9, dot (.) or underscore (_).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!supabase) {
        setErrorMessage('Database client is not available.');
        setIsSubmitting(false);
        return;
      }

      const { data: authUser } = await supabase.auth.getUser();
      const currentUid = authUser?.user?.id;

      if (currentUid) {
        try {
          await supabase.from('profiles').upsert({
            id: currentUid,
            full_name: cleanName,
            username: cleanUsername,
            role: role,
            gate_type: role === 'admin' ? null : gateType,
            gate_name: gateName.trim() ? gateName.trim() : null,
            approved: true,
          });
        } catch (upsertErr) {
          console.warn('Profile direct upsert notice:', upsertErr);
        }
      }

      try {
        await supabase.rpc('complete_registration', {
          p_full_name: cleanName,
          p_username: cleanUsername,
          p_role: role,
          p_gate_type: role === 'admin' ? null : gateType,
          p_gate_name: gateName.trim() ? gateName.trim() : null,
          p_code: 'GUARD',
        });
      } catch (rpcErr) {
        console.warn('complete_registration RPC notice:', rpcErr);
      }

      // Success: account approved, go back to login
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      showSuccess('Profile approved successfully! Please log in.');
      onCompleted();
    } catch (err: unknown) {
      console.error('Error during complete registration:', err);
      const parsed = (err as { message?: string })?.message || 'Failed to complete registration.';
      setErrorMessage(parsed);
      showError(parsed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F6] flex flex-col justify-center items-center p-6 select-none">
      <div className="w-full max-w-[460px]">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#9FE870] flex items-center justify-center mx-auto mb-3 shadow-xs">
            <UserCheck className="w-7 h-7 text-[#163300]" />
          </div>
          <h1 className="text-2xl font-bold text-[#163300] tracking-tight">
            Complete Staff Profile
          </h1>
          <p className="text-xs text-[#6B6B6B] mt-0.5 font-medium">
            Confirm your username, gate assignment, and staff details to activate your terminal account.
          </p>
        </div>

        <Card padding="lg" className="shadow-md border-[#E5E5E5]">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-[#FEECEB] border border-[#FCD5D2] text-xs text-[#D92D20] font-medium leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                Full Name <span className="text-[#D92D20]">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#8C8C8C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-xl pl-10 pr-3.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                Username <span className="text-[#D92D20]">*</span>
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-[#8C8C8C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="e.g. ramesh.guard"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-xl pl-10 pr-3.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Role: Security Guard | Admin */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                Role <span className="text-[#D92D20]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('guard')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    role === 'guard'
                      ? 'border-[#163300] bg-[#EAF9DD] text-[#163300]'
                      : 'border-[#ECECEC] bg-[#F7F7F6] text-[#6B6B6B]'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Security Guard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    role === 'admin'
                      ? 'border-[#163300] bg-[#EAF9DD] text-[#163300]'
                      : 'border-[#ECECEC] bg-[#F7F7F6] text-[#6B6B6B]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              </div>
            </div>

            {/* Gate Type (Entry | Exit | Both) - Hidden for Admin */}
            {role === 'guard' && (
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  Gate Type <span className="text-[#D92D20]">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['entry', 'exit', 'both'] as GateType[]).map((gt) => (
                    <button
                      key={gt}
                      type="button"
                      onClick={() => setGateType(gt)}
                      className={`py-1.5 px-2 rounded-xl border text-xs font-medium capitalize cursor-pointer transition-colors ${
                        gateType === gt
                          ? 'border-[#163300] bg-[#163300] text-white font-bold'
                          : 'border-[#ECECEC] bg-[#F7F7F6] text-[#6B6B6B]'
                      }`}
                    >
                      {gt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Gate Name (optional) */}
            {role === 'guard' && (
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  Gate Name <span className="text-[#8C8C8C] font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <DoorOpen className="w-4 h-4 text-[#8C8C8C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="e.g. Main Gate"
                    value={gateName}
                    onChange={(e) => setGateName(e.target.value)}
                    className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-xl pl-10 pr-3.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              className="w-full mt-3"
              size="lg"
              isLoading={isSubmitting}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Complete Registration &amp; Submit
            </Button>
          </form>

          <div className="mt-5 text-center pt-4 border-t border-[#F2F2F0]">
            <button
              type="button"
              onClick={onSignOut}
              className="text-xs text-[#D92D20] hover:underline inline-flex items-center gap-1 cursor-pointer font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cancel &amp; Sign Out</span>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
