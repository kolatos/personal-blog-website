import { useState, FormEvent } from 'react';
import type { Comment } from '../../types';
import { addComment } from '../../api/comments';
import { Button } from '../ui/Button';

const MAX_LENGTH = 2000;
const WARN_THRESHOLD = 1800;

interface CommentFormProps {
  postId: string;
  onCommentAdded: (comment: Comment) => void;
}

function CommentForm({ postId, onCommentAdded }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(value: string): string {
    if (value.trim() === '') return 'Komentar tidak boleh kosong';
    if (value.length > MAX_LENGTH) return 'Komentar terlalu panjang';
    return '';
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError('');

    const validationError = validate(content);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const newComment = await addComment(postId, { content });
      setContent('');
      onCommentAdded(newComment);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      const message =
        axiosError.response?.data?.error?.message ??
        'Gagal mengirim komentar. Silakan coba lagi.';
      setApiError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleChange(value: string) {
    setContent(value);
    // Clear validation error on change so it re-evaluates on submit
    if (error) setError('');
  }

  const charCountClass =
    content.length >= WARN_THRESHOLD
      ? 'text-destructive'
      : 'text-muted-foreground';

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="comment-content"
          className="text-sm font-medium text-foreground"
        >
          Tambah Komentar
        </label>

        <textarea
          id="comment-content"
          name="content"
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Tulis komentarmu di sini..."
          rows={4}
          maxLength={MAX_LENGTH + 1} /* allow typing over limit so user sees the error */
          disabled={isSubmitting}
          aria-invalid={!!error}
          aria-describedby={error ? 'comment-error' : undefined}
          className={[
            'w-full min-h-[6rem] resize-vertical rounded-lg border bg-background px-3 py-2 text-base text-foreground',
            'placeholder:text-muted-foreground leading-relaxed',
            'transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-destructive focus:ring-destructive' : 'border-border',
          ]
            .filter(Boolean)
            .join(' ')}
        />

        <div className="flex items-center justify-between gap-2">
          {error ? (
            <p id="comment-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <span /> /* spacer to keep counter right-aligned */
          )}
          <span className={`text-xs tabular-nums ${charCountClass}`}>
            {content.length}/{MAX_LENGTH}
          </span>
        </div>
      </div>

      {apiError && (
        <p role="alert" className="text-sm text-destructive">
          {apiError}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isSubmitting}
        >
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
              Mengirim...
            </span>
          ) : (
            'Kirim Komentar'
          )}
        </Button>
      </div>
    </form>
  );
}

export { CommentForm };
export type { CommentFormProps };
