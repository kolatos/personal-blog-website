/**
 * Component tests untuk ProjectCard
 * Task 17 — Stage 2 New Sections
 *
 * Skenario yang dicakup:
 *  1. Merender judul project
 *  2. Merender tech tags
 *  3. Merender link ke halaman detail project
 *  4. Merender link repo dan demo jika ada
 *  5. Merender placeholder jika tidak ada cover image
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectCard } from './ProjectCard';
import type { Project } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    title: 'Proyek Keren',
    slug: 'proyek-keren',
    description: 'Deskripsi proyek keren ini.',
    contentHtml: '<p>Deskripsi proyek keren ini.</p>',
    status: 'published',
    order: 0,
    techTags: [
      { id: 'tag-1', name: 'typescript', slug: 'typescript' },
      { id: 'tag-2', name: 'react', slug: 'react' },
    ],
    publishedAt: '2024-01-15T00:00:00.000Z',
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function renderCard(project: Project) {
  return render(
    <MemoryRouter>
      <ProjectCard project={project} />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectCard', () => {
  it('merender judul project', () => {
    renderCard(makeProject());
    expect(screen.getByText('Proyek Keren')).toBeInTheDocument();
  });

  it('merender semua tech tags', () => {
    renderCard(makeProject());
    const tags = screen.getAllByTestId('tag-chip');
    expect(tags).toHaveLength(2);
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
  });

  it('merender link ke halaman detail project dengan slug yang benar', () => {
    renderCard(makeProject());
    const link = screen.getByTestId('project-card-link');
    expect(link).toHaveAttribute('href', '/projects/proyek-keren');
  });

  it('merender link repo jika repoUrl ada', () => {
    renderCard(makeProject({ repoUrl: 'https://github.com/user/repo' }));
    const repoLink = screen.getByTestId('project-repo-link');
    expect(repoLink).toHaveAttribute('href', 'https://github.com/user/repo');
    expect(repoLink).toHaveAttribute('target', '_blank');
  });

  it('merender link demo jika demoUrl ada', () => {
    renderCard(makeProject({ demoUrl: 'https://demo.example.com' }));
    const demoLink = screen.getByTestId('project-demo-link');
    expect(demoLink).toHaveAttribute('href', 'https://demo.example.com');
    expect(demoLink).toHaveAttribute('target', '_blank');
  });

  it('tidak merender link repo jika repoUrl tidak ada', () => {
    renderCard(makeProject({ repoUrl: undefined }));
    expect(screen.queryByTestId('project-repo-link')).not.toBeInTheDocument();
  });

  it('tidak merender link demo jika demoUrl tidak ada', () => {
    renderCard(makeProject({ demoUrl: undefined }));
    expect(screen.queryByTestId('project-demo-link')).not.toBeInTheDocument();
  });

  it('tidak merender img jika coverImageUrl tidak ada', () => {
    renderCard(makeProject({ coverImageUrl: undefined }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('merender img cover jika coverImageUrl ada', () => {
    renderCard(makeProject({ coverImageUrl: 'https://example.com/cover.png' }));
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/cover.png');
  });

  it('tidak merender tags jika techTags kosong', () => {
    renderCard(makeProject({ techTags: [] }));
    expect(screen.queryByTestId('project-card-tags')).not.toBeInTheDocument();
  });
});
