import { Card, CardContent } from '../ui/card';
import type { AboutSection } from '../../types';

interface TimelineSectionProps {
  title: string;
  sections: AboutSection[];
}

function formatDateRange(startDate?: string, endDate?: string | null): string {
  if (!startDate) return '';

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(iso));

  const start = fmt(startDate);
  const end = endDate ? fmt(endDate) : 'Sekarang';
  return `${start} – ${end}`;
}

/**
 * Renders a vertical timeline for education or experience sections.
 * Entries are sorted by startDate DESC (newest first) before rendering.
 */
export function TimelineSection({ title, sections }: TimelineSectionProps) {
  // Sort by startDate DESC (newest first)
  const sorted = [...sections].sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  if (sorted.length === 0) return null;

  return (
    <section aria-labelledby={`timeline-${title.toLowerCase()}-heading`} className="mb-10">
      <h2
        id={`timeline-${title.toLowerCase()}-heading`}
        className="text-2xl font-semibold text-foreground mb-6"
      >
        {title}
      </h2>

      <div className="relative">
        {/* Vertical connector line */}
        <div
          className="absolute left-4 top-2 bottom-2 w-0.5 bg-border"
          aria-hidden="true"
        />

        <ol className="space-y-4" data-testid="timeline-list">
          {sorted.map((section) => (
            <li key={section.id} className="relative pl-12">
              {/* Timeline dot */}
              <div
                className="absolute left-2.5 top-5 h-3 w-3 rounded-full bg-primary border-2 border-background"
                aria-hidden="true"
              />

              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold text-foreground text-base">
                      {section.title}
                    </h3>

                    {section.subtitle && (
                      <p className="text-sm font-medium text-primary">
                        {section.subtitle}
                      </p>
                    )}

                    {section.startDate && (
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(section.startDate, section.endDate)}
                      </p>
                    )}

                    {section.description && (
                      <p className="mt-2 text-sm text-foreground leading-relaxed">
                        {section.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
