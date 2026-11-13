import React from 'react';
import { Slot, ParkingSession } from '../types';
import { formatVehicleNumber } from '../lib/format';

interface SlotGridProps {
  slots: Slot[];
  activeSessions?: ParkingSession[];
  selectedSlotId?: string | null;
  onSelectSlot?: (slot: Slot) => void;
  filterType?: 'all' | 'two_wheeler' | 'four_wheeler';
  interactiveMode?: 'select' | 'details'; // select = for check-in; details = for viewing drawer
  disabled?: boolean;
}

export const SlotGrid: React.FC<SlotGridProps> = ({
  slots,
  activeSessions = [],
  selectedSlotId,
  onSelectSlot,
  filterType = 'all',
  interactiveMode = 'select',
  disabled = false,
}) => {
  const filteredSlots = slots.filter((slot) => {
    if (filterType === 'all') return true;
    return slot.vehicle_type === filterType;
  });

  // Map slotId or slot_code to active session for quick lookup
  const sessionBySlotId = new Map<string, ParkingSession>();
  activeSessions.forEach((s) => {
    if (s.slot_id) sessionBySlotId.set(s.slot_id, s);
    if (s.slot_code) sessionBySlotId.set(s.slot_code, s);
  });

  return (
    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5">
      {filteredSlots.map((slot) => {
        const isOccupied = slot.status === 'occupied';
        const isSelected = selectedSlotId === slot.id;
        const session =
          sessionBySlotId.get(slot.id) ||
          (slot.slot_code ? sessionBySlotId.get(slot.slot_code) : undefined);

        let buttonStyle = '';
        if (isSelected) {
          // Highlighted: forest border + lime fill
          buttonStyle =
            'bg-[#9FE870] border-2 border-[#163300] text-[#163300] font-bold shadow-sm scale-105 z-10';
        } else if (isOccupied) {
          // Occupied: grey tile with vehicle number in small text
          buttonStyle =
            'bg-[#ECECEB] border border-[#DCDCDC] text-[#555555] opacity-90';
        } else {
          // Available: white with a lime border
          buttonStyle =
            'bg-white border-1.5 border-[#9FE870] hover:border-[#7ecf49] hover:bg-[#F4FCEF] text-[#163300] font-semibold shadow-2xs';
        }

        const isClickable =
          !disabled &&
          (interactiveMode === 'details' || (interactiveMode === 'select' && !isOccupied));

        return (
          <button
            key={slot.id}
            type="button"
            disabled={!isClickable}
            onClick={() => onSelectSlot && onSelectSlot(slot)}
            className={`h-14 rounded-xl p-1 flex flex-col items-center justify-center transition-all text-xs relative select-none ${buttonStyle} ${
              isClickable ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-not-allowed'
            }`}
          >
            <span className="font-bold text-[13px] tracking-tight">{slot.slot_code}</span>
            {isOccupied ? (
              <span className="text-[9.5px] font-semibold text-[#666666] tracking-tighter truncate max-w-full px-1">
                {session ? formatVehicleNumber(session.vehicle_number) : 'OCCUPIED'}
              </span>
            ) : (
              <span className="text-[9px] uppercase text-[#1F9D55] font-semibold tracking-wider">
                FREE
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
