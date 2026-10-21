import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../contexts/AuthContext';
import PostDetailPage from './PostDetailPage';
import type { Post } from '../../types';

// ── Mock API modules ──────────────────────────────────────────────────────────
vi.mock('../../api/posts', () => ({
  getPostBySlug: vi.fn(),
}));

vi.mock('../../api/comments', () => ({
  getComments: vi.fn().mockResolvedValue([]),
  deleteComment: vi.fn(),
}));

vi.mock('../../api/subscriptions', () => ({
  getSubscriptionStatus: vi.fn().mockResolvedValue({ subscribed: false }),
  subscribeToNewsletter: vi.fn().mockResolvedValue({ subscribed: true }),
  unsubscribeFromNewsletter: vi.fn().mockResolvedValue(undefined),
}));

import { getPostBySlug } from '../../api/posts';

const mockGetPostBySlug = vi.mocked(getPostBySlug);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    title: 'Judul Postingan',
    slug: 'judul-postingan',
    content: '# Hello',
    contentHtml: '<h1>Hello</h1>',
    status: 'published',
    publishedAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    commentCount: 0,
    tags: [],
    ...overrides,
  };
}

function renderPostDetailPage(slug = 'judul-postingan') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/blog/${slug}`]}>
          <Routes>
            <Route path="/blog/:slug" element={<PostDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PostDetailPage — tombol kembali', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders back button linking to "/blog" (blog root)', async () => {
    mockGetPostBySlug.mockResolvedValue(makePost());

    renderPostDetailPage();

    // Back button/link should appear after post loads
    const backLink = await screen.findByTestId('back-to-blog');
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/blog');
  });

  it('back button text contains "Kembali ke Blog"', async () => {
    mockGetPostBySlug.mockResolvedValue(makePost());

    renderPostDetailPage();

    const backLink = await screen.findByTestId('back-to-blog');
    expect(backLink).toHaveTextContent(/kembali ke blog/i);
  });
});
