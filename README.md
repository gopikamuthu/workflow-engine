# Workflow Engine ✨

A production-ready full-stack workflow automation engine with advanced rule engine, comprehensive testing, and complete documentation.

## 🚀 Live Demo

👉 https://workflow-engine-l77i.onrender.com

## Features

- **Node.js/Express REST API** with comprehensive documentation
- **MongoDB persistence** with Mongoose ORM
- **Advanced rule engine** with string operators (`contains`, `startsWith`, `endsWith`)
- **Input validation** with helpful error messages
- **Retry management** with configurable max limits (MAX_RETRIES = 3)
- **Plain HTML/JS frontend** for workflow management
- **100% test coverage** for rule engine (16/16 tests passing)
- **Execution timing** - Tracks START, END, and DURATION for each workflow execution
- **Complete documentation** with examples and API guides

## Project Structure

```
workflow-engine/
├── server.js                 # Main Express server with workflow logic
├── public/
│   ├── index.html           # Main UI for workflow management
│   └── landing.html         # Landing page
├── backend/
│   └── package.json         # Node.js dependencies
├── test-rule-engine.js      # Comprehensive test suite
├── package.json             # Project dependencies
├── .env                     # Environment configuration
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/gopikamuthu/workflow-engine.git
cd workflow-engine

# Install dependencies
npm install

# Create .env file
echo "MONGODB_URI=mongodb://localhost:27017/workflow-engine" > .env
echo "PORT=3000" >> .env

# Start the server
npm start
```

The application will run on `http://localhost:3000`

### Running Tests

```bash
# Run the complete test suite
node test-rule-engine.js

# Expected output:
# Test Suite Results:
# ✅ Test 1: Simple comparison operators (>, <, ==, !=) - PASSED
# ✅ Test 2: Logical operators (&&, ||) - PASSED
# ✅ Test 3: String operator: contains() - PASSED
# ✅ Test 4: String operator: startsWith() - PASSED
# ✅ Test 5: String operator: endsWith() - PASSED
# ... (16 tests total)
# Success Rate: 100.0% (16/16 tests passed)
```

## API Endpoints

### Workflows

#### Get All Workflows
```
GET /api/workflows
Response: { data: [workflow1, workflow2, ...] }
```

#### Get Single Workflow
```
GET /api/workflows/:id
Response: { data: workflow }
```

#### Create Workflow
```
POST /api/workflows
Body: {
  name: "Expense Approval",
  is_active: true,
  input_schema: [...],
  steps: [...],
  rules: [...]
}
Response: { data: createdWorkflow }
```

#### Update Workflow
```
PUT /api/workflows/:id
Body: { name, is_active, input_schema, steps, rules }
Response: { data: updatedWorkflow }
```

#### Delete Workflow
```
DELETE /api/workflows/:id
Response: { message: "Workflow deleted" }
```

### Executions

#### Execute Workflow
```
POST /api/workflows/:id/execute
Body: {
  data: { field1: "value1", field2: "value2" },
  triggered_by: "api_user"
}
Response: {
  id: "exec-xxx",
  workflow_id: "wf-001",
  status: "completed",
  started_at: "2026-03-20T10:05:50.186Z",
  ended_at: "2026-03-20T10:05:50.187Z",
  logs: [...]
}
```

#### Get All Executions
```
GET /api/executions
Response: { data: [execution1, execution2, ...] }
```

#### Get Single Execution
```
GET /api/executions/:id
Response: { data: execution }
```

#### Retry Execution
```
POST /api/executions/:id/retry
Response: { data: retriedExecution }
```

#### Cancel Execution
```
POST /api/executions/:id/cancel
Response: { data: cancelledExecution }
```

## Rule Engine

### Supported Operators

#### Comparison Operators
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal
- `==` - Equal
- `!=` - Not equal

#### Logical Operators
- `&&` - AND
- `||` - OR

#### String Operators
- `contains(field, "value")` - Check if string contains value
- `startsWith(field, "value")` - Check if string starts with value
- `endsWith(field, "value")` - Check if string ends with value

### Example Rules

```javascript
// Simple comparison
amount > 1000

// Logical operators
amount > 1000 && country == "US"

// String operators
description contains "urgent"

// Complex expressions
(amount > 500 && status == "pending") || (priority startsWith "HIGH")

// Default fallback
DEFAULT
```

