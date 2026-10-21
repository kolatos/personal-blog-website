import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminFunPosts,
  publishFunPost,
  unpublishFunPost,
  deleteFunPost,
} from '../../api/fun';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Pagination } from '../../components/ui/pagination';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
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
  | { type: 'publish'; id: string; title: string }
  | { type: 'unpublish'; id: string; title: string }
  | { type: 'delete'; id: string; title: string }
  | null;

const TYPE_LABELS: Record<string, string> = {
  text: 'Tulisan',
  review: 'Ulasan',
  image: 'Gambar',
  drawing: 'Drawing',
  music: 'Musik',
  interactive: 'Interaktif',
};

function getDialogContent(action: ConfirmAction): {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'default' | 'destructive';
} {
  if (!action) return { title: '', description: '', confirmLabel: '' };
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
        description: 'Postingan akan kembali menjadi draft dan tidak dapat dilihat publik.',
        confirmLabel: 'Batalkan Publikasi',
        confirmVariant: 'default',
      };
    case 'delete':
      return {
        title: 'Hapus postingan?',
        description: `Postingan "${action.title}" akan dihapus secara permanen beserta semua komentarnya. Tindakan ini tidak dapat dibatalkan.`,
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function FunAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmAction>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-fun', page],
    queryFn: () => getAdminFunPosts(page, 20),
  });

  const posts = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  function invalidateFun() {
    queryClient.invalidateQueries({ queryKey: ['admin-fun'] });
  }

  const publishMutation = useMutation({
    mutationFn: publishFunPost,
    onSuccess: invalidateFun,
    onError: () => setMutationError('Gagal mempublikasikan postingan. Coba lagi.'),
  });

  const unpublishMutation = useMutation({
    mutationFn: unpublishFunPost,
    onSuccess: invalidateFun,
    onError: () => setMutationError('Gagal membatalkan publikasi postingan. Coba lagi.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFunPost,
    onSuccess: invalidateFun,
    onError: () => setMutationError('Gagal menghapus postingan. Coba lagi.'),
  });

  function handleConfirm() {
    if (!pendingAction) return;
    setMutationError(null);
    switch (pendingAction.type) {
      case 'publish':
        publishMutation.mutate(pendingAction.id);
        break;
      case 'unpublish':
        unpublishMutation.mutate(pendingAction.id);
        break;
      case 'delete':
        deleteMutation.mutate(pendingAction.id);
        break;
    }
    setPendingAction(null);
  }

  const dialogContent = getDialogContent(pendingAction);

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-2">
            ← Kembali ke Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Kelola Fun</h1>
          <p className="mt-1 text-muted-foreground">
            Buat, edit, dan kelola postingan fun di sini.
          </p>
        </div>
        <Button
          variant="default"
          onClick={() => navigate('/admin/fun/new')}
          data-testid="new-fun-button"
        >
          + Postingan Baru
        </Button>
      </div>

      {/* Error banner */}
      {mutationError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {mutationError}
        </div>
      )}

      {/* Fun posts table */}
      <section aria-labelledby="fun-table-heading">
        <h2 id="fun-table-heading" className="sr-only">
          Daftar Postingan Fun
        </h2>

        {isLoading && posts.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            Belum ada postingan fun.{' '}
            <button
              type="button"
              className="text-primary underline underline-offset-2"
              onClick={() => navigate('/admin/fun/new')}
            >
              Buat postingan pertama
            </button>
            .
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judul</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="whitespace-nowrap">Diperbarui</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id} data-testid="fun-row">
                    <TableCell className="text-foreground">
                      <span className="font-medium line-clamp-2">{post.title}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs" data-testid="fun-type-badge">
                        {TYPE_LABELS[post.type] ?? post.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={post.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(post.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/fun/${post.id}/edit`)}
                          data-testid="edit-fun-button"
                        >
                          Edit
                        </Button>

                        {post.status === 'draft' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setPendingAction({
                                type: 'publish',
                                id: post.id,
                                title: post.title,
                              })
                            }
                            aria-label={`Publikasikan: ${post.title}`}
                            data-testid="publish-fun-button"
                          >
                            Publish
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setPendingAction({
                                type: 'unpublish',
                                id: post.id,
                                title: post.title,
                              })
                            }
                            aria-label={`Batalkan publikasi: ${post.title}`}
                            data-testid="unpublish-fun-button"
                          >
                            Unpublish
                          </Button>
                        )}

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setPendingAction({
                              type: 'delete',
                              id: post.id,
                              title: post.title,
                            })
                          }
                          aria-label={`Hapus: ${post.title}`}
                          data-testid="delete-fun-button"
                        >
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

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
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingAction(null)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                dialogContent.confirmVariant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              data-testid="confirm-action-button"
            >
              {dialogContent.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
