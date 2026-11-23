# RailwayVision AI

**Sistem pendukung inspeksi infrastruktur perkeretaapian berbasis bukti, dengan
penyaringan visual berbantuan AI dan validasi manusia.**

> RailwayVision AI merupakan proyek sistem pendukung inspeksi infrastruktur perkeretaapian. Repository ini bukan representasi kebijakan, SOP, atau sistem resmi PT Kereta Cepat Indonesia China (KCIC), dan publikasinya tidak menyatakan adanya persetujuan atau afiliasi resmi KCIC. Seluruh penggunaan pada lingkungan operasional memerlukan validasi, otorisasi, pengujian, dan persetujuan pihak yang berwenang.

Status repository: **prototipe pengembangan lokal (0.7.0 + pekerjaan pasca-rilis)**.
Tidak ada klaim kesiapan produksi, akurasi AI, maupun persetujuan KCIC.

---

## 1. Nama proyek

**RailwayVision AI** — monorepo sistem pendukung inspeksi infrastruktur
perkeretaapian yang terdiri dari web, API, worker AI, aplikasi seluler, dan dokumentasi.

## 2. Deskripsi RailwayVision AI

RailwayVision AI adalah monorepo berisi aplikasi web, API, worker AI, aplikasi seluler, dan
dokumentasi untuk mendukung alur kerja inspeksi:

inspeksi lapangan → bukti media terintegritas → penyaringan AI (saran) →
verifikasi pemeriksa teknis → persetujuan supervisor → perintah kerja →
verifikasi penyelesaian → laporan dan audit trail.

AI hanya memberi indikasi awal. Seluruh keputusan teknis, persetujuan tindak lanjut, dan
penyelesaian pekerjaan dilakukan oleh pengguna berwenang dan tercatat pada audit trail.
Sistem tidak memiliki fungsi kendali kereta, persinyalan, interlocking, dispatch, atau
keputusan keselamatan otomatis.

### Batas sistem

- Keluaran AI bersifat saran dan wajib diverifikasi manusia berwenang.
- Tidak ada keputusan otomatis "aman/tidak aman" di mana pun.
- Tidak ada integrasi ke persinyalan, interlocking, train control, CTCS, GSM-R, SCADA,
  atau sistem operasi kritis perkeretaapian.
- Kategori kerusakan, severity, toleransi, checklist, dan interval inspeksi menunggu
  validasi KCIC (`PENDING_KCIC_VALIDATION`).
- Seluruh data contoh bersifat sintetis dan diberi label `DEMO`.

## 3. Tujuan sistem

- Menyediakan pencatatan inspeksi yang konsisten, dapat diaudit, dan aman.
- Menjaga integritas bukti foto melalui penyimpanan privat, checksum, dan karantina.
- Menyediakan alur validasi manusia dua tingkat: pemeriksa teknis dan supervisor.
- Menyediakan pengelolaan tindak lanjut (temuan dan perintah kerja) yang dapat dilacak.
- Menyediakan dasbor KPI dan laporan berbasis data PostgreSQL.
- Menyediakan tata kelola model AI dan dataset sebelum model boleh digunakan.

## 4. Fitur utama

Yang benar-benar tersedia dan telah diuji secara lokal:

### Web (`apps/web`)

- Login, pemulihan kata sandi, sesi via cookie HttpOnly, dan navigasi berbasis peran.
- Dasbor operasional dengan KPI langsung dari PostgreSQL, tren enam bulan (WIB),
  status temuan/perintah kerja, dan status platform.
- Register aset dan lokasi dengan filter, pencarian, dan paginasi sesuai cakupan.
- Inspeksi: draf, pengiriman, pemrosesan AI, verifikasi manusia, dan pemantauan status.
- Unggah media dua tahap dengan progres, verifikasi SHA-256, karantina berkas tidak valid,
  serta pratinjau dan unduh yang diaudit.
