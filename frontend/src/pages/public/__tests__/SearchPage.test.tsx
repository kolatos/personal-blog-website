import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SearchPage from '../SearchPage';
import type { PaginatedResponse, Post } from '../../../types';

// Mock the searchPosts API function
vi.mock('../../../api/posts', () => ({
  searchPosts: vi.fn(),
}));

import { searchPosts } from '../../../api/posts';

const mockSearchPosts = vi.mocked(searchPosts);

const samplePost: Post = {
  id: 'post-1',
  title: 'Artikel Tentang React',
  slug: 'artikel-tentang-react',
  content: 'React adalah library JavaScript yang populer untuk membangun UI.',
  contentHtml: '<p>React adalah library JavaScript yang populer.</p>',
  status: 'published',
  publishedAt: '2025-01-14T00:00:00.000Z',
  updatedAt: '2025-01-14T00:00:00.000Z',
  commentCount: 3,
  tags: [],
};

const emptyResponse: PaginatedResponse<Post> = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0,
};

const resultsResponse: PaginatedResponse<Post> = {
  data: [samplePost],
  total: 1,
  page: 1,
  pageSize: 10,
  totalPages: 1,
};

function renderSearchPage(initialEntries: string[] = ['/search']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <SearchPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the search form', () => {
    renderSearchPage();
    expect(screen.getByRole('button', { name: /cari/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/kata kunci pencarian/i)).toBeInTheDocument();
  });

  it('shows placeholder prompt when no keyword is entered', () => {
    renderSearchPage();
    expect(screen.getByText(/masukkan kata kunci/i)).toBeInTheDocument();
  });

  it('shows validation error when keyword is empty and form is submitted', async () => {
    renderSearchPage();
    await userEvent.click(screen.getByRole('button', { name: /cari/i }));
    expect(screen.getByText(/tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockSearchPosts).not.toHaveBeenCalled();
  });

  it('shows validation error when keyword is only whitespace', async () => {
    renderSearchPage();
    const input = screen.getByLabelText(/kata kunci pencarian/i);
    await userEvent.type(input, '   ');
    await userEvent.click(screen.getByRole('button', { name: /cari/i }));
    expect(screen.getByText(/tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockSearchPosts).not.toHaveBeenCalled();
  });

  it('clears validation error when user starts typing after error', async () => {
    renderSearchPage();
    await userEvent.click(screen.getByRole('button', { name: /cari/i }));
    expect(screen.getByText(/tidak boleh kosong/i)).toBeInTheDocument();
    const input = screen.getByLabelText(/kata kunci pencarian/i);
    await userEvent.type(input, 'react');
    expect(screen.queryByText(/tidak boleh kosong/i)).not.toBeInTheDocument();
  });

  it('calls searchPosts API with keyword when form is submitted with valid input', async () => {
    mockSearchPosts.mockResolvedValueOnce(resultsResponse);
    renderSearchPage();
    const input = screen.getByLabelText(/kata kunci pencarian/i);
    await userEvent.type(input, 'react');
    await userEvent.click(screen.getByRole('button', { name: /cari/i }));
    await waitFor(() => {
      expect(mockSearchPosts).toHaveBeenCalledWith('react', 1);
    });
  });

  it('displays search results as PostCard list when keyword is valid', async () => {
    mockSearchPosts.mockResolvedValueOnce(resultsResponse);
    renderSearchPage();
    const input = screen.getByLabelText(/kata kunci pencarian/i);
    await userEvent.type(input, 'react');
    await userEvent.click(screen.getByRole('button', { name: /cari/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /artikel tentang react/i })).toBeInTheDocument();
    });
  });

  it('shows "tidak ada hasil" message when search returns empty array', async () => {
    mockSearchPosts.mockResolvedValueOnce(emptyResponse);
    renderSearchPage();
    const input = screen.getByLabelText(/kata kunci pencarian/i);
    await userEvent.type(input, 'xyzabc123notfound');
    await userEvent.click(screen.getByRole('button', { name: /cari/i }));
    await waitFor(() => {
      expect(screen.getByText(/tidak ada hasil/i)).toBeInTheDocument();
    });
  });

  it('pre-fills input from URL ?q= param and executes search', async () => {
    mockSearchPosts.mockResolvedValueOnce(resultsResponse);
    renderSearchPage(['/search?q=react']);
    await waitFor(() => {
      expect(mockSearchPosts).toHaveBeenCalledWith('react', 1);
    });
    const input = screen.getByLabelText(/kata kunci pencarian/i) as HTMLInputElement;
    expect(input.value).toBe('react');
  });
});
