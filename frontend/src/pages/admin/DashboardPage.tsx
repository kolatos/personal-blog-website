import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllPosts, publishPost, unpublishPost, deletePost } from '../../api/posts';
import { getAdminStats } from '../../api/admin';
import { PostTable } from '../../components/admin/PostTable';
import { StatCard } from '../../components/admin/StatCard';
import { Pagination } from '../../components/ui/pagination';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConfirmAction =
  | { type: 'publish'; id: string }
  | { type: 'unpublish'; id: string }
  | { type: 'delete'; id: string }
  | null;

function getDialogContent(action: ConfirmAction): {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'default' | 'destructive';
} {
  if (!action) {
    return { title: '', description: '', confirmLabel: '' };
  }
  switch (action.type) {
    case 'publish':
      return {
        title: 'Publikasikan postingan?',
        description: 'Postingan akan dapat dilihat oleh publik.',
        confirmLabel: 'Publikasikan',
        confirmVariant: 'default',
      };
    case 'unpublish':
      return {
        title: 'Batalkan publikasi?',
        description:
          'Postingan akan kembali menjadi draft dan tidak dapat dilihat publik.',
        confirmLabel: 'Batalkan Publikasi',
        confirmVariant: 'default',
      };
    case 'delete':
      return {
        title: 'Hapus postingan?',
        description:
          'Postingan akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan dan semua komentar terkait juga akan dihapus.',
        confirmLabel: 'Hapus',
        confirmVariant: 'destructive',
      };
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

// ── Icons (inline SVG) ────────────────────────────────────────────────────────

function PostsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function CommentsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmAction>(null);

  // Stats query
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getAdminStats,
  });

  // Posts query (for the post management table)
  const { data, isLoading } = useQuery({
    queryKey: ['admin-posts', page],
    queryFn: () => getAllPosts(page, 20),
  });

  const posts = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  function invalidatePosts() {
    queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  }

  const publishMutation = useMutation({
    mutationFn: publishPost,
    onSuccess: invalidatePosts,
    onError: () => setMutationError('Gagal mempublikasikan postingan. Coba lagi.'),
  });

  const unpublishMutation = useMutation({
    mutationFn: unpublishPost,
    onSuccess: invalidatePosts,
    onError: () => setMutationError('Gagal membatalkan publikasi postingan. Coba lagi.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePost,
    onSuccess: invalidatePosts,
    onError: () => setMutationError('Gagal menghapus postingan. Coba lagi.'),
  });

  function handleEdit(id: string) {
    navigate(`/admin/posts/${id}/edit`);
  }
  function handlePublish(id: string) { setPendingAction({ type: 'publish', id }); }
  function handleUnpublish(id: string) { setPendingAction({ type: 'unpublish', id }); }
  function handleDelete(id: string) { setPendingAction({ type: 'delete', id }); }

  function handleConfirm() {
    if (!pendingAction) return;
    setMutationError(null);
    switch (pendingAction.type) {
      case 'publish': publishMutation.mutate(pendingAction.id); break;
      case 'unpublish': unpublishMutation.mutate(pendingAction.id); break;
      case 'delete': deleteMutation.mutate(pendingAction.id); break;
    }
    setPendingAction(null);
  }

  function handleCancel() {
    setPendingAction(null);
  }

  const dialogContent = getDialogContent(pendingAction);

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Admin</h1>
          <p className="mt-1 text-muted-foreground">
            Selamat datang di panel admin. Kelola seluruh konten website di sini.
          </p>
        </div>
        <Button variant="default" onClick={() => navigate('/admin/posts/new')}>
          Buat Postingan Baru
        </Button>
      </div>

      {/* Stat cards */}
      <section aria-label="Statistik website" className="mb-8">
        {statsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Postingan"
              value={stats?.totalPosts ?? 0}
              icon={<PostsIcon />}
              href="/admin"
            />
            <StatCard
              label="Total Komentar"
              value={stats?.totalComments ?? 0}
              icon={<CommentsIcon />}
              href="/admin/comments"
            />
            <StatCard
              label="Total Pengguna"
              value={stats?.totalUsers ?? 0}
              icon={<UsersIcon />}
              href="/admin/users"
            />
          </div>
        )}
      </section>

      {/* Recent activity */}
      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Comments */}
          <section aria-labelledby="recent-comments-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="recent-comments-heading" className="text-lg font-semibold text-foreground">
                Komentar Terbaru
              </h2>
              <Link
                to="/admin/comments"
                className="text-sm text-primary hover:underline"
              >
                Lihat semua →
              </Link>
            </div>
            {stats.recentComments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada komentar.</p>
            ) : (
              <ul className="space-y-2">
                {stats.recentComments.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <p className="font-medium text-foreground line-clamp-2">{c.content}</p>
                    <p className="mt-1 text-muted-foreground">
                      <span className="font-medium">{c.authorUsername}</span>
                      {c.contentTitle && (
                        <> · <span className="italic">{c.contentTitle}</span></>
                      )}
                      {' · '}{formatDate(c.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Latest Users */}
          <section aria-labelledby="recent-users-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="recent-users-heading" className="text-lg font-semibold text-foreground">
                Pengguna Terbaru
              </h2>
              <Link
                to="/admin/users"
                className="text-sm text-primary hover:underline"
              >
                Lihat semua →
              </Link>
            </div>
            {stats.recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pengguna.</p>
            ) : (
              <ul className="space-y-2">
                {stats.recentUsers.map((u) => (
                  <li
                    key={u.id}
                    className="rounded-lg border border-border bg-card p-3 text-sm flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">{u.username}</p>
                      <p className="text-muted-foreground">{u.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Post management section */}
      <section aria-labelledby="posts-table-heading">
        <div className="mb-4">
          <h2 id="posts-table-heading" className="text-lg font-semibold text-foreground">
            Kelola Postingan
          </h2>
        </div>

        {/* Mutation error banner */}
        {mutationError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {mutationError}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card">
          <PostTable
            posts={posts}
            onEdit={handleEdit}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
            onDelete={handleDelete}
            isLoading={isLoading && posts.length === 0}
          />
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </section>

      {/* Confirmation dialog */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => { if (!open) handleCancel(); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                dialogContent.confirmVariant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {dialogContent.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
