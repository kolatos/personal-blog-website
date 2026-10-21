import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminFunPostById,
  createFunPost,
  updateFunPost,
} from '../../api/fun';
import { MarkdownRenderer } from '../../components/shared/MarkdownRenderer';
import { TagInput } from '../../components/shared/TagInput';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';

// ── Type labels ───────────────────────────────────────────────────────────────

const FUN_POST_TYPES = [
  { value: 'text', label: 'Tulisan' },
  { value: 'review', label: 'Ulasan' },
  { value: 'image', label: 'Gambar' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'music', label: 'Musik' },
  { value: 'interactive', label: 'Interaktif' },
] as const;

type FunPostTypeValue = (typeof FUN_POST_TYPES)[number]['value'];

// ── Zod schema ────────────────────────────────────────────────────────────────

const funPostSchema = z.object({
  title: z
    .string()
    .min(1, 'Judul wajib diisi')
    .max(200, 'Judul tidak boleh lebih dari 200 karakter'),
  type: z.enum(
    FUN_POST_TYPES.map((t) => t.value) as [FunPostTypeValue, ...FunPostTypeValue[]],
    { required_error: 'Tipe wajib dipilih' }
  ),
  content: z.string().min(1, 'Konten wajib diisi'),
  excerpt: z.string().max(500, 'Kutipan tidak boleh lebih dari 500 karakter').optional(),
  mediaUrl: z
    .string()
    .url('URL media tidak valid')
    .optional()
    .or(z.literal('')),
  tags: z.array(z.string()),
});