- Peninjauan indikasi AI dan keputusan pemeriksa (terima/kembalikan/tidak konklusif).
- Temuan dan perintah kerja dengan transisi status tervalidasi server.
- Notifikasi dalam aplikasi.
- Laporan periode dengan ringkasan status dan ekspor PDF/Excel serta cetak.
- Riwayat aktivitas (audit) dengan filter.
- Administrasi pengguna, peran, cakupan, dan tautan reset kata sandi sekali pakai.
- Register model AI dan dataset: pengajuan, persetujuan/penolakan bercatatan,
  penerapan (deploy) dan pensiun model, riwayat siklus hidup.

### API (`services/api`)

- FastAPI + SQLAlchemy 2.0 async + Pydantic v2 + Alembic.
- RBAC 6 peran dan 22 izin; otorisasi tingkat objek dan cakupan hierarkis.
- Transisi status inspeksi, temuan, dan perintah kerja divalidasi di backend.
- Audit trail hanya-tambah untuk peristiwa autentikasi dan alur kerja material.
- Media privat melalui MinIO (S3-compatible) dengan validasi tipe, ukuran, signature,
  dan checksum.
- Ekspor laporan XLSX (openpyxl) dan PDF (reportlab).

### Worker AI (`services/ai-worker`)

- Celery worker dengan heartbeat.
- Pipeline **demo** bernama `demo-image-quality` yang menghitung metrik kualitas gambar
  deterministik (luminansi, kontras, variansi tepi).
- **Bukan** pendeteksi kerusakan, tidak mengklaim akurasi, dan tidak digunakan untuk
  keputusan keselamatan.

### Seluler (`apps/mobile`)

- Kerangka aplikasi Flutter dengan navigasi dan halaman status.
- **Belum** memiliki login, kamera, unggah, draf luring, atau sinkronisasi. Lihat
  bagian 21.

## 5. Arsitektur sistem

```text
apps/web (Next.js) ───────┐
                          ├──► services/api (FastAPI) ──► PostgreSQL 16
apps/mobile (Flutter) ────┘             │
                                        ├──► Redis 7.4 (queue, cache, heartbeat)
                                        ├──► MinIO (media privat, karantina)
                                        └──► services/ai-worker (Celery, demo)
```

- Komunikasi web → API melalui proxy same-origin Next.js (`/api/v1`, `/health`) agar
  cookie refresh tetap first-party.
- Media tidak disimpan di PostgreSQL; objek disimpan di bucket privat dan diakses
  melalui API yang diaudit.
- Redis bukan sumber data transaksi permanen.

## 6. Teknologi yang digunakan

| Lapisan | Teknologi |
|---|---|
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide-react |
| API | Python 3.13, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Argon2id, JWT |
| Basis data | PostgreSQL 16 + Alembic |
| Antrean/cache | Redis 7.4 + Celery |
| Penyimpanan objek | MinIO (S3-compatible, privat) |
| Mobile | Flutter (Dart) |
| Laporan | openpyxl, reportlab |
| Infrastruktur | Docker Compose, GitHub Actions (CI) |
| Pengujian | pytest, Vitest, ruff, ESLint, TypeScript, `flutter test` |

## 7. Struktur direktori

```text
.
├── apps/
│   ├── web/                 # Next.js (bahasa Indonesia, identitas #C61F33)
│   └── mobile/              # Flutter (kerangka status)
├── services/
│   ├── api/                 # FastAPI, Alembic, pytest
│   │   ├── app/api/routes/  # auth, assets, inspections, media, maintenance,
│   │   │                    # dashboard, reports, ai_registry, users, audit, ...
│   │   ├── app/core/        # konfigurasi, RBAC, workflow, error handling
│   │   └── alembic/versions/
│   └── ai-worker/           # Celery worker + heuristik demo
├── docs/                    # dokumentasi fase, arsitektur, audit, test report
├── .github/workflows/ci.yml # pipeline CI
├── docker-compose.yml
├── Makefile
├── .env.example
└── README.md
```

