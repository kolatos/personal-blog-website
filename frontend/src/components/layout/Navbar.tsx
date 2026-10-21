import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition-colors hover:text-primary ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <nav
        className="container mx-auto px-4"
        aria-label="Navigasi utama"
      >
        {/* Top row: brand + desktop nav + controls */}
        <div className="flex h-14 items-center justify-between">
          {/* Brand */}
          <Link
            to="/"
            className="text-lg font-bold text-foreground hover:text-primary transition-colors"
          >
            Kirodico
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-4">
            <NavLink to="/blog" className={navLinkClass}>
              Blog
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
            <NavLink to="/projects" className={navLinkClass}>
              Projects
            </NavLink>
            <NavLink to="/fun" className={navLinkClass}>
              Fun
            </NavLink>
            {/* Learning — coming soon, not navigable */}
            <span
              className="text-sm text-muted-foreground cursor-default flex items-center gap-1.5"
              title="Coming soon"
              aria-disabled="true"
              data-testid="learning-nav-item"
            >
              Learning
              <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-5">
                Soon
              </Badge>
            </span>

            {/* Role-based links */}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navLinkClass}>
                Dashboard
              </NavLink>
            )}

            {user?.role === 'user' && (
              <NavLink to="/profile" className={navLinkClass}>
                Profil
              </NavLink>
            )}

            {/* Auth links (guest only) */}
            {!user && (
              <>
                <NavLink to="/login" className={navLinkClass}>
                  Masuk
                </NavLink>
                <NavLink
                  to="/register"
                  className="text-sm rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Daftar
                </NavLink>
              </>
            )}

            {/* Logout button (authenticated only) */}
            {user && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-sm text-foreground hover:text-destructive"
              >
                Keluar
              </Button>
            )}

            {/* Dark mode toggle */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            >
              {theme === 'dark' ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </Button>
          </div>

          {/* Mobile: theme toggle + hamburger button */}
          <div className="flex items-center gap-1 md:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            >
              {theme === 'dark' ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-label={isOpen ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              data-testid="hamburger-button"
            >
              {isOpen ? (
                /* X icon */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile menu — collapse/expand via isOpen */}
        {isOpen && (
          <div
            id="mobile-menu"
            className="md:hidden pb-4 flex flex-col gap-1 border-t border-border pt-3"
            data-testid="mobile-menu"
          >
            <NavLink to="/blog" className={({ isActive }) => `block px-2 py-2 rounded text-sm transition-colors hover:bg-muted ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`} onClick={closeMenu}>
              Blog
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => `block px-2 py-2 rounded text-sm transition-colors hover:bg-muted ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`} onClick={closeMenu}>
              About
            </NavLink>
            <NavLink to="/projects" className={({ isActive }) => `block px-2 py-2 rounded text-sm transition-colors hover:bg-muted ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`} onClick={closeMenu}>
              Projects
            </NavLink>
            <NavLink to="/fun" className={({ isActive }) => `block px-2 py-2 rounded text-sm transition-colors hover:bg-muted ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`} onClick={closeMenu}>
              Fun
            </NavLink>
            {/* Learning — disabled */}
            <span
              className="flex items-center gap-1.5 px-2 py-2 text-sm text-muted-foreground cursor-default"
              aria-disabled="true"
            >
              Learning
              <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-5">
                Soon
              </Badge>
            </span>

            {/* Role-based links */}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={({ isActive }) => `block px-2 py-2 rounded text-sm transition-colors hover:bg-muted ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`} onClick={closeMenu}>
                Dashboard
              </NavLink>
            )}
            {user?.role === 'user' && (
              <NavLink to="/profile" className={({ isActive }) => `block px-2 py-2 rounded text-sm transition-colors hover:bg-muted ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`} onClick={closeMenu}>
                Profil
              </NavLink>
            )}

            {/* Guest */}
            {!user && (
              <>
                <NavLink to="/login" className={({ isActive }) => `block px-2 py-2 rounded text-sm transition-colors hover:bg-muted ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`} onClick={closeMenu}>
                  Masuk
                </NavLink>
                <NavLink to="/register" className="block px-2 py-2 rounded text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity" onClick={closeMenu}>
                  Daftar
                </NavLink>
              </>
            )}

            {/* Logout */}
            {user && (
              <button
                type="button"
                onClick={() => { logout(); closeMenu(); }}
                className="text-left block w-full px-2 py-2 rounded text-sm text-foreground hover:text-destructive hover:bg-muted transition-colors"
              >
                Keluar
              </button>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
