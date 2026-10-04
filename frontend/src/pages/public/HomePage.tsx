import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosts } from '../../hooks/usePosts';
import { PostList } from '../../components/blog/PostList';

/**
 * Public home page.
 *
 * Displays:
 * - A search bar that navigates to /search?q={keyword}
 * - A paginated list of published posts (10 per page, publishedAt DESC)
 *
 * Satisfies Requirements 5.1 and 5.4.
 */
export default function HomePage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = usePosts(page);

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    // Scroll back to the top of the post list
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleSearch() {
    const keyword = searchInput.trim();
    if (keyword.length === 0) return;
    navigate(`/search?q=${encodeURIComponent(keyword)}`);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }

  const posts = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-10" ref={topRef}>
      {/* Blog heading */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Blog</h1>
        <p className="text-muted-foreground text-base">
          Kumpulan tulisan dan catatan pribadi.
        </p>
      </header>

      {/* Search bar */}
      <section aria-label="Pencarian postingan" className="mb-10">
        <div className="flex gap-2">
          <input
            id="homepage-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Cari postingan…"
            aria-label="Kata kunci pencarian"
            data-testid="homepage-search-input"
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-base text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSearch}
            aria-label="Cari"
            data-testid="homepage-search-btn"
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            Cari
          </button>
        </div>
      </section>

      {/* Post list */}
      <section aria-label="Daftar postingan">
        {isError ? (
          <p role="alert" className="text-destructive text-center py-12">
            Gagal memuat postingan. Silakan coba lagi.
          </p>
        ) : (
          <PostList
            posts={posts}
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
