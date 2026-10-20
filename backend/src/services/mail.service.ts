import { Resend } from 'resend';
import type { Post } from '../types/index.js';

/**
 * MailService — wrapper tipis di atas Resend SDK.
 *
 * - Inisialisasi client dengan RESEND_API_KEY dari environment.
 * - Jika key tidak ada, client di-set ke null dan semua metode menjadi no-op.
 * - Kegagalan pengiriman email tidak boleh di-throw ke luar service ini;
 *   caller (publishPost) membungkus pemanggilan dalam try/catch sendiri.
 *
 * Requirements: 6.5, 6.6
 */
class MailService {
  private client: Resend | null;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env['RESEND_API_KEY'];
    this.fromEmail = process.env['RESEND_FROM_EMAIL'] ?? 'noreply@example.com';

    if (apiKey && apiKey.trim() !== '') {
      this.client = new Resend(apiKey);
    } else {
      this.client = null;
    }
  }

  /**
   * Mengirim notifikasi email ke semua subscriber ketika post baru dipublikasikan.
   *
   * No-op jika:
   * - RESEND_API_KEY tidak ada (client null)
   * - Daftar emails kosong
   *
   * Requirements: 6.4, 6.5, 6.6
   */
  async sendNewPostNotification(post: Post, emails: string[]): Promise<void> {
    if (!this.client || emails.length === 0) {
      return;
    }

    const subject = `Post baru: ${post.title}`;
    const postUrl = `${process.env['FRONTEND_URL'] ?? 'http://localhost:5173'}/posts/${post.slug}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Post baru telah dipublikasikan</h2>
        <h3>${post.title}</h3>
        <p>${post.content.slice(0, 200)}...</p>
        <a href="${postUrl}" style="
          display: inline-block;
          padding: 10px 20px;
          background-color: #3b82f6;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin-top: 16px;
        ">Baca Selengkapnya</a>
        <hr style="margin-top: 32px;" />
        <p style="color: #6b7280; font-size: 12px;">
          Anda menerima email ini karena berlangganan notifikasi post baru.
        </p>
      </div>
    `;

    await this.client.emails.send({
      from: this.fromEmail,
      to: emails,
      subject,
      html,
    });
  }
}

export const mailService = new MailService();
export { MailService };
