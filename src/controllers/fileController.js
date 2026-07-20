const SftpClient = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');

/**
 * Creates the file controller for SFTP operations.
 * @param {Object} db
 * @returns {Object}
 */
function createFileController(db) {
  
  /**
   * Helper function to establish an SFTP connection.
   * @param {string} serverId
   * @returns {Promise<Object>}
   */
  async function getSftpClient(serverId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM servers WHERE id = ?', [serverId], async (err, server) => {
        if (err) return reject(new Error('Database error fetching server'));
        if (!server) return reject(new Error('Server not found'));

        const privateKeyPath = process.env.SSH_PRIVATE_KEY_PATH;
        let privateKey = '';
        
        if (privateKeyPath && fs.existsSync(privateKeyPath)) {
          privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        } else {
          return reject(new Error('SSH private key not found'));
        }

        const sftp = new SftpClient();
        try {
          await sftp.connect({
            host: server.ip,
            port: server.ssh_port || 22,
            username: server.username || 'root',
            privateKey: privateKey,
            readyTimeout: 10000
          });
          resolve(sftp);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Lists the contents of a remote directory.
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<void>}
   */
  async function listDirectory(req, res) {
    const serverId = req.params.serverId;
    const dirPath = req.query.path || '.';
    let sftp;

    try {
      sftp = await getSftpClient(serverId);
      let list = await sftp.list(dirPath);
      
      // Sort: folders first, then files, alphabetically
      list = list.sort((a, b) => {
        if (a.type === 'd' && b.type !== 'd') return -1;
        if (a.type !== 'd' && b.type === 'd') return 1;
        return a.name.localeCompare(b.name);
      });

      res.status(200).json({ success: true, path: dirPath, files: list });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to list directory' });
    } finally {
      if (sftp) sftp.end();
    }
  }

  /**
   * Uploads a file to a remote directory via SFTP.
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<void>}
   */
  async function uploadFile(req, res) {
    const serverId = req.params.serverId;
    const remotePath = req.query.path || '.';
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let sftp;
    try {
      sftp = await getSftpClient(serverId);
      const remoteFilePath = path.posix.join(remotePath, file.originalname);
      await sftp.put(file.path, remoteFilePath);
      
      // Clean up local temp file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      res.status(200).json({ success: true, message: 'File uploaded successfully' });
    } catch (err) {
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      res.status(500).json({ error: err.message || 'Failed to upload file' });
    } finally {
      if (sftp) sftp.end();
    }
  }

  /**
   * Streams a file from the remote server for download.
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<void>}
   */
  async function downloadFile(req, res) {
    const serverId = req.params.serverId;
    const remoteFilePath = req.query.path;
    
    if (!remoteFilePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    let sftp;
    try {
      sftp = await getSftpClient(serverId);
      const fileName = path.posix.basename(remoteFilePath);
      
      res.setHeader('Content-disposition', 'attachment; filename=' + fileName);
      res.setHeader('Content-type', 'application/octet-stream');
      
      // Pipe SFTP stream directly to Express response
      await sftp.get(remoteFilePath, res);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Failed to download file' });
      }
    } finally {
      if (sftp) sftp.end();
    }
  }

  /**
   * Deletes a remote file or directory.
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<void>}
   */
  async function deleteFile(req, res) {
    const serverId = req.params.serverId;
    const remoteFilePath = req.query.path;
    
    if (!remoteFilePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    let sftp;
    try {
      sftp = await getSftpClient(serverId);
      const type = req.query.type;
      
      if (type === 'd') {
        await sftp.rmdir(remoteFilePath, true);
      } else {
        await sftp.delete(remoteFilePath);
      }
      
      res.status(200).json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to delete file/directory' });
    } finally {
      if (sftp) sftp.end();
    }
  }

  return {
    listDirectory,
    uploadFile,
    downloadFile,
    deleteFile
  };
}

module.exports = { createFileController };
