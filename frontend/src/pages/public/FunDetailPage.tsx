import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFunPostBySlug } from '../../api/fun';
import { getComments, deleteComment } from '../../api/comments';
import type { Comment } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { CommentList } from '../../components/blog/CommentList';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';
import { TagChip } from '../../components/shared/TagChip';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  text: 'Tulisan',
  review: 'Ulasan',
  image: 'Gambar',
  drawing: 'Drawing',
  music: 'Musik',
  interactive: 'Interaktif',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Memuat konten...">
      <div className="h-8 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-1/4" />
      <div className="space-y-2 mt-6">
        <div className="h-4 bg-muted rounded" />
        <div className="h-4 bg-muted rounded" />
        <div className="h-4 bg-muted rounded w-5/6" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="text-center py-16 space-y-4" data-testid="not-found">
      <p className="text-6xl font-bold text-muted-foreground" aria-hidden="true">404</p>
      <h1 className="text-2xl font-semibold text-foreground">Postingan tidak ditemukan</h1>
      <p className="text-muted-foreground">
        Postingan yang kamu cari tidak ada atau belum dipublikasikan.
      </p>
      <Link
        to="/fun"
        className="inline-block mt-4 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        ← Kembali ke Fun
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FunDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);

  const {
    data: post,
    isLoading: postLoading,
    isError: postError,
  } = useQuery({
    queryKey: ['fun-post', slug],
    queryFn: () => getFunPostBySlug(slug!),
    enabled: !!slug,
    retry: false,
  });

  const { data: fetchedComments } = useQuery({
    queryKey: ['comments', 'fun', post?.id],
    queryFn: () => getComments('fun', post!.id),
    enabled: !!post?.id,
  });

  useEffect(() => {
    if (fetchedComments) setLocalComments(fetchedComments);
  }, [fetchedComments]);

  const totalCommentCount = localComments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length ?? 0),
    0,
  );

  function handleCommentAdded(comment: Comment) {
    if (comment.parentId) {
      setLocalComments((prev) =>
        prev.map((c) =>
          c.id === comment.parentId
            ? { ...c, replies: [...(c.replies ?? []), comment] }
            : c,
        ),
      );
    } else {
      setLocalComments((prev) => [...prev, { ...comment, replies: [] }]);
    }
    void queryClient.invalidateQueries({
      queryKey: ['comments', 'fun', post?.id],
    });
  }

  async function handleDeleteComment(commentId: string) {
    if (!post) return;
    setDeletingId(commentId);
    try {
      await deleteComment(commentId);
      setLocalComments((prev) => {
        const withoutTop = prev.filter((c) => c.id !== commentId);
        return withoutTop.map((c) => ({
          ...c,
          replies: (c.replies ?? []).filter((r) => r.id !== commentId),
        }));
      });
    } finally {
      setDeletingId(undefined);
    }
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (postLoading) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <LoadingSkeleton />
      </main>
    );
  }

  if (postError || !post) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <NotFound />
      </main>
    );
  }

  const publishedDate = formatDate(post.publishedAt);
  const isMedia = post.type === 'image' || post.type === 'drawing';
  const isMusic = post.type === 'music';

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/fun" data-testid="back-to-fun">
            ← Kembali ke Fun
          </Link>
        </Button>
      </div>

      <article data-testid="fun-article">
        {/* Media display */}
        {isMedia && post.mediaUrl && (
          <div className="mb-6 overflow-hidden rounded-lg bg-muted" data-testid="fun-detail-media">
            <img
              src={post.mediaUrl}
              alt={post.title}
              className="h-auto w-full object-contain max-h-[600px]"
            />
          </div>
        )}

        <header className="mb-6">
          <div className="flex items-start gap-3 mb-2">
            <h1
              className="text-3xl font-bold text-foreground leading-tight flex-1"
              data-testid="fun-detail-title"
            >
              {post.title}
            </h1>
            <Badge variant="outline" className="shrink-0 mt-1" data-testid="fun-detail-type">
              {TYPE_LABELS[post.type] ?? post.type}
            </Badge>
          </div>

          <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
            {publishedDate && (
              <time dateTime={post.publishedAt ?? ''}>{publishedDate}</time>
            )}
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3" data-testid="fun-detail-tags">
              {post.tags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} />
              ))}
            </div>
          )}

          {/* Music link */}
          {isMusic && post.mediaUrl && (
            <div className="mt-4">
              <a
                href={post.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline underline-offset-2"
                data-testid="fun-detail-music-link"
              >
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
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                Dengarkan
              </a>
            </div>
          )}
        </header>

        {/* Content — rendered with KaTeX support */}
        <MarkdownRenderer content={post.content} />
      </article>

      {/* Divider */}
      <hr className="border-border my-8" />

      {/* Comments section */}
      <section
        aria-labelledby="fun-comments-heading"
        data-testid="fun-comments-section"
      >
        <h2
          id="fun-comments-heading"
          className="text-xl font-semibold text-foreground mb-6"
        >
          Komentar ({totalCommentCount})
        </h2>

        <CommentList
          contentType="fun"
          contentId={post.id}
          comments={localComments}
          currentUserId={user?.id}
          currentUserRole={user?.role}
          onDeleteComment={handleDeleteComment}
          onCommentAdded={handleCommentAdded}
          isDeletingId={deletingId}
          isAuthenticated={!!user}
        />

        {!user && (
          <p className="text-sm text-muted-foreground mt-4">
            <Link
              to="/login"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              Login
            </Link>{' '}
            untuk memberikan komentar.
          </p>
        )}
      </section>
    </main>
  );
}
