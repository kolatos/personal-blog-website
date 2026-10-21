import { Link } from 'react-router-dom';
import type { Project } from '../../types';
import { TagChip } from '../shared/TagChip';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';

interface ProjectCardProps {
  project: Project;
}

/**
 * Strips markdown / HTML from a string, returning plain text.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ProjectCard({ project }: ProjectCardProps) {
  const rawDescription = stripMarkdown(project.description ?? '');
  const excerpt =
    rawDescription.length > 200 ? rawDescription.slice(0, 200) + '...' : rawDescription;

  return (
    <Card
      className="flex flex-col overflow-hidden hover:border-primary transition-colors"
      data-testid="project-card"
    >
      {/* Cover image or placeholder */}
      {project.coverImageUrl ? (
        <div className="aspect-video overflow-hidden bg-muted">
          <img
            src={project.coverImageUrl}
            alt={project.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
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
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
      )}

      <CardHeader className="pb-2">
        <Link
          to={`/projects/${project.slug}`}
          className="group"
          data-testid="project-card-link"
        >
          <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
            {project.title}
          </h2>
        </Link>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 flex-1">
        {/* Excerpt */}
        {excerpt && (
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
            {excerpt}
          </p>
        )}

        {/* Tech tags */}
        {project.techTags && project.techTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid="project-card-tags">
            {project.techTags.map((tag) => (
              <TagChip key={tag.id} name={tag.name} />
            ))}
          </div>
        )}

        {/* Repo / demo links — pushed to bottom */}
        <div className="flex items-center gap-2 mt-auto pt-2 flex-wrap">
          {project.repoUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              data-testid="project-repo-link"
            >
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Lihat kode sumber ${project.title}`}
              >
                {/* GitHub icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                Repo
              </a>
            </Button>
          )}
          {project.demoUrl && (
            <Button
              variant="default"
              size="sm"
              asChild
              data-testid="project-demo-link"
            >
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Lihat demo ${project.title}`}
              >
                {/* External link icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Demo
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { ProjectCard };
export type { ProjectCardProps };
