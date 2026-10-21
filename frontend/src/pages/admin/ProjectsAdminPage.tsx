import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminProjects,
  publishProject,
  unpublishProject,
  deleteProject,
} from '../../api/projects';
import { StatusBadge } from '../../components/admin/StatusBadge';
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
        title: 'Publikasikan project?',
        description: 'Project akan dapat dilihat oleh publik.',
        confirmLabel: 'Publikasikan',
        confirmVariant: 'default',
      };
    case 'unpublish':
      return {
        title: 'Batalkan publikasi?',
        description: 'Project akan kembali menjadi draft dan tidak dapat dilihat publik.',
        confirmLabel: 'Batalkan Publikasi',
        confirmVariant: 'default',
      };
    case 'delete':
      return {
        title: 'Hapus project?',
        description: `Project "${action.title}" akan dihapus secara permanen beserta semua komentarnya. Tindakan ini tidak dapat dibatalkan.`,
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

export default function ProjectsAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmAction>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-projects', page],
    queryFn: () => getAdminProjects(page, 20),
  });

  const projects = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  function invalidateProjects() {
    queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
  }

  const publishMutation = useMutation({
    mutationFn: publishProject,
    onSuccess: invalidateProjects,
    onError: () => setMutationError('Gagal mempublikasikan project. Coba lagi.'),
  });

  const unpublishMutation = useMutation({
    mutationFn: unpublishProject,
    onSuccess: invalidateProjects,
    onError: () => setMutationError('Gagal membatalkan publikasi project. Coba lagi.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: invalidateProjects,
    onError: () => setMutationError('Gagal menghapus project. Coba lagi.'),
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
          <h1 className="text-3xl font-bold text-foreground">Kelola Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Buat, edit, dan kelola project di sini.
          </p>
        </div>
        <Button
          variant="default"
          onClick={() => navigate('/admin/projects/new')}
          data-testid="new-project-button"
        >
          + Project Baru
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

      {/* Projects table */}
      <section aria-labelledby="projects-table-heading">
        <h2 id="projects-table-heading" className="sr-only">
          Daftar Project
        </h2>

        {isLoading && projects.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            Belum ada project.{' '}
            <button
              type="button"
              className="text-primary underline underline-offset-2"
              onClick={() => navigate('/admin/projects/new')}
            >
              Buat project pertama
            </button>
            .
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judul</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Urutan</TableHead>
                  <TableHead className="whitespace-nowrap">Diperbarui</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id} data-testid="project-row">
                    <TableCell className="text-foreground">
                      <span className="font-medium line-clamp-2">{project.title}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={project.status} />
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {project.order}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(project.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                          data-testid="edit-project-button"
                        >
                          Edit
                        </Button>

                        {project.status === 'draft' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setPendingAction({
                                type: 'publish',
                                id: project.id,
                                title: project.title,
                              })
                            }
                            aria-label={`Publikasikan project: ${project.title}`}
                            data-testid="publish-project-button"
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
                                id: project.id,
                                title: project.title,
                              })
                            }
                            aria-label={`Batalkan publikasi project: ${project.title}`}
                            data-testid="unpublish-project-button"
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
                              id: project.id,
                              title: project.title,
                            })
                          }
                          aria-label={`Hapus project: ${project.title}`}
                          data-testid="delete-project-button"
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
