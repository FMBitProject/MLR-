# Perbaikan audit keamanan

Status kode: 1 CRITICAL dan 9 MEDIUM diperbaiki; 2 MINOR dicatat tanpa perubahan perilaku. Deploy dan migrasi production belum dijalankan.

| Severity | Risiko sebelumnya | Perbaikan |
|---|---|---|
| CRITICAL | Secret Compose publik memungkinkan pemalsuan sesi lama | Secret production wajib, nilai default lemah ditolak; sesi memakai token acak yang dicatat di server |
| MEDIUM | Password demo publik memberi akses akun admin | Hapus quick-login dan seed otomatis; seed lokal perlu password privat; migrasi menonaktifkan identitas demo lama |
| MEDIUM | Sesi curian tetap berlaku setelah logout/reset | Kedaluwarsa server 7 hari, pencabutan saat logout/reset, pemeriksaan ulang password ketika menerbitkan sesi |
| MEDIUM | Cookie bisa terkirim melalui HTTP | Cookie Secure di production; Compose melayani HTTPS melalui Caddy |
| MEDIUM | Referensi elemen asing membocorkan teks dokumen tenant lain | Validasi elemen terhadap versi, pembatasan pembacaan versi sebelumnya, serta foreign key gabungan |
| MEDIUM | Tahap pending dapat diputuskan dan melewati review wajib | Transaksi dengan lock submission, validasi urutan dan status; approval akhir mensyaratkan seluruh tahap approved |
| MEDIUM | Token akun mentah di DB dapat dipakai ulang atau ditebus bersamaan | Simpan hash SHA-256, validasi tujuan/expiry, tebus sekali secara atomik |
| MEDIUM | ZIP Office kecil dapat menghabiskan memori/CPU | Batasi hasil dekompresi, XML, jumlah entri/slide/paragraf, teks, dan waktu pemrosesan |
| MEDIUM | CSV dapat menjalankan formula saat dibuka di spreadsheet | Netralisasi awalan formula dan karakter kontrol, dengan escaping CSV |
| MEDIUM | Reuse dan request serentak melewati kuota | Create/reuse memakai pemeriksaan kuota dan insert dalam transaksi dengan lock tenant |

## Penerapan

1. Cadangkan database dan jadwalkan penghentian instance aplikasi lama selama migrasi. Kode lama tidak kompatibel dengan perubahan kolom token.
2. Atur secret production acak (`openssl rand -hex 32`), koneksi database, dan `APP_URL` HTTPS. Compose membutuhkan `APP_HOST`, `AUTH_SECRET`, serta password database yang berlaku. Muat nilai yang sama pada setiap pemanggilan Compose; jangan mengganti password database yang sudah ada hanya melalui environment.
3. Jalankan `npm run db:migrate` dari folder `app` menggunakan database tujuan, lalu jalankan versi aplikasi baru. Compose menjalankan migrasi sebelum aplikasi mulai. Migrasi `0008_security_controls.sql` membuat tabel sesi, mengganti kolom token, menghapus token lama, memperbaiki pin komentar lintas versi, dan menonaktifkan identitas seed demo lama sambil mempertahankan konten/audit.
4. Semua pengguna perlu login kembali. Tautan verifikasi, reset, dan undangan yang diterbitkan sebelum migrasi kedaluwarsa. Pengguna terdaftar dapat meminta verifikasi/reset baru. Untuk undangan tertunda, penerima dapat meminta verifikasi email dahulu, kemudian reset password setelah terverifikasi. Identitas demo lama juga dinonaktifkan bila passwordnya pernah diganti; jangan mengandalkannya untuk akses admin production.
5. Pastikan DNS hostname Compose mengarah ke server dan port 80/443 tersedia bagi Caddy. Uji login, reset, dan alur review melalui HTTPS setelah penerapan.

## TODO MINOR — belum diubah

- Respons login akun belum terverifikasi dan registrasi `email_taken` masih dapat mengungkap keberadaan akun. Samakan respons publik tanpa menghilangkan petunjuk pemulihan yang diperlukan pengguna.
- `experimental.serverActions.allowedOrigins` masih berisi wildcard proxy development; batasi origin dan pisahkan konfigurasinya dari production. Komentar TODO juga ada di `next.config.ts`.
- Review lanjutan: sesi kedaluwarsa masih tersimpan. Tambahkan pembersihan berkala pada perubahan terpisah; pemeriksaan expiry saat autentikasi tetap berlaku.

## Perbaikan review lanjutan

- **CRITICAL — submission parsial:** create/reuse menyimpan reservasi kuota, tahap review, versi, render, file database, dan audit dalam transaksi yang sama. Penolakan Office atau kegagalan penyimpanan membatalkan seluruh perubahan database; pekerjaan latar belakang hanya dijadwalkan setelah commit.
- **CRITICAL — approval versi belum siap:** server mensyaratkan status `ready`, halaman, elemen, dan keberadaan file master bila versi berasal dari upload. Pemeriksaan ulang memakai lock submission yang sama dengan approval. Kegagalan pemeriksaan menghasilkan status `failed`, memblokir approval, dan dapat dicoba ulang dari UI.
- **MEDIUM — timeout XML:** ekstraksi paragraf/text memakai scanner maju tanpa regex backtracking, dengan pemeriksaan deadline selama pemindaian. XML dengan tag bersarang/tidak lengkap berhenti cepat; batas dekompresi tetap berlaku.
- **MEDIUM — audit resubmit:** audit berada dalam transaksi versi/workflow. Jika audit gagal, versi baru dan reset tahap dibatalkan sehingga retry tidak menggandakan versi akibat kegagalan tersebut.

Perbaikan lanjutan ini tidak membutuhkan migrasi tambahan di luar `0008` dari audit pertama. Tidak ada perubahan otomatis terhadap submission parsial yang mungkin sudah ada; versi yang belum lengkap ditolak saat approval. Driver file lokal khusus development tetap menggunakan filesystem di luar transaksi database.

## Validasi

Suite utama, typecheck aplikasi/test, build production, dan regresi security dijalankan. Test integrasi di `tests/security-integration.test.ts` membutuhkan `SECURITY_TEST_DATABASE_URL` menuju database PostgreSQL lokal khusus (`mlr_security` atau `mlr_security_fresh`); test menerapkan migrasi dan menulis fixture, sehingga tidak boleh diarahkan ke database pengguna.
