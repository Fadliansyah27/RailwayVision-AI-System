# GITHUB_SECURITY_AUDIT — RailwayVision AI

Tanggal audit: 2026-11-23
Lingkup: seluruh working tree repository lokal sebelum publikasi GitHub.
Status akhir: `PUBLICATION_READY` (lihat bagian 9).

Dokumen ini tidak memuat nilai secret apa pun. Seluruh nilai sensitif yang ditemukan
dirujuk berdasarkan lokasi, bukan isi.

## 1. Kondisi Git sebelum audit

| Pemeriksaan | Hasil |
|---|---|
| Repository Git | Sudah diinisialisasi (`main`), belum memiliki commit pada awal audit |
| Remote | Tidak ada remote terkonfigurasi |
| Riwayat commit | Kosong pada awal audit — tidak ada secret historis; kini berisi satu commit persiapan tunggal |
| File ter-track | 0 file pada awal audit; 309 file pada commit persiapan |

Karena riwayat kosong pada awal audit, tidak ada kebutuhan rewrite history. Seluruh
pemeriksaan di bawah dilakukan pada working tree yang menjadi commit pertama; commit
tersebut belum dikirim ke remote mana pun.

## 2. Pemeriksaan file environment

| File | Status | Keterangan |
|---|---|---|
| `.env` | Ada di disk, **diabaikan** oleh `.gitignore` | Berisi nilai lokal hasil pengembangan |
| `.env.example` | Ada, akan dipublikasikan | Hanya placeholder; seluruh nilai kredensial diberi label `change-me` |
| `services/api/.env.example` | Ada, akan dipublikasikan | Placeholder lokal |
| `services/ai-worker/.env.example` | Ada, akan dipublikasikan | Placeholder lokal |

`.env` tidak masuk ke commit. Tidak ada `.env.local`, `.env.production`, atau
`.env.*.local` lain di working tree.

### 2.1 Riwayat Git lokal

Riwayat lokal awal (dua commit) pernah memuat kata sandi demo literal dan surel
pribadi pada metadata commit. Riwayat tersebut dibangun ulang menjadi satu commit
sebelum ada remote; commit lama tidak pernah dikirim, tidak reachable dari branch,
dan tidak ikut terkirim oleh `git push` biasa. Pemindaian manual pada riwayat
final tidak menemukan secret. `gitleaks` tidak tersedia pada verifikasi akhir
2026-11-23 (lihat bagian 4), sehingga tidak ada klaim hasil gitleaks.

## 3. Pola secret yang diperiksa

Pencarian dilakukan pada seluruh file yang akan dipublikasikan (bukan file yang
diabaikan seperti `.env`, `.venv`, `node_modules`, `.next`, `.dart_tool`).

