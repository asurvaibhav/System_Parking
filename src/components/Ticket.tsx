import React, { useState, useEffect } from 'react';
import { Download, Printer, CheckCircle2, QrCode } from 'lucide-react';
import { ParkingSession, CheckoutPreview } from '../types';
import { formatVehicleNumber, formatDateTimeIST, formatDuration } from '../lib/format';
import { generateTicketQrDataUrl, downloadTicketPdf, TicketData } from '../lib/ticketPdf';
import { Button } from './ui/Button';

interface TicketProps {
  ticket: TicketData | ParkingSession | CheckoutPreview;
  paymentMethod?: 'upi' | 'cash';
  onNewAction?: () => void;
  newActionLabel?: string;
  isModal?: boolean;
}

export const Ticket: React.FC<TicketProps> = ({
  ticket,
  paymentMethod = 'upi',
  onNewAction,
  newActionLabel = 'New Check-Out',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    let isMounted = true;
    generateTicketQrDataUrl(ticket).then((url) => {
      if (isMounted) setQrDataUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [ticket]);

  const handleDownload = async () => {
    try {
      setIsGeneratingPdf(true);
      await downloadTicketPdf(ticket, paymentMethod);
    } catch (err) {
      console.error('Failed to download ticket PDF', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const freeMin =
    ('free_minutes_applied' in ticket
      ? ticket.free_minutes_applied
      : 'free_minutes' in ticket
      ? (ticket as CheckoutPreview).free_minutes
      : 0) ?? 0;

  const chargeableMin =
    ('chargeable_minutes' in ticket
      ? (ticket as CheckoutPreview).chargeable_minutes
      : Math.max(0, (ticket.duration_minutes || 0) - freeMin)) ?? 0;

  const rateHr =
    ('rate_per_hour_applied' in ticket
      ? ticket.rate_per_hour_applied
      : 'rate_per_hour' in ticket
      ? (ticket as CheckoutPreview).rate_per_hour
      : 0) ?? 0;

  const isStaff = ticket.owner_category === 'staff';

  return (
    <div className="flex flex-col items-center">
      {/* Printable Soft-Copy Receipt Card */}
      <div
        id="printable-ticket"
        className="w-full max-w-[390px] bg-white rounded-[20px] border border-[#ECECEC] shadow-md p-6 text-[#1A1A1A] relative"
      >
        {/* Ticket Header */}
        <div className="bg-[#EAF9DD] -mx-6 -mt-6 p-5 rounded-t-[20px] border-b border-[#D8F2C4] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#9FE870] flex items-center justify-center font-bold text-[#163300] text-sm shadow-xs">
              P
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#163300] tracking-tight uppercase">
                Parking Ticket
              </h2>
              <p className="text-[10px] text-[#558030] font-medium">
                CPVTS · Campus Vehicle Tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-[#1F9D55] text-[11px] font-bold border border-[#D1F2DE]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{('status' in ticket && ticket.status === 'completed') || ticket.exit_time ? 'SLOT RELEASED' : 'ACTIVE'}</span>
          </div>
        </div>

        {/* Ticket Reference & Barcode line */}
        <div className="pt-5 pb-3 border-b border-[#F2F2F0]">
          <div className="text-[11px] font-semibold text-[#8C8C8C] uppercase tracking-wider">
            Ticket Number
          </div>
          <div className="text-base font-bold text-[#163300] tracking-tight font-mono">
            {ticket.ticket_no}
          </div>
        </div>

        {/* Details list */}
        <div className="py-4 space-y-2.5 text-xs border-b border-[#F2F2F0]">
          <div className="flex justify-between items-center">
            <span className="text-[#6B6B6B]">Vehicle Number</span>
            <span className="font-bold text-[#1A1A1A] font-mono text-[13px]">
              {formatVehicleNumber(ticket.vehicle_number)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#6B6B6B]">Category</span>
            <span className="font-semibold uppercase px-2 py-0.5 rounded-full bg-[#F7F7F6] text-[#163300] text-[10.5px]">
              {ticket.owner_category}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#6B6B6B]">Vehicle Type</span>
            <span className="font-medium text-[#1A1A1A]">
              {ticket.vehicle_type === 'two_wheeler' ? 'Two-Wheeler' : 'Four-Wheeler'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#6B6B6B]">Assigned Slot</span>
            <span className="font-bold text-[#163300] px-2 py-0.5 rounded bg-[#EAF9DD]">
              {ticket.slot_code || '—'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#6B6B6B]">Entry Time</span>
            <span className="font-medium text-[#1A1A1A] tabular-nums">
              {formatDateTimeIST(ticket.entry_time)}
            </span>
          </div>

          {ticket.exit_time && (
            <div className="flex justify-between items-center">
              <span className="text-[#6B6B6B]">Exit Time</span>
              <span className="font-medium text-[#1A1A1A] tabular-nums">
                {formatDateTimeIST(ticket.exit_time)}
              </span>
            </div>
          )}

          {ticket.exit_time && ticket.duration_minutes !== null && (
            <div className="flex justify-between items-center">
              <span className="text-[#6B6B6B]">Total Duration</span>
              <span className="font-bold text-[#1A1A1A] tabular-nums">
                {formatDuration(ticket.duration_minutes)}
              </span>
            </div>
          )}

          {!ticket.exit_time && (
            <div className="flex justify-between items-center">
              <span className="text-[#6B6B6B]">Current Status</span>
              <span className="font-bold text-[#1F9D55] bg-[#EAF9DD] px-2 py-0.5 rounded text-[11px]">
                Active Parking · In Campus
              </span>
            </div>
          )}

          {!isStaff && ticket.exit_time && (
            <>
              <div className="flex justify-between items-center text-[11px] text-[#8C8C8C]">
                <span>Free Minutes Applied</span>
                <span>{freeMin} min</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-[#8C8C8C]">
                <span>Chargeable Duration</span>
                <span>{chargeableMin} min</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-[#8C8C8C]">
                <span>Hourly Tariff</span>
                <span>₹{rateHr}/hr</span>
              </div>
            </>
          )}

          {ticket.exit_time && (
            <div className="flex justify-between items-center pt-1 border-t border-[#F2F2F0]">
              <span className="text-[#6B6B6B] font-medium">Paid by</span>
              <span className="font-bold text-[#163300] bg-[#EAF9DD] px-2 py-0.5 rounded text-[11px]">
                Paid by: {isStaff || ticket.fee === 0 ? 'Free' : (('payment_method' in ticket && ticket.payment_method === 'upi') || paymentMethod === 'upi' ? 'UPI' : (('payment_method' in ticket && ticket.payment_method === 'free') ? 'Free' : 'Cash'))}
              </span>
            </div>
          )}

          {!isStaff && !ticket.exit_time && (
            <div className="flex justify-between items-center text-[11px] text-[#8C8C8C]">
              <span>Standard Tariff</span>
              <span>₹{rateHr}/hr (First {freeMin > 0 ? `${freeMin / 60}h free` : 'no free time'})</span>
            </div>
          )}
        </div>

        {/* Total Fee Box */}
        <div className="my-4 p-3.5 rounded-xl bg-[#F7F7F6] border border-[#ECECEC] flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider">
              {ticket.exit_time ? 'Total Fee Paid' : 'Billing Status'}
            </div>
            {ticket.exit_time && (
              <span className="text-[10px] text-[#247012] font-semibold bg-[#EAF9DD] px-2 py-0.5 rounded-full inline-block mt-0.5">
                Paid by: {isStaff || ticket.fee === 0 ? 'Free' : (('payment_method' in ticket && ticket.payment_method === 'upi') || paymentMethod === 'upi' ? 'UPI' : (('payment_method' in ticket && ticket.payment_method === 'free') ? 'Free' : 'Cash'))}
              </span>
            )}
            {!ticket.exit_time && (
              <span className="text-[10px] text-[#558030] font-semibold">
                {isStaff ? 'Staff Free Pass' : 'Computed at Exit Gate'}
              </span>
            )}
          </div>
          <div className="text-xl font-bold text-[#163300] tabular-nums">
            {isStaff ? 'FREE (₹0)' : ticket.exit_time ? (ticket.fee === 0 ? 'FREE (₹0)' : `₹${ticket.fee}`) : 'Active Pass'}
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center pt-2">
          {qrDataUrl ? (
            <div className="p-2 bg-white border border-[#ECECEC] rounded-xl shadow-2xs">
              <img
                src={qrDataUrl}
                alt="Ticket Verification QR"
                className="w-28 h-28 object-contain"
              />
            </div>
          ) : (
            <div className="w-28 h-28 bg-[#F7F7F6] rounded-xl flex items-center justify-center text-[#8C8C8C]">
              <QrCode className="w-8 h-8 animate-pulse" />
            </div>
          )}
          <span className="text-[10px] text-[#8C8C8C] mt-2 text-center">
            Scan at barrier gate for auto-verification
          </span>
        </div>
      </div>

      {/* Action Buttons (Excluded from print) */}
      <div className="no-print mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={handleDownload}
          isLoading={isGeneratingPdf}
          icon={<Download className="w-4 h-4" />}
        >
          Download PDF
        </Button>
        <Button
          variant="outline"
          onClick={handlePrint}
          icon={<Printer className="w-4 h-4" />}
        >
          Print Ticket
        </Button>
        {onNewAction && (
          <Button variant="primary" onClick={onNewAction}>
            {newActionLabel}
          </Button>
        )}
      </div>
    </div>
  );
};
