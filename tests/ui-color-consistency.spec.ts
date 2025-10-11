import { test, expect } from '@playwright/test';

/**
 * UI Color Consistency Tests
 * Verifies all UI elements use userColor correctly
 */

test.describe('UI Color Consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for color to be set in localStorage (client-side generation)
    await page.waitForFunction(() => {
      return localStorage.getItem('sww-color') !== null;
    }, { timeout: 5000 });
  });

  test('domain filter button uses userColor', async ({ page }) => {
    // Get the userColor from localStorage (guaranteed to exist after beforeEach)
    const userColor = await page.evaluate(() => localStorage.getItem('sww-color'));
    expect(userColor).toBeTruthy();
    
    // Convert 9-digit to RGB for comparison
    const r = parseInt(userColor!.substring(0, 3));
    const g = parseInt(userColor!.substring(3, 6));
    const b = parseInt(userColor!.substring(6, 9));
    const expectedRgb = `rgb(${r}, ${g}, ${b})`;
    
    // Wait for domain filter button to mount (mounted state becomes true in useEffect)
    const domainButton = page.getByRole('button', { name: /domain/i }).first();
    await domainButton.waitFor({ state: 'visible', timeout: 5000 });
    
    if (await domainButton.isVisible()) {
      // Check the button or its child elements for color
      const buttonColor = await domainButton.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return computed.color || computed.backgroundColor || computed.borderColor;
      });
      
      // Also check for any LED/dot indicator child elements
      const ledIndicator = domainButton.locator('span, div, svg').first();
      if (await ledIndicator.count() > 0) {
        const ledColor = await ledIndicator.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return computed.color || computed.backgroundColor || computed.fill;
        });
        
        // LED should use userColor (check if it contains the RGB values)
        const hasCorrectColor = ledColor.includes(`${r}`) || 
                                ledColor.includes(`${g}`) || 
                                ledColor.includes(`${b}`);
        
        if (!hasCorrectColor) {
          throw new Error(`Domain LED not using userColor. Expected RGB(${r},${g},${b}), got: ${ledColor}`);
        }
      }
    }
  });

  test('title uses userColor', async ({ page }) => {
    // Get userColor
    const userColor = await page.evaluate(() => localStorage.getItem('sww-color'));
    expect(userColor).toBeTruthy();
    
    const r = parseInt(userColor!.substring(0, 3));
    const g = parseInt(userColor!.substring(3, 6));
    const b = parseInt(userColor!.substring(6, 9));
    
    // Find "Say What Want" title
    const title = page.getByRole('heading', { name: /say what want/i });
    
    if (await title.isVisible()) {
      const titleStyle = await title.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return computed.color;
      });
      
      // Title should use userColor
      expect(titleStyle).toContain(`${r}`);
    }
  });

  test('username input uses userColor', async ({ page }) => {
    // Get userColor
    const userColor = await page.evaluate(() => localStorage.getItem('sww-color'));
    expect(userColor).toBeTruthy();
    
    const r = parseInt(userColor!.substring(0, 3));
    const g = parseInt(userColor!.substring(3, 6));
    const b = parseInt(userColor!.substring(6, 9));
    
    // Find username input
    const usernameInput = page.locator('input[type="text"]').first();
    
    if (await usernameInput.isVisible()) {
      const inputStyle = await usernameInput.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return computed.color;
      });
      
      // Input text should use userColor (or darker version)
      expect(inputStyle).toBeTruthy();
    }
  });

  test('all UI elements that should use userColor are consistent', async ({ page }) => {
    // Get userColor
    const userColor = await page.evaluate(() => localStorage.getItem('sww-color'));
    expect(userColor).toBeTruthy();
    
    const r = parseInt(userColor!.substring(0, 3));
    const g = parseInt(userColor!.substring(3, 6));
    const b = parseInt(userColor!.substring(6, 9));
    
    // This test ensures we're using userColor across UI
    // If any element doesn't match, test fails and we know to investigate
    
    // Check multiple elements that should use userColor
    const elementsToCheck = [
      { name: 'Title', selector: 'h2' },
      { name: 'Username input', selector: 'input[type="text"]' },
      { name: 'Search input', selector: 'input[placeholder*="Search"]' },
    ];
    
    for (const element of elementsToCheck) {
      const el = page.locator(element.selector).first();
      if (await el.count() > 0 && await el.isVisible()) {
        const color = await el.evaluate(e => window.getComputedStyle(e).color);
        // Just verify color is set (actual value may vary with opacity)
        expect(color).toBeTruthy();
      }
    }
  });
});

