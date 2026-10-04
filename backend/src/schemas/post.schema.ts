import { z } from 'zod';

/**
 * Schema for creating a new post.
 * Requirements: 3.1, 3.5
 */
export const CreatePostSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must not exceed 200 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Title cannot consist of only whitespace',
    }),
  content: z
    .string({ required_error: 'Content is required' })
    .min(1, 'Content cannot be empty')
    .refine((val) => val.trim().length > 0, {
      message: 'Content cannot consist of only whitespace',
    }),
});

export type CreatePostDto = z.infer<typeof CreatePostSchema>;

/**
 * Schema for updating an existing post.
 * Both fields are optional — caller provides only what they want to change.
 * Requirements: 3.3, 3.5
 */
export const UpdatePostSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title cannot be empty')
      .max(200, 'Title must not exceed 200 characters')
      .refine((val) => val.trim().length > 0, {
        message: 'Title cannot consist of only whitespace',
      })
      .optional(),
    content: z
      .string()
      .min(1, 'Content cannot be empty')
      .refine((val) => val.trim().length > 0, {
        message: 'Content cannot consist of only whitespace',
      })
      .optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'At least one of title or content must be provided',
    path: ['title'],
  });

export type UpdatePostDto = z.infer<typeof UpdatePostSchema>;
