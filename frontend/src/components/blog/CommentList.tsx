import type { Comment } from '../../types';
import { Button } from '../ui/Button';

interface CommentListProps {
  postId: string;
  comments: Comment[];
  currentUserId?: string;
  currentUserRole?: 'admin' | 'user';
  onDeleteComment: (commentId: string) => void;
  isDeletingId?: string;
}

/**
 * Formats a date string using Indonesian locale.
 * e.g., "14 Januari 2025, 10:30"
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Trash icon SVG
function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function CommentList({
  comments,
  currentUserId,
  currentUserRole,
  onDeleteComment,
  isDeletingId,
}: CommentListProps) {
  if (comments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4 text-center">
        Belum ada komentar. Jadilah yang pertama!
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {comments.map((comment) => {
        const canDelete =
          currentUserId === comment.authorId || currentUserRole === 'admin';
        const isDeleting = isDeletingId === comment.id;

        return (
          <li
            key={comment.id}
            className="border border-border rounded-lg p-4 bg-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">
                    {comment.authorUsername}
                  </span>
                  <time
                    dateTime={comment.createdAt}
                    className="text-xs text-muted-foreground"
                  >
                    {formatDate(comment.createdAt)}
                  </time>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {comment.content}
                </p>
              </div>

              {canDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDeleteComment(comment.id)}
                  disabled={isDeleting}
                  aria-label={`Hapus komentar dari ${comment.authorUsername}`}
                  className="shrink-0"
                >
                  {isDeleting ? (
                    <span className="flex items-center gap-1.5">
                      <svg
                        className="animate-spin h-4 w-4"
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
                      Menghapus...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <TrashIcon />
                      Hapus
                    </span>
                  )}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export { CommentList };
export type { CommentListProps };
