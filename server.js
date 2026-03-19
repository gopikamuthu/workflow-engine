const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB Connection ────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/workflow-engine';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected:', MONGO_URI))
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ── Schemas & Models ──────────────────────────────────────────────────────────
const SchemaFieldSchema = new mongoose.Schema({
  field: String,
  type: { type: String, enum: ['string', 'number', 'boolean'], default: 'string' },
  required: { type: Boolean, default: false },
  allowed_values: [String]
}, { _id: false });

const StepSchema = new mongoose.Schema({
  id: { type: String, default: () => 'step-' + uuidv4().slice(0, 8) },
  workflow_id: String,
  name: String,
  step_type: { type: String, enum: ['task', 'approval', 'notification'], default: 'task' },
  order: Number,
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { _id: false });

const RuleSchema = new mongoose.Schema({
  id: { type: String, default: () => 'r-' + uuidv4().slice(0, 8) },
  step_id: String,
  condition: String,
  next_step_id: String,
  priority: { type: Number, default: 1 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { _id: false });

const WorkflowSchema = new mongoose.Schema({
  id: { type: String, default: () => 'wf-' + uuidv4().slice(0, 8), unique: true },
  name: { type: String, required: true },
  version: { type: Number, default: 1 },
  is_active: { type: Boolean, default: true },
  input_schema: [SchemaFieldSchema],
  start_step_id: String,
  steps: [StepSchema],
  rules: [RuleSchema],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const StepLogSchema = new mongoose.Schema({
  step_name: String,
  step_type: String,
  evaluated_rules: [{ rule: String, result: Boolean, priority: Number }],
  selected_next_step: String,
  status: String,
  approver_id: String,
  error_message: String,
  started_at: Date,
  ended_at: Date
}, { _id: false });

const ExecutionSchema = new mongoose.Schema({
  id: { type: String, default: () => 'exec-' + uuidv4().slice(0, 8), unique: true },
  workflow_id: String,
  workflow_version: Number,
  status: { type: String, enum: ['completed', 'failed', 'pending', 'in_progress', 'cancelled'], default: 'pending' },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  logs: [StepLogSchema],
  current_step_id: String,
  retries: { type: Number, default: 0 },
  triggered_by: { type: String, default: 'api_user' },
  started_at: { type: Date, default: Date.now },
  ended_at: Date
});

const Workflow = mongoose.model('Workflow', WorkflowSchema);
const Execution = mongoose.model('Execution', ExecutionSchema);

// ── Seed initial data if empty ────────────────────────────────────────────────
async function seedIfEmpty() {
  const count = await Workflow.countDocuments();
  if (count > 0) return;
  await Workflow.insertMany([
    {
      id: 'wf-001', name: 'Expense Approval', version: 3, is_active: true,
      input_schema: [
        { field: 'amount',     type: 'number', required: true,  allowed_values: [] },
        { field: 'country',    type: 'string', required: true,  allowed_values: ['US','UK','IN'] },
        { field: 'department', type: 'string', required: false, allowed_values: ['Finance','HR','IT','Ops'] },
        { field: 'priority',   type: 'string', required: true,  allowed_values: ['High','Medium','Low'] }
      ],
      start_step_id: 'step-001',
      steps: [
        { id: 'step-001', workflow_id: 'wf-001', name: 'Manager Approval',     step_type: 'approval',     order: 1, metadata: { assignee_email: 'manager@example.com' } },
        { id: 'step-002', workflow_id: 'wf-001', name: 'Finance Notification', step_type: 'notification', order: 2, metadata: { notification_channel: 'email' } },
        { id: 'step-003', workflow_id: 'wf-001', name: 'CEO Approval',         step_type: 'approval',     order: 3, metadata: { assignee_email: 'ceo@example.com' } },
        { id: 'step-004', workflow_id: 'wf-001', name: 'Task Rejection',       step_type: 'task',         order: 4, metadata: {} }
      ],
      rules: [
        { id: 'r-001', step_id: 'step-001', priority: 1, condition: 'amount > 100 && country == "US" && priority == "High"', next_step_id: 'step-003' },
        { id: 'r-002', step_id: 'step-001', priority: 2, condition: 'amount <= 100',                                          next_step_id: 'step-002' },
        { id: 'r-003', step_id: 'step-001', priority: 3, condition: 'priority == "Low" && country != "US"',                   next_step_id: 'step-004' },
        { id: 'r-004', step_id: 'step-001', priority: 4, condition: 'DEFAULT',                                                next_step_id: 'step-004' }
      ]
    },
    {
      id: 'wf-002', name: 'Employee Onboarding', version: 1, is_active: true,
      input_schema: [
        { field: 'employee_name', type: 'string', required: true,  allowed_values: [] },
        { field: 'department',    type: 'string', required: true,  allowed_values: ['Engineering','Sales','HR'] }
      ],
      start_step_id: 'step-010',
      steps: [
        { id: 'step-010', workflow_id: 'wf-002', name: 'HR Review',             step_type: 'approval',     order: 1, metadata: { assignee_email: 'hr@example.com' } },
        { id: 'step-011', workflow_id: 'wf-002', name: 'IT Setup Notification', step_type: 'notification', order: 2, metadata: { notification_channel: 'slack' } }
      ],
      rules: [
        { id: 'r-010', step_id: 'step-010', priority: 1, condition: 'DEFAULT', next_step_id: 'step-011' }
      ]
    }
  ]);
  console.log('🌱 Seeded initial workflows');
}

// ── Rule Engine ───────────────────────────────────────────────────────────────
function evaluateCondition(condition, data) {
  if (condition === 'DEFAULT') return true;
  try {
    let expr = condition;
    Object.keys(data).forEach(key => {
      const val = data[key];
      expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), typeof val === 'string' ? `"${val}"` : val);
    });
    return Function('"use strict"; return (' + expr + ')')();
  } catch { return false; }
}

function runWorkflow(workflow, inputData) {
  const logs = [];
  let currentStepId = workflow.start_step_id;
  let status = 'completed';
  let iter = 0;

  while (currentStepId && iter < 50) {
    iter++;
    const step = workflow.steps.find(s => s.id === currentStepId);
    if (!step) { status = 'failed'; break; }

    const stepRules = workflow.rules
      .filter(r => r.step_id === step.id)
      .sort((a, b) => a.priority - b.priority);

    const evaluatedRules = [];
    let matchedRule = null;

    for (const rule of stepRules) {
      const result = evaluateCondition(rule.condition, inputData);
      evaluatedRules.push({ rule: rule.condition, result, priority: rule.priority });
      if (result && !matchedRule) matchedRule = rule;
    }

    const nextStep = matchedRule?.next_step_id
      ? workflow.steps.find(s => s.id === matchedRule.next_step_id)
      : null;

    const logEntry = {
      step_name: step.name,
      step_type: step.step_type,
      evaluated_rules: evaluatedRules,
      selected_next_step: nextStep?.name || null,
      status: 'completed',
      started_at: new Date(),
      ended_at: new Date()
    };

    if (step.step_type === 'approval') {
      logEntry.approver_id = 'user' + Math.floor(Math.random() * 900 + 100);
    }

    logs.push(logEntry);
    currentStepId = matchedRule?.next_step_id || null;
  }

  return { status, logs };
}

// ══════════════════════════════════════════════════════════════════════════════
// WORKFLOW ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/workflows
app.get('/api/workflows', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10 } = req.query;
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};
    const total = await Workflow.countDocuments(query);
    const data = await Workflow.find(query)
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    res.json({ data, total, page: Number(page), limit: Number(limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/workflows
app.post('/api/workflows', async (req, res) => {
  try {
    const { name, input_schema = [], steps = [], rules = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const wf = new Workflow({
      name, input_schema,
      steps: steps.map(s => ({ ...s, id: s.id || 'step-' + uuidv4().slice(0, 8) })),
      rules: rules.map(r => ({ ...r, id: r.id || 'r-' + uuidv4().slice(0, 8) })),
      start_step_id: steps[0]?.id || null
    });
    await wf.save();
    res.status(201).json(wf.toObject());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/workflows/:id
app.get('/api/workflows/:id', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ id: req.params.id }).lean();
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });
    res.json(wf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/workflows/:id
app.put('/api/workflows/:id', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ id: req.params.id });
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });
    const { name, is_active, input_schema, steps, rules } = req.body;
    if (name !== undefined) wf.name = name;
    if (is_active !== undefined) wf.is_active = is_active;
    if (input_schema !== undefined) wf.input_schema = input_schema;
    if (steps !== undefined) {
      wf.steps = steps.map(s => ({ ...s, id: s.id || 'step-' + uuidv4().slice(0, 8) }));
      wf.start_step_id = steps[0]?.id || wf.start_step_id;
    }
    if (rules !== undefined) {
      wf.rules = rules.map(r => ({ ...r, id: r.id || 'r-' + uuidv4().slice(0, 8) }));
    }
    wf.version += 1;
    wf.updated_at = new Date();
    await wf.save();
    res.json(wf.toObject());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/workflows/:id
app.delete('/api/workflows/:id', async (req, res) => {
  try {
    const result = await Workflow.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Workflow not found' });
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// STEP ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/workflows/:id/steps
app.post('/api/workflows/:id/steps', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ id: req.params.id });
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });
    const step = { id: 'step-' + uuidv4().slice(0, 8), workflow_id: wf.id, ...req.body };
    wf.steps.push(step);
    if (!wf.start_step_id) wf.start_step_id = step.id;
    await wf.save();
    res.status(201).json(step);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/workflows/:id/steps
app.get('/api/workflows/:id/steps', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ id: req.params.id }).lean();
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });
    res.json(wf.steps);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/steps/:id
app.put('/api/steps/:id', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ 'steps.id': req.params.id });
    if (!wf) return res.status(404).json({ error: 'Step not found' });
    const step = wf.steps.find(s => s.id === req.params.id);
    Object.assign(step, req.body, { updated_at: new Date() });
    await wf.save();
    res.json(step);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/steps/:id
