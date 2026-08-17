const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');
const startIdx = content.indexOf('    function renderRecapSlide() {');
if(startIdx !== -1) {
    const endIdxStr = 'document.getElementById("recapSlide").innerHTML = html;\n  }';
    let endIdx = content.indexOf(endIdxStr, startIdx);
    if(endIdx !== -1) {
        endIdx += endIdxStr.length;
        content = content.substring(0, startIdx) + content.substring(endIdx);
        fs.writeFileSync('js/app.js', content, 'utf8');
        console.log('Removed second renderRecapSlide!');
    }
}
