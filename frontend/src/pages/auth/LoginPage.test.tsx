import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../contexts/AuthContext';
import LoginPage from './LoginPage';
import { AxiosError } from 'axios';
import type { User } from '../../types';

// Mock modul API auth
vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
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

import { login as mockLoginFn } from '../../api/auth';

const mockLogin = vi.mocked(mockLoginFn);

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

const mockUserUser: User = {
  id: 'user-1',
  username: 'testuser',
  email: 'user@example.com',
  role: 'user',
  joinedAt: '2024-01-01T00:00:00.000Z',
};

const mockAdminUser: User = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin',
  joinedAt: '2024-01-01T00:00:00.000Z',
};

function renderLoginPage(initialPath = '/login') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('submit kredensial valid', () => {
    it('memanggil API login dan mengarahkan user biasa ke "/"', async () => {
      mockLogin.mockResolvedValueOnce({ token: 'user-token', user: mockUserUser });

      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'user@example.com',
          password: 'password123',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('memanggil API login dan mengarahkan admin ke "/admin"', async () => {
      mockLogin.mockResolvedValueOnce({ token: 'admin-token', user: mockAdminUser });

      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email/i), 'admin@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'adminpass');
      await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
      });
    });
  });

  describe('validasi client-side', () => {
    it('menampilkan error ketika email kosong', async () => {
      renderLoginPage();

      await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

      await waitFor(() => {
        expect(screen.getByText('Email wajib diisi')).toBeInTheDocument();
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('menampilkan error ketika password kosong', async () => {
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
      await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

      await waitFor(() => {
        expect(screen.getByText('Password wajib diisi')).toBeInTheDocument();
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('menampilkan error format email tidak valid', async () => {
      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email/i), 'bukan-email');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

      await waitFor(() => {
        expect(screen.getByText('Format email tidak valid')).toBeInTheDocument();
      });
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('error dari server', () => {
    it('menampilkan pesan error ketika credentials salah (401)', async () => {
      mockLogin.mockRejectedValueOnce(
        makeAxiosError(401, {
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
        }),
      );

      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Email atau password salah.');
      });
    });

    it('menampilkan pesan error ketika akun terkunci (ACCOUNT_LOCKED)', async () => {
      mockLogin.mockRejectedValueOnce(
        makeAxiosError(403, {
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Akun Anda terkunci sementara karena terlalu banyak percobaan login.',
          },
        }),
      );

      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Akun Anda terkunci sementara karena terlalu banyak percobaan login.',
        );
      });
    });

    it('menampilkan pesan error ketika rate limit tercapai (429)', async () => {
      mockLogin.mockRejectedValueOnce(
        makeAxiosError(429, {
          error: { code: 'RATE_LIMIT', message: 'Too many requests' },
        }),
      );

      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Terlalu banyak percobaan login. Coba lagi nanti.',
        );
      });
    });

    it('menampilkan pesan generik ketika tidak ada koneksi server', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Network Error'));

      renderLoginPage();

      await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'password123');
      await userEvent.click(screen.getByRole('button', { name: /masuk/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Tidak dapat menghubungi server. Periksa koneksi Anda.',
        );
      });
    });
  });
});

describe('LoginPage — tombol kembali', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('menampilkan tombol kembali', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: /← kembali/i })).toBeInTheDocument();
  });

  it('memanggil navigate(-1) ketika history.length > 1', async () => {
    // jsdom sets window.history.length to 2 by default when using MemoryRouter with initial entry
    Object.defineProperty(window, 'history', {
      value: { ...window.history, length: 2 },
      writable: true,
      configurable: true,
    });

    renderLoginPage();
    await userEvent.click(screen.getByRole('button', { name: /← kembali/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
