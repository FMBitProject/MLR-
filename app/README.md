# MLR Flow — MLR Review Workflow Tool (Lite)

Implementasi webapp dari **PRD: MLR Review Workflow Tool (Lite)** — platform B2B SaaS untuk mendigitalkan proses review Medical–Legal–Regulatory (MLR) konten promosi farmasi, dengan kategori review yang selaras Pedoman Promosi Obat.

## Menjalankan

Aplikasi butuh **PostgreSQL** (Neon di produksi, Postgres lokal untuk dev). Salin `.env.example` → `.env.local` dan isi `DATABASE_URL` + `AUTH_SECRET`.

```bash
cd app
npm install
cp .env.example .env.local        # lalu isi DATABASE_URL & AUTH_SECRET

# Postgres lokal cepat via Docker (opsional):
docker run -d --name mlr-pg -e POSTGRES_PASSWORD=mlr -e POSTGRES_DB=mlr \
  -p 5433:5432 postgres:16-alpine
# → DATABASE_URL=postgres://postgres:mlr@localhost:5433/mlr

npm run db:migrate                # terapkan skema (drizzle-kit)
npm run db:seed                   # isi data demo; wajib set DEMO_PASSWORD privat (≥16 karakter)
npm run dev                       # http://localhost:3000
# atau produksi:
npm run build && npm start
```

Skema dikelola sebagai migrasi drizzle-kit di `src/lib/db/migrations/` (`npm run db:generate` untuk membuat migrasi baru setelah mengubah `schema.ts`). Untuk reset penuh: drop database, lalu `db:migrate` + `db:seed` lagi.

### Deploy ke Vercel + Neon

