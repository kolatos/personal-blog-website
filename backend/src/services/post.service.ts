import slugify from 'slugify';
import { marked } from 'marked';
import prisma from '../lib/prisma.js';
import { mailService } from './mail.service.js';
import { getAllSubscriberEmails } from './subscription.service.js';
import type {
  CreatePostDto,
  UpdatePostDto,
  PaginatedResponse,
  Post,
  PostSummary,
  TagDto,
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

// ─── Tag helpers ─────────────────────────────────────────────────────────────

/**
 * Normalizes tag name to lowercase.
 * Requirements: 2.7
 */
export function normalizeTagName(name: string): string {
  return name.toLowerCase();
}

/**
 * Upserts tags by normalized name and connects them to a post.
 * Creates tags that don't exist yet (idempotent — safe to call multiple times
 * with the same name).
 *
 * Requirements: 2.2, 2.7 (Property 1: Tag Upsert Idempotency)
 */
export async function upsertTags(tagNames: string[]): Promise<{ id: string }[]> {
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

// ─── Raw post shape expected by mapPost / mapPostSummary ────────────────────

type RawPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  commentCount?: number;
  tags?: { tag: { name: string } }[];
};

// ─── Comment count helpers ─────────────────────────────────────────────────

/**
 * Returns the number of comments for a single post.
 */
async function getCommentCountForPost(postId: string): Promise<number> {
  return prisma.comment.count({
    where: { contentType: 'post', contentId: postId },
  });
}

/**
 * Returns a Map of postId → commentCount for a list of post IDs.
 * Uses a single aggregation query to avoid N+1.
 */
async function getCommentCountsForPosts(
  postIds: string[]
): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map();

  const counts = await prisma.comment.groupBy({
    by: ['contentId'],
    where: { contentType: 'post', contentId: { in: postIds } },
    _count: { id: true },
  });

  const map = new Map<string, number>();
  for (const row of counts) {
    map.set(row.contentId, row._count.id);
  }
  return map;
}

// ─── Map Prisma Post → Post interface ───────────────────────────────────────

async function mapPost(raw: RawPost): Promise<Post> {
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
    commentCount: raw.commentCount ?? 0,
    tags: raw.tags ? raw.tags.map((pt) => pt.tag.name) : [],
  };
}

async function mapPostSummary(raw: RawPost): Promise<PostSummary> {
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
    commentCount: raw.commentCount ?? 0,
    tags: raw.tags ? raw.tags.map((pt) => pt.tag.name) : [],
  };
}

// ─── Prisma include for tags ─────────────────────────────────────────────────

const tagsInclude = {
  tags: { include: { tag: { select: { name: true } } } },
} as const;

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
 * If tags are provided, they are upserted and connected via PostTag.
 *
 * Requirements: 3.1, 3.2, 3.5, 3.7, 2.2, 2.7
 */
export async function createPost(data: CreatePostDto): Promise<Post> {
  const { title, content, tags } = data;

  const slug = await generateUniqueSlug(title);

  // Upsert tags first so we have their IDs
  const tagRecords = tags && tags.length > 0 ? await upsertTags(tags) : [];

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      content,
      status: 'draft',
      tags: tagRecords.length > 0
        ? { create: tagRecords.map((t) => ({ tagId: t.id })) }
        : undefined,
    },
    include: {
      ...tagsInclude,
    },
  });

  return mapPost({ ...post, commentCount: 0 });
}

// ─── updatePost ──────────────────────────────────────────────────────────────

/**
 * Updates an existing Post. If the title changes, regenerates the slug.
 * If the post is currently Published, auto-reverts to Draft.
 * Tags are fully replaced (disconnect all → connect new list).
 *
 * Requirements: 3.3, 3.4, 3.5, 2.2, 2.7
 */
export async function updatePost(
  id: string,
  data: UpdatePostDto
): Promise<Post> {
  const existing = await prisma.post.findUnique({
    where: { id },
    include: {
      ...tagsInclude,
    },
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

  // Handle tags: full replace strategy
  let tagOps: object | undefined;
  if (data.tags !== undefined) {
    // Disconnect all existing tags first, then connect new ones
    const newTagRecords = data.tags.length > 0 ? await upsertTags(data.tags) : [];
    tagOps = {
      deleteMany: {},
      ...(newTagRecords.length > 0
        ? { create: newTagRecords.map((t) => ({ tagId: t.id })) }
        : {}),
    };
  }

  const updated = await prisma.post.update({
    where: { id },
    data: {
      ...updates,
      ...(tagOps !== undefined ? { tags: tagOps } : {}),
    },
    include: {
      ...tagsInclude,
    },
  });

  const commentCount = await getCommentCountForPost(updated.id);
  return mapPost({ ...updated, commentCount });
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

  // Hapus semua komentar yang terkait post ini (tidak ada FK cascade langsung
  // karena sistem komentar generik menggunakan contentType/contentId)
  await prisma.comment.deleteMany({
    where: { contentType: 'post', contentId: id },
  });

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
    include: {
      ...tagsInclude,
    },
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
    include: {
      ...tagsInclude,
    },
  });

  const commentCount = await getCommentCountForPost(updated.id);
  const mappedPost = await mapPost({ ...updated, commentCount });

  // Kirim notifikasi email ke semua subscriber.
  // Kegagalan email TIDAK menggagalkan publish — log error dan lanjutkan.
  // Requirements: 6.4, 6.6
  try {
    const emails = await getAllSubscriberEmails();
    await mailService.sendNewPostNotification(mappedPost, emails);
  } catch (emailErr) {
    console.error('[publishPost] Failed to send email notifications:', emailErr);
  }

  return mappedPost;
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
    include: {
      ...tagsInclude,
    },
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
    include: {
      ...tagsInclude,
    },
  });

  const commentCount = await getCommentCountForPost(updated.id);
  return mapPost({ ...updated, commentCount });
}

