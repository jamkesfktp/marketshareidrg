const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');

const INPUTS = {
  jan_des: process.env.JAN_DES_CSV || 'C:\\Users\\PUSBIKES-KEMKES\\Downloads\\TARIF\\Data Spending\\spending_jan_des_v11_gabungan.csv',
  okt_oct: process.env.OKT_OKT_CSV || 'C:\\Users\\PUSBIKES-KEMKES\\Downloads\\TARIF\\spending_okt_okt_grouper2026_kompetensi_v0_gabungan.csv'
};
const OUTPUT = process.env.DATASET_OUTPUT || path.join(__dirname, 'js', 'data.json.gz');
const NBR = { A: { RI: 8333041, RJ: 424629 }, B: { RI: 8037060, RJ: 461474 } };
const VECTOR_LENGTH = 15;
const ZERO = () => Array(VECTOR_LENGTH).fill(0);
const add = (a, b) => { for (let i = 0; i < VECTOR_LENGTH; i++) a[i] = (a[i] || 0) + (b[i] || 0); };
const text = value => String(value ?? '').trim();
const number = value => { const n = Number(text(value).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const parseIndonesian = value => {
  const s = text(value).replace(/\s/g, '');
  if (!s || s === '-') return 0;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\./g, ''));
  return Number.isFinite(n) ? n : 0;
};
const parseLevel = value => {
  const s = text(value).toLowerCase();
  if (/^(4|paripurna)/.test(s)) return 4;
  if (/^(3|utama)/.test(s)) return 3;
  if (/^(2|madya)/.test(s)) return 2;
  if (/^(1|dasar)/.test(s)) return 1;
  return 0;
};
function parseCsvLine(line) {
  const fields = [];
  let value = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { fields.push(value); value = ''; }
    else value += ch;
  }
  fields.push(value);
  return fields;
}
function hasUnclosedCsvQuote(line) {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '"') continue;
    if (quoted && line[i + 1] === '"') { i++; continue; }
    quoted = !quoted;
  }
  return quoted;
}
const SERVICE_ALIASES = {
  'JANTUNG & PEMBULUH DARAH': 'JANTUNG DAN PEMBULUH DARAH',
  'LUKA BAKAR/BURN': 'LUKA BAKAR',
  'PARU & PERNAPASAN': 'PARU DAN PERNAFASAN',
  'PENCERNAAN DAN HEPATOBILIAR': 'PENCERNAAN DAN HEPATOBILIER',
  'REHABILITASI MEDIS': 'REHABILITASI',
  'SYARAF - NEUROSCIENCE': 'SARAF/ NEUROSCIENCE',
  'TRAUMA DAN MULTIPLE TRAUMA': 'TRAUMA',
  'URONEFRO/GINJAL': 'URO NEFRO'
};
function normalizedService(value) {
  const name = text(value).toUpperCase().replace(/\s+/g, ' ');
  return SERVICE_ALIASES[name] || name;
}
function ensure(object, key, create) { return object[key] || (object[key] = create()); }
function createEntity(code, name, hclass, province, city, ownership) {
  return { code, name, class: hclass, province, city, ownership, total: ZERO(), severity: {}, services: {}, unclassified: ZERO() };
}
function ensureService(hospital, service, competency) {
  return ensure(hospital.services, service, () => ({ competency, total: ZERO(), severity: {}, unclassified: ZERO() }));
}
function getIndices(headers) { return Object.fromEntries(headers.map((name, i) => [name.toLowerCase().trim(), i])); }
function sumBasis(vector, cases, tariff, ptd) {
  if (!tariff) return false;
  const basis = cases * tariff.cwAdj;
  vector[ptd === '1' ? 13 : 14] += basis;
  return true;
}
function makeDataset(period, hospitals, services, rowCount, sourceFile, matchedCases, totalCases, malformedRows) {
  const regional = { total: ZERO(), severity: {}, unclassified: ZERO(), services: {} };
  const serviceSet = new Set(services);
  let unmatchedCases = 0;
  for (const h of hospitals.values()) {
    add(regional.total, h.total);
    add(regional.unclassified, h.unclassified);
    for (const [level, m] of Object.entries(h.severity)) add(ensure(regional.severity, level, ZERO), m);
    for (const [svc, s] of Object.entries(h.services)) {
      serviceSet.add(svc);
      const rs = ensure(regional.services, svc, () => ({ competency: 0, total: ZERO(), severity: {}, unclassified: ZERO() }));
      add(rs.total, s.total);
      add(rs.unclassified, s.unclassified || ZERO());
      for (const [level, m] of Object.entries(s.severity)) add(ensure(rs.severity, level, ZERO), m);
    }
  }
  return {
    meta: {
      sourceFile, periodName: period === 'jan_des' ? 'Januari–Desember 2025' : '15 Oktober 2025–15 Oktober 2026',
      periodCode: period, sourceRows: rowCount, generatedAt: new Date().toISOString(),
      defaultTargetCode: hospitals.has('3372015') ? '3372015' : hospitals.keys().next().value,
      hospitalCount: hospitals.size, sourceServiceCount: serviceSet.size,
      unmatchedTariffCases: Math.max(0, totalCases - matchedCases), matchedTariffCases: matchedCases,
      totalCases, malformedRows, tariffFormula: 'CW Asli × Adj Factor × NBR', nbrScenarioDefaults: NBR,
      competencySource: sourceFile,
      tariffScenarios: {
        cw_nbr_adj_a: { index: 9, label: 'Skenario A · CW × NBR A × Adj Factor' },
        cw_nbr_adj_b: { index: 10, label: 'Skenario B · CW × NBR B × Adj Factor' }
      }
    },
    severityLabels: { 1: 'Dasar', 2: 'Madya', 3: 'Utama', 4: 'Paripurna' },
    services: [...serviceSet].sort(), regional, hospitals: [...hospitals.values()]
  };
}
function initialRates(dataset) {
  const visit = entity => {
    if (!entity || typeof entity !== 'object') return;
    for (const key of ['total', 'unclassified']) {
      const m = entity[key];
      if (Array.isArray(m) && m.length >= VECTOR_LENGTH) {
        m[9] = m[13] * NBR.A.RI + m[14] * NBR.A.RJ;
        m[10] = m[13] * NBR.B.RI + m[14] * NBR.B.RJ;
      }
    }
    if (entity.severity) for (const m of Object.values(entity.severity)) if (Array.isArray(m) && m.length >= VECTOR_LENGTH) {
      m[9] = m[13] * NBR.A.RI + m[14] * NBR.A.RJ;
      m[10] = m[13] * NBR.B.RI + m[14] * NBR.B.RJ;
    }
    if (entity.services) for (const s of Object.values(entity.services)) visit(s);
  };
  visit(dataset.regional);
  for (const h of dataset.hospitals) visit(h);
}
function loadTariffMap() {
  const lines = fs.readFileSync(path.join(__dirname, 'data', 'spending-tariffs.tsv'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  const map = new Map();
  for (const line of lines.slice(1)) {
    const r = line.split('\t');
    if (r.length < 11) continue;
    const ptd = text(r[0]), drg = text(r[3]);
    if (!ptd || !drg) continue;
    map.set(`${ptd}:${drg}`, { cwAdj: parseIndonesian(r[7]) * parseIndonesian(r[9]) });
  }
  return map;
}
async function processCsv(period, file, tariffMap, idrgService) {
  if (!fs.existsSync(file)) throw new Error(`Input tidak ditemukan: ${file}`);
  const hospitals = new Map(), services = new Set(), scatterServices = new Map(), idrgTariffs = new Map();
  let header = null, indices = null, rows = 0, malformedRows = 0, totalCases = 0, matchedCases = 0, skipNoCode = 0;
  const stream = fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 1024 * 1024 });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let pendingRecord = '';
  for await (const line of rl) {
    if (!header) { header = parseCsvLine(line).map(v => v.replace(/^\uFEFF/, '').trim()); indices = getIndices(header); continue; }
    const record = pendingRecord ? `${pendingRecord}\n${line}` : line;
    if (hasUnclosedCsvQuote(record)) { pendingRecord = record; continue; }
    pendingRecord = '';
    if (!record.trim()) continue;
    rows++;
    const r = parseCsvLine(record);
    if (r.length !== header.length) { malformedRows++; continue; }
    const get = name => r[indices[name] ?? -1] ?? '';
    const code = text(get('kode_rs'));
    const drg = period === 'jan_des' ? text(get('idrg_code_1370')) : text(get('drg_final'));
    const ptd = text(get('ptd'));
    const cases = number(get('jml_kasus'));
    if (!code || !cases) { skipNoCode++; continue; }
    const svc = normalizedService(idrgService.get(drg) || get('kelompok_idrg') || get('kelompok_idrg'));
    if (!svc) { skipNoCode++; continue; }
    const tariff = tariffMap.get(`${ptd}:${drg}`);
    const vec = ZERO();
    vec[0] = cases;
    vec[1] = number(get('total_tarif_inacbg'));
    if (period === 'jan_des') {
      // Keep the existing 2025 iDRG series available for exports that still use them.
      vec[2] = number(get('idrg_total_tarif_1370_dengan_af_afreg_afkep'));
      vec[3] = number(get('idrg_total_tarif_1370_dengan_af_afreg'));
      vec[4] = number(get('idrg_total_tarif_1370_dengan_af'));
      vec[5] = number(get('idrg_total_tarif_1370_tanpa_af'));
      vec[6] = number(get('idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup'));
      vec[7] = number(get('idrg_total_tarif_1363_dengan_af_afreg_afkep'));
      vec[8] = number(get('idrg_total_tarif_1363_dengan_af'));
    }
    if (sumBasis(vec, cases, tariff, ptd)) matchedCases += cases;
    totalCases += cases;
    services.add(svc);
    const ownershipRaw = text(get('pemilik_rs') || get('PEMILIK') || get('pemilik_faskes')).toUpperCase();
    const ownership = ['P', 'PEMERINTAH'].includes(ownershipRaw) ? 'PEMERINTAH' : ['S', 'SWASTA'].includes(ownershipRaw) ? 'SWASTA' : ownershipRaw;
    const hospitalClass = text(get('kelas_rs') || get('kelas_faskes')).toUpperCase();
    const rawatClass = text(get('kelas_rawat_merg') || get('kelas_rawat')).toUpperCase();
    const region = text(get('regional_2023') || get('reg_rs')).toUpperCase();
    const description = text(get('desc_idrg') || get('desc_code') || get('deskripsi_inacbg') || get('desc_inacbg'));
    if (drg) {
      if (!idrgTariffs.has(drg)) idrgTariffs.set(drg, { description, ptd });
      let byService = scatterServices.get(svc);
      if (!byService) { byService = new Map(); scatterServices.set(svc, byService); }
      const scatterKey = [drg, ownership, hospitalClass, rawatClass, region].join('\u001f');
      let segment = byService.get(scatterKey);
      if (!segment) {
        segment = [drg, description, ownership, hospitalClass, rawatClass, region, 0, 0, 0, 0, 0, 0];
        byService.set(scatterKey, segment);
      }
      segment[6] += cases;
      segment[7] += number(get('total_tarif_inacbg'));
      if (tariff) {
        const basis = cases * tariff.cwAdj;
        segment[11] += basis;
        segment[9] += basis * (ptd === '1' ? NBR.A.RI : NBR.A.RJ);
        segment[10] += basis * (ptd === '1' ? NBR.B.RI : NBR.B.RJ);
      }
    }
    let h = hospitals.get(code);
    if (!h) {
      h = createEntity(code, text(get('nama_rs')), text(get('kelas_faskes') || get('kelas_rs')), text(get('propinsi')), text(get('kabupaten')), text(get('PEMILIK') || get('pemilik_rs') || get('pemilik_faskes')));
      hospitals.set(code, h);
    }
    const competency = parseLevel(get('faskes_kompetensi'));
    const severity = parseLevel(get('klaim_kompetensi'));
    const serviceEntity = ensureService(h, svc, competency);
    serviceEntity.competency = competency || serviceEntity.competency || 0;
    add(h.total, vec);
    add(serviceEntity.total, vec);
    if (severity) {
      add(ensure(h.severity, String(severity), ZERO), vec);
      add(ensure(serviceEntity.severity, String(severity), ZERO), vec);
    } else {
      add(h.unclassified, vec);
      add(serviceEntity.unclassified, vec);
    }
    if (rows % 1000000 === 0) console.log(`${period}: ${rows.toLocaleString('id-ID')} baris terbaca`);
  }
  if (!header) throw new Error(`CSV kosong: ${file}`);
  if (pendingRecord) malformedRows++;
  if (malformedRows > 0) throw new Error(`${path.basename(file)} memiliki ${malformedRows.toLocaleString('id-ID')} baris dengan jumlah kolom tidak sesuai (${header.length} kolom wajib); data tidak diterbitkan.`);
  const dataset = makeDataset(period, hospitals, services, rows, path.basename(file), matchedCases, totalCases, malformedRows);
  dataset.meta.skippedRows = skipNoCode;
  dataset.scatterServices = Object.fromEntries([...scatterServices].map(([service, groups]) => [service, [...groups.values()]]));
  dataset.idrgTariffs = Object.fromEntries(idrgTariffs);
  initialRates(dataset);
  console.log(JSON.stringify({ period, source: path.basename(file), columns: header.length, rows, hospitals: hospitals.size, services: services.size, totalCases, matchedCases, malformedRows, skippedRows: skipNoCode }));
  return dataset;
}
async function main() {
  const mapScript = fs.readFileSync(path.join(__dirname, 'js', 'idrg-map-data.js'), 'utf8');
  const sandbox = { window: {} };
  require('vm').runInNewContext(mapScript, sandbox, { timeout: 120000 });
  const idrgService = new Map();
  for (const [service, codes] of Object.entries(sandbox.window.idrgMapData.services || {})) for (const item of codes) idrgService.set(text(item.idrg), service);
  const tariffMap = loadTariffMap();
  const datasets = {};
  for (const period of ['jan_des', 'okt_oct']) datasets[period] = await processCsv(period, INPUTS[period], tariffMap, idrgService);
  const payload = JSON.stringify(datasets);
  await new Promise((resolve, reject) => {
    const gzip = zlib.createGzip({ level: 9 });
    const output = fs.createWriteStream(OUTPUT);
    gzip.on('error', reject); output.on('error', reject); output.on('finish', resolve);
    gzip.pipe(output); gzip.end(payload);
  });
  console.log(JSON.stringify({ output: OUTPUT, compressedBytes: fs.statSync(OUTPUT).size, uncompressedBytes: Buffer.byteLength(payload), nbrScenarios: NBR }));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
