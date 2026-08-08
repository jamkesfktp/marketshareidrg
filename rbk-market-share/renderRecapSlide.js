  function renderRecapSlide() {
    const target = targetHospital();
    if (!target) return;
    
    let html = 
      <div class="table-container" style="max-height: 500px; overflow-y: auto;">
        <table class="scenario-table" style="table-layout: auto; width: 100%; min-width: 1200px;">
          <thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <th rowspan="2" style="background-color: #0aa7ad; color: white;">No</th>
              <th rowspan="2" style="background-color: #0aa7ad; color: white; text-align: left;">Layanan</th>
              <th rowspan="2" style="background-color: #0aa7ad; color: white;">Komp.</th>
              <th rowspan="2" style="background-color: #0aa7ad; color: white;">Kasus<br>RS</th>
              <th rowspan="2" style="background-color: #0aa7ad; color: white;">Kasus<br>Regional</th>
              <th rowspan="2" style="background-color: #0aa7ad; color: white;">Market<br>Share</th>
              <th colspan="2" style="background-color: #16a085; color: white;">Rentang Tambahan Kasus<br>(min s.d. maks skenario)</th>
              <th colspan="2" style="background-color: #0e7490; color: white;">Rentang Tamb. Pendapatan<br>(min s.d. maks skenario)</th>
              <th colspan="2" style="background-color: #b93d4a; color: white;">Rentang Pengurangan Kasus<br>(min s.d. maks skenario)</th>
              <th colspan="2" style="background-color: #9f1239; color: white;">Rentang Pengurangan Rp<br>(min s.d. maks skenario)</th>
            </tr>
            <tr>
              <th style="background-color: #16a085; color: white;">Min</th>
              <th style="background-color: #16a085; color: white;">Maks</th>
              <th style="background-color: #0e7490; color: white;">Min</th>
              <th style="background-color: #0e7490; color: white;">Maks</th>
              <th style="background-color: #b93d4a; color: white;">Min</th>
              <th style="background-color: #b93d4a; color: white;">Maks</th>
              <th style="background-color: #9f1239; color: white;">Min</th>
              <th style="background-color: #9f1239; color: white;">Maks</th>
            </tr>
          </thead>
          <tbody>
    ;
    
    data.services.forEach((service, idx) => {
      const tHospSvc = target.services[service];
      const svcData = data.regional.services[service];
      const tSvcTotal = tHospSvc ? tHospSvc.total : [0,0,0];
      const rSvcTotal = svcData ? svcData.total : [0,0,0];
      
      const tKasus = tSvcTotal[CASES] || 0;
      const rKasus = rSvcTotal[CASES] || 0;
      const ms = rKasus ? tKasus / rKasus : 0;
      
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
        basePengurangan[lvl][1] = tM[INA]||0; // Note: using INA for pengurangan
      });
      
      let scenarios = state.serviceScenarios[service] || [];
      if (!scenarios || scenarios.length === 0) {
        scenarios = Array(6).fill().map((_, i) => {
          let scn = {};
          rules.tambah.forEach(lvl => {
            let lvlComp = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= lvl).length;
            let base = lvlComp > 0 ? Math.min(50, 100 / (lvlComp + 1)) : 50;
            scn['tambah_' + lvl] = parseFloat(Math.min(100, Math.max(0, base + i * 10)).toFixed(1));
          });
          rules.kurang.forEach(lvl => {
            scn['kurang_' + lvl] = (lvl > targetCompetency || lvl === 4) ? 100 : 90;
          });
          return scn;
        });
      }
      
      const allTK=[], allTRp=[], allKK=[], allKRp=[];
      scenarios.forEach(scn => {
        let tK=0, tRp=0, kK=0, kRp=0;
        rules.tambah.forEach(lvl => {
          if (scn.hasOwnProperty("tambah_" + lvl)) {
            const pp = scn["tambah_" + lvl] / 100;
            tK += baseTambahan[lvl][0] * pp;
            tRp += baseTambahan[lvl][1] * pp;
          }
        });
        rules.kurang.forEach(lvl => {
          if (scn.hasOwnProperty("kurang_" + lvl)) {
            const pk = scn["kurang_" + lvl] / 100;
            kK += basePengurangan[lvl][0] * pk;
            kRp += basePengurangan[lvl][1] * pk;
          }
        });
        allTK.push(tK); allTRp.push(tRp);
        allKK.push(kK); allKRp.push(kRp);
      });
      
      const minTK = Math.min(...allTK); const maxTK = Math.max(...allTK);
      const minTRp = Math.min(...allTRp); const maxTRp = Math.max(...allTRp);
      const minKK = Math.min(...allKK); const maxKK = Math.max(...allKK);
      const minKRp = Math.min(...allKRp); const maxKRp = Math.max(...allKRp);
      
      const msColor = ms >= 0.3 ? '#087e83' : (ms >= 0.15 ? '#f59e0b' : '#dc2626');
      
      html += \
        <tr>
          <td style="color: #94a3b8; font-size: 11px;">\</td>
          <td style="text-align: left; font-weight: 600; font-size: 11px;">\</td>
          <td style="font-size: 11px;">\</td>
          <td style="color: #087e83; font-weight: 600;">\</td>
          <td style="color: #187a59; font-weight: 600;">\</td>
          <td style="color: \; font-weight: 600;">\</td>
          <td style="color: #16a085; background-color: \;">\</td>
          <td style="color: #16a085; background-color: \; font-weight: 600;">\</td>
          <td style="color: #0e7490; background-color: \;">\</td>
          <td style="color: #0e7490; background-color: \; font-weight: 600;">\</td>
          <td style="color: #b93d4a; background-color: \;">\</td>
          <td style="color: #b93d4a; background-color: \; font-weight: 600;">\</td>
          <td style="color: #9f1239; background-color: \;">\</td>
          <td style="color: #9f1239; background-color: \; font-weight: 600;">\</td>
        </tr>
      \;
    });
    
    html += \
          </tbody>
        </table>
      </div>
      <div style="margin-top: 10px; font-size: 11px; color: #4e5d59; font-style: italic; line-height: 1.5; background: #f4f8f7; padding: 6px 10px; border-radius: 6px; border: 1px solid #d9e5e2;">
        <div>* Rentang dihitung dari seluruh 6 skenario yang tersedia per layanan.</div>
        <div>* Tambahan kasus = selisih kasus regional vs RS target dikali % asumsi tangkapan.</div>
        <div>* Pengurangan pendapatan INA-CBG = estimasi nilai kasus yang mungkin beralih ke level lebih tinggi.</div>
        <div>* Semua nilai bersifat proyeksi; kapasitas, SDM, dan kebijakan operasional belum diperhitungkan.</div>
      </div>
    \;
    
    document.getElementById("recapSlide").innerHTML = html;
  }
