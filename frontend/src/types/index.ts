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
