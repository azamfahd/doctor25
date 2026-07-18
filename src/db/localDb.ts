import Dexie, { type EntityTable } from 'dexie';
import type { PatientCase } from '../../types.ts';

export const db = new Dexie('AlHakimDB') as Dexie & {
  records: EntityTable<PatientCase, 'id'>;
  settings: EntityTable<any, 'id'>;
};

// Schema declaration:
// 'id' is the primary key. We index fields that we might want to query by.
db.version(1).stores({
  records: 'id, date, name, gender, status', // Primary key and indexed props
  settings: 'id'
});
