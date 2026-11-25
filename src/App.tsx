import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Grid2x2,
  ArrowDownLeft,
  ArrowUpRight,
  CarFront,
  History,
  FileBarChart2,
  UserCog,
  LogOut,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import { api, getStoredToken, setStoredToken } from './services/api';
import type { AdminUser, ParkingSlotItem } from './types/parking';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { ParkingSlotsView } from './components/ParkingSlotsView';
import { VehicleEntryView } from './components/VehicleEntryView';
import { VehicleExitView } from './components/VehicleExitView';
import { VehiclesView } from './components/VehiclesView';
import { HistoryView } from './components/HistoryView';
import { DailyReportsView } from './components/DailyReportsView';
import { AdminProfileView } from './components/AdminProfileView';

type NavTab =
  | 'dashboard'
  | 'slots'
  | 'entry'
  | 'exit'
  | 'vehicles'
  | 'history'
  | 'reports'
  | 'profile';

const NAV_ITEMS: Array<{ id: NavTab; label: string; group: 'operations' | 'admin'; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', group: 'operations', icon: LayoutDashboard },
  { id: 'slots', label: 'Parking Slots', group: 'operations', icon: Grid2x2 },
  { id: 'entry', label: 'Vehicle Entry', group: 'operations', icon: ArrowDownLeft },
  { id: 'exit', label: 'Vehicle Exit', group: 'operations', icon: ArrowUpRight },
  { id: 'vehicles', label: 'Vehicles', group: 'operations', icon: CarFront },
  { id: 'history', label: 'History & Search', group: 'operations', icon: History },
  { id: 'reports', label: 'Daily Reports', group: 'operations', icon: FileBarChart2 },
  { id: 'profile', label: 'Admin Profile', group: 'admin', icon: UserCog },
];

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'Operations Dashboard',
  slots: 'Live Parking Slots',
  entry: 'Vehicle Entry & Slot Allocation',
  exit: 'Vehicle Exit & Fee Settlement',
  vehicles: 'Registered Vehicles Directory',
  history: 'Parking History & Search',
  reports: 'Daily Parking & Revenue Reports',
  profile: 'Admin Profile & Security',
};

export default function App() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cross-view contextual handoffs
  const [preselectedSlot, setPreselectedSlot] = useState<ParkingSlotItem | null>(null);
  const [preselectedExitPlate, setPreselectedExitPlate] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setCheckingAuth(false);
      return;
    }

    api
      .getProfile()
      .then((res) => {
        setAdmin(res.admin);
      })
      .catch(() => {
        setStoredToken(null);
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, []);

  const handleAuthenticated = (token: string, user: AdminUser) => {
    setStoredToken(token);
    setAdmin(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setStoredToken(null);
    setAdmin(null);
  };

  const handleNavigate = (tab: string) => {
    setActiveTab(tab as NavTab);
    setMobileMenuOpen(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Verifying operator session...
      </div>
    );
  }

  if (!admin) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const operationsNav = NAV_ITEMS.filter((i) => i.group === 'operations');
  const adminNav = NAV_ITEMS.filter((i) => i.group === 'admin');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 no-print">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white shrink-0">
            <CarFront className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">ParkFlow</span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
          <div>
            <p className="px-3 mb-2 text-xs font-medium text-slate-400">Gate &amp; Operations</p>
            <div className="space-y-1">
              {operationsNav.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-blue-50 text-blue-800 font-medium'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="px-3 mb-2 text-xs font-medium text-slate-400">Account</p>
            <div className="space-y-1">
              {adminNav.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-blue-50 text-blue-800 font-medium'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{admin.fullName}</p>
            <p className="text-xs text-slate-500 truncate">{admin.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="p-2 text-slate-400 hover:text-red-700 rounded-lg hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 max-w-full bg-white h-full flex flex-col border-r border-slate-200 z-50">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold text-slate-900">ParkFlow</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="text-slate-500 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-50 text-blue-800 font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800 truncate">{admin.fullName}</span>
              <button type="button" onClick={handleLogout} className="text-xs font-medium text-red-700">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Clean Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
              {TAB_TITLES[activeTab]}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              setPreselectedSlot(null);
              handleNavigate('entry');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Vehicle Entry
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1400px] w-full mx-auto">
          {activeTab === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}

          {activeTab === 'slots' && (
            <ParkingSlotsView
              onQuickEntry={(slot) => {
                setPreselectedSlot(slot);
                setActiveTab('entry');
              }}
              onQuickExit={(plate) => {
                setPreselectedExitPlate(plate);
                setActiveTab('exit');
              }}
            />
          )}

          {activeTab === 'entry' && (
            <VehicleEntryView
              preselectedSlot={preselectedSlot}
              onClearPreselectedSlot={() => setPreselectedSlot(null)}
            />
          )}

          {activeTab === 'exit' && (
            <VehicleExitView
              preselectedPlate={preselectedExitPlate}
              onClearPreselectedPlate={() => setPreselectedExitPlate(null)}
            />
          )}

          {activeTab === 'vehicles' && <VehiclesView />}
          {activeTab === 'history' && <HistoryView />}
          {activeTab === 'reports' && <DailyReportsView />}
          {activeTab === 'profile' && <AdminProfileView admin={admin} onAdminUpdated={setAdmin} />}
        </main>
      </div>
    </div>
  );
}
