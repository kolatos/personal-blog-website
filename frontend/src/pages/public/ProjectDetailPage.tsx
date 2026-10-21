import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProjectBySlug } from '../../api/projects';
import { getComments, deleteComment } from '../../api/comments';
import type { Comment } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { CommentList } from '../../components/blog/CommentList';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';
import { TagChip } from '../../components/shared/TagChip';
import { Button } from '../../components/ui/button';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
      <div className="aspect-video bg-muted rounded-lg w-full" />
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
      <h1 className="text-2xl font-semibold text-foreground">Project tidak ditemukan</h1>
      <p className="text-muted-foreground">
        Project yang kamu cari tidak ada atau belum dipublikasikan.
      </p>
      <Link
        to="/projects"
        className="inline-block mt-4 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        ← Kembali ke Projects
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
  } = useQuery({
    queryKey: ['project', slug],
    queryFn: () => getProjectBySlug(slug!),
    enabled: !!slug,
    retry: false,
  });

  const { data: fetchedComments } = useQuery({
    queryKey: ['comments', 'project', project?.id],
    queryFn: () => getComments('project', project!.id),
    enabled: !!project?.id,
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
      queryKey: ['comments', 'project', project?.id],
    });
  }

  async function handleDeleteComment(commentId: string) {
    if (!project) return;
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

  if (projectLoading) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <LoadingSkeleton />
      </main>
    );
  }

  if (projectError || !project) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <NotFound />
      </main>
    );
  }

  const publishedDate = formatDate(project.publishedAt);

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/projects" data-testid="back-to-projects">
            ← Kembali ke Projects
          </Link>
        </Button>
      </div>

      <article data-testid="project-article">
        {/* Cover image */}
        {project.coverImageUrl && (
          <div className="mb-6 overflow-hidden rounded-lg aspect-video bg-muted">
            <img
              src={project.coverImageUrl}
              alt={project.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <header className="mb-6">
          <h1
            className="text-3xl font-bold text-foreground leading-tight mb-2"
            data-testid="project-title"
          >
            {project.title}
          </h1>

          <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
            {publishedDate && (
              <time dateTime={project.publishedAt ?? ''}>
                {publishedDate}
              </time>
            )}
          </div>

          {/* Tech stack chips */}
          {project.techTags && project.techTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3" data-testid="project-tech-tags">
              {project.techTags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} />
              ))}
            </div>
          )}

          {/* Repo / demo links */}
          {(project.repoUrl || project.demoUrl) && (
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              {project.repoUrl && (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2"
                  data-testid="project-repo-link"
                >
                  {/* GitHub icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  Kode Sumber
                </a>
              )}
              {project.demoUrl && (
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2"
                  data-testid="project-demo-link"
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
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Live Demo
                </a>
              )}
            </div>
          )}
        </header>

        {/* Project description — rendered with KaTeX support */}
        <MarkdownRenderer content={project.description ?? ''} />
      </article>

      {/* Divider */}
      <hr className="border-border my-8" />

      {/* Comments section */}
      <section
        aria-labelledby="project-comments-heading"
        data-testid="project-comments-section"
      >
        <h2
          id="project-comments-heading"
          className="text-xl font-semibold text-foreground mb-6"
        >
          Komentar ({totalCommentCount})
        </h2>

        <CommentList
          contentType="project"
          contentId={project.id}
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
