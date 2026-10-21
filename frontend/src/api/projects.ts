import type { PaginatedResponse, Project } from '../types';
import apiClient from './client';

export interface CreateProjectPayload {
  title: string;
  description: string;
  repoUrl?: string;
  demoUrl?: string;
  coverImageUrl?: string;
  order?: number;
  techTags?: string[];
}

export interface UpdateProjectPayload {
  title?: string;
  description?: string;
  repoUrl?: string;
  demoUrl?: string;
  coverImageUrl?: string;
  order?: number;
  techTags?: string[];
}

// ── Public endpoints ──────────────────────────────────────────────────────────

/**
 * Fetch paginated published projects, ordered by order ASC.
 */
export async function getPublishedProjects(
  page = 1,
  pageSize = 10,
): Promise<PaginatedResponse<Project>> {
  const { data } = await apiClient.get<PaginatedResponse<Project>>('/api/projects', {
    params: { page, pageSize },
  });
  return data;
}

/**
 * Fetch a single published project by its slug.
 * Throws 404 if not found or the project is a draft.
 * Backend returns { data: Project }.
 */
export async function getProjectBySlug(slug: string): Promise<Project> {
  const { data: body } = await apiClient.get<{ data: Project }>(`/api/projects/${slug}`);
  return body.data;
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

/**
 * Fetch all projects (draft + published), ordered by updatedAt DESC.
 * Admin only.
 */
export async function getAdminProjects(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<Project>> {
  const { data } = await apiClient.get<PaginatedResponse<Project>>('/api/projects/admin', {
    params: { page, pageSize },
  });
  return data;
}

/**
 * Fetch a single project by ID (works for draft and published).
 * Admin only.
 * Backend returns { data: Project }.
 */
export async function getAdminProjectById(id: string): Promise<Project> {
  const { data: body } = await apiClient.get<{ data: Project }>(`/api/projects/admin/${id}`);
  return body.data;
}

/**
 * Create a new project (saved as draft).
 * Admin only.
 * Backend returns { data: Project }.
 */
export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const { data: body } = await apiClient.post<{ data: Project }>('/api/projects', payload);
  return body.data;
}

/**
 * Update an existing project by ID.
 * If the project is published, it auto-reverts to draft.
 * Admin only.
 * Backend returns { data: Project }.
 */
export async function updateProject(
  id: string,
  payload: UpdateProjectPayload,
): Promise<Project> {
  const { data: body } = await apiClient.put<{ data: Project }>(`/api/projects/${id}`, payload);
  return body.data;
}

/**
 * Publish a draft project by ID.
 * Admin only.
 * Backend returns { data: Project }.
 */
export async function publishProject(id: string): Promise<Project> {
  const { data: body } = await apiClient.patch<{ data: Project }>(
    `/api/projects/${id}/publish`,
  );
  return body.data;
}

/**
 * Unpublish a published project by ID (revert to draft).
 * Admin only.
 * Backend returns { data: Project }.
 */
export async function unpublishProject(id: string): Promise<Project> {
  const { data: body } = await apiClient.patch<{ data: Project }>(
    `/api/projects/${id}/unpublish`,
  );
  return body.data;
}

/**
 * Delete a project and its associated comments by ID.
 * Admin only.
 */
export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/api/projects/${id}`);
}
