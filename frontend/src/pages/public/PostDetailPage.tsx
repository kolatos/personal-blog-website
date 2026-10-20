import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPostBySlug } from '../../api/posts';
import { getComments, deleteComment } from '../../api/comments';
import type { Comment } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { CommentList } from '../../components/blog/CommentList';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';
import { TagChip } from '../../components/shared/TagChip';
import { SubscribeButton } from '../../components/shared/SubscribeButton';
import { Button } from '../../components/ui/button';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
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
      <h1 className="text-2xl font-semibold text-foreground">
        Halaman tidak ditemukan
      </h1>
      <p className="text-muted-foreground">
        Postingan yang kamu cari tidak ada atau belum dipublikasikan.
      </p>
      <Link
        to="/"
        className="inline-block mt-4 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        ← Kembali ke Beranda
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);

  // Fetch post by slug
  const {
    data: post,
    isLoading: postLoading,
    isError: postError,
  } = useQuery({
    queryKey: ['post', slug],
    queryFn: () => getPostBySlug(slug!),
    enabled: !!slug,
    retry: false,
  });

  // Fetch comments — only after post is loaded; seed local state on success
  const { data: fetchedComments } = useQuery({
    queryKey: ['comments', 'post', post?.id],
    queryFn: () => getComments('post', post!.id),
    enabled: !!post?.id,
  });

  useEffect(() => {
    if (fetchedComments) setLocalComments(fetchedComments);
  }, [fetchedComments]);

  // Total comment count including all replies
  const totalCommentCount = localComments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length ?? 0),
    0,
  );

  // Add a new comment/reply
  function handleCommentAdded(comment: Comment) {
    if (comment.parentId) {
      // It's a reply — insert it into the parent's replies array
      setLocalComments((prev) =>
        prev.map((c) =>
          c.id === comment.parentId
            ? { ...c, replies: [...(c.replies ?? []), comment] }
            : c,
        ),
      );
    } else {
      // Top-level comment
      setLocalComments((prev) => [...prev, { ...comment, replies: [] }]);
    }
    void queryClient.invalidateQueries({ queryKey: ['comments', 'post', post?.id] });
  }

  // Delete a comment by ID (works for both top-level and replies)
  async function handleDeleteComment(commentId: string) {
    if (!post) return;
    setDeletingId(commentId);
    try {
      await deleteComment(commentId);
      setLocalComments((prev) => {
        // Remove top-level comment
        const withoutTop = prev.filter((c) => c.id !== commentId);
        // Remove from replies
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

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/" data-testid="back-to-blog">← Kembali ke Blog</Link>
        </Button>
      </div>

      {/* Post header */}
      <article data-testid="post-article">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-foreground leading-tight mb-2" data-testid="post-title">
            {post.title}
          </h1>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {publishedDate && (
              <time
                dateTime={post.publishedAt ?? ''}
                className="text-sm text-muted-foreground"
              >
                {publishedDate}
              </time>
            )}
            <SubscribeButton />
          </div>
          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3" data-testid="post-tags">
              {post.tags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} />
              ))}
            </div>
          )}
        </header>

        {/* Post body — rendered with KaTeX support */}
        <MarkdownRenderer content={post.content} />
      </article>

      {/* Divider */}
      <hr className="border-border my-8" />

      {/* Comments section */}
      <section aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="text-xl font-semibold text-foreground mb-6">
          Komentar ({totalCommentCount})
        </h2>

        <CommentList
          contentType="post"
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
