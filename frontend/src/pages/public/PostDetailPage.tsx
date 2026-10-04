import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPostBySlug } from '../../api/posts';
import { getComments, deleteComment } from '../../api/comments';
import type { Comment } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { CommentList } from '../../components/blog/CommentList';
import { CommentForm } from '../../components/blog/CommentForm';

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
    queryKey: ['comments', post?.id],
    queryFn: () => getComments(post!.id),
    enabled: !!post?.id,
  });

  useEffect(() => {
    if (fetchedComments) setLocalComments(fetchedComments);
  }, [fetchedComments]);

  // Add a new comment optimistically
  function handleCommentAdded(comment: Comment) {
    setLocalComments((prev) => [...prev, comment]);
    // Invalidate so a background refetch stays in sync
    void queryClient.invalidateQueries({ queryKey: ['comments', post?.id] });
  }

  // Delete a comment by ID
  async function handleDeleteComment(commentId: string) {
    if (!post) return;
    setDeletingId(commentId);
    try {
      await deleteComment(post.id, commentId);
      setLocalComments((prev) => prev.filter((c) => c.id !== commentId));
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
      {/* Post header */}
      <article data-testid="post-article">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-foreground leading-tight mb-2" data-testid="post-title">
            {post.title}
          </h1>
          {publishedDate && (
            <time
              dateTime={post.publishedAt ?? undefined}
              className="text-sm text-muted-foreground"
            >
              {publishedDate}
            </time>
          )}
        </header>

        {/* Post body — rendered HTML from server */}
        <div
          className={[
            'text-foreground leading-relaxed',
            // Headings
            '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-3',
            '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-7 [&_h2]:mb-3',
            '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2',
            '[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-5 [&_h4]:mb-2',
            // Paragraphs
            '[&_p]:mb-4',
            // Lists
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4',
            '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4',
            '[&_li]:mb-1',
            // Blockquote
            '[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-4',
            // Code
            '[&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre]:text-sm',
            '[&_code]:bg-muted [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono',
            '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
            // Links
            '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:opacity-80',
            // Images
            '[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4',
            // Horizontal rule
            '[&_hr]:border-border [&_hr]:my-6',
            // Strong / em
            '[&_strong]:font-semibold',
            '[&_em]:italic',
          ].join(' ')}
          data-testid="post-content"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </article>

      {/* Divider */}
      <hr className="border-border my-8" />

      {/* Comments section */}
      <section aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="text-xl font-semibold text-foreground mb-6">
          Komentar ({localComments.length})
        </h2>

        <CommentList
          postId={post.id}
          comments={localComments}
          currentUserId={user?.id}
          currentUserRole={user?.role}
          onDeleteComment={handleDeleteComment}
          isDeletingId={deletingId}
        />

        <div className="mt-6">
          {user ? (
            <CommentForm postId={post.id} onCommentAdded={handleCommentAdded} />
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link to="/login" className="text-primary underline underline-offset-2 hover:opacity-80">
                Login
              </Link>{' '}
              untuk memberikan komentar.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
