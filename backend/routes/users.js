const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { db } = require('../db');

router.get('/', (req, res) => {
  const { project_id } = req.query;
  const users = project_id
    ? db.prepare('SELECT id, project_id, name, username, role, created_at FROM test_users WHERE project_id = ?').all(project_id)
    : db.prepare('SELECT id, project_id, name, username, role, created_at FROM test_users').all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { project_id, name = '', username, password, role = 'user' } = req.body;
  if (!project_id || !username || !password) return res.status(400).json({ error: 'project_id, username e password são obrigatórios' });
  const id = uuid();
  db.prepare('INSERT INTO test_users (id, project_id, name, username, password, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, project_id, name, username, password, role);
  res.status(201).json(db.prepare('SELECT id, project_id, name, username, role, created_at FROM test_users WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const { name, username, password, role } = req.body;
  const user = db.prepare('SELECT * FROM test_users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  db.prepare('UPDATE test_users SET name=?, username=?, password=?, role=? WHERE id=?')
    .run(name ?? user.name, username ?? user.username, password ?? user.password, role ?? user.role, req.params.id);
  res.json(db.prepare('SELECT id, project_id, name, username, role, created_at FROM test_users WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM test_users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ ok: true });
});

module.exports = router;
