# Master Prompt Compliance — RailwayVision AI

Tanggal audit: 2026-11-23
Acuan: MASTER PROMPT — RailwayVision AI (real-world production software development),
17 bagian. Status dinilai terhadap repository lokal, bukan terhadap klaim pemasaran.

Status yang dipakai: `COMPLETED` (lokal), `PARTIAL`, `BLOCKED`, `PENDING_KCIC_VALIDATION`.
Tidak ada item berstatus `FAILED`. Tidak ada klaim production-ready atau persetujuan KCIC.

## Ringkasan per bagian prompt

| § | Persyaratan | Status | Bukti / catatan |
|---|---|---|---|
| 1 | Identitas proyek, bukan demo | COMPLETED | README §1–2; disclaimer; data demo berlabel |
| 2 | 15 komponen misi terintegrasi | PARTIAL | Web/API/DB/worker/queue/storage berjalan; mobile masih kerangka; AI masih demo |
| 3 | Identitas visual merah `#C61F33` + design system | COMPLETED | `apps/web/src/app/globals.css`, `apps/mobile/lib/core/theme.dart`, `components/ui.tsx` |
| 4 | UI/UX enterprise, Bahasa Indonesia, empty state, penanda DEMO | COMPLETED | Seluruh halaman web berbahasa Indonesia; empty/loading/error state; label DEMO |
| 5 | Arsitektur baseline (Next/React/TS, Flutter, FastAPI, PG, Redis, S3, Docker) | COMPLETED | PostGIS sengaja belum diaktifkan karena kebutuhan geospasial belum dikonfirmasi |
| 6 | Workflow inspeksi dan AI hanya indikasi | PARTIAL | Workflow 9 status, review, approval berjalan; ruang lingkup/SOP pending KCIC |
| 7A | Dashboard dari database | COMPLETED | `GET /api/v1/dashboard/overview`, `components/operational-overview.tsx` |
| 7B | User/role/permission/scope/organisasi | PARTIAL | Pengguna, peran, izin, cakupan ada; entitas `organizations` belum dimodelkan |
| 7C | Asset management | PARTIAL | Register aset + lokasi; master kategori/hierarki aset belum dimodelkan |
| 7D | Inspection management + checklist | PARTIAL | Inspeksi, media, status, riwayat, checklist master + snapshot + guard submit ada; koreksi kategori dan integrasi kamera/SOP resmi belum |
| 7E | AI detection (jobs, confidence, bbox, segmen) | PARTIAL | Job AI + indikasi demo ada; tidak ada bbox/segmentasi; model nyata belum ada |
| 7F | Technical review termasuk koreksi kategori | PARTIAL | Antrean, bukti, terima/kembalikan/tidak konklusif, catatan; koreksi kategori belum ada |
| 7G | Supervisor approval | COMPLETED | Persetujuan/penolakan/pengembalian + riwayat keputusan |
| 7H | Work order end-to-end | COMPLETED | Pembuatan, prioritas, penugasan, status, verifikasi penyelesaian, penutupan |
| 7I | Dataset management | PARTIAL | Registri + persetujuan dataset; anotasi, QC, versioning, evaluasi belum ada |
| 7J | Model management | COMPLETED | Registri, evaluasi tercatat, persetujuan, deploy/rollback, pensiun |
| 7K | Reporting | PARTIAL | Laporan inspeksi PDF/Excel; laporan AI dan work order belum terpisah |
| 7L | Audit trail | COMPLETED | Audit hanya-tambah, filter, ekspor tercatat |
| 8 | RBAC backend + scope | COMPLETED | 6 peran / 22 izin divalidasi di backend; role perlu konfirmasi KCIC |
| 9 | Database/API terstruktur, `/api/v1`, OpenAPI | PARTIAL | UUID, FK, migrasi, OpenAPI, error standar; beberapa entitas belum ada (lihat gap) |
| 10 | Dataset/AI pipeline dan evaluasi terukur | BLOCKED + PENDING_KCIC_VALIDATION | Tidak ada dataset/model/metrik nyata; dilarang mengarang; pipeline demo saja |
| 11 | Security aplikasi | COMPLETED (lokal) | Argon2id, JWT, rate limit, object-level auth, media privat, validasi unggah, audit |
| 11 | Security infrastruktur (TLS, at-rest, secret manager, backup) | PARTIAL | Belum ada TLS/at-rest/secret manager/backup di stack lokal |
| 12 | Kualitas per modul (UI, backend, DB, izin, validasi, tes) | PARTIAL | Modul yang ada lulus tes (77 API, 8 worker, 38 web); modul yang belum ada tidak dihitung |
| 13 | Deployment & environment separation | PARTIAL | Docker Compose development; staging/produksi/backup/rollback belum ada |
| 14 | Audit lalu implementasi bertahap | COMPLETED | Fase 1–8 selesai lokal; fase 9 sebagian; fase 10 belum |
| 15 | Penandaan `PENDING_KCIC_VALIDATION` | COMPLETED | `docs/10_PROJECT_GOVERNANCE/KCIC_VALIDATION_REGISTER.md` |
| 16 | Laporan per fase | PARTIAL | Laporan fase 1–4, 6, 7 tersedia; laporan fase 5 dan 8 belum dibuat |
| 17 | Target akhir & larangan klaim | COMPLETED | README §20–22 menyatakan batasan dan status apa adanya |

## Gap fungsional yang belum ada (prioritas implementasi berikutnya)

1. **Master data aset**: tipe/kategori, hierarki, organisasi — modul 7B/7C.
2. **Aplikasi lapangan Flutter**: login, kamera, unggah, draf luring, sinkronisasi.
3. **Dataset governance lengkap**: anotasi, QC, versioning, split, evaluasi.
4. **AI nyata** beserta metrik — bergantung pada dataset dan persetujuan (BLOCKED).
5. **Laporan AI dan work order** terpisah.
6. **Konsol operasi**: riwayat job AI, log terbatas peran, riwayat deploy, status backup.
7. **Entitas belum dimodelkan**: organizations, asset_types, inspection_types,
   camera_profiles, media_derivatives, defect_categories, follow_up_proposals/approvals,
   work_order_updates, system_settings.
8. **Hardening deployment**: TLS, enkripsi at-rest, secret manager, backup/DR, staging.

## Catatan

- Status publikasi terpisah dari status produk: konten `PUBLICATION_READY`, publikasi
  `BLOCKED_GITHUB_AUTH`. Publikasi tidak menyatakan kesiapan operasional.
- Setiap item baru hanya boleh ditandai selesai setelah ada tes dan bukti eksekusi.
