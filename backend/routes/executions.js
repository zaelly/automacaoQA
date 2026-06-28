const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { supabase, findOne, findAll, insert } = require('../db');
const { startExecution, stopExecution } = require('../services/executor');

router.get('/', async (req, res) => {
  try {
    const { project_id, limit = 50, offset = 0 } = req.query;
    const execs = await findAll(
      'executions',
      project_id ? { project_id } : {},
      { order: 'started_at', ascending: false, limit: Number(limit), offset: Number(offset) }
    );
    res.json(execs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const exec = await findOne('executions', { id: req.params.id });
    if (!exec) return res.status(404).json({ error: 'Execução não encontrada' });

    const steps = await findAll('execution_steps', { execution_id: req.params.id }, { order: 'order_index', ascending: true });

    res.json({
      ...exec,
      findings: JSON.parse(exec.findings || '[]'),
      suggestions: JSON.parse(exec.suggestions || '[]'),
      steps,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      project_id, flow_id, environment_id, base_url,
      trigger_type = 'manual', record_video = false, flow_name: customFlowName,
      credentials = null, checks = null,
    } = req.body;

    let resolvedUrl = base_url;
    if (environment_id && !base_url) {
      const env = await findOne('environments', { id: environment_id });
      if (env) resolvedUrl = env.base_url;
    }
    if (!resolvedUrl) return res.status(400).json({ error: 'URL é obrigatória' });

    const [flow, project] = await Promise.all([
      flow_id    ? findOne('flows',    { id: flow_id })    : null,
      project_id ? findOne('projects', { id: project_id }) : null,
    ]);

    let pid = project_id;
    if (!pid) {
      pid = uuid();
      await insert('projects', { id: pid, name: 'Auditoria IA', base_url: resolvedUrl });
    }

    const id = uuid();
    await insert('executions', {
      id, project_id: pid,
      flow_id: flow_id || null,
      environment_id: environment_id || null,
      flow_name: customFlowName || (flow ? flow.name : 'Auditoria IA'),
      project_name: project ? project.name : 'Auditoria IA',
      status: 'pending',
      trigger_type,
      base_url: resolvedUrl,
    });

    startExecution(id, { recordVideo: record_video, credentials, checks }).catch(err => {
      console.error('Execution error:', err);
      supabase.from('executions').update({ status: 'failed' }).eq('id', id);
    });

    res.status(202).json({ id, status: 'pending', message: 'Execução iniciada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const exec = await findOne('executions', { id: req.params.id });
    if (!exec) return res.status(404).json({ error: 'Execução não encontrada' });
    if (exec.status !== 'running') return res.status(400).json({ error: 'Execução não está em andamento' });

    stopExecution(req.params.id);
    res.json({ ok: true, message: 'Sinal de parada enviado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('executions').delete().eq('id', req.params.id).select();
    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Execução não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
