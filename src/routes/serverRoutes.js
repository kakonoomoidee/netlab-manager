const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * Creates the server routes.
 * @param {Object} serverController
 * @returns {Object}
 */
function createServerRoutes(serverController) {
  const router = express.Router();

  router.use(requireAuth);

  router.get('/', serverController.getAllServers);
  router.get('/data', serverController.getServersData);
  router.post('/', serverController.createServer);
  router.post('/:id/update', serverController.updateServer);
  router.post('/:id/delete', serverController.deleteServer);
  router.get('/:id/ping', serverController.pingServer);
  router.get('/:id/stats', serverController.getServerStats);
  router.get('/terminal/:id', serverController.getTerminalView);
  router.post('/:id/execute', serverController.executeServerCommand);

  return router;
}

module.exports = { createServerRoutes };
