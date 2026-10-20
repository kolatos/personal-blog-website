import { useState, FormEvent, useEffect } from 'react';
import type { Comment } from '../../types';
import { addComment } from '../../api/comments';
import { Button } from '../ui/button';

const MAX_LENGTH = 2000;
const WARN_THRESHOLD = 1800;

interface CommentFormProps {
  contentType: string;
  contentId: string;
  /** If set, this form creates a reply to the given parent comment. */
  parentId?: string;
  /**
   * If set, the textarea is pre-filled with "@username " as a mention prefix.
   * Used when replying to a reply — the mention goes into the top-level form.
   */
  parentAuthorUsername?: string;
  /**
   * External prefill override — used by CommentList to inject @mention text
   * when a nested-reply "Balas" button is clicked.
   */
  prefillContent?: string;
  /** Called after the external prefill is consumed so the parent can clear it. */
  onPrefillConsumed?: () => void;
  onCommentAdded: (comment: Comment) => void;
  /** Optional cancel callback (shown when form is an inline reply). */
  onCancel?: () => void;
}

function CommentForm({
  contentType,
  contentId,
  parentId,
  parentAuthorUsername,
  prefillContent,
  onPrefillConsumed,
  onCommentAdded,
  onCancel,
}: CommentFormProps) {
  // Build initial content from parentAuthorUsername mention if provided
  const initialContent = parentAuthorUsername ? `@${parentAuthorUsername} ` : '';

  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When an external prefill arrives (reply-to-reply), inject it
  useEffect(() => {
    if (prefillContent !== undefined) {
      setContent(prefillContent);
      onPrefillConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillContent]);

  // If parentAuthorUsername changes (form reused), re-seed the mention
  useEffect(() => {
    if (parentAuthorUsername) {
      setContent(`@${parentAuthorUsername} `);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentAuthorUsername]);

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
      const newComment = await addComment({
        contentType,
        contentId,
        content,
        parentId,
      });
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
    if (error) setError('');
  }

  const labelText = parentId ? 'Tulis Balasan' : 'Tambah Komentar';
  const submitText = parentId ? 'Kirim Balasan' : 'Kirim Komentar';
  const placeholderText = parentId
    ? 'Tulis balasanmu di sini...'
    : 'Tulis komentarmu di sini...';

  const charCountClass =
    content.length >= WARN_THRESHOLD
      ? 'text-destructive'
      : 'text-muted-foreground';

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor={parentId ? `reply-content-${parentId}` : 'comment-content'}
          className="text-sm font-medium text-foreground"
        >
          {labelText}
        </label>

        <textarea
          id={parentId ? `reply-content-${parentId}` : 'comment-content'}
          name="content"
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholderText}
          rows={4}
          maxLength={MAX_LENGTH + 1}
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
            <span />
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

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Batal
          </Button>
        )}
        <Button type="submit" variant="default" disabled={isSubmitting}>
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
            submitText
          )}
        </Button>
      </div>
    </form>
  );
}

export { CommentForm };
export type { CommentFormProps };
