import { Platform } from 'react-native';

export interface Transaction {
  id: number;
  amount: number;
  category: string;
  ai_suggestion: string | null;
  confidence: number | null;
  user_overrode: number;
  note: string | null;
  raw_sms: string | null;
  created_at: number;
}

// ---------------------------------------------------------------------------
// In-memory fallback for web (expo-sqlite WASM doesn't bundle in Metro web)
// ---------------------------------------------------------------------------
export interface Budget {
  category: string;
  amount: number;
  month: number;
}

let memoryStore: Transaction[] = [];
let memoryIdCounter = 0;
let memoryBudgets: Budget[] = [];

const webFallback = {
  async insert(tx: Omit<Transaction, 'id' | 'created_at'>, createdAt?: number): Promise<number> {
    const id = ++memoryIdCounter;
    memoryStore.push({ ...tx, id, created_at: createdAt ?? Math.floor(Date.now() / 1000) });
    return id;
  },
  async update(id: number, updates: { category?: string; note?: string }) {
    const t = memoryStore.find((x) => x.id === id);
    if (!t) return;
    if (updates.category !== undefined) t.category = updates.category;
    if (updates.note !== undefined) t.note = updates.note;
  },
  async remove(id: number) {
    memoryStore = memoryStore.filter((x) => x.id !== id);
  },
  async all(): Promise<Transaction[]> {
    return [...memoryStore].sort((a, b) => b.created_at - a.created_at);
  },
  async range(startTs: number, endTs: number): Promise<Transaction[]> {
    return memoryStore
      .filter((t) => t.created_at >= startTs && t.created_at <= endTs)
      .sort((a, b) => b.created_at - a.created_at);
  },
  async byId(id: number): Promise<Transaction | null> {
    return memoryStore.find((x) => x.id === id) ?? null;
  },
  async avg(days: number): Promise<number> {
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const recent = memoryStore.filter((t) => t.created_at >= since);
    if (recent.length === 0) return 0;
    return recent.reduce((s, t) => s + t.amount, 0) / recent.length;
  },
  async totalRange(startTs: number, endTs: number): Promise<number> {
    return memoryStore
      .filter((t) => t.created_at >= startTs && t.created_at <= endTs)
      .reduce((s, t) => s + t.amount, 0);
  },
};

const isWeb = Platform.OS === 'web';

// ---------------------------------------------------------------------------
// Native SQLite (only imported on non-web)
// ---------------------------------------------------------------------------
let db: any = null;

