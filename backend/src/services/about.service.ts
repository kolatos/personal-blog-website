import prisma from '../lib/prisma.js';
import type {
  CreateAboutSectionDto,
  UpdateAboutSectionDto,
  ReorderAboutSectionsDto,
} from '../schemas/about.schema.js';

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

// ─── AboutSection DTO ────────────────────────────────────────────────────────

export interface AboutSectionDto {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  order: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Map Prisma record → DTO ─────────────────────────────────────────────────

function mapSection(raw: {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  order: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AboutSectionDto {
  return {
    id: raw.id,
    type: raw.type,
    title: raw.title,
    subtitle: raw.subtitle,
    description: raw.description,
    startDate: raw.startDate ? raw.startDate.toISOString() : null,
    endDate: raw.endDate ? raw.endDate.toISOString() : null,
    order: raw.order,
    metadata: raw.metadata as Record<string, unknown> | null,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

// ─── getAllSections ───────────────────────────────────────────────────────────

/**
 * Mengembalikan semua AboutSection diurutkan berdasarkan type lalu order.
 * Requirements: 2.1, 2.5
 */
export async function getAllSections(): Promise<AboutSectionDto[]> {
  const sections = await prisma.aboutSection.findMany({
    orderBy: [{ type: 'asc' }, { order: 'asc' }],
  });
  return sections.map(mapSection);
}

// ─── createSection ───────────────────────────────────────────────────────────

/**
 * Membuat AboutSection baru.
 * Requirements: 2.2
 */
export async function createSection(
  data: CreateAboutSectionDto
): Promise<AboutSectionDto> {
  const section = await prisma.aboutSection.create({
    data: {
      type: data.type,
      title: data.title,
      subtitle: data.subtitle ?? null,
      description: data.description ?? null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      order: data.order ?? 0,
      metadata: data.metadata !== undefined ? (data.metadata as object) : undefined,
    },
  });
  return mapSection(section);
}

// ─── updateSection ───────────────────────────────────────────────────────────

/**
 * Mengupdate AboutSection yang ada.
 * Melempar 404 jika tidak ditemukan.
 * Requirements: 2.3
 */
export async function updateSection(
  id: string,
  data: UpdateAboutSectionDto
): Promise<AboutSectionDto> {
  const existing = await prisma.aboutSection.findUnique({ where: { id } });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'About section not found');
  }

  const updated = await prisma.aboutSection.update({
    where: { id },
    data: {
      ...(data.type !== undefined && { type: data.type }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.startDate !== undefined && {
        startDate: data.startDate ? new Date(data.startDate) : null,
      }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? new Date(data.endDate) : null,
      }),
      ...(data.order !== undefined && { order: data.order }),
      ...(data.metadata !== undefined && { metadata: data.metadata as object }),
    },
  });

  return mapSection(updated);
}

// ─── deleteSection ───────────────────────────────────────────────────────────

/**
 * Menghapus AboutSection secara permanen.
 * Melempar 404 jika tidak ditemukan.
 * Requirements: 2.4
 */
export async function deleteSection(id: string): Promise<void> {
  const existing = await prisma.aboutSection.findUnique({ where: { id } });

  if (!existing) {
    throw createError(404, 'NOT_FOUND', 'About section not found');
  }

  await prisma.aboutSection.delete({ where: { id } });
}

// ─── reorderSections ─────────────────────────────────────────────────────────

/**
 * Memperbarui field `order` untuk beberapa AboutSection sekaligus dalam
 * satu transaksi Prisma (all-or-nothing).
 *
 * Jika satu pun `id` tidak ditemukan, seluruh transaksi di-rollback dan
 * tidak ada perubahan yang tersimpan.
 *
 * Property 4: Reorder Transaction Atomicity
 * Requirements: 2.6
 */
export async function reorderSections(
  data: ReorderAboutSectionsDto
): Promise<AboutSectionDto[]> {
  const { items } = data;

  // Verifikasi semua id ada sebelum memulai transaksi
  const ids = items.map((i) => i.id);
  const existing = await prisma.aboutSection.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });

  if (existing.length !== ids.length) {
    const foundIds = new Set(existing.map((s) => s.id));
    const missingIds = ids.filter((id) => !foundIds.has(id));
    throw createError(
      404,
      'NOT_FOUND',
      `About section(s) not found: ${missingIds.join(', ')}`
    );
  }

  // Jalankan semua update dalam satu transaksi Prisma
  await prisma.$transaction(
    items.map((item) =>
      prisma.aboutSection.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    )
  );

  // Kembalikan semua seksi yang diperbarui dengan urutan baru
  return getAllSections();
}
