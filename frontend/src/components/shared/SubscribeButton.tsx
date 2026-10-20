import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { Button } from '../ui/button';

/**
 * Tombol subscribe/unsubscribe notifikasi post baru.
 *
 * - Tidak merender apa pun jika user tidak terotentikasi.
 * - Menampilkan "Subscribed" jika sudah berlangganan, "Subscribe" jika belum.
 * - Menampilkan loading state saat mutasi sedang berjalan.
 *
 * Requirements: 6.7
 */
export function SubscribeButton() {
  const { user } = useAuth();
  const { subscribed, isLoading, subscribe, unsubscribe, isMutating } =
    useSubscription();

  // Tidak merender apa pun jika user tidak terotentikasi
  if (!user) return null;

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <span className="animate-pulse">…</span>
      </Button>
    );
  }

  if (subscribed) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={unsubscribe}
        disabled={isMutating}
        data-testid="subscribe-button"
        aria-label="Berhenti berlangganan notifikasi post baru"
      >
        {isMutating ? (
          <span className="animate-pulse">…</span>
        ) : (
          '✓ Subscribed'
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={subscribe}
      disabled={isMutating}
      data-testid="subscribe-button"
      aria-label="Berlangganan notifikasi post baru"
    >
      {isMutating ? (
        <span className="animate-pulse">…</span>
      ) : (
        'Subscribe'
      )}
    </Button>
  );
}
