import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostEditor } from './PostEditor';
import * as tagsApi from '../../api/tags';

// Mock getTags so TagInput doesn't make real network calls
vi.mock('../../api/tags', () => ({
  getTags: vi.fn(),
}));

vi.mocked(tagsApi.getTags).mockResolvedValue([]);

// react-markdown renders its children as HTML — the actual markdown parsing
// is tested via integration; here we just need to confirm content appears.
// The real react-markdown is used so preview rendering is exercised.

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('PostEditor', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockReset();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  it('renders empty form for new post (no initial values)', () => {
    render(<PostEditor onSubmit={mockOnSubmit} />, { wrapper: createWrapper() });

    const titleInput = screen.getByLabelText(/judul/i);
    const contentArea = screen.getByRole('textbox', { name: /konten/i });

    expect(titleInput).toHaveValue('');
    expect(contentArea).toHaveValue('');
  });

  it('renders pre-filled form when initial values are provided', () => {
    render(
      <PostEditor
        initialTitle="Judul Awal"
        initialContent="Konten awal"
        onSubmit={mockOnSubmit}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByLabelText(/judul/i)).toHaveValue('Judul Awal');
    expect(screen.getByRole('textbox', { name: /konten/i })).toHaveValue('Konten awal');
  });

  it('renders submit button with default label "Simpan"', () => {
    render(<PostEditor onSubmit={mockOnSubmit} />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /simpan/i })).toBeInTheDocument();
  });

  it('renders submit button with custom label', () => {
    render(<PostEditor onSubmit={mockOnSubmit} submitLabel="Publikasikan Nanti" />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByRole('button', { name: /publikasikan nanti/i })).toBeInTheDocument();
  });

  // ── Validation ───────────────────────────────────────────────────────────

  it('shows validation error when title is empty on submit', async () => {
    render(<PostEditor onSubmit={mockOnSubmit} initialContent="Konten" />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByText(/judul tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error when content is empty on submit', async () => {
    render(<PostEditor onSubmit={mockOnSubmit} initialTitle="Judul" />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByText(/konten tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error when title is only whitespace', async () => {
    render(<PostEditor onSubmit={mockOnSubmit} initialContent="Konten" />, {
      wrapper: createWrapper(),
    });

    const titleInput = screen.getByLabelText(/judul/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, '   ');

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByText(/judul tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows both validation errors when title and content are empty', async () => {
    render(<PostEditor onSubmit={mockOnSubmit} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByText(/judul tidak boleh kosong/i)).toBeInTheDocument();
    expect(screen.getByText(/konten tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  // ── Markdown preview ─────────────────────────────────────────────────────

  it('shows placeholder text in preview when content is empty', () => {
    render(<PostEditor onSubmit={mockOnSubmit} />, { wrapper: createWrapper() });
    expect(screen.getByText(/preview akan muncul di sini/i)).toBeInTheDocument();
  });

  it('renders Markdown preview when content is typed', async () => {
    render(<PostEditor onSubmit={mockOnSubmit} />, { wrapper: createWrapper() });

    const contentArea = screen.getByRole('textbox', { name: /konten/i });
    await userEvent.type(contentArea, '# Heading Satu');

    // react-markdown renders the heading as an <h1>
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('renders initial content in preview immediately', () => {
    render(
      <PostEditor
        onSubmit={mockOnSubmit}
        initialContent="**Teks Tebal**"
      />,
      { wrapper: createWrapper() },
    );

    // react-markdown should render the bold element
    const preview = screen.getByLabelText(/pratinjau markdown/i);
    expect(preview).toBeInTheDocument();
    expect(preview.querySelector('strong')).toBeInTheDocument();
  });

  // ── Submit handling ──────────────────────────────────────────────────────

  it('calls onSubmit with correct trimmed title and content on valid form', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    render(
      <PostEditor
        onSubmit={mockOnSubmit}
        initialTitle="  Judul Valid  "
        initialContent="Konten valid"
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledOnce();
      // Now called with (title, content, tags)
      expect(mockOnSubmit).toHaveBeenCalledWith('Judul Valid', 'Konten valid', []);
    });
  });

  it('shows loading state when isSubmitting prop is true', () => {
    render(
      <PostEditor
        onSubmit={mockOnSubmit}
        initialTitle="Judul"
        initialContent="Konten"
        isSubmitting
      />,
      { wrapper: createWrapper() },
    );

    // Loading spinner text is rendered inside the submit button
    expect(screen.getByText(/menyimpan/i)).toBeInTheDocument();
    // The submit button (which contains the "Menyimpan..." text) should be disabled
    expect(screen.getByRole('button', { name: /menyimpan/i })).toBeDisabled();
  });

  it('shows API error message when onSubmit rejects', async () => {
    const apiError = {
      response: { data: { error: { message: 'Judul sudah digunakan' } } },
    };
    mockOnSubmit.mockRejectedValue(apiError);

    render(
      <PostEditor
        onSubmit={mockOnSubmit}
        initialTitle="Judul"
        initialContent="Konten"
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByText(/judul sudah digunakan/i)).toBeInTheDocument();
  });

  it('shows generic error message when onSubmit rejects without response', async () => {
    mockOnSubmit.mockRejectedValue(new Error('Network error'));

    render(
      <PostEditor
        onSubmit={mockOnSubmit}
        initialTitle="Judul"
        initialContent="Konten"
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByText(/terjadi kesalahan/i)).toBeInTheDocument();
  });

  it('disables inputs and button when isSubmitting is true', () => {
    render(
      <PostEditor
        onSubmit={mockOnSubmit}
        initialTitle="Judul"
        initialContent="Konten"
        isSubmitting
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByLabelText(/judul/i)).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /konten/i })).toBeDisabled();
    // The submit button should be disabled (toolbar buttons are intentionally not disabled)
    expect(screen.getByRole('button', { name: /menyimpan/i })).toBeDisabled();
  });
});
