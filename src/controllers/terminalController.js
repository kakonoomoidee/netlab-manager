const ssh2 = require('ssh2');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Creates the terminal controller with database dependency.
 * @param {Object} db
 * @returns {Object}
 */
function createTerminalController(db) {
  /**
   * Handles an incoming WebSocket connection for the terminal.
   * @param {Object} ws
   * @param {Object} request
   * @returns {void}
   */
  function handleTerminalConnection(ws, request) {
    const urlParts = request.url.split('/');
    const serverId = urlParts[urlParts.length - 1];

    if (!request.session || request.session.role !== 'admin') {
      ws.send('\r\n\x1b[31mError: Unauthorized access. Admin role required to access the terminal.\x1b[0m\r\n');
      return ws.close();
    }

    if (!serverId) {
      ws.send('\r\n\x1b[31mError: Server ID not provided.\x1b[0m\r\n');
      return ws.close();
    }

    db.get('SELECT * FROM servers WHERE id = ?', [serverId], (err, server) => {
      if (err) {
        ws.send('\r\n\x1b[31mError: Database query failed.\x1b[0m\r\n');
        return ws.close();
      }
      
      if (!server) {
        ws.send('\r\n\x1b[31mError: Server not found.\x1b[0m\r\n');
        return ws.close();
      }

      const privateKeyPath = process.env.SSH_PRIVATE_KEY_PATH;
      
      if (!privateKeyPath) {
        console.error('Terminal error: SSH_PRIVATE_KEY_PATH environment variable is not defined.');
        ws.send('\r\n\x1b[31mError: SSH_PRIVATE_KEY_PATH is not configured in the backend.\x1b[0m\r\n');
        return ws.close();
      }

      let privateKey;
      try {
        privateKey = fs.readFileSync(privateKeyPath);
      } catch (keyErr) {
        console.error(`Terminal error: Failed to read private key at ${privateKeyPath}`, keyErr);
        ws.send(`\r\n\x1b[31mError: Private key could not be read from ${privateKeyPath}\x1b[0m\r\n`);
        return ws.close();
      }

      const sshClient = new ssh2.Client();

      sshClient.on('ready', () => {
        ws.send('\r\n\x1b[32mSSH Connection established.\x1b[0m\r\n');
        
        // Request a pseudo-terminal and start a shell
        sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            ws.send('\r\n\x1b[31mError: Failed to request shell.\x1b[0m\r\n');
            sshClient.end();
            return ws.close();
          }

          // Pipe data from WebSocket to SSH stream
          ws.on('message', (data) => {
            stream.write(data);
          });

          // Pipe data from SSH stream to WebSocket
          stream.on('data', (data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(data.toString('utf-8'));
            }
          });

          stream.on('close', () => {
            if (ws.readyState === ws.OPEN) {
              ws.send('\r\n\x1b[33mSSH Session closed.\x1b[0m\r\n');
              ws.close();
            }
            sshClient.end();
          });

          ws.on('close', () => {
            sshClient.end();
          });
        });
      });

      sshClient.on('error', (err) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(`\r\n\x1b[31mSSH Error: ${err.message}\x1b[0m\r\n`);
          ws.close();
        }
      });

      sshClient.on('close', () => {
        if (ws.readyState === ws.OPEN) {
          ws.send('\r\n\x1b[33mSSH Connection closed.\x1b[0m\r\n');
          ws.close();
        }
      });

      try {
        sshClient.connect({
          host: server.ip,
          port: server.ssh_port || 22,
          username: server.username,
          privateKey: privateKey,
          readyTimeout: 10000
        });
      } catch (connErr) {
        ws.send(`\r\n\x1b[31mError connecting: ${connErr.message}\x1b[0m\r\n`);
        if (ws.readyState === ws.OPEN) {
            ws.close();
        }
      }
    });
  }

  return { handleTerminalConnection };
}

module.exports = { createTerminalController };