## 8. Persyaratan instalasi

- Docker Desktop / Docker Engine dengan Compose v2.
- Windows, macOS, atau Linux.
- Python 3.13 (hanya untuk menjalankan tes/lint di luar Docker).
- Node.js 22+ (hanya untuk menjalankan web di luar Docker).
- Flutter SDK (opsional, untuk `apps/mobile`).
- Port lokal yang dipakai (semua terikat `127.0.0.1`): 3000, 5432, 6379, 8000, 9000, 9001.

## 9. Cara menjalankan development environment

```bash
cp .env.example .env        # lalu ganti seluruh nilai change-me
make setup                  # membuat venv Python dan memasang dependensi dev
docker compose up -d --build
docker compose ps           # semua layanan harus healthy
```

Akses:

- Web: <http://127.0.0.1:3000>
- API: <http://127.0.0.1:8000>
- Swagger/OpenAPI (lingkungan lokal): <http://127.0.0.1:8000/docs>

Akun demo (hanya ada bila `SEED_DEMO_DATA=true` dan `DEMO_SEED_PASSWORD` diisi):

- `admin@demo.railwayvision.example`
- `inspector@demo.railwayvision.example`
- `reviewer@demo.railwayvision.example`
- `supervisor@demo.railwayvision.example`
- `ai@demo.railwayvision.example`
- `auditor@demo.railwayvision.example`

Kata sandi diambil dari `DEMO_SEED_PASSWORD` di `.env` Anda. Jangan pernah mengaktifkan
seed demo di lingkungan yang dapat diakses publik.

## 10. Konfigurasi environment

`.env.example` memuat placeholder untuk:

| Variabel | Kegunaan |
|---|---|
| `APP_ENV`, `LOG_LEVEL` | Mode aplikasi dan tingkat log |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Kredensial basis data lokal |
| `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | Redis dan antrean |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_*_BUCKET` | Penyimpanan objek privat |
| `MEDIA_MAX_BYTES` | Batas ukuran unggahan media |
| `DEMO_AI_ENABLED` | Mengaktifkan pipeline AI demo (lokal) |
| `NEXT_PUBLIC_API_BASE_URL` | Kosongkan untuk proxy same-origin |
| `CORS_ALLOWED_ORIGINS` | Origin web yang diizinkan |
| `JWT_SECRET`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS` | Token |
| `ENABLE_HSTS`, `MAX_JSON_BODY_BYTES` | Pengerasan API |
| `SEED_DEMO_DATA`, `DEMO_SEED_PASSWORD` | Seed akun/data demo lokal |

Aturan: **jangan commit `.env`**, gunakan secret manager di lingkungan non-lokal, dan
jangan menggunakan nilai contoh di luar local development.

## 11. Database migration

Migrasi berjalan otomatis saat container API start (`alembic upgrade head`).

```bash
make migrate                                  # atau:
docker compose exec api alembic upgrade head
```

Revisi terbaru: `8f1c2d3e4a50` (siklus hidup model AI + registri dataset).
Membuat migrasi baru:

```bash
docker compose exec api alembic revision -m "deskripsi" --autogenerate
```

Selalu tinjau hasil autogenerate sebelum diterapkan.

## 12. Cara menjalankan backend

Cara utama adalah melalui Docker (bagian 9). Untuk menjalankan API langsung:

```bash
cd services/api
../../.venv/Scripts/python.exe -m uvicorn app.main:app --reload
```

Pastikan `DATABASE_URL`, `REDIS_URL`, dan `JWT_SECRET` tersedia di environment.
Pemeriksaan kesehatan: `GET /health/live`, `GET /health/ready`, `GET /api/v1/meta`.

## 13. Cara menjalankan frontend

```bash
cd apps/web
npm install
npm run dev
```

Web mem-proxy `/api/v1` dan `/health` ke API (lihat `next.config.ts`). Untuk build:

```bash
npm run build && npm run start
```

## 14. Cara menjalankan mobile

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000   # emulator Android
```

