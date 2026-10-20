import { z } from 'zod';

/**
 * Tipe konten yang valid untuk sistem komentar generik.
 * Diperluas di Stage berikutnya untuk menyertakan 'project', 'fun', 'module'.
 */
const VALID_CONTENT_TYPES = ['post', 'project', 'fun', 'module'] as const;

/**
 * Schema untuk membuat komentar baru via endpoint generik.
 * Mendukung komentar pada konten apapun (post, project, fun, module)
 * serta balasan (reply) hingga kedalaman 1.
 *
 * Requirements: 6.1, 6.7
 */
export const CreateCommentSchema = z.object({
  contentType: z.enum(VALID_CONTENT_TYPES, {
    required_error: 'contentType is required',
    invalid_type_error: `contentType must be one of: ${VALID_CONTENT_TYPES.join(', ')}`,
  }),
  contentId: z
    .string({ required_error: 'contentId is required' })
    .uuid('contentId must be a valid UUID'),
  content: z
    .string({ required_error: 'Comment content is required' })
    .min(1, 'Comment content cannot be empty')
    .max(2000, 'Comment content must not exceed 2000 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Comment content cannot consist of only whitespace',
    }),
  parentId: z
    .string()
    .uuid('parentId must be a valid UUID')
    .optional()
    .nullable(),
});

export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;

/**
 * Schema untuk legacy endpoint POST /api/posts/:postId/comments.
 * Hanya memerlukan `content` — contentType dan contentId diambil dari URL params.
 *
 * Requirements: 6.1, 6.7
 */
export const CreateCommentLegacySchema = z.object({
  content: z
    .string({ required_error: 'Comment content is required' })
    .min(1, 'Comment content cannot be empty')
    .max(2000, 'Comment content must not exceed 2000 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Comment content cannot consist of only whitespace',
    }),
  parentId: z
    .string()
    .uuid('parentId must be a valid UUID')
    .optional()
    .nullable(),
});

export type CreateCommentLegacyDto = z.infer<typeof CreateCommentLegacySchema>;
