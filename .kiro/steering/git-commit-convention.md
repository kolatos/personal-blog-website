# Git Commit Message Convention

Semua commit mengikuti format **Conventional Commits** yang dimodifikasi untuk proyek ini.

## Format

```
<type>(<scope>): <subject>

[body opsional]

[footer opsional]
```

### Aturan Baris Pertama

- Panjang maksimal **72 karakter**
- Gunakan **imperatif** untuk subject: "add feature" bukan "added feature" atau "adds feature"
- Tidak diakhiri tanda titik
- `type` dan `scope` ditulis **lowercase**

---

## Type

| Type | Kapan Digunakan |
|---|---|
| `feat` | Fitur baru yang terlihat oleh pengguna |
| `fix` | Perbaikan bug |
| `refactor` | Perubahan kode yang bukan fitur baru dan bukan bug fix |
| `style` | Perubahan formatting, whitespace, atau kode tanpa efek logika |
| `test` | Menambah atau memperbaiki test |
| `docs` | Perubahan dokumentasi saja |
| `chore` | Pembaruan dependency, konfigurasi build, tooling |
| `perf` | Peningkatan performa |
| `ci` | Perubahan konfigurasi CI/CD |
| `revert` | Membatalkan commit sebelumnya |
| `db` | Perubahan Prisma schema atau migrasi database |

---

## Scope

Scope adalah bagian opsional yang mempersempit konteks perubahan. Gunakan nama modul, layer, atau fitur yang relevan.

**Scope yang umum digunakan:**

| Scope | Konteks |
|---|---|
| `auth` | Login, register, JWT, lockout |
| `post` | Blog post CRUD, slug, status |
| `comment` | Komentar dan reply |
| `user` | Profil pengguna, admin users |
| `about` | Seksi About/CV |
| `project` | Seksi Projects |
| `fun` | Seksi Fun |
| `module` | Learning modules |
| `path` | Learning paths |
| `flashcard` | Flashcard dan spaced repetition |
| `note` | User notes dan highlight |
| `subscription` | Email subscription |
| `admin` | Dashboard admin, stats |
| `search` | Full-text search |
| `api` | Perubahan API lintas fitur |
| `ui` | Komponen UI umum, shadcn |
| `schema` | Prisma schema |
| `migration` | File migrasi database |
| `middleware` | Express middleware |
| `docker` | Dockerfile, docker-compose |
| `env` | Variabel environment, config |
| `e2e` | Playwright E2E tests |
| `deps` | Pembaruan dependency |

---

## Contoh

```
feat(post): add tag filtering to blog list

fix(auth): prevent login after account lockout expires

refactor(comment): migrate postId to generic contentType/contentId

test(auth): add property tests for token blacklist uniqueness

db(migration): add Tag and PostTag models for post tagging

chore(deps): update prisma to 5.x

feat(module): implement SM-2 spaced repetition for flashcard review

docs: update README with Docker setup instructions

revert: revert "feat(fun): add feed filter by type"
```

---

## Body (opsional)

Gunakan body ketika subject tidak cukup menjelaskan *mengapa* perubahan dilakukan, bukan *apa* yang diubah. Pisahkan dari subject dengan satu baris kosong. Bungkus di **72 karakter**.

```
fix(auth): hash token before inserting into blacklist

Token was previously stored in plaintext. An attacker with read
access to the database could reuse valid tokens. Hashing with
SHA-256 mitigates this without requiring additional secret material.
```

---

## Footer (opsional)

Gunakan untuk referensi issue atau breaking change.

```
feat(comment): add parentId support for 1-level replies

BREAKING CHANGE: comment endpoint now requires contentType and
contentId instead of postId

Closes #42
```

---

## Hal yang Dihindari

- ❌ `fix stuff` — terlalu samar
- ❌ `WIP` — jangan commit WIP ke branch utama
- ❌ `update files` — tidak informatif
- ❌ Mencampur banyak concern berbeda dalam satu commit
- ❌ Subject lebih dari 72 karakter
- ❌ Commit message dalam bahasa campuran — pilih **English** untuk semua commit message (code is English)
