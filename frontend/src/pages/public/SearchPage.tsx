import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchPosts } from '../../api/posts';
import { PostList } from '../../components/blog/PostList';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Pre-fill input from URL ?q= param
  const initialQuery = searchParams.get('q') ?? '';

  const [inputValue, setInputValue] = useState(initialQuery);
  const [submittedKeyword, setSubmittedKeyword] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [validationError, setValidationError] = useState('');

  // If the URL param changes externally (e.g. back/forward navigation), sync state
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setInputValue(q);
    setSubmittedKeyword(q);
    setPage(1);
  }, [searchParams]);

  const isQueryEnabled = submittedKeyword.trim().length > 0;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['search', submittedKeyword, page],
    queryFn: () => searchPosts(submittedKeyword, page),
    enabled: isQueryEnabled,
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = inputValue.trim();

    if (!trimmed) {
      setValidationError('Kata kunci tidak boleh kosong.');
      return;
    }

    setValidationError('');
    setSubmittedKeyword(trimmed);
    setPage(1);
    setSearchParams({ q: trimmed });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const hasResults = data && data.data.length > 0;
  const hasNoResults = data && data.data.length === 0;

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Pencarian</h1>

      {/* Search form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2 mb-8">
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <Input
              id="search-input"
              type="search"
              placeholder="Cari artikel..."
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (validationError) setValidationError('');
              }}
              error={validationError}
              aria-label="Kata kunci pencarian"
              data-testid="search-input"
            />
          </div>
          <Button type="submit" variant="primary" size="md" className="shrink-0 mt-0">
            Cari
          </Button>
        </div>
      </form>

      {/* Results area */}
      {!isQueryEnabled && (
        <p className="text-muted-foreground text-center py-12">
          Masukkan kata kunci untuk mulai mencari artikel.
        </p>
      )}

      {isQueryEnabled && isLoading && (
        <div className="flex justify-center py-12">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"
            role="status"
            aria-label="Memuat hasil pencarian..."
          />
        </div>
      )}

      {isQueryEnabled && isError && (
        <p className="text-destructive text-center py-12" role="alert">
          Terjadi kesalahan saat mengambil hasil pencarian.
          {error instanceof Error && ` (${error.message})`}
        </p>
      )}

      {isQueryEnabled && hasNoResults && (
        <p className="text-muted-foreground text-center py-12" data-testid="no-results">
          Tidak ada hasil untuk &ldquo;{submittedKeyword}&rdquo;.
        </p>
      )}

      {isQueryEnabled && hasResults && (
        <PostList
          posts={data.data}
          currentPage={data.page}
          totalPages={data.totalPages}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      )}
    </main>
  );
}
