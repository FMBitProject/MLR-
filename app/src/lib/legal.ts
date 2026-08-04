import { COMPANY } from "./company";
import { PLANS, formatIdr, effectivePriceIdr } from "./plans";
import { MAX_UPLOAD_MB } from "./upload";
import { GRACE_DAYS } from "./billing";
import type { Locale } from "./i18n";

// Long-form public documents (Terms, Privacy, FAQ). Kept out of i18n.ts so the
// UI dictionary stays about UI chrome.
//
// Everything asserted here is checked against what the application actually
// does — the sub-processor list, the retention rules, and the limits are
// derived from real behaviour, and prices/limits are read from the catalogue
// so they cannot drift from what the app charges.

export type LegalSection = { heading: string; body: string[]; list?: string[] };
export type LegalDoc = {
  title: string;
  subtitle: string;
  updatedLabel: string;
  sections: LegalSection[];
};

const growth = PLANS.growth;
const enterprise = PLANS.enterprise;
const g = formatIdr(effectivePriceIdr(growth) ?? growth.monthlyPriceIdr ?? 0);
const e = formatIdr(effectivePriceIdr(enterprise) ?? enterprise.monthlyPriceIdr ?? 0);
const s = PLANS.starter.limits;

/* ------------------------------- TERMS ------------------------------- */

