import { test, expect } from '@playwright/test';

/**
 * Video Player Tests
 * Tests for video toggle functionality and video player behavior
 */

test.describe('Video Player', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage to start fresh
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('video player can be toggled on and off', async ({ page }) => {
    // Target the container div that persists (has transition-all class)
    const videoContainer = page.locator('div.transition-all.duration-500').first();
    
    // Wait for page to load
    await page.waitForTimeout(600);
    
    // Video should be visible by default (opacity > 0.9)
    const initialOpacity = await videoContainer.evaluate(el => 
      window.getComputedStyle(el).opacity
    );
    expect(parseFloat(initialOpacity)).toBeGreaterThan(0.9);
    
    // Look for toggle button
    const toggleButton = page.getByRole('button', { name: /video|toggle|hide/i }).first();
    
    if (await toggleButton.isVisible()) {
      // Click to hide video
      await toggleButton.click();
      await page.waitForTimeout(600);
      
      // Video should be hidden (opacity < 0.1)
      const hiddenOpacity = await videoContainer.evaluate(el => 
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(hiddenOpacity)).toBeLessThan(0.1);
      
      // Click to show video again
      await toggleButton.click();
      await page.waitForTimeout(600);
      
      // Video should be visible (opacity > 0.9)
      const visibleOpacity = await videoContainer.evaluate(el => 
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(visibleOpacity)).toBeGreaterThan(0.9);
    }
  });

  test('video toggle state persists in localStorage', async ({ page }) => {
    // Video starts visible by default - toggle OFF and verify persistence
    const videoContainer = page.locator('div.transition-all.duration-500').first();
    const toggleButton = page.getByRole('button', { name: /video|toggle|hide/i }).first();
    
    if (await toggleButton.isVisible()) {
      // Toggle video OFF (it starts ON)
      await toggleButton.click();
      await page.waitForTimeout(600);
      
      // Check localStorage - should be 'false' now
      const showVideoState = await page.evaluate(() => 
        localStorage.getItem('sww-show-video')
      );
      expect(showVideoState).toBe('false');
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);
      
      // Video should still be hidden after reload (opacity < 0.1)
      const hiddenOpacity = await videoContainer.evaluate(el => 
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(hiddenOpacity)).toBeLessThan(0.1);
    }
  });

  test('video container has correct aspect ratio (9:16)', async ({ page }) => {
    // Video is already visible by default
    await page.waitForTimeout(600);
    
    // Target the container div that persists
    const videoContainer = page.locator('div.transition-all.duration-500').first();
    
    const width = await videoContainer.evaluate(el => el.offsetWidth);
    const height = await videoContainer.evaluate(el => el.offsetHeight);
    
    // 9:16 aspect ratio means width should be approximately height * 9/16
    const expectedWidth = height * 9 / 16;
    const tolerance = 10; // 10px tolerance for layout variations
    
    expect(Math.abs(width - expectedWidth)).toBeLessThan(tolerance);
  });
});

