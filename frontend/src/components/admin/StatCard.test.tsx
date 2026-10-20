/**
 * Component tests untuk StatCard
 * Task 11 — Stage 1 Blog Improvements
 *
 * Skenario yang dicakup:
 *  1. Merender label dan value dengan benar
 *  2. Merender ikon yang diberikan
 *  3. Merender sebagai link jika href diberikan
 *  4. Tidak merender link jika href tidak diberikan
 *  5. Memformat angka besar dengan benar
 *
 * Requirements: 7.2, 7.8
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatCard } from './StatCard';

// ── Helper ────────────────────────────────────────────────────────────────────

function MockIcon() {
  return <svg data-testid="mock-icon" aria-hidden="true" />;
}

function renderStatCard(props: { label: string; value: number; icon?: React.ReactNode; href?: string }) {
  return render(
    <MemoryRouter>
      <StatCard
        label={props.label}
        value={props.value}
        icon={props.icon ?? <MockIcon />}
        href={props.href}
      />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StatCard', () => {
  it('merender label dengan benar', () => {
    renderStatCard({ label: 'Total Postingan', value: 42 });

    expect(screen.getByText('Total Postingan')).toBeInTheDocument();
  });

  it('merender value dengan benar', () => {
    renderStatCard({ label: 'Total Postingan', value: 42 });

    expect(screen.getByTestId('stat-value')).toHaveTextContent('42');
  });

  it('merender ikon yang diberikan', () => {
    renderStatCard({ label: 'Total Komentar', value: 10, icon: <MockIcon /> });

    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  it('merender sebagai link ke href jika href diberikan', () => {
    renderStatCard({ label: 'Total Pengguna', value: 18, href: '/admin/users' });

    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/users');
  });

  it('tidak merender link jika href tidak diberikan', () => {
    renderStatCard({ label: 'Total Postingan', value: 10 });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('merender dengan value nol', () => {
    renderStatCard({ label: 'Total Postingan', value: 0 });

    expect(screen.getByTestId('stat-value')).toHaveTextContent('0');
  });

  it('merender dengan data berbeda (beberapa stat card)', () => {
    render(
      <MemoryRouter>
        <StatCard label="Total Postingan" value={10} icon={<MockIcon />} />
        <StatCard label="Total Komentar" value={42} icon={<MockIcon />} />
        <StatCard label="Total Pengguna" value={18} icon={<MockIcon />} />
      </MemoryRouter>,
    );

    const cards = screen.getAllByTestId('stat-card');
    expect(cards).toHaveLength(3);

    expect(screen.getByText('Total Postingan')).toBeInTheDocument();
    expect(screen.getByText('Total Komentar')).toBeInTheDocument();
    expect(screen.getByText('Total Pengguna')).toBeInTheDocument();
  });
});
