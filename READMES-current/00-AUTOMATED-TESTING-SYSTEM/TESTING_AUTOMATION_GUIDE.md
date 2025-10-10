# Automated Testing Guide for SayWhatWant

## 🎯 Overview

This guide covers the automated testing setup for your React + TypeScript application. The system is designed to:

- **Reduce manual testing time** from 4+ hours to minutes
- **Test full-stack**: UI/UX interactions + API calls + console errors
- **Run automatically** on every code change (via GitHub Actions)
- **Auto-fix issues** using AI-powered tools integrated with Cursor

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Test Suite Overview](#test-suite-overview)
3. [Running Tests Locally](#running-tests-locally)
4. [Cursor AI Integration](#cursor-ai-integration)
5. [Automated CI/CD Testing](#automated-cicd-testing)
6. [Testers.ai Integration](#testersai-integration)
7. [Advanced Workflows](#advanced-workflows)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Chrome browser
- Cursor AI IDE
- GitHub repository (for automated CI/CD)

### Installation

All dependencies are already installed! The setup includes:

```bash
# Already installed via package.json
- @playwright/test
- playwright (Chromium browser)
```

### Run Your First Test

```bash
# Make sure you're in the saywhatwant directory
cd saywhatwant

# Run all tests (headless mode)
npm run test

# Run tests with UI (see tests in action)
npm run test:ui

# Run tests in debug mode
npm run test:debug

# Run tests in headed mode (visible browser)
npm run test:headed
```

---

## 📊 Test Suite Overview

### Current Test Coverage

1. **Smoke Tests** (`tests/smoke.spec.ts`)
   - Homepage loads successfully
   - No console errors on load
   - Responsive viewport testing

2. **Video Player Tests** (`tests/video-player.spec.ts`)
   - Video toggle functionality
   - localStorage persistence
   - 9:16 aspect ratio verification

3. **Comments Stream Tests** (`tests/comments-stream.spec.ts`)
   - Comments display and interaction
   - Message input functionality
   - Filter system behavior
   - Scroll position memory

4. **Color System Tests** (`tests/color-system.spec.ts`)
   - Random color assignment
   - Color picker functionality
   - Color change persistence
   - Event system validation

### Test Configuration

Located in `playwright.config.ts`:

- **Browser**: Chrome (Desktop) only
- **Viewport**: 1920x1080 (desktop resolution)
- **Timeout**: 60 seconds per test
- **Retries**: 2 retries on CI, 0 locally
- **Reports**: HTML + JSON + List formats

---

## 💻 Running Tests Locally

### Development Server + Tests

Playwright automatically starts your dev server before tests:

```bash
npm run test
```

This will:
1. Start `npm run dev` (Next.js dev server on port 3000)
2. Wait for server to be ready
3. Run all tests
4. Generate HTML report

### Test Against Production Build

```bash
# Build the app first
npm run build

# Test the production build
npm run test:local
```

### Test Against Deployed Site

```bash
# Update package.json with your deployed URL
# Then run:
npm run test:deployed
```

Or set the URL inline:

```bash
TEST_URL=https://your-site.pages.dev npm run test
```

### View Test Reports

After tests complete:

```bash
npm run test:report
```

This opens an interactive HTML report showing:
- Test results (pass/fail)
- Screenshots on failure
- Video recordings on failure
- Execution timeline
- Detailed error logs

---

## 🔌 Cursor AI Integration

### Option 1: MCP Server Integration (Recommended)

MCP (Model Context Protocol) servers allow Cursor to interact with Playwright directly.

#### Step 1: Configure MCP in Cursor

1. Open Cursor Settings (`Cmd/Ctrl + ,`)
2. Navigate to: **Features** → **Model Context Protocol**
3. Click **Edit Config** or open `~/.cursor/mcp.json`
4. Add the following configuration:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": [
        "-y",
        "@executeautomation/puppeteer-mcp-server"
      ]
    },
    "browserbase": {
      "command": "npx",
      "args": [
        "-y",
        "@browserbasehq/mcp-server-browserbase"
      ],
      "env": {
        "BROWSERBASE_API_KEY": "your-api-key-here",
        "BROWSERBASE_PROJECT_ID": "your-project-id-here"
      }
    }
  }
}
```

#### Step 2: Using MCP with Cursor

Once configured, you can ask Cursor:

- "Run the Playwright tests and show me the results"
- "Debug the failing test in video-player.spec.ts"
- "Create a new test for the search functionality"
- "Generate a test that clicks through the entire user flow"

The MCP server allows Cursor to:
- Execute Playwright commands
- Navigate your app
- Interact with elements
- Capture screenshots
- Analyze test failures

### Option 2: Direct Test Integration

Simply ask Cursor in chat:

```
Run the Playwright tests: npm run test

Then analyze the results and fix any failing tests.
```

Cursor will:
1. Run the command
2. Read the test output
3. Identify failures
4. Propose fixes
5. Apply fixes to your code

---

## 🤖 Automated CI/CD Testing

### GitHub Actions Setup

The workflow is already configured in `.github/workflows/playwright-tests.yml`.

#### What It Does:

1. **On Every Push/PR** to main/master/develop:
   - Installs dependencies
   - Builds your Next.js app
   - Runs all Playwright tests
   - Uploads test reports as artifacts
   - Comments results on PRs

2. **On Main Branch Push**:
   - Waits 3 minutes for Cloudflare deployment
   - Tests the deployed production site
   - Reports any issues

#### Setup Requirements:

1. **GitHub Secrets** (Optional):
   - Go to: Repository → Settings → Secrets → Actions
   - Add: `DEPLOYED_URL` (your Cloudflare Pages URL)

2. **Cloudflare Integration**:
   - Your current git-push → Cloudflare deployment works automatically
   - Tests run after deployment completes

#### Viewing Results:

1. Go to: Repository → Actions tab
2. Click on any workflow run
3. View test results in the logs
4. Download artifacts for detailed reports

#### PR Integration:

When you create a PR, the workflow will:
- Run all tests automatically
- Comment the results directly on the PR
- ✅ Show passed/failed test counts
- 📊 Link to full report artifacts

---

## 🧪 Testers.ai Integration

**Testers.ai** is specifically designed for Cursor and provides AI-powered test generation and auto-fixing.

### Setup Testers.ai

1. **Install Testers.ai Extension** (if available in Cursor marketplace)
2. **Or use CLI**:

```bash
npx testers-ai init
```

### Using Testers.ai

#### Generate Tests Automatically

Ask Cursor with Testers.ai:

```
@testers Generate tests for the video player component
```

Testers.ai will:
- Analyze your component
- Generate comprehensive test cases
- Create Playwright test files
- Run the tests
- Report results

#### Auto-Fix Test Failures

When tests fail:

```
@testers Fix the failing tests
```

Testers.ai will:
- Analyze the failure logs
- Identify the root cause
- Propose code fixes
- Apply fixes automatically
- Re-run tests to verify

#### Watch Mode

```
@testers Watch for changes and run tests automatically
```

This enables the "test on every code change" workflow you want.

---

## 🔧 Advanced Workflows

### 1. Visual Regression Testing

Add visual comparison tests:

```typescript
// tests/visual.spec.ts
import { test, expect } from '@playwright/test';

test('homepage matches snapshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});
```

Run with:

```bash
# Update snapshots
npm run test -- --update-snapshots

# Compare against snapshots
npm run test
```

### 2. API Testing

Test your Cloudflare Workers API:

```typescript
// tests/api.spec.ts
import { test, expect } from '@playwright/test';

test('comments API returns data', async ({ request }) => {
  const response = await request.get('https://sww-comments.workers.dev/api/comments');
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(Array.isArray(data)).toBe(true);
});
```

### 3. Multi-Step User Flows

Test complex interactions:

```typescript
// tests/user-flow.spec.ts
import { test, expect } from '@playwright/test';

test('complete user journey', async ({ page }) => {
  // Step 1: Land on homepage
  await page.goto('/');
  
  // Step 2: Toggle video
  await page.getByRole('button', { name: /video/i }).click();
  await page.waitForTimeout(600);
  
  // Step 3: Change color
  await page.getByRole('button', { name: /color/i }).click();
  await page.locator('.color-option').first().click();
  
  // Step 4: Open comment input
  await page.locator('textarea').fill('Test comment');
  
  // Step 5: Submit comment
  await page.getByRole('button', { name: /send/i }).click();
  
  // Verify: Comment appears
  await expect(page.getByText('Test comment')).toBeVisible();
});
```

### 4. Code Generation

Use Playwright's codegen to record interactions:

```bash
npm run test:codegen
```

This will:
1. Open a browser window
2. Record your interactions
3. Generate test code automatically
4. Save to a file

### 5. Parallel Testing

Speed up tests by running in parallel:

```bash
# Run tests in parallel across all CPU cores
npm run test -- --workers=4

# Or use a percentage
npm run test -- --workers=50%
```

### 6. Test Specific Files/Tests

```bash
# Run specific test file
npm run test tests/smoke.spec.ts

# Run tests matching a pattern
npm run test --grep "video"

# Run a specific test
npm run test --grep "video player can be toggled"
```

---

## 📈 Monitoring & Optimization

### Performance Metrics

Playwright automatically tracks:
- Test execution time
- Page load performance
- Network requests
- Console logs

View in the HTML report: `npm run test:report`

### Debugging Failed Tests

When tests fail:

1. **Check Screenshots**: `test-results/` folder
2. **Watch Videos**: `test-results/` folder
3. **Review Traces**: Open trace viewer

```bash
npx playwright show-trace test-results/trace.zip
```

4. **Debug Interactively**:

```bash
npm run test:debug
```

This opens Playwright Inspector:
- Step through test line-by-line
- Inspect elements in real-time
- Modify selectors on the fly

### Optimizing Test Speed

1. **Use --headed only when needed** (headless is faster)
2. **Enable parallel execution**: `--workers=4`
3. **Optimize waitForTimeout**: Use specific waits instead
4. **Cache authentication**: Save login state between tests

---

## 🎉 Summary: Your New Workflow

### Before (Manual - 4+ hours):
1. Make code change
2. Push to git
3. Wait for Cloudflare deployment (2-3 min)
4. Manually test each feature
5. Document issues
6. Tell Cursor about issues
7. Cursor makes fixes
8. Repeat...

### After (Automated - minutes):
1. Make code change
2. Push to git
3. **GitHub Actions automatically**:
   - Builds app
   - Runs all tests
   - Posts results to PR
4. **If tests fail**:
   - Cursor reads failure logs (via MCP)
   - Proposes fixes automatically
   - Applies fixes
   - Re-runs tests
5. **Deploy to production** with confidence

### Local Development:
1. Make code change
2. Save file
3. Tests run automatically (via Testers.ai watch mode)
4. Get instant feedback
5. Fix issues in real-time

---

## 🚨 Troubleshooting

### Tests Won't Run

```bash
# Reinstall Playwright browsers
npx playwright install chromium --with-deps
```

### Port Already in Use

```bash
# Kill processes on port 3000
lsof -ti:3000 | xargs kill -9

# Or use the clean script
npm run dev:clean
```

### Tests Timeout

Increase timeout in `playwright.config.ts`:

```typescript
timeout: 120 * 1000, // 2 minutes
```

### Flaky Tests

Add explicit waits:

```typescript
// Instead of:
await page.waitForTimeout(1000);

// Use:
await page.waitForLoadState('networkidle');
await expect(element).toBeVisible();
```

---

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Cursor MCP Documentation](https://docs.cursor.com/mcp)
- [Testers.ai Documentation](https://testers.ai/docs)
- [GitHub Actions Documentation](https://docs.github.com/actions)

---

## 🎯 Next Steps

1. **Run your first test**: `npm run test`
2. **Review test results**: `npm run test:report`
3. **Configure Cursor MCP**: Add MCP servers to Cursor settings
4. **Push to GitHub**: Let CI/CD run automatically
5. **Set up Testers.ai**: For AI-powered test generation
6. **Customize tests**: Add tests for new features as you build

---

**Questions or Issues?**

If you encounter any problems, ask Cursor:

```
Help me debug the Playwright tests. Here's the error: [paste error]
```

Cursor will analyze the issue and provide fixes automatically!

