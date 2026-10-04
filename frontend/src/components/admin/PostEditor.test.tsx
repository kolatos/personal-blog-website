import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostEditor } from './PostEditor';

// react-markdown renders its children as HTML — the actual markdown parsing
// is tested via integration; here we just need to confirm content appears.
// The real react-markdown is used so preview rendering is exercised.

describe('PostEditor', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockReset();
  });

  // ── Rendering ────────────────────────────────────────────────────────────

  it('renders empty form for new post (no initial values)', () => {
    render(<PostEditor onSubmit={mockOnSubmit} />);

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
    );

    expect(screen.getByLabelText(/judul/i)).toHaveValue('Judul Awal');
    expect(screen.getByRole('textbox', { name: /konten/i })).toHaveValue('Konten awal');
  });

  it('renders submit button with default label "Simpan"', () => {
    render(<PostEditor onSubmit={mockOnSubmit} />);
    expect(screen.getByRole('button', { name: /simpan/i })).toBeInTheDocument();
  });

  it('renders submit button with custom label', () => {
    render(<PostEditor onSubmit={mockOnSubmit} submitLabel="Publikasikan Nanti" />);
    expect(screen.getByRole('button', { name: /publikasikan nanti/i })).toBeInTheDocument();
  });

  // ── Validation ───────────────────────────────────────────────────────────

  it('shows validation error when title is empty on submit', async () => {
    render(<PostEditor onSubmit={mockOnSubmit} initialContent="Konten" />);

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByText(/judul tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error when content is empty on submit', async () => {
    render(<PostEditor onSubmit={mockOnSubmit} initialTitle="Judul" />);

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByText(/konten tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error when title is only whitespace', async () => {
    render(<PostEditor onSubmit={mockOnSubmit} initialContent="Konten" />);

    const titleInput = screen.getByLabelText(/judul/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, '   ');

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByText(/judul tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows both validation errors when title and content are empty', async () => {
    render(<PostEditor onSubmit={mockOnSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByText(/judul tidak boleh kosong/i)).toBeInTheDocument();
    expect(screen.getByText(/konten tidak boleh kosong/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  // ── Markdown preview ─────────────────────────────────────────────────────

  it('shows placeholder text in preview when content is empty', () => {
    render(<PostEditor onSubmit={mockOnSubmit} />);
    expect(screen.getByText(/preview akan muncul di sini/i)).toBeInTheDocument();
  });

  it('renders Markdown preview when content is typed', async () => {
    render(<PostEditor onSubmit={mockOnSubmit} />);

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
    );

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledOnce();
      expect(mockOnSubmit).toHaveBeenCalledWith('Judul Valid', 'Konten valid');
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
    );

    // Loading spinner text is rendered inside the button
    expect(screen.getByText(/menyimpan/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
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
    );

    expect(screen.getByLabelText(/judul/i)).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /konten/i })).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
