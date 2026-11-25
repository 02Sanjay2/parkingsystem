import { db } from '../db.ts';

export type VehicleType = 'TWO_WHEELER' | 'FOUR_WHEELER' | 'EV' | 'HEAVY';
export type SlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function normalizePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-');
}

export function calculateFeeDetails(entryTimeIso: string, exitTimeIso: string, hourlyRate: number) {
  const startMs = new Date(entryTimeIso).getTime();
  const endMs = new Date(exitTimeIso).getTime();
  const diffMs = Math.max(0, endMs - startMs);
  const durationMinutes = Math.max(1, Math.round(diffMs / 60000));
  // Minimum 1 hour charge; thereafter rounded up to each commenced hour
  const billedHours = Math.max(1, Math.ceil(durationMinutes / 60));
  const calculatedFee = Number((billedHours * hourlyRate).toFixed(2));
  return {
    durationMinutes,
    billedHours,
    hourlyRate,
    calculatedFee,
  };
}

export function getDashboardData() {
  const todayStr = new Date().toISOString().slice(0, 10);

  const slotStats = db.prepare(`
    SELECT
      COUNT(*) as totalSlots,
      SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as availableSlots,
      SUM(CASE WHEN status = 'OCCUPIED' THEN 1 ELSE 0 END) as occupiedSlots,
      SUM(CASE WHEN status = 'MAINTENANCE' THEN 1 ELSE 0 END) as maintenanceSlots
    FROM parking_slots
  `).get() as {
    totalSlots: number;
    availableSlots: number;
    occupiedSlots: number;
    maintenanceSlots: number;
  };

  const vehicleCount = (db.prepare('SELECT COUNT(*) as count FROM vehicles').get() as { count: number }).count;
  const activeCount = (db.prepare(`SELECT COUNT(*) as count FROM parking_records WHERE status = 'ACTIVE'`).get() as { count: number }).count;

  const todayStats = db.prepare(`
    SELECT
      SUM(CASE WHEN substr(entry_time, 1, 10) = ? THEN 1 ELSE 0 END) as todayEntries,
      SUM(CASE WHEN status = 'COMPLETED' AND substr(exit_time, 1, 10) = ? THEN 1 ELSE 0 END) as todayExits
    FROM parking_records
  `).get(todayStr, todayStr) as { todayEntries: number | null; todayExits: number | null };

  const todayRevenueRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as todayRevenue
    FROM payments
    WHERE substr(paid_at, 1, 10) = ?
  `).get(todayStr) as { todayRevenue: number };

  const totalRevenueRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as totalRevenue
    FROM payments
  `).get() as { totalRevenue: number };

  const zoneSummary = db.prepare(`
    SELECT
      zone,
      floor,
      vehicle_type as vehicleType,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN status = 'OCCUPIED' THEN 1 ELSE 0 END) as occupied,
      SUM(CASE WHEN status = 'MAINTENANCE' THEN 1 ELSE 0 END) as maintenance
    FROM parking_slots
    GROUP BY zone, floor, vehicle_type
    ORDER BY zone ASC
  `).all();

  const recentActivity = db.prepare(`
    SELECT
      pr.id,
      pr.ticket_number as ticketNumber,
      pr.entry_time as entryTime,
      pr.exit_time as exitTime,
      pr.duration_minutes as durationMinutes,
      pr.calculated_fee as calculatedFee,
      pr.status,
      v.registration_number as registrationNumber,
      v.vehicle_type as vehicleType,
      v.owner_name as ownerName,
      ps.slot_code as slotCode,
      ps.zone
    FROM parking_records pr
    JOIN vehicles v ON v.id = pr.vehicle_id
    JOIN parking_slots ps ON ps.id = pr.slot_id
    ORDER BY pr.id DESC
    LIMIT 8
  `).all();

  return {
    stats: {
      totalSlots: slotStats.totalSlots || 0,
      availableSlots: slotStats.availableSlots || 0,
      occupiedSlots: slotStats.occupiedSlots || 0,
      maintenanceSlots: slotStats.maintenanceSlots || 0,
      occupancyRate: slotStats.totalSlots > 0 ? Math.round(((slotStats.occupiedSlots || 0) / slotStats.totalSlots) * 100) : 0,
      activeVehicles: activeCount,
      registeredVehicles: vehicleCount,
      todayEntries: todayStats.todayEntries || 0,
      todayExits: todayStats.todayExits || 0,
      todayRevenue: Number((todayRevenueRow.todayRevenue || 0).toFixed(2)),
      totalRevenue: Number((totalRevenueRow.totalRevenue || 0).toFixed(2)),
    },
    zoneSummary,
    recentActivity,
  };
}

