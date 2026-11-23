# Kebijakan Keamanan — RailwayVision AI

RailwayVision AI adalah prototipe pendukung keputusan inspeksi. Repository ini
tidak memuat data operasional KCIC, kredensial produksi, maupun model AI yang
disetujui untuk penggunaan operasional.

## Melaporkan kerentanan

**Jangan** membuka issue publik yang memuat detail eksploitasi, data sensitif,
atau langkah reproduksi yang dapat disalahgunakan.

Gunakan salah satu jalur berikut:

1. **GitHub Private Vulnerability Reporting** (disarankan): buka tab
   *Security* pada repository, lalu pilih *Report a vulnerability*. Laporan
   hanya terlihat oleh pemelihara.
2. Bila fitur tersebut belum aktif, hubungi pemelihara repository secara
   privat melalui kanal yang tercantum pada profil pemilik repository.

Sertakan, bila memungkinkan:

- Deskripsi singkat dampak dan komponen terdampak.
- Versi/commit yang diuji.
- Langkah reproduksi minimal (tanpa data nyata).
- Saran mitigasi bila Anda memilikinya.

Kami akan mengonfirmasi penerimaan laporan, menilai dampak, dan menyampaikan
rencana perbaikan. Mohon beri waktu perbaikan sebelum publikasi apa pun.

## Cakupan

Berlaku untuk kode pada repository ini: `apps/web`, `apps/mobile`,
`services/api`, `services/ai-worker`, konfigurasi Docker, dan CI.

Hal yang **di luar** cakupan: infrastruktur KCIC, jaringan internal KCIC, dan
sistem operasi kritis perkeretaapian. Pengujian terhadap sistem tersebut tanpa
otorisasi tertulis dilarang.

## Praktik yang diharapkan dari kontributor

- Jangan pernah commit `.env`, token, kata sandi, kunci privat, atau
  connection string berisi kredensial.
- Jangan menambahkan data inspeksi nyata, media KCIC, dataset privat, atau
  dokumen internal.
- Jangan melemahkan validasi backend, RBAC, cakupan, checksum media, atau
  audit trail.
- Jangan menambahkan fungsi kendali kereta, persinyalan, interlocking,
  dispatch, atau keputusan keselamatan otomatis.
- Laporkan temuan keamanan secara privat sesuai bagian di atas.

## Batas keselamatan

- Keluaran AI bersifat saran dan memerlukan verifikasi manusia berwenang.
- Sistem tidak menyatakan infrastruktur aman atau tidak aman.
- Status lisensi saat ini `PENDING_OWNER_APPROVAL`.

Lihat juga `docs/SECURITY_AUDIT_REPORT.md` dan
`docs/10_PROJECT_GOVERNANCE/GITHUB_SECURITY_AUDIT.md`.
