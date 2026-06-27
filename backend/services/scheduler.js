const cron = require('node-cron');
const { v4: uuid } = require('uuid');
const { startExecution } = require('./executor');

const jobs = new Map();

async function runScheduledExecution(schedule) {
  const { supabase, findOne, insert } = require('../db');
  const execId = uuid();

  try {
    const [env, project, flow] = await Promise.all([
      schedule.environment_id ? findOne('environments', { id: schedule.environment_id }) : Promise.resolve(null),
      findOne('projects', { id: schedule.project_id }),
      findOne('flows', { id: schedule.flow_id }),
    ]);

    const baseUrl = env?.base_url || project?.base_url || '';

    await insert('executions', {
      id: execId,
      project_id: schedule.project_id,
      flow_id: schedule.flow_id,
      environment_id: schedule.environment_id || null,
      flow_name: flow?.name || 'Flow',
      project_name: project?.name || 'Projeto',
      status: 'pending',
      trigger_type: 'scheduled',
      base_url: baseUrl,
    });

    await supabase
      .from('schedules')
      .update({ last_run: new Date().toISOString() })
      .eq('id', schedule.id);

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

async function initScheduler() {
  const { findAll } = require('../db');
  const schedules = await findAll('schedules', { enabled: true });
  schedules.forEach(addSchedule);
  console.log(`[scheduler] Initialized ${schedules.length} active schedule(s)`);
}

module.exports = { initScheduler, addSchedule, removeSchedule, toggleSchedule };
