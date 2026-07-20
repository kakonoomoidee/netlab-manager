const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * Creates the settings routes.
 * @param {Object} settingsController
 * @returns {Object}
 */
function createSettingsRoutes(settingsController) {
  const router = express.Router();

  router.use(requireAuth);

  router.post('/api/settings/password', settingsController.updatePassword);

  return router;
}

module.exports = { createSettingsRoutes };
