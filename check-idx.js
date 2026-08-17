const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');
const startIdx = content.indexOf('    function renderRecapSlide() {');
console.log('startIdx:', startIdx);
