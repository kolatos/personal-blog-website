import { Link } from 'react-router-dom';
import { useAbout } from '../../hooks/useAbout';
import { TimelineSection } from '../../components/about/TimelineSection';
import { SkillsGrid } from '../../components/about/SkillsGrid';
import { ContactList } from '../../components/about/ContactList';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import type { AboutSection } from '../../types';

export default function AboutPage() {
  const { data: sections, isLoading, isError } = useAbout();

  // Group sections by type
  const grouped = (sections ?? []).reduce<Record<string, AboutSection[]>>(
    (acc, section) => {
      if (!acc[section.type]) acc[section.type] = [];
      acc[section.type].push(section);
      return acc;
    },
    {},
  );

  const education = grouped['education'] ?? [];
  const experience = grouped['experience'] ?? [];
  const skills = grouped['skill'] ?? [];
  const contacts = grouped['contact'] ?? [];

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Back button */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/" data-testid="back-to-home">
            ← Kembali
          </Link>
        </Button>
      </div>

      <h1 className="text-4xl font-bold text-foreground mb-8">Tentang</h1>

      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-8 w-40 mt-8" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      )}

      {isError && (
        <p className="text-destructive text-sm">
          Gagal memuat data. Silakan coba lagi.
        </p>
      )}

      {!isLoading && !isError && (
        <>
          <TimelineSection title="Pengalaman" sections={experience} />
          <TimelineSection title="Pendidikan" sections={education} />
          <SkillsGrid sections={skills} />
          <ContactList sections={contacts} />
        </>
      )}
    </main>
  );
}