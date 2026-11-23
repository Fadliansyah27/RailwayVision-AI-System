# Implementation Gap Matrix — RailwayVision AI

Tanggal: 2026-11-23 · Basis: commit `0a6a92c` + working tree · Lihat `EXISTING_PROJECT_AUDIT.md`.

Status: `IMPLEMENTED` (kode ada), `WORKING` (diuji lokal), `PARTIAL`, `BROKEN`,
`PLACEHOLDER`, `MOCK`, `MISSING`, `BLOCKED`, `PENDING_KCIC_VALIDATION`.
`WORKING` di sini berarti teruji pada stack lokal, bukan kesiapan produksi/KCIC.

| ID | Kapabilitas | Status | Bukti (lokasi) | Kesenjangan / tindakan berikut | Dependensi |
|---|---|---|---|---|---|
| A01 | Login, sesi refresh, logout, ganti kata sandi | WORKING | `services/api/app/api/routes/auth.py`, tes API | MFA dan deteksi reuse token belum ada | Kebijakan keamanan |
| A02 | Reset kata sandi sekali pakai | PARTIAL | UI admin + digest SHA-256, TTL 30 menit | Pengiriman email/SMS, rate limit permintaan, sapuan kedaluwarsa | Penyedia email/SMS |
| A03 | RBAC 6 peran / 22 izin + cakupan hierarkis | WORKING | `app/core/rbac.py`, tes otorisasi | Matriks peran final | PENDING_KCIC_VALIDATION |
| A04 | Audit trail hanya-tambah + filter | WORKING | route `audit`, UI riwayat | Ekspor audit belum ada | — |
| B01 | Register aset/lokasi/kategori | WORKING | route `assets`, UI `/assets` | Penghapusan/arsip, label QR, riwayat status aset | Master aset KCIC |
| B02 | Workflow inspeksi 9 status | WORKING | `app/core/workflow.py`, tes transisi | Taksonomi status final | PENDING_KCIC_VALIDATION |
| B03 | Master checklist + snapshot + submit guard | WORKING | route `checklists`, migration, tes | Bobot/skor dan item final | PENDING_KCIC_VALIDATION |
| B04 | Bukti media privat (2 fase, SHA-256, karantina) | WORKING | route `media`, MinIO, tes | Hapus media, purge karantina, strip EXIF/GPS, scan malware | Kebijakan retensi |
| B05 | Review manusia (3 keputusan) + reopen | WORKING | route `reviews`, UI detail | Antrean review, penugasan, SLA | SOP review |
| B06 | Temuan dan perintah kerja | WORKING | route `maintenance`, UI | Tenggat, penjadwalan, eskalasi | SOP pemeliharaan |
| B07 | Notifikasi dalam aplikasi | WORKING | route `notifications`, badge | Transport email/WhatsApp, preferensi | Kebijakan KCIC |
| C01 | Dasbor KPI PostgreSQL + tren WIB | WORKING | `routes/dashboard.py`, UI `/` | KPI final | Definisi KPI |
| C02 | Laporan periode + PDF/XLSX + audit | WORKING | `routes/reports.py`, UI `/reports` | Format laporan resmi, tanda tangan digital | Format KCIC |
| C03 | Registri model & dataset + siklus hidup | WORKING | `routes/ai_registry.py`, UI `/models` | Unggah artefak + verifikasi checksum blob | Penyimpanan artefak |
| C04 | Pipeline AI demo (kualitas gambar) | WORKING | `services/ai-worker` | Tidak boleh disebut deteksi kerusakan | — |
| C05 | Model deteksi terlatih + evaluasi akurasi | BLOCKED | — | Dataset terotorisasi, artefak model, protokol evaluasi | Persetujuan pemilik data |
| D01 | Web Next.js berbahasa Indonesia, identitas merah | WORKING | `apps/web`, `docs/DESIGN_SYSTEM.md` | Konsistensi token pada halaman baru | — |
| D02 | Seluler Flutter Fase B (login, inspeksi, checklist, kamera, unggah, antrean luring) | WORKING (widget + API layer live) | `apps/mobile`, 7 tes, 1 smoke live | Otomasi UI layar, perangkat fisik, build bertanda tangan, push/background sync | Perangkat uji |
| D03 | Konsol operasi (riwayat job AI, log per peran, backup, deployment, reset DEMO) | MISSING | — | Rencana Fase D | Kebijakan operasi |
| E01 | Docker Compose + healthcheck | WORKING | `docker-compose.yml`, 6 layanan healthy | Profil produksi | Infrastruktur KCIC |
| E02 | CI GitHub Actions | IMPLEMENTED (belum jalan di GitHub) | `.github/workflows/ci.yml` | Eksekusi nyata setelah remote tersedia | Remote + auth |
| E03 | Migration Alembic | WORKING | revisi `8f1c2d3e4a50` | Uji upgrade/downgrade pada salinan data | — |
| E04 | Publikasi GitHub Public | BLOCKED | `GITHUB_SECURITY_AUDIT.md` | `gh auth login` / token `repo`, buat repo `RailwayVision-AI`, lalu push | Autentikasi pemilik |
| F01 | SOP inspeksi, kategori kerusakan, severity, threshold, protokol kamera | PENDING_KCIC_VALIDATION | `KCIC_VALIDATION_REGISTER.md` | Divalidasi KCIC; jangan dikarang | KCIC |
| F02 | SSO/OIDC, retensi data, backup/DR, persetujuan AI | PENDING_KCIC_VALIDATION | register validasi | Kebijakan resmi | KCIC |
| F03 | UAT resmi dan gerbang produksi | MISSING | `TEST_PLAN.md` §4 | Dijadwalkan setelah validasi | KCIC |

## Prioritas yang dapat dikerjakan tanpa dependensi eksternal

1. Fase C: penyajian hasil AI dan alur perintah kerja/laporan lanjutan di web + seluler.
2. Fase D: konsol operasi (riwayat job, log per peran, status backup, reset khusus DEMO).
3. Pengerasan: hapus media/purge karantina, MFA, notifikasi eksternal bila penyedia tersedia.
4. Otomasi UI seluler dan pengujian perangkat fisik.

## Tidak boleh dilakukan tanpa persetujuan

- Mengarang SOP, kategori kerusakan, severity, threshold, atau angka akurasi.
- Menghubungkan sistem ke persinyalan, interlocking, train control, CTCS, GSM-R, SCADA.
- Mempublikasikan data/media/dokumen KCIC atau credential apa pun.
- Menyatakan kesiapan produksi atau afiliasi resmi KCIC.
