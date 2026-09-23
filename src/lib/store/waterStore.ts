import fs from 'fs';
import path from 'path';

export interface WaterLog {
  user_id: string;
  date: string; // YYYY-MM-DD
  water_ml: number;
  updated_at: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const FILE_PATH = path.join(DATA_DIR, 'water_logs.json');

function ensureFile(): WaterLog[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify([]), 'utf-8');
      return [];
    }
    const content = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(content) || [];
  } catch (err) {
    console.error('Error reading water_logs.json:', err);
    return [];
  }
}

export function getWaterIntake(userId: string, date: string): number {
  const logs = ensureFile();
  const entry = logs.find((l) => l.user_id === userId && l.date === date);
  return entry ? entry.water_ml : 0;
}

export function setWaterIntake(userId: string, date: string, water_ml: number): number {
  const logs = ensureFile();
  const existingIdx = logs.findIndex((l) => l.user_id === userId && l.date === date);
  const safeAmount = Math.max(0, Math.round(water_ml));

  const record: WaterLog = {
    user_id: userId,
    date,
    water_ml: safeAmount,
    updated_at: new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    logs[existingIdx] = record;
  } else {
    logs.push(record);
  }

  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing water_logs.json:', err);
  }

  return safeAmount;
}

export function getWaterLogsRange(userId: string, startDate: string, endDate: string): WaterLog[] {
  const logs = ensureFile();
  return logs.filter((l) => l.user_id === userId && l.date >= startDate && l.date <= endDate);
}
