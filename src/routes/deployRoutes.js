const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

/**
 * Creates the deployment routes.
 * @param {Object} deployController
 * @returns {Object}
 */
function createDeployRoutes(deployController) {
  const router = express.Router();

  router.use(requireAuth);

  router.post('/api/deploy/git', requireAdmin, deployController.deployGit);

  return router;
}

module.exports = { createDeployRoutes };
