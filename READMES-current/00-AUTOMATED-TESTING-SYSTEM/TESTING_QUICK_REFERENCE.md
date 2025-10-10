# Testing Quick Reference

## 🚀 Common Commands

```bash
# Run all tests
npm run test

# Run tests with interactive UI
npm run test:ui

# Run tests in debug mode (step through)
npm run test:debug

# Run tests with visible browser
npm run test:headed

# View test report
npm run test:report

# Generate test code by recording actions
npm run test:codegen

# Run specific test file
npm run test tests/smoke.spec.ts

# Run tests matching pattern
npm run test --grep "video"
```

## 🎯 Test Files

| File | Purpose |
|------|---------|
| `tests/smoke.spec.ts` | Basic app loading & console error checks |
| `tests/video-player.spec.ts` | Video toggle & aspect ratio tests |
| `tests/comments-stream.spec.ts` | Comments display & interaction tests |
| `tests/color-system.spec.ts` | Color picker & persistence tests |

## 💬 Ask Cursor AI

### Test Execution
```
Run the Playwright tests and show me results
```

### Test Generation
```
Create a Playwright test for [feature name]
```

### Debugging
```
Debug the failing test in [test-file.spec.ts]
```

### Auto-Fix
```
Analyze the test failures and fix the code
```

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright test configuration |
| `package.json` | Test scripts & dependencies |
| `.github/workflows/playwright-tests.yml` | CI/CD automation |

## 📊 Test Reports

After running tests, find results in:
- **HTML Report**: `playwright-report/index.html` (open with `npm run test:report`)
- **JSON Results**: `test-results/results.json`
- **Screenshots**: `test-results/` (on failures)
- **Videos**: `test-results/` (on failures)

## 🐛 Debugging Tips

### 1. Use UI Mode (Best for Development)
```bash
npm run test:ui
```
- See tests running in real-time
- Pause/resume execution
- Inspect elements
- View network activity

### 2. Use Debug Mode (Best for Single Tests)
```bash
npm run test:debug
```
- Step through test line-by-line
- Set breakpoints
- Modify selectors live

### 3. Use Trace Viewer (Best for CI Failures)
```bash
npx playwright show-trace test-results/trace.zip
```
- Timeline of test execution
- Screenshots at each step
- Network logs
- Console output

## 🔄 Workflow: Cursor + Tests

### Standard Flow
1. Make code changes in Cursor
2. Run: `npm run test:ui` in terminal
3. Watch tests execute
4. If failures, ask Cursor: "Fix the failing tests"
5. Cursor analyzes and proposes fixes
6. Accept fixes, re-run tests

### Automated Flow (with Testers.ai)
1. Make code changes in Cursor
2. Testers.ai auto-detects changes
3. Tests run automatically
4. Failures are auto-fixed
5. You review the fixes

### CI/CD Flow
1. Push code to GitHub
2. GitHub Actions runs tests automatically
3. Results posted to PR
4. If failures, Cursor reads the logs (via MCP)
5. You ask Cursor to fix issues
6. Push fixes, tests run again

## 📦 File Structure

```
saywhatwant/
├── tests/                    # Test files
│   ├── smoke.spec.ts
│   ├── video-player.spec.ts
│   ├── comments-stream.spec.ts
│   └── color-system.spec.ts
├── playwright.config.ts      # Configuration
├── test-results/             # Test artifacts (gitignored)
├── playwright-report/        # HTML reports (gitignored)
└── package.json             # Test scripts
```

## 🎨 Writing New Tests

### Basic Template
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Arrange: Set up test conditions
    const button = page.getByRole('button', { name: /click me/i });
    
    // Act: Perform action
    await button.click();
    
    // Assert: Verify result
    await expect(page.getByText('Success')).toBeVisible();
  });
});
```

### Common Patterns

**Click a button:**
```typescript
await page.getByRole('button', { name: /submit/i }).click();
```

**Fill input:**
```typescript
await page.getByPlaceholder('Enter text').fill('Hello World');
```

**Check visibility:**
```typescript
await expect(page.getByText('Welcome')).toBeVisible();
```

**Wait for navigation:**
```typescript
await page.waitForLoadState('networkidle');
```

**Check localStorage:**
```typescript
const value = await page.evaluate(() => 
  localStorage.getItem('key')
);
expect(value).toBe('expected');
```

**Handle console errors:**
```typescript
page.on('console', msg => {
  if (msg.type() === 'error') {
    console.log('Error:', msg.text());
  }
});
```

## 🚨 Common Issues

### Issue: Port 3000 already in use
```bash
npm run dev:clean
```

### Issue: Tests timeout
```typescript
// In test file, increase timeout
test.setTimeout(120000); // 2 minutes
```

### Issue: Element not found
```typescript
// Use better selectors
// ❌ Bad: page.locator('.btn-123')
// ✅ Good: page.getByRole('button', { name: 'Submit' })

// Or wait longer
await page.waitForSelector('button', { timeout: 10000 });
```

### Issue: Flaky tests
```typescript
// Replace arbitrary waits
// ❌ Bad: await page.waitForTimeout(1000);
// ✅ Good: await page.waitForLoadState('networkidle');
// ✅ Good: await expect(element).toBeVisible();
```

## 🎓 Learning Resources

- **Playwright Docs**: https://playwright.dev
- **Test Examples**: https://playwright.dev/docs/test-example-recipes
- **Selectors Guide**: https://playwright.dev/docs/selectors
- **Best Practices**: https://playwright.dev/docs/best-practices

## 💡 Pro Tips

1. **Use `test:ui` during development** - It's the fastest way to debug
2. **Use `test:codegen` to generate tests** - Record actions, get test code
3. **Group related tests** - Use `test.describe()` blocks
4. **Use beforeEach for setup** - Keep tests DRY
5. **Name tests clearly** - "should toggle video on button click" > "test 1"
6. **Test user flows, not implementation** - Focus on what users do
7. **Avoid fixed timeouts** - Use `waitForLoadState`, `waitForSelector`, etc.
8. **Use data-testid for dynamic content** - More stable than CSS classes

## 🤝 Integration Matrix

| Tool | Purpose | Status |
|------|---------|--------|
| Playwright | Test execution | ✅ Installed |
| GitHub Actions | CI/CD automation | ✅ Configured |
| Cursor AI | Code assistance | ✅ Ready |
| MCP Servers | Cursor integration | 🔧 Manual setup needed |
| Testers.ai | Auto-fix & generation | 🔧 Optional setup |

## 📝 Checklist

Before pushing code:
- [ ] Run `npm run test` locally
- [ ] All tests pass
- [ ] No new console errors
- [ ] Test report looks good (`npm run test:report`)
- [ ] New features have tests

After pushing:
- [ ] Check GitHub Actions status
- [ ] Review test results on PR
- [ ] Fix any CI failures
- [ ] Merge when green ✅

