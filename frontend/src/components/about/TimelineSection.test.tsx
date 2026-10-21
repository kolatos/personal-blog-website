/**
 * Component tests untuk TimelineSection
 * Task 15 — Stage 2 New Sections
 *
 * Skenario yang dicakup:
 *  1. Merender entry diurutkan terbaru di atas (startDate DESC)
 *  2. Menampilkan "Sekarang" jika endDate null
 *  3. Merender subtitle jika ada
 *  4. Mengembalikan null jika tidak ada sections
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineSection } from './TimelineSection';
import type { AboutSection } from '../../types';

function makeSection(overrides: Partial<AboutSection> = {}): AboutSection {
  return {
    id: Math.random().toString(),
    type: 'experience',
    title: 'Judul Seksi',
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('TimelineSection', () => {
  it('merender entry diurutkan terbaru di atas (startDate DESC)', () => {
    const sections: AboutSection[] = [
      makeSection({ id: 'old', title: 'Pekerjaan Lama', startDate: '2018-01-01' }),
      makeSection({ id: 'new', title: 'Pekerjaan Baru', startDate: '2022-06-01' }),
      makeSection({ id: 'mid', title: 'Pekerjaan Menengah', startDate: '2020-03-01' }),
    ];

    render(<TimelineSection title="Pengalaman" sections={sections} />);

    screen.getAllByTestId(/sortable-row|timeline-list/);
    // Get rendered list items
    const list = screen.getByTestId('timeline-list');
    const listItems = list.querySelectorAll('li');

    expect(listItems).toHaveLength(3);
    // First item should be the newest (2022)
    expect(listItems[0].textContent).toContain('Pekerjaan Baru');
    // Last item should be the oldest (2018)
    expect(listItems[2].textContent).toContain('Pekerjaan Lama');
  });

  it('menampilkan "Sekarang" jika endDate tidak ada', () => {
    const sections: AboutSection[] = [
      makeSection({ title: 'Pekerjaan Aktif', startDate: '2022-01-01', endDate: undefined }),
    ];

    render(<TimelineSection title="Pengalaman" sections={sections} />);

    expect(screen.getByText(/Sekarang/)).toBeInTheDocument();
  });

  it('menampilkan range tanggal jika startDate dan endDate ada', () => {
    const sections: AboutSection[] = [
      makeSection({ title: 'Pekerjaan Selesai', startDate: '2020-01-01', endDate: '2022-12-31' }),
    ];

    render(<TimelineSection title="Pengalaman" sections={sections} />);

    // Should show start and end date formatting
    expect(screen.getByText(/Jan 2020/i)).toBeTruthy();
  });

  it('merender subtitle jika ada', () => {
    const sections: AboutSection[] = [
      makeSection({ title: 'Software Engineer', subtitle: 'PT Contoh Indonesia' }),
    ];

    render(<TimelineSection title="Pengalaman" sections={sections} />);

    expect(screen.getByText('PT Contoh Indonesia')).toBeInTheDocument();
  });

  it('tidak merender apa-apa jika sections kosong', () => {
    const { container } = render(<TimelineSection title="Pengalaman" sections={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('merender heading dengan title yang diberikan', () => {
    const sections: AboutSection[] = [makeSection({ title: 'Test Entry' })];

    render(<TimelineSection title="Riwayat Kerja" sections={sections} />);

    expect(screen.getByText('Riwayat Kerja')).toBeInTheDocument();
  });
});
