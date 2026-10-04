import { z } from 'zod';

/**
 * Schema for user registration.
 * Requirements: 2.1, 2.3
 */
export const RegisterSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Email must be a valid email address'),
  username: z
    .string({ required_error: 'Username is required' })
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Username cannot consist of only whitespace',
    }),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters'),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;

/**
 * Schema for login (supports email or username).
 * At least one of email or username must be provided.
 * Requirements: 2.4
 */
export const LoginSchema = z
  .object({
    email: z.string().email('Email must be a valid email address').optional(),
    username: z
      .string()
      .min(1, 'Username cannot be empty')
      .max(50, 'Username must not exceed 50 characters')
      .refine((val) => val.trim().length > 0, {
        message: 'Username cannot consist of only whitespace',
      })
      .optional(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required'),
  })
  .refine((data) => data.email !== undefined || data.username !== undefined, {
    message: 'Either email or username must be provided',
    path: ['email'],
  });

export type LoginDto = z.infer<typeof LoginSchema>;
