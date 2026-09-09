// Update only competency fields; preserve claim metrics and unmatched hospitals.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const master = JSON.parse(fs.readFileSync('data/competencies-2026-09-03.json', 'utf8'));
const window = {};
vm.runInNewContext(fs.readFileSync('js/data.js', 'utf8'), { window });
const datasets = window.marketSimulatorDatasets;
const reports = {};
for (const [key, dataset] of Object.entries(datasets)) {
  assert(dataset.services.every(service => master.services.includes(service)), 'Unknown service');
  const regionalBefore = JSON.stringify(dataset.regional);
  const report = { matched: 0, unmatched: [], changedHospitals: 0, changedEntries: 0, addedEntries: 0, changes: [] };
  for (const hospital of dataset.hospitals) {
    const entries = master.hospitals[hospital.code];
    if (!entries) { report.unmatched.push({ code: hospital.code, name: hospital.name }); continue; }
    report.matched++;
    const original = JSON.parse(JSON.stringify(hospital));
    let changed = false;
    for (const [service, level] of Object.entries(entries)) {
      assert(Number.isInteger(level) && level >= 0 && level <= 4);
      if (!hospital.services[service]) {
        hospital.services[service] = { competency: level, total: hospital.total.map(() => 0), severity: {} };
        report.addedEntries++;
        changed = true;
      } else if (hospital.services[service].competency !== level) {
        report.changes.push({ code: hospital.code, service, from: hospital.services[service].competency, to: level });
        report.changedEntries++;
        changed = true;
        hospital.services[service].competency = level;
      }
    }
    if (changed) report.changedHospitals++;
    // Independent equality check: every old field except competency remains identical.
    const check = JSON.parse(JSON.stringify(hospital));
    for (const service of Object.keys(check.services)) {
      if (!original.services[service]) delete check.services[service];
      else check.services[service].competency = original.services[service].competency;
    }
    assert.deepEqual(check, original, `Claim data changed: ${key}/${hospital.code}`);
  }
  assert.equal(JSON.stringify(dataset.regional), regionalBefore);
  dataset.services = [...new Set([...dataset.services, ...master.services])].sort();
  Object.assign(dataset.meta, {
    competencySource: master.source, competencyAsOf: master.asOf,
    competencySourceSha256: master.sha256, competencyMatchedHospitals: report.matched,
    competencyUnmatchedHospitals: report.unmatched.length, referenceServiceCount: dataset.services.length
  });
  reports[key] = report;
}
if (process.argv.includes('--write')) {
  fs.writeFileSync('js/data.js', 'window.marketSimulatorDatasets = ' + JSON.stringify(datasets) + ';\nwindow.marketSimulatorData = window.marketSimulatorDatasets["okt_jun"];\n');
  fs.writeFileSync('data/competency-update-2026-09-03-report.json', JSON.stringify(reports, null, 2) + '\n');
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(reports).map(([key,r]) => [key,{...r,unmatched:r.unmatched.length,changes:r.changes.slice(0,3)}])), null, 2));
