import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Search,
  Filter,
  FileText,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ParkingSession } from '../types';
import { fetchHistory, subscribeToRealtime } from '../lib/api';
import {
  formatVehicleNumber,
  formatDateTimeIST,
  formatDuration,
  formatRupees,
} from '../lib/format';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs, TabItem } from '../components/ui/Tabs';
import { Pill, PillVariant } from '../components/ui/Pill';
import { Modal } from '../components/ui/Modal';
import { Ticket } from '../components/Ticket';
import { useToast } from '../components/ui/Toast';

export const History: React.FC = () => {
  const { showSuccess } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicketSession, setSelectedTicketSession] = useState<ParkingSession | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchHistory({
        status: activeTab,
        category: categoryFilter,
        vehicleType: typeFilter,
        search: searchFilter,
      });
      setSessions(data);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToRealtime(
      () => loadData(),
      () => loadData()
    );
    return () => unsub();
  }, [activeTab, categoryFilter, typeFilter]);

  // Handle live search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData();
  };

  // Pagination slice
  const totalPages = Math.ceil(sessions.length / pageSize) || 1;
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sessions.slice(start, start + pageSize);
  }, [sessions, currentPage]);

  // Export CSV
  const handleExportCsv = () => {
    const getSessionPaidBy = (s: ParkingSession) => {
      if (s.status === 'active') return '—';
      if (s.owner_category === 'staff' || s.fee === 0) return 'Free';
      if (s.payment_method === 'upi') return 'UPI';
      if (s.payment_method === 'cash') return 'Cash';
      if (s.payment_method === 'free') return 'Free';
      return 'Cash';
    };

    const headers = [
      'Ticket No',
      'Vehicle Number',
      'Category',
      'Vehicle Type',
      'Slot Code',
      'Entry Time (IST)',
      'Exit Time (IST)',
      'Duration (Min)',
      'Fee (INR)',
      'Paid By',
      'Status',
    ];

    const rows = sessions.map((s) => [
      s.ticket_no,
      formatVehicleNumber(s.vehicle_number),
      s.owner_category.toUpperCase(),
      s.vehicle_type === 'two_wheeler' ? 'Two-Wheeler' : 'Four-Wheeler',
      s.slot_code || '',
      formatDateTimeIST(s.entry_time),
      formatDateTimeIST(s.exit_time),
      s.duration_minutes ?? 0,
      s.fee ?? 0,
      getSessionPaidBy(s),
      s.status.toUpperCase(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CPVTS_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('CSV history report downloaded successfully');
  };

  const getPillVariant = (cat: string): PillVariant => {
    if (cat === 'staff') return 'purple';
    if (cat === 'student') return 'info';
    return 'warning';
  };

  const tabs: TabItem[] = [
    { id: 'all', label: 'All Records', count: sessions.length },
    { id: 'active', label: 'Currently Parked' },
    { id: 'completed', label: 'Completed Exits' },
  ];

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Page Title & Export button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#163300] tracking-tight">
            Gate Activity &amp; Session History
          </h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5">
            Audit logs for campus parking, duration metrics, and tariff revenues
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={loadData}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={handleExportCsv}
            icon={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        {/* Top Status Tabs */}
        <div className="border-b border-[#ECECEC] mb-5">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) => {
              setActiveTab(id as 'all' | 'active' | 'completed');
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Filters Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-4 border-b border-[#F2F2F0]">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] max-w-sm">
            <div className="relative">
              <Search className="w-4 h-4 text-[#8C8C8C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by vehicle or ticket no..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#9FE870] focus:bg-white transition-all uppercase"
              />
            </div>
          </form>

          {/* Category Dropdown */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[#6B6B6B] font-medium">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F7F7F6] border border-[#ECECEC] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="staff">Staff</option>
                <option value="student">Student</option>
                <option value="visitor">Visitor</option>
              </select>
            </div>

            {/* Vehicle Type Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#6B6B6B] font-medium">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F7F7F6] border border-[#ECECEC] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="two_wheeler">Two-Wheeler</option>
                <option value="four_wheeler">Four-Wheeler</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#ECECEC] text-[#8C8C8C] font-semibold">
                <th className="py-3 px-3">Ticket No</th>
                <th className="py-3 px-3">Vehicle Number</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Spot</th>
                <th className="py-3 px-3">Entry Time (IST)</th>
                <th className="py-3 px-3">Exit Time (IST)</th>
                <th className="py-3 px-3">Duration</th>
                <th className="py-3 px-3 text-right">Fee</th>
                <th className="py-3 px-3">Paid by</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F0]">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[#8C8C8C]">
                    Loading gate records...
                  </td>
                </tr>
              ) : paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[#8C8C8C]">
                    No sessions found matching filters.
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F9F9F8]">
                    <td className="py-3.5 px-3 font-mono font-bold text-[#163300]">
                      {s.ticket_no}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-[#1A1A1A]">
                      {formatVehicleNumber(s.vehicle_number)}
                    </td>
                    <td className="py-3.5 px-3">
                      <Pill variant={getPillVariant(s.owner_category)} size="sm">
                        {s.owner_category.toUpperCase()}
                      </Pill>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-[#163300]">
                      {s.slot_code || '—'}
                    </td>
                    <td className="py-3.5 px-3 text-[#555555] tabular-nums">
                      {formatDateTimeIST(s.entry_time)}
                    </td>
                    <td className="py-3.5 px-3 text-[#555555] tabular-nums">
                      {formatDateTimeIST(s.exit_time)}
                    </td>
                    <td className="py-3.5 px-3 tabular-nums font-medium text-[#1A1A1A]">
                      {formatDuration(s.duration_minutes)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-[#163300] tabular-nums">
                      {s.owner_category === 'staff'
                        ? 'FREE'
                        : s.fee !== null
                        ? `₹${s.fee}`
                        : '—'}
                    </td>
                    <td className="py-3.5 px-3 text-xs font-semibold">
                      {s.status === 'active' ? (
                        <span className="text-[#8C8C8C]">—</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-[#F7F7F6] border border-[#ECECEC] text-[11px] font-bold text-[#163300]">
                          {s.owner_category === 'staff' || s.fee === 0
                            ? 'Free'
                            : s.payment_method === 'upi'
                            ? 'UPI'
                            : s.payment_method === 'free'
                            ? 'Free'
                            : 'Cash'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <Pill variant={s.status === 'completed' ? 'success' : 'danger'} size="sm">
                        {s.status.toUpperCase()}
                      </Pill>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      {s.status === 'completed' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedTicketSession(s)}
                          className="h-7 text-xs px-2 text-[#163300]"
                          icon={<FileText className="w-3 h-3" />}
                        >
                          Ticket
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Strip */}
        <div className="flex items-center justify-between pt-5 mt-4 border-t border-[#F2F2F0] text-xs text-[#6B6B6B]">
          <div>
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, sessions.length)} of {sessions.length} entries
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[#ECECEC] hover:bg-[#F7F7F6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-[#1A1A1A] tabular-nums px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-[#ECECEC] hover:bg-[#F7F7F6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Ticket Modal */}
      {selectedTicketSession && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTicketSession(null)}
          title={`Parking Ticket — ${selectedTicketSession.ticket_no}`}
          maxWidth="lg"
        >
          <Ticket ticket={selectedTicketSession} />
        </Modal>
      )}
    </div>
  );
};
