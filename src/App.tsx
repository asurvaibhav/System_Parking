/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { fetchUserProfile } from './lib/api';
import { Profile, UserRole, GateType } from './types';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Sidebar, NavPage } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { CompleteRegistration } from './pages/CompleteRegistration';
import { Dashboard } from './pages/Dashboard';
import { CheckIn } from './pages/CheckIn';
import { CheckOut } from './pages/CheckOut';
import { Slots } from './pages/Slots';
import { VehicleFinder } from './pages/VehicleFinder';
import { History } from './pages/History';
import { Tariffs } from './pages/Tariffs';
import { Settings } from './pages/Settings';
// --- VIP RESERVATION FEATURE START ---
import { VIPReservations } from './pages/VIPReservations';
// --- VIP RESERVATION FEATURE END ---
import { CustomerDisplay } from './pages/CustomerDisplay';
import { HelpModal } from './components/HelpModal';
import { ConfigNotice } from './components/ConfigNotice';
import { ProfileModal } from './components/ProfileModal';
import { Modal } from './components/ui/Modal';

type AuthView = 'login' | 'register' | 'complete_registration';

function MainApp() {
  const { showSuccess, showError } = useToast();

  const [isCustomerDisplayRoute, setIsCustomerDisplayRoute] = useState(() =>
    window.location.hash.startsWith('#/display')
  );

  useEffect(() => {
    const handleHash = () => {
      setIsCustomerDisplayRoute(window.location.hash.startsWith('#/display'));
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const [authView, setAuthView] = useState<AuthView>('login');
  const [currentPage, setCurrentPage] = useState<NavPage>('dashboard');
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Prefill state for complete registration screen
  const [completeRegPrefill, setCompleteRegPrefill] = useState<{
    fullName?: string;
    username?: string;
    role?: UserRole;
    gateType?: GateType;
    gateName?: string;
  } | undefined>(undefined);

  // Cross-page navigation parameters
  const [prefillCheckOutVehicle, setPrefillCheckOutVehicle] = useState<string>('');
  const [prefillCheckInSlot, setPrefillCheckInSlot] = useState<string>('');
  const [prefillFinderQuery, setPrefillFinderQuery] = useState<string>('');

  // Modals
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Initialize Auth & Profile
  useEffect(() => {
    if (!supabase) {
      const storedDemo = localStorage.getItem('cpvts_demo_session');
      if (storedDemo) {
        try {
          const parsed = JSON.parse(storedDemo);
          if (parsed && parsed.id && parsed.profile) {
            setCurrentUser({ id: parsed.id });
            setUserProfile(parsed.profile);
            setIsLoadingAuth(false);
            return;
          }
        } catch {
          localStorage.removeItem('cpvts_demo_session');
        }
      }
      setIsLoadingAuth(false);
      return;
    }
    const client = supabase;

    const initAuth = async () => {
      try {
        // First check for active demo session in localStorage
        const storedDemo = localStorage.getItem('cpvts_demo_session');
        if (storedDemo) {
          try {
            const parsed = JSON.parse(storedDemo);
            if (parsed && parsed.id && parsed.profile) {
              setCurrentUser({ id: parsed.id });
              setUserProfile(parsed.profile);
              setIsLoadingAuth(false);
              return;
            }
          } catch {
            localStorage.removeItem('cpvts_demo_session');
          }
        }

        const { data, error } = await client.auth.getSession();
        if (error) {
          console.error('Session retrieval error:', error);
        } else if (data.session?.user) {
          const user = data.session.user;
          setCurrentUser({ id: user.id });

          try {
            const prof = await fetchUserProfile(user.id);
            if (prof.approved === false) {
              if (supabase) {
                supabase.from('profiles').update({ approved: true }).eq('id', user.id).then();
              }
              prof.approved = true;
            }
            setUserProfile(prof);
          } catch (profErr) {
            console.warn('Error fetching profile for current user, using fallback:', profErr);
            setUserProfile({
              id: user.id,
              full_name: user.user_metadata?.full_name || 'Security Operator',
              username: 'guard.gate1',
              role: 'guard',
              approved: true,
              gate_type: 'both',
              gate_name: 'Gate 1 (Main Entrance)',
              created_at: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: authListener } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          localStorage.removeItem('cpvts_demo_session');
          setCurrentUser({ id: session.user.id });
          try {
            const prof = await fetchUserProfile(session.user.id);
            if (prof.approved === false) {
              if (supabase) {
                supabase.from('profiles').update({ approved: true }).eq('id', session.user.id).then();
              }
              prof.approved = true;
            }
            setUserProfile(prof);
          } catch (err) {
            console.warn('Error loading profile on sign in:', err);
            setUserProfile({
              id: session.user.id,
              full_name: session.user.user_metadata?.full_name || 'Security Operator',
              username: 'guard.gate1',
              role: 'guard',
              approved: true,
              gate_type: 'both',
              gate_name: 'Gate 1 (Main Entrance)',
              created_at: new Date().toISOString(),
            });
          }
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem('cpvts_demo_session');
          setCurrentUser(null);
          setUserProfile(null);
          setAuthView('login');
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLoginSuccess = (userId: string, role: UserRole, profile: Profile) => {
    setCurrentUser({ id: userId });
    setUserProfile(profile);
    setCurrentPage('dashboard');
    showSuccess(`Signed in successfully as ${profile.full_name || 'Staff'}`);
  };

  const handleLogout = async () => {
    localStorage.removeItem('cpvts_demo_session');
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }
    setCurrentUser(null);
    setUserProfile(null);
    setAuthView('login');
    setCurrentPage('dashboard');
    showSuccess('You have been logged out.');
  };

  const handleRefreshProfile = async () => {
    if (currentUser) {
      try {
        const prof = await fetchUserProfile(currentUser.id);
        setUserProfile(prof);
      } catch (err) {
        console.error('Failed to refresh profile:', err);
      }
    }
  };

  // Topbar quick search
  const handleQuickSearch = (query: string) => {
    const q = query.trim().toUpperCase();
    if (/^[TF]-?[0-9]{2}$/.test(q)) {
      setPrefillCheckOutVehicle(q);
      setCurrentPage('checkout');
    } else {
      setPrefillFinderQuery(q);
      setCurrentPage('finder');
    }
  };

  // Customer display route has no login, no sidebar, no navigation
  if (isCustomerDisplayRoute) {
    return <CustomerDisplay />;
  }

  // If loading auth initially
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#F7F7F6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#9FE870] flex items-center justify-center font-bold text-[#163300]">
            P
          </div>
          <span className="text-xs font-semibold text-[#6B6B6B]">Connecting to CPVTS Database...</span>
        </div>
      </div>
    );
  }

  // If not authenticated
  if (!currentUser || !userProfile) {
    if (authView === 'register') {
      return (
        <Register
          onGoToLogin={() => setAuthView('login')}
          onOpenCompleteRegistration={(prefill) => {
            setCompleteRegPrefill(prefill);
            setAuthView('complete_registration');
          }}
        />
      );
    }

    if (authView === 'complete_registration') {
      return (
        <CompleteRegistration
          initialValues={completeRegPrefill}
          onCompleted={() => setAuthView('login')}
          onSignOut={handleLogout}
        />
      );
    }

    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onGoToRegister={() => setAuthView('register')}
        onOpenCompleteRegistration={(_user, prefill) => {
          setCompleteRegPrefill({
            fullName: prefill?.full_name,
            username: prefill?.username,
            role: prefill?.role,
            gateType: prefill?.gate_type,
            gateName: prefill?.gate_name,
          });
          setAuthView('complete_registration');
        }}
        onOpenConfigNotice={() => setIsConfigOpen(true)}
      />
    );
  }

  // Page titles
  const pageTitles: Record<NavPage, string> = {
    dashboard: 'Dashboard Overview',
    checkin: 'Vehicle Gate Check-In',
    checkout: 'Vehicle Gate Check-Out',
    slots: 'Visual Slot Allocations',
    // --- VIP RESERVATION FEATURE START ---
    vip_reserve: 'Fast-Track VIP Reservations',
    // --- VIP RESERVATION FEATURE END ---
    finder: 'Campus Vehicle Finder',
    history: 'Session History & Audit',
    tariffs: 'Tariff Matrix & Rates',
    settings: 'Payment & Gateway Settings',
  };

  return (
    <div className="flex min-h-screen bg-[#F7F7F6] text-[#1A1A1A]">
      {/* Fixed 260px Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          setPrefillCheckInSlot('');
          setPrefillCheckOutVehicle('');
          setPrefillFinderQuery('');
          setCurrentPage(page);
        }}
        onLogout={handleLogout}
        onOpenHelp={() => setIsHelpOpen(true)}
        profile={userProfile}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={pageTitles[currentPage]}
          onQuickSearch={handleQuickSearch}
          profile={userProfile}
          onOpenProfile={() => setIsProfileOpen(true)}
        />

        <main className="flex-1 pb-16">
          {currentPage === 'dashboard' && (
            <Dashboard
              profile={userProfile}
              onNavigateToCheckIn={() => setCurrentPage('checkin')}
              onNavigateToCheckOut={(vehicle) => {
                if (vehicle) setPrefillCheckOutVehicle(vehicle);
                setCurrentPage('checkout');
              }}
              onNavigateToSlots={() => setCurrentPage('slots')}
            />
          )}

          {currentPage === 'checkin' && (
            <CheckIn
              initialSlotId={prefillCheckInSlot}
              onNavigateToDashboard={() => setCurrentPage('dashboard')}
            />
          )}

          {currentPage === 'checkout' && (
            <CheckOut
              initialQuery={prefillCheckOutVehicle}
              onNavigateToDashboard={() => setCurrentPage('dashboard')}
            />
          )}

          {currentPage === 'slots' && (
            <Slots
              onCheckInAtSlot={(slotId) => {
                setPrefillCheckInSlot(slotId);
                setCurrentPage('checkin');
              }}
              onCheckOutVehicle={(vehicle) => {
                setPrefillCheckOutVehicle(vehicle);
                setCurrentPage('checkout');
              }}
            />
          )}

          {/* --- VIP RESERVATION FEATURE START --- */}
          {currentPage === 'vip_reserve' && (
            <VIPReservations profile={userProfile} />
          )}
          {/* --- VIP RESERVATION FEATURE END --- */}

          {currentPage === 'finder' && (
            <VehicleFinder
              initialSearchQuery={prefillFinderQuery}
              onNavigateToCheckOut={(vehicle) => {
                if (vehicle) setPrefillCheckOutVehicle(vehicle);
                setCurrentPage('checkout');
              }}
            />
          )}

          {currentPage === 'history' && <History />}

          {currentPage === 'tariffs' && (
            <Tariffs
              profile={userProfile}
              onRefreshProfile={handleRefreshProfile}
            />
          )}

          {currentPage === 'settings' && (
            <Settings profile={userProfile} />
          )}
        </main>
      </div>

      {/* Operator Profile Details Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={userProfile}
        onLogout={handleLogout}
        onRefreshProfile={handleRefreshProfile}
      />

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Supabase Configuration Modal */}
      {isConfigOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsConfigOpen(false)}
          title="Supabase Database Configuration"
          maxWidth="2xl"
        >
          <ConfigNotice
            isModal={true}
            onCloseModal={() => setIsConfigOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
