import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PostCard } from '../PostCard';
import type { Post } from '../../../types';

const basePost: Post = {
  id: 'post-1',
  title: 'Judul Postingan Pertama',
  slug: 'judul-postingan-pertama',
  content: 'Ini adalah konten artikel yang sangat menarik untuk dibaca.',
  contentHtml: '<p>Ini adalah konten artikel yang sangat menarik untuk dibaca.</p>',
  status: 'published',
  publishedAt: '2025-01-14T00:00:00.000Z',
  updatedAt: '2025-01-14T00:00:00.000Z',
  commentCount: 5,
};

function renderPostCard(post: Post = basePost) {
  return render(
    <MemoryRouter>
      <PostCard post={post} />
    </MemoryRouter>,
  );
}

describe('PostCard', () => {
  it('renders post title correctly', () => {
    renderPostCard();
    expect(screen.getByRole('heading', { name: /judul postingan pertama/i })).toBeInTheDocument();
  });

  it('renders content summary (first 200 chars of plain text)', () => {
    const longContent = 'A'.repeat(250);
    renderPostCard({ ...basePost, content: longContent });

    // Summary should be 200 chars + '...'
    const expectedSummary = 'A'.repeat(200) + '...';
    expect(screen.getByText(expectedSummary)).toBeInTheDocument();
  });

  it('does not truncate content shorter than 200 chars', () => {
    renderPostCard();
    expect(
      screen.getByText('Ini adalah konten artikel yang sangat menarik untuk dibaca.'),
    ).toBeInTheDocument();
  });

  it('renders publication date in Indonesian format', () => {
    renderPostCard();
    // 14 Januari 2025 in id-ID locale
    expect(screen.getByText(/januari/i)).toBeInTheDocument();
  });

  it('does not render date when publishedAt is null', () => {
    renderPostCard({ ...basePost, publishedAt: null });
    expect(screen.queryByRole('time')).not.toBeInTheDocument();
  });

  it('renders comment count', () => {
    renderPostCard();
    expect(screen.getByText(/5\s*komentar/i)).toBeInTheDocument();
  });

  it('link navigates to correct post URL using slug', () => {
    renderPostCard();
    const link = screen.getByRole('link', { name: /judul postingan pertama/i });
    expect(link).toHaveAttribute('href', '/posts/judul-postingan-pertama');
  });

  it('strips markdown heading syntax from summary', () => {
    renderPostCard({ ...basePost, content: '# Heading\n\nParagraf biasa.' });
    expect(screen.getByText(/heading/i)).toBeInTheDocument();
    // The # character should not appear
    expect(screen.queryByText(/#/)).not.toBeInTheDocument();
  });
});
