import { supabase } from './supabase';

export const DISPLAY_CODE_KEY = 'cpvts_display_code';

// Letters A-Z and digits 2-9
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';

export function generateDisplayCode(): string {
  const array = new Uint8Array(10);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += CODE_CHARS[array[i] % CODE_CHARS.length];
  }
  return result;
}

export function getStoredDisplayCode(): string {
  try {
    const existing = localStorage.getItem(DISPLAY_CODE_KEY);
    if (existing && /^[A-Z2-9]{10}$/.test(existing)) {
      return existing;
    }
  } catch {
    // ignore localStorage errors
  }
  const fresh = generateDisplayCode();
  try {
    localStorage.setItem(DISPLAY_CODE_KEY, fresh);
  } catch {
    // ignore
  }
  return fresh;
}

export function saveDisplayCode(code: string): void {
  try {
    localStorage.setItem(DISPLAY_CODE_KEY, code.toUpperCase().trim());
  } catch {
    // ignore
  }
}

export interface ShowMessagePayload {
  id: string;
  type: 'show';
  qr_data_url: string;
  amount: number;
  vehicle_number: string;
  ticket_no: string;
  duration_text: string;
  entry_text: string;
  exit_text: string;
  payee_name: string;
  payee_vpa: string;
  expires_at: number; // timestamp in ms (e.g. now + 8 min)
}

export interface PaidMessagePayload {
  id: string;
  type: 'paid';
  ticket_no: string;
}

export interface IdleMessagePayload {
  id: string;
  type: 'idle';
  rates_text?: string;
}

export type DisplayMessage = ShowMessagePayload | PaidMessagePayload | IdleMessagePayload;

interface InternalBroadcastMsg {
  isInternalPing?: boolean;
  role?: 'display' | 'guard';
  payload?: DisplayMessage;
}

/**
 * Guard Terminal Controller
 * Sends messages over both Supabase Realtime channel and local BroadcastChannel
 * Monitors display presence
 */
export class DisplaySender {
  private code: string;
  private localChannel: BroadcastChannel | null = null;
  private supabaseChannel: any = null;
  private isConnected = false;
  private onConnectionChange?: (connected: boolean) => void;
  private pingInterval: any = null;
  private lastPingFromDisplay = 0;

  constructor(code: string, onConnectionChange?: (connected: boolean) => void) {
    this.code = code;
    this.onConnectionChange = onConnectionChange;
    this.init();
  }

