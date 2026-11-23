# Design System — RailwayVision AI

Identitas visual RailwayVision AI menggunakan merah `#C61F33` sebagai warna utama. Merah
dipakai secara proporsional pada elemen identitas dan aksi, bukan sebagai latar seluruh
halaman. Dokumen ini adalah rujukan untuk web (`apps/web`) dan seluler (`apps/mobile`).

## Token warna

Implementasi web: `apps/web/src/app/globals.css` (`--rv-*`, dipetakan ke Tailwind melalui
`@theme inline`). Implementasi seluler: `apps/mobile/lib/core/theme.dart` (`RvColors`).

| Token | Nilai | Penggunaan |
|---|---|---|
| Primary | `#C61F33` | Navigasi aktif, tombol utama, tab aktif, aksen merek |
| Primary strong | `#A8192D` | Hover/pressed, aksen AI, snackbar seluler |
| Primary soft | `#FCECEF` | Latar highlight merah, chip AI, avatar |
| Canvas | `#F8F9FB` | Latar halaman |
| Surface | `#FFFFFF` | Kartu, panel, dialog |
| Ink | `#101820` | Teks utama |
| Secondary | `#667085` | Teks sekunder dan metadata |
| Border | `#E5E7EB` | Garis pemisah |
| Success | `#16A34A` (soft `#E9F6F1`) | Status berhasil/lulus |
| Warning | `#D97706` (soft `#FDF5E6`) | Status peringatan/DEMO |
| Critical | `#DC2626` (soft `#FDEEEC`) | Status gagal/penolakan |

Catatan aksesibilitas: warna status memakai varian yang mempertahankan kontras teks pada
latar lembut; merah utama tetap menjadi identitas dominan. Rasio kontras teks diperiksa
pada komponen utama (tombol putih di atas primary, teks ink di atas canvas/surface).

## Aturan dominasi merah

- Sidebar web: latar gelap, logo merah, dan **item navigasi aktif berlatar merah penuh**
  dengan teks putih.
- Header web: garis aksen atas merah 3 px.
- Tombol aksi utama, tab aktif, tautan penting, dan penanda merek memakai primary.
- Seluler: app bar merah dengan teks/ikon putih, logo `RV` putih dengan huruf merah,
  `FilledButton` merah, FAB merah, indikator dan label navigasi aktif merah.
- Hindari halaman merah penuh; gabungkan merah dengan putih, canvas, dan teks gelap.

## Komponen web

Sumber: `apps/web/src/components/ui.tsx` dan `components/admin/form-styles.ts`.

- `Card`, `CardHeader`: panel putih, border tipis, bayangan satu tingkat.
- `Chip`: tone `success`, `warning`, `critical`, `neutral`, `ai` (keluarga merah).
- `EmptyState`: ikon, judul, deskripsi; wajib dipakai saat data belum tersedia.
- `PageHeader`: eyebrow merah, judul ink, deskripsi sekunder.
- Tombol: `primaryButtonClass` (merah), `secondaryButtonClass` (putih ber-border),
  `dangerButtonClass` (merah lembut), `subtleButtonClass`.
- Form: `inputClass`, `labelClass` dengan fokus cincin merah (`--rv-focus`).
- Status inspeksi dan label domain: `components/records.tsx`, `lib/domain.ts`.

## Komponen seluler

`ThemeData` Flutter menetapkan `ColorScheme.fromSeed(seedColor: #C61F33)` lalu menimpa
primary/onPrimary. App bar, tombol terisi, FAB, indikator progres, dan navigasi aktif
mengikuti merah. `DemoBadge` memiliki varian `onBrand` untuk dipakai di app bar merah.

## Status dan label

- Setiap data sintetis wajib diberi label `DEMO`; jangan menampilkan angka yang tidak
  berasal dari API.
- AI bersifat advisori: gunakan tone AI (merah) dengan teks penjelas, bukan klaim akurasi.
- Status keselamatan tidak pernah dinyatakan otomatis oleh UI.

## Verifikasi

Perubahan visual diverifikasi dengan `tsc`, ESLint, Vitest, `flutter analyze`, dan
`flutter test`. Pemeriksaan browser mencakup nilai computed (mis. navigasi aktif
`rgb(198, 31, 51)`) serta pemuatan data dari API; tangkapan layar hanya diklaim jika
benar-benar diambil.
