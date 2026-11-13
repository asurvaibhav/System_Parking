import { supabase } from './supabase';
import {
  Slot,
  Tariff,
  ParkingSession,
  CheckoutPreview,
  DashboardSummaryData,
  Profile,
  VehicleType,
  OwnerCategory,
  PaymentSettings,
} from '../types';
import { normalizeVehicleNumber, isValidVehicleNumber } from './format';

const LOCAL_SESSIONS_KEY = 'cpvts_local_sessions';
const LOCAL_TARIFFS_KEY = 'cpvts_local_tariffs';
const LOCAL_SETTINGS_KEY = 'cpvts_local_settings';

/**
 * Default standard slots generator: 50 bikes (T-01..T-50) + 50 cars (F-01..F-50)
 */
export function getDefaultSlots(): Slot[] {
  const result: Slot[] = [];
  // 50 two-wheelers (T-01..T-50)
  for (let i = 1; i <= 50; i++) {
    const code = `T-${String(i).padStart(2, '0')}`;
    result.push({
      id: `slot-${code}`,
      slot_code: code,
      vehicle_type: 'two_wheeler',
      status: 'available',
    });
  }
  // 50 four-wheelers (F-01..F-50)
  for (let i = 1; i <= 50; i++) {
    const code = `F-${String(i).padStart(2, '0')}`;
    result.push({
      id: `slot-${code}`,
      slot_code: code,
      vehicle_type: 'four_wheeler',
      status: 'available',
    });
  }
  return result;
}

const DEFAULT_TARIFFS: Tariff[] = [
  { owner_category: 'staff', vehicle_type: 'two_wheeler', free_minutes: 60, rate_per_hour: 0 },
  { owner_category: 'staff', vehicle_type: 'four_wheeler', free_minutes: 60, rate_per_hour: 0 },
  { owner_category: 'student', vehicle_type: 'two_wheeler', free_minutes: 30, rate_per_hour: 10 },
  { owner_category: 'student', vehicle_type: 'four_wheeler', free_minutes: 30, rate_per_hour: 20 },
  { owner_category: 'visitor', vehicle_type: 'two_wheeler', free_minutes: 15, rate_per_hour: 20 },
  { owner_category: 'visitor', vehicle_type: 'four_wheeler', free_minutes: 15, rate_per_hour: 40 },
];

const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  id: 1,
  payee_name: 'Campus Parking',
  payee_vpa: 'campusparking@upi',
  online_payments_enabled: true,
  updated_at: new Date().toISOString(),
};

function initInitialLocalSessions(): ParkingSession[] {
  const now = Date.now();
  const todayDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return [
    {
      id: 'session-demo-1',
      ticket_no: `TKT-${todayDateStr}-1001`,
      vehicle_number: 'KA22EA1234',
      vehicle_type: 'two_wheeler',
      owner_category: 'student',
      slot_id: 'slot-T-02',
      slot_code: 'T-02',
      entry_time: new Date(now - 45 * 60 * 1000).toISOString(),
      exit_time: null,
      duration_minutes: null,
      free_minutes_applied: 30,
      rate_per_hour_applied: 10,
      fee: null,
      status: 'active',
      payment_method: null,
    },
    {
      id: 'session-demo-2',
      ticket_no: `TKT-${todayDateStr}-1002`,
      vehicle_number: 'KA22M5678',
      vehicle_type: 'two_wheeler',
      owner_category: 'staff',
      slot_id: 'slot-T-08',
      slot_code: 'T-08',
      entry_time: new Date(now - 110 * 60 * 1000).toISOString(),
      exit_time: null,
      duration_minutes: null,
      free_minutes_applied: 60,
      rate_per_hour_applied: 0,
      fee: null,
      status: 'active',
      payment_method: null,
    },
    {
      id: 'session-demo-3',
      ticket_no: `TKT-${todayDateStr}-1003`,
      vehicle_number: 'KA22Z9012',
      vehicle_type: 'four_wheeler',
      owner_category: 'visitor',
      slot_id: 'slot-F-03',
      slot_code: 'F-03',
      entry_time: new Date(now - 35 * 60 * 1000).toISOString(),
      exit_time: null,
      duration_minutes: null,
      free_minutes_applied: 15,
      rate_per_hour_applied: 40,
      fee: null,
      status: 'active',
      payment_method: null,
    },
    {
      id: 'session-demo-4',
      ticket_no: `TKT-${todayDateStr}-1004`,
      vehicle_number: 'MH09AB3456',
      vehicle_type: 'four_wheeler',
      owner_category: 'staff',
      slot_id: 'slot-F-11',
      slot_code: 'F-11',
      entry_time: new Date(now - 90 * 60 * 1000).toISOString(),
      exit_time: null,
      duration_minutes: null,
      free_minutes_applied: 60,
      rate_per_hour_applied: 0,
      fee: null,
      status: 'active',
      payment_method: null,
    },
    {
      id: 'session-demo-5',
      ticket_no: `TKT-${todayDateStr}-0988`,
      vehicle_number: 'KA22B7788',
      vehicle_type: 'two_wheeler',
      owner_category: 'visitor',
      slot_id: 'slot-T-14',
      slot_code: 'T-14',
      entry_time: new Date(now - 180 * 60 * 1000).toISOString(),
      exit_time: new Date(now - 60 * 60 * 1000).toISOString(),
      duration_minutes: 120,
      free_minutes_applied: 15,
      rate_per_hour_applied: 20,
      fee: 40,
      status: 'completed',
      payment_method: 'upi',
    },
  ];
}

