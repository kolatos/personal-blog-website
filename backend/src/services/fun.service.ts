import { marked } from 'marked';
import slugify from 'slugify';
import prisma from '../lib/prisma.js';
import { generateUniqueSlug as _generateUniqueSlug } from '../lib/slugUtils.js';
import type { CreateFunPostDto, UpdateFunPostDto } from '../schemas/fun.schema.js';
import type { PaginatedResponse } from '../types/index.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE_PUBLIC = 10;
const DEFAULT_PAGE_SIZE_ADMIN = 20;

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

// ─── Markdown helper ─────────────────────────────────────────────────────────

async function renderMarkdown(content: string): Promise<string> {
  return await marked(content);
}

// ─── Tag helpers ─────────────────────────────────────────────────────────────

function normalizeTagName(name: string): string {
  return name.toLowerCase();
}

/**
 * Upserts tags by normalized name and returns their IDs.
 */
async function upsertTags(tagNames: string[]): Promise<{ id: string }[]> {
  const normalized = tagNames.map(normalizeTagName).filter(Boolean);
  const unique = [...new Set(normalized)];

  const tags = await Promise.all(
    unique.map((name) => {
      const slug = slugify(name, { lower: true, strict: true, trim: true });
      return prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name, slug },
        select: { id: true },
      });
    })
  );

  return tags;
}

// ─── Slug generation ─────────────────────────────────────────────────────────

/**
 * Generates a unique slug for a FunPost, using the shared slugUtils utility.
 *
 * Requirements: 4.1 (Stage 2) — Property 2: Slug Uniqueness
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  return _generateUniqueSlug(
    title,
    async (slug) => {
      const existing = await prisma.funPost.findUnique({ where: { slug } });
      return existing !== null;
    },
    async (prefix) => {
      const conflicts = await prisma.funPost.findMany({
        where: { slug: { startsWith: prefix } },
        select: { slug: true },
      });
      return conflicts.map((c) => c.slug);
    }
  );
}

// ─── FunPost DTO ─────────────────────────────────────────────────────────────

export interface FunPostDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  contentHtml: string;
  status: 'draft' | 'published';
  type: string;
  mediaUrl: string | null;
  tags: Array<{ id: string; name: string; slug: string }>;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Prisma include for tags ─────────────────────────────────────────────────

const tagsInclude = {
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

// ─── Map Prisma FunPost → FunPostDto ─────────────────────────────────────────

type RawFunPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: string;
  type: string;
  mediaUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: { tag: { id: string; name: string; slug: string } }[];
};

async function mapFunPost(raw: RawFunPost): Promise<FunPostDto> {
  const contentHtml = await renderMarkdown(raw.content);
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    excerpt: raw.excerpt,
    content: raw.content,
    contentHtml,
    status: raw.status as 'draft' | 'published',
    type: raw.type,
    mediaUrl: raw.mediaUrl,
    tags: raw.tags ? raw.tags.map((ft) => ft.tag) : [],
    publishedAt: raw.publishedAt ? raw.publishedAt.toISOString() : null,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

// ─── createFunPost ────────────────────────────────────────────────────────────

/**
 * Membuat FunPost baru dalam status draft dengan slug auto-generated.
 * excerpt di-generate otomatis dari content.slice(0, 500) jika tidak disediakan.
 * Requirements: 4.1, 4.4 (Stage 2)
 */
export async function createFunPost(data: CreateFunPostDto): Promise<FunPostDto> {
  const { title, content, type, mediaUrl, tags } = data;

  const slug = await generateUniqueSlug(title);
  const excerpt = data.excerpt?.trim() || content.slice(0, 500);

  const tagRecords = tags && tags.length > 0 ? await upsertTags(tags) : [];

  const funPost = await prisma.funPost.create({
    data: {
      title,
      slug,
      content,
      excerpt,
      type,
      status: 'draft',
      mediaUrl: mediaUrl ?? null,
      tags:
        tagRecords.length > 0
          ? { create: tagRecords.map((t) => ({ tagId: t.id })) }
          : undefined,
    },
    include: { ...tagsInclude },
  });

  return mapFunPost(funPost);
}

