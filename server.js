const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Configuration ─────────────────────────────────────────────────────────────
const MAX_RETRIES = 3; // Maximum number of retry attempts allowed
const RETRY_DELAY_MS = 1000; // Delay before retry (ms)

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
    },
    {
      id: 'wf-003', name: 'Support Ticket Routing', version: 1, is_active: true,
      input_schema: [
        { field: 'email',       type: 'string', required: true,  allowed_values: [] },
        { field: 'category',    type: 'string', required: true,  allowed_values: ['Billing','Technical','General'] },
        { field: 'severity',    type: 'string', required: true,  allowed_values: ['Critical','High','Normal','Low'] },
        { field: 'description', type: 'string', required: false, allowed_values: [] }
      ],
      start_step_id: 'step-100',
      steps: [
        { id: 'step-100', workflow_id: 'wf-003', name: 'Ticket Classification',    step_type: 'task',         order: 1, metadata: {} },
        { id: 'step-101', workflow_id: 'wf-003', name: 'Admin Escalation',         step_type: 'approval',     order: 2, metadata: { assignee_email: 'admin@support.com' } },
        { id: 'step-102', workflow_id: 'wf-003', name: 'Technical Team Routing',   step_type: 'task',         order: 3, metadata: { team: 'engineering' } },
        { id: 'step-103', workflow_id: 'wf-003', name: 'Billing Team Routing',     step_type: 'task',         order: 4, metadata: { team: 'billing' } },
        { id: 'step-104', workflow_id: 'wf-003', name: 'Support Response',         step_type: 'notification', order: 5, metadata: { notification_channel: 'email' } },
        { id: 'step-105', workflow_id: 'wf-003', name: 'Close Ticket',             step_type: 'task',         order: 6, metadata: {} }
      ],
      rules: [
        { id: 'r-100', step_id: 'step-100', priority: 1, condition: 'contains(category, "Technical") && severity == "Critical"', next_step_id: 'step-101' },
        { id: 'r-101', step_id: 'step-100', priority: 2, condition: 'contains(category, "Technical")', next_step_id: 'step-102' },
        { id: 'r-102', step_id: 'step-100', priority: 3, condition: 'contains(category, "Billing")', next_step_id: 'step-103' },
        { id: 'r-103', step_id: 'step-100', priority: 4, condition: 'DEFAULT', next_step_id: 'step-104' },
        { id: 'r-104', step_id: 'step-102', priority: 1, condition: 'startsWith(email, "admin")', next_step_id: 'step-101' },
        { id: 'r-105', step_id: 'step-102', priority: 2, condition: 'DEFAULT', next_step_id: 'step-104' },
        { id: 'r-106', step_id: 'step-103', priority: 1, condition: 'DEFAULT', next_step_id: 'step-104' },
        { id: 'r-107', step_id: 'step-101', priority: 1, condition: 'DEFAULT', next_step_id: 'step-104' },
        { id: 'r-108', step_id: 'step-104', priority: 1, condition: 'endsWith(email, "@admin.local")', next_step_id: 'step-105' },
        { id: 'r-109', step_id: 'step-104', priority: 2, condition: 'DEFAULT', next_step_id: 'step-105' }
      ]
    }
  ]);
  console.log('🌱 Seeded initial workflows');
}

// ── Rule Engine ───────────────────────────────────────────────────────────────
/**
 * Evaluates a rule condition against input data
 * Supports: comparison (==, !=, <, >, <=, >=), logical (&&, ||), string functions (contains, startsWith, endsWith)
 * @param {string} condition - The rule condition expression
 * @param {object} data - Input data to evaluate against
 * @returns {boolean} - Whether the condition evaluates to true
 */
