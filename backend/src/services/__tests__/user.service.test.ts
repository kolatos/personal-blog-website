// Unit tests untuk UserService
// Requirements: 8.1–8.6

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks (hoisted sebelum import nyata) ───────────────────────────────

vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// ── Imports (setelah mocks) ──────────────────────────────────────────────────

import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import {
  getProfile,
  updateUsername,
  updatePassword,
} from '../user.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2024-06-01T10:00:00Z');

const BASE_USER = {
  id: 'user-uuid-123',
  username: 'alice',
  email: 'alice@example.com',
  role: 'user' as const,
  createdAt: NOW,
  updatedAt: NOW,
};

// User dengan passwordHash (digunakan untuk updatePassword)
const USER_WITH_HASH = {
  id: 'user-uuid-123',
  passwordHash: '$2b$12$existinghash',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════
  // getProfile
  // Requirements: 8.1
  // ══════════════════════════════════════════════════════════════════════

  describe('getProfile', () => {
    describe('user ditemukan (Req 8.1)', () => {
      it('mengembalikan UserProfile tanpa passwordHash ketika user ada', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(BASE_USER as never);

        const result = await getProfile('user-uuid-123');

        expect(result).toEqual({
          id: BASE_USER.id,
          username: BASE_USER.username,
          email: BASE_USER.email,
          role: BASE_USER.role,
          createdAt: BASE_USER.createdAt,
          updatedAt: BASE_USER.updatedAt,
        });
        // passwordHash tidak boleh ada dalam hasil
        expect(result).not.toHaveProperty('passwordHash');
      });

      it('memanggil prisma.user.findUnique dengan id yang benar', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(BASE_USER as never);

        await getProfile('user-uuid-123');

        expect(prisma.user.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'user-uuid-123' },
          })
        );
      });

      it('mengembalikan role yang benar dari profil', async () => {
        const adminUser = { ...BASE_USER, role: 'admin' as const };
        vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as never);

        const result = await getProfile('user-uuid-123');

        expect(result.role).toBe('admin');
      });
    });

    describe('user tidak ditemukan (Req 8.1)', () => {
      it('melempar error 404 USER_NOT_FOUND ketika user tidak ada', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

        await expect(getProfile('nonexistent-id')).rejects.toMatchObject({
          status: 404,
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      });

      it('tidak mengembalikan data apapun ketika user tidak ada', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

        let result: unknown;
        try {
          result = await getProfile('nonexistent-id');
        } catch {
          // expected error
        }

        expect(result).toBeUndefined();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // updateUsername
  // Requirements: 8.2, 8.3
  // ══════════════════════════════════════════════════════════════════════

  describe('updateUsername', () => {
    describe('username unik — sukses (Req 8.2)', () => {
      it('mengembalikan UserProfile terupdate ketika username unik', async () => {
        const updatedUser = { ...BASE_USER, username: 'alice_baru' };

        // findUnique pertama: verifikasi user ada
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          { id: BASE_USER.id, username: BASE_USER.username } as never
        );
        // findFirst: cek collision → tidak ada
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
        // update: kembalikan user yang terupdate
        vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as never);

        const result = await updateUsername('user-uuid-123', 'alice_baru');

        expect(result.username).toBe('alice_baru');
        expect(result.id).toBe(BASE_USER.id);
      });

      it('memanggil prisma.user.update dengan username baru (Req 8.2)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          { id: BASE_USER.id, username: BASE_USER.username } as never
        );
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.user.update).mockResolvedValue({
          ...BASE_USER,
          username: 'alice_baru',
        } as never);

        await updateUsername('user-uuid-123', 'alice_baru');

        expect(prisma.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'user-uuid-123' },
            data: { username: 'alice_baru' },
          })
        );
      });

      it('memeriksa collision dengan mengecualikan user saat ini (Req 8.3)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          { id: BASE_USER.id, username: BASE_USER.username } as never
        );
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.user.update).mockResolvedValue({
          ...BASE_USER,
          username: 'alice_baru',
        } as never);

        await updateUsername('user-uuid-123', 'alice_baru');

        expect(prisma.user.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              username: 'alice_baru',
              NOT: { id: 'user-uuid-123' },
            }),
          })
        );
      });
    });

    describe('username duplikat — 409 (Req 8.3)', () => {
      it('melempar error 409 USERNAME_TAKEN ketika username sudah digunakan oleh user lain', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          { id: BASE_USER.id, username: BASE_USER.username } as never
        );
        // findFirst: ada user lain dengan username yang sama
        vi.mocked(prisma.user.findFirst).mockResolvedValue(
          { id: 'other-user-uuid' } as never
        );

        await expect(
          updateUsername('user-uuid-123', 'nama_yang_sudah_dipakai')
        ).rejects.toMatchObject({
          status: 409,
          code: 'USERNAME_TAKEN',
          message: 'Username is already taken',
        });
      });

      it('tidak memanggil prisma.user.update ketika username duplikat', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          { id: BASE_USER.id, username: BASE_USER.username } as never
        );
        vi.mocked(prisma.user.findFirst).mockResolvedValue(
          { id: 'other-user-uuid' } as never
        );

        await expect(
          updateUsername('user-uuid-123', 'nama_yang_sudah_dipakai')
        ).rejects.toThrow();

        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('error 409 menyertakan fields.username (Req 8.3)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          { id: BASE_USER.id, username: BASE_USER.username } as never
        );
        vi.mocked(prisma.user.findFirst).mockResolvedValue(
          { id: 'other-user-uuid' } as never
        );

        await expect(
          updateUsername('user-uuid-123', 'nama_yang_sudah_dipakai')
        ).rejects.toMatchObject({
          fields: { username: 'Username is already taken' },
        });
      });
    });

    describe('user tidak ditemukan', () => {
      it('melempar error 404 USER_NOT_FOUND ketika user tidak ada', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

        await expect(
          updateUsername('nonexistent-id', 'username_baru')
        ).rejects.toMatchObject({
          status: 404,
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      });

      it('tidak memeriksa collision ketika user tidak ditemukan', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

        await expect(
          updateUsername('nonexistent-id', 'username_baru')
        ).rejects.toThrow();

        expect(prisma.user.findFirst).not.toHaveBeenCalled();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // updatePassword
  // Requirements: 8.4, 8.5, 8.6
  // ══════════════════════════════════════════════════════════════════════

  describe('updatePassword', () => {
    describe('password lama benar + password baru valid (Req 8.4, 8.6)', () => {
      it('berhasil mengupdate password tanpa melempar error', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          USER_WITH_HASH as never
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$newhash' as never);
        vi.mocked(prisma.user.update).mockResolvedValue({} as never);

        await expect(
          updatePassword('user-uuid-123', 'OldPass123', 'NewPass456')
        ).resolves.toBeUndefined();
      });

      it('meng-hash password baru dengan bcrypt cost 12 sebelum menyimpan (Req 8.6)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          USER_WITH_HASH as never
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$newhash' as never);
        vi.mocked(prisma.user.update).mockResolvedValue({} as never);

        await updatePassword('user-uuid-123', 'OldPass123', 'NewPass456');

        expect(bcrypt.hash).toHaveBeenCalledWith('NewPass456', 12);
      });

      it('menyimpan hash baru ke database melalui prisma.user.update', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          USER_WITH_HASH as never
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$newhash' as never);
        vi.mocked(prisma.user.update).mockResolvedValue({} as never);

        await updatePassword('user-uuid-123', 'OldPass123', 'NewPass456');

        expect(prisma.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'user-uuid-123' },
            data: { passwordHash: '$2b$12$newhash' },
          })
        );
      });

      it('memverifikasi password lama dengan bcrypt menggunakan hash tersimpan (Req 8.4)', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          USER_WITH_HASH as never
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$newhash' as never);
        vi.mocked(prisma.user.update).mockResolvedValue({} as never);

        await updatePassword('user-uuid-123', 'OldPass123', 'NewPass456');

        expect(bcrypt.compare).toHaveBeenCalledWith(
          'OldPass123',
          USER_WITH_HASH.passwordHash
        );
      });
    });

    describe('password lama salah (Req 8.4)', () => {
      it('melempar error 401 INVALID_PASSWORD ketika password lama salah', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          USER_WITH_HASH as never
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(
          updatePassword('user-uuid-123', 'PasswordSalah', 'NewPass456')
        ).rejects.toMatchObject({
          status: 401,
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect',
        });
      });

      it('tidak memanggil bcrypt.hash ketika password lama salah', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          USER_WITH_HASH as never
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(
          updatePassword('user-uuid-123', 'PasswordSalah', 'NewPass456')
        ).rejects.toThrow();

        expect(bcrypt.hash).not.toHaveBeenCalled();
      });

      it('tidak mengupdate database ketika password lama salah', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          USER_WITH_HASH as never
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        await expect(
          updatePassword('user-uuid-123', 'PasswordSalah', 'NewPass456')
        ).rejects.toThrow();

        expect(prisma.user.update).not.toHaveBeenCalled();
      });
    });

    describe('password baru sama dengan password lama (Req 8.5)', () => {
      it('melempar error 422 SAME_PASSWORD ketika password baru identik dengan password lama', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          USER_WITH_HASH as never
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        await expect(
          updatePassword('user-uuid-123', 'SamePass123', 'SamePass123')
        ).rejects.toMatchObject({
          status: 422,
          code: 'SAME_PASSWORD',
          message: 'New password must be different from the current password',
        });
      });

      it('tidak menyimpan apapun ke database ketika password baru sama dengan lama', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          USER_WITH_HASH as never
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        await expect(
          updatePassword('user-uuid-123', 'SamePass123', 'SamePass123')
        ).rejects.toThrow();

        expect(prisma.user.update).not.toHaveBeenCalled();
      });
    });

    describe('password baru terlalu pendek', () => {
      it('menerima password pendek di service level (validasi panjang dilakukan Zod schema)', async () => {
        // UserService tidak memvalidasi panjang password — itu tugas Zod schema.
        // Service hanya memverifikasi password lama dan perbedaan dengan yang baru.
        vi.mocked(prisma.user.findUnique).mockResolvedValue(
          USER_WITH_HASH as never
        );
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$shorthash' as never);
        vi.mocked(prisma.user.update).mockResolvedValue({} as never);

        // Service memproses password pendek selama password baru berbeda dari lama
        await expect(
          updatePassword('user-uuid-123', 'OldPass123', 'abc')
        ).resolves.toBeUndefined();

        // bcrypt.hash dipanggil meskipun password pendek (validasi diluar service)
        expect(bcrypt.hash).toHaveBeenCalledWith('abc', 12);
      });
    });

    describe('user tidak ditemukan', () => {
      it('melempar error 404 USER_NOT_FOUND ketika user tidak ada', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

        await expect(
          updatePassword('nonexistent-id', 'OldPass123', 'NewPass456')
        ).rejects.toMatchObject({
          status: 404,
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      });

      it('tidak memanggil bcrypt.compare ketika user tidak ditemukan', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

        await expect(
          updatePassword('nonexistent-id', 'OldPass123', 'NewPass456')
        ).rejects.toThrow();

        expect(bcrypt.compare).not.toHaveBeenCalled();
      });
    });
  });
});
