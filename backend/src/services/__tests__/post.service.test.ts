// Unit tests untuk PostService
// Requirements: 3.1–3.7, 4.1–4.8, 5.1–5.7

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks (hoisted before real imports) ────────────────────────────────

// $queryRaw is a tagged template literal — hoist its mock so it's accessible
// inside the vi.mock factory (which is itself hoisted before all imports).
const { queryRawMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  default: {
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    comment: {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    tag: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    postTag: {
      findMany: vi.fn(),
    },
    $queryRaw: queryRawMock,
  },
}));

vi.mock('marked', () => ({
  marked: vi.fn().mockResolvedValue('<p>rendered</p>'),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import prisma from '../../lib/prisma';
import {
  generateUniqueSlug,
  createPost,
  updatePost,
  deletePost,
  publishPost,
  unpublishPost,
  getPublishedPosts,
  getAllPosts,
  getPostBySlug,
  searchPosts,
} from '../post.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2024-06-01T10:00:00Z');
const PUBLISHED_AT = new Date('2024-05-15T08:00:00Z');

function buildPost(overrides: Partial<{
  id: string;
  title: string;
  slug: string;
  content: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: 'post-uuid-1',
    title: 'Hello World',
    slug: 'hello-world',
    content: '# Hello\n\nWorld',
    status: 'draft',
    publishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PostService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRawMock.mockReset();
    // Default mock for postTag.findMany — returns empty array unless overridden
    vi.mocked(prisma.postTag.findMany).mockResolvedValue([] as never);
    // Default comment count mocks — return 0 unless overridden
    vi.mocked(prisma.comment.count).mockResolvedValue(0);
    vi.mocked(prisma.comment.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.comment.deleteMany).mockResolvedValue({ count: 0 });
  });

  // ══════════════════════════════════════════════════════════════════════
  // generateUniqueSlug
  // Requirements: 3.1, 3.2
  // ══════════════════════════════════════════════════════════════════════

  describe('generateUniqueSlug', () => {
    describe('judul normal tanpa collision', () => {
      it('menghasilkan slug URL-safe dari judul normal (Req 3.1)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        const slug = await generateUniqueSlug('Hello World');

        expect(slug).toBe('hello-world');
      });

      it('mengubah huruf kapital menjadi huruf kecil', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        const slug = await generateUniqueSlug('My AWESOME Post');

        expect(slug).toBe('my-awesome-post');
      });

      it('mengembalikan base slug ketika tidak ada collision', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        const slug = await generateUniqueSlug('Belajar TypeScript');

        expect(slug).toBe('belajar-typescript');
      });
    });

    describe('judul dengan karakter khusus', () => {
      it('menghapus karakter khusus dari slug (Req 3.1)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        const slug = await generateUniqueSlug('Hello, World!');

        expect(slug).toBe('hello-world');
      });

      it('menangani judul dengan tanda tanya dan seru', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        const slug = await generateUniqueSlug('What is Node.js?');

        // slugify dengan strict:true menghapus titik dan tanda tanya
        expect(slug).toBe('what-is-nodejs');
      });

      it('menangani judul dengan angka', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        const slug = await generateUniqueSlug('Top 10 Tips');

        expect(slug).toBe('top-10-tips');
      });

      it('menangani spasi ganda dan spasi di awal/akhir', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        const slug = await generateUniqueSlug('  Hello   World  ');

        expect(slug).toBe('hello-world');
      });
    });

    describe('collision handling — suffix numerik (Req 3.2)', () => {
      it('menambahkan suffix -2 ketika base slug sudah ada', async () => {
        // base slug 'hello-world' sudah ada, tidak ada suffix lain
        vi.mocked(prisma.post.findUnique).mockResolvedValue(buildPost() as never);
        vi.mocked(prisma.post.findMany).mockResolvedValue([]);

        const slug = await generateUniqueSlug('Hello World');

        expect(slug).toBe('hello-world-2');
      });

      it('menambahkan suffix -3 ketika base dan -2 sudah ada', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(buildPost() as never);
        vi.mocked(prisma.post.findMany).mockResolvedValue([
          { slug: 'hello-world-2' },
        ] as never);

        const slug = await generateUniqueSlug('Hello World');

        expect(slug).toBe('hello-world-3');
      });

      it('menghitung suffix terbesar dengan benar dari banyak collision', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(buildPost() as never);
        vi.mocked(prisma.post.findMany).mockResolvedValue([
          { slug: 'hello-world-2' },
          { slug: 'hello-world-5' },
          { slug: 'hello-world-3' },
        ] as never);

        const slug = await generateUniqueSlug('Hello World');

        // Harus mengambil max suffix (5) + 1 = 6
        expect(slug).toBe('hello-world-6');
      });

      it('mengabaikan slug dengan suffix non-numerik saat mencari max', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(buildPost() as never);
        vi.mocked(prisma.post.findMany).mockResolvedValue([
          { slug: 'hello-world-abc' },
          { slug: 'hello-world-2' },
        ] as never);

        const slug = await generateUniqueSlug('Hello World');

        expect(slug).toBe('hello-world-3');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // createPost
  // Requirements: 3.1, 3.2, 3.5, 3.7
  // ══════════════════════════════════════════════════════════════════════

  describe('createPost', () => {
    describe('input valid (Req 3.5, 3.7)', () => {
      it('membuat post baru dengan status draft dan slug dari judul', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.post.findMany).mockResolvedValue([]);
        vi.mocked(prisma.post.create).mockResolvedValue(buildPost({
          title: 'Judul Post Baru',
          slug: 'judul-post-baru',
          content: '## Isi post',
          status: 'draft',
        }) as never);

        const result = await createPost({ title: 'Judul Post Baru', content: '## Isi post' });

        expect(result.status).toBe('draft');
        expect(result.slug).toBe('judul-post-baru');
        expect(result.title).toBe('Judul Post Baru');
      });

      it('memanggil prisma.post.create dengan status "draft" (Req 3.5)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.post.findMany).mockResolvedValue([]);
        vi.mocked(prisma.post.create).mockResolvedValue(buildPost() as never);

        await createPost({ title: 'Hello World', content: 'Isi' });

        expect(prisma.post.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'draft',
              slug: 'hello-world',
            }),
          })
        );
      });

      it('mengembalikan Post dengan contentHtml yang dirender dari markdown', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.post.findMany).mockResolvedValue([]);
        vi.mocked(prisma.post.create).mockResolvedValue(buildPost({
          content: '# Judul',
        }) as never);

        const result = await createPost({ title: 'Hello World', content: '# Judul' });

        // marked mock mengembalikan '<p>rendered</p>'
        expect(result.contentHtml).toBe('<p>rendered</p>');
      });

      it('mengembalikan commentCount 0 untuk post baru (Req 3.7)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.post.findMany).mockResolvedValue([]);
        vi.mocked(prisma.post.create).mockResolvedValue(buildPost() as never);

        const result = await createPost({ title: 'Hello World', content: 'Isi' });

        expect(result.commentCount).toBe(0);
      });

      it('publishedAt adalah null saat post baru dibuat (Req 3.5)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.post.findMany).mockResolvedValue([]);
        vi.mocked(prisma.post.create).mockResolvedValue(buildPost({
          publishedAt: null,
        }) as never);

        const result = await createPost({ title: 'Hello World', content: 'Isi' });

        expect(result.publishedAt).toBeNull();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // updatePost
  // Requirements: 3.3, 3.4, 3.5
  // ══════════════════════════════════════════════════════════════════════

  describe('updatePost', () => {
    describe('tanpa perubahan judul — slug tidak berubah (Req 3.3)', () => {
      it('mempertahankan slug asli ketika judul tidak diubah', async () => {
        const existing = buildPost({ status: 'draft' });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(existing as never);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...existing,
          content: 'Konten baru',
        } as never);

        await updatePost('post-uuid-1', { content: 'Konten baru' });

        // prisma.post.update tidak boleh mendapat field slug
        const updateCall = vi.mocked(prisma.post.update).mock.calls[0][0];
        expect(updateCall.data).not.toHaveProperty('slug');
      });

      it('memanggil prisma.post.update hanya dengan content ketika hanya content berubah', async () => {
        const existing = buildPost({ status: 'draft' });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(existing as never);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...existing,
          content: 'Konten diupdate',
        } as never);

        await updatePost('post-uuid-1', { content: 'Konten diupdate' });

        const updateCall = vi.mocked(prisma.post.update).mock.calls[0][0];
        expect(updateCall.data.content).toBe('Konten diupdate');
        expect(updateCall.data.title).toBeUndefined();
        expect(updateCall.data.slug).toBeUndefined();
      });
    });

    describe('dengan perubahan judul — slug di-regenerate (Req 3.3)', () => {
      it('menghasilkan slug baru ketika judul berubah', async () => {
        const existing = buildPost({
          title: 'Judul Lama',
          slug: 'judul-lama',
          status: 'draft',
        });
        vi.mocked(prisma.post.findUnique)
          .mockResolvedValueOnce(existing as never)  // load post
          .mockResolvedValueOnce(null);              // generateUniqueSlug → tidak ada collision
        vi.mocked(prisma.post.findMany).mockResolvedValue([]);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...existing,
          title: 'Judul Baru',
          slug: 'judul-baru',
        } as never);

        const result = await updatePost('post-uuid-1', { title: 'Judul Baru' });

        expect(result.slug).toBe('judul-baru');
        const updateCall = vi.mocked(prisma.post.update).mock.calls[0][0];
        expect(updateCall.data.slug).toBe('judul-baru');
      });

      it('meneruskan title baru ke prisma.post.update', async () => {
        const existing = buildPost({
          title: 'Judul Lama',
          slug: 'judul-lama',
          status: 'draft',
        });
        vi.mocked(prisma.post.findUnique)
          .mockResolvedValueOnce(existing as never)
          .mockResolvedValueOnce(null);
        vi.mocked(prisma.post.findMany).mockResolvedValue([]);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...existing,
          title: 'Judul Baru',
          slug: 'judul-baru',
        } as never);

        await updatePost('post-uuid-1', { title: 'Judul Baru' });

        const updateCall = vi.mocked(prisma.post.update).mock.calls[0][0];
        expect(updateCall.data.title).toBe('Judul Baru');
      });
    });

    describe('post Published → otomatis Draft saat diedit (Req 3.4)', () => {
      it('mengubah status dari published ke draft setelah diedit', async () => {
        const existing = buildPost({
          status: 'published',
          publishedAt: PUBLISHED_AT,
        });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(existing as never);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...existing,
          status: 'draft',
          publishedAt: null,
          content: 'Konten diupdate',
        } as never);

        const result = await updatePost('post-uuid-1', { content: 'Konten diupdate' });

        expect(result.status).toBe('draft');
        expect(result.publishedAt).toBeNull();
      });

      it('meneruskan status:"draft" dan publishedAt:null ke prisma.post.update (Req 3.4)', async () => {
        const existing = buildPost({
          status: 'published',
          publishedAt: PUBLISHED_AT,
        });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(existing as never);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...existing,
          status: 'draft',
          publishedAt: null,
        } as never);

        await updatePost('post-uuid-1', { content: 'Konten baru' });

        const updateCall = vi.mocked(prisma.post.update).mock.calls[0][0];
        expect(updateCall.data.status).toBe('draft');
        expect(updateCall.data.publishedAt).toBeNull();
      });

      it('post Draft tidak mengubah status ketika diedit', async () => {
        const existing = buildPost({ status: 'draft', publishedAt: null });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(existing as never);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...existing,
          content: 'Konten baru',
        } as never);

        await updatePost('post-uuid-1', { content: 'Konten baru' });

        // status tidak diset di update call (tidak ada perubahan status)
        const updateCall = vi.mocked(prisma.post.update).mock.calls[0][0];
        expect(updateCall.data.status).toBeUndefined();
      });
    });

    describe('post tidak ditemukan (Req 4.4)', () => {
      it('melempar error 404 NOT_FOUND ketika post tidak ada', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        await expect(updatePost('nonexistent-id', { content: 'Baru' })).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Post not found',
        });
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // deletePost
  // Requirements: 4.3, 4.8
  // ══════════════════════════════════════════════════════════════════════

  describe('deletePost', () => {
    it('menghapus post yang ada tanpa error (Req 4.3)', async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(buildPost() as never);
      vi.mocked(prisma.post.delete).mockResolvedValue(buildPost() as never);

      await expect(deletePost('post-uuid-1')).resolves.toBeUndefined();

      expect(prisma.post.delete).toHaveBeenCalledWith({ where: { id: 'post-uuid-1' } });
    });

    it('melempar error 404 NOT_FOUND ketika post tidak ada (Req 4.4)', async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

      await expect(deletePost('nonexistent-id')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Post not found',
      });

      expect(prisma.post.delete).not.toHaveBeenCalled();
    });

    it('mengembalikan void (undefined) setelah berhasil menghapus', async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValue(buildPost() as never);
      vi.mocked(prisma.post.delete).mockResolvedValue(buildPost() as never);

      const result = await deletePost('post-uuid-1');

      expect(result).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // publishPost
  // Requirements: 4.1, 4.6
  // ══════════════════════════════════════════════════════════════════════

  describe('publishPost', () => {
    describe('transisi valid: Draft → Published (Req 4.1)', () => {
      it('mengubah status menjadi published dan menetapkan publishedAt', async () => {
        const draftPost = buildPost({ status: 'draft', publishedAt: null });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(draftPost as never);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...draftPost,
          status: 'published',
          publishedAt: NOW,
        } as never);

        const result = await publishPost('post-uuid-1');

        expect(result.status).toBe('published');
        expect(result.publishedAt).not.toBeNull();
      });

      it('memanggil prisma.post.update dengan status "published" dan publishedAt baru', async () => {
        const draftPost = buildPost({ status: 'draft', publishedAt: null });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(draftPost as never);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...draftPost,
          status: 'published',
          publishedAt: NOW,
        } as never);

        await publishPost('post-uuid-1');

        const updateCall = vi.mocked(prisma.post.update).mock.calls[0][0];
        expect(updateCall.data.status).toBe('published');
        expect(updateCall.data.publishedAt).toBeInstanceOf(Date);
      });
    });

    describe('transisi invalid (Req 4.6)', () => {
      it('melempar error 409 STATUS_CONFLICT ketika post sudah published (Req 4.6)', async () => {
        const publishedPost = buildPost({ status: 'published', publishedAt: NOW });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(publishedPost as never);

        await expect(publishPost('post-uuid-1')).rejects.toMatchObject({
          status: 409,
          code: 'STATUS_CONFLICT',
          message: 'Post is already published',
        });

        expect(prisma.post.update).not.toHaveBeenCalled();
      });

      it('melempar error 404 NOT_FOUND ketika post tidak ada', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        await expect(publishPost('nonexistent-id')).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
        });
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // unpublishPost
  // Requirements: 4.2, 4.6
  // ══════════════════════════════════════════════════════════════════════

  describe('unpublishPost', () => {
    describe('transisi valid: Published → Draft (Req 4.2)', () => {
      it('mengubah status menjadi draft dan menghapus publishedAt', async () => {
        const publishedPost = buildPost({ status: 'published', publishedAt: PUBLISHED_AT });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(publishedPost as never);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...publishedPost,
          status: 'draft',
          publishedAt: null,
        } as never);

        const result = await unpublishPost('post-uuid-1');

        expect(result.status).toBe('draft');
        expect(result.publishedAt).toBeNull();
      });

      it('memanggil prisma.post.update dengan status "draft" dan publishedAt null', async () => {
        const publishedPost = buildPost({ status: 'published', publishedAt: PUBLISHED_AT });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(publishedPost as never);
        vi.mocked(prisma.post.update).mockResolvedValue({
          ...publishedPost,
          status: 'draft',
          publishedAt: null,
        } as never);

        await unpublishPost('post-uuid-1');

        const updateCall = vi.mocked(prisma.post.update).mock.calls[0][0];
        expect(updateCall.data.status).toBe('draft');
        expect(updateCall.data.publishedAt).toBeNull();
      });
    });

    describe('transisi invalid (Req 4.6)', () => {
      it('melempar error 409 STATUS_CONFLICT ketika post sudah draft (Req 4.6)', async () => {
        const draftPost = buildPost({ status: 'draft', publishedAt: null });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(draftPost as never);

        await expect(unpublishPost('post-uuid-1')).rejects.toMatchObject({
          status: 409,
          code: 'STATUS_CONFLICT',
          message: 'Post is already a draft',
        });

        expect(prisma.post.update).not.toHaveBeenCalled();
      });

      it('melempar error 404 NOT_FOUND ketika post tidak ada', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        await expect(unpublishPost('nonexistent-id')).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
        });
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // getPublishedPosts
  // Requirements: 5.1, 5.4
  // ══════════════════════════════════════════════════════════════════════

  describe('getPublishedPosts', () => {
    it('mengembalikan PaginatedResponse berisi hanya post berstatus published (Req 5.1)', async () => {
      const publishedPost = buildPost({ status: 'published', publishedAt: PUBLISHED_AT });

      vi.mocked(prisma.post.findMany).mockResolvedValue([publishedPost] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(1 as never);

      const result = await getPublishedPosts(1);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('published');
      expect(result.total).toBe(1);
    });

    it('query hanya mengambil post dengan status "published" (Req 5.1)', async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(0 as never);

      await getPublishedPosts(1);

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'published' },
          orderBy: { publishedAt: 'desc' },
        })
      );
    });

    it('mengembalikan paginasi yang benar (Req 5.4)', async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(25 as never);

      const result = await getPublishedPosts(2, 10);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
    });

    it('menggunakan default pageSize 10 ketika tidak diisi', async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(0 as never);

      const result = await getPublishedPosts(1);

      expect(result.pageSize).toBe(10);

      // Cek skip yang dikirim ke findMany
      const findCall = vi.mocked(prisma.post.findMany).mock.calls[0][0];
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(10);
    });

    it('mengembalikan excerpt dalam PostSummary (Req 5.1)', async () => {
      const longContent = 'A'.repeat(300);
      const postWithLongContent = buildPost({ content: longContent, status: 'published', publishedAt: PUBLISHED_AT });

      vi.mocked(prisma.post.findMany).mockResolvedValue([postWithLongContent] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(1 as never);

      const result = await getPublishedPosts(1);

      // excerpt adalah 200 karakter pertama
      expect(result.data[0].excerpt).toBe('A'.repeat(200));
    });

    it('setiap item menyertakan commentCount (Req 5.4)', async () => {
      const postWithComments = buildPost({
        status: 'published',
        publishedAt: PUBLISHED_AT,
      });

      vi.mocked(prisma.post.findMany).mockResolvedValue([postWithComments] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(1 as never);
      // groupBy mengembalikan 5 komentar untuk post ini
      vi.mocked(prisma.comment.groupBy).mockResolvedValue([
        { contentId: postWithComments.id, _count: { id: 5 } },
      ] as never);

      const result = await getPublishedPosts(1);

      expect(result.data[0].commentCount).toBe(5);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // getAllPosts (Admin)
  // Requirements: 4.5
  // ══════════════════════════════════════════════════════════════════════

  describe('getAllPosts', () => {
    it('mengembalikan semua post (draft + published) untuk admin (Req 4.5)', async () => {
      const draft = buildPost({ id: 'post-1', status: 'draft' });
      const published = buildPost({ id: 'post-2', status: 'published', publishedAt: PUBLISHED_AT });

      vi.mocked(prisma.post.findMany).mockResolvedValue([published, draft] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(2 as never);

      const result = await getAllPosts(1);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('query tidak memfilter berdasarkan status (Req 4.5)', async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(0 as never);

      await getAllPosts(1);

      const findCall = vi.mocked(prisma.post.findMany).mock.calls[0][0];
      // Tidak ada filter 'where' untuk status
      expect(findCall).not.toHaveProperty('where');
    });

    it('diurutkan berdasarkan updatedAt DESC (Req 4.5)', async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(0 as never);

      await getAllPosts(1);

      const findCall = vi.mocked(prisma.post.findMany).mock.calls[0][0];
      expect(findCall.orderBy).toEqual({ updatedAt: 'desc' });
    });

    it('menggunakan default pageSize 20 untuk admin', async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(0 as never);

      const result = await getAllPosts(1);

      expect(result.pageSize).toBe(20);
    });

    it('menghitung totalPages dengan benar', async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.post.count).mockResolvedValue(41 as never);

      const result = await getAllPosts(1);

      expect(result.totalPages).toBe(3); // ceil(41/20)
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // getPostBySlug
  // Requirements: 5.2, 5.3, 4.7
  // ══════════════════════════════════════════════════════════════════════

  describe('getPostBySlug', () => {
    describe('post published ditemukan (Req 5.2)', () => {
      it('mengembalikan post ketika slug ditemukan dan status published', async () => {
        const publishedPost = buildPost({
          status: 'published',
          publishedAt: PUBLISHED_AT,
        });
        vi.mocked(prisma.post.findUnique).mockResolvedValue(publishedPost as never);

        const result = await getPostBySlug('hello-world');

        expect(result.slug).toBe('hello-world');
        expect(result.status).toBe('published');
      });

      it('query menggunakan slug sebagai where clause (Req 5.2)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(buildPost({
          status: 'published',
          publishedAt: PUBLISHED_AT,
        }) as never);

        await getPostBySlug('hello-world');

        expect(prisma.post.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { slug: 'hello-world' },
          })
        );
      });

      it('mengembalikan contentHtml dari hasil render markdown (Req 5.3)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(buildPost({
          status: 'published',
          publishedAt: PUBLISHED_AT,
          content: '# Hello',
        }) as never);

        const result = await getPostBySlug('hello-world');

        expect(result.contentHtml).toBe('<p>rendered</p>');
      });
    });

    describe('post tidak ditemukan atau draft (Req 4.7, 5.3)', () => {
      it('melempar error 404 NOT_FOUND ketika slug tidak ada (Req 5.3)', async () => {
        vi.mocked(prisma.post.findUnique).mockResolvedValue(null);

        await expect(getPostBySlug('slug-tidak-ada')).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Post not found',
        });
      });

      it('melempar error 404 NOT_FOUND ketika post berstatus draft — tidak boleh mengungkap eksistensi draft (Req 4.7)', async () => {
        // Post ada tapi berstatus draft — visitor tidak boleh tahu post ini ada
        vi.mocked(prisma.post.findUnique).mockResolvedValue(buildPost({ status: 'draft' }) as never);

        await expect(getPostBySlug('hello-world')).rejects.toMatchObject({
          status: 404,
          code: 'NOT_FOUND',
          message: 'Post not found',
        });
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // searchPosts
  // Requirements: 5.5, 5.6, 5.7
  // ══════════════════════════════════════════════════════════════════════

  describe('searchPosts', () => {
    const buildRawPost = (overrides: Partial<{
      id: string;
      title: string;
      slug: string;
      content: string;
      status: string;
      published_at: Date | null;
      created_at: Date;
      updated_at: Date;
      comment_count: bigint;
      total_count: bigint;
    }> = {}) => ({
      id: 'post-uuid-1',
      title: 'Hello World',
      slug: 'hello-world',
      content: '# Hello\n\nWorld',
      status: 'published',
      published_at: PUBLISHED_AT,
      created_at: NOW,
      updated_at: NOW,
      comment_count: BigInt(2),
      total_count: BigInt(1),
      ...overrides,
    });

    it('mengembalikan PaginatedResponse berisi hasil pencarian (Req 5.5)', async () => {
      queryRawMock.mockResolvedValue([buildRawPost()]);

      const result = await searchPosts('hello', 1);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Hello World');
    });

    it('mengembalikan PaginatedResponse kosong ketika tidak ada hasil (Req 5.5)', async () => {
      queryRawMock.mockResolvedValue([]);

      const result = await searchPosts('tidakada', 1);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('setiap item mengandung excerpt 200 karakter pertama (Req 5.6)', async () => {
      const longContent = 'B'.repeat(300);
      queryRawMock.mockResolvedValue([buildRawPost({ content: longContent })]);

      const result = await searchPosts('hello', 1);

      expect(result.data[0].excerpt).toBe('B'.repeat(200));
    });

    it('setiap item mengandung commentCount dari query (Req 5.7)', async () => {
      queryRawMock.mockResolvedValue([buildRawPost({ comment_count: BigInt(7) })]);

      const result = await searchPosts('hello', 1);

      expect(result.data[0].commentCount).toBe(7);
    });

    it('mengonversi total_count BigInt ke number dengan benar (Req 5.5)', async () => {
      queryRawMock.mockResolvedValue([buildRawPost({ total_count: BigInt(42) })]);

      const result = await searchPosts('hello', 1);

      expect(result.total).toBe(42);
      expect(typeof result.total).toBe('number');
    });

    it('menghitung totalPages dengan benar berdasarkan total_count (Req 5.5)', async () => {
      const rows = Array.from({ length: 10 }, (_, i) =>
        buildRawPost({ id: `post-${i}`, total_count: BigInt(25) })
      );
      queryRawMock.mockResolvedValue(rows);

      const result = await searchPosts('hello', 1);

      expect(result.totalPages).toBe(3); // ceil(25/10)
      expect(result.pageSize).toBe(10);
    });

    it('mengembalikan contentHtml dari hasil render markdown (Req 5.6)', async () => {
      queryRawMock.mockResolvedValue([buildRawPost()]);

      const result = await searchPosts('hello', 1);

      expect(result.data[0].contentHtml).toBe('<p>rendered</p>');
    });

    it('paginasi menggunakan page yang benar', async () => {
      queryRawMock.mockResolvedValue([]);

      const result = await searchPosts('hello', 3);

      expect(result.page).toBe(3);
    });
  });
});
