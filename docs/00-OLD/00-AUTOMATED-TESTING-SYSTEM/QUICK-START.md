# Quick Start - Automated Testing System (Cursor AI Reference)

## 🎯 READ THIS FIRST

**Before running or fixing tests, ALWAYS read:**

1. **This file (QUICK-START.md)** - How to execute and read test results
2. **APP-TESTING-CONTEXT.md** - Critical app behavior and testing quirks

The APP-TESTING-CONTEXT file contains essential knowledge about:
- How app features actually work (vs what tests expect)
- Known quirks (hydration issues, timing, localStorage behavior)
- Why certain tests fail (and if that's expected)
- App-specific testing patterns

**Workflow:**
```
1. User asks to run tests
2. Read APP-TESTING-CONTEXT.md first ← CRITICAL
3. Execute tests
4. Read results.json via MCP
5. Analyze failures using context from step 2
6. Propose fixes (test adjustments or app changes)
7. Update APP-TESTING-CONTEXT.md with new learnings
```

---

## System Overview

**Stack**: Playwright + Puppeteer MCP + Cursor AI + GitHub Actions
**Location**: `/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant`
**Framework**: Next.js 14 + React + TypeScript + Cloudflare Pages
**Tests**: 15 tests across 4 files in `tests/` directory
**Browser**: Chromium (Chrome desktop) @ 1920x1080

---

## MCP Setup Status

### Current Configuration
Location: `/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/.cursor-mcp-config.json`

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@executeautomation/puppeteer-mcp-server"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant"
      ]
    }
  }
}
```

### User Action Required
User needs to add above config to Cursor settings:
1. `Cmd + Shift + P` → "Preferences: Open User Settings (JSON)"
2. Add `mcpServers` section from above
3. Restart Cursor
4. Verify with: "Are the MCP servers connected?"

### MCP Setup Helper
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
node scripts/setup-mcp.js
```

---

## Test Execution Commands

### Working Directory
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
```

### Primary Commands
```bash
# Interactive UI mode (BEST for user feedback)
npm run test:ui

# Headless run (for automation)
npm run test

# Debug mode (step through)
npm run test:debug

# Headed mode (visible browser)
npm run test:headed

# View HTML report
npm run test:report

# Generate test code by recording
npm run test:codegen http://localhost:3000

# Run specific test file
npm run test tests/smoke.spec.ts