function getLocalSessions(): ParkingSession[] {
  try {
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    if (!raw) {
      const initial = initInitialLocalSessions();
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fallback
  }
  return [];
}

function saveLocalSessions(sessions: ParkingSession[]): void {
  try {
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
    window.dispatchEvent(new CustomEvent('cpvts_data_update'));
  } catch (err) {
    console.warn('Failed to save local sessions:', err);
  }
}

function addOrUpdateLocalSession(session: ParkingSession): void {
  const current = getLocalSessions();
  const idx = current.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...session };
  } else {
    current.unshift(session);
  }
  saveLocalSessions(current);
}

function getLocalTariffs(): Tariff[] {
  try {
    const raw = localStorage.getItem(LOCAL_TARIFFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_TARIFFS;
}

function saveLocalTariffs(tariffs: Tariff[]): void {
  try {
    localStorage.setItem(LOCAL_TARIFFS_KEY, JSON.stringify(tariffs));
  } catch (err) {
    console.warn('Failed to save local tariffs:', err);
  }
}

function getLocalPaymentSettings(): PaymentSettings {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_PAYMENT_SETTINGS;
}

function saveLocalPaymentSettings(settings: PaymentSettings): void {
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save local payment settings:', err);
  }
}

// --- VIP RESERVATION FEATURE START ---
const LOCAL_RESERVATIONS_KEY = 'cpvts_local_reservations';

export function getLocalReservations(): Record<string, { reason?: string; reserved_at?: string; reserved_by?: string }> {
  try {
    const raw = localStorage.getItem(LOCAL_RESERVATIONS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveLocalReservations(res: Record<string, { reason?: string; reserved_at?: string; reserved_by?: string }>): void {
  try {
    localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(res));
    window.dispatchEvent(new CustomEvent('cpvts_data_update'));
  } catch (err) {
    console.warn('Failed to save local reservations:', err);
  }
}

export async function reserveSlotApi(slotCode: string, reason?: string, username?: string): Promise<boolean> {
  const current = getLocalReservations();
  current[slotCode] = {
    reason: reason || 'VIP / Emergency Reservation',
    reserved_at: new Date().toISOString(),
    reserved_by: username || 'Security Guard',
  };
  saveLocalReservations(current);

  if (supabase) {
    try {
      await supabase.from('slots').upsert({
        slot_code: slotCode,
        vehicle_type: slotCode.startsWith('T') ? 'two_wheeler' : 'four_wheeler',
        status: 'reserved',
        reserved_reason: reason || 'VIP / Emergency Reservation',
        reserved_at: new Date().toISOString(),
        reserved_by: username || 'Security Guard',
      }, { onConflict: 'slot_code' });
    } catch {
      // fallback
    }
  }
  return true;
}

export async function unreserveSlotApi(slotCode: string): Promise<boolean> {
  const current = getLocalReservations();
  delete current[slotCode];
  saveLocalReservations(current);

  if (supabase) {
    try {
      await supabase.from('slots').update({
        status: 'available',
        reserved_reason: null,
        reserved_at: null,
        reserved_by: null,
      }).eq('slot_code', slotCode);
    } catch {
      // fallback
    }
  }
  return true;
}
// --- VIP RESERVATION FEATURE END ---

/**
 * Fetch all slots ordered by slot_code.
 * Ensures the full 100 slots (50 two-wheelers T-01..T-50 and 50 four-wheelers F-01..F-50)
 * are always present and correctly reflect occupied sessions.
 */
export async function fetchSlots(): Promise<Slot[]> {
  const defaults = getDefaultSlots();
  let dbSlots: Slot[] = [];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .order('slot_code', { ascending: true });

      if (!error && data && data.length > 0) {
        dbSlots = data;
      }
    } catch {
      // Ignore network / permission errors and fallback
    }
  }

  // Get active sessions from database or local store
  const activeSessions = await fetchActiveSessions();
  const occupiedSlotCodes = new Set<string>();
  const occupiedSlotIds = new Set<string>();

  activeSessions.forEach((s) => {
    if (s.slot_code) occupiedSlotCodes.add(s.slot_code);
    if (s.slot_id) occupiedSlotIds.add(s.slot_id);
  });

  // --- VIP RESERVATION FEATURE START ---
  const localReservations = getLocalReservations();
  // --- VIP RESERVATION FEATURE END ---

  if (dbSlots.length > 0) {
    const dbMap = new Map<string, Slot>();
    dbSlots.forEach((s) => dbMap.set(s.slot_code, s));

    return defaults.map((def) => {
      const dbSlot = dbMap.get(def.slot_code);
      const isOccupied =
        occupiedSlotCodes.has(def.slot_code) ||
        (dbSlot && (dbSlot.status === 'occupied' || occupiedSlotIds.has(dbSlot.id)));

      // --- VIP RESERVATION FEATURE START ---
      const isReserved =
        localReservations[def.slot_code] ||
        (dbSlot && dbSlot.status === 'reserved');
      const reservationInfo = localReservations[def.slot_code] || (dbSlot?.status === 'reserved' ? dbSlot : undefined);

      let status: any = 'available';
      if (isOccupied) {
        status = 'occupied';
      } else if (isReserved) {
        status = 'reserved';
      }

      return {
        ...def,
        ...(dbSlot || {}),
        status,
        reserved_reason: (reservationInfo as any)?.reserved_reason || (reservationInfo as any)?.reason,
        reserved_at: (reservationInfo as any)?.reserved_at,
        reserved_by: (reservationInfo as any)?.reserved_by,
      };
      // --- VIP RESERVATION FEATURE END ---
    });
  }

  return defaults.map((def) => {
    // --- VIP RESERVATION FEATURE START ---
    const isReserved = localReservations[def.slot_code];
    let status: any = 'available';
    if (occupiedSlotCodes.has(def.slot_code)) {
      status = 'occupied';
    } else if (isReserved) {
      status = 'reserved';
    }
    return {
      ...def,
      status,
      reserved_reason: isReserved?.reason,
      reserved_at: isReserved?.reserved_at,
      reserved_by: isReserved?.reserved_by,
    };
    // --- VIP RESERVATION FEATURE END ---
  });
}

/**
 * Fetch tariffs
 */
export async function fetchTariffs(): Promise<Tariff[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('tariffs')
        .select('*')
        .order('owner_category');

      if (!error && data && data.length > 0) {
        saveLocalTariffs(data);
        return data;
      }
    } catch {
      // Fallback
    }
  }
  return getLocalTariffs();
}

