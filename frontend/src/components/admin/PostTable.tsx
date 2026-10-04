import type { Post } from '../../types';
import { Button } from '../ui/Button';
import { StatusBadge } from './StatusBadge';

interface PostTableProps {
  posts: Post[];
  onEdit: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function PostTable({
  posts,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
  isLoading = false,
}: PostTableProps) {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-12 text-muted-foreground"
        aria-live="polite"
        aria-busy="true"
      >
        <svg
          className="animate-spin h-5 w-5 mr-2"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Memuat postingan...
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Belum ada postingan.
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th
              scope="col"
              className="px-4 py-3 text-left font-medium text-foreground"
            >
              Judul
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left font-medium text-foreground"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left font-medium text-foreground whitespace-nowrap"
            >
              Terakhir Diperbarui
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-medium text-foreground"
            >
              Aksi
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post, index) => (
            <tr
              key={post.id}
              className={[
                'border-b border-border transition-colors hover:bg-muted/50',
                index === posts.length - 1 ? 'border-b-0' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/* Title */}
              <td className="px-4 py-3 text-foreground">
                <span className="line-clamp-2 font-medium">{post.title}</span>
              </td>

              {/* Status badge */}
              <td className="px-4 py-3">
                <StatusBadge status={post.status} />
              </td>

              {/* Last updated */}
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {formatDate(post.updatedAt)}
              </td>

              {/* Action buttons */}
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(post.id)}
                  >
                    Edit
                  </Button>

                  {post.status === 'draft' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onPublish(post.id)}
                      aria-label={`Publikasikan postingan: ${post.title}`}
                    >
                      Publish
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUnpublish(post.id)}
                      aria-label={`Batalkan publikasi postingan: ${post.title}`}
                    >
                      Unpublish
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(post.id)}
                    aria-label={`Hapus postingan: ${post.title}`}
                  >
                    Hapus
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { PostTable };
export type { PostTableProps };