Gunakan `http://localhost:8000` untuk simulator iOS. Saat ini aplikasi seluler adalah
kerangka status; modul lapangan belum tersedia.

## 15. Cara menjalankan AI worker

Worker berjalan sebagai layanan Compose `ai-worker`:

```bash
docker compose logs -f ai-worker
```

Worker menulis heartbeat ke Redis (`rvai:worker:heartbeat`) dan memproses job dari
antrean Celery. Pipeline yang terdaftar adalah **demo kualitas gambar**, bukan deteksi
kerusakan. Jangan menambahkan model yang belum disetujui ke lingkungan operasional.

## 16. Cara menjalankan testing

```bash
# API
cd services/api
../../.venv/Scripts/ruff.exe check app tests
../../.venv/Scripts/python.exe -m pytest -q

# AI worker
cd services/ai-worker
../../.venv/Scripts/python.exe -m pytest -c pyproject.toml -q

# Web
cd apps/web
npx tsc --noEmit
npx eslint src
npx vitest run

# Seluler
cd apps/mobile
flutter analyze
flutter test
```

Hasil verifikasi lokal terakhir (2026-11-23):

- API: **73 tes lulus**, ruff bersih.
- AI worker: **8 tes lulus**.
- Web: **38 tes lulus**, TypeScript dan ESLint bersih.
- Build container `api` dan `web` berhasil; seluruh layanan Compose healthy.

Angka di atas adalah hasil eksekusi lokal, bukan sertifikasi. Lihat
`docs/TEST_REPORT.md` dan laporan fase untuk rincian historis.

## 17. Dokumentasi API

- OpenAPI interaktif: `http://127.0.0.1:8000/docs` (lokal/pengujian).
- `docs/API_DOCUMENTATION.md` dan `API_SPECIFICATION.md` (kontrak dan contoh).
- Format error standar memuat `error.code`, `error.message`, `error.request_id`, dan
  `error.details`; setiap respons error menyertakan `X-Request-ID`.

Semua endpoint memberlakukan autentikasi dan izin backend; login saja tidak memberi
akses ke objek di luar cakupan (respons `404` untuk objek lintas cakupan).

## 18. Keamanan

- Kata sandi di-hash Argon2id; akses JWT berumur pendek (15 menit) dengan refresh token
  opaque yang dirotasi dan dapat dicabut.
- Pembatasan laju login (5 kegagalan / 300 detik).
- RBAC 6 peran / 22 izin dari PostgreSQL, ditambah pembatasan cakupan hierarkis.
- Bukti media disimpan privat; akses melalui API yang diaudit, dengan checksum dan
  karantina untuk berkas tidak valid.
- Header keamanan, batas ukuran body JSON, CORS terbatas, dan audit trail hanya-tambah.
- Log tidak memuat kata sandi, token, atau signed URL.

Cara melaporkan kerentanan: lihat [`SECURITY.md`](SECURITY.md) dan
`docs/10_PROJECT_GOVERNANCE/GITHUB_SECURITY_AUDIT.md`.

## 19. Roadmap

1. Konsol operasi sistem: riwayat job AI, log terbatas peran, riwayat deployment,
   dan status backup.
2. Reset data DEMO yang aman (hanya data demo, tidak pernah data operasional).
3. Transport notifikasi tambahan (email/WhatsApp) sesuai kebijakan KCIC.
4. Aplikasi lapangan Flutter: login, kamera, kompresi, unggah, draf luring, sinkronisasi.
5. Alat anotasi dan manajemen dataset yang terhubung ke registri.
6. Model AI terotorisasi dengan evaluasi terukur, setelah dataset dan protokol evaluasi
   disetujui pemilik data.
