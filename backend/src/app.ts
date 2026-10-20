import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRouter from './routes/auth.routes.js';
import postRouter from './routes/post.routes.js';
import { tagsRouter } from './routes/post.routes.js';
import legacyCommentRouter, { commentRouter } from './routes/comment.routes.js';
import userRouter from './routes/user.routes.js';
import subscriptionRouter from './routes/subscription.routes.js';
import adminRouter from './routes/admin.routes.js';

/**
 * Express application instance.
 *
 * Separating app setup from server startup allows the app to be imported
 * in tests without binding to a port.
 */
const app = express();

// --- Trust proxy --------------------------------------------------------------
// Diperlukan saat deploy di balik proxy/load balancer (Vercel, Nginx, dll)
// agar express-rate-limit bisa membaca X-Forwarded-For dengan benar.
app.set('trust proxy', 1);

// --- Security & body-parsing middleware --------------------------------------

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health check -------------------------------------------------------------

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API routes ---------------------------------------------------------------

/**
 * Auth routes — register, login, logout
 * Requirements: 1.x, 2.x
 */
app.use('/api/auth', authRouter);

/**
 * Post routes — CRUD for posts, publish/unpublish, search
 * Requirements: 3.x, 4.x, 5.x
 */
app.use('/api/posts', postRouter);

/**
 * Tags routes — public tag listing
 * Requirements: 2.4
 */
app.use('/api/tags', tagsRouter);

/**
 * Generic comment routes — GET/POST/DELETE untuk semua content type
 * Requirements: 6.x
 */
app.use('/api/comments', commentRouter);

/**
 * Legacy comment routes — nested di bawah posts untuk backward-compatibility
 * Express mergeParams diaktifkan pada legacyCommentRouter agar :postId tersedia.
 * Requirements: 6.x
 */
app.use('/api/posts/:postId/comments', legacyCommentRouter);

/**
 * User routes — profile management (username/password updates)
 * Requirements: 8.x
 */
app.use('/api/users', userRouter);

/**
 * Subscription routes — subscribe/unsubscribe/status untuk email notifikasi
 * Requirements: 6.1, 6.2, 6.3
 */
app.use('/api/subscriptions', subscriptionRouter);

/**
 * Admin routes — stats, user management, comment management
 * Requirements: 7.1, 7.3, 7.4, 7.6
 */
app.use('/api/admin', adminRouter);

// --- 404 handler --------------------------------------------------------------

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
  });
});

// --- Global error handler -----------------------------------------------------

/**
 * Catches errors thrown by route handlers and services.
 *
 * Services use createError() which attaches `status`, `code`, `message`,
 * and optionally `fields` to the Error object.
 *
 * Response shape (ErrorResponse):
 * {
 *   error: {
 *     code: string;
 *     message: string;
 *     fields?: Record<string, string>;
 *   }
 * }
 *
 * Requirements: 7.4 (access denied response), 7.7 (validation errors)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Log the full error for debugging (especially in production/Vercel)
  console.error('[Global Error Handler]', err);

  // Typed guard for errors produced by createError() in the service layer
  const appError = err as {
    status?: number;
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };

  const status = typeof appError.status === 'number' ? appError.status : 500;
  const code = appError.code ?? 'INTERNAL_ERROR';
  const message = appError.message ?? 'An unexpected error occurred';

  const body: {
    error: { code: string; message: string; fields?: Record<string, string> };
  } = {
    error: { code, message },
  };

  if (appError.fields) {
    body.error.fields = appError.fields;
  }

  res.status(status).json(body);
});

export default app;