export const TERMS: Record<Locale, LegalDoc> = {
  id: {
    title: "Syarat & Ketentuan",
    subtitle: `Ketentuan penggunaan layanan ${COMPANY.productName}.`,
    updatedLabel: "Terakhir diperbarui",
    sections: [
      {
        heading: "1. Tentang layanan ini",
        body: [
          `${COMPANY.productName} adalah perangkat lunak berbasis langganan yang dioperasikan oleh ${COMPANY.legalName} ("kami"). Layanan ini membantu perusahaan farmasi menjalankan proses persetujuan materi promosi melalui alur review Medical, Legal, dan Regulatory (MLR), beserta jejak auditnya.`,
          "Dengan mendaftar atau menggunakan layanan, perusahaan Anda menyetujui ketentuan ini.",
        ],
      },
      {
        heading: "2. Akun dan kelayakan",
        body: [
          "Layanan ini ditujukan untuk badan usaha, bukan perorangan. Orang yang mendaftarkan workspace menyatakan dirinya berwenang mewakili perusahaan yang didaftarkan.",
          "Anda bertanggung jawab menjaga kerahasiaan kata sandi dan seluruh aktivitas yang terjadi pada akun perusahaan Anda. Setiap pengguna wajib memakai akunnya sendiri — akun bersama merusak keabsahan jejak audit dan tanda tangan elektronik.",
        ],
      },
      {
        heading: "3. Paket, harga, dan pembayaran",
        body: [
          `Paket Starter gratis selamanya, dengan batas ${s.users} pengguna, ${s.products} produk, dan ${s.submissionsPerMonth} pengajuan konten per bulan. Tidak diperlukan kartu kredit.`,
          `Paket berbayar ditagih di muka per bulan: Growth ${g} dan Enterprise ${e} per bulan. Harga dapat berbeda bila terdapat harga promo yang sedang berlaku, dan belum termasuk PPN kecuali dinyatakan lain.`,
          "Pembayaran diproses oleh Midtrans. Kami tidak menerima, memproses, atau menyimpan data kartu Anda.",
          "Masa aktif diperpanjang satu bulan setiap pembayaran diterima. Bila Anda membayar sebelum masa aktif berakhir, sisa hari yang belum terpakai tetap dihitung.",
        ],
      },
      {
        heading: "4. Keterlambatan pembayaran",
        body: [
          `Apabila masa aktif berakhir tanpa pembayaran, workspace tetap dapat digunakan sepenuhnya selama masa tenggang ${GRACE_DAYS} hari.`,
          "Setelah masa tenggang berakhir, workspace beralih ke mode baca-saja: seluruh data, riwayat, dan review yang sedang berjalan tetap dapat dibuka dan diunduh, namun pengajuan materi baru dinonaktifkan sampai pembayaran diterima. Kami tidak menghapus data Anda karena keterlambatan pembayaran.",
        ],
      },
      {
        heading: "5. Pembatalan dan pengembalian dana",
        body: [
          "Langganan tidak diperpanjang otomatis melalui pemotongan kartu; setiap periode dibayar melalui invoice, sehingga Anda dapat berhenti kapan saja dengan tidak membayar invoice berikutnya.",
          `[BELUM DIISI: kebijakan pengembalian dana — apakah refund tersedia, dalam kondisi apa, dan berapa lama prosesnya. Ajukan pertanyaan melalui ${COMPANY.email}.]`,
        ],
      },
      {
        heading: "6. Data dan konten Anda",
        body: [
          "Seluruh materi, klaim, komentar, dan dokumen yang Anda unggah tetap menjadi milik perusahaan Anda. Kami tidak mengklaim kepemilikan atasnya.",
          "Kami memproses data tersebut semata-mata untuk menjalankan layanan bagi Anda, sebagaimana dijelaskan pada Kebijakan Privasi.",
          "Data setiap perusahaan terisolasi: seluruh kueri disaring berdasarkan identitas workspace pengguna yang sedang masuk.",
        ],
      },
      {
        heading: "7. Batasan penting mengenai kepatuhan",
        body: [
          "Bagian ini penting dan mohon dibaca dengan saksama.",
        ],
        list: [
          "Fitur AI claims check bersifat membantu, bukan memutuskan. AI menandai teks yang berpotensi tidak sesuai dengan Approved Claims Library untuk diperiksa manusia. AI tidak pernah menyetujui, menolak, atau menyatakan suatu klaim sah secara medis.",
          "AI tidak dapat menilai klaim yang hanya tersirat secara visual (gambar, grafik, tata letak). Review manusia atas render setiap halaman tetap wajib.",
          "Seluruh keputusan persetujuan adalah tindakan manusia yang terikat pada akun reviewer bernama, diverifikasi ulang dengan kata sandi pada saat penandatanganan.",
          "Layanan ini belum melalui proses validasi sistem komputer (CSV) formal, sehingga tidak dapat diklaim sebagai sistem tervalidasi GxP atau 21 CFR Part 11.",
          "Tanda tangan elektronik pada layanan ini adalah tanda tangan in-app berbasis verifikasi ulang kata sandi, bukan tanda tangan digital bersertifikat dari penyelenggara sertifikasi elektronik.",
          "Kami bukan otoritas regulasi dan tidak memberikan nasihat hukum maupun regulatori. Kepatuhan materi promosi Anda terhadap ketentuan BPOM dan Pedoman Promosi Obat sepenuhnya menjadi tanggung jawab perusahaan Anda.",
        ],
      },
      {
        heading: "8. Penggunaan yang dilarang",
        body: ["Anda tidak diperkenankan:"],
        list: [
          "mengunggah materi yang melanggar hak pihak ketiga atau peraturan yang berlaku;",
          "mencoba mengakses data workspace lain, atau menguji keamanan layanan tanpa izin tertulis;",
          "menggunakan layanan untuk memproses data pribadi pasien atau data kesehatan perorangan — layanan ini dirancang untuk materi promosi, bukan rekam medis;",
          "menjual kembali atau menyewakan akses layanan tanpa persetujuan tertulis kami.",
        ],
      },
      {
        heading: "9. Ketersediaan layanan",
        body: [
          "Kami berupaya menjaga layanan tetap tersedia, namun tidak menjamin ketersediaan tanpa gangguan. Pemeliharaan terencana, gangguan penyedia infrastruktur, atau keadaan kahar dapat menyebabkan layanan tidak dapat diakses sementara.",
          "Paket gratis diberikan sebagaimana adanya, tanpa jaminan tingkat layanan (SLA).",
        ],
      },
      {
        heading: "10. Batasan tanggung jawab",
        body: [
          "Sepanjang diizinkan hukum yang berlaku, tanggung jawab kami atas klaim apa pun yang timbul dari penggunaan layanan dibatasi maksimal sebesar biaya langganan yang Anda bayarkan kepada kami dalam 12 bulan terakhir.",
          "Kami tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan, atau konsekuensi regulatori yang timbul dari materi promosi yang Anda setujui dan edarkan.",
        ],
      },
      {
        heading: "11. Penghentian",
        body: [
          "Anda dapat berhenti menggunakan layanan kapan saja. Kami dapat menangguhkan atau menghentikan akses apabila terjadi pelanggaran ketentuan ini, dengan pemberitahuan wajar kecuali pelanggaran tersebut membahayakan layanan atau pengguna lain.",
          `Setelah penghentian, Anda dapat meminta salinan data workspace Anda melalui ${COMPANY.email} dalam jangka waktu wajar sebelum data dihapus.`,
        ],
      },
      {
        heading: "12. Perubahan ketentuan",
        body: [
          "Kami dapat memperbarui ketentuan ini. Perubahan yang bersifat material akan diberitahukan melalui email kepada admin workspace sebelum berlaku.",
        ],
      },
      {
        heading: "13. Hukum yang berlaku",
        body: [
          "Ketentuan ini tunduk pada hukum Republik Indonesia. Sengketa yang tidak dapat diselesaikan secara musyawarah akan diselesaikan melalui pengadilan yang berwenang di wilayah Republik Indonesia.",
        ],
      },
      {
        heading: "14. Kontak",
        body: [
          `${COMPANY.legalName}`,
          `${COMPANY.address}`,
          `Email: ${COMPANY.email} · Telepon: ${COMPANY.phone}`,
        ],
      },
    ],
  },
  en: {
    title: "Terms & Conditions",
    subtitle: `Terms governing your use of ${COMPANY.productName}.`,
    updatedLabel: "Last updated",
    sections: [
      {
        heading: "1. About this service",
        body: [
          `${COMPANY.productName} is subscription software operated by ${COMPANY.legalName} ("we"). It helps pharmaceutical companies run promotional material through a Medical, Legal, and Regulatory (MLR) review workflow, with a full audit trail.`,
          "By registering for or using the service, your company agrees to these terms.",
        ],
      },
      {
        heading: "2. Accounts and eligibility",
        body: [
          "This service is intended for business entities, not individual consumers. Whoever registers a workspace represents that they are authorised to act for the company they register.",
          "You are responsible for keeping passwords confidential and for all activity under your company's account. Each person must use their own account — shared logins destroy the integrity of the audit trail and of electronic signatures.",
        ],
      },
      {
        heading: "3. Plans, pricing, and payment",
        body: [
          `The Starter plan is free forever, limited to ${s.users} users, ${s.products} products, and ${s.submissionsPerMonth} content submissions per month. No credit card is required.`,
          `Paid plans are billed monthly in advance: Growth ${g} and Enterprise ${e} per month. Prices may differ while a promotional rate applies, and exclude VAT unless stated otherwise.`,
          "Payments are processed by Midtrans. We never receive, process, or store your card details.",
          "Each payment extends the subscription by one month. Paying before the current period ends carries the unused days forward.",
        ],
      },
      {
        heading: "4. Late payment",
        body: [
          `If a period ends unpaid, the workspace stays fully usable during a ${GRACE_DAYS}-day grace period.`,
          "After the grace period the workspace becomes read-only: all data, history, and in-flight reviews remain accessible and downloadable, but new submissions are disabled until payment is received. We do not delete your data because of late payment.",
        ],
      },
      {
        heading: "5. Cancellation and refunds",
        body: [
          "Subscriptions are not auto-charged to a card; each period is paid by invoice, so you can stop at any time by not paying the next invoice.",
          `[NOT YET SPECIFIED: refund policy — whether refunds are available, under what conditions, and the processing time. Direct questions to ${COMPANY.email}.]`,
        ],
      },
      {
        heading: "6. Your data and content",
        body: [
          "All material, claims, comments, and documents you upload remain your company's property. We claim no ownership over them.",
          "We process them solely to operate the service for you, as described in the Privacy Policy.",
          "Each company's data is isolated: every query is filtered by the workspace identity of the signed-in user.",
        ],
      },
      {
        heading: "7. Important compliance limitations",
        body: ["This section matters — please read it carefully."],
        list: [
          "The AI claims check assists; it does not decide. It flags text that may not match the Approved Claims Library so a human can judge it. It never approves, rejects, or asserts that a claim is medically valid.",
          "The AI cannot judge claims carried only visually (images, charts, layout). Human review of every rendered page remains mandatory.",
          "Every approval decision is a human action bound to a named reviewer account and re-verified by password at the moment of signing.",
          "The service has not undergone formal computer system validation (CSV) and therefore cannot be claimed as a validated GxP or 21 CFR Part 11 system.",
          "Electronic signatures here are in-app signatures based on password re-verification, not certificate-based digital signatures issued by a certification authority.",
          "We are not a regulatory authority and give no legal or regulatory advice. Compliance of your promotional material with BPOM rules and the Pedoman Promosi Obat remains entirely your company's responsibility.",
        ],
      },
      {
        heading: "8. Prohibited use",
        body: ["You may not:"],
        list: [
          "upload material that infringes third-party rights or applicable regulations;",
          "attempt to access another workspace's data, or test the security of the service without our written permission;",
          "use the service to process patient personal data or individual health records — it is designed for promotional material, not medical records;",
          "resell or sublicense access without our written agreement.",
        ],
      },
      {
        heading: "9. Availability",
        body: [
          "We work to keep the service available but do not guarantee uninterrupted access. Planned maintenance, infrastructure provider incidents, or force majeure may make it temporarily unavailable.",
          "The free plan is provided as-is, with no service level agreement.",
        ],
      },
      {
        heading: "10. Limitation of liability",
        body: [
          "To the extent permitted by applicable law, our liability for any claim arising from use of the service is limited to the subscription fees you paid us in the preceding 12 months.",
          "We are not liable for indirect loss, lost profit, or regulatory consequences arising from promotional material your company approved and circulated.",
        ],
      },
      {
        heading: "11. Termination",
        body: [
          "You may stop using the service at any time. We may suspend or terminate access for breach of these terms, with reasonable notice unless the breach endangers the service or other users.",
          `After termination you may request a copy of your workspace data via ${COMPANY.email} within a reasonable period before deletion.`,
        ],
      },
      {
        heading: "12. Changes to these terms",
        body: [
          "We may update these terms. Material changes will be notified by email to workspace administrators before they take effect.",
        ],
      },
      {
        heading: "13. Governing law",
        body: [
          "These terms are governed by the laws of the Republic of Indonesia. Disputes that cannot be settled amicably will be resolved by the competent courts of the Republic of Indonesia.",
        ],
      },
      {
        heading: "14. Contact",
        body: [
          `${COMPANY.legalName}`,
          `${COMPANY.address}`,
          `Email: ${COMPANY.email} · Phone: ${COMPANY.phone}`,
        ],
      },
    ],
  },
};

