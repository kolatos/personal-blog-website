import { Badge } from '../ui/badge';

interface StatusBadgeProps {
  status: 'draft' | 'published';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const label = status === 'published' ? 'Published' : 'Draft';

  return <Badge variant={status}>{label}</Badge>;
}

export { StatusBadge };
export type { StatusBadgeProps };
