import pandas as pd
import json
import datetime
import math

files = [
    r'C:\Users\User\Downloads\Laporan_Agregat_iDRG_Simulasi_2 (1).xlsx',
    r'C:\Users\User\Downloads\Laporan_Agregat_iDRG_Simulasi_2 (2)DIY.xlsx'
]
dfs = []
for f in files:
    dfs.append(pd.read_excel(f, sheet_name=0))
df = pd.concat(dfs, ignore_index=True)
df = df.fillna('')

def parse_level(val):
    val = str(val).strip().upper()
    if val.startswith('1'): return 1
    if val.startswith('2'): return 2
    if val.startswith('3'): return 3
    if val.startswith('4'): return 4
    return 0

hospitals = {}
services = set()
unclassified_cases = 0

regional_suitable = [0, 0, 0]
regional_unsuitable = [0, 0, 0]

for idx, row in df.iterrows():
    h_code = str(row['Kode RS']).strip()
    if not h_code: continue
    if h_code not in hospitals:
        hospitals[h_code] = {
            "code": h_code,
            "name": str(row['Nama RS']).strip(),
            "class": str(row['Kelas RS']).strip(),
            "province": str(row['Provinsi']).strip(),
            "city": str(row['Kabupaten/Kota']).strip(),
            "total": [0, 0, 0],
            "severity": {},
            "services": {},
            "unclassified": [0, 0, 0]
        }
    
    h = hospitals[h_code]
    svc = str(row['Layanan']).strip()
    if not svc: continue
    services.add(svc)
    
    if svc not in h['services']:
        h['services'][svc] = {
            "competency": parse_level(row['Kompetensi RS']),
            "total": [0, 0, 0],
            "severity": {}
        }
    
    s = h['services'][svc]
    sev = parse_level(row['Tingkat Keparahan Kasus (Klaim)'])
    
    try:
        cases = float(row['Total Kasus']) if str(row['Total Kasus']) else 0.0
    except:
        cases = 0.0
    try:
        ina = float(row['Total INA-CBG (Rp)']) if str(row['Total INA-CBG (Rp)']) else 0.0
    except:
        ina = 0.0
    try:
        idrg = float(row['iDRG Skenario 2 (Rp)']) if str(row['iDRG Skenario 2 (Rp)']) else 0.0
    except:
        idrg = 0.0
        
    metrics = [cases, ina, idrg]
    
    h['total'][0] += cases
    h['total'][1] += ina
    h['total'][2] += idrg
    
    s['total'][0] += cases
    s['total'][1] += ina
    s['total'][2] += idrg
    
    if sev > 0:
        sev_str = str(sev)
        if sev_str not in h['severity']: h['severity'][sev_str] = [0, 0, 0]
        h['severity'][sev_str][0] += cases
        h['severity'][sev_str][1] += ina
        h['severity'][sev_str][2] += idrg
        
        if sev_str not in s['severity']: s['severity'][sev_str] = [0, 0, 0]
        s['severity'][sev_str][0] += cases
        s['severity'][sev_str][1] += ina
        s['severity'][sev_str][2] += idrg
    else:
        unclassified_cases += cases
        h['unclassified'][0] += cases
        h['unclassified'][1] += ina
        h['unclassified'][2] += idrg
        if 'unclassified' not in s: s['unclassified'] = [0, 0, 0]
        s['unclassified'][0] += cases
        s['unclassified'][1] += ina
        s['unclassified'][2] += idrg

    kesesuaian = str(row['Kesesuaian Kompetensi']).strip().upper()
    if kesesuaian == 'SESUAI':
        regional_suitable[0] += cases
        regional_suitable[1] += ina
        regional_suitable[2] += idrg
    elif kesesuaian == 'TIDAK SESUAI':
        regional_unsuitable[0] += cases
        regional_unsuitable[1] += ina
        regional_unsuitable[2] += idrg

regional = {
    "total": [0, 0, 0],
    "severity": {},
    "unclassified": [0, 0, 0],
    "services": {},
    "suitable": regional_suitable,
    "unsuitable": regional_unsuitable
}

for h in hospitals.values():
    regional['total'][0] += h['total'][0]
    regional['total'][1] += h['total'][1]
    regional['total'][2] += h['total'][2]
    
    regional['unclassified'][0] += h.get('unclassified', [0,0,0])[0]
    regional['unclassified'][1] += h.get('unclassified', [0,0,0])[1]
    regional['unclassified'][2] += h.get('unclassified', [0,0,0])[2]
    
    for sev_str, metrics in h['severity'].items():
        if sev_str not in regional['severity']: regional['severity'][sev_str] = [0, 0, 0]
        regional['severity'][sev_str][0] += metrics[0]
        regional['severity'][sev_str][1] += metrics[1]
        regional['severity'][sev_str][2] += metrics[2]
        
    for svc, s in h['services'].items():
        if svc not in regional['services']:
            regional['services'][svc] = {
                "competency": 0,
                "total": [0, 0, 0],
                "severity": {}
            }
        rs = regional['services'][svc]
        rs['total'][0] += s['total'][0]
        rs['total'][1] += s['total'][1]
        rs['total'][2] += s['total'][2]
        
        if 'unclassified' in s:
            if 'unclassified' not in rs: rs['unclassified'] = [0, 0, 0]
            rs['unclassified'][0] += s['unclassified'][0]
            rs['unclassified'][1] += s['unclassified'][1]
            rs['unclassified'][2] += s['unclassified'][2]
            
        for sev_str, metrics in s['severity'].items():
            if sev_str not in rs['severity']: rs['severity'][sev_str] = [0, 0, 0]
            rs['severity'][sev_str][0] += metrics[0]
            rs['severity'][sev_str][1] += metrics[1]
            rs['severity'][sev_str][2] += metrics[2]

data = {
    "meta": {
        "sourceFile": "Laporan_Agregat_iDRG_Simulasi_2 (1).xlsx",
        "sourceSheet": "Data Agregat",
        "sourceRows": len(df),
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "defaultTargetCode": "3372015",
        "sourceServiceCount": len(services),
        "referenceServiceCount": 24,
        "missingServices": [],
        "hospitalCount": len(hospitals),
        "competencyConflictCount": 0,
        "unclassifiedSeverityCases": unclassified_cases
    },
    "severityLabels": { "1": "Dasar", "2": "Madya", "3": "Utama", "4": "Paripurna" },
    "services": sorted(list(services)),
    "regional": regional,
    "hospitals": list(hospitals.values())
}

with open("js/data.js", "w", encoding="utf-8") as f:
    f.write("window.marketSimulatorData = " + json.dumps(data) + ";")
