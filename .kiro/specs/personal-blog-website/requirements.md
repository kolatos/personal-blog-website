# Requirements Document

## Introduction

Personal Blog Website adalah aplikasi web full-stack yang memungkinkan seorang admin (pemilik blog) untuk membuat, mengelola, dan mempublikasikan postingan blog. Pengunjung dapat membuat akun terdaftar khusus untuk memberikan komentar pada postingan yang telah dipublikasikan. Aplikasi dibangun menggunakan TypeScript, React, Tailwind CSS, dan PostgreSQL.

## Glossary

- **System**: Aplikasi Personal Blog Website secara keseluruhan
- **Admin**: Pemilik blog yang memiliki akses penuh untuk mengelola postingan (satu akun tetap, dikonfigurasi di sisi server)
- **Visitor**: Pengguna yang belum login, hanya dapat membaca postingan
- **Registered_User**: Pengunjung yang telah mendaftar dan login, dapat memberikan komentar
- **Post**: Tulisan/artikel yang dibuat oleh Admin
- **Comment**: Komentar yang ditulis oleh Registered_User pada sebuah Post
- **Auth_Service**: Layanan autentikasi yang mengelola login, registrasi, dan sesi pengguna
- **Post_Service**: Layanan yang mengelola operasi CRUD pada Post
- **Comment_Service**: Layanan yang mengelola operasi CRUD pada Comment
- **Draft**: Status Post yang belum dipublikasikan, hanya dapat dilihat oleh Admin
- **Published**: Status Post yang telah dipublikasikan dan dapat dilihat oleh semua pengguna
- **Slug**: URL-friendly identifier unik yang dihasilkan dari judul Post
- **JWT**: JSON Web Token yang digunakan sebagai bukti autentikasi sesi

---

## Requirements

### Requirement 1: Autentikasi Admin

**User Story:** Sebagai Admin, saya ingin dapat login ke sistem, sehingga saya dapat mengakses fitur pengelolaan blog secara eksklusif.

#### Acceptance Criteria

1. WHEN Admin mengirimkan kredensial yang valid (username tidak kosong dengan panjang maksimal 100 karakter dan password tidak kosong dengan panjang minimal 8 karakter dan maksimal 128 karakter), THE Auth_Service SHALL mengautentikasi Admin dan mengembalikan JWT dengan masa berlaku tepat 24 jam.
2. WHEN Admin berhasil login, THE System SHALL mengarahkan Admin ke halaman dashboard pengelolaan postingan dalam waktu paling lama 3 detik setelah autentikasi berhasil.
3. IF Admin mengirimkan kredensial yang tidak valid, THEN THE Auth_Service SHALL menolak permintaan autentikasi dan mengembalikan pesan error yang tidak mengungkapkan field mana yang salah.
4. IF Admin mengirimkan kredensial yang tidak valid sebanyak 5 kali berturut-turut, THEN THE Auth_Service SHALL memblokir upaya login dari akun tersebut selama 15 menit dan menampilkan pesan error yang mengindikasikan bahwa akun sementara dikunci.
5. IF JWT Admin telah kedaluwarsa, THEN THE Auth_Service SHALL menolak semua permintaan yang memerlukan autentikasi dan mengembalikan respons error yang mengindikasikan sesi tidak valid.
6. WHEN Admin melakukan logout, THE Auth_Service SHALL menginvalidasi JWT aktif sehingga token tersebut tidak dapat digunakan kembali untuk permintaan apapun.
7. WHEN Auth_Service berhasil menginvalidasi sesi Admin, THE System SHALL mengarahkan Admin ke halaman beranda.

---

### Requirement 2: Registrasi dan Autentikasi Registered User

**User Story:** Sebagai Visitor, saya ingin dapat mendaftar dan login ke sistem, sehingga saya dapat memberikan komentar pada postingan blog.

#### Acceptance Criteria

