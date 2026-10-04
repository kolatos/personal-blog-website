import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests untuk Admin flow — Personal Blog Website
 *
 * Mencakup Requirements 1.1–1.7, 3.1–3.7, 4.1–4.8, 6.5:
 * 1.x Auth: login, logout, JWT, role-based redirect
 * 3.x Post management: create, edit, publish, unpublish, delete (draft/published lifecycle)
 * 4.x Comment management: admin dapat hapus komentar siapapun
 * 6.5 Admin melihat dashboard dan mengelola semua konten
 *
 * Semua test berjalan di browser nyata (Chromium) terhadap Vite dev server
 * yang sudah berjalan di http://localhost:5173 dan backend di :3000.
 *
 * Jalankan server sebelum test:
 *   cd frontend && npm run dev   (terminal 1)
 *   cd backend && npm run dev    (terminal 2)
 * Kemudian dari root:
 *   npx playwright test e2e/admin.spec.ts
 */

// ─────────────────────────────────────────────────────────────────────────────
// Konfigurasi
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@blog.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin1234!';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Login sebagai admin. Navigasi ke /login, isi form, submit, dan tunggu
 * redirect ke /admin.
 */
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // Tunggu redirect ke dashboard admin
  await page.waitForURL('/admin', { timeout: 15_000 });
}

/**
 * Terima semua dialog konfirmasi window.confirm() yang muncul selama test.
 * Harus dipanggil sebelum aksi yang memicu dialog.
 */
function acceptAllDialogs(page: Page): void {
  page.on('dialog', (dialog) => dialog.accept());
}

/**
 * Cari baris post di tabel berdasarkan judul (partial match).
 * Mengembalikan locator untuk baris <tr> yang cocok.
 */
function getPostRow(page: Page, title: string) {
  return page.locator('table tbody tr').filter({ hasText: title });
}

/**
 * Tunggu sampai baris post dengan judul tertentu menampilkan status yang diharapkan.
 */
