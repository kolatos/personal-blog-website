import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminComments, deleteAdminComment } from '../../api/admin';
import { Button } from '../../components/ui/button';
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
import { Pagination } from '../../components/ui/pagination';
import { Skeleton } from '../../components/ui/skeleton';

const CONTENT_TYPE_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'post', label: 'Post' },
  { value: 'project', label: 'Project' },
  { value: 'fun', label: 'Fun' },
  { value: 'module', label: 'Module' },
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function CommentsAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-comments', page, contentTypeFilter],
    queryFn: () => getAdminComments(page, 20, contentTypeFilter || undefined),
  });

  const comments = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: deleteAdminComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setPendingDeleteId(null);
      setDeleteError(null);
    },
    onError: () => {
      setDeleteError('Gagal menghapus komentar. Coba lagi.');
      setPendingDeleteId(null);
    },
  });

  function handleFilterChange(value: string) {
    setContentTypeFilter(value);
    setPage(1);
  }

  function handleDeleteConfirm() {
    if (!pendingDeleteId) return;
    deleteMutation.mutate(pendingDeleteId);
  }

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
          ← Kembali ke Dashboard
        </Button>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manajemen Komentar</h1>
          <p className="mt-1 text-muted-foreground">
            Daftar semua komentar di semua jenis konten.
          </p>
        </div>

        {/* Content type filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="contentTypeFilter" className="text-sm text-muted-foreground whitespace-nowrap">
            Filter:
          </label>
          <select
            id="contentTypeFilter"
            value={contentTypeFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CONTENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error banner */}
      {deleteError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {deleteError}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            Belum ada komentar.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konten</TableHead>
                  <TableHead>Penulis</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell className="max-w-xs">
                      <p className="line-clamp-2 text-sm text-foreground">
                        {comment.content}
                      </p>
                      {comment.contentTitle && (
                        <p className="mt-0.5 text-xs text-muted-foreground italic line-clamp-1">
                          {comment.contentTitle}
                        </p>
                      )}
                      {comment.parentId && (
                        <span className="mt-0.5 inline-block text-xs text-muted-foreground">
                          ↪ balasan
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground whitespace-nowrap">
                      {comment.authorUsername}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {comment.contentType}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(comment.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPendingDeleteId(comment.id)}
                        aria-label="Hapus komentar"
                      >
                        Hapus
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus komentar?</AlertDialogTitle>
            <AlertDialogDescription>
              Komentar akan dihapus secara permanen. Jika ini komentar induk,
              semua balasannya juga akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Menghapus…' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
