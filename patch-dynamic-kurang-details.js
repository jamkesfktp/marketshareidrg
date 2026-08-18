const fs = require('fs');

let appJs = fs.readFileSync('js/app.js', 'utf8');

const newRenderCompetencySimSlide = `
  function renderCompetencySimSlide() {
    const formatMoneyUnit = (val) => {
      if (!val || isNaN(val)) return '0,00';
      const sign = val < 0 ? '-' : '';
      const absVal = Math.abs(val);
      if (absVal >= 1e12) return sign + (absVal / 1e12).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' T';
      if (absVal >= 1e9) return sign + (absVal / 1e9).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' M';
      if (absVal >= 1e6) return sign + (absVal / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' JT';
      return sign + Math.round(absVal).toLocaleString('id-ID');
    };

    const container = document.getElementById('competencyTableSlide');
    if (!container) return;

    const data = window.marketSimulatorDatasets ? (window.marketSimulatorDatasets[activeDatasetKey] || window.marketSimulatorDatasets['okt_jun']) : window.marketSimulatorData;
    if (!data || !data.hospitals) return;

    const target = data.hospitals.find((h) => h.code === state.targetCode) || (data.hospitals.length ? data.hospitals[0] : null);
    if (!target) {
      container.innerHTML = '<div style="padding: 20px;">Target RS tidak ditemukan.</div>';
      return;
    }

    if (!window.competencySimScenarios) {
      window.competencySimScenarios = [1, 3, 5, 10];
    }
    if (!window.competencyKurangScenarios) {
      window.competencyKurangScenarios = [100, 100, 100, 100];
    }

    const potentials = window.globalSimPotentials || {
      potensiSerapanKasus: 0,
      potensiSerapanIdrg: 0,
      potensiRedistribusiKasus: 0,
      potensiRedistribusiIdrg: 0
    };
    
    let eksistingDM_Idrg = 0;
    let eksistingUP_Idrg = 0;
    
    let kasusDasar = 0, kasusMadya = 0, kasusUtama = 0, kasusParipurna = 0;
    let inaDasar = 0, inaMadya = 0, inaUtama = 0, inaParipurna = 0;
    let idrgDasar = 0, idrgMadya = 0, idrgUtama = 0, idrgParipurna = 0;

    data.services.forEach(service => {
      const targetSrv = target.services[service];
      if (!targetSrv) return;

      const tDasar = severityMetric(targetSrv, 1);
      const tMadya = severityMetric(targetSrv, 2);
      const tUtama = severityMetric(targetSrv, 3);
      const tParipurna = severityMetric(targetSrv, 4);

      eksistingDM_Idrg += (tDasar[IDRG] || 0) + (tMadya[IDRG] || 0);
      eksistingUP_Idrg += (tUtama[IDRG] || 0) + (tParipurna[IDRG] || 0);
      
      kasusDasar += tDasar[CASES] || 0;
      kasusMadya += tMadya[CASES] || 0;
      kasusUtama += tUtama[CASES] || 0;
      kasusParipurna += tParipurna[CASES] || 0;

      inaDasar += tDasar[INA] || 0;
      inaMadya += tMadya[INA] || 0;
      inaUtama += tUtama[INA] || 0;
      inaParipurna += tParipurna[INA] || 0;

      idrgDasar += tDasar[IDRG] || 0;
      idrgMadya += tMadya[IDRG] || 0;
      idrgUtama += tUtama[IDRG] || 0;
      idrgParipurna += tParipurna[IDRG] || 0;
    });

    const targetTotalKasus = target.total[CASES] || 0;
    const targetInaTotal = target.total[INA] || 0;
    const targetIdrgTotal = target.total[IDRG] || 0;
    
    const selisihPendapatan = targetIdrgTotal - targetInaTotal;
    const pctSelisih = targetInaTotal > 0 ? (selisihPendapatan / targetInaTotal) * 100 : 0;
    
    // Dynamic Modes
    const tambahMode = document.getElementById('globalSimTambahSelect')?.value || 'tambah_cross_comp';
    const kurangMode = document.getElementById('globalSimKurangSelect')?.value || 'kurang_up';
    
    const isTambahUP = (tambahMode === 'tambah_up');
    const isKurangDM = (kurangMode === 'kurang_dm');

    const headerTambahan = isTambahUP ? 'Tambahan Kasus Utama & Paripurna' : 'Tambahan Kasus Dasar & Madya';
    const headerPengurangan = isKurangDM ? 'Pengurangan Kasus Dasar & Madya' : 'Pengurangan Kasus Utama & Paripurna';
    const headerEksisting = isTambahUP ? 'Pendapatan Eksisting iDRG Kasus Utama & Paripurna (Rp M)' : 'Pendapatan Eksisting iDRG Kasus Dasar & Madya (Rp M)';

    const eksistingTambahan = isTambahUP ? eksistingUP_Idrg : eksistingDM_Idrg;

    const html = \`
      <div style="font-family: Arial, sans-serif; padding-top: 10px;">
        
        <!-- Summary Cards -->
        <div style="display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 180px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; text-align: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Total Kasus:</div>
            <div style="color: #be185d; font-size: 24px; font-weight: 900;">\${formatNumber(targetTotalKasus)}</div>
            <div style="margin-top: 8px; font-size: 10px; color: #475569; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <div>D: <strong style="color: #0f172a;">\${formatNumber(kasusDasar)}</strong></div>
              <div>M: <strong style="color: #0f172a;">\${formatNumber(kasusMadya)}</strong></div>
              <div>U: <strong style="color: #0f172a;">\${formatNumber(kasusUtama)}</strong></div>
              <div>P: <strong style="color: #0f172a;">\${formatNumber(kasusParipurna)}</strong></div>
            </div>
          </div>
          <div style="flex: 1; min-width: 180px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; text-align: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Pendapatan INA:</div>
            <div style="color: #c2410c; font-size: 24px; font-weight: 900;">\${formatMoneyUnit(targetInaTotal)}</div>
            <div style="margin-top: 8px; font-size: 10px; color: #475569; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <div>D: <strong style="color: #0f172a;">\${formatMoneyUnit(inaDasar)}</strong></div>
              <div>M: <strong style="color: #0f172a;">\${formatMoneyUnit(inaMadya)}</strong></div>
              <div>U: <strong style="color: #0f172a;">\${formatMoneyUnit(inaUtama)}</strong></div>
              <div>P: <strong style="color: #0f172a;">\${formatMoneyUnit(inaParipurna)}</strong></div>
            </div>
          </div>
          <div style="flex: 1; min-width: 180px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; text-align: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Total iDRG Eksisting:</div>
            <div style="color: #c2410c; font-size: 24px; font-weight: 900;">\${formatMoneyUnit(targetIdrgTotal)}</div>
            <div style="margin-top: 8px; font-size: 10px; color: #475569; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <div>D: <strong style="color: #0f172a;">\${formatMoneyUnit(idrgDasar)}</strong></div>
              <div>M: <strong style="color: #0f172a;">\${formatMoneyUnit(idrgMadya)}</strong></div>
              <div>U: <strong style="color: #0f172a;">\${formatMoneyUnit(idrgUtama)}</strong></div>
              <div>P: <strong style="color: #0f172a;">\${formatMoneyUnit(idrgParipurna)}</strong></div>
            </div>
          </div>
          
          <!-- Scorecard Selisih -->
          <div style="flex: 1; min-width: 160px; background: \${selisihPendapatan >= 0 ? '#f0fdf4' : '#fef2f2'}; border: 1px solid \${selisihPendapatan >= 0 ? '#bbf7d0' : '#fecaca'}; padding: 12px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Selisih Pendapatan:</div>
            <div style="color: \${selisihPendapatan >= 0 ? '#15803d' : '#b91c1c'}; font-size: 24px; font-weight: 900;">\${selisihPendapatan >= 0 ? '+' : ''}\${formatMoneyUnit(selisihPendapatan)}</div>
            <div style="color: \${selisihPendapatan >= 0 ? '#15803d' : '#b91c1c'}; font-size: 14px; font-weight: bold; margin-top: 4px;">\${selisihPendapatan >= 0 ? '+' : ''}\${pctSelisih.toFixed(2).replace('.', ',')}%</div>
          </div>

          <div style="flex: 1; min-width: 160px; background: #fdf2f8; border: 1px solid #fbcfe8; padding: 12px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
            <div style="color: #be185d; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Potensi Tambah Max:</div>
            <div style="color: #059669; font-size: 24px; font-weight: 900;">\${formatMoneyUnit(potentials.potensiSerapanIdrg)}</div>
            <div style="color: #f43f5e; font-size: 11px; font-weight: 700; margin-top: 4px;">Filter Global Aktif</div>
          </div>
        </div>

        <!-- Table -->
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #1e293b; text-align: center; font-size: 13px;">
            <thead style="background: #38bdf8; color: white;">
              <tr>
                <th rowspan="2" style="border: 1px solid #1e293b; padding: 8px; background: #0f766e;">Skenario</th>
                <th colspan="3" style="border: 1px solid #1e293b; padding: 8px; background: #059669;">\${headerTambahan}</th>
                <th colspan="3" style="border: 1px solid #1e293b; padding: 8px; background: #e11d48;">\${headerPengurangan}</th>
                <th colspan="3" style="border: 1px solid #1e293b; padding: 8px; background: #0d9488;">Net +/- Pasca iDRG & RBKP</th>
                <th rowspan="2" style="border: 1px solid #1e293b; padding: 8px; background: #0f766e; max-width: 120px;">\${headerEksisting}</th>
                <th rowspan="2" style="border: 1px solid #1e293b; padding: 8px; background: #059669;">Total Pendapatan Pasca iDRG & RBKP (Rp M)</th>
              </tr>
              <tr>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #10b981;">Persentase</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #10b981;">Jumlah Kasus</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #10b981;">Tambahan (Rp M)</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #f43f5e;">Persentase</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #f43f5e;">Jumlah Kasus</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #f43f5e;">Pengurangan (Rp M)</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #14b8a6;">+/- Kasus</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #14b8a6;">% thd total kasus</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #14b8a6;">+/- Pendapatan (Rp M)</th>
              </tr>
            </thead>
            <tbody>
              \${window.competencySimScenarios.map((pctTambah, idx) => {
                const pctKurang = window.competencyKurangScenarios[idx];
                
                const tambahKasus = Math.round(potentials.potensiSerapanKasus * (pctTambah / 100));
                const tambahIdrg = potentials.potensiSerapanIdrg * (pctTambah / 100);
                
                const kurangKasus = Math.round(potentials.potensiRedistribusiKasus * (pctKurang / 100));
                const kurangIdrg = potentials.potensiRedistribusiIdrg * (pctKurang / 100);
                
                const netKasus = tambahKasus - kurangKasus;
                const netKasusPct = targetTotalKasus > 0 ? (netKasus / targetTotalKasus) * 100 : 0;
                const netIdrg = tambahIdrg - kurangIdrg; 
                
                // Total Pasca RS Keseluruhan = Total Awal + Tambahan - Pengurangan
                const totalPasca = targetIdrgTotal + netIdrg;

                return \`
                  <tr>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold;">Skenario \${idx + 1}</td>
                    
                    <!-- Tambahan -->
                    <td style="border: 1px solid #1e293b; padding: 8px;">
                      <div style="display:flex; align-items:center; justify-content:center;">
                        <input type="number" class="comp-sim-tambah-pct-input" data-idx="\${idx}" value="\${pctTambah}" min="0" max="100" style="width: 45px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; font-weight: bold;">
                        <span style="margin-left: 2px;">%</span>
                      </div>
                    </td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold;">\${formatNumber(tambahKasus)}</td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: #059669;">+\${(tambahIdrg / 1000000000).toFixed(1).replace('.', ',')}</td>
                    
                    <!-- Pengurangan -->
                    <td style="border: 1px solid #1e293b; padding: 8px;">
                      <div style="display:flex; align-items:center; justify-content:center;">
                        <input type="number" class="comp-sim-kurang-pct-input" data-idx="\${idx}" value="\${pctKurang}" min="0" max="100" style="width: 45px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; font-weight: bold;">
                        <span style="margin-left: 2px;">%</span>
                      </div>
                    </td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold;">\${formatNumber(kurangKasus)}</td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: #e11d48;">-\${(kurangIdrg / 1000000000).toFixed(2).replace('.', ',')}</td>
                    
                    <!-- Net -->
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: \${netKasus >= 0 ? '#059669' : '#e11d48'}">\${netKasus >= 0 ? '+' : ''}\${formatNumber(netKasus)}</td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: \${netKasus >= 0 ? '#059669' : '#e11d48'}">\${netKasus >= 0 ? '+' : ''}\${netKasusPct.toFixed(2).replace('.', ',')} %</td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: \${netIdrg >= 0 ? '#059669' : '#e11d48'}">\${netIdrg >= 0 ? '+' : ''}\${(netIdrg / 1000000000).toFixed(1).replace('.', ',')}</td>
                    
                    <!-- Eksisting -->
                    \${idx === 0 ? \`
                      <td rowspan="\${window.competencySimScenarios.length}" style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; background: #f8fafc;">\${(eksistingTambahan / 1000000000).toFixed(2).replace('.', ',')}</td>
                    \` : ''}
                    
                    <!-- Total Pasca -->
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; background: #f0fdf4;">\${(totalPasca / 1000000000).toFixed(2).replace('.', ',')}</td>
                  </tr>
                \`;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <div style="margin-top: 15px; font-size: 11px; color: #475569;">
          <div style="margin-bottom: 4px;"><strong>Catatan:</strong> Tabel ini terhubung secara dinamis dengan pengaturan <em>Skenario Simulasi Global</em> di bilah samping.</div>
          <div>* Total Pendapatan Pasca iDRG = Total iDRG Eksisting RS (\${formatMoneyUnit(targetIdrgTotal)}) + Tambahan - Pengurangan.</div>
        </div>
      </div>
    \`;

    container.innerHTML = html;

    container.querySelectorAll('.comp-sim-tambah-pct-input').forEach(input => {
      input.addEventListener('change', function() {
        const idx = parseInt(this.getAttribute('data-idx'), 10);
        let val = parseFloat(this.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 100) val = 100;
        window.competencySimScenarios[idx] = val;
        renderCompetencySimSlide();
      });
    });

    container.querySelectorAll('.comp-sim-kurang-pct-input').forEach(input => {
      input.addEventListener('change', function() {
        const idx = parseInt(this.getAttribute('data-idx'), 10);
        let val = parseFloat(this.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 100) val = 100;
        window.competencyKurangScenarios[idx] = val;
        renderCompetencySimSlide();
      });
    });
  }
`;

appJs = appJs.replace(/  function renderCompetencySimSlide\(\) \{[\s\S]*?renderCompetencySimSlide\(\);\n      \}\);\n    \}\);\n  \}/g, '');
appJs = appJs.replace(/  function renderCompetencySimSlide\(\) \{[\s\S]*?container\.innerHTML = html;\n  \}/g, '');

appJs = appJs.replace(
  '  function renderRegionalProfileSlide() {',
  newRenderCompetencySimSlide + '\n  function renderRegionalProfileSlide() {'
);

fs.writeFileSync('js/app.js', appJs);
console.log('App patched successfully!');
