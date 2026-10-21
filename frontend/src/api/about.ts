import type { AboutSection } from '../types';
import apiClient from './client';

export interface CreateSectionPayload {
  type: 'education' | 'experience' | 'skill' | 'contact';
  title: string;
  subtitle?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  order?: number;
  metadata?: Record<string, string>;
}

export type UpdateSectionPayload = Partial<CreateSectionPayload>;

export interface ReorderItem {
  id: string;
  order: number;
}

/**
 * Fetch all about sections, sorted by type then order.
 * Public endpoint.
 */
export async function getAboutSections(): Promise<AboutSection[]> {
  const { data } = await apiClient.get<{ data: AboutSection[] }>('/api/about');
  return data.data;
}

/**
 * Create a new about section.
 * Admin only.
 */
export async function createSection(payload: CreateSectionPayload): Promise<AboutSection> {
  const { data } = await apiClient.post<{ data: AboutSection }>('/api/about', payload);
  return data.data;
}

/**
 * Update an existing about section by ID.
 * Admin only.
 */
export async function updateSection(id: string, payload: UpdateSectionPayload): Promise<AboutSection> {
  const { data } = await apiClient.put<{ data: AboutSection }>(`/api/about/${id}`, payload);
  return data.data;
}

/**
 * Delete an about section by ID.
 * Admin only.
 */
export async function deleteSection(id: string): Promise<void> {
  await apiClient.delete(`/api/about/${id}`);
}

/**
 * Batch reorder about sections.
 * Admin only.
 */
export async function reorderSections(items: ReorderItem[]): Promise<void> {
  await apiClient.patch('/api/about/reorder', items);
}
