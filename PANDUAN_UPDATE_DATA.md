# 📖 Panduan Lengkap Pembaruan Data & Konfigurasi Simulator
## Simulator Market Share iDRG & INA-CBG Kemenkes RI

Dokumen ini berisi panduan resmi langkah demi langkah untuk memperbarui database aplikasi (*Market Share Simulator*), konfigurasi filter grup rumah sakit khusus (seperti RS Muhammadiyah / Aisyiyah), serta tata cara rebuild data transaksi klaim dan kompetensi RS Online.

---

## 📁 1. File Sumber Data yang Digunakan

Aplikasi mendukung **multi-periode/dataset** secara simultan melalui filter antarmuka:

| No | Nama Dataset / Periode | Lokasi / Nama File Default | Deskripsi Data |
|---|---|---|---|
| 1 | **Periode 8 Bulan (Uji Coba)** | `C:\Backup Riki\Drive D\Analsisi Uji Coba\spending_okt_jun_v3_gabungan.csv` *(±8,52 GB)* | Berisi 13.947.907 baris transaksi klaim riil (111,76 juta kasus, 3.235 RS, 24 layanan, 6 skenario tarif iDRG). |
| 2 | **Periode 1 Tahun Penuh (Jan - Des)** | `C:\Backup Riki\Drive D\Analsisi Uji Coba\spending_jan_des_v11_gabungan.csv` *(±3,60 GB)* | Berisi 6.540.369 baris transaksi klaim agregat 12 bulan penuh (3.190 RS, 24 layanan, 6 skenario tarif iDRG). |
| 3 | **Data Kompetensi RS Online** | `C:\Backup Riki\Download\RS Online - Monitoring Kompetensi dan olah tarikan 30 Juli 2026.xlsx` | Berisi data strata kompetensi RS (Dasar, Madya, Utama, Paripurna) untuk 24 layanan di sheet `Tarik`. |

---

## ⚡ 2. Langkah Pembaruan Data Sekali Eksekusi (*All-in-One*)

Aplikasi telah dilengkapi skrip kompilasi otomatis berkecepatan tinggi: **`build_dual_datasets.js`**.

Skrip ini secara otomatis:
1. Melakukan *streaming processing* pada kedua file CSV (total 12 GB+) secara efisien tanpa membuat memori RAM penuh.
2. Mengekstrak dan menyusun **6 varian skenario tarif iDRG**:
   - `iDRG 1370 - AF + AFreg + AFkep` *(Default / Standar Kemenkes)*
   - `iDRG 1370 - AF + AFreg`
   - `iDRG 1370 - AF Saja`
   - `iDRG 1370 - Tanpa AF (Base)`
   - `iDRG 1370 - Juknis Top-Up`
   - `iDRG 1363 - AF + AFreg + AFkep`
3. Menggabungkan (*merge*) data kompetensi RS Online untuk seluruh 24 layanan secara otomatis.
4. Menghasilkan bundel dataset siap pakai: **`js/data.js`**.

### 🚀 Cara Menjalankan Rebuild:
1. Buka Terminal / PowerShell / Command Prompt.
2. Masuk ke direktori proyek `rbk-market-share`:
   ```powershell
   cd "c:\Backup Riki\Dokumen\Market Share\rbk-market-share"
   ```
3. Jika lokasi file CSV atau Excel berubah, sesuaikan path pada baris teratas `build_dual_datasets.js`:
   ```javascript
   const csvOktJunPath = 'C:\\lokasi_baru\\spending_okt_jun_v3_gabungan.csv';
   const csvJanDesPath = 'C:\\lokasi_baru\\spending_jan_des_v11_gabungan.csv';
   const excelCompetencyPath = 'C:\\lokasi_baru\\RS Online - Monitoring Kompetensi.xlsx';
   ```
4. Jalankan perintah:
   ```powershell
   node build_dual_datasets.js
   ```
5. Tunggu hingga proses selesai (muncul pesan: `✅ All datasets compiled successfully!`).

---

