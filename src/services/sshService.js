const { Client } = require('ssh2');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Attempts to ping a server via SSH by executing a simple echo command.
 * @param {Object} serverData
 * @returns {Promise<boolean>} Resolves to true if the server responds to the ping, false otherwise.
 */
function pingServer(serverData) {
  return new Promise((resolve) => {
    const conn = new Client();
    
    const privateKeyPath = process.env.SSH_PRIVATE_KEY_PATH;
    let privateKey = '';
    
    if (privateKeyPath) {
      if (fs.existsSync(privateKeyPath)) {
        try {
          privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        } catch (e) {
          console.error('Failed to read private key at ' + privateKeyPath, e);
        }
      } else {
        console.error('SSH_PRIVATE_KEY_PATH is set but the file does not exist: ' + privateKeyPath);
      }
    } else {
      console.warn('SSH_PRIVATE_KEY_PATH environment variable is not defined.');
    }

    let resolved = false;

    conn.on('ready', () => {
      conn.exec('echo pong', (err, stream) => {
        if (err) {
          conn.end();
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
          return;
        }
        
        let output = '';
        
        stream.on('close', () => {
          conn.end();
          if (!resolved) {
            resolved = true;
            resolve(output.trim() === 'pong');
          }
        }).on('data', (data) => {
          output += data.toString();
        }).stderr.on('data', () => {
          // Ignore stderr for the ping check
        });
      });
    }).on('error', (err) => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }).on('end', () => {
        if (!resolved) {
            resolved = true;
            resolve(false);
        }
    }).on('close', () => {
        if (!resolved) {
            resolved = true;
            resolve(false);
        }
    }).on('timeout', () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });

    try {
      conn.connect({
        host: serverData.ip,
        port: serverData.ssh_port,
        username: serverData.username,
        privateKey: privateKey,
        readyTimeout: 5000 // 5 seconds timeout for health check
      });
    } catch (e) {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }
  });
}

/**
 * Executes a custom command on a remote server via SSH.
 * @param {Object} serverData
 * @param {string} command
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
function executeCommand(serverData, command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    const privateKeyPath = process.env.SSH_PRIVATE_KEY_PATH;
    let privateKey = '';
    
    if (privateKeyPath && fs.existsSync(privateKeyPath)) {
      try {
        privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      } catch (e) {
        // Ignored
      }
    }

    let resolved = false;

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          if (!resolved) {
            resolved = true;
            reject(err);
          }
          return;
        }
        
        let stdout = '';
        let stderr = '';
        
        stream.on('close', (code) => {
          conn.end();
          if (!resolved) {
            resolved = true;
            resolve({ stdout, stderr, code: code !== undefined ? code : 0 });
          }
        }).on('data', (data) => {
          stdout += data.toString();
        }).stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    }).on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    }).on('end', () => {
        if (!resolved) {
            resolved = true;
            reject(new Error('Connection ended unexpectedly'));
        }
    }).on('close', () => {
        if (!resolved) {
            resolved = true;
            reject(new Error('Connection closed unexpectedly'));
        }
    }).on('timeout', () => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Connection timed out'));
      }
    });

    try {
      conn.connect({
        host: serverData.ip,
        port: serverData.ssh_port,
        username: serverData.username,
        privateKey: privateKey,
        readyTimeout: 10000 // 10 seconds for commands
      });
    } catch (e) {
      if (!resolved) {
        resolved = true;
        reject(e);
      }
    }
  });
}

/**
 * Fetches real-time system stats (CPU, RAM, Disk, Temp) from a remote server.
 * @param {Object} serverData
 * @returns {Promise<Object>}
 */
async function getSystemStats(serverData) {
  const statCommand = `echo "$(top -bn1 | grep "Cpu(s)")|$(free -m | grep Mem)|$(df -h / | tail -1)|$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0)"`;
  try {
    const { stdout } = await executeCommand(serverData, statCommand);
    const parts = stdout.trim().split('|');
    
    const stats = { cpu: 'N/A', ram: 'N/A', disk: 'N/A', temp: 'N/A' };
    
    if (parts.length === 4) {
      const cpuMatch = parts[0].match(/(\d+\.\d+)\s+id/);
      if (cpuMatch && cpuMatch[1]) {
        const idle = parseFloat(cpuMatch[1]);
        stats.cpu = (100 - idle).toFixed(1) + '%';
      }

      const ramMatch = parts[1].match(/Mem:\s+(\d+)\s+(\d+)/);
      if (ramMatch && ramMatch[1] && ramMatch[2]) {
        const total = parseInt(ramMatch[1], 10);
        const used = parseInt(ramMatch[2], 10);
        stats.ram = `${used}MB / ${total}MB`;
      }

      const diskParts = parts[2].trim().split(/\s+/);
      if (diskParts.length >= 5) {
        stats.disk = `${diskParts[2]} / ${diskParts[1]} (${diskParts[4]})`;
      }

      const tempVal = parseInt(parts[3], 10);
      if (!isNaN(tempVal) && tempVal > 0) {
        stats.temp = (tempVal / 1000).toFixed(1) + '°C';
      }
    }
    return stats;
  } catch (err) {
    throw err;
  }
}

module.exports = { pingServer, executeCommand, getSystemStats };
