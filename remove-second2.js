const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');
const startIdx = content.indexOf('    function renderRecapSlide() {');
if(startIdx !== -1) {
    const endIdxStr = 'document.getElementById("recapSlide").innerHTML = html;';
    let endIdx = content.indexOf(endIdxStr, startIdx);
    if(endIdx !== -1) {
        // Also remove the \n    }
        endIdx += endIdxStr.length;
        let nextCloseIdx = content.indexOf('}', endIdx);
        endIdx = nextCloseIdx + 1;
        
        content = content.substring(0, startIdx) + content.substring(endIdx);
        fs.writeFileSync('js/app.js', content, 'utf8');
        console.log('Removed second renderRecapSlide!');
    }
}