# Run tests matching pattern
npm run test --grep "video"
```

### Test Files Structure
```
tests/
├── smoke.spec.ts              # 3 tests: app loading, console errors, responsive
├── video-player.spec.ts       # 3 tests: toggle, localStorage, aspect ratio
├── comments-stream.spec.ts    # 5 tests: display, input, filters, scroll
└── color-system.spec.ts       # 4 tests: assignment, picker, persistence, events
```

---

## 🔑 CRITICAL: Reading Playwright Results via MCP Filesystem

### DO NOT Rely on Screenshots from User

**YOU HAVE DIRECT ACCESS TO TEST RESULTS!** Use the filesystem MCP to read:

1. **Test Results JSON** (Most Important)
2. **Screenshots** (on failures)
3. **Videos** (on failures)
4. **Error Context** (detailed markdown)
5. **Trace files** (for deep debugging)

### How to Read Test Results

#### Step 1: Read the JSON Results File
```typescript
// Use this MCP tool:
mcp_filesystem-saywhatwant_read_text_file(
  path: "/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/test-results/results.json"
)
```

**This gives you:**
- Pass/fail status for every test
- Error messages and stack traces
- Exact line numbers of failures
- Duration of each test
- Paths to screenshots/videos/traces

#### Step 2: Check What Test Artifacts Exist
```typescript
// List test results directory:
mcp_filesystem-saywhatwant_list_directory(
  path: "/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/test-results"
)
```

#### Step 3: Read Specific Error Context
```typescript
// For failed tests, read the error-context.md:
mcp_filesystem-saywhatwant_read_text_file(
  path: "/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/test-results/[test-name]/error-context.md"
)
```

#### Step 4: Read Screenshots (if needed)
```typescript
// Screenshots are PNG files - you can read them:
mcp_filesystem-saywhatwant_read_media_file(
  path: "/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/test-results/[test-name]/test-failed-1.png"
)
```

### Test Results JSON Structure

**Key fields to look for:**

```json
{
  "stats": {
    "expected": 10,      // Passed tests
    "unexpected": 5,     // Failed tests
    "skipped": 0,        // Skipped tests
    "flaky": 0          // Flaky tests
  },
  "suites": [
    {
      "title": "color-system.spec.ts",
      "suites": [
        {
          "specs": [
            {
              "title": "user is assigned a random color on first visit",
              "ok": false,  // ❌ Failed
              "tests": [{
                "status": "unexpected",
                "results": [{
                  "status": "failed",
                  "error": {
                    "message": "expect(received).toBeTruthy()\n\nReceived: null",
                    "location": {
                      "file": "tests/color-system.spec.ts",
                      "line": 20,
                      "column": 23
                    }
                  },
                  "attachments": [
                    {
                      "name": "screenshot",
                      "path": "/path/to/screenshot.png"
                    },
                    {
                      "name": "video",
                      "path": "/path/to/video.webm"
                    }
                  ]
                }]
              }]
            }
          ]
        }
      ]
    }
  ]
}
```

### Workflow for Test Analysis

**DO THIS automatically after tests run:**

1. **Read results.json**
   ```typescript
   const results = mcp_filesystem-saywhatwant_read_text_file(
     "/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/test-results/results.json"
   );
   ```

2. **Parse the stats**
   - `stats.expected` = passed tests
   - `stats.unexpected` = failed tests
   - Report: "X/15 tests passed (Y%)"

3. **Find all failed tests**
   - Look for `"ok": false` in specs
   - Extract test titles and error messages

4. **Analyze each failure**
   - Read `error.message` for what failed
   - Read `error.location` for where it failed
   - Check `attachments` for screenshot/video paths

5. **Read error context if needed**
   - Each failed test has an `error-context.md` file
   - Contains full error details + context

6. **View screenshots only if necessary**
   - Use `read_media_file` for PNG screenshots
   - Only do this if error message isn't clear

### Common Failure Patterns

**Pattern 1: Element Not Found**
```json
"error": {
  "message": "expect(locator).toBeVisible() failed"
}
```
→ Selector is wrong or element doesn't exist

**Pattern 2: localStorage is null**
```json
"error": {
  "message": "expect(received).toBeTruthy()\nReceived: null"
}
```
→ localStorage item not set or cleared incorrectly

**Pattern 3: Console Errors**
```json
"error": {
  "message": "expect(criticalErrors).toHaveLength(0)\nReceived length: 1"
}
```
→ App has console errors (often React hydration issues)

**Pattern 4: Timing Issues**
```json
"error": {
  "message": "expect(locator).toHaveCSS() failed\nTimeout: 5000ms"
}
```
→ Element not ready or animation not complete

### DO NOT Ask User for Screenshots

**❌ BAD:**
"Can you send me a screenshot of the Playwright UI?"

**✅ GOOD:**
```typescript
// Read results automatically
const results = mcp_filesystem-saywhatwant_read_text_file(
  "/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/test-results/results.json"
);
// Parse and analyze
// Report findings
```

### Reporting Test Results to User

**Template:**
```
📊 Test Results: X/15 Passed (Y%)

✅ Passing Tests (X):
1. Test name
2. Test name
...

❌ Failing Tests (Y):

**1. Test Name**
- Problem: <error message>
- Location: tests/file.spec.ts:line:column
- Why: <root cause analysis>
- Screenshot: test-results/[path] (if relevant)

**2. Test Name**
...

🎯 Root Cause: <overall analysis>
```

---

## When User Asks to Run Tests

### Standard Flow
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
npm run test
```

