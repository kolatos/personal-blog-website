import apiClient from './client';

/**
 * Mengambil status langganan user yang sedang login.
 * Requirements: 6.3, 6.7
 */
export async function getSubscriptionStatus(): Promise<{ subscribed: boolean }> {
  const res = await apiClient.get<{ subscribed: boolean }>('/api/subscriptions/status');
  return res.data;
}

/**
 * Mendaftarkan user yang sedang login untuk berlangganan.
 * Requirements: 6.1, 6.7
 */
export async function subscribeToNewsletter(): Promise<{ subscribed: true }> {
  const res = await apiClient.post<{ subscribed: true }>('/api/subscriptions');
  return res.data;
}

/**
 * Membatalkan langganan user yang sedang login.
 * Requirements: 6.2, 6.7
 */
export async function unsubscribeFromNewsletter(): Promise<void> {
  await apiClient.delete('/api/subscriptions');
}
