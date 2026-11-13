import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Save,
  Lock,
  RefreshCw,
  Info,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Profile } from '../types';
import { fetchPaymentSettings, updatePaymentSettings } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { parseSupabaseError } from '../lib/errors';

interface SettingsProps {
  profile: Profile | null;
}

// Validation pattern: name@bank (e.g. campus@sbi, parking.gate@icici, 9876543210@upi)
const UPI_PATTERN = /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+$/;

export const Settings: React.FC<SettingsProps> = ({ profile }) => {
  const { showSuccess, showError } = useToast();
  const isAdmin = profile?.role === 'admin';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [payeeName, setPayeeName] = useState('');
  const [payeeVpa, setPayeeVpa] = useState('');
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [vpaError, setVpaError] = useState<string | null>(null);

  // QR preview
  const [previewQr, setPreviewQr] = useState<string>('');

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPaymentSettings();
      setPayeeName(data.payee_name || '');
      setPayeeVpa(data.payee_vpa || '');
      setOnlineEnabled(Boolean(data.online_payments_enabled));
    } catch (err) {
      console.error('Failed to load payment settings:', err);
      const parsed = parseSupabaseError(err);
      showError(parsed.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Update sample QR preview when VPA or Name changes
  useEffect(() => {
    if (!payeeVpa || !UPI_PATTERN.test(payeeVpa)) {
      setPreviewQr('');
      return;
    }
    const sampleLink = `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(
      payeeName || 'Campus Parking'
    )}&am=10.00&cu=INR&tn=${encodeURIComponent('Parking Sample')}`;

    QRCode.toDataURL(sampleLink, { width: 180, margin: 1 })
      .then((url) => setPreviewQr(url))
      .catch(() => setPreviewQr(''));
  }, [payeeName, payeeVpa]);

  const validateVpa = (val: string) => {
    if (!val.trim()) {
      return 'Payee UPI ID is required';
    }
    if (!UPI_PATTERN.test(val.trim())) {
      return 'Invalid UPI ID format. Must match name@bank (e.g. campus@sbi or parking@okaxis)';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const error = validateVpa(payeeVpa);
    if (error) {
      setVpaError(error);
      showError(error);
      return;
    }
    setVpaError(null);

    setIsSaving(true);
    try {
      await updatePaymentSettings({
        payee_name: payeeName,
        payee_vpa: payeeVpa,
        online_payments_enabled: onlineEnabled,
      });
      showSuccess('Payment settings updated successfully. ✓ Saved to database');
    } catch (err) {
      const parsed = parseSupabaseError(err);
      showError(parsed.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#163300] tracking-tight">
            Payment &amp; Gateway Settings
          </h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5">
            Configure UPI merchant ID, payee details, and enable customer-facing online checkouts
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadSettings}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh Settings
        </Button>
      </div>

      {/* Role notice banner */}
      {!isAdmin && (
        <div className="p-4 rounded-2xl bg-[#FFFDF5] border border-[#FEE6A8] flex items-center gap-3">
          <Lock className="w-5 h-5 text-[#8C5200] shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-[#8C5200] block">Operator Read-Only Mode</span>
            <p className="text-[#8C5200] mt-0.5">
              You are signed in with the Guard role. Payment configuration is view-only. Only campus administrators can edit payee UPI details.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Settings Form */}
        <div className="lg:col-span-7">
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#F2F2F0] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EAF9DD] flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-[#163300]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#163300]">
                    Online Payment (UPI) Configuration
                  </h3>
                  <p className="text-[11px] text-[#6B6B6B]">
                    Stored in database table <code className="font-mono text-[#163300]">payment_settings</code>
                  </p>
                </div>
              </div>

              <div
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  onlineEnabled
                    ? 'bg-[#EAF9DD] text-[#163300] border border-[#C5EBA6]'
                    : 'bg-[#F7F7F6] text-[#8C8C8C] border border-[#ECECEC]'
                }`}
              >
                {onlineEnabled ? 'ONLINE PAYMENTS ACTIVE' : 'ONLINE PAYMENTS DISABLED'}
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-[#8C8C8C]">
                Loading payment settings from database...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Toggle Enable Online Payments */}
                <div className="p-4 rounded-xl bg-[#F9FAF8] border border-[#E6EDE0] flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-[#163300] block">
                      Enable Online Payments (UPI)
                    </label>
                    <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                      When enabled, the Check-Out screen displays the 'Collect Online (UPI)' option and generates dynamic QR codes on the customer display.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={onlineEnabled}
                      onChange={(e) => setOnlineEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#E0E0DE] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#ECECEC] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#163300] disabled:opacity-50"></div>
                  </label>
                </div>

                {/* Payee Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                    Payee / Merchant Display Name
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    required
                    placeholder="e.g. Campus Parking BIT Belagavi"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-xl px-3.5 py-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white disabled:bg-[#F2F2F0] disabled:text-[#6B6B6B]"
                  />
                  <p className="text-[11px] text-[#8C8C8C] mt-1">
                    The business or gate cabin name shown to drivers on payment apps (GPay, PhonePe, Paytm).
                  </p>
                </div>

                {/* Payee UPI ID (VPA) */}
                <div>
                  <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
                    Payee UPI ID (VPA)
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    required
                    placeholder="e.g. campusparking@sbi or parking@okaxis"
                    value={payeeVpa}
                    onChange={(e) => {
                      setPayeeVpa(e.target.value);
                      if (vpaError) setVpaError(null);
                    }}
                    className={`w-full font-mono bg-[#F7F7F6] border rounded-xl px-3.5 py-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white disabled:bg-[#F2F2F0] disabled:text-[#6B6B6B] ${
                      vpaError ? 'border-[#D92D20]' : 'border-[#ECECEC]'
                    }`}
                  />
                  {vpaError ? (
                    <p className="text-[11px] text-[#D92D20] mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{vpaError}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#8C8C8C] mt-1">
                      Must follow standard UPI format: <code className="font-mono font-semibold">name@bank</code>. Funds are credited directly to this linked bank account.
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                {isAdmin && (
                  <div className="pt-3 border-t border-[#F2F2F0] flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isSaving}
                      icon={<Save className="w-4 h-4" />}
                    >
                      Save Payment Settings
                    </Button>
                  </div>
                )}
              </form>
            )}
          </Card>
        </div>

        {/* Live Preview Card */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6 space-y-4">
            <h4 className="text-sm font-bold text-[#163300] flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#163300]" />
              <span>Customer QR Display Preview</span>
            </h4>
            <p className="text-xs text-[#6B6B6B]">
              Real-time preview of the UPI payload generated for gate checkout clearance:
            </p>

            <div className="p-4 bg-[#FCFDFC] rounded-2xl border border-[#ECECEC] flex flex-col items-center justify-center text-center space-y-3">
              {previewQr ? (
                <div className="p-3 bg-white rounded-2xl border-2 border-[#9FE870] shadow-sm">
                  <img
                    src={previewQr}
                    alt="Sample Preview QR"
                    className="w-36 h-36 object-contain"
                  />
                </div>
              ) : (
                <div className="w-36 h-36 rounded-2xl bg-[#F7F7F6] border border-dashed border-[#D0D0CE] flex items-center justify-center text-xs text-[#8C8C8C] p-4">
                  Enter valid UPI ID to preview QR
                </div>
              )}

              <div>
                <span className="text-xs font-bold text-[#163300] block">
                  {payeeName || 'Campus Parking'}
                </span>
                <span className="text-[11px] font-mono text-[#6B6B6B] block">
                  {payeeVpa || '—'}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-[#F7F7F6] rounded-xl border border-[#ECECEC] text-[11px] text-[#6B6B6B] space-y-1.5">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-[#163300] shrink-0 mt-0.5" />
                <span>
                  No secret keys or credentials are stored. The QR code contains only the public UPI link with the exact parking fee.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1F9D55] shrink-0 mt-0.5" />
                <span>
                  The guard terminal verifies payments against operator SMS / UPI app receipts before opening the barrier gate.
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
