"""Read RS Online Tarik sheet; export validated competency data (no workbook edits)."""
import collections
import hashlib
import json
import pathlib
import sys
import openpyxl

source = pathlib.Path(sys.argv[1])
as_of = sys.argv[2]
output = pathlib.Path(sys.argv[3])
workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
rows = iter(workbook['Tarik'].values)
header = next(rows)
columns = {name: header.index(name) for name in ['kode_rs', 'jenis_kompetensi', 'strata']}
levels = {'Tidak Kompeten': 0, 'Dasar': 1, 'Madya': 2, 'Utama': 3, 'Paripurna': 4}
hospitals = {}
service_counts = collections.Counter()
for number, row in enumerate(rows, 2):
    if not any(value is not None for value in row):
        continue
    raw_code = row[columns['kode_rs']]
    code = str(int(raw_code)) if isinstance(raw_code, (int, float)) and raw_code == int(raw_code) else str(raw_code).strip()
    if not code.isdigit() or len(code) != 7:
        raise ValueError(f'Invalid hospital code at row {number}: {code}')
    service = str(row[columns['jenis_kompetensi']]).strip().upper()
    if service == 'FORENSIK':
        service = 'FORENSIK DAN MEDIKOLEGAL'
    raw_level = row[columns['strata']]
    if raw_level not in levels:
        raise ValueError(f'Unknown/missing competency at row {number}: {raw_level}')
    entries = hospitals.setdefault(code, {})
    if service in entries:
        raise ValueError(f'Duplicate hospital/service at row {number}: {code}, {service}')
    entries[service] = levels[raw_level]
    service_counts[service] += 1
services = sorted(service_counts)
assert len(services) == 24, services
assert all(set(entries) == set(services) for entries in hospitals.values()), 'Incomplete hospital'
result = {'source': source.name, 'sheet': 'Tarik', 'asOf': as_of,
          'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'services': services, 'hospitals': hospitals}
output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps({'hospitals': len(hospitals), 'services': len(services), 'rows': sum(service_counts.values())}))
