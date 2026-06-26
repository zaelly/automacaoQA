const cron = require('node-cron');
const { v4: uuid } = require('uuid');
const { startExecution } = require('./executor');

const jobs = new Map(); // scheduleId -> cron.Task

function runScheduledExecution(schedule) {
  const { db } = require('../db');
  const execId = uuid();

  try {
    const env = schedule.environment_id
      ? db.prepare('SELECT base_url FROM environments WHERE id = ?').get(schedule.environment_id)
      : null;
    const project = db.prepare('SELECT base_url, name FROM projects WHERE id = ?').get(schedule.project_id);
    const flow = db.prepare('SELECT name FROM flows WHERE id = ?').get(schedule.flow_id);

    const baseUrl = env?.base_url || project?.base_url || '';

    db.prepare(`
      INSERT INTO executions (id, project_id, flow_id, environment_id, flow_name, project_name, status, trigger_type, base_url)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 'scheduled', ?)
    `).run(
      execId,
      schedule.project_id,
      schedule.flow_id,
      schedule.environment_id || null,
      flow?.name || 'Flow',
      project?.name || 'Projeto',
      baseUrl
    );

    db.prepare("UPDATE schedules SET last_run=datetime('now') WHERE id=?").run(schedule.id);

    startExecution(execId).catch(err => {
      console.error(`[scheduler] Execution ${execId} failed:`, err.message);
    });
  } catch (err) {
    console.error(`[scheduler] Failed to start scheduled execution for schedule ${schedule.id}:`, err.message);
  }
}

function addSchedule(schedule) {
  if (!cron.validate(schedule.cron_expression)) {
    console.warn(`[scheduler] Invalid cron expression: ${schedule.cron_expression}`);
    return;
  }
  if (jobs.has(schedule.id)) removeSchedule(schedule.id);

  if (!schedule.enabled) return;

  const task = cron.schedule(schedule.cron_expression, () => {
    runScheduledExecution(schedule);
  }, { scheduled: true, timezone: 'America/Sao_Paulo' });

  jobs.set(schedule.id, task);
  console.log(`[scheduler] Registered schedule ${schedule.id}: ${schedule.cron_expression}`);
}

function removeSchedule(scheduleId) {
  const task = jobs.get(scheduleId);
  if (task) {
    task.destroy();
    jobs.delete(scheduleId);
  }
}

function toggleSchedule(scheduleId, enable) {
  const task = jobs.get(scheduleId);
  if (!task) return;
  if (enable) task.start();
  else task.stop();
}

function initScheduler() {
  const { db } = require('../db');
  const schedules = db.prepare('SELECT * FROM schedules WHERE enabled = 1').all();
  schedules.forEach(addSchedule);
  console.log(`[scheduler] Initialized ${schedules.length} active schedule(s)`);
}

module.exports = { initScheduler, addSchedule, removeSchedule, toggleSchedule };
