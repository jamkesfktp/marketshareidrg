import csv
import os
import sys

def main():
    input_csv = r'D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\spending_okt_jun_v3_gabungan.csv'
    output_csv = 'data/Tarikan_DRG_RS.csv'
    
    if not os.path.exists(input_csv):
        print(f"File {input_csv} tidak ditemukan.")
        print("Pastikan path file CSV sumber sudah benar.")
        return

    print(f"Membaca data dari {input_csv} ...")
    
    # We will aggregate by: PTD, MDC, DC, DRG, Deskripsi DRG, Kode RS, Deskripsi RS
    # Columns in raw data usually:
    # kode_rs, nama_rs, ptd, mdc, dc, kelompok_idrg (DRG), deskripsi_idrg (Deskripsi DRG)
    # jml_kasus, total_tarif_inacbg, idrg_total_tarif_1370_dengan_af_afreg_afkep (DRG)
    
    aggs = {}
    
    with open(input_csv, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        # safely find column indexes
        def find_col(*names):
            for n in names:
                for i, h in enumerate(header):
                    if n.lower() == h.lower().strip():
                        return i
            return -1
            
        kode_rs_idx = find_col('kode_rs')
        nama_rs_idx = find_col('nama_rs')
        ptd_idx = find_col('ptd', 'jenis_rawat')
        mdc_idx = find_col('mdc')
        dc_idx = find_col('dc')
        drg_idx = find_col('drg', 'kelompok_idrg')
        desc_drg_idx = find_col('deskripsi_drg', 'deskripsi_idrg')
        
        kasus_idx = find_col('jml_kasus', 'kasus')
        inacbg_idx = find_col('total_tarif_inacbg', 'inacbg')
        idrg_idx = find_col('idrg_total_tarif_1370_dengan_af_afreg_afkep', 'total_tarif_idrg')
        
        if -1 in [kode_rs_idx, drg_idx, kasus_idx, inacbg_idx, idrg_idx]:
            print("Beberapa kolom wajib tidak ditemukan di CSV.")
            return
            
        row_count = 0
        for row in reader:
            row_count += 1
            if row_count % 1000000 == 0:
                print(f"Diproses {row_count} baris...")
                
            try:
                kode = row[kode_rs_idx]
                nama = row[nama_rs_idx] if nama_rs_idx != -1 else ""
                ptd = row[ptd_idx] if ptd_idx != -1 else ""
                mdc = row[mdc_idx] if mdc_idx != -1 else ""
                dc = row[dc_idx] if dc_idx != -1 else ""
                drg = row[drg_idx]
                desc_drg = row[desc_drg_idx] if desc_drg_idx != -1 else ""
                
                kasus = float(row[kasus_idx]) if row[kasus_idx] else 0
                ina = float(row[inacbg_idx]) if row[inacbg_idx] else 0
                idrg = float(row[idrg_idx]) if row[idrg_idx] else 0
                
                key = (ptd, mdc, dc, drg, desc_drg, kode, nama)
                if key not in aggs:
                    aggs[key] = [0, 0, 0]
                aggs[key][0] += kasus
                aggs[key][1] += ina
                aggs[key][2] += idrg
                
            except Exception as e:
                pass
                
    print(f"Menyimpan ke {output_csv} ...")
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['PTD', 'MDC', 'DC', 'DRG', 'Deskripsi DRG', 'Kode RS', 'Deskripsi RS', 'Jumlah kasus', 'Total Tarif INACBG', 'Total Tarif DRG', 'Selisih', '% Selisih'])
        for k, v in aggs.items():
            kasus, ina, idrg = v
            selisih = idrg - ina
            pct = (selisih / ina) * 100 if ina > 0 else 0
            writer.writerow([k[0], k[1], k[2], k[3], k[4], k[5], k[6], kasus, ina, idrg, selisih, pct])
            
    print("Selesai.")

if __name__ == '__main__':
    main()
