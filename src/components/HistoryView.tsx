import React, { useEffect, useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  VEHICLE_TYPE_LABELS,
  type HistoryRecord,
} from '../types/parking';

export const HistoryView: React.FC = () => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadHistory = async (overrides?: { q?: string; status?: string; vehicleType?: string; date?: string }) => {
    setLoading(true);
    try {
      const res = await api.getHistory({
        q: overrides?.q ?? query,
        status: overrides?.status ?? statusFilter,
        vehicleType: overrides?.vehicleType ?? typeFilter,
        date: overrides?.date ?? dateFilter,
      });
      setRecords(res.records);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleReset = () => {
    setQuery('');
    setStatusFilter('');
    setTypeFilter('');
    setDateFilter('');
    loadHistory({ q: '', status: '', vehicleType: '', date: '' });
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              loadHistory({ q: val });
            }}
            placeholder="Search by vehicle registration number, ticket, owner, or slot..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              loadHistory({ status: e.target.value });
            }}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active (Parked)</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              loadHistory({ vehicleType: e.target.value });
            }}
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="">All Vehicle Types</option>
            <option value="FOUR_WHEELER">Four-Wheeler</option>
            <option value="TWO_WHEELER">Two-Wheeler</option>
            <option value="EV">Electric (EV)</option>
            <option value="HEAVY">Heavy Vehicle</option>
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              loadHistory({ date: e.target.value });
            }}
            className="px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-700"
          />

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Audit History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Complete Vehicle Parking History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Searchable audit log of every vehicle entry, exit, and payment</p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">{records.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-6 font-medium">Ticket / Receipt</th>
                <th className="py-3 px-4 font-medium">Vehicle</th>
                <th className="py-3 px-4 font-medium">Slot</th>
                <th className="py-3 px-4 font-medium">Entry</th>
                <th className="py-3 px-4 font-medium">Exit</th>
                <th className="py-3 px-4 font-medium">Duration</th>
                <th className="py-3 px-4 font-medium">State</th>
                <th className="py-3 px-6 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    Searching parking records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No parking records matched your search criteria.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-6">
                      <span className="font-mono text-xs text-slate-900 block tabular-nums">{r.ticketNumber}</span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {r.receiptNumber ?? 'Pending exit'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-semibold text-slate-900 block tabular-nums">
                        {r.registrationNumber}
                      </span>
                      <span className="text-xs text-slate-500">
                        {r.ownerName} · {VEHICLE_TYPE_LABELS[r.vehicleType]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-800 tabular-nums">{r.slotCode}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums">{formatDateTime(r.entryTime)}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums">{formatDateTime(r.exitTime)}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700 tabular-nums">
                      {formatDuration(r.durationMinutes)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-medium ${
                          r.status === 'ACTIVE' ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {r.status === 'ACTIVE' ? 'Parked' : `Paid · ${r.paymentMethod ?? ''}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono font-medium text-slate-900 tabular-nums">
                      {r.calculatedFee !== null ? formatCurrency(r.calculatedFee) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
