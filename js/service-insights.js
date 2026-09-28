(function (root) {
  'use strict';
  // Planning indicators, not clinical accreditation or measured provider capacity.
  //
  // Level serving rules (consistent with canServeLevel in app.js):
  //   Paripurna (4) : serves level 3 (Utama)   + 4 (Paripurna)
  //   Utama    (3)  : serves level 2 (Madya)    + 3 (Utama)
  //   Madya    (2)  : serves level 1 (Dasar)    + 2 (Madya)
  //   Dasar    (1)  : serves level 1 (Dasar) only
  //
  //   tambah = levels the RS CAN pick up additional cases from regional pool
  //   kurang = levels the RS will LOSE because out of competency range

  var SERVE_LEVELS = {1: [1], 2: [1,2], 3: [2,3], 4: [3,4]};
  var LOSE_LEVELS  = {1: [2,3,4], 2: [3,4], 3: [1,4], 4: [1,2]};

  function evaluate(input) {
    var competency = input.competency, levels = input.levels, simulation = input.simulation;
    var known = [1, 2, 3, 4].indexOf(competency) >= 0;
    var current = levels.find(function(x){ return x.level === competency; });
    var next    = levels.find(function(x){ return x.level === competency + 1; });
    var caseDelta   = simulation.projectedCases - simulation.baselineCases;
    var incomeDelta = simulation.projectedIdrg  - simulation.baselineIna;
    var currentLoad = current ? current.regionalCases / Math.max(1, current.providers) : 0;
    var nextLoad    = next    ? next.regionalCases    / Math.max(1, next.providers)    : 0;
    var opportunity = 'maintain';
    if (!known) opportunity = 'unknown';
    else if (!levels.some(function(x){ return x.regionalCases > 0; })) opportunity = 'no-data';
    else if (competency === 4) opportunity = 'paripurna';
    else if (next && next.regionalCases > 0 && (next.providers === 0 || nextLoad > currentLoad)) opportunity = 'upgrade';
    else if (simulation.addCases <= 0) opportunity = 'optimize';
    var complexGrowth = levels
      .filter(function(x){ return x.level >= 3; })
      .reduce(function(sum, x){ return sum + Math.max(0, x.addCases - x.lossCases); }, 0);
    var readiness = 'stable';
    if (caseDelta > 0) readiness = complexGrowth > 0 ? 'growth-complex' : 'growth';
    else if (complexGrowth > 0) readiness = 'complex';
    else if (caseDelta < 0) readiness = 'decline';
    return {
      opportunity: opportunity, readiness: readiness,
      caseDelta: caseDelta, incomeDelta: incomeDelta,
      complexGrowth: complexGrowth, currentLoad: currentLoad, nextLoad: nextLoad,
      casePct:    simulation.baselineCases > 0 ? caseDelta    / simulation.baselineCases : null,
      incomePct:  simulation.baselineIna   > 0 ? incomeDelta  / simulation.baselineIna  : null
    };
  }

  function executiveSummary(simulation) {
    var before = simulation.baselineCases, revenueBefore = simulation.baselineIna;
    var after  = simulation.projectedCases, revenueAfter  = simulation.projectedIdrg;
    var fmt = function(v){ return v.toLocaleString('id-ID', {maximumFractionDigits:2}); };
    var change = function(a,b){ return b>0?(a/b-1)*100:null; };
    var describe = function(v){ return v===null?'persentase perubahan tidak tersedia karena baseline nol':(v>0?'naik ':v<0?'turun ':'tetap ')+fmt(Math.abs(v))+'%'; };
    var casesPct=change(after,before), revenuePct=change(revenueAfter,revenueBefore);
    var avgBefore=before>0?revenueBefore/before:null, avgAfter=after>0?revenueAfter/after:null;
    var avgPct=avgBefore>0&&avgAfter!==null?change(avgAfter,avgBefore):null;
    var comparison=casesPct===null||revenuePct===null?'':'; perubahan pendapatan '+(revenuePct<casesPct?'lebih rendah daripada':revenuePct>casesPct?'lebih tinggi daripada':'sejalan dengan')+' perubahan beban kasus';
    var first='Proyeksi pasca iDRG & RBKP mencapai '+fmt(after)+' kasus ('+describe(casesPct)+') dengan pendapatan Rp'+fmt(revenueAfter/1e9)+' M ('+describe(revenuePct)+')'+comparison+'.';
    var second=avgPct===null?'Perubahan pendapatan rata-rata per kasus belum dapat dihitung karena baseline pendapatan atau volume kasus nol.':'Pendapatan rata-rata per kasus '+describe(avgPct)+' dari Rp'+fmt(avgBefore)+' menjadi Rp'+fmt(avgAfter)+(avgPct<0?', sehingga margin per kasus berpotensi tertekan apabila biaya per kasus tidak turun sebanding.':'; dampaknya terhadap margin per kasus tetap bergantung pada biaya pelayanan.');
    var third=(after>before?'Kenaikan volume menuntut penyesuaian SDM, sarpras, dan logistik serta pengendalian biaya sesuai komposisi kasus':after<before?'Penurunan volume menuntut penyesuaian alokasi SDM dan sarpras serta pengendalian biaya tetap sesuai komposisi kasus':'Volume yang tetap memerlukan penyesuaian SDM, sarpras, dan logistik apabila komposisi kasus berubah')+'; margin aktual belum dapat dihitung tanpa data biaya.';
    return first+' '+second+' '+third;
  }

  /**
   * Generate ONE concise, data-driven recommendation for the slide bottom bar.
   *
   * Competency serving rules (RS melayani level kompetensinya + satu tingkat di bawah):
   *   Paripurna (4) -> tambah kasus level 3+4, kurang level 1+2
   *   Utama     (3) -> tambah kasus level 2+3, kurang level 1+4
   *   Madya     (2) -> tambah kasus level 1+2, kurang level 3+4
   *   Dasar     (1) -> tambah kasus level 1,   kurang level 2+3+4
   */
  function recommendation(service, competency, simulation) {
    var insight = evaluate({competency:competency, simulation:simulation, levels:simulation.insightLevels||[]});
    var levels  = simulation.insightLevels || [];
    var fmt     = function(n){ return Math.round(n).toLocaleString('id-ID'); };
    var fmtPct  = function(n){ return n.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}); };
    var names   = {1:'Dasar',2:'Madya',3:'Utama',4:'Paripurna'};
    var UP   = '\u25b2'; // triangle up
    var DOWN = '\u25bc'; // triangle down

    function regionalFor(lvl) {
      var l = levels.find(function(x){ return x.level===lvl; });
      return l ? (l.regionalCases||0) : 0;
    }
    function competitorsFor(lvl) {
      var l = levels.find(function(x){ return x.level===lvl; });
      return l ? (l.competitors||0) : 0;
    }

    var totalRegional = levels.reduce(function(s,x){ return s+(x.regionalCases||0); }, 0);

    // Case 1: Zero cases at all
    if (simulation.baselineCases === 0 && simulation.projectedCases === 0) {
      return 'Sejauh ini tidak ada kasus '+service+' sehingga perlu dipertimbangkan untuk melakukan efisiensi pada sisi fixed cost serta realokasi SDM (bukan dokter) untuk mendukung layanan yang akan mengalami lonjakan pasien cukup tinggi.';
    }

    // Case 2: Significant case growth
    if (insight.caseDelta > 0) {
      var absDelta = Math.abs(insight.caseDelta);
      var pctStr = insight.casePct !== null ? ' (+'+fmtPct(insight.casePct*100)+'%)' : '';
      
      var upgradeMsg = '';
      if (insight.opportunity === 'upgrade') {
        var nextComp = competency + 1;
        var nextName = names[nextComp] || '';
        upgradeMsg = ' Pertimbangkan juga peningkatan kompetensi ke ' + nextName + ' untuk menjangkau kasus dengan margin lebih baik.';
      }

      if (insight.incomeDelta < 0) {
        var absIncome = Math.abs(insight.incomeDelta);
        var fmtMoneyM = function(n) { 
          var inMilyar = n / 1e9;
          if (Math.abs(n) >= 1e9) {
            return inMilyar.toLocaleString('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' M';
          } else {
            return inMilyar.toLocaleString('id-ID', {minimumFractionDigits:3, maximumFractionDigits:3}) + ' M';
          }
        };
        
        if (insight.opportunity === 'upgrade') {
          return 'Peningkatan kompetensi ke ' + names[competency + 1] + ' sangat disarankan! Peningkatan beban layanan ' + UP + ' ' + fmt(absDelta) + ' kasus' + pctStr + ' saat ini berisiko membebani RS akibat potensi penurunan pendapatan ' + DOWN + ' ' + fmtMoneyM(absIncome) + ', sehingga upgrade kompetensi dapat membuka peluang kenaikan pendapatan.';
        }
        
        return 'Perketat kendali mutu dan biaya (efisiensi layanan) serta evaluasi clinical pathway. Peningkatan beban layanan ' + UP + ' ' + fmt(absDelta) + ' kasus' + pctStr + ' berisiko membebani RS karena diiringi potensi penurunan total pendapatan ' + DOWN + ' ' + fmtMoneyM(absIncome) + '.';
      }

      return 'Perhatikan kesiapan SDM, sarpras, dan logistik RS dalam merespons kenaikan pasien '+UP+' '+fmt(absDelta)+' kasus'+pctStr + '.' + upgradeMsg;
    }

    // Case 3: Paripurna RS under-utilizing available regional cases
    if (competency === 4) {
      var lvl4 = levels.find(function(x){ return x.level===4; });
      var lvl3 = levels.find(function(x){ return x.level===3; });
      var reg4 = lvl4 ? lvl4.regionalCases : 0;
      var reg3 = lvl3 ? lvl3.regionalCases : 0;
      var comp4 = lvl4 ? lvl4.competitors : 0;
      var comp3 = lvl3 ? lvl3.competitors : 0;
      if (simulation.baselineCases > 0 && (reg4+reg3) > simulation.baselineCases) {
        return 'Dengan level Paripurna, layanan '+service+' melayani di bawah kapasitasnya (hanya '+fmt(simulation.baselineCases)+' kasus) dibandingkan '+fmt(reg4)+' kasus Paripurna'+(comp4===0?' tanpa pesaing':' dengan '+comp4+' pesaing')+(reg3>0?' dan '+fmt(reg3)+' kasus Utama'+(comp3===0?' tanpa pesaing RS Paripurna':' dengan '+comp3+' pesaing RS Utama/Paripurna'):'')+'. RS harus didorong untuk melayani seluruh kasus Paripurna dan sebagian kasus Utama.';
      }
    }

    // Case 4: Utama RS under-utilizing available Madya+Utama cases
    if (competency === 3) {
      var reg3u = regionalFor(3), reg2u = regionalFor(2);
      var comp3u = competitorsFor(3), comp2u = competitorsFor(2);
      if (simulation.baselineCases > 0 && (reg3u+reg2u) > simulation.baselineCases) {
        return 'Dengan level Utama, layanan '+service+' melayani di bawah kapasitasnya ('+fmt(simulation.baselineCases)+' kasus) dibandingkan '+fmt(reg3u)+' kasus Utama'+(comp3u===0?' tanpa pesaing':' dengan '+comp3u+' pesaing')+(reg2u>0?' dan '+fmt(reg2u)+' kasus Madya'+(comp2u===0?' tanpa pesaing':''):'')+'. Optimalkan penyerapan kasus Utama dan Madya sesuai kapasitas RS.';
      }
    }

    // Case 5: Upgrade opportunity (Fallback if caseDelta == 0)
    if (insight.opportunity === 'upgrade') {
      var nextComp  = competency + 1;
      var nextName  = names[nextComp]  || '';
      var currName  = names[competency] || '';
      var compNext  = competitorsFor(nextComp);
      var compCurr  = competitorsFor(competency);
      var regNext   = regionalFor(nextComp);
      var regCurr   = regionalFor(competency);

      if (compNext === 0 && compCurr === 0) {
        return 'Untuk layanan '+service+', RS berpeluang meningkatkan kompetensinya ke '+nextName+' (hanya '+compNext+' pesaing) atau setidaknya '+currName+' (belum ada pesaing) dengan jumlah pasien yang cukup tinggi baik di '+currName+' ('+fmt(regCurr)+' kasus) maupun '+nextName+' ('+fmt(regNext)+' kasus).\nLayanan '+service+' RS dengan level saat ini melayani pasien sangat sedikit ('+fmt(simulation.baselineCases)+') dibandingkan potensi yang ada.';
      }
      if (compNext === 0) {
        return 'Optimalkan layanan '+service+' untuk melayani tambahan kasus regional '+nextName+' dimana tidak ada RS dengan kompetensi '+nextName+' sedangkan kasus '+nextName+' ('+fmt(regNext)+') jauh lebih banyak dari '+currName+' ('+fmt(regCurr)+').';
      }
      return 'Prioritaskan persiapan peningkatan kompetensi layanan '+service+' menjadi '+nextName+' berdasarkan kebutuhan '+fmt(regNext)+' kasus regional per penyedia, disertai pemenuhan SDM dan sarpras.';
    }

    // Case 6: Case decline
    if (insight.caseDelta < 0) {
      if (insight.opportunity === 'upgrade') {
        return 'Pertimbangkan peningkatan kompetensi ke ' + names[competency + 1] + ' untuk mengkompensasi potensi penurunan pasien ' + DOWN + ' ' + fmt(Math.abs(insight.caseDelta)) + ' kasus pada level saat ini.';
      }
      return 'Sesuaikan alokasi SDM dan sarpras layanan '+service+' dengan penurunan pasien '+DOWN+' '+fmt(Math.abs(insight.caseDelta))+' kasus; pertimbangkan efisiensi biaya tetap.';
    }

    // Case 7: Zero cases but regional pool exists
    if (simulation.baselineCases === 0 && totalRegional > 0) {
      return 'Sejauh ini tidak ada kasus '+service+' sehingga perlu dipertimbangkan untuk melakukan efisiensi pada sisi fixed cost serta realokasi SDM (bukan dokter) untuk mendukung layanan yang akan mengalami lonjakan pasien cukup tinggi.';
    }

    // Case 8: Default - optimize at current competency
    var serveLvls = SERVE_LEVELS[competency] || [];
    var serveLvlNames = serveLvls.map(function(l){ return names[l]||''; }).join(' dan ');
    return 'Optimalkan layanan '+service+' pada kompetensi '+(names[competency]||'-')+' untuk menangani proyeksi pasien sesuai hasil simulasi (melayani kasus level '+serveLvlNames+').';
  }

  /** Legacy multi-line array version - kept for backward compatibility */
  function recommendations(service, competency, simulation) {
    return [recommendation(service, competency, simulation)];
  }

  root.ServiceInsights = { evaluate: evaluate, executiveSummary: executiveSummary, recommendation: recommendation, recommendations: recommendations };
})(typeof window === 'undefined' ? globalThis : window);
