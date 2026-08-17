const fs = require('fs');
let lines = fs.readFileSync('js/app.js', 'utf8').split(/\r?\n/);

let start = -1;
let end = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function renderRecapSlide() {')) {
        start = i;
    }
    if (start !== -1 && i > start && lines[i].includes('function updateTargetMeta() {')) {
        end = i - 1;
        break;
    }
}

if (start !== -1 && end !== -1) {
    while(end > start && !lines[end].includes('}')) {
        end--;
    }
    console.log('Replacing from line ' + start + ' to ' + end);
    const newCode = fs.readFileSync('patch-data.js', 'utf8').split(/\r?\n/);
    lines.splice(start, end - start + 1, ...newCode);
    fs.writeFileSync('js/app.js', lines.join('\\n'), 'utf8');
} else {
    console.log('Bounds not found');
}