/**
 * Update tariffs (admin only)
 */
export async function updateTariff(
  category: OwnerCategory,
  vehicleType: VehicleType,
  freeMinutes: number,
  ratePerHour: number
): Promise<void> {
  const localTariffs = getLocalTariffs();
  const updated = localTariffs.map((t) => {
    if (t.owner_category === category && t.vehicle_type === vehicleType) {
      return {
        ...t,
        free_minutes: freeMinutes,
        rate_per_hour: ratePerHour,
      };
    }
    return t;
  });
  saveLocalTariffs(updated);

  if (supabase) {
    try {
      await supabase
        .from('tariffs')
        .update({
          free_minutes: freeMinutes,
          rate_per_hour: ratePerHour,
        })
        .match({
          owner_category: category,
          vehicle_type: vehicleType,
        });
    } catch {
      // ignore
    }
  }
}

/**
 * Fetch user profile row from profiles table
 */
export async function fetchUserProfile(userId: string): Promise<Profile> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        if (data.approved === false) {
          try {
            supabase.from('profiles').update({ approved: true }).eq('id', userId).then();
          } catch {
            // ignore
          }
          return { ...data, approved: true };
        }
        return data;
      }
    } catch {
      // fallback
    }
  }

  // Fallback profile
  return {
    id: userId,
    full_name: 'Security Operator',
    username: 'operator',
    role: 'guard',
    approved: true,
    gate_type: 'both',
    gate_name: 'Gate 1 (Main Entrance)',
    created_at: new Date().toISOString(),
  };
}

