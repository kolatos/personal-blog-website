/**
 * Component tests untuk ProjectDetailPage
 * Task 17 — Stage 2 New Sections
 *
 * Skenario yang dicakup:
 *  1. Merender judul project setelah berhasil fetch
 *  2. Merender seksi komentar dengan contentType="project" yang benar
 *  3. Merender 404 ketika project tidak ditemukan
 *  4. Merender tech tags
 *  5. Merender link repo dan demo
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../contexts/AuthContext';
import ProjectDetailPage from './ProjectDetailPage';
import type { Project } from '../../types';

// ── Mock API modules ──────────────────────────────────────────────────────────

vi.mock('../../api/projects', () => ({
  getProjectBySlug: vi.fn(),
}));

vi.mock('../../api/comments', () => ({
  getComments: vi.fn().mockResolvedValue([]),
  deleteComment: vi.fn(),
}));

import { getProjectBySlug } from '../../api/projects';

const mockGetProjectBySlug = vi.mocked(getProjectBySlug);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Proyek Luar Biasa',
    slug: 'proyek-luar-biasa',
    description: '## Deskripsi\n\nIni adalah proyek luar biasa.',
    contentHtml: '<h2>Deskripsi</h2><p>Ini adalah proyek luar biasa.</p>',
    status: 'published',
    order: 0,
    techTags: [
      { id: 'tag-1', name: 'typescript', slug: 'typescript' },
      { id: 'tag-2', name: 'nodejs', slug: 'nodejs' },
    ],
    repoUrl: 'https://github.com/user/project',
    demoUrl: 'https://project.example.com',
    publishedAt: '2024-02-01T00:00:00.000Z',
    createdAt: '2024-01-20T00:00:00.000Z',
    updatedAt: '2024-02-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderProjectDetailPage(slug = 'proyek-luar-biasa') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/projects/${slug}`]}>
          <Routes>
            <Route path="/projects/:slug" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merender judul project setelah berhasil fetch', async () => {
    mockGetProjectBySlug.mockResolvedValue(makeProject());
    renderProjectDetailPage();

    const title = await screen.findByTestId('project-title');
    expect(title).toHaveTextContent('Proyek Luar Biasa');
  });

  it('merender seksi komentar dengan data-testid yang benar', async () => {
    mockGetProjectBySlug.mockResolvedValue(makeProject());
    renderProjectDetailPage();

    const commentsSection = await screen.findByTestId('project-comments-section');
    expect(commentsSection).toBeInTheDocument();
  });

  it('seksi komentar memuat heading "Komentar"', async () => {
    mockGetProjectBySlug.mockResolvedValue(makeProject());
    renderProjectDetailPage();

    const heading = await screen.findByRole('heading', { name: /komentar/i });
    expect(heading).toBeInTheDocument();
  });

  it('merender tombol kembali ke halaman projects', async () => {
    mockGetProjectBySlug.mockResolvedValue(makeProject());
    renderProjectDetailPage();

    const backBtn = await screen.findByTestId('back-to-projects');
    expect(backBtn).toHaveAttribute('href', '/projects');
  });

  it('merender tech tags project', async () => {
    mockGetProjectBySlug.mockResolvedValue(makeProject());
    renderProjectDetailPage();

    const tagsContainer = await screen.findByTestId('project-tech-tags');
    expect(tagsContainer).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('nodejs')).toBeInTheDocument();
  });

  it('merender link repo', async () => {
    mockGetProjectBySlug.mockResolvedValue(makeProject());
    renderProjectDetailPage();

    const repoLink = await screen.findByTestId('project-repo-link');
    expect(repoLink).toHaveAttribute('href', 'https://github.com/user/project');
  });

  it('merender link demo', async () => {
    mockGetProjectBySlug.mockResolvedValue(makeProject());
    renderProjectDetailPage();

    const demoLink = await screen.findByTestId('project-demo-link');
    expect(demoLink).toHaveAttribute('href', 'https://project.example.com');
  });

  it('merender halaman 404 ketika project tidak ditemukan', async () => {
    mockGetProjectBySlug.mockRejectedValue({ response: { status: 404 } });
    renderProjectDetailPage('slug-tidak-ada');

    const notFound = await screen.findByTestId('not-found');
    expect(notFound).toBeInTheDocument();
  });

  it('merender pesan login untuk pengunjung yang belum login', async () => {
    mockGetProjectBySlug.mockResolvedValue(makeProject());
    renderProjectDetailPage();

    // User is not authenticated (AuthProvider default state)
    const loginPrompt = await screen.findByText(/login/i);
    expect(loginPrompt).toBeInTheDocument();
  });
});