## Input Validation

All workflow inputs are validated against the input schema. Each field can have:

- `field` - Field name (required)
- `type` - Data type: `string`, `number`, `boolean`
- `required` - Whether field is required (true/false)
- `allowed_values` - Array of allowed values for validation

### Example Schema

```javascript
input_schema: [
  {
    field: "amount",
    type: "number",
    required: true,
    allowed_values: []
  },
  {
    field: "status",
    type: "string",
    required: true,
    allowed_values: ["pending", "approved", "rejected"]
  }
]
```

## Retry Management

The engine includes built-in retry logic:

- **MAX_RETRIES**: 3 (configurable in server.js)
- **RETRY_DELAY_MS**: 1000 milliseconds (1 second)
- **Automatic retry** on failed executions
- **Manual retry** via API endpoint

### Retry Endpoint

```
POST /api/executions/:id/retry
```

The system will:
1. Check if retries < MAX_RETRIES
2. Create a new execution attempt
3. Re-run the workflow
4. Return the new execution details

## Execution Timing

Each execution tracks:
- **started_at** - Timestamp when execution began
- **ended_at** - Timestamp when execution completed
- **duration** - Calculated in seconds (ended_at - started_at)

This allows you to:
- Measure workflow performance
- Identify slow workflows
- Optimize rule evaluation
- Debug execution issues

### Example Execution

```json
{
  "id": "exec-d098d5b8",
  "workflow_id": "wf-001",
  "status": "completed",
  "started_at": "2026-03-20T10:05:50.186Z",
  "ended_at": "2026-03-20T10:05:50.187Z",
  "duration_ms": 1,
  "logs": [...]
}
```

## Sample Workflows

### 1. Expense Approval (wf-001)

**Purpose**: Approve expenses based on amount and category

**Steps**:
1. Receive Request
2. Validate Expense
3. Manager Review
4. Approval Decision
5. Notify Requester

**Rules**:
- If amount < 100 → Auto-approve
- If amount >= 100 && amount < 1000 → Manager review
- If amount >= 1000 → Director review
- DEFAULT → End workflow

### 2. Employee Onboarding (wf-002)

**Purpose**: Onboard new employees with automated steps

**Steps**:
1. Create Account
2. Send Credentials
3. IT Setup
4. HR Training
5. Welcome Package

**Rules**:
- If department == "IT" → Assign IT training
- If department == "Sales" → Assign sales training
- DEFAULT → Standard onboarding

### 3. Support Ticket Routing (wf-003)

**Purpose**: Route support tickets based on type and priority

**Steps**:
1. Receive Ticket
2. Analyze Issue
3. Route to Team
4. Assign Agent
5. Send Confirmation

**Rules**:
- If priority startsWith "CRITICAL" → Escalate immediately
- If category contains "billing" → Route to billing team
- If urgency == "high" && category == "technical" → Route to senior tech
- DEFAULT → Route to general support

## Frontend Usage

### Dashboard Features

- **Workflows Tab**: View, create, edit, and delete workflows
- **Execute Tab**: Live workflow execution with visual feedback
- **Executions Tab**: View all past executions and their details
- **Audit Log**: Complete history of all workflow executions

### Workflow Management

1. **Create Workflow**: Define name, input schema, steps, and rules
2. **Define Input Schema**: Specify required fields and validation
3. **Add Steps**: Create workflow steps (task, approval, notification)
4. **Set Rules**: Define routing rules based on conditions
5. **Execute**: Run workflow with sample data and see results

### Live Execution View

- Visual flow of workflow steps
- Real-time status updates
- Rule evaluation display
- Duration and performance metrics

## Database Schema

### Workflow Model

```javascript
{
  id: String,
  name: String,
  is_active: Boolean,
  version: Number,
  input_schema: Array,
  steps: Array,
  rules: Array,
  start_step_id: String,
  created_at: Date,
  updated_at: Date
}
```

### Execution Model

```javascript
{
  id: String,
  workflow_id: String,
  workflow_version: Number,
  status: String, // "completed" | "failed" | "pending"
  data: Object,
  logs: Array,
  triggered_by: String,
  started_at: Date,
  ended_at: Date,
  retries: Number,
  created_at: Date,
  updated_at: Date
}
```

