const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');
content = content.replace('}onst originalData', '}\\n\\nconst originalData');
fs.writeFileSync('js/app.js', content, 'utf8');
