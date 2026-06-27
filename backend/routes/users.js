const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { findOne, findAll, insert, update, remove } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    const users = project_id
      ? await findAll('test_users', { project_id }, { select: 'id, project_id, name, username, role, created_at' })
      : await findAll('test_users', {}, { select: 'id, project_id, name, username, role, created_at' });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, name = '', username, password, role = 'user' } = req.body;
    if (!project_id || !username || !password)
      return res.status(400).json({ error: 'project_id, username e password são obrigatórios' });
    const user = await insert('test_users', { id: uuid(), project_id, name, username, password, role });
    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    const user = await findOne('test_users', { id: req.params.id });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const updated = await update('test_users', { id: req.params.id }, {
      name: name ?? user.name,
      username: username ?? user.username,
      password: password ?? user.password,
      role: role ?? user.role,
    });
    const { password: _, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await remove('test_users', { id: req.params.id });
    if (n === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