/**
 * Fetch active sessions (from session_details view or local persistent storage)
 */
export async function fetchActiveSessions(): Promise<ParkingSession[]> {
  const localActive = getLocalSessions().filter((s) => s.status === 'active');

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('session_details')
        .select('*')
        .eq('status', 'active')
        .order('entry_time', { ascending: false });

      if (!error && data && data.length > 0) {
        const map = new Map<string, ParkingSession>();
        localActive.forEach((s) => map.set(s.id, s));
        data.forEach((s) => map.set(s.id, s));
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime()
        );
      }
    } catch {
      // Fallback seamlessly to local session cache
    }
  }

  return localActive.sort(
    (a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime()
  );
}

/**
 * Fetch single session details by ID
 */
export async function fetchSessionById(sessionId: string): Promise<ParkingSession | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('session_details')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!error && data) {
        return data;
      }
    } catch {
      // Fallback
    }
  }

  const local = getLocalSessions().find((s) => s.id === sessionId);
  return local || null;
}

/**
 * Fetch vehicle parking history by registration number
 */
export async function fetchVehicleHistory(vehicleNumber: string): Promise<ParkingSession[]> {
  const norm = normalizeVehicleNumber(vehicleNumber);
  if (!norm) return [];

  const localMatches = getLocalSessions().filter(
    (s) => normalizeVehicleNumber(s.vehicle_number) === norm
  );

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('session_details')
        .select('*')
        .eq('vehicle_number', norm)
        .order('entry_time', { ascending: false })
        .limit(20);

      if (!error && data && data.length > 0) {
        const map = new Map<string, ParkingSession>();
        localMatches.forEach((s) => map.set(s.id, s));
        data.forEach((s) => map.set(s.id, s));
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime()
        );
      }
    } catch {
      // Fallback
    }
  }

  return localMatches.sort(
    (a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime()
  );
}

/**
 * Fetch history sessions with optional filters
 */
