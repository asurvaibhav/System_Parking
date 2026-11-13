import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  AtSign,
  Mail,
  Lock,
  ShieldCheck,
  UserCheck,
  DoorOpen,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GateType, UserRole } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

interface RegisterProps {
  onGoToLogin: () => void;
  onOpenCompleteRegistration: (prefill?: {
    fullName: string;
    username: string;
    role: UserRole;
    gateType: GateType;
    gateName: string;
  }) => void;
}

const USERNAME_REGEX = /^[a-z0-9._]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Register: React.FC<RegisterProps> = ({
  onGoToLogin,
  onOpenCompleteRegistration,
}) => {
  const { showSuccess, showError } = useToast();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameErrorMsg, setUsernameErrorMsg] = useState('');

  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [role, setRole] = useState<UserRole>('guard');
  const [gateType, setGateType] = useState<GateType>('both');
  const [gateName, setGateName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Live username check with 400ms debounce
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      setUsernameStatus('idle');
      setUsernameErrorMsg('');
      return;
    }

    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameStatus('invalid');
      setUsernameErrorMsg('3–20 chars, lowercase letters, numbers, dot or underscore');
      return;
    }

    setUsernameStatus('checking');
    setUsernameErrorMsg('');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.rpc('username_available', {
          p_username: trimmed,
        });

        if (error) {
          console.error('username_available error:', error);
          // If RPC fails (e.g. not created yet), allow user to proceed
          setUsernameStatus('available');
          return;
        }

        if (data === true) {
          setUsernameStatus('available');
          setUsernameErrorMsg('');
        } else {
          setUsernameStatus('taken');
          setUsernameErrorMsg('Username is already taken');
        }
      } catch (err) {
        console.error('username check exception:', err);
        setUsernameStatus('available');
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [username]);

  // Live email check
  useEffect(() => {
    setIsEmailValid(EMAIL_REGEX.test(email.trim()));
  }, [email]);

  const isPasswordLengthValid = password.length >= 8;
  const doPasswordsMatch = password.length > 0 && password === confirmPassword;

  // Live checks validity
  const canSubmit =
    fullName.trim().length > 0 &&
    (usernameStatus === 'available' || (USERNAME_REGEX.test(username.trim().toLowerCase()) && usernameStatus !== 'taken')) &&
    isEmailValid &&
    isPasswordLengthValid &&
    doPasswordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setServerError('');
    setIsSubmitting(true);

    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim();
    const cleanCode = role === 'admin' ? 'ADMIN' : 'GUARD';

    try {
      if (!supabase) {
        showSuccess('Demo mode enabled. Please use the login screen with guard.gate1 or admin.campus.');
        onGoToLogin();
        setIsSubmitting(false);
        return;
      }

      // Step a: supabase.auth.signUp
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanFullName,
          },
        },
      });

      // Step b: Error handling
      if (signUpError) {
        console.error('Sign up error:', signUpError);
        const rawMsg = signUpError.message || '';
        const code = (signUpError as { code?: string; status?: number }).code || '';
        const status = (signUpError as { status?: number }).status;
        const lowerMsg = rawMsg.toLowerCase();

        if (
          code === 'over_email_send_rate_limit' ||
          code === 'email_rate_limit_exceeded' ||
          status === 429 ||
          lowerMsg.includes('rate limit') ||
          lowerMsg.includes('email rate limit')
        ) {
          setServerError(
            'Email rate limit exceeded by Supabase auth. In Supabase Dashboard -> Authentication -> Providers -> Email, disable "Confirm email", or wait a few minutes before trying again.'
          );
        } else if (lowerMsg.includes('already registered') || lowerMsg.includes('already exists') || lowerMsg.includes('user already exists')) {
          setServerError('This email is already registered. Please log in.');
        } else if (lowerMsg.includes('email') && (lowerMsg.includes('invalid') || lowerMsg.includes('format') || lowerMsg.includes('valid email'))) {
          setServerError(
            `Email address rejected by Supabase auth (${rawMsg}). Please verify the domain and formatting, or configure Email provider settings in Supabase.`
          );
        } else {
          setServerError(rawMsg || 'Failed to sign up.');
        }
        setIsSubmitting(false);
        return;
      }

      // Step c: Check if session is null (email confirmation is turned on in Supabase)
      if (!data.session) {
        setServerError('Email confirmation is switched on in Supabase. Ask the admin to turn it off in Supabase Authentication settings.');
        setIsSubmitting(false);
        return;
      }

      // Step d: Complete registration via direct profile upsert and RPC
      try {
        await supabase.from('profiles').upsert({
          id: data.session.user.id,
          full_name: cleanFullName,
          username: cleanUsername,
          role: role,
          gate_type: role === 'admin' ? null : gateType,
          gate_name: cleanGateName(gateName),
          approved: true,
        });
      } catch (upsertErr) {
        console.warn('Direct profile upsert notice:', upsertErr);
      }

      try {
        await supabase.rpc('complete_registration', {
          p_full_name: cleanFullName,
          p_username: cleanUsername,
          p_role: role,
          p_gate_type: role === 'admin' ? null : gateType,
          p_gate_name: cleanGateName(gateName),
          p_code: 'GUARD',
        });
      } catch (rpcErr) {
        console.warn('complete_registration RPC notice:', rpcErr);
      }

      // Step e: Registration is complete and approved. Sign out and go to Login.
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      showSuccess('Registration successful! Please log in with your credentials.');
      onGoToLogin();
    } catch (err: unknown) {
      console.error('Registration unexpected error:', err);
      const parsedMsg = (err as { message?: string })?.message || 'Registration failed.';
      const lower = parsedMsg.toLowerCase();
      if (lower.includes('rate limit')) {
        setServerError(
          'Email rate limit exceeded by Supabase auth. In Supabase Dashboard -> Authentication -> Providers -> Email, disable "Confirm email", or wait a few minutes before trying again.'
        );
      } else {
        setServerError(parsedMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  function cleanGateName(val: string): string | null {
    const trimmed = val.trim();
    return trimmed ? trimmed : null;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F6] flex flex-col justify-center items-center p-6 select-none">
      <div className="w-full max-w-[480px]">
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
            Register New Staff
          </h1>
          <p className="text-xs text-[#6B6B6B] mt-0.5 font-medium">
            Campus Parking &amp; Vehicle Tracking System · Gate Terminal
          </p>
        </div>

        <Card padding="lg" className="shadow-md border-[#E5E5E5]">
          {serverError && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#FEECEB] border border-[#FCD5D2] text-xs text-[#D92D20] font-medium leading-relaxed flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{serverError}</span>
                {serverError.toLowerCase().includes('rate limit') && (
                  <div className="mt-2 text-[11px] text-[#8C1D18] bg-white/70 p-2.5 rounded-lg border border-[#FCD5D2]/60">
                    <span className="font-semibold block mb-0.5">How to resolve in Supabase:</span>
                    <span>1. Open Supabase Dashboard → Authentication → Providers → Email</span>
                    <br />
                    <span>2. Toggle <strong>Confirm email</strong> off, click Save.</span>
                    <br />
                    <span>Or wait a few minutes for Supabase's hourly email rate limit bucket to reset.</span>
                  </div>
                )}
              </div>
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

            {/* Username with live check */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#1A1A1A]">
                  Username <span className="text-[#D92D20]">*</span>
                </label>
                <div className="text-[11px]">
                  {usernameStatus === 'checking' && (
                    <span className="text-[#8C8C8C] flex items-center gap-1 font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                    </span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="text-[#1F9D55] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Available
                    </span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-[#D92D20] font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Taken
                    </span>
                  )}
                </div>
              </div>
              <div className="relative">
                <AtSign className="w-4 h-4 text-[#8C8C8C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="e.g. ramesh.guard"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  className={`w-full bg-[#F7F7F6] border rounded-xl pl-10 pr-3.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:bg-white transition-all ${
                    usernameStatus === 'available'
                      ? 'border-[#1F9D55]'
                      : usernameStatus === 'taken' || usernameStatus === 'invalid'
                      ? 'border-[#D92D20]'
                      : 'border-[#ECECEC] focus:border-[#9FE870]'
                  }`}
                />
              </div>
              {usernameErrorMsg && (
                <p className="text-[11px] text-[#D92D20] mt-1 font-medium">
                  {usernameErrorMsg}
                </p>
              )}
            </div>

            {/* Email with live format check */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#1A1A1A]">
                  Email <span className="text-[#D92D20]">*</span>
                </label>
                {email && (
                  <span className={`text-[11px] font-semibold ${isEmailValid ? 'text-[#1F9D55]' : 'text-[#D92D20]'}`}>
                    {isEmailValid ? 'Valid email' : 'Invalid email format'}
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8C8C8C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="guard@campus.edu.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full bg-[#F7F7F6] border rounded-xl pl-10 pr-3.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:bg-white transition-all ${
                    email ? (isEmailValid ? 'border-[#1F9D55]' : 'border-[#D92D20]') : 'border-[#ECECEC] focus:border-[#9FE870]'
                  }`}
                />
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  Password <span className="text-[#D92D20]">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8C8C8C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    placeholder="Min 8 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full bg-[#F7F7F6] border rounded-xl pl-9 pr-2.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:bg-white transition-all ${
                      password ? (isPasswordLengthValid ? 'border-[#1F9D55]' : 'border-[#D92D20]') : 'border-[#ECECEC] focus:border-[#9FE870]'
                    }`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  Confirm Password <span className="text-[#D92D20]">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8C8C8C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-[#F7F7F6] border rounded-xl pl-9 pr-2.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:bg-white transition-all ${
                      confirmPassword ? (doPasswordsMatch ? 'border-[#1F9D55]' : 'border-[#D92D20]') : 'border-[#ECECEC] focus:border-[#9FE870]'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Role: Security Guard | Admin */}
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                Account Role <span className="text-[#D92D20]">*</span>
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

            {/* Gate Type (Entry | Exit | Both) - Hidden for Admin! */}
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
                    placeholder="e.g. Main Gate / North Gate"
                    value={gateName}
                    onChange={(e) => setGateName(e.target.value)}
                    className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-xl pl-10 pr-3.5 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white transition-all"
                  />
                </div>
              </div>
            )}

            {/* Submit Register */}
            <Button
              type="submit"
              variant="primary"
              className="w-full mt-3"
              size="lg"
              disabled={!canSubmit || isSubmitting}
              isLoading={isSubmitting}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Register Account
            </Button>
          </form>

          {/* Link back to login */}
          <div className="mt-5 text-center pt-4 border-t border-[#F2F2F0]">
            <p className="text-xs text-[#6B6B6B]">
              Already registered?{' '}
              <button
                type="button"
                onClick={onGoToLogin}
                className="font-bold text-[#163300] hover:underline cursor-pointer"
              >
                Log In
              </button>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