7. Pengujian integrasi, keamanan, dan beban yang lebih luas; UAT terdokumentasi.
8. Gerbang kesiapan produksi (deployment, backup/DR, monitoring, persetujuan KCIC).

## 20. Status implementasi

| Fase | Lingkup | Status |
|---|---|---|
| 1 | Fondasi monorepo, Docker, CI | Selesai (lokal) |
| 2 | Autentikasi, RBAC, cakupan, audit, pemulihan kata sandi | Selesai (lokal) |
| 3 | Register aset dan workflow inspeksi 9 status | Selesai (lokal) |
| 4 | Bukti media privat dan pipeline AI demo | Selesai (lokal) |
| 5 | Model AI terotorisasi dan evaluasi | Registri + konsol tersedia; model nyata **belum ada** |
| 6 | Verifikasi manusia dan tinjauan bukti | Selesai (lokal) |
| 7 | Temuan, perintah kerja, notifikasi | Selesai (lokal) |
| 8 | Dasbor KPI, laporan PDF/Excel, registri model & dataset | Tersedia (lokal); operasi sistem lain dalam pengerjaan |
| 9 | Aplikasi lapangan Flutter | Kerangka saja |
| 10 | Pengujian integrasi/keamanan menyeluruh dan UAT | Sebagian; UAT resmi **belum dilakukan** |

Tidak ada fase yang boleh dianggap "production-ready" sampai gerbang penerimaan,
persetujuan KCIC, dan UAT resmi terpenuhi.

## 21. Batasan proyek

- Tidak ada model AI terlatih, dataset resmi, taksonomi kerusakan resmi, bounding box,
  severity, confidence, atau metrik akurasi. Pipeline demo hanya menghitung kualitas gambar.
- Tidak ada integrasi SSO/OIDC resmi; adapter autentikasi lokal bersifat sementara.
- Tidak ada pengiriman email/SMS; tautan reset kata sandi disalin manual dari UI admin.
- Aplikasi seluler belum siap untuk lapangan.
- Tidak ada fungsi kendali/persinyalan/keselamatan kritis, dan tidak akan ditambahkan
  tanpa kajian keselamatan serta persetujuan khusus.
- Tidak ada data KCIC. Semua data contoh sintetis dan berlabel DEMO.
- Verifikasi dilakukan pada stack lokal, bukan infrastruktur KCIC.
- Tidak ada klaim kepatuhan terhadap SOP, standar, atau regulasi tertentu.

## 22. Disclaimer

RailwayVision AI merupakan proyek sistem pendukung inspeksi infrastruktur perkeretaapian.
Repository ini bukan representasi kebijakan, SOP, atau sistem resmi PT Kereta Cepat
Indonesia China (KCIC), dan publikasinya tidak menyatakan adanya persetujuan atau
afiliasi resmi KCIC. Seluruh penggunaan pada lingkungan operasional memerlukan validasi,
otorisasi, pengujian, dan persetujuan pihak yang berwenang.

Keluaran AI bersifat saran dan awal; keluaran harus diverifikasi oleh peninjau berwenang.
Sistem ini tidak menyatakan infrastruktur apa pun aman atau tidak aman, dan tidak boleh
digunakan sebagai izin keselamatan atau pengganti prosedur inspeksi resmi.

---

## Lisensi

Status lisensi: **`PENDING_OWNER_APPROVAL`**. Belum ada lisensi sumber terbuka yang
diberikan. Lihat [`LICENSE`](LICENSE). Jangan menggunakan, menyalin, atau
mendistribusikan ulang tanpa persetujuan pemilik hak cipta.

## Kontribusi

Lihat [`CONTRIBUTING.md`](CONTRIBUTING.md). Dilarang keras memasukkan data operasional
KCIC, media inspeksi nyata, dataset privat, credential, atau hasil pengujian/persetujuan
fiktif.
