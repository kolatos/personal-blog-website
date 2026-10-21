/**
 * Component tests untuk FunCard
 * Task 18 — Stage 2 New Sections
 *
 * Skenario yang dicakup:
 *  1. FunCard dengan type="image" dan mediaUrl merender cover image
 *  2. FunCard dengan type="image" tanpa mediaUrl merender placeholder (tanpa img)
 *  3. FunCard dengan type="text" dan excerpt merender excerpt
 *  4. FunCard dengan type="text" tanpa excerpt tidak merender excerpt
 *  5. FunCard dengan type="music" merender music link
 *  6. FunCard merender type badge
 *  7. FunCard merender judul dengan link ke /fun/:slug
 *  8. FunCard merender tags ketika ada
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FunCard } from './FunCard';
import type { FunPost } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFunPost(overrides: Partial<FunPost> = {}): FunPost {
  return {
    id: 'fun-1',
    title: 'Postingan Fun',
    slug: 'postingan-fun',
    excerpt: 'Ini adalah excerpt singkat.',
    content: '## Konten\n\nIsi postingan.',
    contentHtml: '<h2>Konten</h2><p>Isi postingan.</p>',
    status: 'published',
    type: 'text',
    mediaUrl: null,
    tags: [],
    publishedAt: '2024-03-01T00:00:00.000Z',
    createdAt: '2024-03-01T00:00:00.000Z',
    updatedAt: '2024-03-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderFunCard(post: FunPost) {
  return render(
    <MemoryRouter>
      <FunCard post={post} />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FunCard', () => {
  // ── Media ──────────────────────────────────────────────────────────────────

  it('merender cover image untuk type="image" dengan mediaUrl', () => {
    const post = makeFunPost({
      type: 'image',
      mediaUrl: 'https://example.com/photo.jpg',
    });
    renderFunCard(post);

    const mediaContainer = screen.getByTestId('fun-card-media');
    expect(mediaContainer).toBeInTheDocument();

    const img = mediaContainer.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('merender placeholder untuk type="image" tanpa mediaUrl (tidak ada img)', () => {
    const post = makeFunPost({ type: 'image', mediaUrl: null });
    renderFunCard(post);

    // Tidak ada fun-card-media karena tidak ada mediaUrl
    expect(screen.queryByTestId('fun-card-media')).not.toBeInTheDocument();
    // Tidak ada elemen img
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('merender cover image untuk type="drawing" dengan mediaUrl', () => {
    const post = makeFunPost({
      type: 'drawing',
      mediaUrl: 'https://example.com/drawing.png',
    });
    renderFunCard(post);

    const mediaContainer = screen.getByTestId('fun-card-media');
    expect(mediaContainer).toBeInTheDocument();
  });

  // ── Excerpt ────────────────────────────────────────────────────────────────

  it('merender excerpt untuk type="text" dengan excerpt', () => {
    const post = makeFunPost({
      type: 'text',
      excerpt: 'Ini adalah excerpt yang sangat menarik.',
    });
    renderFunCard(post);

    const excerpt = screen.getByTestId('fun-card-excerpt');
    expect(excerpt).toBeInTheDocument();
    expect(excerpt).toHaveTextContent('Ini adalah excerpt yang sangat menarik.');
  });

  it('tidak merender excerpt untuk type="text" tanpa excerpt', () => {
    const post = makeFunPost({ type: 'text', excerpt: null });
    renderFunCard(post);

    expect(screen.queryByTestId('fun-card-excerpt')).not.toBeInTheDocument();
  });

  it('merender excerpt untuk type="review" dengan excerpt', () => {
    const post = makeFunPost({
      type: 'review',
      excerpt: 'Ulasan singkat buku ini.',
    });
    renderFunCard(post);

    const excerpt = screen.getByTestId('fun-card-excerpt');
    expect(excerpt).toHaveTextContent('Ulasan singkat buku ini.');
  });

  // ── Music ──────────────────────────────────────────────────────────────────

  it('merender music link untuk type="music" dengan mediaUrl', () => {
    const post = makeFunPost({
      type: 'music',
      mediaUrl: 'https://open.spotify.com/track/123',
    });
    renderFunCard(post);

    const musicLink = screen.getByTestId('fun-card-music-link');
    expect(musicLink).toBeInTheDocument();
    expect(musicLink).toHaveAttribute('href', 'https://open.spotify.com/track/123');
    expect(musicLink).toHaveTextContent('Dengarkan');
  });

  it('tidak merender music link untuk type="music" tanpa mediaUrl', () => {
    const post = makeFunPost({ type: 'music', mediaUrl: null });
    renderFunCard(post);

    expect(screen.queryByTestId('fun-card-music-link')).not.toBeInTheDocument();
  });

  // ── Type badge ─────────────────────────────────────────────────────────────

  it('merender type badge dengan label yang benar', () => {
    const post = makeFunPost({ type: 'review' });
    renderFunCard(post);

    const badge = screen.getByTestId('fun-card-type-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Ulasan');
  });

  it('merender type badge untuk type="text"', () => {
    const post = makeFunPost({ type: 'text' });
    renderFunCard(post);

    const badge = screen.getByTestId('fun-card-type-badge');
    expect(badge).toHaveTextContent('Tulisan');
  });

  it('merender type badge untuk type="interactive"', () => {
    const post = makeFunPost({ type: 'interactive' });
    renderFunCard(post);

    const badge = screen.getByTestId('fun-card-type-badge');
    expect(badge).toHaveTextContent('Interaktif');
  });

  // ── Title link ─────────────────────────────────────────────────────────────

  it('merender judul dengan link ke /fun/:slug', () => {
    const post = makeFunPost({ slug: 'my-fun-post', title: 'My Fun Post' });
    renderFunCard(post);

    const link = screen.getByTestId('fun-card-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/fun/my-fun-post');

    expect(link).toHaveTextContent('My Fun Post');
  });

  // ── Tags ───────────────────────────────────────────────────────────────────

  it('merender tags ketika ada', () => {
    const post = makeFunPost({
      tags: [
        { id: 'tag-1', name: 'javascript', slug: 'javascript' },
        { id: 'tag-2', name: 'typescript', slug: 'typescript' },
      ],
    });
    renderFunCard(post);

    const tagsContainer = screen.getByTestId('fun-card-tags');
    expect(tagsContainer).toBeInTheDocument();
    expect(screen.getByText('javascript')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('tidak merender tags container ketika tags kosong', () => {
    const post = makeFunPost({ tags: [] });
    renderFunCard(post);

    expect(screen.queryByTestId('fun-card-tags')).not.toBeInTheDocument();
  });
});
