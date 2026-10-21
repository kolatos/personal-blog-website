import { z } from 'zod';

/**
 * Nilai valid untuk field `type` pada FunPost.
 * Requirements: 4.1 (Stage 2)
 */
export const FUN_POST_TYPES = [
  'text',
  'review',
  'image',
  'drawing',
  'music',
  'interactive',
] as const;

export type FunPostType = (typeof FUN_POST_TYPES)[number];

/**
 * Schema URL opsional — jika disediakan, harus berupa URL yang valid.
 */
const optionalUrl = z
  .string()
  .url('Must be a valid URL')
  .max(500, 'URL must not exceed 500 characters')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' ? undefined : v));

/**
 * Schema untuk membuat FunPost baru.
 * Requirements: 4.1 (Stage 2)
 */
export const CreateFunPostSchema = z.object({
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
  type: z.enum(FUN_POST_TYPES, {
    required_error: 'Type is required',
    invalid_type_error: `Type must be one of: ${FUN_POST_TYPES.join(', ')}`,
  }),
  excerpt: z
    .string()
    .max(500, 'Excerpt must not exceed 500 characters')
    .optional(),
  mediaUrl: optionalUrl,
  tags: z
    .array(
      z
        .string()
        .min(1, 'Tag name cannot be empty')
        .max(100, 'Tag name must not exceed 100 characters')
        .refine((val) => val.trim().length > 0, {
          message: 'Tag name cannot consist of only whitespace',
        })
    )
    .optional(),
});

export type CreateFunPostDto = z.infer<typeof CreateFunPostSchema>;

/**
 * Schema untuk mengupdate FunPost.
 * Semua field opsional — caller menyediakan hanya field yang ingin diubah.
 * Requirements: 4.4 (Stage 2)
 */
export const UpdateFunPostSchema = z
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
    type: z
      .enum(FUN_POST_TYPES, {
        invalid_type_error: `Type must be one of: ${FUN_POST_TYPES.join(', ')}`,
      })
      .optional(),
    excerpt: z
      .string()
      .max(500, 'Excerpt must not exceed 500 characters')
      .optional(),
    mediaUrl: optionalUrl,
    tags: z
      .array(
        z
          .string()
          .min(1, 'Tag name cannot be empty')
          .max(100, 'Tag name must not exceed 100 characters')
          .refine((val) => val.trim().length > 0, {
            message: 'Tag name cannot consist of only whitespace',
          })
      )
      .optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.content !== undefined ||
      data.type !== undefined ||
      data.excerpt !== undefined ||
      data.mediaUrl !== undefined ||
      data.tags !== undefined,
    {
      message: 'At least one field must be provided for update',
      path: ['title'],
    }
  );

export type UpdateFunPostDto = z.infer<typeof UpdateFunPostSchema>;
