const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { db } = require('../db');

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

router.get('/', (req, res) => {
  const { project_id } = req.query;
  const flows = project_id
    ? db.prepare('SELECT * FROM flows WHERE project_id = ? ORDER BY order_index, name').all(project_id)
    : db.prepare('SELECT * FROM flows ORDER BY created_at DESC').all();
  res.json(flows);
});

router.get('/:id', (req, res) => {
  const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(req.params.id);
  if (!flow) return res.status(404).json({ error: 'Flow não encontrado' });
  res.json(flow);
});

router.post('/', (req, res) => {
  const { project_id, name, description = '', script = DEFAULT_SCRIPT, order_index = 0 } = req.body;
  if (!project_id || !name) return res.status(400).json({ error: 'project_id e name são obrigatórios' });
  const id = uuid();
  db.prepare('INSERT INTO flows (id, project_id, name, description, script, order_index) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, project_id, name, description, script, order_index);
  res.status(201).json(db.prepare('SELECT * FROM flows WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const { name, description, script, order_index } = req.body;
  const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(req.params.id);
  if (!flow) return res.status(404).json({ error: 'Flow não encontrado' });
  db.prepare("UPDATE flows SET name=?, description=?, script=?, order_index=?, updated_at=datetime('now') WHERE id=?")
    .run(name ?? flow.name, description ?? flow.description, script ?? flow.script, order_index ?? flow.order_index, req.params.id);
  res.json(db.prepare('SELECT * FROM flows WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM flows WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Flow não encontrado' });
  res.json({ ok: true });
});

module.exports = router;
