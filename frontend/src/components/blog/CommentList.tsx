import { useState, useRef } from 'react';
import type { Comment } from '../../types';
import { Button } from '../ui/button';
import { CommentForm } from './CommentForm';

interface CommentListProps {
  contentType: string;
  contentId: string;
  comments: Comment[];
  currentUserId?: string;
  currentUserRole?: 'admin' | 'user';
  onDeleteComment: (commentId: string) => void;
  onCommentAdded: (comment: Comment) => void;
  isDeletingId?: string;
  isAuthenticated?: boolean;
}

/** Formats a date string using Indonesian locale. */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

function ReplyIcon() {
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
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

interface CommentItemProps {
  comment: Comment;
  contentType: string;
  contentId: string;
  currentUserId?: string;
  currentUserRole?: 'admin' | 'user';
  onDeleteComment: (commentId: string) => void;
  onCommentAdded: (comment: Comment) => void;
  isDeletingId?: string;
  isAuthenticated?: boolean;
  /** Called when user clicks Reply on a nested reply — fills the top-level form */
  onReplyToReply?: (authorUsername: string) => void;
}

function CommentItem({
  comment,
  contentType,
  contentId,
  currentUserId,
  currentUserRole,
  onDeleteComment,
  onCommentAdded,
  isDeletingId,
  isAuthenticated,
  onReplyToReply,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  const canDelete =
    currentUserId === comment.authorId || currentUserRole === 'admin';
  const isDeleting = isDeletingId === comment.id;
  const isReply = comment.parentId !== null;

  function handleReplyClick() {
    if (isReply) {
      // Replying to a reply: fill the top-level form with @mention instead of
      // opening a deeper inline form.
      onReplyToReply?.(comment.authorUsername);
    } else {
      setShowReplyForm((prev) => !prev);
    }
  }

  function handleReplyAdded(newComment: Comment) {
    setShowReplyForm(false);
    onCommentAdded(newComment);
  }

  return (
    <div
      className="border border-border rounded-lg p-4 bg-card"
      data-testid={isReply ? 'reply-item' : 'comment-item'}
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

        <div className="flex items-center gap-2 shrink-0">
          {/* Reply button — visible to authenticated users */}
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReplyClick}
              aria-label={`Balas komentar dari ${comment.authorUsername}`}
              data-testid="reply-button"
            >
              <span className="flex items-center gap-1.5">
                <ReplyIcon />
                Balas
              </span>
            </Button>
          )}

          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDeleteComment(comment.id)}
              disabled={isDeleting}
              aria-label={`Hapus komentar dari ${comment.authorUsername}`}
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
      </div>

      {/* Inline reply form — only for top-level comments */}
      {!isReply && showReplyForm && isAuthenticated && (
        <div className="mt-4" data-testid="inline-reply-form">
          <CommentForm
            contentType={contentType}
            contentId={contentId}
            parentId={comment.id}
            parentAuthorUsername={comment.authorUsername}
            onCommentAdded={handleReplyAdded}
            onCancel={() => setShowReplyForm(false)}
          />
        </div>
      )}

      {/* Nested replies — indented */}
      {comment.replies && comment.replies.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3 ml-8" data-testid="replies-list">
          {comment.replies.map((reply) => (
            <li key={reply.id}>
              <CommentItem
                comment={reply}
                contentType={contentType}
                contentId={contentId}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onDeleteComment={onDeleteComment}
                onCommentAdded={onCommentAdded}
                isDeletingId={isDeletingId}
                isAuthenticated={isAuthenticated}
                onReplyToReply={onReplyToReply}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentList({
  contentType,
  contentId,
  comments,
  currentUserId,
  currentUserRole,
  onDeleteComment,
  onCommentAdded,
  isDeletingId,
  isAuthenticated,
}: CommentListProps) {
  /**
   * `topLevelPrefill` holds an @mention string to prefill the page-level
   * CommentForm when a user replies to a nested reply.
   */
  const [topLevelPrefill, setTopLevelPrefill] = useState<string | undefined>(
    undefined,
  );
  const topLevelFormRef = useRef<HTMLDivElement>(null);

  function handleReplyToReply(authorUsername: string) {
    setTopLevelPrefill(`@${authorUsername} `);
    // Scroll to the top-level comment form
    topLevelFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  if (comments.length === 0) {
    return (
      <>
        <p className="text-muted-foreground text-sm py-4 text-center">
          Belum ada komentar. Jadilah yang pertama!
        </p>
        {isAuthenticated && (
          <div ref={topLevelFormRef} className="mt-4" data-testid="top-level-form-area">
            <CommentForm
              contentType={contentType}
              contentId={contentId}
              prefillContent={topLevelPrefill}
              onPrefillConsumed={() => setTopLevelPrefill(undefined)}
              onCommentAdded={onCommentAdded}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-4">
        {comments.map((comment) => (
          <li key={comment.id}>
            <CommentItem
              comment={comment}
              contentType={contentType}
              contentId={contentId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onDeleteComment={onDeleteComment}
              onCommentAdded={onCommentAdded}
              isDeletingId={isDeletingId}
              isAuthenticated={isAuthenticated}
              onReplyToReply={handleReplyToReply}
            />
          </li>
        ))}
      </ul>

      {isAuthenticated && (
        <div ref={topLevelFormRef} className="mt-6" data-testid="top-level-form-area">
          <CommentForm
            contentType={contentType}
            contentId={contentId}
            prefillContent={topLevelPrefill}
            onPrefillConsumed={() => setTopLevelPrefill(undefined)}
            onCommentAdded={onCommentAdded}
          />
        </div>
      )}
    </>
  );
}

export { CommentList };
export type { CommentListProps };
