import { Link } from 'react-router-dom';
import type { FunPost } from '../../types';
import { TagChip } from '../shared/TagChip';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader } from '../ui/card';

interface FunCardProps {
  post: FunPost;
}

/** Maps type values to human-readable Indonesian labels. */
const TYPE_LABELS: Record<string, string> = {
  text: 'Tulisan',
  review: 'Ulasan',
  image: 'Gambar',
  drawing: 'Drawing',
  music: 'Musik',
  interactive: 'Interaktif',
};

function FunCard({ post }: FunCardProps) {
  const isMedia = post.type === 'image' || post.type === 'drawing';
  const isMusic = post.type === 'music';

  return (
    <Card
      className="flex flex-col overflow-hidden hover:border-primary transition-colors"
      data-testid="fun-card"
    >
      {/* Cover image — prominent for image/drawing types */}
      {isMedia && post.mediaUrl ? (
        <div className="aspect-video overflow-hidden bg-muted" data-testid="fun-card-media">
          <img
            src={post.mediaUrl}
            alt={post.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : isMedia ? (
        /* Placeholder for image/drawing without mediaUrl */
        <div
          className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-muted-foreground/40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      ) : null}

      <CardHeader className="pb-2">
        <div className="flex items-start gap-2 justify-between">
          <Link
            to={`/fun/${post.slug}`}
            className="group flex-1"
            data-testid="fun-card-link"
          >
            <h2 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
              {post.title}
            </h2>
          </Link>
          <Badge variant="outline" className="shrink-0 text-xs" data-testid="fun-card-type-badge">
            {TYPE_LABELS[post.type] ?? post.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 flex-1 pt-0">
        {/* Music: show media URL as link */}
        {isMusic && post.mediaUrl && (
          <a
            href={post.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2"
            data-testid="fun-card-music-link"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            Dengarkan
          </a>
        )}

        {/* text/review/interactive: show excerpt */}
        {!isMedia && !isMusic && post.excerpt && (
          <p
            className="text-muted-foreground text-sm leading-relaxed line-clamp-3"
            data-testid="fun-card-excerpt"
          >
            {post.excerpt}
          </p>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-1" data-testid="fun-card-tags">
            {post.tags.map((tag) => (
              <TagChip key={tag.id} name={tag.name} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { FunCard };
export type { FunCardProps };
