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
const severity = (v) => {
  const s = clean(v).toUpperCase();
  if (s.includes("DASAR") || s === "1") return 1;
  if (s.includes("MADYA") || s === "2") return 2;
  if (s.includes("UTAMA") || s === "3") return 3;
  if (s.includes("PARIPURNA") || s === "4") return 4;
  return 0;
};

const idrgRows = XLSX.utils.sheet_to_json(XLSX.readFile(IDRG).Sheets.Sheet1, { defval: "" });
const idrgTariffs = {};
for (const row of idrgRows) {
  const code = clean(row.DRG);
  if (code) idrgTariffs[code] = { description: clean(row["Deskripsi DRG"]), tariff: number(row["Tarif iDRG"]), ptd: clean(row.PTD), mdc: clean(row.MDC), dc: clean(row.DC) };
}

const inaSheet = XLSX.readFile(INA).Sheets["TARIF CBGS 2022"];
const inaRows = XLSX.utils.sheet_to_json(inaSheet, { range: 4, defval: "" });
const inaAgg = new Map();
for (const row of inaRows) {
  const code = clean(row.KODE_INACBG); const reg = clean(row.REGIONAL).toUpperCase().replace("REG", "R");
  if (!code || !/^R[1-5]$/.test(reg)) continue;
  const key = `${code}|${reg}`; const prev = inaAgg.get(key) || { sum: 0, n: 0, description: clean(row.DESKRIPSI) };
  prev.sum += number(row["TARIF FINAL"]); prev.n++; inaAgg.set(key, prev);
}
const inaTariffs = {};
for (const [key, val] of inaAgg) {
  const [code, reg] = key.split("|");
  inaTariffs[code] ||= { description: val.description, regions: {} };
  inaTariffs[code].regions[reg] = Math.round(val.sum / val.n);
}
for (const item of Object.values(inaTariffs)) {
  const vals = Object.values(item.regions);
  item.regions.ALL = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}

const relations = new Map();
const input = readline.createInterface({ input: fs.createReadStream(CLAIMS, { encoding: "utf8" }), crlfDelay: Infinity });
let headers = null; let rows = 0;
input.on("line", (line) => {
  if (!headers) { headers = csv(line); return; }
  const row = csv(line); rows++;
  const service = clean(row[14]).toUpperCase(); const ina = clean(row[18]); const idrg = clean(row[22]);
  if (!service || !ina || !idrg) return;
  const sev = severity(row[17]); const cases = number(row[28]);
  const key = `${service}|${ina}|${idrg}|${sev}`;
  const prev = relations.get(key) || { service, ina, inaDescription: clean(row[19]), idrg, idrgDescription: clean(row[23]), severity: sev, cases: 0 };
  prev.cases += cases; relations.set(key, prev);
  if (rows % 1000000 === 0) console.log(`Processed ${rows.toLocaleString()} rows`);
});
input.on("close", () => {
  const services = {};
  for (const rel of relations.values()) { services[rel.service] ||= []; services[rel.service].push(rel); }
  for (const rows of Object.values(services)) rows.sort((a, b) => b.cases - a.cases);
  const payload = { meta: { generatedAt: new Date().toISOString(), sourceRows: rows, idrgTariffSource: IDRG, inaTariffSource: INA }, services, inaTariffs, idrgTariffs };
  fs.writeFileSync(OUTPUT, `window.idrgMapData=${JSON.stringify(payload)};`);
  console.log(`Wrote ${OUTPUT}: ${Object.keys(services).length} services, ${relations.size} relations`);
});
