export type VehicleType = 'two_wheeler' | 'four_wheeler';
export type OwnerCategory = 'staff' | 'student' | 'visitor';
// --- VIP RESERVATION FEATURE START ---
export type SlotStatus = 'available' | 'occupied' | 'reserved';
// --- VIP RESERVATION FEATURE END ---
export type SessionStatus = 'active' | 'completed';
export type UserRole = 'guard' | 'admin';
export type GateType = 'entry' | 'exit' | 'both';

export type PaymentMethod = 'cash' | 'upi' | 'free';

export interface PaymentSettings {
  id: number;
  payee_name: string;
  payee_vpa: string;
  online_payments_enabled: boolean;
  updated_at?: string;
}

export interface Profile {
  id: string;
  full_name: string;
  username?: string;
  role: UserRole;
  approved?: boolean;
  gate_type?: GateType;
  gate_name?: string;
  created_at?: string;
}

export interface Slot {
  id: string;
  slot_code: string; // T-01..T-50, F-01..F-50
  vehicle_type: VehicleType;
  status: SlotStatus;
  // --- VIP RESERVATION FEATURE START ---
  reserved_reason?: string;
  reserved_at?: string;
  reserved_by?: string;
  // --- VIP RESERVATION FEATURE END ---
}

export interface Tariff {
  owner_category: OwnerCategory;
  vehicle_type: VehicleType;
  free_minutes: number;
  rate_per_hour: number;
}

export interface ParkingSession {
  id: string;
  ticket_no: string;
  vehicle_number: string;
  vehicle_type: VehicleType;
  owner_category: OwnerCategory;
  slot_id: string;
  slot_code?: string;
  entry_time: string;
  exit_time: string | null;
  duration_minutes: number | null;
  free_minutes_applied: number | null;
  rate_per_hour_applied: number | null;
  fee: number | null;
  status: SessionStatus;
  payment_method?: PaymentMethod | null;
  checked_in_by?: string | null;
  checked_out_by?: string | null;
}

export interface CheckoutPreview {
  session_id: string;
  ticket_no: string;
  vehicle_number: string;
  vehicle_type: VehicleType;
  owner_category: OwnerCategory;
  slot_code: string;
  entry_time: string;
  exit_time: string;
  duration_minutes: number;
  free_minutes: number;
  rate_per_hour: number;
  chargeable_minutes: number;
  fee: number;
}

export interface DashboardSummaryData {
  two_wheeler: {
    total: number;
    occupied: number;
  };
  four_wheeler: {
    total: number;
    occupied: number;
  };
  vehicles_today: number;
  fees_today: number;
}

declare global {
  interface Window {
    cpvtsDesktop?: {
      openCustomerDisplay: (code: string) => Promise<void>;
    };
  }
}
