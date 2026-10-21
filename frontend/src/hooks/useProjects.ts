import { useQuery } from '@tanstack/react-query';
import { getPublishedProjects } from '../api/projects';

const PAGE_SIZE = 10;

/**
 * Hook untuk mengambil daftar project published yang dipaginasi.
 * Query key: ['projects', page] — otomatis refetch saat page berubah.
 */
export function useProjects(page: number) {
  return useQuery({
    queryKey: ['projects', page],
    queryFn: () => getPublishedProjects(page, PAGE_SIZE),
  });
}
