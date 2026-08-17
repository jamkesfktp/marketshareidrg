const fs = require('fs');

let content = fs.readFileSync('js/app.js', 'utf8');

// 1. Update state init in renderDynamicServiceSlides
const old_init = `// Hitung Persentase Default
      if (!state.serviceScenarios[service]) {
        const c = competitors > 0 ? competitors : 1;
        let base = (100 / c) + (competitors > 0 ? 5 : 0);
        state.serviceScenarios[service] = Array(6).fill().map((_, i) => {
          let val = base - (i * 5);
          if (val < 0) val = 0;
          return { tambah: parseFloat(val.toFixed(1)), kurang: parseFloat(val.toFixed(1)) };
        });
      }`;

const new_init = `// Hitung Persentase Default
      if (!state.serviceScenarios[service]) {
        const competitorCounts = { 1:0, 2:0, 3:0, 4:0 };
        competitorsList.forEach(h => competitorCounts[getCompetency(h, service)]++);
        
        state.serviceScenarios[service] = Array(6).fill().map((_, i) => {
          let scn = {};
          [1, 2, 3, 4].forEach(lvl => {
            if (competitorCounts[lvl] > 0) {
              let base = (100 / competitorCounts[lvl]) + 5;
              let val = base - (i * 5);
              scn['tambah_' + lvl] = parseFloat(Math.max(0, val).toFixed(1));
            }
          });
          
          let c = competitors > 0 ? competitors : 1;
          let baseKurang = (100 / c) + (competitors > 0 ? 5 : 0);
          let valKurang = parseFloat(Math.max(0, baseKurang - (i * 5)).toFixed(1));
          
          [1, 2, 3, 4].forEach(lvl => {
            if (lvl < targetCompetency) {
              const targetSvc = target.services[service];
              if (targetSvc && severityMetric(targetSvc, lvl)[CASES] > 0) {
                scn['kurang_' + lvl] = valKurang;
              }
            }
          });
          
          return scn;
        });
      }`;
content = content.replace(old_init, new_init);


// 2. Update logic inside renderDynamicServiceSlides
const old_dyn_table = `const targetSvc = target.services[service];
      const targetKasusArr = targetSvc ? targetSvc.total : [0,0,0];
      const existingKasus = targetKasusArr[CASES] || 0;
      const existingIna = targetKasusArr[INA] || 0;
      
      // Tambahan hanya diambil dari Pesaing (RS dengan kompetensi >= Target)
      let compKasus = 0;
      let compIdrg = 0;
      competitorsList.forEach(h => {
        const hSvc = h.services?.[service];
        if (hSvc) {
          compKasus += hSvc.total[CASES] || 0;
          compIdrg += hSvc.total[IDRG] || 0;
        }
      });
      const baseTambahanKasus = compKasus;
      const baseTambahanPendapatan = compIdrg;
      
      // Pengurangan hanya dari Kasus Dasar & Madya RS Target
      const targetDasar = severityMetric(targetSvc, 1);
      const targetMadya = severityMetric(targetSvc, 2);
      const basePenguranganKasus = targetDasar[CASES] + targetMadya[CASES];
      const basePenguranganPendapatan = targetDasar[INA] + targetMadya[INA];
      
      
      const generateRow = (index, scn) => {
        const pTambah = scn.tambah / 100;
        const pKurang = scn.kurang / 100;
        const tambahKasus = baseTambahanKasus * pTambah;
        const tambahRp = baseTambahanPendapatan * pTambah;
        const kurangKasus = basePenguranganKasus * pKurang;
        const kurangRp = basePenguranganPendapatan * pKurang;
        
        const netKasus = tambahKasus - kurangKasus;
        const pctNetKasus = existingKasus ? (netKasus - existingKasus) / existingKasus : 0;
        
        const netRp = tambahRp - kurangRp;
        const pctKenaikan = existingIna ? (netRp - existingIna) / existingIna : 0;

        return \`<tr>
          <td style="font-weight: 700; text-align: left; padding-left: 10px; background-color: #f8f9fa;">Skenario \${index + 1}</td>
          <td class="b-left-green b-top-green b-bottom-green"><input type="number" class="scenario-input dynamic-scenario-input" data-service="\${escapeHtml(service)}" data-index="\${index}" data-field="tambah" value="\${scn.tambah}" step="0.1"></td>
          <td class="b-top-green b-bottom-green">\${formatNumber(tambahKasus)}</td>
          <td class="b-right-green b-top-green b-bottom-green">\${formatMatrixMoney(tambahRp)}</td>
          <td class="b-left-red b-top-red b-bottom-red"><input type="number" class="scenario-input dynamic-scenario-input" data-service="\${escapeHtml(service)}" data-index="\${index}" data-field="kurang" value="\${scn.kurang}" step="0.1"></td>
          <td class="b-top-red b-bottom-red">\${formatNumber(kurangKasus)}</td>
          <td class="b-right-red b-top-red b-bottom-red">\${formatMatrixMoney(kurangRp)}</td>
          <td>\${formatSignedNumber(netKasus)}</td>
          <td>\${formatPercent(pctNetKasus)}</td>
          <td>\${netRp > 0 ? '+' : ''}\${formatMatrixMoney(netRp)}</td>
          <td class="b-left-yellow b-top-yellow b-bottom-yellow">\${formatMatrixMoney(existingIna)}</td>
          <td class="b-right-yellow b-top-yellow b-bottom-yellow" style="background:#fffcf0;"><strong>\${formatPercent(pctKenaikan)}</strong></td>
        </tr>\`;
      };`;