export function listSlotsWithOccupant() {
  return db.prepare(`
    SELECT
      ps.id,
      ps.slot_code as slotCode,
      ps.zone,
      ps.floor,
      ps.vehicle_type as vehicleType,
      ps.hourly_rate as hourlyRate,
      ps.status,
      pr.id as activeRecordId,
      pr.ticket_number as ticketNumber,
      pr.entry_time as entryTime,
      v.registration_number as registrationNumber,
      v.owner_name as ownerName,
      v.owner_phone as ownerPhone
    FROM parking_slots ps
    LEFT JOIN parking_records pr ON pr.slot_id = ps.id AND pr.status = 'ACTIVE'
    LEFT JOIN vehicles v ON v.id = pr.vehicle_id
    ORDER BY ps.zone ASC, ps.slot_code ASC
  `).all();
}

export function createParkingSlot(input: {
  slotCode: string;
  zone: string;
  floor: string;
  vehicleType: VehicleType;
  hourlyRate: number;
}) {
  const code = input.slotCode.trim().toUpperCase();
  if (!code || code.length < 2) {
    throw new AppError('Slot code must be at least 2 characters (e.g., A-11).', 400);
  }
  if (!['TWO_WHEELER', 'FOUR_WHEELER', 'EV', 'HEAVY'].includes(input.vehicleType)) {
    throw new AppError('Invalid vehicle type for parking slot.', 400);
  }
  if (!Number.isFinite(input.hourlyRate) || input.hourlyRate <= 0) {
    throw new AppError('Hourly rate must be greater than 0.', 400);
  }

  const existing = db.prepare('SELECT id FROM parking_slots WHERE slot_code = ?').get(code);
  if (existing) {
    throw new AppError(`Parking slot "${code}" already exists.`, 409);
  }

  const result = db.prepare(`
    INSERT INTO parking_slots (slot_code, zone, floor, vehicle_type, hourly_rate, status)
    VALUES (?, ?, ?, ?, ?, 'AVAILABLE')
  `).run(code, input.zone.trim(), input.floor.trim(), input.vehicleType, Number(input.hourlyRate.toFixed(2)));

  return db.prepare(`
    SELECT id, slot_code as slotCode, zone, floor, vehicle_type as vehicleType, hourly_rate as hourlyRate, status
    FROM parking_slots WHERE id = ?
  `).get(result.lastInsertRowid);
}

export function updateParkingSlot(slotId: number, updates: { status?: SlotStatus; hourlyRate?: number }) {
  const slot = db.prepare('SELECT * FROM parking_slots WHERE id = ?').get(slotId) as
    | { id: number; status: SlotStatus; hourly_rate: number; slot_code: string }
    | undefined;

  if (!slot) {
    throw new AppError('Parking slot not found.', 404);
  }

  if (updates.status !== undefined) {
    if (slot.status === 'OCCUPIED') {
      throw new AppError(`Slot ${slot.slot_code} is currently occupied. Process vehicle exit before changing status.`, 409);
    }
    if (!['AVAILABLE', 'MAINTENANCE'].includes(updates.status)) {
      throw new AppError('Manual status change only supports AVAILABLE or MAINTENANCE.', 400);
    }
  }

  if (updates.hourlyRate !== undefined && (!Number.isFinite(updates.hourlyRate) || updates.hourlyRate <= 0)) {
    throw new AppError('Hourly rate must be greater than 0.', 400);
  }

  const nextStatus = updates.status ?? slot.status;
  const nextRate = updates.hourlyRate !== undefined ? Number(updates.hourlyRate.toFixed(2)) : slot.hourly_rate;

  db.prepare('UPDATE parking_slots SET status = ?, hourly_rate = ? WHERE id = ?').run(nextStatus, nextRate, slotId);

  return db.prepare(`
    SELECT id, slot_code as slotCode, zone, floor, vehicle_type as vehicleType, hourly_rate as hourlyRate, status
    FROM parking_slots WHERE id = ?
  `).get(slotId);
}

