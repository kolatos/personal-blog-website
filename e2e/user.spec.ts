import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests untuk Registered_User flow â€” Personal Blog Website
 *
 * Mencakup Requirements 2.1â€“2.6, 6.1â€“6.7, 8.1â€“8.3:
 * 2.x Register: validasi form, konflik email/username, sukses â†’ redirect ke login
 * 6.x Login/Logout: kredensial valid, salah password, redirect berdasarkan role
 * 8.x Profil: lihat info, update username, konflik username
 *
 * Serta komentar (Requirements tidak bernomor secara eksplisit di sini):
 * - Menambah komentar pada post yang dipublikasi
 * - Validasi komentar kosong
 * - Menghapus komentar milik sendiri
 *
 * Jalankan dev server + backend secara manual sebelum test:
 *   cd frontend && npm run dev
 *   cd backend && npx ts-node src/index.ts (atau sesuai setup)
 * Kemudian dari root:
 *   npx playwright test e2e/user.spec.ts
 */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Generate data unik per test run untuk menghindari konflik antar-run */
let _userCounter = 0;
function uniqueUser() {
  const worker = process.env.PLAYWRIGHT_TEST_WORKER_INDEX ?? '0';
  const ts = Date.now().toString();
  const suffix = ts + 'w' + worker + 'c' + (++_userCounter).toString();
  return {
    username: 'testuser' + suffix,
    email: 'testuser' + suffix + '@test.com',
    password: 'Password123!',
  };
}
/** Isi form login dan submit â€” menunggu navigasi selesai */
async function loginAsUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: /^masuk$/i }).click();
  // Tunggu redirect ke homepage (user role) â€” bukan /admin
  await page.waitForURL('/', { timeout: 10_000 });
}

/** Tunggu hingga loading state (skeleton) hilang */
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  try {
    await page.locator('[aria-busy="true"]').waitFor({ state: 'hidden', timeout: 8_000 });
  } catch {
    // Tidak ada skeleton, lanjut
  }
}

