export interface ParsedError {
  message: string;
  code: string;
  shouldSignOut?: boolean;
  shouldRefreshSlots?: boolean;
}

export function parseSupabaseError(error: unknown): ParsedError {
  if (!error) {
    return { message: 'An unexpected error occurred.', code: 'UNKNOWN' };
  }

  const err = error as { message?: string; code?: string; details?: string };
  const rawMsg = err.message || (typeof error === 'string' ? error : '');
  const errCode = err.code || '';

  // Expected user input/lookup validation outcomes (do not log as server crashes)
  const isExpectedUserFlow =
    rawMsg.includes('NO_ACTIVE_SESSION') ||
    rawMsg.includes('INVALID_VEHICLE_NUMBER') ||
    rawMsg.includes('SLOT_NOT_FOUND') ||
    rawMsg.includes('SLOT_NOT_AVAILABLE') ||
    rawMsg.includes('SLOT_TYPE_MISMATCH') ||
    rawMsg.includes('DUPLICATE_ACTIVE_VEHICLE') ||
    rawMsg.includes('INVALID_CREDENTIALS') ||
    rawMsg.includes('USERNAME_TAKEN') ||
    rawMsg.includes('INVALID_USERNAME') ||
    rawMsg.includes('INVALID_NAME') ||
    rawMsg.includes('INVALID_ACCESS_CODE') ||
    rawMsg.includes('ALREADY_REGISTERED') ||
    rawMsg.includes('TARIFF_NOT_FOUND') ||
    rawMsg.includes('INVALID_PAYMENT_METHOD');

  if (!isExpectedUserFlow && errCode !== 'PGRST116') {
    console.warn('Supabase operation notice:', error);
  }

  // Auth / session
  if (rawMsg.includes('NOT_AUTHENTICATED') || errCode === 'NOT_AUTHENTICATED') {
    return {
      message: 'Session expired or not signed in. Please log in with staff credentials.',
      code: 'NOT_AUTHENTICATED',
      shouldSignOut: true,
    };
  }

  if (errCode === '42501' || rawMsg.toLowerCase().includes('permission denied')) {
    return {
      message: 'Permission denied. Please ensure you are logged in with valid gate staff credentials.',
      code: '42501',
      shouldSignOut: true,
    };
  }

  // Registration specific errors
  if (rawMsg.includes('INVALID_ACCESS_CODE')) {
    return {
      message: 'Access code not required. Only username and password are required to log in.',
      code: 'INVALID_ACCESS_CODE',
    };
  }

  if (rawMsg.includes('USERNAME_TAKEN')) {
    return {
      message: 'Username already taken.',
      code: 'USERNAME_TAKEN',
    };
  }

  if (rawMsg.includes('INVALID_USERNAME')) {
    return {
      message: 'Invalid username. Must be 3–20 characters consisting of a-z, 0-9, dot (.) or underscore (_).',
      code: 'INVALID_USERNAME',
    };
  }

  if (rawMsg.includes('INVALID_NAME')) {
    return {
      message: 'Invalid full name provided.',
      code: 'INVALID_NAME',
    };
  }

  // Rate limits & auth signup
  if (errCode === 'over_email_send_rate_limit' || rawMsg.toLowerCase().includes('rate limit')) {
    return {
      message: 'Too many registration emails. Ask the admin to switch off Confirm email in Supabase.',
      code: 'RATE_LIMIT',
    };
  }

  if (rawMsg.toLowerCase().includes('already registered') || rawMsg.toLowerCase().includes('already exists')) {
    return {
      message: 'This email is already registered. Please log in.',
      code: 'ALREADY_REGISTERED',
    };
  }

  if (rawMsg.includes('INVALID_CREDENTIALS') || rawMsg.toLowerCase().includes('invalid login credentials')) {
    return {
      message: 'Invalid email/username or password.',
      code: 'INVALID_CREDENTIALS',
    };
  }

  // Config / URL errors
  if (errCode === 'PGRST125' || rawMsg.includes('Invalid path specified')) {
    return {
      message: 'Invalid Supabase URL path. The Project URL must be formatted as https://<project-ref>.supabase.co without /rest/v1.',
      code: 'PGRST125',
    };
  }

  if (errCode === 'PGRST202' || rawMsg.includes('Could not find the function')) {
    return {
      message: 'Database function not found. Please run cpvts_schema.sql in your Supabase SQL editor.',
      code: 'PGRST202',
    };
  }

  // Parking operations
  if (rawMsg.includes('INVALID_VEHICLE_NUMBER')) {
    return {
      message: 'Enter a valid vehicle number, e.g. KA-22-AB-1234 or 22-BH-1234-A',
      code: 'INVALID_VEHICLE_NUMBER',
    };
  }

  if (rawMsg.includes('SLOT_NOT_FOUND')) {
    return {
      message: 'Slot not found.',
      code: 'SLOT_NOT_FOUND',
      shouldRefreshSlots: true,
    };
  }

  if (rawMsg.includes('SLOT_TYPE_MISMATCH')) {
    return {
      message: 'Selected slot does not match the vehicle type.',
      code: 'SLOT_TYPE_MISMATCH',
    };
  }

  if (rawMsg.includes('SLOT_NOT_AVAILABLE')) {
    return {
      message: 'That slot was just taken. Please choose another available slot.',
      code: 'SLOT_NOT_AVAILABLE',
      shouldRefreshSlots: true,
    };
  }

  if (rawMsg.includes('DUPLICATE_ACTIVE_VEHICLE')) {
    return {
      message: 'This vehicle already has an active parking session.',
      code: 'DUPLICATE_ACTIVE_VEHICLE',
    };
  }

  if (rawMsg.includes('NO_ACTIVE_SESSION')) {
    return {
      message: 'No active parked vehicle found for that vehicle number or spot ID.',
      code: 'NO_ACTIVE_SESSION',
    };
  }

  if (rawMsg.includes('TARIFF_NOT_FOUND')) {
    return {
      message: 'Tariff rule not found for this vehicle type. Contact administrator.',
      code: 'TARIFF_NOT_FOUND',
    };
  }

  if (rawMsg.includes('INVALID_PAYMENT_METHOD')) {
    return {
      message: 'Invalid payment method.',
      code: 'INVALID_PAYMENT_METHOD',
    };
  }

  if (errCode === '23505' || rawMsg.includes('23505') || rawMsg.includes('unique constraint') || rawMsg.includes('one_active_session')) {
    return {
      message: 'This vehicle or slot already has an active parked session.',
      code: '23505',
    };
  }

  return {
    message: rawMsg || 'An unexpected database error occurred. Check browser console for details.',
    code: errCode || 'SERVER_ERROR',
  };
}
