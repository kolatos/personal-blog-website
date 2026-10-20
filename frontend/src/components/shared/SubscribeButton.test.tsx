/**
 * Component tests untuk SubscribeButton
 * Task 11 — Stage 1 Blog Improvements
 *
 * Skenario yang dicakup:
 *  1. Tidak merender apa pun jika user tidak terotentikasi
 *  2. Menampilkan "Subscribe" saat user belum berlangganan
 *  3. Menampilkan "Subscribed" saat user sudah berlangganan
 *  4. Memanggil subscribe saat tombol "Subscribe" diklik
 *  5. Memanggil unsubscribe saat tombol "Subscribed" diklik
 *  6. Menampilkan loading state saat mutasi berjalan
 *
 * Requirements: 6.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SubscribeButton } from './SubscribeButton';

// ── Mock hooks ────────────────────────────────────────────────────────────────

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useSubscription', () => ({
  useSubscription: vi.fn(),
}));

import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';

const mockUseAuth = vi.mocked(useAuth);
const mockUseSubscription = vi.mocked(useSubscription);

// ── Helper ────────────────────────────────────────────────────────────────────

function renderSubscribeButton() {
  return render(
    <MemoryRouter>
      <SubscribeButton />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SubscribeButton', () => {
  const mockSubscribe = vi.fn();
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSubscription.mockReturnValue({
      subscribed: false,
      isLoading: false,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      isMutating: false,
    });
  });

  it('tidak merender apa pun jika user tidak terotentikasi', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    const { container } = renderSubscribeButton();

    expect(container).toBeEmptyDOMElement();
  });

  it('menampilkan "Subscribe" saat user belum berlangganan', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', username: 'alice', email: 'a@a.com', role: 'user', joinedAt: '' },
      token: 'tok',
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUseSubscription.mockReturnValue({
      subscribed: false,
      isLoading: false,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      isMutating: false,
    });

    renderSubscribeButton();

    expect(screen.getByTestId('subscribe-button')).toHaveTextContent('Subscribe');
  });

  it('menampilkan "Subscribed" saat user sudah berlangganan', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', username: 'alice', email: 'a@a.com', role: 'user', joinedAt: '' },
      token: 'tok',
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUseSubscription.mockReturnValue({
      subscribed: true,
      isLoading: false,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      isMutating: false,
    });

    renderSubscribeButton();

    expect(screen.getByTestId('subscribe-button')).toHaveTextContent('Subscribed');
  });

  it('memanggil subscribe saat tombol "Subscribe" diklik', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', username: 'alice', email: 'a@a.com', role: 'user', joinedAt: '' },
      token: 'tok',
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUseSubscription.mockReturnValue({
      subscribed: false,
      isLoading: false,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      isMutating: false,
    });

    renderSubscribeButton();

    await userEvent.click(screen.getByTestId('subscribe-button'));

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });

  it('memanggil unsubscribe saat tombol "Subscribed" diklik', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', username: 'alice', email: 'a@a.com', role: 'user', joinedAt: '' },
      token: 'tok',
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUseSubscription.mockReturnValue({
      subscribed: true,
      isLoading: false,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      isMutating: false,
    });

    renderSubscribeButton();

    await userEvent.click(screen.getByTestId('subscribe-button'));

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('menonaktifkan tombol saat mutasi sedang berjalan', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', username: 'alice', email: 'a@a.com', role: 'user', joinedAt: '' },
      token: 'tok',
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUseSubscription.mockReturnValue({
      subscribed: false,
      isLoading: false,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      isMutating: true,
    });

    renderSubscribeButton();

    expect(screen.getByTestId('subscribe-button')).toBeDisabled();
  });

  it('menampilkan loading state (indikator animasi) saat mutasi berjalan', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', username: 'alice', email: 'a@a.com', role: 'user', joinedAt: '' },
      token: 'tok',
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUseSubscription.mockReturnValue({
      subscribed: false,
      isLoading: false,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      isMutating: true,
    });

    renderSubscribeButton();

    // Saat isMutating=true teks "Subscribe" diganti dengan animasi "…"
    expect(screen.getByTestId('subscribe-button')).toHaveTextContent('…');
  });
});
