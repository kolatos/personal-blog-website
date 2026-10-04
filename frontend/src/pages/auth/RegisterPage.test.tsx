import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../contexts/AuthContext';
import RegisterPage from './RegisterPage';
import axios, { AxiosError } from 'axios';

// Mock modul API auth
vi.mock('../../api/auth', () => ({
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { register as mockRegisterFn } from '../../api/auth';

const mockRegister = vi.mocked(mockRegisterFn);

/**
 * Membuat AxiosError palsu yang lolos pengecekan axios.isAxiosError()
 */
function makeAxiosError(status: number, data: unknown): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = {
    status,
    data,
    statusText: String(status),
    headers: {},
    config: {} as never,
  };
  return err;
}

function renderRegisterPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('validasi client-side', () => {
    it('menampilkan error ketika semua field kosong', async () => {
      renderRegisterPage();

      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByText('Username minimal 3 karakter')).toBeInTheDocument();
        expect(screen.getByText('Email wajib diisi')).toBeInTheDocument();
        expect(screen.getByText('Password minimal 8 karakter')).toBeInTheDocument();
      });
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('menampilkan error untuk username kurang dari 3 karakter', async () => {
      renderRegisterPage();

      await userEvent.type(screen.getByLabelText(/username/i), 'ab');
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByText('Username minimal 3 karakter')).toBeInTheDocument();
      });
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('menampilkan error untuk username lebih dari 50 karakter', async () => {
      renderRegisterPage();

      const longUsername = 'a'.repeat(51);
      await userEvent.type(screen.getByLabelText(/username/i), longUsername);
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByText('Username maksimal 50 karakter')).toBeInTheDocument();
      });
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('menampilkan error untuk format email tidak valid', async () => {
      renderRegisterPage();

      await userEvent.type(screen.getByLabelText(/username/i), 'validuser');
      await userEvent.type(screen.getByLabelText(/email/i), 'bukan-email');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByText('Format email tidak valid')).toBeInTheDocument();
      });
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('menampilkan error untuk password kurang dari 8 karakter', async () => {
      renderRegisterPage();

      await userEvent.type(screen.getByLabelText(/username/i), 'validuser');
      await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'short');
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByText('Password minimal 8 karakter')).toBeInTheDocument();
      });
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe('registrasi berhasil', () => {
    it('menampilkan pesan sukses setelah registrasi berhasil', async () => {
      mockRegister.mockResolvedValueOnce({
        token: 'new-token',
        user: {
          id: 'user-1',
          username: 'newuser',
          email: 'new@example.com',
          role: 'user',
          joinedAt: '2024-01-01T00:00:00.000Z',
        },
      });

      renderRegisterPage();

      await userEvent.type(screen.getByLabelText(/username/i), 'newuser');
      await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'securepassword');
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          'Akun berhasil dibuat! Mengarahkan ke halaman login...',
        );
      });

      expect(mockRegister).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'new@example.com',
        password: 'securepassword',
      });
    });

    it('mengarahkan ke /login setelah timeout redirect', async () => {
      mockRegister.mockResolvedValueOnce({
        token: 'new-token',
        user: {
          id: 'user-1',
          username: 'newuser',
          email: 'new@example.com',
          role: 'user',
          joinedAt: '2024-01-01T00:00:00.000Z',
        },
      });

      renderRegisterPage();

      await userEvent.type(screen.getByLabelText(/username/i), 'newuser');
      await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'securepassword');
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });

      // Tunggu redirect (1500ms) selesai secara asli
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      }, { timeout: 3000 });
    });
  });

  describe('error duplikat dari server (409)', () => {
    it('menampilkan error field-level untuk duplikat email', async () => {
      const err = makeAxiosError(409, {
        error: {
          code: 'CONFLICT',
          message: 'Data sudah digunakan.',
          fields: { email: 'Email sudah terdaftar.' },
        },
      });
      mockRegister.mockRejectedValueOnce(err);

      renderRegisterPage();

      await userEvent.type(screen.getByLabelText(/username/i), 'newuser');
      await userEvent.type(screen.getByLabelText(/email/i), 'existing@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByText('Email sudah terdaftar.')).toBeInTheDocument();
      });
    });

    it('menampilkan error field-level untuk duplikat username', async () => {
      const err = makeAxiosError(409, {
        error: {
          code: 'CONFLICT',
          message: 'Data sudah digunakan.',
          fields: { username: 'Username sudah digunakan.' },
        },
      });
      mockRegister.mockRejectedValueOnce(err);

      renderRegisterPage();

      await userEvent.type(screen.getByLabelText(/username/i), 'existinguser');
      await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByText('Username sudah digunakan.')).toBeInTheDocument();
      });
    });

    it('menampilkan server error generik ketika 409 tanpa fields', async () => {
      const err = makeAxiosError(409, {
        error: {
          code: 'CONFLICT',
          message: 'Data sudah digunakan.',
        },
      });
      mockRegister.mockRejectedValueOnce(err);

      renderRegisterPage();

      await userEvent.type(screen.getByLabelText(/username/i), 'existinguser');
      await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Data sudah digunakan.');
      });
    });
  });

  describe('error lain dari server', () => {
    it('menampilkan pesan error rate limit (429)', async () => {
      const err = makeAxiosError(429, {
        error: { code: 'RATE_LIMIT', message: 'Too many requests' },
      });
      mockRegister.mockRejectedValueOnce(err);

      renderRegisterPage();

      await userEvent.type(screen.getByLabelText(/username/i), 'newuser');
      await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Terlalu banyak permintaan. Coba lagi nanti.',
        );
      });
    });

    it('menampilkan pesan generik ketika tidak ada koneksi server', async () => {
      mockRegister.mockRejectedValueOnce(new Error('Network Error'));

      renderRegisterPage();

      await userEvent.type(screen.getByLabelText(/username/i), 'newuser');
      await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /daftar/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Tidak dapat menghubungi server. Periksa koneksi Anda.',
        );
      });
    });
  });
});
