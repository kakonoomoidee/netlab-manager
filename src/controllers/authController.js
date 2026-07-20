const bcrypt = require('bcrypt');

/**
 * Creates the authentication controller with database dependency.
 * @param {Object} db
 * @returns {Object}
 */
function createAuthController(db) {
  /**
   * Renders the login page.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function renderLogin(req, res) {
    res.render('login', { error: null, layout: false });
  }

  /**
   * Handles login submission.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function handleLogin(req, res) {
    const username = req.body.username;
    const password = req.body.password;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
      if (err) {
        return res.render('login', { error: 'Database error occurred', layout: false });
      }

      if (!user) {
        return res.render('login', { error: 'Invalid username or password', layout: false });
      }

      bcrypt.compare(password, user.password, (compareErr, isMatch) => {
        if (compareErr) {
          return res.render('login', { error: 'Authentication error', layout: false });
        }

        if (!isMatch) {
          return res.render('login', { error: 'Invalid username or password', layout: false });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        return res.redirect('/');
      });
    });
  }

  /**
   * Handles user logout.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function handleLogout(req, res) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }

  return {
    renderLogin,
    handleLogin,
    handleLogout
  };
}

module.exports = { createAuthController };
