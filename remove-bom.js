const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');
content = content.replace(/\uFEFF/g, '');
fs.writeFileSync('js/app.js', content, 'utf8');
console.log('BOM removed');
