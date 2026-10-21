import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import type { Post, Project, FunPost, AboutSection, PaginatedResponse } from '../../types';

// ── Mock API modules ──────────────────────────────────────────────────────────

vi.mock('../../api/posts', () => ({
  getPublishedPosts: vi.fn(),
}));

vi.mock('../../api/projects', () => ({
  getPublishedProjects: vi.fn(),
}));

vi.mock('../../api/fun', () => ({
  getPublishedFunPosts: vi.fn(),
}));

vi.mock('../../api/about', () => ({
  getAboutSections: vi.fn(),
}));

import { getPublishedPosts } from '../../api/posts';
import { getPublishedProjects } from '../../api/projects';
import { getPublishedFunPosts } from '../../api/fun';
import { getAboutSections } from '../../api/about';

const mockGetPublishedPosts = vi.mocked(getPublishedPosts);
const mockGetPublishedProjects = vi.mocked(getPublishedProjects);
const mockGetPublishedFunPosts = vi.mocked(getPublishedFunPosts);
const mockGetAboutSections = vi.mocked(getAboutSections);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    title: 'Postingan Test',
    slug: 'postingan-test',
    contentHtml: '<p>Konten</p>',
    status: 'published',
    publishedAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    commentCount: 0,
    tags: [],
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    title: 'Proyek Test',
    slug: 'proyek-test',
    description: 'Deskripsi proyek',
    contentHtml: '<p>Deskripsi proyek</p>',
    status: 'published',
    order: 0,
    techTags: [],
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function makeFunPost(overrides: Partial<FunPost> = {}): FunPost {
  return {
    id: 'fun-1',
    title: 'Fun Test',
    slug: 'fun-test',
    excerpt: 'Excerpt fun post',
    content: 'Konten fun',
    contentHtml: '<p>Konten fun</p>',
    status: 'published',
    type: 'text',
    tags: [],
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function makeAboutSection(overrides: Partial<AboutSection> = {}): AboutSection {
  return {
    id: 'about-1',
    type: 'experience',
    title: 'Engineer di Perusahaan XYZ',
    subtitle: 'Software Engineer',
    order: 0,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function paginatedOf<T>(items: T[]): PaginatedResponse<T> {
  return { data: items, total: items.length, page: 1, pageSize: 3, totalPages: 1 };
}

function renderLandingPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LandingPage', () => {
  // ── Hero section (always renders) ─────────────────────────────────────────

  it('merender seksi Hero selalu dengan CTA buttons', () => {
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));
    mockGetAboutSections.mockResolvedValue([]);

    renderLandingPage();

    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /baca blog/i })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('link', { name: /tentang saya/i })).toHaveAttribute('href', '/about');
  });

  it('merender Learning CTA selalu (statis)', () => {
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));
    mockGetAboutSections.mockResolvedValue([]);

    renderLandingPage();

    expect(screen.getByTestId('learning-cta-section')).toBeInTheDocument();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });

  // ── About teaser section ──────────────────────────────────────────────────

  it('merender seksi About teaser ketika ada data experience/skill', async () => {
    const sections = [
      makeAboutSection({ id: 'a1', type: 'experience', title: 'Engineer XYZ' }),
      makeAboutSection({ id: 'a2', type: 'skill', title: 'React Developer' }),
    ];
    mockGetAboutSections.mockResolvedValue(sections);
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));

    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByTestId('about-teaser-section')).toBeInTheDocument();
    });
    expect(screen.getByText('Engineer XYZ')).toBeInTheDocument();
    expect(screen.getByText('React Developer')).toBeInTheDocument();
  });

  it('menyembunyikan seksi About teaser ketika data kosong', async () => {
    mockGetAboutSections.mockResolvedValue([]);
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));

    renderLandingPage();

    await waitFor(() => {
      expect(screen.queryByTestId('about-teaser-section')).not.toBeInTheDocument();
    });
  });

  it('menyembunyikan seksi About teaser ketika semua seksi bertipe education/contact', async () => {
    mockGetAboutSections.mockResolvedValue([
      makeAboutSection({ id: 'a1', type: 'education', title: 'S1 Teknik Informatika' }),
      makeAboutSection({ id: 'a2', type: 'contact', title: 'GitHub' }),
    ]);
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));

    renderLandingPage();

    await waitFor(() => {
      expect(screen.queryByTestId('about-teaser-section')).not.toBeInTheDocument();
    });
  });

  // ── Recent posts section ──────────────────────────────────────────────────

  it('merender seksi Recent posts dengan 3 PostCard ketika ada data', async () => {
    const posts = [
      makePost({ id: 'p1', title: 'Post Pertama' }),
      makePost({ id: 'p2', title: 'Post Kedua' }),
      makePost({ id: 'p3', title: 'Post Ketiga' }),
    ];
    mockGetPublishedPosts.mockResolvedValue(paginatedOf(posts));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));
    mockGetAboutSections.mockResolvedValue([]);

    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByTestId('recent-posts-section')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('post-card')).toHaveLength(3);
    expect(screen.getByText('Post Pertama')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /lihat semua/i })).toHaveAttribute('href', '/blog');
  });

  it('menyembunyikan seksi Recent posts ketika data kosong', async () => {
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));
    mockGetAboutSections.mockResolvedValue([]);

    renderLandingPage();

    await waitFor(() => {
      expect(screen.queryByTestId('recent-posts-section')).not.toBeInTheDocument();
    });
  });

  // ── Featured projects section ─────────────────────────────────────────────

  it('merender seksi Featured projects dengan 3 ProjectCard ketika ada data', async () => {
    const projects = [
      makeProject({ id: 'pr1', title: 'Proyek Alpha' }),
      makeProject({ id: 'pr2', title: 'Proyek Beta' }),
      makeProject({ id: 'pr3', title: 'Proyek Gamma' }),
    ];
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf(projects));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));
    mockGetAboutSections.mockResolvedValue([]);

    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByTestId('featured-projects-section')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('project-card')).toHaveLength(3);
    expect(screen.getByText('Proyek Alpha')).toBeInTheDocument();
  });

  it('menyembunyikan seksi Featured projects ketika data kosong', async () => {
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));
    mockGetAboutSections.mockResolvedValue([]);

    renderLandingPage();

    await waitFor(() => {
      expect(screen.queryByTestId('featured-projects-section')).not.toBeInTheDocument();
    });
  });

  // ── Fun highlights section ────────────────────────────────────────────────

  it('merender seksi Fun highlights dengan 3 FunCard ketika ada data', async () => {
    const funPosts = [
      makeFunPost({ id: 'f1', title: 'Fun Post Satu' }),
      makeFunPost({ id: 'f2', title: 'Fun Post Dua' }),
      makeFunPost({ id: 'f3', title: 'Fun Post Tiga' }),
    ];
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf(funPosts));
    mockGetAboutSections.mockResolvedValue([]);

    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByTestId('fun-highlights-section')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('fun-card')).toHaveLength(3);
    expect(screen.getByText('Fun Post Satu')).toBeInTheDocument();
  });

  it('menyembunyikan seksi Fun highlights ketika data kosong', async () => {
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));
    mockGetAboutSections.mockResolvedValue([]);

    renderLandingPage();

    await waitFor(() => {
      expect(screen.queryByTestId('fun-highlights-section')).not.toBeInTheDocument();
    });
  });

  // ── Semua seksi merender bersamaan ────────────────────────────────────────

  it('merender semua seksi bersamaan ketika semua API mengembalikan data', async () => {
    mockGetAboutSections.mockResolvedValue([
      makeAboutSection({ id: 'a1', type: 'experience' }),
    ]);
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([makePost()]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([makeProject()]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([makeFunPost()]));

    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByTestId('about-teaser-section')).toBeInTheDocument();
      expect(screen.getByTestId('recent-posts-section')).toBeInTheDocument();
      expect(screen.getByTestId('featured-projects-section')).toBeInTheDocument();
      expect(screen.getByTestId('fun-highlights-section')).toBeInTheDocument();
      expect(screen.getByTestId('learning-cta-section')).toBeInTheDocument();
    });
  });

  // ── Max 3 teasers about ───────────────────────────────────────────────────

  it('hanya menampilkan 3 about teaser meskipun ada lebih dari 3 seksi', async () => {
    const sections = Array.from({ length: 5 }, (_, i) =>
      makeAboutSection({ id: `a${i}`, type: 'experience', title: `Pengalaman ${i + 1}` }),
    );
    mockGetAboutSections.mockResolvedValue(sections);
    mockGetPublishedPosts.mockResolvedValue(paginatedOf([]));
    mockGetPublishedProjects.mockResolvedValue(paginatedOf([]));
    mockGetPublishedFunPosts.mockResolvedValue(paginatedOf([]));

    renderLandingPage();

    await waitFor(() => {
      expect(screen.getAllByTestId('about-teaser-card')).toHaveLength(3);
    });
  });
});