1. WHEN Visitor mengisi formulir registrasi dengan email unik yang valid, username unik dengan panjang 3–50 karakter, dan password minimal 8 karakter, THE Auth_Service SHALL membuat akun Registered_User baru dan mengembalikan respons sukses dengan HTTP status 201.
2. IF Visitor mendaftar menggunakan email atau username yang sudah terdaftar, THEN THE Auth_Service SHALL mengembalikan pesan error yang menginformasikan field mana yang sudah digunakan dengan HTTP status 409.
3. IF Visitor mengisi password dengan kurang dari 8 karakter saat registrasi, THEN THE System SHALL mengembalikan pesan validasi error yang mengindikasikan persyaratan password tidak terpenuhi, baik pada sisi klien sebelum pengiriman maupun pada sisi server jika validasi klien terlewati.
4. WHEN Registered_User mengirimkan email atau username yang terdaftar beserta password yang benar, THE Auth_Service SHALL mengautentikasi Registered_User dan mengembalikan JWT dengan masa berlaku 7 hari.
5. IF Registered_User mengirimkan kredensial login yang tidak valid, THEN THE Auth_Service SHALL mengembalikan pesan error dengan HTTP status 401 tanpa mengungkapkan apakah email/username atau password yang salah.
6. THE Auth_Service SHALL menyimpan password pengguna dalam bentuk hash menggunakan algoritma yang aman sebelum disimpan ke database.

---

### Requirement 3: Membuat dan Mengedit Postingan

**User Story:** Sebagai Admin, saya ingin dapat membuat dan mengedit postingan blog, sehingga saya dapat mempublikasikan konten untuk pembaca.

#### Acceptance Criteria

1. WHEN Admin mengirimkan formulir pembuatan postingan baru dengan judul (1–200 karakter) dan konten yang tidak kosong, THE Post_Service SHALL menyimpan Post baru dengan status Draft dan Slug yang dihasilkan secara otomatis dari judul.
2. THE Post_Service SHALL menghasilkan Slug yang unik; IF Slug yang dihasilkan dari judul sudah ada, THEN THE Post_Service SHALL menambahkan suffix numerik pada Slug (contoh: `judul-post-2`).
3. WHEN Admin menyimpan perubahan pada Post yang sudah ada termasuk perubahan judul, THE Post_Service SHALL memperbarui konten Post, menghasilkan ulang Slug jika judul berubah, dan mencatat timestamp pembaruan terakhir dalam UTC.
4. IF Admin mengedit sebuah Post berstatus Published, THEN THE Post_Service SHALL mengubah status Post menjadi Draft secara otomatis dan mewajibkan Admin untuk mempublikasikan ulang setelah perubahan selesai.
5. IF Admin mengirimkan formulir Post dengan judul kosong, judul yang hanya terdiri dari spasi, atau konten kosong, THEN THE Post_Service SHALL mengembalikan pesan validasi error yang mengidentifikasi setiap field yang tidak valid dan tidak menyimpan data.
6. WHERE Admin mengaktifkan fitur pratinjau, THE System SHALL menampilkan konten Post dengan Markdown yang telah dirender menjadi HTML, sebagaimana yang akan ditampilkan kepada Visitor setelah dipublikasikan.
7. THE Post_Service SHALL mendukung konten postingan dalam format Markdown yang dirender menjadi HTML pada saat Post ditampilkan.

---

### Requirement 4: Mempublikasikan dan Mengelola Status Postingan

**User Story:** Sebagai Admin, saya ingin dapat mempublikasikan, menarik kembali, dan menghapus postingan, sehingga saya dapat mengontrol konten yang tersedia untuk publik.

#### Acceptance Criteria

