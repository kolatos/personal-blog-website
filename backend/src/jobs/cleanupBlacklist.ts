import cron from 'node-cron';
import prisma from '../lib/prisma.js';

/**
 * Menghapus entri token_blacklist yang sudah kedaluwarsa (expires_at < NOW()).
 * Dipanggil secara periodik oleh cronjob.
 */
async function deleteExpiredTokens(): Promise<void> {
  try {
    const result = await prisma.tokenBlacklist.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      // eslint-disable-next-line no-console
      console.log(`[cleanupBlacklist] Berhasil menghapus ${result.count} token kedaluwarsa.`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[cleanupBlacklist] Gagal menghapus token kedaluwarsa:', error);
  }
}

/**
 * Memulai cronjob pembersihan token blacklist.
 * Berjalan setiap 1 jam (pada menit ke-0 setiap jam).
 */
export function startCleanupJob(): void {
  // Jalankan sekali saat startup untuk membersihkan token lama
  void deleteExpiredTokens();

  // Jadwalkan setiap jam: "0 * * * *"
  cron.schedule('0 * * * *', () => {
    void deleteExpiredTokens();
  });

  // eslint-disable-next-line no-console
  console.log('[cleanupBlacklist] Cronjob pembersihan token blacklist dimulai (setiap 1 jam).');
}
