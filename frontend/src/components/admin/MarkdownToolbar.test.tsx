import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RefObject } from 'react';
import {
  wrapSelection,
  prefixLines,
  setHeading,
  insertTemplate,
  MarkdownToolbar,
} from './MarkdownToolbar';

// ── Pure helper tests ─────────────────────────────────────────────────────

describe('wrapSelection', () => {
  it('Bold: wraps selected text with **', () => {
    const result = wrapSelection('hello world', 6, 11, '**', '**', 'teks tebal');
    expect(result.value).toBe('hello **world**');
    // Selection covers wrapped content (start is before pre, end is before post — spec: selects the wrapped block)
    expect(result.selStart).toBe(6);
    expect(result.selEnd).toBe(15);
  });

  it('Bold: inserts placeholder when no selection', () => {
    const result = wrapSelection('', 0, 0, '**', '**', 'teks tebal');
    expect(result.value).toBe('**teks tebal**');
    // Selection covers the placeholder text
    expect(result.selStart).toBe(2);
    expect(result.selEnd).toBe(12);
  });

  it('Italic: wraps selected text with *', () => {
    const result = wrapSelection('abc', 0, 3, '*', '*', 'teks miring');
    expect(result.value).toBe('*abc*');
  });

  it('Inline math: wraps selection with $', () => {
    const result = wrapSelection('x^2', 0, 3, '$', '$', 'expr');
    expect(result.value).toBe('$x^2$');
  });

  it('Inline math: inserts $expr$ when no selection', () => {
    const result = wrapSelection('', 0, 0, '$', '$', 'expr');
    expect(result.value).toBe('$expr$');
    expect(result.selStart).toBe(1);
    expect(result.selEnd).toBe(5);
  });
});

describe('prefixLines', () => {
  it('adds "- " prefix to a single line', () => {
    const result = prefixLines('baris satu', 0, 10, '- ');
    expect(result.value).toBe('- baris satu');
  });

  it('removes "- " prefix when line already has it (toggle off)', () => {
    const result = prefixLines('- baris satu', 0, 12, '- ');
    expect(result.value).toBe('baris satu');
  });

  it('adds prefix to multiple selected lines', () => {
    const text = 'baris satu\nbaris dua';
    const result = prefixLines(text, 0, 20, '- ');
    expect(result.value).toBe('- baris satu\n- baris dua');
  });

  it('removes prefix from all lines when all have it', () => {
    const text = '- baris satu\n- baris dua';
    const result = prefixLines(text, 0, 24, '- ');
    expect(result.value).toBe('baris satu\nbaris dua');
  });

  it('adds prefix to lines missing it when not all have prefix', () => {
    const text = '- baris satu\nbaris dua';
    const result = prefixLines(text, 0, 22, '- ');
    expect(result.value).toBe('- baris satu\n- baris dua');
  });

  it('handles blockquote prefix ("> ")', () => {
    const result = prefixLines('test', 0, 4, '> ');
    expect(result.value).toBe('> test');
  });
});

describe('setHeading', () => {
  it('adds H2 prefix to empty line', () => {
    const result = setHeading('', 0, 2);
    expect(result.value).toBe('## ');
  });

  it('adds H1 prefix to plain text line', () => {
    const result = setHeading('hello', 0, 1);
    expect(result.value).toBe('# hello');
  });

  it('removes H2 prefix when same level is clicked again', () => {
    const result = setHeading('## hello', 0, 2);
    expect(result.value).toBe('hello');
  });

  it('replaces H2 with H3 when H3 is clicked on H2 line', () => {
    const result = setHeading('## hello', 0, 3);
    expect(result.value).toBe('### hello');
  });

  it('replaces H3 with H2 when H2 is clicked on H3 line', () => {
    const result = setHeading('### hello', 0, 2);
    expect(result.value).toBe('## hello');
  });

  it('handles H4', () => {
    const result = setHeading('test', 0, 4);
    expect(result.value).toBe('#### test');
  });

  it('preserves text after heading on same line', () => {
    const text = 'line1\n## line2\nline3';
    const result = setHeading(text, 6, 3); // cursor in "## line2"
    expect(result.value).toBe('line1\n### line2\nline3');
  });
});

