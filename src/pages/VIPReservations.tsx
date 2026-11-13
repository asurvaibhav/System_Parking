// --- VIP RESERVATION FEATURE START ---
import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  Bike,
  Car,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Info,
} from 'lucide-react';
import { Slot, ParkingSession, Profile } from '../types';
import {
  fetchSlots,
  fetchActiveSessions,
  reserveSlotApi,
  unreserveSlotApi,
  subscribeToRealtime,
} from '../lib/api';
import { formatVehicleNumber, formatDateTimeIST } from '../lib/format';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs, TabItem } from '../components/ui/Tabs';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

interface VIPReservationsProps {
  profile?: Profile | null;
}

export const VIPReservations: React.FC<VIPReservationsProps> = ({ profile }) => {
  const { showSuccess, showError } = useToast();

  const [slots, setSlots] = useState<Slot[]>([]);
  const [activeSessions, setActiveSessions] = useState<ParkingSession[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal state for reserving or unreserving
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reservationReason, setReservationReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [slotsData, sessionsData] = await Promise.all([
        fetchSlots(),
        fetchActiveSessions(),
      ]);
      setSlots(slotsData);
      setActiveSessions(sessionsData);
    } catch (err) {
      console.error('Failed to load slots for VIP reservations', err);
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
    return () => unsub();
  }, []);

  const twoSlots = slots.filter((s) => s.vehicle_type === 'two_wheeler');
  const fourSlots = slots.filter((s) => s.vehicle_type === 'four_wheeler');

  const twoAvail = twoSlots.filter((s) => s.status === 'available').length;
  const fourAvail = fourSlots.filter((s) => s.status === 'available').length;
  const twoReserved = twoSlots.filter((s) => s.status === 'reserved').length;
  const fourReserved = fourSlots.filter((s) => s.status === 'reserved').length;

  const filteredSlots = slots.filter((s) => {
    if (activeTab === 'all') return true;
    return s.vehicle_type === activeTab;
  });

  const sessionBySlotCode = new Map<string, ParkingSession>();
  activeSessions.forEach((s) => {
    if (s.slot_code) sessionBySlotCode.set(s.slot_code, s);
    if (s.slot_id) sessionBySlotCode.set(s.slot_id, s);
  });

  const handleSlotClick = (slot: Slot) => {
    setSelectedSlot(slot);
    setReservationReason(slot.reserved_reason || 'VIP Guest / Emergency Reservation');
    setIsModalOpen(true);
  };

  const handleConfirmReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setIsSubmitting(true);
    try {
      await reserveSlotApi(
        selectedSlot.slot_code,
        reservationReason.trim() || 'VIP / Emergency Reservation',
        profile?.full_name || 'Security Guard'
      );
      showSuccess(`Slot ${selectedSlot.slot_code} successfully marked as Reserved (VIP).`);
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      showError('Failed to reserve slot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmUnreserve = async () => {
    if (!selectedSlot) return;

    setIsSubmitting(true);
    try {
      await unreserveSlotApi(selectedSlot.slot_code);
      showSuccess(`Slot ${selectedSlot.slot_code} has been unlocked and made available again.`);
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      showError('Failed to unreserve slot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[#EAF9DD] text-[#163300] text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#1F9D55]" /> Fast-Track VIP Extension
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#163300] tracking-tight">
            Reserve VIP Slot
          </h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5">
            Lock specific parking slots for VIPs or emergency vehicles. Reserved slots are strictly excluded from regular auto-assignment.
          </p>
        </div>

        <div className="flex items-center gap-4 p-2 bg-white rounded-xl border border-[#ECECEC] text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border border-[#9FE870] bg-white inline-block" />
            <span className="font-semibold text-[#163300]">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#9333EA] inline-block" />
            <span className="font-semibold text-[#6B6B6B]">VIP Reserved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#E0E0DF] inline-block" />
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#ECECEC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF9DD] text-[#163300] flex items-center justify-center">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#6B6B6B]">Two-Wheeler Zone (T)</div>
              <div className="text-lg font-bold text-[#163300] tabular-nums">
                {twoReserved} VIP Reserved <span className="text-xs text-[#8C8C8C] font-normal">/ {twoAvail} Free</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#ECECEC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF9DD] text-[#163300] flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#6B6B6B]">Four-Wheeler Zone (F)</div>
              <div className="text-lg font-bold text-[#163300] tabular-nums">
                {fourReserved} VIP Reserved <span className="text-xs text-[#8C8C8C] font-normal">/ {fourAvail} Free</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Tabs */}
      <div className="flex border-b border-[#ECECEC] gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'all'
              ? 'border-[#163300] text-[#163300] font-bold'
              : 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
          }`}
        >
          All Slots ({slots.length})
        </button>
        <button
          onClick={() => setActiveTab('two_wheeler')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'two_wheeler'
              ? 'border-[#163300] text-[#163300] font-bold'
              : 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
          }`}
        >
          Two-Wheeler Zone T-01..T-50 ({twoSlots.length})
        </button>
        <button
          onClick={() => setActiveTab('four_wheeler')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'four_wheeler'
              ? 'border-[#163300] text-[#163300] font-bold'
              : 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
          }`}
        >
          Four-Wheeler Zone F-01..F-50 ({fourSlots.length})
        </button>
      </div>

      {/* Slot Grid */}
      <Card className="p-6">
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5">
          {filteredSlots.map((slot) => {
            const isOccupied = slot.status === 'occupied';
            const isReserved = slot.status === 'reserved';
            const session = sessionBySlotCode.get(slot.slot_code) || sessionBySlotCode.get(slot.id);

            let tileStyle = '';
            if (isOccupied) {
              tileStyle = 'bg-[#ECECEB] border border-[#DCDCDC] text-[#666666] opacity-90 cursor-not-allowed';
            } else if (isReserved) {
              tileStyle = 'bg-[#FAF5FF] border-2 border-[#9333EA] text-[#6B21A8] font-bold shadow-xs hover:bg-[#F3E8FF] cursor-pointer';
            } else {
              tileStyle = 'bg-white border-1.5 border-[#9FE870] hover:border-[#7ecf49] hover:bg-[#F4FCEF] text-[#163300] font-semibold cursor-pointer';
            }

            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleSlotClick(slot)}
                className={`h-16 rounded-xl p-1 flex flex-col items-center justify-center transition-all text-xs relative select-none ${tileStyle}`}
              >
                <div className="flex items-center gap-0.5">
                  <span className="font-bold text-[13px] tracking-tight">{slot.slot_code}</span>
                  {isReserved && <Shield className="w-3 h-3 text-[#9333EA]" />}
                </div>
                {isOccupied ? (
                  <span className="text-[9px] font-semibold text-[#666666] tracking-tighter truncate max-w-full px-1 mt-0.5">
                    {session ? formatVehicleNumber(session.vehicle_number) : 'OCCUPIED'}
                  </span>
                ) : isReserved ? (
                  <span className="text-[9px] uppercase text-[#9333EA] font-extrabold tracking-wider mt-0.5">
                    VIP LOCK
                  </span>
                ) : (
                  <span className="text-[9px] uppercase text-[#1F9D55] font-semibold tracking-wider mt-0.5">
                    FREE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Reservation Modal */}
      {isModalOpen && selectedSlot && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`VIP Reservation Manager · Slot ${selectedSlot.slot_code}`}
          maxWidth="md"
        >
          <div className="space-y-5">
            <div className="p-3.5 rounded-xl bg-[#F7F7F6] border border-[#ECECEC] text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[#6B6B6B] font-medium">Slot Code:</span>
                <span className="font-bold font-mono text-[#163300]">{selectedSlot.slot_code}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6B6B6B] font-medium">Zone Type:</span>
                <span className="font-semibold capitalize text-[#1A1A1A]">
                  {selectedSlot.vehicle_type.replace('_', '-')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6B6B6B] font-medium">Current Status:</span>
                <span
                  className={`font-bold uppercase text-[11px] px-2 py-0.5 rounded ${
                    selectedSlot.status === 'reserved'
                      ? 'bg-[#F3E8FF] text-[#7E22CE]'
                      : selectedSlot.status === 'occupied'
                      ? 'bg-[#FEECEB] text-[#D92D20]'
                      : 'bg-[#EAF9DD] text-[#1F9D55]'
                  }`}
                >
                  {selectedSlot.status}
                </span>
              </div>
            </div>

            {selectedSlot.status === 'occupied' ? (
              <div className="p-4 bg-[#FEECEB] border border-[#FCD5D2] rounded-xl text-xs text-[#9A1E15] flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm mb-0.5">Slot Currently Occupied</span>
                  This slot is occupied by an active vehicle session. It cannot be reserved as VIP until the vehicle completes check-out.
                </div>
              </div>
            ) : selectedSlot.status === 'reserved' ? (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-[#FAF5FF] border border-[#E9D5FF] text-xs text-[#6B21A8] space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-sm mb-1">
                    <Shield className="w-4 h-4 text-[#9333EA]" /> Active VIP Reservation
                  </div>
                  <div><strong className="font-medium">Reason:</strong> {selectedSlot.reserved_reason || 'VIP / Emergency Reservation'}</div>
                  {selectedSlot.reserved_at && (
                    <div><strong className="font-medium">Reserved At:</strong> {formatDateTimeIST(selectedSlot.reserved_at)}</div>
                  )}
                  {selectedSlot.reserved_by && (
                    <div><strong className="font-medium">Reserved By:</strong> {selectedSlot.reserved_by}</div>
                  )}
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>Unreserving this slot will unlock it and make it immediately available for regular auto-assignment during check-ins.</span>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleConfirmUnreserve}
                    disabled={isSubmitting}
                    icon={<Unlock className="w-4 h-4" />}
                  >
                    {isSubmitting ? 'Unreserving...' : 'Unreserve & Unlock Slot'}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmReserve} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                    VIP Reservation Reason / Notes
                  </label>
                  <input
                    type="text"
                    required
                    value={reservationReason}
                    onChange={(e) => setReservationReason(e.target.value)}
                    placeholder="e.g. VIP Guest Visit, Medical Emergency, Rector Reserved"
                    className="w-full text-xs font-medium bg-[#F7F7F6] border border-[#ECECEC] rounded-xl px-3.5 py-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#9333EA] focus:bg-white"
                  />
                  <p className="text-[11px] text-[#8C8C8C] mt-1.5">
                    Locking this slot will strictly exclude it from the regular vehicle auto-assignment algorithm.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#9333EA] hover:bg-[#7E22CE] text-white"
                    icon={<Lock className="w-4 h-4" />}
                  >
                    {isSubmitting ? 'Locking...' : 'Lock & Reserve VIP Slot'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
// --- VIP RESERVATION FEATURE END ---
