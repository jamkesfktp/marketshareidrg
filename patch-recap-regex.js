const fs = require('fs');

let content = fs.readFileSync('js/app.js', 'utf8');

const regex = /^[ \t]*function renderRecapSlide\(\)\s*\{[\s\S]*?document\.getElementById\("recapSlide"\)\.innerHTML = html;\s*\}/m;

const b = String.fromCharCode(96);
const dl = '$';

const newRender = '  function renderRecapSlide() {\\n' +
    '    const target = targetHospital();\\n' +
    '    if (!target) return;\\n' +
    '    \\n' +
    '    let html = ' + b + '\\n' +
    '      <div class="table-container" style="max-height: 500px; overflow-y: auto;">\\n' +
    '        <table class="scenario-table" style="table-layout: auto; width: 100%; min-width: 1200px;">\\n' +
    '          <thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">\\n' +
    '            <tr>\\n' +
    '              <th rowspan="2" style="background-color: #0aa7ad; color: white;">No</th>\\n' +
    '              <th rowspan="2" style="background-color: #0aa7ad; color: white; text-align: left;">Layanan</th>\\n' +
    '              <th rowspan="2" style="background-color: #0aa7ad; color: white;">Komp.</th>\\n' +
    '              <th colspan="4" style="background-color: #16a085; color: white; text-align: center;">Dampak per Tingkat Kompetensi (Rentang Kasus & Rp)</th>\\n' +
    '              <th colspan="3" style="background-color: #0e7490; color: white; text-align: center;">Net +/- Pasca iDRG & RBKP (Rentang Min s.d Maks)</th>\\n' +
    '              <th rowspan="2" style="background-color: #1e40af; color: white;">Pendapatan<br>Eksisting INA-CBG<br>(Rp M)</th>\\n' +
    '              <th rowspan="2" style="background-color: #1e40af; color: white;">% Kenaikan<br>thd INA-CBG</th>\\n' +
    '            </tr>\\n' +
    '            <tr>\\n' +
    '              <th style="background-color: #20b2aa; color: white; min-width: 120px;">Paripurna</th>\\n' +
    '              <th style="background-color: #20b2aa; color: white; min-width: 120px;">Utama</th>\\n' +
    '              <th style="background-color: #20b2aa; color: white; min-width: 120px;">Madya</th>\\n' +
    '              <th style="background-color: #20b2aa; color: white; min-width: 120px;">Dasar</th>\\n' +
    '              <th style="background-color: #0284c7; color: white;">+/- Jml Kasus</th>\\n' +
    '              <th style="background-color: #0284c7; color: white;">% thd Kasus<br>Eksisting</th>\\n' +
    '              <th style="background-color: #0284c7; color: white;">+/- Net Rp (M)</th>\\n' +
    '            </tr>\\n' +
    '          </thead>\\n' +
    '          <tbody>\\n' +
    '    ' + b + ';\\n' +
    '    \\n' +
    '    data.services.forEach((service, idx) => {\\n' +
    '      const tHospSvc = target.services[service];\\n' +
    '      const svcData = data.regional.services[service];\\n' +
    '      const tSvcTotal = tHospSvc ? tHospSvc.total : [0,0,0];\\n' +
    '      \\n' +
    '      const tKasus = tSvcTotal[CASES] || 0;\\n' +
    '      const existingIna = tSvcTotal[INA] || 0;\\n' +
    '      \\n' +
    '      const targetCompetency = tHospSvc ? (tHospSvc.competency || 0) : 0;\\n' +
    '      const rules = getLevelRules(targetCompetency);\\n' +
    '      \\n' +
    '      const baseTambahan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };\\n' +
    '      const basePengurangan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };\\n' +
    '      \\n' +
    '      rules.tambah.forEach(lvl => {\\n' +
    '        const rM = svcData ? severityMetric(svcData, lvl) : [0,0,0];\\n' +
    '        const tM = tHospSvc ? severityMetric(tHospSvc, lvl) : [0,0,0];\\n' +
    '        baseTambahan[lvl][0] = Math.max(0, (rM[CASES]||0) - (tM[CASES]||0));\\n' +
    '        baseTambahan[lvl][1] = Math.max(0, (rM[IDRG]||0) - (tM[IDRG]||0));\\n' +
    '      });\\n' +
    '      rules.kurang.forEach(lvl => {\\n' +
    '        const tM = tHospSvc ? severityMetric(tHospSvc, lvl) : [0,0,0];\\n' +
    '        basePengurangan[lvl][0] = tM[CASES]||0;\\n' +
    '        basePengurangan[lvl][1] = tM[INA]||0;\\n' +
    '      });\\n' +
    '      \\n' +
    '      let scenarios = state.serviceScenarios[service] || [];\\n' +
    '      if (!scenarios || scenarios.length === 0) {\\n' +
    '        scenarios = Array(6).fill().map((_, i) => {\\n' +
    '          let scn = {};\\n' +
    '          rules.tambah.forEach(lvl => {\\n' +
    '            let lvlComp = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= lvl).length;\\n' +
    '            let base = lvlComp > 0 ? Math.min(50, 100 / (lvlComp + 1)) : 50;\\n' +
    '            scn["tambah_" + lvl] = parseFloat(Math.min(100, Math.max(0, base + i * 10)).toFixed(1));\\n' +
    '          });\\n' +
    '          rules.kurang.forEach(lvl => {\\n' +
    '            scn["kurang_" + lvl] = (lvl > targetCompetency || lvl === 4) ? 100 : 90;\\n' +
    '          });\\n' +
    '          return scn;\\n' +
    '        });\\n' +
    '      }\\n' +
    '      \\n' +
    '      const allDampak = { 4: {k:[],rp:[]}, 3: {k:[],rp:[]}, 2: {k:[],rp:[]}, 1: {k:[],rp:[]} };\\n' +
    '      const allNetK = [], allNetRp = [];\\n' +
    '      \\n' +
    '      scenarios.forEach(scn => {\\n' +
    '        let totalNetK = 0, totalNetRp = 0;\\n' +
    '        [4,3,2,1].forEach(lvl => {\\n' +
    '          let k = 0, rp = 0;\\n' +
    '          if (rules.tambah.includes(lvl) && scn.hasOwnProperty("tambah_" + lvl)) {\\n' +
    '            const pp = scn["tambah_" + lvl] / 100;\\n' +
    '            k = baseTambahan[lvl][0] * pp;\\n' +
    '            rp = baseTambahan[lvl][1] * pp;\\n' +
    '          } else if (rules.kurang.includes(lvl) && scn.hasOwnProperty("kurang_" + lvl)) {\\n' +
    '            const pk = scn["kurang_" + lvl] / 100;\\n' +
    '            k = -(basePengurangan[lvl][0] * pk);\\n' +
    '            rp = -(basePengurangan[lvl][1] * pk);\\n' +
    '          }\\n' +
    '          allDampak[lvl].k.push(k);\\n' +
    '          allDampak[lvl].rp.push(rp);\\n' +
    '          totalNetK += k;\\n' +
    '          totalNetRp += rp;\\n' +
    '        });\\n' +
    '        allNetK.push(totalNetK);\\n' +
    '        allNetRp.push(totalNetRp);\\n' +
    '      });\\n' +
    '      \\n' +
    '      const formatCell = (minVal, maxVal, isRp) => {\\n' +
    '        if (minVal === 0 && maxVal === 0) return "<span style=\\"color:#cbd5e1;\\">-</span>";\\n' +
    '        const isMinPos = minVal > 0;\\n' +
    '        const isMaxPos = maxVal > 0;\\n' +
    '        const color = (isMinPos || isMaxPos) ? "#15803d" : "#b91c1c";\\n' +
    '        const signMin = minVal > 0 ? "+" : (minVal < 0 ? "" : "");\\n' +
    '        const signMax = maxVal > 0 ? "+" : (maxVal < 0 ? "" : "");\\n' +
    '        \\n' +
    '        let textMin = isRp ? formatMoney(Math.abs(minVal)).replace("Rp", "").trim() : formatNumber(Math.abs(minVal));\\n' +
    '        let textMax = isRp ? formatMoney(Math.abs(maxVal)).replace("Rp", "").trim() : formatNumber(Math.abs(maxVal));\\n' +
    '        \\n' +
    '        if (isRp) {\\n' +
    '          textMin = (Math.abs(minVal)/1000000000).toFixed(1) + " M";\\n' +
    '          textMax = (Math.abs(maxVal)/1000000000).toFixed(1) + " M";\\n' +
    '        }\\n' +
    '        \\n' +
    '        if (minVal === maxVal) {\\n' +
    '          return ' + b + '<span style="color:' + dl + '{color}; font-weight:600;">' + dl + '{signMin} ' + dl + '{textMin}</span>' + b + ';\\n' +
    '        } else {\\n' +
    '          return ' + b + '<span style="color:' + dl + '{color}; font-weight:600;">' + dl + '{signMin} ' + dl + '{textMin} <span style="color:#94a3b8; font-weight:normal; font-size:9px;">s.d</span> ' + dl + '{signMax} ' + dl + '{textMax}</span>' + b + ';\\n' +
    '        }\\n' +
    '      };\\n' +
    '      \\n' +
    '      let htmlDampak = "";\\n' +
    '      [4,3,2,1].forEach(lvl => {\\n' +
    '        const minK = Math.min(...allDampak[lvl].k);\\n' +
    '        const maxK = Math.max(...allDampak[lvl].k);\\n' +
    '        const minRp = Math.min(...allDampak[lvl].rp);\\n' +
    '        const maxRp = Math.max(...allDampak[lvl].rp);\\n' +
    '        \\n' +
    '        if (minK === 0 && maxK === 0) {\\n' +
    '          htmlDampak += ' + b + '<td style="background:#f8fafc; text-align:center;">-</td>' + b + ';\\n' +
    '        } else {\\n' +
    '          htmlDampak += ' + b + '<td style="white-space:nowrap;">\\n' +
    '            <div style="margin-bottom:4px;">' + dl + '{formatCell(minK, maxK, false)}</div>\\n' +
    '            <div>' + dl + '{formatCell(minRp, maxRp, true)}</div>\\n' +
    '          </td>' + b + ';\\n' +
    '        }\\n' +
    '      });\\n' +
    '      \\n' +
    '      const minNetK = Math.min(...allNetK);\\n' +
    '      const maxNetK = Math.max(...allNetK);\\n' +
    '      const minNetRp = Math.min(...allNetRp);\\n' +
    '      const maxNetRp = Math.max(...allNetRp);\\n' +
    '      \\n' +
    '      const minPctK = tKasus ? minNetK / tKasus : 0;\\n' +
    '      const maxPctK = tKasus ? maxNetK / tKasus : 0;\\n' +
    '      const minPctRp = existingIna ? minNetRp / existingIna : 0;\\n' +
    '      const maxPctRp = existingIna ? maxNetRp / existingIna : 0;\\n' +
    '      \\n' +
    '      html += ' + b + '\\n' +
    '        <tr>\\n' +
    '          <td style="color: #94a3b8; font-size: 11px;">' + dl + '{idx + 1}</td>\\n' +
    '          <td style="text-align: left; font-weight: 600; font-size: 11px; white-space:nowrap;">' + dl + '{escapeHtml(formatService(service))}</td>\\n' +
    '          <td style="font-size: 11px;">' + dl + '{levelBadge(targetCompetency)}</td>\\n' +
    '          ' + dl + '{htmlDampak}\\n' +
    '          <td style="background:#f0f9ff; white-space:nowrap;">' + dl + '{formatCell(minNetK, maxNetK, false)}</td>\\n' +
    '          <td style="background:#f0f9ff; white-space:nowrap;">\\n' +
    '            ' + dl + '{minPctK === maxPctK \\n' +
    '                ? ' + b + '<span style="color:' + dl + '{minPctK > 0 ? "#15803d" : (minPctK < 0 ? "#b91c1c" : "#334155")}; font-weight:600;">' + dl + '{formatSignedPercent(minPctK)}</span>' + b + '\\n' +
    '                : ' + b + '<span style="color:' + dl + '{minPctK > 0 ? "#15803d" : "#b91c1c"}; font-weight:600;">' + dl + '{formatSignedPercent(minPctK)}</span> <span style="color:#94a3b8; font-size:9px;">s.d</span> <span style="color:' + dl + '{maxPctK > 0 ? "#15803d" : "#b91c1c"}; font-weight:600;">' + dl + '{formatSignedPercent(maxPctK)}</span>' + b + '\\n' +
    '             }\\n' +
    '          </td>\\n' +
    '          <td style="background:#f0f9ff; white-space:nowrap;">' + dl + '{formatCell(minNetRp, maxNetRp, true)}</td>\\n' +
    '          <td style="background:#fbfccb; color:#854d0e; font-weight:600; white-space:nowrap;">' + dl + '{(existingIna/1000000000).toFixed(1)} M</td>\\n' +
    '          <td style="background:#eff6ff; white-space:nowrap;">\\n' +
    '            ' + dl + '{minPctRp === maxPctRp \\n' +
    '                ? ' + b + '<span style="color:' + dl + '{minPctRp > 0 ? "#15803d" : (minPctRp < 0 ? "#b91c1c" : "#334155")}; font-weight:600;">' + dl + '{formatSignedPercent(minPctRp)}</span>' + b + '\\n' +
    '                : ' + b + '<span style="color:' + dl + '{minPctRp > 0 ? "#15803d" : "#b91c1c"}; font-weight:600;">' + dl + '{formatSignedPercent(minPctRp)}</span> <span style="color:#94a3b8; font-size:9px;">s.d</span> <span style="color:' + dl + '{maxPctRp > 0 ? "#15803d" : "#b91c1c"}; font-weight:600;">' + dl + '{formatSignedPercent(maxPctRp)}</span>' + b + '\\n' +
    '             }\\n' +
    '          </td>\\n' +
    '        </tr>\\n' +
    '      ' + b + ';\\n' +
    '    });\\n' +
    '    \\n' +
    '    html += ' + b + '\\n' +
    '          </tbody>\\n' +
    '        </table>\\n' +
    '      </div>\\n' +
    '      <div style="margin-top: 10px; font-size: 11px; color: #4e5d59; font-style: italic; line-height: 1.5; background: #f4f8f7; padding: 6px 10px; border-radius: 6px; border: 1px solid #d9e5e2;">\\n' +
    '        <div>* Warna <strong>Hijau</strong> menandakan potensi penambahan (capture) dari RS kompetitor; warna <strong>Merah</strong> menandakan potensi kehilangan (loss) karena kasus dikembalikan.</div>\\n' +
    '        <div>* % Kenaikan thd INA-CBG dihitung dari (Proyeksi Tambahan iDRG - Pengurangan INA-CBG) / Eksisting INA-CBG.</div>\\n' +
    '      </div>\\n' +
    '    ' + b + ';\\n' +
    '    \\n' +
    '    document.getElementById("recapSlide").innerHTML = html;\\n' +
    '  }';

if (regex.test(content)) {
   let fixed = content.replace(regex, newRender);
   fs.writeFileSync('js/app.js', fixed, 'utf8');
   console.log('App patched successfully via Regex');
} else {
   console.log('Regex did not match!');
}
