// Feature: personal-blog-website, Property 12: Password change requires correct current password

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Module mocks (hoisted before real imports) ────────────────────────────────

vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
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

import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { updatePassword } from '../user.service';

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates valid passwords: 8–72 printable ASCII characters.
 * The length range matches Req 8.4 (8–72 characters).
 */
const passwordArb = fc.string({
  minLength: 8,
  maxLength: 72,
  unit: fc.mapToConstant(
    // printable ASCII 33–126 (excluding space to avoid ambiguity)
    { num: 94, build: (n) => String.fromCharCode(33 + n) },
  ),
});

/**
 * Generates UUID-like strings for user IDs.
 */
const userIdArb = fc.uuid();

/**
 * Produces a pair of passwords that are guaranteed to be different from each other.
 * Used to ensure we test the newPassword !== oldPassword path.
 */
const differentPasswordPairArb = fc
  .tuple(passwordArb, passwordArb)
  .filter(([a, b]) => a !== b);

/**
 * Generates a plausible bcrypt hash string (not a real hash; the actual
 * comparison is controlled via the mocked bcrypt.compare).
 */
const hashArb = fc
  .string({ minLength: 60, maxLength: 60, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./'.split('')) })
  .map((s) => `$2b$12$${s}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUser(id: string, passwordHash: string) {
  return {
    id,
    username: 'testuser',
    email: 'test@example.com',
    passwordHash,
    role: 'user',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 12: Password change requires correct current password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Property 12a: Succeeds when old password matches the stored hash ───────

  /**
   * **Validates: Requirements 8.4**
   *
   * For any userId and any (oldPassword, newPassword) pair where the two
   * passwords are different, `updatePassword` MUST succeed (resolve without
   * throwing) when `bcrypt.compare(oldPassword, storedHash)` returns true.
   * The stored hash MUST be updated exactly once with the new hash.
   */
  it(
    'succeeds and updates the stored hash when the correct old password is provided',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          differentPasswordPairArb,
          hashArb,
          hashArb,
          async (userId, [oldPassword, newPassword], storedHash, newHash) => {
            vi.clearAllMocks();

            const user = buildUser(userId, storedHash);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);

            // Simulate correct old password: bcrypt.compare returns true
            vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

            // Simulate bcrypt.hash producing the new hash
            vi.mocked(bcrypt.hash).mockResolvedValue(newHash as never);

            vi.mocked(prisma.user.update).mockResolvedValue({
              ...user,
              passwordHash: newHash,
            } as never);

            // Must not throw
            await expect(
              updatePassword(userId, oldPassword, newPassword),
            ).resolves.toBeUndefined();

            // Must have called prisma.user.update exactly once
            expect(prisma.user.update).toHaveBeenCalledOnce();

            // The update must include the new hash (not the old one)
            const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0];
            expect(updateCall.data.passwordHash).toBe(newHash);
            expect(updateCall.data.passwordHash).not.toBe(storedHash);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ── Property 12b: Throws 401 when old password does NOT match ─────────────

  /**
   * **Validates: Requirements 8.5**
   *
   * For any userId and any (oldPassword, newPassword) pair, when
   * `bcrypt.compare(oldPassword, storedHash)` returns false,
   * `updatePassword` MUST throw an error with status 401 and code
   * INVALID_PASSWORD. The DB update MUST NOT be called.
   */
  it(
    'throws 401 INVALID_PASSWORD and does not update the DB when the wrong old password is provided',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          differentPasswordPairArb,
          hashArb,
          async (userId, [oldPassword, newPassword], storedHash) => {
            vi.clearAllMocks();

            const user = buildUser(userId, storedHash);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);

            // Simulate wrong old password: bcrypt.compare returns false
            vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

            let thrownError: unknown;
            try {
              await updatePassword(userId, oldPassword, newPassword);
            } catch (err) {
              thrownError = err;
            }

            // Must have thrown
            expect(thrownError).toBeDefined();

            // Must be a 401 INVALID_PASSWORD error
            const e = thrownError as Record<string, unknown>;
            expect(e['status']).toBe(401);
            expect(e['code']).toBe('INVALID_PASSWORD');

            // The DB update MUST NOT have been called — password is unchanged
            expect(prisma.user.update).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ── Property 12c: Stored hash is unchanged after a failed attempt ─────────

  /**
   * **Validates: Requirements 8.5**
   *
   * After a failed `updatePassword` call (wrong old password), the stored
   * hash must remain identical to its value before the call. We verify this
   * indirectly by confirming `prisma.user.update` was never invoked, so the
   * database record could not have changed.
   */
  it(
    'never mutates the stored password hash when bcrypt.compare returns false',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          differentPasswordPairArb,
          hashArb,
          async (userId, [oldPassword, newPassword], storedHash) => {
            vi.clearAllMocks();

            const updateSpy = vi.mocked(prisma.user.update);
            const user = buildUser(userId, storedHash);

            vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
            vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

            try {
              await updatePassword(userId, oldPassword, newPassword);
            } catch {
              // Expected to throw; we only care about the invariant below
            }

            // Invariant: update was never called → the hash in the DB is untouched
            expect(updateSpy).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ── Property 12d: Returns 404 when the user does not exist ────────────────

  /**
   * **Validates: Requirements 8.4**
   *
   * If the user record is not found, `updatePassword` must throw a 404
   * USER_NOT_FOUND error without calling bcrypt or updating the DB.
   */
  it(
    'throws 404 USER_NOT_FOUND when the user does not exist',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          differentPasswordPairArb,
          async (userId, [oldPassword, newPassword]) => {
            vi.clearAllMocks();

            // User not found
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

            let thrownError: unknown;
            try {
              await updatePassword(userId, oldPassword, newPassword);
            } catch (err) {
              thrownError = err;
            }

            expect(thrownError).toBeDefined();
            const e = thrownError as Record<string, unknown>;
            expect(e['status']).toBe(404);
            expect(e['code']).toBe('USER_NOT_FOUND');

            // Must not attempt bcrypt comparison or a DB write
            expect(bcrypt.compare).not.toHaveBeenCalled();
            expect(prisma.user.update).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
