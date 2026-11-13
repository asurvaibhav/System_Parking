import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  Car,
  AlertCircle,
  LogOut,
  FileText,
  Calendar,
} from 'lucide-react';
import { ParkingSession } from '../types';
import { fetchVehicleHistory } from '../lib/api';
import {
  formatVehicleNumber,
  formatDateTimeIST,
  formatDuration,
  formatRupees,
} from '../lib/format';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pill, PillVariant } from '../components/ui/Pill';
import { Modal } from '../components/ui/Modal';
import { Ticket } from '../components/Ticket';
import { useToast } from '../components/ui/Toast';

interface VehicleFinderProps {
  initialSearchQuery?: string;
  onNavigateToCheckOut: (vehicleNumber: string) => void;
}

export const VehicleFinder: React.FC<VehicleFinderProps> = ({
  initialSearchQuery = '',
  onNavigateToCheckOut,
}) => {
  const { showError } = useToast();
  const [vehicleInput, setVehicleInput] = useState(initialSearchQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [history, setHistory] = useState<ParkingSession[]>([]);
  const [selectedTicketSession, setSelectedTicketSession] = useState<ParkingSession | null>(null);

  const handleSearch = async (numToSearch: string) => {
    if (!numToSearch.trim()) {
      showError('Please enter a vehicle number');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const results = await fetchVehicleHistory(numToSearch.trim());
      setHistory(results);
    } catch (err) {
      console.error('Failed to find vehicle', err);
      showError('Failed to search records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialSearchQuery) {
      setVehicleInput(initialSearchQuery);
      handleSearch(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(vehicleInput);
  };

  const activeSession = history.find((s) => s.status === 'active');
  const pastSessions = history.filter((s) => s.status === 'completed');

  const getPillVariant = (cat: string): PillVariant => {
    if (cat === 'staff') return 'purple';
    if (cat === 'student') return 'info';
    return 'warning';
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-[#163300] tracking-tight">
          Vehicle Finder
        </h2>
        <p className="text-xs text-[#6B6B6B] mt-0.5">
          Locate parked vehicles on campus and review historical entry logs
        </p>
      </div>

      {/* Search Input Box */}
      <Card className="max-w-2xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">
              Vehicle Registration Number
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8C8C8C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. KA22AB1234 or 22BH1234AA"
                  value={vehicleInput}
                  onChange={(e) => setVehicleInput(e.target.value.toUpperCase())}
                  className="w-full bg-[#F7F7F6] border border-[#ECECEC] rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold tracking-wider text-[#1A1A1A] focus:outline-none focus:border-[#9FE870] focus:bg-white uppercase"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                icon={<Search className="w-4 h-4" />}
              >
                Search Vehicle
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Results View */}
      {hasSearched && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
          {history.length === 0 ? (
            <Card className="text-center p-12">
              <AlertCircle className="w-10 h-10 text-[#8C8C8C] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#163300]">No Record Found</h3>
              <p className="text-xs text-[#6B6B6B] mt-1 max-w-sm mx-auto">
                No entry logs exist for registration number <span className="font-mono font-semibold text-[#1A1A1A]">{formatVehicleNumber(vehicleInput)}</span>.
              </p>
            </Card>
          ) : (
            <>
              {/* Current Status Card */}
              <Card className="p-6 border-2 border-[#ECECEC]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F2F2F0]">
                  <div>
                    <span className="text-[11px] font-bold text-[#8C8C8C] uppercase tracking-wider">
                      Vehicle Record
                    </span>
                    <h3 className="text-2xl font-extrabold text-[#163300] font-mono mt-0.5">
                      {formatVehicleNumber(history[0].vehicle_number)}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeSession ? (
                      <Pill variant="success" size="md" dot>
                        PARKED NOW
                      </Pill>
                    ) : (
                      <Pill variant="neutral" size="md">
                        NOT PARKED
                      </Pill>
                    )}
                    <Pill variant={getPillVariant(history[0].owner_category)}>
                      {history[0].owner_category.toUpperCase()}
                    </Pill>
                  </div>
                </div>

                {/* If Currently Parked */}
                {activeSession ? (
                  <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-[#8C8C8C] block text-[11px]">Current Spot</span>
                        <span className="font-bold text-[#163300] text-base bg-[#EAF9DD] px-2 py-0.5 rounded inline-block mt-0.5">
                          {activeSession.slot_code || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8C8C8C] block text-[11px]">Entry Time</span>
                        <span className="font-semibold text-[#1A1A1A] tabular-nums block mt-1">
                          {formatDateTimeIST(activeSession.entry_time)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8C8C8C] block text-[11px]">Running Duration</span>
                        <span className="font-bold text-[#163300] text-sm tabular-nums block mt-1">
                          {formatDuration(
                            Math.floor(
                              Math.max(0, Date.now() - new Date(activeSession.entry_time).getTime()) /
                                (60 * 1000)
                            )
                          )}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      onClick={() => onNavigateToCheckOut(activeSession.vehicle_number)}
                      icon={<LogOut className="w-4 h-4 text-[#163300]" />}
                    >
                      Check-Out Vehicle
                    </Button>
                  </div>
                ) : (
                  <div className="pt-4 text-xs text-[#6B6B6B] flex items-center justify-between">
                    <span>
                      Vehicle is not currently on campus. Last visit completed on{' '}
                      <strong className="text-[#1A1A1A] tabular-nums font-semibold">
                        {formatDateTimeIST(history[0].exit_time)}
                      </strong>
                      .
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTicketSession(history[0])}
                      icon={<FileText className="w-3.5 h-3.5" />}
                    >
                      View Last Ticket
                    </Button>
                  </div>
                )}
              </Card>

              {/* Past Visits Table */}
              <Card>
                <h4 className="text-sm font-bold text-[#163300] mb-3">
                  Recent Visits History (Last 5 Entries)
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#ECECEC] text-[#8C8C8C] font-semibold">
                        <th className="py-2.5 px-3">Ticket</th>
                        <th className="py-2.5 px-3">Spot</th>
                        <th className="py-2.5 px-3">Entry Time (IST)</th>
                        <th className="py-2.5 px-3">Exit Time (IST)</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3 text-right">Fee</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2F2F0]">
                      {history.slice(0, 5).map((session) => (
                        <tr key={session.id} className="hover:bg-[#F9F9F8]">
                          <td className="py-3 px-3 font-mono font-bold text-[#163300]">
                            {session.ticket_no}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#1A1A1A]">
                            {session.slot_code || '—'}
                          </td>
                          <td className="py-3 px-3 text-[#555555] tabular-nums">
                            {formatDateTimeIST(session.entry_time)}
                          </td>
                          <td className="py-3 px-3 text-[#555555] tabular-nums">
                            {formatDateTimeIST(session.exit_time)}
                          </td>
                          <td className="py-3 px-3 tabular-nums font-medium text-[#1A1A1A]">
                            {formatDuration(session.duration_minutes)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-[#163300] tabular-nums">
                            {session.owner_category === 'staff'
                              ? 'FREE'
                              : session.fee !== null
                              ? `₹${session.fee}`
                              : '—'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Pill
                              variant={session.status === 'completed' ? 'success' : 'danger'}
                              size="sm"
                            >
                              {session.status.toUpperCase()}
                            </Pill>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {session.status === 'completed' ? (
                              <button
                                onClick={() => setSelectedTicketSession(session)}
                                className="text-xs font-semibold text-[#163300] hover:underline cursor-pointer"
                              >
                                Ticket
                              </button>
                            ) : (
                              <button
                                onClick={() => onNavigateToCheckOut(session.vehicle_number)}
                                className="text-xs font-semibold text-[#D92D20] hover:underline cursor-pointer"
                              >
                                Exit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Ticket Modal */}
      {selectedTicketSession && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTicketSession(null)}
          title={`Ticket Details — ${selectedTicketSession.ticket_no}`}
          maxWidth="lg"
        >
          <Ticket ticket={selectedTicketSession} />
        </Modal>
      )}
    </div>
  );
};
