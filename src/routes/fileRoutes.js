const express = require('express');
const multer = require('multer');
const os = require('os');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

/**
 * Creates the file routes for SFTP File Manager.
 * @param {Object} fileController
 * @returns {Object}
 */
function createFileRoutes(fileController) {
  const router = express.Router();
  const upload = multer({ dest: os.tmpdir() });

  router.use(requireAuth);

  router.get('/api/:serverId/files', fileController.listDirectory);
  router.post('/api/:serverId/files/upload', requireAdmin, upload.single('file'), fileController.uploadFile);
  router.get('/api/:serverId/files/download', fileController.downloadFile);
  router.delete('/api/:serverId/files', requireAdmin, fileController.deleteFile);

  return router;
}

module.exports = { createFileRoutes };
