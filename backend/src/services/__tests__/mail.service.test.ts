/**
 * Unit tests untuk MailService
 * Task 10 — Stage 1 Blog Improvements
 *
 * Skenario yang dicakup:
 *  1. sendNewPostNotification dipanggil dengan email yang benar saat RESEND_API_KEY tersedia
 *  2. No-op saat RESEND_API_KEY tidak ada (client null)
 *  3. No-op saat daftar emails kosong
 *
 * Requirements: 6.5, 6.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const sendMock = vi.fn().mockResolvedValue({ id: 'email-id-123' });

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: sendMock,
    },
  })),
}));

// ─── Imports setelah mocks ─────────────────────────────────────────────────────

import { Resend } from 'resend';
import { MailService } from '../mail.service';
import type { Post } from '../../types/index';

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const POST_FIXTURE: Post = {
  id: 'post-uuid-1',
  title: 'Hello World',
  slug: 'hello-world',
  content: '# Hello\n\nIni adalah post pertama.',
  contentHtml: '<h1>Hello</h1><p>Ini adalah post pertama.</p>',
  status: 'published',
  publishedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  commentCount: 0,
  tags: ['tutorial'],
};

const EMAILS = ['user1@example.com', 'user2@example.com'];

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('MailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendNewPostNotification', () => {
    it('mengirim email ke semua subscriber ketika RESEND_API_KEY tersedia', async () => {
      process.env['RESEND_API_KEY'] = 'test-api-key-123';
      process.env['RESEND_FROM_EMAIL'] = 'noreply@myblog.com';

      const service = new MailService();
      await service.sendNewPostNotification(POST_FIXTURE, EMAILS);

      expect(sendMock).toHaveBeenCalledOnce();
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@myblog.com',
          to: EMAILS,
          subject: `Post baru: ${POST_FIXTURE.title}`,
        })
      );
    });

    it('no-op saat RESEND_API_KEY tidak ada', async () => {
      delete process.env['RESEND_API_KEY'];

      const service = new MailService();
      await service.sendNewPostNotification(POST_FIXTURE, EMAILS);

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('no-op saat RESEND_API_KEY adalah string kosong', async () => {
      process.env['RESEND_API_KEY'] = '';

      const service = new MailService();
      await service.sendNewPostNotification(POST_FIXTURE, EMAILS);

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('no-op saat daftar emails kosong', async () => {
      process.env['RESEND_API_KEY'] = 'test-api-key-123';

      const service = new MailService();
      await service.sendNewPostNotification(POST_FIXTURE, []);

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('menggunakan RESEND_FROM_EMAIL sebagai pengirim', async () => {
      process.env['RESEND_API_KEY'] = 'test-api-key-456';
      process.env['RESEND_FROM_EMAIL'] = 'hello@custom-domain.com';

      const service = new MailService();
      await service.sendNewPostNotification(POST_FIXTURE, ['sub@example.com']);

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'hello@custom-domain.com',
        })
      );
    });

    it('Resend tidak diinisialisasi (constructor tidak dipanggil) saat RESEND_API_KEY tidak ada', async () => {
      delete process.env['RESEND_API_KEY'];
      const ResendConstructor = vi.mocked(Resend);
      ResendConstructor.mockClear();

      new MailService();

      expect(ResendConstructor).not.toHaveBeenCalled();
    });
  });
});