const new_dyn_table = `const targetSvc = target.services[service];
      const targetKasusArr = targetSvc ? targetSvc.total : [0,0,0];
      const existingKasus = targetKasusArr[CASES] || 0;
      const existingIna = targetKasusArr[INA] || 0;
      
      const baseTambahan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
      competitorsList.forEach(h => {
        const hSvc = h.services?.[service];
        const hLvl = getCompetency(h, service);
        if (hSvc) {
          baseTambahan[hLvl][0] += hSvc.total[CASES] || 0;
          baseTambahan[hLvl][1] += hSvc.total[IDRG] || 0;
        }
      });
      
      const basePengurangan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
      [1, 2, 3, 4].forEach(lvl => {
        if (lvl < targetCompetency) {
          const targetLvl = severityMetric(targetSvc, lvl);
          basePengurangan[lvl][0] = targetLvl[CASES] || 0;
          basePengurangan[lvl][1] = targetLvl[INA] || 0;
        }
      });
      
      const generateRow = (index, scn) => {
        let totalTambahKasus = 0;
        let totalTambahRp = 0;
        let totalKurangKasus = 0;
        let totalKurangRp = 0;
        
        let tambahCols = '';
        [1, 2, 3, 4].forEach(lvl => {
          if (scn.hasOwnProperty('tambah_' + lvl)) {
            const pTambah = scn['tambah_' + lvl] / 100;
            const tk = baseTambahan[lvl][0] * pTambah;
            const trp = baseTambahan[lvl][1] * pTambah;
            totalTambahKasus += tk;
            totalTambahRp += trp;
            tambahCols += \`
              <td class="b-left-green b-top-green b-bottom-green"><input type="number" class="scenario-input dynamic-scenario-input" data-service="\${escapeHtml(service)}" data-index="\${index}" data-field="tambah_\${lvl}" value="\${scn['tambah_' + lvl]}" step="0.1" style="width: 60px;"></td>
              <td class="b-top-green b-bottom-green">\${formatNumber(tk)}</td>
              <td class="b-right-green b-top-green b-bottom-green">\${formatMatrixMoney(trp)}</td>
            \`;
          }
        });
        
        let kurangCols = '';
        [1, 2, 3, 4].forEach(lvl => {
          if (scn.hasOwnProperty('kurang_' + lvl)) {
            const pKurang = scn['kurang_' + lvl] / 100;
            const kk = basePengurangan[lvl][0] * pKurang;
            const krp = basePengurangan[lvl][1] * pKurang;
            totalKurangKasus += kk;
            totalKurangRp += krp;
            kurangCols += \`
              <td class="b-left-red b-top-red b-bottom-red"><input type="number" class="scenario-input dynamic-scenario-input" data-service="\${escapeHtml(service)}" data-index="\${index}" data-field="kurang_\${lvl}" value="\${scn['kurang_' + lvl]}" step="0.1" style="width: 60px;"></td>
              <td class="b-top-red b-bottom-red">\${formatNumber(kk)}</td>
              <td class="b-right-red b-top-red b-bottom-red">\${formatMatrixMoney(krp)}</td>
            \`;
          }
        });
        
        const netKasus = totalTambahKasus - totalKurangKasus;
        const pctNetKasus = existingKasus ? (netKasus - existingKasus) / existingKasus : 0;
        
        const netRp = totalTambahRp - totalKurangRp;
        const pctKenaikan = existingIna ? (netRp - existingIna) / existingIna : 0;

        return \`<tr>
          <td style="font-weight: 700; text-align: left; padding-left: 10px; background-color: #f8f9fa;">Skenario \${index + 1}</td>
          \${tambahCols}
          \${kurangCols}
          <td>\${formatSignedNumber(netKasus)}</td>
          <td>\${formatPercent(pctNetKasus)}</td>
          <td>\${netRp > 0 ? '+' : ''}\${formatMatrixMoney(netRp)}</td>
          <td class="b-left-yellow b-top-yellow b-bottom-yellow">\${formatMatrixMoney(existingIna)}</td>
          <td class="b-right-yellow b-top-yellow b-bottom-yellow" style="background:#fffcf0;"><strong>\${formatPercent(pctKenaikan)}</strong></td>
        </tr>\`;
      };`;
