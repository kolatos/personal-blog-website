import { Link } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
}

/**
 * Kartu statistik yang dapat digunakan kembali untuk dashboard admin.
 * Menampilkan satu angka statistik dengan label dan ikon.
 *
 * Jika `href` diberikan, seluruh kartu menjadi link navigasi.
 *
 * Requirements: 7.2, 7.8
 */
export function StatCard({ label, value, icon, href }: StatCardProps) {
  const content = (
    <Card
      className={
        href
          ? 'transition-colors hover:border-primary cursor-pointer'
          : undefined
      }
      data-testid="stat-card"
    >
      <CardContent className="flex items-center gap-4 p-6">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0"
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold text-foreground" data-testid="stat-value">
            {value.toLocaleString('id-ID')}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link to={href} className="block no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
