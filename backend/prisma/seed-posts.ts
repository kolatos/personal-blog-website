/**
 * Seed script: membuat post blog bertema Abstract Algebra.
 * Membutuhkan akun admin yang sudah ada (jalankan seed.ts terlebih dahulu).
 *
 * Jalankan: npx tsx prisma/seed-posts.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@blog.com';

const posts = [
  {
    title: 'Pengantar Grup: Fondasi Aljabar Abstrak',
    slug: 'pengantar-grup-fondasi-aljabar-abstrak',
    status: 'published',
    publishedAt: new Date('2026-09-01T08:00:00Z'),
    content: `# Pengantar Grup: Fondasi Aljabar Abstrak

Aljabar abstrak adalah cabang matematika yang mempelajari struktur-struktur
aljabar seperti grup, ring, dan field. Di antara semua struktur ini, **grup**
adalah yang paling mendasar dan paling banyak muncul di berbagai bidang
matematika maupun fisika.

## Apa Itu Grup?

Secara formal, sebuah **grup** adalah pasangan $(G, \\cdot)$ di mana $G$
adalah himpunan tak kosong dan $\\cdot$ adalah operasi biner pada $G$
yang memenuhi empat aksioma berikut:

1. **Closure (Ketutupan):** Untuk setiap $a, b \\in G$, berlaku $a \\cdot b \\in G$.
2. **Associativity (Asosiatif):** Untuk setiap $a, b, c \\in G$, berlaku
   $(a \\cdot b) \\cdot c = a \\cdot (b \\cdot c)$.
3. **Identity (Identitas):** Terdapat elemen $e \\in G$ sedemikian sehingga
   untuk setiap $a \\in G$, berlaku $e \\cdot a = a \\cdot e = a$.
4. **Inverse (Invers):** Untuk setiap $a \\in G$, terdapat elemen $a^{-1} \\in G$
   sedemikian sehingga $a \\cdot a^{-1} = a^{-1} \\cdot a = e$.

## Contoh Sederhana

Contoh paling sederhana adalah $( \\mathbb{Z}, + )$, yaitu himpunan
bilangan bulat dengan operasi penjumlahan:
- **Closure:** Jumlah dua bilangan bulat adalah bilangan bulat.
- **Asosiatif:** Penjumlahan bilangan bulat bersifat asosiatif.
- **Identitas:** Elemen identitasnya adalah $0$.
- **Invers:** Invers dari $n$ adalah $-n$.

Contoh lain yang sering muncul adalah **grup simetri** $S_n$, yaitu
himpunan semua permutasi dari $n$ elemen dengan operasi komposisi.

## Grup Abelian

Sebuah grup $(G, \\cdot)$ disebut **abelian** (atau komutatif) jika untuk
setiap $a, b \\in G$ berlaku $a \\cdot b = b \\cdot a$. Himpunan bilangan
bulat dengan penjumlahan adalah contoh grup abelian, sementara $S_n$
untuk $n \\geq 3$ bukan grup abelian.

## Mengapa Grup Penting?

Grup muncul secara alami dalam:
- **Geometri:** Simetri bangun datar dan ruang direpresentasikan sebagai grup.
- **Fisika partikel:** Grup Lie seperti $SU(2)$ dan $SU(3)$ mendeskripsikan
  simetri fundamental partikel subatomik.
- **Kriptografi:** Grup siklik digunakan dalam algoritma Diffie-Hellman
  dan kriptografi kurva eliptik.

Di post berikutnya kita akan membahas **subgrup** dan **teorema Lagrange**.
`,
  },
  {
    title: 'Subgrup dan Teorema Lagrange',
    slug: 'subgrup-dan-teorema-lagrange',
    status: 'published',
    publishedAt: new Date('2026-09-08T08:00:00Z'),
    content: `# Subgrup dan Teorema Lagrange

Setelah memahami definisi dasar grup, langkah selanjutnya adalah
mempelajari struktur *di dalam* sebuah grup: **subgrup**. Konsep ini
membawa kita ke salah satu teorema paling elegan dalam aljabar abstrak.

## Definisi Subgrup

Diberikan grup $(G, \\cdot)$. Himpunan tak kosong $H \\subseteq G$ disebut
**subgrup** dari $G$, dinotasikan $H \\leq G$, jika $H$ sendiri
membentuk grup di bawah operasi yang sama.

**Kriteria subgrup:** $H \\leq G$ jika dan hanya jika:
1. $H \\neq \\emptyset$
2. Untuk setiap $a, b \\in H$, berlaku $a \\cdot b^{-1} \\in H$

Ini jauh lebih efisien daripada memeriksa keempat aksioma grup satu per satu.

## Contoh Subgrup

Pada grup $( \\mathbb{Z}, + )$:
- $2\\mathbb{Z} = \\{\\ldots, -4, -2, 0, 2, 4, \\ldots\\}$ (bilangan bulat genap) adalah subgrup.
- $n\\mathbb{Z}$ untuk sembarang $n \\in \\mathbb{Z}^+$ selalu merupakan subgrup.

Fakta menarik: setiap subgrup dari $( \\mathbb{Z}, + )$ berbentuk $n\\mathbb{Z}$
untuk suatu bilangan bulat non-negatif $n$.

## Coset

Diberikan $H \\leq G$ dan $a \\in G$. **Koset kiri** dari $H$ di $G$
yang dihasilkan oleh $a$ adalah:

$$aH = \\{a \\cdot h \\mid h \\in H\\}$$

Properti penting koset:
- Dua koset kiri dari $H$ di $G$ bersifat **disjoint** atau **identik**.
- Setiap koset memiliki kardinalitas yang sama dengan $|H|$.
- Koset-koset kiri dari $H$ membentuk partisi dari $G$.

## Teorema Lagrange

> **Teorema Lagrange:** Jika $G$ adalah grup berhingga dan $H \\leq G$,
> maka $|H|$ habis membagi $|G|$.

Lebih tepatnya, $|G| = [G : H] \\cdot |H|$, di mana $[G : H]$ disebut
**indeks** dari $H$ di $G$ dan menyatakan banyaknya koset berbeda dari $H$ di $G$.

**Bukti sketsa:** Karena setiap koset memiliki kardinalitas $|H|$ dan
koset-koset tersebut membentuk partisi dari $G$, maka
$|G| = [G : H] \\cdot |H|$. $\\blacksquare$

## Konsekuensi Teorema Lagrange

1. **Orde elemen membagi orde grup:** Untuk setiap $a \\in G$, orde dari $a$
   (yaitu bilangan bulat terkecil $n > 0$ sedemikian sehingga $a^n = e$)
   habis membagi $|G|$.

2. **Grup berorde prima bersifat siklik:** Jika $|G| = p$ untuk suatu
   bilangan prima $p$, maka $G$ adalah grup siklik yang dihasilkan oleh
   sembarang elemen non-identitas.

3. **Subgrup dari $\\mathbb{Z}_n$:** Subgrup dari $\\mathbb{Z}_n$ harus
   berorde yang membagi $n$, dan untuk setiap pembagi tersebut terdapat
   tepat satu subgrup.

Teorema Lagrange adalah *langkah pertama* menuju teorema-teorema lebih
dalam seperti teorema Sylow, yang akan kita bahas di post mendatang.
`,
  },
  {
    title: 'Ring: Generalisasi dari Bilangan Biasa',
    slug: 'ring-generalisasi-dari-bilangan-biasa',
    status: 'published',
    publishedAt: new Date('2026-09-15T08:00:00Z'),
    content: `# Ring: Generalisasi dari Bilangan Biasa

Setelah memahami grup, kita melangkah ke struktur aljabar yang lebih
kaya: **ring**. Ring menambahkan operasi kedua ke dalam struktur grup,
membuatnya lebih mirip dengan sistem bilangan yang kita kenal sehari-hari.

## Definisi Ring

Sebuah **ring** adalah tripel $(R, +, \\cdot)$ di mana $R$ adalah himpunan
tak kosong dengan dua operasi biner yang memenuhi:

1. $(R, +)$ adalah **grup abelian** (penjumlahan):
   - Asosiatif, komutatif, memiliki identitas $0$, dan setiap elemen memiliki invers.

2. $(R, \\cdot)$ bersifat **asosiatif** (perkalian):
   - $(a \\cdot b) \\cdot c = a \\cdot (b \\cdot c)$ untuk semua $a, b, c \\in R$.

3. **Distributif** (menghubungkan kedua operasi):
   - $a \\cdot (b + c) = a \\cdot b + a \\cdot c$
   - $(a + b) \\cdot c = a \\cdot c + b \\cdot c$

Ring **tidak** harus memiliki identitas perkalian, dan perkalian **tidak**
harus komutatif.

## Contoh Ring

| Himpunan | Operasi | Catatan |
|---|---|---|
| $\\mathbb{Z}$ | $+$, $\\times$ | Ring komutatif dengan identitas |
| $\\mathbb{Z}/n\\mathbb{Z}$ | $+$, $\\times$ | Ring bilangan bulat modulo $n$ |
| $M_{n\\times n}(\\mathbb{R})$ | $+$, matriks $\\times$ | Ring **non-komutatif** |
| $\\mathbb{Z}[x]$ | $+$, $\\times$ | Ring polinomial dengan koefisien bulat |

## Jenis-Jenis Ring

### Ring Komutatif
Ring di mana perkalian bersifat komutatif: $a \\cdot b = b \\cdot a$.
Contoh: $\\mathbb{Z}$, $\\mathbb{Q}[x]$.

### Ring dengan Satuan (Unital Ring)
Ring yang memiliki elemen identitas perkalian $1$ sedemikian sehingga
$1 \\cdot a = a \\cdot 1 = a$ untuk semua $a$.

### Domain Integral (Integral Domain)
Ring komutatif dengan satuan tanpa **zero divisor**: jika $a \\cdot b = 0$,
maka $a = 0$ atau $b = 0$. Contoh: $\\mathbb{Z}$, setiap field.

### Field
Ring komutatif dengan satuan di mana setiap elemen non-nol memiliki
invers perkalian. Contoh: $\\mathbb{Q}$, $\\mathbb{R}$, $\\mathbb{Z}/p\\mathbb{Z}$
untuk $p$ prima.

## Ideal

Konsep **ideal** pada ring analog dengan subgrup normal pada grup.
Himpunan $I \\subseteq R$ disebut **ideal kiri** jika:
- $(I, +)$ adalah subgrup dari $(R, +)$
- Untuk setiap $r \\in R$ dan $i \\in I$, berlaku $r \\cdot i \\in I$

Ideal memungkinkan kita mendefinisikan **ring quotient** $R/I$, yang
merupakan ring dengan elemen-elemen berupa coset $a + I$.

### Contoh Ideal di $\\mathbb{Z}$

Setiap ideal di $\\mathbb{Z}$ berbentuk $n\\mathbb{Z} = \\{\\ldots, -2n, -n, 0, n, 2n, \\ldots\\}$.
Ring quotient-nya adalah $\\mathbb{Z}/n\\mathbb{Z}$, yang sangat familiar dari
aritmetika modular.

## Teorema Isomorfisme Ring

Serupa dengan grup, ring memiliki teorema isomorfisme:

> Jika $\\phi: R \\to S$ adalah homomorfisme ring, maka
> $R / \\ker(\\phi) \\cong \\text{Im}(\\phi)$.

Ini adalah alat yang sangat kuat untuk memahami struktur ring melalui
pemetaan aljabar. Di post berikutnya kita akan membahas **field** secara
lebih mendalam beserta aplikasinya dalam teori Galois.
`,
  },
  {
    title: 'Field dan Ekstension Field',
    slug: 'field-dan-ekstension-field',
    status: 'published',
    publishedAt: new Date('2026-09-22T08:00:00Z'),
    content: `# Field dan Ekstension Field

Field (medan) adalah struktur aljabar paling "kaya" dari trio
grup–ring–field. Hampir semua operasi aritmetika yang kita lakukan
sehari-hari hidup di dalam suatu field.

## Definisi Field

Sebuah **field** adalah ring komutatif dengan satuan $(F, +, \\cdot)$
di mana setiap elemen non-nol memiliki invers perkalian.

Dengan kata lain, $(F \\setminus \\{0\\}, \\cdot)$ adalah grup abelian.

**Contoh field:**
- $\\mathbb{Q}$ — bilangan rasional
- $\\mathbb{R}$ — bilangan real
- $\\mathbb{C}$ — bilangan kompleks
- $\\mathbb{F}_p = \\mathbb{Z}/p\\mathbb{Z}$ untuk $p$ prima — **finite field** (field berhingga)

## Field Berhingga (Galois Field)

Field berhingga, sering dinotasikan $\\mathbb{F}_q$ atau $GF(q)$, adalah
field dengan jumlah elemen terbatas. Teorema fundamental menyatakan:

> Sebuah field berhingga dengan tepat $q$ elemen ada jika dan hanya jika
> $q = p^n$ untuk suatu bilangan prima $p$ dan bilangan bulat positif $n$.

Field berhingga unik hingga isomorfisme, artinya $GF(p^n)$ adalah
satu-satunya field (sampai isomorfisme) dengan $p^n$ elemen.

Aplikasi field berhingga sangat luas, mulai dari **kode koreksi error**
(Reed-Solomon codes) hingga **kriptografi** (AES menggunakan $GF(2^8)$).

## Ekstension Field

Diberikan field $F$. Sebuah **ekstension field** dari $F$ adalah field $E$
yang mengandung $F$ sebagai subfield. Kita tuliskan $E/F$.

**Contoh:**
- $\\mathbb{R}/\\mathbb{Q}$ — bilangan real adalah ekstension dari rasional
- $\\mathbb{C}/\\mathbb{R}$ — bilangan kompleks adalah ekstension dari real
- $\\mathbb{Q}(\\sqrt{2})/\\mathbb{Q}$ — field yang diperoleh dengan
  "menambahkan" $\\sqrt{2}$ ke $\\mathbb{Q}$

## Derajat Ekstension

Derajat ekstension $E/F$, dinotasikan $[E : F]$, adalah dimensi $E$
sebagai ruang vektor atas $F$.

$$[\\mathbb{C} : \\mathbb{R}] = 2 \\quad \\text{(basis: } \\{1, i\\}\\text{)}$$
$$[\\mathbb{Q}(\\sqrt{2}) : \\mathbb{Q}] = 2 \\quad \\text{(basis: } \\{1, \\sqrt{2}\\}\\text{)}$$

**Teorema multiplicatif:** Jika $F \\subseteq K \\subseteq E$, maka
$$[E : F] = [E : K] \\cdot [K : F]$$

## Elemen Aljabar dan Transenden

Elemen $\\alpha \\in E$ disebut **aljabar** atas $F$ jika ia merupakan
akar dari suatu polinomial tak-nol dengan koefisien di $F$.
Jika tidak, $\\alpha$ disebut **transenden** atas $F$.

- $\\sqrt{2}$ aljabar atas $\\mathbb{Q}$ karena merupakan akar $x^2 - 2$
- $\\pi$ dan $e$ transenden atas $\\mathbb{Q}$ (sulit dibuktikan!)

Untuk elemen aljabar $\\alpha$, polinomial minimal $\\text{min}_F(\\alpha)$
adalah polinomial monik berderajat terkecil di $F[x]$ yang memiliki $\\alpha$
sebagai akar. Derajatnya sama dengan $[F(\\alpha) : F]$.

## Menuju Teori Galois

Teori Galois menghubungkan **ekstension field** dengan **teori grup**
secara mendalam. Kunci utamanya adalah **grup Galois** $\\text{Gal}(E/F)$,
yaitu grup dari semua automorfisme field $E$ yang memfiksasi $F$.

Korespondensi Galois menyatakan:

> Ada korespondensi yang membalik inklusi (order-reversing bijection)
> antara subgrup dari $\\text{Gal}(E/F)$ dan intermediate field antara $F$ dan $E$.

Ini adalah jembatan yang memungkinkan kita menjawab pertanyaan geometri
kuno — seperti mengapa **tidak mungkin** membuat triseksi sudut sembarang
hanya dengan jangka dan penggaris — menggunakan aljabar abstrak.
`,
  },
  {
    title: 'Homomorfisme dan Teorema Isomorfisme',
    slug: 'homomorfisme-dan-teorema-isomorfisme',
    status: 'published',
    publishedAt: new Date('2026-09-29T08:00:00Z'),
    content: `# Homomorfisme dan Teorema Isomorfisme

Salah satu pertanyaan sentral dalam aljabar abstrak adalah:
"Kapan dua struktur aljabar pada dasarnya *sama*?" Jawaban formalnya
ada di konsep **homomorfisme** dan **isomorfisme**.

## Homomorfisme Grup

Fungsi $\\phi: G \\to H$ antara dua grup disebut **homomorfisme** jika
ia menjaga operasi grup:
$$\\phi(a \\cdot_G b) = \\phi(a) \\cdot_H \\phi(b) \\quad \\text{untuk semua } a, b \\in G$$

Sifat-sifat otomatis yang terpenuhi:
- $\\phi(e_G) = e_H$
- $\\phi(a^{-1}) = \\phi(a)^{-1}$

### Kernel dan Image

- **Kernel:** $\\ker(\\phi) = \\{g \\in G \\mid \\phi(g) = e_H\\}$
- **Image:** $\\text{Im}(\\phi) = \\{\\phi(g) \\mid g \\in G\\} \\subseteq H$

Kernel selalu merupakan **subgrup normal** dari $G$, dan image selalu
merupakan subgrup dari $H$.

## Jenis Homomorfisme

| Nama | Sifat |
|---|---|
| **Monomorfisme** | Injektif (satu-satu) |
| **Epimorfisme** | Surjektif (onto) |
| **Isomorfisme** | Bijektif (satu-satu dan onto) |
| **Endomorfisme** | $G = H$ (domain = kodomain) |
| **Automorfisme** | Isomorfisme dengan $G = H$ |

Dua grup $G$ dan $H$ dikatakan **isomorfik**, ditulis $G \\cong H$, jika
terdapat isomorfisme antara keduanya. Grup yang isomorfik memiliki
struktur yang identik — hanya label elemen yang berbeda.

## Subgrup Normal dan Grup Quotient

Subgrup $N \\leq G$ disebut **normal**, ditulis $N \\trianglelefteq G$, jika
untuk setiap $g \\in G$:
$$gNg^{-1} = N$$

Normalitas diperlukan agar **grup quotient** $G/N$ terdefinisi dengan baik
sebagai grup dengan operasi:
$$(aN)(bN) = (ab)N$$

## Teorema Isomorfisme Pertama

> **Teorema Isomorfisme I:** Jika $\\phi: G \\to H$ adalah homomorfisme grup,
> maka $\\ker(\\phi) \\trianglelefteq G$ dan
> $$G / \\ker(\\phi) \\cong \\text{Im}(\\phi)$$

Secara intuitif, teorema ini mengatakan bahwa setiap homomorfisme
"mengidentifikasikan" elemen-elemen yang dipetakan ke nilai yang sama,
dan hasilnya persis isomorfik dengan image-nya.

**Contoh:**

Definisikan $\\phi: \\mathbb{Z} \\to \\mathbb{Z}/n\\mathbb{Z}$ dengan $\\phi(k) = k \\bmod n$.
Ini adalah epimorfisme dengan $\\ker(\\phi) = n\\mathbb{Z}$. Oleh teorema di atas:
$$\\mathbb{Z} / n\\mathbb{Z} \\cong \\mathbb{Z}/n\\mathbb{Z} \\checkmark$$

## Teorema Isomorfisme Kedua dan Ketiga

**Teorema II:** Jika $H \\leq G$ dan $N \\trianglelefteq G$, maka:
$$H/(H \\cap N) \\cong HN/N$$

**Teorema III:** Jika $N \\trianglelefteq M \\trianglelefteq G$ dan $N \\trianglelefteq G$, maka:
$$(G/N)/(M/N) \\cong G/M$$

Ketiga teorema ini membentuk fondasi untuk menganalisis struktur grup
yang kompleks dengan cara yang sistematis. Di post berikutnya, kita akan
menggunakan alat-alat ini untuk membuktikan **Teorema Sylow** — salah satu
hasil paling powerful dalam teori grup berhingga.
`,
  },
  {
    title: 'Teorema Sylow: Klasifikasi Grup Berhingga',
    slug: 'teorema-sylow-klasifikasi-grup-berhingga',
    status: 'draft',
    publishedAt: null,
    content: `# Teorema Sylow: Klasifikasi Grup Berhingga

Teorema Sylow adalah seperangkat tiga teorema yang memberikan informasi
rinci tentang subgrup dari grup berhingga. Bersama-sama, mereka adalah
alat paling kuat untuk mengklasifikasikan grup berhingga.

## Latar Belakang

Teorema Lagrange menyatakan bahwa orde subgrup membagi orde grup.
Pertanyaan sebaliknya — apakah untuk setiap pembagi $d$ dari $|G|$
selalu ada subgrup berorde $d$? — jawabannya **tidak** secara umum.

Namun, untuk **pembagi prima-power**, Teorema Sylow menjamin keberadaannya.

## Definisi Sylow $p$-Subgrup

Diberikan grup berhingga $G$ dengan $|G| = p^n m$ di mana $p$ adalah
bilangan prima dan $\\gcd(p, m) = 1$.

Subgrup $P \\leq G$ dengan $|P| = p^n$ disebut **Sylow $p$-subgrup** dari $G$.

## Tiga Teorema Sylow

### Teorema I — Eksistensi
> Untuk setiap bilangan prima $p$ yang membagi $|G|$, terdapat Sylow
> $p$-subgrup dari $G$.

### Teorema II — Konjugasi
> Semua Sylow $p$-subgrup dari $G$ adalah konjugat satu sama lain.
> Artinya, jika $P$ dan $Q$ keduanya adalah Sylow $p$-subgrup, maka
> terdapat $g \\in G$ sedemikian sehingga $Q = gPg^{-1}$.

### Teorema III — Jumlah
> Banyaknya Sylow $p$-subgrup dari $G$, dinotasikan $n_p$, memenuhi:
> 1. $n_p \\mid m$ (membagi bagian non-$p$ dari $|G|$)
> 2. $n_p \\equiv 1 \\pmod{p}$

## Aplikasi: Klasifikasi Grup Berorde Kecil

Teorema Sylow sangat berguna untuk membuktikan bahwa grup berorde
tertentu harus isomorfik ke grup yang kita kenal.

**Contoh: Grup berorde 15**

Misalkan $|G| = 15 = 3 \\cdot 5$. Maka:
- $n_3 \\mid 5$ dan $n_3 \\equiv 1 \\pmod{3}$, sehingga $n_3 = 1$.
- $n_5 \\mid 3$ dan $n_5 \\equiv 1 \\pmod{5}$, sehingga $n_5 = 1$.

Karena $n_3 = n_5 = 1$, kedua Sylow subgrup bersifat normal.
Oleh karena itu $G \\cong \\mathbb{Z}_3 \\times \\mathbb{Z}_5 \\cong \\mathbb{Z}_{15}$.

**Kesimpulan:** Setiap grup berorde 15 bersifat siklik.

## Contoh Lain: Grup Berorde $p^2$

Jika $|G| = p^2$ untuk suatu prima $p$, maka $G$ abelian, dan
$G \\cong \\mathbb{Z}_{p^2}$ atau $G \\cong \\mathbb{Z}_p \\times \\mathbb{Z}_p$.

## Grup Sederhana

Sebuah grup $G$ (dengan $|G| > 1$) disebut **sederhana** (simple) jika
satu-satunya subgrup normal $G$ adalah $\\{e\\}$ dan $G$ sendiri.

Teorema Sylow sering digunakan untuk membuktikan bahwa suatu grup
**tidak** sederhana. Jika $n_p = 1$ untuk suatu prima $p$ yang membagi
$|G|$, maka Sylow $p$-subgrup tersebut normal, menunjukkan $G$ tidak sederhana.

## Ke Depan: Teori Galois

Pemahaman mendalam tentang grup berhingga — khususnya **grup sederhana** —
adalah kunci untuk memahami mengapa persamaan polinomial derajat $\\geq 5$
tidak dapat diselesaikan dengan rumus radikal (teorema Abel-Ruffini).
Ini akan menjadi puncak dari seri aljabar abstrak ini.
`,
  },
];

async function main() {
  // Cari admin
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    console.error(
      `Admin account tidak ditemukan (${ADMIN_EMAIL}). Jalankan seed.ts terlebih dahulu.`
    );
    process.exit(1);
  }

  console.log(`Membuat post blog untuk admin: ${admin.email}`);

  let created = 0;
  let skipped = 0;

  for (const post of posts) {
    const existing = await prisma.post.findUnique({ where: { slug: post.slug } });
    if (existing) {
      console.log(`  [skip] "${post.title}" sudah ada.`);
      skipped++;
      continue;
    }

    await prisma.post.create({
      data: {
        title: post.title,
        slug: post.slug,
        content: post.content,
        status: post.status,
        publishedAt: post.publishedAt,
      },
    });

    console.log(`  [ok]   "${post.title}" (${post.status})`);
    created++;
  }

  console.log(`\nSelesai: ${created} post dibuat, ${skipped} dilewati.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
