# Audit Proyek Existing — RailwayVision AI

Tanggal audit: 2026-11-23
Commit yang diaudit: `0a6a92c` (branch `main`, repository lokal tanpa remote)
Lokasi: `D:\Dokumen\QODER\AI-Based Railway Infrastructure Inspection`

Dokumen ini mencatat kondisi **nyata** project existing sebelum/selama pekerjaan lanjutan.
Klasifikasi menggunakan status: `IMPLEMENTED`, `WORKING`, `PARTIAL`, `BROKEN`,
`PLACEHOLDER`, `MOCK`, `MISSING`, `BLOCKED`, `PENDING_KCIC_VALIDATION`.

Audit dilakukan dengan membaca source code, konfigurasi, migration, dokumentasi, dan
menjalankan suite otomatis. Tidak ada fitur yang dinyatakan `WORKING` hanya karena
halamannya dapat dibuka.

## 1. Fakta repository

| Aspek | Kondisi |
|---|---|
| Bentuk | Monorepo existing (bukan project baru, bukan template baru) |
| Web | `apps/web` — Next.js 16.4.6 (App Router), React 19, TypeScript, Tailwind v4 |
| API | `services/api` — FastAPI, SQLAlchemy 2.0 async, Pydantic v2, Alembic |
| Worker | `services/ai-worker` — Celery, heartbeat Redis |
| Basis data | PostgreSQL 16 (sumber data transaksi), Redis 7.4 (antrean/cache), MinIO (media privat) |
| Seluler | `apps/mobile` — Flutter 3.47.7 (Fase B) |
| Identitas warna | Merah `#C61F33` (token terdokumentasi di `docs/DESIGN_SYSTEM.md`) |
| Remote Git | **Tidak ada** — publikasi belum dilakukan |
| Data contoh | Seed DEMO berlabel, hanya aktif bila `SEED_DEMO_DATA=true` |

## 2. Bukti eksekusi (bukan inferensi)

| Pemeriksaan | Hasil |
|---|---|
| API: `pytest -q` (dari `services/api`) | 77 lulus |
| API: `ruff check app tests` | 0 temuan |
| AI worker: `pytest -c pyproject.toml -q` | 8 lulus |
| Web: `tsc --noEmit`, `npm run lint`, `vitest run` | bersih; 38 lulus |
| Flutter: `flutter analyze` | 0 isu |
| Flutter: `flutter test` | 7 lulus (+1 live test di-skip tanpa kredensial) |
| Flutter live smoke (`test/live_api_test.dart`) terhadap Compose lokal | lulus — login, readiness, daftar/detail inspeksi, aset, logout |
| Flutter: `flutter build web --release` | berhasil |
| Docker Compose | 6 layanan healthy saat verifikasi live |

Rincian perintah dan batasan tercatat di `docs/10_PROJECT_GOVERNANCE/FINAL_TEST_REPORT.md`
dan `docs/TEST_REPORT.md`.

## 3. Inventaris fitur dan klasifikasi

### 3.1 Platform dan keamanan

| Kapabilitas | Status | Bukti / catatan |
|---|---|---|
| Compose stack (postgres, redis, minio, api, ai-worker, web) | WORKING (lokal) | `docker-compose.yml`, healthcheck; port loopback |
| Autentikasi Argon2id + JWT akses 15 menit | WORKING (lokal) | `app/core/security.py`, tes auth |
| Sesi refresh opaque, rotasi, revokasi logout/ganti kata sandi | WORKING (lokal) | tes API sesi |
| Rate limit login (5 gagal / 300 detik) | WORKING (lokal) | tes 429 |
| Reset kata sandi sekali pakai (tautan dari UI admin) | PARTIAL | Tidak ada pengiriman email/SMS; tautan disalin manual |
| RBAC 6 peran / 22 izin dari PostgreSQL | WORKING (lokal) | otorisasi backend per request |
| Cakupan hierarkis (lintas cakupan → 404) | WORKING (lokal) | tes RBAC/scope |
| Audit trail hanya-tambah + filter/paginasi | WORKING (lokal) | `audit` route, tes |
| MFA / deteksi reuse refresh token | MISSING | — |
| SSO/OIDC resmi | BLOCKED | Menunggu identitas resmi KCIC |

### 3.2 Operasi inspeksi

