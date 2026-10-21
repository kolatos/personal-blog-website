import { useState, useRef } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { ProjectList } from '../../components/projects/ProjectList';

/**
 * Halaman daftar project publik.
 * Grid responsif: 1 kolom (mobile), 2 kolom (tablet), 3 kolom (desktop).
 */
export default function ProjectsPage() {
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useProjects(page);

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  const projects = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10" ref={topRef}>
      {/* Page header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
          Projects
        </h1>
        <p className="text-muted-foreground text-base max-w-xl mx-auto">
          Kumpulan project yang pernah dibuat — dari eksperimen kecil sampai proyek serius.
        </p>
      </header>

      {/* Project grid */}
      <section aria-label="Daftar project">
        {isError ? (
          <p role="alert" className="text-destructive text-center py-12">
            Gagal memuat project. Silakan coba lagi.
          </p>
        ) : (
          <ProjectList
            projects={projects}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        )}
      </section>
    </main>
  );
}
