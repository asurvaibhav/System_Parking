import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Clock,
  ExternalLink,
  Copy,
  Tv,
  Check,
  CreditCard,
  QrCode,
  AlertTriangle,
} from 'lucide-react';
import { CheckoutPreview, ParkingSession, PaymentSettings } from '../types';
import {
  previewCheckout,
  confirmCheckout,
  fetchPaymentSettings,
} from '../lib/api';
import {
  formatVehicleNumber,
  formatDateTimeIST,
  formatDuration,
  formatRupees,
} from '../lib/format';
import { parseSupabaseError } from '../lib/errors';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pill, PillVariant } from '../components/ui/Pill';
import { Ticket } from '../components/Ticket';
import { useToast } from '../components/ui/Toast';
import {
  getStoredDisplayCode,
  saveDisplayCode,
  generateDisplayCode,
  DisplaySender,
} from '../lib/displaySync';

interface CheckOutProps {
  initialQuery?: string;
  onNavigateToDashboard?: () => void;
}

export const CheckOut: React.FC<CheckOutProps> = ({
  initialQuery = '',
}) => {
  const { showError, showSuccess } = useToast();

  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [completedSession, setCompletedSession] = useState<ParkingSession | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash'>('cash');
  const [feeChangeNotice, setFeeChangeNotice] = useState<string | null>(null);

  // Customer Display pairing code & connection
  const [displayCode, setDisplayCode] = useState<string>(getStoredDisplayCode);
  const [isDisplayConnected, setIsDisplayConnected] = useState(false);
  const displaySenderRef = useRef<DisplaySender | null>(null);

  // Payment settings from database
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);

  // Online (UPI) Waiting State
  const [isWaitingForUpi, setIsWaitingForUpi] = useState(false);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');
  const [upiExpiresAt, setUpiExpiresAt] = useState<number>(0);
  const [isSawPaymentChecked, setIsSawPaymentChecked] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  const ratesText =
    'Two-Wheeler: ₹10/hr (First 2 hrs free for students) • Four-Wheeler: ₹20/hr • Campus Staff: Free';

  // Load payment settings on mount
  useEffect(() => {
    fetchPaymentSettings()
      .then((settings) => setPaymentSettings(settings))
      .catch((err) => console.warn('Could not load payment settings:', err));
  }, []);

  // Initialize display sender
  useEffect(() => {
    const sender = new DisplaySender(displayCode, (connected) => {
      setIsDisplayConnected(connected);
    });
    displaySenderRef.current = sender;

    // Send initial idle state
    sender.sendMessage({
      id: crypto.randomUUID(),
      type: 'idle',
      rates_text: ratesText,
    });

    return () => {
      sender.destroy();
    };
  }, [displayCode]);

  // Countdown timer for active QR code
  useEffect(() => {
    if (!isWaitingForUpi || upiExpiresAt <= 0) return;

    const tick = () => {
      const diff = Math.max(0, Math.floor((upiExpiresAt - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isWaitingForUpi, upiExpiresAt]);

  const countdownText = useMemo(() => {
    const m = Math.floor(secondsRemaining / 60);
    const s = secondsRemaining % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, [secondsRemaining]);

  // If initialQuery is passed, automatically trigger search
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async (queryToSearch: string) => {
    if (!queryToSearch.trim()) {
      showError('Please enter a vehicle number or spot code');
      return;
    }

    setIsSearching(true);
    setPreview(null);
    setCompletedSession(null);
    setIsWaitingForUpi(false);
    setIsSawPaymentChecked(false);
    setFeeChangeNotice(null);

    try {
      const data = await previewCheckout(queryToSearch.trim());
      setPreview(data);
    } catch (err) {
      const parsed = parseSupabaseError(err);
      showError(parsed.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleRefreshTime = async () => {
    if (preview) {
      handleSearch(preview.vehicle_number);
    }
  };

  // 1. Existing Cash Checkout flow
  const handleConfirmExitCash = async () => {
    if (!preview) return;

    setIsConfirming(true);
    try {
      const completed = await confirmCheckout(
        preview.session_id,
        preview.exit_time,
        'cash'
      );
      setCompletedSession(completed);
      setPaymentMethod('cash');
      setPreview(null);
      setIsWaitingForUpi(false);
      setFeeChangeNotice(null);

      // Tell display to return to idle
      displaySenderRef.current?.sendMessage({
        id: crypto.randomUUID(),
        type: 'idle',
        rates_text: ratesText,
      });

      const paidMsg =
        preview.fee > 0 && preview.owner_category !== 'staff'
          ? ` (Paid ₹${preview.fee} in Cash)`
          : '';
      showSuccess(
        `Exit cleared for ${formatVehicleNumber(completed.vehicle_number)}${paidMsg}. Slot ${completed.slot_code} is now available. ✓ Saved to database`
      );
    } catch (err) {
      const parsed = parseSupabaseError(err);
      showError(parsed.message);
    } finally {
      setIsConfirming(false);
    }
  };

  // 2. Initiate Online Payment (UPI) flow
  const handleStartOnlinePayment = async () => {
    if (!preview || !paymentSettings?.payee_vpa) return;

    try {
      const payeeVpa = paymentSettings.payee_vpa;
      const payeeName = paymentSettings.payee_name || 'Campus Parking';
      const feeVal = preview.fee;
      const ticketNo = preview.ticket_no;

      const upiUrl = `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(
        payeeName
      )}&am=${feeVal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Parking ${ticketNo}`)}`;

      const qrUrl = await QRCode.toDataURL(upiUrl, {
        width: 380,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#163300', light: '#FFFFFF' },
      });

      const expires = Date.now() + 8 * 60 * 1000; // 8 minutes per spec
      setUpiQrDataUrl(qrUrl);
      setUpiExpiresAt(expires);
      setIsSawPaymentChecked(false);
      setIsWaitingForUpi(true);

      // Send 'show' message to customer display
      displaySenderRef.current?.sendMessage({
        id: crypto.randomUUID(),
        type: 'show',
        qr_data_url: qrUrl,
        amount: feeVal,
        vehicle_number: preview.vehicle_number,
        ticket_no: ticketNo,
        duration_text: formatDuration(preview.duration_minutes),
        entry_text: formatDateTimeIST(preview.entry_time),
        exit_text: formatDateTimeIST(preview.exit_time),
        payee_name: payeeName,
        payee_vpa: payeeVpa,
        expires_at: expires,
      });
    } catch (err) {
      console.error('Failed to generate payment QR code:', err);
      showError('Failed to generate UPI payment QR');
    }
  };

  // 3. Confirm UPI Payment & Exit
  const handleConfirmUpiPayment = async () => {
    if (!preview) return;

    setIsConfirming(true);
    try {
      const expectedAmount = preview.fee;
      const completed = await confirmCheckout(
        preview.session_id,
        preview.exit_time,
        'upi'
      );

      // Send 'paid' message to customer display
      displaySenderRef.current?.sendMessage({
        id: crypto.randomUUID(),
        type: 'paid',
        ticket_no: preview.ticket_no,
      });

      // Check if returned fee differs from QR amount
      if (completed.fee !== null && completed.fee !== expectedAmount) {
        setFeeChangeNotice(
          `Fee changed from ₹${expectedAmount} to ₹${completed.fee}. Collect the difference.`
        );
      } else {
        setFeeChangeNotice(null);
      }

      setCompletedSession(completed);
      setPaymentMethod('upi');
      setPreview(null);
      setIsWaitingForUpi(false);
      showSuccess(
        `Payment confirmed for ${formatVehicleNumber(completed.vehicle_number)} (Paid ₹${completed.fee} via UPI). Slot ${completed.slot_code} is now available. ✓ Saved to database`
      );
    } catch (err) {
      const parsed = parseSupabaseError(err);
      showError(parsed.message);
    } finally {
      setIsConfirming(false);
    }
  };

  // 4. Cancel Online Payment
  const handleCancelOnlinePayment = () => {
    setIsWaitingForUpi(false);
    setIsSawPaymentChecked(false);
    // Send 'idle' to customer display
    displaySenderRef.current?.sendMessage({
      id: crypto.randomUUID(),
      type: 'idle',
      rates_text: ratesText,
    });
  };

  // 5. Regenerate QR (calls preview_checkout again)
  const handleRegenerateQr = async () => {
    if (!preview) return;
    try {
      const freshPreview = await previewCheckout(preview.vehicle_number);
      setPreview(freshPreview);

      const payeeVpa = paymentSettings?.payee_vpa || '';
      const payeeName = paymentSettings?.payee_name || 'Campus Parking';
      const feeVal = freshPreview.fee;
      const ticketNo = freshPreview.ticket_no;

      const upiUrl = `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(
        payeeName
      )}&am=${feeVal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Parking ${ticketNo}`)}`;

      const qrUrl = await QRCode.toDataURL(upiUrl, {
        width: 380,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#163300', light: '#FFFFFF' },
      });

      const expires = Date.now() + 8 * 60 * 1000;
      setUpiQrDataUrl(qrUrl);
      setUpiExpiresAt(expires);
      setIsSawPaymentChecked(false);

      displaySenderRef.current?.sendMessage({
        id: crypto.randomUUID(),
        type: 'show',
        qr_data_url: qrUrl,
        amount: feeVal,
        vehicle_number: freshPreview.vehicle_number,
        ticket_no: ticketNo,
        duration_text: formatDuration(freshPreview.duration_minutes),
        entry_text: formatDateTimeIST(freshPreview.entry_time),
        exit_text: formatDateTimeIST(freshPreview.exit_time),
        payee_name: payeeName,
        payee_vpa: payeeVpa,
        expires_at: expires,
      });

      showSuccess('QR code regenerated with updated server time and amount.');
    } catch (err) {
      const parsed = parseSupabaseError(err);
      showError(parsed.message);
    }
  };

  // Reset entire check-out view
  const handleReset = () => {
    setQuery('');
    setPreview(null);
    setCompletedSession(null);
    setIsWaitingForUpi(false);
    setIsSawPaymentChecked(false);
    setPaymentMethod('cash');
    setFeeChangeNotice(null);

    // Send idle to display
    displaySenderRef.current?.sendMessage({
      id: crypto.randomUUID(),
      type: 'idle',
      rates_text: ratesText,
    });
  };

  // Customer Display Header Chip Handlers
  const handleOpenSecondScreen = () => {
    if (typeof window !== 'undefined' && window.cpvtsDesktop?.openCustomerDisplay) {
      window.cpvtsDesktop.openCustomerDisplay(displayCode);
    } else {
      window.open(
        `${window.location.origin}${window.location.pathname}#/display?code=${displayCode}`,
        'cpvts-display',
        'width=1280,height=800'
      );
      showSuccess('Drag this window to the second screen and press F11');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(displayCode);
    showSuccess(`Display pairing code ${displayCode} copied to clipboard`);
  };

  const handleNewCode = () => {
    const fresh = generateDisplayCode();
    saveDisplayCode(fresh);
    setDisplayCode(fresh);
    showSuccess(`New display pairing code generated: ${fresh}`);
  };

  const getPillVariant = (cat: string): PillVariant => {
    if (cat === 'staff') return 'purple';
    if (cat === 'student') return 'info';
    return 'warning';
  };

  const canShowOnlinePaymentBtn =
    Boolean(paymentSettings?.online_payments_enabled) &&
    Boolean(paymentSettings?.payee_vpa) &&
    Boolean(preview && preview.fee > 0 && preview.owner_category !== 'staff');

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Customer Display Header Chip & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#163300] tracking-tight">
            Gate Check-Out &amp; Exit Clearance
          </h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5">
            Lookup active parking sessions by vehicle registration or spot code to compute fee
          </p>
        </div>

        {/* Customer Display Chip */}
        <div className="flex flex-wrap items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-[#ECECEC] shadow-2xs">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-[#163300]" />
            <span className="text-xs font-bold text-[#163300]">Customer Display</span>
            <span className="font-mono font-bold text-xs bg-[#F7F7F6] border border-[#ECECEC] px-2 py-0.5 rounded text-[#163300]">
              {displayCode}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[#ECECEC] mx-1" />

          {/* Connected status */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                isDisplayConnected ? 'bg-[#1F9D55]' : 'bg-[#E58300]'
              }`}
            />
            <span className={isDisplayConnected ? 'text-[#163300]' : 'text-[#8C5200]'}>
              {isDisplayConnected ? 'Display connected' : 'Display not connected'}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[#ECECEC] mx-1" />

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleOpenSecondScreen}
              className="px-2.5 py-1 text-xs font-medium text-[#163300] hover:bg-[#F2F2F0] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Open on 2nd screen or popout window"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open on 2nd screen</span>
            </button>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1 text-[#6B6B6B] hover:text-[#163300] hover:bg-[#F2F2F0] rounded-lg transition-colors cursor-pointer"
              title="Copy pairing code"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNewCode}
              className="p-1 text-[#6B6B6B] hover:text-[#163300] hover:bg-[#F2F2F0] rounded-lg transition-colors cursor-pointer"
              title="Generate new pairing code"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {completedSession ? (
        /* Completed Exit Ticket Soft Copy */
        <div className="animate-in fade-in duration-200 space-y-4">
          <div className="text-center mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF9DD] border border-[#C5EBA6] text-[#163300] text-xs font-bold uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1F9D55]" />
              <span>Clearance Finalized</span>
              <span className="text-[#1F9D55] font-extrabold">✓ Saved to database</span>
            </div>
            <h3 className="text-xl font-bold text-[#163300]">
              Exit Clearance Ticket Issued
            </h3>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              Slot {completedSession.slot_code} has been freed. Soft-copy ticket available below.
            </p>
          </div>

          {/* Fee Changed Notice if applicable */}
          {feeChangeNotice && (
            <div className="max-w-[390px] mx-auto p-3.5 rounded-xl bg-[#FFFDF5] border-2 border-[#E58300] text-[#8C5200] font-bold text-xs flex items-center gap-2.5 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-[#E58300] shrink-0" />
              <span>{feeChangeNotice}</span>
            </div>
          )}

          <Ticket
            ticket={completedSession}
            paymentMethod={paymentMethod}
            onNewAction={handleReset}
            newActionLabel="New Check-Out"
          />
        </div>
      ) : (
        /* Check-Out Lookup & Fee Preview */
        <div className="space-y-6">
          {/* Lookup Input Card */}
          <Card className="max-w-2xl mx-auto p-6">
            <form onSubmit={handleSubmitSearch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                  Enter Vehicle Number or Spot ID
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#8C8C8C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. KA22AB1234 or T-02"
                      value={query}
                      onChange={(e) => setQuery(e.target.value.toUpperCase())}
                      className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold tracking-wider text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white uppercase"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSearching}
                    icon={<Search className="w-4 h-4" />}
                  >
                    Find Vehicle
                  </Button>
                </div>
                <p className="text-[11px] text-[#8C8C8C] mt-2">
                  Tip: You can search by registration number (e.g. KA22AB1234, 22BH1234AA) or slot code (e.g. T-02, F-15).
                </p>
              </div>
            </form>
          </Card>

          {/* Fee Preview & Exit Confirmation */}
          {preview && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-2 duration-200">
              <Card className="border-2 border-[#9FE870] p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-[#F2F2F0] pb-4">
                  <div>
                    <span className="text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider">
                      Active Parking Session
                    </span>
                    <h3 className="text-xl font-bold text-[#163300] font-mono mt-0.5">
                      {formatVehicleNumber(preview.vehicle_number)}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill variant={getPillVariant(preview.owner_category)}>
                      {preview.owner_category.toUpperCase()}
                    </Pill>
                    <span className="font-bold text-xs bg-[#EAF9DD] text-[#163300] px-2.5 py-1 rounded-full">
                      Spot {preview.slot_code}
                    </span>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-[#F7F7F6] rounded-xl border border-[#ECECEC]">
                    <span className="text-[#8C8C8C] block text-[11px]">Server Entry Time (IST)</span>
                    <span className="font-semibold text-[#1A1A1A] tabular-nums mt-0.5 block">
                      {formatDateTimeIST(preview.entry_time)}
                    </span>
                  </div>

                  <div className="p-3 bg-[#F7F7F6] rounded-xl border border-[#ECECEC]">
                    <span className="text-[#8C8C8C] block text-[11px]">Server Exit Time (IST)</span>
                    <span className="font-semibold text-[#1A1A1A] tabular-nums mt-0.5 block">
                      {formatDateTimeIST(preview.exit_time)}
                    </span>
                  </div>

                  <div className="p-3 bg-[#F7F7F6] rounded-xl border border-[#ECECEC]">
                    <span className="text-[#8C8C8C] block text-[11px]">Total Duration</span>
                    <span className="font-bold text-[#163300] text-sm tabular-nums mt-0.5 block">
                      {formatDuration(preview.duration_minutes)}
                    </span>
                  </div>

                  <div className="p-3 bg-[#F7F7F6] rounded-xl border border-[#ECECEC]">
                    <span className="text-[#8C8C8C] block text-[11px]">Vehicle Classification</span>
                    <span className="font-semibold text-[#1A1A1A] mt-0.5 block">
                      {preview.vehicle_type === 'two_wheeler' ? 'Two-Wheeler (Bike)' : 'Four-Wheeler (Car)'}
                    </span>
                  </div>
                </div>

                {/* Tariff Math Breakdown */}
                <div className="p-4 rounded-xl bg-[#F9FAF8] border border-[#E0EBD8] space-y-2 text-xs">
                  <div className="font-semibold text-[#163300] flex items-center justify-between">
                    <span>Tariff Breakdown</span>
                    <span className="text-[11px] text-[#6B6B6B] font-normal">
                      Ceil(chargeable min × rate / 60)
                    </span>
                  </div>

                  <div className="flex justify-between text-[#555555]">
                    <span>Free Time Deducted:</span>
                    <span className="font-medium tabular-nums">{preview.free_minutes} min</span>
                  </div>

                  <div className="flex justify-between text-[#555555]">
                    <span>Chargeable Duration:</span>
                    <span className="font-medium tabular-nums">{preview.chargeable_minutes} min</span>
                  </div>

                  <div className="flex justify-between text-[#555555]">
                    <span>Applicable Hourly Rate:</span>
                    <span className="font-medium tabular-nums">
                      {preview.owner_category === 'staff' ? '₹0/hr' : `₹${preview.rate_per_hour}/hr`}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[#DDE6D5] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#163300]">
                        Total Amount Due
                      </span>
                      <p className="text-[11px] text-[#6B6B6B]">
                        {preview.owner_category === 'staff'
                          ? 'Staff parking is exempt from parking fees'
                          : 'Pro-rata billing per minute, rounded up to whole rupee'}
                      </p>
                    </div>
                    <div className="text-2xl font-extrabold text-[#163300] tabular-nums">
                      {formatRupees(preview.fee, preview.owner_category === 'staff')}
                    </div>
                  </div>
                </div>

                {/* WAITING FOR PAYMENT PANEL (UPI) */}
                {isWaitingForUpi ? (
                  <div className="p-5 rounded-2xl bg-[#FCFDFC] border-2 border-[#163300] space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-[#F0F0EE] pb-3">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-[#163300]" />
                        <h4 className="text-sm font-bold text-[#163300]">
                          Waiting for Online UPI Payment
                        </h4>
                      </div>

                      {/* Display connection indicator */}
                      {!isDisplayConnected ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFDF5] border border-[#FEE6A8] text-[#8C5200]">
                          Display not connected
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF9DD] border border-[#C5EBA6] text-[#163300]">
                          Display live on screen
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      {/* Small QR preview */}
                      <div className="p-2 bg-white rounded-xl border border-[#ECECEC] shadow-2xs shrink-0">
                        {upiQrDataUrl ? (
                          <img
                            src={upiQrDataUrl}
                            alt="Payment QR"
                            className="w-32 h-32 object-contain"
                          />
                        ) : (
                          <div className="w-32 h-32 bg-[#F7F7F6] rounded flex items-center justify-center text-xs text-[#8C8C8C]">
                            Loading QR...
                          </div>
                        )}
                      </div>

                      {/* Amount and countdown details */}
                      <div className="flex-1 space-y-2 text-xs">
                        <div>
                          <span className="text-[#8C8C8C] block text-[11px]">Amount to Collect</span>
                          <span className="text-3xl font-black text-[#163300] tabular-nums">
                            ₹{preview.fee.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="w-4 h-4 text-[#8C5200]" />
                          {secondsRemaining > 0 ? (
                            <span className="font-semibold text-[#8C5200]">
                              QR valid for <strong className="font-mono">{countdownText}</strong>
                            </span>
                          ) : (
                            <span className="font-bold text-[#D92D20]">
                              QR expired. Please regenerate QR.
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[#6B6B6B]">
                          Payee: <strong>{paymentSettings?.payee_name}</strong> ({paymentSettings?.payee_vpa})
                        </p>
                      </div>
                    </div>

                    {/* Operator confirmation checkbox */}
                    <div className="p-3 bg-[#F9FAF8] rounded-xl border border-[#E6EDE0]">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSawPaymentChecked}
                          onChange={(e) => setIsSawPaymentChecked(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-[#D0D0CE] text-[#163300] focus:ring-[#9FE870] cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-[#163300] select-none">
                          I saw the payment in my UPI app or bank message
                        </span>
                      </label>
                    </div>

                    {/* Action buttons inside waiting panel */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRegenerateQr}
                          icon={<RefreshCw className="w-3.5 h-3.5" />}
                        >
                          Regenerate QR
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelOnlinePayment}
                        >
                          Cancel
                        </Button>
                      </div>

                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        disabled={!isSawPaymentChecked || secondsRemaining <= 0 || isConfirming}
                        isLoading={isConfirming}
                        onClick={handleConfirmUpiPayment}
                        icon={<Check className="w-4 h-4" />}
                      >
                        Payment received - Confirm Exit
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Normal Action Buttons Bar */
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshTime}
                        icon={<RefreshCw className="w-3.5 h-3.5" />}
                      >
                        Refresh Time
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                      >
                        Cancel
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Collect Online (UPI) button: only if online payments enabled, payee vpa set, fee > 0 */}
                      {canShowOnlinePaymentBtn && (
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={handleStartOnlinePayment}
                          className="border-[#163300] text-[#163300] hover:bg-[#EAF9DD]"
                          icon={<CreditCard className="w-4 h-4 text-[#163300]" />}
                        >
                          Collect Online (UPI)
                        </Button>
                      )}

                      {/* Cash Checkout button: always available per spec */}
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        isLoading={isConfirming}
                        onClick={handleConfirmExitCash}
                        icon={<LogOut className="w-4 h-4 text-[#163300]" />}
                      >
                        {preview.fee > 0 && preview.owner_category !== 'staff'
                          ? `Confirm Exit & Free Slot (Cash ₹${preview.fee})`
                          : 'Confirm Exit & Free Slot'}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
