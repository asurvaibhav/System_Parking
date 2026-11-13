import React, { useState, useEffect, useMemo } from 'react';
import {
  Bike,
  Car,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  LayoutDashboard,
} from 'lucide-react';
import { VehicleType, OwnerCategory, Slot, Tariff, ParkingSession } from '../types';
import {
  fetchSlots,
  fetchTariffs,
  checkIn,
  fetchActiveSessions,
  subscribeToRealtime,
} from '../lib/api';
import {
  normalizeVehicleNumber,
  isValidVehicleNumber,
  formatVehicleNumber,
  formatDateTimeIST,
} from '../lib/format';
import { parseSupabaseError } from '../lib/errors';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SlotGrid } from '../components/SlotGrid';
import { Ticket } from '../components/Ticket';
import { useToast } from '../components/ui/Toast';

interface CheckInProps {
  initialSlotId?: string;
  onNavigateToDashboard: () => void;
}

export const CheckIn: React.FC<CheckInProps> = ({
  initialSlotId,
  onNavigateToDashboard,
}) => {
  const { showError, showSuccess } = useToast();

  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('two_wheeler');
  const [ownerCategory, setOwnerCategory] = useState<OwnerCategory>('student');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [activeSessions, setActiveSessions] = useState<ParkingSession[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success state after booking
  const [completedSession, setCompletedSession] = useState<ParkingSession | null>(null);

  // Load slots and tariffs
  const loadData = async () => {
    try {
      const [allSlots, allTariffs, active] = await Promise.all([
        fetchSlots(),
        fetchTariffs(),
        fetchActiveSessions(),
      ]);
      setSlots(allSlots);
      setTariffs(allTariffs);
      setActiveSessions(active);

      // Handle initialSlotId if passed
      if (initialSlotId) {
        const found = allSlots.find((s) => s.id === initialSlotId || s.slot_code === initialSlotId);
        if (found && found.status === 'available') {
          setSelectedSlot(found);
          setVehicleType(found.vehicle_type);
        }
      }
    } catch (err) {
      console.error('Failed to load slots for check-in', err);
    } finally {
      setIsLoadingSlots(false);
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

  // When vehicle type changes, verify or clear selected slot if mismatch
  const handleVehicleTypeChange = (type: VehicleType) => {
    setVehicleType(type);
    if (selectedSlot && selectedSlot.vehicle_type !== type) {
      setSelectedSlot(null);
    }
  };

  // Filter slots for current zone
  const zoneSlots = useMemo(() => {
    return slots.filter((s) => s.vehicle_type === vehicleType);
  }, [slots, vehicleType]);

  const availableZoneSlots = useMemo(() => {
    return zoneSlots.filter((s) => s.status === 'available');
  }, [zoneSlots]);

  const isZoneFull = zoneSlots.length > 0 && availableZoneSlots.length === 0;

  // Normalized and validation state
  const normalizedNumber = normalizeVehicleNumber(vehicleNumber);
  const isValidNumber = isValidVehicleNumber(normalizedNumber);
  const formattedPreview = formatVehicleNumber(vehicleNumber);

  // Dynamic tariff hint
  const currentTariffHint = useMemo(() => {
    if (ownerCategory === 'staff') {
      return 'Staff: Parking is completely FREE';
    }
    const t = tariffs.find(
      (item) => item.owner_category === ownerCategory && item.vehicle_type === vehicleType
    );
    if (!t) return '';

    if (ownerCategory === 'student') {
      const freeH = t.free_minutes / 60;
      return `Student: First ${freeH} hours free, then ₹${t.rate_per_hour}/hour (charged per minute)`;
    }
    if (ownerCategory === 'visitor') {
      return `Visitor: ₹${t.rate_per_hour}/hour, no free time (charged per minute)`;
    }
    return '';
  }, [tariffs, ownerCategory, vehicleType]);

  // Pick first available slot helper
  const handlePickFirstAvailable = () => {
    if (availableZoneSlots.length > 0) {
      setSelectedSlot(availableZoneSlots[0]);
    }
  };

  // Submit check-in
  const handleConfirmCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidNumber) {
      showError('Enter a valid vehicle number, e.g. KA-22-AB-1234');
      return;
    }
    if (!selectedSlot) {
      showError('Please select an available parking slot');
      return;
    }

    setIsSubmitting(true);
    try {
      const newSession = await checkIn(
        normalizedNumber,
        vehicleType,
        ownerCategory,
        selectedSlot.id
      );
      setCompletedSession(newSession);
      showSuccess(`Vehicle ${formatVehicleNumber(normalizedNumber)} successfully checked in! ✓ Saved to database`);
      // Reload slots
      await loadData();
    } catch (err) {
      const parsed = parseSupabaseError(err);
      showError(parsed.message);
      if (parsed.shouldRefreshSlots) {
        setSelectedSlot(null);
        await loadData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setVehicleNumber('');
    setSelectedSlot(null);
    setCompletedSession(null);
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-[#163300] tracking-tight">
          Gate Check-In
        </h2>
        <p className="text-xs text-[#6B6B6B] mt-0.5">
          Issue entry ticket and allocate a designated zone slot
        </p>
      </div>

      {completedSession ? (
        /* Success Confirmation Panel with Live QR Code Ticket */
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF9DD] border border-[#C5EBA6] text-[#163300] text-xs font-bold uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-4 h-4 text-[#1F9D55]" />
              <span>Check-In Successful · Spot Allocated</span>
              <span className="text-[#1F9D55] font-extrabold flex items-center gap-0.5">
                ✓ Saved to database
              </span>
            </div>

            <h3 className="text-2xl font-bold text-[#163300] tracking-tight">
              Vehicle {formatVehicleNumber(completedSession.vehicle_number)} Checked In
            </h3>

            <p className="text-xs text-[#6B6B6B] mt-1">
              Allocated to Spot{' '}
              <span className="font-bold text-[#163300] bg-[#EAF9DD] px-2 py-0.5 rounded">
                {completedSession.slot_code || selectedSlot?.slot_code}
              </span>
              . Issue the entry ticket below with scannable QR code to the vehicle driver.
            </p>
          </div>

          {/* Database Returned Record Verification */}
          <div className="p-4 bg-white rounded-2xl border border-[#ECECEC] shadow-xs">
            <div className="text-xs font-bold text-[#163300] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Database Confirmed Record</span>
              <span className="text-[#1F9D55] flex items-center gap-1 text-[11px] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Live Supabase Row
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-[#F7F7F6]">
                <span className="text-[#8C8C8C] block text-[10px] uppercase font-semibold">Ticket No</span>
                <span className="font-bold text-[#163300] font-mono text-[11px] truncate block mt-0.5">
                  {completedSession.ticket_no}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F7F6]">
                <span className="text-[#8C8C8C] block text-[10px] uppercase font-semibold">Vehicle Number</span>
                <span className="font-bold text-[#1A1A1A] font-mono text-xs block mt-0.5">
                  {formatVehicleNumber(completedSession.vehicle_number)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F7F6]">
                <span className="text-[#8C8C8C] block text-[10px] uppercase font-semibold">Slot Code</span>
                <span className="font-bold text-[#163300] text-xs block mt-0.5">
                  {completedSession.slot_code || '—'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F7F6]">
                <span className="text-[#8C8C8C] block text-[10px] uppercase font-semibold">Entry Time (IST)</span>
                <span className="font-medium text-[#1A1A1A] text-[11px] block mt-0.5">
                  {formatDateTimeIST(completedSession.entry_time)}
                </span>
              </div>
            </div>
          </div>

          {/* Official Printable Ticket with embedded QR Code */}
          <Ticket
            ticket={completedSession}
            onNewAction={resetForm}
            newActionLabel="New Vehicle Check-In"
          />

          <div className="text-center no-print pt-2">
            <Button
              variant="ghost"
              onClick={onNavigateToDashboard}
              icon={<LayoutDashboard className="w-4 h-4" />}
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      ) : (
        /* Check-In Two-Column Interface */
        <form onSubmit={handleConfirmCheckIn} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Card: Vehicle Details (5 cols) */}
            <Card className="lg:col-span-5 space-y-5">
              <div className="border-b border-[#F2F2F0] pb-3">
                <h3 className="text-base font-semibold text-[#163300]">
                  Vehicle Details
                </h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5">
                  Enter registration and classification
                </p>
              </div>

              {/* Vehicle Number Input */}
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                  Vehicle Number (Indian Format)
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. KA22AB1234 or 22BH1234AA"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  className="w-full uppercase font-mono text-base font-bold bg-[#F7F7F6] border border-[#ECECEC] rounded-xl px-4 py-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white tracking-wider"
                />

                {/* Formatted live preview */}
                <div className="mt-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#8C8C8C]">Formatted:</span>
                    <span className="font-mono font-bold text-[#163300]">
                      {formattedPreview || '—'}
                    </span>
                  </div>
                  {normalizedNumber && (
                    <span
                      className={`text-[11px] font-medium flex items-center gap-1 ${
                        isValidNumber ? 'text-[#1F9D55]' : 'text-[#D92D20]'
                      }`}
                    >
                      {isValidNumber ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Valid
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" /> Invalid format
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Vehicle Type Segmented Control */}
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                  Vehicle Type
                </label>
                <SegmentedControl
                  value={vehicleType}
                  onChange={handleVehicleTypeChange}
                  options={[
                    {
                      value: 'two_wheeler',
                      label: 'Two-Wheeler (Bike)',
                      icon: <Bike className="w-4 h-4" />,
                    },
                    {
                      value: 'four_wheeler',
                      label: 'Four-Wheeler (Car)',
                      icon: <Car className="w-4 h-4" />,
                    },
                  ]}
                />
              </div>

              {/* Owner Category Segmented Control */}
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                  Owner Category
                </label>
                <SegmentedControl
                  value={ownerCategory}
                  onChange={(val) => setOwnerCategory(val)}
                  options={[
                    { value: 'staff', label: 'Staff' },
                    { value: 'student', label: 'Student' },
                    { value: 'visitor', label: 'Visitor' },
                  ]}
                />

                {/* Tariff Hint */}
                <div className="mt-3 p-3 rounded-xl bg-[#F7F7F6] border border-[#ECECEC] text-xs text-[#558030] font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#9FE870] shrink-0" />
                  <span>{currentTariffHint}</span>
                </div>
              </div>
            </Card>

            {/* Right Card: Select Slot (7 cols) */}
            <Card className="lg:col-span-7">
              <div className="flex items-center justify-between border-b border-[#F2F2F0] pb-3 mb-4">
                <div>
                  <h3 className="text-base font-semibold text-[#163300]">
                    Select Slot (
                    {vehicleType === 'two_wheeler' ? 'Two-Wheeler Zone T' : 'Four-Wheeler Zone F'}
                    )
                  </h3>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">
                    Available: {availableZoneSlots.length} of {zoneSlots.length}
                  </p>
                </div>
                {!isZoneFull && availableZoneSlots.length > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handlePickFirstAvailable}
                    className="text-xs"
                  >
                    Pick First Available
                  </Button>
                )}
              </div>

              {isZoneFull ? (
                /* Required exact message when zone is full */
                <div className="p-12 text-center bg-[#FEECEB] border-2 border-dashed border-[#FCD5D2] rounded-2xl">
                  <AlertCircle className="w-10 h-10 text-[#D92D20] mx-auto mb-3" />
                  <h4 className="text-lg font-bold text-[#D92D20]">
                    {vehicleType === 'two_wheeler'
                      ? 'Parking Full for Two-Wheeler Zone'
                      : 'Parking Full for Four-Wheeler Zone'}
                  </h4>
                  <p className="text-xs text-[#9A1E15] mt-1 max-w-sm mx-auto">
                    All 50 slots in this designated zone are currently occupied. Gate booking is blocked until an existing vehicle exits.
                  </p>
                </div>
              ) : (
                <div className="max-h-[380px] overflow-y-auto pr-1">
                  <SlotGrid
                    slots={zoneSlots}
                    activeSessions={activeSessions}
                    selectedSlotId={selectedSlot?.id}
                    onSelectSlot={(slot) => setSelectedSlot(slot)}
                    interactiveMode="select"
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </Card>
          </div>

          {/* Bottom Confirmation Bar */}
          <div className="p-4 bg-white border border-[#ECECEC] rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-[#6B6B6B]">Check-In Summary:</span>
              <span className="font-bold text-[#163300] font-mono">
                {formattedPreview || 'Enter Vehicle No.'}
              </span>
              <span className="text-[#8C8C8C]">·</span>
              <span className="text-[#1A1A1A] font-medium capitalize">
                {vehicleType.replace('_', '-')}
              </span>
              <span className="text-[#8C8C8C]">·</span>
              <span className="text-[#1A1A1A] font-medium capitalize">
                {ownerCategory}
              </span>
              <span className="text-[#8C8C8C]">·</span>
              <span className="font-bold text-[#163300] bg-[#EAF9DD] px-2 py-0.5 rounded">
                Slot {selectedSlot?.slot_code || 'None Selected'}
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              disabled={!isValidNumber || !selectedSlot || isZoneFull}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Confirm Check-In
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
