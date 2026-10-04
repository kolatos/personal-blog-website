import { useQuery } from '@tanstack/react-query';
import { getPublishedPosts } from '../api/posts';

const PAGE_SIZE = 10;

/**
 * Hook to fetch paginated published posts.
 * Query key: ['posts', page] — automatically refetches when page changes.
 */
export function usePosts(page: number) {
  return useQuery({
    queryKey: ['posts', page],
    queryFn: () => getPublishedPosts(page, PAGE_SIZE),
  });
}