content = content.replace(old_dyn_table, new_dyn_table);


// 3. Update HTML table in renderDynamicServiceSlides
const old_dyn_html = `<table class="scenario-table">
              <thead>
                <tr>
                  <th rowspan="2">Skenario</th>
                  <th colspan="3">Tambahan Kasus<br>Utama & Paripurna</th>
                  <th colspan="3">Pengurangan Kasus<br>Dasar & Madya</th>
                  <th colspan="3">Net +/- Pasca iDRG & RBKP</th>
                  <th rowspan="2">Pendapatan<br>Eksisting INA<br>CBG (Rp M)</th>
                  <th rowspan="2">% Kenaikan<br>thd INA-CBG<br>Eksisting</th>
                </tr>
                <tr>
                  <th>Persentase<br>(%)</th>
                  <th>Jumlah<br>Kasus</th>
                  <th>Tambahan<br>Pendapatan<br>(Rp M)</th>
                  <th>Persentase<br>(%)</th>
                  <th>Jumlah<br>Kasus</th>
                  <th>Pengurangan<br>Pendapatan<br>(Rp M)</th>
                  <th>+/-<br>Jumlah<br>Kasus</th>
                  <th>% thd total<br>kasus<br>eksisting</th>
                  <th>+/-<br>Pendapatan<br>(Rp M)</th>
                </tr>
              </thead>
              <tbody>
                \${state.serviceScenarios[service].map((scn, i) => generateRow(i, scn)).join("")}
              </tbody>
            </table>`;

const new_dyn_html = `\${(() => {
              let tHead1 = '';
              let tHead2 = '';
              [1, 2, 3, 4].forEach(lvl => {
                if (state.serviceScenarios[service][0].hasOwnProperty('tambah_' + lvl)) {
                  tHead1 += \`<th colspan="3" class="b-top-green b-left-green b-right-green" style="background-color: #e8f5e9;">Tambahan Kasus<br>\${levelNames[lvl]}</th>\`;
                  tHead2 += \`<th>Persentase<br>(%)</th><th>Jumlah<br>Kasus</th><th>Tambahan<br>Pendapatan<br>(Rp M)</th>\`;
                }
              });
              [1, 2, 3, 4].forEach(lvl => {
                if (state.serviceScenarios[service][0].hasOwnProperty('kurang_' + lvl)) {
                  tHead1 += \`<th colspan="3" class="b-top-red b-left-red b-right-red" style="background-color: #ffebee;">Pengurangan Kasus<br>\${levelNames[lvl]}</th>\`;
                  tHead2 += \`<th>Persentase<br>(%)</th><th>Jumlah<br>Kasus</th><th>Pengurangan<br>Pendapatan<br>(Rp M)</th>\`;
                }
              });
              
              return \`
                <div style="overflow-x: auto; width: 100%;">
                  <table class="scenario-table" style="table-layout: auto; min-width: 1000px;">
                    <thead>
                      <tr>
                        <th rowspan="2" style="background-color: #f8f9fa;">Skenario</th>
                        \${tHead1}
                        <th colspan="3">Net +/- Pasca iDRG & RBKP</th>
                        <th rowspan="2">Pendapatan<br>Eksisting INA<br>CBG (Rp M)</th>
                        <th rowspan="2">% Kenaikan<br>thd INA-CBG<br>Eksisting</th>
                      </tr>
                      <tr>
                        \${tHead2}
                        <th>+/-<br>Jumlah<br>Kasus</th>
                        <th>% thd total<br>kasus<br>eksisting</th>
                        <th>+/-<br>Pendapatan<br>(Rp M)</th>
                      </tr>
                    </thead>
                    <tbody>
                      \${state.serviceScenarios[service].map((scn, i) => generateRow(i, scn)).join("")}
                    </tbody>
                  </table>
                </div>
              \`;
            })()}`;
