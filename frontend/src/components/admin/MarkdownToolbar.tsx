import { RefObject, useEffect, useRef } from 'react';

// ── Pure helper functions ─────────────────────────────────────────────────

/**
 * Wraps the selected text with `pre` and `post` markers.
 * If no text is selected, inserts `placeholder` wrapped with markers.
 *
 * Returns `{ value, selStart, selEnd }` — the new string and the
 * selection range to restore after React re-renders.
 */
export function wrapSelection(
  value: string,
  selStart: number,
  selEnd: number,
  pre: string,
  post: string,
  placeholder: string,
): { value: string; selStart: number; selEnd: number } {
  const before = value.slice(0, selStart);
  const selected = value.slice(selStart, selEnd);
  const after = value.slice(selEnd);

  if (selected.length === 0) {
    // No selection — insert placeholder wrapped with markers
    const inserted = `${pre}${placeholder}${post}`;
    return {
      value: before + inserted + after,
      selStart: selStart + pre.length,
      selEnd: selStart + pre.length + placeholder.length,
    };
  }

  // Wrap the selection
  const wrapped = `${pre}${selected}${post}`;
  return {
    value: before + wrapped + after,
    selStart: selStart,
    selEnd: selStart + wrapped.length,
  };
}

/**
 * Adds or removes a line prefix on every line within the selection range.
 * Toggle: if ALL selected lines already start with `prefix`, remove it;
 * otherwise add it to lines that don't have it yet.
 *
 * Returns `{ value, selStart, selEnd }`.
 */
export function prefixLines(
  value: string,
  selStart: number,
  selEnd: number,
  prefix: string,
): { value: string; selStart: number; selEnd: number } {
  // Expand selection to cover full lines
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const lineEndIdx =
    value.indexOf('\n', selEnd) === -1
      ? value.length
      : value.indexOf('\n', selEnd);

  const before = value.slice(0, lineStart);
  const block = value.slice(lineStart, lineEndIdx);
  const after = value.slice(lineEndIdx);

  const lines = block.split('\n');
  const allPrefixed = lines.every((l) => l.startsWith(prefix));

  let newBlock: string;
  if (allPrefixed) {
    // Remove prefix
    newBlock = lines.map((l) => l.slice(prefix.length)).join('\n');
  } else {
    // Add prefix to lines that don't already have it
    newBlock = lines.map((l) => (l.startsWith(prefix) ? l : prefix + l)).join('\n');
  }

  const delta = newBlock.length - block.length;
  return {
    value: before + newBlock + after,
    selStart: selStart + (allPrefixed ? -prefix.length : prefix.length),
    selEnd: selEnd + delta,
  };
}

/**
 * Sets or toggles a heading prefix (`# `, `## `, etc.) on the current line.
 * - Same level → removes the prefix entirely
 * - Different level → replaces existing heading prefix with new one
 * - No heading → adds prefix
 *
 * Returns `{ value, selStart, selEnd }`.
 */