## Testing

### Test Suite Overview

The project includes 16 comprehensive tests covering:

- **Comparison Operators** (3 tests)
  - Test greater than, less than, equality
  - Test logical combinations

- **Logical Operators** (3 tests)
  - Test AND (&&) logic
  - Test OR (||) logic
  - Test combined expressions

- **String Operators** (6 tests)
  - Test `contains()` function
  - Test `startsWith()` function
  - Test `endsWith()` function
  - Test case sensitivity
  - Test edge cases

- **Complex Combinations** (4 tests)
  - Test nested conditions
  - Test multiple operators
  - Test real-world scenarios

### Running Tests

```bash
node test-rule-engine.js
```

All 16 tests pass with 100% success rate.

## Configuration

### Environment Variables (.env)

```
MONGODB_URI=mongodb://localhost:27017/workflow-engine
PORT=3000
NODE_ENV=development
```

### Server Configuration (server.js)

```javascript
const MAX_RETRIES = 3;              // Maximum retry attempts
const RETRY_DELAY_MS = 1000;        // Delay between retries
const MAX_ITERATIONS = 50;          // Maximum loop iterations
```

## Error Handling

### Validation Errors

```json
{
  "error": "Validation failed",
  "details": {
    "amount": "Required field missing",
    "status": "Invalid value. Allowed: pending, approved, rejected"
  }
}
```

### Execution Errors

```json
{
  "error": "Execution failed",
  "message": "Rule evaluation error",
  "step": "step-001",
  "logs": [...]
}
```

### Retry Errors

```json
{
  "error": "Max retries exceeded",
  "execution_id": "exec-xxx",
  "retry_count": 3,
  "message": "Cannot retry this execution"
}
```

## Performance

- **Fast execution**: 1-10ms for typical workflows
- **Efficient rule engine**: Optimized for quick evaluation
- **Scalable architecture**: Handles high-volume executions
- **Indexed database**: Fast lookups and queries

## Production Deployment

### Before Deployment

1. ✅ Set NODE_ENV=production
2. ✅ Configure MongoDB Atlas or production database
3. ✅ Set secure environment variables
4. ✅ Run full test suite
5. ✅ Review security settings
6. ✅ Enable CORS for frontend domain
7. ✅ Set up monitoring and logging

### Deployment Steps

```bash
# Install dependencies
npm install

# Run tests
node test-rule-engine.js

# Start server
NODE_ENV=production npm start
```

## Troubleshooting

### Port Already in Use

```bash
# Use different port
PORT=3001 npm start
```

### MongoDB Connection Error

- Verify MongoDB is running
- Check MONGODB_URI in .env
- Ensure database is accessible

### Tests Failing

```bash
# Clear data and retry
# Delete MongoDB database and restart

node test-rule-engine.js
```

## Development

### Code Structure

- **Rule Evaluation**: `evaluateCondition()` function
- **Workflow Execution**: `runWorkflow()` function
- **API Routes**: Express route handlers
- **Data Models**: Mongoose schemas

### Adding New Features

1. Define the feature in a step function
2. Add tests for the feature
3. Update API endpoints
4. Update frontend components
5. Document in README

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or suggestions:
1. Check existing documentation
2. Review test cases for examples
3. Check server console for error messages
4. Review browser console for frontend errors

## Contributors

- Gopikanuthu (Original creator)
- Contributors welcome!

## Changelog

### Version 2.0
- ✅ Added execution timing (START, END, DURATION)
- ✅ Added string operators (contains, startsWith, endsWith)
- ✅ Added max retry limit with configuration
- ✅ Enhanced input validation with detailed error messages
- ✅ Created comprehensive test suite (16 tests, 100% passing)
- ✅ Added complete documentation
- ✅ Improved frontend UI
- ✅ Added sample workflows

### Version 1.0
- Initial release with basic workflow engine
- Rule-based routing
- MongoDB persistence
- Express REST API

## Getting Help

- Review the test suite: `test-rule-engine.js`
- Check API documentation above
- Review sample workflows
- Check browser console for frontend issues
- Check server console for backend issues

---

**Made with ❤️ | Workflow Engine v2.0 | Production Ready**
