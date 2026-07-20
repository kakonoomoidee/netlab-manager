const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

/**
 * Initializes the SQLite database and creates necessary tables for Phase 1.
 * @param {string} dbPath
 * @returns {Object}
 */
function initDatabase(dbPath) {
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(
      'CREATE TABLE IF NOT EXISTS users (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        'username TEXT UNIQUE, ' +
        'password TEXT, ' +
        'role TEXT)'
    );

    db.run(
      'CREATE TABLE IF NOT EXISTS servers (' +
        'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        'hostname TEXT, ' +
        'ip TEXT, ' +
        'ssh_port INTEGER, ' +
        'username TEXT, ' +
        'role TEXT, ' +
        'created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
    );

    const salt = bcrypt.genSaltSync(10);
    const adminPassword = process.env.ADMIN_PASSWORD || '12345678';
    const hashedPassword = bcrypt.hashSync(adminPassword, salt);

    db.run(
      'INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)',
      ['admin', hashedPassword, 'admin']
    );
  });

  return db;
}

module.exports = { initDatabase };
