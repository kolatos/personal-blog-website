import type { User } from '../types';
import apiClient from './client';

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Register a new user account.
 * Returns the created user profile. The caller doesn't need the return value
 * for the standard flow (redirect to login).
 */
export async function register(payload: RegisterPayload): Promise<void> {
  await apiClient.post('/api/auth/register', payload);
}

/**
 * Log in with email and password.
 * Returns a JWT token and the authenticated user profile.
 * The backend returns { data: { token, expiresIn, user } }.
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data: body } = await apiClient.post<{
    data: { token: string; expiresIn: number; user: { id: string; username: string; email: string; role: string; createdAt: string; updatedAt: string } };
  }>('/api/auth/login', payload);

  const backendUser = body.data.user;
  const user: User = {
    id: backendUser.id,
    username: backendUser.username,
    email: backendUser.email,
    role: backendUser.role as 'admin' | 'user',
    joinedAt: backendUser.createdAt,
  };

  return {
    token: body.data.token,
    user,
  };
}

/**
 * Log out the current user, invalidating the JWT on the server.
 */
export async function logout(): Promise<void> {
  await apiClient.post('/api/auth/logout');
}
