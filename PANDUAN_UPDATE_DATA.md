# Memperbarui data spending

## Sumber data

- 2025 (Januari–Desember): `C:\Users\PUSBIKES-KEMKES\Downloads\TARIF\Data Spending\spending_jan_des_v11_gabungan.csv`
- Uji coba (15 Oktober 2025–15 Oktober 2026): `C:\Users\PUSBIKES-KEMKES\Downloads\TARIF\spending_okt_okt_grouper2026_kompetensi_v0_gabungan.csv`

## Rumus tarif

Setiap skenario dihitung dengan `CW Asli × Adj Factor × NBR`. Nilai dasar NBR yang disediakan:

| Skenario | Rawat Inap (RI) | Rawat Jalan (RJ) |
| --- | ---: | ---: |
| NBR A | Rp8.333.041 | Rp424.629 |
| NBR B | Rp8.037.060 | Rp461.474 |

Nilai RI dan RJ dapat diubah dari aplikasi. Perubahan tersimpan di browser tersebut dan langsung menghitung ulang kedua periode.

## Membangun data aplikasi

Jalankan dari direktori utama aplikasi:

```powershell
node build_formula_datasets.js
```

Proses membaca CSV secara bertahap, memeriksa jumlah kolom setiap baris, lalu menghasilkan `js/data.json.gz`. Aplikasi memuat dan membuka kompresi berkas ini saat halaman dibuka. Jangan masukkan CSV sumber atau berkas data mentah tak terkompresi ke Git.

Ringkasan hasil proses dicetak di konsol, termasuk jumlah kasus yang cocok dengan tabel CW, yang tidak cocok, baris dilewati, dan baris rusak. Jika ditemukan baris dengan jumlah kolom tidak sesuai, proses berhenti tanpa menerbitkan dataset baru.
