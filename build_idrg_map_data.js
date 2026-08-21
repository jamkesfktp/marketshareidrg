const fs = require("fs");
const readline = require("readline");
const XLSX = require("xlsx");

const CLAIMS = "C:\\Backup Riki\\Drive D\\Analsisi Uji Coba\\spending_okt_jun_v3_gabungan.csv";
const IDRG = "C:\\Users\\PUSBIKES-KEMKES\\Documents\\Tarif iDRG_+AF.xlsx";
const INA = "C:\\Users\\PUSBIKES-KEMKES\\Documents\\10. 20230110_Draft Tarif 2023 Final 10012023 (2).xlsx";
const OUTPUT = "js/idrg-map-data.js";

function csv(line) {
  const out = []; let value = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { out.push(value); value = ""; }
    else value += ch;
  }
  out.push(value); return out;
}

const clean = (v) => String(v ?? "").trim();
const number = (v) => Number(String(v ?? 0).replace(/,/g, "")) || 0;
const idrgTariffNumber = (v) => {
  if (typeof v === "number") return v > 0 && v < 100000 ? Math.round(v * 1000) : Math.round(v);
  return number(v);
};
const severityFromInaCode = (v) => {
  const suffix = clean(v).toUpperCase().split("-").pop();
  if (suffix === "I") return 1;
  if (suffix === "II") return 2;
  if (suffix === "III") return 3;
  return 0;
};

const idrgRows = XLSX.utils.sheet_to_json(XLSX.readFile(IDRG).Sheets.Sheet1, { defval: "" });
const idrgTariffs = {};
for (const row of idrgRows) {
  const code = clean(row.DRG);
  if (code) idrgTariffs[code] = { description: clean(row["Deskripsi DRG"]), tariff: idrgTariffNumber(row["Tarif iDRG"]), ptd: number(row.PTD) };
}

const inaWorkbook = XLSX.readFile(INA);
const inaRows = XLSX.utils.sheet_to_json(inaWorkbook.Sheets["TARIF CBGS 2022"], { range: 4, defval: "" });
const inaAgg = new Map();
const inaOwnershipAgg = new Map();
for (const row of inaRows) {
  const code = clean(row.KODE_INACBG); const reg = clean(row.REGIONAL).toUpperCase().replace("REG", "R");
  const hospitalClass = clean(row["KELAS RS"]).toUpperCase(); const rawatClass = clean(row.KELAS_RAWAT).toUpperCase().replace(/\s+/g, "");
  if (!code || !/^[A-D]$/.test(hospitalClass) || !/^KELAS[0-3]$/.test(rawatClass) || !/^R[1-5]$/.test(reg)) continue;
  const key = `${code}|${hospitalClass}|${rawatClass}|${reg}`; const prev = inaAgg.get(key) || { sum: 0, n: 0, description: clean(row.DESKRIPSI) };
  const tariff = number(row[" TARIF FINAL "] ?? row["TARIF FINAL"] ?? row["FINAL TARIF "]);
  prev.sum += tariff; prev.n++; inaAgg.set(key, prev);
  const ownershipCode = clean(row.KEPEMILIKAN).toUpperCase();
  const ownership = ownershipCode === "P" || ownershipCode.includes("PEMERINTAH") ? "PEMERINTAH" : ownershipCode === "S" || ownershipCode.includes("SWASTA") ? "SWASTA" : "";
  if (ownership) {
    const ownershipKey = `${code}|${hospitalClass}|${rawatClass}|${ownership}|${reg}`;
    const ownershipPrev = inaOwnershipAgg.get(ownershipKey) || { sum: 0, n: 0 };
    ownershipPrev.sum += tariff; ownershipPrev.n++; inaOwnershipAgg.set(ownershipKey, ownershipPrev);
  }
}
const inaTariffs = {};
for (const [key, val] of inaAgg) {
  const [code, hospitalClass, rawatClass, reg] = key.split("|");
  inaTariffs[code] ||= { rates: {} };
  inaTariffs[code].rates[hospitalClass] ||= {};
  inaTariffs[code].rates[hospitalClass][rawatClass] ||= {};
  inaTariffs[code].rates[hospitalClass][rawatClass][reg] = Math.round(val.sum / val.n);
}
for (const [key, val] of inaOwnershipAgg) {
  const [code, hospitalClass, rawatClass, ownership, reg] = key.split("|");
  inaTariffs[code].ownershipRates ||= {};
  inaTariffs[code].ownershipRates[hospitalClass] ||= {};
  inaTariffs[code].ownershipRates[hospitalClass][rawatClass] ||= {};
  inaTariffs[code].ownershipRates[hospitalClass][rawatClass][ownership] ||= {};
  inaTariffs[code].ownershipRates[hospitalClass][rawatClass][ownership][reg] = Math.round(val.sum / val.n);
}
for (const item of Object.values(inaTariffs)) {
  for (const byRawat of Object.values(item.ownershipRates || {})) for (const byOwnership of Object.values(byRawat)) for (const regions of Object.values(byOwnership)) {
    const vals = [1, 2, 3, 4, 5].map((n) => regions[`R${n}`]).filter(Number.isFinite);
    regions.ALL = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }
}
for (const item of Object.values(inaTariffs)) {
  for (const byRawat of Object.values(item.rates)) for (const regions of Object.values(byRawat)) {
    const vals = [1, 2, 3, 4, 5].map((n) => regions[`R${n}`]).filter(Number.isFinite);
    regions.ALL = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }
}
const specialRows = XLSX.utils.sheet_to_json(inaWorkbook.Sheets["RS KHUSUS"], { range: 4, defval: "" });
const specialAgg = new Map();
for (const row of specialRows) {
  const code = clean(row.KODE_INACBG); const rawatClass = clean(row.KELAS_RAWAT).toUpperCase().replace(/\s+/g, "");
  if (!code || !/^KELAS[0-3]$/.test(rawatClass)) continue;
  const key = `${code}|${rawatClass}`; const prev = specialAgg.get(key) || { sum: 0, n: 0, description: clean(row.DESKRIPSI) };
  const tariffKey = Object.keys(row).find((name) => name.trim() === "FINAL TARIF");
  const tariff = number(tariffKey ? row[tariffKey] : 0); if (!tariff) continue;
  prev.sum += tariff; prev.n++; specialAgg.set(key, prev);
}
for (const [key, val] of specialAgg) {
  const [code, rawatClass] = key.split("|");
  inaTariffs[code] ||= { rates: {} };
  inaTariffs[code].rates["RS KHUSUS"] ||= {};
  inaTariffs[code].rates["RS KHUSUS"][rawatClass] = { ALL: Math.round(val.sum / val.n) };
}

