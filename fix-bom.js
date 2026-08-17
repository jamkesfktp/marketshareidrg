const fs = require('fs');
let text = fs.readFileSync('js/app.js', 'utf8');
text = text.replace(/^\uFEFF/, ''); // Remove BOM if present at start
text = text.replace(/\uFEFF/g, ''); // Remove any other BOMs
fs.writeFileSync('js/app.js', text, 'utf8');
