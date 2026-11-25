import React, { useEffect, useState } from 'react';
import { Plus, Search, Pencil, X } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime, VEHICLE_TYPE_LABELS, type VehicleItem, type VehicleType } from '../types/parking';

export const VehiclesView: React.FC = () => {
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('FOUR_WHEELER');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const loadVehicles = async (q?: string) => {
    setLoading(true);
    try {
      const res = await api.getVehicles(q);
      setVehicles(res.vehicles);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load vehicles.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setRegistrationNumber('');
    setVehicleType('FOUR_WHEELER');
    setOwnerName('');
    setOwnerPhone('');
    setVehicleModel('');
    setShowForm(false);
  };

  const startEdit = (v: VehicleItem) => {
    setEditingId(v.id);
    setRegistrationNumber(v.registrationNumber);
    setVehicleType(v.vehicleType);
    setOwnerName(v.ownerName);
    setOwnerPhone(v.ownerPhone);
    setVehicleModel(v.vehicleModel || '');
    setShowForm(true);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      if (editingId) {
        await api.updateVehicle(editingId, { vehicleType, ownerName, ownerPhone, vehicleModel });
        setFeedback({ type: 'success', text: `Updated vehicle ${registrationNumber}.` });
      } else {
        await api.registerVehicle({ registrationNumber, vehicleType, ownerName, ownerPhone, vehicleModel });
        setFeedback({ type: 'success', text: `Registered new vehicle ${registrationNumber.toUpperCase()}.` });
      }
      resetForm();
      await loadVehicles(search);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to save vehicle.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search + Add Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadVehicles(search);
          }}
          className="flex items-center gap-2 flex-1 max-w-md"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                loadVehicles(e.target.value);
              }}
              placeholder="Search plate, owner name, or phone..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </form>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Register Vehicle
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {editingId ? `Edit Vehicle (${registrationNumber})` : 'Register New Vehicle'}
            </h3>
            <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer">
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Registration Plate</label>
              <input
                type="text"
                required
                disabled={editingId !== null}
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                placeholder="KA-01-AB-1234"
                className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Class</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="FOUR_WHEELER">Four-Wheeler</option>
                <option value="TWO_WHEELER">Two-Wheeler</option>
                <option value="EV">Electric (EV)</option>
                <option value="HEAVY">Heavy Vehicle</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Owner Name</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Owner Phone</label>
              <input
                type="tel"
                required
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+91 98450-11223"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
              <input
                type="text"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="e.g., Honda City"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              {editingId ? 'Save Changes' : 'Register Vehicle'}
            </button>
          </div>
        </form>
      )}

      {/* Vehicles Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-6 font-medium">Registration Plate</th>
                <th className="py-3 px-4 font-medium">Class &amp; Model</th>
                <th className="py-3 px-4 font-medium">Owner</th>
                <th className="py-3 px-4 font-medium">Contact</th>
                <th className="py-3 px-4 font-medium text-right">Visits</th>
                <th className="py-3 px-4 font-medium">Parking Status</th>
                <th className="py-3 px-6 font-medium text-right">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading registered vehicles...
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No vehicles found matching your search.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-6 font-mono font-semibold text-slate-900 tabular-nums">
                      {v.registrationNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {VEHICLE_TYPE_LABELS[v.vehicleType]}
                      {v.vehicleModel && <span className="text-slate-400 text-xs ml-1.5">· {v.vehicleModel}</span>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800">{v.ownerName}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">{v.ownerPhone}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">{v.totalVisits ?? 0}</td>
                    <td className="py-3.5 px-4">
                      {v.activeSlotCode ? (
                        <span className="text-xs font-medium text-amber-700 font-mono">
                          Parked in {v.activeSlotCode}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Not parked</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="inline-flex items-center gap-3">
                        <span className="text-xs text-slate-500 tabular-nums">{formatDateTime(v.createdAt)}</span>
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          title="Edit vehicle"
                          className="text-slate-400 hover:text-blue-700 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
