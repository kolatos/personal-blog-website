import type { TagSummary } from '../types';
import apiClient from './client';

/**
 * Fetch all existing tags, sorted alphabetically.
 * Public endpoint — no auth required.
 */
export async function getTags(): Promise<TagSummary[]> {
  const { data } = await apiClient.get<TagSummary[]>('/api/tags');
  return data;
}
