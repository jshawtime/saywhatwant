/**
 * Message Type Toggle Tests
 * Tests the Human/AI icon toggle functionality and scroll position behavior
 */

import { test, expect } from '@playwright/test';

test.describe('Message Type Toggle', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000');
    
    // Wait for app to load
    await page.waitForSelector('.sww-title', { timeout: 10000 });
  });

  test('should show both icon buttons without slider', async ({ page }) => {
    // Check that user icon exists
    const userIcon = page.locator('button svg').filter({ has: page.locator('[class*="lucide-users"]') });
    await expect(userIcon).toBeVisible();
    
    // Check that AI/sparkle icon exists
    const aiIcon = page.locator('button svg').filter({ has: page.locator('[class*="lucide-sparkles"]') });
    await expect(aiIcon).toBeVisible();
    
    // Verify there's no slider element (should only have 2 buttons in the toggle container)
    const toggleContainer = page.locator('div').filter({ has: userIcon }).and(page.locator('div').filter({ has: aiIcon })).first();
    const buttons = toggleContainer.locator('button');
    await expect(buttons).toHaveCount(2); // Only 2 buttons, no slider
  });

  test('should toggle between human and AI states', async ({ page }) => {
    // Start at human state (default)
    await expect(page).toHaveURL(/mt=human|#$/);
    
    // Click AI icon
    const aiIcon = page.locator('button').filter({ has: page.locator('[class*="lucide-sparkles"]') });
    await aiIcon.click();
    
    // Should switch to AI state
    await expect(page).toHaveURL(/mt=AI/);
    await page.waitForTimeout(500); // Wait for content to render
    
    // Click human icon
    const userIcon = page.locator('button').filter({ has: page.locator('[class*="lucide-users"]') });
    await userIcon.click();
    
    // Should switch back to human state
    await expect(page).toHaveURL(/mt=human/);
  });

  test('should highlight both icons when mt=ALL in URL', async ({ page }) => {
    // Navigate to ALL state
    await page.goto('http://localhost:3000/#mt=ALL');
    await page.waitForTimeout(500);
    
    // Both icons should have background highlight
    const userIconButton = page.locator('button').filter({ has: page.locator('[class*="lucide-users"]') });
    const aiIconButton = page.locator('button').filter({ has: page.locator('[class*="lucide-sparkles"]') });
    
    // Check if both buttons have the active background class
    await expect(userIconButton).toHaveClass(/bg-black\/40/);
    await expect(aiIconButton).toHaveClass(/bg-black\/40/);
  });

  test('should preserve scroll position when switching views', async ({ page }) => {
    // Navigate to human view
    await page.goto('http://localhost:3000/#mt=human');
    await page.waitForTimeout(1000); // Wait for messages to load
    
    // Get message stream container
    const messageStream = page.locator('[data-scroll-container]').or(page.locator('.overflow-y-auto').first());
    
    // Scroll to a specific position (middle of content)
    await messageStream.evaluate((el) => {
      el.scrollTop = Math.floor(el.scrollHeight / 2);
    });
    
    // Wait a moment for position to save
    await page.waitForTimeout(500);
    
    // Get the scroll position before switching
    const humanScrollPosition = await messageStream.evaluate((el) => el.scrollTop);
    console.log('[Test] Human view scroll position:', humanScrollPosition);
    
    // Switch to AI view
    const aiIcon = page.locator('button').filter({ has: page.locator('[class*="lucide-sparkles"]') });
    await aiIcon.click();
    await page.waitForTimeout(500); // Wait for view switch
    
    // Switch back to human view
    const userIcon = page.locator('button').filter({ has: page.locator('[class*="lucide-users"]') });
    await userIcon.click();
    await page.waitForTimeout(500); // Wait for view switch
    
    // Check if scroll position was restored
    const restoredScrollPosition = await messageStream.evaluate((el) => el.scrollTop);
    console.log('[Test] Restored scroll position:', restoredScrollPosition);
    
    // Position should be restored (allow 50px tolerance for dynamic content)
    expect(Math.abs(restoredScrollPosition - humanScrollPosition)).toBeLessThan(50);
  });

  test('should scroll to bottom when switching to view with no saved position', async ({ page }) => {
    // Navigate directly to human view (fresh state)
    await page.goto('http://localhost:3000/#mt=human');
    await page.waitForTimeout(1000);
    
    // Get message stream
    const messageStream = page.locator('[data-scroll-container]').or(page.locator('.overflow-y-auto').first());
    
    // Should start at bottom (newest messages)
    const scrollTop = await messageStream.evaluate((el) => el.scrollTop);
    const scrollHeight = await messageStream.evaluate((el) => el.scrollHeight);
    const clientHeight = await messageStream.evaluate((el) => el.clientHeight);
    
    const atBottom = scrollTop >= (scrollHeight - clientHeight - 100); // 100px tolerance
    expect(atBottom).toBe(true);
  });

  test('should clear position and scroll to bottom when user reaches bottom', async ({ page }) => {
    // Navigate to human view
    await page.goto('http://localhost:3000/#mt=human');
    await page.waitForTimeout(1000);
    
    // Get message stream
    const messageStream = page.locator('[data-scroll-container]').or(page.locator('.overflow-y-auto').first());
    
    // Scroll to middle
    await messageStream.evaluate((el) => {
      el.scrollTop = Math.floor(el.scrollHeight / 2);
    });
    await page.waitForTimeout(300);
    
    // Scroll to bottom
    await messageStream.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);
    
    // Switch to AI and back
    const aiIcon = page.locator('button').filter({ has: page.locator('[class*="lucide-sparkles"]') });
    await aiIcon.click();
    await page.waitForTimeout(300);
    
    const userIcon = page.locator('button').filter({ has: page.locator('[class*="lucide-users"]') });
    await userIcon.click();
    await page.waitForTimeout(500);
    
    // Should be at bottom (position was cleared when user reached bottom)
    const scrollTop = await messageStream.evaluate((el) => el.scrollTop);
    const scrollHeight = await messageStream.evaluate((el) => el.scrollHeight);
    const clientHeight = await messageStream.evaluate((el) => el.clientHeight);
    
    const atBottom = scrollTop >= (scrollHeight - clientHeight - 100);
    expect(atBottom).toBe(true);
  });

});