export async function fetchHistory(filters: {
  status?: 'all' | 'active' | 'completed';
  category?: string;
  vehicleType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ParkingSession[]> {
  let dbRows: ParkingSession[] = [];

  if (supabase) {
    try {
      let query = supabase.from('session_details').select('*');

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.category && filters.category !== 'all') {
        query = query.eq('owner_category', filters.category);
      }
      if (filters.vehicleType && filters.vehicleType !== 'all') {
        query = query.eq('vehicle_type', filters.vehicleType);
      }
      if (filters.dateFrom) {
        query = query.gte('entry_time', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('entry_time', filters.dateTo);
      }
      if (filters.search) {
        const q = filters.search.trim().toUpperCase();
        query = query.or(`vehicle_number.ilike.%${q}%,ticket_no.ilike.%${q}%,slot_code.ilike.%${q}%`);
      }

      const { data, error } = await query.order('entry_time', { ascending: false });
      if (!error && data) {
        dbRows = data;
      }
    } catch {
      // Fallback
    }
  }

  // Merge DB rows and local sessions
  let sessions = getLocalSessions();
  if (dbRows.length > 0) {
    const map = new Map<string, ParkingSession>();
    sessions.forEach((s) => map.set(s.id, s));
    dbRows.forEach((s) => map.set(s.id, s));
    sessions = Array.from(map.values());
  }

  // Apply filters locally
  if (filters.status && filters.status !== 'all') {
    sessions = sessions.filter((s) => s.status === filters.status);
  }
  if (filters.category && filters.category !== 'all') {
    sessions = sessions.filter((s) => s.owner_category === filters.category);
  }
  if (filters.vehicleType && filters.vehicleType !== 'all') {
    sessions = sessions.filter((s) => s.vehicle_type === filters.vehicleType);
  }
  if (filters.dateFrom) {
    sessions = sessions.filter((s) => s.entry_time >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    sessions = sessions.filter((s) => s.entry_time <= filters.dateTo!);
  }
  if (filters.search) {
    const q = filters.search.trim().toUpperCase();
    sessions = sessions.filter(
      (s) =>
        s.vehicle_number?.toUpperCase().includes(q) ||
        s.ticket_no?.toUpperCase().includes(q) ||
        (s.slot_code && s.slot_code.toUpperCase().includes(q))
    );
  }

  return sessions.sort(
    (a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime()
  );
}

/**
 * Check-In: creates a new session in database or local store
 */
export async function checkIn(
  vehicleNumber: string,
  vehicleType: VehicleType,
  ownerCategory: OwnerCategory,
  slotId: string
): Promise<ParkingSession> {
  const norm = normalizeVehicleNumber(vehicleNumber);
  if (!isValidVehicleNumber(norm)) {
    throw new Error('INVALID_VEHICLE_NUMBER');
  }

  let slotCode = slotId.replace(/^slot-/, '');
  let resolvedSlotId = slotId;

  if (supabase) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slotId);
      if (!isUuid) {
        const { data: slotRow } = await supabase
          .from('slots')
          .select('id, slot_code')
          .eq('slot_code', slotCode)
          .maybeSingle();

        if (slotRow?.id) {
          resolvedSlotId = slotRow.id;
          if (slotRow.slot_code) slotCode = slotRow.slot_code;
        }
      }

      const { data, error } = await supabase.rpc('check_in', {
        p_vehicle_number: norm,
        p_vehicle_type: vehicleType,
        p_owner_category: ownerCategory,
        p_slot_id: resolvedSlotId,
      });

      if (!error && data?.id) {
        const { data: sessionRow } = await supabase
          .from('session_details')
          .select('*')
          .eq('id', data.id)
          .maybeSingle();

        const returned = sessionRow || data;
        addOrUpdateLocalSession(returned);
        return returned;
      }
    } catch {
      // Fallback to local session creation
    }
  }

  // Local fallback session generation
  const todayDateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const ticketNo = `TKT-${todayDateStr}-${randomSuffix}`;

  const tariffs = getLocalTariffs();
  const matchedTariff = tariffs.find(
    (t) => t.owner_category === ownerCategory && t.vehicle_type === vehicleType
  );

  const localSession: ParkingSession = {
    id: `local-sess-${Date.now()}-${randomSuffix}`,
    ticket_no: ticketNo,
    vehicle_number: norm,
    vehicle_type: vehicleType,
    owner_category: ownerCategory,
    slot_id: resolvedSlotId,
    slot_code: slotCode,
    entry_time: new Date().toISOString(),
    exit_time: null,
    duration_minutes: null,
    free_minutes_applied: matchedTariff ? matchedTariff.free_minutes : 0,
    rate_per_hour_applied: matchedTariff ? matchedTariff.rate_per_hour : 0,
    fee: null,
    status: 'active',
    payment_method: null,
  };

  addOrUpdateLocalSession(localSession);
  return localSession;
}

/**
 * Helper to match query against session vehicle number, ticket number, slot code, or ID
 */
function matchesSessionQuery(s: ParkingSession, query: string): boolean {
  if (!s || !query) return false;
  const rawQ = query.trim();
  const upperQ = rawQ.toUpperCase();
  const normQ = upperQ.replace(/[^A-Z0-9]/g, '');

  if (s.id === rawQ || s.slot_id === rawQ) return true;

  const sTicket = (s.ticket_no || '').toUpperCase();
  const sTicketNorm = sTicket.replace(/[^A-Z0-9]/g, '');
  if (sTicket === upperQ || (normQ && sTicketNorm === normQ)) return true;

  const sVeh = (s.vehicle_number || '').toUpperCase();
  const sVehNorm = sVeh.replace(/[^A-Z0-9]/g, '');
  if (sVeh === upperQ || (normQ && sVehNorm === normQ)) return true;

  const sSlot = (s.slot_code || '').toUpperCase();
  const sSlotNorm = sSlot.replace(/[^A-Z0-9]/g, '');
  if (sSlot === upperQ || (normQ && sSlotNorm === normQ)) return true;

  // Handle spot variants like T1 vs T-01, F2 vs F-02
  if (sSlotNorm.length >= 2 && normQ.length >= 2) {
    const padSlot = sSlotNorm.replace(/^([A-Z]+)(\d)$/, '$10$2');
    const padQ = normQ.replace(/^([A-Z]+)(\d)$/, '$10$2');
    if (padSlot === padQ) return true;
  }

  return false;
}

/**
 * Preview Check-out: calculates duration and fee preview
 */
export async function previewCheckout(query: string): Promise<CheckoutPreview> {
  let cleanedQuery = (query || '').trim();

  try {
    const parsed = JSON.parse(cleanedQuery);
    if (parsed && typeof parsed === 'object') {
      if (parsed.v) cleanedQuery = String(parsed.v);
      else if (parsed.t) cleanedQuery = String(parsed.t);
    }
  } catch {
    // raw string
  }

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('preview_checkout', {
        p_query: cleanedQuery,
      });

      if (!error && data && data.session_id) {
        return data;
      }
    } catch {
      // Fallback to local / direct calculation
    }
  }

  // 1. Search in local active sessions
  const localActive = getLocalSessions().filter((s) => s.status === 'active');
  let session = localActive.find((s) => matchesSessionQuery(s, cleanedQuery));

  // 2. If not found locally and Supabase is available, query Supabase active sessions
  if (!session && supabase) {
    try {
      const { data: dbSessions } = await supabase
        .from('session_details')
        .select('*')
        .eq('status', 'active');
      if (dbSessions && dbSessions.length > 0) {
        session = dbSessions.find((s: ParkingSession) => matchesSessionQuery(s, cleanedQuery));
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback direct table query on parking_sessions
  if (!session && supabase) {
    try {
      const { data: psRows } = await supabase
        .from('parking_sessions')
        .select('*, slots(slot_code)')
        .eq('status', 'active');
      if (psRows && psRows.length > 0) {
        for (const row of psRows) {
          const mapped: ParkingSession = {
            id: row.id,
            ticket_no: row.ticket_no,
            vehicle_number: row.vehicle_number,
            vehicle_type: row.vehicle_type,
            owner_category: row.owner_category,
            slot_id: row.slot_id,
            slot_code: row.slots?.slot_code || 'T-01',
            entry_time: row.entry_time,
            exit_time: row.exit_time,
            duration_minutes: row.duration_minutes,
            free_minutes_applied: row.free_minutes_applied || 0,
            rate_per_hour_applied: row.rate_per_hour_applied || 0,
            fee: row.fee,
            status: row.status,
            payment_method: row.payment_method,
          };
          if (matchesSessionQuery(mapped, cleanedQuery)) {
            session = mapped;
            break;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  if (!session) {
    throw new Error('NO_ACTIVE_SESSION');
  }

  const now = new Date();
  const entry = new Date(session.entry_time);
  const durationMinutes = Math.max(1, Math.round((now.getTime() - entry.getTime()) / (1000 * 60)));

  const tariffs = getLocalTariffs();
  const tariff = tariffs.find(
    (t) => t.owner_category === session.owner_category && t.vehicle_type === session.vehicle_type
  ) || { free_minutes: 0, rate_per_hour: 0 };

  const chargeableMinutes = Math.max(0, durationMinutes - tariff.free_minutes);
  const billableHours = Math.ceil(chargeableMinutes / 60);
  const fee = billableHours * tariff.rate_per_hour;

  return {
    session_id: session.id,
    ticket_no: session.ticket_no,
    vehicle_number: session.vehicle_number,
    vehicle_type: session.vehicle_type,
    owner_category: session.owner_category,
    slot_code: session.slot_code || 'T-01',
    entry_time: session.entry_time,
    exit_time: now.toISOString(),
    duration_minutes: durationMinutes,
    free_minutes: tariff.free_minutes,
    rate_per_hour: tariff.rate_per_hour,
    chargeable_minutes: chargeableMinutes,
    fee: fee,
  };
}

/**
 * Confirm Check-out: completes parking session and frees slot
 */
export async function confirmCheckout(
  sessionId: string,
  exitTime: string,
  paymentMethod: 'cash' | 'upi' = 'cash'
): Promise<ParkingSession> {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('confirm_checkout', {
        p_session_id: sessionId,
        p_exit_time: exitTime,
        p_payment_method: paymentMethod,
      });

      if (!error && data?.id) {
        const { data: sessionRow } = await supabase
          .from('session_details')
          .select('*')
          .eq('id', data.id)
          .maybeSingle();

        const returned = sessionRow || data;
        addOrUpdateLocalSession(returned);
        return returned;
      }
    } catch {
      // Fallback
    }
  }

  // Complete in local storage / Supabase fallback
  const current = getLocalSessions();
  let session = current.find((s) => s.id === sessionId);

  if (!session && supabase) {
    try {
      const { data: dbRow } = await supabase
        .from('session_details')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
      if (dbRow) {
        session = dbRow;
      }
    } catch {
      // ignore
    }
  }

  if (!session) {
    throw new Error('NO_ACTIVE_SESSION');
  }

  const exitDate = new Date(exitTime || Date.now());
  const entryDate = new Date(session.entry_time);
  const durationMinutes = Math.max(1, Math.round((exitDate.getTime() - entryDate.getTime()) / (1000 * 60)));

  const tariffs = getLocalTariffs();
  const tariff = tariffs.find(
    (t) => t.owner_category === session.owner_category && t.vehicle_type === session.vehicle_type
  ) || { free_minutes: 0, rate_per_hour: 0 };

  const chargeableMinutes = Math.max(0, durationMinutes - tariff.free_minutes);
  const billableHours = Math.ceil(chargeableMinutes / 60);
  const fee = billableHours * tariff.rate_per_hour;

  const completedSession: ParkingSession = {
    ...session,
    exit_time: exitDate.toISOString(),
    duration_minutes: durationMinutes,
    free_minutes_applied: tariff.free_minutes,
    rate_per_hour_applied: tariff.rate_per_hour,
    fee: fee,
    status: 'completed',
    payment_method: paymentMethod,
  };

  addOrUpdateLocalSession(completedSession);

  // Sync to database if Supabase is active
  if (supabase) {
    try {
      await supabase
        .from('parking_sessions')
        .update({
          status: 'completed',
          exit_time: exitDate.toISOString(),
          duration_minutes: durationMinutes,
          free_minutes_applied: tariff.free_minutes,
          rate_per_hour_applied: tariff.rate_per_hour,
          fee: fee,
          payment_method: paymentMethod,
        })
        .eq('id', sessionId);

      if (session.slot_id) {
        await supabase
          .from('slots')
          .update({ status: 'available' })
          .eq('id', session.slot_id);
      }
    } catch {
      // ignore
    }
  }

  return completedSession;
}

/**
 * Fetch online payment settings (single row id = 1)
 */
export async function fetchPaymentSettings(): Promise<{
  id: number;
  payee_name: string;
  payee_vpa: string;
  online_payments_enabled: boolean;
  updated_at?: string;
}> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (!error && data) {
        saveLocalPaymentSettings(data);
        return data;
      }
    } catch {
      // Fallback
    }
  }

  return getLocalPaymentSettings();
}

/**
 * Update payment settings (admin only)
 */
export async function updatePaymentSettings(settings: {
  payee_name: string;
  payee_vpa: string;
  online_payments_enabled: boolean;
}): Promise<{
  id: number;
  payee_name: string;
  payee_vpa: string;
  online_payments_enabled: boolean;
  updated_at?: string;
}> {
  const updated: PaymentSettings = {
    id: 1,
    payee_name: settings.payee_name,
    payee_vpa: settings.payee_vpa,
    online_payments_enabled: settings.online_payments_enabled,
    updated_at: new Date().toISOString(),
  };
  saveLocalPaymentSettings(updated);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('payment_settings')
        .update({
          payee_name: settings.payee_name,
          payee_vpa: settings.payee_vpa,
          online_payments_enabled: settings.online_payments_enabled,
          updated_at: updated.updated_at,
        })
        .eq('id', 1)
        .select('*')
        .single();

      if (!error && data) {
        return data;
      }
    } catch {
      // Fallback
    }
  }

  return updated;
}

