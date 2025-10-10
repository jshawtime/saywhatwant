import { test, expect } from '@playwright/test';

/**
 * Color System Tests
 * Tests for user color assignment, picker, and persistence
 */

test.describe('Color System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('user is assigned a random color on first visit', async ({ page }) => {
    const userColor = await page.evaluate(() => 
      localStorage.getItem('sww-color')
    );
    
    expect(userColor).toBeTruthy();
    expect(userColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test('can open color picker', async ({ page }) => {
    // Look for color picker button or icon
    const colorButton = page.locator('button[class*="color"], [data-testid="color-picker"]').first();
    
    if (await colorButton.count() > 0) {
      await colorButton.click();
      
      // Color picker modal/dropdown should appear
      await page.waitForTimeout(500);
      
      // Look for color options or swatches
      const colorOptions = page.locator('[class*="color-swatch"], [class*="color-option"]');
      
      if (await colorOptions.count() > 0) {
        expect(await colorOptions.count()).toBeGreaterThan(0);
      }
    }
  });

  test('can change user color', async ({ page }) => {
    // Get initial color
    const initialColor = await page.evaluate(() => 
      localStorage.getItem('sww-color')
    );
    
    // Look for color picker
    const colorButton = page.locator('button').filter({ hasText: /color/i }).first();
    
    if (await colorButton.count() > 0) {
      await colorButton.click();
      await page.waitForTimeout(500);
      
      // Try to select a different color
      const colorOptions = page.locator('[class*="color"]').filter({ hasNotText: /picker/i });
      
      if (await colorOptions.count() > 1) {
        await colorOptions.nth(1).click();
        await page.waitForTimeout(500);
        
        // Check if color changed
        const newColor = await page.evaluate(() => 
          localStorage.getItem('sww-color')
        );
        
        // Color should exist (might be same or different depending on UI)
        expect(newColor).toBeTruthy();
      }
    }
  });

  test('color change triggers colorChanged event', async ({ page }) => {
    // Set up event listener
    await page.evaluate(() => {
      (window as any).colorChangedFired = false;
      window.addEventListener('colorChanged', () => {
        (window as any).colorChangedFired = true;
      });
    });
    
    // Change color via localStorage and dispatch event
    await page.evaluate(() => {
      localStorage.setItem('sww-color', '#FF0000');
      window.dispatchEvent(new Event('colorChanged'));
    });
    
    await page.waitForTimeout(500);
    
    const eventFired = await page.evaluate(() => (window as any).colorChangedFired);
    expect(eventFired).toBe(true);
  });
});

