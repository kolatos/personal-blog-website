import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuthContext } from './AuthContext';
import type { User } from '../types';

// Helper untuk membuat JWT dengan klaim tertentu (tidak perlu signature valid untuk test)
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake_signature`;
}

const mockUser: User = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  joinedAt: '2024-01-01T00:00:00.000Z',
};

const adminUser: User = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin',
  joinedAt: '2024-01-01T00:00:00.000Z',
};

// Komponen pembantu untuk mengakses context di dalam tests
function AuthStateDisplay() {
  const ctx = useAuthContext();
  return (
    <div>
      <span data-testid="user">{ctx.user ? ctx.user.username : 'null'}</span>
      <span data-testid="token">{ctx.token ?? 'null'}</span>
      <span data-testid="role">{ctx.user?.role ?? 'none'}</span>
    </div>
  );
}

function AuthActions() {
  const ctx = useAuthContext();
  return (
    <div>
      <span data-testid="user">{ctx.user ? ctx.user.username : 'null'}</span>
      <span data-testid="token">{ctx.token ?? 'null'}</span>
      <button
        data-testid="login-btn"
        onClick={() => ctx.login(mockUser, 'test-token')}
      >
        Login
      </button>
      <button
        data-testid="login-admin-btn"
        onClick={() => ctx.login(adminUser, 'admin-token')}
      >
        Login Admin
      </button>
      <button data-testid="logout-btn" onClick={() => ctx.logout()}>
        Logout
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('login', () => {
    it('menyimpan user dan token ke state dan localStorage', () => {
      render(
        <AuthProvider>
          <AuthActions />
        </AuthProvider>,
      );

      act(() => {
        screen.getByTestId('login-btn').click();
      });

      expect(screen.getByTestId('user').textContent).toBe('testuser');
      expect(screen.getByTestId('token').textContent).toBe('test-token');
      expect(localStorage.getItem('auth_token')).toBe('test-token');
      expect(JSON.parse(localStorage.getItem('auth_user')!)).toEqual(mockUser);
    });

    it('login sebagai admin menyimpan user dengan role admin', () => {
      render(
        <AuthProvider>
          <AuthActions />
        </AuthProvider>,
      );

      act(() => {
        screen.getByTestId('login-admin-btn').click();
      });

      expect(screen.getByTestId('user').textContent).toBe('admin');
      expect(screen.getByTestId('token').textContent).toBe('admin-token');
    });
  });

  describe('logout', () => {
    it('menghapus user dan token dari state dan localStorage', () => {
      // Set up state awal seolah sudah login — gunakan token JWT yang valid
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validToken = makeJwt({ sub: 'user-1', exp: futureExp });
      localStorage.setItem('auth_token', validToken);
      localStorage.setItem('auth_user', JSON.stringify(mockUser));

      render(
        <AuthProvider>
          <AuthActions />
        </AuthProvider>,
      );

      // Verifikasi state sudah terisi
      expect(screen.getByTestId('user').textContent).toBe('testuser');

      act(() => {
        screen.getByTestId('logout-btn').click();
      });

      expect(screen.getByTestId('user').textContent).toBe('null');
      expect(screen.getByTestId('token').textContent).toBe('null');
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('auth_user')).toBeNull();
    });
  });

  describe('token persistence', () => {
    it('membaca token dan user dari localStorage saat mount', () => {
      // Buat token yang belum kedaluwarsa (exp 1 jam ke depan)
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validToken = makeJwt({ sub: 'user-1', exp: futureExp });

      localStorage.setItem('auth_token', validToken);
      localStorage.setItem('auth_user', JSON.stringify(mockUser));

      render(
        <AuthProvider>
          <AuthStateDisplay />
        </AuthProvider>,
      );

      expect(screen.getByTestId('user').textContent).toBe('testuser');
      expect(screen.getByTestId('token').textContent).toBe(validToken);
    });

    it('mengembalikan state kosong jika tidak ada token di localStorage', () => {
      render(
        <AuthProvider>
          <AuthStateDisplay />
        </AuthProvider>,
      );

      expect(screen.getByTestId('user').textContent).toBe('null');
      expect(screen.getByTestId('token').textContent).toBe('null');
    });
  });

  describe('expiry handling', () => {
    it('membersihkan token kedaluwarsa dari localStorage saat mount', () => {
      // Buat token yang sudah kedaluwarsa (exp di masa lalu)
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = makeJwt({ sub: 'user-1', exp: pastExp });

      localStorage.setItem('auth_token', expiredToken);
      localStorage.setItem('auth_user', JSON.stringify(mockUser));

      render(
        <AuthProvider>
          <AuthStateDisplay />
        </AuthProvider>,
      );

      // State harus kosong karena token kedaluwarsa
      expect(screen.getByTestId('user').textContent).toBe('null');
      expect(screen.getByTestId('token').textContent).toBe('null');

      // Token juga harus dihapus dari localStorage
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('auth_user')).toBeNull();
    });

    it('mempertahankan token yang belum kedaluwarsa', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 7200;
      const validToken = makeJwt({ sub: 'user-1', exp: futureExp });

      localStorage.setItem('auth_token', validToken);
      localStorage.setItem('auth_user', JSON.stringify(mockUser));

      render(
        <AuthProvider>
          <AuthStateDisplay />
        </AuthProvider>,
      );

      expect(screen.getByTestId('user').textContent).toBe('testuser');
    });

    it('membersihkan token yang tidak dapat di-decode', () => {
      localStorage.setItem('auth_token', 'token-tidak-valid-bukan-jwt');
      localStorage.setItem('auth_user', JSON.stringify(mockUser));

      render(
        <AuthProvider>
          <AuthStateDisplay />
        </AuthProvider>,
      );

      expect(screen.getByTestId('user').textContent).toBe('null');
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('useAuthContext', () => {
    it('melempar error jika digunakan di luar AuthProvider', () => {
      // Suppress console.error untuk test ini
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <AuthStateDisplay />
        );
      }).toThrow('useAuthContext must be used within AuthProvider');

      consoleSpy.mockRestore();
    });
  });
});
