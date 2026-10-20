import { useState, FormEvent, useRef, useCallback } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { TagInput } from '../shared/TagInput';
import { MarkdownToolbar } from './MarkdownToolbar';

const MAX_TITLE_LENGTH = 200;
const MAX_HISTORY = 50;

interface PostEditorProps {
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[];
  onSubmit: (title: string, content: string, tags: string[]) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
}

function PostEditor({
  initialTitle = '',
  initialContent = '',
  initialTags = [],
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Simpan',
}: PostEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [titleError, setTitleError] = useState('');
  const [contentError, setContentError] = useState('');
  const [apiError, setApiError] = useState('');

  // Undo/Redo: two stacks — past (for undo) and future (for redo)
  // Both are refs to avoid stale closure issues. React state tracks can[Undo/Redo].
  const pastRef = useRef<string[]>([]);   // snapshots before each action (oldest first)
  const futureRef = useRef<string[]>([]); // snapshots after undo (newest first)
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function syncHistoryState() {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }

  // Called by toolbar before every action — saves current content snapshot
  const handleBeforeAction = useCallback(
    (snapshot: string) => {
      // Push snapshot to past; clear future (a new action invalidates redo)
      const past = pastRef.current;
      // Avoid duplicates
      if (past.length > 0 && past[past.length - 1] === snapshot) {
        // Still clear future since a new action starts a new branch
        futureRef.current = [];
        syncHistoryState();
        return;
      }
      const next = [...past, snapshot];
      pastRef.current = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      futureRef.current = [];
      syncHistoryState();
    },
    [],
  );

  function handleUndo(currentContent: string) {
    if (pastRef.current.length === 0) return;
    // Move current content to future
    futureRef.current = [currentContent, ...futureRef.current];
    // Pop from past
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    setContent(previous);
    syncHistoryState();
  }

  function handleRedo(currentContent: string) {
    if (futureRef.current.length === 0) return;
    // Move current content to past
    pastRef.current = [...pastRef.current, currentContent];
    // Pop from future
    const [next, ...rest] = futureRef.current;
    futureRef.current = rest;
    setContent(next);
    syncHistoryState();
  }

  // ── Validation ─────────────────────────────────────────────────────────

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
      await onSubmit(title.trim(), content, tags);
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

      {/* Tags input */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground">Tag</label>
        <TagInput value={tags} onChange={setTags} disabled={isSubmitting} />
        <p className="text-xs text-muted-foreground">
          Ketik nama tag lalu tekan Enter untuk menambahkan.
        </p>
      </div>

      {/* Editor + Preview pane */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Markdown editor */}
        <div className="flex flex-col gap-0">
          <label
            htmlFor="post-content"
            className="mb-1 text-sm font-medium text-foreground"
          >
            Konten (Markdown)
          </label>

          {/* Toolbar sits directly above the textarea, sharing its border */}
          <MarkdownToolbar
            value={content}
            onChange={handleContentChange}
            textareaRef={textareaRef}
            onBeforeAction={handleBeforeAction}
            onUndo={() => handleUndo(content)}
            onRedo={() => handleRedo(content)}
            canUndo={canUndo}
            canRedo={canRedo}
          />

          <Textarea
            id="post-content"
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Tulis konten postingan dalam Markdown..."
            disabled={isSubmitting}
            aria-invalid={!!contentError}
            aria-describedby={contentError ? 'post-content-error' : undefined}
            aria-required="true"
            className={[
              'min-h-[24rem] resize-y rounded-t-none font-mono text-sm leading-relaxed',
              contentError ? 'border-destructive focus-visible:ring-destructive' : '',
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
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {content.trim() ? (
              <MarkdownRenderer content={content} />
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
