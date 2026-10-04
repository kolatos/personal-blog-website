import slugify from 'slugify';
import { marked } from 'marked';
import prisma from '../lib/prisma.js';
import type {
  CreatePostDto,
  UpdatePostDto,
  PaginatedResponse,
  Post,
  PostSummary,
} from '../types/index.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE_PUBLIC = 10;
const DEFAULT_PAGE_SIZE_ADMIN = 20;
const SEARCH_PAGE_SIZE = 10;

// ─── Error helpers ──────────────────────────────────────────────────────────

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

// ─── Markdown helper ────────────────────────────────────────────────────────

async function renderMarkdown(content: string): Promise<string> {
  return await marked(content);
}

// ─── Map Prisma Post → Post interface ───────────────────────────────────────

async function mapPost(
  raw: {
    id: string;
    title: string;
    slug: string;
    content: string;
    status: string;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { comments: number };
  }
): Promise<Post> {
  const contentHtml = await renderMarkdown(raw.content);
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    content: raw.content,
    contentHtml,
    status: raw.status as 'draft' | 'published',
    publishedAt: raw.publishedAt ? raw.publishedAt.toISOString() : null,
    updatedAt: raw.updatedAt.toISOString(),
    commentCount: raw._count?.comments ?? 0,
  };
}

async function mapPostSummary(
  raw: {
    id: string;
    title: string;
    slug: string;
    content: string;
    status: string;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { comments: number };
  }
): Promise<PostSummary> {
  const contentHtml = await renderMarkdown(raw.content);
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    excerpt: raw.content.slice(0, 200),
    contentHtml,
    status: raw.status as 'draft' | 'published',
    publishedAt: raw.publishedAt ? raw.publishedAt.toISOString() : null,
    updatedAt: raw.updatedAt.toISOString(),
    commentCount: raw._count?.comments ?? 0,
  };
}

// ─── Slug generation ─────────────────────────────────────────────────────────

/**
 * Generates a URL-safe slug from the title using `slugify`, then ensures
 * uniqueness by appending a numeric suffix (-2, -3, …) if a collision exists.
 *
 * Requirements: 3.1, 3.2
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title, { lower: true, strict: true, trim: true });

  // Check if the base slug already exists
  const existing = await prisma.post.findUnique({ where: { slug: base } });
  if (!existing) {
    return base;
  }

  // Find the highest existing numeric suffix for this base slug
  const conflicts = await prisma.post.findMany({
    where: {
      slug: {
        startsWith: `${base}-`,
      },
    },
    select: { slug: true },
  });

  // Extract numeric suffixes and find the maximum
  let maxSuffix = 1;
  for (const { slug } of conflicts) {
    const suffix = slug.slice(base.length + 1);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > maxSuffix) {
      maxSuffix = num;
    }
  }

  return `${base}-${maxSuffix + 1}`;
}

// ─── createPost ──────────────────────────────────────────────────────────────

/**
 * Creates a new Post in Draft status with a unique auto-generated slug.
 *
 * Requirements: 3.1, 3.2, 3.5, 3.7
 */
export async function createPost(data: CreatePostDto): Promise<Post> {
  const { title, content } = data;

  const slug = await generateUniqueSlug(title);

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      content,
      status: 'draft',
    },
    include: { _count: { select: { comments: true } } },
  });

  return mapPost(post);
}

// ─── updatePost ──────────────────────────────────────────────────────────────

/**
 * Updates an existing Post. If the title changes, regenerates the slug.
 * If the post is currently Published, auto-reverts to Draft.
 *
 * Requirements: 3.3, 3.4, 3.5
 */
export async function updatePost(
  id: string,
  data: UpdatePostDto
): Promise<Post> {
  const existing = await prisma.post.findUnique({
    where: { id },
    include: { _count: { select: { comments: true } } },
  });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Post not found');
  }

  const updates: {
    title?: string;
    slug?: string;
    content?: string;
    status?: string;
    publishedAt?: Date | null;
    updatedAt?: Date;
  } = {};

  // Update title and regenerate slug if title changed
  if (data.title !== undefined && data.title !== existing.title) {
    updates.title = data.title;
    updates.slug = await generateUniqueSlug(data.title);
  }

  if (data.content !== undefined) {
    updates.content = data.content;
  }

  // Auto-revert Published → Draft on any edit (Req 3.4)
  if (existing.status === 'published') {
    updates.status = 'draft';
    updates.publishedAt = null;
  }

  const updated = await prisma.post.update({
    where: { id },
    data: updates,
    include: { _count: { select: { comments: true } } },
  });

  return mapPost(updated);
}

// ─── deletePost ──────────────────────────────────────────────────────────────

/**
 * Permanently deletes a Post. Associated comments are removed via ON DELETE
 * CASCADE in the database schema.
 *
 * Requirements: 4.3, 4.8
 */
export async function deletePost(id: string): Promise<void> {
  const existing = await prisma.post.findUnique({ where: { id } });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Post not found');
  }

  await prisma.post.delete({ where: { id } });
}

// ─── publishPost ─────────────────────────────────────────────────────────────

/**
 * Transitions a Post from Draft → Published, recording published_at timestamp.
 * Returns 409 if the post is already Published.
 *
 * Requirements: 4.1, 4.6
 */
