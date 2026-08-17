const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// The new HTML for the headers
const tHeadHtml = \
          <thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <th rowspan="2" style="background-color: #0aa7ad; color: white;">No</th>
              <th rowspan="2" style="background-color: #0aa7ad; color: white; text-align: left;">Layanan</th>
              <th rowspan="2" style="background-color: #0aa7ad; color: white;">Komp.</th>
              <th colspan="3" style="background-color: #16a085; color: white; text-align: center;">Dampak Paripurna</th>
              <th colspan="3" style="background-color: #16a085; color: white; text-align: center;">Dampak Utama</th>
              <th colspan="3" style="background-color: #16a085; color: white; text-align: center;">Dampak Madya</th>
              <th colspan="3" style="background-color: #16a085; color: white; text-align: center;">Dampak Dasar</th>
              <th colspan="3" style="background-color: #0e7490; color: white; text-align: center;">Net +/- Pasca iDRG & RBKP</th>
              <th rowspan="2" style="background-color: #1e40af; color: white;">Pendapatan<br>Eksisting INA-CBG<br>(Rp M)</th>
              <th rowspan="2" style="background-color: #1e40af; color: white;">% Kenaikan<br>thd INA-CBG</th>
            </tr>
            <tr>
              \
              <th style="background-color: #0284c7; color: white;">+/- Jml Kasus</th>
              <th style="background-color: #0284c7; color: white;">% thd Kasus<br>Eksisting</th>
              <th style="background-color: #0284c7; color: white;">+/- Net Rp (M)</th>
            </tr>
          </thead>
\;

// Replace the original headers
code = code.replace(
  /<thead style=\"position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba\(0,0,0,0\.1\);\">[\s\S]*?<\/thead>/m,
  tHeadHtml
);

// We also need to update the data row generation
// Find the logic that generates \htmlDampak\
const oldRowHtml = \      let htmlDampak = "";
      [4,3,2,1].forEach(lvl => {
        const minK = Math.min(...allDampak[lvl].k);
        const maxK = Math.max(...allDampak[lvl].k);
        const minRp = Math.min(...allDampak[lvl].rp);
        const maxRp = Math.max(...allDampak[lvl].rp);
        
        if (minK === 0 && maxK === 0) {
          htmlDampak += \\\<td style="background:#f8fafc; text-align:center;">-</td>\\\;
        } else {
          htmlDampak += \\\<td style="white-space:nowrap;">
            <div style="margin-bottom:4px;">\\\</div>
            <div>\\\</div>
          </td>\\\;
        }
      });\;

const newRowHtml = \      let htmlDampak = "";
      [4,3,2,1].forEach(lvl => {
        const minK = Math.min(...allDampak[lvl].k);
        const maxK = Math.max(...allDampak[lvl].k);
        const minRp = Math.min(...allDampak[lvl].rp);
        const maxRp = Math.max(...allDampak[lvl].rp);
        
        let minPct = 0;
        let maxPct = 0;
        if (tKasus > 0) {
           minPct = minK / tKasus;
           maxPct = maxK / tKasus;
        }

        if (minK === 0 && maxK === 0) {
          htmlDampak += \\\<td style="background:#f8fafc; text-align:center;">-</td><td style="background:#f8fafc; text-align:center;">-</td><td style="background:#f8fafc; text-align:center;">-</td>\\\;
        } else {
          const pctStr = (minPct === maxPct) ? 
             \\\<span style="color:\\\; font-weight:600;">\\\</span>\\\ :
             \\\<span style="color:\\\; font-weight:600;">\\\</span> <span style="color:#94a3b8; font-size: 11px;">s.d</span> <span style="color:\\\; font-weight:600;">\\\</span>\\\;
             
          htmlDampak += \\\<td style="background:#ffffff; white-space:nowrap;">\\\</td>
            <td style="background:#ffffff; white-space:nowrap;">\\\</td>
            <td style="background:#ffffff; white-space:nowrap;">\\\</td>\\\;
        }
      });\;

code = code.replace(oldRowHtml, newRowHtml);

fs.writeFileSync('js/app.js', code);