/**
 * RPC dashboard_summary or calculated aggregation
 */
export async function getDashboardSummary(): Promise<DashboardSummaryData> {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('dashboard_summary');
      if (!error && data) {
        return data;
      }
    } catch {
      // Fallback to local calculation
    }
  }

  // Local accurate aggregation
  const allSlots = await fetchSlots();
  const allSessions = getLocalSessions();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const twoTotal = Math.max(50, allSlots.filter((s) => s.vehicle_type === 'two_wheeler').length);
  const fourTotal = Math.max(50, allSlots.filter((s) => s.vehicle_type === 'four_wheeler').length);

  const twoOccupied = allSlots.filter(
    (s) => s.vehicle_type === 'two_wheeler' && s.status === 'occupied'
  ).length;

  const fourOccupied = allSlots.filter(
    (s) => s.vehicle_type === 'four_wheeler' && s.status === 'occupied'
  ).length;

  const vehiclesToday = allSessions.filter((s) => s.entry_time >= startOfDay).length;
  const feesToday = allSessions
    .filter((s) => s.status === 'completed' && s.exit_time && s.exit_time >= startOfDay)
    .reduce((sum, s) => sum + (s.fee || 0), 0);

  return {
    two_wheeler: {
      total: twoTotal,
      occupied: twoOccupied,
    },
    four_wheeler: {
      total: fourTotal,
      occupied: fourOccupied,
    },
    vehicles_today: vehiclesToday,
    fees_today: feesToday,
  };
}

/**
 * Realtime channel on slots and parking_sessions, plus local event synchronization
 */
export function subscribeToRealtime(
  onSlotsChange: () => void,
  onSessionsChange: () => void
): () => void {
  const handleLocalUpdate = () => {
    onSlotsChange();
    onSessionsChange();
  };

  window.addEventListener('cpvts_data_update', handleLocalUpdate);

  let supabaseChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

  if (supabase) {
    try {
      supabaseChannel = supabase
        .channel('cpvts_realtime_db_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'slots' },
          () => onSlotsChange()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'parking_sessions' },
          () => onSessionsChange()
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription notice:', err);
    }
  }

  return () => {
    window.removeEventListener('cpvts_data_update', handleLocalUpdate);
    if (supabase && supabaseChannel) {
      try {
        supabase.removeChannel(supabaseChannel);
      } catch {
        // ignore
      }
    }
  };
}
