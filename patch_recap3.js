const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');

const target1 = `      let allNetK = [];
      let allNetRp = [];
      
      scenarios.forEach(scn => {
        let scnNetK = 0;
        let scnNetRp = 0;
        
        rules.tambah.forEach(lvl => {
          if (scn.hasOwnProperty('tambah_' + lvl)) {
            let pct = scn['tambah_' + lvl] / 100;
            scnNetK += baseTambahan[lvl][0] * pct;
            scnNetRp += baseTambahan[lvl][1] * pct;
          }
        });
        
        rules.kurang.forEach(lvl => {
          if (scn.hasOwnProperty('kurang_' + lvl)) {
            let pct = scn['kurang_' + lvl] / 100;
            scnNetK -= basePengurangan[lvl][0] * pct;
            scnNetRp -= basePengurangan[lvl][1] * pct;
          }
        });
        
        allNetK.push(scnNetK);
        allNetRp.push(scnNetRp);
      });
      
      const minNetK = Math.min(...allNetK);
      const maxNetK = Math.max(...allNetK);
      const minNetRp = Math.min(...allNetRp);
      const maxNetRp = Math.max(...allNetRp);
      
      const minKenaikanPct = existingIna ? (minNetRp / existingIna) : 0;
      const maxKenaikanPct = existingIna ? (maxNetRp / existingIna) : 0;
      
      let targetStringHTML = '';`;

const repl1 = `      let allTambahK = [];
      let allTambahRp = [];
      let allKurangK = [];
      let allKurangRp = [];
      let allNetK = [];
      let allNetRp = [];
      let allPascaRbkp = [];
      
      scenarios.forEach(scn => {
        let tk = 0, trp = 0;
        let kk = 0, krp = 0;
        
        rules.tambah.forEach(lvl => {
          if (scn.hasOwnProperty('tambah_' + lvl)) {
            let pct = scn['tambah_' + lvl] / 100;
            tk += baseTambahan[lvl][0] * pct;
            trp += baseTambahan[lvl][1] * pct;
          }
        });
        
        rules.kurang.forEach(lvl => {
          if (scn.hasOwnProperty('kurang_' + lvl)) {
            let pct = scn['kurang_' + lvl] / 100;
            kk += basePengurangan[lvl][0] * pct;
            krp += basePengurangan[lvl][1] * pct;
          }
        });
        
        allTambahK.push(tk);
        allTambahRp.push(trp);
        allKurangK.push(kk);
        allKurangRp.push(krp);
        allNetK.push(tk - kk);
        allNetRp.push(trp - krp);
        allPascaRbkp.push((existingIna - krp) + (trp - krp));
      });
      
      const minTK = Math.min(...allTambahK), maxTK = Math.max(...allTambahK);
      const minTRp = Math.min(...allTambahRp), maxTRp = Math.max(...allTambahRp);
      const minKK = Math.min(...allKurangK), maxKK = Math.max(...allKurangK);
      const minKRp = Math.min(...allKurangRp), maxKRp = Math.max(...allKurangRp);
      const minNetK = Math.min(...allNetK), maxNetK = Math.max(...allNetK);
      const minNetRp = Math.min(...allNetRp), maxNetRp = Math.max(...allNetRp);
      const minPasca = Math.min(...allPascaRbkp), maxPasca = Math.max(...allPascaRbkp);
      
      const minKenaikanPct = existingIna ? ((minPasca - existingIna) / existingIna) : 0;
      const maxKenaikanPct = existingIna ? ((maxPasca - existingIna) / existingIna) : 0;
      
      let targetStringHTML = '';`;

content = content.replace(target1, repl1);

const target2 = `      tableDataRows.push({
        service: service,
        competency: levelNames[targetCompetency],
        baseIna: existingIna,
        targetString: targetStringHTML,
        minNetK: minNetK,
        maxNetK: maxNetK,
        minNetRp: minNetRp,
        maxNetRp: maxNetRp,
        minKenaikanPct: minKenaikanPct,
        maxKenaikanPct: maxKenaikanPct,
        utamaCompetitors: utamaCompetitors
      });`;

const repl2 = `      tableDataRows.push({
        service: service,
        competency: levelNames[targetCompetency],
        baseIna: existingIna,
        targetString: targetStringHTML,
        minTK, maxTK,
        minTRp, maxTRp,
        minKK, maxKK,
        minKRp, maxKRp,
        minNetK, maxNetK,
        minNetRp, maxNetRp,
        minPasca, maxPasca,
        minKenaikanPct, maxKenaikanPct,
        utamaCompetitors: utamaCompetitors
      });`;
content = content.replace(target2, repl2);