app.delete('/api/steps/:id', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ 'steps.id': req.params.id });
    if (!wf) return res.status(404).json({ error: 'Step not found' });
    wf.steps = wf.steps.filter(s => s.id !== req.params.id);
    wf.rules = wf.rules.filter(r => r.step_id !== req.params.id && r.next_step_id !== req.params.id);
    await wf.save();
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// RULE ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/steps/:stepId/rules
app.post('/api/steps/:stepId/rules', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ 'steps.id': req.params.stepId });
    if (!wf) return res.status(404).json({ error: 'Step not found' });
    const rule = { id: 'r-' + uuidv4().slice(0, 8), step_id: req.params.stepId, ...req.body };
    wf.rules.push(rule);
    await wf.save();
    res.status(201).json(rule);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/steps/:stepId/rules
app.get('/api/steps/:stepId/rules', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ 'steps.id': req.params.stepId }).lean();
    if (!wf) return res.status(404).json({ error: 'Step not found' });
    res.json(wf.rules.filter(r => r.step_id === req.params.stepId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rules/:id
app.put('/api/rules/:id', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ 'rules.id': req.params.id });
    if (!wf) return res.status(404).json({ error: 'Rule not found' });
    const rule = wf.rules.find(r => r.id === req.params.id);
    Object.assign(rule, req.body, { updated_at: new Date() });
    await wf.save();
    res.json(rule);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rules/:id
app.delete('/api/rules/:id', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ 'rules.id': req.params.id });
    if (!wf) return res.status(404).json({ error: 'Rule not found' });
    wf.rules = wf.rules.filter(r => r.id !== req.params.id);
    await wf.save();
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// EXECUTION ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/workflows/:id/execute
app.post('/api/workflows/:id/execute', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ id: req.params.id }).lean();
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });
    if (!wf.is_active) return res.status(400).json({ error: 'Workflow is not active' });

    const { status, logs } = runWorkflow(wf, req.body.data || {});
    const exec = new Execution({
      workflow_id: wf.id,
      workflow_version: wf.version,
      status,
      data: req.body.data || {},
      logs,
      triggered_by: req.body.triggered_by || 'api_user',
      started_at: new Date(),
      ended_at: new Date()
    });
    await exec.save();
    res.status(201).json(exec.toObject());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/executions
