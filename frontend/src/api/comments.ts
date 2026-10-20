import type { Comment } from '../types';
import apiClient from './client';

export interface AddCommentPayload {
  contentType: string;
  contentId: string;
  content: string;
  parentId?: string;
}

/**
 * Fetch all top-level comments (with nested replies) for a content item.
 * Uses the generic endpoint: GET /api/comments?contentType=&contentId=
 */
export async function getComments(
  contentType: string,
  contentId: string,
): Promise<Comment[]> {
  const { data: body } = await apiClient.get<{ data: Comment[] }>('/api/comments', {
    params: { contentType, contentId },
  });
  return body.data;
}

/**
 * Add a comment or reply.
 * POST /api/comments
 * body: { contentType, contentId, content, parentId? }
 */
export async function addComment(payload: AddCommentPayload): Promise<Comment> {
  const { data: body } = await apiClient.post<{ data: Comment }>(
    '/api/comments',
    payload,
  );
  return body.data;
}

/**
 * Delete a comment by ID.
 * Allowed for the comment owner or an admin.
 * DELETE /api/comments/:id
 */
export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/api/comments/${commentId}`);
}
