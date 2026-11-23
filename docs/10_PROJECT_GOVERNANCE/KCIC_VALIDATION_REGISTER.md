# KCIC Validation Register — RailwayVision AI

Tanggal: 2026-11-23
Aturan: tidak ada item di bawah yang boleh diubah menjadi "disetujui" tanpa bukti
persetujuan tertulis dari pihak KCIC yang berwenang. Repository ini tidak memuat
persetujuan, SOP, atau data KCIC.

Seluruh item berstatus **`PENDING_KCIC_VALIDATION`**.

| # | Item | Selama pending | Penanganan saat ini |
|---|---|---|---|
| 1 | SOP inspeksi | Alur dan urutan langkah belum final | Workflow 9 status bersifat teknis, bukan SOP resmi |
| 2 | Ruang lingkup aset | Cakupan jenis aset belum pasti | Register aset generik + lokasi |
| 3 | Master aset | Kode, kategori, hierarki resmi belum ada | Data contoh sintetis berlabel `DEMO` |
| 4 | Kategori kerusakan | Taksonomi temuan belum sah | Temuan memakai kategori bebas/terbatas |
| 5 | Severity | Skala keparahan belum disetujui | Severity tidak dipakai untuk keputusan keselamatan |
| 6 | Threshold teknis | Ambang pemeriksaan belum ada | Tidak ada threshold otomatis |
| 7 | Kamera dan protokol pengambilan gambar | Perangkat/prosedur belum ditetapkan | Unggah media generik (JPEG/PNG), checksum, karantina |
| 8 | Role dan permission | Struktur organisasi belum dikonfirmasi | 6 peran / 22 izin, dapat dikonfigurasi di basis data |
| 9 | Workflow | Urutan persetujuan belum resmi | Pemeriksa teknis → supervisor diterapkan di backend |
| 10 | Dataset | Data resmi belum tersedia | Registri dataset kosong; tidak ada data KCIC |
| 11 | Kebijakan data | Retensi, klasifikasi, akses belum ditetapkan | Data demo; media privat di MinIO lokal |
| 12 | SSO | Penyedia identitas belum ditetapkan | Autentikasi lokal Argon2id + JWT (sementara) |
| 13 | Infrastruktur | Target server/provider belum diputuskan | Docker Compose lokal, loopback `127.0.0.1` |
| 14 | Retensi | Durasi penyimpanan belum ditetapkan | Tidak ada kebijakan retensi otomatis |
| 15 | Backup dan recovery | RPO/RTO dan prosedur belum ada | Backup/DR belum diimplementasikan |
| 16 | Target AI | Kelas, metrik, dan ambang penerimaan belum ada | Pipeline demo kualitas gambar; bukan deteksi kerusakan |
| 17 | Pilot dan UAT | Skenario dan penerimaan belum disusun | UAT resmi **belum dilakukan** |

Catatan pelaporan: setiap laporan fase harus mencantumkan status
`PENDING_KCIC_VALIDATION` untuk item yang relevan dan tidak boleh mengklaim
persetujuan yang belum ada.