app.get('/api/executions', async (req, res) => {
  try {
    const { workflow_id, status } = req.query;
    const query = {};
    if (workflow_id) query.workflow_id = workflow_id;
    if (status) query.status = status;
    const data = await Execution.find(query).sort({ started_at: -1 }).lean();
    res.json({ data, total: data.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/executions/:id
app.get('/api/executions/:id', async (req, res) => {
  try {
    const exec = await Execution.findOne({ id: req.params.id }).lean()
      || await Execution.findById(req.params.id).lean();
    if (!exec) return res.status(404).json({ error: 'Execution not found' });
    res.json(exec);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/executions/:id/cancel
app.post('/api/executions/:id/cancel', async (req, res) => {
  try {
    const exec = await Execution.findOne({ id: req.params.id });
    if (!exec) return res.status(404).json({ error: 'Not found' });
    if (!['pending', 'in_progress'].includes(exec.status))
      return res.status(400).json({ error: 'Can only cancel pending/in_progress executions' });
    exec.status = 'cancelled';
    exec.ended_at = new Date();
    await exec.save();
    res.json(exec.toObject());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/executions/:id/retry
app.post('/api/executions/:id/retry', async (req, res) => {
  try {
    const exec = await Execution.findOne({ id: req.params.id });
    if (!exec) return res.status(404).json({ error: 'Not found' });
    if (exec.status !== 'failed') return res.status(400).json({ error: 'Only failed executions can be retried' });
    const failedLog = exec.logs.find(l => l.status === 'failed');
    if (failedLog) { failedLog.status = 'completed'; failedLog.error_message = undefined; }
    exec.status = 'completed';
    exec.retries += 1;
    exec.ended_at = new Date();
    await exec.save();
    res.json(exec.toObject());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  uptime: process.uptime()
}));

// ── Static pages ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
mongoose.connection.once('open', async () => {
  await seedIfEmpty();
  app.listen(PORT, () => console.log(`🚀 Workflow Engine running at http://localhost:${PORT}`));
});
