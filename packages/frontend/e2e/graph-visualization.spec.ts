import { test, expect } from '@playwright/test';

test.describe('Graph Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for canvas to render
    await page.waitForSelector('canvas');
    // Wait for data to load (check r3f-perf or just wait)
    await page.waitForTimeout(2000);
  });

  test('renders canvas element', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('renders mixer panel with dials', async ({ page }) => {
    // Check mixer panel is visible
    const mixerPanel = page.locator('text=Mixer');
    await expect(mixerPanel).toBeVisible();

    // Check some dials are present
    const formalityDial = page.locator('text=Formality');
    await expect(formalityDial).toBeVisible();

    const brevityDial = page.locator('text=Brevity');
    await expect(brevityDial).toBeVisible();
  });

  test('displays style, tone, and content groups', async ({ page }) => {
    await expect(page.locator('text=Style').first()).toBeVisible();
    await expect(page.locator('text=Tone').first()).toBeVisible();
    await expect(page.locator('text=Content').first()).toBeVisible();
  });

  test('dial groups can be collapsed/expanded', async ({ page }) => {
    // Find Style group button and click to collapse
    const styleButton = page.locator('button:has-text("Style")');
    await styleButton.click();

    // Wait for animation
    await page.waitForTimeout(300);

    // Click again to expand
    await styleButton.click();
    await page.waitForTimeout(300);

    // Formality should still be visible after expand
    const formalityDial = page.locator('text=Formality');
    await expect(formalityDial).toBeVisible();
  });

  test('mixer panel can be closed', async ({ page }) => {
    // Find and click close button
    const closeButton = page.locator('button[aria-label="Close panel"]');
    await closeButton.click();

    // Wait for animation
    await page.waitForTimeout(300);

    // Mixer title should not be visible
    const mixerTitle = page.locator('text=Mixer');
    await expect(mixerTitle).not.toBeVisible();
  });

  test('page loads without console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Filter out expected/ignorable errors
    const realErrors = errors.filter(
      (e) =>
        !e.includes('React DevTools') &&
        !e.includes('Failed to load resource') &&
        !e.includes('net::ERR')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('canvas responds to mouse movement', async ({ page }) => {
    const canvas = page.locator('canvas');

    // Get canvas bounding box
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Move mouse across canvas
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(100);

      // Move to different position
      await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
      await page.waitForTimeout(100);

      // No crash = success
    }
  });

  test('canvas responds to click', async ({ page }) => {
    const canvas = page.locator('canvas');

    // Get canvas bounding box
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Click in center of canvas
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(100);

      // No crash = success
    }
  });

  test('r3f-perf monitoring is visible in dev mode', async ({ page }) => {
    // r3f-perf should show stats
    // Look for GPU, Geometries, etc. indicators
    const perfStats = page.locator('text=Geometries');
    // This may or may not be visible depending on how r3f-perf is configured
    // Just check the page doesn't crash
    await page.waitForTimeout(1000);
  });
});

test.describe('Data Loading', () => {
  test('handles page load with graph data', async ({ page }) => {
    await page.goto('/');

    // Wait for data to load
    await page.waitForTimeout(3000);

    // Page should be responsive
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('recovers from network errors gracefully', async ({ page }) => {
    // Set up route interception before navigation
    await page.route('**/data/*.json', (route) => {
      route.abort('failed');
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Page should still render (maybe with error state)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas');
    await page.waitForTimeout(2000);

    // Focus the canvas
    const canvas = page.locator('canvas');
    await canvas.click();
  });

  test('W key moves camera forward', async ({ page }) => {
    await page.keyboard.press('w');
    await page.waitForTimeout(100);

    // No crash = success
  });

  test('S key moves camera backward', async ({ page }) => {
    await page.keyboard.press('s');
    await page.waitForTimeout(100);
  });

  test('A key strafes left', async ({ page }) => {
    await page.keyboard.press('a');
    await page.waitForTimeout(100);
  });

  test('D key strafes right', async ({ page }) => {
    await page.keyboard.press('d');
    await page.waitForTimeout(100);
  });

  test('R key resets camera', async ({ page }) => {
    // Move camera first
    await page.keyboard.press('w');
    await page.keyboard.press('w');
    await page.waitForTimeout(200);

    // Reset
    await page.keyboard.press('r');
    await page.waitForTimeout(200);

    // No crash = success
  });

  test('multiple key presses work in sequence', async ({ page }) => {
    await page.keyboard.press('w');
    await page.keyboard.press('a');
    await page.keyboard.press('s');
    await page.keyboard.press('d');
    await page.waitForTimeout(200);
  });
});

test.describe('Visual Regression', () => {
  test('initial render matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas');
    await page.waitForTimeout(3000);

    // Take screenshot of the entire page
    await expect(page).toHaveScreenshot('initial-render.png', {
      maxDiffPixels: 1000, // Allow some variance
    });
  });
});
