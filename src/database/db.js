const sqlite3 = require("sqlite3").verbose();

/**
 * Initializes the SQLite database and creates necessary tables for Phase 1.
 * @param {string} dbPath - The absolute file path to the SQLite database.
 * @returns {sqlite3.Database} The initialized SQLite database instance.
 */
function initDatabase(dbPath) {
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT
            )
        `);

    db.run(`
            CREATE TABLE IF NOT EXISTS servers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hostname TEXT,
                ip TEXT,
                ssh_port INTEGER,
                username TEXT,
                role TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
  });

  return db;
}

module.exports = { initDatabase };
