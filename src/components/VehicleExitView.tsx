import React, { useEffect, useState } from 'react';
import { Search, CheckCircle2, Printer, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { api } from '../services/api';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  VEHICLE_TYPE_LABELS,
  type ActiveParkingRecord,
  type ExitPreview,
  type ExitReceipt,
  type PaymentMethod,
} from '../types/parking';

interface VehicleExitViewProps {
  preselectedPlate?: string | null;
  onClearPreselectedPlate?: () => void;
}

export const VehicleExitView: React.FC<VehicleExitViewProps> = ({
  preselectedPlate,
  onClearPreselectedPlate,
}) => {
  const [activeList, setActiveList] = useState<ActiveParkingRecord[]>([]);
  const [searchPlate, setSearchPlate] = useState(preselectedPlate ?? '');
  const [preview, setPreview] = useState<ExitPreview | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [receipt, setReceipt] = useState<ExitReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActive = async () => {
    setLoading(true);
    try {
      const res = await api.getActiveParking();
      setActiveList(res.activeRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load active vehicles.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewByPlate = async (plate: string) => {
    if (!plate.trim()) return;
    setError(null);
    setReceipt(null);
    try {
      const res = await api.previewExit({ registrationNumber: plate });
      setPreview(res.preview);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Active vehicle not found.');
    }
  };

  const handlePreviewById = async (recordId: number) => {
    setError(null);
    setReceipt(null);
    try {
      const res = await api.previewExit({ recordId });
      setPreview(res.preview);
      setSearchPlate(res.preview.registrationNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch exit fee preview.');
    }
  };

  useEffect(() => {
    loadActive();
  }, []);

  useEffect(() => {
    if (preselectedPlate) {
      setSearchPlate(preselectedPlate);
      handlePreviewByPlate(preselectedPlate);
      onClearPreselectedSlotHelper();
    }
  }, [preselectedPlate]);

  const onClearPreselectedSlotHelper = () => {
    onClearPreselectedPlate?.();
  };

  const handleConfirmExit = async () => {
    if (!preview) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await api.processExit({ recordId: preview.id, paymentMethod });
      setReceipt(res.receipt);
      setPreview(null);
      setSearchPlate('');
      await loadActive();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exit processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Left 2 Columns: Plate Lookup + Active Vehicles List */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900">Lookup Parked Vehicle for Exit</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Search by registration number or select any vehicle below to calculate parking charges
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePreviewByPlate(searchPlate);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
                placeholder="Enter plate number (e.g., KA-01-MJ-4821)"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Calculate Fee
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>

        {/* Active Parked Vehicles Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Currently Parked Vehicles</h3>
              <p className="text-xs text-slate-500 mt-0.5">Live elapsed durations and accrued charges</p>
            </div>
            <span className="text-xs font-mono text-slate-600 tabular-nums">{activeList.length} active</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6 font-medium">Registration</th>
                  <th className="py-3 px-4 font-medium">Slot</th>
                  <th className="py-3 px-4 font-medium">Entry Time</th>
                  <th className="py-3 px-4 font-medium">Elapsed</th>
                  <th className="py-3 px-4 font-medium text-right">Est. Fee</th>
                  <th className="py-3 px-6 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Loading active vehicles...
                    </td>
                  </tr>
                ) : activeList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No vehicles are currently parked inside the facility.
                    </td>
                  </tr>
                ) : (
                  activeList.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 ${preview?.id === item.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="py-3.5 px-6">
                        <span className="font-mono font-semibold text-slate-900 block tabular-nums">
                          {item.registrationNumber}
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.ownerName} · {VEHICLE_TYPE_LABELS[item.vehicleType]}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-800 tabular-nums">{item.slotCode}</td>
                      <td className="py-3.5 px-4 text-slate-600 tabular-nums">{formatDateTime(item.entryTime)}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 tabular-nums">
                        {formatDuration(item.durationMinutes)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900 tabular-nums">
                        {formatCurrency(item.calculatedFee)}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => handlePreviewById(item.id)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Checkout
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Fee Checkout or Receipt */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {receipt ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-base font-semibold">Exit &amp; Payment Settled</h3>
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

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
              <p className="text-xs text-emerald-800">Amount Paid ({receipt.paymentMethod})</p>
              <p className="text-3xl font-bold font-mono text-emerald-900 mt-1 tabular-nums">
                {formatCurrency(receipt.amountPaid)}
              </p>
              <p className="text-xs text-emerald-700 mt-1">Slot {receipt.slotCode} released to Available</p>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt No</span>
                <span className="font-mono text-xs text-slate-900">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ticket No</span>
                <span className="font-mono text-xs text-slate-700">{receipt.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vehicle</span>
                <span className="font-mono font-semibold text-slate-900">{receipt.registrationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Entry</span>
                <span className="text-slate-700 tabular-nums">{formatDateTime(receipt.entryTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Exit</span>
                <span className="text-slate-700 tabular-nums">{formatDateTime(receipt.exitTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration</span>
                <span className="font-mono text-slate-900 tabular-nums">
                  {formatDuration(receipt.durationMinutes)} ({receipt.billedHours} hr billed)
                </span>
              </div>
            </div>
          </div>
        ) : preview ? (
          <div className="space-y-5">
            <div className="border-b border-slate-200 pb-4">
              <p className="text-xs text-slate-500">Exit Settlement Summary</p>
              <h3 className="text-xl font-semibold font-mono text-slate-900 mt-0.5">{preview.registrationNumber}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {preview.ownerName} · Slot {preview.slotCode} ({preview.zone})
              </p>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Ticket Number</span>
                <span className="font-mono text-xs text-slate-800">{preview.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Entry Time</span>
                <span className="text-slate-700 tabular-nums">{formatDateTime(preview.entryTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Duration</span>
                <span className="font-mono text-slate-900 tabular-nums">{formatDuration(preview.durationMinutes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Billing Calculation</span>
                <span className="font-mono text-xs text-slate-700 tabular-nums">
                  {preview.billedHours} hr × {formatCurrency(preview.hourlyRate)}/hr
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Total Parking Fee</span>
              <span className="text-2xl font-bold font-mono text-blue-700 tabular-nums">
                {formatCurrency(preview.calculatedFee)}
              </span>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-700 mb-2">Payment Method</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'UPI', label: 'UPI', icon: Smartphone },
                  { id: 'CASH', label: 'Cash', icon: Banknote },
                  { id: 'CARD', label: 'Card', icon: CreditCard },
                ] as const).map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        paymentMethod === m.id
                          ? 'bg-blue-50 border-blue-600 text-blue-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={processing}
              onClick={handleConfirmExit}
              className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {processing ? 'Completing Checkout...' : `Collect ${formatCurrency(preview.calculatedFee)} & Release Slot`}
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <h3 className="text-base font-semibold text-slate-900">Tariff &amp; Exit Rules</h3>
            <p>
              Select an active vehicle from the table or search by registration plate to calculate charges and release the parking bay.
            </p>
            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
              <p>Two-Wheeler: $2.00 / commenced hour</p>
              <p>Four-Wheeler: $5.00 / commenced hour</p>
              <p>Electric (EV): $6.00 / commenced hour</p>
              <p>Heavy Vehicle: $10.00 / commenced hour</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
