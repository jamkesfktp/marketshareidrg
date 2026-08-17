const fs = require('fs');

let lines = fs.readFileSync('js/app.js', 'utf8').split(/\r?\n/);

let start = -1;
let end = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function renderRecapSlide() {')) {
        start = i;
    }
    // We want the closing brace for renderRecapSlide
    // This happens right before 'function updateTargetMeta()'
    if (start !== -1 && i > start && lines[i].includes('function updateTargetMeta() {')) {
        end = i - 1; // The empty line before updateTargetMeta
        break;
    }
}

if (start !== -1 && end !== -1) {
    // Find exact closing brace
    while(end > start && !lines[end].includes('}')) {
        end--;
    }
    
    console.log('Replacing from line ' + start + ' to ' + end);
    
    const newLines = `  function renderRecapSlide() {
    const target = targetHospital();
    if (!target) return;
    
    let html = \`
      <div class="table-container" style="max-height: 500px; overflow-y: auto;">
        <table class="scenario-table" style="table-layout: auto; width: 100%; min-width: 1200px;">
          <thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <th rowspan="2" style="background-color: #0aa7ad; color: white;">No</th>
              <th rowspan="2" style="background-color: #0aa7ad; color: white; text-align: left;">Layanan</th>
              <th rowspan="2" style="background-color: #0aa7ad; color: white;">Komp.</th>
              <th colspan="4" style="background-color: #16a085; color: white; text-align: center;">Dampak per Tingkat Kompetensi (Rentang Kasus & Rp)</th>
              <th colspan="3" style="background-color: #0e7490; color: white; text-align: center;">Net +/- Pasca iDRG & RBKP (Rentang Min s.d Maks)</th>
              <th rowspan="2" style="background-color: #1e40af; color: white;">Pendapatan<br>Eksisting INA-CBG<br>(Rp M)</th>
              <th rowspan="2" style="background-color: #1e40af; color: white;">% Kenaikan<br>thd INA-CBG</th>
            </tr>
            <tr>
              <th style="background-color: #20b2aa; color: white; min-width: 120px;">Paripurna</th>
              <th style="background-color: #20b2aa; color: white; min-width: 120px;">Utama</th>
              <th style="background-color: #20b2aa; color: white; min-width: 120px;">Madya</th>
              <th style="background-color: #20b2aa; color: white; min-width: 120px;">Dasar</th>
              <th style="background-color: #0284c7; color: white;">+/- Jml Kasus</th>
              <th style="background-color: #0284c7; color: white;">% thd Kasus<br>Eksisting</th>
              <th style="background-color: #0284c7; color: white;">+/- Net Rp (M)</th>
            </tr>
          </thead>
          <tbody>
    \`;
    
    data.services.forEach((service, idx) => {
      const tHospSvc = target.services[service];
      const svcData = data.regional.services[service];
      const tSvcTotal = tHospSvc ? tHospSvc.total : [0,0,0];
      
      const tKasus = tSvcTotal[CASES] || 0;
      const existingIna = tSvcTotal[INA] || 0;
      
      const targetCompetency = tHospSvc ? (tHospSvc.competency || 0) : 0;
      const rules = getLevelRules(targetCompetency);
      
      const baseTambahan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
      const basePengurangan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
      
      rules.tambah.forEach(lvl => {
        const rM = svcData ? severityMetric(svcData, lvl) : [0,0,0];
        const tM = tHospSvc ? severityMetric(tHospSvc, lvl) : [0,0,0];
        baseTambahan[lvl][0] = Math.max(0, (rM[CASES]||0) - (tM[CASES]||0));
        baseTambahan[lvl][1] = Math.max(0, (rM[IDRG]||0) - (tM[IDRG]||0));
      });
      rules.kurang.forEach(lvl => {
        const tM = tHospSvc ? severityMetric(tHospSvc, lvl) : [0,0,0];
        basePengurangan[lvl][0] = tM[CASES]||0;
        basePengurangan[lvl][1] = tM[INA]||0;
      });
      
      let scenarios = state.serviceScenarios[service] || [];
      if (!scenarios || scenarios.length === 0) {
        scenarios = Array(6).fill().map((_, i) => {
          let scn = {};
          rules.tambah.forEach(lvl => {
            let lvlComp = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= lvl).length;
            let base = lvlComp > 0 ? Math.min(50, 100 / (lvlComp + 1)) : 50;
            scn["tambah_" + lvl] = parseFloat(Math.min(100, Math.max(0, base + i * 10)).toFixed(1));
          });
          rules.kurang.forEach(lvl => {
            scn["kurang_" + lvl] = (lvl > targetCompetency || lvl === 4) ? 100 : 90;
          });
          return scn;
        });
      }
      
      const allDampak = { 4: {k:[],rp:[]}, 3: {k:[],rp:[]}, 2: {k:[],rp:[]}, 1: {k:[],rp:[]} };
      const allNetK = [], allNetRp = [];
      
      scenarios.forEach(scn => {
        let totalNetK = 0, totalNetRp = 0;
        [4,3,2,1].forEach(lvl => {
          let k = 0, rp = 0;
          if (rules.tambah.includes(lvl) && scn.hasOwnProperty("tambah_" + lvl)) {
            const pp = scn["tambah_" + lvl] / 100;
            k = baseTambahan[lvl][0] * pp;
            rp = baseTambahan[lvl][1] * pp;
          } else if (rules.kurang.includes(lvl) && scn.hasOwnProperty("kurang_" + lvl)) {
            const pk = scn["kurang_" + lvl] / 100;
            k = -(basePengurangan[lvl][0] * pk);
            rp = -(basePengurangan[lvl][1] * pk);
          }
          allDampak[lvl].k.push(k);
          allDampak[lvl].rp.push(rp);
          totalNetK += k;
          totalNetRp += rp;
        });
        allNetK.push(totalNetK);
        allNetRp.push(totalNetRp);
      });
      
      const formatCell = (minVal, maxVal, isRp) => {
        if (minVal === 0 && maxVal === 0) return "<span style=\"color:#cbd5e1;\">-</span>";
        const isMinPos = minVal > 0;
        const isMaxPos = maxVal > 0;
        const color = (isMinPos || isMaxPos) ? "#15803d" : "#b91c1c";
        const signMin = minVal > 0 ? "+" : (minVal < 0 ? "" : "");
        const signMax = maxVal > 0 ? "+" : (maxVal < 0 ? "" : "");
        
        let textMin = isRp ? formatMoney(Math.abs(minVal)).replace("Rp", "").trim() : formatNumber(Math.abs(minVal));
        let textMax = isRp ? formatMoney(Math.abs(maxVal)).replace("Rp", "").trim() : formatNumber(Math.abs(maxVal));
        
        if (isRp) {
          textMin = (Math.abs(minVal)/1000000000).toFixed(1) + " M";
          textMax = (Math.abs(maxVal)/1000000000).toFixed(1) + " M";
        }
        
        if (minVal === maxVal) {
          return \`<span style="color:${color}; font-weight:600;">${signMin} ${textMin}</span>\`;
        } else {
          return \`<span style="color:${color}; font-weight:600;">${signMin} ${textMin} <span style="color:#94a3b8; font-weight:normal; font-size:9px;">s.d</span> ${signMax} ${textMax}</span>\`;
        }
      };
      
      let htmlDampak = "";
      [4,3,2,1].forEach(lvl => {
        const minK = Math.min(...allDampak[lvl].k);
        const maxK = Math.max(...allDampak[lvl].k);
        const minRp = Math.min(...allDampak[lvl].rp);
        const maxRp = Math.max(...allDampak[lvl].rp);
        
        if (minK === 0 && maxK === 0) {
          htmlDampak += \`<td style="background:#f8fafc; text-align:center;">-</td>\`;
        } else {
          htmlDampak += \`<td style="white-space:nowrap;">
            <div style="margin-bottom:4px;">${formatCell(minK, maxK, false)}</div>
            <div>${formatCell(minRp, maxRp, true)}</div>
          </td>\`;
        }
      });
      
      const minNetK = Math.min(...allNetK);
      const maxNetK = Math.max(...allNetK);
      const minNetRp = Math.min(...allNetRp);
      const maxNetRp = Math.max(...allNetRp);
      
      const minPctK = tKasus ? minNetK / tKasus : 0;
      const maxPctK = tKasus ? maxNetK / tKasus : 0;
      const minPctRp = existingIna ? minNetRp / existingIna : 0;
      const maxPctRp = existingIna ? maxNetRp / existingIna : 0;
      
      html += \`
        <tr>
          <td style="color: #94a3b8; font-size: 11px;">${idx + 1}</td>
          <td style="text-align: left; font-weight: 600; font-size: 11px; white-space:nowrap;">${escapeHtml(formatService(service))}</td>
          <td style="font-size: 11px;">${levelBadge(targetCompetency)}</td>
          ${htmlDampak}
          <td style="background:#f0f9ff; white-space:nowrap;">${formatCell(minNetK, maxNetK, false)}</td>
          <td style="background:#f0f9ff; white-space:nowrap;">
            ${minPctK === maxPctK 
                ? \`<span style="color:${minPctK > 0 ? "#15803d" : (minPctK < 0 ? "#b91c1c" : "#334155")}; font-weight:600;">${formatSignedPercent(minPctK)}</span>\`
                : \`<span style="color:${minPctK > 0 ? "#15803d" : "#b91c1c"}; font-weight:600;">${formatSignedPercent(minPctK)}</span> <span style="color:#94a3b8; font-size:9px;">s.d</span> <span style="color:${maxPctK > 0 ? "#15803d" : "#b91c1c"}; font-weight:600;">${formatSignedPercent(maxPctK)}</span>\`
             }
          </td>
          <td style="background:#f0f9ff; white-space:nowrap;">${formatCell(minNetRp, maxNetRp, true)}</td>
          <td style="background:#fbfccb; color:#854d0e; font-weight:600; white-space:nowrap;">${(existingIna/1000000000).toFixed(1)} M</td>
          <td style="background:#eff6ff; white-space:nowrap;">
            ${minPctRp === maxPctRp 
                ? \`<span style="color:${minPctRp > 0 ? "#15803d" : (minPctRp < 0 ? "#b91c1c" : "#334155")}; font-weight:600;">${formatSignedPercent(minPctRp)}</span>\`
                : \`<span style="color:${minPctRp > 0 ? "#15803d" : "#b91c1c"}; font-weight:600;">${formatSignedPercent(minPctRp)}</span> <span style="color:#94a3b8; font-size:9px;">s.d</span> <span style="color:${maxPctRp > 0 ? "#15803d" : "#b91c1c"}; font-weight:600;">${formatSignedPercent(maxPctRp)}</span>\`
             }
          </td>
        </tr>
      \`;
    });
    
    html += \`
          </tbody>
        </table>
      </div>
      <div style="margin-top: 10px; font-size: 11px; color: #4e5d59; font-style: italic; line-height: 1.5; background: #f4f8f7; padding: 6px 10px; border-radius: 6px; border: 1px solid #d9e5e2;">
        <div>* Warna <strong>Hijau</strong> menandakan potensi penambahan (capture) dari RS kompetitor; warna <strong>Merah</strong> menandakan potensi kehilangan (loss) karena kasus dikembalikan.</div>
        <div>* % Kenaikan thd INA-CBG dihitung dari (Proyeksi Tambahan iDRG - Pengurangan INA-CBG) / Eksisting INA-CBG.</div>
      </div>
    \`;
    
    document.getElementById("recapSlide").innerHTML = html;
  }`.split('\n');

    lines.splice(start, end - start + 1, ...newLines);
    fs.writeFileSync('js/app.js', lines.join('\n'), 'utf8');
} else {
    console.log('Could not find bounds!');
}
