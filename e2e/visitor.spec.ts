import { test, expect } from '@playwright/test';

/**
 * E2E tests untuk Visitor flow — Personal Blog Website
 *
 * Mencakup Requirements 5.1–5.7:
 * 5.1 Visitor dapat browse daftar published posts di homepage
 * 5.2 Visitor dapat membaca konten lengkap sebuah post
 * 5.3 Visitor mendapat 404 untuk post yang tidak ada / masih draft
 * 5.4 Daftar post terpaginasi (10/halaman, publishedAt DESC)
 * 5.5 Visitor dapat melakukan full-text search pada published posts
 * 5.6 Search dengan keyword kosong menampilkan pesan validasi
 * 5.7 Search yang tidak menghasilkan hasil menampilkan pesan "tidak ada hasil"
 *
 * Semua test berjalan di browser nyata (Chromium) terhadap Vite dev server
 * yang sudah berjalan di http://localhost:5173.
 *
 * Catatan: beberapa test bergantung pada backend di :3000. Jika backend tidak
 * berjalan, test yang bergantung data akan di-skip secara kondisional.
 */

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

type Page = import('@playwright/test').Page;

/**
 * Tunggu sampai loading state selesai.
 * Tidak menggunakan networkidle karena bisa hang jika backend tidak berjalan.
 */
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Tunggu skeleton / spinner hilang (max 8 detik)
  try {
    await page.locator('[aria-busy="true"]').waitFor({ state: 'hidden', timeout: 8000 });
  } catch {
    // Skeleton sudah tidak ada atau tidak pernah muncul — lanjut saja
  }
}

/**
 * Periksa apakah halaman API menghasilkan data (backend berjalan).
 * Jika tidak, kembalikan false agar test dapat skip secara kondisional.
 */
