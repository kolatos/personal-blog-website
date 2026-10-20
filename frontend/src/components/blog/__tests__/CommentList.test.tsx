import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentList } from '../CommentList';
import type { Comment } from '../../../types';

// Mock the addComment API so form submissions don't hit the network
vi.mock('../../../api/comments', () => ({
  addComment: vi.fn(),
}));

import { addComment } from '../../../api/comments';
const mockAddComment = vi.mocked(addComment);

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeComment(overrides?: Partial<Comment>): Comment {
  return {
    id: 'comment-1',
    contentType: 'post',
    contentId: 'post-1',
    authorId: 'user-1',
    authorUsername: 'alice',
    content: 'Ini komentar pertama',
    parentId: null,
    replies: [],
    createdAt: '2025-01-14T00:00:00.000Z',
    ...overrides,
  };
}

function makeReply(overrides?: Partial<Comment>): Comment {
  return {
    id: 'reply-1',
    contentType: 'post',
    contentId: 'post-1',
    authorId: 'user-2',
    authorUsername: 'bob',
    content: 'Ini balasan dari bob',
    parentId: 'comment-1',
    replies: [],
    createdAt: '2025-01-14T01:00:00.000Z',
    ...overrides,
  };
}

// ── Default props ─────────────────────────────────────────────────────────────

const defaultProps = {
  contentType: 'post',
  contentId: 'post-1',
  currentUserId: 'user-1',
  currentUserRole: 'user' as const,
  onDeleteComment: vi.fn(),
  onCommentAdded: vi.fn(),
  isDeletingId: undefined,
  isAuthenticated: true,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: Top-level comments render with Reply button ───────────────────

  it('komentar level atas merender dengan tombol "Balas"', () => {
    const comment = makeComment();
    render(
      <CommentList {...defaultProps} comments={[comment]} />,
    );

    // The comment text is shown
    expect(screen.getByText('Ini komentar pertama')).toBeInTheDocument();

    // The Reply button is present on the top-level comment item
    const commentItem = screen.getByTestId('comment-item');
    const replyButton = within(commentItem).getByTestId('reply-button');
    expect(replyButton).toBeInTheDocument();
    expect(replyButton).toHaveTextContent(/balas/i);
  });

  // ── Test 2: Reply comments render with Reply button ───────────────────────

  it('balasan merender dengan tombol "Balas"', () => {
    const reply = makeReply();
    const comment = makeComment({ replies: [reply] });

    render(<CommentList {...defaultProps} comments={[comment]} />);

    // The reply item should exist
    const replyItem = screen.getByTestId('reply-item');
    expect(replyItem).toBeInTheDocument();
    expect(within(replyItem).getByText('Ini balasan dari bob')).toBeInTheDocument();

    // The reply item also has a Reply button
    const replyButton = within(replyItem).getByTestId('reply-button');
    expect(replyButton).toBeInTheDocument();
    expect(replyButton).toHaveTextContent(/balas/i);
  });

  // ── Test 3: Clicking Reply on top-level opens inline form ─────────────────

  it('klik "Balas" pada komentar level atas membuka form inline', async () => {
    const comment = makeComment({ authorUsername: 'alice' });
    render(<CommentList {...defaultProps} comments={[comment]} />);

    // No inline form initially
    expect(screen.queryByTestId('inline-reply-form')).not.toBeInTheDocument();

    // Click the Reply button on the top-level comment
    const commentItem = screen.getByTestId('comment-item');
    const replyButton = within(commentItem).getByTestId('reply-button');
    await userEvent.click(replyButton);

    // Inline reply form should now be visible inside the comment item
    const inlineForm = within(commentItem).getByTestId('inline-reply-form');
    expect(inlineForm).toBeInTheDocument();

    // The textarea should be pre-filled with @alice
    const textarea = within(inlineForm).getByRole('textbox');
    expect(textarea).toHaveValue('@alice ');
  });

  // ── Test 4: Clicking Reply on a nested reply fills top-level form ─────────

  it('klik "Balas" pada balasan mengisi top-level form dengan @username, tidak membuka form baru', async () => {
    const reply = makeReply({ authorUsername: 'bob' });
    const comment = makeComment({ replies: [reply] });

    render(<CommentList {...defaultProps} comments={[comment]} />);

    // No inline reply form initially on the top-level comment
    const commentItem = screen.getByTestId('comment-item');
    expect(within(commentItem).queryByTestId('inline-reply-form')).not.toBeInTheDocument();

    // Click the Reply button on the nested reply
    const replyItem = screen.getByTestId('reply-item');
    const replyReplyButton = within(replyItem).getByTestId('reply-button');
    await userEvent.click(replyReplyButton);

    // No NEW inline form should open on the reply item
    expect(within(replyItem).queryByTestId('inline-reply-form')).not.toBeInTheDocument();

    // The top-level comment form (in the page footer area) should be pre-filled with @bob
    const topLevelFormArea = screen.getByTestId('top-level-form-area');
    const topTextarea = within(topLevelFormArea).getByRole('textbox');
    expect(topTextarea).toHaveValue('@bob ');
  });

  // ── Test 5: Nested replies appear indented under parent ───────────────────

  it('balasan bersarang tampil diindentasi di bawah parent', () => {
    const reply1 = makeReply({ id: 'r1', authorUsername: 'bob', content: 'Balasan pertama' });
    const reply2 = makeReply({ id: 'r2', authorUsername: 'charlie', content: 'Balasan kedua' });
    const comment = makeComment({ replies: [reply1, reply2] });

    render(<CommentList {...defaultProps} comments={[comment]} />);

    // Replies list container should exist
    const repliesList = screen.getByTestId('replies-list');
    expect(repliesList).toBeInTheDocument();

    // Both replies should appear inside it
    expect(within(repliesList).getByText('Balasan pertama')).toBeInTheDocument();
    expect(within(repliesList).getByText('Balasan kedua')).toBeInTheDocument();

    // The replies list should have the indentation class
    expect(repliesList).toHaveClass('ml-8');
  });

  // ── Additional: inline form submit resets and calls onCommentAdded ─────────

  it('submit balasan inline memanggil onCommentAdded dan menutup form', async () => {
    const newReply = makeReply({ id: 'new-reply', content: 'Balasan baru' });
    mockAddComment.mockResolvedValueOnce(newReply);

    const comment = makeComment({ authorUsername: 'alice' });
    render(<CommentList {...defaultProps} comments={[comment]} />);

    // Open inline reply form
    const commentItem = screen.getByTestId('comment-item');
    await userEvent.click(within(commentItem).getByTestId('reply-button'));

    const inlineForm = within(commentItem).getByTestId('inline-reply-form');
    const textarea = within(inlineForm).getByRole('textbox');

    // Type a reply
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Balasan baru');

    // Submit
    await userEvent.click(within(inlineForm).getByRole('button', { name: /kirim balasan/i }));

    await waitFor(() => {
      expect(mockAddComment).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: 'post',
          contentId: 'post-1',
          parentId: 'comment-1',
          content: 'Balasan baru',
        }),
      );
      expect(defaultProps.onCommentAdded).toHaveBeenCalledWith(newReply);
    });

    // Inline form should be closed after submit
    expect(within(commentItem).queryByTestId('inline-reply-form')).not.toBeInTheDocument();
  });
});
