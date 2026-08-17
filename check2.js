const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');
const startIdx = content.indexOf('  function renderRecapSlide() {');
const endIdx = content.indexOf('document.getElementById("recapSlide").innerHTML = html;', startIdx) + 55;
console.log("Start: ", startIdx, "End: ", endIdx);
console.log("Next chars: ", JSON.stringify(content.substring(endIdx, endIdx + 10)));
