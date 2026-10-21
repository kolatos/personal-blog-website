import type { Project } from '../../types';
import { ProjectCard } from './ProjectCard';
import { Pagination } from '../ui/pagination';
import { Skeleton } from '../ui/skeleton';

interface ProjectListProps {
  projects: Project[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

function ProjectListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <Skeleton className="aspect-video w-full rounded-md" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectList({
  projects,
  currentPage,
  totalPages,
  onPageChange,
  isLoading = false,
}: ProjectListProps) {
  if (isLoading) {
    return <ProjectListSkeleton />;
  }

  if (projects.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground" data-testid="empty-projects">
        Belum ada project yang dipublikasikan.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="projects-grid"
      >
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

export { ProjectList };
export type { ProjectListProps };
