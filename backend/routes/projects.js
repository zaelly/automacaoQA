const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { findOne, findAll, insert, update, remove, countRows } = require('../db');

router.get('/', async (req, res) => {
  try {
    const projects = await findAll('projects', {}, { order: 'created_at', ascending: false });
    const result = await Promise.all(projects.map(async p => ({
      ...p,
      flow_count:      await countRows('flows',      { project_id: p.id }),
      execution_count: await countRows('executions', { project_id: p.id }),
      passed_count:    await countRows('executions', { project_id: p.id, status: 'passed' }),
      failed_count:    await countRows('executions', { project_id: p.id, status: 'failed' }),
      running_count:   await countRows('executions', { project_id: p.id, status: 'running' }),
    })));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await findOne('projects', { id });
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    const [environments, test_users, flows, recent_executions] = await Promise.all([
      findAll('environments', { project_id: id }, { order: 'type', ascending: true }),
      findAll('test_users', { project_id: id }, { select: 'id, project_id, name, username, role, created_at' }),
      findAll('flows', { project_id: id }, { order: 'order_index', ascending: true }),
      findAll('executions', { project_id: id }, { order: 'started_at', ascending: false, limit: 10 }),
    ]);

    res.json({ ...project, environments, test_users, flows, recent_executions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description = '', base_url = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const project = await insert('projects', { id: uuid(), name, description, base_url });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, base_url } = req.body;
    const project = await findOne('projects', { id: req.params.id });
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
    const updated = await update('projects', { id: req.params.id }, {
      name: name ?? project.name,
      description: description ?? project.description,
      base_url: base_url ?? project.base_url,
      updated_at: new Date().toISOString(),
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await remove('projects', { id: req.params.id });
    if (n === 0) return res.status(404).json({ error: 'Projeto não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
