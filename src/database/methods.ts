import type { SQLiteDatabase } from 'expo-sqlite';
import type { BrewMethodId, EquipmentKind, Method, MethodFamily } from '../models';
import { getDatabase } from './database';

interface MethodRow {
  id: string;
  uuid: string | null;
  name: string;
  family: string;
  brewer_kind: string | null;
  supports_pressure: number;
  supports_grinder: number;
  default_step_template: string | null;
  sort_order: number;
}

function rowToMethod(row: MethodRow): Method {
  return {
    id: row.id as BrewMethodId,
    name: row.name,
    family: row.family as MethodFamily,
    brewerKind: row.brewer_kind as EquipmentKind | null,
    supportsPressure: row.supports_pressure === 1,
    supportsGrinder: row.supports_grinder === 1,
    defaultStepTemplate: row.default_step_template,
    sortOrder: row.sort_order,
  };
}

export async function getAllMethods(db?: SQLiteDatabase): Promise<Method[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<MethodRow>(
    'SELECT * FROM methods ORDER BY sort_order ASC, name ASC'
  );
  return rows.map(rowToMethod);
}

export async function getMethod(
  id: BrewMethodId,
  db?: SQLiteDatabase
): Promise<Method | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<MethodRow>('SELECT * FROM methods WHERE id = ?', [id]);
  return row ? rowToMethod(row) : null;
}
