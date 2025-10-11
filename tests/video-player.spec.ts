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
    // Video should be visible by default on first visit
    const videoContainer = page.locator('div').filter({ has: page.locator('video') }).first();
    
    // Wait for page to load and video to appear
    await page.waitForTimeout(600);
    
    // Video should be visible by default
    await expect(videoContainer).toBeVisible({ timeout: 5000 });
    await expect(videoContainer).toHaveCSS('opacity', '1', { timeout: 5000 });
    
    // Look for toggle button
    const toggleButton = page.getByRole('button', { name: /video|toggle/i }).first();
    
    if (await toggleButton.isVisible()) {
      // Click to hide video
      await toggleButton.click();
      await page.waitForTimeout(600); // Wait for animation
      
      // Video should be hidden
      await expect(videoContainer).toHaveCSS('opacity', '0', { timeout: 5000 });
      
      // Click to show video again
      await toggleButton.click();
      await page.waitForTimeout(600); // Wait for animation
      
      // Video should be visible again
      await expect(videoContainer).toHaveCSS('opacity', '1', { timeout: 5000 });
    }
  });

  test('video toggle state persists in localStorage', async ({ page }) => {
    // Find toggle button
    const toggleButton = page.getByRole('button', { name: /video|toggle/i }).first();
    
    if (await toggleButton.isVisible()) {
      // Toggle video on
      await toggleButton.click();
      await page.waitForTimeout(500);
      
      // Check localStorage
      const showVideoState = await page.evaluate(() => 
        localStorage.getItem('sww-show-video')
      );
      expect(showVideoState).toBe('true');
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Video should still be visible after reload
      const videoContainer = page.locator('div').filter({ has: page.locator('video') }).first();
      await expect(videoContainer).toBeVisible({ timeout: 5000 });
    }
  });

  test('video container has correct aspect ratio (9:16)', async ({ page }) => {
    // Toggle video on if needed
    const toggleButton = page.getByRole('button', { name: /video|toggle/i }).first();
    
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await page.waitForTimeout(600);
      
      // Check the video container width calculation
      const videoContainer = page.locator('div').filter({ has: page.locator('video') }).first();
      const width = await videoContainer.evaluate(el => el.offsetWidth);
      const height = await videoContainer.evaluate(el => el.offsetHeight);
      
      // 9:16 aspect ratio means width should be approximately height * 9/16
      const expectedWidth = height * 9 / 16;
      const tolerance = 5; // 5px tolerance
      
      expect(Math.abs(width - expectedWidth)).toBeLessThan(tolerance);
    }
  });
});