content = content.replace(old_dyn_html, new_dyn_html);

// 4. Update dynamic listener
const old_dyn_listen = `if (field === "tambah") {
          state.serviceScenarios[srv][idx].tambah = val;
        } else {
          state.serviceScenarios[srv][idx].kurang = val;
        }`;
const new_dyn_listen = `state.serviceScenarios[srv][idx][field] = val;`;
content = content.replace(old_dyn_listen, new_dyn_listen);


// 5. Update globalScenarios init
const old_g_init = `state.globalScenarios = Array(6).fill().map((_, i) => ({
      tambah: parseFloat((19.3 - (i * 5)).toFixed(1)),
      kurang: parseFloat((19.3 - (i * 5)).toFixed(1))
    }));`;
const new_g_init = `state.globalScenarios = Array(6).fill().map((_, i) => {
      let scn = {};
      [1, 2, 3, 4].forEach(lvl => scn['tambah_'+lvl] = parseFloat(Math.max(0, 19.3 - (i*5)).toFixed(1)));
      [1, 2, 3, 4].forEach(lvl => scn['kurang_'+lvl] = parseFloat(Math.max(0, 19.3 - (i*5)).toFixed(1)));
      return scn;
    });`;
content = content.replace(old_g_init, new_g_init);


// 6. Update logic inside renderScenarioSlide
const old_g_table = `const regionalUtama = severityMetric(data.regional, 3);
    const regionalParipurna = severityMetric(data.regional, 4);
    
    const targetUtama = sumMetrics(data.services.map(s => severityMetric(target.services?.[s], 3)));
    const targetParipurna = sumMetrics(data.services.map(s => severityMetric(target.services?.[s], 4)));
    
    const targetDasar = sumMetrics(data.services.map(s => severityMetric(target.services?.[s], 1)));
    const targetMadya = sumMetrics(data.services.map(s => severityMetric(target.services?.[s], 2)));

    const baseTambahanKasus = (regionalUtama[CASES] + regionalParipurna[CASES]) - (targetUtama[CASES] + targetParipurna[CASES]);
    const baseTambahanPendapatan = (regionalUtama[IDRG] + regionalParipurna[IDRG]) - (targetUtama[IDRG] + targetParipurna[IDRG]);

    const basePenguranganKasus = targetDasar[CASES] + targetMadya[CASES];
    const basePenguranganPendapatan = targetDasar[INA] + targetMadya[INA];

    const existingIna = target.total[INA];
    const existingKasus = target.total[CASES];

    const generateRow = (index, scn) => {
      const pTambah = scn.tambah / 100;
      const pKurang = scn.kurang / 100;
      const tambahKasus = baseTambahanKasus * pTambah;
      const tambahRp = baseTambahanPendapatan * pTambah;
      const kurangKasus = basePenguranganKasus * pKurang;
      const kurangRp = basePenguranganPendapatan * pKurang;
      
      const netKasus = tambahKasus - kurangKasus;
      const pctNetKasus = existingKasus ? (netKasus - existingKasus) / existingKasus : 0;
      
      const netRp = tambahRp - kurangRp;
      const pctKenaikan = existingIna ? (netRp - existingIna) / existingIna : 0;

      return \`<tr>
        <td style="font-weight: 700; text-align: left; padding-left: 10px; background-color: #f8f9fa;">Skenario \${index + 1}</td>
        <td class="b-left-green b-top-green b-bottom-green"><input type="number" class="scenario-input" data-index="\${index}" data-type="tambah" value="\${scn.tambah}"></td>
        <td class="b-top-green b-bottom-green">\${formatNumber(tambahKasus)}</td>
        <td class="b-right-green b-top-green b-bottom-green">\${formatMatrixMoney(tambahRp)}</td>
        <td class="b-left-red b-top-red b-bottom-red"><input type="number" class="scenario-input" data-index="\${index}" data-type="kurang" value="\${scn.kurang}"></td>
        <td class="b-top-red b-bottom-red">\${formatNumber(kurangKasus)}</td>
        <td class="b-right-red b-top-red b-bottom-red">\${formatMatrixMoney(kurangRp)}</td>
        <td>\${formatSignedNumber(netKasus)}</td>
        <td>\${formatPercent(pctNetKasus)}</td>
        <td>\${formatSignedMatrixMoney(netRp)}</td>
        <td class="b-left-yellow b-top-yellow b-bottom-yellow">\${formatMatrixMoney(existingIna)}</td>
        <td class="b-right-yellow b-top-yellow b-bottom-yellow" style="background:#fffcf0;"><strong>\${formatPercent(pctKenaikan)}</strong></td>
      </tr>\`;
    };`;

