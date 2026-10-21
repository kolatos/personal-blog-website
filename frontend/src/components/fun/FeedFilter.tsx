import type { FunPostType, TagSummary } from '../../types';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface FeedFilterProps {
  activeType: FunPostType | null;
  activeTags: string[]; // tag slugs
  availableTags?: TagSummary[];
  onTypeChange: (type: FunPostType | null) => void;
  onTagToggle: (tagSlug: string) => void;
}

const FUN_POST_TYPES: { value: FunPostType; label: string }[] = [
  { value: 'text', label: 'Tulisan' },
  { value: 'review', label: 'Ulasan' },
  { value: 'image', label: 'Gambar' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'music', label: 'Musik' },
  { value: 'interactive', label: 'Interaktif' },
];

function FeedFilter({
  activeType,
  activeTags,
  availableTags = [],
  onTypeChange,
  onTagToggle,
}: FeedFilterProps) {
  function handleTypeChange(value: string) {
    if (!value || value === activeType) {
      // Deselect current
      onTypeChange(null);
    } else {
      onTypeChange(value as FunPostType);
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="feed-filter">
      {/* Type filter — shadcn ToggleGroup */}
      <div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
          Tipe
        </span>
        <ToggleGroup
          type="single"
          value={activeType ?? ''}
          onValueChange={handleTypeChange}
          className="flex flex-wrap justify-start gap-1"
          data-testid="type-filter-group"
        >
          {FUN_POST_TYPES.map((t) => (
            <ToggleGroupItem
              key={t.value}
              value={t.value}
              size="sm"
              variant="outline"
              aria-label={`Filter by ${t.label}`}
              data-testid={`type-filter-${t.value}`}
            >
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Tag filter chips */}
      {availableTags.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Tag
          </span>
          <div className="flex flex-wrap gap-1.5" data-testid="tag-filter-chips">
            {availableTags.map((tag) => {
              const isActive = activeTags.includes(tag.slug);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onTagToggle(tag.slug)}
                  data-testid={`tag-filter-${tag.slug}`}
                  aria-pressed={isActive}
                >
                  <Badge
                    variant={isActive ? 'default' : 'secondary'}
                    className="cursor-pointer transition-colors hover:opacity-80"
                  >
                    {tag.name}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear filters button — shows when any filter is active */}
      {(activeType || activeTags.length > 0) && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onTypeChange(null);
              activeTags.forEach((slug) => onTagToggle(slug));
            }}
            data-testid="clear-filters-button"
          >
            Hapus filter
          </Button>
        </div>
      )}
    </div>
  );
}

export { FeedFilter };
export type { FeedFilterProps };
