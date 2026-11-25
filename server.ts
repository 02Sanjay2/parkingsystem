import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db, initializeDatabase } from './server/db.ts';
import { requireAuth, signAdminToken, type AuthenticatedRequest } from './server/middleware/auth.ts';
import {
  AppError,
  createParkingSlot,
  getDailyReport,
  getDashboardData,
  getParkingHistory,
  listActiveRecords,
  listSlotsWithOccupant,
  listVehicles,
  previewVehicleExit,
  processVehicleEntry,
  processVehicleExit,
  registerVehicle,
  updateParkingSlot,
  updateVehicle,
} from './server/services/parkingService.ts';

initializeDatabase();

const app = express();
const PORT = 3000;

app.use(express.json());

// ============================================================================
// 1. AUTHENTICATION & ADMIN PROFILE CONTROLLER
// ============================================================================

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { fullName, email, username, password, phone } = req.body ?? {};
  if (!fullName || String(fullName).trim().length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    res.status(400).json({ error: 'Valid email address is required.' });
    return;
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const rawUser = username ? String(username).trim() : cleanEmail.split('@')[0];
  const cleanUser = rawUser.toLowerCase().replace(/\s+/g, '');

  if (cleanUser.length < 3) {
    res.status(400).json({ error: 'Username must be at least 3 characters.' });
    return;
  }
  if (!password || String(password).length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM admins WHERE email = ? OR username = ?')
    .get(cleanEmail, cleanUser);

  if (existing) {
    res.status(409).json({ error: 'A user with that email or username already exists. Try signing in instead.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(String(password), 10);
  const result = db
    .prepare(`
      INSERT INTO admins (full_name, email, username, password_hash, phone, role)
      VALUES (?, ?, ?, ?, ?, 'ADMIN')
    `)
    .run(String(fullName).trim(), cleanEmail, cleanUser, passwordHash, String(phone || '').trim());

  const adminId = Number(result.lastInsertRowid);
  const admin = db
    .prepare('SELECT id, full_name as fullName, email, username, phone, role, created_at as createdAt FROM admins WHERE id = ?')
    .get(adminId) as { id: number; fullName: string; email: string; username: string; phone: string; role: string; createdAt: string };

  const token = signAdminToken({
    id: admin.id,
    username: admin.username,
    email: admin.email,
    role: admin.role,
  });

  res.status(201).json({ token, admin });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body ?? {};
  if (!identifier || !password) {
    res.status(400).json({ error: 'Username/email and password are required.' });
    return;
  }

  const cleanIdentifier = String(identifier).trim().toLowerCase();
  const adminRow = db
    .prepare('SELECT * FROM admins WHERE LOWER(username) = ? OR LOWER(email) = ?')
    .get(cleanIdentifier, cleanIdentifier) as
    | {
        id: number;
        full_name: string;
        email: string;
        username: string;
        password_hash: string;
        phone: string;
        role: string;
        created_at: string;
      }
    | undefined;

  if (!adminRow || !bcrypt.compareSync(String(password), adminRow.password_hash)) {
    res.status(401).json({ error: 'Invalid username/email or password.' });
    return;
  }

  const token = signAdminToken({
    id: adminRow.id,
    username: adminRow.username,
    email: adminRow.email,
    role: adminRow.role,
  });

  res.json({
    token,
    admin: {
      id: adminRow.id,
      fullName: adminRow.full_name,
      email: adminRow.email,
      username: adminRow.username,
      phone: adminRow.phone,
      role: adminRow.role,
      createdAt: adminRow.created_at,
    },
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const admin = db
    .prepare('SELECT id, full_name as fullName, email, username, phone, role, created_at as createdAt FROM admins WHERE id = ?')
    .get(req.admin!.id);

  if (!admin) {
    res.status(404).json({ error: 'Admin account not found.' });
    return;
  }
  res.json({ admin });
});

app.put('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { fullName, email, phone, currentPassword, newPassword } = req.body ?? {};
  const adminRow = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin!.id) as
    | {
        id: number;
        full_name: string;
        email: string;
        username: string;
        password_hash: string;
        phone: string;
        role: string;
        created_at: string;
      }
    | undefined;

  if (!adminRow) {
    res.status(404).json({ error: 'Admin account not found.' });
    return;
  }

  const nextName = fullName ? String(fullName).trim() : adminRow.full_name;
  const nextEmail = email ? String(email).trim().toLowerCase() : adminRow.email;
  const nextPhone = phone !== undefined ? String(phone).trim() : adminRow.phone;

  if (nextName.length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    res.status(400).json({ error: 'Valid email address is required.' });
    return;
  }

  const emailConflict = db
    .prepare('SELECT id FROM admins WHERE email = ? AND id != ?')
    .get(nextEmail, adminRow.id);
  if (emailConflict) {
    res.status(409).json({ error: 'Another admin is already using that email address.' });
    return;
  }

  let nextHash = adminRow.password_hash;
  if (newPassword) {
    if (!currentPassword || !bcrypt.compareSync(String(currentPassword), adminRow.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    nextHash = bcrypt.hashSync(String(newPassword), 10);
  }

  db.prepare(`
    UPDATE admins SET full_name = ?, email = ?, phone = ?, password_hash = ? WHERE id = ?
  `).run(nextName, nextEmail, nextPhone, nextHash, adminRow.id);

  const updated = db
    .prepare('SELECT id, full_name as fullName, email, username, phone, role, created_at as createdAt FROM admins WHERE id = ?')
    .get(adminRow.id);

  res.json({ admin: updated });
});

// ============================================================================
// 2. DASHBOARD CONTROLLER
// ============================================================================

app.get('/api/dashboard', requireAuth, (_req: Request, res: Response) => {
  res.json(getDashboardData());
});

// ============================================================================
// 3. PARKING SLOTS CONTROLLER
// ============================================================================

app.get('/api/slots', requireAuth, (_req: Request, res: Response) => {
  res.json({ slots: listSlotsWithOccupant() });
});

app.post('/api/slots', requireAuth, (req: Request, res: Response) => {
  const { slotCode, zone, floor, vehicleType, hourlyRate } = req.body ?? {};
  const slot = createParkingSlot({
    slotCode: String(slotCode || ''),
    zone: String(zone || 'Zone A'),
    floor: String(floor || 'Ground'),
    vehicleType,
    hourlyRate: Number(hourlyRate),
  });
  res.status(201).json({ slot });
});

app.patch('/api/slots/:id', requireAuth, (req: Request, res: Response) => {
  const slotId = Number(req.params.id);
  const { status, hourlyRate } = req.body ?? {};
  const slot = updateParkingSlot(slotId, {
    status,
    hourlyRate: hourlyRate !== undefined ? Number(hourlyRate) : undefined,
  });
  res.json({ slot });
});

// ============================================================================
// 4. VEHICLES CONTROLLER
// ============================================================================

app.get('/api/vehicles', requireAuth, (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  res.json({ vehicles: listVehicles(q) });
});

app.post('/api/vehicles', requireAuth, (req: Request, res: Response) => {
  const { registrationNumber, vehicleType, ownerName, ownerPhone, vehicleModel } = req.body ?? {};
  const vehicle = registerVehicle({
    registrationNumber: String(registrationNumber || ''),
    vehicleType,
    ownerName: String(ownerName || ''),
    ownerPhone: String(ownerPhone || ''),
    vehicleModel: vehicleModel ? String(vehicleModel) : '',
  });
  res.status(201).json({ vehicle });
});

app.put('/api/vehicles/:id', requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { vehicleType, ownerName, ownerPhone, vehicleModel } = req.body ?? {};
  const vehicle = updateVehicle(id, {
    vehicleType,
    ownerName: String(ownerName || ''),
    ownerPhone: String(ownerPhone || ''),
    vehicleModel: vehicleModel ? String(vehicleModel) : '',
  });
  res.json({ vehicle });
});

// ============================================================================
// 5. PARKING ENTRY, EXIT, HISTORY & DAILY REPORTS CONTROLLER
// ============================================================================

app.get('/api/parking/active', requireAuth, (_req: Request, res: Response) => {
  res.json({ activeRecords: listActiveRecords() });
});

app.post('/api/parking/entry', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { registrationNumber, vehicleType, ownerName, ownerPhone, vehicleModel, preferredSlotId, notes } = req.body ?? {};
  const record = processVehicleEntry({
    registrationNumber: String(registrationNumber || ''),
    vehicleType,
    ownerName: String(ownerName || ''),
    ownerPhone: String(ownerPhone || ''),
    vehicleModel: vehicleModel ? String(vehicleModel) : '',
    preferredSlotId: preferredSlotId ? Number(preferredSlotId) : undefined,
    notes: notes ? String(notes) : '',
    adminId: req.admin!.id,
  });
  res.status(201).json({ record });
});

app.get('/api/parking/exit-preview', requireAuth, (req: Request, res: Response) => {
  const recordId = req.query.recordId ? Number(req.query.recordId) : undefined;
  const registrationNumber = typeof req.query.registrationNumber === 'string' ? req.query.registrationNumber : undefined;
  const preview = previewVehicleExit({ recordId, registrationNumber });
  res.json({ preview });
});

app.post('/api/parking/exit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { recordId, paymentMethod } = req.body ?? {};
  if (!recordId) {
    res.status(400).json({ error: 'Parking record ID is required.' });
    return;
  }
  const receipt = processVehicleExit({
    recordId: Number(recordId),
    paymentMethod,
    adminId: req.admin!.id,
  });
  res.json({ receipt });
});

app.get('/api/parking/history', requireAuth, (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const vehicleType = typeof req.query.vehicleType === 'string' ? req.query.vehicleType : undefined;
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  res.json({ records: getParkingHistory({ q, status, vehicleType, date }) });
});

app.get('/api/reports/daily', requireAuth, (req: Request, res: Response) => {
  const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
  res.json({ report: getDailyReport(date) });
});

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Unhandled API Error:', err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ParkFlow Server running on http://localhost:${PORT}`);
  });
}

startServer();
