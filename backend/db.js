/**
 * SQLite via sql.js (WebAssembly) — sem compilação nativa.
 * Expõe API compatível com better-sqlite3 (prepare/get/all/run).
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'qatry.db');

let _db = null; // sql.js Database instance

// ── Persist to disk after each write ──────────────────────────────────────
function _save() {
  if (!_db) return;
  fs.writeFileSync(DB_FILE, Buffer.from(_db.export()));
}

// ── Compatibility wrapper: Statement ──────────────────────────────────────
class Statement {
  constructor(sql) { this._sql = sql; }

  _flat(params) {
    return Array.isArray(params[0]) ? params[0] : params;
  }

  get(...params) {
    const p = this._flat(params);
    const result = _db.exec(this._sql, p.length ? p : undefined);
    if (!result.length || !result[0].values.length) return undefined;
    const { columns, values } = result[0];
    const row = {};
    columns.forEach((c, i) => { row[c] = values[0][i]; });
    return row;
  }

  all(...params) {
    const p = this._flat(params);
    const result = _db.exec(this._sql, p.length ? p : undefined);
    if (!result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((c, i) => { obj[c] = row[i]; });
      return obj;
    });
  }

  run(...params) {
    const p = this._flat(params);
    _db.run(this._sql, p.length ? p : undefined);
    const changes = _db.getRowsModified();
    _save();
    return { changes, lastInsertRowid: null };
  }
}

// ── Compatibility wrapper: Database ──────────────────────────────────────
const dbProxy = {
  prepare: (sql) => new Statement(sql),
  exec: (sql) => { _db.run(sql); _save(); return dbProxy; },
  pragma: () => dbProxy, // no-op; WAL not needed for local use
};

// ── Schema ────────────────────────────────────────────────────────────────
const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
  base_url TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
  type TEXT DEFAULT 'development', base_url TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS test_users (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT DEFAULT '',
  username TEXT NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'user',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
  description TEXT DEFAULT '', script TEXT DEFAULT '', order_index INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, flow_id TEXT, environment_id TEXT,
  flow_name TEXT DEFAULT 'Auditoria IA', project_name TEXT DEFAULT '',
  status TEXT DEFAULT 'pending', trigger_type TEXT DEFAULT 'manual',
  base_url TEXT DEFAULT '', started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT, duration_ms INTEGER, total_steps INTEGER DEFAULT 0,
  passed_steps INTEGER DEFAULT 0, failed_steps INTEGER DEFAULT 0,
  score INTEGER, findings TEXT DEFAULT '[]', suggestions TEXT DEFAULT '[]',
  video_path TEXT, report_path TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS execution_steps (
  id TEXT PRIMARY KEY, execution_id TEXT NOT NULL, name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', screenshot_path TEXT, error_message TEXT,
  duration_ms INTEGER, order_index INTEGER DEFAULT 0,
  FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, flow_id TEXT NOT NULL,
  environment_id TEXT, cron_expression TEXT NOT NULL, enabled INTEGER DEFAULT 1,
  last_run TEXT, next_run TEXT, created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT DEFAULT 'QA Engineer',
  created_at TEXT DEFAULT (datetime('now'))
);
`;

// ── Async initializer (call once at startup) ──────────────────────────────
async function initDb() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  const buffer = fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE) : null;
  _db = buffer ? new SQL.Database(buffer) : new SQL.Database();

  // Apply schema (idempotent)
  SCHEMA.trim().split(';').filter(s => s.trim()).forEach(stmt => {
    try { _db.run(stmt + ';'); } catch (_) {}
  });

  _save();
  console.log('[db] SQLite (sql.js) ready:', DB_FILE);
  return dbProxy;
}

module.exports = { initDb, db: dbProxy };
