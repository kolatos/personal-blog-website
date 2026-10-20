export interface JwtPayload {
  sub: string; // user ID
  username: string;
  role: 'admin' | 'user';
  jti: string; // JWT ID for blacklist
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  token: string;
  expiresIn: number;
  user: UserProfile;
}

export interface RegisterDto {
  email: string;
  username: string;
  password: string;
}

export interface LoginDto {
  email?: string;
  username?: string;
  password: string;
}

export interface CreatePostDto {
  title: string;
  content: string;
  tags?: string[];
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
  tags?: string[];
}

export interface TagDto {
  id: string;
  name: string;
  slug: string;
}

/**
 * Full Post object returned by PostService (includes raw Markdown + rendered HTML).
 */
export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;        // raw Markdown
  contentHtml: string;    // rendered HTML
  status: 'draft' | 'published';
  publishedAt: string | null;
  updatedAt: string;
  commentCount: number;
  tags: string[];         // tag names
}

/**
 * Abbreviated Post for list/search responses (excerpt instead of full content).
 */
export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;        // first 200 chars of raw content
  contentHtml: string;    // rendered HTML (full, for preview use)
  status: 'draft' | 'published';
  publishedAt: string | null;
  updatedAt: string;
  commentCount: number;
  tags: string[];         // tag names
}

/**
 * Generic paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LockoutStatus {
  isLocked: boolean;
  lockedUntil?: Date;
  attemptCount: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}
