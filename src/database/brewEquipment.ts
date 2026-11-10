import type { SQLiteDatabase } from 'expo-sqlite';
import type { BrewEquipment } from '../models';
import { getDatabase } from './database';

interface BrewEquipmentRow {
  id: number;
  uuid: string | null;
  brew_id: number;
  brewer_id: number;
  created_at: string;
  updated_at: string | null;
}

function rowToBrewEquipment(row: BrewEquipmentRow): BrewEquipment {
  return {
    id: row.id,
    uuid: row.uuid,
    brewId: row.brew_id,
    brewerId: row.brewer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllBrewEquipment(db?: SQLiteDatabase): Promise<BrewEquipment[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BrewEquipmentRow>(
    'SELECT * FROM brew_equipment ORDER BY id ASC'
  );
  return rows.map(rowToBrewEquipment);
}

export async function getBrewEquipmentByBrew(
  brewId: number,
  db?: SQLiteDatabase
): Promise<BrewEquipment[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BrewEquipmentRow>(
    'SELECT * FROM brew_equipment WHERE brew_id = ? ORDER BY id ASC',
    [brewId]
  );
  return rows.map(rowToBrewEquipment);
}

/**
 * Replaces the other gear attached to a brew. Re-run-safe: the existing rows
 * are cleared first, so passing the same ids twice changes nothing. Callers
 * inside a transaction pass the shared handle.
 */
export async function setBrewEquipment(
  brewId: number,
  brewerIds: readonly number[],
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM brew_equipment WHERE brew_id = ?', [brewId]);
  const seen = new Set<number>();
  for (const brewerId of brewerIds) {
    if (seen.has(brewerId)) {
      continue;
    }
    seen.add(brewerId);
    await database.runAsync(
      'INSERT INTO brew_equipment (brew_id, brewer_id) VALUES (?, ?)',
      [brewId, brewerId]
    );
  }
}

export async function deleteBrewEquipmentByBrew(
  brewId: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM brew_equipment WHERE brew_id = ?', [brewId]);
}
