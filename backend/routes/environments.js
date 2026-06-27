const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { findOne, findAll, insert, update, remove } = require('../db');

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    const envs = project_id
      ? await findAll('environments', { project_id }, { order: 'type', ascending: true })
      : await findAll('environments', {}, { order: 'created_at', ascending: false });
    res.json(envs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, name, type = 'development', base_url } = req.body;
    if (!project_id || !name || !base_url)
      return res.status(400).json({ error: 'project_id, name e base_url são obrigatórios' });
    const env = await insert('environments', { id: uuid(), project_id, name, type, base_url });
    res.status(201).json(env);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, type, base_url } = req.body;
    const env = await findOne('environments', { id: req.params.id });
    if (!env) return res.status(404).json({ error: 'Ambiente não encontrado' });
    const updated = await update('environments', { id: req.params.id }, {
      name: name ?? env.name,
      type: type ?? env.type,
      base_url: base_url ?? env.base_url,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await remove('environments', { id: req.params.id });
    if (n === 0) return res.status(404).json({ error: 'Ambiente não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