**Then**:
1. Parse output for pass/fail counts
2. Identify failing tests
3. Read test files if needed
4. Propose fixes
5. Apply fixes
6. Re-run tests

### With UI Mode (When User Wants to See)
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
npm run test:ui
```

This opens interactive UI - tell user to:
- Click "Run all" or individual tests
- Watch execution
- View screenshots/videos on failures

---

## Test Failure Analysis

### Read Test Results
```bash
# JSON results
cat /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/test-results/results.json

# HTML report (if exists)
open /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/playwright-report/index.html
```

### Common Failure Patterns

**Element Not Found**
- Selector changed
- Timing issue (need waitForSelector)
- Element not visible

**Timeout**
- Page load slow
- waitForTimeout too short
- Network request hanging

**Console Errors**
- Check test output
- May be acceptable (favicon, etc.)
- Filter in test if needed

**Visual/Layout Issues**
- Screenshot saved to test-results/
- Compare expected vs actual
- Update test or fix code

---

## Test Creation Workflow

### Generate Test Code
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
npm run test:codegen http://localhost:3000
```

This opens browser - record actions:
1. User performs actions
2. Playwright generates code
3. Copy code to new test file
4. Refine and add assertions

### Test Template
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    const element = page.getByRole('button', { name: /text/i });
    
    // Act
    await element.click();
    
    // Assert
    await expect(page.getByText('Result')).toBeVisible();
  });
});
```

---

## Using Puppeteer MCP (Once Configured)

### Browser Control Commands

**Navigate & Inspect**
```
Use puppeteer to open http://localhost:3000 and take a screenshot
Use puppeteer to navigate to the app and check for console errors
Use puppeteer to scroll to the bottom of the page
```

**Interaction**
```
Use puppeteer to click the video toggle button
Use puppeteer to fill the comment input with "test"
Use puppeteer to select the color picker and change color
```

**Multi-Step Flow**
```
Use puppeteer to:
1. Open localhost:3000
2. Click video toggle
3. Wait 1 second
4. Take screenshot
5. Click color picker
6. Select first color option
7. Take another screenshot
```

**Debugging**
```
Use puppeteer to open the app and capture all console messages
Use puppeteer to monitor network requests while clicking the submit button
Use puppeteer to check localStorage values after color change
```

---

## Fixing Test Failures

### Step-by-Step Process

1. **Identify Failure**
   - Run: `npm run test`
   - Parse output
   - Note which test failed and why

2. **Read Test File**
   ```bash
   cat /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/tests/[test-file].spec.ts
   ```

3. **Analyze Root Cause**
   - Code changed?
   - Selector changed?
   - Timing issue?
   - Logic bug?

4. **Propose Fix**
   - If test needs updating: modify test file
   - If code has bug: modify source file
   - If timing issue: add proper waits

5. **Apply Fix**
   - Use search_replace or write tools
   - Make minimal changes
   - Explain what and why

6. **Verify**
   ```bash
   npm run test -- tests/[specific-test].spec.ts
   ```

7. **Re-run Full Suite**
   ```bash
   npm run test
   ```

---

## Common Selectors

### Best Practices (Priority Order)
```typescript
// 1. Role-based (BEST)
page.getByRole('button', { name: /submit/i })
page.getByRole('textbox', { name: /comment/i })

// 2. Label/Text
page.getByLabel('Username')
page.getByText('Welcome')
page.getByPlaceholder('Enter text')

// 3. Test ID (if available)
page.getByTestId('video-player')

