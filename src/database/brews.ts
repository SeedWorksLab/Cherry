import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  AgitationKind,
  Brew,
  BrewMethodId,
  GrindUnit,
  BrewStep,
  StepKind,
} from '../models';
import { getDatabase } from './database';
import { deleteBrewEquipmentByBrew, setBrewEquipment } from './brewEquipment';

interface BrewRow {
  id: number;
  uuid: string | null;
  method_id: string;
  brewer_id: number | null;
  bean_id: number | null;
  plan_id: number | null;
  recommendation_id: number | null;
  voice_session_id: number | null;
  brew_date: string;
  started_at: string | null;
  ended_at: string | null;
  dose_g: number | null;
  water_total_g: number | null;
  water_temp_c: number | null;
  yield_g: number | null;
  grinder_id: number | null;
  grind_setting_id: number | null;
  grind_value: number | null;
  grind_unit: string | null;
  total_time_s: number | null;
  bean_name_snapshot: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

interface BrewStepRow {
  id: number;
  uuid: string | null;
  brew_id: number;
  step_index: number;
  kind: string | null;
  label: string | null;
  target_water_g: number | null;
  pour_water_g: number | null;
  pour_duration_s: number | null;
  wait_after_s: number | null;
  agitation_count: number | null;
  agitation_kind: string | null;
  temperature_c: number | null;
  note: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface BrewListFilter {
  methodId?: BrewMethodId | null;
  beanId?: number | null;
  minRating?: number | null;
  maxRating?: number | null;
  plannedOnly?: boolean;
  unplannedOnly?: boolean;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

function rowToBrew(row: BrewRow): Brew {
  return {
    id: row.id,
    uuid: row.uuid,
    methodId: row.method_id as BrewMethodId,
    brewerId: row.brewer_id,
    beanId: row.bean_id,
    planId: row.plan_id,
    recommendationId: row.recommendation_id,
    voiceSessionId: row.voice_session_id,
    brewDate: row.brew_date,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    doseG: row.dose_g,
    waterTotalG: row.water_total_g,
    waterTempC: row.water_temp_c,
    yieldG: row.yield_g,
    grinderId: row.grinder_id,
    grindSettingId: row.grind_setting_id,
    grindValue: row.grind_value,
    grindUnit: row.grind_unit as GrindUnit | null,
    totalTimeS: row.total_time_s,
    beanNameSnapshot: row.bean_name_snapshot,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

function rowToBrewStep(row: BrewStepRow): BrewStep {
  return {
    id: row.id,
    uuid: row.uuid,
    brewId: row.brew_id,
    stepIndex: row.step_index,
    kind: row.kind as StepKind | null,
    label: row.label,
    targetWaterG: row.target_water_g,
    pourWaterG: row.pour_water_g,
    pourDurationS: row.pour_duration_s,
    waitAfterS: row.wait_after_s,
    agitationCount: row.agitation_count,
    agitationKind: row.agitation_kind as AgitationKind | null,
    temperatureC: row.temperature_c,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface BrewStepInput {
  kind: StepKind | null;
  label: string | null;
  targetWaterG: number | null;
  pourWaterG: number | null;
  pourDurationS: number | null;
  waitAfterS: number | null;
  agitationCount: number | null;
  agitationKind: AgitationKind | null;
  temperatureC: number | null;
  note: string | null;
}

export interface BrewInput {
  methodId: BrewMethodId;
  brewerId: number | null;
  beanId: number | null;
  planId: number | null;
  recommendationId: number | null;
  voiceSessionId: number | null;
  brewDate: string;
  startedAt: string | null;
  endedAt: string | null;
  doseG: number | null;
  waterTotalG: number | null;
  waterTempC: number | null;
  yieldG: number | null;
  grinderId: number | null;
  grindSettingId: number | null;
  grindValue: number | null;
  grindUnit: GrindUnit | null;
  totalTimeS: number | null;
  beanNameSnapshot: string | null;
  notes: string | null;
  steps: BrewStepInput[];
  equipmentIds: number[];
}

const BREW_COLUMNS = `method_id, brewer_id, bean_id, plan_id, recommendation_id, voice_session_id,
  brew_date, started_at, ended_at, dose_g, water_total_g, water_temp_c, yield_g, grinder_id,
  grind_setting_id, grind_value, grind_unit, total_time_s, bean_name_snapshot, notes`;

function brewParams(input: BrewInput): (string | number | null)[] {
  return [
    input.methodId,
    input.brewerId,
    input.beanId,
    input.planId,
    input.recommendationId,
    input.voiceSessionId,
    input.brewDate,
    input.startedAt,
    input.endedAt,
    input.doseG,
    input.waterTotalG,
    input.waterTempC,
    input.yieldG,
    input.grinderId,
    input.grindSettingId,
    input.grindValue,
    input.grindUnit,
    input.totalTimeS,
    input.beanNameSnapshot,
    input.notes,
  ];
}

async function insertSteps(
  database: SQLiteDatabase,
  brewId: number,
  steps: BrewStepInput[]
): Promise<void> {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    await database.runAsync(
      `INSERT INTO brew_steps (
         brew_id, step_index, kind, label, target_water_g, pour_water_g, pour_duration_s,
         wait_after_s, agitation_count, agitation_kind, temperature_c, note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        brewId,
        index,
        step.kind,
        step.label,
        step.targetWaterG,
        step.pourWaterG,
        step.pourDurationS,
        step.waitAfterS,
        step.agitationCount,
        step.agitationKind,
        step.temperatureC,
        step.note,
      ]
    );
  }
}

export async function getAllBrews(db?: SQLiteDatabase): Promise<Brew[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BrewRow>(
    'SELECT * FROM brews WHERE deleted = 0 ORDER BY brew_date DESC, id DESC'
  );
  return rows.map(rowToBrew);
}

export async function getRecentBrews(limit: number, db?: SQLiteDatabase): Promise<Brew[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BrewRow>(
    'SELECT * FROM brews WHERE deleted = 0 ORDER BY brew_date DESC, id DESC LIMIT ?',
    [limit]
  );
  return rows.map(rowToBrew);
}

export async function getBrewsByMethod(
  methodId: BrewMethodId,
  db?: SQLiteDatabase
): Promise<Brew[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BrewRow>(
    'SELECT * FROM brews WHERE deleted = 0 AND method_id = ? ORDER BY brew_date DESC, id DESC',
    [methodId]
  );
  return rows.map(rowToBrew);
}

export async function getBrewsByBean(beanId: number, db?: SQLiteDatabase): Promise<Brew[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BrewRow>(
    'SELECT * FROM brews WHERE deleted = 0 AND bean_id = ? ORDER BY brew_date DESC, id DESC',
    [beanId]
  );
  return rows.map(rowToBrew);
}

export async function getBrewsByPlan(planId: number, db?: SQLiteDatabase): Promise<Brew[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BrewRow>(
    'SELECT * FROM brews WHERE deleted = 0 AND plan_id = ? ORDER BY brew_date DESC, id DESC',
    [planId]
  );
  return rows.map(rowToBrew);
}

export async function getBrewsByVoiceSession(
  sessionId: number,
  db?: SQLiteDatabase
): Promise<Brew[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BrewRow>(
    'SELECT * FROM brews WHERE deleted = 0 AND voice_session_id = ?',
    [sessionId]
  );
  return rows.map(rowToBrew);
}

export async function getBrew(id: number, db?: SQLiteDatabase): Promise<Brew | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<BrewRow>('SELECT * FROM brews WHERE id = ?', [id]);
  return row ? rowToBrew(row) : null;
}

export async function getBrewSteps(brewId: number, db?: SQLiteDatabase): Promise<BrewStep[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<BrewStepRow>(
    'SELECT * FROM brew_steps WHERE brew_id = ? ORDER BY step_index ASC',
    [brewId]
  );
  return rows.map(rowToBrewStep);
}

/**
 * The Log tab's filtered list. The rating filter runs against the latest
 * non-null tasting of a brew, which is what the user remembers (idea.txt §10.5).
 */
export async function getFilteredBrews(
  filter: BrewListFilter,
  db?: SQLiteDatabase
): Promise<Brew[]> {
  const database = db ?? (await getDatabase());
  const clauses = ['b.deleted = 0'];
  const params: (string | number)[] = [];

  if (filter.methodId != null) {
    clauses.push('b.method_id = ?');
    params.push(filter.methodId);
  }
  if (filter.beanId != null) {
    clauses.push('b.bean_id = ?');
    params.push(filter.beanId);
  }
  if (filter.plannedOnly === true) {
    clauses.push('b.plan_id IS NOT NULL');
  }
  if (filter.unplannedOnly === true) {
    clauses.push('b.plan_id IS NULL');
  }
  if (filter.dateFrom != null) {
    clauses.push('b.brew_date >= ?');
    params.push(filter.dateFrom);
  }
  if (filter.dateTo != null) {
    clauses.push('b.brew_date <= ?');
    params.push(filter.dateTo);
  }
  if (filter.search != null && filter.search.trim() !== '') {
    clauses.push(
      `(LOWER(COALESCE(b.bean_name_snapshot, '')) LIKE ?
        OR LOWER(COALESCE(b.notes, '')) LIKE ?
        OR EXISTS (
          SELECT 1 FROM tastings t
           WHERE t.brew_id = b.id AND t.deleted = 0
             AND LOWER(COALESCE(t.notes, '')) LIKE ?
        ))`
    );
    const needle = `%${filter.search.trim().toLowerCase()}%`;
    params.push(needle, needle, needle);
  }

  const ratingClause =
    filter.minRating != null || filter.maxRating != null
      ? `AND latest_rating ${filter.minRating != null ? '>= ?' : ''}${
          filter.minRating != null && filter.maxRating != null ? ' AND ' : ''
        }${filter.maxRating != null ? '<= ?' : ''}`
      : '';

  if (filter.minRating != null) {
    params.push(filter.minRating);
  }
  if (filter.maxRating != null) {
    params.push(filter.maxRating);
  }

  const rows = await database.getAllAsync<BrewRow>(
    `SELECT b.* FROM brews b
       LEFT JOIN (
         SELECT t.brew_id, t.overall_rating AS latest_rating
           FROM tastings t
          WHERE t.deleted = 0 AND t.overall_rating IS NOT NULL
            AND t.id = (
              SELECT t2.id
                FROM tastings t2
               WHERE t2.brew_id = t.brew_id AND t2.deleted = 0
                 AND t2.overall_rating IS NOT NULL
               ORDER BY COALESCE(t2.tasted_at, t2.created_at) DESC, t2.id DESC
               LIMIT 1
            )
       ) latest ON latest.brew_id = b.id
      WHERE ${clauses.join(' AND ')}
        ${ratingClause}
      ORDER BY b.brew_date DESC, b.id DESC`,
    params
  );
  return rows.map(rowToBrew);
}

export async function createBrew(input: BrewInput, db?: SQLiteDatabase): Promise<number> {
  const database = db ?? (await getDatabase());
  let id = 0;
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      `INSERT INTO brews (${BREW_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      brewParams(input)
    );
    id = result.lastInsertRowId;
    await insertSteps(database, id, input.steps);
    await setBrewEquipment(id, input.equipmentIds, database);
    if (input.planId !== null) {
      await database.runAsync(
        `UPDATE plans SET status = 'brewed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?`,
        [input.planId]
      );
      await database.runAsync(
        `INSERT INTO plan_events (plan_id, kind, field, previous_value, new_value, note)
         VALUES (?, 'brewed', NULL, NULL, ?, NULL)`,
        [input.planId, String(id)]
      );
    }
    if (input.recommendationId !== null) {
      await database.runAsync(
        `UPDATE recommendations SET status = 'brewed',
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?`,
        [input.recommendationId]
      );
    }
  });
  return id;
}

export async function updateBrew(id: number, input: BrewInput, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE brews SET method_id = ?, brewer_id = ?, bean_id = ?, plan_id = ?,
              recommendation_id = ?, voice_session_id = ?, brew_date = ?, started_at = ?,
              ended_at = ?, dose_g = ?, water_total_g = ?, water_temp_c = ?, yield_g = ?,
              grinder_id = ?, grind_setting_id = ?, grind_value = ?, grind_unit = ?,
              total_time_s = ?, bean_name_snapshot = ?, notes = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?`,
      [...brewParams(input), id]
    );
    await database.runAsync('DELETE FROM brew_steps WHERE brew_id = ?', [id]);
    await insertSteps(database, id, input.steps);
    await setBrewEquipment(id, input.equipmentIds, database);
  });
}

export async function setBrewVoiceSession(
  id: number,
  voiceSessionId: number | null,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE brews SET voice_session_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [voiceSessionId, id]
  );
}

export async function deleteBrew(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE brews SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?`,
      [id]
    );
    await database.runAsync('DELETE FROM brew_steps WHERE brew_id = ?', [id]);
    await deleteBrewEquipmentByBrew(id, database);
    await database.runAsync('DELETE FROM tastings WHERE brew_id = ?', [id]);
  });
}

/**
 * Brew count and the mean of the per-brew mean rating, so that re-tasting one
 * brew is not confused with a second data point (idea.txt §10.5).
 */
export interface BrewStats {
  brewCount: number;
  meanRating: number | null;
}

export async function getBrewStats(db?: SQLiteDatabase): Promise<BrewStats> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ brew_count: number; mean_rating: number | null }>(
    `SELECT COUNT(*) AS brew_count,
            (SELECT AVG(per_brew.mean)
               FROM (
                 SELECT AVG(t.overall_rating) AS mean
                   FROM tastings t
                   JOIN brews b ON b.id = t.brew_id
                  WHERE b.deleted = 0 AND t.deleted = 0
                    AND t.overall_rating IS NOT NULL
                  GROUP BY t.brew_id
               ) per_brew) AS mean_rating
       FROM brews
      WHERE deleted = 0`
  );
  return {
    brewCount: row?.brew_count ?? 0,
    meanRating: row?.mean_rating ?? null,
  };
}