const new_g_table = `const existingIna = target.total[INA];
    const existingKasus = target.total[CASES];
    
    const globalTambahan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
    const globalPengurangan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
    
    data.services.forEach(service => {
      const targetCompetency = getCompetency(target, service);
      const competitorsList = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= targetCompetency);
      
      competitorsList.forEach(h => {
        const hLvl = getCompetency(h, service);
        const hSvc = h.services?.[service];
        if (hSvc) {
          globalTambahan[hLvl][0] += hSvc.total[CASES] || 0;
          globalTambahan[hLvl][1] += hSvc.total[IDRG] || 0;
        }
      });
      
      const targetSvc = target.services[service];
      if (targetSvc) {
        [1, 2, 3, 4].forEach(lvl => {
          if (lvl < targetCompetency) {
            const targetLvl = severityMetric(targetSvc, lvl);
            globalPengurangan[lvl][0] += targetLvl[CASES] || 0;
            globalPengurangan[lvl][1] += targetLvl[INA] || 0;
          }
        });
      }
    });

    const generateRow = (index, scn) => {
      let totalTambahKasus = 0;
      let totalTambahRp = 0;
      let totalKurangKasus = 0;
      let totalKurangRp = 0;
      
      let tambahCols = '';
      [1, 2, 3, 4].forEach(lvl => {
        if (globalTambahan[lvl][0] > 0) {
          const pTambah = (scn['tambah_' + lvl] || 0) / 100;
          const tk = globalTambahan[lvl][0] * pTambah;
          const trp = globalTambahan[lvl][1] * pTambah;
          totalTambahKasus += tk;
          totalTambahRp += trp;
          tambahCols += \`
            <td class="b-left-green b-top-green b-bottom-green"><input type="number" class="scenario-input" data-index="\${index}" data-type="tambah_\${lvl}" value="\${scn['tambah_' + lvl] !== undefined ? scn['tambah_' + lvl] : 0}" step="0.1" style="width: 60px;"></td>
            <td class="b-top-green b-bottom-green">\${formatNumber(tk)}</td>
            <td class="b-right-green b-top-green b-bottom-green">\${formatMatrixMoney(trp)}</td>
          \`;
        }
      });
      
      let kurangCols = '';
      [1, 2, 3, 4].forEach(lvl => {
        if (globalPengurangan[lvl][0] > 0) {
          const pKurang = (scn['kurang_' + lvl] || 0) / 100;
          const kk = globalPengurangan[lvl][0] * pKurang;
          const krp = globalPengurangan[lvl][1] * pKurang;
          totalKurangKasus += kk;
          totalKurangRp += krp;
          kurangCols += \`
            <td class="b-left-red b-top-red b-bottom-red"><input type="number" class="scenario-input" data-index="\${index}" data-type="kurang_\${lvl}" value="\${scn['kurang_' + lvl] !== undefined ? scn['kurang_' + lvl] : 0}" step="0.1" style="width: 60px;"></td>
            <td class="b-top-red b-bottom-red">\${formatNumber(kk)}</td>
            <td class="b-right-red b-top-red b-bottom-red">\${formatMatrixMoney(krp)}</td>
          \`;
        }
      });
      
      const netKasus = totalTambahKasus - totalKurangKasus;
      const pctNetKasus = existingKasus ? (netKasus - existingKasus) / existingKasus : 0;
      
      const netRp = totalTambahRp - totalKurangRp;
      const pctKenaikan = existingIna ? (netRp - existingIna) / existingIna : 0;

      return \`<tr>
        <td style="font-weight: 700; text-align: left; padding-left: 10px; background-color: #f8f9fa;">Skenario \${index + 1}</td>
        \${tambahCols}
        \${kurangCols}
        <td>\${formatSignedNumber(netKasus)}</td>
        <td>\${formatPercent(pctNetKasus)}</td>
        <td>\${formatSignedMatrixMoney(netRp)}</td>
        <td class="b-left-yellow b-top-yellow b-bottom-yellow">\${formatMatrixMoney(existingIna)}</td>
        <td class="b-right-yellow b-top-yellow b-bottom-yellow" style="background:#fffcf0;"><strong>\${formatPercent(pctKenaikan)}</strong></td>
      </tr>\`;
    };`;
