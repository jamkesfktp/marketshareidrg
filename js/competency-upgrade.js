(function () {
  "use strict";

  const emptyMetric = (length = 3) => Array(length).fill(0);
  const addMetric = (left, right) => Array.from({ length: Math.max(left.length, right.length) }, (_, index) => (left[index] || 0) + (right[index] || 0));
  const scaleMetric = (metric, rate) => metric.map((value) => (value || 0) * rate);

  function canServe(competency, level) {
    return competency >= 1 && competency <= 4 && (competency === level || competency === level + 1);
  }

  function simulateUpgrade(options) {
    const {
      service,
      target,
      hospitals,
      regionalService,
      targetCompetency,
      targetLevel,
      captureMultiplier = 1,
      retentionRate = 1,
      getCompetency,
      severityMetric,
      casesIndex = 0,
      inaIndex = 1,
      idrgIndex = 2,
    } = options;

    const targetService = target?.services?.[service];
    const metricLength = Math.max(targetService?.total?.length || 0, regionalService?.total?.length || 0, idrgIndex + 1);
    const existing = targetService?.total ? [...targetService.total] : emptyMetric(metricLength);
    let projected = targetService?.unclassified ? [...targetService.unclassified] : emptyMetric(metricLength);
    let retained = targetService?.unclassified ? [...targetService.unclassified] : emptyMetric(metricLength);
    let captured = emptyMetric(metricLength);
    const levelRows = [];

    [1, 2, 3, 4].forEach((level) => {
      const existingLevel = severityMetric(targetService, level);
      const regionalLevel = severityMetric(regionalService, level);
      const external = regionalLevel.map((value, index) => Math.max(0, (value || 0) - (existingLevel[index] || 0)));
      const eligible = canServe(targetLevel, level);
      const competitors = hospitals.filter((hospital) =>
        hospital.code !== target?.code && canServe(getCompetency(hospital, service), level)
      ).length;
      const naturalShare = competitors > 0 ? 1 / (competitors + 1) : 1;
      const captureRate = eligible ? Math.min(1, Math.max(0, naturalShare * captureMultiplier)) : 0;
      const kept = eligible ? scaleMetric(existingLevel, retentionRate) : emptyMetric(metricLength);
      const won = eligible ? scaleMetric(external, captureRate) : emptyMetric(metricLength);
      retained = addMetric(retained, kept);
      captured = addMetric(captured, won);
      projected = addMetric(projected, addMetric(kept, won));
      levelRows.push({ level, eligible, competitors, naturalShare, captureRate, existing: existingLevel, external, retained: kept, captured: won });
    });

    return {
      service,
      targetCompetency,
      targetLevel,
      existing,
      retained,
      captured,
      projected,
      deltaCases: projected[casesIndex] - (existing[casesIndex] || 0),
      deltaIdrgVsExisting: projected[idrgIndex] - (existing[idrgIndex] || 0),
      deltaIdrgVsIna: projected[idrgIndex] - (existing[inaIndex] || 0),
      levelRows,
    };
  }

  window.CompetencyUpgrade = { canServe, simulateUpgrade };
})();
