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
  router.post('/', serverController.createServer);
  router.post('/:id/update', serverController.updateServer);
  router.post('/:id/delete', serverController.deleteServer);

  return router;
}

module.exports = { createServerRoutes };