content = content.replace(old_g_table, new_g_table);


// 7. Update HTML table in renderScenarioSlide
const old_g_html = `<table class="scenario-table">
        <thead>
          <tr>
            <th rowspan="2">Skenario</th>
            <th colspan="3">Tambahan Kasus<br>Utama & Paripurna</th>
            <th colspan="3">Pengurangan Kasus<br>Dasar & Madya</th>
            <th colspan="3">Net +/- Pasca iDRG & RBKP</th>
            <th rowspan="2">Pendapatan<br>Eksisting INA<br>CBG (Rp M)</th>
            <th rowspan="2">% Kenaikan<br>thd INA-CBG<br>Eksisting</th>
          </tr>
          <tr>
            <th>Persentase<br>(%)</th>
            <th>Jumlah<br>Kasus</th>
            <th>Tambahan<br>Pendapatan<br>(Rp M)</th>
            <th>Persentase<br>(%)</th>
            <th>Jumlah<br>Kasus</th>
            <th>Pengurangan<br>Pendapatan<br>(Rp M)</th>
            <th>+/-<br>Jumlah<br>Kasus</th>
            <th>% thd total<br>kasus<br>eksisting</th>
            <th>+/-<br>Pendapatan<br>(Rp M)</th>
          </tr>
        </thead>
        <tbody>
          \${state.globalScenarios.map((scn, i) => generateRow(i, scn)).join("")}
        </tbody>
      </table>`;

const new_g_html = `\${(() => {
        let tHead1 = '';
        let tHead2 = '';
        [1, 2, 3, 4].forEach(lvl => {
          if (globalTambahan[lvl][0] > 0) {
            tHead1 += \`<th colspan="3" class="b-top-green b-left-green b-right-green" style="background-color: #e8f5e9;">Tambahan Kasus<br>\${levelNames[lvl]}</th>\`;
            tHead2 += \`<th>Persentase<br>(%)</th><th>Jumlah<br>Kasus</th><th>Tambahan<br>Pendapatan<br>(Rp M)</th>\`;
          }
        });
        [1, 2, 3, 4].forEach(lvl => {
          if (globalPengurangan[lvl][0] > 0) {
            tHead1 += \`<th colspan="3" class="b-top-red b-left-red b-right-red" style="background-color: #ffebee;">Pengurangan Kasus<br>\${levelNames[lvl]}</th>\`;
            tHead2 += \`<th>Persentase<br>(%)</th><th>Jumlah<br>Kasus</th><th>Pengurangan<br>Pendapatan<br>(Rp M)</th>\`;
          }
        });
        
        return \`
          <div style="overflow-x: auto; width: 100%;">
            <table class="scenario-table" style="table-layout: auto; min-width: 1000px;">
              <thead>
                <tr>
                  <th rowspan="2" style="background-color: #f8f9fa;">Skenario</th>
                  \${tHead1}
                  <th colspan="3">Net +/- Pasca iDRG & RBKP</th>
                  <th rowspan="2">Pendapatan<br>Eksisting INA<br>CBG (Rp M)</th>
                  <th rowspan="2">% Kenaikan<br>thd INA-CBG<br>Eksisting</th>
                </tr>
                <tr>
                  \${tHead2}
                  <th>+/-<br>Jumlah<br>Kasus</th>
                  <th>% thd total<br>kasus<br>eksisting</th>
                  <th>+/-<br>Pendapatan<br>(Rp M)</th>
                </tr>
              </thead>
              <tbody>
                \${state.globalScenarios.map((scn, i) => generateRow(i, scn)).join("")}
              </tbody>
            </table>
          </div>
        \`;
      })()}`;
content = content.replace(old_g_html, new_g_html);

// 8. Update global listener
const old_g_listen = `if (type === "tambah") {
          state.globalScenarios[idx].tambah = val;
        } else {
          state.globalScenarios[idx].kurang = val;
        }`;
const new_g_listen = `state.globalScenarios[idx][type] = val;`;
content = content.replace(old_g_listen, new_g_listen);


fs.writeFileSync('js/app.js', content, 'utf8');
console.log('Successfully updated app.js using node script');
