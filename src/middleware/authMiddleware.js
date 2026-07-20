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

module.exports = { requireAuth };
