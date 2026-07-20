const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

/**
 * Creates the Docker routes.
 * @param {Object} dockerController
 * @returns {Object}
 */
function createDockerRoutes(dockerController) {
  const router = express.Router();

  router.use(requireAuth);

  // API route to get containers for a specific server
  router.get('/api/:id/containers', dockerController.getContainers);

  // API routes for container actions
  router.post('/api/:serverId/containers/:containerId/start', requireAdmin, dockerController.startContainer);
  router.post('/api/:serverId/containers/:containerId/stop', requireAdmin, dockerController.stopContainer);
  router.post('/api/:serverId/containers/:containerId/restart', requireAdmin, dockerController.restartContainer);
  router.delete('/api/:serverId/containers/:containerId', requireAdmin, dockerController.removeContainer);
  router.get('/api/:serverId/containers/:containerId/logs', dockerController.getContainerLogs);

  return router;
}

module.exports = { createDockerRoutes };
