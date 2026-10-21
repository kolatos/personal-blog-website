import { Badge } from '../ui/badge';
import type { AboutSection } from '../../types';

interface SkillsGridProps {
  sections: AboutSection[];
}

/**
 * Renders a wrapping flex grid of skill badge chips.
 * One Badge is rendered per skill section entry.
 */
export function SkillsGrid({ sections }: SkillsGridProps) {
  if (sections.length === 0) return null;

  return (
    <section aria-labelledby="skills-heading" className="mb-10">
      <h2 id="skills-heading" className="text-2xl font-semibold text-foreground mb-6">
        Keahlian
      </h2>

      <div className="flex flex-wrap gap-2" data-testid="skills-grid">
        {sections.map((section) => (
          <Badge
            key={section.id}
            variant="secondary"
            className="px-3 py-1 text-sm"
            data-testid="skill-badge"
          >
            {section.title}
          </Badge>
        ))}
      </div>
    </section>
  );
}
