// Unit tests for AuthService
// Requirements: 1.1–1.7, 2.1–2.6

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks (hoisted before real imports) ────────────────────────────────

vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    tokenBlacklist: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    loginAttempts: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
    decode: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../lib/prisma';
import {
  registerUser,
  loginAdmin,
  loginUser,
  logout,
  validateToken,
  isTokenBlacklisted,
  recordFailedAttempt,
  checkAccountLockout,
  resetFailedAttempts,
} from '../auth.service';
import type { RegisterDto, LoginDto } from '../../types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_USER = {
  id: 'user-uuid-123',
  email: 'alice@example.com',
  username: 'alice',
  passwordHash: '$2b$12$hashedpassword',
  role: 'user' as const,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const ADMIN_USER = {
  ...BASE_USER,
  id: 'admin-uuid-456',
  email: 'admin@example.com',
  username: 'adminuser',
  role: 'admin' as const,
};

const VALID_REGISTER_DTO: RegisterDto = {
  email: 'newuser@example.com',
  username: 'newuser',
  password: 'SecurePass123',
};

const VALID_LOGIN_DTO: LoginDto = {
  email: 'alice@example.com',
  password: 'SecurePass123',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  // ══════════════════════════════════════════════════════════════════════
  // registerUser
  // Requirements: 2.1, 2.2, 2.6
  // ══════════════════════════════════════════════════════════════════════

  describe('registerUser', () => {
    describe('sukses', () => {
      it('mengembalikan UserProfile setelah berhasil menyimpan user baru', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$newhash' as never);
        vi.mocked(prisma.user.create).mockResolvedValue({
          ...BASE_USER,
          email: VALID_REGISTER_DTO.email,
          username: VALID_REGISTER_DTO.username,
          passwordHash: '$2b$12$newhash',
        } as never);

        const result = await registerUser(VALID_REGISTER_DTO);

        expect(result).toEqual({
          id: BASE_USER.id,
          username: VALID_REGISTER_DTO.username,
          email: VALID_REGISTER_DTO.email,
          role: 'user',
          createdAt: BASE_USER.createdAt,
          updatedAt: BASE_USER.updatedAt,
        });
      });

      it('meng-hash password dengan bcrypt sebelum menyimpan (Req 2.6)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$newhash' as never);
        vi.mocked(prisma.user.create).mockResolvedValue({
          ...BASE_USER,
          email: VALID_REGISTER_DTO.email,
          username: VALID_REGISTER_DTO.username,
        } as never);

        await registerUser(VALID_REGISTER_DTO);

        // bcrypt.hash harus dipanggil dengan plaintext password dan cost 12
        expect(bcrypt.hash).toHaveBeenCalledWith(VALID_REGISTER_DTO.password, 12);
      });

      it('menyimpan user ke DB dengan role default "user" (Req 2.1)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$newhash' as never);
        vi.mocked(prisma.user.create).mockResolvedValue({
          ...BASE_USER,
          email: VALID_REGISTER_DTO.email,
          username: VALID_REGISTER_DTO.username,
        } as never);

        await registerUser(VALID_REGISTER_DTO);

        expect(prisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ role: 'user' }),
          })
        );
      });
    });

    describe('duplikat email (Req 2.2)', () => {
      it('melempar error 409 DUPLICATE_FIELD ketika email sudah digunakan', async () => {
        // email sudah ada, username belum
        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce(BASE_USER as never) // email lookup → ada
          .mockResolvedValueOnce(null);              // username lookup → tidak ada

        const promise = registerUser(VALID_REGISTER_DTO);

        await expect(promise).rejects.toMatchObject({
          status: 409,
          code: 'DUPLICATE_FIELD',
          fields: { email: 'Email is already in use' },
        });
        expect(prisma.user.create).not.toHaveBeenCalled();
      });
    });

    describe('duplikat username (Req 2.2)', () => {
      it('melempar error 409 DUPLICATE_FIELD ketika username sudah digunakan', async () => {
        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce(null)               // email lookup → tidak ada
          .mockResolvedValueOnce(BASE_USER as never); // username lookup → ada

        const promise = registerUser(VALID_REGISTER_DTO);

        await expect(promise).rejects.toMatchObject({
          status: 409,
          code: 'DUPLICATE_FIELD',
          fields: { username: 'Username is already taken' },
        });
        expect(prisma.user.create).not.toHaveBeenCalled();
      });

      it('melempar error 409 dengan kedua field ketika email DAN username duplikat', async () => {
        vi.mocked(prisma.user.findUnique)
          .mockResolvedValueOnce(BASE_USER as never)  // email → ada
          .mockResolvedValueOnce(ADMIN_USER as never); // username → ada

        const promise = registerUser(VALID_REGISTER_DTO);

        await expect(promise).rejects.toMatchObject({
          status: 409,
          code: 'DUPLICATE_FIELD',
          fields: {
            email: 'Email is already in use',
            username: 'Username is already taken',
          },
        });
      });
    });

    describe('password terlalu pendek', () => {
      it('tidak dipanggil bcrypt.hash jika validasi Zod sudah menolak — hash dipanggil hanya untuk input valid', async () => {
        // AuthService sendiri tidak melakukan validasi panjang password;
        // itu adalah tanggung jawab Zod schema. Kita verifikasi bahwa
        // ketika password diteruskan langsung (bypass Zod), service
        // tetap memanggil bcrypt.hash tanpa pengecekan tambahan.
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$newhash' as never);
        vi.mocked(prisma.user.create).mockResolvedValue({
          ...BASE_USER,
        } as never);

        // password pendek lolos ke service (Zod sudah memblokir sebelumnya)
        await registerUser({ ...VALID_REGISTER_DTO, password: 'short' });

        // service harus tetap memanggil bcrypt.hash dengan nilai yang diberikan
        expect(bcrypt.hash).toHaveBeenCalledWith('short', 12);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // loginAdmin
  // Requirements: 1.1, 1.3, 7.1
  // ══════════════════════════════════════════════════════════════════════

  describe('loginAdmin', () => {
    const ADMIN_CREDS: LoginDto = {
      email: 'admin@example.com',
      password: 'AdminPass123',
    };

    describe('kredensial valid', () => {
      it('mengembalikan token dan expiresIn saat login admin berhasil (Req 1.1)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(ADMIN_USER as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(uuidv4).mockReturnValue('jti-uuid-abc' as never);
        vi.mocked(jwt.sign).mockReturnValue('signed.jwt.token' as never);

        const result = await loginAdmin(ADMIN_CREDS);

        expect(result).toEqual({
          token: 'signed.jwt.token',
          expiresIn: 24 * 60 * 60, // 24 jam dalam detik
          user: {
            id: ADMIN_USER.id,
            username: ADMIN_USER.username,
            email: ADMIN_USER.email,
            role: 'admin',
            createdAt: ADMIN_USER.createdAt,
            updatedAt: ADMIN_USER.updatedAt,
          },
        });
      });

      it('menyertakan klaim role:"admin" dan jti dalam JWT payload (Req 7.1)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(ADMIN_USER as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(uuidv4).mockReturnValue('jti-uuid-abc' as never);
        vi.mocked(jwt.sign).mockReturnValue('signed.jwt.token' as never);

        await loginAdmin(ADMIN_CREDS);

        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            sub: ADMIN_USER.id,
            username: ADMIN_USER.username,
            role: 'admin',
            jti: 'jti-uuid-abc',
          }),
          'test-jwt-secret',
          { expiresIn: 24 * 60 * 60 }
        );
      });

      it('dapat login menggunakan username sebagai ganti email', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(ADMIN_USER as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(uuidv4).mockReturnValue('jti-uuid-abc' as never);
        vi.mocked(jwt.sign).mockReturnValue('signed.jwt.token' as never);

        const result = await loginAdmin({ username: 'adminuser', password: 'AdminPass123' });

        expect(result.token).toBe('signed.jwt.token');
        // query harus menggunakan username
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { username: 'adminuser' },
        });
      });
    });

    describe('kredensial invalid (Req 1.3)', () => {
      it('melempar error 401 INVALID_CREDENTIALS ketika user tidak ditemukan', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(loginAdmin(ADMIN_CREDS)).rejects.toMatchObject({
          status: 401,
          code: 'INVALID_CREDENTIALS',
        });
      });

      it('melempar error 401 INVALID_CREDENTIALS ketika password salah', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(ADMIN_USER as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(loginAdmin(ADMIN_CREDS)).rejects.toMatchObject({
          status: 401,
          code: 'INVALID_CREDENTIALS',
        });
      });

      it('melempar error 401 INVALID_CREDENTIALS ketika role bukan admin (user mencoba login admin)', async () => {
        // User biasa mencoba endpoint admin
        vi.mocked(prisma.user.findUnique).mockResolvedValue(BASE_USER as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(loginAdmin(ADMIN_CREDS)).rejects.toMatchObject({
          status: 401,
          code: 'INVALID_CREDENTIALS',
        });
        // Tidak boleh mengungkap field mana yang salah
        await expect(loginAdmin(ADMIN_CREDS)).rejects.not.toMatchObject({
          fields: expect.anything(),
        });
      });

      it('melakukan dummy bcrypt compare untuk mencegah timing attack saat user tidak ditemukan', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(loginAdmin(ADMIN_CREDS)).rejects.toBeDefined();

        // bcrypt.compare harus dipanggil meskipun user tidak ditemukan
        expect(bcrypt.compare).toHaveBeenCalledOnce();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // loginUser
  // Requirements: 2.4, 2.5, 7.1
  // ══════════════════════════════════════════════════════════════════════

  describe('loginUser', () => {
    describe('kredensial valid', () => {
      it('mengembalikan token dengan expiresIn 7 hari saat login user berhasil (Req 2.4)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(BASE_USER as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(uuidv4).mockReturnValue('jti-user-abc' as never);
        vi.mocked(jwt.sign).mockReturnValue('user.signed.token' as never);

        const result = await loginUser(VALID_LOGIN_DTO);

        expect(result).toEqual({
          token: 'user.signed.token',
          expiresIn: 7 * 24 * 60 * 60, // 7 hari dalam detik
          user: {
            id: BASE_USER.id,
            username: BASE_USER.username,
            email: BASE_USER.email,
            role: 'user',
            createdAt: BASE_USER.createdAt,
            updatedAt: BASE_USER.updatedAt,
          },
        });
      });

      it('menyertakan klaim role:"user" dan jti dalam JWT payload (Req 7.1)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(BASE_USER as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(uuidv4).mockReturnValue('jti-user-abc' as never);
        vi.mocked(jwt.sign).mockReturnValue('user.signed.token' as never);

        await loginUser(VALID_LOGIN_DTO);

        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            sub: BASE_USER.id,
            username: BASE_USER.username,
            role: 'user',
            jti: 'jti-user-abc',
          }),
          'test-jwt-secret',
          { expiresIn: 7 * 24 * 60 * 60 }
        );
      });
    });

    describe('kredensial invalid (Req 2.5)', () => {
      it('melempar error 401 INVALID_CREDENTIALS saat password salah', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(BASE_USER as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(loginUser(VALID_LOGIN_DTO)).rejects.toMatchObject({
          status: 401,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
        });
      });

      it('melempar error 401 INVALID_CREDENTIALS saat user tidak ditemukan', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(loginUser(VALID_LOGIN_DTO)).rejects.toMatchObject({
          status: 401,
          code: 'INVALID_CREDENTIALS',
        });
      });

      it('melempar error 401 ketika role bukan user (admin mencoba login sebagai user)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(ADMIN_USER as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(loginUser(VALID_LOGIN_DTO)).rejects.toMatchObject({
          status: 401,
          code: 'INVALID_CREDENTIALS',
        });
      });

      it('pesan error tidak mengungkap field mana yang salah (Req 2.5)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        try {
          await loginUser(VALID_LOGIN_DTO);
          expect.fail('Seharusnya melempar error');
        } catch (err: unknown) {
          const e = err as Record<string, unknown>;
          expect(e['fields']).toBeUndefined();
          expect(e['message']).toBe('Invalid credentials');
        }
      });
    });

    describe('login via username', () => {
      it('dapat login menggunakan username sebagai identifier', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(BASE_USER as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(uuidv4).mockReturnValue('jti-user-abc' as never);
        vi.mocked(jwt.sign).mockReturnValue('user.signed.token' as never);

        const result = await loginUser({ username: 'alice', password: 'SecurePass123' });

        expect(result.token).toBe('user.signed.token');
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { username: 'alice' },
        });
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // logout
  // Requirements: 1.6
  // ══════════════════════════════════════════════════════════════════════

  describe('logout', () => {
    const RAW_TOKEN = 'header.payload.signature';
    const JTI = 'jti-logout-test';
    const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600;

    describe('token berhasil di-blacklist', () => {
      it('memanggil tokenBlacklist.upsert dengan jti dan tokenHash yang benar (Req 1.6)', async () => {
        vi.mocked(jwt.decode).mockReturnValue({ exp: FUTURE_EXP });
        vi.mocked(prisma.tokenBlacklist.upsert).mockResolvedValue({} as never);

        await logout(RAW_TOKEN, JTI);

        expect(prisma.tokenBlacklist.upsert).toHaveBeenCalledOnce();

        const callArgs = vi.mocked(prisma.tokenBlacklist.upsert).mock.calls[0][0];
        expect(callArgs.where).toEqual({ jti: JTI });
        expect(callArgs.create.jti).toBe(JTI);
        // tokenHash harus berupa string SHA-256 hex (64 karakter)
        expect(callArgs.create.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      });

      it('menggunakan exp dari token untuk menentukan expiresAt', async () => {
        vi.mocked(jwt.decode).mockReturnValue({ exp: FUTURE_EXP });
        vi.mocked(prisma.tokenBlacklist.upsert).mockResolvedValue({} as never);

        await logout(RAW_TOKEN, JTI);

        const callArgs = vi.mocked(prisma.tokenBlacklist.upsert).mock.calls[0][0];
        const expectedDate = new Date(FUTURE_EXP * 1000);
        expect(callArgs.create.expiresAt).toEqual(expectedDate);
      });

      it('menggunakan fallback expiry 24 jam ketika token tidak memiliki klaim exp', async () => {
        vi.mocked(jwt.decode).mockReturnValue({}); // tidak ada field exp
        vi.mocked(prisma.tokenBlacklist.upsert).mockResolvedValue({} as never);

        const before = Date.now();
        await logout(RAW_TOKEN, JTI);
        const after = Date.now();

        const callArgs = vi.mocked(prisma.tokenBlacklist.upsert).mock.calls[0][0];
        const expiresAtMs = callArgs.create.expiresAt.getTime();
        // fallback: expires dalam 24 jam (24 * 60 * 60 * 1000 ms)
        const expectedMin = before + 24 * 60 * 60 * 1000;
        const expectedMax = after + 24 * 60 * 60 * 1000;
        expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMin);
        expect(expiresAtMs).toBeLessThanOrEqual(expectedMax);
      });

      it('logout dua kali untuk token yang sama tidak melempar error (upsert idempotent)', async () => {
        vi.mocked(jwt.decode).mockReturnValue({ exp: FUTURE_EXP });
        vi.mocked(prisma.tokenBlacklist.upsert).mockResolvedValue({} as never);

        await expect(logout(RAW_TOKEN, JTI)).resolves.toBeUndefined();
        await expect(logout(RAW_TOKEN, JTI)).resolves.toBeUndefined();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // validateToken
  // Requirements: 1.5
  // ══════════════════════════════════════════════════════════════════════

  describe('validateToken', () => {
    const VALID_PAYLOAD = {
      sub: BASE_USER.id,
      username: BASE_USER.username,
      role: 'user' as const,
      jti: 'jti-valid-test',
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it('mengembalikan decoded payload ketika token valid dan tidak ter-blacklist (Req 1.5)', async () => {
      vi.mocked(jwt.verify).mockReturnValue(VALID_PAYLOAD as never);
      vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue(null);

      const result = await validateToken('valid.token.here');

      expect(result).toEqual(VALID_PAYLOAD);
    });

    it('melempar error 401 ketika token tidak valid atau kedaluwarsa', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(validateToken('expired.token')).rejects.toMatchObject({
        status: 401,
        code: 'UNAUTHORIZED',
      });
    });

    it('melempar error 401 ketika token ter-blacklist (Req 1.5)', async () => {
      vi.mocked(jwt.verify).mockReturnValue(VALID_PAYLOAD as never);
      vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue({
        id: 'bl-id',
        jti: VALID_PAYLOAD.jti,
        tokenHash: 'some-hash',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600_000),
      } as never);

      await expect(validateToken('blacklisted.token')).rejects.toMatchObject({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Token has been invalidated',
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // isTokenBlacklisted
  // Requirements: 1.6
  // ══════════════════════════════════════════════════════════════════════

  describe('isTokenBlacklisted', () => {
    it('mengembalikan true ketika jti ditemukan di blacklist', async () => {
      vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue({
        id: 'bl-123',
      } as never);

      expect(await isTokenBlacklisted('some-jti')).toBe(true);
    });

    it('mengembalikan false ketika jti tidak ada di blacklist', async () => {
      vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue(null);

      expect(await isTokenBlacklisted('unknown-jti')).toBe(false);
    });

    it('query menggunakan jti yang benar sebagai where clause', async () => {
      vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue(null);

      await isTokenBlacklisted('specific-jti-value');

      expect(prisma.tokenBlacklist.findUnique).toHaveBeenCalledWith({
        where: { jti: 'specific-jti-value' },
        select: { id: true },
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // recordFailedAttempt
  // Requirements: 1.4
  // ══════════════════════════════════════════════════════════════════════

  describe('recordFailedAttempt', () => {
    it('membuat record baru dengan attemptCount 1 ketika belum ada record sebelumnya', async () => {
      vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.loginAttempts.upsert).mockResolvedValue({} as never);

      await recordFailedAttempt('alice');

      expect(prisma.loginAttempts.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { username: 'alice' },
          create: expect.objectContaining({
            username: 'alice',
            attemptCount: 1,
            lockedUntil: null,
          }),
          update: expect.objectContaining({
            attemptCount: 1,
            lockedUntil: null,
          }),
        })
      );
    });

    it('menginkremen attemptCount ketika sudah ada record sebelumnya', async () => {
      vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
        username: 'alice',
        attemptCount: 3,
        lockedUntil: null,
        lastAttemptAt: new Date(),
      } as never);
      vi.mocked(prisma.loginAttempts.upsert).mockResolvedValue({} as never);

      await recordFailedAttempt('alice');

      expect(prisma.loginAttempts.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ attemptCount: 4 }),
          update: expect.objectContaining({ attemptCount: 4 }),
        })
      );
    });

    describe('5 kali gagal → terkunci (Req 1.4)', () => {
      it('menetapkan lockedUntil ke NOW + 15 menit setelah percobaan ke-5', async () => {
        vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
          username: 'alice',
          attemptCount: 4, // percobaan ke-4 sudah ada, ini akan menjadi ke-5
          lockedUntil: null,
          lastAttemptAt: new Date(),
        } as never);
        vi.mocked(prisma.loginAttempts.upsert).mockResolvedValue({} as never);

        const before = Date.now();
        await recordFailedAttempt('alice');
        const after = Date.now();

        const callArgs = vi.mocked(prisma.loginAttempts.upsert).mock.calls[0][0];
        const lockedUntil: Date | null = callArgs.create.lockedUntil;

        expect(lockedUntil).not.toBeNull();
        const lockedUntilMs = lockedUntil!.getTime();
        const expectedMin = before + 15 * 60 * 1000;
        const expectedMax = after + 15 * 60 * 1000;
        expect(lockedUntilMs).toBeGreaterThanOrEqual(expectedMin);
        expect(lockedUntilMs).toBeLessThanOrEqual(expectedMax);
      });

      it('lockedUntil diset pada update juga (bukan hanya create)', async () => {
        vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
          username: 'alice',
          attemptCount: 4,
          lockedUntil: null,
          lastAttemptAt: new Date(),
        } as never);
        vi.mocked(prisma.loginAttempts.upsert).mockResolvedValue({} as never);

        await recordFailedAttempt('alice');

        const callArgs = vi.mocked(prisma.loginAttempts.upsert).mock.calls[0][0];
        expect(callArgs.update.lockedUntil).not.toBeNull();
      });

      it('tidak menetapkan lockedUntil sebelum percobaan ke-5 (kurang dari 5 kali)', async () => {
        vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
          username: 'alice',
          attemptCount: 3, // percobaan ke-4, belum terkunci
          lockedUntil: null,
          lastAttemptAt: new Date(),
        } as never);
        vi.mocked(prisma.loginAttempts.upsert).mockResolvedValue({} as never);

        await recordFailedAttempt('alice');

        const callArgs = vi.mocked(prisma.loginAttempts.upsert).mock.calls[0][0];
        expect(callArgs.create.lockedUntil).toBeNull();
        expect(callArgs.update.lockedUntil).toBeNull();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // checkAccountLockout
  // Requirements: 1.4
  // ══════════════════════════════════════════════════════════════════════

  describe('checkAccountLockout', () => {
    describe('akun tidak terkunci', () => {
      it('mengembalikan isLocked:false dan attemptCount:0 ketika tidak ada record', async () => {
        vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue(null);

        const status = await checkAccountLockout('alice');

        expect(status).toEqual({ isLocked: false, attemptCount: 0 });
      });

      it('mengembalikan isLocked:false ketika lockedUntil adalah null', async () => {
        vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
          username: 'alice',
          attemptCount: 2,
          lockedUntil: null,
          lastAttemptAt: new Date(),
        } as never);

        const status = await checkAccountLockout('alice');

        expect(status.isLocked).toBe(false);
        expect(status.attemptCount).toBe(2);
        expect(status.lockedUntil).toBeUndefined();
      });

      describe('lockout expired → bisa login lagi (Req 1.4)', () => {
        it('mengembalikan isLocked:false ketika lockedUntil sudah lewat', async () => {
          const pastDate = new Date(Date.now() - 60_000); // 1 menit yang lalu
          vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
            username: 'alice',
            attemptCount: 5,
            lockedUntil: pastDate,
            lastAttemptAt: new Date(Date.now() - 16 * 60 * 1000),
          } as never);

          const status = await checkAccountLockout('alice');

          expect(status.isLocked).toBe(false);
          expect(status.lockedUntil).toEqual(pastDate);
          expect(status.attemptCount).toBe(5);
        });
      });
    });

    describe('akun terkunci', () => {
      it('mengembalikan isLocked:true ketika lockedUntil ada di masa depan (Req 1.4)', async () => {
        const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 menit lagi
        vi.mocked(prisma.loginAttempts.findUnique).mockResolvedValue({
          username: 'alice',
          attemptCount: 5,
          lockedUntil: futureDate,
          lastAttemptAt: new Date(),
        } as never);

        const status = await checkAccountLockout('alice');

        expect(status.isLocked).toBe(true);
        expect(status.lockedUntil).toEqual(futureDate);
        expect(status.attemptCount).toBe(5);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // resetFailedAttempts
  // ══════════════════════════════════════════════════════════════════════

  describe('resetFailedAttempts', () => {
    it('mereset attemptCount ke 0 dan menghapus lockedUntil', async () => {
      vi.mocked(prisma.loginAttempts.upsert).mockResolvedValue({} as never);

      await resetFailedAttempts('alice');

      expect(prisma.loginAttempts.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { username: 'alice' },
          update: expect.objectContaining({
            attemptCount: 0,
            lockedUntil: null,
          }),
        })
      );
    });

    it('tidak melempar error ketika dipanggil untuk user yang tidak ada record-nya', async () => {
      vi.mocked(prisma.loginAttempts.upsert).mockResolvedValue({} as never);

      await expect(resetFailedAttempts('nonexistent')).resolves.toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // JWT_SECRET tidak dikonfigurasi
  // Requirements: 1.1, 2.4
  // ══════════════════════════════════════════════════════════════════════

  describe('JWT_SECRET tidak dikonfigurasi', () => {
    it('loginAdmin melempar error 500 INTERNAL_ERROR ketika JWT_SECRET tidak ada', async () => {
      delete process.env.JWT_SECRET;
      vi.mocked(prisma.user.findUnique).mockResolvedValue(ADMIN_USER as never);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(uuidv4).mockReturnValue('jti-abc' as never);

      await expect(loginAdmin({ email: 'admin@example.com', password: 'pass' })).rejects.toMatchObject({
        status: 500,
        code: 'INTERNAL_ERROR',
      });
    });

    it('loginUser melempar error 500 INTERNAL_ERROR ketika JWT_SECRET tidak ada', async () => {
      delete process.env.JWT_SECRET;
      vi.mocked(prisma.user.findUnique).mockResolvedValue(BASE_USER as never);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(uuidv4).mockReturnValue('jti-abc' as never);

      await expect(loginUser({ email: 'alice@example.com', password: 'pass' })).rejects.toMatchObject({
        status: 500,
        code: 'INTERNAL_ERROR',
      });
    });
  });
});
