const express = require("express");

/**
 * Creates the authentication routes.
 * @param {Object} authController
 * @returns {Object}
 */
function createAuthRoutes(authController) {
  const router = express.Router();

  router.get("/login", authController.renderLogin);
  router.post("/login", authController.handleLogin);
  router.get("/logout", authController.handleLogout);

  return router;
}

module.exports = { createAuthRoutes };
