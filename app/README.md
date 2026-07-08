# MLR Flow — MLR Review Workflow Tool (Lite)

Implementasi webapp dari **PRD: MLR Review Workflow Tool (Lite)** — platform B2B SaaS untuk mendigitalkan proses review Medical–Legal–Regulatory (MLR) konten promosi farmasi, dengan kategori review yang selaras Pedoman Promosi Obat.

## Menjalankan

```bash
cd app
npm install
npm run dev        # http://localhost:3000
# atau produksi:
npm run build && npm start
```

Database SQLite dibuat & di-seed otomatis di `.data/mlr.db` saat pertama dijalankan. Hapus folder `.data/` untuk reset ke data demo.

### Menjalankan dengan Docker

Dari **root repo** (bukan folder `app/`):

```bash
git pull                     # ambil kode terbaru dari GitHub
docker compose up --build -d # build image + jalankan di http://localhost:3000
docker compose logs -f       # lihat log
docker compose down          # hentikan (data tetap tersimpan)
```

Database & file upload bertahan di volume Docker `mlr-data` — `docker compose down` tidak menghapusnya (`down -v` baru menghapus). Untuk produksi, set secret sendiri lewat environment:

```bash
AUTH_SECRET=$(openssl rand -hex 32) ANTHROPIC_API_KEY=sk-ant-... docker compose up -d
```

## Akun demo (kata sandi: `demo123`)

| Email | Peran |
|---|---|
| dewi@nusantara-pharma.co.id | Marketing (pengaju konten) |
| budi@nusantara-pharma.co.id | Medical Reviewer |
| ratna@nusantara-pharma.co.id | Legal Reviewer |
| agus@nusantara-pharma.co.id | Regulatory Reviewer |
| sari@nusantara-pharma.co.id | Compliance / QA Admin |
| rudi@nusantara-pharma.co.id | Company Admin |

Halaman login menyediakan tombol quick-login untuk tiap persona.

## Fitur (pemetaan ke PRD)

- **Multi-tenant** (§7) — `tenant_id` di setiap tabel; semua query difilter dari sesi.
- **Submission + versioning** (§9.1) — resubmit membuat versi baru & mereset workflow; versi yang disetujui **terkunci permanen** (immutability NFR).
- **Workflow review terkonfigurasi** (§9.2) — urutan tahap per kanal diatur di Settings; routing otomatis ke tahap berikutnya saat disetujui, kembali ke marketing saat revisi/tolak.
- **Review visual per halaman** (§9.7) — setiap versi dirender menjadi halaman SVG; elemen punya bounding box sehingga **flag AI dan komentar ter-pin tepat di posisinya** pada render halaman. Elemen chart/OCR rendah ditandai `requiresManualReview` dan disurface terpisah.
- **Approved Claims Library** (§9.3) — CRUD klaim per produk dengan cakupan kanal, tanggal kedaluwarsa, peringatan "segera kedaluwarsa", dan aksi expire.
- **AI-assisted claims check** (§9.4) — teks tiap elemen dibandingkan dengan klaim aktif produk. Default: cosine similarity leksikal yang transparan; jika `ANTHROPIC_API_KEY` di-set, kasus borderline diadili **Claude Haiku** (`claude-haiku-4-5`, sesuai §6). AI **hanya menandai** — keputusan (terima/abaikan/eskalasi) selalu aksi reviewer manusia dan tercatat di audit log.
- **Audit trail** (§9.5) — append-only, setiap aksi dicatat dengan user + timestamp + referensi versi; filter produk/rentang tanggal + **ekspor CSV** untuk inspeksi.
- **Dashboard** (§9.6) — KPI, rata-rata waktu review per tahap dengan penanda bottleneck, klaim mendekati kedaluwarsa, aktivitas terbaru.
- **Bilingual ID/EN** — toggle di topbar (cookie `NEXT_LOCALE`).
- **RBAC** — antrean "giliran saya" untuk reviewer; Audit & Settings hanya untuk Compliance Admin / Company Admin.

## Catatan arsitektur demo vs produksi (PRD §6)

| Aspek | Demo ini | Produksi per PRD |
|---|---|---|
| Database | SQLite lokal (Drizzle ORM) | PostgreSQL Neon + pgvector (skema Drizzle identik secara struktur) |
| Auth | Session cookie HMAC + scrypt | Better Auth |
| Rendering/OCR | Layout teks → SVG sinkron; file upload jadi placeholder | LibreOffice/unoconv + OCR sebagai job async (Inngest/Trigger.dev) |
| Claims matching | Cosine leksikal + opsi Claude Haiku | Embedding pgvector + Claude Haiku (eskalasi Sonnet) |
| File storage | Metadata saja | Cloudflare R2 / S3 dengan versioned keys |
| Billing/Analytics | — | Xendit, PostHog |

Set `AUTH_SECRET` dan (opsional) `ANTHROPIC_API_KEY` melalui environment variable.

## Catatan kepatuhan (PRD §11)

Aplikasi ini memposisikan diri sebagai **audit-ready**, bukan "GxP/21 CFR Part 11 validated". Keterbatasan OCR/AI diungkap eksplisit di UI: AI tidak dapat membaca klaim yang tersirat murni secara visual, sehingga review manusia atas render halaman wajib untuk setiap submission.
