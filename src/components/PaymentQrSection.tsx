import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  CheckCircle2,
  Copy,
  Check,
  Smartphone,
  Banknote,
  Edit2,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Button } from './ui/Button';

interface PaymentQrSectionProps {
  fee: number;
  vehicleNumber: string;
  slotCode: string;
  isStaff: boolean;
  paymentMethod: 'upi' | 'cash';
  setPaymentMethod: (method: 'upi' | 'cash') => void;
  isPaid: boolean;
  setIsPaid: (paid: boolean) => void;
}

const DEFAULT_UPI_ID = 'campus.parking@upi';
const DEFAULT_MERCHANT_NAME = 'Campus Parking CPVTS';

export const PaymentQrSection: React.FC<PaymentQrSectionProps> = ({
  fee,
  vehicleNumber,
  slotCode,
  isStaff,
  paymentMethod,
  setPaymentMethod,
  isPaid,
  setIsPaid,
}) => {
  const [upiId, setUpiId] = useState<string>(DEFAULT_UPI_ID);
  const [merchantName, setMerchantName] = useState<string>(DEFAULT_MERCHANT_NAME);

  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [tempUpiId, setTempUpiId] = useState(DEFAULT_UPI_ID);
  const [tempMerchantName, setTempMerchantName] = useState(DEFAULT_MERCHANT_NAME);

  // QR Mode: dynamic UPI link vs custom standee image
  const [qrMode, setQrMode] = useState<'dynamic' | 'custom'>('dynamic');
  const [customQrImage, setCustomQrImage] = useState<string | null>(null);

  const [dynamicQrDataUrl, setDynamicQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Cash change helper state
  const [cashTendered, setCashTendered] = useState<number | ''>('');

  // UPI deep link
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    merchantName
  )}&am=${fee}&cu=INR&tn=${encodeURIComponent(`Parking Fee ${vehicleNumber} Slot ${slotCode}`)}`;

  // Generate dynamic QR code whenever fee, upiId, merchantName or vehicleNumber changes
  useEffect(() => {
    if (fee <= 0 || isStaff) {
      setDynamicQrDataUrl('');
      return;
    }

    let isMounted = true;
    QRCode.toDataURL(upiLink, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 240,
      color: {
        dark: '#163300',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) setDynamicQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate payment QR code', err);
      });

    return () => {
      isMounted = false;
    };
  }, [upiLink, fee, isStaff]);

  const handleSaveUpiConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = tempUpiId.trim() || DEFAULT_UPI_ID;
    const cleanName = tempMerchantName.trim() || DEFAULT_MERCHANT_NAME;
    setUpiId(cleanId);
    setMerchantName(cleanName);
    setIsEditingUpi(false);
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCustomQrImage(result);
        setQrMode('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveCustomQr = () => {
    setCustomQrImage(null);
    setQrMode('dynamic');
  };

  if (isStaff || fee === 0) {
    return (
      <div className="p-4 rounded-xl bg-[#EAF9DD] border border-[#C5EBA6] flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-[#163300] shrink-0" />
        <div>
          <span className="text-xs font-bold text-[#163300] block">
            No Payment Required (₹0)
          </span>
          <p className="text-[11px] text-[#476C24] mt-0.5">
            {isStaff
              ? 'Campus Staff parking is 100% exempt from exit fees.'
              : 'Exit is within free time grace period. Free exit cleared.'}
          </p>
        </div>
      </div>
    );
  }

  const changeDue =
    typeof cashTendered === 'number' && cashTendered >= fee ? cashTendered - fee : 0;

  return (
    <div className="space-y-4">
      {/* Payment Header & Method Switcher */}
      <div className="p-4 rounded-2xl bg-white border border-[#ECECEC] shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#F2F2F0] pb-3">
          <div>
            <h4 className="text-sm font-bold text-[#163300] flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#163300]" />
              Payment Collection &amp; QR Code
            </h4>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">
              Collect exit fee before releasing barrier gate
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#F7F7F6] p-1 rounded-xl border border-[#ECECEC]">
            <button
              type="button"
              onClick={() => setPaymentMethod('upi')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                paymentMethod === 'upi'
                  ? 'bg-white text-[#163300] shadow-xs border border-[#E0E0DE]'
                  : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>UPI / QR</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'bg-white text-[#163300] shadow-xs border border-[#E0E0DE]'
                  : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Cash</span>
            </button>
          </div>
        </div>

        {/* UPI / QR Code View */}
        {paymentMethod === 'upi' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Top UPI Info Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#F9FAF8] rounded-xl border border-[#E6EDE0] text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#163300]">Amount Due:</span>
                <span className="text-base font-extrabold text-[#163300] tabular-nums">
                  ₹{fee}
                </span>
                <span className="text-[10px] bg-[#EAF9DD] text-[#163300] font-bold px-2 py-0.5 rounded-full">
                  Auto-encoded in QR
                </span>
              </div>

              {/* QR Mode Switcher */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setQrMode('dynamic')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    qrMode === 'dynamic'
                      ? 'bg-[#163300] text-white font-bold'
                      : 'text-[#6B6B6B] hover:bg-[#EAEAEA]'
                  }`}
                >
                  Dynamic UPI QR
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode('custom')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    qrMode === 'custom'
                      ? 'bg-[#163300] text-white font-bold'
                      : 'text-[#6B6B6B] hover:bg-[#EAEAEA]'
                  }`}
                >
                  Custom QR Standee
                </button>
              </div>
            </div>

            {/* QR Code Presentation Box */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 bg-[#FCFDFC] rounded-2xl border border-[#ECECEC]">
              {/* QR Image Container */}
              <div className="flex flex-col items-center">
                <div className="p-3 bg-white border-2 border-[#9FE870] rounded-2xl shadow-sm relative group">
                  {qrMode === 'dynamic' ? (
                    dynamicQrDataUrl ? (
                      <img
                        src={dynamicQrDataUrl}
                        alt={`UPI Payment QR for ₹${fee}`}
                        className="w-44 h-44 object-contain"
                      />
                    ) : (
                      <div className="w-44 h-44 bg-[#F7F7F6] rounded-xl flex items-center justify-center">
                        <QrCode className="w-10 h-10 text-[#8C8C8C] animate-pulse" />
                      </div>
                    )
                  ) : customQrImage ? (
                    <img
                      src={customQrImage}
                      alt="Custom Merchant QR Standee"
                      className="w-44 h-44 object-contain"
                    />
                  ) : (
                    <div className="w-44 h-44 bg-[#F7F7F6] rounded-xl flex flex-col items-center justify-center p-3 text-center border border-dashed border-[#CCCCCC]">
                      <ImageIcon className="w-8 h-8 text-[#8C8C8C] mb-2" />
                      <span className="text-[11px] text-[#6B6B6B]">
                        No custom QR uploaded
                      </span>
                      <label className="mt-2 text-[11px] font-bold text-[#163300] bg-[#EAF9DD] px-2.5 py-1 rounded cursor-pointer hover:bg-[#D5F2BC]">
                        Upload QR
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {/* Overlaid Pill Badge */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#163300] text-[#9FE870] font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider whitespace-nowrap">
                    Scan to Pay ₹{fee}
                  </div>
                </div>

                {/* Subtext */}
                <p className="text-[11px] text-[#8C8C8C] mt-4 font-medium text-center">
                  Point phone camera or any UPI App
                </p>
              </div>

              {/* UPI App Icons & Details */}
              <div className="flex-1 max-w-xs space-y-3 text-xs">
                {/* Supported Apps List */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-[#8C8C8C] uppercase tracking-wider block">
                    Supported UPI Apps
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Amazon Pay'].map((app) => (
                      <span
                        key={app}
                        className="px-2 py-0.5 rounded-md bg-[#F7F7F6] border border-[#ECECEC] text-[11px] font-semibold text-[#1A1A1A]"
                      >
                        {app}
                      </span>
                    ))}
                  </div>
                </div>

                {/* UPI ID Display & Copy */}
                <div className="p-2.5 bg-[#F7F7F6] rounded-xl border border-[#ECECEC] space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#8C8C8C]">Merchant UPI ID:</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingUpi(!isEditingUpi)}
                      className="text-[#163300] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      {isEditingUpi ? 'Close' : 'Change'}
                    </button>
                  </div>

                  {!isEditingUpi ? (
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="font-mono font-bold text-[#163300] truncate">
                        {upiId}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="p-1 rounded hover:bg-white text-[#6B6B6B] hover:text-[#163300] cursor-pointer transition-colors"
                        title="Copy UPI ID"
                      >
                        {copiedUpi ? (
                          <Check className="w-3.5 h-3.5 text-[#1F9D55]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveUpiConfig} className="space-y-2 pt-1">
                      <div>
                        <label className="text-[10px] text-[#8C8C8C] block">UPI ID</label>
                        <input
                          type="text"
                          value={tempUpiId}
                          onChange={(e) => setTempUpiId(e.target.value)}
                          placeholder="e.g. yourname@upi"
                          className="w-full bg-white border border-[#ECECEC] rounded-lg px-2 py-1 text-xs font-mono text-[#1A1A1A]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#8C8C8C] block">Payee Name</label>
                        <input
                          type="text"
                          value={tempMerchantName}
                          onChange={(e) => setTempMerchantName(e.target.value)}
                          placeholder="e.g. College Parking"
                          className="w-full bg-white border border-[#ECECEC] rounded-lg px-2 py-1 text-xs text-[#1A1A1A]"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingUpi(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" variant="primary" size="sm">
                          Save UPI
                        </Button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Custom Standee Actions (if in custom mode) */}
                {qrMode === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <label className="text-[11px] font-semibold text-[#163300] bg-[#EAF9DD] px-2.5 py-1 rounded cursor-pointer hover:bg-[#D5F2BC] transition-colors">
                      {customQrImage ? 'Replace Standee Image' : 'Upload Standee Image'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {customQrImage && (
                      <button
                        type="button"
                        onClick={handleRemoveCustomQr}
                        className="text-[11px] text-[#D84C4C] hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cash View */}
        {paymentMethod === 'cash' && (
          <div className="p-4 rounded-xl bg-[#F9FAF8] border border-[#E6EDE0] space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#163300] block">
                  Cash Payment at Gate Cabin
                </span>
                <p className="text-[11px] text-[#6B6B6B]">
                  Collect exact cash from the driver before clearing exit
                </p>
              </div>
              <div className="text-xl font-extrabold text-[#163300] tabular-nums">
                ₹{fee}
              </div>
            </div>

            {/* Quick change calculator */}
            <div className="pt-2 border-t border-[#E0EBD8] space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#6B6B6B]">Cash Received:</span>
                <div className="flex gap-1.5">
                  {[fee, 50, 100, 200, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCashTendered(preset)}
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold border cursor-pointer ${
                        cashTendered === preset
                          ? 'bg-[#163300] text-white border-[#163300]'
                          : 'bg-white text-[#1A1A1A] border-[#ECECEC] hover:bg-[#F2F2F0]'
                      }`}
                    >
                      ₹{preset}
                    </button>
                  ))}
                </div>
              </div>

              {typeof cashTendered === 'number' && (
                <div className="p-2.5 bg-white rounded-lg border border-[#D8F2C4] flex items-center justify-between text-xs">
                  <span className="text-[#6B6B6B]">Change to return to driver:</span>
                  <span
                    className={`font-bold tabular-nums text-sm ${
                      changeDue < 0 ? 'text-[#D84C4C]' : 'text-[#163300]'
                    }`}
                  >
                    {changeDue < 0
                      ? `Short by ₹${Math.abs(changeDue)}`
                      : `₹${changeDue}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Confirmation State Bar */}
        <div className="pt-3 border-t border-[#F2F2F0]">
          {isPaid ? (
            <div className="p-3 bg-[#EAF9DD] border border-[#BDE895] rounded-xl flex items-center justify-between animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-[#163300] text-[#9FE870] flex items-center justify-center font-bold text-xs">
                  ✓
                </div>
                <div>
                  <span className="text-xs font-bold text-[#163300] block">
                    Payment Confirmed: ₹{fee}
                  </span>
                  <span className="text-[10px] text-[#426421]">
                    Collected via {paymentMethod === 'upi' ? 'UPI QR Code' : 'Cash'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPaid(false)}
                className="text-[11px] text-[#6B6B6B] hover:text-[#163300] hover:underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Change
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#FFFDF5] border border-[#FEE6A8] rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E58300] animate-ping shrink-0" />
                <span className="text-xs font-semibold text-[#8C5200]">
                  Awaiting {paymentMethod === 'upi' ? 'UPI QR Payment' : 'Cash Collection'} (₹{fee})
                </span>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsPaid(true)}
                icon={<Check className="w-3.5 h-3.5" />}
              >
                Mark as Paid (₹{fee})
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
