const bcrypt = require('bcrypt');

/**
 * Creates the settings controller.
 * @param {Object} db
 * @returns {Object}
 */
function createSettingsController(db) {
  
  /**
   * Updates the password for the currently authenticated user.
   * @param {Object} req
   * @param {Object} res
   */
  async function updatePassword(req, res) {
    const { oldPassword, newPassword } = req.body;
    const username = req.session.username;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new passwords are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error fetching user' });
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!bcrypt.compareSync(oldPassword, user.password)) {
        return res.status(401).json({ error: 'Incorrect old password' });
      }

      const salt = bcrypt.genSaltSync(10);
      const hashedNewPassword = bcrypt.hashSync(newPassword, salt);

      db.run('UPDATE users SET password = ? WHERE username = ?', [hashedNewPassword, username], function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to update password' });
        }
        res.json({ success: true, message: 'Password updated successfully' });
      });
    });
  }

  return { updatePassword };
}

module.exports = { createSettingsController };
