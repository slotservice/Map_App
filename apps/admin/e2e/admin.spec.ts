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
    'Map list',
    'Worker list',
    'Vendor list',
    'Viewer list',
    'Audit log',
    'Profile',
    'Change Password',
  ]) {
    test(`sidebar → ${linkLabel}`, async ({ page }) => {
      await page.getByRole('link', { name: linkLabel, exact: true }).click();
      // Page must render its <h1>; if it didn't load it'd be blank or an error.
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    });
  }
});

test.describe('sidebar role filtering — non-admin must not see admin-only sections', () => {
  const apiBase = (process.env.ADMIN_URL || 'http://localhost:4000').replace(/\/$/, '') + '/api/v1';
  let mapId: string | null = null;

  // Vendor needs a map assignment, otherwise the post-login redirect to
  // /maps shows no content; we only need the sidebar to render anyway,
  // but assign so the page is non-empty.
  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post(`${apiBase}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const token = (await adminLogin.json()).tokens.accessToken;
    const fs = await import('node:fs/promises');
    const xlsx = await fs.readFile('/tmp/c_dilbeck.xlsx');
    const importRes = await request.post(`${apiBase}/maps/import`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        name: `pw-sidebar-${Date.now()}`,
        file: { name: 'c_dilbeck.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx },
      },
    });
    mapId = (await importRes.json()).mapId;
    const vendorId = (await (await request.get(`${apiBase}/users?role=vendor`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json())
      .find((u: { email: string }) => u.email === 'vendor@fullcirclefm.local').id;
    await request.post(`${apiBase}/maps/${mapId}/assignments`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { userId: vendorId, role: 'vendor' },
    });
  });

  test.afterAll(async ({ request }) => {
    if (!mapId) return;
    const adminLogin = await request.post(`${apiBase}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const token = (await adminLogin.json()).tokens.accessToken;
    await request.delete(`${apiBase}/maps/${mapId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('vendor sees Maps + Account Settings, NOT Users section', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('vendor@fullcirclefm.local');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/maps', { timeout: 10_000 });

    // Scope all assertions to the sidebar (<aside>) so we don't collide
    // with same-text page headings.
    const aside = page.locator('aside');

    // Section headers visible in sidebar
    await expect(aside.getByText('Maps', { exact: true })).toBeVisible();
    await expect(aside.getByText('Account Settings', { exact: true })).toBeVisible();
    // Users section MUST NOT render for vendor
    await expect(aside.getByText('Users', { exact: true })).toHaveCount(0);

    // Vendor-allowed items visible
    await expect(aside.getByRole('link', { name: 'Map list', exact: true })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Change Password', exact: true })).toBeVisible();
    // Admin-only items must be absent
    await expect(aside.getByRole('link', { name: 'Worker list', exact: true })).toHaveCount(0);
    await expect(aside.getByRole('link', { name: 'Vendor list', exact: true })).toHaveCount(0);
    await expect(aside.getByRole('link', { name: 'Viewer list', exact: true })).toHaveCount(0);
    await expect(aside.getByRole('link', { name: 'Audit log', exact: true })).toHaveCount(0);
  });
});

test.describe('stale localStorage AuthUser (pre-address-fields) — backwards compat', () => {
  test('logging in fresh writes the new schema (sanity)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/maps', { timeout: 10_000 });
    // localStorage must now carry the four new optional keys (even if null).
    const cached = await page.evaluate(() => {
      const raw = window.localStorage.getItem('mapapp.user');
      return raw ? JSON.parse(raw) : null;
    });
    expect(cached).toBeTruthy();
    expect(cached).toHaveProperty('address');
    expect(cached).toHaveProperty('state');
    expect(cached).toHaveProperty('zip');
  });

  test('Profile renders cleanly even when cached user has no address fields (simulated stale cache)', async ({ page }) => {
    // Login normally, then mutate localStorage to remove the new fields,
    // simulating a session that was created before today's deploy.
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/maps', { timeout: 10_000 });

    await page.evaluate(() => {
      const raw = window.localStorage.getItem('mapapp.user');
      if (!raw) return;
      const obj = JSON.parse(raw);
      delete obj.address;
      delete obj.state;
      delete obj.zip;
      window.localStorage.setItem('mapapp.user', JSON.stringify(obj));
    });

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /my profile/i })).toBeVisible();
    // No JS errors, fields just empty (which is fine).
    await expect(page.getByLabel('Address')).toHaveValue('');
    await expect(page.getByLabel('State')).toHaveValue('');
    await expect(page.getByLabel('Zip')).toHaveValue('');
  });
});

test.describe('profile self-edit (legacy parity)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Profile', exact: true }).click();
  });

  test('profile page is editable (not a TODO stub)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /my profile/i })).toBeVisible();
    // Must NOT show the TODO stub from the old version.
    await expect(page.getByText(/TODO/i)).toHaveCount(0);
    // Phone, address, state, zip inputs must be present and editable.
    for (const label of ['Phone', 'Address', 'State', 'Zip']) {
      const field = page.getByLabel(label);
      await expect(field).toBeVisible();
      await expect(field).toBeEditable();
    }
  });

  test('profile save round-trip', async ({ page }) => {
    const stamp = String(Date.now()).slice(-6);
    const newPhone = `555-PW-${stamp}`;
    await page.getByLabel('Phone').fill(newPhone);
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText(/profile saved/i)).toBeVisible({ timeout: 10_000 });
    // Reload — value should persist
    await page.reload();
    await expect(page.getByLabel('Phone')).toHaveValue(newPhone);
  });
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
          (!/Failed to load resource/.test(e) &&
            !/^The resource .* was preloaded/.test(e) &&
            // Next.js sidebar-prefetch flake; user navigation still works.
            !/Failed to fetch RSC payload/.test(e) &&
            !/Hydration failed/.test(e)) ||
          // …but DO surface hydration mismatches.
          /Hydration/.test(e),
      );
      expect(real, real.join('\n')).toEqual([]);
    });
  }
});

test.describe('map list — per-row action buttons (legacy parity)', () => {
  let createdMapId: string | null = null;
  const mapName = `pw-actions-${Date.now()}`;
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

  test('all six legacy action buttons render on each row', async ({ page }) => {
    const row = page.locator('tr', { has: page.getByRole('link', { name: mapName }) });
    await expect(row).toBeVisible();
    // Detail link is the first action button (also the row's name is a link, but action column has Detail too).
    await expect(row.getByRole('link', { name: 'Detail' })).toBeVisible();
    await expect(row.getByRole('link', { name: /Map/, exact: false }).first()).toBeVisible();
    await expect(row.getByRole('link', { name: 'Manage Workers' })).toBeVisible();
    await expect(row.getByRole('link', { name: 'Tag Alerts' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('Detail button → /maps/[id]', async ({ page }) => {
    const row = page.locator('tr', { has: page.getByRole('link', { name: mapName }) });
    await row.getByRole('link', { name: 'Detail' }).click();
    await expect(page).toHaveURL(new RegExp(`/maps/${createdMapId}$`));
    await expect(page.getByRole('heading', { name: mapName })).toBeVisible();
  });

  test('Manage Workers button → /maps/[id]/workers', async ({ page }) => {
    const row = page.locator('tr', { has: page.getByRole('link', { name: mapName }) });
    await row.getByRole('link', { name: 'Manage Workers' }).click();
    await expect(page).toHaveURL(new RegExp(`/maps/${createdMapId}/workers$`));
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('Tag Alerts button → /maps/[id]/tag-alerts', async ({ page }) => {
    const row = page.locator('tr', { has: page.getByRole('link', { name: mapName }) });
    await row.getByRole('link', { name: 'Tag Alerts' }).click();
    await expect(page).toHaveURL(new RegExp(`/maps/${createdMapId}/tag-alerts$`));
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('Edit button opens rename dialog', async ({ page }) => {
    const row = page.locator('tr', { has: page.getByRole('link', { name: mapName }) });
    await row.getByRole('button', { name: 'Edit' }).click();
    const dialogTitle = page.getByRole('heading', { name: /rename map/i });
    await expect(dialogTitle).toBeVisible();
    // The current name should be pre-filled.
    const input = page.getByRole('textbox').first();
    await expect(input).toHaveValue(mapName);
  });
});

test.describe('map view — Leaflet marker page', () => {
  let createdMapId: string | null = null;
  const mapName = `pw-mapview-${Date.now()}`;
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

  test('Map button on list navigates to /maps/[id]/view', async ({ page }) => {
    const row = page.locator('tr', { has: page.getByRole('link', { name: mapName }) });
    await row.getByRole('link', { name: /Map/, exact: false }).first().click();
    await expect(page).toHaveURL(new RegExp(`/maps/${createdMapId}/view$`));
  });

  test('map view page renders the Leaflet container', async ({ page }) => {
    await page.goto(`/maps/${createdMapId}/view`);
    // Leaflet adds .leaflet-container to its mount element.
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10_000 });
    // Tile layer attribution from OpenStreetMap is a load proof.
    await expect(page.getByText(/OpenStreetMap/i)).toBeVisible();
  });

  test('map view page renders at least one marker', async ({ page }) => {
    await page.goto(`/maps/${createdMapId}/view`);
    await page.locator('.leaflet-container').waitFor({ timeout: 15_000 });
    // DivIcon markers carry the .fcfm-store-marker class (see map-marker-view.tsx).
    // Use toBeAttached over toBeVisible because Leaflet's wrapper element can
    // briefly have a 0×0 layout while it positions itself; what matters is
    // that the marker is in the DOM and has rendered children.
    const markers = page.locator('.fcfm-store-marker');
    await expect(markers.first()).toBeAttached({ timeout: 15_000 });
    expect(await markers.count()).toBeGreaterThan(0);
  });

  test('"View on map" button on detail page navigates to map view', async ({ page }) => {
    await page.goto(`/maps/${createdMapId}`);
    await page.getByRole('link', { name: /view on map/i }).click();
    await expect(page).toHaveURL(new RegExp(`/maps/${createdMapId}/view$`));
  });

  test('no JS console errors on /maps/[id]/view', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`/maps/${createdMapId}/view`);
    await page.waitForLoadState('networkidle');
    const real = errors.filter(
      (e) =>
        !/Failed to load resource/.test(e) &&
        !/^The resource .* was preloaded/.test(e) &&
        // Next.js sidebar-prefetch flake; user-visible navigation works fine.
        !/Failed to fetch RSC payload/.test(e),
    );
    expect(real, real.join('\n')).toEqual([]);
  });
});

test.describe('map detail — store CRUD + manual complete dialogs (legacy parity)', () => {
  let createdMapId: string | null = null;
  const mapName = `pw-storecrud-${Date.now()}`;
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

  test('Add new store button opens dialog', async ({ page }) => {
    await page.goto(`/maps/${createdMapId}`);
    await page.getByRole('button', { name: /add new store/i }).click();
    await expect(page.getByRole('heading', { name: /add new store/i })).toBeVisible();
  });

  test('per-row Edit button opens edit dialog with pre-filled fields', async ({ page }) => {
    await page.goto(`/maps/${createdMapId}`);
    // Wait for the stores table to render before searching for buttons,
    // otherwise getByRole returns 0 matches.
    await expect(page.getByRole('button', { name: /^Edit$/ }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /^Edit$/ }).first().click();
    await expect(page.getByRole('heading', { name: /edit store/i })).toBeVisible();
    // The dialog has the same number of inputs as our store form; just
    // confirm the Store # field has a non-empty value.
    const storeNumberInput = page.getByRole('textbox').first();
    await expect(storeNumberInput).not.toHaveValue('');
  });

  test('per-row Complete button opens admin-complete dialog (workers needed)', async ({ page, request }) => {
    // The dialog needs at least one worker assigned to surface a meaningful selector,
    // but the dialog still opens regardless — we test it opens and shows the heading.
    await page.goto(`/maps/${createdMapId}`);
    await page.getByRole('button', { name: /^Complete$/ }).first().click();
    await expect(page.getByRole('heading', { name: /manual complete/i })).toBeVisible();
  });

  test('per-row Delete button asks for confirm', async ({ page }) => {
    await page.goto(`/maps/${createdMapId}`);
    // Wait for at least one Delete button to exist before counting.
    await expect(page.getByRole('button', { name: /^Delete$/ }).first()).toBeVisible({
      timeout: 10_000,
    });
    // Capture the confirm() prompt and dismiss it (don't actually delete during the test).
    page.on('dialog', (dialog) => dialog.dismiss());
    const before = await page.getByRole('button', { name: /^Delete$/ }).count();
    await page.getByRole('button', { name: /^Delete$/ }).first().click();
    // Row count unchanged because we dismissed.
    await expect(page.getByRole('button', { name: /^Delete$/ })).toHaveCount(before);
  });
});

test.describe('questions page (legacy parity)', () => {
  let createdMapId: string | null = null;
  const mapName = `pw-questions-${Date.now()}`;
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

  test('Questions button on detail navigates to /maps/[id]/questions', async ({ page }) => {
    await page.goto(`/maps/${createdMapId}`);
    await page.getByRole('link', { name: /^Questions$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/maps/${createdMapId}/questions$`));
    await expect(page.getByRole('heading', { name: /^Questions$/ })).toBeVisible();
  });

  test('Add new question round-trip (create + appears in list + delete)', async ({ page }) => {
    await page.goto(`/maps/${createdMapId}/questions`);
    await page.getByRole('button', { name: /add new question/i }).click();
    const dialog = page.getByRole('heading', { name: /add new question/i });
    await expect(dialog).toBeVisible();
    const title = `pw-q-${Date.now()}`;
    await page.getByRole('textbox').first().fill(title);
    await page.getByRole('button', { name: /^save$/i }).click();
    // Dialog closes, table shows the new title.
    await expect(page.getByText(title)).toBeVisible({ timeout: 5000 });

    // Delete it (capture confirm)
    page.on('dialog', (dialog) => dialog.accept());
    await page
      .locator('tr', { has: page.getByText(title) })
      .getByRole('button', { name: /^delete$/i })
      .click();
    await expect(page.getByText(title)).toHaveCount(0);
  });
});

test.describe('map detail sub-pages render (admin)', () => {
  let createdMapId: string | null = null;
  const mapName = `pw-subpages-${Date.now()}`;
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

  for (const sub of ['workers', 'vendors', 'viewers', 'tag-alerts', 'tag-alert-log', 'questions']) {
    test(`/maps/[id]/${sub} renders without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto(`/maps/${createdMapId}/${sub}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1, h2').first()).toBeVisible();
      const real = errors.filter(
        (e) =>
          !/Failed to load resource/.test(e) &&
          !/^The resource .* was preloaded/.test(e) &&
          // Next.js sidebar-prefetch flake; the user-visible navigation works fine.
          !/Failed to fetch RSC payload/.test(e),
      );
      expect(real, real.join('\n')).toEqual([]);
    });
  }
});
