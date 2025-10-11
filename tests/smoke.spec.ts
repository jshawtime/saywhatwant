import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Basic functionality checks
 * These tests ensure the app loads and core elements are present
 */

test.describe('App Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads without errors
    await expect(page).toHaveTitle(/SayWhatWant|Say What Want/i);
    
    // Check for main layout elements
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('no console errors on initial load', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Allow some time for any delayed errors
    await page.waitForTimeout(2000);
    
    // Filter out known acceptable errors
    const criticalErrors = consoleErrors.filter(error => {
      // Ignore favicon errors
      if (error.includes('favicon')) return false;
      
      // Ignore video playback errors in test environment (no videos available)
      if (error.includes('Video playback error')) return false;
      if (error.includes('VideoPlayer')) return false;
      
      // Ignore hydration warnings (expected with random color generation)
      if (error.includes('Prop') && error.includes('did not match')) return false;
      if (error.includes('style') && error.includes('color:rgb')) return false;
      
      return true;
    });
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('app is responsive to viewport changes', async ({ page }) => {
    await page.goto('/');
    
    // Test at desktop resolution
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('main')).toBeVisible();
    
    // Test at tablet resolution
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('main')).toBeVisible();
    
    // Test at mobile resolution
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('main')).toBeVisible();
  });
});

