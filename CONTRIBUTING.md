# Panduan Kontribusi — RailwayVision AI

Terima kasih atas minat Anda. Repository ini adalah prototipe pendukung
keputusan inspeksi perkeretaapian. Kontribusi harus menghormati batas
keselamatan dan aturan data yang tercantum di bawah.

## 1. Aturan yang tidak dapat dilanggar

- Jangan menambahkan data KCIC, foto/video inspeksi nyata, dataset privat,
  dokumen internal, atau data pribadi.
- Jangan menambahkan credential, token, kunci, atau connection string berisi
  kredensial ke dalam kode, konfigurasi, atau dokumentasi.
- Jangan membuat hasil pengujian, UAT, persetujuan, atau metrik evaluasi yang
  tidak benar-benar dijalankan.
- Jangan menambahkan fungsi kendali kereta, persinyalan, interlocking, dispatch,
  atau keputusan "aman/tidak aman" otomatis.
- Jangan melemahkan autentikasi, RBAC, pembatasan cakupan, validasi backend,
  checksum media, atau audit trail.
- Jangan mengubah workflow agar AI dapat menyetujui atau menutup pekerjaan.

## 2. Alur kontribusi

1. Buat branch dari `main` dengan nama deskriptif, misalnya
   `feat/ops-console` atau `fix/media-quarantine`.
2. Buat perubahan kecil dan terfokus; sertakan tes bila perilaku berubah.
3. Jalankan seluruh pemeriksaan lokal (bagian 3).
4. Buat commit dengan pesan yang jelas (imperatif, Bahasa Indonesia atau
   Inggris konsisten).
5. Buka pull request yang menjelaskan: masalah, pendekatan, bukti pengujian,
   dan apakah ada perubahan migrasi/konfigurasi.
6. Tunggu tinjauan. Perubahan yang menyentuh keamanan, workflow, atau data
   memerlukan tinjauan tambahan.

Jangan memaksa push (`git push --force`) ke branch bersama, dan jangan menulis
ulang riwayat repository tanpa persetujuan pemilik.

## 3. Pemeriksaan wajib sebelum PR

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

# Seluler (bila menyentuh apps/mobile)
cd apps/mobile
flutter analyze
flutter test
```

## 4. Standar kode

- API: Python 3.13, async SQLAlchemy, Pydantic v2. Semua endpoint wajib memeriksa
  izin backend dan cakupan objek.
- Migrasi: gunakan Alembic, aditif bila memungkinkan, tinjau hasil autogenerate,
  dan pastikan downgrade tersedia bila layak.
- Web: TypeScript strict, komponen di `src/components`, akses API melalui
  `src/lib/api.ts`. UI dan pesan pengguna berbahasa Indonesia.
- Mobile: Flutter native (bukan WebView). Kredensial di secure storage.
- Tulis dokumentasi sesuai implementasi nyata; gunakan `PENDING_KCIC_VALIDATION`
  atau `BLOCKED` bila informasi belum tersedia.

## 5. Commit dan lisensi

- Format pesan yang disarankan: `feat: …`, `fix: …`, `docs: …`, `test: …`,
  `chore: …`.
- Dengan mengirim kontribusi, Anda menyatakan bahwa Anda berhak mengirimkan kode
  tersebut dan tidak menyertakan materi pihak ketiga tanpa izin.
- Status lisensi repository saat ini `PENDING_OWNER_APPROVAL`; lihat `LICENSE`.
  Kontribusi diterima untuk keperluan tinjauan dan pengembangan yang disetujui.

## 6. Pelaporan masalah

- Bug fungsional: buka issue dengan langkah reproduksi yang tidak memuat data
  sensitif.
- Kerentanan keamanan: **jangan** buka issue publik; ikuti `SECURITY.md`.
