const fs = require('fs');
let content = fs.readFileSync('js/data.js', 'utf8');

// The data.js is a large string starting with `window.marketSimulatorData = { ... }`
// We need to parse it, modify it, and write it back.
const window = {};
eval(content);

const data = window.marketSimulatorData;
const sadikin = data.hospitals.find(h => h.name.toLowerCase().includes('hasan sadikin'));

if (sadikin && sadikin.services['KEDOKTERAN FORENSIK']) {
  sadikin.services['KEDOKTERAN FORENSIK'].competency = 4; // Assume Paripurna
  
  // Write back
  const newContent = 'window.marketSimulatorData = ' + JSON.stringify(data, null, 2) + ';';
  fs.writeFileSync('js/data.js', newContent, 'utf8');
  console.log("Patched Hasan Sadikin Kedokteran Forensik to Level 4 (Paripurna)");
} else {
  console.log("Could not find Hasan Sadikin or Kedokteran Forensik");
}
