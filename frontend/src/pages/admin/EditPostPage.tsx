import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PostEditor } from '../../components/admin/PostEditor';
import { getAdminPostById, updatePost } from '../../api/posts';

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: post,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['admin-post', id],
    queryFn: () => getAdminPostById(id!),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: ({ title, content }: { title: string; content: string }) =>
      updatePost(id!, { title, content }),
    onSuccess: () => {
      // Hapus cache agar DashboardPage fetch ulang data terbaru dari server
      queryClient.removeQueries({ queryKey: ['admin-posts'] });
      queryClient.removeQueries({ queryKey: ['admin-post', id] });
      navigate('/admin');
    },
  });

  async function handleSubmit(title: string, content: string) {
    await mutation.mutateAsync({ title, content });
  }

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Memuat...</p>
      </main>
    );
  }

  if (isError || !post) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-destructive">
          Gagal memuat postingan. Pastikan postingan ada dan coba lagi.
        </p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Postingan</h1>

      {post.status === 'published' && (
        <div
          role="alert"
          className="bg-secondary/20 border border-secondary text-foreground rounded-lg p-4 mb-6"
        >
          <strong>Perhatian:</strong> Postingan ini sedang dipublikasikan. Menyimpan
          perubahan akan mengembalikannya ke status <em>draft</em>.
        </div>
      )}

      <PostEditor
        initialTitle={post.title}
        initialContent={post.content}
        submitLabel="Simpan Perubahan"
        onSubmit={handleSubmit}
        isSubmitting={mutation.isPending}
      />
    </main>
  );
}
