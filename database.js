const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'home_portal.db');
let db, SQL;

function wrapDb(rawDb) {
  function saveToFile() { fs.writeFileSync(DB_PATH, Buffer.from(rawDb.export())); }
  let dirty = false, saveTimer = null;
  function markDirty() {
    dirty = true;
    if (!saveTimer) { saveTimer = setTimeout(() => { if (dirty) { saveToFile(); dirty = false; } saveTimer = null; }, 3000); }
  }
  return {
    exec(sql) { rawDb.run(sql); markDirty(); },
    prepare(sql) {
      return {
        run(...p) { rawDb.run(sql, p); markDirty(); const id = rawDb.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0]; return { lastInsertRowid: id, changes: rawDb.getRowsModified() }; },
        get(...p) { const s = rawDb.prepare(sql); s.bind(p); if (s.step()) { const c = s.getColumnNames(), v = s.get(); s.free(); const r = {}; c.forEach((k,i) => r[k] = v[i]); return r; } s.free(); return undefined; },
        all(...p) { const rows = [], s = rawDb.prepare(sql); s.bind(p); while (s.step()) { const c = s.getColumnNames(), v = s.get(), r = {}; c.forEach((k,i) => r[k] = v[i]); rows.push(r); } s.free(); return rows; }
      };
    },
    save() { saveToFile(); },
    close() { saveToFile(); rawDb.close(); }
  };
}

async function initDatabase() {
  SQL = await initSqlJs();
  let rawDb = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  db = wrapDb(rawDb);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      url TEXT NOT NULL,
      icon TEXT DEFAULT '📦',
      color TEXT DEFAULT '#7986cb',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );
  `);
  // Seed default apps if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM apps').get().c;
  if (count === 0) {
    const apps = [
      { name: 'Trading Journal', desc: 'Track daily P/L, CSV import, analytics', url: 'http://localhost:5000', icon: '📊', color: '#e94560', sort: 1 },
      { name: 'RSS Reader', desc: 'News & podcast feeds, full-text reading', url: 'http://localhost:3001', icon: '📰', color: '#f59e0b', sort: 2 },
      { name: 'Stock Scanner', desc: 'Daily scalp picks, volume & volatility', url: 'http://localhost:3002', icon: '🔍', color: '#10b981', sort: 3 },
      { name: 'Pi-hole', desc: 'Network-wide ad blocking', url: 'http://localhost:8080/admin', icon: '🛡️', color: '#96060a', sort: 4 },
    ];
    apps.forEach(a => {
      db.prepare('INSERT INTO apps (name, description, url, icon, color, sort_order) VALUES (?,?,?,?,?,?)').run(a.name, a.desc, a.url, a.icon, a.color, a.sort);
    });
  }
  db.save();
  return db;
}

function getDb() { if (!db) throw new Error('DB not initialized'); return db; }
module.exports = { getDb, initDatabase };
