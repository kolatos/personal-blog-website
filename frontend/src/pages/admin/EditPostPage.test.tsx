import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import EditPostPage from './EditPostPage';
import type { Post } from '../../types';

// ── Mock API modules ──────────────────────────────────────────────────────────
vi.mock('../../api/posts', () => ({
  getAdminPostById: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock('../../api/tags', () => ({
  getTags: vi.fn().mockResolvedValue([]),
}));

// ── Mock react-router-dom ─────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'post-abc-123' }),
  };
});

import { getAdminPostById, updatePost } from '../../api/posts';

const mockGetAdminPostById = vi.mocked(getAdminPostById);
const mockUpdatePost = vi.mocked(updatePost);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDraftPost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-abc-123',
    title: 'Draft Postingan',
    slug: 'draft-postingan',
    content: '## Konten Draft',
    contentHtml: '<h2>Konten Draft</h2>',
    status: 'draft',
    publishedAt: null,
    updatedAt: '2024-01-15T10:00:00.000Z',
    commentCount: 0,
    tags: [],
    ...overrides,
  };
}

function makePublishedPost(overrides: Partial<Post> = {}): Post {
  return makeDraftPost({
    status: 'published',
    publishedAt: '2024-01-10T00:00:00.000Z',
    ...overrides,
  });
}

function renderEditPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EditPostPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EditPostPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it('shows loading state while fetching post data', () => {
    mockGetAdminPostById.mockReturnValue(new Promise(() => {}));

    renderEditPage();

    expect(screen.getByText(/memuat/i)).toBeInTheDocument();
  });

  // ── Data display ─────────────────────────────────────────────────────────

  it('renders PostEditor pre-filled with existing post data', async () => {
    const post = makeDraftPost();
    mockGetAdminPostById.mockResolvedValue(post);

    renderEditPage();

    expect(await screen.findByLabelText(/judul/i)).toHaveValue(post.title);
    expect(screen.getByRole('textbox', { name: /konten/i })).toHaveValue(post.content);
  });

  it('renders page heading "Edit Postingan"', async () => {
    mockGetAdminPostById.mockResolvedValue(makeDraftPost());

    renderEditPage();

    expect(await screen.findByRole('heading', { name: /edit postingan/i })).toBeInTheDocument();
  });

  // ── Published post warning ────────────────────────────────────────────────

  it('shows warning notification that published post will revert to draft on save', async () => {
    mockGetAdminPostById.mockResolvedValue(makePublishedPost());

    renderEditPage();

    // Wait for data to load
    await screen.findByLabelText(/judul/i);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/draft/i);
  });

  it('does NOT show the published warning for a draft post', async () => {
    mockGetAdminPostById.mockResolvedValue(makeDraftPost());

    renderEditPage();

    await screen.findByLabelText(/judul/i);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // ── Not found / error ─────────────────────────────────────────────────────

  it('shows error message when post is not found', async () => {
    const notFoundError = { response: { status: 404 } };
    mockGetAdminPostById.mockRejectedValue(notFoundError);

    renderEditPage();

    expect(await screen.findByText(/gagal memuat postingan/i)).toBeInTheDocument();
  });

  it('shows error message when fetch fails with server error', async () => {
    mockGetAdminPostById.mockRejectedValue(new Error('Server error'));

    renderEditPage();

    expect(await screen.findByText(/gagal memuat postingan/i)).toBeInTheDocument();
  });

  // ── Submit handling ───────────────────────────────────────────────────────

  it('calls updatePost API with correct data on valid submit', async () => {
    const post = makeDraftPost();
    mockGetAdminPostById.mockResolvedValue(post);
    mockUpdatePost.mockResolvedValue({ ...post, title: 'Judul Diperbarui' });

    renderEditPage();

    // Wait for form to be ready
    const titleInput = await screen.findByLabelText(/judul/i);

    // Clear and type a new title
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Judul Diperbarui');

    await userEvent.click(screen.getByRole('button', { name: /simpan perubahan/i }));

    await waitFor(() => {
      expect(mockUpdatePost).toHaveBeenCalledWith('post-abc-123', {
        title: 'Judul Diperbarui',
        content: post.content,
        tags: [],
      });
    });
  });

  it('redirects to /admin dashboard after successful update', async () => {
    const post = makeDraftPost();
    mockGetAdminPostById.mockResolvedValue(post);
    mockUpdatePost.mockResolvedValue(post);

    renderEditPage();

    await screen.findByLabelText(/judul/i);

    await userEvent.click(screen.getByRole('button', { name: /simpan perubahan/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });
  });

  it('shows server error message when update API returns error', async () => {
    const post = makeDraftPost();
    mockGetAdminPostById.mockResolvedValue(post);
    const apiError = {
      response: {
        data: { error: { message: 'Judul sudah digunakan' } },
      },
    };
    mockUpdatePost.mockRejectedValue(apiError);

    renderEditPage();

    await screen.findByLabelText(/judul/i);

    await userEvent.click(screen.getByRole('button', { name: /simpan perubahan/i }));

    expect(await screen.findByText(/judul sudah digunakan/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows generic error message when update API fails without message', async () => {
    const post = makeDraftPost();
    mockGetAdminPostById.mockResolvedValue(post);
    mockUpdatePost.mockRejectedValue(new Error('Network Error'));

    renderEditPage();

    await screen.findByLabelText(/judul/i);

    await userEvent.click(screen.getByRole('button', { name: /simpan perubahan/i }));

    expect(await screen.findByText(/terjadi kesalahan/i)).toBeInTheDocument();
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it('shows validation error when title is cleared before submit', async () => {
    const post = makeDraftPost();
    mockGetAdminPostById.mockResolvedValue(post);

    renderEditPage();

    const titleInput = await screen.findByLabelText(/judul/i);
    await userEvent.clear(titleInput);

    await userEvent.click(screen.getByRole('button', { name: /simpan perubahan/i }));

    expect(await screen.findByText(/judul tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockUpdatePost).not.toHaveBeenCalled();
  });
});
