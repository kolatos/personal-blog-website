import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import type { Post, PaginatedResponse } from '../../types';

// ── Mock API module ───────────────────────────────────────────────────────────
vi.mock('../../api/posts', () => ({
  getAllPosts: vi.fn(),
  publishPost: vi.fn(),
  unpublishPost: vi.fn(),
  deletePost: vi.fn(),
}));

import {
  getAllPosts,
  publishPost,
  unpublishPost,
  deletePost,
} from '../../api/posts';

const mockGetAllPosts = vi.mocked(getAllPosts);
const mockPublishPost = vi.mocked(publishPost);
const mockUnpublishPost = vi.mocked(unpublishPost);
const mockDeletePost = vi.mocked(deletePost);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    title: 'Postingan Pertama',
    slug: 'postingan-pertama',
    content: '# Konten',
    contentHtml: '<h1>Konten</h1>',
    status: 'draft',
    publishedAt: null,
    updatedAt: '2024-01-15T10:00:00.000Z',
    commentCount: 0,
    ...overrides,
  };
}

function emptyPage(): PaginatedResponse<Post> {
  return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
}

function pageWithPosts(posts: Post[]): PaginatedResponse<Post> {
  return { data: posts, total: posts.length, page: 1, pageSize: 20, totalPages: 1 };
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it('renders loading state while fetching posts', () => {
    // Keep query pending
    mockGetAllPosts.mockReturnValue(new Promise(() => {}));

    renderDashboard();

    // PostTable renders a loading spinner with aria-busy
    expect(screen.getByText(/memuat postingan/i)).toBeInTheDocument();
  });

  // ── Post list ─────────────────────────────────────────────────────────────

  it('renders PostTable with posts after fetch succeeds', async () => {
    const posts = [
      makePost({ id: 'p1', title: 'Post Satu', status: 'draft' }),
      makePost({ id: 'p2', title: 'Post Dua', status: 'published', publishedAt: '2024-01-10T00:00:00.000Z' }),
    ];
    mockGetAllPosts.mockResolvedValue(pageWithPosts(posts));

    renderDashboard();

    expect(await screen.findByText('Post Satu')).toBeInTheDocument();
    expect(screen.getByText('Post Dua')).toBeInTheDocument();
  });

  it('shows empty state when no posts exist', async () => {
    mockGetAllPosts.mockResolvedValue(emptyPage());

    renderDashboard();

    expect(await screen.findByText(/belum ada postingan/i)).toBeInTheDocument();
  });

  it('renders "Buat Postingan Baru" button', async () => {
    mockGetAllPosts.mockResolvedValue(emptyPage());

    renderDashboard();

    expect(await screen.findByRole('button', { name: /buat postingan baru/i })).toBeInTheDocument();
  });

  // ── Publish action ────────────────────────────────────────────────────────

  it('calls publishPost API and refetches when publish button clicked', async () => {
    const post = makePost({ status: 'draft' });
    mockGetAllPosts.mockResolvedValue(pageWithPosts([post]));
    mockPublishPost.mockResolvedValue({ ...post, status: 'published', publishedAt: '2024-01-16T00:00:00.000Z' });

    renderDashboard();

    const publishBtn = await screen.findByRole('button', { name: /publikasikan postingan/i });
    await userEvent.click(publishBtn);

    await waitFor(() => {
      expect(mockPublishPost).toHaveBeenCalledWith(post.id);
    });
    // After success, getAllPosts is called again (cache invalidated)
    await waitFor(() => {
      expect(mockGetAllPosts).toHaveBeenCalledTimes(2);
    });
  });

  it('shows confirmation dialog before publishing', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const post = makePost({ status: 'draft' });
    mockGetAllPosts.mockResolvedValue(pageWithPosts([post]));

    renderDashboard();

    const publishBtn = await screen.findByRole('button', { name: /publikasikan postingan/i });
    await userEvent.click(publishBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockPublishPost).not.toHaveBeenCalled();
  });

  // ── Unpublish action ──────────────────────────────────────────────────────

  it('calls unpublishPost API and refetches when unpublish button clicked', async () => {
    const post = makePost({ status: 'published', publishedAt: '2024-01-10T00:00:00.000Z' });
    mockGetAllPosts.mockResolvedValue(pageWithPosts([post]));
    mockUnpublishPost.mockResolvedValue({ ...post, status: 'draft', publishedAt: null });

    renderDashboard();

    const unpublishBtn = await screen.findByRole('button', { name: /batalkan publikasi postingan/i });
    await userEvent.click(unpublishBtn);

    await waitFor(() => {
      expect(mockUnpublishPost).toHaveBeenCalledWith(post.id);
    });
    await waitFor(() => {
      expect(mockGetAllPosts).toHaveBeenCalledTimes(2);
    });
  });

  it('does not call unpublishPost when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const post = makePost({ status: 'published', publishedAt: '2024-01-10T00:00:00.000Z' });
    mockGetAllPosts.mockResolvedValue(pageWithPosts([post]));

    renderDashboard();

    const unpublishBtn = await screen.findByRole('button', { name: /batalkan publikasi postingan/i });
    await userEvent.click(unpublishBtn);

    expect(mockUnpublishPost).not.toHaveBeenCalled();
  });

  // ── Delete action ─────────────────────────────────────────────────────────

  it('shows confirmation dialog before deleting', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const post = makePost();
    mockGetAllPosts.mockResolvedValue(pageWithPosts([post]));

    renderDashboard();

    const deleteBtn = await screen.findByRole('button', { name: /hapus postingan/i });
    await userEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockDeletePost).not.toHaveBeenCalled();
  });

  it('calls deletePost API and refetches after delete confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const post = makePost();
    mockGetAllPosts.mockResolvedValue(pageWithPosts([post]));
    mockDeletePost.mockResolvedValue(undefined);

    renderDashboard();

    const deleteBtn = await screen.findByRole('button', { name: /hapus postingan/i });
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockDeletePost).toHaveBeenCalledWith(post.id);
    });
    await waitFor(() => {
      expect(mockGetAllPosts).toHaveBeenCalledTimes(2);
    });
  });

  // ── Error states ──────────────────────────────────────────────────────────

  it('shows error message when publishPost API call fails', async () => {
    const post = makePost({ status: 'draft' });
    mockGetAllPosts.mockResolvedValue(pageWithPosts([post]));
    mockPublishPost.mockRejectedValue(new Error('Server error'));

    renderDashboard();

    const publishBtn = await screen.findByRole('button', { name: /publikasikan postingan/i });
    await userEvent.click(publishBtn);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/gagal mempublikasikan/i)).toBeInTheDocument();
  });

  it('shows error message when unpublishPost API call fails', async () => {
    const post = makePost({ status: 'published', publishedAt: '2024-01-10T00:00:00.000Z' });
    mockGetAllPosts.mockResolvedValue(pageWithPosts([post]));
    mockUnpublishPost.mockRejectedValue(new Error('Server error'));

    renderDashboard();

    const unpublishBtn = await screen.findByRole('button', { name: /batalkan publikasi postingan/i });
    await userEvent.click(unpublishBtn);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/gagal membatalkan publikasi/i)).toBeInTheDocument();
  });

  it('shows error message when deletePost API call fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const post = makePost();
    mockGetAllPosts.mockResolvedValue(pageWithPosts([post]));
    mockDeletePost.mockRejectedValue(new Error('Server error'));

    renderDashboard();

    const deleteBtn = await screen.findByRole('button', { name: /hapus postingan/i });
    await userEvent.click(deleteBtn);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/gagal menghapus/i)).toBeInTheDocument();
  });
});
