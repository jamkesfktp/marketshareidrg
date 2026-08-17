const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// 1. Change row generation for the last column
const rowRegex = /<td style="\$\{cellBorder\} font-size: 11px; padding: 4px; font-weight: 700; color: \$\{pctKenaikan > 0 \? '#15803d' : \(pctKenaikan < 0 \? '#b91c1c' : '#334155'\)\};">\$\{formatPercent\(pctKenaikan\)\}<\/td>/;
const newRowCol = `<td style="\${cellBorder} font-size: 11px; padding: 4px; font-weight: 700; color: #0f766e;">\${formatMatrixMoneyJT(netRp + existingIna)}</td>`;
if (code.match(rowRegex)) {
  code = code.replace(rowRegex, newRowCol);
  console.log('Row patched');
} else {
  console.log('Row NOT patched');
}

// 2. Change header for Pendapatan Eksisting INA CBG
const headerRegex = /<th rowspan="2" style="background-color: #16a085; color: white; padding: 6px; font-size: 11px; border: 1px solid white; width: 100px;">PENDAPATAN<br>EKSISTING INA<br>CBG<br>\(Rp M\)<\/th>/;
const newHeader1 = `<th rowspan="2" style="background-color: #16a085; color: white; padding: 6px; font-size: 11px; border: 1px solid white; width: 100px;">PENDAPATAN<br>EKSISTING INA<br>CBG<br>(Rp M)<br><span style="font-size:9px; color:#a7f3d0;">(\${formatNumber(totalTargetCases)} Kasus Eksisting)</span></th>`;
if (code.match(headerRegex)) {
  code = code.replace(headerRegex, newHeader1);
  console.log('Header 1 patched');
} else {
  console.log('Header 1 NOT patched');
}

// 3. Change header for the last column
const headerRegex2 = /<th rowspan="2" style="background-color: #16a085; color: white; padding: 6px; font-size: 11px; border: 1px solid white; width: 100px;">% KENAIKAN<br>THD INA-CBG<br>EKSISTING<\/th>/;
const newHeader2 = `<th rowspan="2" style="background-color: #16a085; color: white; padding: 6px; font-size: 11px; border: 1px solid white; width: 100px;">PENDAPATAN<br>PASCA RBKP<br>(Rp M)</th>`;
if (code.match(headerRegex2)) {
  code = code.replace(headerRegex2, newHeader2);
  console.log('Header 2 patched');
} else {
  console.log('Header 2 NOT patched');
}

fs.writeFileSync('js/app.js', code);
console.log('App.js patched successfully');
