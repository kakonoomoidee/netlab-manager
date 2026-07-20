const bcrypt = require('bcrypt');

/**
 * Creates the user controller.
 * @param {Object} db
 * @returns {Object}
 */
function createUserController(db) {
  
  /**
   * Retrieves all users from the database, excluding passwords.
   * @param {Object} req
   * @param {Object} res
   */
  async function getAllUsers(req, res) {
    db.all('SELECT id, username, role FROM users', (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error fetching users' });
      }
      res.json(rows);
    });
  }

  /**
   * Creates a new user in the database.
   * @param {Object} req
   * @param {Object} res
   */
  async function createUser(req, res) {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role are required' });
    }

    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    db.run(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: 'Database error creating user' });
        }
        res.status(201).json({ success: true, user: { id: this.lastID, username, role } });
      }
    );
  }

  return {
    getAllUsers,
    createUser
  };
}

module.exports = { createUserController };
