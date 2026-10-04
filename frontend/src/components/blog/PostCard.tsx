import { Link } from 'react-router-dom';
import type { Post } from '../../types';

interface PostCardProps {
  post: Post;
}

/**
 * Strips markdown and HTML tags from a string, returning plain text.
 */
function stripMarkdown(text: string): string {
  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove markdown headings
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // Remove blockquote markers
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats a date string using Indonesian locale.
 * e.g., "14 Januari 2025"
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function PostCard({ post }: PostCardProps) {
  // List endpoint provides `excerpt` (plain text, first 200 chars).
  // Fall back to stripping `content` if somehow only the full post is passed.
  const rawExcerpt = post.excerpt ?? (post.content ? stripMarkdown(post.content) : '');
  const summary = rawExcerpt.length > 200 ? rawExcerpt.slice(0, 200) + '...' : rawExcerpt;
  const publishedDate = formatDate(post.publishedAt);

  return (
    <article
      className="bg-card border border-border rounded-lg p-6 hover:bg-muted transition-colors"
      data-testid="post-card"
    >
      <Link to={`/posts/${post.slug}`} className="group block" data-testid="post-card-link">
        <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
          {post.title}
        </h2>
      </Link>

      {summary && (
        <p className="text-muted-foreground text-sm leading-relaxed mb-4">{summary}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {publishedDate && (
          <time dateTime={post.publishedAt ?? undefined} className="flex items-center gap-1">
            {/* Calendar icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {publishedDate}
          </time>
        )}

        <span className="flex items-center gap-1">
          {/* Comment icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>
            {post.commentCount}{' '}
            {post.commentCount === 1 ? 'komentar' : 'komentar'}
          </span>
        </span>
      </div>
    </article>
  );
}

export { PostCard };
export type { PostCardProps };