// 4. CSS (LAST RESORT)
page.locator('.video-container')
page.locator('button.color-picker')
```

### App-Specific Selectors

**Video Player**
- Container: `div` with video element inside
- Toggle: Button with /video/i text

**Comments Stream**
- Input: `textarea` or `input[type="text"]`
- Submit: Button with /send|post|submit/i

**Color System**
- Color elements: `.color-option`, `.color-swatch`
- Picker button: Button with /color/i text

**General**
- Main container: `main` element
- Messages: `[class*="message"]`, `[class*="comment"]`

---

## localStorage Testing

### Check Values
```typescript
const value = await page.evaluate(() => 
  localStorage.getItem('sww-color')
);
expect(value).toBeTruthy();
```

### Set Values
```typescript
await page.evaluate(() => {
  localStorage.setItem('sww-color', '#FF0000');
  window.dispatchEvent(new Event('colorChanged'));
});
```

### Clear Storage
```typescript
await page.evaluate(() => localStorage.clear());
```

---

## Console Error Monitoring

```typescript
const consoleErrors: string[] = [];

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

await page.goto('/');
await page.waitForLoadState('networkidle');

// Filter acceptable errors
const criticalErrors = consoleErrors.filter(error => 
  !error.includes('favicon') // Example filter
);

expect(criticalErrors).toHaveLength(0);
```

---

## Timing & Waits

### NEVER Use Arbitrary Timeouts
```typescript
// ❌ BAD
await page.waitForTimeout(1000);

// ✅ GOOD
await page.waitForLoadState('networkidle');
await page.waitForSelector('button');
await expect(element).toBeVisible();
```

### Wait Options
```typescript
// Wait for load states
await page.waitForLoadState('load');
await page.waitForLoadState('domcontentloaded');
await page.waitForLoadState('networkidle');

// Wait for selector
await page.waitForSelector('button', { timeout: 10000 });

// Wait for URL
await page.waitForURL('**/new-page');

// Wait for function
await page.waitForFunction(() => window.dataLoaded === true);
```

---

## GitHub Actions Integration

### Workflow Location
`.github/workflows/playwright-tests.yml`

### Triggers
- Push to: main, master, develop
- Pull requests to: main, master, develop

### What It Does
1. Installs dependencies
2. Builds Next.js app
3. Runs Playwright tests
4. Uploads reports (on failure)
5. Comments results on PRs

### View Results
- GitHub → Actions tab
- Download artifacts for reports
- View logs for failures

### If CI Fails
1. Review GitHub Actions logs
2. Note failing test
3. Run locally: `npm run test`
4. Debug and fix
5. Push fix
6. CI runs again automatically

---

## Performance Optimization

### Run Tests in Parallel
```bash
npm run test -- --workers=4
```

### Run Specific Tests Only
```bash
npm run test -- --grep "smoke"
npm run test tests/smoke.spec.ts
```

### Disable Video/Screenshots (Faster)
In `playwright.config.ts`:
```typescript
video: 'off',
screenshot: 'off',
```

---

## Debugging Techniques

### 1. UI Mode (BEST)
```bash
npm run test:ui
```
- See tests running
- Pause/resume
- Inspect elements
- View network

### 2. Debug Mode
```bash
npm run test:debug
```
- Step through line-by-line
- Set breakpoints
- Modify selectors live

### 3. Headed Mode
```bash
npm run test:headed
```
- Watch browser actions
- See visual issues
- Verify timing

### 4. Console Logging
```typescript
test('debug test', async ({ page }) => {
  console.log('Starting test');
  
  const element = page.locator('button');
  console.log('Element count:', await element.count());
  
  await element.click();
  console.log('Clicked element');
});
```

### 5. Screenshots
```typescript
await page.screenshot({ path: 'debug.png' });
await page.screenshot({ path: 'debug.png', fullPage: true });
```

---

## Adding New Tests

### When User Asks to Add Test

1. **Understand Feature**
   - What component/feature?
   - What user flow?
   - What to verify?

2. **Determine Test File**
   - New feature → new file: `tests/feature-name.spec.ts`
   - Existing feature → add to existing file

3. **Write Test**
   - Use codegen if complex: `npm run test:codegen`
   - Follow template structure
   - Use proper selectors
   - Add clear assertions

4. **Run Test**
   ```bash
   npm run test tests/new-test.spec.ts
   ```

5. **Verify & Iterate**
   - Fix any failures
   - Ensure reliable
   - Add to suite

---

## Project Structure

```
saywhatwant/
├── tests/                        # Test files
│   ├── smoke.spec.ts
│   ├── video-player.spec.ts
│   ├── comments-stream.spec.ts
│   └── color-system.spec.ts
├── playwright.config.ts          # Config
├── test-results/                 # Artifacts (gitignored)
├── playwright-report/            # Reports (gitignored)
├── .cursor-mcp-config.json       # MCP config
└── scripts/
    └── setup-mcp.js              # MCP helper