const target3 = `        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="text-align: center; vertical-align: middle; font-weight: bold; color: #475569;">\${idx + 1}</td>
          <td style="text-align: left; vertical-align: top; padding: 10px;">
            <div style="font-weight: 600; color: #1e293b; font-size: 14px;">\${formatService(r.service)}</div>
            <div style="font-size: 12px; color: #3b82f6; margin-top: 2px; font-weight: 500;">(\${r.competency})</div>
          </td>
          <td style="vertical-align: middle; text-align: center; font-weight: 500; color: #1e293b;">\${formatMatrixMoney(r.baseIna)}</td>
          <td style="text-align: left; vertical-align: top; padding: 10px; font-size: 12px; line-height: 1.4; color: #334155;">
            \${r.targetString}
          </td>
          <td style="vertical-align: middle; text-align: center; color: #047857; background-color: #f0fdf4;">
            \${formatSignedNumber(r.minNetK)} &rarr; \${formatSignedNumber(r.maxNetK)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: #047857; font-weight: 600; background-color: #dcfce7;">
            \${formatMatrixMoney(r.minNetRp)} &rarr; \${formatMatrixMoney(r.maxNetRp)}
          </td>
          <td style="vertical-align: middle; text-align: center; font-weight: 600; background-color: #f8fafc;">
            <span style="color: \${r.minKenaikanPct < 0 ? '#dc2626' : '#16a34a'}">\${r.minKenaikanPct > 0 ? '+' : ''}\${formatPercent(r.minKenaikanPct)}</span> &rarr;
            <span style="color: \${r.maxKenaikanPct < 0 ? '#dc2626' : '#16a34a'}">\${r.maxKenaikanPct > 0 ? '+' : ''}\${formatPercent(r.maxKenaikanPct)}</span>
          </td>
          <td style="vertical-align: middle; text-align: center; padding: 10px; border-left: 1px dashed #cbd5e1;">
            <div style="font-weight: 700; font-size: 13px; color: \${idx < 3 ? '#d97706' : '#475569'};">\${priorityText}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">(\${r.utamaCompetitors} kompetitor Utama)</div>
          </td>
        </tr>`;

const repl3 = `        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="text-align: center; vertical-align: middle; font-weight: bold; color: #475569; padding: 8px 4px;">\${idx + 1}</td>
          <td style="text-align: left; vertical-align: top; padding: 8px;">
            <div style="font-weight: 600; color: #1e293b;">\${formatService(r.service)}</div>
            <div style="font-size: 10px; color: #3b82f6; margin-top: 2px; font-weight: 500;">(\${r.competency})</div>
          </td>
          <td style="text-align: left; vertical-align: top; padding: 8px; font-size: 10px; line-height: 1.4; color: #334155;">
            \${r.targetString}
          </td>
          <td style="vertical-align: middle; text-align: center; color: #047857; background-color: #f0fdf4;">
            +\${formatNumber(r.minTK)} &rarr; +\${formatNumber(r.maxTK)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: #047857; font-weight: 600; background-color: #dcfce7;">
            +\${formatMatrixMoney(r.minTRp)} &rarr; +\${formatMatrixMoney(r.maxTRp)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: #b91c1c; background-color: #fef2f2;">
            -\${formatNumber(r.minKK)} &rarr; -\${formatNumber(r.maxKK)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: #b91c1c; font-weight: 600; background-color: #fee2e2;">
            -\${formatMatrixMoney(r.minKRp)} &rarr; -\${formatMatrixMoney(r.maxKRp)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: \${r.minNetK < 0 ? '#b91c1c' : '#047857'}; background-color: #f0f9ff;">
            \${formatSignedNumber(r.minNetK)} &rarr; \${formatSignedNumber(r.maxNetK)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: \${r.minNetRp < 0 ? '#b91c1c' : '#047857'}; font-weight: 600; background-color: #e0f2fe;">
            \${r.minNetRp > 0 ? '+' : ''}\${formatMatrixMoney(r.minNetRp)} &rarr; \${r.maxNetRp > 0 ? '+' : ''}\${formatMatrixMoney(r.maxNetRp)}
          </td>
          <td style="vertical-align: middle; text-align: center; font-weight: 600; color: #1e293b;">\${formatMatrixMoney(r.baseIna)}</td>
          <td style="vertical-align: middle; text-align: center; font-weight: 700; color: #0f766e;">\${formatMatrixMoney(r.minPasca)} &rarr; \${formatMatrixMoney(r.maxPasca)}</td>
          <td style="vertical-align: middle; text-align: center; font-weight: 600; background-color: #f8fafc;">
            <span style="color: \${r.minKenaikanPct < 0 ? '#dc2626' : '#16a34a'}">\${r.minKenaikanPct > 0 ? '+' : ''}\${formatPercent(r.minKenaikanPct)}</span> &rarr;
            <span style="color: \${r.maxKenaikanPct < 0 ? '#dc2626' : '#16a34a'}">\${r.maxKenaikanPct > 0 ? '+' : ''}\${formatPercent(r.maxKenaikanPct)}</span>
          </td>
          <td style="vertical-align: middle; text-align: center; padding: 8px; border-left: 1px dashed #cbd5e1;">
            <div style="font-weight: 700; font-size: 11px; color: \${idx < 3 ? '#d97706' : '#475569'};">\${priorityText}</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 4px;">(\${r.utamaCompetitors} kompetitor Utama)</div>
          </td>
        </tr>`;
