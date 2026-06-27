const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { findOne, findAll, insert, update, remove } = require('../db');

const DEFAULT_SCRIPT = `async function flow(page, { baseUrl, testUser, step }) {
  await step('Navegar para a aplicação', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
  });

  // Adicione mais steps aqui...
  // Exemplos:
  // await page.fill('[name="email"]', testUser.username);
  // await page.fill('[name="password"]', testUser.password);
  // await page.click('[type="submit"]');
  // await page.waitForURL('**/dashboard');
}`;

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    const flows = project_id
      ? await findAll('flows', { project_id }, { order: 'order_index', ascending: true })
      : await findAll('flows', {}, { order: 'created_at', ascending: false });
    res.json(flows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const flow = await findOne('flows', { id: req.params.id });
    if (!flow) return res.status(404).json({ error: 'Flow não encontrado' });
    res.json(flow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, name, description = '', script = DEFAULT_SCRIPT, order_index = 0 } = req.body;
    if (!project_id || !name) return res.status(400).json({ error: 'project_id e name são obrigatórios' });
    const flow = await insert('flows', { id: uuid(), project_id, name, description, script, order_index });
    res.status(201).json(flow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, script, order_index } = req.body;
    const flow = await findOne('flows', { id: req.params.id });
    if (!flow) return res.status(404).json({ error: 'Flow não encontrado' });
    const updated = await update('flows', { id: req.params.id }, {
      name: name ?? flow.name,
      description: description ?? flow.description,
      script: script ?? flow.script,
      order_index: order_index ?? flow.order_index,
      updated_at: new Date().toISOString(),
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await remove('flows', { id: req.params.id });
    if (n === 0) return res.status(404).json({ error: 'Flow não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
