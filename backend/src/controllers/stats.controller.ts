import type { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';

// ─── Error helper ─────────────────────────────────────────────────────────────

function createError(
  status: number,
  code: string,
  message: string,
): Error & { status: number; code: string } {
  const err = new Error(message) as Error & { status: number; code: string };
  err.status = status;
  err.code = code;
  return err;
}

// ─── GET /api/admin/stats ──────────────────────────────────────────────────────

/**
 * Mengembalikan statistik dashboard admin:
 * - totalPosts, totalComments, totalUsers
 * - recentPosts[5], recentComments[5], recentUsers[5]
 *
 * Requirements: 7.1
 */
export async function getStats(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const [
      totalPosts,
      totalComments,
      totalUsers,
      totalProjects,
      totalFunPosts,
      recentPosts,
      recentComments,
      recentUsers,
    ] = await Promise.all([
      prisma.post.count(),
      prisma.comment.count(),
      prisma.user.count(),
      prisma.project.count(),
      prisma.funPost.count(),
      prisma.post.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          publishedAt: true,
          updatedAt: true,
        },
      }),
      prisma.comment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          content: true,
          contentType: true,
          contentId: true,
          createdAt: true,
          author: {
            select: { username: true },
          },
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    // Fetch content titles for recent comments
    const commentTitles = await resolveContentTitles(recentComments);

    res.json({
      totalPosts,
      totalComments,
      totalUsers,
      totalProjects,
      totalFunPosts,
      recentPosts: recentPosts.map((p) => ({
        ...p,
        publishedAt: p.publishedAt?.toISOString() ?? null,
        updatedAt: p.updatedAt.toISOString(),
      })),
      recentComments: recentComments.map((c) => ({
        id: c.id,
        content: c.content,
        authorUsername: c.author.username,
        contentType: c.contentType,
        contentId: c.contentId,
        contentTitle: commentTitles.get(c.contentId) ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      recentUsers: recentUsers.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/admin/users ──────────────────────────────────────────────────────

/**
 * Mengembalikan daftar semua pengguna yang dipaginasi beserta jumlah komentar.
 *
 * Requirements: 7.3
 */
export async function getUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const pageRaw = (req.query.page as string | undefined) ?? '1';
    const pageSizeRaw = (req.query.pageSize as string | undefined) ?? '20';
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const pageSize = Math.max(1, parseInt(pageSizeRaw, 10) || 20);
    const skip = (page - 1) * pageSize;

    const [total, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { comments: true } },
        },
      }),
    ]);

    res.json({
      data: users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        commentCount: u._count.comments,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/admin/users/:id ──────────────────────────────────────────────

/**
 * Menghapus pengguna secara permanen beserta seluruh komentarnya (cascade via FK).
 * Tidak dapat menghapus diri sendiri.
 *
 * Requirements: 7.4
 */
export async function deleteUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;

    // Cegah admin menghapus dirinya sendiri
    if (req.user!.sub === id) {
      throw createError(400, 'CANNOT_DELETE_SELF', 'Admin cannot delete their own account');
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw createError(404, 'USER_NOT_FOUND', 'User not found');
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/admin/comments ──────────────────────────────────────────────────

/**
 * Mengembalikan semua komentar yang dipaginasi di semua content type.
 * Mendukung filter opsional `?contentType=`.
 *
 * Requirements: 7.6
 */
export async function getComments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const pageRaw = (req.query.page as string | undefined) ?? '1';
    const pageSizeRaw = (req.query.pageSize as string | undefined) ?? '20';
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const pageSize = Math.max(1, parseInt(pageSizeRaw, 10) || 20);
    const skip = (page - 1) * pageSize;

    const contentTypeFilter =
      typeof req.query.contentType === 'string' && req.query.contentType
        ? req.query.contentType
        : undefined;

    const where = contentTypeFilter
      ? { contentType: contentTypeFilter }
      : undefined;

    const [total, comments] = await Promise.all([
      prisma.comment.count({ where }),
      prisma.comment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          contentType: true,
          contentId: true,
          parentId: true,
          createdAt: true,
          author: { select: { username: true } },
        },
      }),
    ]);

    // Fetch content titles for comments
    const contentTitles = await resolveContentTitles(comments);

    res.json({
      data: comments.map((c) => ({
        id: c.id,
        content: c.content,
        authorUsername: c.author.username,
        contentType: c.contentType,
        contentId: c.contentId,
        contentTitle: contentTitles.get(c.contentId) ?? null,
        parentId: c.parentId,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve content titles for a list of comment-like objects.
 * Mendukung contentType = 'post', 'project', dan 'fun'.
 * Stage 3 dapat memperluas ini dengan modules.
 */
async function resolveContentTitles(
  items: { contentType: string; contentId: string }[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  const postIds = items
    .filter((c) => c.contentType === 'post')
    .map((c) => c.contentId);

  const projectIds = items
    .filter((c) => c.contentType === 'project')
    .map((c) => c.contentId);

  const funIds = items
    .filter((c) => c.contentType === 'fun')
    .map((c) => c.contentId);

  const uniquePostIds = [...new Set(postIds)];
  const uniqueProjectIds = [...new Set(projectIds)];
  const uniqueFunIds = [...new Set(funIds)];

  const [posts, projects, funPosts] = await Promise.all([
    uniquePostIds.length > 0
      ? prisma.post.findMany({
          where: { id: { in: uniquePostIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    uniqueProjectIds.length > 0
      ? prisma.project.findMany({
          where: { id: { in: uniqueProjectIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    uniqueFunIds.length > 0
      ? prisma.funPost.findMany({
          where: { id: { in: uniqueFunIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  for (const p of posts) result.set(p.id, p.title);
  for (const p of projects) result.set(p.id, p.title);
  for (const f of funPosts) result.set(f.id, f.title);

  return result;
}
