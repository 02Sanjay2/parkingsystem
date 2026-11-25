import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime, type AdminUser } from '../types/parking';

interface AdminProfileViewProps {
  admin: AdminUser;
  onAdminUpdated: (admin: AdminUser) => void;
}

export const AdminProfileView: React.FC<AdminProfileViewProps> = ({ admin, onAdminUpdated }) => {
  const [fullName, setFullName] = useState(admin.fullName);
  const [email, setEmail] = useState(admin.email);
  const [phone, setPhone] = useState(admin.phone);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      const res = await api.updateProfile({
        fullName,
        email,
        phone,
        currentPassword: newPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined,
      });
      onAdminUpdated(res.admin);
      setCurrentPassword('');
      setNewPassword('');
      setFeedback({ type: 'success', text: 'Admin profile updated successfully.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Admin Profile &amp; Security</h2>
          <p className="text-xs text-slate-500 mt-0.5">Update operator contact details or rotate your password</p>
        </div>

        {feedback && (
          <div
            className={`mb-5 p-3.5 rounded-lg border text-sm ${
              feedback.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Username (Read-only)</label>
              <input
                type="text"
                disabled
                value={admin.username}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-100 border border-slate-200 rounded-lg text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Change Password (Optional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Required only if changing password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">New Password</label>
                <input
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Account Metadata */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-slate-900">
          <ShieldCheck className="w-5 h-5 text-blue-700" />
          <h3 className="text-base font-semibold">Account Details</h3>
        </div>
        <div className="space-y-2.5 text-sm pt-2 border-t border-slate-100">
          <div className="flex justify-between">
            <span className="text-slate-500">Role</span>
            <span className="font-mono text-xs text-slate-900">{admin.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Password Hashing</span>
            <span className="text-slate-700">bcrypt (10 rounds)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Created</span>
            <span className="text-slate-700 tabular-nums">{formatDateTime(admin.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