1. WHEN Admin mempublikasikan sebuah Post berstatus Draft, THE Post_Service SHALL mengubah status Post menjadi Published dan mencatat timestamp publikasi.
2. WHEN Admin menarik kembali sebuah Post berstatus Published, THE Post_Service SHALL mengubah status Post menjadi Draft sehingga Post tidak lagi dikembalikan dalam respons permintaan konten publik.
3. WHEN Admin menghapus sebuah Post yang ada, THE Post_Service SHALL menghapus Post beserta seluruh Comment yang terkait secara permanen dari database.
4. IF Admin mencoba mengakses endpoint pengelolaan Post tanpa JWT yang valid, THEN THE Post_Service SHALL menolak permintaan dengan respons error yang menginformasikan bahwa akses ditolak.
5. WHEN Admin membuka halaman dashboard, THE Post_Service SHALL menampilkan daftar semua Post (Draft dan Published) dengan maksimum 20 Post per halaman, diurutkan berdasarkan tanggal pembaruan terakhir secara descending.
6. IF Admin mencoba mengubah status Post ke status yang sama (mempublikasikan Post yang sudah Published atau menarik Post yang sudah Draft), THEN THE Post_Service SHALL menolak permintaan dengan respons error yang menginformasikan bahwa transisi status tidak valid.
7. IF Visitor mencoba mengakses sebuah Post berstatus Draft, THEN THE Post_Service SHALL menolak permintaan dengan respons error yang menginformasikan bahwa konten tidak ditemukan.
8. IF Admin mencoba menghapus sebuah Post yang tidak ada, THEN THE Post_Service SHALL menolak permintaan dengan respons error yang menginformasikan bahwa Post tidak ditemukan.

---

### Requirement 5: Menampilkan Postingan kepada Pengunjung

**User Story:** Sebagai Visitor, saya ingin dapat membaca postingan blog yang telah dipublikasikan, sehingga saya dapat mengonsumsi konten blog.

#### Acceptance Criteria

1. THE Post_Service SHALL menampilkan hanya Post berstatus Published pada halaman beranda publik, diurutkan berdasarkan tanggal publikasi secara descending.
2. WHEN Visitor mengakses URL dengan Slug yang valid dari Post berstatus Published, THE Post_Service SHALL menampilkan konten lengkap Post tersebut.
3. IF Visitor mengakses URL dengan Slug yang tidak ada atau Post dengan status selain Published, THEN THE System SHALL menampilkan halaman 404.
4. THE System SHALL menampilkan daftar Post pada halaman beranda dengan informasi: judul, ringkasan konten (maksimal 200 karakter pertama), tanggal publikasi, dan jumlah komentar, dengan maksimum 10 Post per halaman.
5. WHEN Visitor mengirimkan pencarian dengan kata kunci yang mengandung minimal 1 karakter non-spasi, THE Post_Service SHALL menampilkan Post berstatus Published yang judul atau kontennya mengandung kata kunci tersebut, diurutkan berdasarkan tanggal publikasi secara descending.
6. IF pencarian tidak menghasilkan Post yang cocok, THEN THE System SHALL menampilkan pesan yang mengindikasikan bahwa tidak ada hasil yang ditemukan untuk kata kunci tersebut.
7. IF Visitor mengirimkan pencarian dengan kata kunci yang kosong atau hanya terdiri dari spasi, THEN THE System SHALL menampilkan pesan validasi error dan tidak mengeksekusi pencarian.

---

### Requirement 6: Sistem Komentar

**User Story:** Sebagai Registered_User, saya ingin dapat menambahkan dan menghapus komentar pada postingan, sehingga saya dapat berinteraksi dengan konten blog.

#### Acceptance Criteria

1. WHEN Registered_User yang telah login mengirimkan komentar dengan konten yang tidak kosong dan tidak melebihi 2000 karakter pada sebuah Post berstatus Published, THE Comment_Service SHALL menyimpan Comment baru yang dikaitkan dengan Post dan Registered_User tersebut.
2. IF Visitor yang belum login mencoba mengirimkan komentar, THEN THE Comment_Service SHALL menolak permintaan dengan HTTP status 401 dan menampilkan pesan yang mengarahkan Visitor untuk login terlebih dahulu.
3. WHEN Registered_User menghapus Comment miliknya sendiri, THE Comment_Service SHALL menghapus Comment tersebut secara permanen dan mengembalikan respons yang mengkonfirmasi penghapusan berhasil.
4. IF Registered_User mencoba menghapus Comment milik pengguna lain, THEN THE Comment_Service SHALL menolak permintaan dengan HTTP status 403 dan mengembalikan pesan yang mengindikasikan tidak memiliki izin.
5. WHEN Admin menghapus Comment manapun dari sebuah Post, THE Comment_Service SHALL menghapus Comment tersebut secara permanen dan mengembalikan respons yang mengkonfirmasi penghapusan berhasil.
6. WHEN Visitor atau Registered_User membuka halaman sebuah Post berstatus Published, THE Comment_Service SHALL menampilkan semua Comment pada Post tersebut diurutkan berdasarkan tanggal pembuatan secara ascending (komentar terlama di atas); IF tidak ada Comment, THEN THE System SHALL menampilkan pesan yang mengindikasikan belum ada komentar.
7. IF Registered_User mengirimkan komentar dengan konten kosong atau melebihi 2000 karakter, THEN THE Comment_Service SHALL mengembalikan pesan validasi error yang mengindikasikan batasan mana yang dilanggar dan tidak menyimpan data.

