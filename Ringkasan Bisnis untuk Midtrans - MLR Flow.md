# Ringkasan Bisnis — MLR Flow

**Untuk:** Pengajuan merchant/onboarding Midtrans
**Tanggal:** 4 Agustus 2026
**Disiapkan oleh:** [Nama Anda]

> Dokumen ini adalah ringkasan bisnis yang diringkas dari PRD produk internal ("PRD MLR Workflow.md") khusus untuk kebutuhan business review Midtrans. Bagian yang berisi `[BELUM DIISI: ...]` adalah data faktual (identitas badan hukum, angka aktual) yang belum bisa saya isikan sendiri — mohon dilengkapi sebelum dokumen ini dikirim.

---

## 1. Identitas Bisnis

| Item | Detail |
|---|---|
| Nama produk/brand | MLR Flow |
| Nama badan hukum | `[BELUM DIISI: nama PT sesuai akta/NIB]` |
| NPWP badan usaha | `[BELUM DIISI]` |
| Alamat terdaftar | `[BELUM DIISI]` |
| Website | `[BELUM DIISI: domain produksi]` |
| Kontak bisnis | `[BELUM DIISI: email & telepon]` |
| Jenis usaha | B2B SaaS (Software-as-a-Service), model langganan bulanan |

---

## 2. Apa yang Dijual

MLR Flow adalah aplikasi SaaS yang mendigitalkan proses review Medical-Legal-Regulatory (MLR) untuk materi promosi obat di perusahaan farmasi — menggantikan alur email/WhatsApp dengan alur kerja terstruktur, versi konten yang terkontrol, dan jejak audit lengkap. Pelanggan adalah **perusahaan** (bukan konsumen perorangan): tim Marketing, Medical, Legal, dan Regulatory Affairs di perusahaan farmasi menggunakan satu workspace bersama per perusahaan.

Target pasar: perusahaan farmasi skala kecil–menengah di Indonesia yang butuh disiplin review MLR dan jejak audit siap-inspeksi BPOM, tapi tidak butuh (atau tidak mampu membayar) tool kelas enterprise seperti Veeva Vault PromoMats.

---

## 3. Model Bisnis & Skema Harga

Langganan bulanan, self-serve, ditagih via invoice (bukan potong kartu otomatis berulang):

| Paket | Harga normal | Harga promo (s.d. 31 Des 2026) |
|---|---|---|
| Starter | Gratis selamanya | — |
| Growth | Rp 1.000.000/bulan | Rp 799.000/bulan |
| Enterprise | Rp 3.000.000/bulan | Rp 1.500.000/bulan |

- Paket Starter gratis tidak pernah menghasilkan invoice atau transaksi Midtrans — hanya paket berbayar (Growth, Enterprise) yang bertransaksi.
- Setiap periode ditagih di muka lewat invoice bulanan; admin workspace membayar sendiri (self-serve) dari halaman Billing.
- Tidak ada auto-charge kartu tersimpan berulang — setiap pembayaran adalah transaksi Snap baru per invoice.
- Bila lewat jatuh tempo, ada masa tenggang 7 hari (akses tetap penuh), lalu workspace masuk mode baca-saja sampai dibayar — bukan penangguhan langsung.
- Harga di atas belum termasuk PPN.

---

## 4. Metode Pembayaran yang Dibutuhkan

Via Midtrans Snap:
- Transfer bank / Virtual Account
- QRIS
- E-wallet
- Kartu kredit/debit

Semua transaksi dalam **IDR**. Cakupan bisnis saat ini **Indonesia-domestik saja** — belum ada kebutuhan pembayaran lintas negara/mata uang asing di roadmap saat ini.

---

## 5. Alur Transaksi (Integrasi Teknis)

1. Admin workspace memilih paket di halaman Billing → sistem membuat satu invoice internal.
2. Backend membuat **Snap transaction** ke Midtrans dengan `order_id` = ID invoice, nominal sesuai paket, dan `finish_url` kembali ke aplikasi.
3. Pelanggan diarahkan ke halaman pembayaran hosted Midtrans, memilih metode pembayaran, dan membayar.
4. Midtrans mengirim **HTTP notification (webhook)** ke endpoint aplikasi; signature `sha512(order_id + status_code + gross_amount + server_key)` diverifikasi sebelum status apa pun diproses.
5. Status `settlement` atau `capture` (fraud status `accept`) → invoice ditandai lunas, masa aktif paket diperpanjang otomatis. Status `expire`/`cancel`/`deny`/`failure` → invoice ditandai gagal, pelanggan bisa membuat transaksi baru.

Referensi implementasi: [midtrans.ts](app/src/lib/midtrans.ts), [billing.ts](app/src/lib/billing.ts).

Aplikasi **tidak pernah menerima, memproses, atau menyimpan data kartu pelanggan** — seluruhnya ditangani di sisi Midtrans (hosted payment page).

---

## 6. Estimasi Volume Transaksi

`[BELUM DIISI: estimasi jumlah tenant berbayar dan transaksi/bulan dalam 3–6 bulan pertama. Contoh format yang biasanya diminta Midtrans: jumlah merchant/pelanggan aktif, rata-rata nilai transaksi (Rp 799rb–Rp 1,5jt per invoice sesuai tabel di atas), dan proyeksi transaksi bulanan.]`

Karakteristik yang relevan untuk risk assessment Midtrans:
- Nilai transaksi kecil dan seragam (satu dari tiga nominal tetap sesuai paket), bukan nominal bebas yang diinput pelanggan.
- Frekuensi rendah per pelanggan (1x per bulan per workspace), bukan transaksi berulang cepat.
- Bukan marketplace/reseller — MLR Flow adalah penjual langsung ke pelanggan atas layanannya sendiri (bukan memfasilitasi transaksi pihak ketiga).

---

## 7. Catatan Kepatuhan & Data (relevan untuk business review)

- Data yang diproses adalah **materi promosi & data akun bisnis**, bukan data kesehatan/rekam medis pasien — aplikasi secara eksplisit melarang unggahan data pribadi pasien (lihat Syarat & Ketentuan §8).
- Data per perusahaan terisolasi berdasarkan `tenant_id`.
- Data yang dikirim ke Midtrans terbatas pada: nama, email, nomor order (invoice), dan nominal — sesuai yang tercantum di Kebijakan Privasi aplikasi.

---

## 8. Lampiran / Referensi

- Dokumen produk lengkap (teknis): `PRD MLR Workflow.md` (di repo yang sama)
- Syarat & Ketentuan dan Kebijakan Privasi publik: `[BELUM DIISI: URL /terms dan /privacy setelah domain produksi ada]`
- Kontak teknis untuk integrasi: `[BELUM DIISI]`

---

*Dokumen ini disiapkan untuk keperluan pengajuan merchant ke Midtrans dan bukan dokumen produk lengkap. Untuk detail teknis/fitur produk, lihat PRD MLR Workflow.md.*
