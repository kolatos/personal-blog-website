// Feature: personal-blog-website, Property 11: Username uniqueness on update

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Module mocks (hoisted before real imports) ────────────────────────────────

vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// bcrypt has a native binding; mock it to allow the module to load in tests.
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { updateUsername } from '../user.service';

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates valid usernames: 3–50 alphanumeric characters (letters + digits).
 * We exclude whitespace and special characters to stay within what the Zod
 * schema accepts, and guarantee the base string is always non-empty.
 */
const usernameArb = fc
  .stringOf(
    fc.mapToConstant(
      { num: 26, build: (n) => String.fromCharCode(65 + n) }, // A-Z
      { num: 26, build: (n) => String.fromCharCode(97 + n) }, // a-z
      { num: 10, build: (n) => String.fromCharCode(48 + n) }, // 0-9
    ),
    { minLength: 3, maxLength: 50 },
  );

/**
 * Generates a UUID-like string to use as a user ID.
 */
const userIdArb = fc
  .uuid()
  .filter((id) => id.length > 0);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a minimal Prisma User fixture for use in mock return values.
 */
function buildUser(overrides: { id: string; username: string }) {
  return {
    id: overrides.id,
    username: overrides.username,
    email: `${overrides.username}@example.com`,
    passwordHash: '$2b$12$fakehash',
    role: 'user',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 11: Username uniqueness on update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Property 11a: Update succeeds when new username is not taken ──────────

  /**
   * **Validates: Requirements 8.2**
   *
   * For any user and any new username that is not already in use by another
   * account, `updateUsername` MUST succeed and return a profile whose
   * username equals the requested new value.
   */
  it(
    'succeeds and returns updated profile when new username is not taken by another account',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          usernameArb,
          usernameArb,
          async (userId, currentUsername, newUsername) => {
            // Skip degenerate case where new username equals the current one;
            // the uniqueness constraint checks against OTHER accounts, so this
            // path is still valid, but testing it separately keeps the property focused.
            fc.pre(currentUsername !== newUsername);

            vi.clearAllMocks();

            const existingUser = buildUser({ id: userId, username: currentUsername });

            // `findUnique` is called first to verify the user exists
            vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser as never);

            // `findFirst` checks for conflict with other accounts — returns null
            // (no other user has this username)
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

            const updatedUser = buildUser({ id: userId, username: newUsername });
            vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as never);

            const result = await updateUsername(userId, newUsername);

            // Core property: update must succeed and return the new username
            expect(result.username).toBe(newUsername);
            expect(result.id).toBe(userId);

            // Must have called prisma.user.update exactly once
            expect(prisma.user.update).toHaveBeenCalledOnce();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ── Property 11b: Update fails with 409 when new username is already taken ─

  /**
   * **Validates: Requirements 8.3**
   *
   * For any user and any new username that IS already used by a different
   * account, `updateUsername` MUST throw an error with status 409 and code
   * USERNAME_TAKEN. The DB update must NOT be called.
   */
  it(
    'throws 409 USERNAME_TAKEN and does not update the DB when the new username is already taken',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          usernameArb,
          usernameArb,
          usernameArb,
          async (userId, currentUsername, newUsername, conflictingOwnerId) => {
            // The conflicting user must be a different account
            fc.pre(conflictingOwnerId !== userId);
            fc.pre(currentUsername !== newUsername);

            vi.clearAllMocks();

            const existingUser = buildUser({ id: userId, username: currentUsername });
            const conflictUser = buildUser({ id: conflictingOwnerId, username: newUsername });

            // The user exists
            vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser as never);

            // Another account already owns the desired username
            vi.mocked(prisma.user.findFirst).mockResolvedValue(conflictUser as never);

            let thrownError: unknown;
            try {
              await updateUsername(userId, newUsername);
            } catch (err) {
              thrownError = err;
            }

            // Must have thrown
            expect(thrownError).toBeDefined();

            // Must be a 409 USERNAME_TAKEN error
            const e = thrownError as Record<string, unknown>;
            expect(e['status']).toBe(409);
            expect(e['code']).toBe('USERNAME_TAKEN');

            // The username conflict field must be reported
            expect(e['fields']).toMatchObject({ username: expect.any(String) });

            // The DB update must NOT have been called
            expect(prisma.user.update).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ── Property 11c: Original username is unchanged in DB after a 409 ────────

  /**
   * **Validates: Requirements 8.2, 8.3**
   *
   * When `updateUsername` throws 409, the stored username must remain
   * identical to the original value — the function must not have mutated it.
   * We verify this by asserting that `prisma.user.update` was never invoked.
   */
  it(
    'never mutates the stored username when returning 409',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          usernameArb,
          usernameArb,
          usernameArb,
          async (userId, currentUsername, newUsername, otherUserId) => {
            fc.pre(otherUserId !== userId);
            fc.pre(currentUsername !== newUsername);

            vi.clearAllMocks();

            // Capture whatever `prisma.user.update` would have been called with
            const updateSpy = vi.mocked(prisma.user.update);

            const existingUser = buildUser({ id: userId, username: currentUsername });
            const conflictUser = buildUser({ id: otherUserId, username: newUsername });

            vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser as never);
            vi.mocked(prisma.user.findFirst).mockResolvedValue(conflictUser as never);

            try {
              await updateUsername(userId, newUsername);
            } catch {
              // Expected to throw
            }

            // The invariant: update was never called → stored username is unchanged
            expect(updateSpy).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ── Property 11d: Update returns 404 when the target user does not exist ──

  /**
   * **Validates: Requirements 8.2**
   *
   * If the user being updated does not exist in the database, `updateUsername`
   * must throw 404 USER_NOT_FOUND regardless of the requested username.
   */
  it(
    'throws 404 USER_NOT_FOUND when the target user does not exist',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          usernameArb,
          async (userId, newUsername) => {
            vi.clearAllMocks();

            // Simulate user not found
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            let thrownError: unknown;
            try {
              await updateUsername(userId, newUsername);
            } catch (err) {
              thrownError = err;
            }

            expect(thrownError).toBeDefined();
            const e = thrownError as Record<string, unknown>;
            expect(e['status']).toBe(404);
            expect(e['code']).toBe('USER_NOT_FOUND');

            // Must not attempt a conflict check or DB update
            expect(prisma.user.findFirst).not.toHaveBeenCalled();
            expect(prisma.user.update).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
