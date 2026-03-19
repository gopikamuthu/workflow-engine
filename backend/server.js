const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// ── In-memory DB ──────────────────────────────────────────────────────────────
const db = {
  workflows: [
    {
      id: 'wf-001',
      name: 'Expense Approval',
      version: 3,
      is_active: true,
      input_schema: [
        { field: 'amount',     type: 'number', required: true,  allowed_values: [] },
        { field: 'country',    type: 'string', required: true,  allowed_values: ['US','UK','IN'] },
        { field: 'department', type: 'string', required: false, allowed_values: ['Finance','HR','IT','Ops'] },
        { field: 'priority',   type: 'string', required: true,  allowed_values: ['High','Medium','Low'] }
      ],
      start_step_id: 'step-001',
      steps: [
        { id: 'step-001', workflow_id: 'wf-001', name: 'Manager Approval',     step_type: 'approval',     order: 1, metadata: { assignee_email: 'manager@example.com' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'step-002', workflow_id: 'wf-001', name: 'Finance Notification', step_type: 'notification', order: 2, metadata: { notification_channel: 'email' },          created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'step-003', workflow_id: 'wf-001', name: 'CEO Approval',         step_type: 'approval',     order: 3, metadata: { assignee_email: 'ceo@example.com' },      created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'step-004', workflow_id: 'wf-001', name: 'Task Rejection',       step_type: 'task',         order: 4, metadata: {},                                         created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ],
      rules: [
        { id: 'r-001', step_id: 'step-001', condition: 'amount > 100 && country == "US" && priority == "High"', next_step_id: 'step-003', priority: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'r-002', step_id: 'step-001', condition: 'amount <= 100',                                          next_step_id: 'step-002', priority: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'r-003', step_id: 'step-001', condition: 'priority == "Low" && country != "US"',                   next_step_id: 'step-004', priority: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'r-004', step_id: 'step-001', condition: 'DEFAULT',                                                next_step_id: 'step-004', priority: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'wf-002',
      name: 'Employee Onboarding',
      version: 1,
      is_active: true,
      input_schema: [
        { field: 'employee_name', type: 'string', required: true,  allowed_values: [] },
        { field: 'department',    type: 'string', required: true,  allowed_values: ['Engineering','Sales','HR'] }
      ],
      start_step_id: 'step-010',
      steps: [
        { id: 'step-010', workflow_id: 'wf-002', name: 'HR Review',              step_type: 'approval',     order: 1, metadata: { assignee_email: 'hr@example.com' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'step-011', workflow_id: 'wf-002', name: 'IT Setup Notification',  step_type: 'notification', order: 2, metadata: { notification_channel: 'slack' },    created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ],
      rules: [
        { id: 'r-010', step_id: 'step-010', condition: 'DEFAULT', next_step_id: 'step-011', priority: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  executions: []
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function findWorkflow(id) { return db.workflows.find(w => w.id === id); }

function evaluateCondition(condition, data) {
  if (condition === 'DEFAULT') return true;
  try {
    let expr = condition;
    Object.keys(data).forEach(k => {
      const v = data[k];
      expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), typeof v === 'string' ? `"${v}"` : v);
    });
    return Function('"use strict"; return (' + expr + ')')();
  } catch (e) {
    return false;
  }
}

function runWorkflowEngine(workflow, inputData) {
  const logs = [];
  let currentStepId = workflow.start_step_id;
  let status = 'completed';
  let maxIter = 20, iter = 0;

  while (currentStepId && iter < maxIter) {
    iter++;
    const step = workflow.steps.find(s => s.id === currentStepId);
    if (!step) break;

    const stepRules = workflow.rules
      .filter(r => r.step_id === step.id)
      .sort((a, b) => a.priority - b.priority);

    const evaluatedRules = [];
    let nextStepId = null;
    let matched = false;

    for (const rule of stepRules) {
      const result = evaluateCondition(rule.condition, inputData);
      evaluatedRules.push({ rule: rule.condition, result });
      if (result && !matched) {
        matched = true;
        nextStepId = rule.next_step_id || null;
      }
    }

    const nextStep = nextStepId ? workflow.steps.find(s => s.id === nextStepId) : null;
    const logEntry = {
      step_name: step.name,
      step_type: step.step_type,
      evaluated_rules: evaluatedRules,
      selected_next_step: nextStep ? nextStep.name : null,
      status: 'completed',
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString()
    };
    if (step.step_type === 'approval') {
      logEntry.approver_id = 'user' + Math.floor(Math.random() * 900 + 100);
    }
    logs.push(logEntry);
    currentStepId = nextStepId;
  }

  return { logs, status };
}

// ══════════════════════════════════════════════════════════════════════════════
// WORKFLOW ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /workflows — create
app.post('/workflows', (req, res) => {
  const { name, input_schema, steps, rules } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const wf = {
    id: 'wf-' + uuidv4().slice(0, 8),
    name,
    version: 1,
    is_active: true,
    input_schema: input_schema || [],
    start_step_id: steps && steps.length ? steps[0].id : null,
    steps: (steps || []).map(s => ({ ...s, id: s.id || 'step-' + uuidv4().slice(0, 8), created_at: new Date().toISOString(), updated_at: new Date().toISOString() })),
    rules: (rules || []).map(r => ({ ...r, id: r.id || 'r-' + uuidv4().slice(0, 8), created_at: new Date().toISOString(), updated_at: new Date().toISOString() })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.workflows.push(wf);
  res.status(201).json(wf);
});

// GET /workflows — list (pagination + search)
app.get('/workflows', (req, res) => {
  const { search = '', page = 1, limit = 20 } = req.query;
  let list = db.workflows;
  if (search) list = list.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));
  const total = list.length;
  const start = (parseInt(page) - 1) * parseInt(limit);
  list = list.slice(start, start + parseInt(limit));
  res.json({ data: list, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /workflows/:id — detail with steps & rules
app.get('/workflows/:id', (req, res) => {
  const wf = findWorkflow(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });
  res.json(wf);
});

// PUT /workflows/:id — update (creates new version)
app.put('/workflows/:id', (req, res) => {
  const idx = db.workflows.findIndex(w => w.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Workflow not found' });
  const existing = db.workflows[idx];
  const updated = {
    ...existing,
    ...req.body,
    id: existing.id,
    version: existing.version + 1,
    updated_at: new Date().toISOString()
  };
  if (updated.steps && updated.steps.length) updated.start_step_id = updated.steps[0].id;
  db.workflows[idx] = updated;
  res.json(updated);
});

// DELETE /workflows/:id
app.delete('/workflows/:id', (req, res) => {
  const idx = db.workflows.findIndex(w => w.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Workflow not found' });
  db.workflows.splice(idx, 1);
  res.json({ message: 'Workflow deleted' });
});

// ══════════════════════════════════════════════════════════════════════════════
// STEPS ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /workflows/:workflow_id/steps
app.post('/workflows/:workflow_id/steps', (req, res) => {
  const wf = findWorkflow(req.params.workflow_id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });
  const step = {
    ...req.body,
    id: 'step-' + uuidv4().slice(0, 8),
    workflow_id: wf.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  wf.steps.push(step);
  res.status(201).json(step);
});

// GET /workflows/:workflow_id/steps
app.get('/workflows/:workflow_id/steps', (req, res) => {
  const wf = findWorkflow(req.params.workflow_id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });
  res.json(wf.steps);
});

// PUT /steps/:id
app.put('/steps/:id', (req, res) => {
  for (const wf of db.workflows) {
    const idx = wf.steps.findIndex(s => s.id === req.params.id);
    if (idx >= 0) {
      wf.steps[idx] = { ...wf.steps[idx], ...req.body, id: req.params.id, updated_at: new Date().toISOString() };
      return res.json(wf.steps[idx]);
    }
  }
  res.status(404).json({ error: 'Step not found' });
});

// DELETE /steps/:id
app.delete('/steps/:id', (req, res) => {
  for (const wf of db.workflows) {
    const idx = wf.steps.findIndex(s => s.id === req.params.id);
    if (idx >= 0) {
      wf.steps.splice(idx, 1);
      wf.rules = wf.rules.filter(r => r.step_id !== req.params.id && r.next_step_id !== req.params.id);
      return res.json({ message: 'Step deleted' });
    }
  }
  res.status(404).json({ error: 'Step not found' });
});

// ══════════════════════════════════════════════════════════════════════════════
// RULES ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /steps/:step_id/rules
app.post('/steps/:step_id/rules', (req, res) => {
  for (const wf of db.workflows) {
    const step = wf.steps.find(s => s.id === req.params.step_id);
    if (step) {
      const rule = {
        ...req.body,
        id: 'r-' + uuidv4().slice(0, 8),
        step_id: step.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      wf.rules.push(rule);
      return res.status(201).json(rule);
    }
  }
  res.status(404).json({ error: 'Step not found' });
});

// GET /steps/:step_id/rules
app.get('/steps/:step_id/rules', (req, res) => {
  for (const wf of db.workflows) {
    if (wf.steps.find(s => s.id === req.params.step_id)) {
      return res.json(wf.rules.filter(r => r.step_id === req.params.step_id));
    }
  }
  res.status(404).json({ error: 'Step not found' });
});

// PUT /rules/:id
app.put('/rules/:id', (req, res) => {
  for (const wf of db.workflows) {
    const idx = wf.rules.findIndex(r => r.id === req.params.id);
    if (idx >= 0) {
      wf.rules[idx] = { ...wf.rules[idx], ...req.body, id: req.params.id, updated_at: new Date().toISOString() };
      return res.json(wf.rules[idx]);
    }
  }
  res.status(404).json({ error: 'Rule not found' });
});

// DELETE /rules/:id
app.delete('/rules/:id', (req, res) => {
  for (const wf of db.workflows) {
    const idx = wf.rules.findIndex(r => r.id === req.params.id);
    if (idx >= 0) {
      wf.rules.splice(idx, 1);
      return res.json({ message: 'Rule deleted' });
    }
  }
  res.status(404).json({ error: 'Rule not found' });
});

// ══════════════════════════════════════════════════════════════════════════════
// EXECUTION ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /workflows/:workflow_id/execute — start execution
app.post('/workflows/:workflow_id/execute', (req, res) => {
  const wf = findWorkflow(req.params.workflow_id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });
  if (!wf.is_active) return res.status(400).json({ error: 'Workflow is not active' });

  const inputData = req.body.data || {};
  const { logs, status } = runWorkflowEngine(wf, inputData);

  const execution = {
    id: 'exec-' + uuidv4().slice(0, 8),
    workflow_id: wf.id,
    workflow_version: wf.version,
    status,
    data: inputData,
    logs,
    current_step_id: null,
    retries: 0,
    triggered_by: req.body.triggered_by || 'api',
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString()
  };

  db.executions.unshift(execution);
  res.status(201).json(execution);
});

// GET /executions/:id — get execution status & logs
app.get('/executions/:id', (req, res) => {
  const exec = db.executions.find(e => e.id === req.params.id);
  if (!exec) return res.status(404).json({ error: 'Execution not found' });
  res.json(exec);
});

// GET /executions — list all
app.get('/executions', (req, res) => {
  const { workflow_id, status } = req.query;
  let list = db.executions;
  if (workflow_id) list = list.filter(e => e.workflow_id === workflow_id);
  if (status) list = list.filter(e => e.status === status);
  res.json({ data: list, total: list.length });
});

// POST /executions/:id/cancel
app.post('/executions/:id/cancel', (req, res) => {
  const exec = db.executions.find(e => e.id === req.params.id);
  if (!exec) return res.status(404).json({ error: 'Execution not found' });
  if (exec.status !== 'pending' && exec.status !== 'in_progress') {
    return res.status(400).json({ error: 'Only pending/in_progress executions can be cancelled' });
  }
  exec.status = 'cancelled';
  exec.ended_at = new Date().toISOString();
  res.json(exec);
});

// POST /executions/:id/retry — retry only the failed step
app.post('/executions/:id/retry', (req, res) => {
  const exec = db.executions.find(e => e.id === req.params.id);
  if (!exec) return res.status(404).json({ error: 'Execution not found' });
  if (exec.status !== 'failed') return res.status(400).json({ error: 'Only failed executions can be retried' });

  const failedLog = exec.logs.find(l => l.status === 'failed');
  if (failedLog) { failedLog.status = 'completed'; delete failedLog.error_message; }
  exec.status = 'completed';
  exec.retries = (exec.retries || 0) + 1;
  exec.ended_at = new Date().toISOString();
  res.json(exec);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Workflow Engine API running on http://localhost:${PORT}`));
