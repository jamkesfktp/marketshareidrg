const fs = require('fs');

const dataFile = 'js/data.js';
const content = fs.readFileSync(dataFile, 'utf8');
const window = {};
eval(content);

const data = window.marketSimulatorData;
const sadikin = data.hospitals.find(h => h.name.toLowerCase().includes('hasan sadikin'));
console.log(sadikin.services['KEDOKTERAN FORENSIK'].competency);