// ─── getPublishedPosts ────────────────────────────────────────────────────────

/**
 * Returns paginated Published posts ordered by published_at DESC.
 * Each item includes a comment count and tags.
 *
 * Requirements: 5.1, 5.4, 2.3
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
      include: {
        ...tagsInclude,
      },
    }),
    prisma.post.count({ where: { status: 'published' } }),
  ]);

  const postIds = posts.map((p) => p.id);
  const commentCountMap = await getCommentCountsForPosts(postIds);

  const data = await Promise.all(
    posts.map((p) => mapPostSummary({ ...p, commentCount: commentCountMap.get(p.id) ?? 0 }))
  );

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
      include: {
        ...tagsInclude,
      },
    }),
    prisma.post.count(),
  ]);

  const postIds = posts.map((p) => p.id);
  const commentCountMap = await getCommentCountsForPosts(postIds);

  const data = await Promise.all(
    posts.map((p) => mapPost({ ...p, commentCount: commentCountMap.get(p.id) ?? 0 }))
  );

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
 * Returns a single Published post by slug (includes tags).
 * Returns 404 if not found or if the post is a Draft.
 *
 * Requirements: 5.2, 5.3, 4.7, 2.3
 */
export async function getPostBySlug(slug: string): Promise<Post> {
  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      ...tagsInclude,
    },
  });

  // Return 404 for missing OR draft posts (Req 4.7: never reveal draft existence)
  if (!post || post.status !== 'published') {
    throw createError(404, 'NOT_FOUND', 'Post not found');
  }

  const commentCount = await getCommentCountForPost(post.id);
  return mapPost({ ...post, commentCount });
}

// ─── searchPosts ──────────────────────────────────────────────────────────────

/**
 * Full-text search over published posts using PostgreSQL `to_tsvector`.
 * Uses the 'indonesian' text search configuration to match the DB index.
 * Results are ordered by published_at DESC. Includes tags via separate query.
 *
 * Requirements: 5.5, 5.6, 5.7, 2.3
 */
export async function searchPosts(
  keyword: string,
  page: number
): Promise<PaginatedResponse<PostSummary>> {
  const skip = (page - 1) * SEARCH_PAGE_SIZE;

  // Use PostgreSQL full-text search via raw query for count + data
  type RawSearchPost = {
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

  const rows = await prisma.$queryRaw<RawSearchPost[]>`
    SELECT
      p.id,
      p.title,
      p.slug,
      p.content,
      p.status,
      p.published_at,
      p.created_at,
      p.updated_at,
      (SELECT COUNT(*) FROM comments c WHERE c.content_type = 'post' AND c.content_id = p.id) AS comment_count,
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

  // Fetch tags for the returned posts
  const postIds = rows.map((r) => r.id);
  const postTags = postIds.length > 0
    ? await prisma.postTag.findMany({
        where: { postId: { in: postIds } },
        include: { tag: { select: { name: true } } },
      })
    : [];

  // Build a map: postId → tag names
  const tagsByPostId = new Map<string, string[]>();
  for (const pt of postTags) {
    const existing = tagsByPostId.get(pt.postId) ?? [];
    existing.push(pt.tag.name);
    tagsByPostId.set(pt.postId, existing);
  }

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
        tags: tagsByPostId.get(row.id) ?? [],
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
 * Retrieves a post by its ID without status filtering (includes tags).
 * Used by admin endpoints (edit page prefill).
 *
 * Returns 404 if the post does not exist.
 *
 * Requirements: 3.3, 4.4
 */
export async function getPostById(id: string): Promise<Post> {
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      ...tagsInclude,
    },
  });

  if (!post) {
    throw createError(404, 'NOT_FOUND', 'Post not found');
  }

  const commentCount = await getCommentCountForPost(post.id);
  return mapPost({ ...post, commentCount });
}

// ─── getAllTags ──────────────────────────────────────────────────────────────

/**
 * Returns all tags sorted alphabetically.
 *
 * Requirements: 2.4
 */
export async function getAllTags(): Promise<TagDto[]> {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });
  return tags;
}
