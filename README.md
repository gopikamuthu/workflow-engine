# Workflow Engine

A full-stack workflow automation engine with a Node.js REST API and a plain HTML/JS frontend.

---

## Project Structure

```
workflow-engine/
├── backend/
│   ├── server.js        ← Express API server
│   └── package.json
└── frontend/
    └── public/
        └── index.html   ← Full UI (open directly in browser)
```

---

## Setup & Run

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Start the API server

```bash
npm start
```

Server runs at: **http://localhost:3000**

### 3. Open the frontend

Open `frontend/public/index.html` directly in your browser.
*(The frontend auto-connects to the API at http://localhost:3000)*

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /workflows | List workflows (search, pagination) |
| POST | /workflows | Create workflow |
| GET | /workflows/:id | Get workflow with steps & rules |
| PUT | /workflows/:id | Update workflow (bumps version) |
| DELETE | /workflows/:id | Delete workflow |
| POST | /workflows/:id/steps | Add step |
| GET | /workflows/:id/steps | List steps |
| PUT | /steps/:id | Update step |
| DELETE | /steps/:id | Delete step |
| POST | /steps/:step_id/rules | Add rule |
| GET | /steps/:step_id/rules | List rules |
| PUT | /rules/:id | Update rule |
| DELETE | /rules/:id | Delete rule |
| POST | /workflows/:id/execute | **Run workflow** |
| GET | /executions | List executions |
| GET | /executions/:id | Get execution status & logs |
| POST | /executions/:id/cancel | Cancel execution |
| POST | /executions/:id/retry | Retry failed step |
| GET | /health | Health check |

---

## Rule Engine

Rules are evaluated in **priority order** (lowest number = highest priority).

### Supported operators:
- **Comparison:** `==` `!=` `<` `>` `<=` `>=`
- **Logical:** `&&` (AND) `||` (OR)
- **String:** `contains(field, "value")`, `startsWith(...)`, `endsWith(...)`
- **Fallback:** `DEFAULT` — always matches (use as last rule)

### Example Rules for "Manager Approval" step:

| Priority | Condition | Next Step |
|----------|-----------|-----------|
| 1 | `amount > 100 && country == "US" && priority == "High"` | CEO Approval |
| 2 | `amount <= 100` | Finance Notification |
| 3 | `priority == "Low" && country != "US"` | Task Rejection |
| 4 | `DEFAULT` | Task Rejection |

---

## Sample Execution

```bash
curl -X POST http://localhost:3000/workflows/wf-001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "amount": 250,
      "country": "US",
      "department": "Finance",
      "priority": "High"
    },
    "triggered_by": "user123"
  }'
```

Expected path: **Manager Approval → CEO Approval → End**

---

## Notes

- Data is stored **in-memory** — restarting the server resets it.
- To persist data, replace the `db` object in `server.js` with a database (SQLite, PostgreSQL, etc.).
- The frontend works standalone or served via the Express static middleware.