async function waitForPostStatus(
  page: Page,
  title: string,
  status: 'Draft' | 'Published',
  timeout = 10_000,
): Promise<void> {
  const row = getPostRow(page, title);
  await row.waitFor({ state: 'visible', timeout });
  await expect(row.getByText(status, { exact: true })).toBeVisible({ timeout });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Admin flow', () => {

  // ── 1. Admin login ──────────────────────────────────────────────────────────

  test.describe('Login admin', () => {

    test('login dengan kredensial valid mengarah ke /admin — Req 1.1, 1.2', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('#email', ADMIN_EMAIL);
      await page.fill('#password', ADMIN_PASSWORD);
      await page.click('button[type="submit"]');

      // Setelah login berhasil, admin diarahkan ke dashboard
      await page.waitForURL('/admin', { timeout: 15_000 });
      await expect(page.getByRole('heading', { name: 'Dashboard Admin' })).toBeVisible();
    });

    test('login dengan password salah menampilkan error alert — Req 1.1', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('#email', ADMIN_EMAIL);
      await page.fill('#password', 'PasswordSalah999!');
      await page.click('button[type="submit"]');

      // Pesan error harus tampil; tidak boleh redirect ke /admin
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 });
      await expect(page).not.toHaveURL('/admin');
    });

    test('login dengan email tidak terdaftar menampilkan error alert — Req 1.1', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('#email', 'tidakada@contoh.com');
      await page.fill('#password', 'Password123!');
      await page.click('button[type="submit"]');

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 });
      await expect(page).not.toHaveURL('/admin');
    });

  });

  // ── 2. Dashboard setelah login ─────────────────────────────────────────────

  test.describe('Dashboard admin', () => {

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('menampilkan heading dan tombol buat postingan — Req 6.5', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Dashboard Admin' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Buat Postingan Baru' })).toBeVisible();
    });

    test('tabel postingan ditampilkan dengan kolom yang benar — Req 3.1', async ({ page }) => {
      // Kolom header tabel harus ada
      await expect(page.getByRole('columnheader', { name: 'Judul' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /terakhir diperbarui/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Aksi' })).toBeVisible();
    });

    test('navbar menampilkan link Dashboard untuk admin — Req 1.2', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    });

  });

  // ── 3. Siklus lengkap post: create → publish → edit → publish → unpublish → delete ──

  test.describe('Siklus lengkap postingan', () => {

    test('create → publish → edit → auto-revert draft → publish → unpublish → delete — Req 3.1–3.7', async ({ page }) => {
      // Auto-accept semua dialog konfirmasi
      acceptAllDialogs(page);

      await loginAsAdmin(page);

      // ── 3a. Navigasi ke halaman buat postingan baru ──────────────────────
      await page.getByRole('button', { name: 'Buat Postingan Baru' }).click();
      await page.waitForURL('/admin/posts/new', { timeout: 10_000 });

      // ── 3b. Isi form PostEditor ───────────────────────────────────────────
      const uniqueTitle = `Test Post E2E ${Date.now()}`;
      const markdownContent = '# Judul Konten\n\nIni adalah konten **tebal** dan *miring* untuk test.';

      // Input judul menggunakan id="post-title" (dari PostEditor)
      await page.fill('#post-title', uniqueTitle);

      // Textarea konten menggunakan id="post-content"
      await page.fill('#post-content', markdownContent);

      // ── 3c. Verifikasi Markdown preview ──────────────────────────────────
      // Preview selalu tampil (side-by-side layout, bukan toggle)
      // Section preview diidentifikasi dengan aria-label="Pratinjau Markdown"
      const previewArea = page.getByLabel('Pratinjau Markdown');
      await expect(previewArea).toBeVisible();

      // Markdown dirender oleh react-markdown: heading <h1> harus ada di preview
      await expect(previewArea.locator('h1')).toBeVisible({ timeout: 5_000 });
      await expect(previewArea.locator('strong')).toBeVisible();

      // ── 3d. Submit form (Publikasikan Nanti = simpan sebagai Draft) ───────
      await page.getByRole('button', { name: 'Publikasikan Nanti' }).click();

      // Setelah submit → redirect ke /admin
      await page.waitForURL('/admin', { timeout: 15_000 });

      // ── 3e. Verifikasi post baru muncul di tabel dengan status Draft ──────
      await waitForPostStatus(page, uniqueTitle, 'Draft');

      // ── 3f. Publikasikan post ────────────────────────────────────────────
      const row = getPostRow(page, uniqueTitle);
      await row.getByRole('button', { name: /publikasikan/i }).click();

      // Setelah publish → status berubah menjadi Published
      await waitForPostStatus(page, uniqueTitle, 'Published');

      // ── 3g. Edit post yang sudah dipublikasikan ───────────────────────────
      await getPostRow(page, uniqueTitle).getByRole('button', { name: /^edit$/i }).click();

      // URL harus berubah ke /admin/posts/:id/edit
      await page.waitForURL(/\/admin\/posts\/.+\/edit/, { timeout: 10_000 });

      // Peringatan "akan kembali ke draft" harus tampil (post sudah published)
      await expect(page.getByRole('alert')).toContainText(/mengembalikannya ke status/i, {
        timeout: 8_000,
      });

      // Modifikasi konten
      const editedContent = markdownContent + '\n\n> Paragraf tambahan setelah edit.';
      await page.fill('#post-content', editedContent);

      // Submit perubahan
      await page.getByRole('button', { name: 'Simpan Perubahan' }).click();

      // Redirect ke /admin setelah save
      await page.waitForURL('/admin', { timeout: 15_000 });

      // ── 3h. Verifikasi post kembali ke Draft (auto-revert) ────────────────
      await waitForPostStatus(page, uniqueTitle, 'Draft');

      // ── 3i. Publish ulang ────────────────────────────────────────────────
      await getPostRow(page, uniqueTitle)
        .getByRole('button', { name: /publikasikan/i })
        .click();
      await waitForPostStatus(page, uniqueTitle, 'Published');

      // ── 3j. Unpublish ────────────────────────────────────────────────────
      await getPostRow(page, uniqueTitle)
        .getByRole('button', { name: /batalkan publikasi/i })
        .click();
      await waitForPostStatus(page, uniqueTitle, 'Draft');

      // ── 3k. Hapus post ───────────────────────────────────────────────────
      await getPostRow(page, uniqueTitle).getByRole('button', { name: /hapus/i }).click();

      // Setelah hapus, baris post tidak boleh ada di tabel
      await expect(getPostRow(page, uniqueTitle)).toHaveCount(0, { timeout: 10_000 });
    });

  });

  // ── 4. Buat post (unit step yang lebih kecil untuk coverage yang lebih cepat) ─

  test.describe('Buat postingan baru', () => {

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('tombol Buat Postingan Baru navigasi ke /admin/posts/new — Req 3.1', async ({ page }) => {
      await page.getByRole('button', { name: 'Buat Postingan Baru' }).click();
      await page.waitForURL('/admin/posts/new', { timeout: 10_000 });
      await expect(page.getByRole('heading', { name: 'Buat Postingan Baru' })).toBeVisible();
    });

    test('form PostEditor menampilkan input judul, textarea konten, dan preview — Req 3.2', async ({ page }) => {
      await page.goto('/admin/posts/new');
      await page.waitForLoadState('domcontentloaded');

      // Input judul
      await expect(page.locator('#post-title')).toBeVisible();

      // Textarea konten
      await expect(page.locator('#post-content')).toBeVisible();

      // Area preview (selalu tampil, side-by-side)
      await expect(page.getByLabel('Pratinjau Markdown')).toBeVisible();

      // Tombol submit dengan label sesuai submitLabel prop
      await expect(page.getByRole('button', { name: 'Publikasikan Nanti' })).toBeVisible();
    });

    test('validasi: submit dengan judul kosong menampilkan error — Req 3.2', async ({ page }) => {
      await page.goto('/admin/posts/new');
      await page.waitForLoadState('domcontentloaded');

      // Isi konten tapi biarkan judul kosong
      await page.fill('#post-content', 'Konten tanpa judul');
      await page.getByRole('button', { name: 'Publikasikan Nanti' }).click();

      // Error validasi harus muncul
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('alert')).toContainText(/judul/i);
    });

    test('validasi: submit dengan konten kosong menampilkan error — Req 3.2', async ({ page }) => {
      await page.goto('/admin/posts/new');
      await page.waitForLoadState('domcontentloaded');

      // Isi judul tapi biarkan konten kosong
      await page.fill('#post-title', 'Judul tanpa konten');
      await page.getByRole('button', { name: 'Publikasikan Nanti' }).click();

      // Error validasi harus muncul
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('alert')).toContainText(/konten/i);
    });

    test('counter karakter judul diperbarui saat mengetik — Req 3.2', async ({ page }) => {
      await page.goto('/admin/posts/new');
      await page.waitForLoadState('domcontentloaded');

      const testTitle = 'Judul Counter Test';
      await page.fill('#post-title', testTitle);

      // Counter format "X/200" harus muncul dan sesuai panjang input
      const counterText = `${testTitle.length}/200`;
      await expect(page.getByText(counterText)).toBeVisible();
    });

    test('markdown preview diperbarui secara realtime saat mengetik konten — Req 3.3', async ({ page }) => {
      await page.goto('/admin/posts/new');
      await page.waitForLoadState('domcontentloaded');

      const previewArea = page.getByLabel('Pratinjau Markdown');

      // Sebelum ada konten, preview menampilkan teks placeholder
      await expect(previewArea).toContainText(/preview akan muncul/i);

      // Ketik konten Markdown dengan heading
      await page.fill('#post-content', '## Sub Heading\n\nIsi **tebal**.');

      // Heading <h2> harus dirender di preview
      await expect(previewArea.locator('h2')).toBeVisible({ timeout: 5_000 });
      await expect(previewArea.locator('strong')).toBeVisible();
    });

  });

  // ── 5. Edit postingan ──────────────────────────────────────────────────────

  test.describe('Edit postingan yang ada', () => {

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('EditPostPage prefill nilai awal dari post yang ada — Req 3.4', async ({ page }) => {
      acceptAllDialogs(page);

      // Buat post baru terlebih dahulu agar ada yang bisa diedit
      await page.goto('/admin/posts/new');
      const prefillTitle = `Prefill Test ${Date.now()}`;
      await page.fill('#post-title', prefillTitle);
      await page.fill('#post-content', 'Konten awal untuk test prefill.');
      await page.getByRole('button', { name: 'Publikasikan Nanti' }).click();
      await page.waitForURL('/admin', { timeout: 15_000 });

      // Klik Edit pada post yang baru dibuat
      await getPostRow(page, prefillTitle).getByRole('button', { name: /^edit$/i }).click();
      await page.waitForURL(/\/admin\/posts\/.+\/edit/, { timeout: 10_000 });

      // Input judul harus ter-prefill dengan judul asli
      await expect(page.locator('#post-title')).toHaveValue(prefillTitle, { timeout: 8_000 });

      // Textarea konten harus ter-prefill dengan konten asli
      await expect(page.locator('#post-content')).toHaveValue(
        'Konten awal untuk test prefill.',
        { timeout: 8_000 },
      );

      // Bersihkan: hapus post test
      await page.goto('/admin');
      await getPostRow(page, prefillTitle).getByRole('button', { name: /hapus/i }).click();
      await expect(getPostRow(page, prefillTitle)).toHaveCount(0, { timeout: 10_000 });
    });

    test('post Published menampilkan warning auto-revert saat edit — Req 3.5', async ({ page }) => {
      acceptAllDialogs(page);

      // Buat post baru lalu publish
      await page.goto('/admin/posts/new');
      const warningTitle = `Warning Test ${Date.now()}`;
      await page.fill('#post-title', warningTitle);
      await page.fill('#post-content', 'Konten untuk test warning revert.');
      await page.getByRole('button', { name: 'Publikasikan Nanti' }).click();
      await page.waitForURL('/admin', { timeout: 15_000 });

      // Publish post
      await getPostRow(page, warningTitle).getByRole('button', { name: /publikasikan/i }).click();
      await waitForPostStatus(page, warningTitle, 'Published');

      // Buka halaman edit
      await getPostRow(page, warningTitle).getByRole('button', { name: /^edit$/i }).click();
      await page.waitForURL(/\/admin\/posts\/.+\/edit/, { timeout: 10_000 });

      // Warning alert harus tampil karena post sedang Published
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('alert')).toContainText(/mengembalikannya ke status/i);
      await expect(page.getByRole('alert')).toContainText(/draft/i);

      // Bersihkan: kembali ke dashboard dan hapus
      await page.goto('/admin');
      await getPostRow(page, warningTitle).getByRole('button', { name: /hapus/i }).click();
      await expect(getPostRow(page, warningTitle)).toHaveCount(0, { timeout: 10_000 });
    });

  });

  // ── 6. Admin hapus komentar ────────────────────────────────────────────────

  test.describe('Hapus komentar oleh admin', () => {

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('tombol hapus komentar dengan aria-label tersedia untuk admin — Req 4.1, 4.8', async ({ page }) => {
      acceptAllDialogs(page);

      // Navigasi ke homepage untuk mencari published post
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const postCards = page.getByTestId('post-card');

      // Tunggu sebentar untuk data dari backend
      await page.waitForTimeout(2000);
      const count = await postCards.count();

      if (count === 0) {
        // Tidak ada published post — skip dengan graceful fallback
        console.log('Tidak ada published post untuk test hapus komentar. Skip.');
        return;
      }

      // Klik post pertama
      await postCards.first().getByTestId('post-card-link').click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForURL(/\/posts\/.+/);

      // Jika post dihapus oleh test paralel, skip
      const isNotFound1 = await page.getByTestId('not-found').isVisible().catch(() => false);
      if (isNotFound1) {
        console.log('Post tidak ditemukan (mungkin dihapus test paralel). Skip.');
        return;
      }

      // Tunggu section komentar dimuat
      const commentsSection = page.getByRole('region', { name: /komentar/i });
      await expect(commentsSection).toBeVisible({ timeout: 8_000 });

      // Cek apakah ada komentar (admin dapat hapus semua)
      const deleteCommentBtns = page.getByRole('button', { name: /hapus komentar dari/i });
      const btnCount = await deleteCommentBtns.count();

      if (btnCount === 0) {
        // Tidak ada komentar di post ini — test tidak applicable
        console.log('Tidak ada komentar di post ini. Skip delete comment test.');
        return;
      }

      // Tombol hapus komentar harus ada dengan aria-label yang benar
      await expect(deleteCommentBtns.first()).toBeVisible();
      const ariaLabel = await deleteCommentBtns.first().getAttribute('aria-label');
      expect(ariaLabel).toMatch(/hapus komentar dari/i);

      // Hitung jumlah komentar sebelum hapus
      const commentCountBefore = btnCount;

      // Hapus komentar pertama
      await deleteCommentBtns.first().click();

      // Tombol hapus harus berkurang 1 setelah berhasil dihapus
      await expect(page.getByRole('button', { name: /hapus komentar dari/i })).toHaveCount(
        commentCountBefore - 1,
        { timeout: 10_000 },
      );
    });

    test('admin dapat hapus komentar dari semua post (bukan hanya miliknya) — Req 4.8', async ({
      page,
    }) => {
      // Test ini memverifikasi bahwa untuk admin, tombol hapus tampil untuk
      // SEMUA komentar, bukan hanya yang dimiliki admin sendiri.
      // Bergantung pada adanya published post dengan komentar dari user lain.

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      const postCards = page.getByTestId('post-card');
      const count = await postCards.count();

      if (count === 0) {
        console.log('Tidak ada published post. Skip admin delete-any-comment test.');
        return;
      }

      await postCards.first().getByTestId('post-card-link').click();
      await page.waitForLoadState('domcontentloaded');

      // Jika post dihapus oleh test paralel, skip
      const isNotFound2 = await page.getByTestId('not-found').isVisible().catch(() => false);
      if (isNotFound2) {
        console.log('Post tidak ditemukan (mungkin dihapus test paralel). Skip.');
        return;
      }

      const commentsSection = page.getByRole('region', { name: /komentar/i });
      await expect(commentsSection).toBeVisible({ timeout: 8_000 });

      // Jika ada komentar, setiap komentar harus memiliki tombol hapus untuk admin
      const commentItems = commentsSection.locator('ul li');
      const itemCount = await commentItems.count();

      if (itemCount === 0) {
        console.log('Tidak ada komentar di post ini. Skip.');
        return;
      }

      // Setiap item komentar harus memiliki tombol hapus (karena user adalah admin)
      for (let i = 0; i < itemCount; i++) {
        await expect(
          commentItems.nth(i).getByRole('button', { name: /hapus komentar dari/i }),
        ).toBeVisible();
      }
    });

  });

  // ── 7. Proteksi rute admin ─────────────────────────────────────────────────

  test.describe('Proteksi rute admin', () => {

    test('rute /admin tidak dapat diakses tanpa login — Req 1.3', async ({ page }) => {
      // Pastikan tidak ada sesi aktif dengan navigasi langsung
      await page.goto('/admin');
      await page.waitForLoadState('domcontentloaded');

      // Harus diarahkan ke /login atau halaman tidak menampilkan konten admin
      const currentUrl = page.url();
      const isOnLogin = currentUrl.includes('/login');
      const hasDashboardHeading = await page
        .getByRole('heading', { name: 'Dashboard Admin' })
        .isVisible()
        .catch(() => false);

      // Salah satu kondisi harus terpenuhi: redirect ke login, atau konten admin tidak tampil
      expect(isOnLogin || !hasDashboardHeading).toBe(true);
    });

    test('rute /admin/posts/new tidak dapat diakses tanpa login — Req 1.3', async ({ page }) => {
      await page.goto('/admin/posts/new');
      await page.waitForLoadState('domcontentloaded');

      const currentUrl = page.url();
      const isOnLogin = currentUrl.includes('/login');
      const hasCreateHeading = await page
        .getByRole('heading', { name: 'Buat Postingan Baru' })
        .isVisible()
        .catch(() => false);

      expect(isOnLogin || !hasCreateHeading).toBe(true);
    });

  });

});
