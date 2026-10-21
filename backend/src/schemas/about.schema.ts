import { z } from 'zod';

/**
 * Nilai valid untuk field `type` pada AboutSection.
 * Requirements: 2.1
 */
export const ABOUT_SECTION_TYPES = ['education', 'experience', 'skill', 'contact'] as const;
export type AboutSectionType = (typeof ABOUT_SECTION_TYPES)[number];

/**
 * Schema untuk membuat AboutSection baru.
 * Requirements: 2.1, 2.2
 */
export const CreateAboutSectionSchema = z.object({
  type: z.enum(ABOUT_SECTION_TYPES, {
    errorMap: () => ({
      message: `Type must be one of: ${ABOUT_SECTION_TYPES.join(', ')}`,
    }),
  }),
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must not exceed 200 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Title cannot consist of only whitespace',
    }),
  subtitle: z
    .string()
    .max(200, 'Subtitle must not exceed 200 characters')
    .optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be a valid date (YYYY-MM-DD)').optional()),
  endDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be a valid date (YYYY-MM-DD)').optional()),
  order: z.number().int().min(0).optional().default(0),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateAboutSectionDto = z.infer<typeof CreateAboutSectionSchema>;

/**
 * Schema untuk mengupdate AboutSection.
 * Semua field opsional — caller menyediakan hanya field yang ingin diubah.
 * Requirements: 2.3
 */
export const UpdateAboutSectionSchema = z
  .object({
    type: z
      .enum(ABOUT_SECTION_TYPES, {
        errorMap: () => ({
          message: `Type must be one of: ${ABOUT_SECTION_TYPES.join(', ')}`,
        }),
      })
      .optional(),
    title: z
      .string()
      .min(1, 'Title cannot be empty')
      .max(200, 'Title must not exceed 200 characters')
      .refine((val) => val.trim().length > 0, {
        message: 'Title cannot consist of only whitespace',
      })
      .optional(),
    subtitle: z
      .string()
      .max(200, 'Subtitle must not exceed 200 characters')
      .optional(),
    description: z.string().optional(),
    startDate: z
      .string()
      .datetime({ offset: true })
      .optional()
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    endDate: z
      .string()
      .datetime({ offset: true })
      .optional()
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    order: z.number().int().min(0).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine(
    (data) =>
      data.type !== undefined ||
      data.title !== undefined ||
      data.subtitle !== undefined ||
      data.description !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.order !== undefined ||
      data.metadata !== undefined,
    {
      message: 'At least one field must be provided for update',
      path: ['title'],
    }
  );

export type UpdateAboutSectionDto = z.infer<typeof UpdateAboutSectionSchema>;

/**
 * Schema untuk batch reorder AboutSection.
 * Memvalidasi array `{ id, order }`.
 * Requirements: 2.6
 */
export const ReorderAboutSectionsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid('Each item must have a valid UUID id'),
        order: z.number().int().min(0, 'Order must be a non-negative integer'),
      })
    )
    .min(1, 'Items array cannot be empty'),
});

export type ReorderAboutSectionsDto = z.infer<typeof ReorderAboutSectionsSchema>;
