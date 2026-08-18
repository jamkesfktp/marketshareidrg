const fs = require('fs');

const rawJs = fs.readFileSync('C:/Backup Riki/Dokumen/Market Share/rbk-market-share/js/data.js', 'utf8');
const jsonStr = rawJs.replace(/^window\.marketSimulatorDatasets\s*=\s*/, '').replace(/;\s*$/, '');
const ds = JSON.parse(jsonStr);
const data = ds['okt_jun'];

const sums = {
    dasar: { 1: 0, 2: 0, 3: 0, 4: 0, 0: 0 },
    madya: { 1: 0, 2: 0, 3: 0, 4: 0, 0: 0 },
    utama: { 1: 0, 2: 0, 3: 0, 4: 0, 0: 0 },
    paripurna: { 1: 0, 2: 0, 3: 0, 4: 0, 0: 0 }
};

data.hospitals.forEach(h => {
    if (h.services) {
        Object.values(h.services).forEach(s => {
            const comp = s.competency || 0;
            if (s.severity) {
                if (s.severity['1']) sums.dasar[comp] += s.severity['1'][0];
                if (s.severity['2']) sums.madya[comp] += s.severity['2'][0];
                if (s.severity['3']) sums.utama[comp] += s.severity['3'][0];
                if (s.severity['4']) sums.paripurna[comp] += s.severity['4'][0];
            }
        });
    }
});

const out = 'const compData = ' + JSON.stringify(sums) + ';';
fs.writeFileSync('C:/Backup Riki/Dokumen/Market Share/simulasi-dashboard/data.js', out);
console.log('Success! Result:', JSON.stringify(sums));
