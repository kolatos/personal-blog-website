import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CreatePostPage from './CreatePostPage';
import type { Post } from '../../types';

// ── Mock API module ───────────────────────────────────────────────────────────
vi.mock('../../api/posts', () => ({
  createPost: vi.fn(),
}));

// ── Mock react-router-dom navigate ───────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { createPost } from '../../api/posts';

const mockCreatePost = vi.mocked(createPost);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'new-post-1',
    title: 'Judul Baru',
    slug: 'judul-baru',
    content: '# Konten',
    contentHtml: '<h1>Konten</h1>',
    status: 'draft',
    publishedAt: null,
    updatedAt: new Date().toISOString(),
    commentCount: 0,
    ...overrides,
  };
}

function renderCreatePage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreatePostPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreatePostPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page heading', () => {
    renderCreatePage();
    expect(screen.getByRole('heading', { name: /buat postingan baru/i })).toBeInTheDocument();
  });

  it('renders PostEditor with empty form', () => {
    renderCreatePage();

    expect(screen.getByLabelText(/judul/i)).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /konten/i })).toHaveValue('');
  });

  it('shows validation errors when form is submitted with empty title', async () => {
    renderCreatePage();

    // Fill only content, leave title empty
    const contentArea = screen.getByRole('textbox', { name: /konten/i });
    await userEvent.type(contentArea, 'Isi konten');

    const submitBtn = screen.getByRole('button', { name: /publikasikan nanti/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/judul tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it('shows validation errors when form is submitted with empty content', async () => {
    renderCreatePage();

    // Fill only title, leave content empty
    const titleInput = screen.getByLabelText(/judul/i);
    await userEvent.type(titleInput, 'Judul Ada');

    const submitBtn = screen.getByRole('button', { name: /publikasikan nanti/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/konten tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it('shows validation errors when both fields are empty', async () => {
    renderCreatePage();

    const submitBtn = screen.getByRole('button', { name: /publikasikan nanti/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/judul tidak boleh kosong/i)).toBeInTheDocument();
    expect(screen.getByText(/konten tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it('calls createPost API with correct data on valid submit', async () => {
    mockCreatePost.mockResolvedValue(makePost());

    renderCreatePage();

    await userEvent.type(screen.getByLabelText(/judul/i), 'Judul Postingan Baru');
    await userEvent.type(screen.getByRole('textbox', { name: /konten/i }), 'Isi konten postingan');

    await userEvent.click(screen.getByRole('button', { name: /publikasikan nanti/i }));

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledWith({
        title: 'Judul Postingan Baru',
        content: 'Isi konten postingan',
      });
    });
  });

  it('redirects to /admin dashboard after successful creation', async () => {
    mockCreatePost.mockResolvedValue(makePost());

    renderCreatePage();

    await userEvent.type(screen.getByLabelText(/judul/i), 'Judul');
    await userEvent.type(screen.getByRole('textbox', { name: /konten/i }), 'Konten');

    await userEvent.click(screen.getByRole('button', { name: /publikasikan nanti/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });
  });

  it('shows server error message when API returns error', async () => {
    const apiError = {
      response: {
        data: { error: { message: 'Judul sudah digunakan oleh postingan lain' } },
      },
    };
    mockCreatePost.mockRejectedValue(apiError);

    renderCreatePage();

    await userEvent.type(screen.getByLabelText(/judul/i), 'Judul Duplikat');
    await userEvent.type(screen.getByRole('textbox', { name: /konten/i }), 'Konten');

    await userEvent.click(screen.getByRole('button', { name: /publikasikan nanti/i }));

    expect(await screen.findByText(/judul sudah digunakan oleh postingan lain/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows generic error when API fails without a message', async () => {
    mockCreatePost.mockRejectedValue(new Error('Network Error'));

    renderCreatePage();

    await userEvent.type(screen.getByLabelText(/judul/i), 'Judul');
    await userEvent.type(screen.getByRole('textbox', { name: /konten/i }), 'Konten');

    await userEvent.click(screen.getByRole('button', { name: /publikasikan nanti/i }));

    expect(await screen.findByText(/terjadi kesalahan/i)).toBeInTheDocument();
  });
});