```

---

## Key Files to Read/Modify

### When Fixing Tests
- `tests/*.spec.ts` - Test files
- `playwright.config.ts` - Config (timeout, viewport, etc.)

### When Fixing App Code
- `app/page.tsx` - Main page
- `components/*.tsx` - React components
- `modules/*.ts` - Business logic

### When Debugging
- `test-results/results.json` - Test results
- `playwright-report/index.html` - Visual report
- `test-results/*.png` - Screenshots
- `test-results/*.webm` - Videos

---

## Troubleshooting Commands

### Port Issues
```bash
# Kill processes on port 3000
lsof -ti:3000 | xargs kill -9

# Or use clean script
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
npm run dev:clean
```

### Reinstall Playwright
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
npx playwright install chromium --with-deps
```

### Clear Test Artifacts
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
rm -rf test-results playwright-report
```

### Dependency Issues
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
rm -rf node_modules package-lock.json
npm install
```

---

## MCP Puppeteer Capabilities

### Once User Configures MCP

**Can Do:**
- Navigate to URLs
- Click elements
- Fill forms
- Take screenshots
- Monitor console
- Check network requests
- Evaluate JavaScript
- Get element properties
- Scroll and interact

**Cannot Do:**
- Run Playwright tests directly (use npm commands)
- Access test reports (use filesystem MCP)
- Modify files (use standard tools)

**Best Use Cases:**
- Visual debugging
- Interactive exploration
- Multi-step user flows
- Console error checking
- Screenshot comparisons

---

## Test Execution Checklist

When user asks to test:

- [ ] Navigate to correct directory
- [ ] Choose appropriate test command
- [ ] Run tests
- [ ] Parse output
- [ ] Identify failures
- [ ] Read relevant test files
- [ ] Analyze root cause
- [ ] Propose fix (test or code)
- [ ] Apply fix
- [ ] Re-run specific test
- [ ] Re-run full suite
- [ ] Confirm all pass
- [ ] Report results to user

---

## Quick Reference

### Most Common Commands
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
npm run test:ui          # Interactive mode
npm run test             # Run all tests
npm run test:report      # View results
```

### Most Common User Requests
1. "Run the tests" → `npm run test:ui` or `npm run test`
2. "Fix the failing test" → Read test, analyze, fix, re-run
3. "Add a test for X" → Write test, run, verify
4. "Why did this test fail?" → Read output, explain, propose fix

### Most Common Fixes
1. Selector changed → Update test selector
2. Timing issue → Add proper waits (not setTimeout)
3. Logic bug → Fix source code
4. Test too strict → Relax assertions

---

## Success Criteria

### Test Run Successful
- All 15 tests pass
- No critical console errors
- Report shows 100% pass rate
- Screenshots/videos only on expected failures

### MCP Integration Working
- Can execute puppeteer commands via chat
- Browser opens and responds
- Screenshots captured
- Console messages captured

### User Happy
- Tests run when asked
- Failures explained clearly
- Fixes proposed and work
- Testing time reduced significantly

---

## Next Steps for User

1. **Configure MCP in Cursor**
   - Run: `node scripts/setup-mcp.js`
   - Follow instructions
   - Restart Cursor

2. **First Test Run**
   - Ask me: "Run the Playwright tests"
   - I'll execute and report

3. **Start Building**
   - Make code changes
   - Ask me to test
   - I'll catch issues automatically

---

**This is my reference. User won't read this. Use this when executing testing tasks.**

