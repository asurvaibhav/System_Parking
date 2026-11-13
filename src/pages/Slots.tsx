import React, { useState, useEffect } from 'react';
import { Bike, Car, ArrowRight, LogIn, LogOut, Clock, X, RefreshCw, QrCode } from 'lucide-react';
import { Slot, ParkingSession } from '../types';
import { fetchSlots, fetchActiveSessions, subscribeToRealtime } from '../lib/api';
import {
  formatVehicleNumber,
  formatDateTimeIST,
  formatDuration,
} from '../lib/format';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs, TabItem } from '../components/ui/Tabs';
import { SlotGrid } from '../components/SlotGrid';
import { Pill, PillVariant } from '../components/ui/Pill';
import { Modal } from '../components/ui/Modal';
import { Ticket } from '../components/Ticket';

interface SlotsProps {
  onCheckInAtSlot: (slotId: string) => void;
  onCheckOutVehicle: (vehicleNumber: string) => void;
}

export const Slots: React.FC<SlotsProps> = ({
  onCheckInAtSlot,
  onCheckOutVehicle,
}) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [activeSessions, setActiveSessions] = useState<ParkingSession[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [viewingTicketSession, setViewingTicketSession] = useState<ParkingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  const loadData = async () => {
    try {
      const [slotsData, sessionsData] = await Promise.all([
        fetchSlots(),
        fetchActiveSessions(),
      ]);
      setSlots(slotsData);
      setActiveSessions(sessionsData);
    } catch (err) {
      console.error('Failed to load slots data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToRealtime(
      () => loadData(),
      () => loadData()
    );

    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 30000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  // Compute counts
  const twoSlots = slots.filter((s) => s.vehicle_type === 'two_wheeler');
  const fourSlots = slots.filter((s) => s.vehicle_type === 'four_wheeler');

  const twoAvail = twoSlots.filter((s) => s.status === 'available').length;
  const fourAvail = fourSlots.filter((s) => s.status === 'available').length;

  const tabs: TabItem[] = [
    { id: 'all', label: 'All Slots', count: slots.length },
    { id: 'two_wheeler', label: 'Two-Wheeler (T-01..T-50)', count: twoAvail },
    { id: 'four_wheeler', label: 'Four-Wheeler (F-01..F-50)', count: fourAvail },
  ];

  // Active session for selected slot if occupied
  const selectedSession = selectedSlot
    ? activeSessions.find(
        (s) => s.slot_id === selectedSlot.id || s.slot_code === selectedSlot.slot_code
      )
    : null;

  const getPillVariant = (cat: string): PillVariant => {
    if (cat === 'staff') return 'purple';
    if (cat === 'student') return 'info';
    return 'warning';
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#163300] tracking-tight">
            Campus Slot Visual Grid
          </h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5">
            Real-time status for all 100 parking spots across Two-Wheeler and Four-Wheeler zones
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 p-2 bg-white rounded-xl border border-[#ECECEC] text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border-2 border-[#9FE870] bg-white inline-block" />
            <span className="font-semibold text-[#163300]">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border border-[#C4C4C4] bg-[#E0E0DF] inline-block" />
            <span className="font-medium text-[#6B6B6B]">Occupied</span>
          </div>
          <div className="h-4 w-[1px] bg-[#ECECEC]" />
          <Button
            size="sm"
            variant="ghost"
            onClick={loadData}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync
          </Button>
        </div>
      </div>

      {/* Zone Overview Mini-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#ECECEC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF9DD] text-[#163300] flex items-center justify-center">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#6B6B6B]">Two-Wheeler Zone</div>
              <div className="text-lg font-bold text-[#163300] tabular-nums">
                {twoAvail} Available <span className="text-xs text-[#8C8C8C] font-normal">/ {twoSlots.length} Total</span>
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F7F7F6] text-[#555555]">
            T-01..T-50
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#ECECEC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F2F2F0] text-[#163300] flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#6B6B6B]">Four-Wheeler Zone</div>
              <div className="text-lg font-bold text-[#163300] tabular-nums">
                {fourAvail} Available <span className="text-xs text-[#8C8C8C] font-normal">/ {fourSlots.length} Total</span>
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F7F7F6] text-[#555555]">
            F-01..F-50
          </span>
        </div>
      </div>

      {/* Main Slots Card */}
      <Card>
        {/* Tabs */}
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id)}
          className="mb-6"
        />

        {/* Slot Tiles */}
        <SlotGrid
          slots={slots}
          activeSessions={activeSessions}
          filterType={activeTab as 'all' | 'two_wheeler' | 'four_wheeler'}
          interactiveMode="details"
          selectedSlotId={selectedSlot?.id}
          onSelectSlot={(slot) => setSelectedSlot(slot)}
        />
      </Card>

      {/* Side Drawer / Modal for selected slot details */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
          <div
            className="fixed inset-0"
            onClick={() => setSelectedSlot(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-[20px] shadow-2xl border border-[#ECECEC] p-6 z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#F2F2F0] mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-lg font-bold text-[#163300] bg-[#EAF9DD] px-2.5 py-0.5 rounded-lg font-mono">
                  {selectedSlot.slot_code}
                </span>
                <span className="text-xs font-semibold text-[#6B6B6B]">
                  {selectedSlot.vehicle_type === 'two_wheeler' ? 'Two-Wheeler Slot' : 'Four-Wheeler Slot'}
                </span>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#6B6B6B] hover:bg-[#F2F2F0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedSlot.status === 'occupied' && selectedSession ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-[#F7F7F6] border border-[#ECECEC] space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#6B6B6B]">Vehicle Number:</span>
                    <span className="font-bold text-[#163300] font-mono text-sm">
                      {formatVehicleNumber(selectedSession.vehicle_number)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#6B6B6B]">Category:</span>
                    <Pill variant={getPillVariant(selectedSession.owner_category)} size="sm">
                      {selectedSession.owner_category.toUpperCase()}
                    </Pill>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#6B6B6B]">Ticket Number:</span>
                    <span className="font-mono text-[#555555]">{selectedSession.ticket_no}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#6B6B6B]">Server Entry Time:</span>
                    <span className="font-medium text-[#1A1A1A] tabular-nums">
                      {formatDateTimeIST(selectedSession.entry_time)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#6B6B6B]">Running Duration:</span>
                    <span className="font-bold text-[#163300] tabular-nums">
                      {formatDuration(
                        Math.floor(
                          Math.max(0, nowTimestamp - new Date(selectedSession.entry_time).getTime()) /
                            (60 * 1000)
                        )
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setViewingTicketSession(selectedSession);
                    }}
                    className="text-xs text-[#163300] hover:bg-[#EAF9DD]"
                    icon={<QrCode className="w-4 h-4 text-[#163300]" />}
                  >
                    Ticket &amp; QR
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedSlot(null)}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setSelectedSlot(null);
                      onCheckOutVehicle(selectedSession.vehicle_number);
                    }}
                    icon={<LogOut className="w-4 h-4 text-[#163300]" />}
                  >
                    Go to Check-Out
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#F2FBF5] border border-[#D1F2DE] text-xs text-[#126635]">
                  <p className="font-semibold text-sm">Slot is Available</p>
                  <p className="mt-1">
                    Spot {selectedSlot.slot_code} is currently vacant and ready for new vehicle check-in.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setSelectedSlot(null)}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setSelectedSlot(null);
                      onCheckInAtSlot(selectedSlot.id);
                    }}
                    icon={<LogIn className="w-4 h-4" />}
                  >
                    Check-In Here
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ticket & QR Code Modal */}
      {viewingTicketSession && (
        <Modal
          isOpen={true}
          onClose={() => setViewingTicketSession(null)}
          title="Vehicle Parking Ticket & QR Code"
          maxWidth="md"
        >
          <div className="py-2">
            <Ticket
              ticket={viewingTicketSession}
              onNewAction={() => setViewingTicketSession(null)}
              newActionLabel="Close Ticket"
              isModal
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