content = content.replace(target3, repl3);

const target4 = `            <tr>
              <th style="width: 40px; text-align: center; background-color: #1e293b; color: white; padding: 12px 8px;">No</th>
              <th style="width: 220px; text-align: left; background-color: #0f766e; color: white; padding: 12px;">Layanan (Kompetensi)</th>
              <th style="width: 120px; text-align: center; background-color: #334155; color: white; padding: 12px;">Base INA-CBG<br>(Rp M)</th>
              <th style="width: 200px; text-align: left; background-color: #475569; color: white; padding: 12px;">Persentase Target Skenario<br>(Konservatif &rarr; Agresif)</th>
              <th style="width: 150px; text-align: center; background-color: #16a34a; color: white; padding: 12px;">Proyeksi Tambahan Kasus<br>(Low &rarr; High)</th>
              <th style="width: 170px; text-align: center; background-color: #15803d; color: white; padding: 12px;">Proyeksi Tambahan Pendapatan<br>(Rp M)</th>
              <th style="width: 130px; text-align: center; background-color: #0369a1; color: white; padding: 12px;">% Kenaikan Rp</th>
              <th style="width: 150px; text-align: center; background-color: #ea580c; color: white; padding: 12px;">Prioritas Strategis</th>
            </tr>`;

const repl4 = `            <tr>
              <th rowspan="2" style="width: 30px; text-align: center; background-color: #1e293b; color: white; padding: 6px 4px; font-size: 11px;">No</th>
              <th rowspan="2" style="width: 140px; text-align: left; background-color: #0f766e; color: white; padding: 6px; font-size: 11px;">Layanan (Kompetensi)</th>
              <th rowspan="2" style="width: 110px; text-align: left; background-color: #475569; color: white; padding: 6px; font-size: 11px;">Rentang Skenario</th>
              <th colspan="2" style="background-color: #22c55e; color: white; padding: 6px; font-size: 10px; text-align: center; border: 1px solid white;">PROYEKSI TAMBAHAN (Low &rarr; High)</th>
              <th colspan="2" style="background-color: #dc2626; color: white; padding: 6px; font-size: 10px; text-align: center; border: 1px solid white;">PROYEKSI PENGURANGAN (Low &rarr; High)</th>
              <th colspan="2" style="background-color: #0ea5e9; color: white; padding: 6px; font-size: 10px; text-align: center; border: 1px solid white;">NET +/- (Low &rarr; High)</th>
              <th rowspan="2" style="width: 80px; text-align: center; background-color: #16a085; color: white; padding: 6px; font-size: 10px; border: 1px solid white;">PENDAPATAN<br>EKSISTING INA<br>CBG (Rp M)</th>
              <th rowspan="2" style="width: 90px; text-align: center; background-color: #16a085; color: white; padding: 6px; font-size: 10px; border: 1px solid white;">PENDAPATAN<br>PASCA RBKP<br>(Low &rarr; High)</th>
              <th rowspan="2" style="width: 80px; text-align: center; background-color: #16a085; color: white; padding: 6px; font-size: 10px; border: 1px solid white;">% KENAIKAN<br>PENDAPATAN</th>
              <th rowspan="2" style="width: 80px; text-align: center; background-color: #ea580c; color: white; padding: 6px; font-size: 11px;">Prioritas Strategis</th>
            </tr>
            <tr>
              <th style="background-color: #4ade80; color: white; padding: 6px; font-size: 10px; text-align: center; border: 1px solid white; width: 70px;">Kasus</th>
              <th style="background-color: #4ade80; color: white; padding: 6px; font-size: 10px; text-align: center; border: 1px solid white; width: 80px;">Rp M</th>
              <th style="background-color: #f87171; color: white; padding: 6px; font-size: 10px; text-align: center; border: 1px solid white; width: 70px;">Kasus</th>
              <th style="background-color: #f87171; color: white; padding: 6px; font-size: 10px; text-align: center; border: 1px solid white; width: 80px;">Rp M</th>
              <th style="background-color: #38bdf8; color: white; padding: 6px; font-size: 10px; text-align: center; border: 1px solid white; width: 70px;">Kasus</th>
              <th style="background-color: #38bdf8; color: white; padding: 6px; font-size: 10px; text-align: center; border: 1px solid white; width: 80px;">Rp M</th>
            </tr>`;
content = content.replace(target4, repl4);

fs.writeFileSync('js/app.js', content);