// ─── updateFunPost ────────────────────────────────────────────────────────────

/**
 * Mengupdate FunPost yang ada. Jika title berubah, slug di-regenerasi.
 * Jika status `published`, otomatis revert ke `draft`.
 * Requirements: 4.4, 4.5 (Stage 2)
 */
export async function updateFunPost(
  id: string,
  data: UpdateFunPostDto
): Promise<FunPostDto> {
  const existing = await prisma.funPost.findUnique({
    where: { id },
    include: { ...tagsInclude },
  });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Fun post not found');
  }

  const updates: {
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string;
    type?: string;
    status?: string;
    publishedAt?: Date | null;
    mediaUrl?: string | null;
  } = {};

  if (data.title !== undefined && data.title !== existing.title) {
    updates.title = data.title;
    updates.slug = await generateUniqueSlug(data.title);
  }

  if (data.content !== undefined) updates.content = data.content;
  if (data.type !== undefined) updates.type = data.type;
  if (data.mediaUrl !== undefined) updates.mediaUrl = data.mediaUrl ?? null;

  if (data.excerpt !== undefined) {
    updates.excerpt = data.excerpt;
  } else if (data.content !== undefined) {
    // Re-generate excerpt from new content if excerpt not explicitly provided
    updates.excerpt = data.content.slice(0, 500);
  }

  // Auto-revert Published → Draft on any edit
  if (existing.status === 'published') {
    updates.status = 'draft';
    updates.publishedAt = null;
  }

  // Handle tags: full replace strategy
  let tagOps: object | undefined;
  if (data.tags !== undefined) {
    const newTagRecords = data.tags.length > 0 ? await upsertTags(data.tags) : [];
    tagOps = {
      deleteMany: {},
      ...(newTagRecords.length > 0
        ? { create: newTagRecords.map((t) => ({ tagId: t.id })) }
        : {}),
    };
  }

  const updated = await prisma.funPost.update({
    where: { id },
    data: {
      ...updates,
      ...(tagOps !== undefined ? { tags: tagOps } : {}),
    },
    include: { ...tagsInclude },
  });

  return mapFunPost(updated);
}

// ─── deleteFunPost ────────────────────────────────────────────────────────────

/**
 * Menghapus FunPost secara permanen beserta komentar terkait.
 * Requirements: 4.4 (Stage 2)
 */
export async function deleteFunPost(id: string): Promise<void> {
  const existing = await prisma.funPost.findUnique({ where: { id } });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Fun post not found');
  }

  // Hapus komentar terkait (sistem komentar generik, tidak ada FK cascade)
  await prisma.comment.deleteMany({
    where: { contentType: 'fun', contentId: id },
  });

  await prisma.funPost.delete({ where: { id } });
}

// ─── publishFunPost ───────────────────────────────────────────────────────────

/**
 * Transisi FunPost dari Draft → Published.
 * Mengembalikan 409 jika sudah Published.
 * Requirements: 4.5 (Stage 2)
 */
export async function publishFunPost(id: string): Promise<FunPostDto> {
  const existing = await prisma.funPost.findUnique({
    where: { id },
    include: { ...tagsInclude },
  });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Fun post not found');
  }

  if (existing.status === 'published') {
    throw createError(409, 'STATUS_CONFLICT', 'Fun post is already published');
  }

  const updated = await prisma.funPost.update({
    where: { id },
    data: { status: 'published', publishedAt: new Date() },
    include: { ...tagsInclude },
  });

  return mapFunPost(updated);
}

// ─── unpublishFunPost ─────────────────────────────────────────────────────────

