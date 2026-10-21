import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import Navbar from './Navbar';

/**
 * Test komponen Navbar — memastikan tautan navigasi yang benar setelah
 * migrasi rute blog dari "/" ke "/blog" dan penambahan semua seksi Stage 2.
 */

function renderNavbar(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Navbar />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Navbar — tautan navigasi blog', () => {
  it('merender tautan "Blog" dengan href "/blog"', () => {
    renderNavbar();

    // Desktop version (hidden md:flex — queried by href)
    const blogLinks = screen.getAllByRole('link', { name: /^blog$/i });
    expect(blogLinks.length).toBeGreaterThanOrEqual(1);
    expect(blogLinks[0]).toHaveAttribute('href', '/blog');
  });

  it('tidak merender tautan "Beranda" yang mengarah ke "/"', () => {
    renderNavbar();

    const navLinks = screen.getAllByRole('link');
    const homeNavLink = navLinks.find(
      (link) =>
        link.getAttribute('href') === '/' &&
        /beranda/i.test(link.textContent ?? ''),
    );
    expect(homeNavLink).toBeUndefined();
  });

  it('brand link (Kirodico) tetap mengarah ke "/"', () => {
    renderNavbar();

    const brandLink = screen.getByRole('link', { name: /kirodico/i });
    expect(brandLink).toHaveAttribute('href', '/');
  });
});

describe('Navbar — semua tautan seksi Stage 2', () => {
  it('merender tautan "About" dengan href "/about"', () => {
    renderNavbar();

    const aboutLinks = screen.getAllByRole('link', { name: /^about$/i });
    expect(aboutLinks.length).toBeGreaterThanOrEqual(1);
    expect(aboutLinks[0]).toHaveAttribute('href', '/about');
  });

  it('merender tautan "Projects" dengan href "/projects"', () => {
    renderNavbar();

    const projectsLinks = screen.getAllByRole('link', { name: /^projects$/i });
    expect(projectsLinks.length).toBeGreaterThanOrEqual(1);
    expect(projectsLinks[0]).toHaveAttribute('href', '/projects');
  });

  it('merender tautan "Fun" dengan href "/fun"', () => {
    renderNavbar();

    const funLinks = screen.getAllByRole('link', { name: /^fun$/i });
    expect(funLinks.length).toBeGreaterThanOrEqual(1);
    expect(funLinks[0]).toHaveAttribute('href', '/fun');
  });

  it('tautan Learning memiliki badge "Soon" dan tidak dapat dinavigasi', () => {
    renderNavbar();

    // Learning item is a <span> (aria-disabled), not a link
    const learningItem = screen.getByTestId('learning-nav-item');
    expect(learningItem).toBeInTheDocument();
    expect(learningItem).toHaveAttribute('aria-disabled', 'true');
    expect(learningItem).not.toHaveAttribute('href');

    // Badge "Soon" muncul
    expect(screen.getByText(/soon/i)).toBeInTheDocument();
  });

  it('tautan Learning bukan merupakan link yang bisa diklik', () => {
    renderNavbar();

    // Pastikan tidak ada link dengan text "Learning"
    const allLinks = screen.getAllByRole('link');
    const learningLink = allLinks.find((link) =>
      /learning/i.test(link.textContent ?? ''),
    );
    expect(learningLink).toBeUndefined();
  });
});

describe('Navbar — hamburger mobile menu', () => {
  it('menu mobile tidak terlihat secara default', () => {
    renderNavbar();

    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
  });

  it('membuka menu mobile ketika hamburger button diklik', async () => {
    renderNavbar();

    const hamburger = screen.getByTestId('hamburger-button');
    await userEvent.click(hamburger);

    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
  });

  it('menutup menu mobile ketika hamburger button diklik lagi', async () => {
    renderNavbar();

    const hamburger = screen.getByTestId('hamburger-button');
    await userEvent.click(hamburger);
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();

    await userEvent.click(hamburger);
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
  });

  it('menu mobile berisi semua tautan seksi', async () => {
    renderNavbar();

    const hamburger = screen.getByTestId('hamburger-button');
    await userEvent.click(hamburger);

    const mobileMenu = screen.getByTestId('mobile-menu');
    expect(mobileMenu).toBeInTheDocument();

    // Cek semua tautan ada di dalam mobile menu
    const links = mobileMenu.querySelectorAll('a');
    const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/blog');
    expect(hrefs).toContain('/about');
    expect(hrefs).toContain('/projects');
    expect(hrefs).toContain('/fun');
  });
});
