import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSubscriptionStatus,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '../api/subscriptions';
import { useAuth } from './useAuth';

const QUERY_KEY = ['subscription-status'];

/**
 * Hook untuk mengelola status langganan email user yang sedang login.
 *
 * Hanya mengambil status jika user terotentikasi.
 * Setiap mutasi (subscribe/unsubscribe) menginvalidasi query secara otomatis.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.7
 */
export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getSubscriptionStatus,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const subscribeMutation = useMutation({
    mutationFn: subscribeToNewsletter,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: unsubscribeFromNewsletter,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const isMutating =
    subscribeMutation.isPending || unsubscribeMutation.isPending;

  return {
    subscribed: data?.subscribed ?? false,
    isLoading,
    subscribe: () => subscribeMutation.mutate(),
    unsubscribe: () => unsubscribeMutation.mutate(),
    isMutating,
  };
}
