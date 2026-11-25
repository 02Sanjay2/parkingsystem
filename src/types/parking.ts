export type VehicleType = 'TWO_WHEELER' | 'FOUR_WHEELER' | 'EV' | 'HEAVY';
export type SlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD';

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  username: string;
  phone: string;
  role: string;
  createdAt: string;
}

export interface DashboardStats {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  maintenanceSlots: number;
  occupancyRate: number;
  activeVehicles: number;
  registeredVehicles: number;
  todayEntries: number;
  todayExits: number;
  todayRevenue: number;
  totalRevenue: number;
}

export interface ZoneSummary {
  zone: string;
  floor: string;
  vehicleType: VehicleType;
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
}

export interface ParkingSlotItem {
  id: number;
  slotCode: string;
  zone: string;
  floor: string;
  vehicleType: VehicleType;
  hourlyRate: number;
  status: SlotStatus;
  activeRecordId?: number | null;
  ticketNumber?: string | null;
  entryTime?: string | null;
  registrationNumber?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
}

export interface VehicleItem {
  id: number;
  registrationNumber: string;
  vehicleType: VehicleType;
  ownerName: string;
  ownerPhone: string;
  vehicleModel: string;
  createdAt: string;
  totalVisits?: number;
  activeSlotCode?: string | null;
}

export interface ActiveParkingRecord {
  id: number;
  ticketNumber: string;
  entryTime: string;
  hourlyRate: number;
  status: 'ACTIVE';
  notes: string;
  vehicleId: number;
  registrationNumber: string;
  vehicleType: VehicleType;
  ownerName: string;
  ownerPhone: string;
  vehicleModel: string;
  slotId: number;
  slotCode: string;
  zone: string;
  floor: string;
  durationMinutes: number;
  billedHours: number;
  calculatedFee: number;
}

export interface ExitPreview {
  id: number;
  ticketNumber: string;
  entryTime: string;
  previewExitTime: string;
  hourlyRate: number;
  registrationNumber: string;
  vehicleType: VehicleType;
  ownerName: string;
  ownerPhone: string;
  vehicleModel: string;
  slotCode: string;
  zone: string;
  floor: string;
  durationMinutes: number;
  billedHours: number;
  calculatedFee: number;
}

export interface ExitReceipt {
  recordId: number;
  ticketNumber: string;
  receiptNumber: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  ownerName: string;
  ownerPhone: string;
  slotCode: string;
  zone: string;
  floor: string;
  entryTime: string;
  exitTime: string;
  durationMinutes: number;
  billedHours: number;
  hourlyRate: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
}

export interface HistoryRecord {
  id: number;
  ticketNumber: string;
  entryTime: string;
  exitTime: string | null;
  durationMinutes: number | null;
  hourlyRate: number;
  calculatedFee: number | null;
  status: 'ACTIVE' | 'COMPLETED';
  notes: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  ownerName: string;
  ownerPhone: string;
  slotCode: string;
  zone: string;
  floor: string;
  receiptNumber: string | null;
  paymentMethod: PaymentMethod | null;
  paymentStatus: string | null;
  paidAt: string | null;
  adminName: string;
}

export interface DailyReportData {
  date: string;
  summary: {
    totalEntries: number;
    completedExits: number;
    stillParked: number;
    avgDurationMinutes: number;
    totalRevenue: number;
    totalTransactions: number;
  };
  byVehicleType: Array<{
    vehicleType: VehicleType;
    vehicleCount: number;
    revenue: number;
  }>;
  byPaymentMethod: Array<{
    paymentMethod: PaymentMethod;
    txCount: number;
    totalAmount: number;
  }>;
  transactions: Array<{
    receiptNumber: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paidAt: string;
    ticketNumber: string;
    entryTime: string;
    exitTime: string;
    durationMinutes: number;
    registrationNumber: string;
    vehicleType: VehicleType;
    ownerName: string;
    slotCode: string;
  }>;
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  TWO_WHEELER: 'Two-Wheeler',
  FOUR_WHEELER: 'Four-Wheeler',
  EV: 'Electric (EV)',
  HEAVY: 'Heavy Vehicle',
};

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}
