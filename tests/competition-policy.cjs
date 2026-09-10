const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/app.js', 'utf8');
const ctx = {
  severityRanks: [1, 2, 3, 4],
  levelNames: {1: 'Dasar', 2: 'Madya', 3: 'Utama', 4: 'Paripurna'},
  formatNumber: String, formatService: String, window: {}
};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('  function canServeLevel('), source.indexOf('  function getLevelRules(')), ctx);
for (const [level, expected] of [[1, [1, 2]], [2, [2, 3]], [3, [3, 4]], [4, [4]]]) {
  assert.deepEqual([0, 1, 2, 3, 4, 5].filter(comp => ctx.canServeLevel(comp, level)), expected);
}
const levels = [1, 2, 3, 4].map(level => ({level, competitors: 3}));
const note = ctx.competitionFootnote('Jantung', 3, levels);
assert(note.includes('Madya: RS Madya + Utama = 3 kompetitor'));
assert(note.includes('Utama: RS Utama + Paripurna = 3 kompetitor'));
assert(!note.includes('Dasar: RS'));
assert(note.includes('25,00%'));
assert(ctx.competitionFootnote('Anak', 1, [{level: 1, competitors: 0}]).includes('100,00%'));
assert(ctx.competitionFootnote('Anak', 1, levels, {0: {tambah_1: 0}}).includes('manual aktif'));
ctx.window.dynamicMarketAddMode = 'flat';
assert(ctx.competitionFootnote('Anak', 1, levels).includes('Mode flat aktif'));
console.log('Competition eligibility and dynamic footnote checks passed');
