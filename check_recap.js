const fs = require('fs');
const content = fs.readFileSync('js/app.js', 'utf8');

const start = content.indexOf('function renderRecapSlide()');
const end = content.indexOf('function updateTargetMeta()');

if (start !== -1 && end !== -1) {
  console.log(content.substring(start, end));
} else {
  console.log("Could not find renderRecapSlide");
}
