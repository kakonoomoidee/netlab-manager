const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

/**
 * Creates the Task routes.
 * @param {Object} taskController
 * @returns {Object}
 */
function createTaskRoutes(taskController) {
  const router = express.Router();

  router.use(requireAuth);

  // API route to execute a command on multiple servers
  router.post('/api/execute', requireAdmin, taskController.executeTask);

  return router;
}

module.exports = { createTaskRoutes };