export function listVehicles(searchQuery?: string) {
  const q = searchQuery ? `%${searchQuery.trim().toUpperCase()}%` : '%';
  return db.prepare(`
    SELECT
      v.id,
      v.registration_number as registrationNumber,
      v.vehicle_type as vehicleType,
      v.owner_name as ownerName,
      v.owner_phone as ownerPhone,
      v.vehicle_model as vehicleModel,
      v.created_at as createdAt,
      (SELECT COUNT(*) FROM parking_records pr WHERE pr.vehicle_id = v.id) as totalVisits,
      (SELECT ps.slot_code FROM parking_records pr JOIN parking_slots ps ON ps.id = pr.slot_id WHERE pr.vehicle_id = v.id AND pr.status = 'ACTIVE' LIMIT 1) as activeSlotCode
    FROM vehicles v
    WHERE v.registration_number LIKE ? OR UPPER(v.owner_name) LIKE ? OR v.owner_phone LIKE ?
    ORDER BY v.id DESC
  `).all(q, q, q);
}

export function registerVehicle(input: {
  registrationNumber: string;
  vehicleType: VehicleType;
  ownerName: string;
  ownerPhone: string;
  vehicleModel?: string;
}) {
  const reg = normalizePlate(input.registrationNumber);
  if (reg.length < 4 || !/^[A-Z0-9-]+$/.test(reg)) {
    throw new AppError('Registration number must be at least 4 alphanumeric characters (e.g., KA-01-AB-1234).', 400);
  }
  if (!['TWO_WHEELER', 'FOUR_WHEELER', 'EV', 'HEAVY'].includes(input.vehicleType)) {
    throw new AppError('Invalid vehicle type selected.', 400);
  }
  if (!input.ownerName.trim() || input.ownerName.trim().length < 2) {
    throw new AppError('Owner name must be at least 2 characters.', 400);
  }
  if (!input.ownerPhone.trim() || input.ownerPhone.trim().length < 7) {
    throw new AppError('Valid owner contact phone is required.', 400);
  }

  const existing = db.prepare('SELECT id FROM vehicles WHERE registration_number = ?').get(reg);
  if (existing) {
    throw new AppError(`Vehicle "${reg}" is already registered.`, 409);
  }

  const res = db.prepare(`
    INSERT INTO vehicles (registration_number, vehicle_type, owner_name, owner_phone, vehicle_model)
    VALUES (?, ?, ?, ?, ?)
  `).run(reg, input.vehicleType, input.ownerName.trim(), input.ownerPhone.trim(), (input.vehicleModel || '').trim());

  return db.prepare(`
    SELECT id, registration_number as registrationNumber, vehicle_type as vehicleType, owner_name as ownerName, owner_phone as ownerPhone, vehicle_model as vehicleModel, created_at as createdAt
    FROM vehicles WHERE id = ?
  `).get(res.lastInsertRowid);
}

export function updateVehicle(
  id: number,
  input: { ownerName: string; ownerPhone: string; vehicleModel?: string; vehicleType: VehicleType }
) {
  const existing = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(id);
  if (!existing) {
    throw new AppError('Vehicle not found.', 404);
  }
  if (!input.ownerName.trim() || input.ownerName.trim().length < 2) {
    throw new AppError('Owner name must be at least 2 characters.', 400);
  }
  if (!input.ownerPhone.trim() || input.ownerPhone.trim().length < 7) {
    throw new AppError('Valid owner contact phone is required.', 400);
  }

  db.prepare(`
    UPDATE vehicles
    SET owner_name = ?, owner_phone = ?, vehicle_model = ?, vehicle_type = ?
    WHERE id = ?
  `).run(input.ownerName.trim(), input.ownerPhone.trim(), (input.vehicleModel || '').trim(), input.vehicleType, id);

  return db.prepare(`
    SELECT id, registration_number as registrationNumber, vehicle_type as vehicleType, owner_name as ownerName, owner_phone as ownerPhone, vehicle_model as vehicleModel, created_at as createdAt
    FROM vehicles WHERE id = ?
  `).get(id);
}

