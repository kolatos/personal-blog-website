import prisma from '../lib/prisma.js';

// ─── Error helper ─────────────────────────────────────────────────────────────

function createError(
  status: number,
  code: string,
  message: string
): Error & { status: number; code: string } {
  const err = new Error(message) as Error & { status: number; code: string };
  err.status = status;
  err.code = code;
  return err;
}

// ─── SubscriptionService ─────────────────────────────────────────────────────

/**
 * Berlangganan notifikasi post baru untuk user yang diberikan.
 *
 * Throws 409 ALREADY_SUBSCRIBED jika user sudah berlangganan
 * (unique constraint pada userId terpicu).
 *
 * Requirements: 6.1 (Property 4: Subscription Uniqueness)
 */
export async function subscribe(userId: string): Promise<{ subscribed: true }> {
  try {
    await prisma.subscription.create({
      data: { userId },
    });
    return { subscribed: true };
  } catch (err: unknown) {
    // Prisma unique constraint violation: P2002
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') {
      throw createError(409, 'ALREADY_SUBSCRIBED', 'User is already subscribed');
    }
    throw err;
  }
}

/**
 * Berhenti berlangganan untuk user yang diberikan.
 *
 * Throws 404 NOT_SUBSCRIBED jika subscription tidak ditemukan.
 *
 * Requirements: 6.2
 */
export async function unsubscribe(userId: string): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!existing) {
    throw createError(404, 'NOT_SUBSCRIBED', 'User is not subscribed');
  }

  await prisma.subscription.delete({ where: { userId } });
}

/**
 * Mengecek status langganan untuk user yang diberikan.
 *
 * Requirements: 6.3
 */
export async function getStatus(userId: string): Promise<{ subscribed: boolean }> {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
  });
  return { subscribed: existing !== null };
}

/**
 * Mengembalikan semua email subscriber aktif.
 * Di-join dengan tabel users untuk mendapatkan email.
 *
 * Digunakan oleh publishPost untuk mengirim notifikasi email.
 *
 * Requirements: 6.4
 */
export async function getAllSubscriberEmails(): Promise<string[]> {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      user: {
        select: { email: true },
      },
    },
  });
  return subscriptions.map((s) => s.user.email);
}
