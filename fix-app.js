const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');
content = content.replace('let html = \\n      <div', 'let html = \\\n      <div');
content = content.replace('      </tbody>\\n    <', '      </tbody>\\n    \;\\n    html += \<');
content = content.replace('  function renderRecapSlide() {', '/* FIXX */\\n  function renderRecapSlide() {');
fs.writeFileSync('js/app.js', content, 'utf8');
