import fs from 'fs';
import path from 'path';
import os from 'os';
import { WaterLog } from '@/types/database';
import { isServiceRoleConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { getDb } from './mockDb';

export type { WaterLog };

const DATA_DIR = path.join(process.cwd(), '.data');
const LOCAL_FILE = path.join(DATA_DIR, 'water_logs.json');
const TMP_FILE = path.join(os.tmpdir(), 'duocal_water_logs.json');

// Memoria compartida para hot-reloads y serverless invocations
const globalForWater = global as unknown as { duoCalWaterLogs?: WaterLog[] };
if (!globalForWater.duoCalWaterLogs) {
  globalForWater.duoCalWaterLogs = [];
}

function updateMemoryCache(record: WaterLog) {
  if (!globalForWater.duoCalWaterLogs) globalForWater.duoCalWaterLogs = [];
  const idx = globalForWater.duoCalWaterLogs.findIndex(
    (l) => l.user_id === record.user_id && l.date === record.date
  );
  if (idx !== -1) {
    globalForWater.duoCalWaterLogs[idx] = record;
  } else {
    globalForWater.duoCalWaterLogs.push(record);
  }
}

function getWritableFilePath(): string | null {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return LOCAL_FILE;
  } catch {
    // Si process.cwd() es de solo lectura (ej. Vercel Serverless), usar os.tmpdir()
    try {
      return TMP_FILE;
    } catch {
      return null;
    }
  }
}

function readLocalFiles(): WaterLog[] {
  try {
    if (fs.existsSync(LOCAL_FILE)) {
      const content = fs.readFileSync(LOCAL_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  try {
    if (fs.existsSync(TMP_FILE)) {
      const content = fs.readFileSync(TMP_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

function writeLocalFile(logs: WaterLog[]): void {
  const filePath = getWritableFilePath();
  if (filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf-8');
      return;
    } catch {}
  }

  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch {}
}

/**
 * Obtiene el registro de agua autoritativo de Supabase con fallback a memoria y archivo local.
 * Retorna `{ water_ml, has_record }` para distinguir entre "0 ml explícito" y "sin registro".
 */
export async function getWaterRecord(
  userId: string,
  date: string
): Promise<{ water_ml: number; has_record: boolean }> {
  // 1. Supabase (fuente de verdad permanente en la nube)
  if (isServiceRoleConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from('water_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

      if (!error && data) {
        updateMemoryCache(data);
        return { water_ml: Number(data.water_ml) || 0, has_record: true };
      }
      if (!error && data === null) {
        return { water_ml: 0, has_record: false };
      }
    } catch {
      // Si la tabla no ha sido creada aún en Supabase, continúa al fallback
    }
  }

  // 2. Caché en memoria global
  if (globalForWater.duoCalWaterLogs) {
    const memEntry = globalForWater.duoCalWaterLogs.find((l) => l.user_id === userId && l.date === date);
    if (memEntry) {
      return { water_ml: memEntry.water_ml, has_record: true };
    }
  }

  // 3. InMemoryDB (mockDb)
  const db = await getDb();
  const dbEntry = db.water_logs?.find((l) => l.user_id === userId && l.date === date);
  if (dbEntry) {
    updateMemoryCache(dbEntry);
    return { water_ml: dbEntry.water_ml, has_record: true };
  }

  // 4. Archivo local / tmp
  const fileLogs = readLocalFiles();
  const fileEntry = fileLogs.find((l) => l.user_id === userId && l.date === date);
  if (fileEntry) {
    updateMemoryCache(fileEntry);
    return { water_ml: fileEntry.water_ml, has_record: true };
  }

  return { water_ml: 0, has_record: false };
}

/**
 * Función sincrónica de lectura rápida para reportes e informes.
 */
export function getWaterIntakeSync(userId: string, date: string): number {
  if (globalForWater.duoCalWaterLogs) {
    const memEntry = globalForWater.duoCalWaterLogs.find((l) => l.user_id === userId && l.date === date);
    if (memEntry) return memEntry.water_ml;
  }
  const fileLogs = readLocalFiles();
  const fileEntry = fileLogs.find((l) => l.user_id === userId && l.date === date);
  return fileEntry ? fileEntry.water_ml : 0;
}

/**
 * Compatibilidad con firmas anteriores (retorna solo el número).
 */
export async function getWaterIntake(userId: string, date: string): Promise<number> {
  const res = await getWaterRecord(userId, date);
  return res.water_ml;
}

/**
 * Guarda el consumo de agua permanentemente en Supabase, memoria y fallback local.
 */
export async function setWaterIntake(
  userId: string,
  date: string,
  water_ml: number
): Promise<{ water_ml: number; has_record: boolean }> {
  const safeAmount = Math.max(0, Math.round(water_ml));
  const now = new Date().toISOString();

  const record: WaterLog = {
    id: `w_${userId.slice(0, 8)}_${date}`,
    user_id: userId,
    date,
    water_ml: safeAmount,
    updated_at: now,
  };

  // 1. Persistencia prioritaria en Supabase
  if (isServiceRoleConfigured) {
    try {
      const payload = {
        user_id: userId,
        date,
        water_ml: safeAmount,
        updated_at: now,
      };

      const { data, error } = await supabaseAdmin
        .from('water_logs')
        .upsert(payload, { onConflict: 'user_id,date' })
        .select()
        .maybeSingle();

      if (!error && data) {
        record.id = data.id || record.id;
      }
    } catch (err) {
      console.warn('Advertencia al guardar agua en Supabase:', err);
    }
  }

  // 2. Memoria compartida y mockDb
  updateMemoryCache(record);
  try {
    const db = await getDb();
    if (!db.water_logs) db.water_logs = [];
    const dbIdx = db.water_logs.findIndex((l) => l.user_id === userId && l.date === date);
    if (dbIdx !== -1) {
      db.water_logs[dbIdx] = record;
    } else {
      db.water_logs.push(record);
    }
  } catch {}

  // 3. Archivo local / tmp
  try {
    const fileLogs = readLocalFiles();
    const fIdx = fileLogs.findIndex((l) => l.user_id === userId && l.date === date);
    if (fIdx !== -1) {
      fileLogs[fIdx] = record;
    } else {
      fileLogs.push(record);
    }
    writeLocalFile(fileLogs);
  } catch {}

  return { water_ml: safeAmount, has_record: true };
}

/**
 * Obtiene el registro de un rango de fechas.
 */
export async function getWaterLogsRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<WaterLog[]> {
  if (isServiceRoleConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from('water_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (!error && data) {
        for (const item of data) {
          updateMemoryCache(item);
        }
        return data;
      }
    } catch {}
  }

  const db = await getDb();
  if (db.water_logs && db.water_logs.length > 0) {
    return db.water_logs.filter((l) => l.user_id === userId && l.date >= startDate && l.date <= endDate);
  }

  const fileLogs = readLocalFiles();
  return fileLogs.filter((l) => l.user_id === userId && l.date >= startDate && l.date <= endDate);
}
