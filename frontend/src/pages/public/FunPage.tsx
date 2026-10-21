import { useState, useRef } from 'react';
import type { FunPostType } from '../../types';
import { useFun } from '../../hooks/useFun';
import { FeedFilter } from '../../components/fun/FeedFilter';
import { FunFeed } from '../../components/fun/FunFeed';

/**
 * Halaman publik Fun — feed dengan filter type dan tag.
 *
 * Requirements: 4.8 (Stage 2)
 */
export default function FunPage() {
  const [page, setPage] = useState(1);
  const [activeType, setActiveType] = useState<FunPostType | null>(null);
  // For now, tag filter uses a single tag slug (first selected wins; future: multi)
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const topRef = useRef<HTMLDivElement>(null);

  // Use first tag only (API supports one tag at a time)
  const activeTag = activeTags[0] ?? undefined;

  const { data, isLoading, isError } = useFun(
    page,
    activeType ?? undefined,
    activeTag,
  );

  const posts = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  function handleTypeChange(type: FunPostType | null) {
    setActiveType(type);
    setPage(1);
  }

  function handleTagToggle(tagSlug: string) {
    setActiveTags((prev) => {
      if (prev.includes(tagSlug)) {
        return prev.filter((s) => s !== tagSlug);
      }
      // Single-tag filter for now
      return [tagSlug];
    });
    setPage(1);
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // Collect unique tags from current result + preserve known tags
  const availableTags = data?.data
    ? Array.from(
        new Map(
          data.data
            .flatMap((p) => p.tags)
            .map((t) => [t.id, t]),
        ).values(),
      )
    : [];

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10" ref={topRef}>
      {/* Page header */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Fun</h1>
        <p className="text-muted-foreground text-base max-w-xl mx-auto">
          Ulasan, gambar, musik, dan hal-hal menarik lainnya.
        </p>
      </header>

      {/* Filters */}
      <section
        aria-label="Filter postingan"
        className="mb-6 rounded-lg border border-border bg-card/50 p-4"
      >
        <FeedFilter
          activeType={activeType}
          activeTags={activeTags}
          availableTags={availableTags}
          onTypeChange={handleTypeChange}
          onTagToggle={handleTagToggle}
        />
      </section>

      {/* Feed */}
      <section aria-label="Daftar postingan">
        {isError ? (
          <p role="alert" className="text-destructive text-center py-12">
            Gagal memuat postingan. Silakan coba lagi.
          </p>
        ) : (
          <FunFeed
            posts={posts}
            isLoading={isLoading}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </section>
    </main>
  );
}
