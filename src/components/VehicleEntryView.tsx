import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Printer, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import {
  formatCurrency,
  formatDateTime,
  VEHICLE_TYPE_LABELS,
  type ParkingSlotItem,
  type VehicleItem,
  type VehicleType,
} from '../types/parking';

interface VehicleEntryViewProps {
  preselectedSlot?: ParkingSlotItem | null;
  onClearPreselectedSlot?: () => void;
}

export const VehicleEntryView: React.FC<VehicleEntryViewProps> = ({
  preselectedSlot,
  onClearPreselectedSlot,
}) => {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>(preselectedSlot?.vehicleType ?? 'FOUR_WHEELER');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [preferredSlotId, setPreferredSlotId] = useState<string>(preselectedSlot ? String(preselectedSlot.id) : '');
  const [notes, setNotes] = useState('');

  const [slots, setSlots] = useState<ParkingSlotItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [issuedTicket, setIssuedTicket] = useState<{
    ticketNumber: string;
    entryTime: string;
    hourlyRate: number;
    registrationNumber: string;
    vehicleType: VehicleType;
    ownerName: string;
    ownerPhone: string;
    slotCode: string;
    zone: string;
    floor: string;
  } | null>(null);

  const loadReferenceData = async () => {
    try {
      const [slotsRes, vehiclesRes] = await Promise.all([api.getSlots(), api.getVehicles()]);
      setSlots(slotsRes.slots);
      setVehicles(vehiclesRes.vehicles);
    } catch {
      // handled on submit if needed
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (preselectedSlot) {
      setVehicleType(preselectedSlot.vehicleType);
      setPreferredSlotId(String(preselectedSlot.id));
    }
  }, [preselectedSlot]);

  const compatibleAvailableSlots = useMemo(() => {
    return slots.filter((s) => s.status === 'AVAILABLE' && s.vehicleType === vehicleType);
  }, [slots, vehicleType]);

  const handleSelectExistingVehicle = (vehicleIdStr: string) => {
    const found = vehicles.find((v) => String(v.id) === vehicleIdStr);
    if (!found) return;
    setRegistrationNumber(found.registrationNumber);
    setVehicleType(found.vehicleType);
    setOwnerName(found.ownerName);
    setOwnerPhone(found.ownerPhone);
    setVehicleModel(found.vehicleModel || '');
    setPreferredSlotId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.vehicleEntry({
        registrationNumber,
        vehicleType,
        ownerName,
        ownerPhone,
        vehicleModel,
        preferredSlotId: preferredSlotId ? Number(preferredSlotId) : undefined,
        notes,
      });
      setIssuedTicket(res.record);
      setRegistrationNumber('');
      setOwnerName('');
      setOwnerPhone('');
      setVehicleModel('');
      setPreferredSlotId('');
      setNotes('');
      onClearPreselectedSlot?.();
      await loadReferenceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete vehicle entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Entry Form */}
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
        <div className="border-b border-slate-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Gate Entry &amp; Automatic Slot Allocation</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Prevents duplicate active entries and automatically assigns the next free compatible bay
            </p>
          </div>
          {vehicles.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => handleSelectExistingVehicle(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="" disabled>
                Quick-fill registered vehicle...
              </option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber} — {v.ownerName}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="entry-plate">
                Vehicle Registration Number
              </label>
              <input
                id="entry-plate"
                type="text"
                required
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                placeholder="e.g., KA-01-AB-1234"
                className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="entry-type">
                Vehicle Class
              </label>
              <select
                id="entry-type"
                value={vehicleType}
                onChange={(e) => {
                  setVehicleType(e.target.value as VehicleType);
                  setPreferredSlotId('');
                }}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="FOUR_WHEELER">Four-Wheeler ($5.00/hr)</option>
                <option value="TWO_WHEELER">Two-Wheeler ($2.00/hr)</option>
                <option value="EV">Electric Vehicle / EV ($6.00/hr)</option>
                <option value="HEAVY">Heavy Vehicle ($10.00/hr)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="entry-owner">
                Driver / Owner Name
              </label>
              <input
                id="entry-owner"
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="entry-phone">
                Contact Phone
              </label>
              <input
                id="entry-phone"
                type="tel"
                required
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+91 98450-11223"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="entry-model">
                Vehicle Make / Model
              </label>
              <input
                id="entry-model"
                type="text"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Optional (e.g., Honda City)"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="entry-slot">
                Slot Assignment Mode
              </label>
              <select
                id="entry-slot"
                value={preferredSlotId}
                onChange={(e) => setPreferredSlotId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">
                  Automatic Allocation ({compatibleAvailableSlots.length} available)
                </option>
                {compatibleAvailableSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.slotCode} — {slot.zone} ({slot.floor}) · {formatCurrency(slot.hourlyRate)}/hr
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="entry-notes">
                Gate Notes (Optional)
              </label>
              <input
                id="entry-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Helmet locker issued, VIP guest"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              {compatibleAvailableSlots.length} {VEHICLE_TYPE_LABELS[vehicleType]} slot(s) currently free
            </p>
            <button
              type="submit"
              disabled={submitting || compatibleAvailableSlots.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              <span>{submitting ? 'Allocating Slot...' : 'Confirm Entry & Issue Ticket'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Right Column: Live Ticket Output or Allocation Rules */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {issuedTicket ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-base font-semibold">Entry Ticket Issued</h3>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 no-print cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <p className="text-xs text-slate-500">Assigned Parking Bay</p>
              <p className="text-3xl font-bold font-mono text-slate-900 mt-1">{issuedTicket.slotCode}</p>
              <p className="text-xs text-slate-600 mt-1">
                {issuedTicket.zone} · {issuedTicket.floor}
              </p>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Ticket Number</span>
                <span className="font-mono text-xs text-slate-900">{issuedTicket.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Registration</span>
                <span className="font-mono font-semibold text-slate-900">{issuedTicket.registrationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Owner</span>
                <span className="text-slate-900">{issuedTicket.ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Entry Timestamp</span>
                <span className="text-slate-700 tabular-nums">{formatDateTime(issuedTicket.entryTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hourly Tariff</span>
                <span className="font-mono text-slate-900 tabular-nums">{formatCurrency(issuedTicket.hourlyRate)}/hr</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Entry Validation Rules</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="pb-3 border-b border-slate-100">
                <span className="font-medium text-slate-900 block">Duplicate Entry Protection</span>
                The backend rejects any plate that already holds an active parked session.
              </li>
              <li className="pb-3 border-b border-slate-100">
                <span className="font-medium text-slate-900 block">Atomic Slot Locking</span>
                Slots are reserved inside a database transaction so two cars can never receive the same bay.
              </li>
              <li>
                <span className="font-medium text-slate-900 block">Auto Vehicle Registration</span>
                First-time visitors are automatically added to the vehicle directory upon entry.
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
