import React, { useState, useEffect, useMemo } from 'react';
import {
  Bike,
  Car,
  TrendingUp,
  Receipt,
  LogIn,
  LogOut,
  Clock,
  ArrowRight,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  DashboardSummaryData,
  ParkingSession,
  Profile,
} from '../types';
import {
  getDashboardSummary,
  fetchActiveSessions,
  subscribeToRealtime,
  fetchHistory,
} from '../lib/api';
import {
  formatVehicleNumber,
  formatDateTimeIST,
  formatDuration,
  formatRupees,
} from '../lib/format';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Pill, PillVariant } from '../components/ui/Pill';
import { Button } from '../components/ui/Button';
import { DataTable, Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Ticket } from '../components/Ticket';

interface DashboardProps {
  profile: Profile | null;
  onNavigateToCheckIn: () => void;
  onNavigateToCheckOut: (prefillVehicle?: string) => void;
  onNavigateToSlots: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  profile,
  onNavigateToCheckIn,
  onNavigateToCheckOut,
  onNavigateToSlots,
}) => {
  const [summary, setSummary] = useState<DashboardSummaryData>({
    two_wheeler: { total: 50, occupied: 0 },
    four_wheeler: { total: 50, occupied: 0 },
    vehicles_today: 0,
    fees_today: 0,
  });
  const [activeSessions, setActiveSessions] = useState<ParkingSession[]>([]);
  const [allTodaySessions, setAllTodaySessions] = useState<ParkingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [selectedTicketSession, setSelectedTicketSession] = useState<ParkingSession | null>(null);

  // Load dashboard data
  const loadData = async () => {
    try {
      const [sumData, activeData, historyData] = await Promise.all([
        getDashboardSummary(),
        fetchActiveSessions(),
        fetchHistory({ status: 'all' }),
      ]);
      if (sumData) setSummary(sumData);
      if (activeData) setActiveSessions(activeData);
      if (historyData) setAllTodaySessions(historyData);
    } catch (err) {
      console.warn('Dashboard data warning:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Realtime subscription
    const unsubscribe = subscribeToRealtime(
      () => loadData(),
      () => loadData()
    );

    // Refresh running duration every 30s
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'Guard';

  // Compute hourly entry vs exit chart data in IST for today
  const hourlyChartData = useMemo(() => {
    const hours = [
      '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'
    ];

    const dataMap: { [key: string]: { entries: number; exits: number } } = {};
    hours.forEach((h) => {
      dataMap[h] = { entries: 0, exits: 0 };
    });

    // Helper to get 2-hour bracket
    const getBracket = (isoString: string) => {
      const date = new Date(isoString);
      // IST hours
      const istHours = (date.getUTCHours() + 5.5) % 24;
      if (istHours < 7) return '06:00';
      if (istHours < 9) return '08:00';
      if (istHours < 11) return '10:00';
      if (istHours < 13) return '12:00';
      if (istHours < 15) return '14:00';
      if (istHours < 17) return '16:00';
      if (istHours < 19) return '18:00';
      if (istHours < 21) return '20:00';
      return '22:00';
    };

    allTodaySessions.forEach((s) => {
      if (s.entry_time) {
        const b = getBracket(s.entry_time);
        if (dataMap[b]) dataMap[b].entries += 1;
      }
      if (s.exit_time) {
        const b = getBracket(s.exit_time);
        if (dataMap[b]) dataMap[b].exits += 1;
      }
    });

    // Aggregate database activity by hour bracket
    return hours.map((hour) => ({
      hour,
      Entries: dataMap[hour]?.entries || 0,
      Exits: dataMap[hour]?.exits || 0,
    }));
  }, [allTodaySessions]);

  // Table columns for currently parked vehicles
  const tableColumns: Column<ParkingSession>[] = [
    {
      key: 'vehicle_number',
      header: 'Vehicle Number',
      render: (s) => (
        <span className="font-bold text-[#163300] font-mono">
          {formatVehicleNumber(s.vehicle_number)}
        </span>
      ),
    },
    {
      key: 'owner_category',
      header: 'Category',
      render: (s) => {
        const variantMap: Record<string, PillVariant> = {
          staff: 'purple',
          student: 'info',
          visitor: 'warning',
        };
        return (
          <Pill variant={variantMap[s.owner_category] || 'neutral'} size="sm">
            {s.owner_category.toUpperCase()}
          </Pill>
        );
      },
    },
    {
      key: 'vehicle_type',
      header: 'Type',
      render: (s) => (
        <span className="text-xs text-[#555555]">
          {s.vehicle_type === 'two_wheeler' ? 'Two-Wheeler' : 'Four-Wheeler'}
        </span>
      ),
    },
    {
      key: 'slot_code',
      header: 'Spot Code',
      render: (s) => (
        <span className="font-bold px-2 py-0.5 rounded bg-[#EAF9DD] text-[#163300] text-xs">
          {s.slot_code || '—'}
        </span>
      ),
    },
    {
      key: 'entry_time',
      header: 'Entry Time',
      render: (s) => (
        <span className="text-xs text-[#555555] tabular-nums">
          {formatDateTimeIST(s.entry_time)}
        </span>
      ),
    },
    {
      key: 'running_duration',
      header: 'Duration',
      render: (s) => {
        const diffMs = Math.max(0, currentTime - new Date(s.entry_time).getTime());
        const mins = Math.floor(diffMs / (60 * 1000));
        return (
          <span className="font-semibold text-[#1A1A1A] tabular-nums text-xs">
            {formatDuration(mins)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedTicketSession(s)}
            className="text-xs h-7 px-2 text-[#163300] hover:bg-[#EAF9DD]"
            icon={<QrCode className="w-3.5 h-3.5 text-[#163300]" />}
          >
            Ticket &amp; QR
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigateToCheckOut(s.vehicle_number)}
            className="text-xs h-7 px-2.5"
            icon={<LogOut className="w-3 h-3 text-[#D92D20]" />}
          >
            Check-Out
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-8 max-w-[1440px] mx-auto">
      {/* Welcome Banner & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#163300] tracking-tight">
            Welcome Back, {firstName}!
          </h2>
          <p className="text-sm text-[#6B6B6B] mt-0.5">
            Here is today's campus parking status and live gate flow at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => onNavigateToCheckOut()}
            icon={<LogOut className="w-4 h-4 text-[#D92D20]" />}
          >
            Check-Out
          </Button>
          <Button
            variant="primary"
            onClick={onNavigateToCheckIn}
            icon={<LogIn className="w-4 h-4" />}
          >
            Check-In Vehicle
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Two-Wheeler Slots"
          value={`${50 - summary.two_wheeler.occupied} Available`}
          subtitle="50 Total Capacity"
          icon={<Bike className="w-4 h-4" />}
          progress={{
            current: summary.two_wheeler.occupied,
            total: summary.two_wheeler.total || 50,
          }}
        />

        <StatCard
          label="Four-Wheeler Slots"
          value={`${50 - summary.four_wheeler.occupied} Available`}
          subtitle="50 Total Capacity"
          icon={<Car className="w-4 h-4" />}
          progress={{
            current: summary.four_wheeler.occupied,
            total: summary.four_wheeler.total || 50,
          }}
        />

        <StatCard
          label="Vehicles Today"
          value={summary.vehicles_today}
          subtitle="Recorded gate entries"
          icon={<TrendingUp className="w-4 h-4" />}
          trend={{
            direction: 'up',
            label: 'Active Gate Volume',
          }}
        />

        <StatCard
          label="Fees Collected Today"
          value={formatRupees(summary.fees_today)}
          subtitle="Settled at exit gates"
          icon={<Receipt className="w-4 h-4" />}
          trend={{
            direction: 'neutral',
            label: 'Pro-rata tariff settled',
          }}
        />
      </div>

      {/* Middle Grid: Hourly Chart & Zone Occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entries vs Exits Chart (2 columns) */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-[#163300]">
                Entries vs Exits (Today)
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-0.5">
                Distribution of vehicle throughput across gate hours (IST)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-[#163300]">
                <span className="w-3 h-3 rounded-sm bg-[#9FE870]" />
                Entries
              </span>
              <span className="flex items-center gap-1.5 text-[#6B6B6B]">
                <span className="w-3 h-3 rounded-sm bg-[#C4C4C4]" />
                Exits
              </span>
            </div>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0EE" />
                <XAxis dataKey="hour" tickLine={false} axisLine={{ stroke: '#ECECEC' }} fontSize={11} stroke="#8C8C8C" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="#8C8C8C" />
                <Tooltip
                  cursor={{ fill: '#F7F7F6' }}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #ECECEC',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Entries" fill="#9FE870" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Exits" fill="#C4C4C4" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Zone Occupancy Bars (1 column) */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[#163300]">
                Zone Occupancy
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToSlots}
                className="text-xs"
                icon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                View Grid
              </Button>
            </div>

            <div className="space-y-6">
              {/* Bike Zone */}
              <div>
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="font-semibold text-[#1A1A1A] flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-[#163300]" />
                    Two-Wheeler Zone (T-01..T-50)
                  </span>
                  <span className="tabular-nums font-semibold text-[#163300]">
                    {summary.two_wheeler.occupied} / {summary.two_wheeler.total}
                  </span>
                </div>
                <div className="w-full h-3 bg-[#F0F0EE] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#9FE870] transition-all duration-500 rounded-full"
                    style={{
                      width: `${(summary.two_wheeler.occupied / (summary.two_wheeler.total || 50)) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#8C8C8C] mt-1.5">
                  <span>{50 - summary.two_wheeler.occupied} vacant spots</span>
                  <span>
                    {Math.round(
                      (summary.two_wheeler.occupied / (summary.two_wheeler.total || 50)) * 100
                    )}
                    % occupied
                  </span>
                </div>
              </div>

              {/* Car Zone */}
              <div>
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="font-semibold text-[#1A1A1A] flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-[#163300]" />
                    Four-Wheeler Zone (F-01..F-50)
                  </span>
                  <span className="tabular-nums font-semibold text-[#163300]">
                    {summary.four_wheeler.occupied} / {summary.four_wheeler.total}
                  </span>
                </div>
                <div className="w-full h-3 bg-[#F0F0EE] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#163300] transition-all duration-500 rounded-full"
                    style={{
                      width: `${(summary.four_wheeler.occupied / (summary.four_wheeler.total || 50)) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#8C8C8C] mt-1.5">
                  <span>{50 - summary.four_wheeler.occupied} vacant spots</span>
                  <span>
                    {Math.round(
                      (summary.four_wheeler.occupied / (summary.four_wheeler.total || 50)) * 100
                    )}
                    % occupied
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F7F6] border border-[#ECECEC] mt-6 flex items-center justify-between text-xs">
            <span className="text-[#6B6B6B]">Total Campus Slots:</span>
            <span className="font-bold text-[#163300] tabular-nums">100 (50 Two + 50 Four)</span>
          </div>
        </Card>
      </div>

      {/* Currently Parked Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-[#163300]">
              Currently Parked Vehicles ({activeSessions.length})
            </h3>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              Live sessions in parking lot with auto-updating running duration
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadData}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>

        <DataTable
          columns={tableColumns}
          data={activeSessions}
          keyExtractor={(s) => s.id}
          isLoading={isLoading}
          emptyMessage="No vehicles currently parked in campus slots"
        />
      </Card>

      {/* Ticket & QR Code Modal */}
      {selectedTicketSession && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTicketSession(null)}
          title="Vehicle Parking Ticket & QR Code"
          maxWidth="md"
        >
          <div className="py-2">
            <Ticket
              ticket={selectedTicketSession}
              onNewAction={() => setSelectedTicketSession(null)}
              newActionLabel="Close Ticket"
              isModal
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
