/**
 * Component tests untuk SkillsGrid
 * Task 15 — Stage 2 New Sections
 *
 * Skenario yang dicakup:
 *  1. Merender satu Badge per skill section
 *  2. Menampilkan title setiap skill
 *  3. Tidak merender apa-apa jika sections kosong
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillsGrid } from './SkillsGrid';
import type { AboutSection } from '../../types';

function makeSkill(overrides: Partial<AboutSection> = {}): AboutSection {
  return {
    id: Math.random().toString(),
    type: 'skill',
    title: 'Skill',
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('SkillsGrid', () => {
  it('merender satu Badge per skill', () => {
    const sections: AboutSection[] = [
      makeSkill({ id: '1', title: 'TypeScript' }),
      makeSkill({ id: '2', title: 'React' }),
      makeSkill({ id: '3', title: 'PostgreSQL' }),
    ];

    render(<SkillsGrid sections={sections} />);

    const badges = screen.getAllByTestId('skill-badge');
    expect(badges).toHaveLength(3);
  });

  it('menampilkan title setiap skill', () => {
    const sections: AboutSection[] = [
      makeSkill({ id: '1', title: 'TypeScript' }),
      makeSkill({ id: '2', title: 'Node.js' }),
    ];

    render(<SkillsGrid sections={sections} />);

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
  });

  it('tidak merender apa-apa jika sections kosong', () => {
    const { container } = render(<SkillsGrid sections={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('merender heading "Keahlian"', () => {
    const sections: AboutSection[] = [makeSkill({ title: 'Python' })];

    render(<SkillsGrid sections={sections} />);

    expect(screen.getByText('Keahlian')).toBeInTheDocument();
  });
});
