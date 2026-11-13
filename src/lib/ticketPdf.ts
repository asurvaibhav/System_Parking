import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { ParkingSession, CheckoutPreview } from '../types';
import { formatDateTimeIST, formatDuration } from './format';

export interface TicketData {
  ticket_no: string;
  vehicle_number: string;
  vehicle_type: 'two_wheeler' | 'four_wheeler';
  owner_category: 'staff' | 'student' | 'visitor';
  slot_code: string;
  entry_time: string;
  exit_time: string | null;
  duration_minutes: number | null;
  free_minutes_applied?: number | null;
  rate_per_hour_applied?: number | null;
  fee: number | null;
  status: 'active' | 'completed';
  payment_method?: 'cash' | 'upi' | 'free' | null;
}

/**
 * Generates data URL for the QR code
 * QR format: compact JSON { t: ticket_no, v: vehicle_number, f: fee, x: exit_time }
 */
export async function generateTicketQrDataUrl(ticket: TicketData | ParkingSession | CheckoutPreview): Promise<string> {
  const qrPayload = JSON.stringify({
    t: ticket.ticket_no,
    v: ticket.vehicle_number,
    f: ticket.fee ?? 0,
    x: ticket.exit_time || new Date().toISOString(),
  });

  return await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
    color: {
      dark: '#163300',
      light: '#FFFFFF',
    },
  });
}

/**
 * Generates and triggers download of the A6 portrait PDF ticket
 */
export async function downloadTicketPdf(
  ticket: TicketData | ParkingSession | CheckoutPreview,
  paymentMethod: 'upi' | 'cash' = 'upi'
): Promise<void> {
  // A6 dimensions: 105mm x 148mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a6',
  });

  const pageWidth = 105;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  // Header Background bar
  doc.setFillColor(159, 232, 112); // #9FE870 lime
  doc.rect(margin, y, contentWidth, 14, 'F');

  // Header Title
  doc.setTextColor(22, 51, 0); // #163300 forest
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('CPVTS - CAMPUS PARKING', pageWidth / 2, y + 6, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('SECURITY GATE EXIT CLEARANCE RECEIPT', pageWidth / 2, y + 11, { align: 'center' });

  y += 20;

  // Ticket No & Status
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 26);
  doc.text(`TICKET: ${ticket.ticket_no}`, margin, y);

  doc.setFontSize(8);
  const isCompleted = ('status' in ticket && ticket.status === 'completed') || Boolean(ticket.exit_time);
  doc.text(isCompleted ? 'SLOT RELEASED' : 'ACTIVE SESSION', pageWidth - margin, y, { align: 'right' });

  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;

  // Key Details Grid
  const renderRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 107, 107);
    doc.text(label, margin, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 26, 26);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 5;
  };

  renderRow('Vehicle Number:', ticket.vehicle_number);
  renderRow('Category:', ticket.owner_category.toUpperCase());
  renderRow(
    'Vehicle Type:',
    ticket.vehicle_type === 'two_wheeler' ? 'Two-Wheeler (Bike)' : 'Four-Wheeler (Car)'
  );
  renderRow('Allocated Slot:', ticket.slot_code || '—');
  renderRow('Entry Time:', formatDateTimeIST(ticket.entry_time));
  renderRow('Exit Time:', formatDateTimeIST(ticket.exit_time));
  renderRow('Total Duration:', formatDuration(ticket.duration_minutes));

  // Tariff breakdown if available
  const freeMin = ('free_minutes_applied' in ticket ? ticket.free_minutes_applied : 'free_minutes' in ticket ? (ticket as CheckoutPreview).free_minutes : 0) ?? 0;
  const rateHr = ('rate_per_hour_applied' in ticket ? ticket.rate_per_hour_applied : 'rate_per_hour' in ticket ? (ticket as CheckoutPreview).rate_per_hour : 0) ?? 0;

  if (ticket.owner_category !== 'staff') {
    renderRow('Free Time Applied:', `${freeMin} min`);
    renderRow('Hourly Tariff Rate:', `Rs. ${rateHr}/hr`);
  }

  const getPaidBy = () => {
    if (ticket.owner_category === 'staff' || ticket.fee === 0) return 'Free';
    if ('payment_method' in ticket && ticket.payment_method) {
      if (ticket.payment_method === 'upi') return 'UPI';
      if (ticket.payment_method === 'cash') return 'Cash';
      if (ticket.payment_method === 'free') return 'Free';
    }
    return paymentMethod === 'upi' ? 'UPI' : 'Cash';
  };
  const paidByLabel = getPaidBy();

  if (ticket.exit_time) {
    renderRow('Paid by:', paidByLabel);
  }

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Total Amount Box
  doc.setFillColor(247, 247, 246);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 107, 107);
  const paidMethodLabel =
    ticket.exit_time
      ? `TOTAL (PAID BY ${paidByLabel.toUpperCase()}):`
      : 'TOTAL AMOUNT DUE:';
  doc.text(paidMethodLabel, margin + 4, y + 9);

  doc.setFontSize(12);
  doc.setTextColor(22, 51, 0);
  const feeText =
    ticket.owner_category === 'staff' || ticket.fee === 0
      ? 'FREE (Rs. 0)'
      : `Rs. ${ticket.fee}`;
  doc.text(feeText, pageWidth - margin - 4, y + 9.5, { align: 'right' });

  y += 18;

  // QR Code
  try {
    const qrDataUrl = await generateTicketQrDataUrl(ticket);
    const qrSize = 24;
    const qrX = (pageWidth - qrSize) / 2;
    doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
    y += qrSize + 4;
  } catch (err) {
    console.error('Failed to embed QR code in PDF', err);
    y += 10;
  }

  // Footer Verification Note
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text('Scan QR code at exit barrier gate to verify clearance.', pageWidth / 2, y, { align: 'center' });
  doc.text('AMBIT Codethon 2026 · BIT Belagavi Parking Security', pageWidth / 2, y + 3.5, { align: 'center' });

  // Save file with required name format
  const sanitizedTicket = ticket.ticket_no.replace(/[^A-Za-z0-9-]/g, '');
  doc.save(`CPVTS-${sanitizedTicket}.pdf`);
}
