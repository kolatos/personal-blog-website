/**
 * Component tests untuk FunDetailPage
 * Task 18 — Stage 2 New Sections
 *
 * Skenario yang dicakup:
 *  1. Merender judul fun post setelah berhasil fetch
 *  2. Merender seksi komentar dengan data-testid="fun-comments-section"
 *  3. Seksi komentar memuat heading "Komentar"
 *  4. Merender 404 ketika post tidak ditemukan
 *  5. Merender media display untuk type="image" dengan mediaUrl
 *  6. Merender type badge
 *  7. Merender tombol kembali ke /fun
 *  8. Merender pesan login untuk pengunjung yang belum login
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../contexts/AuthContext';
import FunDetailPage from './FunDetailPage';
import type { FunPost } from '../../types';

// ── Mock API modules ──────────────────────────────────────────────────────────

vi.mock('../../api/fun', () => ({
  getFunPostBySlug: vi.fn(),
}));

vi.mock('../../api/comments', () => ({
  getComments: vi.fn().mockResolvedValue([]),
  deleteComment: vi.fn(),
}));

import { getFunPostBySlug } from '../../api/fun';

const mockGetFunPostBySlug = vi.mocked(getFunPostBySlug);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFunPost(overrides: Partial<FunPost> = {}): FunPost {
  return {
    id: 'fun-1',
    title: 'Postingan Fun Keren',
    slug: 'postingan-fun-keren',
    excerpt: 'Ini adalah excerpt.',
    content: '## Konten\n\nIsi postingan fun.',
    contentHtml: '<h2>Konten</h2><p>Isi postingan fun.</p>',
    status: 'published',
    type: 'text',
    mediaUrl: null,
    tags: [],
    publishedAt: '2024-03-15T00:00:00.000Z',
    createdAt: '2024-03-10T00:00:00.000Z',
    updatedAt: '2024-03-15T00:00:00.000Z',
    ...overrides,
  };
}

function renderFunDetailPage(slug = 'postingan-fun-keren') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/fun/${slug}`]}>
          <Routes>
            <Route path="/fun/:slug" element={<FunDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FunDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merender judul fun post setelah berhasil fetch', async () => {
    mockGetFunPostBySlug.mockResolvedValue(makeFunPost());
    renderFunDetailPage();

    const title = await screen.findByTestId('fun-detail-title');
    expect(title).toHaveTextContent('Postingan Fun Keren');
  });

  it('merender seksi komentar dengan data-testid yang benar', async () => {
    mockGetFunPostBySlug.mockResolvedValue(makeFunPost());
    renderFunDetailPage();

    const commentsSection = await screen.findByTestId('fun-comments-section');
    expect(commentsSection).toBeInTheDocument();
  });

  it('seksi komentar memuat heading "Komentar"', async () => {
    mockGetFunPostBySlug.mockResolvedValue(makeFunPost());
    renderFunDetailPage();

    const heading = await screen.findByRole('heading', { name: /komentar/i });
    expect(heading).toBeInTheDocument();
  });

  it('merender halaman 404 ketika post tidak ditemukan', async () => {
    mockGetFunPostBySlug.mockRejectedValue({ response: { status: 404 } });
    renderFunDetailPage('slug-tidak-ada');

    const notFound = await screen.findByTestId('not-found');
    expect(notFound).toBeInTheDocument();
  });

  it('merender media display untuk type="image" dengan mediaUrl', async () => {
    mockGetFunPostBySlug.mockResolvedValue(
      makeFunPost({
        type: 'image',
        mediaUrl: 'https://example.com/gambar.jpg',
      }),
    );
    renderFunDetailPage();

    const media = await screen.findByTestId('fun-detail-media');
    expect(media).toBeInTheDocument();

    const img = media.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/gambar.jpg');
  });

  it('tidak merender media display untuk type="text"', async () => {
    mockGetFunPostBySlug.mockResolvedValue(makeFunPost({ type: 'text' }));
    renderFunDetailPage();

    // Wait for article to render
    await screen.findByTestId('fun-article');
    expect(screen.queryByTestId('fun-detail-media')).not.toBeInTheDocument();
  });

  it('merender type badge', async () => {
    mockGetFunPostBySlug.mockResolvedValue(makeFunPost({ type: 'review' }));
    renderFunDetailPage();

    const badge = await screen.findByTestId('fun-detail-type');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Ulasan');
  });

  it('merender tombol kembali dengan href="/fun"', async () => {
    mockGetFunPostBySlug.mockResolvedValue(makeFunPost());
    renderFunDetailPage();

    const backBtn = await screen.findByTestId('back-to-fun');
    expect(backBtn).toHaveAttribute('href', '/fun');
  });

  it('merender pesan login untuk pengunjung yang belum login', async () => {
    mockGetFunPostBySlug.mockResolvedValue(makeFunPost());
    renderFunDetailPage();

    // AuthProvider default state has no user
    const loginPrompt = await screen.findByText(/login/i);
    expect(loginPrompt).toBeInTheDocument();
  });

  it('merender tags ketika ada', async () => {
    mockGetFunPostBySlug.mockResolvedValue(
      makeFunPost({
        tags: [
          { id: 't1', name: 'buku', slug: 'buku' },
          { id: 't2', name: 'teknologi', slug: 'teknologi' },
        ],
      }),
    );
    renderFunDetailPage();

    const tagsContainer = await screen.findByTestId('fun-detail-tags');
    expect(tagsContainer).toBeInTheDocument();
    expect(screen.getByText('buku')).toBeInTheDocument();
    expect(screen.getByText('teknologi')).toBeInTheDocument();
  });

  it('merender music link untuk type="music" dengan mediaUrl', async () => {
    mockGetFunPostBySlug.mockResolvedValue(
      makeFunPost({
        type: 'music',
        mediaUrl: 'https://open.spotify.com/track/abc',
      }),
    );
    renderFunDetailPage();

    const musicLink = await screen.findByTestId('fun-detail-music-link');
    expect(musicLink).toBeInTheDocument();
    expect(musicLink).toHaveAttribute('href', 'https://open.spotify.com/track/abc');
  });
});
