require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const { initScheduler } = require('./services/scheduler');

async function start() {
  const app = express();
  const server = http.createServer(app);

  const wss = new WebSocket.Server({ server, path: '/ws' });
  global.wss = wss;

  app.use(cors({ origin: '*' }));
  app.use(express.json());

  const WORKSPACE = path.join(__dirname, 'workspace');
  if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });
  app.use('/files', express.static(WORKSPACE));

  app.use('/api/auth',         require('./routes/auth'));
  app.use('/api/projects',     require('./routes/projects'));
  app.use('/api/environments', require('./routes/environments'));
  app.use('/api/users',        require('./routes/users'));
  app.use('/api/flows',        require('./routes/flows'));
  app.use('/api/executions',   require('./routes/executions'));
  app.use('/api/reports',      require('./routes/reports'));
  app.use('/api/schedules',    require('./routes/schedules'));

  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

  wss.on('connection', (ws) => { ws.on('error', () => {}); });

  global.broadcast = (executionId, payload) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ executionId, ...payload }));
      }
    });
  };

  // Serve agent workspace files (screenshots, videos)
  const AGENT_WORKSPACE = path.join(__dirname, 'agent-workspace');
  if (!fs.existsSync(AGENT_WORKSPACE)) fs.mkdirSync(AGENT_WORKSPACE, { recursive: true });
  app.use('/agent-files', express.static(AGENT_WORKSPACE));

  // AI Agent routes (TypeScript, loaded via tsx)
  const agentBroadcast = (event) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ __agent: true, ...event }));
      }
    });
  };
  const { createAgentRouter } = require('./api/agentRoutes');
  app.use('/api/agent', createAgentRouter(agentBroadcast));

  await initScheduler();

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`QATry backend running on http://localhost:${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
  });
}

start().catch(err => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
