import type {
  ActiveParkingRecord,
  AdminUser,
  DailyReportData,
  DashboardStats,
  ExitPreview,
  ExitReceipt,
  HistoryRecord,
  ParkingSlotItem,
  PaymentMethod,
  SlotStatus,
  VehicleItem,
  VehicleType,
  ZoneSummary,
} from '../types/parking';

const TOKEN_KEY = 'parkflow_auth_token';
let memoryToken: string | null = null;

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setStoredToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Fallback to in-memory token if browser blocks storage in iframe
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  login(identifier: string, password: string) {
    return apiRequest<{ token: string; admin: AdminUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  },

  register(payload: { fullName: string; email: string; username: string; password: string; phone: string }) {
    return apiRequest<{ token: string; admin: AdminUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getProfile() {
    return apiRequest<{ admin: AdminUser }>('/api/auth/me');
  },

  updateProfile(payload: {
    fullName: string;
    email: string;
    phone: string;
    currentPassword?: string;
    newPassword?: string;
  }) {
    return apiRequest<{ admin: AdminUser }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getDashboard() {
    return apiRequest<{
      stats: DashboardStats;
      zoneSummary: ZoneSummary[];
      recentActivity: Array<{
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
      }>;
    }>('/api/dashboard');
  },

  getSlots() {
    return apiRequest<{ slots: ParkingSlotItem[] }>('/api/slots');
  },

  createSlot(payload: {
    slotCode: string;
    zone: string;
    floor: string;
    vehicleType: VehicleType;
    hourlyRate: number;
  }) {
    return apiRequest<{ slot: ParkingSlotItem }>('/api/slots', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSlot(id: number, payload: { status?: SlotStatus; hourlyRate?: number }) {
    return apiRequest<{ slot: ParkingSlotItem }>(`/api/slots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getVehicles(q?: string) {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    return apiRequest<{ vehicles: VehicleItem[] }>(`/api/vehicles${query}`);
  },

  registerVehicle(payload: {
    registrationNumber: string;
    vehicleType: VehicleType;
    ownerName: string;
    ownerPhone: string;
    vehicleModel: string;
  }) {
    return apiRequest<{ vehicle: VehicleItem }>('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateVehicle(
    id: number,
    payload: {
      vehicleType: VehicleType;
      ownerName: string;
      ownerPhone: string;
      vehicleModel: string;
    }
  ) {
    return apiRequest<{ vehicle: VehicleItem }>(`/api/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getActiveParking() {
    return apiRequest<{ activeRecords: ActiveParkingRecord[] }>('/api/parking/active');
  },

  vehicleEntry(payload: {
    registrationNumber: string;
    vehicleType: VehicleType;
    ownerName: string;
    ownerPhone: string;
    vehicleModel?: string;
    preferredSlotId?: number;
    notes?: string;
  }) {
    return apiRequest<{
      record: {
        id: number;
        ticketNumber: string;
        entryTime: string;
        hourlyRate: number;
        status: string;
        notes: string;
        registrationNumber: string;
        vehicleType: VehicleType;
        ownerName: string;
        ownerPhone: string;
        vehicleModel: string;
        slotId: number;
        slotCode: string;
        zone: string;
        floor: string;
      };
    }>('/api/parking/entry', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  previewExit(params: { recordId?: number; registrationNumber?: string }) {
    const qs = new URLSearchParams();
    if (params.recordId) qs.set('recordId', String(params.recordId));
    if (params.registrationNumber) qs.set('registrationNumber', params.registrationNumber);
    return apiRequest<{ preview: ExitPreview }>(`/api/parking/exit-preview?${qs.toString()}`);
  },

  processExit(payload: { recordId: number; paymentMethod: PaymentMethod }) {
    return apiRequest<{ receipt: ExitReceipt }>('/api/parking/exit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getHistory(filters: { q?: string; status?: string; vehicleType?: string; date?: string }) {
    const qs = new URLSearchParams();
    if (filters.q) qs.set('q', filters.q);
    if (filters.status) qs.set('status', filters.status);
    if (filters.vehicleType) qs.set('vehicleType', filters.vehicleType);
    if (filters.date) qs.set('date', filters.date);
    return apiRequest<{ records: HistoryRecord[] }>(`/api/parking/history?${qs.toString()}`);
  },

  getDailyReport(date: string) {
    return apiRequest<{ report: DailyReportData }>(`/api/reports/daily?date=${encodeURIComponent(date)}`);
  },
};