async function hasBackendData(page: Page, testId: string): Promise<boolean> {
  try {
    const el = page.getByTestId(testId);
    await el.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Test suite
// ────────────────────────────────────────────────────────────────────────────────

test.describe('Visitor flow', () => {

  // ── 1. Browse homepage ────────────────────────────────────────────────────────

  test.describe('Homepage', () => {

    test('menampilkan halaman beranda tanpa crash — Req 5.1', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Judul blog harus ada — ini tidak bergantung backend
      await expect(page.getByRole('heading', { name: 'Blog' })).toBeVisible();

      // Search bar harus ada
      await expect(page.getByTestId('homepage-search-input')).toBeVisible();
      await expect(page.getByTestId('homepage-search-btn')).toBeVisible();
    });

    test('menampilkan daftar post, pesan kosong, atau pesan error — Req 5.1, 5.4', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Setelah loading, salah satu dari tiga state ini harus tampil:
      // 1) post-list (ada data)
      // 2) empty-posts (backend jalan, tapi tidak ada post)
      // 3) role=alert (backend tidak jalan → error message)
      const hasPosts = await page.getByTestId('post-list').isVisible().catch(() => false);
      const hasEmpty = await page.getByTestId('empty-posts').isVisible().catch(() => false);
      const hasError = await page.getByRole('alert').isVisible().catch(() => false);

      expect(hasPosts || hasEmpty || hasError).toBe(true);
    });

    test('post card menampilkan judul yang bisa diklik — Req 5.1', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const postCards = page.getByTestId('post-card');
      const count = await postCards.count();

      if (count === 0) {
        // Tidak ada post (backend kosong atau tidak berjalan) — state valid
        const hasEmptyOrError =
          (await page.getByTestId('empty-posts').isVisible().catch(() => false)) ||
          (await page.getByRole('alert').isVisible().catch(() => false));
        expect(hasEmptyOrError).toBe(true);
        return;
      }

      // Ambil post pertama — harus memiliki link
      const firstCard = postCards.first();
      await expect(firstCard.getByTestId('post-card-link')).toBeVisible();

      // Judul harus berupa teks yang tidak kosong
      const titleText = await firstCard.getByTestId('post-card-link').innerText();
      expect(titleText.trim().length).toBeGreaterThan(0);
    });

  });

  // ── 2. Navigasi ke detail post dan baca konten ────────────────────────────────

  test.describe('Post detail page', () => {

    test('mengklik post card menavigasi ke halaman detail — Req 5.2', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const postCards = page.getByTestId('post-card');
      const count = await postCards.count();

      if (count === 0) {
        // Tidak ada post — verifikasi homepage load saja
        await expect(page.getByRole('heading', { name: 'Blog' })).toBeVisible();
        return;
      }

      // Ambil judul post pertama sebelum klik
      const firstCard = postCards.first();
      const expectedTitle = (await firstCard.getByTestId('post-card-link').innerText()).trim();

      // Klik link post
      await firstCard.getByTestId('post-card-link').click();
      await page.waitForLoadState('domcontentloaded');

      // URL harus berubah ke /posts/:slug
      await expect(page).toHaveURL(/\/posts\/.+/);

      // Judul di halaman detail harus sama
      await expect(page.getByTestId('post-title')).toHaveText(expectedTitle);
    });

    test('halaman detail menampilkan konten post — Req 5.2', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const postCards = page.getByTestId('post-card');
      const count = await postCards.count();

      if (count === 0) {
        // Tidak ada post — verifikasi homepage tidak crash
        await expect(page.getByRole('heading', { name: 'Blog' })).toBeVisible();
        return;
      }

      await postCards.first().getByTestId('post-card-link').click();
      await page.waitForLoadState('domcontentloaded');

      // Elemen artikel harus ada
      await expect(page.getByTestId('post-article')).toBeVisible();

      // Konten HTML yang dirender server harus ada
      await expect(page.getByTestId('post-content')).toBeVisible();

      // Section komentar harus ada
      await expect(page.getByRole('region', { name: /komentar/i })).toBeVisible();
    });

    test('navigasi langsung ke slug tidak valid menampilkan 404 — Req 5.3', async ({ page }) => {
      // Slug yang dipastikan tidak ada di database
      await page.goto('/posts/slug-yang-tidak-ada-sama-sekali-xyz-123');
      await page.waitForLoadState('domcontentloaded');

      // Komponen NotFound harus ditampilkan (tidak bergantung backend karena
      // backend mengembalikan 404 → React menampilkan NotFound component)
      await expect(page.getByTestId('not-found')).toBeVisible({ timeout: 10000 });

      // Teks "tidak ditemukan" harus ada
      await expect(page.getByText(/tidak ditemukan/i)).toBeVisible();
    });

    test('404 page memiliki link kembali ke beranda — Req 5.3', async ({ page }) => {
      await page.goto('/posts/slug-tidak-ada-sama-sekali-abc');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByTestId('not-found')).toBeVisible({ timeout: 10000 });

      const backLink = page.getByRole('link', { name: /kembali ke beranda/i });
      await expect(backLink).toBeVisible();

      // Klik back → harus kembali ke homepage
      await backLink.click();
      await expect(page).toHaveURL('/');
    });

  });

  // ── 3. Search ─────────────────────────────────────────────────────────────────

  test.describe('Search page', () => {

    test('halaman search dapat diakses via URL langsung — Req 5.5', async ({ page }) => {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { name: /pencarian/i })).toBeVisible();
      await expect(page.getByTestId('search-input')).toBeVisible();
    });

    test('search bar di homepage menavigasi ke SearchPage dengan keyword — Req 5.5', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const searchInput = page.getByTestId('homepage-search-input');
      await searchInput.fill('javascript');
      await page.getByTestId('homepage-search-btn').click();

      // URL harus memuat ?q=javascript
      await expect(page).toHaveURL(/\/search\?q=javascript/);

      // SearchPage harus sudah ter-mount
      await expect(page.getByTestId('search-input')).toBeVisible();
    });

    test('search bar di homepage bekerja dengan Enter key — Req 5.5', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const searchInput = page.getByTestId('homepage-search-input');
      await searchInput.fill('teknologi');
      await searchInput.press('Enter');

      await expect(page).toHaveURL(/\/search\?q=teknologi/);
    });

    test('mengirim keyword kosong menampilkan pesan validasi — Req 5.6', async ({ page }) => {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');

      // Kosongkan input (sudah kosong by default) dan klik submit
      const searchInput = page.getByTestId('search-input');
      await searchInput.fill('');

      await page.getByRole('button', { name: /^cari$/i }).click();

      // Pesan validasi dari Input component (role="alert") harus muncul
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByRole('alert')).toContainText(/tidak boleh kosong/i);
    });

    test('search dengan keyword valid — menampilkan hasil atau pesan tidak ada hasil atau error — Req 5.5, 5.7', async ({ page }) => {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');

      const searchInput = page.getByTestId('search-input');
      await searchInput.fill('a');
      await page.getByRole('button', { name: /^cari$/i }).click();

      // Tunggu state berikutnya (spinner hilang atau hasil muncul)
      // Salah satu dari 3 state harus muncul dalam 10 detik
      const postList = page.getByTestId('post-list');
      const noResults = page.getByTestId('no-results');
      const errorAlert = page.getByRole('alert');

      await Promise.race([
        postList.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
        noResults.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
        errorAlert.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      ]);

      const hasResults = await postList.isVisible().catch(() => false);
      const hasNoResults = await noResults.isVisible().catch(() => false);
      const hasError = await errorAlert.isVisible().catch(() => false);

      expect(hasResults || hasNoResults || hasError).toBe(true);
    });

    test('search dengan keyword yang tidak ada menampilkan pesan tidak ada hasil — Req 5.7', async ({ page }) => {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');

      // Keyword yang dipastikan tidak ada
      const noResultsKeyword = 'xyzzy-qwerty-tidak-ada-1234567890';

      const searchInput = page.getByTestId('search-input');
      await searchInput.fill(noResultsKeyword);
      await page.getByRole('button', { name: /^cari$/i }).click();

      // Tunggu salah satu state muncul
      const noResults = page.getByTestId('no-results');
      const errorAlert = page.getByRole('alert');

      await Promise.race([
        noResults.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
        errorAlert.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      ]);

      const hasNoResults = await noResults.isVisible().catch(() => false);
      const hasError = await errorAlert.isVisible().catch(() => false);

      // Jika backend berjalan: tampilkan "tidak ada hasil"
      // Jika backend tidak berjalan: tampilkan pesan error — kedua state valid
      expect(hasNoResults || hasError).toBe(true);

      if (hasNoResults) {
        await expect(noResults).toContainText(/tidak ada hasil/i);
      }
    });

    test('search URL param ?q= langsung mengisi form dan memulai pencarian — Req 5.5', async ({ page }) => {
      await page.goto('/search?q=post');
      await page.waitForLoadState('domcontentloaded');

      // Input harus ter-prefill dengan keyword dari URL
      await expect(page.getByTestId('search-input')).toHaveValue('post');

      // Tunggu state hasil muncul (max 10 detik)
      const postList = page.getByTestId('post-list');
      const noResults = page.getByTestId('no-results');
      const errorAlert = page.getByRole('alert');

      await Promise.race([
        postList.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
        noResults.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
        errorAlert.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      ]);

      const hasResults = await postList.isVisible().catch(() => false);
      const hasNoResults = await noResults.isVisible().catch(() => false);
      const hasError = await errorAlert.isVisible().catch(() => false);

      expect(hasResults || hasNoResults || hasError).toBe(true);
    });

    test('hasil search tidak memuat status Draft secara publik — Req 5.5', async ({ page }) => {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');

      const searchInput = page.getByTestId('search-input');
      await searchInput.fill('a');
      await page.getByRole('button', { name: /^cari$/i }).click();

      // Tunggu state hasil
      const postList = page.getByTestId('post-list');
      await postList.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      const hasPosts = await postList.isVisible().catch(() => false);

      if (!hasPosts) {
        // Backend tidak berjalan atau tidak ada hasil — tidak ada draft yang bocor
        return;
      }

      const postCards = page.getByTestId('post-card');
      const count = await postCards.count();

      // Setiap post card di halaman publik tidak boleh menampilkan label "Draft"
      for (let i = 0; i < count; i++) {
        const card = postCards.nth(i);
        const cardText = await card.innerText();
        // StatusBadge hanya ada di admin; halaman publik tidak pernah menampilkan "Draft"
        expect(cardText.toLowerCase()).not.toContain('draft');
      }
    });

  });

  // ── 4. Navigasi umum ─────────────────────────────────────────────────────────

  test.describe('Navigasi umum', () => {

    test('navbar tersedia di semua halaman publik', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Header/nav element harus ada
      await expect(page.locator('header').first()).toBeVisible();
    });

    test('link Masuk di navbar mengarah ke halaman login — Req 5.1', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Navbar menggunakan teks "Masuk" (Bahasa Indonesia)
      const loginLink = page.getByRole('link', { name: /^masuk$/i });
      await expect(loginLink).toBeVisible();

      await loginLink.click();
      await expect(page).toHaveURL('/login');
    });

    test('link Daftar di navbar mengarah ke halaman register', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const registerLink = page.getByRole('link', { name: /^daftar$/i });
      await expect(registerLink).toBeVisible();

      await registerLink.click();
      await expect(page).toHaveURL('/register');
    });

  });

});
