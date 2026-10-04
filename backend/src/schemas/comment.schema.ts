import { z } from 'zod';

/**
 * Schema for creating a new comment.
 * Requirements: 6.1, 6.7
 */
export const CreateCommentSchema = z.object({
  content: z
    .string({ required_error: 'Comment content is required' })
    .min(1, 'Comment content cannot be empty')
    .max(2000, 'Comment content must not exceed 2000 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Comment content cannot consist of only whitespace',
    }),
});

export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;
