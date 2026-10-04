import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import type { UserProfile } from '../types/index';

// ─── Constants ──────────────────────────────────────────────────────────────

const BCRYPT_COST = 12;

// ─── Error helper ────────────────────────────────────────────────────────────

function createError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>
): Error & { status: number; code: string; fields?: Record<string, string> } {
  const err = new Error(message) as Error & {
    status: number;
    code: string;
    fields?: Record<string, string>;
  };
  err.status = status;
  err.code = code;
  if (fields) err.fields = fields;
  return err;
}

// ─── Shape helper ────────────────────────────────────────────────────────────

/**
 * Maps a Prisma User record to the UserProfile DTO (omits passwordHash).
 */
function toUserProfile(user: {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}): UserProfile {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role as 'admin' | 'user',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ─── UserService implementation ──────────────────────────────────────────────

/**
 * Returns the profile of the given user without exposing the password hash.
 *
 * Requirements: 8.1
 */
export async function getProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw createError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return toUserProfile(user);
}

/**
 * Updates the username of the given user.
 * Throws 409 if the new username is already taken.
 * Returns the updated profile.
 *
 * Requirements: 8.2, 8.3
 */
export async function updateUsername(
  userId: string,
  newUsername: string
): Promise<UserProfile> {
  // Verify user exists
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });

  if (!existing) {
    throw createError(404, 'USER_NOT_FOUND', 'User not found');
  }

  // Check uniqueness of the new username (exclude the current user)
  const conflict = await prisma.user.findFirst({
    where: {
      username: newUsername,
      NOT: { id: userId },
    },
    select: { id: true },
  });

  if (conflict) {
    throw createError(
      409,
      'USERNAME_TAKEN',
      'Username is already taken',
      { username: 'Username is already taken' }
    );
  }

  // Perform the update
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { username: newUsername },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toUserProfile(updated);
}

/**
 * Changes the password for the given user.
 *
 * Validates:
 * - oldPassword matches the stored hash
 * - newPassword is different from oldPassword
 * Hashes newPassword with bcrypt cost 12 before storing.
 *
 * Requirements: 8.4, 8.5, 8.6
 */
export async function updatePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  // Fetch the user including the hash (we need it for verification)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    throw createError(404, 'USER_NOT_FOUND', 'User not found');
  }

  // Verify old password matches the stored hash
  const oldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!oldPasswordValid) {
    throw createError(
      401,
      'INVALID_PASSWORD',
      'Current password is incorrect'
    );
  }

  // New password must differ from old password (Req 8.5)
  if (newPassword === oldPassword) {
    throw createError(
      422,
      'SAME_PASSWORD',
      'New password must be different from the current password'
    );
  }

  // Hash the new password with bcrypt cost 12 (Req 8.6)
  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });
}
