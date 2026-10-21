import slugify from 'slugify';

/**
 * Fungsi callback yang memeriksa apakah slug tertentu sudah digunakan.
 * Mengembalikan `true` jika slug sudah ada, `false` jika belum.
 */
export type SlugExistsCallback = (slug: string) => Promise<boolean>;

/**
 * Fungsi callback yang mencari semua slug yang dimulai dengan prefix tertentu.
 * Digunakan untuk menemukan suffix numerik tertinggi yang sudah dipakai.
 */
export type SlugStartsWithCallback = (prefix: string) => Promise<string[]>;

/**
 * Menghasilkan slug URL-safe dari title menggunakan `slugify`, lalu memastikan
 * keunikannya dengan menambahkan suffix numerik (-2, -3, …) bila terjadi tabrakan.
 *
 * Menerima query callbacks sehingga dapat digunakan oleh semua content type
 * (Post, Project, FunPost) tanpa coupling langsung ke Prisma.
 *
 * Requirements: 3.2, 4.1 (Stage 2)
 *
 * @param title       Judul konten yang akan di-slug-kan
 * @param slugExists  Callback yang memeriksa apakah slug sudah digunakan
 * @param getConflicts Callback yang mengembalikan semua slug yang dimulai dengan prefix
 */
export async function generateUniqueSlug(
  title: string,
  slugExists: SlugExistsCallback,
  getConflicts: SlugStartsWithCallback
): Promise<string> {
  const base = slugify(title, { lower: true, strict: true, trim: true });

  // Periksa apakah base slug sudah ada
  const exists = await slugExists(base);
  if (!exists) {
    return base;
  }

  // Temukan suffix numerik tertinggi untuk base slug ini
  const conflicts = await getConflicts(`${base}-`);

  let maxSuffix = 1;
  for (const slug of conflicts) {
    const suffix = slug.slice(base.length + 1);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > maxSuffix) {
      maxSuffix = num;
    }
  }

  return `${base}-${maxSuffix + 1}`;
}