function evaluateCondition(condition, data) {
  // DEFAULT is a special fallback rule that always matches
  if (condition === 'DEFAULT') return true;
  
  try {
    let expr = condition;
    
    // Step 1: Handle string function calls (contains, startsWith, endsWith)
    // These need to be converted to JavaScript method calls before variable substitution
    expr = expr.replace(/contains\s*\(\s*(\w+)\s*,\s*"([^"]*)"\s*\)/g, 
      (match, field, value) => {
        // Escape special regex characters in value
        const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return `(String(${field}).includes("${escapedValue}"))`;
      }
    );
    
    expr = expr.replace(/startsWith\s*\(\s*(\w+)\s*,\s*"([^"]*)"\s*\)/g,
      (match, field, value) => {
        const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return `(String(${field}).startsWith("${escapedValue}"))`;
      }
    );
    
    expr = expr.replace(/endsWith\s*\(\s*(\w+)\s*,\s*"([^"]*)"\s*\)/g,
      (match, field, value) => {
        const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return `(String(${field}).endsWith("${escapedValue}"))`;
      }
    );
    
    // Step 2: Replace variable references with their actual values
    Object.keys(data).forEach(key => {
      const val = data[key];
      // Only replace whole words to avoid partial matches
      expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), 
        typeof val === 'string' ? `"${val}"` : val);
    });
    
    // Step 3: Evaluate the expression safely
    return Function('"use strict"; return (' + expr + ')')();
  } catch (error) {
    // Log the error for debugging purposes
    console.error(`Rule evaluation error: ${error.message} | Condition: ${condition} | Data:`, data);
    return false;
  }
}

/**
 * Executes a workflow by traversing steps and evaluating rules
 * @param {object} workflow - The workflow definition with steps and rules
 * @param {object} inputData - Input data provided for the execution
 * @returns {object} - { logs: [], status: 'completed'|'failed', ... }
 */
