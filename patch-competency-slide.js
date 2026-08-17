const fs = require('fs');

let appJs = fs.readFileSync('js/app.js', 'utf8');

const functionCode = `
  function renderCompetencySimSlide() {
    const container = document.getElementById('competencyTableSlide');
    if (!container) return;

    const data = window.marketSimulatorDatasets ? (window.marketSimulatorDatasets[activeDatasetKey] || window.marketSimulatorDatasets['okt_jun']) : window.marketSimulatorData;
    if (!data || !data.hospitals) return;

    const target = data.hospitals.find((h) => h.code === state.targetCode) || (data.hospitals.length ? data.hospitals[0] : null);
    if (!target) {
      container.innerHTML = '<div style="padding: 20px;">Target RS tidak ditemukan.</div>';
      return;
    }

    // Hitung Eksisting dan Potensi Lintas Kompetensi
    let targetTotalKasus = 0;
    let targetInaTotal = 0;
    let targetIdrgTotal = 0;
    
    let eksistingDM_Kasus = 0;
    let eksistingDM_Idrg = 0;
    let eksistingUP_Kasus = 0;
    let eksistingUP_Idrg = 0;

    let potensiMax_Kasus = 0;
    let potensiMax_Idrg = 0;

    data.services.forEach(service => {
      const targetSrv = target.services[service];
      if (!targetSrv) return;

      const tDasar = severityMetric(targetSrv, 1);
      const tMadya = severityMetric(targetSrv, 2);
      const tUtama = severityMetric(targetSrv, 3);
      const tParipurna = severityMetric(targetSrv, 4);

      eksistingDM_Kasus += (tDasar[CASES] || 0) + (tMadya[CASES] || 0);
      eksistingDM_Idrg += (tDasar[IDRG] || 0) + (tMadya[IDRG] || 0);
      
      eksistingUP_Kasus += (tUtama[CASES] || 0) + (tParipurna[CASES] || 0);
      eksistingUP_Idrg += (tUtama[IDRG] || 0) + (tParipurna[IDRG] || 0);

      // Hitung potensi lintas kompetensi
      data.hospitals.forEach(h => {
        if (h.code === target.code) return;
        const hCompetency = getCompetency(h, service);
        if (!hCompetency || hCompetency === 0) return;

        const hSrv = h.services[service];
        if (hSrv) {
          const hDasar = severityMetric(hSrv, 1);
          const hMadya = severityMetric(hSrv, 2);
          
          if (hCompetency !== 1) {
            potensiMax_Kasus += (hDasar[CASES] || 0);
            potensiMax_Idrg += (hDasar[IDRG] || 0);
          }
          if (hCompetency !== 2) {
            potensiMax_Kasus += (hMadya[CASES] || 0);
            potensiMax_Idrg += (hMadya[IDRG] || 0);
          }
        }
      });
    });

    targetTotalKasus = target.total[CASES] || 0;
    targetInaTotal = target.total[INA] || 0;
    targetIdrgTotal = target.total[IDRG] || 0;

    const html = \`
      <div style="font-family: Arial, sans-serif; padding-top: 10px;">
        
        <!-- Summary Cards -->
        <div style="display: flex; gap: 15px; margin-bottom: 24px;">
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; text-align: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Total Kasus:</div>
            <div style="color: #be185d; font-size: 28px; font-weight: 900;">\${formatNumber(targetTotalKasus)}</div>
            <div style="color: #94a3b8; font-size: 11px;">Jumlah kasus eklaim</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; text-align: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Pendapatan INA CBGs:</div>
            <div style="color: #c2410c; font-size: 28px; font-weight: 900;">\${formatMoneyUnit(targetInaTotal)}</div>
            <div style="color: #94a3b8; font-size: 11px;">Dari data 8 bulan</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; text-align: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Pendapatan iDRG:</div>
            <div style="color: #c2410c; font-size: 28px; font-weight: 900;">\${formatMoneyUnit(targetIdrgTotal)}</div>
            <div style="color: #94a3b8; font-size: 11px;">Klaim uji coba iDRG</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; text-align: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Potensi Penambahan Max:</div>
            <div style="color: #059669; font-size: 28px; font-weight: 900;">\${formatMoneyUnit(potensiMax_Idrg)}</div>
            <div style="color: #94a3b8; font-size: 11px;">Lintas Kompetensi Layanan</div>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #1e293b; text-align: center;">
          <thead style="background: #38bdf8; color: white;">
            <tr>
              <th rowspan="2" style="border: 1px solid #1e293b; padding: 10px; background: #0f766e;">Skenario</th>
              <th colspan="3" style="border: 1px solid #1e293b; padding: 10px; background: #059669;">Tambahan Kasus Dasar & Madya</th>
              <th colspan="3" style="border: 1px solid #1e293b; padding: 10px; background: #e11d48;">Pengurangan Kasus Utama & Paripurna</th>
              <th colspan="3" style="border: 1px solid #1e293b; padding: 10px; background: #0d9488;">Net +/- Pasca iDRG & RBKP</th>
              <th rowspan="2" style="border: 1px solid #1e293b; padding: 10px; background: #0f766e; max-width: 120px;">Pendapatan Eksisting iDRG Kasus Dasar & Madya (Rp. M)</th>
              <th rowspan="2" style="border: 1px solid #1e293b; padding: 10px; background: #059669;">Total Pendapatan Pasca iDRG & RBKP (Rp M)</th>
            </tr>
            <tr>
              <th style="border: 1px solid #1e293b; padding: 10px; background: #10b981;">Persentase (%)</th>
              <th style="border: 1px solid #1e293b; padding: 10px; background: #10b981;">Jumlah Kasus</th>
              <th style="border: 1px solid #1e293b; padding: 10px; background: #10b981;">Tambahan Pendapatan (Rp M)</th>
              <th style="border: 1px solid #1e293b; padding: 10px; background: #f43f5e;">Persentase (%)</th>
              <th style="border: 1px solid #1e293b; padding: 10px; background: #f43f5e;">Jumlah Kasus</th>
              <th style="border: 1px solid #1e293b; padding: 10px; background: #f43f5e;">Pengurangan Pendapatan (Rp M)</th>
              <th style="border: 1px solid #1e293b; padding: 10px; background: #14b8a6;">+/- Jumlah Kasus</th>
              <th style="border: 1px solid #1e293b; padding: 10px; background: #14b8a6;">% thd total kasus eksisting</th>
              <th style="border: 1px solid #1e293b; padding: 10px; background: #14b8a6;">+/- Pendapatan (Rp M)</th>
            </tr>
          </thead>
          <tbody>
            \${[1, 3, 5, 10].map((pct, idx) => {
              const tambahKasus = Math.round(potensiMax_Kasus * (pct / 100));
              const tambahIdrg = potensiMax_Idrg * (pct / 100);
              const kurangKasus = eksistingUP_Kasus;
              const kurangIdrg = eksistingUP_Idrg;
              
              const netKasus = tambahKasus - kurangKasus;
              const netKasusPct = (netKasus / targetTotalKasus) * 100;
              const netIdrg = tambahIdrg; // Dari mockup, +/- Pendapatan hanya menampilkan Tambahan Pendapatan
              const totalPasca = eksistingDM_Idrg + tambahIdrg;

              return \`
                <tr>
                  <td style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">Skenario \${idx + 1}</td>
                  <td style="border: 1px solid #1e293b; padding: 10px;">\${pct}%</td>
                  <td style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">\${formatNumber(tambahKasus)}</td>
                  <td style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">\${(tambahIdrg / 1000000000).toFixed(1).replace('.', ',')}</td>
                  
                  \${idx === 0 ? \`
                    <td rowspan="4" style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">100%</td>
                    <td rowspan="4" style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">\${formatNumber(kurangKasus)}</td>
                    <td rowspan="4" style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">\${(kurangIdrg / 1000000000).toFixed(2).replace('.', ',')}</td>
                  \` : ''}
                  
                  <td style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">\${formatNumber(netKasus)}</td>
                  <td style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">\${netKasusPct.toFixed(2).replace('.', ',')} %</td>
                  <td style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">\${(netIdrg / 1000000000).toFixed(1).replace('.', ',')}</td>
                  
                  \${idx === 0 ? \`
                    <td rowspan="4" style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">\${(eksistingDM_Idrg / 1000000000).toFixed(2).replace('.', ',')}</td>
                  \` : ''}
                  
                  <td style="border: 1px solid #1e293b; padding: 10px; font-weight: bold;">\${(totalPasca / 1000000000).toFixed(2).replace('.', ',')}</td>
                </tr>
              \`;
            }).join('')}
          </tbody>
        </table>
        
        <div style="margin-top: 30px; font-size: 11px; color: #475569;">
          <div><strong>Sebaran Wilayah:</strong> (Berdasarkan filter regional yang aktif)</div>
        </div>
      </div>
    \`;

    container.innerHTML = html;
  }
`;

// Insert the new function right after renderGlobalSimulationSlide()
if (!appJs.includes('function renderCompetencySimSlide()')) {
  appJs = appJs.replace(
    '  function renderRegionalProfileSlide() {',
    functionCode + '\\n  function renderRegionalProfileSlide() {'
  );
}

// Add calls to renderCompetencySimSlide
appJs = appJs.replace(/renderGlobalSimulationSlide\(\);/g, 'renderGlobalSimulationSlide();\\n    if(typeof renderCompetencySimSlide === "function") renderCompetencySimSlide();');

fs.writeFileSync('js/app.js', appJs);
console.log('App.js patched successfully!');