export function processVehicleEntry(input: {
  registrationNumber: string;
  vehicleType: VehicleType;
  ownerName: string;
  ownerPhone: string;
  vehicleModel?: string;
  preferredSlotId?: number;
  notes?: string;
  adminId: number;
}) {
  const reg = normalizePlate(input.registrationNumber);
  if (reg.length < 4 || !/^[A-Z0-9-]+$/.test(reg)) {
    throw new AppError('Registration number must be at least 4 alphanumeric characters (e.g., KA-01-AB-1234).', 400);
  }
  if (!['TWO_WHEELER', 'FOUR_WHEELER', 'EV', 'HEAVY'].includes(input.vehicleType)) {
    throw new AppError('Invalid vehicle type.', 400);
  }
  if (!input.ownerName.trim() || input.ownerName.trim().length < 2) {
    throw new AppError('Owner name is required.', 400);
  }
  if (!input.ownerPhone.trim() || input.ownerPhone.trim().length < 7) {
    throw new AppError('Valid phone number is required.', 400);
  }

  const runEntryTx = db.transaction(() => {
    // 1. Prevent duplicate active vehicle entries
    const activeConflict = db.prepare(`
      SELECT pr.ticket_number as ticketNumber, ps.slot_code as slotCode
      FROM parking_records pr
      JOIN vehicles v ON v.id = pr.vehicle_id
      JOIN parking_slots ps ON ps.id = pr.slot_id
      WHERE v.registration_number = ? AND pr.status = 'ACTIVE'
    `).get(reg) as { ticketNumber: string; slotCode: string } | undefined;

    if (activeConflict) {
      throw new AppError(
        `Duplicate entry blocked: Vehicle ${reg} is already parked in Slot ${activeConflict.slotCode} (Ticket ${activeConflict.ticketNumber}).`,
        409
      );
    }

    // 2. Find or register vehicle
    let vehicle = db.prepare('SELECT id, vehicle_type FROM vehicles WHERE registration_number = ?').get(reg) as
      | { id: number; vehicle_type: VehicleType }
      | undefined;

    let vehicleId: number;
    if (!vehicle) {
      const ins = db.prepare(`
        INSERT INTO vehicles (registration_number, vehicle_type, owner_name, owner_phone, vehicle_model)
        VALUES (?, ?, ?, ?, ?)
      `).run(reg, input.vehicleType, input.ownerName.trim(), input.ownerPhone.trim(), (input.vehicleModel || '').trim());
      vehicleId = Number(ins.lastInsertRowid);
    } else {
      vehicleId = vehicle.id;
      db.prepare(`
        UPDATE vehicles SET vehicle_type = ?, owner_name = ?, owner_phone = ?, vehicle_model = COALESCE(NULLIF(?, ''), vehicle_model)
        WHERE id = ?
      `).run(input.vehicleType, input.ownerName.trim(), input.ownerPhone.trim(), (input.vehicleModel || '').trim(), vehicleId);
    }

    // 3. Allocate slot (never assign an occupied or maintenance slot)
    let chosenSlot: { id: number; slot_code: string; zone: string; floor: string; hourly_rate: number; status: string; vehicle_type: string } | undefined;

    if (input.preferredSlotId) {
      chosenSlot = db.prepare('SELECT * FROM parking_slots WHERE id = ?').get(input.preferredSlotId) as typeof chosenSlot;
      if (!chosenSlot) {
        throw new AppError('Selected parking slot does not exist.', 404);
      }
      if (chosenSlot.status !== 'AVAILABLE') {
        throw new AppError(`Slot ${chosenSlot.slot_code} is currently ${chosenSlot.status.toLowerCase()} and cannot be assigned.`, 409);
      }
      if (chosenSlot.vehicle_type !== input.vehicleType) {
        throw new AppError(`Slot ${chosenSlot.slot_code} is designated for ${chosenSlot.vehicle_type.replace('_', ' ')} vehicles.`, 400);
      }
    } else {
      chosenSlot = db.prepare(`
        SELECT * FROM parking_slots
        WHERE status = 'AVAILABLE' AND vehicle_type = ?
        ORDER BY zone ASC, slot_code ASC
        LIMIT 1
      `).get(input.vehicleType) as typeof chosenSlot;
    }

    if (!chosenSlot) {
      throw new AppError(`Parking full: No available slots for ${input.vehicleType.replace('_', ' ')} vehicles.`, 409);
    }

    // 4. Mark slot OCCUPIED atomically
    const updateSlot = db.prepare(`UPDATE parking_slots SET status = 'OCCUPIED' WHERE id = ? AND status = 'AVAILABLE'`).run(chosenSlot.id);
    if (updateSlot.changes === 0) {
      throw new AppError('Selected slot was just occupied. Please try again.', 409);
    }

    // 5. Create active parking record
    const nowIso = new Date().toISOString();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `PKT-${nowIso.slice(0, 10).replace(/-/g, '')}-${randomSuffix}`;

    const recordRes = db.prepare(`
      INSERT INTO parking_records (ticket_number, vehicle_id, slot_id, admin_id, entry_time, hourly_rate, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).run(ticketNumber, vehicleId, chosenSlot.id, input.adminId, nowIso, chosenSlot.hourly_rate, (input.notes || '').trim());

    return db.prepare(`
      SELECT
        pr.id,
        pr.ticket_number as ticketNumber,
        pr.entry_time as entryTime,
        pr.hourly_rate as hourlyRate,
        pr.status,
        pr.notes,
        v.registration_number as registrationNumber,
        v.vehicle_type as vehicleType,
        v.owner_name as ownerName,
        v.owner_phone as ownerPhone,
        v.vehicle_model as vehicleModel,
        ps.id as slotId,
        ps.slot_code as slotCode,
        ps.zone,
        ps.floor
      FROM parking_records pr
      JOIN vehicles v ON v.id = pr.vehicle_id
      JOIN parking_slots ps ON ps.id = pr.slot_id
      WHERE pr.id = ?
    `).get(recordRes.lastInsertRowid);
  });

  return runEntryTx();
}

export function listActiveRecords() {
  const rows = db.prepare(`
    SELECT
      pr.id,
      pr.ticket_number as ticketNumber,
      pr.entry_time as entryTime,
      pr.hourly_rate as hourlyRate,
      pr.status,
      pr.notes,
      v.id as vehicleId,
      v.registration_number as registrationNumber,
      v.vehicle_type as vehicleType,
      v.owner_name as ownerName,
      v.owner_phone as ownerPhone,
      v.vehicle_model as vehicleModel,
      ps.id as slotId,
      ps.slot_code as slotCode,
      ps.zone,
      ps.floor
    FROM parking_records pr
    JOIN vehicles v ON v.id = pr.vehicle_id
    JOIN parking_slots ps ON ps.id = pr.slot_id
    WHERE pr.status = 'ACTIVE'
    ORDER BY pr.entry_time DESC
  `).all() as Array<{
    id: number;
    ticketNumber: string;
    entryTime: string;
    hourlyRate: number;
    status: string;
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
  }>;

  const nowIso = new Date().toISOString();
  return rows.map((row) => ({
    ...row,
    ...calculateFeeDetails(row.entryTime, nowIso, row.hourlyRate),
  }));
}

export function previewVehicleExit(params: { recordId?: number; registrationNumber?: string }) {
  let row:
    | {
        id: number;
        ticketNumber: string;
        entryTime: string;
        hourlyRate: number;
        registrationNumber: string;
        vehicleType: VehicleType;
        ownerName: string;
        ownerPhone: string;
        vehicleModel: string;
        slotCode: string;
        zone: string;
        floor: string;
      }
    | undefined;

  if (params.recordId) {
    row = db.prepare(`
      SELECT
        pr.id, pr.ticket_number as ticketNumber, pr.entry_time as entryTime, pr.hourly_rate as hourlyRate,
        v.registration_number as registrationNumber, v.vehicle_type as vehicleType, v.owner_name as ownerName, v.owner_phone as ownerPhone, v.vehicle_model as vehicleModel,
        ps.slot_code as slotCode, ps.zone, ps.floor
      FROM parking_records pr
      JOIN vehicles v ON v.id = pr.vehicle_id
      JOIN parking_slots ps ON ps.id = pr.slot_id
      WHERE pr.id = ? AND pr.status = 'ACTIVE'
    `).get(params.recordId) as typeof row;
  } else if (params.registrationNumber) {
    const reg = normalizePlate(params.registrationNumber);
    row = db.prepare(`
      SELECT
        pr.id, pr.ticket_number as ticketNumber, pr.entry_time as entryTime, pr.hourly_rate as hourlyRate,
        v.registration_number as registrationNumber, v.vehicle_type as vehicleType, v.owner_name as ownerName, v.owner_phone as ownerPhone, v.vehicle_model as vehicleModel,
        ps.slot_code as slotCode, ps.zone, ps.floor
      FROM parking_records pr
      JOIN vehicles v ON v.id = pr.vehicle_id
      JOIN parking_slots ps ON ps.id = pr.slot_id
      WHERE v.registration_number = ? AND pr.status = 'ACTIVE'
    `).get(reg) as typeof row;
  }

  if (!row) {
    throw new AppError('No active parking session found for the specified vehicle or ticket.', 404);
  }

  const previewTime = new Date().toISOString();
  return {
    ...row,
    previewExitTime: previewTime,
    ...calculateFeeDetails(row.entryTime, previewTime, row.hourlyRate),
  };
}

export function processVehicleExit(input: {
  recordId: number;
  paymentMethod: PaymentMethod;
  adminId: number;
}) {
  if (!['CASH', 'UPI', 'CARD'].includes(input.paymentMethod)) {
    throw new AppError('Invalid payment method. Choose CASH, UPI, or CARD.', 400);
  }

  const runExitTx = db.transaction(() => {
    const record = db.prepare(`
      SELECT
        pr.id, pr.ticket_number, pr.slot_id, pr.entry_time, pr.hourly_rate, pr.status,
        v.registration_number, v.vehicle_type, v.owner_name, v.owner_phone,
        ps.slot_code, ps.zone, ps.floor
      FROM parking_records pr
      JOIN vehicles v ON v.id = pr.vehicle_id
      JOIN parking_slots ps ON ps.id = pr.slot_id
      WHERE pr.id = ?
    `).get(input.recordId) as
      | {
          id: number;
          ticket_number: string;
          slot_id: number;
          entry_time: string;
          hourly_rate: number;
          status: string;
          registration_number: string;
          vehicle_type: VehicleType;
          owner_name: string;
          owner_phone: string;
          slot_code: string;
          zone: string;
          floor: string;
        }
      | undefined;

    if (!record) {
      throw new AppError('Parking record not found.', 404);
    }
    if (record.status !== 'ACTIVE') {
      throw new AppError('This parking record has already been checked out.', 409);
    }

    const exitTimeIso = new Date().toISOString();
    const fee = calculateFeeDetails(record.entry_time, exitTimeIso, record.hourly_rate);

    db.prepare(`
      UPDATE parking_records
      SET exit_time = ?, duration_minutes = ?, calculated_fee = ?, status = 'COMPLETED'
      WHERE id = ?
    `).run(exitTimeIso, fee.durationMinutes, fee.calculatedFee, record.id);

    // Release parking slot back to AVAILABLE
    db.prepare(`UPDATE parking_slots SET status = 'AVAILABLE' WHERE id = ?`).run(record.slot_id);

    const receiptNumber = `RCP-${exitTimeIso.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    db.prepare(`
      INSERT INTO payments (record_id, receipt_number, amount, payment_method, payment_status, paid_at, collected_by_admin_id)
      VALUES (?, ?, ?, ?, 'PAID', ?, ?)
    `).run(record.id, receiptNumber, fee.calculatedFee, input.paymentMethod, exitTimeIso, input.adminId);

    return {
      recordId: record.id,
      ticketNumber: record.ticket_number,
      receiptNumber,
      registrationNumber: record.registration_number,
      vehicleType: record.vehicle_type,
      ownerName: record.owner_name,
      ownerPhone: record.owner_phone,
      slotCode: record.slot_code,
      zone: record.zone,
      floor: record.floor,
      entryTime: record.entry_time,
      exitTime: exitTimeIso,
      durationMinutes: fee.durationMinutes,
      billedHours: fee.billedHours,
      hourlyRate: fee.hourlyRate,
      amountPaid: fee.calculatedFee,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'PAID',
    };
  });

  return runExitTx();
}

export function getParkingHistory(filters: {
  q?: string;
  status?: string;
  vehicleType?: string;
  date?: string;
}) {
  const conditions: string[] = [];
  const params: Array<string> = [];

  if (filters.q && filters.q.trim()) {
    const pattern = `%${filters.q.trim().toUpperCase()}%`;
    conditions.push(`(v.registration_number LIKE ? OR UPPER(pr.ticket_number) LIKE ? OR UPPER(v.owner_name) LIKE ? OR UPPER(ps.slot_code) LIKE ?)`);
    params.push(pattern, pattern, pattern, pattern);
  }
  if (filters.status && ['ACTIVE', 'COMPLETED'].includes(filters.status)) {
    conditions.push(`pr.status = ?`);
    params.push(filters.status);
  }
  if (filters.vehicleType && ['TWO_WHEELER', 'FOUR_WHEELER', 'EV', 'HEAVY'].includes(filters.vehicleType)) {
    conditions.push(`v.vehicle_type = ?`);
    params.push(filters.vehicleType);
  }
  if (filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
    conditions.push(`substr(pr.entry_time, 1, 10) = ?`);
    params.push(filters.date);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db.prepare(`
    SELECT
      pr.id,
      pr.ticket_number as ticketNumber,
      pr.entry_time as entryTime,
      pr.exit_time as exitTime,
      pr.duration_minutes as durationMinutes,
      pr.hourly_rate as hourlyRate,
      pr.calculated_fee as calculatedFee,
      pr.status,
      pr.notes,
      v.registration_number as registrationNumber,
      v.vehicle_type as vehicleType,
      v.owner_name as ownerName,
      v.owner_phone as ownerPhone,
      ps.slot_code as slotCode,
      ps.zone,
      ps.floor,
      p.receipt_number as receiptNumber,
      p.payment_method as paymentMethod,
      p.payment_status as paymentStatus,
      p.paid_at as paidAt,
      a.full_name as adminName
    FROM parking_records pr
    JOIN vehicles v ON v.id = pr.vehicle_id
    JOIN parking_slots ps ON ps.id = pr.slot_id
    JOIN admins a ON a.id = pr.admin_id
    LEFT JOIN payments p ON p.record_id = pr.id
    ${whereClause}
    ORDER BY pr.id DESC
    LIMIT 200
  `).all(...params);
}

export function getDailyReport(dateStr: string) {
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : new Date().toISOString().slice(0, 10);

  const summary = db.prepare(`
    SELECT
      COUNT(*) as totalEntries,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedExits,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as stillParked,
      COALESCE(AVG(CASE WHEN duration_minutes IS NOT NULL THEN duration_minutes END), 0) as avgDurationMinutes
    FROM parking_records
    WHERE substr(entry_time, 1, 10) = ?
  `).get(targetDate) as {
    totalEntries: number;
    completedExits: number;
    stillParked: number;
    avgDurationMinutes: number;
  };

  const revenueSummary = db.prepare(`
    SELECT
      COALESCE(SUM(amount), 0) as totalRevenue,
      COUNT(*) as totalTransactions
    FROM payments
    WHERE substr(paid_at, 1, 10) = ?
  `).get(targetDate) as { totalRevenue: number; totalTransactions: number };

  const byVehicleType = db.prepare(`
    SELECT
      v.vehicle_type as vehicleType,
      COUNT(pr.id) as vehicleCount,
      COALESCE(SUM(p.amount), 0) as revenue
    FROM parking_records pr
    JOIN vehicles v ON v.id = pr.vehicle_id
    LEFT JOIN payments p ON p.record_id = pr.id AND substr(p.paid_at, 1, 10) = ?
    WHERE substr(pr.entry_time, 1, 10) = ?
    GROUP BY v.vehicle_type
  `).all(targetDate, targetDate);

  const byPaymentMethod = db.prepare(`
    SELECT
      payment_method as paymentMethod,
      COUNT(*) as txCount,
      COALESCE(SUM(amount), 0) as totalAmount
    FROM payments
    WHERE substr(paid_at, 1, 10) = ?
    GROUP BY payment_method
  `).all(targetDate);

  const transactions = db.prepare(`
    SELECT
      p.receipt_number as receiptNumber,
      p.amount,
      p.payment_method as paymentMethod,
      p.paid_at as paidAt,
      pr.ticket_number as ticketNumber,
      pr.entry_time as entryTime,
      pr.exit_time as exitTime,
      pr.duration_minutes as durationMinutes,
      v.registration_number as registrationNumber,
      v.vehicle_type as vehicleType,
      v.owner_name as ownerName,
      ps.slot_code as slotCode
    FROM payments p
    JOIN parking_records pr ON pr.id = p.record_id
    JOIN vehicles v ON v.id = pr.vehicle_id
    JOIN parking_slots ps ON ps.id = pr.slot_id
    WHERE substr(p.paid_at, 1, 10) = ?
    ORDER BY p.paid_at DESC
  `).all(targetDate);

  return {
    date: targetDate,
    summary: {
      totalEntries: summary.totalEntries || 0,
      completedExits: summary.completedExits || 0,
      stillParked: summary.stillParked || 0,
      avgDurationMinutes: Math.round(summary.avgDurationMinutes || 0),
      totalRevenue: Number((revenueSummary.totalRevenue || 0).toFixed(2)),
      totalTransactions: revenueSummary.totalTransactions || 0,
    },
    byVehicleType,
    byPaymentMethod,
    transactions,
  };
}
