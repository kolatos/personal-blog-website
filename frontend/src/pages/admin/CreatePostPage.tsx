import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PostEditor } from '../../components/admin/PostEditor';
import { createPost } from '../../api/posts';
import { Button } from '../../components/ui/button';

export default function CreatePostPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ title, content, tags }: { title: string; content: string; tags: string[] }) =>
      createPost({ title, content, tags }),
    onSuccess: () => {
      // Hapus cache dashboard sepenuhnya agar DashboardPage fetch ulang dari server
      queryClient.removeQueries({ queryKey: ['admin-posts'] });
      navigate('/admin');
    },
  });

  async function handleSubmit(title: string, content: string, tags: string[]) {
    await mutation.mutateAsync({ title, content, tags });
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
          ← Kembali ke Dashboard
        </Button>
      </div>
      <h1 className="text-3xl font-bold mb-6">Buat Postingan Baru</h1>
      <PostEditor
        submitLabel="Publikasikan Nanti"
        onSubmit={handleSubmit}
        isSubmitting={mutation.isPending}
      />
    </main>
  );
}