| Kapabilitas | Status | Bukti / catatan |
|---|---|---|
| Register aset, lokasi, kategori (filter, cari, paginasi) | WORKING (lokal) | route `assets`, UI `/assets` |
| Workflow inspeksi 9 status tervalidasi server | WORKING (lokal) | `app/core/workflow.py`, tes transisi |
| Master checklist per jenis + snapshot saat draf | WORKING (lokal) | `checklists` route, migration |
| Penjagaan submit checklist wajib (`422 checklist_incomplete`) | WORKING (lokal) | tes backend |
| Unggah media dua fase + SHA-256 + karantina | WORKING (lokal) | `media` route, MinIO privat |
| Pratinjau/unduh media dengan audit | WORKING (lokal) | tes media |
| Penghapusan media / purge karantina / strip EXIF | MISSING | — |
| Tinjauan AI + keputusan pemeriksa (terima/kembalikan/tidak konklusif) | WORKING (lokal) | route `reviews` |
| Temuan + perintah kerja + transisi tervalidasi | WORKING (lokal) | route `maintenance`, tes |
| Notifikasi dalam aplikasi | WORKING (lokal) | badge unread; tanpa email/SMS |
| Tenggat / overdue perintah kerja | MISSING | — |
| Dasbor KPI dari PostgreSQL (tren 6 bulan WIB) | WORKING (lokal) | `dashboard.py`, UI `/` |
| Laporan periode + ekspor PDF/XLSX + audit ekspor | WORKING (lokal) | `reports.py`, UI `/reports` |
| Registri model & dataset + siklus hidup | WORKING (lokal) | `ai_registry.py`, UI `/models` |
| Unggah/unduh artefak model + verifikasi checksum blob | MISSING | Artefak tidak diunggah |
| Konsol operasi (riwayat job AI, log per peran, backup, deployment, reset DEMO) | MISSING | Roadmap Fase D |

### 3.3 AI

| Kapabilitas | Status | Bukti / catatan |
|---|---|---|
| Pipeline demo `demo-image-quality` (metrik kualitas gambar) | WORKING (lokal) | Celery worker, disclaimer eksplisit |
| Model deteksi kerusakan terlatih | MISSING / BLOCKED | Butuh dataset, artefak, protokol evaluasi yang disetujui |
| Taksonomi kerusakan, severity, threshold | PENDING_KCIC_VALIDATION | Tidak boleh dikarang |
| Confidence/akurasi | TIDAK ADA KLAIM | Tidak ditampilkan sebagai hasil nyata |

### 3.4 Antarmuka

| Kapabilitas | Status | Bukti / catatan |
|---|---|---|
| Web berbahasa Indonesia dengan identitas merah | WORKING (lokal) | diverifikasi browser |
| Navigasi berbasis peran, sesi cookie HttpOnly | WORKING (lokal) | proxy same-origin |
| Seluler Flutter: login, daftar/detail, checklist, draf luring, kamera/galeri, unggah 2 fase, antrean luring | WORKING (level widget + lapisan API live) | 7 tes widget; smoke API live |
| Otomasi UI layar seluler terhadap API live; perangkat fisik; build bertanda tangan | MISSING / belum diuji | Tidak diklaim |
| Push notification / sinkronisasi latar | MISSING | — |

### 3.5 Rekayasa dan tata kelola

| Kapabilitas | Status | Catatan |
|---|---|---|
| Migration Alembic (revisi terakhir `8f1c2d3e4a50`) | WORKING (lokal) | diterapkan pada stack lokal |
| CI GitHub Actions | IMPLEMENTED (belum dieksekusi di GitHub) | Tidak ada remote |
| Dokumentasi fase, arsitektur, keamanan, desain | WORKING | `docs/` |
| Lisensi open source | PENDING_OWNER_APPROVAL | `LICENSE` status eksplisit |
| UAT resmi / persetujuan KCIC | PENDING_KCIC_VALIDATION | Tidak ada bukti persetujuan |
| Data operasional KCIC | TIDAK ADA | Semua data contoh sintetis berlabel DEMO |

## 4. Temuan utama

1. Seluruh alur inti (autentikasi → inspeksi → bukti → AI demo → review → temuan →
   perintah kerja → laporan) sudah terhubung frontend–API–PostgreSQL dan diuji lokal.
2. Tidak ditemukan data operasional palsu yang disamarkan sebagai data nyata; seed bersifat
   DEMO dan dapat dimatikan.
3. Kesenjangan terbesar bukan pada alur inti, melainkan pada: konsol operasi, artefak model,
   notifikasi eksternal, kapabilitas lapangan lanjutan, dan seluruh validasi KCIC.
4. Publikasi ke GitHub belum dilakukan karena tidak ada remote dan autentikasi GitHub yang
   terverifikasi; hal ini dicatat di `GITHUB_SECURITY_AUDIT.md`.

## 5. Pernyataan batas

Dokumen ini merupakan audit teknis internal, bukan sertifikasi, bukan UAT, dan bukan
pernyataan kesiapan produksi atau afiliasi resmi KCIC. Matriks rinci ada di
`IMPLEMENTATION_GAP_MATRIX.md`.
