const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { generateHTMLReport, generatePDFReport } = require('../services/reporter');

// List all reports (completed executions)
router.get('/', (req, res) => {
  const { project_id } = req.query;
  const execs = project_id
    ? db.prepare("SELECT * FROM executions WHERE project_id = ? AND status IN ('passed','failed') ORDER BY started_at DESC").all(project_id)
    : db.prepare("SELECT * FROM executions WHERE status IN ('passed','failed') ORDER BY started_at DESC").all();

  const reports = execs.map(e => ({
    ...e,
    findings: JSON.parse(e.findings || '[]'),
    suggestions: JSON.parse(e.suggestions || '[]'),
    has_html: !!e.report_path && fs.existsSync(path.join(__dirname, '..', 'workspace', e.report_path || '')),
  }));
  res.json(reports);
});

// Get specific report with all steps
router.get('/:id', (req, res) => {
  const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id);
  if (!exec) return res.status(404).json({ error: 'Relatório não encontrado' });

  exec.findings = JSON.parse(exec.findings || '[]');
  exec.suggestions = JSON.parse(exec.suggestions || '[]');
  exec.steps = db.prepare('SELECT * FROM execution_steps WHERE execution_id = ? ORDER BY order_index').all(req.params.id);

  res.json(exec);
});

// Generate / download HTML report
router.get('/:id/html', async (req, res) => {
  const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id);
  if (!exec) return res.status(404).json({ error: 'Relatório não encontrado' });

  const reportPath = await generateHTMLReport(exec);
  res.download(reportPath, `relatorio-${exec.id.slice(0, 8)}.html`);
});

// Generate / download PDF report
router.get('/:id/pdf', async (req, res) => {
  const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(req.params.id);
  if (!exec) return res.status(404).json({ error: 'Relatório não encontrado' });

  try {
    const pdfPath = await generatePDFReport(exec);
    res.download(pdfPath, `relatorio-${exec.id.slice(0, 8)}.pdf`);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar PDF: ' + err.message });
  }
});

module.exports = router;
