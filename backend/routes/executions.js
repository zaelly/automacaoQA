const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { startExecution, stopExecution } = require('../services/executor');

// List executions
router.get('/', (req, res) => {
  const { project_id, limit = 50, offset = 0 } = req.query;
  const execs = project_id
    ? db.prepare('SELECT * FROM executions WHERE project_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?').all(project_id, Number(limit), Number(offset))
    : db.prepare('SELECT * FROM executions ORDER BY started_at DESC LIMIT ? OFFSET ?').all(Number(limit), Number(offset));
  res.json(execs);
});

// Get single execution with steps
router.get('/:id', (req, res) => {
  const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id);
  if (!exec) return res.status(404).json({ error: 'Execução não encontrada' });

  exec.findings = JSON.parse(exec.findings || '[]');
  exec.suggestions = JSON.parse(exec.suggestions || '[]');
  exec.steps = db.prepare('SELECT * FROM execution_steps WHERE execution_id = ? ORDER BY order_index').all(req.params.id);

  res.json(exec);
});

// Start new execution (AI audit or project flow)
router.post('/', async (req, res) => {
  const {
    project_id,
    flow_id,
    environment_id,
    base_url,
    trigger_type = 'manual',
    record_video = false,
  } = req.body;

  // Resolve base_url from environment or request body
  let resolvedUrl = base_url;
  if (environment_id && !base_url) {
    const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(environment_id);
    if (env) resolvedUrl = env.base_url;
  }
  if (!resolvedUrl) return res.status(400).json({ error: 'URL é obrigatória' });

  const flow = flow_id ? db.prepare('SELECT * FROM flows WHERE id = ?').get(flow_id) : null;
  const project = project_id ? db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) : null;

  // Create a temporary project if none provided (AI audit mode)
  let pid = project_id;
  if (!pid) {
    pid = uuid();
    db.prepare("INSERT INTO projects (id, name, base_url) VALUES (?, ?, ?)").run(pid, 'Auditoria IA', resolvedUrl);
  }

  const id = uuid();
  db.prepare(`
    INSERT INTO executions (id, project_id, flow_id, environment_id, flow_name, project_name, status, trigger_type, base_url)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id, pid, flow_id || null, environment_id || null,
    flow ? flow.name : 'Auditoria IA',
    project ? project.name : 'Auditoria IA',
    trigger_type,
    resolvedUrl
  );

  // Start async (don't await — runs in background)
  startExecution(id, { recordVideo: record_video }).catch(err => {
    console.error('Execution error:', err);
    db.prepare("UPDATE executions SET status='failed' WHERE id=?").run(id);
  });

  res.status(202).json({ id, status: 'pending', message: 'Execução iniciada' });
});

// Stop execution
router.post('/:id/stop', (req, res) => {
  const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id);
  if (!exec) return res.status(404).json({ error: 'Execução não encontrada' });
  if (exec.status !== 'running') return res.status(400).json({ error: 'Execução não está em andamento' });

  stopExecution(req.params.id);
  res.json({ ok: true, message: 'Sinal de parada enviado' });
});

// Delete execution
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM executions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Execução não encontrada' });
  res.json({ ok: true });
});

module.exports = router;
