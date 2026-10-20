import { Badge } from '../ui/badge';

interface TagChipProps {
  name: string;
  className?: string;
}

/**
 * Display-only tag badge using shadcn Badge.
 */
function TagChip({ name, className }: TagChipProps) {
  return (
    <Badge variant="secondary" className={className} data-testid="tag-chip">
      {name}
    </Badge>
  );
}

export { TagChip };
export type { TagChipProps };