export async function publishPost(id: string): Promise<Post> {
  const existing = await prisma.post.findUnique({
    where: { id },
    include: { _count: { select: { comments: true } } },
  });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Post not found');
  }

  if (existing.status === 'published') {
    throw createError(
      409,
      'STATUS_CONFLICT',
      'Post is already published'
    );
  }

  const updated = await prisma.post.update({
    where: { id },
    data: {
      status: 'published',
      publishedAt: new Date(),
    },
    include: { _count: { select: { comments: true } } },
  });

  return mapPost(updated);
}

// ─── unpublishPost ───────────────────────────────────────────────────────────

/**
 * Transitions a Post from Published → Draft.
 * Returns 409 if the post is already Draft.
 *
 * Requirements: 4.2, 4.6
 */
export async function unpublishPost(id: string): Promise<Post> {
  const existing = await prisma.post.findUnique({
    where: { id },
    include: { _count: { select: { comments: true } } },
  });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Post not found');
  }

  if (existing.status === 'draft') {
    throw createError(
      409,
      'STATUS_CONFLICT',
      'Post is already a draft'
    );
  }

  const updated = await prisma.post.update({
    where: { id },
    data: {
      status: 'draft',
      publishedAt: null,
    },
    include: { _count: { select: { comments: true } } },
  });

  return mapPost(updated);
}

// ─── getPublishedPosts ────────────────────────────────────────────────────────

/**
 * Returns paginated Published posts ordered by published_at DESC.
 * Each item includes a comment count.
 *
 * Requirements: 5.1, 5.4
 */
export async function getPublishedPosts(
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE_PUBLIC
): Promise<PaginatedResponse<PostSummary>> {
  const skip = (page - 1) * pageSize;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: pageSize,
      include: { _count: { select: { comments: true } } },
    }),
    prisma.post.count({ where: { status: 'published' } }),
  ]);

  const data = await Promise.all(posts.map(mapPostSummary));

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── getAllPosts ──────────────────────────────────────────────────────────────

/**
 * Returns all posts (Draft + Published) for the Admin dashboard,
 * ordered by updated_at DESC, 20 per page.
 *
 * Requirements: 4.5
 */
export async function getAllPosts(
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE_ADMIN
): Promise<PaginatedResponse<Post>> {
  const skip = (page - 1) * pageSize;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: { _count: { select: { comments: true } } },
    }),
    prisma.post.count(),
  ]);

  const data = await Promise.all(posts.map(mapPost));

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── getPostBySlug ────────────────────────────────────────────────────────────

/**
 * Returns a single Published post by slug.
 * Returns 404 if not found or if the post is a Draft.
 *
 * Requirements: 5.2, 5.3, 4.7
 */
export async function getPostBySlug(slug: string): Promise<Post> {
  const post = await prisma.post.findUnique({
    where: { slug },
    include: { _count: { select: { comments: true } } },
  });

  // Return 404 for missing OR draft posts (Req 4.7: never reveal draft existence)
  if (!post || post.status !== 'published') {
    throw createError(404, 'NOT_FOUND', 'Post not found');
  }

  return mapPost(post);
}

// ─── searchPosts ──────────────────────────────────────────────────────────────

/**
 * Full-text search over published posts using PostgreSQL `to_tsvector`.
 * Uses the 'indonesian' text search configuration to match the DB index.
 * Results are ordered by published_at DESC.
 *
 * Requirements: 5.5, 5.6, 5.7
 */
export async function searchPosts(
  keyword: string,
  page: number
): Promise<PaginatedResponse<PostSummary>> {
  const skip = (page - 1) * SEARCH_PAGE_SIZE;

  // Use PostgreSQL full-text search via raw query for count + data
  type RawPost = {
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
  };

  const rows = await prisma.$queryRaw<RawPost[]>`
    SELECT
      p.id,
      p.title,
      p.slug,
      p.content,
      p.status,
      p.published_at,
      p.created_at,
      p.updated_at,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      COUNT(*) OVER () AS total_count
    FROM posts p
    WHERE
      p.status = 'published'
      AND to_tsvector('indonesian', p.title || ' ' || p.content) @@ plainto_tsquery('indonesian', ${keyword})
    ORDER BY p.published_at DESC
    LIMIT ${SEARCH_PAGE_SIZE}
    OFFSET ${skip}
  `;

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  const data = await Promise.all(
    rows.map(async (row) => {
      const contentHtml = await renderMarkdown(row.content);
      const summary: PostSummary = {
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.content.slice(0, 200),
        contentHtml,
        status: row.status as 'draft' | 'published',
        publishedAt: row.published_at ? row.published_at.toISOString() : null,
        updatedAt: row.updated_at.toISOString(),
        commentCount: Number(row.comment_count),
      };
      return summary;
    })
  );

  return {
    data,
    total,
    page,
    pageSize: SEARCH_PAGE_SIZE,
    totalPages: Math.ceil(total / SEARCH_PAGE_SIZE),
  };
}

// Re-export pageSize constants for use in controller/route defaults
export { DEFAULT_PAGE_SIZE_PUBLIC, DEFAULT_PAGE_SIZE_ADMIN };

// ─── getPostById ──────────────────────────────────────────────────────────────

/**
 * Retrieves a post by its ID without status filtering.
 * Used by admin endpoints (edit page prefill).
 *
 * Returns 404 if the post does not exist.
 *
 * Requirements: 3.3, 4.4
 */
export async function getPostById(id: string): Promise<Post> {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { _count: { select: { comments: true } } },
  });

  if (!post) {
    throw createError(404, 'NOT_FOUND', 'Post not found');
  }

  return mapPost(post);
}

