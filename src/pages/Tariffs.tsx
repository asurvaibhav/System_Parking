import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Shield,
  Edit2,
  Check,
  X,
  AlertCircle,
  Info,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { Tariff, Profile, OwnerCategory, VehicleType } from '../types';
import { fetchTariffs, updateTariff } from '../lib/api';
import { parseSupabaseError } from '../lib/errors';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pill, PillVariant } from '../components/ui/Pill';
import { useToast } from '../components/ui/Toast';

interface TariffsProps {
  profile: Profile | null;
  onRefreshProfile?: () => void;
}

export const Tariffs: React.FC<TariffsProps> = ({
  profile,
  onRefreshProfile,
}) => {
  const { showSuccess, showError } = useToast();

  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editFreeMin, setEditFreeMin] = useState<number>(0);
  const [editRateHr, setEditRateHr] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const loadTariffs = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTariffs();
      setTariffs(data);
    } catch (err) {
      console.error('Failed to load tariffs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTariffs();
  }, []);

  const getRowKey = (t: Tariff) => `${t.owner_category}-${t.vehicle_type}`;

  const startEdit = (t: Tariff) => {
    if (!isAdmin) return;
    setEditingRowKey(getRowKey(t));
    setEditFreeMin(t.free_minutes);
    setEditRateHr(t.rate_per_hour);
  };

  const cancelEdit = () => {
    setEditingRowKey(null);
  };

  const handleSave = async (t: Tariff) => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      await updateTariff(t.owner_category, t.vehicle_type, Number(editFreeMin), Number(editRateHr));
      showSuccess(`Tariff for ${t.owner_category} ${t.vehicle_type} updated.`);
      setEditingRowKey(null);
      await loadTariffs();
    } catch (err) {
      const parsed = parseSupabaseError(err);
      showError(parsed.message || 'Permission denied. Only admins can edit tariffs.');
    } finally {
      setIsSaving(false);
    }
  };

  const getPillVariant = (cat: string): PillVariant => {
    if (cat === 'staff') return 'purple';
    if (cat === 'student') return 'info';
    return 'warning';
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#163300] tracking-tight">
            Tariff Structure &amp; Fee Rules
          </h2>
          <p className="text-xs text-[#6B6B6B] mt-0.5">
            Campus vehicle parking rates and grace period rules
          </p>
        </div>

        {/* Role Chip */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 p-1.5 px-3 rounded-full bg-white border border-[#ECECEC] text-xs">
            <span className="text-[#6B6B6B]">Logged in as:</span>
            <span
              className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded-full ${
                isAdmin ? 'bg-[#F3E8FF] text-[#7C3AED]' : 'bg-[#EAF9DD] text-[#163300]'
              }`}
            >
              {profile?.role || 'guard'}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Notice or Guard Read-only Info */}
      {isAdmin ? (
        <div className="p-4 rounded-xl bg-[#F4FCED] border border-[#D5ECC7] text-xs text-[#163300] flex items-center gap-3">
          <Shield className="w-4 h-4 text-[#1F9D55] shrink-0" />
          <span>
            <strong>Administrator Access Enabled:</strong> You have authorization to adjust grace periods and hourly billing rates. Updates take effect immediately.
          </span>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-[#F7F7F6] border border-[#ECECEC] text-xs text-[#6B6B6B] flex items-center gap-3">
          <Info className="w-4 h-4 text-[#8C8C8C] shrink-0" />
          <span>
            Tariff rates are configured by administrative policy and are read-only for security guard accounts.
          </span>
        </div>
      )}

      {/* 6-Row Tariffs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#ECECEC] text-[#8C8C8C] font-semibold">
                <th className="py-3 px-4">Owner Category</th>
                <th className="py-3 px-4">Vehicle Type</th>
                <th className="py-3 px-4">Free Grace Minutes</th>
                <th className="py-3 px-4">Rate Per Hour</th>
                <th className="py-3 px-4">Billing Calculation Formula</th>
                {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F0]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#8C8C8C]">
                    Loading tariff matrix...
                  </td>
                </tr>
              ) : (
                tariffs.map((t) => {
                  const key = getRowKey(t);
                  const isEditing = editingRowKey === key;

                  return (
                    <tr key={key} className="hover:bg-[#F9F9F8] transition-colors">
                      <td className="py-4 px-4">
                        <Pill variant={getPillVariant(t.owner_category)} size="md">
                          {t.owner_category.toUpperCase()}
                        </Pill>
                      </td>

                      <td className="py-4 px-4 font-semibold text-[#1A1A1A]">
                        {t.vehicle_type === 'two_wheeler' ? 'Two-Wheeler (Bike)' : 'Four-Wheeler (Car)'}
                      </td>

                      <td className="py-4 px-4 tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editFreeMin}
                            onChange={(e) => setEditFreeMin(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-24 bg-white border border-[#9FE870] rounded-lg px-2.5 py-1 text-xs font-bold text-[#163300] focus:outline-none"
                          />
                        ) : (
                          <span className="font-semibold text-[#163300]">
                            {t.free_minutes} min ({t.free_minutes / 60} h)
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 tabular-nums">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-[#163300]">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={editRateHr}
                              onChange={(e) => setEditRateHr(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-24 bg-white border border-[#9FE870] rounded-lg px-2.5 py-1 text-xs font-bold text-[#163300] focus:outline-none"
                            />
                          </div>
                        ) : (
                          <span className="font-bold text-[#163300] text-sm">
                            {t.rate_per_hour === 0 ? 'FREE (₹0)' : `₹${t.rate_per_hour}/hr`}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-[#6B6B6B]">
                        {t.owner_category === 'staff' ? (
                          <span className="text-[#1F9D55] font-semibold">Exempt from fees</span>
                        ) : (
                          <span>
                            Ceil(max(duration - {t.free_minutes}, 0) × {t.rate_per_hour} / 60)
                          </span>
                        )}
                      </td>

                      {isAdmin && (
                        <td className="py-4 px-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="primary"
                                isLoading={isSaving}
                                onClick={() => handleSave(t)}
                                className="h-7 px-2 text-xs"
                                icon={<Check className="w-3.5 h-3.5" />}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                className="h-7 px-2 text-xs"
                                icon={<X className="w-3.5 h-3.5" />}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(t)}
                              className="h-7 px-2.5 text-xs"
                              icon={<Edit2 className="w-3 h-3 text-[#163300]" />}
                            >
                              Edit Rate
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Note under the table as explicitly specified in prompt */}
        <div className="mt-6 pt-4 border-t border-[#F2F2F0] text-xs text-[#8C8C8C] flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#6B6B6B]" />
          <span>
            Note: Changes apply to vehicles checked out after the change. Issued tickets keep the rates they used.
          </span>
        </div>
      </Card>
    </div>
  );
};