function runWorkflow(workflow, inputData) {
  const logs = [];
  let currentStepId = workflow.start_step_id;
  let status = 'completed';
  let iter = 0;
  const MAX_ITERATIONS = 50; // Prevent infinite loops in workflow execution

  while (currentStepId && iter < MAX_ITERATIONS) {
    iter++;
    
    // Find the current step definition
    const step = workflow.steps.find(s => s.id === currentStepId);
    if (!step) { 
      status = 'failed'; 
      break; 
    }

    // Get all rules for this step, sorted by priority (lowest = highest)
    const stepRules = workflow.rules
      .filter(r => r.step_id === step.id)
      .sort((a, b) => a.priority - b.priority);

    const evaluatedRules = [];
    let matchedRule = null;

    // Evaluate each rule in priority order until one matches
    for (const rule of stepRules) {
      const result = evaluateCondition(rule.condition, inputData);
      evaluatedRules.push({ 
        rule: rule.condition, 
        result, 
        priority: rule.priority 
      });
      // First matching rule wins
      if (result && !matchedRule) matchedRule = rule;
    }

    // Determine next step from the matched rule
    const nextStep = matchedRule?.next_step_id
      ? workflow.steps.find(s => s.id === matchedRule.next_step_id)
      : null;

    // Create a log entry for this step execution
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
// WORKFLOW ROUTES - Complete CRUD operations for workflow management
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/workflows
 * List all workflows with pagination and search
 * Query params:
 *   - search (string): Search workflows by name (case-insensitive)
 *   - page (number): Page number for pagination (default: 1)
 *   - limit (number): Items per page (default: 10)
 */
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

/**
 * POST /api/workflows
 * Create a new workflow with name, input schema, steps, and rules
 * Body:
 *   - name (string, required): Workflow name
 *   - input_schema (array): Field definitions for input data
 *   - steps (array): Step definitions
 *   - rules (array): Conditional routing rules
 * Returns: Created workflow with auto-generated ID
 */
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
// EXECUTION ROUTES - Run workflows and track execution status
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/workflows/:id/execute
 * Execute a workflow with provided input data
 * Path: id (string): Workflow ID
 * Body:
 *   - data (object): Input data matching the workflow's input_schema
 *   - triggered_by (string, optional): User/system that triggered execution
 * Returns: Execution object with status and logs
 * Validates: Workflow exists, is active, and data matches schema
 */
app.post('/api/workflows/:id/execute', async (req, res) => {
  try {
    const wf = await Workflow.findOne({ id: req.params.id }).lean();
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });
    if (!wf.is_active) return res.status(400).json({ error: 'Workflow is not active' });

    // Input validation: Check required fields against schema
    const inputData = req.body.data || {};
    for (const field of wf.input_schema) {
      if (field.required && (inputData[field.field] === undefined || inputData[field.field] === null)) {
        return res.status(400).json({ 
          error: `Missing required field: ${field.field}`,
          field: field.field
        });
      }
      // Validate against allowed values if specified
      if (field.allowed_values?.length > 0 && inputData[field.field]) {
        if (!field.allowed_values.includes(String(inputData[field.field]))) {
          return res.status(400).json({
            error: `Invalid value for ${field.field}. Allowed: ${field.allowed_values.join(', ')}`,
            field: field.field,
            allowed_values: field.allowed_values
          });
        }
      }
    }

    // ✨ NEW: Record start time BEFORE execution
    const started_at = new Date();
    console.log(' Execution started at:', started_at);
 

    // Execute the workflow with validated data
    const { status, logs } = runWorkflow(wf, inputData);
    
    // ✨ NEW: Record end time AFTER execution
    const ended_at = new Date();
    console.log(' Execution ended at:', ended_at);
    console.log(' Duration:', ended_at - started_at, 'ms');

    const exec = new Execution({
      workflow_id: wf.id,
      workflow_version: wf.version,
      status,
      data: inputData,
      logs,
      triggered_by: req.body.triggered_by || 'api_user',
      started_at: started_at,   // ✨ Now different!
      ended_at: ended_at        // ✨ Now different!
    });
    
    await exec.save();
    
    // ✨ NEW: Response with timing info
    res.status(201).json(exec.toObject());
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
});

/**
 * GET /api/executions
 * List all executions with filtering by workflow_id and status
 * Query params:
 *   - workflow_id (string, optional): Filter by workflow ID
 *   - status (string, optional): Filter by status (completed, failed, pending, in_progress, cancelled)
 * Returns: Array of executions sorted by start time (newest first)
 */
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

/**
 * GET /api/executions/:id
 * Get detailed execution record including all step logs
 * Path: id (string): Execution ID
 * Returns: Complete execution object with status, logs, and evaluated rules
 */
app.get('/api/executions/:id', async (req, res) => {
  try {
    const exec = await Execution.findOne({ id: req.params.id }).lean()
      || await Execution.findById(req.params.id).lean();
    if (!exec) return res.status(404).json({ error: 'Execution not found' });
    res.json(exec);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/executions/:id/cancel
 * Cancel a pending or in-progress execution
 * Path: id (string): Execution ID
 * Returns: Updated execution with status='cancelled'
 * Errors: Only pending/in_progress executions can be cancelled
 */
app.post('/api/executions/:id/cancel', async (req, res) => {
  try {
    const exec = await Execution.findOne({ id: req.params.id });
    if (!exec) return res.status(404).json({ error: 'Execution not found' });
    if (!['pending', 'in_progress'].includes(exec.status))
      return res.status(400).json({ error: 'Can only cancel pending/in_progress executions' });
    exec.status = 'cancelled';
    exec.ended_at = new Date();
    await exec.save();
    res.json(exec.toObject());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/executions/:id/retry
/**
 * Retry a failed execution
 * Only allows up to MAX_RETRIES attempts to prevent infinite loops
 * Re-executes the failed step from where it left off
 */
app.post('/api/executions/:id/retry', async (req, res) => {
  try {
    const exec = await Execution.findOne({ id: req.params.id });
    if (!exec) return res.status(404).json({ error: 'Execution not found' });
    
    // Only failed executions can be retried
    if (exec.status !== 'failed') {
      return res.status(400).json({ 
        error: 'Only failed executions can be retried',
        current_status: exec.status 
      });
    }
    
    // Check if max retries exceeded
    if (exec.retries >= MAX_RETRIES) {
      return res.status(400).json({
        error: `Max retries (${MAX_RETRIES}) exceeded`,
        retries_used: exec.retries,
        max_retries: MAX_RETRIES
      });
    }
    
    // Find the failed step in logs and mark it for retry
    const failedLog = exec.logs.find(l => l.status === 'failed');
    if (failedLog) {
      // Clear the error and mark as retrying
      failedLog.status = 'retrying';
      failedLog.error_message = `Retry attempt ${exec.retries + 1}/${MAX_RETRIES}`;
    }
    
    // Update execution state
    exec.status = 'in_progress';
    exec.retries += 1;
    exec.current_step_id = failedLog ? failedLog.step_name : exec.current_step_id;
    
    await exec.save();
    
    res.json({
      ...exec.toObject(),
      message: `Retrying execution (attempt ${exec.retries}/${MAX_RETRIES})`
    });
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
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