async function getDb(): Promise<any> {
  if (!db) {
    const SQLite = require('expo-sqlite');
    db = await SQLite.openDatabaseAsync('expenses.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        amount        REAL NOT NULL,
        category      TEXT NOT NULL,
        ai_suggestion TEXT,
        confidence    INTEGER,
        user_overrode INTEGER DEFAULT 0,
        note          TEXT,
        raw_sms       TEXT,
        created_at    INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS budgets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        category   TEXT NOT NULL,
        amount     REAL NOT NULL,
        month      INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(category, month)
      );
    `);
  }
  return db;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function insertTransaction(tx: {
  amount: number;
  category: string;
  ai_suggestion: string | null;
  confidence: number | null;
  user_overrode: number;
  note: string | null;
  raw_sms: string | null;
}): Promise<number> {
  if (isWeb) return webFallback.insert(tx as any);

  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO transactions (amount, category, ai_suggestion, confidence, user_overrode, note, raw_sms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    tx.amount,
    tx.category,
    tx.ai_suggestion,
    tx.confidence,
    tx.user_overrode,
    tx.note,
    tx.raw_sms,
    Math.floor(Date.now() / 1000)
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(
  id: number,
  updates: { category?: string; note?: string }
): Promise<void> {
  if (isWeb) return webFallback.update(id, updates);

  const database = await getDb();
  const sets: string[] = [];
  const values: any[] = [];

  if (updates.category !== undefined) {
    sets.push('category = ?');
    values.push(updates.category);
  }
  if (updates.note !== undefined) {
    sets.push('note = ?');
    values.push(updates.note);
  }

  if (sets.length === 0) return;
  values.push(id);
  await database.runAsync(
    `UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`,
    ...values
  );
}

export async function deleteTransaction(id: number): Promise<void> {
  if (isWeb) return webFallback.remove(id);

  const database = await getDb();
  await database.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export async function clearAllTransactions(): Promise<void> {
  if (isWeb) return;
  const database = await getDb();
  await database.runAsync('DELETE FROM transactions');
}

export async function getAllTransactions(): Promise<Transaction[]> {
  if (isWeb) return webFallback.all();

  const database = await getDb();
  return database.getAllAsync(
    'SELECT * FROM transactions ORDER BY created_at DESC'
  );
}

export async function getTransactionsInRange(
  startTs: number,
  endTs: number
): Promise<Transaction[]> {
  if (isWeb) return webFallback.range(startTs, endTs);

  const database = await getDb();
  return database.getAllAsync(
    'SELECT * FROM transactions WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC',
    startTs,
    endTs
  );
}

export async function getTransactionById(
  id: number
): Promise<Transaction | null> {
  if (isWeb) return webFallback.byId(id);

  const database = await getDb();
  const result = await database.getFirstAsync(
    'SELECT * FROM transactions WHERE id = ?',
    id
  );
  return result ?? null;
}

export async function getAverageSpend(days: number): Promise<number> {
  if (isWeb) return webFallback.avg(days);

  const database = await getDb();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const result = await database.getFirstAsync(
    'SELECT AVG(amount) as avg_amount FROM transactions WHERE created_at >= ?',
    since
  );
  return result?.avg_amount ?? 0;
}

export async function getTotalSpendInRange(
  startTs: number,
  endTs: number
): Promise<number> {
  if (isWeb) return webFallback.totalRange(startTs, endTs);

  const database = await getDb();
  const result = await database.getFirstAsync(
    'SELECT SUM(amount) as total FROM transactions WHERE created_at >= ? AND created_at <= ?',
    startTs,
    endTs
  );
  return result?.total ?? 0;
}

/** Insert with a specific timestamp — used for seeding fake data */
export async function insertTransactionAt(
  tx: {
    amount: number;
    category: string;
    ai_suggestion: string | null;
    confidence: number | null;
    user_overrode: number;
    note: string | null;
    raw_sms: string | null;
  },
  createdAt: number
): Promise<number> {
  if (isWeb) return webFallback.insert(tx as any, createdAt);

  const database = await getDb();
  const result = await database.runAsync(
    `INSERT INTO transactions (amount, category, ai_suggestion, confidence, user_overrode, note, raw_sms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    tx.amount,
    tx.category,
    tx.ai_suggestion,
    tx.confidence,
    tx.user_overrode,
    tx.note,
    tx.raw_sms,
    createdAt
  );
  return result.lastInsertRowId;
}

// ---------------------------------------------------------------------------
// Budget API
// ---------------------------------------------------------------------------

export function getCurrentMonth(): number {
  const now = new Date();
  return now.getFullYear() * 100 + now.getMonth() + 1;
}

export async function setBudget(category: string, amount: number, month?: number): Promise<void> {
  const m = month ?? getCurrentMonth();
  const now = Math.floor(Date.now() / 1000);

  if (isWeb) {
    const existing = memoryBudgets.findIndex((b) => b.category === category && b.month === m);
    if (existing >= 0) {
      memoryBudgets[existing].amount = amount;
    } else {
      memoryBudgets.push({ category, amount, month: m });
    }
    return;
  }

  const database = await getDb();
  await database.runAsync(
    `INSERT INTO budgets (category, amount, month, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(category, month) DO UPDATE SET amount = ?, updated_at = ?`,
    category, amount, m, now, amount, now
  );
}

export async function getAllBudgets(month?: number): Promise<Budget[]> {
  const m = month ?? getCurrentMonth();

  if (isWeb) {
    return memoryBudgets.filter((b) => b.month === m);
  }

  const database = await getDb();
  return database.getAllAsync(
    'SELECT category, amount, month FROM budgets WHERE month = ?',
    m
  );
}

export async function deleteBudget(category: string, month?: number): Promise<void> {
  const m = month ?? getCurrentMonth();

  if (isWeb) {
    memoryBudgets = memoryBudgets.filter((b) => !(b.category === category && b.month === m));
    return;
  }

  const database = await getDb();
  await database.runAsync(
    'DELETE FROM budgets WHERE category = ? AND month = ?',
    category, m
  );
}