---

### Requirement 7: Keamanan dan Otorisasi

**User Story:** Sebagai pemilik sistem, saya ingin setiap endpoint API terlindungi dengan otorisasi berbasis peran, sehingga pengguna hanya dapat mengakses fitur yang sesuai dengan peran mereka.

#### Acceptance Criteria

1. THE Auth_Service SHALL membedakan peran Admin dan Registered_User melalui klaim `role` di dalam JWT payload.
2. IF JWT yang diterima tidak mengandung klaim `role`, atau nilai klaim `role` tidak dikenali sebagai Admin maupun Registered_User, THEN THE Auth_Service SHALL menolak permintaan dengan HTTP status 403 dan mengembalikan respons yang mengindikasikan otorisasi gagal.
3. IF pengguna dengan peran Registered_User mencoba mengakses endpoint yang hanya diperuntukkan bagi Admin — yaitu endpoint untuk membuat, mengedit, menghapus Post, serta endpoint manajemen pengguna — THEN THE Auth_Service SHALL menolak permintaan dengan HTTP status 403.
4. THE System SHALL menggunakan HTTPS untuk semua komunikasi antara klien dan server pada lingkungan produksi.
5. THE Auth_Service SHALL membatasi percobaan pada endpoint login dan registrasi maksimal 10 permintaan per IP address per menit, di mana penghitung permintaan direset setiap 60 detik sejak permintaan pertama dalam jendela tersebut.
6. IF jumlah permintaan dari satu IP address pada endpoint login atau registrasi melebihi 10 permintaan dalam satu jendela 60 detik, THEN THE Auth_Service SHALL menolak permintaan berikutnya dengan HTTP status 429 hingga jendela waktu berikutnya dimulai.
7. THE System SHALL memvalidasi semua input pengguna pada sisi server sebelum diproses atau disimpan; IF suatu input gagal validasi, THEN THE System SHALL menolak permintaan tersebut dengan respons yang mengindikasikan input tidak valid, tanpa memproses atau menyimpan data yang tidak valid.

---

### Requirement 8: Manajemen Profil Registered User

**User Story:** Sebagai Registered_User, saya ingin dapat melihat dan memperbarui profil saya, sehingga saya dapat mengelola informasi akun saya.

#### Acceptance Criteria

1. WHEN Registered_User yang telah login mengakses halaman profil, THE System SHALL menampilkan informasi akun: username, email, dan tanggal bergabung.
2. WHEN Registered_User mengubah username dengan nilai yang unik, tidak kosong, dan tidak melebihi 50 karakter, THE Auth_Service SHALL memperbarui username dan mengembalikan data profil terbaru.
3. IF Registered_User mengubah username dengan nilai yang sudah digunakan oleh akun lain, THEN THE Auth_Service SHALL mengembalikan pesan error yang mengindikasikan konflik username.
4. WHEN Registered_User mengubah password dengan menyertakan password lama yang benar dan password baru yang berbeda dari password lama dengan panjang antara 8 hingga 72 karakter, THE Auth_Service SHALL memperbarui password dengan hash baru.
5. IF Registered_User mengubah password dengan password lama yang salah, THEN THE Auth_Service SHALL mengembalikan pesan error yang mengindikasikan autentikasi gagal.
6. IF Registered_User mengubah password dengan password baru yang sama dengan password lama, THEN THE Auth_Service SHALL mengembalikan pesan error yang mengindikasikan password baru tidak boleh sama dengan password lama.
