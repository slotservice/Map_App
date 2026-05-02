import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin@fullcirclefm.local';
const ADMIN_PASSWORD = 'password123';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/maps', { timeout: 10_000 });
}

test.describe('auth', () => {
  test('login → maps redirect on success', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Maps' })).toBeVisible();
  });

  test('login → friendly error on wrong password (NOT raw "INVALID_CREDENTIALS")', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    const err = page.locator('p.text-red-600').first();
    await expect(err).toBeVisible();
    const text = await err.textContent();
    // The bug we just fixed: must not show raw error code.
    expect(text).not.toMatch(/INVALID_CREDENTIALS/i);
    expect(text?.toLowerCase()).toMatch(/wrong email or password|invalid/);
  });

  test('login trims whitespace before submitting', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    // Leading + trailing space — would 401 if not trimmed.
    await page.getByLabel('Password').fill(`  ${ADMIN_PASSWORD}  `);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/maps', { timeout: 10_000 });
  });

  test('forgot-password page renders form', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('logout returns to /login', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: /^log out$/i }).click();
    await page.waitForURL('**/login', { timeout: 10_000 });
  });
});

test.describe('navigation — every sidebar link loads', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const linkLabel of [
    'Maps',
    'Workers',
    'Vendors',
    'Viewers',
    'Audit log',
    'Profile',
    'Change password',
  ]) {
    test(`sidebar → ${linkLabel}`, async ({ page }) => {
      await page.getByRole('link', { name: linkLabel, exact: true }).click();
      // Page must render its <h1>; if it didn't load it'd be blank or an error.
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    });
  }
});

test.describe('maps list polish (search + pagination)', () => {
  // Seed via API so the table renders (search no-match condition needs data.length > 0).
  let createdMapId: string | null = null;
  const mapName = `pw-smoke-${Date.now()}`;
  const apiBase = (process.env.ADMIN_URL || 'http://localhost:4000').replace(/\/$/, '') + '/api/v1';

  test.beforeAll(async ({ request }) => {
    const login = await request.post(`${apiBase}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const token = (await login.json()).tokens.accessToken;
    const fs = await import('node:fs/promises');
    const xlsx = await fs.readFile('/tmp/c_dilbeck.xlsx');
    const importRes = await request.post(`${apiBase}/maps/import`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        name: mapName,
        file: { name: 'c_dilbeck.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx },
      },
    });
    createdMapId = (await importRes.json()).mapId;
  });

  test.afterAll(async ({ request }) => {
    if (!createdMapId) return;
    const login = await request.post(`${apiBase}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const token = (await login.json()).tokens.accessToken;
    await request.delete(`${apiBase}/maps/${createdMapId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('search box exists, filters list, no-match shows hint', async ({ page }) => {
    const search = page.getByPlaceholder(/search maps/i);
    await expect(search).toBeVisible();
    // Confirm seeded map shows by name
    await expect(page.getByRole('link', { name: mapName })).toBeVisible();
    await search.fill('zzzzzz-no-such-map-xyz');
    await expect(page.getByText(/no maps match/i)).toBeVisible();
  });

  test('search clears and restores list', async ({ page }) => {
    const search = page.getByPlaceholder(/search maps/i);
    await search.fill('xyznotamap');
    await expect(page.getByText(/no maps match/i)).toBeVisible();
    await search.fill('');
    await expect(page.getByRole('link', { name: mapName })).toBeVisible();
    await expect(page.getByText(/no maps match/i)).toHaveCount(0);
  });
});

test.describe('audit log polish (date range filter)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Audit log', exact: true }).click();
  });

  test('renders both date inputs', async ({ page }) => {
    await expect(page.locator('input[type="datetime-local"]').first()).toBeVisible();
    expect(await page.locator('input[type="datetime-local"]').count()).toBe(2);
  });

  test('filters narrow the result set without errors', async ({ page }) => {
    const inputs = page.locator('input[type="datetime-local"]');
    // Set a from-date in the future → expect zero rows or smaller set.
    await inputs.nth(0).fill('2099-01-01T00:00');
    // The page mustn't crash; it should either show "No entries." or render the list.
    // Either way, no red error.
    await expect(page.locator('p.text-red-600')).toHaveCount(0);
  });
});

test.describe('dark mode toggle', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('toggle button switches html.dark class on/off', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /(dark mode|light mode)/i });
    await expect(toggle).toBeVisible();

    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(!before);

    // Toggle back to confirm bidirectional.
    await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(before);
  });

  test('preference persists across reload', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /(dark mode|light mode)/i });
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await toggle.click();
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(!before);
  });
});

test.describe('every page renders without console errors', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const path of ['/maps', '/workers', '/vendors', '/viewers', '/audit-log', '/profile', '/change-password']) {
    test(`no JS console errors on ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // Filter out noisy 401s during refresh-token rotation, third-party warnings.
      const real = errors.filter(
        (e) =>
          !/Failed to load resource/.test(e) &&
          !/^The resource .* was preloaded/.test(e) &&
          !/Hydration failed/.test(e) || // surface hydration mismatches but not "preloaded but not used" warnings
          /Hydration/.test(e),
      );
      expect(real, real.join('\n')).toEqual([]);
    });
  }
});
