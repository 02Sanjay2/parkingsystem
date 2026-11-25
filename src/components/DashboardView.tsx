import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  VEHICLE_TYPE_LABELS,
  type DashboardStats,
  type VehicleType,
  type ZoneSummary,
} from '../types/parking';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [recent, setRecent] = useState<
    Array<{
      id: number;
      ticketNumber: string;
      entryTime: string;
      exitTime: string | null;
      durationMinutes: number | null;
      calculatedFee: number | null;
      status: 'ACTIVE' | 'COMPLETED';
      registrationNumber: string;
      vehicleType: VehicleType;
      ownerName: string;
      slotCode: string;
      zone: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard();
      setStats(data.stats);
      setZones(data.zoneSummary);
      setRecent(data.recentActivity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl p-5 animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700 flex items-center justify-between">
        <span>{error}</span>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8">
      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-500">Available Slots</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700 font-mono tabular-nums">
            {stats.availableSlots}
            <span className="text-base font-normal text-slate-400"> / {stats.totalSlots}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Ready for immediate vehicle allocation
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-500">Occupied Slots</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 font-mono tabular-nums">
            {stats.occupiedSlots}
            <span className="text-base font-normal text-slate-500 ml-2">({stats.occupancyRate}%)</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {stats.maintenanceSlots} slot{stats.maintenanceSlots === 1 ? '' : 's'} in maintenance
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-500">Today&apos;s Traffic</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 font-mono tabular-nums">
            {stats.todayEntries}
            <span className="text-sm font-sans font-normal text-slate-500 ml-2">entries</span>
          </p>
          <p className="mt-2 text-xs text-slate-500 tabular-nums">
            {stats.todayExits} exited · {stats.registeredVehicles} registered vehicles
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm text-slate-500">Today&apos;s Revenue</p>
          <p className="mt-2 text-3xl font-semibold text-blue-700 font-mono tabular-nums">
            {formatCurrency(stats.todayRevenue)}
          </p>
          <p className="mt-2 text-xs text-slate-500 tabular-nums">
            Cumulative collected: {formatCurrency(stats.totalRevenue)}
          </p>
        </div>
      </div>

      {/* Quick Gate Actions + Zone Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Zone Breakdown Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Zone Capacity Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">Live slot availability across floors and vehicle classes</p>
            </div>
            <button
              onClick={loadDashboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6 font-medium">Zone &amp; Floor</th>
                  <th className="py-3 px-4 font-medium">Vehicle Class</th>
                  <th className="py-3 px-4 font-medium text-right">Total</th>
                  <th className="py-3 px-4 font-medium text-right">Available</th>
                  <th className="py-3 px-6 font-medium text-right">Occupied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {zones.map((z) => (
                  <tr key={`${z.zone}-${z.vehicleType}`} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-6 font-medium text-slate-900">
                      {z.zone} <span className="text-slate-400 font-normal">· {z.floor}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{VEHICLE_TYPE_LABELS[z.vehicleType]}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">{z.total}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-emerald-700">{z.available}</td>
                    <td className="py-3.5 px-6 text-right font-mono tabular-nums font-medium text-red-700">{z.occupied}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gate Operations Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Gate Operations</h2>
            <p className="text-xs text-slate-500 mt-0.5">Launch common attendant workflows</p>
          </div>

          <div className="space-y-3 pt-1">
            <button
              onClick={() => onNavigate('entry')}
              className="w-full flex items-center justify-between px-4 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <ArrowDownLeft className="w-4 h-4" />
                Record Vehicle Entry
              </span>
              <span className="text-xs text-blue-100">Auto-assign slot</span>
            </button>

            <button
              onClick={() => onNavigate('exit')}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <ArrowUpRight className="w-4 h-4" />
                Process Vehicle Exit
              </span>
              <span className="text-xs text-slate-300 font-mono tabular-nums">{stats.activeVehicles} active</span>
            </button>

            <button
              onClick={() => onNavigate('slots')}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <span>Inspect Live Slot Map</span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">{stats.totalSlots} bays</span>
            </button>

            <button
              onClick={() => onNavigate('reports')}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <span>Generate Daily Report</span>
              <span className="text-xs text-slate-500">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Parking Activity Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Parking Activity</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest entries and exits logged in SQLite</p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer"
          >
            View Full History
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-6 font-medium">Ticket</th>
                <th className="py-3 px-4 font-medium">Registration</th>
                <th className="py-3 px-4 font-medium">Owner</th>
                <th className="py-3 px-4 font-medium">Slot</th>
                <th className="py-3 px-4 font-medium">Entry Time</th>
                <th className="py-3 px-4 font-medium">Duration</th>
                <th className="py-3 px-4 font-medium">State</th>
                <th className="py-3 px-6 font-medium text-right">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No parking activity recorded yet. Record your first vehicle entry to begin.
                  </td>
                </tr>
              ) : (
                recent.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-6 font-mono text-xs text-slate-600 tabular-nums">{item.ticketNumber}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 tabular-nums">{item.registrationNumber}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {item.ownerName}
                      <span className="text-slate-400 text-xs ml-1.5">· {VEHICLE_TYPE_LABELS[item.vehicleType]}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">{item.slotCode}</td>
                    <td className="py-3 px-4 text-slate-600 tabular-nums">{formatDateTime(item.entryTime)}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono tabular-nums">{formatDuration(item.durationMinutes)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-medium ${
                          item.status === 'ACTIVE' ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {item.status === 'ACTIVE' ? 'Parked' : 'Completed'}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums text-slate-900">
                      {item.calculatedFee !== null ? formatCurrency(item.calculatedFee) : '—'}
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
