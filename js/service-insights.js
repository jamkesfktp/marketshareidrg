(function (root) {
  'use strict';
  // Planning indicators, not clinical accreditation or measured provider capacity.
  function evaluate(input) {
    const { competency, levels, simulation, capacity } = input;
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
    const hasCapacity = typeof capacity === 'number' && Number.isFinite(capacity) && capacity >= 0;
    let readiness = 'stable';
    if (caseDelta > 0) readiness = !hasCapacity ? 'verify' : caseDelta > capacity ? 'surge' : 'within';
    else if (complexGrowth > 0) readiness = 'complex';
    else if (caseDelta < 0) readiness = 'decline';
    return { opportunity, readiness, caseDelta, incomeDelta, complexGrowth, currentLoad, nextLoad,
      casePct: simulation.baselineCases > 0 ? caseDelta / simulation.baselineCases : null,
      incomePct: simulation.baselineIna > 0 ? incomeDelta / simulation.baselineIna : null,
      capacity: hasCapacity ? capacity : null };
  }
  root.ServiceInsights = { evaluate };
})(typeof window === 'undefined' ? globalThis : window);
