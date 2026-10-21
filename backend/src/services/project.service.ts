import { marked } from 'marked';
import slugify from 'slugify';
import prisma from '../lib/prisma.js';
import { generateUniqueSlug as _generateUniqueSlug } from '../lib/slugUtils.js';
import type { CreateProjectDto, UpdateProjectDto } from '../schemas/project.schema.js';
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
 * Shared logic identical to post.service upsertTags.
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
 * Generates a unique slug for a Project, using the shared slugUtils utility.
 *
 * Requirements: 3.2 (Stage 2) — Property 2: Slug Uniqueness
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  return _generateUniqueSlug(
    title,
    async (slug) => {
      const existing = await prisma.project.findUnique({ where: { slug } });
      return existing !== null;
    },
    async (prefix) => {
      const conflicts = await prisma.project.findMany({
        where: { slug: { startsWith: prefix } },
        select: { slug: true },
      });
      return conflicts.map((c) => c.slug);
    }
  );
}

// ─── Project DTO types ───────────────────────────────────────────────────────

export interface ProjectDto {
  id: string;
  title: string;
  slug: string;
  description: string;
  contentHtml: string;
  status: 'draft' | 'published';
  repoUrl: string | null;
  demoUrl: string | null;
  coverImageUrl: string | null;
  order: number;
  techTags: string[];
  publishedAt: string | null;
  updatedAt: string;
}

// ─── Prisma include for techTags ─────────────────────────────────────────────

const techTagsInclude = {
  techTags: { include: { tag: { select: { name: true } } } },
} as const;

// ─── Map Prisma Project → ProjectDto ────────────────────────────────────────

type RawProject = {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  repoUrl: string | null;
  demoUrl: string | null;
  coverImageUrl: string | null;
  order: number;
  publishedAt: Date | null;
  updatedAt: Date;
  techTags?: { tag: { name: string } }[];
};

async function mapProject(raw: RawProject): Promise<ProjectDto> {
  const contentHtml = await renderMarkdown(raw.description);
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    description: raw.description,
    contentHtml,
    status: raw.status as 'draft' | 'published',
    repoUrl: raw.repoUrl,
    demoUrl: raw.demoUrl,
    coverImageUrl: raw.coverImageUrl,
    order: raw.order,
    techTags: raw.techTags ? raw.techTags.map((pt) => pt.tag.name) : [],
    publishedAt: raw.publishedAt ? raw.publishedAt.toISOString() : null,
    updatedAt: raw.updatedAt.toISOString(),
  };
}

// ─── createProject ────────────────────────────────────────────────────────────

/**
 * Membuat Project baru dalam status draft dengan slug auto-generated.
 * Requirements: 3.1, 3.2, 3.5 (Stage 2)
 */
export async function createProject(data: CreateProjectDto): Promise<ProjectDto> {
  const { title, description, repoUrl, demoUrl, coverImageUrl, order, techTags } = data;

  const slug = await generateUniqueSlug(title);

  const tagRecords =
    techTags && techTags.length > 0 ? await upsertTags(techTags) : [];

  const project = await prisma.project.create({
    data: {
      title,
      slug,
      description,
      status: 'draft',
      repoUrl: repoUrl ?? null,
      demoUrl: demoUrl ?? null,
      coverImageUrl: coverImageUrl ?? null,
      order: order ?? 0,
      techTags:
        tagRecords.length > 0
          ? { create: tagRecords.map((t) => ({ tagId: t.id })) }
          : undefined,
    },
    include: { ...techTagsInclude },
  });

  return mapProject(project);
}

// ─── updateProject ────────────────────────────────────────────────────────────

/**
 * Mengupdate Project yang ada. Jika title berubah, slug di-regenerasi.
 * Jika status `published`, otomatis revert ke `draft`.
 * Requirements: 3.3, 3.4 (Stage 2)
 */
export async function updateProject(
  id: string,
  data: UpdateProjectDto
): Promise<ProjectDto> {
  const existing = await prisma.project.findUnique({
    where: { id },
    include: { ...techTagsInclude },
  });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Project not found');
  }

  const updates: {
    title?: string;
    slug?: string;
    description?: string;
    status?: string;
    publishedAt?: Date | null;
    repoUrl?: string | null;
    demoUrl?: string | null;
    coverImageUrl?: string | null;
    order?: number;
  } = {};

  if (data.title !== undefined && data.title !== existing.title) {
    updates.title = data.title;
    updates.slug = await generateUniqueSlug(data.title);
  }

  if (data.description !== undefined) updates.description = data.description;
  if (data.repoUrl !== undefined) updates.repoUrl = data.repoUrl ?? null;
  if (data.demoUrl !== undefined) updates.demoUrl = data.demoUrl ?? null;
  if (data.coverImageUrl !== undefined) updates.coverImageUrl = data.coverImageUrl ?? null;
  if (data.order !== undefined) updates.order = data.order;

  // Auto-revert Published → Draft on any edit
  if (existing.status === 'published') {
    updates.status = 'draft';
    updates.publishedAt = null;
  }

  // Handle tags: full replace strategy
  let tagOps: object | undefined;
  if (data.techTags !== undefined) {
    const newTagRecords =
      data.techTags.length > 0 ? await upsertTags(data.techTags) : [];
    tagOps = {
      deleteMany: {},
      ...(newTagRecords.length > 0
        ? { create: newTagRecords.map((t) => ({ tagId: t.id })) }
        : {}),
    };
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...updates,
      ...(tagOps !== undefined ? { techTags: tagOps } : {}),
    },
    include: { ...techTagsInclude },
  });

  return mapProject(updated);
}

