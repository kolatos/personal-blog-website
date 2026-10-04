/**
 * Global setup untuk Playwright E2E tests.
 *
 * Mereset login_attempts di database sebelum test suite berjalan,
 * agar tes yang menggunakan akun statis (someone@test.com) tidak
 * terkena account lockout dari run sebelumnya.
 */
async function globalSetup() {
  try {
    const res = await fetch('http://localhost:3001/api/auth/test/reset-lockout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      console.log('[global-setup] login_attempts reset berhasil');
    } else {
      console.warn('[global-setup] reset endpoint returned', res.status);
    }
  } catch (e) {
    console.warn('[global-setup] tidak dapat menghubungi backend:', e);
  }
}

export default globalSetup;
