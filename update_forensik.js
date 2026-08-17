const fs = require('fs');

const dataFile = 'js/data.js';
const content = fs.readFileSync(dataFile, 'utf8');
const window = {};
eval(content);

const data = window.marketSimulatorData;
let count = 0;

data.hospitals.forEach(h => {
  if (h.name.toLowerCase().includes('hasan sadikin') && h.services['KEDOKTERAN FORENSIK']) {
    h.services['KEDOKTERAN FORENSIK'].competency = 4;
    count++;
  }
});

const newContent = 'window.marketSimulatorData = ' + JSON.stringify(data, separators=(',', ':')) + ';';
fs.writeFileSync(dataFile, newContent, 'utf8');
console.log(`Updated ${count} hospital(s).`);
