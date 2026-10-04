import type { Comment } from '../types';
import apiClient from './client';

export interface AddCommentPayload {
  content: string;
}

/**
 * Fetch all comments for a post, ordered by createdAt ASC.
 * Backend returns { data: Comment[] }.
 */
export async function getComments(postId: string): Promise<Comment[]> {
  const { data: body } = await apiClient.get<{ data: Comment[] }>(`/api/posts/${postId}/comments`);
  return body.data;
}

/**
 * Add a comment to a published post.
 * Requires authentication (registered user).
 * Backend returns { data: Comment }.
 */
export async function addComment(
  postId: string,
  payload: AddCommentPayload,
): Promise<Comment> {
  const { data: body } = await apiClient.post<{ data: Comment }>(
    `/api/posts/${postId}/comments`,
    payload,
  );
  return body.data;
}

/**
 * Delete a comment by ID.
 * Allowed for the comment owner or an admin.
 */
export async function deleteComment(
  postId: string,
  commentId: string,
): Promise<void> {
  await apiClient.delete(`/api/posts/${postId}/comments/${commentId}`);
}
