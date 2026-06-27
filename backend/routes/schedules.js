const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { supabase, findOne, insert, remove } = require('../db');
const { addSchedule, removeSchedule, toggleSchedule } = require('../services/scheduler');

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    let q = supabase.from('schedules').select('*, flows(name), projects(name)');
    if (project_id) q = q.eq('project_id', project_id);
    const { data: rows, error } = await q;
    if (error) throw error;

    const schedules = (rows || []).map(s => ({
      ...s,
      flow_name: s.flows?.name || null,
      project_name: s.projects?.name || null,
      flows: undefined,
      projects: undefined,
    }));
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, flow_id, environment_id, cron_expression } = req.body;
    if (!project_id || !flow_id || !cron_expression)
      return res.status(400).json({ error: 'project_id, flow_id e cron_expression são obrigatórios' });

    const schedule = await insert('schedules', {
      id: uuid(), project_id, flow_id,
      environment_id: environment_id || null,
      cron_expression,
    });
    addSchedule(schedule);
    res.status(201).json(schedule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/toggle', async (req, res) => {
  try {
    const schedule = await findOne('schedules', { id: req.params.id });
    if (!schedule) return res.status(404).json({ error: 'Agendamento não encontrado' });

    const newEnabled = !schedule.enabled;
    const { error } = await supabase.from('schedules').update({ enabled: newEnabled }).eq('id', req.params.id);
    if (error) throw error;

    toggleSchedule(req.params.id, newEnabled);
    res.json({ ...schedule, enabled: newEnabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    removeSchedule(req.params.id);
    const n = await remove('schedules', { id: req.params.id });
    if (n === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
