import type { Post } from '../../types';
import { PostCard } from './PostCard';
import { Pagination } from '../ui/Pagination';

interface PostListProps {
  posts: Post[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

/**
 * Renders a list of PostCard items with pagination.
 * Shows skeleton placeholders while loading.
 */
function PostList({ posts, currentPage, totalPages, onPageChange, isLoading = false }: PostListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Memuat postingan">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-lg p-6 animate-pulse"
            aria-hidden="true"
          >
            <div className="h-5 bg-muted rounded w-3/4 mb-3" />
            <div className="h-4 bg-muted rounded w-full mb-2" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-12" data-testid="empty-posts">
        Belum ada postingan yang dipublikasikan.
      </p>
    );
  }

  return (
    <div className="space-y-6" data-testid="post-list">
      <ul className="space-y-4 list-none p-0">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex justify-center pt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

export { PostList };
export type { PostListProps };
