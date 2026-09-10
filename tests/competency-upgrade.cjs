const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/competency-upgrade.js', 'utf8'), context);
const { canServe, simulateUpgrade } = context.window.CompetencyUpgrade;

assert.equal(canServe(1, 1), true);
assert.equal(canServe(1, 2), false);
assert.equal(canServe(3, 2), true);
assert.equal(canServe(3, 1), false);

const target = { code: 'T', services: { JIWA: { total: [10, 100, 120], unclassified: [0, 0, 0], levels: { 1: [10, 100, 120], 2: [0, 0, 0], 3: [0, 0, 0], 4: [0, 0, 0] } } } };
const hospitals = [target, { code: 'A', comp: 2 }, { code: 'B', comp: 3 }];
const regional = { levels: { 1: [40, 400, 480], 2: [30, 300, 360], 3: [20, 200, 240], 4: [10, 100, 120] } };
const severityMetric = (item, level) => item?.levels?.[level] || [0, 0, 0];
const result = simulateUpgrade({ service: 'JIWA', target, hospitals, regionalService: regional, targetCompetency: 1, targetLevel: 2, captureMultiplier: 1, retentionRate: 1, getCompetency: (h) => h.comp || 1, severityMetric });
assert.equal(result.levelRows[0].competitors, 1);
assert.equal(result.levelRows[1].competitors, 2);
assert.equal(Math.round(result.projected[0]), 35);
assert.equal(Math.round(result.captured[0]), 25);
console.log('competency-upgrade tests passed');
