import React, { useState, useEffect, useMemo } from 'react';
import {
  DisplayReceiver,
  DisplayMessage,
  ShowMessagePayload,
  PaidMessagePayload,
  IdleMessagePayload,
} from '../lib/displaySync';
import { formatVehicleNumber } from '../lib/format';
import { CheckCircle2, QrCode, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

export const CustomerDisplay: React.FC = () => {
  // Read code from URL hash (e.g., #/display?code=ABC234XYZ9)
  const [code, setCode] = useState<string>(() => {
    const hash = window.location.hash;
    const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(queryStr);
    return (params.get('code') || '').toUpperCase().trim();
  });

  const [inputCode, setInputCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [viewState, setViewState] = useState<'idle' | 'show' | 'paid'>('idle');

  // Payload states
  const [showData, setShowData] = useState<ShowMessagePayload | null>(null);
  const [paidData, setPaidData] = useState<PaidMessagePayload | null>(null);
  const [ratesText, setRatesText] = useState<string>(
    'Two-Wheeler: ₹10/hr (First 2 hrs free for students) • Four-Wheeler: ₹20/hr • Campus Staff: Free'
  );

  // Live IST Clock
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      try {
        const istString = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(new Date());
        setCurrentTime(istString);
      } catch {
        setCurrentTime(new Date().toLocaleTimeString());
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
      const params = new URLSearchParams(queryStr);
      const newCode = (params.get('code') || '').toUpperCase().trim();
      if (newCode !== code) {
        setCode(newCode);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [code]);

  // Connect Display Receiver when valid code is available
  useEffect(() => {
    if (!code || code.length !== 10) return;

    let paidTimeout: any = null;

    const receiver = new DisplayReceiver(
      code,
      (msg: DisplayMessage) => {
        if (paidTimeout) clearTimeout(paidTimeout);

        if (msg.type === 'show') {
          setShowData(msg);
          setViewState('show');
        } else if (msg.type === 'paid') {
          setPaidData(msg);
          setViewState('paid');
          // Automatically return to idle after 6 seconds per spec
          paidTimeout = setTimeout(() => {
            setViewState('idle');
            setShowData(null);
            setPaidData(null);
          }, 6000);
        } else if (msg.type === 'idle') {
          if (msg.rates_text) {
            setRatesText(msg.rates_text);
          }
          setViewState('idle');
          setShowData(null);
          setPaidData(null);
        }
      },
      (connected) => {
        setIsConnected(connected);
      }
    );

    return () => {
      if (paidTimeout) clearTimeout(paidTimeout);
      receiver.destroy();
    };
  }, [code]);

  // Countdown for active QR code in SHOW view
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    if (viewState !== 'show' || !showData?.expires_at) return;

    const tick = () => {
      const diff = Math.max(0, Math.floor((showData.expires_at - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [viewState, showData]);

  const countdownText = useMemo(() => {
    const m = Math.floor(secondsRemaining / 60);
    const s = secondsRemaining % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, [secondsRemaining]);

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (clean.length === 10) {
      window.location.hash = `#/display?code=${clean}`;
      setCode(clean);
    }
  };

  // If code is missing: Show pairing screen
  if (!code || code.length !== 10) {
    return (
      <div className="min-h-screen bg-[#F7F7F6] text-[#163300] flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-[#E5E5E5] shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#9FE870] mx-auto flex items-center justify-center shadow-sm">
            <QrCode className="w-8 h-8 text-[#163300]" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-[#163300] tracking-tight">
              Customer Payment Display
            </h1>
            <p className="text-xs text-[#6B6B6B] mt-1">
              Enter the 10-character code displayed on the Gate Cabin Terminal
            </p>
          </div>

          <form onSubmit={handlePairSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                autoFocus
                maxLength={10}
                placeholder="XXXXXXXXXX"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                className="w-full text-center text-2xl font-mono font-black tracking-widest uppercase bg-[#F7F7F6] border-2 border-[#D0D0CE] focus:border-[#163300] focus:bg-white rounded-2xl py-3 px-4 outline-none transition-all text-[#163300]"
              />
              <span className="text-[11px] text-[#8C8C8C] mt-1.5 block">
                Found on the Gate Operator check-out header chip
              </span>
            </div>

            <button
              type="submit"
              disabled={inputCode.trim().length !== 10}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#163300] text-[#9FE870] font-bold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-[#1f4500] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer"
            >
              <span>Connect Display</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-[#F0F0EE] text-[11px] text-[#888888]">
            AMBIT Codethon 2026 · BIT Belagavi Gate Cabin System
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F6] text-[#1A1A1A] flex flex-col justify-between p-8 sm:p-12 relative overflow-hidden select-none font-sans">
      {/* Corner Status Dot */}
      <div className="absolute top-6 right-6 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#ECECEC] shadow-sm z-50">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isConnected ? 'bg-[#22C55E] animate-pulse' : 'bg-[#F59E0B] animate-ping'
          }`}
        />
        <span className="text-xs font-semibold text-[#4A4A4A]">
          {isConnected ? 'Display Connected' : 'Reconnecting...'}
        </span>
        <span className="text-[10px] font-mono text-[#8C8C8C] border-l border-[#ECECEC] pl-2">
          {code}
        </span>
      </div>

      {/* Top Header Bar */}
      <header className="flex items-center justify-between pb-6 border-b border-[#E5E5E3]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#9FE870] flex items-center justify-center shadow-sm">
            <div className="w-7 h-7 flex flex-wrap items-center justify-center gap-1">
              <div className="w-3 h-3 rounded-xs bg-[#163300]" />
              <div className="w-3 h-3 rounded-xs bg-[#163300]" />
              <div className="w-3 h-3 rounded-xs bg-[#163300]" />
              <div className="w-3 h-3 rounded-xs bg-[#163300]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#163300] tracking-tight">
              CAMPUS PARKING
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#558030] tracking-wide uppercase">
              Security Gate Terminal &bull; CPVTS
            </p>
          </div>
        </div>

        {/* Live IST Clock */}
        <div className="text-right">
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#163300] tabular-nums flex items-center gap-2 justify-end">
            <Clock className="w-5 h-5 text-[#558030]" />
            <span>{currentTime}</span>
          </div>
          <span className="text-[11px] font-semibold text-[#6B6B6B] uppercase tracking-wider">
            Indian Standard Time (IST)
          </span>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 flex items-center justify-center my-6">
        {/* 1. IDLE STATE */}
        {viewState === 'idle' && (
          <div className="w-full max-w-4xl text-center space-y-10 animate-in fade-in zoom-in-95 duration-300">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EAF9DD] border border-[#C5EBA6] text-[#163300] text-sm font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-[#163300]" />
                <span>Authorized Campus Parking Area</span>
              </div>
              <h2 className="text-5xl sm:text-6xl font-black text-[#163300] tracking-tight">
                Welcome to Campus Parking
              </h2>
              <p className="text-lg sm:text-xl text-[#6B6B6B] max-w-2xl mx-auto font-medium">
                Please proceed to the gate barrier. Have your parking pass or vehicle registration ready for exit clearance.
              </p>
            </div>

            {/* Parking Rates Strip */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E5E3] shadow-md max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-widest text-[#8C8C8C] block">
                Standard Tariff Matrix
              </span>
              <p className="text-base sm:text-lg font-semibold text-[#163300] leading-relaxed">
                {ratesText}
              </p>
            </div>

            <div className="text-xs text-[#8C8C8C] flex items-center justify-center gap-6">
              <span>Drive safe &bull; Max campus speed 20 km/h</span>
              <span>&bull;</span>
              <span>Keep ticket QR safe until gate release</span>
            </div>
          </div>
        )}

        {/* 2. SHOW STATE (UPI QR + PAYMENT DETAILS) */}
        {viewState === 'show' && showData && (
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl p-8 sm:p-12 border-2 border-[#9FE870] shadow-2xl animate-in fade-in duration-200">
            {/* Left Column: QR Code & Countdown */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center text-center space-y-5">
              {/* QR Image Container (at least 360px with crisp white margin) */}
              <div className="p-4 bg-white rounded-3xl border-4 border-[#9FE870] shadow-xl relative">
                <img
                  src={showData.qr_data_url}
                  alt="UPI Payment QR Code"
                  className="w-[360px] h-[360px] sm:w-[380px] sm:h-[380px] object-contain rounded-xl"
                />
              </div>

              {/* Supported apps */}
              <p className="text-xs sm:text-sm font-bold text-[#163300] tracking-wide">
                Scan with Google Pay, PhonePe, Paytm or any UPI app
              </p>

              {/* Countdown banner */}
              {secondsRemaining > 0 ? (
                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#FFFDF5] border border-[#FEE6A8] text-[#8C5200] text-sm font-bold shadow-xs">
                  <Clock className="w-4 h-4 text-[#E58300] animate-pulse" />
                  <span>QR valid for {countdownText}</span>
                </div>
              ) : (
                <div className="px-5 py-2.5 rounded-2xl bg-[#FEECEB] border border-[#FECDCA] text-[#D92D20] text-sm font-bold">
                  QR expired. Please ask the guard.
                </div>
              )}
            </div>

            {/* Right Column: Fee & Clearance Details */}
            <div className="lg:col-span-6 space-y-6">
              {/* Big Forest Green Amount */}
              <div className="border-b border-[#F0F0EE] pb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8C8C8C] block mb-1">
                  Parking Amount Due
                </span>
                <div className="text-6xl sm:text-7xl font-black text-[#163300] tabular-nums tracking-tight">
                  ₹{showData.amount.toFixed(2)}
                </div>
                <div className="mt-2 text-xs font-semibold text-[#558030]">
                  Pay to: <span className="font-bold text-[#163300]">{showData.payee_name}</span> ({showData.payee_vpa})
                </div>
              </div>

              {/* Vehicle & Session Details */}
              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="p-4 bg-[#F7F7F6] rounded-2xl border border-[#ECECEC]">
                  <span className="text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider block">
                    Vehicle Number
                  </span>
                  <span className="text-xl sm:text-2xl font-mono font-black text-[#1A1A1A] mt-1 block">
                    {formatVehicleNumber(showData.vehicle_number)}
                  </span>
                </div>

                <div className="p-4 bg-[#F7F7F6] rounded-2xl border border-[#ECECEC]">
                  <span className="text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider block">
                    Ticket Number
                  </span>
                  <span className="text-base sm:text-lg font-mono font-bold text-[#163300] mt-1 block">
                    {showData.ticket_no}
                  </span>
                </div>

                <div className="p-4 bg-[#F7F7F6] rounded-2xl border border-[#ECECEC]">
                  <span className="text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider block">
                    Parked Duration
                  </span>
                  <span className="text-base sm:text-lg font-bold text-[#163300] mt-1 block">
                    {showData.duration_text}
                  </span>
                </div>

                <div className="p-4 bg-[#F7F7F6] rounded-2xl border border-[#ECECEC]">
                  <span className="text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider block">
                    Entry Time
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-[#1A1A1A] mt-1 block">
                    {showData.entry_text}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#EAF9DD] rounded-2xl border border-[#C5EBA6] flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#163300] shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-[#163300]">
                  Once paid, the gate barrier will open and an official receipt will be issued.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. PAID STATE (SUCCESS ANIMATION) */}
        {viewState === 'paid' && paidData && (
          <div className="w-full max-w-2xl bg-white rounded-3xl p-10 sm:p-14 border-4 border-[#9FE870] shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
            {/* Animated Green Checkmark */}
            <div className="w-24 h-24 rounded-full bg-[#EAF9DD] border-4 border-[#9FE870] mx-auto flex items-center justify-center animate-bounce shadow-md">
              <CheckCircle2 className="w-14 h-14 text-[#163300]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-4xl sm:text-5xl font-black text-[#163300] tracking-tight">
                Payment received. Thank you!
              </h2>
              <p className="text-base sm:text-lg font-medium text-[#558030]">
                Exit clearance finalized &bull; Have a safe journey
              </p>
            </div>

            <div className="p-4 bg-[#F7F7F6] rounded-2xl border border-[#ECECEC] inline-block font-mono font-bold text-lg text-[#163300] px-8">
              Ticket #{paidData.ticket_no}
            </div>

            <p className="text-xs text-[#8C8C8C] pt-2">
              Gate barrier releasing &bull; Display returning to idle screen...
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="pt-4 border-t border-[#E5E5E3] flex flex-col sm:flex-row items-center justify-between text-xs text-[#8C8C8C] gap-2">
        <span>AMBIT Codethon 2026 &bull; Department of MCA, BIT Belagavi</span>
        <span>Campus Parking &amp; Vehicle Tracking System (CPVTS)</span>
      </footer>
    </div>
  );
};
