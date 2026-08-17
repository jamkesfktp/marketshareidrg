const fs = require('fs');
const readline = require('readline');
const path = require('path');
const XLSX = require('xlsx');

const csvPath = 'C:\\Backup Riki\\Drive D\\Analsisi Uji Coba\\spending_okt_jun_v3_gabungan.csv';
const excelCompetencyPath = 'C:\\Backup Riki\\Download\\RS Online - Monitoring Kompetensi dan olah tarikan 30 Juli 2026.xlsx';
const outputPath = path.join(__dirname, 'js', 'data.js');

console.log(`[1/3] Reading and streaming master CSV: ${csvPath}...`);
const startTime = Date.now();

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseLevel(val) {
  if (!val) return 0;
  const s = String(val).toUpperCase().trim();
  if (s.includes('DASAR') || s.startsWith('1')) return 1;
  if (s.includes('MADYA') || s.startsWith('2')) return 2;
  if (s.includes('UTAMA') || s.startsWith('3')) return 3;
  if (s.includes('PARIPURNA') || s.startsWith('4')) return 4;
  return 0;
}

// 9-element metric vector:
// [0: CASES, 1: INA, 2: 1370_FULL, 3: 1370_AFREG, 4: 1370_AF, 5: 1370_NOAF, 6: 1370_JUKNIS, 7: 1363_FULL, 8: TARIF_RS]
function createZeroVector() {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0];
}

function addVectors(target, source) {
  for (let i = 0; i < 9; i++) {
    target[i] += source[i];
  }
}

const hospitals = new Map();
const services = new Set();
let unclassifiedCases = 0;
let totalSourceRows = 0;

const rl = readline.createInterface({
  input: fs.createReadStream(csvPath, { encoding: 'utf-8' }),
  crlfDelay: Infinity
});

let isHeader = true;

rl.on('line', (line) => {
  if (isHeader) {
    isHeader = false;
    return;
  }
  if (!line || !line.trim()) return;

  totalSourceRows++;
  const row = parseCsvLine(line);
  if (row.length < 50) return;

  const hCode = String(row[0] || '').trim();
  if (!hCode || hCode === 'kode_rs') return;

  const hName = String(row[1] || '').trim();
  const prov = String(row[2] || '').trim().toUpperCase();
  const city = String(row[3] || '').trim();
  const hClass = String(row[8] || '').trim();
  const svc = String(row[14] || '').trim().toUpperCase();

  if (!svc) return;
  services.add(svc);

  if (!hospitals.has(hCode)) {
    hospitals.set(hCode, {
      code: hCode,
      name: hName,
      class: hClass,
      province: prov,
      city: city,
      total: createZeroVector(),
      severity: {},
      services: {},
      unclassified: createZeroVector()
    });
  }

  const h = hospitals.get(hCode);
  if (!h.services[svc]) {
    h.services[svc] = {
      competency: parseLevel(row[16]),
      total: createZeroVector(),
      severity: {}
    };
  }

  const s = h.services[svc];
  const sev = parseLevel(row[17]);

  // Extract 9 values
  const cases = parseFloat(row[28]) || 0;
  const ina = parseFloat(row[29]) || 0;
  const rsTarif = parseFloat(row[32]) || 0;
  const idrg1363_full = parseFloat(row[37]) || 0;
  const idrg1370_noaf = parseFloat(row[39]) || 0;
  const idrg1370_af = parseFloat(row[40]) || 0;
  const idrg1370_afreg = parseFloat(row[41]) || 0;
  const idrg1370_full = parseFloat(row[42]) || 0;
  const idrg1370_juknis = parseFloat(row[50]) || 0;

  const rowVector = [
    cases,
    ina,
    idrg1370_full,
    idrg1370_afreg,
    idrg1370_af,
    idrg1370_noaf,
    idrg1370_juknis,
    idrg1363_full,
    rsTarif
  ];

  addVectors(h.total, rowVector);
  addVectors(s.total, rowVector);

  if (sev > 0) {
    const sevKey = String(sev);
    if (!h.severity[sevKey]) h.severity[sevKey] = createZeroVector();
    addVectors(h.severity[sevKey], rowVector);

    if (!s.severity[sevKey]) s.severity[sevKey] = createZeroVector();
    addVectors(s.severity[sevKey], rowVector);
  } else {
    unclassifiedCases += cases;
    addVectors(h.unclassified, rowVector);

    if (!s.unclassified) s.unclassified = createZeroVector();
    addVectors(s.unclassified, rowVector);
  }

  if (totalSourceRows % 2000000 === 0) {
    console.log(`Processed ${totalSourceRows / 1000000}M rows (${((Date.now() - startTime) / 1000).toFixed(1)}s)...`);
  }
});

