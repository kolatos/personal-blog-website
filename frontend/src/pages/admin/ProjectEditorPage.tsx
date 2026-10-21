import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminProjectById,
  createProject,
  updateProject,
} from '../../api/projects';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';
import { TagInput } from '../../components/shared/TagInput';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';

// ── Zod schema ────────────────────────────────────────────────────────────────

const projectSchema = z.object({
  title: z
    .string()
    .min(1, 'Judul wajib diisi')
    .max(200, 'Judul tidak boleh lebih dari 200 karakter'),
  description: z.string().min(1, 'Deskripsi wajib diisi'),
  coverImageUrl: z
    .string()
    .url('URL gambar tidak valid')
    .optional()
    .or(z.literal('')),
  repoUrl: z
    .string()
    .url('URL repo tidak valid')
    .optional()
    .or(z.literal('')),
  demoUrl: z
    .string()
    .url('URL demo tidak valid')
    .optional()
    .or(z.literal('')),
  order: z.coerce
    .number({ invalid_type_error: 'Urutan harus angka' })
    .int('Urutan harus bilangan bulat')
    .min(0, 'Urutan tidak boleh negatif'),
  techTags: z.array(z.string()),
});

type ProjectFormData = z.infer<typeof projectSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjectEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch existing project when editing
  const {
    data: existingProject,
    isLoading: isLoadingProject,
    isError: isLoadError,
  } = useQuery({
    queryKey: ['admin-project', id],
    queryFn: () => getAdminProjectById(id!),
    enabled: isEditMode,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: '',
      description: '',
      coverImageUrl: '',
      repoUrl: '',
      demoUrl: '',
      order: 0,
      techTags: [],
    },
  });

  // Populate form once existing project is loaded
  useEffect(() => {
    if (existingProject) {
      reset({
        title: existingProject.title,
        description: existingProject.description,
        coverImageUrl: existingProject.coverImageUrl ?? '',
        repoUrl: existingProject.repoUrl ?? '',
        demoUrl: existingProject.demoUrl ?? '',
        order: existingProject.order,
        techTags: existingProject.techTags?.map((t) => t.name) ?? [],
      });
    }
  }, [existingProject, reset]);

  const description = watch('description');

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin-projects'] });
      navigate('/admin/projects');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ payload }: { payload: ProjectFormData }) =>
      updateProject(id!, {
        title: payload.title,
        description: payload.description,
        coverImageUrl: payload.coverImageUrl || undefined,
        repoUrl: payload.repoUrl || undefined,
        demoUrl: payload.demoUrl || undefined,
        order: payload.order,
        techTags: payload.techTags,
      }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin-projects'] });
      queryClient.removeQueries({ queryKey: ['admin-project', id] });
      navigate('/admin/projects');
    },
  });

  const mutationError =
    (createMutation.error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ??
    (updateMutation.error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ??
    null;

  async function onSubmit(data: ProjectFormData) {
    const payload = {
      title: data.title,
      description: data.description,
      coverImageUrl: data.coverImageUrl || undefined,
      repoUrl: data.repoUrl || undefined,
      demoUrl: data.demoUrl || undefined,
      order: data.order,
      techTags: data.techTags,
    };

    if (isEditMode) {
      updateMutation.mutate({ payload: data });
    } else {
      createMutation.mutate(payload);
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (isEditMode && isLoadingProject) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Memuat project...</p>
      </main>
    );
  }

  if (isEditMode && (isLoadError || !existingProject)) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-destructive">
          Gagal memuat project. Pastikan project ada dan coba lagi.
        </p>
      </main>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/projects')}>
          ← Kembali ke Projects
        </Button>
      </div>

      <h1 className="text-3xl font-bold mb-2">
        {isEditMode ? 'Edit Project' : 'Project Baru'}
      </h1>

      {isEditMode && existingProject?.status === 'published' && (
        <div
          role="alert"
          className="bg-secondary/20 border border-secondary text-foreground rounded-lg p-4 mb-6"
        >
          <strong>Perhatian:</strong> Project ini sedang dipublikasikan. Menyimpan
          perubahan akan mengembalikannya ke status <em>draft</em>.
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-6 mt-6"
      >
        {/* Title */}
        <div className="flex flex-col gap-1">
          <label htmlFor="project-title" className="text-sm font-medium text-foreground">
            Judul <span className="text-destructive">*</span>
          </label>
          <Input
            id="project-title"
            {...register('title')}
            placeholder="Nama project..."
            aria-invalid={!!errors.title}
            disabled={isSubmitting}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        {/* Description — split pane: textarea left, preview right */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            Deskripsi (Markdown) <span className="text-destructive">*</span>
          </span>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Editor */}
            <div className="flex flex-col gap-1">
              <label htmlFor="project-description" className="sr-only">
                Deskripsi
              </label>
              <Textarea
                id="project-description"
                {...register('description')}
                placeholder="Tulis deskripsi project dalam Markdown..."
                rows={16}
                disabled={isSubmitting}
                aria-invalid={!!errors.description}
                className={[
                  'font-mono text-sm leading-relaxed min-h-[24rem] resize-y',
                  errors.description ? 'border-destructive focus-visible:ring-destructive' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Preview */}
            <div className="flex flex-col gap-1">
              <span
                className="text-sm font-medium text-muted-foreground"
                aria-hidden="true"
              >
                Preview
              </span>
              <div
                aria-label="Pratinjau deskripsi"
                className="min-h-[24rem] overflow-auto rounded-lg border border-border bg-card px-4 py-3"
              >
                {description?.trim() ? (
                  <MarkdownRenderer content={description} />
                ) : (
                  <p className="text-muted-foreground italic">
                    Preview akan muncul di sini...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tech tags */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">
            Tech Stack
          </label>
          <Controller
            name="techTags"
            control={control}
            render={({ field }) => (
              <TagInput
                value={field.value}
                onChange={field.onChange}
                disabled={isSubmitting}
              />
            )}
          />
          <p className="text-xs text-muted-foreground">
            Ketik nama teknologi lalu tekan Enter untuk menambahkan.
          </p>
        </div>

        {/* Cover image URL */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="project-cover-image"
            className="text-sm font-medium text-foreground"
          >
            URL Cover Image
          </label>
          <Input
            id="project-cover-image"
            {...register('coverImageUrl')}
            placeholder="https://..."
            disabled={isSubmitting}
            aria-invalid={!!errors.coverImageUrl}
          />
          {errors.coverImageUrl && (
            <p className="text-sm text-destructive">{errors.coverImageUrl.message}</p>
          )}
        </div>

        {/* Repo URL + Demo URL — side by side */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="project-repo-url" className="text-sm font-medium text-foreground">
              URL Repo
            </label>
            <Input
              id="project-repo-url"
              {...register('repoUrl')}
              placeholder="https://github.com/..."
              disabled={isSubmitting}
              aria-invalid={!!errors.repoUrl}
            />
            {errors.repoUrl && (
              <p className="text-sm text-destructive">{errors.repoUrl.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="project-demo-url" className="text-sm font-medium text-foreground">
              URL Demo
            </label>
            <Input
              id="project-demo-url"
              {...register('demoUrl')}
              placeholder="https://..."
              disabled={isSubmitting}
              aria-invalid={!!errors.demoUrl}
            />
            {errors.demoUrl && (
              <p className="text-sm text-destructive">{errors.demoUrl.message}</p>
            )}
          </div>
        </div>

        {/* Order */}
        <div className="flex flex-col gap-1 max-w-xs">
          <label htmlFor="project-order" className="text-sm font-medium text-foreground">
            Urutan Tampil
          </label>
          <Input
            id="project-order"
            type="number"
            min={0}
            {...register('order')}
            disabled={isSubmitting}
            aria-invalid={!!errors.order}
          />
          <p className="text-xs text-muted-foreground">
            Angka kecil tampil lebih dulu.
          </p>
          {errors.order && (
            <p className="text-sm text-destructive">{errors.order.message}</p>
          )}
        </div>

        {/* API error */}
        {mutationError && (
          <p role="alert" className="text-sm text-destructive">
            {mutationError}
          </p>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/projects')}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Menyimpan...
              </span>
            ) : isEditMode ? (
              'Simpan Perubahan'
            ) : (
              'Buat Project'
            )}
          </Button>
        </div>
      </form>
    </main>
  );
}