type FunPostFormData = z.infer<typeof funPostSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function FunEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch existing post when editing
  const {
    data: existingPost,
    isLoading: isLoadingPost,
    isError: isLoadError,
  } = useQuery({
    queryKey: ['admin-fun-post', id],
    queryFn: () => getAdminFunPostById(id!),
    enabled: isEditMode,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FunPostFormData>({
    resolver: zodResolver(funPostSchema),
    defaultValues: {
      title: '',
      type: 'text',
      content: '',
      excerpt: '',
      mediaUrl: '',
      tags: [],
    },
  });

  // Populate form once existing post is loaded
  useEffect(() => {
    if (existingPost) {
      reset({
        title: existingPost.title,
        type: existingPost.type as FunPostTypeValue,
        content: existingPost.content,
        excerpt: existingPost.excerpt ?? '',
        mediaUrl: existingPost.mediaUrl ?? '',
        tags: existingPost.tags?.map((t) => t.name) ?? [],
      });
    }
  }, [existingPost, reset]);

  const content = watch('content');

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createFunPost,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin-fun'] });
      navigate('/admin/fun');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ payload }: { payload: FunPostFormData }) =>
      updateFunPost(id!, {
        title: payload.title,
        type: payload.type,
        content: payload.content,
        excerpt: payload.excerpt || undefined,
        mediaUrl: payload.mediaUrl || undefined,
        tags: payload.tags,
      }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin-fun'] });
      queryClient.removeQueries({ queryKey: ['admin-fun-post', id] });
      navigate('/admin/fun');
    },
  });

  const mutationError =
    (createMutation.error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ??
    (updateMutation.error as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ??
    null;

  async function onSubmit(data: FunPostFormData) {
    const payload = {
      title: data.title,
      type: data.type,
      content: data.content,
      excerpt: data.excerpt || undefined,
      mediaUrl: data.mediaUrl || undefined,
      tags: data.tags,
    };

    if (isEditMode) {
      updateMutation.mutate({ payload: data });
    } else {
      createMutation.mutate(payload);
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (isEditMode && isLoadingPost) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Memuat postingan...</p>
      </main>
    );
  }

  if (isEditMode && (isLoadError || !existingPost)) {
    return (
      <main className="container mx-auto px-4 py-8">
        <p className="text-destructive">
          Gagal memuat postingan. Pastikan postingan ada dan coba lagi.
        </p>
      </main>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/fun')}>
          ← Kembali ke Fun
        </Button>
      </div>

      <h1 className="text-3xl font-bold mb-2">
        {isEditMode ? 'Edit Postingan Fun' : 'Postingan Fun Baru'}
      </h1>

      {isEditMode && existingPost?.status === 'published' && (
        <div
          role="alert"
          className="bg-secondary/20 border border-secondary text-foreground rounded-lg p-4 mb-6"
        >
          <strong>Perhatian:</strong> Postingan ini sedang dipublikasikan. Menyimpan
          perubahan akan mengembalikannya ke status <em>draft</em>.
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-6 mt-6"
      >
        {/* Type selector */}
        <div className="flex flex-col gap-1">
          <label htmlFor="fun-type" className="text-sm font-medium text-foreground">
            Tipe <span className="text-destructive">*</span>
          </label>
          <select
            id="fun-type"
            {...register('type')}
            disabled={isSubmitting}
            className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-invalid={!!errors.type}
          >
            {FUN_POST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.type && (
            <p className="text-sm text-destructive">{errors.type.message}</p>
          )}
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <label htmlFor="fun-title" className="text-sm font-medium text-foreground">
            Judul <span className="text-destructive">*</span>
          </label>
          <Input
            id="fun-title"
            {...register('title')}
            placeholder="Judul postingan..."
            aria-invalid={!!errors.title}
            disabled={isSubmitting}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        {/* Content — split pane: textarea left, preview right */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            Konten (Markdown) <span className="text-destructive">*</span>
          </span>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Editor */}
            <div className="flex flex-col gap-1">
              <label htmlFor="fun-content" className="sr-only">
                Konten
              </label>
              <Textarea
                id="fun-content"
                {...register('content')}
                placeholder="Tulis konten dalam Markdown..."
                rows={16}
                disabled={isSubmitting}
                aria-invalid={!!errors.content}
                className={[
                  'font-mono text-sm leading-relaxed min-h-[24rem] resize-y',
                  errors.content ? 'border-destructive focus-visible:ring-destructive' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              {errors.content && (
                <p className="text-sm text-destructive">{errors.content.message}</p>
              )}
            </div>

            {/* Preview */}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground" aria-hidden="true">
                Preview
              </span>
              <div
                aria-label="Pratinjau konten"
                className="min-h-[24rem] overflow-auto rounded-lg border border-border bg-card px-4 py-3"
              >
                {content?.trim() ? (
                  <MarkdownRenderer content={content} />
                ) : (
                  <p className="text-muted-foreground italic">
                    Preview akan muncul di sini...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Excerpt */}
        <div className="flex flex-col gap-1">
          <label htmlFor="fun-excerpt" className="text-sm font-medium text-foreground">
            Kutipan (opsional)
          </label>
          <Textarea
            id="fun-excerpt"
            {...register('excerpt')}
            placeholder="Kutipan singkat (maks. 500 karakter). Jika kosong, diambil otomatis dari konten."
            rows={3}
            disabled={isSubmitting}
            aria-invalid={!!errors.excerpt}
          />
          {errors.excerpt && (
            <p className="text-sm text-destructive">{errors.excerpt.message}</p>
          )}
        </div>

        {/* Media URL */}
        <div className="flex flex-col gap-1">
          <label htmlFor="fun-media-url" className="text-sm font-medium text-foreground">
            URL Media (opsional)
          </label>
          <Input
            id="fun-media-url"
            {...register('mediaUrl')}
            placeholder="https://..."
            disabled={isSubmitting}
            aria-invalid={!!errors.mediaUrl}
          />
          <p className="text-xs text-muted-foreground">
            Digunakan sebagai cover image (image/drawing) atau link audio (music).
          </p>
          {errors.mediaUrl && (
            <p className="text-sm text-destructive">{errors.mediaUrl.message}</p>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">
            Tag
          </label>
          <Controller
            name="tags"
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
            Ketik nama tag lalu tekan Enter untuk menambahkan.
          </p>
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
            onClick={() => navigate('/admin/fun')}
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
              'Buat Postingan'
            )}
          </Button>
        </div>
      </form>
    </main>
  );
}