describe('insertTemplate', () => {
  it('inserts template at cursor position', () => {
    const result = insertTemplate('hello ', 6, 'world');
    expect(result.value).toBe('hello world');
    expect(result.selStart).toBe(11);
    expect(result.selEnd).toBe(11);
  });

  it('places cursor at cursorOffset from insertion point', () => {
    const result = insertTemplate('', 0, '```\nkode\n```', 4);
    expect(result.value).toBe('```\nkode\n```');
    expect(result.selStart).toBe(4);
    expect(result.selEnd).toBe(4);
  });

  it('Display math template has correct cursor offset', () => {
    const template = '$$\nexpr\n$$';
    const result = insertTemplate('', 0, template, 3);
    expect(result.value).toBe('$$\nexpr\n$$');
    expect(result.selStart).toBe(3); // After "$$\n"
  });
});

// ── Component tests ───────────────────────────────────────────────────────

function createMockTextarea(selStart = 0, selEnd = 0, value = '') {
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.selectionStart = selStart;
  ta.selectionEnd = selEnd;
  // Make setSelectionRange a spy
  vi.spyOn(ta, 'setSelectionRange');
  document.body.appendChild(ta);
  return ta;
}

describe('MarkdownToolbar component', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;
  let mockOnBeforeAction: ReturnType<typeof vi.fn>;
  let mockOnUndo: ReturnType<typeof vi.fn>;
  let mockOnRedo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
    mockOnBeforeAction = vi.fn();
    mockOnUndo = vi.fn();
    mockOnRedo = vi.fn();
  });

  function renderToolbar(
    value = '',
    taSelStart = 0,
    taSelEnd = 0,
    canUndo = false,
    canRedo = false,
  ) {
    // The mock textarea must have the same value so getSelection() reads correct indices
    const ta = createMockTextarea(taSelStart, taSelEnd, value);
    // Use a plain object as the ref — createRef's `current` is non-configurable
    const ref = { current: ta } as RefObject<HTMLTextAreaElement>;

    render(
      <MarkdownToolbar
        value={value}
        onChange={mockOnChange}
        textareaRef={ref}
        onBeforeAction={mockOnBeforeAction}
        onUndo={mockOnUndo}
        onRedo={mockOnRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />,
    );

    return { ta, ref };
  }

  // ── Bold ─────────────────────────────────────────────────────────────────

  it('Bold with selection → **teks**', () => {
    const value = 'teks';
    renderToolbar(value, 0, 4, false, false); // "teks" selected (selStart=0, selEnd=4)

    fireEvent.click(screen.getByRole('button', { name: /bold/i }));

    expect(mockOnChange).toHaveBeenCalledWith('**teks**');
  });

  it('Bold without selection → **teks tebal**', () => {
    renderToolbar('', 0, 0);

    fireEvent.click(screen.getByRole('button', { name: /bold/i }));

    expect(mockOnChange).toHaveBeenCalledWith('**teks tebal**');
  });

  // ── Heading ──────────────────────────────────────────────────────────────

  it('H2 on empty line → ## ', () => {
    renderToolbar('', 0, 0);

    fireEvent.click(screen.getByRole('button', { name: /heading 2/i }));

    expect(mockOnChange).toHaveBeenCalledWith('## ');
  });

  it('H2 again on "## " → removes prefix', () => {
    renderToolbar('## ', 0, 0);

    fireEvent.click(screen.getByRole('button', { name: /heading 2/i }));

    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('H3 on "## hello" line → replaces with ### hello', () => {
    renderToolbar('## hello', 0, 0);

    fireEvent.click(screen.getByRole('button', { name: /heading 3/i }));

    expect(mockOnChange).toHaveBeenCalledWith('### hello');
  });

  // ── Unordered list ────────────────────────────────────────────────────────

  it('Unordered list → adds "- " prefix', () => {
    renderToolbar('baris', 0, 5);

    fireEvent.click(screen.getByRole('button', { name: /unordered list/i }));

    expect(mockOnChange).toHaveBeenCalledWith('- baris');
  });

  it('Unordered list toggle → removes "- " prefix', () => {
    renderToolbar('- baris', 0, 7);

    fireEvent.click(screen.getByRole('button', { name: /unordered list/i }));

    expect(mockOnChange).toHaveBeenCalledWith('baris');
  });

  // ── Math ─────────────────────────────────────────────────────────────────

  it('Inline math without selection → $expr$', () => {
    renderToolbar('', 0, 0);

    fireEvent.click(screen.getByRole('button', { name: /inline math/i }));

    expect(mockOnChange).toHaveBeenCalledWith('$expr$');
  });

  it('Display math → multiline template with $$', () => {
    renderToolbar('', 0, 0);

    fireEvent.click(screen.getByRole('button', { name: /display math/i }));

    const calledWith = mockOnChange.mock.calls[0][0] as string;
    expect(calledWith).toContain('$$');
    expect(calledWith.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  it('calls onUndo when Undo button is clicked (canUndo=true)', () => {
    renderToolbar('', 0, 0, true, false);

    fireEvent.click(screen.getByRole('button', { name: /undo/i }));

    expect(mockOnUndo).toHaveBeenCalledOnce();
  });

  it('Undo button is disabled when canUndo=false', () => {
    renderToolbar('', 0, 0, false, false);

    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
  });

  it('calls onRedo when Redo button is clicked (canRedo=true)', () => {
    renderToolbar('', 0, 0, false, true);

    fireEvent.click(screen.getByRole('button', { name: /redo/i }));

    expect(mockOnRedo).toHaveBeenCalledOnce();
  });

  it('Redo button is disabled when canRedo=false', () => {
    renderToolbar('', 0, 0, false, false);

    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();
  });

  it('calls onBeforeAction before every toolbar action', () => {
    renderToolbar('hello', 0, 0);

    fireEvent.click(screen.getByRole('button', { name: /bold/i }));

    expect(mockOnBeforeAction).toHaveBeenCalledWith('hello');
  });
});

// ── PostEditor undo/redo integration ────────────────────────────────────────
// These tests verify the history state via the PostEditor component itself.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as tagsApi from '../../api/tags';
import { PostEditor } from './PostEditor';

vi.mock('../../api/tags', () => ({
  getTags: vi.fn(),
}));

vi.mocked(tagsApi.getTags).mockResolvedValue([]);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('PostEditor — undo/redo via toolbar', () => {
  const mockOnSubmit = vi.fn();

  it('Undo after Bold reverts content; Redo re-applies Bold', async () => {
    render(
      <PostEditor
        onSubmit={mockOnSubmit}
        initialTitle="T"
        initialContent="hello"
      />,
      { wrapper: createWrapper() },
    );

    const contentTextarea = screen.getByRole('textbox', { name: /konten/i });

    // Verify initial content
    expect(contentTextarea).toHaveValue('hello');

    // Click Bold — cursor is at position 0 by default so placeholder is inserted there
    fireEvent.click(screen.getByRole('button', { name: /bold/i }));

    // Content now has bold placeholder inserted
    const boldedValue = (contentTextarea as HTMLTextAreaElement).value;
    expect(boldedValue).toContain('**teks tebal**');
    expect(boldedValue).toContain('hello');

    // Undo button should now be enabled — click it
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    expect(undoBtn).not.toBeDisabled();
    fireEvent.click(undoBtn);

    // Content should have reverted to 'hello'
    expect(contentTextarea).toHaveValue('hello');

    // Redo button should now be enabled — click it
    const redoBtn = screen.getByRole('button', { name: /redo/i });
    expect(redoBtn).not.toBeDisabled();
    fireEvent.click(redoBtn);

    // Content should be restored to the bolded version
    expect((contentTextarea as HTMLTextAreaElement).value).toContain('**teks tebal**');
  });
});
