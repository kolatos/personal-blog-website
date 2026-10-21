/**
 * Component tests untuk AboutAdminPage
 * Task 15 — Stage 2 New Sections
 *
 * Skenario yang dicakup:
 *  1. "Tambah Seksi" membuka dialog form
 *  2. Tombol hapus menampilkan AlertDialog konfirmasi
 *  3. Merender tabs untuk setiap tipe seksi
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AboutAdminPage from './AboutAdminPage';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../hooks/useAbout', () => ({
  useAbout: () => ({
    data: [
      {
        id: 'exp-1',
        type: 'experience',
        title: 'Software Engineer',
        subtitle: 'PT Contoh',
        order: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useAboutMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    update: { mutate: vi.fn(), isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
    reorder: { mutate: vi.fn(), isPending: false },
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AboutAdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AboutAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merender halaman dengan heading yang benar', () => {
    renderPage();
    expect(screen.getByText('Kelola About')).toBeInTheDocument();
  });

  it('merender tabs untuk setiap tipe seksi', () => {
    renderPage();

    expect(screen.getByText('Pengalaman')).toBeInTheDocument();
    expect(screen.getByText('Pendidikan')).toBeInTheDocument();
    expect(screen.getByText('Keahlian')).toBeInTheDocument();
    expect(screen.getByText('Kontak')).toBeInTheDocument();
  });

  it('menampilkan data seksi yang ada di tab aktif', () => {
    renderPage();

    // Pengalaman tab is active by default
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('PT Contoh')).toBeInTheDocument();
  });

  it('"Tambah Seksi" membuka dialog form', async () => {
    const user = userEvent.setup();
    renderPage();

    // Click "Tambah Seksi" button
    const addButton = screen.getByTestId('add-section-button');
    await user.click(addButton);

    // Dialog should open
    await waitFor(() => {
      expect(screen.getByText('Tambah Seksi')).toBeInTheDocument();
    });

    // Form fields should be visible
    expect(screen.getByLabelText(/^Judul/i)).toBeInTheDocument();
  });

  it('tombol hapus menampilkan AlertDialog konfirmasi', async () => {
    const user = userEvent.setup();
    renderPage();

    // Find the delete button for the section
    const deleteButton = screen.getByTestId('delete-button');
    await user.click(deleteButton);

    // AlertDialog should appear
    await waitFor(() => {
      expect(screen.getByText('Hapus seksi?')).toBeInTheDocument();
    });

    // Confirm and cancel buttons should be visible
    expect(screen.getByTestId('confirm-delete-button')).toBeInTheDocument();
    expect(screen.getByText('Batal')).toBeInTheDocument();
  });

  it('menutup AlertDialog ketika Batal diklik', async () => {
    const user = userEvent.setup();
    renderPage();

    const deleteButton = screen.getByTestId('delete-button');
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Hapus seksi?')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Batal');
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Hapus seksi?')).not.toBeInTheDocument();
    });
  });
});