const relations = new Map();
const scatterRelations = new Map();
const input = readline.createInterface({ input: fs.createReadStream(CLAIMS, { encoding: "utf8" }), crlfDelay: Infinity });
let headers = null; let rows = 0;
input.on("line", (line) => {
  if (!headers) { headers = csv(line); return; }
  const row = csv(line); rows++;
  const service = clean(row[14]).toUpperCase(); const ina = clean(row[18]); const idrg = clean(row[22]);
  if (!service || !ina || !idrg) return;
  const sev = severityFromInaCode(ina); const cases = number(row[28]);
  const key = `${service}|${ina}|${idrg}`;
  const prev = relations.get(key) || { service, ina, inaDescription: clean(row[19]), idrg, idrgDescription: clean(row[23]), severity: sev, cases: 0, segments: new Map() };
  prev.cases += cases;
  const ownership = clean(row[7]).toUpperCase() === "P" ? "PEMERINTAH" : clean(row[7]).toUpperCase() === "S" ? "SWASTA" : "LAINNYA";
  const hospitalClass = clean(row[8]).toUpperCase();
  const region = clean(row[9]).toUpperCase().replace("REG", "R");
  const rawatValue = clean(row[13]).toUpperCase().replace(/\s+/g, "");
  const rawatClass = /^KELAS[0-3]$/.test(rawatValue) ? rawatValue : /^[0-3]$/.test(rawatValue) ? `KELAS${rawatValue}` : rawatValue;
  const segmentKey = `${ownership}|${hospitalClass}|${rawatClass}|${region}`;
  prev.segments.set(segmentKey, (prev.segments.get(segmentKey) || 0) + cases);
  const scatterKey = `${service}|${idrg}|${segmentKey}`;
  const scatter = scatterRelations.get(scatterKey) || { description: clean(row[23]), metrics: [0, 0, 0, 0, 0, 0, 0, 0] };
  const financials = [cases, number(row[29]), number(row[42]), number(row[41]), number(row[40]), number(row[39]), number(row[50]), number(row[37])];
  financials.forEach((value, index) => { scatter.metrics[index] += value; });
  scatterRelations.set(scatterKey, scatter);
  relations.set(key, prev);
  if (rows % 1000000 === 0) console.log(`Processed ${rows.toLocaleString()} rows`);
});
input.on("close", () => {
  const services = {};
  for (const rel of relations.values()) {
    rel.segments = [...rel.segments].map(([key, cases]) => [...key.split("|"), cases]);
    services[rel.service] ||= []; services[rel.service].push(rel);
  }
  const scatterServices = {};
  for (const [key, value] of scatterRelations) {
    const [service, idrg, ownership, hospitalClass, rawatClass, region] = key.split("|");
    scatterServices[service] ||= [];
    scatterServices[service].push([idrg, value.description, ownership, hospitalClass, rawatClass, region, ...value.metrics.map((metric) => Math.round(metric))]);
  }
  for (const rows of Object.values(services)) rows.sort((a, b) => b.cases - a.cases);
  const payload = { meta: { generatedAt: new Date().toISOString(), sourceRows: rows }, services, scatterServices, inaTariffs, idrgTariffs };
  fs.writeFileSync(OUTPUT, `window.idrgMapData=${JSON.stringify(payload)};`);
  console.log(`Wrote ${OUTPUT}: ${Object.keys(services).length} services, ${relations.size} relations`);
});
