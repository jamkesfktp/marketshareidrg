# Panduan Update Data Simulator Market Share iDRG

Dokumen ini berisi panduan langkah demi langkah untuk melakukan pembaruan data pada aplikasi Simulator Market Share iDRG jika di masa depan terdapat data terbaru.

Proses pembaruan data menggunakan skrip Python yang sudah disediakan untuk memproses file raw (Excel/CSV) menjadi file `js/data.js` yang digunakan oleh aplikasi.

---

## 1. Persiapan File Sumber Data

Pastikan Anda memiliki file-file sumber data berikut di komputer Anda:
1. **File Excel Laporan Agregat** (contoh: `Laporan_Agregat_iDRG_Simulasi_2 (1).xlsx`)
2. **File CSV Data Gabungan Klaim** (contoh: `spending_okt_jun_v3_gabungan.csv`)
3. **File Excel RS Online (Opsional)** untuk update tingkat kompetensi RS (contoh: `RS Online - Monitoring Kompetensi dan olah tarikan.xlsx`)

## 2. Langkah Pembaruan Data Utama (Kasus & Pendapatan)

Skrip utama untuk membentuk data aplikasi adalah `generate_data.py`.

**Langkah-langkah:**
1. Buka file `generate_data.py` menggunakan teks editor (Notepad, VSCode, dsb).
2. Periksa dan sesuaikan *path* (lokasi file) pada baris berikut agar sesuai dengan lokasi file terbaru Anda:
   ```python
   excel_files = [
       r'C:\lokasi\file\Laporan_Agregat_iDRG_Simulasi_2 (1).xlsx',
       r'C:\lokasi\file\Laporan_Agregat_iDRG_Simulasi_2 (2)DIY.xlsx'
   ]
   
   csv_file = r'D:\lokasi\file\spending_okt_jun_v3_gabungan.csv'
   ```
3. Buka Terminal/Command Prompt, lalu jalankan perintah:
   ```bash
   python generate_data.py
   ```
4. Skrip akan memproses jutaan baris data dan menghasilkan/menimpa file `js/data.js`. Tunggu hingga selesai (bisa memakan waktu beberapa menit).

## 3. Langkah Pembaruan Data Kompetensi RS (Opsional)

Jika ada pembaruan tingkat kompetensi rumah sakit dari RS Online, Anda dapat menggunakan skrip `scratch/update_competency.py`. Skrip ini akan menyuntikkan (update) tingkat kompetensi ke dalam file `js/data.js` yang sudah di-generate sebelumnya.

**Langkah-langkah:**
1. Buka file `scratch/update_competency.py`.
2. Sesuaikan path file Excel RS Online pada baris berikut:
   ```python
   file_path = r'C:\lokasi\file\RS Online - Monitoring Kompetensi.xlsx'
   ```
3. Jalankan melalui Terminal/Command Prompt:
   ```bash
   python scratch/update_competency.py
   ```

## 4. Penanganan Khusus Layanan Forensik

Berdasarkan data saat ini, layanan **Kedokteran Forensik** tidak memiliki riwayat kasus (0 kasus) di sumber data, sehingga skrip utama tidak akan membentuk layanan tersebut. 

Jika setelah update data baru layanan Forensik masih belum muncul dan Anda ingin menampilkannya secara paksa (dengan nilai 0), gunakan skrip injeksi:

**Langkah-langkah:**
Jalankan perintah berikut di Terminal:
```bash
python scratch/inject_forensik.py
```
Skrip ini akan otomatis menambahkan layanan "KEDOKTERAN FORENSIK" ke dalam `js/data.js` untuk rumah sakit yang disimulasikan.

## 5. Publikasi Perubahan

Setelah semua proses di atas selesai:
1. Pastikan aplikasi berjalan dengan baik di lokal dengan membuka `index.html`.
2. Commit dan push file `js/data.js` yang baru ke GitHub agar perubahan data dapat diakses secara online.
   ```bash
   git add js/data.js
   git commit -m "chore: update data iDRG terbaru"
   git push
   ```
