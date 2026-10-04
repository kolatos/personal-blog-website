import { useState, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

const MAX_TITLE_LENGTH = 200;

interface PostEditorProps {
  initialTitle?: string;
  initialContent?: string;
  onSubmit: (title: string, content: string) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
}

function PostEditor({
  initialTitle = '',
  initialContent = '',
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Simpan',
}: PostEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [titleError, setTitleError] = useState('');
  const [contentError, setContentError] = useState('');
  const [apiError, setApiError] = useState('');

  function validateTitle(value: string): string {
    if (value.trim() === '') return 'Judul tidak boleh kosong';
    if (value.length > MAX_TITLE_LENGTH)
      return `Judul tidak boleh lebih dari ${MAX_TITLE_LENGTH} karakter`;
    return '';
  }

  function validateContent(value: string): string {
    if (value.trim() === '') return 'Konten tidak boleh kosong';
    return '';
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError('');

    const tErr = validateTitle(title);
    const cErr = validateContent(content);

    if (tErr) setTitleError(tErr);
    if (cErr) setContentError(cErr);
    if (tErr || cErr) return;

    try {
      await onSubmit(title.trim(), content);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      const message =
        axiosError.response?.data?.error?.message ??
        'Terjadi kesalahan. Silakan coba lagi.';
      setApiError(message);
    }
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (titleError) setTitleError('');
  }

  function handleContentChange(value: string) {
    setContent(value);
    if (contentError) setContentError('');
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {/* Title input */}
      <div className="flex flex-col gap-1">
        <Input
          id="post-title"
          label="Judul"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Judul postingan..."
          maxLength={MAX_TITLE_LENGTH + 1}
          disabled={isSubmitting}
          error={titleError}
          aria-required="true"
        />
        <span className="self-end text-xs tabular-nums text-muted-foreground">
          {title.length}/{MAX_TITLE_LENGTH}
        </span>
      </div>

      {/* Editor + Preview pane */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Markdown editor */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="post-content"
            className="text-sm font-medium text-foreground"
          >
            Konten (Markdown)
          </label>
          <textarea
            id="post-content"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Tulis konten postingan dalam Markdown..."
            disabled={isSubmitting}
            aria-invalid={!!contentError}
            aria-describedby={contentError ? 'post-content-error' : undefined}
            aria-required="true"
            className={[
              'min-h-[24rem] w-full resize-y rounded-lg border bg-background px-3 py-2',
              'font-mono text-sm text-foreground leading-relaxed',
              'placeholder:text-muted-foreground',
              'transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
              'disabled:cursor-not-allowed disabled:opacity-50',
              contentError
                ? 'border-destructive focus:ring-destructive'
                : 'border-border',
            ]
              .filter(Boolean)
              .join(' ')}
          />
          {contentError && (
            <p
              id="post-content-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {contentError}
            </p>
          )}
        </div>

        {/* Live preview */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground" aria-hidden="true">
            Preview
          </span>
          <div
            aria-label="Pratinjau Markdown"
            className={[
              'min-h-[24rem] w-full overflow-auto rounded-lg border border-border',
              'bg-card px-4 py-3',
              'prose prose-sm max-w-none',
              // prose colour overrides so it respects our CSS custom properties
              '[&_a]:text-primary [&_code]:bg-muted [&_code]:rounded [&_code]:px-1',
              '[&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-3',
              '[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4',
              '[&_blockquote]:text-muted-foreground',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {content.trim() ? (
              <ReactMarkdown>{content}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">
                Preview akan muncul di sini...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* API error */}
      {apiError && (
        <p role="alert" className="text-sm text-destructive">
          {apiError}
        </p>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
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
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}

export { PostEditor };
export type { PostEditorProps };
