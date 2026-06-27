const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { supabase, findOne, findAll } = require('../db');
const { generateHTMLReport, generatePDFReport } = require('../services/reporter');

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    let q = supabase.from('executions')
      .select('*')
      .in('status', ['passed', 'failed'])
      .order('started_at', { ascending: false });
    if (project_id) q = q.eq('project_id', project_id);
    const { data: execs, error } = await q;
    if (error) throw error;

    const reports = (execs || []).map(e => ({
      ...e,
      findings: JSON.parse(e.findings || '[]'),
      suggestions: JSON.parse(e.suggestions || '[]'),
      has_html: !!e.report_path && fs.existsSync(path.join(__dirname, '..', 'workspace', e.report_path || '')),
    }));
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const exec = await findOne('executions', { id: req.params.id });
    if (!exec) return res.status(404).json({ error: 'Relatório não encontrado' });

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

router.get('/:id/html', async (req, res) => {
  try {
    const exec = await findOne('executions', { id: req.params.id });
    if (!exec) return res.status(404).json({ error: 'Relatório não encontrado' });
    const reportPath = await generateHTMLReport(exec);
    res.download(reportPath, `relatorio-${exec.id.slice(0, 8)}.html`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const exec = await findOne('executions', { id: req.params.id });
    if (!exec) return res.status(404).json({ error: 'Relatório não encontrado' });
    const pdfPath = await generatePDFReport(exec);
    res.download(pdfPath, `relatorio-${exec.id.slice(0, 8)}.pdf`);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar PDF: ' + err.message });
  }
});

module.exports = router;
