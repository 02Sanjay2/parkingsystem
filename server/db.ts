import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'parking.db');

export const db = new Database(DB_PATH);

// Enable foreign key constraints and WAL mode for reliable concurrent reads/writes
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'ADMIN',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_number TEXT NOT NULL UNIQUE,
      vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('TWO_WHEELER', 'FOUR_WHEELER', 'EV', 'HEAVY')),
      owner_name TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      vehicle_model TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parking_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_code TEXT NOT NULL UNIQUE,
      zone TEXT NOT NULL,
      floor TEXT NOT NULL,
      vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('TWO_WHEELER', 'FOUR_WHEELER', 'EV', 'HEAVY')),
      hourly_rate REAL NOT NULL CHECK (hourly_rate > 0),
      status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parking_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT NOT NULL UNIQUE,
      vehicle_id INTEGER NOT NULL,
      slot_id INTEGER NOT NULL,
      admin_id INTEGER NOT NULL,
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      duration_minutes INTEGER,
      hourly_rate REAL NOT NULL,
      calculated_fee REAL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED')),
      notes TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
      FOREIGN KEY (slot_id) REFERENCES parking_slots(id) ON DELETE RESTRICT,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL UNIQUE,
      receipt_number TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL CHECK (amount >= 0),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'CARD')),
      payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PENDING')),
      paid_at TEXT NOT NULL,
      collected_by_admin_id INTEGER NOT NULL,
      FOREIGN KEY (record_id) REFERENCES parking_records(id) ON DELETE RESTRICT,
      FOREIGN KEY (collected_by_admin_id) REFERENCES admins(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_records_status ON parking_records(status);
    CREATE INDEX IF NOT EXISTS idx_records_entry_time ON parking_records(entry_time);
    CREATE INDEX IF NOT EXISTS idx_vehicles_reg ON vehicles(registration_number);
    CREATE INDEX IF NOT EXISTS idx_slots_status_type ON parking_slots(status, vehicle_type);
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const adminCount = (db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number }).count;
  if (adminCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO admins (full_name, email, username, password_hash, phone, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Alex Morgan', 'admin@parkflow.io', 'admin', hash, '+1 555-0194', 'SUPER_ADMIN');
  }

  const slotCount = (db.prepare('SELECT COUNT(*) as count FROM parking_slots').get() as { count: number }).count;
  if (slotCount === 0) {
    const insertSlot = db.prepare(`
      INSERT INTO parking_slots (slot_code, zone, floor, vehicle_type, hourly_rate, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const seedSlots = db.transaction(() => {
      // Zone A: Ground Floor Four-Wheelers (A-01 to A-10)
      for (let i = 1; i <= 10; i++) {
        const code = `A-${String(i).padStart(2, '0')}`;
        insertSlot.run(code, 'Zone A', 'Ground', 'FOUR_WHEELER', 5.0, 'AVAILABLE');
      }
      // Zone B: Level 1 Two-Wheelers (B-01 to B-08)
      for (let i = 1; i <= 8; i++) {
        const code = `B-${String(i).padStart(2, '0')}`;
        insertSlot.run(code, 'Zone B', 'Level 1', 'TWO_WHEELER', 2.0, 'AVAILABLE');
      }
      // Zone EV: Ground EV Charging Bays (EV-01 to EV-04)
      for (let i = 1; i <= 4; i++) {
        const code = `EV-${String(i).padStart(2, '0')}`;
        insertSlot.run(code, 'Zone EV', 'Ground', 'EV', 6.0, 'AVAILABLE');
      }
      // Zone H: Outer Heavy Vehicles (H-01 to H-02)
      for (let i = 1; i <= 2; i++) {
        const code = `H-${String(i).padStart(2, '0')}`;
        insertSlot.run(code, 'Zone H', 'Outer Bay', 'HEAVY', 10.0, 'AVAILABLE');
      }
    });
    seedSlots();
  }

  const recordCount = (db.prepare('SELECT COUNT(*) as count FROM parking_records').get() as { count: number }).count;
  if (recordCount === 0) {
    const admin = db.prepare('SELECT id FROM admins ORDER BY id ASC LIMIT 1').get() as { id: number };
    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

    const seedOps = db.transaction(() => {
      const insertVehicle = db.prepare(`
        INSERT INTO vehicles (registration_number, vehicle_type, owner_name, owner_phone, vehicle_model)
        VALUES (?, ?, ?, ?, ?)
      `);

      const v1 = Number(insertVehicle.run('KA-01-MJ-4821', 'FOUR_WHEELER', 'Rohan Sharma', '+91 98450-11223', 'Honda City').lastInsertRowid);
      const v2 = Number(insertVehicle.run('KA-05-EQ-9012', 'EV', 'Priya Nair', '+91 98451-33445', 'Tata Nexon EV').lastInsertRowid);
      const v3 = Number(insertVehicle.run('MH-12-TR-3310', 'TWO_WHEELER', 'Vikram Patel', '+91 97650-88990', 'Royal Enfield Classic').lastInsertRowid);
      const v4 = Number(insertVehicle.run('DL-08-CX-7745', 'FOUR_WHEELER', 'Sneha Verma', '+91 98112-44556', 'Hyundai Creta').lastInsertRowid);
      const v5 = Number(insertVehicle.run('TN-09-AB-1290', 'HEAVY', 'Karthik Logistics', '+91 94440-77665', 'Tata Prima Cargo').lastInsertRowid);
      const v6 = Number(insertVehicle.run('KA-03-HK-5501', 'TWO_WHEELER', 'Ananya Rao', '+91 99001-22334', 'Honda Activa 6G').lastInsertRowid);
      const v7 = Number(insertVehicle.run('KA-01-ZZ-8820', 'FOUR_WHEELER', 'Devendra Kulkarni', '+91 98800-55443', 'Toyota Innova').lastInsertRowid);

      const getSlot = (code: string) =>
        db.prepare('SELECT id, hourly_rate FROM parking_slots WHERE slot_code = ?').get(code) as { id: number; hourly_rate: number };

      const occupySlot = db.prepare(`UPDATE parking_slots SET status = 'OCCUPIED' WHERE id = ?`);
      const insertActiveRecord = db.prepare(`
        INSERT INTO parking_records (ticket_number, vehicle_id, slot_id, admin_id, entry_time, hourly_rate, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
      `);

      // 4 active vehicles currently parked
      const sA01 = getSlot('A-01');
      occupySlot.run(sA01.id);
      insertActiveRecord.run('PKT-2026-1001', v1, sA01.id, admin.id, hoursAgo(2.5), sA01.hourly_rate, 'Ground floor near Gate 1');

      const sA02 = getSlot('A-02');
      occupySlot.run(sA02.id);
      insertActiveRecord.run('PKT-2026-1002', v4, sA02.id, admin.id, hoursAgo(1.2), sA02.hourly_rate, 'Visitor pass');

      const sEV01 = getSlot('EV-01');
      occupySlot.run(sEV01.id);
      insertActiveRecord.run('PKT-2026-1003', v2, sEV01.id, admin.id, hoursAgo(3.1), sEV01.hourly_rate, 'Fast charger bay');

      const sB01 = getSlot('B-01');
      occupySlot.run(sB01.id);
      insertActiveRecord.run('PKT-2026-1004', v3, sB01.id, admin.id, hoursAgo(0.75), sB01.hourly_rate, 'Helmet locker issued');

      // 4 completed exits today + 1 yesterday for rich reports & history
      const insertCompleted = db.prepare(`
        INSERT INTO parking_records (ticket_number, vehicle_id, slot_id, admin_id, entry_time, exit_time, duration_minutes, hourly_rate, calculated_fee, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
      `);
      const insertPayment = db.prepare(`
        INSERT INTO payments (record_id, receipt_number, amount, payment_method, payment_status, paid_at, collected_by_admin_id)
        VALUES (?, ?, ?, ?, 'PAID', ?, ?)
      `);

      const sA03 = getSlot('A-03');
      const r1 = Number(insertCompleted.run('PKT-2026-0997', v7, sA03.id, admin.id, hoursAgo(6), hoursAgo(3.5), 150, sA03.hourly_rate, 15.0, 'Settled at exit gate').lastInsertRowid);
      insertPayment.run(r1, 'RCP-2026-0997', 15.0, 'UPI', hoursAgo(3.5), admin.id);

      const sB02 = getSlot('B-02');
      const r2 = Number(insertCompleted.run('PKT-2026-0998', v6, sB02.id, admin.id, hoursAgo(5), hoursAgo(2.8), 132, sB02.hourly_rate, 6.0, '').lastInsertRowid);
      insertPayment.run(r2, 'RCP-2026-0998', 6.0, 'CASH', hoursAgo(2.8), admin.id);

      const sH01 = getSlot('H-01');
      const r3 = Number(insertCompleted.run('PKT-2026-0999', v5, sH01.id, admin.id, hoursAgo(8), hoursAgo(4.2), 228, sH01.hourly_rate, 40.0, 'Delivery unloading').lastInsertRowid);
      insertPayment.run(r3, 'RCP-2026-0999', 40.0, 'CARD', hoursAgo(4.2), admin.id);

      // Yesterday record
      const r4 = Number(insertCompleted.run('PKT-2026-0996', v1, sA03.id, admin.id, hoursAgo(28), hoursAgo(25), 180, sA03.hourly_rate, 15.0, 'Previous day visit').lastInsertRowid);
      insertPayment.run(r4, 'RCP-2026-0996', 15.0, 'UPI', hoursAgo(25), admin.id);
    });

    seedOps();
  }
}
