import React, { useState } from 'react';
import { CarFront, Lock, ShieldCheck, UserPlus, LogIn, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import type { AdminUser } from '../types/parking';

interface AuthScreenProps {
  onAuthenticated: (token: string, admin: AdminUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.login(identifier, password);
        onAuthenticated(res.token, res.admin);
      } else {
        const res = await api.register({ fullName, email, username, password, phone });
        // Switch cleanly to Sign In with pre-filled username and confirmation message
        setMode('login');
        setIdentifier(res.admin.username);
        setPassword('');
        setFullName('');
        setEmail('');
        setUsername('');
        setPhone('');
        setSuccessMsg(
          `User "${res.admin.username}" created successfully! Please enter your password below to sign in.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await api.login('admin', 'admin123');
      onAuthenticated(res.token, res.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Architectural Operations Panel */}
      <div className="lg:w-[46%] bg-slate-900 text-slate-100 p-8 lg:p-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <CarFront className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">ParkFlow</span>
          </div>

          <div className="mt-14 max-w-md">
            <p className="text-sm text-slate-400 mb-3">Facility Operations &amp; Gate Control</p>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-white leading-tight [text-wrap:balance]">
              Vehicle Parking Management System
            </h1>
            <p className="mt-4 text-slate-300 text-base leading-relaxed">
              Manage multi-zone parking bays, automate slot allocation, calculate duration-based tariffs, and generate audited daily revenue reports from a unified console.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-slate-400">Database Engine</p>
            <p className="mt-1 font-mono text-slate-100 tabular-nums">SQLite Relational (5 Tables)</p>
          </div>
          <div>
            <p className="text-slate-400">Default Demo Operator</p>
            <p className="mt-1 font-mono text-slate-100 tabular-nums">admin / admin123</p>
          </div>
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8">
          <div className="border-b border-slate-200 pb-5 mb-6">
            <h2 className="text-xl font-semibold text-slate-900">
              {mode === 'login' ? 'Operator Sign In' : 'Create New User Account'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'login'
                ? 'Sign in with your username/email or create a new user account'
                : 'Register a new administrator user, then sign in to access the dashboard'}
            </p>
          </div>

          {/* Segmented Mode Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Create User
            </button>
          </div>

          {successMsg && (
            <div
              className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-2.5"
              role="status"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="reg-fullname">
                    Full Name
                  </label>
                  <input
                    id="reg-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Sanjay Kumar"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="reg-username">
                      Username
                    </label>
                    <input
                      id="reg-username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g., sanjay"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="reg-phone">
                      Phone (Optional)
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98450-11223"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="reg-email">
                    Email Address
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sanjay@example.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {mode === 'login' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="login-identifier">
                  Username or Email
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter username or email"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="auth-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent pr-10"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Sign In to Dashboard'
                    : 'Create User Account'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Secondary Actions */}
          <div className="mt-6 pt-5 border-t border-slate-200 space-y-3">
            {mode === 'login' ? (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleDemoSignIn}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Instant Demo Sign In (admin / admin123)
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2 cursor-pointer"
                  >
                    New here? Create a user account first
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2 cursor-pointer"
                >
                  Already have a user account? Go to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
