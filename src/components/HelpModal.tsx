import React from 'react';
import { HelpCircle, CheckCircle2, Shield, Clock, FileText, ArrowRight } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunTestScenario?: (scenarioId: number) => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  const scenarios = [
    {
      id: 1,
      title: 'Fresh Database State',
      desc: '100 total slots: 50 Two-Wheeler (T-01..T-50) and 50 Four-Wheeler (F-01..F-50). All start Available.',
    },
    {
      id: 2,
      title: 'Standard Check-In',
      desc: 'Check in KA-22-XY-9876, Two-Wheeler, Student at Slot T-02. Entry time stamped to the second in IST.',
    },
    {
      id: 3,
      title: 'Duplicate Protection',
      desc: 'Attempting to check in an already parked vehicle returns "This vehicle is already parked".',
    },
    {
      id: 4,
      title: 'Slot Race Protection',
      desc: 'If two gates book the same slot simultaneously, the second receives "That slot was just taken...".',
    },
    {
      id: 5,
      title: 'Full Zone Banner',
      desc: 'When all 50 slots in a zone are occupied, screen displays "Parking Full for [Zone]" and blocks booking.',
    },
    {
      id: 6,
      title: 'Student Bike Tariff (4 hours)',
      desc: '120 min free, 120 min charged at ₹10/h = exactly ₹20 fee (matches PDF official specification problem statement).',
    },
    {
      id: 7,
      title: 'Exit Lookup Flexibility',
      desc: 'Guards can check out either by typing vehicle registration or slot code (e.g. T-02).',
    },
    {
      id: 8,
      title: 'Student Bike Durations',
      desc: '5 h = ₹30 · 2 h 30 min = ₹5 · 2 h 10 min = ₹2 · 1 h 50 min = ₹0 (Free grace period).',
    },
    {
      id: 9,
      title: 'Visitor Car (2 h 30 min)',
      desc: 'No free time; 150 min at ₹40/h pro-rata = ceil(150 × 40 / 60) = ₹100.',
    },
    {
      id: 10,
      title: 'Staff Vehicle Immunity',
      desc: 'Any duration for staff is always ₹0, and issued ticket displays "FREE".',
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CPVTS User Manual &amp; Acceptance Tests" maxWidth="xl">
      <div className="space-y-6 text-xs text-[#1A1A1A]">
        {/* Intro */}
        <div className="p-4 rounded-xl bg-[#EAF9DD] border border-[#D8F2C4] text-[#163300]">
          <h4 className="font-bold text-sm">AMBIT Codethon 2026 · BIT Belagavi</h4>
          <p className="mt-1 text-xs text-[#558030]">
            Campus Parking &amp; Vehicle Tracking System. Desktop client designed for gate cabin guards with real-time Supabase PostgreSQL backend integration.
          </p>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="p-3.5 bg-[#F7F7F6] rounded-xl border border-[#ECECEC]">
          <span className="font-bold uppercase tracking-wider text-[#163300] block mb-2">
            Quick Terminal Shortcuts
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-0.5 rounded bg-white border border-[#DDD] font-mono text-[11px]">⌘K / Ctrl+K</kbd>
              <span>Global vehicle/spot search</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-0.5 rounded bg-white border border-[#DDD] font-mono text-[11px]">Enter</kbd>
              <span>Submit forms &amp; searches</span>
            </div>
          </div>
        </div>

        {/* 10 Acceptance Test Scenarios */}
        <div>
          <h4 className="font-bold text-sm text-[#163300] mb-3">
            Acceptance Test Cases (Section 10 Verification)
          </h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {scenarios.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-white border border-[#ECECEC] hover:border-[#9FE870] transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-[#163300]">
                  <span className="w-5 h-5 rounded-full bg-[#EAF9DD] flex items-center justify-center text-[10px]">
                    {s.id}
                  </span>
                  <span>{s.title}</span>
                </div>
                <p className="text-[#6B6B6B] mt-1 pl-7 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Got it, Return to Terminal
          </Button>
        </div>
      </div>
    </Modal>
  );
};
