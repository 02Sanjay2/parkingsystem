import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { api } from '../services/api';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  VEHICLE_TYPE_LABELS,
  type DailyReportData,
} from '../types/parking';

export const DailyReportsView: React.FC = () => {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = async (targetDate: string) => {
    setLoading(true);
    try {
      const res = await api.getDailyReport(targetDate);
      setReport(res.report);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(date);
  }, [date]);

  const exportCsv = () => {
    if (!report) return;
    const headers = ['Receipt No', 'Ticket No', 'Plate', 'Vehicle Type', 'Owner', 'Slot', 'Duration (min)', 'Method', 'Amount', 'Paid At'];
    const rows = report.transactions.map((t) => [
      t.receiptNumber,
      t.ticketNumber,
      t.registrationNumber,
      t.vehicleType,
      `"${t.ownerName.replace(/"/g, '""')}"`,
      t.slotCode,
      String(t.durationMinutes),
      t.paymentMethod,
      t.amount.toFixed(2),
      t.paidAt,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parkflow-daily-report-${report.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Date Picker & Export Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <label htmlFor="report-date" className="text-sm font-medium text-slate-700">
            Report Date:
          </label>
          <input
            id="report-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg text-slate-900"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!report || report.transactions.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {loading || !report ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : (
        <>
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Total Revenue ({report.date})</p>
              <p className="mt-2 text-2xl font-semibold font-mono text-blue-700 tabular-nums">
                {formatCurrency(report.summary.totalRevenue)}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {report.summary.totalTransactions} settled payment(s)
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Vehicle Entries</p>
              <p className="mt-2 text-2xl font-semibold font-mono text-slate-900 tabular-nums">
                {report.summary.totalEntries}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {report.summary.stillParked} still active on site
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Completed Exits</p>
              <p className="mt-2 text-2xl font-semibold font-mono text-emerald-700 tabular-nums">
                {report.summary.completedExits}
              </p>
              <p className="mt-1 text-xs text-slate-500">Slots checked out &amp; released</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Average Stay Duration</p>
              <p className="mt-2 text-2xl font-semibold font-mono text-slate-900 tabular-nums">
                {formatDuration(report.summary.avgDurationMinutes)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Across completed exits</p>
            </div>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">Breakdown by Vehicle Class</h3>
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-6 font-medium">Vehicle Type</th>
                    <th className="py-2.5 px-4 font-medium text-right">Entries</th>
                    <th className="py-2.5 px-6 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.byVehicleType.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-500 text-xs">
                        No vehicle entries recorded on {report.date}.
                      </td>
                    </tr>
                  ) : (
                    report.byVehicleType.map((row) => (
                      <tr key={row.vehicleType}>
                        <td className="py-3 px-6 text-slate-800">{VEHICLE_TYPE_LABELS[row.vehicleType]}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">{row.vehicleCount}</td>
                        <td className="py-3 px-6 text-right font-mono tabular-nums font-medium text-slate-900">
                          {formatCurrency(row.revenue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">Collection by Payment Method</h3>
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-6 font-medium">Method</th>
                    <th className="py-2.5 px-4 font-medium text-right">Transactions</th>
                    <th className="py-2.5 px-6 font-medium text-right">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.byPaymentMethod.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-500 text-xs">
                        No payments settled on {report.date}.
                      </td>
                    </tr>
                  ) : (
                    report.byPaymentMethod.map((row) => (
                      <tr key={row.paymentMethod}>
                        <td className="py-3 px-6 font-medium text-slate-800">{row.paymentMethod}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">{row.txCount}</td>
                        <td className="py-3 px-6 text-right font-mono tabular-nums font-medium text-slate-900">
                          {formatCurrency(row.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction Ledger */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Settled Payment Transactions ({report.date})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6 font-medium">Receipt</th>
                    <th className="py-3 px-4 font-medium">Plate</th>
                    <th className="py-3 px-4 font-medium">Slot</th>
                    <th className="py-3 px-4 font-medium">Duration</th>
                    <th className="py-3 px-4 font-medium">Method</th>
                    <th className="py-3 px-4 font-medium">Paid At</th>
                    <th className="py-3 px-6 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No settled payments for {report.date}.
                      </td>
                    </tr>
                  ) : (
                    report.transactions.map((t) => (
                      <tr key={t.receiptNumber} className="hover:bg-slate-50/70">
                        <td className="py-3 px-6 font-mono text-xs text-slate-800">{t.receiptNumber}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">{t.registrationNumber}</td>
                        <td className="py-3 px-4 font-mono text-slate-700">{t.slotCode}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                          {formatDuration(t.durationMinutes)}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">{t.paymentMethod}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">{formatDateTime(t.paidAt)}</td>
                        <td className="py-3 px-6 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
