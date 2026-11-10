import { SCHEMA_SQL, SEED_FLAVOUR_TAGS_SQL, SEED_METHODS_SQL } from './schema';
import { SEED_CANONICAL_RECIPES_SQL } from './canonicalRecipes';

export interface Migration {
  id: number;
  description: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    description: 'Initial schema',
    sql: `
${SCHEMA_SQL}

${SEED_METHODS_SQL}

${SEED_FLAVOUR_TAGS_SQL}
`,
  },
  {
    id: 2,
    description: 'Seed nine canonical method recipes',
    sql: SEED_CANONICAL_RECIPES_SQL,
  },
  {
    id: 3,
    description: 'Brewers declare the brew method they are for',
    sql: `
ALTER TABLE brewers ADD COLUMN method_id TEXT
  CHECK (method_id IS NULL OR method_id IN ('v60','chemex','kalita','french-press','aeropress','clever','cold-brew','espresso','moka'));

CREATE INDEX IF NOT EXISTS idx_brewers_method ON brewers (method_id, is_active);
`,
  },
  {
    id: 4,
    description: 'Record the other gear used for a brew',
    sql: `
CREATE TABLE IF NOT EXISTS brew_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  brew_id INTEGER NOT NULL,
  brewer_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  FOREIGN KEY (brew_id) REFERENCES brews (id) ON DELETE CASCADE,
  FOREIGN KEY (brewer_id) REFERENCES brewers (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brew_equipment_uuid ON brew_equipment (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brew_equipment_unique ON brew_equipment (brew_id, brewer_id);
CREATE INDEX IF NOT EXISTS idx_brew_equipment_brew ON brew_equipment (brew_id);
`,
  },
  {
    id: 5,
    description: 'Equipment is the catalogue of all gear; scales and grinders record their own specs',
    sql: `
ALTER TABLE brewers RENAME TO equipment;

DROP INDEX IF EXISTS idx_brewers_uuid;
DROP INDEX IF EXISTS idx_brewers_kind;
DROP INDEX IF EXISTS idx_brewers_method;

CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_uuid ON equipment (uuid);
CREATE INDEX IF NOT EXISTS idx_equipment_kind ON equipment (kind, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_equipment_method ON equipment (method_id, is_active);

ALTER TABLE equipment ADD COLUMN scale_precision_g REAL;
ALTER TABLE equipment ADD COLUMN scale_capacity_g REAL;
ALTER TABLE equipment ADD COLUMN scale_modes TEXT;
ALTER TABLE equipment ADD COLUMN grinder_clicks_per_revolution INTEGER;
ALTER TABLE equipment ADD COLUMN grinder_micron_per_click REAL;
`,
  },
];