/* ------------------------------ PRIVACY ------------------------------ */

export const PRIVACY: Record<Locale, LegalDoc> = {
  id: {
    title: "Kebijakan Privasi",
    subtitle: `Bagaimana ${COMPANY.productName} memperlakukan data Anda.`,
    updatedLabel: "Terakhir diperbarui",
    sections: [
      {
        heading: "1. Pengendali data",
        body: [
          `${COMPANY.legalName}, ${COMPANY.address}, bertindak sebagai pengendali atas data akun pengguna layanan ini.`,
          "Atas materi promosi dan klaim yang diunggah perusahaan pelanggan, kami bertindak sebagai pemroses: kami mengolahnya atas instruksi perusahaan Anda, bukan untuk kepentingan kami sendiri.",
          "Kebijakan ini disusun dengan mengacu pada Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.",
        ],
      },
      {
        heading: "2. Data yang kami kumpulkan",
        body: ["Kami mengumpulkan hanya yang diperlukan untuk menjalankan layanan:"],
        list: [
          "Data akun: nama, alamat email, peran (role), preferensi bahasa, dan kata sandi yang disimpan dalam bentuk hash — bukan teks asli.",
          "Data workspace: nama perusahaan, paket langganan, dan tanggal masa aktif.",
          "Konten yang Anda unggah: berkas materi promosi (PPTX/PDF/DOCX), teks hasil ekstraksi, render halaman, judul, produk, dan kanal distribusi.",
          "Claims Library: teks klaim yang disetujui, nama produk, nomor registrasi BPOM, dan referensi jurnal termasuk dokumen yang Anda unggah.",
          "Aktivitas review: komentar, keputusan, catatan keputusan, serta manifes tanda tangan elektronik (nama, email, peran, dan waktu penandatanganan).",
          "Jejak audit: setiap tindakan penting beserta identitas pelaku dan waktunya.",
          "Data penagihan: nomor invoice, nominal, jenis pembayaran, dan status dari Midtrans. Kami tidak menyimpan nomor kartu.",
          "Data teknis terbatas untuk keamanan: alamat IP dipakai untuk membatasi percobaan masuk yang berlebihan.",
        ],
      },
      {
        heading: "3. Dasar dan tujuan pemrosesan",
        body: [
          "Kami memproses data di atas untuk melaksanakan perjanjian layanan dengan perusahaan Anda: menjalankan alur review, menyimpan jejak audit, mengirim notifikasi, dan menagih langganan.",
          "Kami tidak menjual data Anda, tidak menampilkan iklan, dan tidak memakai konten Anda untuk keperluan pemasaran kami.",
        ],
      },
      {
        heading: "4. Layanan pihak ketiga yang kami gunakan",
        body: [
          "Untuk menjalankan layanan, data tertentu diproses oleh penyedia berikut. Daftar ini kami sebutkan terbuka karena beberapa di antaranya memproses isi materi Anda:",
        ],
        list: [
          "Vercel — hosting aplikasi dan pemrosesan permintaan.",
          "Neon — basis data PostgreSQL tempat seluruh data dan berkas tersimpan.",
          "Resend — pengiriman email transaksional (verifikasi akun, notifikasi review, pengingat tagihan).",
          "Midtrans — pemrosesan pembayaran langganan. Menerima nama, email, nomor pesanan, dan nominal.",
          "Penyedia model AI (Groq, Anthropic, OpenAI, atau xAI — bergantung konfigurasi kami saat itu) — menerima potongan teks materi dan teks klaim yang relevan untuk menjalankan AI claims check dan substansiasi jurnal. Teks dikirim untuk diproses saat itu juga; kami tidak mengirimkan data untuk keperluan pelatihan model. Kebijakan retensi masing-masing penyedia berlaku pada sisi mereka.",
          "PubMed / PubMed Central (NCBI) — dihubungi saat mencari atau mengambil artikel jurnal berdasarkan kutipan atau PMID yang Anda masukkan.",
        ],
      },
      {
        heading: "5. Perhatian khusus untuk materi sensitif",
        body: [
          "Karena AI claims check mengirimkan potongan teks materi ke penyedia model AI, jangan mengunggah materi yang tidak boleh keluar dari lingkungan perusahaan Anda tanpa terlebih dahulu memastikan hal itu sesuai kebijakan internal Anda.",
          "Layanan ini tidak dirancang untuk memproses data pribadi pasien atau rekam medis, dan Anda diminta untuk tidak mengunggahnya.",
        ],
      },
      {
        heading: "6. Penyimpanan dan retensi",
        body: [
          "Data disimpan selama workspace Anda aktif.",
          "Jejak audit bersifat hanya-tambah (append-only) dan sengaja tidak dapat diubah atau dihapus dari dalam aplikasi — sifat inilah yang membuatnya bernilai saat inspeksi. Versi materi yang telah disetujui juga dikunci agar tidak dapat diubah.",
          "Karena itu, permintaan penghapusan data tertentu dapat berbenturan dengan kebutuhan integritas audit. Bila hal ini terjadi, kami akan menjelaskan bagian mana yang dapat dihapus dan bagian mana yang harus dipertahankan beserta alasannya.",
        ],
      },
      {
        heading: "7. Keamanan",
        body: ["Langkah teknis yang kami terapkan antara lain:"],
        list: [
          "kata sandi disimpan dalam bentuk hash, tidak pernah dalam teks asli;",
          "sesi login ditandatangani secara kriptografis;",
          "isolasi antar-perusahaan diterapkan pada setiap kueri basis data;",
          "pembatasan laju percobaan masuk dan pendaftaran untuk menahan serangan tebak kata sandi;",
          "verifikasi ulang kata sandi saat menandatangani keputusan review;",
          "verifikasi tanda tangan kriptografis atas setiap notifikasi pembayaran dari Midtrans;",
          "seluruh komunikasi melalui HTTPS.",
        ],
      },
      {
        heading: "8. Hak Anda",
        body: [
          "Anda berhak meminta akses, perbaikan, penghapusan, atau salinan data pribadi Anda, serta menarik persetujuan sepanjang berlaku.",
          `Ajukan permintaan melalui ${COMPANY.privacyEmail}. Kami akan menanggapi dalam jangka waktu wajar. Untuk data yang berada di bawah kendali perusahaan tempat Anda bekerja, kami dapat mengarahkan permintaan tersebut kepada admin workspace Anda.`,
        ],
      },
      {
        heading: "9. Transfer ke luar negeri",
        body: [
          "Sebagian penyedia di atas mengoperasikan server di luar Indonesia. Dengan menggunakan layanan ini, Anda memahami bahwa data dapat diproses di luar wilayah Indonesia oleh penyedia tersebut.",
        ],
      },
      {
        heading: "10. Perubahan kebijakan",
        body: [
          "Perubahan material atas kebijakan ini akan diberitahukan melalui email kepada admin workspace sebelum berlaku.",
        ],
      },
      {
        heading: "11. Kontak",
        body: [
          `Pertanyaan mengenai kebijakan ini dapat dikirim ke ${COMPANY.privacyEmail}.`,
          `${COMPANY.legalName} · ${COMPANY.address}`,
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    subtitle: `How ${COMPANY.productName} handles your data.`,
    updatedLabel: "Last updated",
    sections: [
      {
        heading: "1. Data controller",
        body: [
          `${COMPANY.legalName}, ${COMPANY.address}, acts as controller for the account data of users of this service.`,
          "For the promotional material and claims uploaded by customer companies, we act as a processor: we handle them on your company's instructions, not for our own purposes.",
          "This policy is written with reference to Indonesian Law No. 27 of 2022 on Personal Data Protection.",
        ],
      },
      {
        heading: "2. What we collect",
        body: ["We collect only what running the service requires:"],
        list: [
          "Account data: name, email address, role, language preference, and a hashed password — never the plain text.",
          "Workspace data: company name, subscription plan, and subscription dates.",
          "Content you upload: promotional files (PPTX/PDF/DOCX), extracted text, rendered pages, titles, products, and distribution channel.",
          "Claims Library: approved claim text, product names, BPOM registration numbers, and journal references including documents you upload.",
          "Review activity: comments, decisions, decision notes, and electronic signature manifests (name, email, role, signing time).",
          "Audit trail: every significant action with the actor's identity and timestamp.",
          "Billing data: invoice number, amount, payment type, and status from Midtrans. We do not store card numbers.",
          "Limited technical data for security: IP addresses are used to rate-limit sign-in attempts.",
        ],
      },
      {
        heading: "3. Purpose and basis",
        body: [
          "We process the above to perform our service agreement with your company: running the review workflow, keeping the audit trail, sending notifications, and billing subscriptions.",
          "We do not sell your data, show advertising, or use your content for our own marketing.",
        ],
      },
      {
        heading: "4. Third-party services we use",
        body: [
          "Certain data is processed by the providers below. We list them openly because several of them process the contents of your material:",
        ],
        list: [
          "Vercel — application hosting and request processing.",
          "Neon — the PostgreSQL database where data and files are stored.",
          "Resend — transactional email (account verification, review notifications, billing reminders).",
          "Midtrans — subscription payment processing. Receives name, email, order number, and amount.",
          "AI model provider (Groq, Anthropic, OpenAI, or xAI — depending on our configuration at the time) — receives excerpts of material text and the relevant approved claim text to run the AI claims check and journal substantiation. Text is sent for immediate processing; we do not submit data for model training. Each provider's own retention policy applies on their side.",
          "PubMed / PubMed Central (NCBI) — contacted when looking up or fetching journal articles from the citations or PMIDs you enter.",
        ],
      },
      {
        heading: "5. A note on sensitive material",
        body: [
          "Because the AI claims check sends excerpts of your material to an AI model provider, do not upload material that must not leave your company's environment without first confirming this fits your internal policy.",
          "The service is not designed to process patient personal data or medical records, and you are asked not to upload them.",
        ],
      },
      {
        heading: "6. Storage and retention",
        body: [
          "Data is retained while your workspace is active.",
          "The audit trail is append-only and deliberately cannot be edited or deleted from within the application — that property is precisely what makes it worth having at an inspection. Approved material versions are likewise locked against modification.",
          "As a result, some deletion requests can conflict with audit integrity. Where that happens we will explain which parts can be deleted and which must be retained, and why.",
        ],
      },
      {
        heading: "7. Security",
        body: ["Technical measures we apply include:"],
        list: [
          "passwords stored as hashes, never in plain text;",
          "cryptographically signed login sessions;",
          "per-company isolation enforced on every database query;",
          "rate limiting on sign-in and registration to resist password guessing;",
          "password re-verification when signing a review decision;",
          "cryptographic signature verification on every payment notification from Midtrans;",
          "all traffic over HTTPS.",
        ],
      },
      {
        heading: "8. Your rights",
        body: [
          "You may request access to, correction of, deletion of, or a copy of your personal data, and withdraw consent where applicable.",
          `Send requests to ${COMPANY.privacyEmail}. We will respond within a reasonable period. For data under the control of the company you work for, we may direct the request to your workspace administrator.`,
        ],
      },
      {
        heading: "9. International transfers",
        body: [
          "Some providers above operate servers outside Indonesia. By using the service you understand that data may be processed outside Indonesian territory by those providers.",
        ],
      },
      {
        heading: "10. Changes to this policy",
        body: [
          "Material changes will be notified by email to workspace administrators before they take effect.",
        ],
      },
      {
        heading: "11. Contact",
        body: [
          `Questions about this policy can be sent to ${COMPANY.privacyEmail}.`,
          `${COMPANY.legalName} · ${COMPANY.address}`,
        ],
      },
    ],
  },
};

/* -------------------------------- FAQ -------------------------------- */

export type FaqGroup = { name: string; items: { q: string; a: string }[] };
export type FaqDoc = { title: string; subtitle: string; groups: FaqGroup[] };

export const FAQ: Record<Locale, FaqDoc> = {
  id: {
    title: "Pertanyaan yang Sering Diajukan",
    subtitle: `Hal-hal yang paling sering ditanyakan tentang ${COMPANY.productName}.`,
    groups: [
      {
        name: "Umum",
        items: [
          {
            q: `Apa itu ${COMPANY.productName}?`,
            a: "Aplikasi untuk menjalankan proses persetujuan materi promosi farmasi — dari pengajuan oleh marketing, review Medical, Legal, dan Regulatory, sampai materi disetujui dan terkunci — menggantikan rantai email dan file yang berserakan.",
          },
          {
            q: "Untuk siapa aplikasi ini?",
            a: "Perusahaan farmasi skala kecil sampai menengah yang membutuhkan disiplin review MLR dan jejak audit yang siap diperiksa, tanpa biaya dan kerumitan tool kelas enterprise.",
          },
          {
            q: "Apakah tersedia dalam Bahasa Indonesia?",
            a: "Ya. Seluruh antarmuka tersedia dalam Bahasa Indonesia dan Inggris, dan dapat diganti kapan saja lewat tombol di pojok kanan atas.",
          },
        ],
      },
      {
        name: "Harga & langganan",
        items: [
          {
            q: "Apakah paket Starter benar-benar gratis?",
            a: `Ya, gratis selamanya dan tanpa kartu kredit. Batasnya ${s.users} pengguna, ${s.products} produk, dan ${s.submissionsPerMonth} pengajuan konten per bulan. Anda bisa menjalankan alur review lengkap dengan materi asli Anda.`,
          },
          {
            q: "Apa yang terjadi kalau kuota bulanan habis?",
            a: "Pengajuan konten baru dinonaktifkan sampai bulan berikutnya, atau sampai Anda upgrade. Data dan review yang sedang berjalan tidak terpengaruh.",
          },
          {
            q: "Bagaimana cara upgrade?",
            a: "Masuk ke menu Pengaturan → Billing & Langganan, pilih paket, lalu bayar. Paket langsung aktif begitu pembayaran terkonfirmasi.",
          },
          {
            q: "Metode pembayaran apa saja yang diterima?",
            a: "Melalui Midtrans: transfer bank/Virtual Account, QRIS, e-wallet, dan kartu kredit/debit.",
          },
          {
            q: "Apakah langganan diperpanjang otomatis?",
            a: "Tidak dipotong otomatis dari kartu. Setiap periode ditagih lewat invoice, jadi Anda berhenti cukup dengan tidak membayar invoice berikutnya.",
          },
          {
            q: "Apa yang terjadi kalau saya telat bayar?",
            a: `Workspace tetap berfungsi penuh selama masa tenggang ${GRACE_DAYS} hari. Setelah itu beralih ke mode baca-saja — semua data tetap bisa dibuka dan diunduh, hanya pengajuan baru yang dinonaktifkan. Data Anda tidak dihapus.`,
          },
        ],
      },
      {
        name: "Fitur & penggunaan",
        items: [
          {
            q: "Format file apa yang bisa diunggah?",
            a: `PPTX, DOCX, dan PDF, dengan ukuran maksimum ${MAX_UPLOAD_MB} MB per berkas. Untuk PPTX dan DOCX, teks diekstrak per slide/halaman dan otomatis dicek terhadap Claims Library.`,
          },
          {
            q: "Bagaimana cara kerja AI claims check?",
            a: "Setiap potongan teks pada materi dibandingkan dengan klaim yang sudah disetujui di Claims Library. Bagian yang tidak cocok ditandai agar diperiksa reviewer. AI hanya menandai — keputusan menyetujui atau menolak selalu di tangan manusia.",
          },
          {
            q: "Apakah AI bisa menyetujui materi secara otomatis?",
            a: "Tidak, dan itu disengaja. AI tidak pernah menyetujui, menolak, atau menyatakan sebuah klaim sah secara medis. AI juga tidak bisa membaca klaim yang hanya tersirat lewat gambar atau grafik, sehingga review manusia atas setiap halaman tetap wajib.",
          },
          {
            q: "Apakah konten saya dipakai untuk melatih model AI?",
            a: "Tidak. Potongan teks dikirim ke penyedia model hanya untuk diproses saat itu juga, bukan untuk pelatihan. Rincian penyedia yang kami gunakan tercantum di Kebijakan Privasi.",
          },
          {
            q: "Bagaimana tanda tangan elektroniknya bekerja?",
            a: "Saat reviewer mengambil keputusan, ia harus memasukkan ulang kata sandi akunnya. Sistem mencatat identitas, makna tanda tangan, versi materi, dan waktu penandatanganan ke jejak audit, lalu menampilkannya pada Paket Persetujuan yang bisa dicetak.",
          },
          {
            q: "Apakah materi yang sudah disetujui bisa kedaluwarsa?",
            a: "Ya. Materi yang disetujui punya masa berlaku (standarnya satu tahun) dan dapat ditarik dari peredaran sewaktu-waktu disertai alasan. Materi yang kedaluwarsa atau ditarik tidak bisa dipakai ulang, tetapi tetap tersimpan di jejak audit.",
          },
        ],
      },
      {
        name: "Kepatuhan & data",
        items: [
          {
            q: "Apakah aplikasi ini tervalidasi GxP / 21 CFR Part 11?",
            a: "Belum. Aplikasi ini mendukung disiplin review MLR dan menghasilkan jejak audit yang siap diperiksa, tetapi belum melalui proses validasi sistem komputer (CSV) formal, sehingga tidak kami klaim sebagai sistem tervalidasi.",
          },
          {
            q: "Apakah data perusahaan saya terpisah dari perusahaan lain?",
            a: "Ya. Setiap perusahaan punya workspace sendiri, dan seluruh kueri basis data disaring berdasarkan identitas workspace pengguna yang sedang masuk.",
          },
          {
            q: "Apakah jejak audit bisa diubah atau dihapus?",
            a: "Tidak dari dalam aplikasi. Jejak audit bersifat hanya-tambah, dan versi materi yang telah disetujui dikunci — justru sifat inilah yang membuatnya berguna saat inspeksi.",
          },
          {
            q: "Bisakah saya mengekspor data untuk keperluan audit?",
            a: "Bisa. Jejak audit dapat diekspor ke CSV dengan penyaringan produk dan rentang tanggal, dan setiap materi yang disetujui memiliki Paket Persetujuan yang dapat dicetak atau disimpan sebagai PDF beserta halaman tanda tangannya.",
          },
          {
            q: "Bolehkah saya mengunggah data pasien?",
            a: "Tidak. Aplikasi ini dirancang untuk materi promosi, bukan rekam medis, dan tidak boleh dipakai memproses data pribadi pasien.",
          },
        ],
      },
    ],
  },
  en: {
    title: "Frequently Asked Questions",
    subtitle: `The questions we get asked most about ${COMPANY.productName}.`,
    groups: [
      {
        name: "General",
        items: [
          {
            q: `What is ${COMPANY.productName}?`,
            a: "An application for running pharmaceutical promotional material through approval — from marketing's submission, through Medical, Legal, and Regulatory review, to a locked approved version — replacing email chains and scattered files.",
          },
          {
            q: "Who is it for?",
            a: "Small to mid-size pharmaceutical companies that need MLR review discipline and an inspection-ready audit trail without the cost and complexity of enterprise tooling.",
          },
          {
            q: "Is it available in Indonesian?",
            a: "Yes. The entire interface is available in Indonesian and English, switchable at any time from the top right.",
          },
        ],
      },
      {
        name: "Pricing & subscription",
        items: [
          {
            q: "Is the Starter plan really free?",
            a: `Yes — free forever, no credit card. It is limited to ${s.users} users, ${s.products} products, and ${s.submissionsPerMonth} content submissions per month, which is enough to run the full review workflow on your own material.`,
          },
          {
            q: "What happens when the monthly quota runs out?",
            a: "New submissions are disabled until next month, or until you upgrade. Existing data and in-flight reviews are unaffected.",
          },
          {
            q: "How do I upgrade?",
            a: "Go to Settings → Billing & Subscription, pick a plan, and pay. The plan activates as soon as payment is confirmed.",
          },
          {
            q: "Which payment methods are accepted?",
            a: "Through Midtrans: bank transfer/Virtual Account, QRIS, e-wallets, and credit/debit cards.",
          },
          {
            q: "Does the subscription auto-renew?",
            a: "Nothing is auto-charged to a card. Each period is invoiced, so you stop simply by not paying the next invoice.",
          },
          {
            q: "What happens if I pay late?",
            a: `The workspace stays fully usable for a ${GRACE_DAYS}-day grace period. After that it becomes read-only — everything remains accessible and downloadable, only new submissions are disabled. Your data is not deleted.`,
          },
        ],
      },
      {
        name: "Features & usage",
        items: [
          {
            q: "Which file formats can I upload?",
            a: `PPTX, DOCX, and PDF, up to ${MAX_UPLOAD_MB} MB per file. For PPTX and DOCX, text is extracted per slide/page and checked against the Claims Library automatically.`,
          },
          {
            q: "How does the AI claims check work?",
            a: "Each piece of text in the material is compared against the approved claims in your Claims Library. Anything that does not match is flagged for a reviewer. The AI only flags — approving or rejecting is always a human decision.",
          },
          {
            q: "Can the AI approve material automatically?",
            a: "No, by design. It never approves, rejects, or asserts that a claim is medically valid. It also cannot read claims carried only by images or charts, so human review of every page remains mandatory.",
          },
          {
            q: "Is my content used to train AI models?",
            a: "No. Text excerpts are sent to the model provider for immediate processing only, not for training. The providers we use are listed in the Privacy Policy.",
          },
          {
            q: "How do the electronic signatures work?",
            a: "When a reviewer makes a decision they must re-enter their account password. The system records the identity, the meaning of the signature, the material version, and the signing time in the audit trail, and prints them on the Approval Package.",
          },
          {
            q: "Can approved material expire?",
            a: "Yes. Approved material carries an expiry date (one year by default) and can be withdrawn from circulation at any time with a reason. Expired or withdrawn material cannot be reused, but stays in the audit trail.",
          },
        ],
      },
      {
        name: "Compliance & data",
        items: [
          {
            q: "Is this GxP / 21 CFR Part 11 validated?",
            a: "Not yet. It supports MLR review discipline and produces an inspection-ready audit trail, but it has not been through formal computer system validation, so we do not claim it as a validated system.",
          },
          {
            q: "Is my company's data separated from other companies?",
            a: "Yes. Each company has its own workspace, and every database query is filtered by the workspace identity of the signed-in user.",
          },
          {
            q: "Can the audit trail be edited or deleted?",
            a: "Not from within the application. The audit trail is append-only and approved versions are locked — that property is exactly what makes it useful at an inspection.",
          },
          {
            q: "Can I export data for an audit?",
            a: "Yes. The audit trail exports to CSV with product and date-range filters, and every approved material has a printable Approval Package, including its signature page, that can be saved as PDF.",
          },
          {
            q: "May I upload patient data?",
            a: "No. The application is built for promotional material, not medical records, and must not be used to process patient personal data.",
          },
        ],
      },
    ],
  },
};
