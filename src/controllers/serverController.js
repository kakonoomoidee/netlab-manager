const { formatDistanceToNow } = require('date-fns');
const { pingServer: sshPingServer, executeCommand: sshExecuteCommand, getSystemStats: sshGetSystemStats } = require('../services/sshService');

/**
 * Validates server data payload.
 * @param {Object} data
 * @returns {string|null} Error message if invalid, null if valid.
 */
function validateServerData(data) {
  if (!data.hostname || typeof data.hostname !== 'string' || data.hostname.trim() === '') {
    return 'Hostname is required.';
  }

  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!data.ip || !ipRegex.test(data.ip)) {
    return 'Valid IPv4 address is required.';
  }

  const port = parseInt(data.ssh_port, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    return 'Valid SSH port (1-65535) is required.';
  }

  if (!data.username || typeof data.username !== 'string' || data.username.trim() === '') {
    return 'Username is required.';
  }

  return null;
}

/**
 * Creates the server controller with database dependency for full CRUD.
 * @param {Object} db
 * @returns {Object}
 */
function createServerController(db) {
  /**
   * Retrieves all servers and renders the servers page.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function getAllServers(req, res) {
    db.all('SELECT * FROM servers', [], (err, rows) => {
      if (err) {
        return res.render('servers', {
          title: 'Servers - NetLab Manager',
          user: req.session.username,
          currentRoute: 'servers',
          servers: [],
          error: 'Failed to retrieve servers from database.'
        });
      }

      const formattedServers = rows.map((server) => {
        let formattedDate = 'Unknown';
        if (server.created_at) {
          try {
            formattedDate = formatDistanceToNow(new Date(server.created_at + 'Z'), { addSuffix: true });
          } catch (e) {
            console.error('Date parsing error:', e);
          }
        }
        return {
          ...server,
          formattedDate
        };
      });

      res.render('servers', {
        title: 'Servers - NetLab Manager',
        user: req.session.username,
        currentRoute: 'servers',
        servers: formattedServers,
        error: null
      });
    });
  }

  /**
   * Retrieves all servers as JSON data.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function getServersData(req, res) {
    db.all('SELECT * FROM servers', [], (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error occurred while fetching servers.' });
      }
      
      const formattedServers = rows.map(server => {
        let formattedDate = 'Unknown';
        if (server.created_at) {
          try {
            const dateStr = server.created_at.replace(' ', 'T') + 'Z';
            const dateObj = new Date(dateStr);
            formattedDate = formatDistanceToNow(dateObj, { addSuffix: true });
          } catch (e) {
            console.error('Date parsing error:', e);
          }
        }
        return {
          ...server,
          formattedDate
        };
      });

      res.status(200).json({ success: true, servers: formattedServers });
    });
  }

  /**
   * Creates a new server record via AJAX.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function createServer(req, res) {
    const errorMsg = validateServerData(req.body);
    if (errorMsg) {
      return res.status(400).json({ error: errorMsg });
    }

    const hostname = req.body.hostname;
    const ip = req.body.ip;
    const sshPort = parseInt(req.body.ssh_port, 10);
    const username = req.body.username;
    const role = req.body.role || 'node';

    db.run(
      'INSERT INTO servers (hostname, ip, ssh_port, username, role) VALUES (?, ?, ?, ?, ?)',
      [hostname, ip, sshPort, username, role],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Database error occurred while adding server.' });
        }

        const now = new Date().toISOString().replace('T', ' ').split('.')[0];
        
        const newServer = {
          id: this.lastID,
          hostname,
          ip,
          ssh_port: sshPort,
          username,
          role,
          created_at: now
        };

        res.status(201).json({ success: true, server: newServer });
      }
    );
  }

  /**
   * Updates an existing server record via AJAX.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function updateServer(req, res) {
    const id = req.params.id;
    const errorMsg = validateServerData(req.body);
    if (errorMsg) {
      return res.status(400).json({ error: errorMsg });
    }

    const hostname = req.body.hostname;
    const ip = req.body.ip;
    const sshPort = parseInt(req.body.ssh_port, 10);
    const username = req.body.username;
    const role = req.body.role;

    db.run(
      'UPDATE servers SET hostname = ?, ip = ?, ssh_port = ?, username = ?, role = ? WHERE id = ?',
      [hostname, ip, sshPort, username, role, id],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Database error occurred while updating server.' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Server not found.' });
        }

        res.status(200).json({ 
          success: true, 
          server: {
            id: parseInt(id, 10),
            hostname,
            ip,
            ssh_port: sshPort,
            username,
            role
          }
        });
      }
    );
  }

  /**
   * Deletes a server record via AJAX.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function deleteServer(req, res) {
    const id = req.params.id;

    db.run('DELETE FROM servers WHERE id = ?', [id], function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error occurred while deleting server.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Server not found.' });
      }

      res.status(200).json({ success: true, message: 'Server deleted successfully.' });
    });
  }

  /**
   * Pings a server via SSH to check its health.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function pingServer(req, res) {
    const id = req.params.id;

    db.get('SELECT * FROM servers WHERE id = ?', [id], async (err, server) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error occurred while fetching server.' });
      }

      if (!server) {
        return res.status(404).json({ error: 'Server not found.' });
      }

      try {
        const isOnline = await sshPingServer(server);
        res.status(200).json({ status: isOnline ? 'Online' : 'Offline' });
      } catch (e) {
        console.error('Ping error:', e);
        res.status(200).json({ status: 'Offline' });
      }
    });
  }

  /**
   * Fetches real-time stats for a server.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function getServerStats(req, res) {
    const id = req.params.id;

    db.get('SELECT * FROM servers WHERE id = ?', [id], async (err, server) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error occurred while fetching server.' });
      }

      if (!server) {
        return res.status(404).json({ error: 'Server not found.' });
      }

      try {
        const stats = await sshGetSystemStats(server);
        res.status(200).json({ success: true, stats });
      } catch (e) {
        console.error('Stats error:', e);
        res.status(500).json({ error: 'Failed to fetch server stats.' });
      }
    });
  }

  /**
   * Executes a command on a remote server.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function executeServerCommand(req, res) {
    const id = req.params.id;
    const { command } = req.body;

    if (!command || typeof command !== 'string' || command.trim() === '') {
      return res.status(400).json({ error: 'Command is required.' });
    }

    db.get('SELECT * FROM servers WHERE id = ?', [id], async (err, server) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error occurred while fetching server.' });
      }

      if (!server) {
        return res.status(404).json({ error: 'Server not found.' });
      }

      try {
        const result = await sshExecuteCommand(server, command);
        res.status(200).json({ success: true, ...result });
      } catch (e) {
        console.error('Execution error:', e);
        res.status(500).json({ error: e.message || 'Failed to execute command.' });
      }
    });
  }

  /**
   * Renders the web terminal view for a specific server.
   * @param {Object} req
   * @param {Object} res
   * @returns {void}
   */
  function getTerminalView(req, res) {
    const id = req.params.id;
    
    db.get('SELECT * FROM servers WHERE id = ?', [id], (err, server) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      if (!server) {
        return res.status(404).send('Server not found');
      }
      
      res.render('terminal', {
        title: 'Terminal - ' + server.hostname,
        server,
        user: req.user,
        layout: false
      });
    });
  }

  return {
    getAllServers,
    getServersData,
    createServer,
    updateServer,
    deleteServer,
    pingServer,
    getServerStats,
    executeServerCommand,
    getTerminalView
  };
}

module.exports = { createServerController };