1. Buat database di [Neon](https://neon.tech), ambil **pooled connection string** (host berakhiran `-pooler`).
2. Di Vercel set env: `DATABASE_URL` (pooled Neon), `AUTH_SECRET` (`openssl rand -hex 32`), `APP_URL` (URL HTTPS publik), `STORAGE_DRIVER=db`, dan (opsional) kunci provider AI.
3. Jalankan `npm run db:migrate` dengan `DATABASE_URL` tujuan yang sudah diatur (lokal atau sebagai deploy step). Seed demo sengaja ditolak di production. Untuk upgrade, baca [catatan keamanan](SECURITY-FIXES.md).

### Menjalankan dengan Docker

Dari **root repo** (bukan folder `app/`):

```bash
export APP_HOST=mlr.example.com
export POSTGRES_PASSWORD=$(openssl rand -hex 32)
export AUTH_SECRET=$(openssl rand -hex 32)
# Simpan ketiga nilai ini di secret manager dan muat kembali pada sesi berikutnya.
# Untuk database yang sudah ada, gunakan POSTGRES_PASSWORD yang sudah berlaku.
docker compose up --build -d
docker compose logs -f       # gunakan environment yang sama
docker compose down          # hentikan (data tetap tersimpan)
```

Docker Compose sekarang ditujukan untuk deployment HTTPS: Caddy menerima koneksi publik pada port 80/443 dan meneruskan ke aplikasi yang tidak diekspos langsung. Set DNS `APP_HOST` ke host tersebut sebelum menjalankan Compose. Database dan file upload bertahan di volume `mlr-pgdata`.

## Akun demo lokal

| Email | Peran |
|---|---|
| dewi@nusantara-pharma.co.id | Marketing (pengaju konten) |
| budi@nusantara-pharma.co.id | Medical Reviewer |
| ratna@nusantara-pharma.co.id | Legal Reviewer |
| agus@nusantara-pharma.co.id | Regulatory Reviewer |
| sari@nusantara-pharma.co.id | Compliance / QA Admin |
| rudi@nusantara-pharma.co.id | Company Admin |

Demo tidak dibuat otomatis, tidak tersedia di production, dan tidak memiliki kata sandi bawaan. Untuk membuatnya pada database lokal kosong, set `DEMO_PASSWORD` acak minimal 16 karakter lalu jalankan `npm run db:seed`.

```bash
# Dari folder app, dengan DATABASE_URL menunjuk database lokal:
export DEMO_PASSWORD=$(openssl rand -hex 24)
npm run db:seed
# Gunakan nilai DEMO_PASSWORD dari shell ini untuk login lokal.
```

## Fitur (pemetaan ke PRD)

- **Multi-tenant** (§7) — `tenant_id` di setiap tabel; semua query difilter dari sesi.
- **Submission + versioning** (§9.1) — resubmit membuat versi baru & mereset workflow; versi yang disetujui **terkunci permanen** (immutability NFR).
- **Workflow review terkonfigurasi** (§9.2) — urutan tahap per kanal diatur di Settings; routing otomatis ke tahap berikutnya saat disetujui, kembali ke marketing saat revisi/tolak.
- **Review visual per halaman** (§9.7) — setiap versi dirender menjadi halaman SVG; elemen punya bounding box sehingga **flag AI dan komentar ter-pin tepat di posisinya** pada render halaman. Elemen chart/OCR rendah ditandai `requiresManualReview` dan disurface terpisah.
- **Approved Claims Library** (§9.3) — CRUD klaim per produk dengan cakupan kanal, tanggal kedaluwarsa, peringatan "segera kedaluwarsa", dan aksi expire.
- **AI-assisted claims check** (§9.4) — teks tiap elemen dibandingkan dengan klaim aktif produk (termasuk teks sitasi jurnal yang terlampir). Default: cosine similarity leksikal yang transparan; jika sebuah provider AI di-set, kasus borderline diadili LLM. AI **hanya menandai** — keputusan (terima/abaikan/eskalasi) selalu aksi reviewer manusia dan tercatat di audit log.
- **Substansiasi jurnal (AI)** — pada flag yang klaim terdekatnya punya PMID, reviewer bisa klik **"Cek terhadap Jurnal"**: abstrak ditarik gratis dari PubMed (efetch) lalu LLM menilai apakah copy didukung isi jurnal (didukung / tidak didukung / tidak jelas). Tanpa provider AI, abstraknya tetap ditampilkan inline.

### Mengaktifkan AI (opsional, gratis)

Fitur AI mati secara default (aplikasi jalan penuh dengan mesin leksikal). Untuk mengaktifkan, set **salah satu** environment variable — provider terdeteksi otomatis:

| Provider | Env var | Biaya | Model default (override `AI_MODEL`) |
|---|---|---|---|
| **Groq** (disarankan) | `GROQ_API_KEY` | **Gratis** (tier gratis, tanpa kartu) | `llama-3.3-70b-versatile` |
| xAI Grok | `XAI_API_KEY` | Berbayar (kredit) | `grok-3-mini` |
| OpenAI | `OPENAI_API_KEY` | Berbayar | `gpt-4o-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | Berbayar | `claude-haiku-4-5` |
| OpenAI-compatible lain | `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL` | — | — |

Dapatkan kunci Groq gratis di `console.groq.com` → API Keys, lalu jalankan:

```bash
GROQ_API_KEY=gsk_... npm start -- -p 3000
```

Status provider aktif tampil di halaman **Settings**.
- **Audit trail** (§9.5) — append-only, setiap aksi dicatat dengan user + timestamp + referensi versi; filter produk/rentang tanggal + **ekspor CSV** untuk inspeksi.
- **Dashboard** (§9.6) — KPI, rata-rata waktu review per tahap dengan penanda bottleneck, klaim mendekati kedaluwarsa, aktivitas terbaru.
- **Bilingual ID/EN** — toggle di topbar (cookie `NEXT_LOCALE`).
- **RBAC** — antrean "giliran saya" untuk reviewer; Audit & Settings hanya untuk Compliance Admin / Company Admin.

## Catatan arsitektur demo vs produksi (PRD §6)

| Aspek | Demo ini | Produksi per PRD |
|---|---|---|
| Database | **PostgreSQL** (Drizzle ORM + node-postgres); Postgres lokal via Docker | **PostgreSQL Neon** (pooled) — kode identik, cukup ganti `DATABASE_URL`; pgvector menyusul |
| File storage | `STORAGE_DRIVER=local` di disk `.data/uploads` untuk dev | `STORAGE_DRIVER=db` menyimpan upload di PostgreSQL; driver S3/R2 belum tersedia |
| Auth | Sesi acak dengan digest di database, kedaluwarsa 7 hari; password scrypt | Cookie Secure melalui HTTPS, pencabutan sesi saat logout/reset password |
| Rendering/OCR | Layout teks → SVG sinkron; file upload jadi placeholder | LibreOffice/unoconv + OCR sebagai job async (Inngest/Trigger.dev) |
| Claims matching | Cosine leksikal + opsi LLM (Groq/xAI/OpenAI/Anthropic) | Embedding pgvector + LLM (eskalasi model lebih besar) |
| Billing/Analytics | — | Xendit, PostHog |

Set `AUTH_SECRET` dan (opsional) kunci provider AI — mis. `GROQ_API_KEY` yang gratis — melalui environment variable.

## Catatan kepatuhan (PRD §11)

Aplikasi ini memposisikan diri sebagai **audit-ready**, bukan "GxP/21 CFR Part 11 validated". Keterbatasan OCR/AI diungkap eksplisit di UI: AI tidak dapat membaca klaim yang tersirat murni secara visual, sehingga review manusia atas render halaman wajib untuk setiap submission.
