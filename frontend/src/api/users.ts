import type { User } from '../types';
import apiClient from './client';

export interface UpdateUsernamePayload {
  username: string;
}

export interface UpdatePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

/**
 * Fetch the authenticated user's profile.
 * Backend returns { data: UserProfile }.
 */
export async function getProfile(): Promise<User> {
  const { data: body } = await apiClient.get<{
    data: { id: string; username: string; email: string; role: string; createdAt: string; updatedAt: string };
  }>('/api/users/me');
  const p = body.data;
  return {
    id: p.id,
    username: p.username,
    email: p.email,
    role: p.role as 'admin' | 'user',
    joinedAt: p.createdAt,
  };
}

/**
 * Update the authenticated user's username.
 * Returns 409 if the new username is already taken.
 * Backend returns { data: UserProfile }.
 */
export async function updateUsername(payload: UpdateUsernamePayload): Promise<User> {
  const { data: body } = await apiClient.patch<{
    data: { id: string; username: string; email: string; role: string; createdAt: string; updatedAt: string };
  }>('/api/users/me/username', payload);
  const p = body.data;
  return {
    id: p.id,
    username: p.username,
    email: p.email,
    role: p.role as 'admin' | 'user',
    joinedAt: p.createdAt,
  };
}

/**
 * Update the authenticated user's password.
 * Requires the current password for verification.
 * New password must differ from the old one and be 8–72 characters.
 */
export async function updatePassword(payload: UpdatePasswordPayload): Promise<void> {
  await apiClient.patch('/api/users/me/password', payload);
}
