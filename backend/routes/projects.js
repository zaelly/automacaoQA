const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { db } = require('../db');

// List all projects
router.get('/', (req, res) => {
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM flows WHERE project_id = p.id) as flow_count,
      (SELECT COUNT(*) FROM executions WHERE project_id = p.id) as execution_count,
      (SELECT COUNT(*) FROM executions WHERE project_id = p.id AND status = 'passed') as passed_count,
      (SELECT COUNT(*) FROM executions WHERE project_id = p.id AND status = 'failed') as failed_count,
      (SELECT COUNT(*) FROM executions WHERE project_id = p.id AND status = 'running') as running_count
    FROM projects p ORDER BY p.created_at DESC
  `).all();
  res.json(projects);
});

// Get single project
router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

  project.environments = db.prepare('SELECT * FROM environments WHERE project_id = ? ORDER BY type').all(req.params.id);
  project.test_users = db.prepare('SELECT id, project_id, name, username, role, created_at FROM test_users WHERE project_id = ?').all(req.params.id);
  project.flows = db.prepare('SELECT * FROM flows WHERE project_id = ? ORDER BY order_index').all(req.params.id);
  project.recent_executions = db.prepare(
    'SELECT * FROM executions WHERE project_id = ? ORDER BY started_at DESC LIMIT 10'
  ).all(req.params.id);

  res.json(project);
});

// Create project
router.post('/', (req, res) => {
  const { name, description = '', base_url = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const id = uuid();
  db.prepare('INSERT INTO projects (id, name, description, base_url) VALUES (?, ?, ?, ?)')
    .run(id, name, description, base_url);

  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
});

// Update project
router.put('/:id', (req, res) => {
  const { name, description, base_url } = req.body;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

  db.prepare('UPDATE projects SET name=?, description=?, base_url=?, updated_at=datetime(\'now\') WHERE id=?')
    .run(name ?? project.name, description ?? project.description, base_url ?? project.base_url, req.params.id);

  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// Delete project
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json({ ok: true });
});

module.exports = router;
