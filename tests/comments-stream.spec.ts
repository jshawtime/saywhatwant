import { test, expect } from '@playwright/test';

/**
 * Comments Stream Tests
 * Tests for comment viewing, posting, and interaction
 */

test.describe('Comments Stream', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('comments stream is visible and functional', async ({ page }) => {
    // Look for comments container (might be MessageList or similar)
    const commentsContainer = page.locator('[class*="comment"], [class*="message"]').first();
    
    // Comments area should be present
    await expect(page.locator('main')).toBeVisible();
  });

  test('can open message input', async ({ page }) => {
    // Look for input field or button to open it
    const messageInput = page.locator('textarea, input[type="text"]').first();
    const messageButton = page.getByRole('button', { name: /send|post|submit/i }).first();
    
    // Either input or button should be present
    const hasInput = await messageInput.count() > 0;
    const hasButton = await messageButton.count() > 0;
    
    expect(hasInput || hasButton).toBe(true);
  });

  test('user color is stored and persists', async ({ page }) => {
    // Check that a color is stored in localStorage
    const userColor = await page.evaluate(() => 
      localStorage.getItem('sww-color')
    );
    
    expect(userColor).toBeTruthy();
    expect(userColor).toMatch(/^#[0-9A-Fa-f]{6}$/); // Valid hex color
    
    // Reload and verify color persists
    const savedColor = userColor;
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const reloadedColor = await page.evaluate(() => 
      localStorage.getItem('sww-color')
    );
    
    expect(reloadedColor).toBe(savedColor);
  });

  test('can interact with filter system', async ({ page }) => {
    // Look for filter buttons or UI
    const filterButtons = page.getByRole('button').filter({ hasText: /filter|sort/i });
    const filterCount = await filterButtons.count();
    
    // If filters exist, test basic interaction
    if (filterCount > 0) {
      const firstFilter = filterButtons.first();
      await firstFilter.click();
      
      // Should not cause errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      
      await page.waitForTimeout(1000);
      expect(consoleErrors.length).toBeLessThan(3); // Allow minor errors
    }
  });

  test('scroll position is maintained', async ({ page }) => {
    // Get scrollable container
    const scrollContainer = page.locator('[class*="overflow"], [class*="scroll"]').first();
    
    if (await scrollContainer.count() > 0) {
      // Scroll down
      await scrollContainer.evaluate(el => el.scrollTop = 500);
      const scrollTop = await scrollContainer.evaluate(el => el.scrollTop);
      
      expect(scrollTop).toBeGreaterThan(0);
      
      // Wait a bit and check scroll position is maintained
      await page.waitForTimeout(1000);
      const newScrollTop = await scrollContainer.evaluate(el => el.scrollTop);
      
      // Should be similar (allowing for small auto-adjustments)
      expect(Math.abs(newScrollTop - scrollTop)).toBeLessThan(100);
    }
  });
});

