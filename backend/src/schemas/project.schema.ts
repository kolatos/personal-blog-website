import { z } from 'zod';

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
 * Schema untuk membuat Project baru.
 * Requirements: 3.1 (Stage 2)
 */
export const CreateProjectSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must not exceed 200 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Title cannot consist of only whitespace',
    }),
  description: z
    .string({ required_error: 'Description is required' })
    .min(1, 'Description cannot be empty')
    .refine((val) => val.trim().length > 0, {
      message: 'Description cannot consist of only whitespace',
    }),
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  coverImageUrl: optionalUrl,
  order: z.number().int().min(0).optional().default(0),
  techTags: z
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

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;

/**
 * Schema untuk mengupdate Project.
 * Semua field opsional — caller menyediakan hanya field yang ingin diubah.
 * Requirements: 3.5 (Stage 2)
 */
export const UpdateProjectSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title cannot be empty')
      .max(200, 'Title must not exceed 200 characters')
      .refine((val) => val.trim().length > 0, {
        message: 'Title cannot consist of only whitespace',
      })
      .optional(),
    description: z
      .string()
      .min(1, 'Description cannot be empty')
      .refine((val) => val.trim().length > 0, {
        message: 'Description cannot consist of only whitespace',
      })
      .optional(),
    repoUrl: optionalUrl,
    demoUrl: optionalUrl,
    coverImageUrl: optionalUrl,
    order: z.number().int().min(0).optional(),
    techTags: z
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
      data.description !== undefined ||
      data.repoUrl !== undefined ||
      data.demoUrl !== undefined ||
      data.coverImageUrl !== undefined ||
      data.order !== undefined ||
      data.techTags !== undefined,
    {
      message: 'At least one field must be provided for update',
      path: ['title'],
    }
  );

export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;
