/**
 * Middleware to protect routes from unauthenticated users.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {void}
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect("/login");
}

/**
 * Middleware to protect routes for admin users only.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {void}
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'admin') {
    return next();
  }
  
  if (req.xhr || req.path.startsWith('/api/') || req.headers.accept.indexOf('json') > -1) {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }
  
  return res.status(403).send('Forbidden: Admin access required.');
}

module.exports = { requireAuth, requireAdmin };
