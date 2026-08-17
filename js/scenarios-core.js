(function() {
  "use strict";
  // mode: 'regional_all' (default) = sisa regional - target
  //       'kelasatas'               = serap Dasar/Madya dari RS kompetitor kelas LEBIH TINGGI
  window.computeServiceScenarios = function(service, target, data, state, CASES, INA, IDRG, severityMetricFn, getLevelRulesFn, mode, getCompetencyFn) {
    const targetSvcRef = target.services[service];
    const regionalSvc = data.regional.services[service];
    const targetCompetency = targetSvcRef ? (targetSvcRef.competency || 0) : 0;
    const scenarios = state.serviceScenarios && state.serviceScenarios[service];
  
    // get target level rules
    const rules = getLevelRulesFn(targetCompetency, service);
    
    const targetKasusArr = targetSvcRef ? targetSvcRef.total : [0,0,0];
    const existingKasus = targetKasusArr[CASES] || 0;
    const existingIna = targetKasusArr[INA] || 0;
    const existingIdrg = targetKasusArr[IDRG] || 0;
    
    const baseTambahan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
    
    if (mode === 'kelasatas' && typeof getCompetencyFn === 'function') {
      // Mode kelasatas: kumpulkan kasus Dasar & Madya dari RS yang kompetensinya > target
      const higherHospitals = data.hospitals.filter(h => {
        if (!h || h.code === target.code) return false;
        return getCompetencyFn(h, service) > targetCompetency;
      });
      [1, 2].forEach(lvl => {
        let poolK = 0, poolRp = 0;
        higherHospitals.forEach(h => {
          const hSrv = h.services && h.services[service];
          if (!hSrv) return;
          const m = severityMetricFn(hSrv, lvl);
          poolK += m[CASES] || 0;
          poolRp += m[IDRG] || 0;
        });
        baseTambahan[lvl][0] = poolK;
        baseTambahan[lvl][1] = poolRp;
      });
    } else {
      // Mode regional_all (default): sisa = regional - target
      rules.tambah.forEach(lvl => {
        const rMetric = regionalSvc ? severityMetricFn(regionalSvc, lvl) : [0,0,0];
        const tMetric = targetSvcRef ? severityMetricFn(targetSvcRef, lvl) : [0,0,0];
        baseTambahan[lvl][0] = Math.max(0, (rMetric[CASES] || 0) - (tMetric[CASES] || 0));
        baseTambahan[lvl][1] = Math.max(0, (rMetric[IDRG] || 0) - (tMetric[IDRG] || 0));
      });
    }
    
    const basePengurangan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
    if (targetSvcRef) {
      rules.kurang.forEach(lvl => {
        const targetLvl = severityMetricFn(targetSvcRef, lvl);
        basePengurangan[lvl][0] = targetLvl[CASES] || 0;
        basePengurangan[lvl][1] = targetLvl[IDRG] || 0;
      });
    }
  
    // Guard: return empty result if no scenarios
    if (!scenarios || scenarios.length === 0) {
      return {
        baseTambahan, basePengurangan,
        scnEvals: [], chosenIdx: -1, chosen: null,
        existingKasus, existingIna, existingIdrg,
        targetSvcRef, regionalSvc, targetCompetency
      };
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
      const sortedUnsafe = [...scnEvals].sort((a, b) => (a.pascaKasus - b.pascaKasus) || (b.netRp - a.netRp));
      chosen = sortedUnsafe[0];
      chosenIdx = chosen.idx;
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
