(function (root) {
  'use strict';
  // Planning indicators, not clinical accreditation or measured provider capacity.
  function evaluate(input) {
    const { competency, levels, simulation } = input;
    const known = [1, 2, 3, 4].includes(competency);
    const current = levels.find(x => x.level === competency);
    const next = levels.find(x => x.level === competency + 1);
    const caseDelta = simulation.projectedCases - simulation.baselineCases;
    const incomeDelta = simulation.projectedIdrg - simulation.baselineIna;
    const currentLoad = current ? current.regionalCases / Math.max(1, current.providers) : 0;
    const nextLoad = next ? next.regionalCases / Math.max(1, next.providers) : 0;
    // Compare regional burden per capable provider across levels; no arbitrary large/small cutoff.
    let opportunity = 'maintain';
    if (!known) opportunity = 'unknown';
    else if (!levels.some(x => x.regionalCases > 0)) opportunity = 'no-data';
    else if (competency === 4) opportunity = 'paripurna';
    else if (next && next.regionalCases > 0 && (next.providers === 0 || nextLoad > currentLoad)) opportunity = 'upgrade';
    else if (simulation.addCases <= 0) opportunity = 'optimize';
    const complexGrowth = levels.filter(x => x.level >= 3).reduce((sum, x) => sum + Math.max(0, x.addCases - x.lossCases), 0);
    let readiness = 'stable';
    if (caseDelta > 0) readiness = complexGrowth > 0 ? 'growth-complex' : 'growth';
    else if (complexGrowth > 0) readiness = 'complex';
    else if (caseDelta < 0) readiness = 'decline';
    return { opportunity, readiness, caseDelta, incomeDelta, complexGrowth, currentLoad, nextLoad,
      casePct: simulation.baselineCases > 0 ? caseDelta / simulation.baselineCases : null,
      incomePct: simulation.baselineIna > 0 ? incomeDelta / simulation.baselineIna : null };
  }
  function executiveSummary(simulation) {
    const {baselineCases: before, baselineIna: revenueBefore, projectedCases: after, projectedIdrg: revenueAfter} = simulation;
    const fmt = value => value.toLocaleString('id-ID', {maximumFractionDigits: 2});
    const change = (a, b) => b > 0 ? (a / b - 1) * 100 : null;
    const describe = value => value === null ? 'persentase perubahan tidak tersedia karena baseline nol' : (value > 0 ? 'naik ' : value < 0 ? 'turun ' : 'tetap ') + fmt(Math.abs(value)) + '%';
    const casesPct = change(after, before), revenuePct = change(revenueAfter, revenueBefore);
    const avgBefore = before > 0 ? revenueBefore / before : null;
    const avgAfter = after > 0 ? revenueAfter / after : null;
    const avgPct = avgBefore > 0 && avgAfter !== null ? change(avgAfter, avgBefore) : null;
    const comparison = casesPct === null || revenuePct === null ? '' : '; perubahan pendapatan ' + (revenuePct < casesPct ? 'lebih rendah daripada' : revenuePct > casesPct ? 'lebih tinggi daripada' : 'sejalan dengan') + ' perubahan beban kasus';
    const first = 'Proyeksi pasca iDRG & RBKP mencapai ' + fmt(after) + ' kasus (' + describe(casesPct) + ') dengan pendapatan Rp' + fmt(revenueAfter / 1e9) + ' M (' + describe(revenuePct) + ')' + comparison + '.';
    const second = avgPct === null ? 'Perubahan pendapatan rata-rata per kasus belum dapat dihitung karena baseline pendapatan atau volume kasus nol.' : 'Pendapatan rata-rata per kasus ' + describe(avgPct) + ' dari Rp' + fmt(avgBefore) + ' menjadi Rp' + fmt(avgAfter) + (avgPct < 0 ? ', sehingga margin per kasus berpotensi tertekan apabila biaya per kasus tidak turun sebanding.' : '; dampaknya terhadap margin per kasus tetap bergantung pada biaya pelayanan.');
    const third = (after > before ? 'Kenaikan volume menuntut penyesuaian SDM, sarpras, dan logistik serta pengendalian biaya sesuai komposisi kasus' : after < before ? 'Penurunan volume menuntut penyesuaian alokasi SDM dan sarpras serta pengendalian biaya tetap sesuai komposisi kasus' : 'Volume yang tetap memerlukan penyesuaian SDM, sarpras, dan logistik apabila komposisi kasus berubah') + '; margin aktual belum dapat dihitung tanpa data biaya.';
    return first + ' ' + second + ' ' + third;
  }
  function recommendations(service, competency, simulation) {
    const insight = evaluate({competency, simulation, levels: simulation.insightLevels});
    const fmt = n => n.toLocaleString('id-ID', {maximumFractionDigits: 2});
    const names = {1:'Dasar',2:'Madya',3:'Utama',4:'Paripurna'};
    const volume = insight.caseDelta > 0
      ? 'Perhatikan kesiapan SDM, sarpras, dan logistik RS dalam merespons kenaikan pasien layanan ' + service + ' ' + (insight.casePct === null ? 'sebanyak ' + fmt(insight.caseDelta) + ' kasus' : '+' + fmt(insight.casePct * 100) + '%') + (insight.complexGrowth > 0 ? ', termasuk tambahan kasus Utama/Paripurna' : '') + '.'
      : insight.complexGrowth > 0 ? 'Sesuaikan kompetensi SDM dan sarpras layanan ' + service + ' untuk tambahan kasus Utama/Paripurna meskipun total pasien tidak meningkat.'
      : 'Sesuaikan alokasi SDM dan sarpras layanan ' + service + (insight.caseDelta < 0 ? ' dengan penurunan pasien ' + fmt(Math.abs(insight.caseDelta)) + ' kasus' : ' dengan volume pasien yang tetap') + '.';
    const competencyAdvice = insight.opportunity === 'upgrade'
      ? 'Prioritaskan persiapan peningkatan kompetensi layanan ' + service + ' menjadi ' + names[competency + 1] + ' berdasarkan kebutuhan kasus regional per penyedia, disertai pemenuhan SDM dan sarpras.'
      : insight.opportunity === 'unknown' || insight.opportunity === 'no-data' ? 'Lengkapi data kompetensi dan kebutuhan regional layanan ' + service + ' sebelum menentukan pengembangan layanan.'
      : 'Optimalkan layanan ' + service + ' pada kompetensi ' + names[competency] + ' untuk menangani proyeksi pasien sesuai hasil simulasi.';
    const avgBefore = simulation.baselineCases > 0 ? simulation.baselineIna / simulation.baselineCases : 0;
    const avgAfter = simulation.projectedCases > 0 ? simulation.projectedIdrg / simulation.projectedCases : null;
    const avgPct = avgBefore > 0 && avgAfter !== null ? (avgAfter / avgBefore - 1) * 100 : null;
    const efficiency = avgPct !== null && avgPct < 0
      ? 'RS didorong melakukan efisiensi layanan ' + service + ' karena pendapatan rata-rata per kasus turun ' + fmt(-avgPct) + '%; kendalikan biaya agar margin per kasus tidak tertekan tanpa mengurangi mutu.'
      : insight.incomeDelta < 0 ? 'RS didorong melakukan efisiensi layanan ' + service + ' karena pendapatan turun; sesuaikan biaya operasional dengan beban pasien tanpa mengurangi mutu.'
      : 'Jaga efisiensi dan mutu layanan ' + service + ' agar perubahan pendapatan diikuti pengendalian biaya operasional; margin aktual tetap memerlukan data biaya.';
    return [volume, competencyAdvice, efficiency];
  }
  root.ServiceInsights = { evaluate, executiveSummary, recommendations };
})(typeof window === 'undefined' ? globalThis : window);
