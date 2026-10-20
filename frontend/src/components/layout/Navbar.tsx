import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/button';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <nav
        className="container mx-auto flex h-14 items-center justify-between px-4"
        aria-label="Navigasi utama"
      >
        {/* Brand */}
        <Link
          to="/"
          className="text-lg font-bold text-foreground hover:text-primary transition-colors"
        >
          Kirodico
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-4">
          {/* Public links */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `text-sm transition-colors hover:text-primary ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`
            }
          >
            Beranda
          </NavLink>

          {/* Role-based links */}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `text-sm transition-colors hover:text-primary ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`
              }
            >
              Dashboard
            </NavLink>
          )}

          {user?.role === 'user' && (
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `text-sm transition-colors hover:text-primary ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`
              }
            >
              Profil
            </NavLink>
          )}

          {/* Auth links (guest only) */}
          {!user && (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `text-sm transition-colors hover:text-primary ${isActive ? 'text-primary font-semibold' : 'text-foreground'}`
                }
              >
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
              /* Sun icon */
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
              /* Moon icon */
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
      </nav>
    </header>
  );
}
