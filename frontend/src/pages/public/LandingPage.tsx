/**
 * Halaman landing publik (/).
 * Menampilkan teaser dari semua seksi utama website.
 * Semua fetch data berjalan paralel via React Query.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { PostCard } from '../../components/blog/PostCard';
import { ProjectCard } from '../../components/projects/ProjectCard';
import { FunCard } from '../../components/fun/FunCard';
import { getPublishedPosts } from '../../api/posts';
import { getPublishedProjects } from '../../api/projects';
import { getPublishedFunPosts } from '../../api/fun';
import { getAboutSections } from '../../api/about';
import type { AboutSection } from '../../types';

// ── About teaser card ─────────────────────────────────────────────────────────

function AboutTeaserCard({ section }: { section: AboutSection }) {
  return (
    <Card className="flex-1 min-w-0" data-testid="about-teaser-card">
      <CardHeader className="pb-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          {section.type === 'experience' ? 'Pengalaman' : 'Keahlian'}
        </p>
        <h3 className="font-semibold text-foreground leading-tight line-clamp-1">
          {section.title}
        </h3>
      </CardHeader>
      <CardContent className="pt-0">
        {section.subtitle && (
          <p className="text-sm text-muted-foreground line-clamp-1">{section.subtitle}</p>
        )}
        {section.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {section.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  viewAllHref: string;
  viewAllLabel?: string;
  children: React.ReactNode;
}

function SectionHeader({ title, viewAllHref, viewAllLabel = 'Lihat semua →' }: Omit<SectionProps, 'children'>) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      <Link
        to={viewAllHref}
        className="text-sm text-primary hover:underline underline-offset-4"
      >
        {viewAllLabel}
      </Link>
    </div>
  );
}

// ── LandingPage ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  // Semua fetch berjalan paralel via React Query
  const { data: aboutData } = useQuery({
    queryKey: ['about-sections'],
    queryFn: getAboutSections,
  });

  const { data: postsData } = useQuery({
    queryKey: ['posts', 1, 3],
    queryFn: () => getPublishedPosts(1, 3),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 1, 3],
    queryFn: () => getPublishedProjects(1, 3),
  });

  const { data: funData } = useQuery({
    queryKey: ['fun', 1, null, null, 3],
    queryFn: () => getPublishedFunPosts(1, 3),
  });

  // Filter about sections ke experience/skill, ambil 3 pertama
  const aboutTeasers = (aboutData ?? [])
    .filter((s) => s.type === 'experience' || s.type === 'skill')
    .slice(0, 3);

  const recentPosts = postsData?.data ?? [];
  const featuredProjects = projectsData?.data ?? [];
  const funHighlights = funData?.data ?? [];

  return (
    <main>
      {/* ── Hero section (statis) ── */}
      <section
        aria-labelledby="hero-heading"
        className="bg-gradient-to-b from-background to-muted/30 py-20 px-4"
        data-testid="hero-section"
      >
        <div className="container mx-auto max-w-3xl text-center">
          <h1
            id="hero-heading"
            className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl mb-4"
          >
            Kirodico
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Tempat berbagi tulisan, proyek, dan eksplorasi. Selamat datang di sudut digital saya.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/blog">Baca Blog</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/about">Tentang Saya</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 space-y-16">
        {/* ── About teaser ── */}
        {aboutTeasers.length > 0 && (
          <section aria-labelledby="about-teaser-heading" data-testid="about-teaser-section">
            <SectionHeader
              title="Tentang Saya"
              viewAllHref="/about"
              viewAllLabel="Lihat profil lengkap →"
            />
            <div className="flex flex-col sm:flex-row gap-4">
              {aboutTeasers.map((section) => (
                <AboutTeaserCard key={section.id} section={section} />
              ))}
            </div>
          </section>
        )}

        {/* ── Recent posts ── */}
        {recentPosts.length > 0 && (
          <section aria-labelledby="recent-posts-heading" data-testid="recent-posts-section">
            <SectionHeader title="Tulisan Terbaru" viewAllHref="/blog" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}

        {/* ── Featured projects ── */}
        {featuredProjects.length > 0 && (
          <section aria-labelledby="featured-projects-heading" data-testid="featured-projects-section">
            <SectionHeader title="Proyek Terpilih" viewAllHref="/projects" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </section>
        )}

        {/* ── Fun highlights ── */}
        {funHighlights.length > 0 && (
          <section aria-labelledby="fun-highlights-heading" data-testid="fun-highlights-section">
            <SectionHeader title="Hal Menarik" viewAllHref="/fun" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {funHighlights.map((post) => (
                <FunCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}

        {/* ── Learning CTA (statis) ── */}
        <section aria-labelledby="learning-cta-heading" data-testid="learning-cta-section">
          <Card className="border-dashed border-2">
            <CardContent className="py-10 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <h2
                  id="learning-cta-heading"
                  className="text-2xl font-bold text-foreground"
                >
                  Platform Belajar
                </h2>
                <Badge variant="secondary">Coming soon</Badge>
              </div>
              <p className="text-muted-foreground max-w-md mx-auto">
                Modul belajar interaktif untuk matematika dan pemrograman. Dengan visualisasi
                langsung, kode yang bisa dijalankan, dan sistem spaced repetition untuk flashcard.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
