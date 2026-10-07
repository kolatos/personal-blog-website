import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllPosts, publishPost, unpublishPost, deletePost } from '../../api/posts';
import { PostTable } from '../../components/admin/PostTable';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-posts', page],
    queryFn: () => getAllPosts(page, 20),
  });

  const posts = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  function invalidatePosts() {
    queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
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

  function handlePublish(id: string) {
    const confirmed = window.confirm('Publikasikan postingan ini?');
    if (!confirmed) return;
    setMutationError(null);
    publishMutation.mutate(id);
  }

  function handleUnpublish(id: string) {
    const confirmed = window.confirm('Batalkan publikasi postingan ini? Postingan akan kembali menjadi draft.');
    if (!confirmed) return;
    setMutationError(null);
    unpublishMutation.mutate(id);
  }

  function handleDelete(id: string) {
    const confirmed = window.confirm(
      'Hapus postingan ini secara permanen? Tindakan ini tidak dapat dibatalkan dan semua komentar terkait juga akan dihapus.',
    );
    if (!confirmed) return;
    setMutationError(null);
    deleteMutation.mutate(id);
  }

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Admin</h1>
          <p className="mt-1 text-muted-foreground">Kelola postingan blog Anda di sini.</p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/admin/posts/new')}
        >
          Buat Postingan Baru
        </Button>
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

      {/* Post table */}
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
    </main>
  );
}