## 🏥 3. Konfigurasi Khusus Grup RS Muhammadiyah & 'Aisyiyah (RSMA)

Aplikasi memiliki fitur pemetaan dan filter eksekutif khusus **131 RS Jejaring Resmi Muhammadiyah & 'Aisyiyah (RSMA)** yang bersumber langsung dari data resmi Persyarikatan (`Data RSMA.xlsx`).

Semua faskes RSMA resmi telah dipetakan presisi dengan data registrasi **Kemenkes RS Online** dan kode rumah sakit (7 digit):

```javascript
// Lokasi: rbk-market-share/js/app.js
const RSMA_MASTER_REGISTRY = [
  { no: 1, name: "RSU Muhammadiyah Sumatera Utara", email: "...", code: "1275885", ... },
  { no: 2, name: "RSU ‘Aisyiyah Padang", email: "...", code: "1371112", ... },
  ...
  { no: 131, name: "RS UMS AR Fachrudin", email: "...", code: "3372255", ... }
];

const MUHAMMADIYAH_HOSPITAL_CODES = new Set(RSMA_MASTER_REGISTRY.map(r => r.code).filter(Boolean));
```

Fasilitas dan fitur yang terintegrasi:
- **Slide 8 (Peta Sebaran & Profil Eksekutif RSMA)**: Visualisasi geografis interaktif 131 RSMA (123 RS terdata transaksi klaim di 17 provinsi), ringkasan portofolio INA vs iDRG, distribusi strata/kelas, dan filter fokus wilayah (Jateng, Jatim, DIY, Jabar, Luar Jawa).
- **Slide 9 (Analisis Rinci & Master Registry RSMA)**: Memuat 4 tab analitik lengkap:
  1. *Rincian Per RS* (123 RS terdata klaim beserta status kompetensi & simulasi delta).
  2. *Rincian 24 Kelompok Layanan* (agregasi kasus, potensi portofolio, dan distribusi level kompetensi).
  3. *Sebaran 17 Provinsi* (kinerja dan kontributor terbesar per wilayah regional).
  4. *Master Registry RSMA* (daftar utuh 131 faskes resmi beserta email kontak persyarikatan dan status klaim uji coba).
- **Global Filter & Shortcut**: Sidebar checkbox dan tombol shortcut **"RS Jejaring Muhammadiyah"** menyaring simulator secara instan ke jejaring RSMA.

---

## 🔄 4. Update Versi Cache Buster (Penting!)

Agar browser pengguna langsung membaca file data dan kode aplikasi baru tanpa tertahan cache browser lama:

1. Buka file `index.html` dan `index.php`.
2. Naikkan nomor versi pada tag `<script>` paling bawah:
   ```html
   <script src="js/data.js?v=2026081512"></script>
   <script src="js/app.js?v=2026081512"></script>
   ```

---

## 📤 5. Publikasi & Sinkronisasi ke GitHub

Setelah file `js/data.js` atau `js/app.js` terupdate dan diuji di browser lokal, simpan dan kirim perubahan ke repositori GitHub:

```powershell
cd "c:\Backup Riki\Dokumen\Market Share"
git add rbk-market-share/js/data.js rbk-market-share/index.html rbk-market-share/index.php rbk-market-share/js/app.js rbk-market-share/PANDUAN_UPDATE_DATA.md
git commit -m "chore: update data dan konfigurasi simulator"
git push origin main
```

---

## 🛠️ 6. Verifikasi Data Setelah Update

Untuk memastikan kedua dataset sudah terkompilasi dengan sempurna:

```powershell
node -e "const d = window.marketSimulatorDatasets || JSON.parse(require('fs').readFileSync('js/data.js', 'utf8').replace(/^window\.marketSimulatorDatasets\s*=\s*/, '').replace(/;\s*window\.marketSimulatorData.*$/, '')); console.log('Datasets loaded:', Object.keys(d)); console.log('Okt-Jun RS count:', d.okt_jun.hospitals.length); console.log('Jan-Des RS count:', d.jan_des.hospitals.length);"
```

