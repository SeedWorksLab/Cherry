import type { SQLiteDatabase } from 'expo-sqlite';
import type { BrewMethodId, Equipment, EquipmentKind, ScaleMode } from '../models';
import { getDatabase } from './database';

interface EquipmentRow {
  id: number;
  uuid: string | null;
  name: string;
  kind: string;
  method_id: string | null;
  manufacturer: string | null;
  model: string | null;
  capacity_ml: number | null;
  material: string | null;
  notes: string | null;
  scale_precision_g: number | null;
  scale_capacity_g: number | null;
  scale_modes: string | null;
  grinder_clicks_per_revolution: number | null;
  grinder_micron_per_click: number | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

function parseScaleModes(raw: string | null): ScaleMode[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScaleMode[]) : null;
  } catch {
    return null;
  }
}

function serializeScaleModes(modes: ScaleMode[] | null): string | null {
  return modes === null ? null : JSON.stringify(modes);
}

function rowToEquipment(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    kind: row.kind as EquipmentKind,
    methodId: row.method_id as BrewMethodId | null,
    manufacturer: row.manufacturer,
    model: row.model,
    capacityMl: row.capacity_ml,
    material: row.material,
    notes: row.notes,
    scalePrecisionG: row.scale_precision_g,
    scaleCapacityG: row.scale_capacity_g,
    scaleModes: parseScaleModes(row.scale_modes),
    grinderClicksPerRevolution: row.grinder_clicks_per_revolution,
    grinderMicronPerClick: row.grinder_micron_per_click,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

export interface EquipmentInput {
  name: string;
  kind: EquipmentKind;
  methodId: BrewMethodId | null;
  manufacturer: string | null;
  model: string | null;
  capacityMl: number | null;
  material: string | null;
  notes: string | null;
  scalePrecisionG: number | null;
  scaleCapacityG: number | null;
  scaleModes: ScaleMode[] | null;
  grinderClicksPerRevolution: number | null;
  grinderMicronPerClick: number | null;
  isActive: boolean;
  sortOrder: number;
}

export async function getAllEquipment(db?: SQLiteDatabase): Promise<Equipment[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<EquipmentRow>(
    'SELECT * FROM equipment WHERE deleted = 0 ORDER BY kind ASC, sort_order ASC, name ASC'
  );
  return rows.map(rowToEquipment);
}

export async function getActiveEquipment(db?: SQLiteDatabase): Promise<Equipment[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<EquipmentRow>(
    'SELECT * FROM equipment WHERE deleted = 0 AND is_active = 1 ORDER BY kind ASC, sort_order ASC, name ASC'
  );
  return rows.map(rowToEquipment);
}

export async function getEquipmentByKind(
  kind: EquipmentKind,
  db?: SQLiteDatabase
): Promise<Equipment[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<EquipmentRow>(
    'SELECT * FROM equipment WHERE deleted = 0 AND kind = ? ORDER BY is_active DESC, sort_order ASC, name ASC',
    [kind]
  );
  return rows.map(rowToEquipment);
}

export async function getEquipment(id: number, db?: SQLiteDatabase): Promise<Equipment | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<EquipmentRow>('SELECT * FROM equipment WHERE id = ?', [
    id,
  ]);
  return row ? rowToEquipment(row) : null;
}

export async function createEquipment(
  input: EquipmentInput,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO equipment (name, kind, method_id, manufacturer, model, capacity_ml, material, notes,
                            scale_precision_g, scale_capacity_g, scale_modes,
                            grinder_clicks_per_revolution, grinder_micron_per_click,
                            is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.kind,
      input.methodId,
      input.manufacturer,
      input.model,
      input.capacityMl,
      input.material,
      input.notes,
      input.scalePrecisionG,
      input.scaleCapacityG,
      serializeScaleModes(input.scaleModes),
      input.grinderClicksPerRevolution,
      input.grinderMicronPerClick,
      input.isActive ? 1 : 0,
      input.sortOrder,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateEquipment(
  id: number,
  input: EquipmentInput,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE equipment SET name = ?, kind = ?, method_id = ?, manufacturer = ?, model = ?, capacity_ml = ?,
            material = ?, notes = ?,
            scale_precision_g = ?, scale_capacity_g = ?, scale_modes = ?,
            grinder_clicks_per_revolution = ?, grinder_micron_per_click = ?,
            is_active = ?, sort_order = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [
      input.name,
      input.kind,
      input.methodId,
      input.manufacturer,
      input.model,
      input.capacityMl,
      input.material,
      input.notes,
      input.scalePrecisionG,
      input.scaleCapacityG,
      serializeScaleModes(input.scaleModes),
      input.grinderClicksPerRevolution,
      input.grinderMicronPerClick,
      input.isActive ? 1 : 0,
      input.sortOrder,
      id,
    ]
  );
}

export async function setEquipmentActive(
  id: number,
  active: boolean,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE equipment SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [active ? 1 : 0, id]
  );
}

export async function deleteEquipment(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE equipment SET deleted = 1, is_active = 0,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [id]
  );
}
