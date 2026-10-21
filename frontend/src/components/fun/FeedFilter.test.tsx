/**
 * Component tests untuk FeedFilter
 * Task 18 — Stage 2 New Sections
 *
 * Skenario yang dicakup:
 *  1. Merender type filter group
 *  2. Memilih type filter memanggil onTypeChange dengan type yang benar
 *  3. Memilih type yang sama lagi (deselect) memanggil onTypeChange(null)
 *  4. Tag filter chips merender ketika availableTags diberikan
 *  5. Mengklik tag chip memanggil onTagToggle dengan slug yang benar
 *  6. Tag aktif memiliki aria-pressed="true"
 *  7. Tombol "Hapus filter" muncul ketika ada filter aktif
 *  8. Tombol "Hapus filter" tidak muncul ketika tidak ada filter aktif
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedFilter } from './FeedFilter';
import type { TagSummary } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const sampleTags: TagSummary[] = [
  { id: 'tag-1', name: 'javascript', slug: 'javascript' },
  { id: 'tag-2', name: 'buku', slug: 'buku' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FeedFilter', () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  it('merender type filter group', () => {
    render(
      <FeedFilter
        activeType={null}
        activeTags={[]}
        onTypeChange={vi.fn()}
        onTagToggle={vi.fn()}
      />,
    );

    expect(screen.getByTestId('type-filter-group')).toBeInTheDocument();
  });

  it('merender semua 6 tombol type filter', () => {
    render(
      <FeedFilter
        activeType={null}
        activeTags={[]}
        onTypeChange={vi.fn()}
        onTagToggle={vi.fn()}
      />,
    );

    expect(screen.getByTestId('type-filter-text')).toBeInTheDocument();
    expect(screen.getByTestId('type-filter-review')).toBeInTheDocument();
    expect(screen.getByTestId('type-filter-image')).toBeInTheDocument();
    expect(screen.getByTestId('type-filter-drawing')).toBeInTheDocument();
    expect(screen.getByTestId('type-filter-music')).toBeInTheDocument();
    expect(screen.getByTestId('type-filter-interactive')).toBeInTheDocument();
  });

  // ── Type selection ─────────────────────────────────────────────────────────

  it('mengklik type filter memanggil onTypeChange dengan type yang benar', async () => {
    const onTypeChange = vi.fn();
    render(
      <FeedFilter
        activeType={null}
        activeTags={[]}
        onTypeChange={onTypeChange}
        onTagToggle={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId('type-filter-review'));

    expect(onTypeChange).toHaveBeenCalledWith('review');
  });

  it('mengklik type filter "text" memanggil onTypeChange("text")', async () => {
    const onTypeChange = vi.fn();
    render(
      <FeedFilter
        activeType={null}
        activeTags={[]}
        onTypeChange={onTypeChange}
        onTagToggle={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId('type-filter-text'));

    expect(onTypeChange).toHaveBeenCalledWith('text');
  });

  it('mengklik type yang sudah aktif memanggil onTypeChange(null) — deselect', async () => {
    const onTypeChange = vi.fn();
    render(
      <FeedFilter
        activeType="review"
        activeTags={[]}
        onTypeChange={onTypeChange}
        onTagToggle={vi.fn()}
      />,
    );

    // Click the already active type to deselect
    await userEvent.click(screen.getByTestId('type-filter-review'));

    expect(onTypeChange).toHaveBeenCalledWith(null);
  });

  // ── Tag filter ─────────────────────────────────────────────────────────────

  it('merender tag filter chips ketika availableTags diberikan', () => {
    render(
      <FeedFilter
        activeType={null}
        activeTags={[]}
        availableTags={sampleTags}
        onTypeChange={vi.fn()}
        onTagToggle={vi.fn()}
      />,
    );

    expect(screen.getByTestId('tag-filter-javascript')).toBeInTheDocument();
    expect(screen.getByTestId('tag-filter-buku')).toBeInTheDocument();
  });

  it('tidak merender tag filter chips ketika availableTags kosong', () => {
    render(
      <FeedFilter
        activeType={null}
        activeTags={[]}
        availableTags={[]}
        onTypeChange={vi.fn()}
        onTagToggle={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('tag-filter-chips')).not.toBeInTheDocument();
  });

  it('mengklik tag chip memanggil onTagToggle dengan slug yang benar', async () => {
    const onTagToggle = vi.fn();
    render(
      <FeedFilter
        activeType={null}
        activeTags={[]}
        availableTags={sampleTags}
        onTypeChange={vi.fn()}
        onTagToggle={onTagToggle}
      />,
    );

    await userEvent.click(screen.getByTestId('tag-filter-javascript'));

    expect(onTagToggle).toHaveBeenCalledWith('javascript');
  });

  it('tag aktif memiliki aria-pressed="true"', () => {
    render(
      <FeedFilter
        activeType={null}
        activeTags={['javascript']}
        availableTags={sampleTags}
        onTypeChange={vi.fn()}
        onTagToggle={vi.fn()}
      />,
    );

    const activeChip = screen.getByTestId('tag-filter-javascript');
    expect(activeChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('tag tidak aktif memiliki aria-pressed="false"', () => {
    render(
      <FeedFilter
        activeType={null}
        activeTags={[]}
        availableTags={sampleTags}
        onTypeChange={vi.fn()}
        onTagToggle={vi.fn()}
      />,
    );

    const inactiveChip = screen.getByTestId('tag-filter-javascript');
    expect(inactiveChip).toHaveAttribute('aria-pressed', 'false');
  });

  // ── Clear filters ──────────────────────────────────────────────────────────

  it('tombol "Hapus filter" muncul ketika activeType aktif', () => {
    render(
      <FeedFilter
        activeType="review"
        activeTags={[]}
        onTypeChange={vi.fn()}
        onTagToggle={vi.fn()}
      />,
    );

    expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument();
  });

  it('tombol "Hapus filter" muncul ketika ada tag aktif', () => {
    render(
      <FeedFilter
        activeType={null}
        activeTags={['javascript']}
        availableTags={sampleTags}
        onTypeChange={vi.fn()}
        onTagToggle={vi.fn()}
      />,
    );

    expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument();
  });

  it('tombol "Hapus filter" tidak muncul ketika tidak ada filter aktif', () => {
    render(
      <FeedFilter
        activeType={null}
        activeTags={[]}
        onTypeChange={vi.fn()}
        onTagToggle={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('clear-filters-button')).not.toBeInTheDocument();
  });

  it('mengklik "Hapus filter" memanggil onTypeChange(null)', async () => {
    const onTypeChange = vi.fn();
    render(
      <FeedFilter
        activeType="music"
        activeTags={[]}
        onTypeChange={onTypeChange}
        onTagToggle={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByTestId('clear-filters-button'));

    expect(onTypeChange).toHaveBeenCalledWith(null);
  });
});
