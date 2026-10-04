import { z } from 'zod';

/**
 * Schema for updating username.
 * Requirements: 8.2
 */
export const UpdateUsernameSchema = z.object({
  username: z
    .string({ required_error: 'Username is required' })
    .min(1, 'Username cannot be empty')
    .max(50, 'Username must not exceed 50 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Username cannot consist of only whitespace',
    }),
});

export type UpdateUsernameDto = z.infer<typeof UpdateUsernameSchema>;

/**
 * Schema for updating password.
 * Requires current (old) password and a new password.
 * New password must differ from old password and be between 8–72 characters.
 * Requirements: 8.4, 8.6
 */
export const UpdatePasswordSchema = z
  .object({
    oldPassword: z
      .string({ required_error: 'Current password is required' })
      .min(1, 'Current password is required'),
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(8, 'New password must be at least 8 characters')
      .max(72, 'New password must not exceed 72 characters'),
  })
  .refine((data) => data.oldPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export type UpdatePasswordDto = z.infer<typeof UpdatePasswordSchema>;