| Pola | Hasil |
|---|---|
| Private key (`BEGIN … PRIVATE KEY`) | Tidak ditemukan |
| AWS access key (`AKIA…`) | Tidak ditemukan |
| GitHub token (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`) | Tidak ditemukan |
| OpenAI-style key (`sk-…`) | Tidak ditemukan |
| JWT literal (`eyJ…`) di luar token uji runtime | Tidak ditemukan |
| Connection string PostgreSQL/Redis dengan password literal | Tidak ditemukan |
| `JWT_SECRET`, `API_KEY`, `CLIENT_SECRET`, `PRIVATE_KEY` dengan nilai non-placeholder | Hanya placeholder `local-development-only-jwt-secret-change-me` |
| Sertifikat/keystore (`.pem`, `.key`, `.p12`, `.pfx`, `.jks`, `.keystore`) | Tidak ditemukan |
| `service-account*.json` | Tidak ditemukan |
| Firebase config / `google-services.json` | Tidak ditemukan |
| Kredensial Redis | Tidak ada password pada `REDIS_URL`/broker; hanya hostname layanan Docker lokal |
| Signed URL tersimpan (mis. `X-Amz-Signature`) | Tidak ditemukan; URL bertanda tangan dibuat saat runtime dan tidak di-log |
| Alamat server internal / konfigurasi jaringan | Hanya nama layanan Compose lokal dan loopback `127.0.0.1`; bukan infrastruktur nyata |
| Data pengguna | Hanya akun dan aset DEMO sintetis |
| Dokumen internal KCIC | Tidak ditemukan |
| Database dump (`.sql`, `.dump`, `.bak`) | Tidak ditemukan |
| Media inspeksi (`.mp4`, `.mov`, `.avi`) | Tidak ditemukan |
| Artefak model (`.pt`, `.pth`, `.onnx`, `.ckpt`) | Tidak ditemukan |
| Folder dataset privat / upload / storage privat | Tidak ditemukan |
| Log produksi (`*.log`, `logs/`) | Tidak ditemukan di working tree |

Catatan nilai placeholder:

- `JWT_SECRET=local-development-only-jwt-secret-change-me` di `.env.example`,
  `services/api/.env.example`, dan fallback `docker-compose.yml`. Nilai ini bukan
  secret produksi; aplikasi menolak start di lingkungan non-lokal tanpa secret
  yang memadai (lihat `app/core/config.py`).
- `DEMO_SEED_PASSWORD=change-me-local-demo-password` hanya placeholder; seed akun
  demo memerlukan nilai dari `.env` lokal. Tidak ada akun operasional.

### 3.1 Temuan dan remediasi

Pemeriksaan manual menemukan kata sandi demo literal yang sebelumnya tertanam di
`.env.example`, `services/api/.env.example`, dan teks halaman login web. Nilai itu
tidak pernah menjadi kredensial operasional (hanya untuk akun DEMO lokal), tetapi
tetap melanggar aturan "tanpa kredensial hardcoded". Ketiganya sudah diperbaiki:
contoh lingkungan memakai placeholder `change-me-local-demo-password`, dan halaman
login hanya menyebut nama variabel `DEMO_SEED_PASSWORD`. Pemindaian ulang setelah
perbaikan tidak menemukan kata sandi literal pada konten yang akan dipublikasikan.

## 4. Tooling secret scanning

| Tool | Status |
|---|---|
| Gitleaks | **Tidak tersedia pada mesin verifikasi ini** (`gitleaks: command not found`, 2026-11-23). Klaim pemindaian gitleaks pada versi dokumen sebelumnya dikoreksi. Jalankan gitleaks sebelum publikasi jika tool tersedia. |
| GitHub secret scanning | Belum dapat dijalankan (repository belum dipublikasikan) |
| Pemeriksaan manual | Regex pada working tree/index (bagian 3) + peninjauan berkas mencurigakan + `git diff --check` |

Karena gitleaks tidak dapat dijalankan, hasil pemindaian manual di bagian 3 adalah
satu-satunya dasar audit. Ini bukan bukti setara gitleaks; pemilik harus
memasang dan menjalankan gitleaks (atau mengaktifkan push protection GitHub)
sebelum mengandalkan repository sebagai publik.

## 5. File yang dikecualikan dari publikasi

`.gitignore` diperluas untuk mencakup:

- Environment: `.env`, `.env.*`, kecuali `.env.example`.
- Secret dan material privat: `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`,
  `*.keystore`, `secrets/`, `credentials/`, `service-account*.json`,
  `google-services.json`.
- Build/runtime: `.venv/`, `venv/`, `__pycache__/`, `node_modules/`, `.next/`,
  `dist/`, `coverage/`, `.dart_tool/`, `build/`, cache alat.
- Data: dump basis data, `datasets/raw/`, `datasets/private/`, `uploads/`,
  `storage/private/`, media video.
- Artefak ML: `checkpoints/`, `runs/`, `wandb/`, `mlruns/`, `*.pt`, `*.onnx`, dll.
- Log dan berkas sementara.

File migrasi Alembic (`.py`) dan konfigurasi nonrahasia tetap dipublikasikan.

## 6. Peninjauan dokumen dan gambar

- `docs/` berisi dokumentasi sintetis hasil pengembangan: laporan fase, arsitektur,
  test report, dan changelog. Tidak ada dokumen internal KCIC, SOP asli, data
  pelanggan, atau koordinat aset nyata.
- Seluruh data demonstrasi (akun, aset, lokasi, inspeksi) bersifat sintetis dan
  diberi label `DEMO`.
- `docs/screenshots/` berisi tangkapan UI prototipe. Isi yang terlihat hanya
  alamat `http://localhost:8000`, label DEMO, dan status sistem lokal — tidak ada
  kredensial, token, atau data operasional.
- Dokumen prompt pengembangan (`MASTER_PROMPT.md`, `AGENT.md`, `SECURITY_AGENT.md`)
  dan dokumen baseline berbahasa Inggris tidak mengandung secret. Pemilik
  repository dapat memilih untuk tidak mempublikasikannya; penghapusan tidak
  dilakukan tanpa persetujuan.

## 7. Risiko residu yang perlu diputuskan pemilik

1. **Lisensi** — status `PENDING_OWNER_APPROVAL`. Tidak ada lisensi permisif yang
   ditambahkan karena kepemilikan source code dan hak publikasi belum dinyatakan.
2. **Nama KCIC dalam dokumen** — dokumen menyatakan proyek *diajukan untuk*
   KCIC dan secara eksplisit menyangkal afiliasi resmi. Publikasi memerlukan
   kesadaran pemilik bahwa nama organisasi muncul dalam konteks proposal.
3. **Default lokal di `docker-compose.yml`** — stack compose dirancang untuk
   development lokal dengan port loopback. Jangan deploy apa adanya ke internet.
4. **Akun demo terdokumentasi** — kata sandi demo di `.env.example` hanya untuk
   seed lokal; jangan aktifkan `SEED_DEMO_DATA` di lingkungan yang dapat diakses
   publik.
5. **Identitas penulis commit** — metadata commit persiapan diubah hanya untuk
   commit tersebut menjadi identitas proyek sementara
   `RailwayVision AI <railwayvision-ai@users.noreply.github.com>`; konfigurasi
   Git pengguna tidak diubah dan surel pribadi tidak lagi tertanam di metadata.
   Jika pemilik ingin commit terhubung ke akun GitHub, ganti identitas sebelum
   push (lihat laporan akhir) — ini keputusan pemilik.

## 8. Verifikasi Git yang dijalankan

```text
git status --short
git ls-files
git diff --cached --check
git grep --cached -nIE '<pola secret>' --
git grep --cached -nIiE '<pola surel pribadi>' --
```

Hasil pada commit persiapan tunggal:

- `git diff --cached --check` bersih (exit 0) setelah normalisasi spasi di akhir
  baris pada dokumen lama; normalisasi ini tidak mengubah semantik kode.
- `.env` tidak ter-track; hanya tiga berkas `.env.example` yang masuk.
- Pemindaian pola secret dan surel pribadi pada index/HEAD: tidak ada kecocokan.
  `gitleaks` **tidak dijalankan** karena tidak tersedia pada PATH saat verifikasi
  akhir 2026-11-23; dokumen ini tidak mengklaim hasil gitleaks.
  Aktifkan GitHub Secret Scanning dan push protection setelah repository dibuat.
- Tidak ada berkas >1 MB dan tidak ada ekstensi sensitif (key, dump, media, model)
  yang ter-track.
- Verifikasi setelah perubahan terakhir: API 73 tes lulus dan ruff bersih; AI
  worker 8 tes lulus; web 38 tes lulus, TypeScript dan ESLint bersih (tes web
  dijalankan ulang setelah teks halaman login diubah).
- Riwayat disederhanakan menjadi satu commit dengan pesan
  `chore: prepare RailwayVision AI for public release`; belum ada remote.

## 9. Kesimpulan

Tidak ditemukan credential, data pribadi, media inspeksi, dataset privat, dump
basis data, atau artefak model di working tree yang dipublikasikan pada commit
persiapan. Riwayat Git kosong pada awal audit sehingga tidak ada kebocoran
historis.

Status konten repository: `PUBLICATION_READY` berdasarkan pemindaian manual.
Status publikasi: `BLOCKED_GITHUB_AUTH`.

Publikasi ke GitHub belum dapat diselesaikan pada sesi ini: `gh` tidak terpasang,
tidak ada remote terkonfigurasi, dan repository target
`Fadliansyah27/RailwayVision-AI` tidak ditemukan melalui `git ls-remote`.
Kredensial GitHub tersimpan di Windows Credential Manager untuk host
`github.com`, tetapi audit ini tidak memverifikasi scope token tersebut dan tidak
mencetak nilainya. Membuat repository baru memerlukan token dengan izin `repo`;
pemilik harus menyediakan `gh auth login` atau token tersebut. Lihat laporan
akhir untuk langkah lanjutan.