  private init() {
    // 1. Local fast path: BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.localChannel = new BroadcastChannel(`cpvts-display-${this.code}`);
        this.localChannel.onmessage = (event) => {
          const data = event.data as InternalBroadcastMsg;
          if (data && data.role === 'display') {
            this.lastPingFromDisplay = Date.now();
            this.setConnected(true);
          }
        };
      }
    } catch (err) {
      console.warn('BroadcastChannel error on sender:', err);
    }

    // 2. Primary: Supabase Realtime BROADCAST channel
    if (supabase) {
      try {
        this.supabaseChannel = supabase.channel(`display-${this.code}`, {
          config: {
            presence: { key: 'guard' },
            broadcast: { ack: false, self: false },
          },
        });

        this.supabaseChannel
          .on('presence', { event: 'sync' }, () => {
            const state = this.supabaseChannel.presenceState();
            const hasDisplay = Object.values(state).some((presences: any) =>
              Array.isArray(presences) &&
              presences.some((p: any) => p.role === 'display')
            );
            if (hasDisplay) {
              this.lastPingFromDisplay = Date.now();
              this.setConnected(true);
            }
          })
          .on('presence', { event: 'leave' }, () => {
            const state = this.supabaseChannel.presenceState();
            const hasDisplay = Object.values(state).some((presences: any) =>
              Array.isArray(presences) &&
              presences.some((p: any) => p.role === 'display')
            );
            if (!hasDisplay && Date.now() - this.lastPingFromDisplay > 5000) {
              this.setConnected(false);
            }
          })
          .on('broadcast', { event: 'display_heartbeat' }, () => {
            this.lastPingFromDisplay = Date.now();
            this.setConnected(true);
          })
          .subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
              try {
                await this.supabaseChannel.track({ role: 'guard' });
              } catch {
                // ignore
              }
            }
          });
      } catch (err) {
        console.warn('Supabase Realtime channel setup error:', err);
      }
    }

    // Periodic heartbeat check
    this.pingInterval = setInterval(() => {
      // Query display on local broadcast channel
      try {
        this.localChannel?.postMessage({ isInternalPing: true, role: 'guard' });
      } catch {
        // ignore
      }

      // If no ping received for > 6 seconds, consider disconnected
      if (Date.now() - this.lastPingFromDisplay > 6000) {
        if (this.isConnected) {
          this.setConnected(false);
        }
      }
    }, 2500);
  }

  private setConnected(val: boolean) {
    if (this.isConnected !== val) {
      this.isConnected = val;
      this.onConnectionChange?.(val);
    }
  }

  public getConnected(): boolean {
    return this.isConnected;
  }

  public sendMessage(msg: DisplayMessage) {
    // 1. Post to local BroadcastChannel (instant on same machine)
    try {
      this.localChannel?.postMessage({ payload: msg });
    } catch (err) {
      console.warn('Local broadcast error:', err);
    }

    // 2. Post to Supabase Realtime channel
    if (this.supabaseChannel) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'display_message',
          payload: msg,
        });
      } catch (err) {
        console.warn('Supabase broadcast send error:', err);
      }
    }
  }

  public destroy() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.localChannel) {
      try {
        this.localChannel.close();
      } catch {
        // ignore
      }
    }
    if (this.supabaseChannel && supabase) {
      try {
        supabase.removeChannel(this.supabaseChannel);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Customer Display Screen Receiver
 * Listens on both local BroadcastChannel and Supabase Realtime Broadcast channel
 * De-duplicates messages using unique IDs
 * Tracks presence
 */
export class DisplayReceiver {
  private code: string;
  private localChannel: BroadcastChannel | null = null;
  private supabaseChannel: any = null;
  private isConnected = false;
  private onMessage: (msg: DisplayMessage) => void;
  private onConnectionChange?: (connected: boolean) => void;
  private seenIds = new Set<string>();
  private heartbeatInterval: any = null;

  constructor(
    code: string,
    onMessage: (msg: DisplayMessage) => void,
    onConnectionChange?: (connected: boolean) => void
  ) {
    this.code = code;
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
    this.init();
  }

  private handleRawMessage(msg: DisplayMessage) {
    if (!msg || !msg.id || !msg.type) return;
    if (this.seenIds.has(msg.id)) return; // Deduplicate

    this.seenIds.add(msg.id);
    // Keep set bounded to last 100 IDs
    if (this.seenIds.size > 100) {
      const first = this.seenIds.values().next().value;
      if (first) this.seenIds.delete(first);
    }

    this.setConnected(true);
    this.onMessage(msg);
  }

  private init() {
    // 1. Local fast path: BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.localChannel = new BroadcastChannel(`cpvts-display-${this.code}`);
        this.localChannel.onmessage = (event) => {
          const data = event.data as InternalBroadcastMsg;
          if (data?.payload) {
            this.handleRawMessage(data.payload);
          } else if (data?.role === 'guard') {
            this.setConnected(true);
            // Reply with heartbeat
            this.localChannel?.postMessage({ role: 'display' });
          }
        };
        // Announce presence immediately
        this.localChannel.postMessage({ role: 'display' });
      }
    } catch (err) {
      console.warn('BroadcastChannel receiver error:', err);
    }

    // 2. Primary: Supabase Realtime channel
    if (supabase) {
      try {
        this.supabaseChannel = supabase.channel(`display-${this.code}`, {
          config: {
            presence: { key: 'display' },
            broadcast: { ack: false, self: false },
          },
        });

        this.supabaseChannel
          .on('broadcast', { event: 'display_message' }, ({ payload }: { payload: DisplayMessage }) => {
            this.handleRawMessage(payload);
          })
          .subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
              this.setConnected(true);
              try {
                await this.supabaseChannel.track({
                  role: 'display',
                  online_at: Date.now(),
                });
              } catch {
                // ignore
              }
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              this.setConnected(false);
            }
          });
      } catch (err) {
        console.warn('Supabase Realtime receiver error:', err);
      }
    }

    // Regular heartbeat ping
    this.heartbeatInterval = setInterval(() => {
      try {
        this.localChannel?.postMessage({ role: 'display' });
      } catch {
        // ignore
      }

      if (this.supabaseChannel && this.isConnected) {
        try {
          this.supabaseChannel.send({
            type: 'broadcast',
            event: 'display_heartbeat',
            payload: { role: 'display', timestamp: Date.now() },
          });
        } catch {
          // ignore
        }
      }
    }, 2500);
  }

  private setConnected(val: boolean) {
    if (this.isConnected !== val) {
      this.isConnected = val;
      this.onConnectionChange?.(val);
    }
  }

  public getConnected(): boolean {
    return this.isConnected;
  }

  public destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.localChannel) {
      try {
        this.localChannel.close();
      } catch {
        // ignore
      }
    }
    if (this.supabaseChannel && supabase) {
      try {
        supabase.removeChannel(this.supabaseChannel);
      } catch {
        // ignore
      }
    }
  }
}
