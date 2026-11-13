import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL as FALLBACK_URL, SUPABASE_ANON_KEY as FALLBACK_KEY } from './supabaseConfig';

export function sanitizeSupabaseUrl(url: string | undefined | null): string {
  if (!url) return '';
  let u = url.trim();
  u = u.replace(/^["']|["']$/g, '');
  u = u.replace(/\/+$/, '');
  const dashboardMatch = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashboardMatch) {
    u = `https://${dashboardMatch[1]}.supabase.co`;
  }
  u = u.replace(/\/rest\/v1\/?$/i, '');
  u = u.replace(/\/rest\/?$/i, '');
  u = u.replace(/\/v1\/?$/i, '');
  u = u.replace(/\/+$/, '');
  return u;
}

export function sanitizeSupabaseKey(key: string | undefined | null): string {
  if (!key) return '';
  return key.trim().replace(/^["']|["']$/g, '');
}

const rawEnvUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawEnvKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const effectiveRawUrl = rawEnvUrl && rawEnvUrl.trim() !== '' ? rawEnvUrl : FALLBACK_URL;
const effectiveRawKey = rawEnvKey && rawEnvKey.trim() !== '' ? rawEnvKey : FALLBACK_KEY;

export const supabaseUrl = sanitizeSupabaseUrl(effectiveRawUrl);
export const supabaseAnonKey = sanitizeSupabaseKey(effectiveRawKey);

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'PASTE_URL_HERE' &&
  supabaseAnonKey !== 'PASTE_ANON_KEY_HERE' &&
  !supabaseUrl.includes('PASTE_URL_HERE') &&
  !supabaseAnonKey.includes('PASTE_ANON_KEY_HERE') &&
  /^https?:\/\//i.test(supabaseUrl)
);

let clientInstance: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}

export const supabase = clientInstance;
