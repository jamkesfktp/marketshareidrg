const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');
let recap = fs.readFileSync('renderRecapSlide.js', 'utf8');

content = content.replace('function updateTargetMeta() {', recap + '\n\n  function updateTargetMeta() {');
fs.writeFileSync('js/app.js', content, 'utf8');
console.log('Recap applied');
