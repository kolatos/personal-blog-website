import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentForm } from '../CommentForm';
import type { Comment } from '../../../types';

/**
 * Helper: sets a textarea value directly via fireEvent.change.
 * Avoids the slowness of userEvent.type for long strings.
 */
function setTextareaValue(textarea: HTMLElement, value: string) {
  fireEvent.change(textarea, { target: { value } });
}

// Mock the addComment API function
vi.mock('../../../api/comments', () => ({
  addComment: vi.fn(),
}));

import { addComment } from '../../../api/comments';

const mockAddComment = vi.mocked(addComment);

const mockComment: Comment = {
  id: 'comment-1',
  contentType: 'post',
  contentId: 'post-1',
  authorId: 'user-1',
  authorUsername: 'testuser',
  content: 'Komentar bagus!',
  parentId: null,
  replies: [],
  createdAt: '2025-01-14T00:00:00.000Z',
};

/** Default props using the generic contentType/contentId API */
const defaultProps = {
  contentType: 'post',
  contentId: 'post-1',
  onCommentAdded: vi.fn(),
};

describe('CommentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the textarea and submit button', () => {
    render(<CommentForm {...defaultProps} />);
    expect(screen.getByLabelText(/tambah komentar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kirim komentar/i })).toBeInTheDocument();
  });

  it('shows character counter with max 2000', () => {
    render(<CommentForm {...defaultProps} />);
    expect(screen.getByText('0/2000')).toBeInTheDocument();
  });

  it('updates character counter as user types', () => {
    render(<CommentForm {...defaultProps} />);
    const textarea = screen.getByLabelText(/tambah komentar/i);
    setTextareaValue(textarea, 'Hello');
    expect(screen.getByText('5/2000')).toBeInTheDocument();
  });

  it('shows validation error for empty content on submit', async () => {
    render(<CommentForm {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /kirim komentar/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/tidak boleh kosong/i);
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('shows validation error when content exceeds 2000 characters', async () => {
    render(<CommentForm {...defaultProps} />);
    const textarea = screen.getByLabelText(/tambah komentar/i);
    const longText = 'A'.repeat(2001);
    setTextareaValue(textarea, longText);
    await userEvent.click(screen.getByRole('button', { name: /kirim komentar/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/terlalu panjang/i);
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it('submits successfully with valid content', async () => {
    mockAddComment.mockResolvedValueOnce(mockComment);
    render(<CommentForm {...defaultProps} />);
    const textarea = screen.getByLabelText(/tambah komentar/i);
    setTextareaValue(textarea, 'Komentar bagus!');
    await userEvent.click(screen.getByRole('button', { name: /kirim komentar/i }));
    await waitFor(() => {
      expect(mockAddComment).toHaveBeenCalledWith({
        contentType: 'post',
        contentId: 'post-1',
        content: 'Komentar bagus!',
        parentId: undefined,
      });
      expect(defaultProps.onCommentAdded).toHaveBeenCalledWith(mockComment);
    });
    // Textarea should be cleared after successful submit
    expect(textarea).toHaveValue('');
  });

  it('submits a reply with parentId when parentId prop is provided', async () => {
    const replyComment: Comment = { ...mockComment, id: 'reply-1', parentId: 'comment-1' };
    mockAddComment.mockResolvedValueOnce(replyComment);
    render(
      <CommentForm
        {...defaultProps}
        parentId="comment-1"
        parentAuthorUsername="alice"
      />,
    );

    // Label should change to "Tulis Balasan"
    expect(screen.getByLabelText(/tulis balasan/i)).toBeInTheDocument();
    // Textarea should be pre-filled with @alice mention
    expect(screen.getByRole('textbox')).toHaveValue('@alice ');

    const textarea = screen.getByLabelText(/tulis balasan/i);
    // Append text after the mention
    setTextareaValue(textarea, '@alice ini balasan');

    await userEvent.click(screen.getByRole('button', { name: /kirim balasan/i }));
    await waitFor(() => {
      expect(mockAddComment).toHaveBeenCalledWith({
        contentType: 'post',
        contentId: 'post-1',
        content: '@alice ini balasan',
        parentId: 'comment-1',
      });
    });
  });

  it('shows server error when API call fails', async () => {
    mockAddComment.mockRejectedValueOnce({
      response: { data: { error: { message: 'Server sedang bermasalah.' } } },
    });
    render(<CommentForm {...defaultProps} />);
    const textarea = screen.getByLabelText(/tambah komentar/i);
    setTextareaValue(textarea, 'Komentar ini akan gagal.');
    await userEvent.click(screen.getByRole('button', { name: /kirim komentar/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/server sedang bermasalah/i);
    });
    expect(defaultProps.onCommentAdded).not.toHaveBeenCalled();
  });

  it('shows fallback error message when API error has no message', async () => {
    mockAddComment.mockRejectedValueOnce(new Error('Network error'));
    render(<CommentForm {...defaultProps} />);
    const textarea = screen.getByLabelText(/tambah komentar/i);
    setTextareaValue(textarea, 'Komentar ini juga gagal.');
    await userEvent.click(screen.getByRole('button', { name: /kirim komentar/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/gagal mengirim komentar/i);
    });
  });
});
