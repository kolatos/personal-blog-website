/**
 * Component tests untuk ProjectEditorPage
 * Task 20 — Stage 2 New Sections
 *
 * Skenario yang dicakup:
 *  1. Merender tombol "← Kembali ke Projects" dalam mode create
 *  2. Klik tombol kembali memanggil navigate ke /admin/projects
 *  3. Merender heading "Project Baru" dalam mode create
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectEditorPage from './ProjectEditorPage';

// ── Mock react-router-dom navigate ────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...(actual as object),
    useNavigate: () => mockNavigate,
  };
});

// ── Mock API modules ──────────────────────────────────────────────────────────

vi.mock('../../api/projects', () => ({
  getAdminProjectById: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderProjectEditorPage(path = '/admin/projects/new') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/projects/new" element={<ProjectEditorPage />} />
          <Route path="/admin/projects/:id/edit" element={<ProjectEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merender tombol "← Kembali ke Projects"', () => {
    renderProjectEditorPage();

    const backBtn = screen.getByRole('button', { name: /kembali ke projects/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveTextContent('← Kembali ke Projects');
  });

  it('klik tombol kembali menavigasi ke /admin/projects', () => {
    renderProjectEditorPage();

    const backBtn = screen.getByRole('button', { name: /kembali ke projects/i });
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/projects');
  });

  it('merender heading "Project Baru" dalam mode create', () => {
    renderProjectEditorPage();

    const heading = screen.getByRole('heading', { name: /project baru/i });
    expect(heading).toBeInTheDocument();
  });
});