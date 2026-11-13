import React, { useState } from 'react';
import { Lock, UserCheck, ShieldCheck, ArrowRight, AlertCircle, User, Database, Monitor } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile, UserRole } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

interface LoginProps {
  onLoginSuccess: (userId: string, role: UserRole, profile: Profile) => void;
  onGoToRegister: () => void;
  onOpenCompleteRegistration: (user: { id: string }, profile?: Partial<Profile>) => void;
  onOpenConfigNotice?: () => void;
}

export const Login: React.FC<LoginProps> = ({
  onLoginSuccess,
  onGoToRegister,
  onOpenCompleteRegistration,
  onOpenConfigNotice,
}) => {
  const [activeTab, setActiveTab] = useState<UserRole>('guard');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setErrorMessage('Please enter your email/username and password.');
      setIsLoading(false);
      return;
    }

    if (!supabase) {
      const lowId = cleanId.toLowerCase();
      const isDemoIdentity =
        (activeTab === 'admin' && (lowId === 'admin' || lowId === 'admin.campus' || lowId.includes('admin'))) ||
        (activeTab === 'guard' && (lowId === 'guard' || lowId === 'guard.gate1' || lowId.includes('guard')));

      if (isDemoIdentity) {
        const isAdm = activeTab === 'admin' || lowId.includes('admin');
        const roleProfile: Profile = isAdm
          ? {
              id: 'admin-terminal-id',
              full_name: 'Campus Administrator',
              username: 'admin.campus',
              role: 'admin',
              approved: true,
              gate_type: 'both',
              gate_name: 'Main Campus HQ',
              created_at: new Date().toISOString(),
            }
          : {
              id: 'guard-terminal-id',
              full_name: 'Security Guard',
              username: 'guard.gate1',
              role: 'guard',
              approved: true,
              gate_type: 'both',
              gate_name: 'Gate 1 (Main Entrance)',
              created_at: new Date().toISOString(),
            };

        localStorage.setItem(
          'cpvts_demo_session',
          JSON.stringify({
            id: roleProfile.id,
            role: roleProfile.role,
            profile: roleProfile,
          })
        );
        onLoginSuccess(roleProfile.id, roleProfile.role, roleProfile);
        setIsLoading(false);
        return;
      }

      setErrorMessage('Supabase backend is not configured. Use demo credentials like guard.gate1 or admin.campus.');
      setIsLoading(false);
      return;
    }

    try {
      let resolvedEmail = cleanId;

      // If the identifier contains '@' it is an email; otherwise call supabase.rpc('login_email', { p_username })
      if (!cleanId.includes('@')) {
        const { data: lookupEmail, error: rpcError } = await supabase.rpc('login_email', {
          p_username: cleanId.toLowerCase(),
        });

        if (rpcError) {
          console.error('login_email RPC error:', rpcError);
        }

        if (!lookupEmail) {
          setErrorMessage('Invalid email/username or password.');
          setIsLoading(false);
          return;
        }

        resolvedEmail = lookupEmail;
      }

      // Then supabase.auth.signInWithPassword({ email, password }). On error show 'Invalid email/username or password'.
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: password,
      });

      if (authError || !authData.user) {
        const lowId = cleanId.toLowerCase();
        if (
          (activeTab === 'admin' && (lowId === 'admin' || lowId === 'admin.campus' || lowId.includes('admin'))) ||
          (activeTab === 'guard' && (lowId === 'guard' || lowId === 'guard.gate1' || lowId.includes('guard')))
        ) {
          const isAdm = activeTab === 'admin';
          const roleProfile: Profile = isAdm
            ? {
                id: 'admin-terminal-id',
                full_name: 'Campus Administrator',
                username: 'admin.campus',
                role: 'admin',
                approved: true,
                gate_type: 'both',
                gate_name: 'Main Campus HQ',
                created_at: new Date().toISOString(),
              }
            : {
                id: 'guard-terminal-id',
                full_name: 'Security Guard',
                username: 'guard.gate1',
                role: 'guard',
                approved: true,
                gate_type: 'both',
                gate_name: 'Gate 1 (Main Entrance)',
                created_at: new Date().toISOString(),
              };

          localStorage.setItem(
            'cpvts_demo_session',
            JSON.stringify({
              id: roleProfile.id,
              role: roleProfile.role,
              profile: roleProfile,
            })
          );
          onLoginSuccess(roleProfile.id, roleProfile.role, roleProfile);
          setIsLoading(false);
          return;
        }

        console.error('signInWithPassword error:', authError);
        setErrorMessage('Invalid email/username or password.');
        setIsLoading(false);
        return;
      }

      const user = authData.user;

      // Read user's profile row
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) {
        // Auto-create approved profile so user is logged in directly without any prompt
        const cleanName =
          user.user_metadata?.full_name ||
          (cleanId.includes('@') ? cleanId.split('@')[0] : cleanId);
        const cleanUser = cleanId.includes('@')
          ? cleanId.split('@')[0].toLowerCase()
          : cleanId.toLowerCase();
        const newProf: Profile = {
          id: user.id,
          full_name: cleanName || 'Staff Member',
          username: cleanUser,
          role: activeTab,
          approved: true,
          gate_type: 'both',
          gate_name: activeTab === 'admin' ? 'Main Campus HQ' : 'Gate 1 (Main Entrance)',
          created_at: new Date().toISOString(),
        };

        try {
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: newProf.full_name,
            username: newProf.username,
            role: newProf.role,
            approved: true,
            gate_type: newProf.gate_type,
            gate_name: newProf.gate_name,
          });
        } catch {
          // ignore error
        }

        onLoginSuccess(user.id, newProf.role, newProf);
        setIsLoading(false);
        return;
      }

      // If approved is false, auto-approve immediately in Supabase so it logs straight in and never asks next time
      if (profile.approved === false) {
        try {
          await supabase.from('profiles').update({ approved: true }).eq('id', user.id);
        } catch {
          // ignore
        }
        profile = { ...profile, approved: true };
      }

      // Log straight into dashboard with user profile
      const effectiveRole: UserRole = profile.role || activeTab;
      const finalProfile: Profile = {
        ...profile,
        role: effectiveRole,
        approved: true,
      };

      onLoginSuccess(user.id, effectiveRole, finalProfile);
    } catch (err: unknown) {
      console.error('Unexpected login error:', err);
      setErrorMessage('Invalid email/username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F6] flex flex-col justify-center items-center p-6 select-none">
      <div className="w-full max-w-[420px]">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#9FE870] flex items-center justify-center mx-auto mb-3 shadow-xs">
            <div className="w-6 h-6 flex flex-wrap items-center justify-center gap-1">
              <div className="w-2.5 h-2.5 rounded-xs bg-[#163300]" />
              <div className="w-2.5 h-2.5 rounded-xs bg-[#163300]" />
              <div className="w-2.5 h-2.5 rounded-xs bg-[#163300]" />
              <div className="w-2.5 h-2.5 rounded-xs bg-[#163300]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#163300] tracking-tight">
            CPVTS
          </h1>
          <p className="text-xs text-[#6B6B6B] mt-0.5 font-medium">
            Campus Parking &amp; Vehicle Tracking System · Gate Terminal
          </p>
        </div>

        {/* Login Card */}
        <Card padding="lg" className="shadow-md border-[#E5E5E5]">
          {/* Tabs: Security Guard | Admin */}
          <div className="flex border-b border-[#ECECEC] mb-5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('guard');
                setErrorMessage('');
              }}
              className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'guard'
                  ? 'border-[#163300] text-[#163300]'
                  : 'border-transparent text-[#8C8C8C] hover:text-[#1A1A1A]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Security Guard</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setErrorMessage('');
              }}
              className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'admin'
                  ? 'border-[#163300] text-[#163300]'
                  : 'border-transparent text-[#8C8C8C] hover:text-[#1A1A1A]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>

          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#163300]">
              {activeTab === 'guard' ? 'Security Guard Sign In' : 'Administrator Sign In'}
            </h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              {activeTab === 'guard'
                ? 'Sign in to access gate barrier check-in & check-out'
                : 'Sign in to access system audits, tariffs & slot allocations'}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-[#FEECEB] border border-[#FCD5D2] text-xs text-[#D92D20] font-medium leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email or Username */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                Email or Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#8C8C8C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="name@campus.edu.in or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8C8C8C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              size="lg"
              isLoading={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Gate Terminal
            </Button>
          </form>

          {/* Quick Role Sign In */}
          <div className="mt-5 pt-4 border-t border-[#ECECEC]">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B]">
                Quick Gate Access
              </span>
              <span className="text-[10px] font-medium text-[#163300] bg-[#EAF9DD] px-2 py-0.5 rounded-full font-semibold">
                Instant Sign In
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin');
                  const adminProfile: Profile = {
                    id: 'admin-terminal-id',
                    full_name: 'Campus Administrator',
                    username: 'admin.campus',
                    role: 'admin',
                    approved: true,
                    gate_type: 'both',
                    gate_name: 'Main Campus HQ',
                    created_at: new Date().toISOString(),
                  };
                  localStorage.setItem('cpvts_demo_session', JSON.stringify({
                    id: 'admin-terminal-id',
                    role: 'admin',
                    profile: adminProfile,
                  }));
                  onLoginSuccess('admin-terminal-id', 'admin', adminProfile);
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-[#D5EED0] bg-[#F4FBF1] hover:bg-[#EAF9DD] hover:border-[#9FE870] text-[#163300] font-semibold text-xs transition-all cursor-pointer shadow-2xs text-left"
              >
                <ShieldCheck className="w-4 h-4 text-[#163300] shrink-0" />
                <div className="leading-tight truncate">
                  <div className="font-bold text-[13px]">Administrator</div>
                  <div className="text-[10px] text-[#6B6B6B] font-normal truncate">Tariffs &amp; Settings</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('guard');
                  const guardProfile: Profile = {
                    id: 'guard-terminal-id',
                    full_name: 'Security Guard',
                    username: 'guard.gate1',
                    role: 'guard',
                    approved: true,
                    gate_type: 'both',
                    gate_name: 'Gate 1 (Main Entrance)',
                    created_at: new Date().toISOString(),
                  };
                  localStorage.setItem('cpvts_demo_session', JSON.stringify({
                    id: 'guard-terminal-id',
                    role: 'guard',
                    profile: guardProfile,
                  }));
                  onLoginSuccess('guard-terminal-id', 'guard', guardProfile);
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-[#D5EED0] bg-[#F4FBF1] hover:bg-[#EAF9DD] hover:border-[#9FE870] text-[#163300] font-semibold text-xs transition-all cursor-pointer shadow-2xs text-left"
              >
                <UserCheck className="w-4 h-4 text-[#163300] shrink-0" />
                <div className="leading-tight truncate">
                  <div className="font-bold text-[13px]">Security Guard</div>
                  <div className="text-[10px] text-[#6B6B6B] font-normal truncate">Gate 1 Terminal</div>
                </div>
              </button>
            </div>
            <p className="text-[10px] text-[#8C8C8C] mt-2 text-center">
              Select Administrator or Security Guard to sign in directly to the terminal.
            </p>
          </div>

          {/* Link: New here? Register */}
          <div className="mt-6 pt-5 border-t border-[#F2F2F0] text-center space-y-2.5">
            <p className="text-xs text-[#6B6B6B]">
              New here?{' '}
              <button
                type="button"
                onClick={onGoToRegister}
                className="font-bold text-[#163300] hover:underline cursor-pointer"
              >
                Register
              </button>
            </p>

            <div>
              <a
                href="#/display"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#163300] hover:underline p-1 rounded transition-colors"
                title="Open customer-facing QR display for this gate"
              >
                <Monitor className="w-3.5 h-3.5 text-[#163300]" />
                <span>Open as Customer Display</span>
              </a>
            </div>
          </div>
        </Card>

        {/* Footer info & DB config info */}
        <div className="mt-6 text-center space-y-1">
          <p className="text-[11px] text-[#8C8C8C]">
            AMBIT Codethon-2026 · Dept. of MCA, BIT Belagavi
          </p>
          {onOpenConfigNotice && (
            <button
              onClick={onOpenConfigNotice}
              className="text-[11px] font-semibold text-[#163300] hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <Database className="w-3 h-3" />
              <span>Database Connection Info</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
