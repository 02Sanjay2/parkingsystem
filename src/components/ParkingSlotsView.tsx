import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Wrench, CheckCircle2, Ban, X } from 'lucide-react';
import { api } from '../services/api';
import {
  formatCurrency,
  formatDateTime,
  VEHICLE_TYPE_LABELS,
  type ParkingSlotItem,
  type SlotStatus,
  type VehicleType,
} from '../types/parking';

interface ParkingSlotsViewProps {
  onQuickEntry?: (slot: ParkingSlotItem) => void;
  onQuickExit?: (registrationNumber: string) => void;
}

export const ParkingSlotsView: React.FC<ParkingSlotsViewProps> = ({ onQuickEntry, onQuickExit }) => {
  const [slots, setSlots] = useState<ParkingSlotItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | SlotStatus>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | VehicleType>('ALL');
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlotItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add slot state
  const [newCode, setNewCode] = useState('');
  const [newZone, setNewZone] = useState('Zone A');
  const [newFloor, setNewFloor] = useState('Ground');
  const [newType, setNewType] = useState<VehicleType>('FOUR_WHEELER');
  const [newRate, setNewRate] = useState('5.00');

  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const loadSlots = async () => {
    setLoading(true);
    try {
      const res = await api.getSlots();
      setSlots(res.slots);
    } catch (err) {
      setActionMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load slots.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const counts = useMemo(() => {
    return {
      total: slots.length,
      available: slots.filter((s) => s.status === 'AVAILABLE').length,
      occupied: slots.filter((s) => s.status === 'OCCUPIED').length,
      maintenance: slots.filter((s) => s.status === 'MAINTENANCE').length,
    };
  }, [slots]);

  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
      if (filterType !== 'ALL' && s.vehicleType !== filterType) return false;
      return true;
    });
  }, [slots, filterStatus, filterType]);

  const groupedZones = useMemo(() => {
    const map = new Map<string, ParkingSlotItem[]>();
    for (const s of filteredSlots) {
      const key = `${s.zone} · ${s.floor}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filteredSlots]);

  const handleToggleMaintenance = async (slot: ParkingSlotItem) => {
    setActionMsg(null);
    const nextStatus: SlotStatus = slot.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    try {
      await api.updateSlot(slot.id, { status: nextStatus });
      setActionMsg({
        type: 'success',
        text: `Slot ${slot.slotCode} marked as ${nextStatus.toLowerCase()}.`,
      });
      setSelectedSlot(null);
      await loadSlots();
    } catch (err) {
      setActionMsg({ type: 'error', text: err instanceof Error ? err.message : 'Could not update slot.' });
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMsg(null);
    try {
      await api.createSlot({
        slotCode: newCode,
        zone: newZone,
        floor: newFloor,
        vehicleType: newType,
        hourlyRate: Number(newRate),
      });
      setNewCode('');
      setShowAddForm(false);
      setActionMsg({ type: 'success', text: 'New parking slot added.' });
      await loadSlots();
    } catch (err) {
      setActionMsg({ type: 'error', text: err instanceof Error ? err.message : 'Could not create slot.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar & Segmented Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'AVAILABLE', 'OCCUPIED', 'MAINTENANCE'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  filterStatus === status ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'ALL' && `All (${counts.total})`}
                {status === 'AVAILABLE' && `Available (${counts.available})`}
                {status === 'OCCUPIED' && `Occupied (${counts.occupied})`}
                {status === 'MAINTENANCE' && `Maintenance (${counts.maintenance})`}
              </button>
            ))}
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'ALL' | VehicleType)}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Vehicle Classes</option>
            <option value="FOUR_WHEELER">Four-Wheeler</option>
            <option value="TWO_WHEELER">Two-Wheeler</option>
            <option value="EV">Electric (EV)</option>
            <option value="HEAVY">Heavy Vehicle</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Parking Slot
        </button>
      </div>

      {actionMsg && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            actionMsg.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-current opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Inline Add Slot Form */}
      {showAddForm && (
        <form onSubmit={handleCreateSlot} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Configure New Parking Slot</h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Slot Code</label>
              <input
                type="text"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g., A-11"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Zone</label>
              <input
                type="text"
                required
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                placeholder="Zone A"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Floor</label>
              <input
                type="text"
                required
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                placeholder="Ground"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Class</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as VehicleType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="FOUR_WHEELER">Four-Wheeler</option>
                <option value="TWO_WHEELER">Two-Wheeler</option>
                <option value="EV">Electric (EV)</option>
                <option value="HEAVY">Heavy Vehicle</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hourly Rate ($)</label>
              <input
                type="number"
                step="0.50"
                min="0.50"
                required
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              Save Parking Slot
            </button>
          </div>
        </form>
      )}

      {/* Legend Bar (Clean unboxed indicators with text + icon) */}
      <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 px-1">
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
          <CheckCircle2 className="w-4 h-4" />
          Available Bay
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
          <Ban className="w-4 h-4" />
          Occupied Bay
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
          <Wrench className="w-4 h-4" />
          Maintenance Hold
        </span>
      </div>

      {/* Main Grid + Inspector Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className={`${selectedSlot ? 'xl:col-span-2' : 'xl:col-span-3'} space-y-6`}>
          {loading ? (
            <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ) : groupedZones.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              No parking slots match the selected filters.
            </div>
          ) : (
            groupedZones.map(([zoneLabel, zoneSlots]) => (
              <div key={zoneLabel} className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">{zoneLabel}</h3>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {zoneSlots.filter((s) => s.status === 'AVAILABLE').length} available · {zoneSlots.length} total
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {zoneSlots.map((slot) => {
                    const isSelected = selectedSlot?.id === slot.id;
                    const statusStyle =
                      slot.status === 'AVAILABLE'
                        ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-400 text-emerald-900'
                        : slot.status === 'OCCUPIED'
                          ? 'bg-red-50/70 border-red-200 hover:border-red-400 text-red-900'
                          : 'bg-amber-50/70 border-amber-200 hover:border-amber-400 text-amber-900';

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer ${statusStyle} ${
                          isSelected ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-semibold text-sm tabular-nums">{slot.slotCode}</span>
                          {slot.status === 'AVAILABLE' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                          {slot.status === 'OCCUPIED' && <Ban className="w-3.5 h-3.5 text-red-700 shrink-0" />}
                          {slot.status === 'MAINTENANCE' && <Wrench className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                        </div>
                        <p className="mt-1.5 text-xs font-mono truncate tabular-nums">
                          {slot.status === 'OCCUPIED' && slot.registrationNumber
                            ? slot.registrationNumber
                            : slot.status === 'AVAILABLE'
                              ? `${formatCurrency(slot.hourlyRate)}/hr`
                              : 'Maintenance'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Slot Inspector Drawer */}
        {selectedSlot && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs text-slate-500">Slot Inspector</p>
                <h3 className="text-xl font-semibold font-mono text-slate-900 mt-0.5">{selectedSlot.slotCode}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedSlot.zone} · {selectedSlot.floor} · {VEHICLE_TYPE_LABELS[selectedSlot.vehicleType]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Current State</span>
                <span
                  className={`font-medium ${
                    selectedSlot.status === 'AVAILABLE'
                      ? 'text-emerald-700'
                      : selectedSlot.status === 'OCCUPIED'
                        ? 'text-red-700'
                        : 'text-amber-700'
                  }`}
                >
                  {selectedSlot.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tariff Rate</span>
                <span className="font-mono tabular-nums text-slate-900">{formatCurrency(selectedSlot.hourlyRate)} / hr</span>
              </div>
            </div>

            {selectedSlot.status === 'OCCUPIED' && selectedSlot.registrationNumber && (
              <div className="pt-4 border-t border-slate-200 space-y-2.5 text-sm">
                <p className="text-xs font-medium text-slate-500">Active Occupant Details</p>
                <div className="flex justify-between">
                  <span className="text-slate-500">Plate Number</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedSlot.registrationNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ticket ID</span>
                  <span className="font-mono text-xs text-slate-700">{selectedSlot.ticketNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Owner</span>
                  <span className="text-slate-900">{selectedSlot.ownerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Contact</span>
                  <span className="font-mono text-xs text-slate-700">{selectedSlot.ownerPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Entry Time</span>
                  <span className="text-slate-700 tabular-nums">{formatDateTime(selectedSlot.entryTime)}</span>
                </div>

                {onQuickExit && (
                  <button
                    type="button"
                    onClick={() => onQuickExit(selectedSlot.registrationNumber!)}
                    className="w-full mt-3 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Proceed to Exit Checkout
                  </button>
                )}
              </div>
            )}

            {selectedSlot.status === 'AVAILABLE' && (
              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                {onQuickEntry && (
                  <button
                    type="button"
                    onClick={() => onQuickEntry(selectedSlot)}
                    className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Assign Vehicle to {selectedSlot.slotCode}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleMaintenance(selectedSlot)}
                  className="w-full py-2 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Place Under Maintenance
                </button>
              </div>
            )}

            {selectedSlot.status === 'MAINTENANCE' && (
              <div className="pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleToggleMaintenance(selectedSlot)}
                  className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Restore Slot to Available
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
