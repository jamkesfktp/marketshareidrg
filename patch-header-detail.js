const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const headerRegex = /<th rowspan="2" style="background-color: #16a085; color: white; padding: 6px; font-size: 11px; border: 1px solid white; width: 100px;">PENDAPATAN<br>EKSISTING INA<br>CBG<br>\(Rp M\)<br><span style="font-size:9px; color:#a7f3d0;">\(\$\{formatNumber\(totalTargetCases\)\} Kasus Eksisting\)<\/span><\/th>/;
const newHeader = `<th rowspan="2" style="background-color: #16a085; color: white; padding: 6px; font-size: 11px; border: 1px solid white; min-width: 130px;">PENDAPATAN<br>EKSISTING INA<br>CBG<br>(Rp M)<br><div style="font-size:9px; color:#a7f3d0; font-weight:normal; text-align:left; margin-top:4px; line-height:1.3;">Paripurna: \${formatNumber(tP)}<br>Utama: \${formatNumber(tU)}<br>Madya: \${formatNumber(tM)}<br>Dasar: \${formatNumber(tD)}</div></th>`;

if (code.match(headerRegex)) {
  code = code.replace(headerRegex, newHeader);
  fs.writeFileSync('js/app.js', code);
  console.log('Header patched to show severity details');
} else {
  console.log('Could not find header regex');
}
