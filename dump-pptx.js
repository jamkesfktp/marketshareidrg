const fs = require('fs');
let content = fs.readFileSync('js/export-gslides.js', 'utf8');
const startIdx = content.indexOf('  function buildRecapSlide(pptx, appState) {');
const endIdx = content.indexOf('  function buildComparisonSlide', startIdx);
console.log(content.substring(startIdx, endIdx));
