require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const ms = require('ms');
const { initDatabase } = require('./database/db');
const { createAuthController } = require('./controllers/authController');
const { createAuthRoutes } = require('./routes/authRoutes');
const { createServerController } = require('./controllers/serverController');
const { createServerRoutes } = require('./routes/serverRoutes');
const { createTerminalController } = require('./controllers/terminalController');
const { requireAuth } = require('./middleware/authMiddleware');
const WebSocket = require('ws');

/**
 * Starts the NetLab Manager Express application server.
 * @returns {void}
 */
function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;
  
  const dbPath = process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : path.join(__dirname, 'database', 'netlab.sqlite');

  const db = initDatabase(dbPath);
  const authController = createAuthController(db);
  const authRoutes = createAuthRoutes(authController);
  const serverController = createServerController(db);
  const serverRoutes = createServerRoutes(serverController);
  const terminalController = createTerminalController(db);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layout');

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ['\'self\''],
          scriptSrc: [
            '\'self\'',
            '\'unsafe-inline\'',
            'https://cdn.tailwindcss.com',
            'https://cdn.jsdelivr.net'
          ],
          styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://cdn.jsdelivr.net'],
          connectSrc: ['\'self\'', 'ws:', 'wss:', 'https://cdn.jsdelivr.net']
        }
      }
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'fallback-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: ms('1h')
      }
    })
  );

  app.use('/', authRoutes);
  app.use('/servers', serverRoutes);

  app.get('/', requireAuth, (req, res) => {
    res.render('dashboard', {
      title: 'Dashboard - NetLab Manager',
      user: req.session.username,
      currentRoute: 'dashboard'
    });
  });

  const server = app.listen(port, () => {
    console.log('Server is running on port ' + port);
  });
  
  const wsServer = new WebSocket.Server({ noServer: true });
  
  server.on('upgrade', (request, socket, head) => {
    if (request.url.startsWith('/terminal-ws/')) {
      wsServer.handleUpgrade(request, socket, head, (ws) => {
        wsServer.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });
  
  wsServer.on('connection', terminalController.handleTerminalConnection);
}

startServer();
