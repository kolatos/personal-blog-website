/**
 * Component tests untuk ProjectsAdminPage
 * Task 17 — Stage 2 New Sections
 *
 * Skenario yang dicakup:
 *  1. Merender daftar project dari API
 *  2. Aksi publish memanggil publishProject API dengan id yang benar
 *  3. Aksi delete menampilkan AlertDialog konfirmasi
 *  4. Aksi delete memanggil deleteProject API setelah konfirmasi
 *  5. Tombol "Project Baru" ada dan dapat diklik
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ProjectsAdminPage from './ProjectsAdminPage';
import type { Project, PaginatedResponse } from '../../types';

// ── Mock API modules ──────────────────────────────────────────────────────────

vi.mock('../../api/projects', () => ({
  getAdminProjects: vi.fn(),
  publishProject: vi.fn(),
  unpublishProject: vi.fn(),
  deleteProject: vi.fn(),
}));

import {
  getAdminProjects,
  publishProject,
  unpublishProject,
  deleteProject,
} from '../../api/projects';

const mockGetAdminProjects = vi.mocked(getAdminProjects);
const mockPublishProject = vi.mocked(publishProject);
const mockUnpublishProject = vi.mocked(unpublishProject);
const mockDeleteProject = vi.mocked(deleteProject);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Proyek Alpha',
    slug: 'proyek-alpha',
    description: 'Deskripsi proyek alpha.',
    contentHtml: '<p>Deskripsi proyek alpha.</p>',
    status: 'draft',
    order: 0,
    techTags: [],
    publishedAt: null,
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function emptyPage(): PaginatedResponse<Project> {
  return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
}

function pageWithProjects(projects: Project[]): PaginatedResponse<Project> {
  return {
    data: projects,
    total: projects.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjectsAdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectsAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merender judul halaman', async () => {
    mockGetAdminProjects.mockResolvedValue(emptyPage());
    renderPage();
    expect(await screen.findByRole('heading', { name: /kelola projects/i })).toBeInTheDocument();
  });

  it('merender daftar project dari API', async () => {
    const projects = [
      makeProject({ id: 'p1', title: 'Proyek Satu', status: 'draft' }),
      makeProject({ id: 'p2', title: 'Proyek Dua', status: 'published' }),
    ];
    mockGetAdminProjects.mockResolvedValue(pageWithProjects(projects));
    renderPage();

    expect(await screen.findByText('Proyek Satu')).toBeInTheDocument();
    expect(screen.getByText('Proyek Dua')).toBeInTheDocument();
  });

  it('merender empty state saat tidak ada project', async () => {
    mockGetAdminProjects.mockResolvedValue(emptyPage());
    renderPage();
    expect(
      await screen.findByText(/belum ada project/i),
    ).toBeInTheDocument();
  });

  it('merender tombol "Project Baru"', async () => {
    mockGetAdminProjects.mockResolvedValue(emptyPage());
    renderPage();
    expect(
      await screen.findByTestId('new-project-button'),
    ).toBeInTheDocument();
  });

  // ── Publish action ─────────────────────────────────────────────────────────

  it('memanggil publishProject dengan id yang benar saat tombol publish diklik dan dikonfirmasi', async () => {
    const project = makeProject({ id: 'project-abc', status: 'draft' });
    mockGetAdminProjects.mockResolvedValue(pageWithProjects([project]));
    mockPublishProject.mockResolvedValue({
      ...project,
      status: 'published',
      publishedAt: '2024-02-01T00:00:00.000Z',
    });

    renderPage();

    const publishBtn = await screen.findByTestId('publish-project-button');
    await userEvent.click(publishBtn);

    // Konfirmasi dialog
    const confirmBtn = await screen.findByTestId('confirm-action-button');
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockPublishProject).toHaveBeenCalledWith('project-abc');
    });
  });

  it('tidak memanggil publishProject saat dialog dibatalkan', async () => {
    const project = makeProject({ status: 'draft' });
    mockGetAdminProjects.mockResolvedValue(pageWithProjects([project]));

    renderPage();

    const publishBtn = await screen.findByTestId('publish-project-button');
    await userEvent.click(publishBtn);

    // Batalkan dialog
    const cancelBtn = await screen.findByRole('button', { name: /^batal$/i });
    await userEvent.click(cancelBtn);

    expect(mockPublishProject).not.toHaveBeenCalled();
  });

  // ── Unpublish action ───────────────────────────────────────────────────────

  it('memanggil unpublishProject dengan id yang benar', async () => {
    const project = makeProject({
      id: 'project-xyz',
      status: 'published',
      publishedAt: '2024-01-20T00:00:00.000Z',
    });
    mockGetAdminProjects.mockResolvedValue(pageWithProjects([project]));
    mockUnpublishProject.mockResolvedValue({ ...project, status: 'draft', publishedAt: null });

    renderPage();

    const unpublishBtn = await screen.findByTestId('unpublish-project-button');
    await userEvent.click(unpublishBtn);

    const confirmBtn = await screen.findByTestId('confirm-action-button');
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockUnpublishProject).toHaveBeenCalledWith('project-xyz');
    });
  });

  // ── Delete action ──────────────────────────────────────────────────────────

  it('menampilkan AlertDialog konfirmasi sebelum menghapus', async () => {
    const project = makeProject({ title: 'Proyek Akan Dihapus' });
    mockGetAdminProjects.mockResolvedValue(pageWithProjects([project]));

    renderPage();

    const deleteBtn = await screen.findByTestId('delete-project-button');
    await userEvent.click(deleteBtn);

    // Dialog harus muncul dengan judul hapus
    expect(await screen.findByText(/hapus project\?/i)).toBeInTheDocument();

    // Batalkan dialog
    const cancelBtn = screen.getByRole('button', { name: /^batal$/i });
    await userEvent.click(cancelBtn);

    expect(mockDeleteProject).not.toHaveBeenCalled();
  });

  it('memanggil deleteProject dengan id yang benar setelah konfirmasi', async () => {
    const project = makeProject({ id: 'project-del', status: 'draft' });
    mockGetAdminProjects.mockResolvedValue(pageWithProjects([project]));
    mockDeleteProject.mockResolvedValue(undefined);

    renderPage();

    const deleteBtn = await screen.findByTestId('delete-project-button');
    await userEvent.click(deleteBtn);

    const confirmBtn = await screen.findByTestId('confirm-action-button');
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith('project-del');
    });
  });

  it('menampilkan error banner saat publishProject gagal', async () => {
    const project = makeProject({ status: 'draft' });
    mockGetAdminProjects.mockResolvedValue(pageWithProjects([project]));
    mockPublishProject.mockRejectedValue(new Error('Server error'));

    renderPage();

    const publishBtn = await screen.findByTestId('publish-project-button');
    await userEvent.click(publishBtn);

    const confirmBtn = await screen.findByTestId('confirm-action-button');
    await userEvent.click(confirmBtn);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/gagal mempublikasikan/i)).toBeInTheDocument();
  });
});