/** Cek apakah ada post yang bisa dikunjungi dari homepage */
async function getFirstPostSlug(page: Page): Promise<string | null> {
  await page.goto('/');
  await waitForPageReady(page);

  const postCards = page.getByTestId('post-card');
  const count = await postCards.count();
  if (count === 0) return null;

  const link = postCards.first().getByTestId('post-card-link');
  const href = await link.getAttribute('href');
  return href ?? null; // e.g. "/posts/my-post-slug"
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Test suite
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

test.describe('Registered_User flow', () => {

  // â”€â”€ 1. Register flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  test.describe('Register', () => {

    test('register sukses dengan data valid â†’ redirect ke /login â€” Req 2.1, 2.2', async ({ page }) => {
      const user = uniqueUser();

      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('#username', user.username);
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();

      // Pesan sukses harus muncul sebelum redirect
      await expect(page.getByRole('status')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('status')).toContainText(/berhasil/i);

      // Setelah pesan sukses, diarahkan ke /login
      await page.waitForURL('/login', { timeout: 10_000 });
      await expect(page).toHaveURL('/login');
    });

    test('register dengan email yang sudah terdaftar â†’ error konflik pada field email â€” Req 2.3', async ({ page }) => {
      const user = uniqueUser();

      // Daftar pertama kali
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      await page.fill('#username', user.username);
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();

      // Tunggu redirect ke login (register sukses)
      await page.waitForURL('/login', { timeout: 10_000 });

      // Coba daftar lagi dengan email yang sama
      const anotherUsername = `other${Date.now()}`;
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      await page.fill('#username', anotherUsername);
      await page.fill('#email', user.email); // email sama
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();

      // Harus ada pesan error (field error atau server error) â€” 409 conflict
      // Field error muncul di bawah input, atau serverError di atas form
      const hasFieldError = await page.locator('#email ~ p.text-destructive, #email + p').isVisible().catch(() => false);
      const hasServerError = await page.getByRole('alert').isVisible().catch(() => false);
      // Either a field-level or top-level error must appear, and we stay on /register
      expect(hasFieldError || hasServerError).toBe(true);
      await expect(page).toHaveURL('/register');
    });

    test('password kurang dari 8 karakter â†’ validasi client-side sebelum submit â€” Req 2.2', async ({ page }) => {
      const user = uniqueUser();

      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('#username', user.username);
      await page.fill('#email', user.email);
      await page.fill('#password', 'short'); // < 8 chars
      await page.getByRole('button', { name: /^daftar$/i }).click();

      // Tetap di halaman register â€” tidak ada redirect
      await expect(page).toHaveURL('/register');

      // Error validasi client-side harus tampil
      const passwordError = page.locator('#password ~ p, #password + p');
      await expect(passwordError.first()).toBeVisible({ timeout: 3_000 });
      await expect(passwordError.first()).toContainText(/minimal 8 karakter/i);
    });

    test('username terlalu pendek (< 3 karakter) â†’ validasi client-side â€” Req 2.2', async ({ page }) => {
      const user = uniqueUser();

      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('#username', 'ab'); // < 3 chars
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();

      await expect(page).toHaveURL('/register');

      const usernameError = page.locator('#username ~ p, #username + p');
      await expect(usernameError.first()).toBeVisible({ timeout: 3_000 });
      await expect(usernameError.first()).toContainText(/minimal 3 karakter/i);
    });

    test('email format tidak valid â†’ validasi client-side â€” Req 2.2', async ({ page }) => {
      const user = uniqueUser();

      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('#username', user.username);
      await page.fill('#email', 'bukan-email'); // format tidak valid
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();

      await expect(page).toHaveURL('/register');

      const emailError = page.locator('#email ~ p, #email + p');
      await expect(emailError.first()).toBeVisible({ timeout: 3_000 });
      await expect(emailError.first()).toContainText(/format email/i);
    });

  });

  // â”€â”€ 2. Login flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  test.describe('Login', () => {

    test('login dengan kredensial valid â†’ redirect ke / â€” Req 6.1, 6.2', async ({ page }) => {
      // Register dulu untuk mendapat akun valid
      const user = uniqueUser();
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      await page.fill('#username', user.username);
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();
      await page.waitForURL('/login', { timeout: 10_000 });

      // Login dengan akun yang baru didaftarkan
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^masuk$/i }).click();

      // User biasa diarahkan ke homepage
      await page.waitForURL('/', { timeout: 10_000 });
      await expect(page).toHaveURL('/');

      // Navbar seharusnya menampilkan "Profil" dan "Keluar" (bukan "Masuk"/"Daftar")
      await expect(page.getByRole('link', { name: /^profil$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^keluar$/i })).toBeVisible();
    });

    test('login dengan password salah â†’ error alert â€” Req 6.3', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      await page.fill('#email', 'someone@test.com');
      await page.fill('#password', 'WrongPassword123!');
      await page.getByRole('button', { name: /^masuk$/i }).click();

      // Error alert harus muncul
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('alert')).toContainText(/email atau password salah/i);

      // Tetap di halaman login
      await expect(page).toHaveURL('/login');
    });

    test('logout setelah login â†’ kembali ke state guest â€” Req 6.5', async ({ page }) => {
      // Register + login
      const user = uniqueUser();
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      await page.fill('#username', user.username);
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();
      await page.waitForURL('/login', { timeout: 10_000 });

      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^masuk$/i }).click();
      await page.waitForURL('/', { timeout: 10_000 });

      // Klik tombol "Keluar"
      await page.getByRole('button', { name: /^keluar$/i }).click();
      await waitForPageReady(page);

      // Setelah logout, tombol "Masuk" dan "Daftar" harus muncul kembali
      await expect(page.getByRole('link', { name: /^masuk$/i })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('link', { name: /^daftar$/i })).toBeVisible({ timeout: 5_000 });
    });

  });

  // â”€â”€ 3. Comment flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  test.describe('Komentar', () => {

    /**
     * Helper: register user baru, login, kembalikan data user
     */
    async function registerAndLogin(page: Page) {
      const user = uniqueUser();
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      await page.fill('#username', user.username);
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();
      await page.waitForURL('/login', { timeout: 10_000 });
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^masuk$/i }).click();
      await page.waitForURL('/', { timeout: 10_000 });
      return user;
    }

    test('form komentar muncul untuk user yang login â€” Req 2.4', async ({ page }) => {
      const user = await registerAndLogin(page);

      const postHref = await getFirstPostSlug(page);
      if (!postHref) {
        test.skip(true, 'Tidak ada post yang dipublikasi â€” skip test komentar');
        return;
      }

      await page.goto(postHref);
      await waitForPageReady(page);

      // CommentForm harus tampil: textarea dan tombol submit
      await expect(page.locator('#comment-content')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('button', { name: /kirim komentar/i })).toBeVisible();

      // Tidak ada pesan "Login untuk memberikan komentar" (hanya untuk guest)
      await expect(page.getByText(/login untuk memberikan komentar/i)).not.toBeVisible();
    });

    test('mengirim komentar kosong â†’ validasi error "Komentar tidak boleh kosong" â€” Req 2.4', async ({ page }) => {
      await registerAndLogin(page);

      const postHref = await getFirstPostSlug(page);
      if (!postHref) {
        test.skip(true, 'Tidak ada post yang dipublikasi â€” skip test komentar');
        return;
      }

      await page.goto(postHref);
      await waitForPageReady(page);
      await expect(page.locator('#comment-content')).toBeVisible({ timeout: 8_000 });

      // Submit tanpa mengisi komentar
      await page.getByRole('button', { name: /kirim komentar/i }).click();

      // Pesan validasi harus muncul
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('alert')).toContainText(/komentar tidak boleh kosong/i);
    });

    test('submit komentar valid â†’ komentar muncul di daftar â€” Req 2.4, 2.5', async ({ page }) => {
      const user = await registerAndLogin(page);

      const postHref = await getFirstPostSlug(page);
      if (!postHref) {
        test.skip(true, 'Tidak ada post yang dipublikasi â€” skip test komentar');
        return;
      }

      await page.goto(postHref);
      await waitForPageReady(page);
      await expect(page.locator('#comment-content')).toBeVisible({ timeout: 8_000 });

      const commentText = `Komentar test ${Date.now()}`;
      await page.fill('#comment-content', commentText);
      await page.getByRole('button', { name: /kirim komentar/i }).click();

      // Komentar baru harus muncul di daftar dengan teks yang benar
      const commentList = page.locator('ul').filter({ has: page.locator('li') });
      await expect(
        commentList.getByText(commentText)
      ).toBeVisible({ timeout: 8_000 });

      // Username harus muncul di komentar tersebut
      await expect(page.getByText(user.username)).toBeVisible();
    });

    test('hapus komentar milik sendiri â†’ komentar hilang dari daftar â€” Req 2.6', async ({ page }) => {
      const user = await registerAndLogin(page);

      const postHref = await getFirstPostSlug(page);
      if (!postHref) {
        test.skip(true, 'Tidak ada post yang dipublikasi â€” skip test komentar');
        return;
      }

      await page.goto(postHref);
      await waitForPageReady(page);
      await expect(page.locator('#comment-content')).toBeVisible({ timeout: 8_000 });

      // Tulis dan submit komentar
      const commentText = `Hapus test ${Date.now()}`;
      await page.fill('#comment-content', commentText);
      await page.getByRole('button', { name: /kirim komentar/i }).click();

      // Verifikasi komentar muncul dulu
      await expect(page.getByText(commentText)).toBeVisible({ timeout: 8_000 });

      // Klik tombol hapus untuk komentar milik user ini
      const deleteBtn = page.getByRole('button', {
        name: new RegExp(`hapus komentar dari ${user.username}`, 'i'),
      });
      await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
      await deleteBtn.click();

      // Komentar harus hilang dari daftar
      await expect(page.getByText(commentText)).not.toBeVisible({ timeout: 8_000 });
    });

    test('guest tidak dapat melihat form komentar â€” Req 2.4', async ({ page }) => {
      const postHref = await getFirstPostSlug(page);
      if (!postHref) {
        test.skip(true, 'Tidak ada post yang dipublikasi â€” skip test komentar');
        return;
      }

      // Akses post tanpa login
      await page.goto(postHref);
      await waitForPageReady(page);

      // Form komentar tidak boleh tampil
      await expect(page.locator('#comment-content')).not.toBeVisible();

      // Pesan "Login untuk memberikan komentar" harus ada
      await expect(
        page.getByRole('link', { name: /^login$/i })
      ).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(/untuk memberikan komentar/i)).toBeVisible();
    });

  });

  // â”€â”€ 4. Profile flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  test.describe('Profil', () => {

    /**
     * Register + login lalu navigasi ke /profile
     */
    async function goToProfile(page: Page) {
      const user = uniqueUser();
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      await page.fill('#username', user.username);
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();
      await page.waitForURL('/login', { timeout: 10_000 });
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^masuk$/i }).click();
      await page.waitForURL('/', { timeout: 10_000 });
      await page.goto('/profile');
      await waitForPageReady(page);
      return user;
    }

    test('halaman profil menampilkan informasi akun â€” Req 8.1', async ({ page }) => {
      const user = await goToProfile(page);

      // Heading "Profil" harus ada
      await expect(page.getByRole('heading', { name: /^profil$/i })).toBeVisible();

      // Username, email, dan tanggal bergabung harus tampil
      await expect(page.getByText(user.username, { exact: true })).toBeVisible();
      await expect(page.getByText(user.email, { exact: true })).toBeVisible();
      await expect(page.getByText(/bergabung sejak/i)).toBeVisible();
    });

    test('update username dengan nilai baru â†’ pesan sukses â€” Req 8.2', async ({ page }) => {
      await goToProfile(page);

      const newUsername = `updated${Date.now()}`;

      // Input username di form "Ubah Username"
      await page.fill('#username', newUsername);
      await page.getByRole('button', { name: /simpan username/i }).click();

      // Pesan sukses harus muncul
      await expect(page.getByRole('status')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('status')).toContainText(/username berhasil diperbarui/i);
    });

    test('update username dengan username yang sudah dipakai â†’ error 409 â€” Req 8.2, 8.3', async ({ page }) => {
      // Register dua user
      const user1 = uniqueUser();
      const user2 = { ...uniqueUser(), username: `u2${Date.now()}` };

      // Daftarkan user1
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      await page.fill('#username', user1.username);
      await page.fill('#email', user1.email);
      await page.fill('#password', user1.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();
      await page.waitForURL('/login', { timeout: 10_000 });

      // Daftarkan user2
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      await page.fill('#username', user2.username);
      await page.fill('#email', user2.email);
      await page.fill('#password', user2.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();
      await page.waitForURL('/login', { timeout: 10_000 });

      // Login sebagai user2
      await page.fill('#email', user2.email);
      await page.fill('#password', user2.password);
      await page.getByRole('button', { name: /^masuk$/i }).click();
      await page.waitForURL('/', { timeout: 10_000 });

      // Coba ubah username menjadi username user1 (sudah dipakai)
      await page.goto('/profile');
      await waitForPageReady(page);
      await page.fill('#username', user1.username);
      await page.getByRole('button', { name: /simpan username/i }).click();

      // Error 409 harus muncul
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('alert')).toContainText(/username sudah digunakan/i);
    });

    test('halaman profil tidak dapat diakses tanpa login â€” Req 8.1', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForLoadState('domcontentloaded');

      // Harus diredirect ke /login (ProtectedRoute)
      await page.waitForURL('/login', { timeout: 8_000 });
      await expect(page).toHaveURL('/login');
    });

    test('link Profil di navbar mengarah ke /profile â€” Req 8.1', async ({ page }) => {
      // Login dulu
      const user = uniqueUser();
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      await page.fill('#username', user.username);
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^daftar$/i }).click();
      await page.waitForURL('/login', { timeout: 10_000 });
      await page.fill('#email', user.email);
      await page.fill('#password', user.password);
      await page.getByRole('button', { name: /^masuk$/i }).click();
      await page.waitForURL('/', { timeout: 10_000 });

      // Klik link "Profil" di navbar
      await page.getByRole('link', { name: /^profil$/i }).click();
      await page.waitForURL('/profile', { timeout: 8_000 });
      await expect(page).toHaveURL('/profile');
    });

  });

});
