const { executeCommand } = require('../services/sshService');

/**
 * Creates the Docker controller.
 * @param {Object} db The SQLite database instance.
 * @returns {Object}
 */
function createDockerController(db) {
  /**
   * Fetches Docker containers for a specific server.
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<void>}
   */
  async function getContainers(req, res) {
    const serverId = req.params.id;

    db.get('SELECT * FROM servers WHERE id = ?', [serverId], async (err, server) => {
      if (err) {
        console.error('Database error fetching server:', err);
        return res.status(500).json({ error: 'Database error occurred while fetching server.' });
      }
      
      if (!server) {
        return res.status(404).json({ error: 'Server not found.' });
      }

      try {
        const command = `docker ps -a --format '{{json .}}'`;
        const { stdout } = await executeCommand(server, command);
        
        // docker ps --format '{{json .}}' outputs one JSON object per line.
        const containers = stdout
          .trim()
          .split('\n')
          .filter(line => line.length > 0)
          .map(line => {
            try {
              return JSON.parse(line);
            } catch (parseErr) {
              console.warn('Failed to parse container line:', line);
              return null;
            }
          })
          .filter(container => container !== null);

        res.status(200).json({ success: true, containers });
      } catch (sshErr) {
        console.error('Failed to execute docker command:', sshErr);
        let errorMsg = 'Failed to fetch Docker containers.';
        if (sshErr.message && sshErr.message.includes('docker: command not found')) {
            errorMsg = 'Docker is not installed on the target server.';
        } else if (sshErr.message && sshErr.message.includes('permission denied')) {
            errorMsg = 'Permission denied. Ensure the SSH user has Docker access.';
        }
        res.status(500).json({ error: errorMsg, details: sshErr.message });
      }
    });
  }

  /**
   * Helper to fetch a server and execute a Docker command.
   * @param {string|number} serverId 
   * @param {string} command 
   * @param {Object} res 
   */
  function runDockerAction(serverId, command, res) {
    db.get('SELECT * FROM servers WHERE id = ?', [serverId], async (err, server) => {
      if (err) {
        console.error('Database error fetching server:', err);
        return res.status(500).json({ error: 'Database error occurred while fetching server.' });
      }
      
      if (!server) {
        return res.status(404).json({ error: 'Server not found.' });
      }

      try {
        const { stdout, stderr } = await executeCommand(server, command);
        res.status(200).json({ success: true, stdout, stderr });
      } catch (sshErr) {
        console.error(`Failed to execute ${command}:`, sshErr);
        res.status(500).json({ error: 'Command failed', details: sshErr.message });
      }
    });
  }

  /**
   * Starts a Docker container.
   * @param {Object} req
   * @param {Object} res
   */
  function startContainer(req, res) {
    runDockerAction(req.params.serverId, `docker start ${req.params.containerId}`, res);
  }

  /**
   * Stops a Docker container.
   * @param {Object} req
   * @param {Object} res
   */
  function stopContainer(req, res) {
    runDockerAction(req.params.serverId, `docker stop ${req.params.containerId}`, res);
  }

  /**
   * Restarts a Docker container.
   * @param {Object} req
   * @param {Object} res
   */
  function restartContainer(req, res) {
    runDockerAction(req.params.serverId, `docker restart ${req.params.containerId}`, res);
  }

  /**
   * Force removes a Docker container.
   * @param {Object} req
   * @param {Object} res
   */
  function removeContainer(req, res) {
    runDockerAction(req.params.serverId, `docker rm -f ${req.params.containerId}`, res);
  }

  /**
   * Fetches the last 100 lines of logs for a Docker container.
   * @param {Object} req
   * @param {Object} res
   */
  function getContainerLogs(req, res) {
    runDockerAction(req.params.serverId, `docker logs --tail 100 ${req.params.containerId} 2>&1`, res);
  }

  return {
    getContainers,
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
    getContainerLogs
  };
}

module.exports = { createDockerController };