export function setHeading(
  value: string,
  selStart: number,
  level: 1 | 2 | 3 | 4,
): { value: string; selStart: number; selEnd: number } {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const lineEndRaw = value.indexOf('\n', selStart);
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;

  const before = value.slice(0, lineStart);
  const line = value.slice(lineStart, lineEnd);
  const after = value.slice(lineEnd);

  const targetPrefix = '#'.repeat(level) + ' ';

  // Detect existing heading prefix (up to #### )
  const headingMatch = line.match(/^(#{1,4}) /);
  let newLine: string;

  if (headingMatch) {
    const existingPrefix = headingMatch[0]; // e.g. "## "
    const existingLevel = headingMatch[1].length;

    if (existingLevel === level) {
      // Same level → remove
      newLine = line.slice(existingPrefix.length);
    } else {
      // Different level → replace
      newLine = targetPrefix + line.slice(existingPrefix.length);
    }
  } else {
    // No heading → add
    newLine = targetPrefix + line;
  }

  const delta = newLine.length - line.length;
  const newStart = Math.max(lineStart, selStart + delta);
  return {
    value: before + newLine + after,
    selStart: newStart,
    selEnd: newStart,
  };
}

/**
 * Inserts `template` at cursor position `start`.
 * `cursorOffset` positions the cursor relative to the insertion point.
 * Defaults to placing the cursor after the inserted template.
 *
 * Returns `{ value, selStart, selEnd }`.
 */
export function insertTemplate(
  value: string,
  start: number,
  template: string,
  cursorOffset?: number,
): { value: string; selStart: number; selEnd: number } {
  const before = value.slice(0, start);
  const after = value.slice(start);
  const newValue = before + template + after;
  const offset = cursorOffset ?? template.length;
  return {
    value: newValue,
    selStart: start + offset,
    selEnd: start + offset,
  };
}

// ── Component ─────────────────────────────────────────────────────────────

export interface MarkdownToolbarProps {
  value: string;
  onChange: (newValue: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onBeforeAction?: (snapshot: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

interface PendingSelection {
  selStart: number;
  selEnd: number;
}

function ToolbarButton({
  title,
  onClick,
  children,
  disabled = false,
  className = '',
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded',
        'border border-transparent px-1 text-sm leading-none',
        'text-foreground hover:bg-accent hover:text-accent-foreground',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'transition-colors',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

function Separator() {
  return (
    <span
      aria-hidden="true"
      className="mx-0.5 inline-block h-5 w-px self-center bg-border"
    />
  );
}

export function MarkdownToolbar({
  value,
  onChange,
  textareaRef,
  onBeforeAction,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: MarkdownToolbarProps) {
  // Store pending cursor position after an action
  const pendingSelectionRef = useRef<PendingSelection | null>(null);

  // After each render, restore cursor/selection if pending
  useEffect(() => {
    if (pendingSelectionRef.current && textareaRef.current) {
      const { selStart, selEnd } = pendingSelectionRef.current;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(selStart, selEnd);
      pendingSelectionRef.current = null;
    }
  });

  function getSelection(): { selStart: number; selEnd: number } {
    const ta = textareaRef.current;
    if (!ta) return { selStart: 0, selEnd: 0 };
    return { selStart: ta.selectionStart, selEnd: ta.selectionEnd };
  }

  function applyResult(result: { value: string; selStart: number; selEnd: number }) {
    onBeforeAction?.(value);
    pendingSelectionRef.current = { selStart: result.selStart, selEnd: result.selEnd };
    onChange(result.value);
  }

  // ── Action handlers ──────────────────────────────────────────────────────

  function handleBold() {
    const { selStart, selEnd } = getSelection();
    applyResult(wrapSelection(value, selStart, selEnd, '**', '**', 'teks tebal'));
  }

  function handleItalic() {
    const { selStart, selEnd } = getSelection();
    applyResult(wrapSelection(value, selStart, selEnd, '*', '*', 'teks miring'));
  }

  function handleStrikethrough() {
    const { selStart, selEnd } = getSelection();
    applyResult(wrapSelection(value, selStart, selEnd, '~~', '~~', 'teks'));
  }

  function handleHeading(level: 1 | 2 | 3 | 4) {
    const { selStart } = getSelection();
    applyResult(setHeading(value, selStart, level));
  }

  function handleUnorderedList() {
    const { selStart, selEnd } = getSelection();
    applyResult(prefixLines(value, selStart, selEnd, '- '));
  }

  function handleOrderedList() {
    const { selStart, selEnd } = getSelection();
    applyResult(prefixLines(value, selStart, selEnd, '1. '));
  }

  function handleTaskList() {
    const { selStart, selEnd } = getSelection();
    applyResult(prefixLines(value, selStart, selEnd, '- [ ] '));
  }

  function handleBlockquote() {
    const { selStart, selEnd } = getSelection();
    applyResult(prefixLines(value, selStart, selEnd, '> '));
  }

  function handleInlineCode() {
    const { selStart, selEnd } = getSelection();
    applyResult(wrapSelection(value, selStart, selEnd, '`', '`', 'kode'));
  }

  function handleCodeBlock() {
    const { selStart } = getSelection();
    const template = '```\nkode\n```';
    applyResult(insertTemplate(value, selStart, template, 4));
  }

  function handleInlineMath() {
    const { selStart, selEnd } = getSelection();
    applyResult(wrapSelection(value, selStart, selEnd, '$', '$', 'expr'));
  }

  function handleDisplayMath() {
    const { selStart } = getSelection();
    const template = '$$\nexpr\n$$';
    applyResult(insertTemplate(value, selStart, template, 3));
  }

  function handleTable() {
    const { selStart } = getSelection();
    const template =
      '| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Baris 1 | Baris 1 |\n| Baris 2 | Baris 2 |';
    applyResult(insertTemplate(value, selStart, template, 2));
  }

  function handleLink() {
    const { selStart, selEnd } = getSelection();
    const selected = value.slice(selStart, selEnd);
    if (selected) {
      applyResult(insertTemplate(value, selStart, `[${selected}](url)`, selected.length + 3));
    } else {
      applyResult(insertTemplate(value, selStart, '[teks](url)', 1));
    }
  }

  function handleImage() {
    const { selStart } = getSelection();
    applyResult(insertTemplate(value, selStart, '![alt](url)', 2));
  }

  return (
    <div
      role="toolbar"
      aria-label="Toolbar format Markdown"
      className={[
        'flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-border',
        'bg-muted/40 px-2 py-1',
      ].join(' ')}
    >
      {/* Undo / Redo */}
      <ToolbarButton title="Undo" onClick={() => onUndo?.()} disabled={!canUndo}>
        ↩
      </ToolbarButton>
      <ToolbarButton title="Redo" onClick={() => onRedo?.()} disabled={!canRedo}>
        ↪
      </ToolbarButton>

      <Separator />

      {/* Inline formatting */}
      <ToolbarButton title="Bold" onClick={handleBold}>
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton title="Italic" onClick={handleItalic}>
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton title="Strikethrough" onClick={handleStrikethrough}>
        <s>S</s>
      </ToolbarButton>

      <Separator />

      {/* Headings sub-group */}
      <ToolbarButton title="Heading 1" onClick={() => handleHeading(1)} className="font-bold">
        H₁
      </ToolbarButton>
      <ToolbarButton title="Heading 2" onClick={() => handleHeading(2)} className="font-bold">
        H₂
      </ToolbarButton>
      <ToolbarButton title="Heading 3" onClick={() => handleHeading(3)} className="font-bold">
        H₃
      </ToolbarButton>
      <ToolbarButton title="Heading 4" onClick={() => handleHeading(4)} className="font-bold">
        H₄
      </ToolbarButton>

      <Separator />

      {/* Lists */}
      <ToolbarButton title="Unordered list" onClick={handleUnorderedList}>
        {/* Hamburger icon */}
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="4" y="3" width="9" height="1.5" rx="0.75" />
          <circle cx="1.5" cy="3.75" r="1" />
          <rect x="4" y="7.25" width="9" height="1.5" rx="0.75" />
          <circle cx="1.5" cy="8" r="1" />
          <rect x="4" y="11.5" width="9" height="1.5" rx="0.75" />
          <circle cx="1.5" cy="12.25" r="1" />
        </svg>
      </ToolbarButton>
      <ToolbarButton title="Ordered list" onClick={handleOrderedList}>
        {/* Numbered list icon */}
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="currentColor"
          aria-hidden="true"
        >
          <text x="0" y="5" fontSize="5" fontFamily="monospace">1.</text>
          <text x="0" y="9.5" fontSize="5" fontFamily="monospace">2.</text>
          <text x="0" y="14" fontSize="5" fontFamily="monospace">3.</text>
          <rect x="7" y="2.5" width="8" height="1.5" rx="0.75" />
          <rect x="7" y="7" width="8" height="1.5" rx="0.75" />
          <rect x="7" y="11.5" width="8" height="1.5" rx="0.75" />
        </svg>
      </ToolbarButton>
      <ToolbarButton title="Task list" onClick={handleTaskList}>
        ☐
      </ToolbarButton>
      <ToolbarButton title="Blockquote" onClick={handleBlockquote}>
        {/* Quote icon */}
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="1" y="2" width="2.5" height="12" rx="1.25" />
          <rect x="5" y="4" width="9" height="1.5" rx="0.75" />
          <rect x="5" y="7" width="9" height="1.5" rx="0.75" />
          <rect x="5" y="10" width="6" height="1.5" rx="0.75" />
        </svg>
      </ToolbarButton>

      <Separator />

      {/* Code */}
      <ToolbarButton title="Inline code" onClick={handleInlineCode}>
        <code className="text-xs">`…`</code>
      </ToolbarButton>
      <ToolbarButton title="Code block" onClick={handleCodeBlock}>
        {'{ }'}
      </ToolbarButton>

      <Separator />

      {/* Math */}
      <ToolbarButton title="Inline math" onClick={handleInlineMath}>
        $
      </ToolbarButton>
      <ToolbarButton title="Display math" onClick={handleDisplayMath}>
        $$
      </ToolbarButton>

      <Separator />

      {/* Misc */}
      <ToolbarButton title="Tabel" onClick={handleTable}>
        ⊞
      </ToolbarButton>
      <ToolbarButton title="Link" onClick={handleLink}>
        🔗
      </ToolbarButton>
      <ToolbarButton title="Sisipkan gambar URL" onClick={handleImage}>
        🖼
      </ToolbarButton>
    </div>
  );
}
