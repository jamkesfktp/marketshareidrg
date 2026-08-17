const fs = require('fs');
const readline = require('readline');
const path = require('path');

const csvPath = 'C:\\Backup Riki\\Drive D\\Analsisi Uji Coba\\spending_okt_jun_v3_gabungan.csv';
const outputPath = path.join(__dirname, 'js', 'data.js');

console.log(`Processing national CSV dataset: ${csvPath}...`);
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
  if (row.length < 30) return;

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
      total: [0, 0, 0],
      severity: {},
      services: {},
      unclassified: [0, 0, 0]
    });
  }

  const h = hospitals.get(hCode);
  if (!h.services[svc]) {
    h.services[svc] = {
      competency: parseLevel(row[16]),
      total: [0, 0, 0],
      severity: {}
    };
  }

  const s = h.services[svc];
  const sev = parseLevel(row[17]);

  const cases = parseFloat(row[28]) || 0;
  const ina = parseFloat(row[29]) || 0;
  const idrg = parseFloat(row[42]) || 0;

  h.total[0] += cases;
  h.total[1] += ina;
  h.total[2] += idrg;

  s.total[0] += cases;
  s.total[1] += ina;
  s.total[2] += idrg;

  if (sev > 0) {
    const sevKey = String(sev);
    if (!h.severity[sevKey]) h.severity[sevKey] = [0, 0, 0];
    h.severity[sevKey][0] += cases;
    h.severity[sevKey][1] += ina;
    h.severity[sevKey][2] += idrg;

    if (!s.severity[sevKey]) s.severity[sevKey] = [0, 0, 0];
    s.severity[sevKey][0] += cases;
    s.severity[sevKey][1] += ina;
    s.severity[sevKey][2] += idrg;
  } else {
    unclassifiedCases += cases;
    h.unclassified[0] += cases;
    h.unclassified[1] += ina;
    h.unclassified[2] += idrg;

    if (!s.unclassified) s.unclassified = [0, 0, 0];
    s.unclassified[0] += cases;
    s.unclassified[1] += ina;
    s.unclassified[2] += idrg;
  }
});

rl.on('close', () => {
  console.log(`Processed ${totalSourceRows} rows. Total Hospitals: ${hospitals.size}, Total Services: ${services.size}`);

  const regional = {
    total: [0, 0, 0],
    severity: {},
    unclassified: [0, 0, 0],
    services: {}
  };

  for (const h of hospitals.values()) {
    regional.total[0] += h.total[0];
    regional.total[1] += h.total[1];
    regional.total[2] += h.total[2];

    regional.unclassified[0] += h.unclassified[0];
    regional.unclassified[1] += h.unclassified[1];
    regional.unclassified[2] += h.unclassified[2];

    for (const [sevKey, metrics] of Object.entries(h.severity)) {
      if (!regional.severity[sevKey]) regional.severity[sevKey] = [0, 0, 0];
      regional.severity[sevKey][0] += metrics[0];
      regional.severity[sevKey][1] += metrics[1];
      regional.severity[sevKey][2] += metrics[2];
    }

    for (const [svcName, s] of Object.entries(h.services)) {
      if (!regional.services[svcName]) {
        regional.services[svcName] = {
          competency: 0,
          total: [0, 0, 0],
          severity: {}
        };
      }
      const rs = regional.services[svcName];
      rs.total[0] += s.total[0];
      rs.total[1] += s.total[1];
      rs.total[2] += s.total[2];

      if (s.unclassified) {
        if (!rs.unclassified) rs.unclassified = [0, 0, 0];
        rs.unclassified[0] += s.unclassified[0];
        rs.unclassified[1] += s.unclassified[1];
        rs.unclassified[2] += s.unclassified[2];
      }

      for (const [sevKey, metrics] of Object.entries(s.severity)) {
        if (!rs.severity[sevKey]) rs.severity[sevKey] = [0, 0, 0];
        rs.severity[sevKey][0] += metrics[0];
        rs.severity[sevKey][1] += metrics[1];
        rs.severity[sevKey][2] += metrics[2];
      }
    }
  }

  const sortedServices = Array.from(services).sort();

  const dataset = {
    meta: {
      sourceFile: "spending_okt_jun_v3_gabungan.csv",
      sourceRows: totalSourceRows,
      generatedAt: new Date().toISOString(),
      defaultTargetCode: hospitals.has("3372015") ? "3372015" : Array.from(hospitals.keys())[0],
      sourceServiceCount: sortedServices.length,
      referenceServiceCount: 24,
      missingServices: [],
      hospitalCount: hospitals.size,
      unclassifiedSeverityCases: unclassifiedCases
    },
    severityLabels: { "1": "Dasar", "2": "Madya", "3": "Utama", "4": "Paripurna" },
    services: sortedServices,
    regional: regional,
    hospitals: Array.from(hospitals.values())
  };

  console.log(`Writing dataset to ${outputPath}...`);
  fs.writeFileSync(outputPath, "window.marketSimulatorData = " + JSON.stringify(dataset) + ";", "utf-8");

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Successfully generated data.js in ${duration}s! Total Hospitals: ${hospitals.size}`);
});
