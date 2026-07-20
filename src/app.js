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
const { createDockerController } = require('./controllers/dockerController');
const { createDockerRoutes } = require('./routes/dockerRoutes');
const { createTaskController } = require('./controllers/taskController');
const { createTaskRoutes } = require('./routes/taskRoutes');
const { createFileController } = require('./controllers/fileController');
const { createFileRoutes } = require('./routes/fileRoutes');
const { createDeployController } = require('./controllers/deployController');
const { createDeployRoutes } = require('./routes/deployRoutes');
const { createUserController } = require('./controllers/userController');
const { createUserRoutes } = require('./routes/userRoutes');
const { createTerminalController } = require('./controllers/terminalController');
const { requireAuth, requireAdmin } = require('./middleware/authMiddleware');
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
  const dockerController = createDockerController(db);
  const dockerRoutes = createDockerRoutes(dockerController);
  const taskController = createTaskController(db);
  const taskRoutes = createTaskRoutes(taskController);
  const fileController = createFileController(db);
  const fileRoutes = createFileRoutes(fileController);
  const deployController = createDeployController(db);
  const deployRoutes = createDeployRoutes(deployController);
  const userController = createUserController(db);
  const userRoutes = createUserRoutes(userController);
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

  const sessionParser = session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: ms('1h')
    }
  });

  app.use(sessionParser);

  app.use('/', authRoutes);
  app.use('/servers', serverRoutes);
  app.use('/docker', dockerRoutes);
  app.use('/tasks', taskRoutes);
  app.use('/files', fileRoutes);
  app.use('/deploy', deployRoutes);
  app.use('/users', userRoutes);

  app.get('/', requireAuth, (req, res) => {
    res.render('dashboard', {
      title: 'Dashboard - NetLab Manager',
      user: req.session.username,
      userRole: req.session.role,
      currentRoute: 'dashboard'
    });
  });

  app.get('/docker', requireAuth, (req, res) => {
    res.render('docker', {
      title: 'Docker Manager - NetLab Manager',
      user: req.session.username,
      userRole: req.session.role,
      currentRoute: 'docker'
    });
  });

  app.get('/tasks', requireAuth, (req, res) => {
    res.render('tasks', {
      title: 'Mass Task Execution - NetLab Manager',
      user: req.session.username,
      userRole: req.session.role,
      currentRoute: 'tasks'
    });
  });

  app.get('/files', requireAuth, (req, res) => {
    res.render('files', {
      title: 'File Manager - NetLab Manager',
      user: req.session.username,
      userRole: req.session.role,
      currentRoute: 'files'
    });
  });

  app.get('/deploy', requireAuth, (req, res) => {
    res.render('deploy', {
      title: 'Deployments - NetLab Manager',
      user: req.session.username,
      userRole: req.session.role,
      currentRoute: 'deploy'
    });
  });

  app.get('/users', requireAuth, requireAdmin, (req, res) => {
    res.render('users', {
      title: 'User Management - NetLab Manager',
      user: req.session.username,
      userRole: req.session.role,
      currentRoute: 'users'
    });
  });

  const server = app.listen(port, () => {
    console.log('Server is running on port ' + port);
  });
  
  const wsServer = new WebSocket.Server({ noServer: true });
  
  server.on('upgrade', (request, socket, head) => {
    if (request.url.startsWith('/terminal-ws/')) {
      sessionParser(request, {}, () => {
        wsServer.handleUpgrade(request, socket, head, (ws) => {
          wsServer.emit('connection', ws, request);
        });
      });
    } else {
      socket.destroy();
    }
  });
  
  wsServer.on('connection', terminalController.handleTerminalConnection);
}

startServer();