/**
 * Transisi FunPost dari Published → Draft.
 * Mengembalikan 409 jika sudah Draft.
 * Requirements: 4.5 (Stage 2)
 */
export async function unpublishFunPost(id: string): Promise<FunPostDto> {
  const existing = await prisma.funPost.findUnique({
    where: { id },
    include: { ...tagsInclude },
  });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Fun post not found');
  }

  if (existing.status === 'draft') {
    throw createError(409, 'STATUS_CONFLICT', 'Fun post is already a draft');
  }

  const updated = await prisma.funPost.update({
    where: { id },
    data: { status: 'draft', publishedAt: null },
    include: { ...tagsInclude },
  });

  return mapFunPost(updated);
}

// ─── getFunPosts ──────────────────────────────────────────────────────────────

/**
 * Mengembalikan fun post published yang dipaginasi, diurutkan publishedAt DESC.
 * Mendukung filter opsional: type (satu nilai enum) dan tag (slug tag).
 * Kedua filter adalah kondisi AND.
 * Requirements: 4.2 (Stage 2) — Property 3: Fun feed filter correctness
 */
export async function getFunPosts(
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE_PUBLIC,
  type?: string,
  tag?: string
): Promise<PaginatedResponse<FunPostDto>> {
  const skip = (page - 1) * pageSize;

  // Build WHERE clause
  const where: {
    status: string;
    type?: string;
    tags?: { some: { tag: { slug: string } } };
  } = { status: 'published' };

  if (type) where.type = type;
  if (tag) where.tags = { some: { tag: { slug: tag } } };

  const [funPosts, total] = await Promise.all([
    prisma.funPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: pageSize,
      include: { ...tagsInclude },
    }),
    prisma.funPost.count({ where }),
  ]);

  const data = await Promise.all(funPosts.map((p) => mapFunPost(p)));

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── getFunPostBySlug ─────────────────────────────────────────────────────────

/**
 * Mengembalikan satu FunPost published berdasarkan slug.
 * Mengembalikan 404 jika draft atau tidak ditemukan.
 * Property 1: Content Draft Isolation
 * Requirements: 4.3 (Stage 2)
 */
export async function getFunPostBySlug(slug: string): Promise<FunPostDto> {
  const funPost = await prisma.funPost.findUnique({
    where: { slug },
    include: { ...tagsInclude },
  });

  if (!funPost || funPost.status !== 'published') {
    throw createError(404, 'NOT_FOUND', 'Fun post not found');
  }

  return mapFunPost(funPost);
}

// ─── getFunPostById ───────────────────────────────────────────────────────────

/**
 * Mengembalikan FunPost berdasarkan ID (tanpa filter status — untuk admin edit).
 * Requirements: 4.4 (Stage 2)
 */
export async function getFunPostById(id: string): Promise<FunPostDto> {
  const funPost = await prisma.funPost.findUnique({
    where: { id },
    include: { ...tagsInclude },
  });

  if (!funPost) {
    throw createError(404, 'NOT_FOUND', 'Fun post not found');
  }

  return mapFunPost(funPost);
}

// ─── getAllFunPosts ───────────────────────────────────────────────────────────

/**
 * Mengembalikan semua fun post (draft + published) untuk dashboard admin.
 * Diurutkan berdasarkan updatedAt DESC, 20/halaman.
 * Requirements: 4.4 (Stage 2)
 */
export async function getAllFunPosts(
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE_ADMIN
): Promise<PaginatedResponse<FunPostDto>> {
  const skip = (page - 1) * pageSize;

  const [funPosts, total] = await Promise.all([
    prisma.funPost.findMany({
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: { ...tagsInclude },
    }),
    prisma.funPost.count(),
  ]);

  const data = await Promise.all(funPosts.map((p) => mapFunPost(p)));

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export { DEFAULT_PAGE_SIZE_PUBLIC, DEFAULT_PAGE_SIZE_ADMIN };
