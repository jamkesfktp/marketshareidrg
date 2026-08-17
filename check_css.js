const fs = require('fs');
const content = fs.readFileSync('css/style.css', 'utf8');

const match = content.match(/\.deck-controls\s*\{[^}]+\}/g);
if (match) {
  console.log(match.join('\n'));
} else {
  console.log('Not found');
}
