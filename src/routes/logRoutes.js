const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

/**
 * Creates the log routes.
 * @param {Object} logController
 * @returns {Object}
 */
function createLogRoutes(logController) {
  const router = express.Router();

  router.use(requireAuth);
  router.use(requireAdmin);

  router.get('/api/logs', logController.getLogs);

  return router;
}

module.exports = { createLogRoutes };
