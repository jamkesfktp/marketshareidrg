const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const slidesSource = fs.readFileSync('js/export-gslides.js', 'utf8');

assert.match(appSource, /class="service-competency-select"/);
assert.match(appSource, /getCompetency: getSimulationCompetency/);
assert.match(appSource, /computeServiceScenarios\(service, scenarioTarget/);
assert.match(slidesSource, /competencyOverrides/);

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('js/scenarios-core.js', 'utf8'), sandbox);
const compute = sandbox.window.computeServiceScenarios;
const service = 'Jantung';
const metric = (cases, revenue) => [cases, 0, revenue];
const serviceData = (competency) => ({
  competency,
  total: metric(10, 1000),
  severity: { 1: metric(4, 400), 2: metric(3, 300), 3: metric(2, 200), 4: metric(1, 100) }
});
const regional = {
  total: metric(100, 10000),
  severity: { 1: metric(40, 4000), 2: metric(30, 3000), 3: metric(20, 2000), 4: metric(10, 1000) }
};
const rules = (level) => level === 1
  ? { tambah: [1], kurang: [2, 3, 4] }
  : { tambah: [1, 2, 3, 4], kurang: [] };
const severityMetric = (entry, level) => entry.severity[level];
const state = { serviceScenarios: { [service]: [{ tambah_1: 10, tambah_2: 10, tambah_3: 10, tambah_4: 10, kurang_2: 100, kurang_3: 100, kurang_4: 100 }] } };
const data = { regional: { services: { [service]: regional } }, hospitals: [] };

const dasarTarget = { code: 'T', services: { [service]: serviceData(1) } };
const paripurnaTarget = { code: 'T', services: { [service]: serviceData(4) } };
const dasar = compute(service, dasarTarget, data, state, 0, 1, 2, severityMetric, rules, 'regional_all', () => 0);
const paripurna = compute(service, paripurnaTarget, data, state, 0, 1, 2, severityMetric, rules, 'regional_all', () => 0);

assert.strictEqual(dasar.targetCompetency, 1);
assert.strictEqual(paripurna.targetCompetency, 4);
assert.strictEqual(dasar.chosen.totalTambahKasus, 3.6);
assert.strictEqual(dasar.chosen.totalKurangKasus, 6);
assert.strictEqual(paripurna.chosen.totalTambahKasus, 9);
assert.strictEqual(paripurna.chosen.totalKurangKasus, 0);
assert.notStrictEqual(dasar.chosen.pascaKasus, paripurna.chosen.pascaKasus);

console.log('Per-service competency controls and recalculation passed');
