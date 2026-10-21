import apiClient from './client';
import type { PaginatedResponse } from '../types';

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface RecentPost {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  updatedAt: string;
}

export interface RecentComment {
  id: string;
  content: string;
  authorUsername: string;
  contentType: string;
  contentId: string;
  contentTitle: string | null;
  createdAt: string;
}

export interface RecentUser {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface AdminStats {
  totalPosts: number;
  totalComments: number;
  totalUsers: number;
  totalProjects: number;
  totalFunPosts: number;
  recentPosts: RecentPost[];
  recentComments: RecentComment[];
  recentUsers: RecentUser[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await apiClient.get<AdminStats>('/api/admin/stats');
  return res.data;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  commentCount: number;
}

export async function getAdminUsers(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<AdminUser>> {
  const res = await apiClient.get<PaginatedResponse<AdminUser>>('/api/admin/users', {
    params: { page, pageSize },
  });
  return res.data;
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await apiClient.delete(`/api/admin/users/${userId}`);
}

// ── Comments ──────────────────────────────────────────────────────────────────

export interface AdminComment {
  id: string;
  content: string;
  authorUsername: string;
  contentType: string;
  contentId: string;
  contentTitle: string | null;
  parentId: string | null;
  createdAt: string;
}

export async function getAdminComments(
  page = 1,
  pageSize = 20,
  contentType?: string,
): Promise<PaginatedResponse<AdminComment>> {
  const res = await apiClient.get<PaginatedResponse<AdminComment>>('/api/admin/comments', {
    params: { page, pageSize, ...(contentType ? { contentType } : {}) },
  });
  return res.data;
}

export async function deleteAdminComment(commentId: string): Promise<void> {
  await apiClient.delete(`/api/comments/${commentId}`);
}
