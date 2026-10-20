interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Builds the list of page items to display.
 * Always shows first and last page; shows up to 2 pages around the current page.
 * Inserts '...' gaps where pages are skipped.
 */
function buildPageItems(current: number, total: number): (number | '...')[] {
  const delta = 2; // pages to show around current
  const range: number[] = [];

  const rangeStart = Math.max(2, current - delta);
  const rangeEnd = Math.min(total - 1, current + delta);

  for (let i = rangeStart; i <= rangeEnd; i++) {
    range.push(i);
  }

  const items: (number | '...')[] = [1];

  if (rangeStart > 2) {
    items.push('...');
  }

  items.push(...range);

  if (rangeEnd < total - 1) {
    items.push('...');
  }

  if (total > 1) {
    items.push(total);
  }

  return items;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const items = buildPageItems(currentPage, totalPages);

  const baseBtn =
    'inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border border-border px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const activeBtn = 'bg-primary text-primary-foreground border-primary font-semibold';
  const defaultBtn = 'bg-background text-foreground hover:bg-muted';
  const disabledBtn = 'opacity-50 pointer-events-none';

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
      {/* Previous */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Go to previous page"
        className={[baseBtn, defaultBtn, currentPage <= 1 ? disabledBtn : ''].filter(Boolean).join(' ')}
      >
        ‹
      </button>

      {/* Page numbers */}
      {items.map((item, idx) =>
        item === '...' ? (
          <span
            key={`ellipsis-${idx}`}
            aria-hidden="true"
            className="inline-flex h-9 min-w-[2.25rem] items-center justify-center text-sm text-muted-foreground"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            aria-label={`Go to page ${item}`}
            aria-current={item === currentPage ? 'page' : undefined}
            className={[baseBtn, item === currentPage ? activeBtn : defaultBtn].join(' ')}
          >
            {item}
          </button>
        ),
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Go to next page"
        className={[
          baseBtn,
          defaultBtn,
          currentPage >= totalPages ? disabledBtn : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        ›
      </button>
    </nav>
  );
}

export { Pagination };
export type { PaginationProps };
