const fs = require('fs');

const dataFile = 'js/data.js';
const content = fs.readFileSync(dataFile, 'utf8');
const window = {};
eval(content);

const data = window.marketSimulatorData;
let modified = false;

// We need to fetch the competency for Forensik from data.competencies if available
const compKey = Object.keys(data.competencies).find(k => k.toLowerCase().includes('forensik'));
if (compKey) {
  const compMapping = data.competencies[compKey];
  
  data.hospitals.forEach(h => {
    // If the hospital has forensik mapped
    if (compMapping[h.code]) {
      const level = compMapping[h.code];
      const svcKey = Object.keys(h.services || {}).find(s => s.toLowerCase().includes('forensik')) || "KEDOKTERAN FORENSIK";
      
      if (!h.services) h.services = {};
      if (!h.services[svcKey]) {
        h.services[svcKey] = {
          competency: level,
          total: [0, 0, 0],
          severity: {}
        };
        modified = true;
      } else if (h.services[svcKey].competency !== level) {
        h.services[svcKey].competency = level;
        modified = true;
      }
    }
  });
}

if (modified) {
  const newContent = 'window.marketSimulatorData = ' + JSON.stringify(data, null, 2) + ';';
  fs.writeFileSync(dataFile, newContent, 'utf8');
  console.log("Updated competencies from mapping data.");
} else {
  console.log("No updates needed.");
}
