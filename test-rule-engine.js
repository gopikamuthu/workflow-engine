/**
 * Rule Engine Test Suite
 * Tests the evaluateCondition function with various operators
 */

// Copy the evaluateCondition function for testing
function evaluateCondition(condition, data) {
  if (condition === 'DEFAULT') return true;
  
  try {
    let expr = condition;
    
    // Step 1: Handle string function calls (contains, startsWith, endsWith)
    expr = expr.replace(/contains\s*\(\s*(\w+)\s*,\s*"([^"]*)"\s*\)/g, 
      (match, field, value) => {
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
      expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), 
        typeof val === 'string' ? `"${val}"` : val);
    });
    
    // Step 3: Evaluate the expression safely
    return Function('"use strict"; return (' + expr + ')')();
  } catch (error) {
    console.error(`Rule evaluation error: ${error.message} | Condition: ${condition}`);
    return false;
  }
}

// Test cases
const tests = [
  // Comparison operators
  {
    name: 'Comparison: amount > 100',
    condition: 'amount > 100',
    data: { amount: 250 },
    expected: true
  },
  {
    name: 'Comparison: amount <= 100',
    condition: 'amount <= 100',
    data: { amount: 50 },
    expected: true
  },
  {
    name: 'Comparison: country == "US"',
    condition: 'country == "US"',
    data: { country: 'US' },
    expected: true
  },
  
  // Logical operators
  {
    name: 'Logical: AND operator',
    condition: 'amount > 100 && country == "US"',
    data: { amount: 250, country: 'US' },
    expected: true
  },
  {
    name: 'Logical: AND operator (false)',
    condition: 'amount > 100 && country == "US"',
    data: { amount: 50, country: 'US' },
    expected: false
  },
  {
    name: 'Logical: OR operator',
    condition: 'amount > 100 || country == "IN"',
    data: { amount: 50, country: 'IN' },
    expected: true
  },
  
  // STRING OPERATORS (NEW!)
  {
    name: '✨ NEW: contains() - Match',
    condition: 'contains(department, "Eng")',
    data: { department: 'Engineering' },
    expected: true
  },
  {
    name: '✨ NEW: contains() - No Match',
    condition: 'contains(department, "Sales")',
    data: { department: 'Engineering' },
    expected: false
  },
  {
    name: '✨ NEW: startsWith() - Match',
    condition: 'startsWith(email, "admin")',
    data: { email: 'admin@example.com' },
    expected: true
  },
  {
    name: '✨ NEW: startsWith() - No Match',
    condition: 'startsWith(email, "user")',
    data: { email: 'admin@example.com' },
    expected: false
  },
  {
    name: '✨ NEW: endsWith() - Match',
    condition: 'endsWith(domain, ".com")',
    data: { domain: 'example.com' },
    expected: true
  },
  {
    name: '✨ NEW: endsWith() - No Match',
    condition: 'endsWith(domain, ".org")',
    data: { domain: 'example.com' },
    expected: false
  },
  
  // Complex combinations
  {
    name: 'Complex: Comparison + String operator',
    condition: 'amount > 100 && contains(department, "Finance")',
    data: { amount: 250, department: 'Finance' },
    expected: true
  },
  {
    name: 'Complex: Multiple string operators',
    condition: 'startsWith(email, "admin") && endsWith(email, ".com")',
    data: { email: 'admin@example.com' },
    expected: true
  },
  {
    name: 'Complex: Full workflow rule',
    condition: 'amount > 100 && country == "US" && priority == "High"',
    data: { amount: 250, country: 'US', priority: 'High' },
    expected: true
  },
  
  // DEFAULT fallback
  {
    name: 'DEFAULT rule',
    condition: 'DEFAULT',
    data: { any: 'data' },
    expected: true
  }
];

// Run tests
console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║           RULE ENGINE TEST SUITE - String Operators                ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  const result = evaluateCondition(test.condition, test.data);
  const testPassed = result === test.expected;
  
  if (testPassed) {
    passed++;
    console.log(`✅ PASS: ${test.name}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${test.name}`);
    console.log(`   Condition: ${test.condition}`);
    console.log(`   Data: ${JSON.stringify(test.data)}`);
    console.log(`   Expected: ${test.expected}, Got: ${result}`);
  }
});

console.log(`\n╔════════════════════════════════════════════════════════════════════╗`);
console.log(`║ RESULTS: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
console.log(`║ Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
console.log(`╚════════════════════════════════════════════════════════════════════╝`);

process.exit(failed > 0 ? 1 : 0);
