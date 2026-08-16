(function() {
  "use strict";
  window.computeServiceScenarios = function(service, target, data, state, CASES, INA, IDRG, severityMetricFn, getLevelRulesFn) {
    const targetSvcRef = target.services[service];
    const regionalSvc = data.regional.services[service];
    const targetCompetency = target.competencies ? target.competencies[service] : 0;
    const scenarios = state.serviceScenarios[service];
  
    // get target level
    const rules = getLevelRulesFn(targetCompetency, service);
    
    const targetKasusArr = targetSvcRef ? targetSvcRef.total : [0,0,0];
    const existingKasus = targetKasusArr[CASES] || 0;
    const existingIna = targetKasusArr[INA] || 0;
    const existingIdrg = targetKasusArr[IDRG] || 0;
    
    const baseTambahan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
    
    rules.tambah.forEach(lvl => {
      const rMetric = regionalSvc ? severityMetricFn(regionalSvc, lvl) : [0,0,0];
      const tMetric = targetSvcRef ? severityMetricFn(targetSvcRef, lvl) : [0,0,0];
      baseTambahan[lvl][0] = Math.max(0, (rMetric[CASES] || 0) - (tMetric[CASES] || 0));
      baseTambahan[lvl][1] = Math.max(0, (rMetric[IDRG] || 0) - (tMetric[IDRG] || 0));
    });
    
    const basePengurangan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
    if (targetSvcRef) {
      rules.kurang.forEach(lvl => {
        const targetLvl = severityMetricFn(targetSvcRef, lvl);
        basePengurangan[lvl][0] = targetLvl[CASES] || 0;
        basePengurangan[lvl][1] = targetLvl[IDRG] || 0;
      });
    }
  
    const scnEvals = scenarios.map((scn, idx) => {
      let totalTambahKasus = 0;
      let totalKurangKasus = 0;
      let totalKurangDasar = 0;
      let totalTambahRp = 0;
      let totalKurangRp = 0;
      
      [4, 3, 2, 1].forEach(lvl => {
        if (scn.hasOwnProperty('tambah_' + lvl)) {
          const pTambah = scn['tambah_' + lvl] / 100;
          const tk = baseTambahan[lvl][0] * pTambah;
          totalTambahKasus += tk;
          totalTambahRp += baseTambahan[lvl][1] * pTambah;
        }
        if (scn.hasOwnProperty('kurang_' + lvl)) {
          const pKurang = scn['kurang_' + lvl] / 100;
          const kk = basePengurangan[lvl][0] * pKurang;
          totalKurangKasus += kk;
          totalKurangRp += basePengurangan[lvl][1] * pKurang;
          if (lvl === 1) totalKurangDasar = kk;
        }
      });
  
      const sisaKasus = existingKasus - totalKurangKasus;
      const sisaIdrg = existingIdrg - totalKurangRp;
      const pascaKasus = sisaKasus + totalTambahKasus;
      const pascaRp = sisaIdrg + totalTambahRp;
      const netKasus = totalTambahKasus - totalKurangKasus;
      const netRp = totalTambahRp - totalKurangRp;
      
      const isSafe = (existingKasus === 0) || (pascaKasus <= existingKasus);
      
      return {
        idx,
        scn,
        totalTambahKasus,
        totalKurangDasar,
        totalKurangKasus,
        totalTambahRp,
        totalKurangRp,
        netKasus,
        netRp,
        sisaKasus,
        sisaIdrg,
        pascaKasus,
        pascaRp,
        isSafe,
        proyeksiTotalKasus: pascaKasus
      };
    });
    
    const safeOnes = scnEvals.filter(s => s.isSafe);
    let chosenIdx = -1;
    let chosen = null;
    if (safeOnes.length > 0) {
      safeOnes.sort((a, b) => b.netRp - a.netRp || b.totalTambahKasus - a.totalTambahKasus);
      chosen = safeOnes[0];
      chosenIdx = chosen.idx;
    } else {
      chosen = scnEvals[0];
      chosenIdx = 0;
    }
    
    return {
      baseTambahan,
      basePengurangan,
      scnEvals,
      chosenIdx,
      chosen,
      existingKasus,
      existingIna,
      existingIdrg,
      targetSvcRef,
      regionalSvc,
      targetCompetency
    };
  };
})();
