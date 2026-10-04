import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PostEditor } from '../../components/admin/PostEditor';
import { createPost } from '../../api/posts';

export default function CreatePostPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ title, content }: { title: string; content: string }) =>
      createPost({ title, content }),
    onSuccess: () => {
      // Hapus cache dashboard sepenuhnya agar DashboardPage fetch ulang dari server
      queryClient.removeQueries({ queryKey: ['admin-posts'] });
      navigate('/admin');
    },
  });

  async function handleSubmit(title: string, content: string) {
    await mutation.mutateAsync({ title, content });
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Buat Postingan Baru</h1>
      <PostEditor
        submitLabel="Publikasikan Nanti"
        onSubmit={handleSubmit}
        isSubmitting={mutation.isPending}
      />
    </main>
  );
}
