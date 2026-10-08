import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRouter from './routes/auth.routes.js';
import postRouter from './routes/post.routes.js';
import commentRouter from './routes/comment.routes.js';
import userRouter from './routes/user.routes.js';

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
 * Comment routes — nested under posts
 * Express mergeParams is enabled on the comment router so that :postId
 * from this parent path is available inside handlers.
 * Requirements: 6.x
 */
app.use('/api/posts/:postId/comments', commentRouter);

/**
 * User routes — profile management (username/password updates)
 * Requirements: 8.x
 */
app.use('/api/users', userRouter);

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
