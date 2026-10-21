import type { PaginatedResponse, FunPost } from '../types';
import apiClient from './client';

export interface CreateFunPostPayload {
  title: string;
  content: string;
  type: string;
  excerpt?: string;
  mediaUrl?: string;
  tags?: string[];
}

export interface UpdateFunPostPayload {
  title?: string;
  content?: string;
  type?: string;
  excerpt?: string;
  mediaUrl?: string;
  tags?: string[];
}

// ── Public endpoints ──────────────────────────────────────────────────────────

/**
 * Fetch paginated published fun posts.
 * Optionally filter by type and/or tag slug (AND condition).
 */
export async function getPublishedFunPosts(
  page = 1,
  pageSize = 10,
  type?: string,
  tag?: string,
): Promise<PaginatedResponse<FunPost>> {
  const { data } = await apiClient.get<PaginatedResponse<FunPost>>('/api/fun', {
    params: { page, pageSize, ...(type ? { type } : {}), ...(tag ? { tag } : {}) },
  });
  return data;
}

/**
 * Fetch a single published fun post by its slug.
 * Throws 404 if not found or the post is a draft.
 */
export async function getFunPostBySlug(slug: string): Promise<FunPost> {
  const { data: body } = await apiClient.get<{ data: FunPost }>(`/api/fun/${slug}`);
  return body.data;
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

/**
 * Fetch all fun posts (draft + published), ordered by updatedAt DESC.
 * Admin only.
 */
export async function getAdminFunPosts(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<FunPost>> {
  const { data } = await apiClient.get<PaginatedResponse<FunPost>>('/api/fun/admin', {
    params: { page, pageSize },
  });
  return data;
}

/**
 * Fetch a single fun post by ID (works for draft and published).
 * Admin only.
 */
export async function getAdminFunPostById(id: string): Promise<FunPost> {
  const { data: body } = await apiClient.get<{ data: FunPost }>(`/api/fun/admin/${id}`);
  return body.data;
}

/**
 * Create a new fun post (saved as draft).
 * Admin only.
 */
export async function createFunPost(payload: CreateFunPostPayload): Promise<FunPost> {
  const { data: body } = await apiClient.post<{ data: FunPost }>('/api/fun', payload);
  return body.data;
}

/**
 * Update an existing fun post by ID.
 * If published, it auto-reverts to draft.
 * Admin only.
 */
export async function updateFunPost(
  id: string,
  payload: UpdateFunPostPayload,
): Promise<FunPost> {
  const { data: body } = await apiClient.put<{ data: FunPost }>(`/api/fun/${id}`, payload);
  return body.data;
}

/**
 * Publish a draft fun post by ID.
 * Admin only.
 */
export async function publishFunPost(id: string): Promise<FunPost> {
  const { data: body } = await apiClient.patch<{ data: FunPost }>(
    `/api/fun/${id}/publish`,
  );
  return body.data;
}

/**
 * Unpublish a published fun post by ID (revert to draft).
 * Admin only.
 */
export async function unpublishFunPost(id: string): Promise<FunPost> {
  const { data: body } = await apiClient.patch<{ data: FunPost }>(
    `/api/fun/${id}/unpublish`,
  );
  return body.data;
}

/**
 * Delete a fun post and its associated comments by ID.
 * Admin only.
 */
export async function deleteFunPost(id: string): Promise<void> {
  await apiClient.delete(`/api/fun/${id}`);
}
