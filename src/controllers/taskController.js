const { executeCommand } = require('../services/sshService');

/**
 * Creates the Task controller.
 * @param {Object} db The SQLite database instance.
 * @returns {Object}
 */
function createTaskController(db) {
  /**
   * Executes a shell command on multiple servers concurrently.
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<void>}
   */
  async function executeTask(req, res) {
    const { command, serverIds } = req.body;

    if (!command || typeof command !== 'string' || command.trim() === '') {
      return res.status(400).json({ error: 'A valid command string is required.' });
    }

    if (!serverIds || !Array.isArray(serverIds) || serverIds.length === 0) {
      return res.status(400).json({ error: 'An array of serverIds is required.' });
    }

    const placeholders = serverIds.map(() => '?').join(',');
    
    db.all(`SELECT * FROM servers WHERE id IN (${placeholders})`, serverIds, async (err, servers) => {
      if (err) {
        console.error('Database error fetching servers for task execution:', err);
        return res.status(500).json({ error: 'Database error occurred while fetching target servers.' });
      }

      if (!servers || servers.length === 0) {
        return res.status(404).json({ error: 'No matching servers found in the database.' });
      }

      const promises = servers.map(server => {
        return executeCommand(server, command)
          .then(({ stdout, stderr }) => {
            return {
              serverId: server.id,
              hostname: server.hostname,
              ip: server.ip,
              status: 'success',
              stdout: stdout || '',
              stderr: stderr || ''
            };
          })
          .catch(err => {
            return {
              serverId: server.id,
              hostname: server.hostname,
              ip: server.ip,
              status: 'error',
              error: err.message || 'Command execution failed or connection timed out.'
            };
          });
      });

      const settledResults = await Promise.allSettled(promises);
      const results = settledResults.map(result => result.value);

      res.status(200).json({ success: true, results });
    });
  }

  return {
    executeTask
  };
}

module.exports = { createTaskController };
