import Dexie, { type EntityTable } from 'dexie';
import type { PatientCase } from '../../types.ts';

export const db = new Dexie('AlHakimDB') as Dexie & {
  records: EntityTable<PatientCase, 'id'>;
  settings: EntityTable<any, 'id'>;
};

// Schema declaration:
// 'id' is the primary key. We index fields that we might want to query by.
db.version(1).stores({
  records: 'id, date, name, gender, status',
  settings: 'id'
});

const LOCAL_STORAGE_BACKUP_KEY = 'alhakim_emergency_records_backup';

/**
 * Robust local persistence helper that saves to Dexie IndexedDB and mirrors
 * a lightweight snapshot in localStorage for multi-layer data protection.
 */
export async function saveRecordLocally(record: PatientCase): Promise<void> {
  // 1. Primary storage in IndexedDB (handles gigabytes, large images, reports, chats)
  await db.records.put(record);

  // 2. Secondary backup in localStorage (resilient against browser DB purge)
  try {
    const existing = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    const list: any[] = existing ? JSON.parse(existing) : [];
    const index = list.findIndex((r: any) => r.id === record.id);
    if (index >= 0) {
      list[index] = record;
    } else {
      list.unshift(record);
    }
    // Keep most recent 50 records in emergency local storage snapshot
    const trimmed = list.slice(0, 50);
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // LocalStorage quota might be exceeded due to images; IndexedDB remains primary
  }
}

/**
 * Loads all records with multi-layer recovery from IndexedDB or emergency snapshot.
 */
export async function loadAllLocalRecords(): Promise<PatientCase[]> {
  try {
    const list = await db.records.toArray();
    if (list && list.length > 0) {
      // Sort newest first
      return list.sort((a, b) => Number(b.id || 0) - Number(a.id || 0) || b.id.localeCompare(a.id));
    }
  } catch (err) {
    console.warn("IndexedDB read warning, checking fallback storage:", err);
  }

  // Fallback to secondary localStorage snapshot if IndexedDB is empty
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    if (raw) {
      const parsed: PatientCase[] = JSON.parse(raw);
      if (parsed && parsed.length > 0) {
        // Re-seed IndexedDB
        await db.records.bulkPut(parsed).catch(() => {});
        return parsed.sort((a, b) => Number(b.id || 0) - Number(a.id || 0) || b.id.localeCompare(a.id));
      }
    }
  } catch (e) {}

  return [];
}

/**
 * Exports complete medical database to a downloadable JSON file.
 */
export async function exportDatabaseBackup(): Promise<string> {
  const records = await db.records.toArray();
  const exportPayload = {
    appName: "AlHakim Pro",
    exportDate: new Date().toISOString(),
    version: "4.0",
    totalRecords: records.length,
    records
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Imports and merges a backup JSON file into the local IndexedDB database.
 */
export async function importDatabaseBackup(jsonContent: string): Promise<number> {
  const parsed = JSON.parse(jsonContent);
  const recordsToImport: PatientCase[] = Array.isArray(parsed) ? parsed : (parsed.records || []);
  if (!Array.isArray(recordsToImport) || recordsToImport.length === 0) {
    throw new Error("ملف النسخة الاحتياطية فارغ أو غير متوافق");
  }
  await db.records.bulkPut(recordsToImport);
  return recordsToImport.length;
}
