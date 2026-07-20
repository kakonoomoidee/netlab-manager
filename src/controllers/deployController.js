const { executeCommand } = require('../services/sshService');

/**
 * Creates the deployment controller.
 * @param {Object} db
 * @returns {Object}
 */
function createDeployController(db) {
  
  /**
   * Executes a Git clone or pull operation on the remote server.
   * @param {Object} req
   * @param {Object} res
   */
  async function deployGit(req, res) {
    const { serverId, repoUrl, targetDirectory, branch } = req.body;

    if (!serverId || !repoUrl || !targetDirectory) {
      return res.status(400).json({ error: 'Missing required parameters: serverId, repoUrl, targetDirectory' });
    }

    const deployBranch = branch || 'main';

    db.get('SELECT * FROM servers WHERE id = ?', [serverId], async (err, server) => {
      if (err) {
        return res.status(500).json({ error: 'Database error retrieving server' });
      }
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }

      const script = `
        if [ -d "${targetDirectory}/.git" ]; then
          echo "Directory exists and is a git repository. Pulling latest changes from ${deployBranch}..."
          cd "${targetDirectory}" && git pull origin ${deployBranch}
        else
          echo "Cloning repository ${repoUrl} branch ${deployBranch} into ${targetDirectory}..."
          git clone -b ${deployBranch} ${repoUrl} "${targetDirectory}"
        fi
      `;

      try {
        const result = await executeCommand(server, script);
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ error: error.message || 'Deployment execution failed' });
      }
    });
  }

  return {
    deployGit
  };
}

module.exports = { createDeployController };
