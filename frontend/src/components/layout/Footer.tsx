export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto flex items-center justify-center px-4 py-6">
        <p className="text-sm text-muted-foreground">
          &copy; {year} Kirodico. Semua hak dilindungi.
        </p>
      </div>
    </footer>
  );
}
