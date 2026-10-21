import { useQuery } from '@tanstack/react-query';
import { getPublishedFunPosts } from '../api/fun';

const PAGE_SIZE = 10;

/**
 * Hook untuk mengambil daftar fun post published yang dipaginasi.
 * Mendukung filter type dan tag (AND condition).
 * Query key: ['fun', page, type, tag] — otomatis refetch saat filter berubah.
 */
export function useFun(page: number, type?: string, tag?: string) {
  return useQuery({
    queryKey: ['fun', page, type ?? null, tag ?? null],
    queryFn: () => getPublishedFunPosts(page, PAGE_SIZE, type, tag),
  });
}
