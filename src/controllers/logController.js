const fs = require('fs');
const path = require('path');

/**
 * Creates the log controller.
 * @returns {Object}
 */
function createLogController() {
  
  /**
   * Retrieves the last 500 lines of the application log file.
   * @param {Object} req
   * @param {Object} res
   */
  async function getLogs(req, res) {
    const logPath = path.join(__dirname, '../../app.log');
    
    if (!fs.existsSync(logPath)) {
      return res.json({ logs: 'No logs available.' });
    }

    try {
      const data = fs.readFileSync(logPath, 'utf8');
      // Very basic approach to tail a file
      // In a real high-traffic app, a ReadStream or reverse-reader should be used to avoid loading whole file in memory.
      const lines = data.split('\n');
      const tail = lines.slice(-500).join('\n');
      res.json({ logs: tail });
    } catch (err) {
      res.status(500).json({ error: 'Failed to read log file' });
    }
  }

  return { getLogs };
}

module.exports = { createLogController };
