import type { FunPost } from '../../types';
import { FunCard } from './FunCard';
import { Skeleton } from '../ui/skeleton';
import { Pagination } from '../ui/pagination';

interface FunFeedProps {
  posts: FunPost[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function FunFeedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-52 rounded-lg" data-testid="fun-card-skeleton" />
      ))}
    </div>
  );
}

function FunFeed({
  posts,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
}: FunFeedProps) {
  if (isLoading) {
    return <FunFeedSkeleton />;
  }

  if (posts.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground" data-testid="fun-empty-state">
        Tidak ada postingan yang cocok dengan filter yang dipilih.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="fun-feed-grid"
      >
        {posts.map((post) => (
          <FunCard key={post.id} post={post} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center">
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

export { FunFeed };
export type { FunFeedProps };
