const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { findOne, findAll, insert, update, remove } = require('../db');
const { FLOW_TEMPLATES } = require('../services/flowTemplates');

const DEFAULT_SCRIPT = `async function flow(page, { baseUrl, testUser, step }) {
  await step('Navegar para a aplicação', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  // Adicione mais steps aqui...
  // Exemplos:
  // await page.fill('[name="email"]', testUser.username);
  // await page.fill('[name="password"]', testUser.password);
  // await page.click('[type="submit"]');
  // const el = await page.$('.success');
  // if (!el) throw new Error('Mensagem de sucesso não encontrada');
}`;

// List all templates (no DB needed)
router.get('/templates', (req, res) => {
  res.json(FLOW_TEMPLATES);
});

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
    const { project_id, name, description = '', script = DEFAULT_SCRIPT, order_index = 0, template_id } = req.body;
    if (!project_id || !name) return res.status(400).json({ error: 'project_id e name são obrigatórios' });

    // Use template script if template_id provided
    let resolvedScript = script;
    if (template_id) {
      const tpl = FLOW_TEMPLATES.find(t => t.id === template_id);
      if (tpl) resolvedScript = tpl.script;
    }

    const flow = await insert('flows', { id: uuid(), project_id, name, description, script: resolvedScript, order_index });
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
      name:        name        ?? flow.name,
      description: description ?? flow.description,
      script:      script      ?? flow.script,
      order_index: order_index ?? flow.order_index,
      updated_at:  new Date().toISOString(),
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
