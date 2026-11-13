/**
 * Normalizes an Indian vehicle number:
 * Uppercase and strip all non-alphanumeric characters.
 */
export function normalizeVehicleNumber(input: string): string {
  return (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Validates normalized Indian vehicle number:
 * Matches standard state codes (e.g. KA22AB1234) and Bharat Series (e.g. 22BH1234AA)
 */
export function isValidVehicleNumber(normalized: string): boolean {
  const standardRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}$/;
  const bhRegex = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
  return standardRegex.test(normalized) || bhRegex.test(normalized);
}

/**
 * Formats a normalized vehicle number with hyphens for readability:
 * KA22AB1234 -> KA-22-AB-1234
 * KA22A1234 -> KA-22-A-1234
 * 22BH1234AA -> 22-BH-1234-AA
 */
export function formatVehicleNumber(raw: string): string {
  const norm = normalizeVehicleNumber(raw);
  if (!norm) return '';

  // Check BH series: YY BH NNNN XX
  const bhMatch = norm.match(/^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$/);
  if (bhMatch) {
    return `${bhMatch[1]}-${bhMatch[2]}-${bhMatch[3]}-${bhMatch[4]}`;
  }

  // Check standard: SS DD SSS NNNN
  const stdMatch = norm.match(/^([A-Z]{2})([0-9]{2})([A-Z]{1,3})([0-9]{4})$/);
  if (stdMatch) {
    return `${stdMatch[1]}-${stdMatch[2]}-${stdMatch[3]}-${stdMatch[4]}`;
  }

  // Progressive formatting while typing
  if (norm.length <= 2) return norm;
  if (norm.length <= 4) return `${norm.slice(0, 2)}-${norm.slice(2)}`;
  
  // Detect if BH series started
  if (/^[0-9]{2}BH/.test(norm)) {
    if (norm.length <= 8) return `${norm.slice(0, 2)}-${norm.slice(2, 4)}-${norm.slice(4)}`;
    return `${norm.slice(0, 2)}-${norm.slice(2, 4)}-${norm.slice(4, 8)}-${norm.slice(8)}`;
  }

  // Standard progressive
  const state = norm.slice(0, 2);
  const district = norm.slice(2, 4);
  const rest = norm.slice(4);

  // find where letters transition to digits
  const letters = rest.match(/^[A-Z]+/)?.[0] || '';
  const digits = rest.slice(letters.length);

  if (letters && digits) {
    return `${state}-${district}-${letters}-${digits}`;
  } else if (letters) {
    return `${state}-${district}-${letters}`;
  } else {
    return `${state}-${district}-${rest}`;
  }
}

/**
 * Formats a timestamp in Asia/Kolkata (IST) with seconds:
 * e.g. "09 Oct 2026, 09:03:27 AM"
 */
export function formatDateTimeIST(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return '—';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Formats a short time in Asia/Kolkata (IST):
 * e.g. "09:03 AM"
 */
export function formatTimeIST(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return '—';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Formats duration in minutes to "X h Y min"
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = Math.max(0, minutes % 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, '0')} min`;
}

/**
 * Formats fee amount in Indian Rupees:
 * e.g. "₹20", "FREE"
 */
export function formatRupees(amount: number | null | undefined, isStaff: boolean = false): string {
  if (isStaff || amount === 0) return 'FREE (₹0)';
  if (amount === null || amount === undefined) return '—';
  return `₹${amount}`;
}
