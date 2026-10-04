import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User, AuthState } from '../types';

interface AuthContextValue extends AuthState {
  login: (user: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Periksa apakah JWT token sudah kedaluwarsa berdasarkan klaim `exp`.
 * Mengembalikan true jika token kedaluwarsa atau tidak dapat di-decode.
 */
function isTokenExpired(token: string): boolean {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return true;
    const payload = JSON.parse(atob(payloadBase64)) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    // exp adalah Unix timestamp dalam detik
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const token = localStorage.getItem('auth_token');
      const userStr = localStorage.getItem('auth_user');
      if (token && userStr) {
        // Hapus token kedaluwarsa dari localStorage saat mount
        if (isTokenExpired(token)) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          return { user: null, token: null, isLoading: false };
        }
        return { user: JSON.parse(userStr) as User, token, isLoading: false };
      }
    } catch {
      // ignore storage errors
    }
    return { user: null, token: null, isLoading: false };
  });

  const login = useCallback((user: User, token: string) => {
    try {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
    } catch {
      // ignore storage errors
    }
    setState({ user, token, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } catch {
      // ignore storage errors
    }
    setState({ user: null, token: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return ctx;
}

export { AuthContext };
