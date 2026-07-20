const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

/**
 * Creates the user routes.
 * @param {Object} userController
 * @returns {Object}
 */
function createUserRoutes(userController) {
  const router = express.Router();

  router.use(requireAuth);
  router.use(requireAdmin);

  router.get('/api/users', userController.getAllUsers);
  router.post('/api/users', userController.createUser);

  return router;
}

module.exports = { createUserRoutes };