// ─── deleteProject ────────────────────────────────────────────────────────────

/**
 * Menghapus Project secara permanen beserta komentar terkait.
 * Requirements: 3.5 (Stage 2)
 */
export async function deleteProject(id: string): Promise<void> {
  const existing = await prisma.project.findUnique({ where: { id } });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Project not found');
  }

  // Hapus komentar terkait (sistem komentar generik, tidak ada FK cascade)
  await prisma.comment.deleteMany({
    where: { contentType: 'project', contentId: id },
  });

  await prisma.project.delete({ where: { id } });
}

// ─── publishProject ───────────────────────────────────────────────────────────

/**
 * Transisi Project dari Draft → Published.
 * Mengembalikan 409 jika sudah Published.
 * Requirements: 3.6 (Stage 2)
 */
export async function publishProject(id: string): Promise<ProjectDto> {
  const existing = await prisma.project.findUnique({
    where: { id },
    include: { ...techTagsInclude },
  });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Project not found');
  }

  if (existing.status === 'published') {
    throw createError(409, 'STATUS_CONFLICT', 'Project is already published');
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { status: 'published', publishedAt: new Date() },
    include: { ...techTagsInclude },
  });

  return mapProject(updated);
}

// ─── unpublishProject ─────────────────────────────────────────────────────────

/**
 * Transisi Project dari Published → Draft.
 * Mengembalikan 409 jika sudah Draft.
 * Requirements: 3.6 (Stage 2)
 */
export async function unpublishProject(id: string): Promise<ProjectDto> {
  const existing = await prisma.project.findUnique({
    where: { id },
    include: { ...techTagsInclude },
  });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'Project not found');
  }

  if (existing.status === 'draft') {
    throw createError(409, 'STATUS_CONFLICT', 'Project is already a draft');
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { status: 'draft', publishedAt: null },
    include: { ...techTagsInclude },
  });

  return mapProject(updated);
}

// ─── getPublishedProjects ─────────────────────────────────────────────────────

/**
 * Mengembalikan project published yang dipaginasi, diurutkan order ASC, createdAt DESC.
 * Draft mengembalikan 404 kepada pengunjung.
 * Requirements: 3.3 (Stage 2)
 */
export async function getPublishedProjects(
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE_PUBLIC
): Promise<PaginatedResponse<ProjectDto>> {
  const skip = (page - 1) * pageSize;

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: { status: 'published' },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: pageSize,
      include: { ...techTagsInclude },
    }),
    prisma.project.count({ where: { status: 'published' } }),
  ]);

  const data = await Promise.all(projects.map((p) => mapProject(p)));

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── getProjectBySlug ─────────────────────────────────────────────────────────

/**
 * Mengembalikan satu Project published berdasarkan slug.
 * Mengembalikan 404 jika draft atau tidak ditemukan.
 * Property 1: Content Draft Isolation
 * Requirements: 3.3, 3.4 (Stage 2)
 */
export async function getProjectBySlug(slug: string): Promise<ProjectDto> {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { ...techTagsInclude },
  });

  if (!project || project.status !== 'published') {
    throw createError(404, 'NOT_FOUND', 'Project not found');
  }

  return mapProject(project);
}

// ─── getProjectById ──────────────────────────────────────────────────────────

/**
 * Mengembalikan Project berdasarkan ID (tanpa filter status — untuk admin edit).
 * Requirements: 3.5 (Stage 2)
 */
export async function getProjectById(id: string): Promise<ProjectDto> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { ...techTagsInclude },
  });

  if (!project) {
    throw createError(404, 'NOT_FOUND', 'Project not found');
  }

  return mapProject(project);
}

// ─── getAllProjects ───────────────────────────────────────────────────────────

/**
 * Mengembalikan semua project (draft + published) untuk dashboard admin.
 * Diurutkan berdasarkan updatedAt DESC, 20/halaman.
 * Requirements: 3.5 (Stage 2)
 */
export async function getAllProjects(
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE_ADMIN
): Promise<PaginatedResponse<ProjectDto>> {
  const skip = (page - 1) * pageSize;

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: { ...techTagsInclude },
    }),
    prisma.project.count(),
  ]);

  const data = await Promise.all(projects.map((p) => mapProject(p)));

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export { DEFAULT_PAGE_SIZE_PUBLIC, DEFAULT_PAGE_SIZE_ADMIN };
