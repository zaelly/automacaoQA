const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { db } = require('../db');

router.get('/', (req, res) => {
  const { project_id } = req.query;
  const envs = project_id
    ? db.prepare('SELECT * FROM environments WHERE project_id = ? ORDER BY type').all(project_id)
    : db.prepare('SELECT * FROM environments ORDER BY created_at DESC').all();
  res.json(envs);
});

router.post('/', (req, res) => {
  const { project_id, name, type = 'development', base_url } = req.body;
  if (!project_id || !name || !base_url) return res.status(400).json({ error: 'project_id, name e base_url são obrigatórios' });
  const id = uuid();
  db.prepare('INSERT INTO environments (id, project_id, name, type, base_url) VALUES (?, ?, ?, ?, ?)')
    .run(id, project_id, name, type, base_url);
  res.status(201).json(db.prepare('SELECT * FROM environments WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const { name, type, base_url } = req.body;
  const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);
  if (!env) return res.status(404).json({ error: 'Ambiente não encontrado' });
  db.prepare('UPDATE environments SET name=?, type=?, base_url=? WHERE id=?')
    .run(name ?? env.name, type ?? env.type, base_url ?? env.base_url, req.params.id);
  res.json(db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM environments WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Ambiente não encontrado' });
  res.json({ ok: true });
});

module.exports = router;
