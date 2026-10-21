export interface TagSummary {
  id: string;
  name: string;
  slug: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content?: string;       // present on detail endpoint only
  excerpt?: string;       // present on list/search endpoints only (first 200 chars)
  contentHtml: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  updatedAt: string;
  commentCount: number;
  tags: TagSummary[];
}

export type PostSummary = Post;

export interface Comment {
  id: string;
  contentType: string;
  contentId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  parentId: string | null;
  replies: Comment[];
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  joinedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

// ── Project ───────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  contentHtml: string;
  status: 'draft' | 'published';
  repoUrl?: string;
  demoUrl?: string;
  coverImageUrl?: string;
  order: number;
  techTags: TagSummary[];
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── About ─────────────────────────────────────────────────────────────────────

export type AboutSectionType = 'education' | 'experience' | 'skill' | 'contact';

export interface AboutSection {
  id: string;
  type: AboutSectionType;
  title: string;
  subtitle?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  order: number;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// ── Fun ───────────────────────────────────────────────────────────────────────

export type FunPostType = 'text' | 'review' | 'image' | 'drawing' | 'music' | 'interactive';

export interface FunPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  contentHtml: string;
  status: 'draft' | 'published';
  type: FunPostType;
  mediaUrl?: string | null;
  tags: TagSummary[];
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