rl.on('close', () => {
  console.log(`[2/3] CSV parsing complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s. Total rows: ${totalSourceRows}. Total Hospitals: ${hospitals.size}`);

  const regional = {
    total: createZeroVector(),
    severity: {},
    unclassified: createZeroVector(),
    services: {}
  };

  for (const h of hospitals.values()) {
    addVectors(regional.total, h.total);
    addVectors(regional.unclassified, h.unclassified);

    for (const [sevKey, metrics] of Object.entries(h.severity)) {
      if (!regional.severity[sevKey]) regional.severity[sevKey] = createZeroVector();
      addVectors(regional.severity[sevKey], metrics);
    }

    for (const [svcName, s] of Object.entries(h.services)) {
      if (!regional.services[svcName]) {
        regional.services[svcName] = {
          competency: 0,
          total: createZeroVector(),
          severity: {}
        };
      }
      const rs = regional.services[svcName];
      addVectors(rs.total, s.total);

      if (s.unclassified) {
        if (!rs.unclassified) rs.unclassified = createZeroVector();
        addVectors(rs.unclassified, s.unclassified);
      }

      for (const [sevKey, metrics] of Object.entries(s.severity)) {
        if (!rs.severity[sevKey]) rs.severity[sevKey] = createZeroVector();
        addVectors(rs.severity[sevKey], metrics);
      }
    }
  }

  const sortedServices = Array.from(services).sort();

  // Load RS Online Competencies if available
  let competencySourceInfo = "Internal CSV";
  if (fs.existsSync(excelCompetencyPath)) {
    console.log(`[3/3] Merging official RS Online Competencies from: ${excelCompetencyPath}...`);
    try {
      const wb = XLSX.readFile(excelCompetencyPath);
      const wsTarik = wb.Sheets['Tarik'] || wb.Sheets[wb.SheetNames[0]];
      const rowsTarik = XLSX.utils.sheet_to_json(wsTarik);

      const serviceNameMap = {
        'JANTUNG DAN PEMBULUH DARAH': 'JANTUNG DAN PEMBULUH DARAH',
        'PARU DAN PERNAFASAN': 'PARU DAN PERNAFASAN',
        'URO NEFRO': 'URO NEFRO',
        'NEONATUS': 'NEONATUS',
        'NEOPLASMA': 'NEOPLASMA',
        'IBU DAN GINEKOLOGI': 'IBU DAN GINEKOLOGI',
        'MUSCULOSKELETAL DAN JARINGAN LUNAK': 'MUSCULOSKELETAL DAN JARINGAN LUNAK',
        'KULIT & PENYAKIT KELAMIN': 'KULIT & PENYAKIT KELAMIN',
        'INFEKSI DAN PARASIT': 'INFEKSI DAN PARASIT',
        'PENCERNAAN DAN HEPATOBILIER': 'PENCERNAAN DAN HEPATOBILIER',
        'HEMATOLOGI': 'HEMATOLOGI',
        'ALERGI IMUNOLOGI DAN RHEUMATOLOGI': 'ALERGI IMUNOLOGI DAN RHEUMATOLOGI',
        'REKONSTRUKSI DAN ESTETIKA': 'REKONSTRUKSI DAN ESTETIKA',
        'KERACUNAN': 'KERACUNAN',
        'ENDOKRIN, NUTRISI DAN METABOLIK': 'ENDOKRIN, NUTRISI DAN METABOLIK',
        'LUKA BAKAR': 'LUKA BAKAR',
        'TRAUMA': 'TRAUMA',
        'JIWA': 'JIWA',
        'FORENSIK': 'FORENSIK DAN MEDIKOLEGAL',
        'FORENSIK DAN MEDIKOLEGAL': 'FORENSIK DAN MEDIKOLEGAL',
        'REHABILITASI': 'REHABILITASI',
        'GIGI DAN MULUT': 'GIGI DAN MULUT',
        'SARAF/ NEUROSCIENCE': 'SARAF/ NEUROSCIENCE',
        'THT': 'THT',
        'MATA': 'MATA'
      };

      const hospCompetencies = new Map();
      rowsTarik.forEach((r) => {
        const code = String(r['kode_rs'] || r['KODE RS'] || '').trim();
        const rawSvc = String(r['jenis_kompetensi'] || '').trim().toUpperCase();
        const svc = serviceNameMap[rawSvc] || rawSvc;
        const strata = String(r['strata'] || '').trim();
        const lvl = parseLevel(strata);
        if (!hospCompetencies.has(code)) hospCompetencies.set(code, {});
        hospCompetencies.get(code)[svc] = lvl;
      });

      for (const h of hospitals.values()) {
        const compMap = hospCompetencies.get(h.code);
        if (!compMap) continue;

        for (const [svcName, lvl] of Object.entries(compMap)) {
          if (h.services[svcName]) {
            h.services[svcName].competency = lvl;
          } else {
            h.services[svcName] = {
              competency: lvl,
              total: createZeroVector(),
              severity: {}
            };
          }
        }
      }
      competencySourceInfo = path.basename(excelCompetencyPath);
    } catch (err) {
      console.warn("Could not merge Excel competencies:", err.message);
    }
  }

  const dataset = {
    meta: {
      sourceFile: "spending_okt_jun_v3_gabungan.csv",
      sourceRows: totalSourceRows,
      generatedAt: new Date().toISOString(),
      defaultTargetCode: hospitals.has("3372015") ? "3372015" : Array.from(hospitals.keys())[0],
      sourceServiceCount: sortedServices.length,
      referenceServiceCount: sortedServices.length,
      hospitalCount: hospitals.size,
      unclassifiedSeverityCases: unclassifiedCases,
      competencySource: competencySourceInfo,
      tariffScenarios: {
        "1370_full": { index: 2, label: "iDRG 1370 - AF + AFreg + AFkep (Default)", description: "Model 1.370 DRG dengan penyesuaian AF + AFreg + AFkep" },
        "1370_afreg": { index: 3, label: "iDRG 1370 - AF + AFreg", description: "Model 1.370 DRG dengan penyesuaian AF + AFreg" },
        "1370_af": { index: 4, label: "iDRG 1370 - AF Saja", description: "Model 1.370 DRG dengan penyesuaian AF saja" },
        "1370_noaf": { index: 5, label: "iDRG 1370 - Tanpa AF (Base)", description: "Tarif dasar iDRG 1.370 tanpa penyesuaian AF" },
        "1370_juknis": { index: 6, label: "iDRG 1370 - Juknis Top-Up", description: "Model 1.370 DRG skema Juknis Top-Up" },
        "1363_full": { index: 7, label: "iDRG 1363 - AF + AFreg + AFkep", description: "Model lama 1.363 DRG (AF + AFreg + AFkep)" },
        "tarif_rs": { index: 8, label: "Tarif RS Riil (Hospital Billing)", description: "Total tagihan/klaim tarif riil rumah sakit" }
      }
    },
    severityLabels: {
      "1": "Dasar",
      "2": "Madya",
      "3": "Utama",
      "4": "Paripurna"
    },
    services: sortedServices,
    regional: regional,
    hospitals: Array.from(hospitals.values())
  };

  console.log(`Writing output dataset to ${outputPath}...`);
  fs.writeFileSync(outputPath, `window.marketSimulatorData = ${JSON.stringify(dataset)};\n`, 'utf-8');
  const sizeMb = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Success! Dataset written (${sizeMb} MB) in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`);
});
