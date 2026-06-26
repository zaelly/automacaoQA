const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { addSchedule, removeSchedule, toggleSchedule } = require('../services/scheduler');

router.get('/', (req, res) => {
  const { project_id } = req.query;
  const schedules = project_id
    ? db.prepare(`
        SELECT s.*, f.name as flow_name, p.name as project_name
        FROM schedules s
        LEFT JOIN flows f ON s.flow_id = f.id
        LEFT JOIN projects p ON s.project_id = p.id
        WHERE s.project_id = ?
      `).all(project_id)
    : db.prepare(`
        SELECT s.*, f.name as flow_name, p.name as project_name
        FROM schedules s
        LEFT JOIN flows f ON s.flow_id = f.id
        LEFT JOIN projects p ON s.project_id = p.id
      `).all();
  res.json(schedules);
});

router.post('/', (req, res) => {
  const { project_id, flow_id, environment_id, cron_expression } = req.body;
  if (!project_id || !flow_id || !cron_expression) {
    return res.status(400).json({ error: 'project_id, flow_id e cron_expression são obrigatórios' });
  }
  const id = uuid();
  db.prepare('INSERT INTO schedules (id, project_id, flow_id, environment_id, cron_expression) VALUES (?, ?, ?, ?, ?)')
    .run(id, project_id, flow_id, environment_id || null, cron_expression);
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
  addSchedule(schedule);
  res.status(201).json(schedule);
});

router.put('/:id/toggle', (req, res) => {
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Agendamento não encontrado' });
  const newEnabled = schedule.enabled ? 0 : 1;
  db.prepare('UPDATE schedules SET enabled = ? WHERE id = ?').run(newEnabled, req.params.id);
  toggleSchedule(req.params.id, !!newEnabled);
  res.json({ ...schedule, enabled: newEnabled });
});

router.delete('/:id', (req, res) => {
  removeSchedule(req.params.id);
  const result = db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
  res.json({ ok: true });
});

module.exports = router;
