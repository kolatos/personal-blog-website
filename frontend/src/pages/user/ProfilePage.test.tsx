import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import ProfilePage from './ProfilePage';
import type { User } from '../../types';

// ── Mock API module ───────────────────────────────────────────────────────────
vi.mock('../../api/users', () => ({
  updateUsername: vi.fn(),
  updatePassword: vi.fn(),
  getProfile: vi.fn(),
}));

// ── Mock useAuth hook ─────────────────────────────────────────────────────────
const mockLogin = vi.fn();
const mockLogout = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../hooks/useAuth';
import { updateUsername, updatePassword } from '../../api/users';

const mockUseAuth = vi.mocked(useAuth);
const mockUpdateUsername = vi.mocked(updateUsername);
const mockUpdatePassword = vi.mocked(updatePassword);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockUser: User = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  joinedAt: '2024-03-15T00:00:00.000Z',
};

/**
 * Membuat AxiosError yang lolos pengecekan axios.isAxiosError()
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

// ── Render helper ─────────────────────────────────────────────────────────────

function renderProfilePage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'mock-token',
      isLoading: false,
      login: mockLogin,
      logout: mockLogout,
    });
  });

  // ── Tampilan data profil ──────────────────────────────────────────────────

  describe('menampilkan data profil', () => {
    it('menampilkan heading halaman profil', () => {
      renderProfilePage();
      expect(screen.getByRole('heading', { name: /profil/i, level: 1 })).toBeInTheDocument();
    });

    it('menampilkan username pengguna', () => {
      renderProfilePage();
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('menampilkan email pengguna', () => {
      renderProfilePage();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('menampilkan tanggal bergabung dalam format Indonesia', () => {
      renderProfilePage();
      // 2024-03-15 → "15 Maret 2024"
      expect(screen.getByText('15 Maret 2024')).toBeInTheDocument();
    });

    it('menampilkan — ketika user null', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        isLoading: false,
        login: mockLogin,
        logout: mockLogout,
      });
      renderProfilePage();
      // Semua field info akun menampilkan —
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(3);
    });

    it('menampilkan field form username dengan nilai default dari user', () => {
      renderProfilePage();
      const input = screen.getByLabelText(/username baru/i);
      expect(input).toHaveValue('testuser');
    });
  });

  // ── Update username ───────────────────────────────────────────────────────

  describe('ubah username', () => {
    it('berhasil update username dan memanggil login dengan data baru', async () => {
      const updatedUser: User = { ...mockUser, username: 'newusername' };
      mockUpdateUsername.mockResolvedValue(updatedUser);

      renderProfilePage();

      const input = screen.getByLabelText(/username baru/i);
      await userEvent.clear(input);
      await userEvent.type(input, 'newusername');

      await userEvent.click(screen.getByRole('button', { name: /simpan username/i }));

      await waitFor(() => {
        expect(mockUpdateUsername).toHaveBeenCalledWith({ username: 'newusername' });
        expect(mockLogin).toHaveBeenCalledWith(updatedUser, 'mock-token');
      });

      expect(await screen.findByText(/username berhasil diperbarui/i)).toBeInTheDocument();
    });

    it('menampilkan error 409 ketika username sudah digunakan', async () => {
      mockUpdateUsername.mockRejectedValue(
        makeAxiosError(409, {
          error: { code: 'USERNAME_TAKEN', message: 'Username sudah digunakan' },
        }),
      );

      renderProfilePage();

      const input = screen.getByLabelText(/username baru/i);
      await userEvent.clear(input);
      await userEvent.type(input, 'takenuser');

      await userEvent.click(screen.getByRole('button', { name: /simpan username/i }));

      expect(await screen.findByText(/username sudah digunakan oleh akun lain/i)).toBeInTheDocument();
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('menampilkan error validasi ketika username dikosongkan', async () => {
      renderProfilePage();

      const input = screen.getByLabelText(/username baru/i);
      await userEvent.clear(input);

      await userEvent.click(screen.getByRole('button', { name: /simpan username/i }));

      expect(await screen.findByText(/username wajib diisi/i)).toBeInTheDocument();
      expect(mockUpdateUsername).not.toHaveBeenCalled();
    });

    it('menampilkan error generik ketika API gagal tanpa pesan spesifik', async () => {
      // Respons 500 tanpa field message → fallback ke teks generik
      mockUpdateUsername.mockRejectedValue(
        makeAxiosError(500, { error: { code: 'SERVER_ERROR' } }),
      );

      renderProfilePage();

      const input = screen.getByLabelText(/username baru/i);
      await userEvent.clear(input);
      await userEvent.type(input, 'someuser');

      await userEvent.click(screen.getByRole('button', { name: /simpan username/i }));

      expect(await screen.findByText(/terjadi kesalahan\. coba lagi/i)).toBeInTheDocument();
    });

    it('menampilkan error koneksi ketika tidak ada respons server', async () => {
      mockUpdateUsername.mockRejectedValue(new Error('Network Error'));

      renderProfilePage();

      const input = screen.getByLabelText(/username baru/i);
      await userEvent.clear(input);
      await userEvent.type(input, 'someuser');

      await userEvent.click(screen.getByRole('button', { name: /simpan username/i }));

      expect(
        await screen.findByText(/tidak dapat menghubungi server/i),
      ).toBeInTheDocument();
    });
  });

  // ── Update password ───────────────────────────────────────────────────────

  describe('ubah password', () => {
    it('berhasil update password dan menampilkan pesan sukses', async () => {
      mockUpdatePassword.mockResolvedValue(undefined);

      renderProfilePage();

      await userEvent.type(screen.getByLabelText(/password lama/i), 'OldPass123');
      await userEvent.type(screen.getByLabelText(/password baru/i), 'NewPass456');

      await userEvent.click(screen.getByRole('button', { name: /simpan password/i }));

      await waitFor(() => {
        expect(mockUpdatePassword).toHaveBeenCalledWith({
          oldPassword: 'OldPass123',
          newPassword: 'NewPass456',
        });
      });

      expect(await screen.findByText(/password berhasil diperbarui/i)).toBeInTheDocument();
    });

    it('mereset form setelah update password berhasil', async () => {
      mockUpdatePassword.mockResolvedValue(undefined);

      renderProfilePage();

      const oldInput = screen.getByLabelText(/password lama/i);
      const newInput = screen.getByLabelText(/password baru/i);

      await userEvent.type(oldInput, 'OldPass123');
      await userEvent.type(newInput, 'NewPass456');

      await userEvent.click(screen.getByRole('button', { name: /simpan password/i }));

      await waitFor(() => {
        expect(oldInput).toHaveValue('');
        expect(newInput).toHaveValue('');
      });
    });

    it('menampilkan error ketika password lama salah (401)', async () => {
      mockUpdatePassword.mockRejectedValue(
        makeAxiosError(401, {
          error: { code: 'INVALID_OLD_PASSWORD', message: 'Password lama salah' },
        }),
      );

      renderProfilePage();

      await userEvent.type(screen.getByLabelText(/password lama/i), 'WrongOld');
      await userEvent.type(screen.getByLabelText(/password baru/i), 'NewPass456');

      await userEvent.click(screen.getByRole('button', { name: /simpan password/i }));

      expect(await screen.findByText(/password lama tidak benar/i)).toBeInTheDocument();
    });

    it('menampilkan error ketika password lama salah (400 + INVALID_OLD_PASSWORD)', async () => {
      mockUpdatePassword.mockRejectedValue(
        makeAxiosError(400, {
          error: { code: 'INVALID_OLD_PASSWORD', message: 'Password lama salah' },
        }),
      );

      renderProfilePage();

      await userEvent.type(screen.getByLabelText(/password lama/i), 'WrongOld');
      await userEvent.type(screen.getByLabelText(/password baru/i), 'NewPass456');

      await userEvent.click(screen.getByRole('button', { name: /simpan password/i }));

      expect(await screen.findByText(/password lama tidak benar/i)).toBeInTheDocument();
    });

    it('menampilkan error validasi client-side ketika password baru sama dengan password lama', async () => {
      renderProfilePage();

      await userEvent.type(screen.getByLabelText(/password lama/i), 'SamePass123');
      await userEvent.type(screen.getByLabelText(/password baru/i), 'SamePass123');

      await userEvent.click(screen.getByRole('button', { name: /simpan password/i }));

      expect(
        await screen.findByText(/password baru tidak boleh sama dengan password lama/i),
      ).toBeInTheDocument();
      expect(mockUpdatePassword).not.toHaveBeenCalled();
    });

    it('menampilkan error validasi ketika password lama kosong', async () => {
      renderProfilePage();

      await userEvent.type(screen.getByLabelText(/password baru/i), 'NewPass456');

      await userEvent.click(screen.getByRole('button', { name: /simpan password/i }));

      expect(await screen.findByText(/password lama wajib diisi/i)).toBeInTheDocument();
      expect(mockUpdatePassword).not.toHaveBeenCalled();
    });

    it('menampilkan error validasi ketika password baru terlalu pendek', async () => {
      renderProfilePage();

      await userEvent.type(screen.getByLabelText(/password lama/i), 'OldPass123');
      await userEvent.type(screen.getByLabelText(/password baru/i), 'short');

      await userEvent.click(screen.getByRole('button', { name: /simpan password/i }));

      expect(await screen.findByText(/password baru minimal 8 karakter/i)).toBeInTheDocument();
      expect(mockUpdatePassword).not.toHaveBeenCalled();
    });

    it('menampilkan error koneksi ketika tidak ada respons server', async () => {
      mockUpdatePassword.mockRejectedValue(new Error('Network Error'));

      renderProfilePage();

      await userEvent.type(screen.getByLabelText(/password lama/i), 'OldPass123');
      await userEvent.type(screen.getByLabelText(/password baru/i), 'NewPass456');

      await userEvent.click(screen.getByRole('button', { name: /simpan password/i }));

      expect(
        await screen.findByText(/tidak dapat menghubungi server/i),
      ).toBeInTheDocument();
    });
  });
});
