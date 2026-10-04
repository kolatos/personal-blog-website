import type { PaginatedResponse, Post } from '../types';
import apiClient from './client';

export interface CreatePostPayload {
  title: string;
  content: string;
}

export interface UpdatePostPayload {
  title?: string;
  content?: string;
}

// ── Public endpoints ──────────────────────────────────────────────────────────

/**
 * Fetch paginated published posts, ordered by publishedAt DESC.
 * Backend returns PaginatedResponse directly (no wrapper).
 */
export async function getPublishedPosts(
  page = 1,
  pageSize = 10,
): Promise<PaginatedResponse<Post>> {
  const { data } = await apiClient.get<PaginatedResponse<Post>>('/api/posts', {
    params: { page, pageSize },
  });
  return data;
}

/**
 * Fetch a single published post by its slug.
 * Throws 404 if not found or the post is a draft.
 * Backend returns { data: Post }.
 */
export async function getPostBySlug(slug: string): Promise<Post> {
  const { data: body } = await apiClient.get<{ data: Post }>(`/api/posts/${slug}`);
  return body.data;
}

/**
 * Search published posts using a keyword.
 * Backend returns PaginatedResponse directly (no wrapper).
 */
export async function searchPosts(
  keyword: string,
  page = 1,
): Promise<PaginatedResponse<Post>> {
  const { data } = await apiClient.get<PaginatedResponse<Post>>('/api/posts/search', {
    params: { keyword, page },
  });
  return data;
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

/**
 * Fetch all posts (draft + published), ordered by updatedAt DESC.
 * Admin only.
 * Backend returns PaginatedResponse directly (no wrapper).
 */
export async function getAllPosts(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<Post>> {
  const { data } = await apiClient.get<PaginatedResponse<Post>>('/api/posts/admin', {
    params: { page, pageSize },
  });
  return data;
}

/**
 * Create a new post (saved as draft).
 * Admin only.
 * Backend returns { data: Post }.
 */
export async function createPost(payload: CreatePostPayload): Promise<Post> {
  const { data: body } = await apiClient.post<{ data: Post }>('/api/posts', payload);
  return body.data;
}

/**
 * Update an existing post by ID.
 * If the post is published, it auto-reverts to draft.
 * Admin only.
 * Backend returns { data: Post }.
 */
export async function updatePost(id: string, payload: UpdatePostPayload): Promise<Post> {
  const { data: body } = await apiClient.put<{ data: Post }>(`/api/posts/${id}`, payload);
  return body.data;
}

/**
 * Publish a draft post by ID.
 * Admin only.
 * Backend returns { data: Post }.
 */
export async function publishPost(id: string): Promise<Post> {
  const { data: body } = await apiClient.patch<{ data: Post }>(`/api/posts/${id}/publish`);
  return body.data;
}

/**
 * Unpublish a published post by ID (revert to draft).
 * Admin only.
 * Backend returns { data: Post }.
 */
export async function unpublishPost(id: string): Promise<Post> {
  const { data: body } = await apiClient.patch<{ data: Post }>(`/api/posts/${id}/unpublish`);
  return body.data;
}

/**
 * Delete a post and its associated comments by ID.
 * Admin only.
 */
export async function deletePost(id: string): Promise<void> {
  await apiClient.delete(`/api/posts/${id}`);
}

/**
 * Fetch a single post by ID (works for both draft and published).
 * Admin only.
 * Backend returns { data: Post }.
 */
export async function getAdminPostById(id: string): Promise<Post> {
  const { data: body } = await apiClient.get<{ data: Post }>(`/api/posts/admin/${id}`);
  return body.data;
}
