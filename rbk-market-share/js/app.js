(function marketShareSimulator() {
  "use strict";

  const originalData = window.marketSimulatorData;
  if (!originalData) throw new Error("Dataset simulator tidak tersedia.");
  let data = originalData;

  const CASES = 0;
  const INA = 1;
  const IDRG = 2;
  const severityRanks = [1, 2, 3, 4];
  const levelNames = { 0: "Tidak terpetakan", 1: "Dasar", 2: "Madya", 3: "Utama", 4: "Paripurna" };
  const shortLevelNames = { 1: "D", 2: "M", 3: "U", 4: "P" };
  
  let hospitalByCode = new Map();
  let hospitalClassCounts = {};
  
  function updateDataState() {
    hospitalByCode = new Map(data.hospitals.map((hospital) => [hospital.code, hospital]));
    hospitalClassCounts = ["A", "B", "C", "D"].reduce((counts, className) => {
      counts[className] = data.hospitals.filter((hospital) => String(hospital.class || "").trim().toUpperCase() === className).length;
      return counts;
    }, {});
  }
  updateDataState();
  
  const defaultTarget = hospitalByCode.has(data.meta.defaultTargetCode)
    ? data.meta.defaultTargetCode
    : (data.hospitals.length > 0 ? data.hospitals[0].code : "");

  const state = {
    targetCode: defaultTarget,
    activeSlide: 0,
    selectedService: data.services.includes("JIWA") ? "JIWA" : data.services[0],
    selectedSeverity: 4,
    targetShare: 50,
    globalRates: {
      capture: { 1: 0, 2: 0, 3: 20, 4: 20 },
      retention: { 1: 50, 2: 50, 3: 100, 4: 100 },
    },
    overrides: {},
  };

  let liveRenderTimer = null;
  function scheduleLiveRender(render, delay = 280) {
    window.clearTimeout(liveRenderTimer);
    liveRenderTimer = window.setTimeout(() => {
      liveRenderTimer = null;
      render();
    }, delay);
  }

  function flushLiveRender(render) {
    window.clearTimeout(liveRenderTimer);
    liveRenderTimer = null;
    render();
  }

  const numberFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const decimalFormatter = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const compactFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const metric = (value) => Array.isArray(value) ? value : [0, 0, 0];
  const severityMetric = (container, rank) => metric(container?.severity?.[rank]);
  const addMetrics = (left, right) => [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
  const subtractMetrics = (left, right) => [
    Math.max(left[0] - right[0], 0),
    Math.max(left[1] - right[1], 0),
    Math.max(left[2] - right[2], 0),
  ];
  const multiplyMetric = (value, factor) => value.map((item) => item * factor);
  const sumMetrics = (values) => values.reduce(addMetrics, [0, 0, 0]);

  const formatNumber = (value) => numberFormatter.format(Math.round(Number(value) || 0));
  const formatSignedNumber = (value) => {
    const numeric = Math.round(Number(value) || 0);
    if (numeric === 0) return "0";
    return `${numeric > 0 ? "+" : "−"}${formatNumber(Math.abs(numeric))}`;
  };
  const formatMoney = (value) => {
    const numeric = Number(value) || 0;
    const absolute = Math.abs(numeric);
    const sign = numeric < 0 ? "−" : "";
    if (absolute >= 1e12) return `${sign}Rp${compactFormatter.format(absolute / 1e12)} T`;
    if (absolute >= 1e9) return `${sign}Rp${compactFormatter.format(absolute / 1e9)} M`;
    if (absolute >= 1e6) return `${sign}Rp${compactFormatter.format(absolute / 1e6)} Jt`;
    return `${sign}Rp${numberFormatter.format(absolute)}`;
  };
  const formatMatrixMoney = (value) => {
    const numeric = Number(value) || 0;
    const absolute = Math.abs(numeric);
    const sign = numeric < 0 ? "−" : "";
    if (absolute >= 1e12) return `${sign}${compactFormatter.format(absolute / 1e12)} T`;
    if (absolute >= 1e9) return `${sign}${compactFormatter.format(absolute / 1e9)} M`;
    if (absolute >= 1e6) return `${sign}${compactFormatter.format(absolute / 1e6)} JT`;
    if (absolute >= 1e3) return `${sign}${compactFormatter.format(absolute / 1e3)} RB`;
    return `${sign}${numberFormatter.format(absolute)}`;
  };
  const formatPercent = (value) => `${decimalFormatter.format((Number(value) || 0) * 100)}%`;

  const serviceAliases = {
    "ALERGI IMUNOLOGI DAN RHEUMATOLOGI": "Alergi, Imunologi & Rheumatologi",
    "ENDOKRIN, NUTRISI DAN METABOLIK": "Endokrin, Nutrisi & Metabolik",
    "GIGI DAN MULUT": "Gigi & Mulut",
    "IBU DAN GINEKOLOGI": "Ibu & Ginekologi",
    "INFEKSI DAN PARASIT": "Infeksi & Parasit",
    "JANTUNG DAN PEMBULUH DARAH": "Jantung & Pembuluh Darah",
    "KULIT & PENYAKIT KELAMIN": "Kulit & Penyakit Kelamin",
    "LUKA BAKAR": "Luka Bakar",
    "MUSCULOSKELETAL DAN JARINGAN LUNAK": "Muskuloskeletal & Jaringan Lunak",
    "PARU DAN PERNAFASAN": "Paru & Pernafasan",
    "PENCERNAAN DAN HEPATOBILIER": "Pencernaan & Hepatobilier",
    "REKONSTRUKSI DAN ESTETIKA": "Rekonstruksi & Estetika",
    "SARAF/ NEUROSCIENCE": "Saraf / Neuroscience",
    "URO NEFRO": "Uro Nefro",
  };
  const formatService = (service) => serviceAliases[service] || service
    .toLocaleLowerCase("id-ID")
    .replace(/(^|\s|\/)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);

  const targetHospital = () => hospitalByCode.get(state.targetCode);
  const targetService = (service) => targetHospital()?.services?.[service] || null;
  const regionalService = (service) => data.regional.services[service] || { total: [0, 0, 0], severity: {} };
  const getCompetency = (hospital, service) => Number(hospital?.services?.[service]?.competency) || 0;
  const overrideFor = (service) => state.overrides[service];
  const rateFor = (service, type, rank) => {
    const override = overrideFor(service);
    return override?.enabled ? override[type][rank] : state.globalRates[type][rank];
  };

  function computeAddressable() {
    const target = targetHospital();
    const rows = data.services.map((service) => {
      const targetItem = target?.services?.[service];
      const regionalItem = regionalService(service);
      const competency = getCompetency(target, service);
      const eligibleRegional = sumMetrics(
        severityRanks
          .filter((rank) => rank <= competency)
          .map((rank) => severityMetric(regionalItem, rank)),
      );
      const eligibleExisting = sumMetrics(
        severityRanks
          .filter((rank) => rank <= competency)
          .map((rank) => severityMetric(targetItem, rank)),
      );
      const external = subtractMetrics(eligibleRegional, eligibleExisting);
      const competitors = competency
        ? data.hospitals.filter((hospital) => hospital.code !== target.code && getCompetency(hospital, service) >= competency).length
        : 0;
      return { service, competency, eligibleRegional, eligibleExisting, external, competitors };
    });
    return {
      rows,
      eligibleRegional: sumMetrics(rows.map((row) => row.eligibleRegional)),
      eligibleExisting: sumMetrics(rows.map((row) => row.eligibleExisting)),
      external: sumMetrics(rows.map((row) => row.external)),
      mappedServices: rows.filter((row) => row.competency > 0).length,
    };
  }

  function computeScenario() {
    const target = targetHospital();
    const serviceRows = data.services.map((service) => {
      const targetItem = target?.services?.[service];
      const regionalItem = regionalService(service);
      const competency = getCompetency(target, service);
      let projected = metric(targetItem?.unclassified);
      let retained = metric(targetItem?.unclassified);
      let captured = [0, 0, 0];

      const severities = severityRanks.map((rank) => {
        const existing = severityMetric(targetItem, rank);
        const regional = severityMetric(regionalItem, rank);
        const external = subtractMetrics(regional, existing);
        const capable = competency >= rank;
        const captureRate = rateFor(service, "capture", rank) / 100;
        const retentionRate = rateFor(service, "retention", rank) / 100;
        const retainedMetric = capable ? multiplyMetric(existing, retentionRate) : [0, 0, 0];
        const capturedMetric = capable ? multiplyMetric(external, captureRate) : [0, 0, 0];
        const projectedMetric = addMetrics(retainedMetric, capturedMetric);
        projected = addMetrics(projected, projectedMetric);
        retained = addMetrics(retained, retainedMetric);
        captured = addMetrics(captured, capturedMetric);
        return {
          rank,
          capable,
          existing,
          regional,
          external,
          captureRate,
          retentionRate,
          retained: retainedMetric,
          captured: capturedMetric,
          projected: projectedMetric,
        };
      });

      const existing = metric(targetItem?.total);
      const delta = projected.map((value, index) => value - existing[index]);
      return { service, competency, existing, projected, retained, captured, delta, severities };
    });

    const existing = metric(target?.total);
    const projected = sumMetrics(serviceRows.map((row) => row.projected));
    const captured = sumMetrics(serviceRows.map((row) => row.captured));
    const retained = sumMetrics(serviceRows.map((row) => row.retained));
    const delta = projected.map((value, index) => value - existing[index]);
    return { serviceRows, existing, projected, captured, retained, delta };
  }

  function competitorsFor(service, rank) {
    const target = targetHospital();
    const targetCompetency = getCompetency(target, service);
    const minimumCompetency = Math.max(targetCompetency, rank);
    const regional = severityMetric(regionalService(service), rank);
    const targetExisting = severityMetric(target?.services?.[service], rank);
    const rows = data.hospitals
      .filter((hospital) => hospital.code !== target?.code && getCompetency(hospital, service) >= minimumCompetency)
      .map((hospital) => {
        const existing = severityMetric(hospital.services?.[service], rank);
        return {
          hospital,
          competency: getCompetency(hospital, service),
          existing,
          share: regional[CASES] ? existing[CASES] / regional[CASES] : 0,
        };
      })
      .sort((a, b) => b.existing[CASES] - a.existing[CASES]);
    const competitorHeld = sumMetrics(rows.map((row) => row.existing));
    const external = subtractMetrics(regional, targetExisting);
    const outsideCapable = subtractMetrics(external, competitorHeld);
    return { regional, targetExisting, external, rows, competitorHeld, outsideCapable, targetCompetency, minimumCompetency };
  }

  const levelBadge = (rank) => `<span class="level-badge level-${rank}">${escapeHtml(levelNames[rank])}</span>`;
  const capabilityCells = (competency) => `<span class="capability-cells">${severityRanks.map((rank) =>
    `<span class="capability-cell ${rank <= competency ? "is-capable" : ""}">${shortLevelNames[rank]}</span>`).join("")}</span>`;
  const deltaClass = (value) => value > 0 ? "delta-positive" : value < 0 ? "delta-negative" : "delta-neutral";

  function renderExistingSlide() {
    const target = targetHospital();
    const delta = target.total[IDRG] - target.total[INA];
    const deltaPercent = target.total[INA] ? delta / target.total[INA] : 0;
    const unclassifiedCases = metric(target.unclassified)[CASES];
    const severityTotals = Object.fromEntries(severityRanks.map((rank) => [rank,
      sumMetrics(data.services.map((service) => severityMetric(target.services?.[service], rank))),
    ]));
    const rankedServices = data.services
      .map((service) => ({ service, total: metric(target.services?.[service]?.total) }))
      .sort((a, b) => b.total[CASES] - a.total[CASES] || a.service.localeCompare(b.service));
    const displayCases = (value) => value ? formatNumber(value) : "—";
    const displayMoney = (value) => value ? formatMatrixMoney(value) : "—";

    document.getElementById("slide1Title").textContent = `Kasus Eksisting Per Layanan - ${target.name}`;
    document.getElementById("existingSlide").innerHTML = `
      <div class="existing-report-kpis">
        <article class="existing-report-kpi kpi-cases"><span>Total Kasus:</span><strong>${formatNumber(target.total[CASES])}</strong><em>Jumlah kasus eklaim</em></article>
        <article class="existing-report-kpi kpi-ina"><span>Pendapatan INA-CBG:</span><strong>${formatMoney(target.total[INA])}</strong><em>Dari data 8 bulan</em></article>
        <article class="existing-report-kpi kpi-idrg"><span>Pendapatan iDRG:</span><strong>${formatMoney(target.total[IDRG])}</strong><em>Klaim uji coba iDRG</em></article>
        <article class="existing-report-kpi kpi-difference ${delta < 0 ? "is-loss" : "is-gain"}"><span>Selisih Pendapatan:</span><strong>${formatMoney(delta)}</strong><em>iDRG − INA-CBG</em></article>
        <article class="existing-report-kpi kpi-percentage ${delta < 0 ? "is-loss" : "is-gain"}"><span>Persentase:</span><strong>${formatPercent(deltaPercent)}</strong><em>Dari pendapatan INA-CBG</em></article>
      </div>
      <div class="existing-matrix-wrap">
        <table class="existing-matrix-table" aria-label="Kasus eksisting per layanan diurutkan berdasarkan persentase kasus terbesar">
          <thead>
            <tr><th rowspan="2" class="matrix-no">No</th><th rowspan="2" class="matrix-service">Layanan RS</th><th rowspan="2" class="matrix-competency">Kompetensi</th><th rowspan="2" class="matrix-total matrix-summary">Total Kasus</th><th rowspan="2" class="matrix-share matrix-summary">% Kasus</th><th rowspan="2" class="matrix-total-ina matrix-summary">Total INA-CBG</th><th rowspan="2" class="matrix-total-idrg matrix-summary">Total iDRG</th>${severityRanks.map((rank) => `<th colspan="3">${levelNames[rank]}</th>`).join("")}</tr>
            <tr>${severityRanks.map(() => `<th>Kasus</th><th>INA-CBG</th><th>iDRG</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rankedServices.map(({ service, total }, index) => {
              const item = target.services?.[service];
              const competency = getCompetency(target, service);
              const caseShare = target.total[CASES] ? total[CASES] / target.total[CASES] : 0;
              return `<tr><td class="matrix-no">${index + 1}</td><td class="matrix-service">${escapeHtml(formatService(service))}</td><td class="matrix-competency">${levelNames[competency]}</td><td class="matrix-total matrix-summary num">${displayCases(total[CASES])}</td><td class="matrix-share matrix-summary num">${formatPercent(caseShare)}</td><td class="matrix-total-ina matrix-summary num">${displayMoney(total[INA])}</td><td class="matrix-total-idrg matrix-summary num">${displayMoney(total[IDRG])}</td>${severityRanks.map((rank) => { const value = severityMetric(item, rank); return `<td class="num">${displayCases(value[CASES])}</td><td class="num">${displayMoney(value[INA])}</td><td class="num">${displayMoney(value[IDRG])}</td>`; }).join("")}</tr>`;
            }).join("")}
          </tbody>
          <tfoot><tr><td></td><td colspan="2">Total D–M–U–P · ${formatNumber(unclassifiedCases)} kasus belum terklasifikasi</td><td class="matrix-total matrix-summary num">${formatNumber(target.total[CASES])}</td><td class="matrix-share matrix-summary num">100%</td><td class="matrix-total-ina matrix-summary num">${formatMatrixMoney(target.total[INA])}</td><td class="matrix-total-idrg matrix-summary num">${formatMatrixMoney(target.total[IDRG])}</td>${severityRanks.map((rank) => { const value = severityTotals[rank]; return `<td class="num">${formatNumber(value[CASES])}</td><td class="num">${formatMatrixMoney(value[INA])}</td><td class="num">${formatMatrixMoney(value[IDRG])}</td>`; }).join("")}</tr></tfoot>
        </table>
      </div>`;
  }

  function renderRegionalSlide() {
    const maxCases = Math.max(...severityRanks.map((rank) => severityMetric(data.regional, rank)[CASES]), 1);
    const maxIdrg = Math.max(...severityRanks.map((rank) => severityMetric(data.regional, rank)[IDRG]), 1);
    document.getElementById("regionalSlide").innerHTML = `
      <div class="kpi-grid">
        <article class="kpi-card is-primary"><div class="kpi-label">Total kasus regional</div><div class="kpi-value">${formatNumber(data.regional.total[CASES])}</div><div class="kpi-note">363 rumah sakit pada sumber</div></article>
        <article class="kpi-card"><div class="kpi-label">Pendapatan regional iDRG</div><div class="kpi-value">${formatMoney(data.regional.total[IDRG])}</div><div class="kpi-note">Skenario 2 workbook</div></article>
        <article class="kpi-card"><div class="kpi-label">Layanan pada workbook</div><div class="kpi-value">${data.meta.sourceServiceCount}/24</div><div class="kpi-note">Tidak tersedia: ${escapeHtml(data.meta.missingServices.join(", "))}</div></article>
        <article class="kpi-card"><div class="kpi-label">Belum ada kompetensi ICD</div><div class="kpi-value">${formatNumber(data.meta.unclassifiedSeverityCases)}</div><div class="kpi-note">Ditampilkan terpisah dari D–M–U–P</div></article>
      </div>
      <div class="regional-layout">
        <div class="regional-left">
          <article class="panel"><div class="panel-heading"><h2>Distribusi kasus D–M–U–P</h2><span>Jumlah kasus</span></div><div class="severity-bars">
            ${severityRanks.map((rank) => { const value = severityMetric(data.regional, rank)[CASES]; return `<div class="metric-bar-row"><span>${levelNames[rank]}</span><div class="bar-track"><div class="bar-fill level-${rank}" style="width:${(value / maxCases) * 100}%"></div></div><strong>${formatNumber(value)}</strong></div>`; }).join("")}
          </div></article>
          <article class="panel"><div class="panel-heading"><h2>Potensi pendapatan iDRG</h2><span>Menurut keparahan</span></div><div class="severity-bars">
            ${severityRanks.map((rank) => { const value = severityMetric(data.regional, rank)[IDRG]; return `<div class="metric-bar-row"><span>${levelNames[rank]}</span><div class="bar-track"><div class="bar-fill level-${rank}" style="width:${(value / maxIdrg) * 100}%"></div></div><strong>${formatMoney(value)}</strong></div>`; }).join("")}
          </div></article>
          <article class="panel hospital-class-panel">
            <div class="panel-heading"><h2>Sebaran kelas rumah sakit</h2><span>${formatNumber(data.hospitals.length)} RS unik</span></div>
            <div class="hospital-class-grid">
              ${["A", "B", "C", "D"].map((className) => `<div class="hospital-class-item"><span>Kelas ${className}</span><strong>${formatNumber(hospitalClassCounts[className])} RS</strong><em>${formatPercent(hospitalClassCounts[className] / data.hospitals.length)}</em></div>`).join("")}
            </div>
          </article>
        </div>
        <article class="panel">
          <div class="panel-heading"><h2>Market regional berdasarkan layanan</h2><span>Kasus dan iDRG</span></div>
          <div class="service-market-grid">
            ${data.services.map((service) => { const item = regionalService(service); return `<div class="service-market-row"><span>${escapeHtml(formatService(service))}</span><strong>${formatNumber(item.total[CASES])}</strong><em>${formatMoney(item.total[IDRG])}</em></div>`; }).join("")}
          </div>
          <p class="source-note">Total regional direkonsiliasi dengan seluruh baris sumber. Kasus “0. Belum ada komp. ICD” masuk total layanan, namun tidak dimasukkan ke salah satu tingkat D–M–U–P.</p>
        </article>
      </div>`;
  }

  function renderAddressableSlide() {
    const target = targetHospital();
    const result = computeAddressable();
    document.getElementById("slide3Subtitle").textContent = `Kompetensi ${target.name} menentukan tingkat keparahan yang mampu dilayani.`;
    document.getElementById("addressableSlide").innerHTML = `
      <div class="kpi-grid addressable-kpis">
        <article class="kpi-card is-primary"><div class="kpi-label">Addressable cases</div><div class="kpi-value">${formatNumber(result.eligibleRegional[CASES])}</div><div class="kpi-note">Kasus regional sesuai kemampuan target</div></article>
        <article class="kpi-card"><div class="kpi-label">Addressable iDRG</div><div class="kpi-value">${formatMoney(result.eligibleRegional[IDRG])}</div><div class="kpi-note">Potensi nilai seluruh pool</div></article>
        <article class="kpi-card"><div class="kpi-label">External available market</div><div class="kpi-value">${formatNumber(result.external[CASES])}</div><div class="kpi-note">RS target telah dikeluarkan</div></article>
        <article class="kpi-card"><div class="kpi-label">Layanan terpetakan</div><div class="kpi-value">${result.mappedServices}/24</div><div class="kpi-note">Kemampuan target pada sumber</div></article>
      </div>
      <article class="panel addressable-table-panel">
        <div class="table-wrap addressable-table-wrap"><table class="compact-table addressable-matrix-table"><colgroup><col class="addressable-service-col"><col class="addressable-competency-col"><col class="addressable-capability-col"><col class="addressable-number-col"><col class="addressable-number-col"><col class="addressable-number-col"><col class="addressable-money-col"><col class="addressable-competitor-col"></colgroup><thead><tr><th>Layanan</th><th>Kompetensi target</th><th>Keparahan yang mampu dilayani</th><th class="num">Kasus regional eligible</th><th class="num">Eksisting eligible</th><th class="num">External pool</th><th class="num">iDRG external</th><th class="num">Kompetitor setara</th></tr></thead><tbody>
          ${result.rows.map((row) => `<tr class="${row.competency ? "" : "is-disabled"}"><td class="service-name">${escapeHtml(formatService(row.service))}</td><td>${levelBadge(row.competency)}</td><td>${capabilityCells(row.competency)}</td><td class="num">${formatNumber(row.eligibleRegional[CASES])}</td><td class="num">${formatNumber(row.eligibleExisting[CASES])}</td><td class="num">${formatNumber(row.external[CASES])}</td><td class="num">${formatMoney(row.external[IDRG])}</td><td class="num">${formatNumber(row.competitors)}</td></tr>`).join("")}
        </tbody></table></div>
      </article>`;
  }

  function renderComparisonSlide() {
    const target = targetHospital();
    const regionalTotal = metric(data.regional.total);
    const delta = regionalTotal[IDRG] - regionalTotal[INA];
    const deltaPercent = regionalTotal[INA] ? delta / regionalTotal[INA] : 0;
    const targetSeverityTotals = Object.fromEntries(severityRanks.map((rank) => [rank,
      sumMetrics(data.services.map((service) => severityMetric(target.services?.[service], rank))),
    ]));
    const otherSeverityTotals = Object.fromEntries(severityRanks.map((rank) => [rank,
      subtractMetrics(severityMetric(data.regional, rank), targetSeverityTotals[rank]),
    ]));
    const displayCases = (value) => value ? formatNumber(value) : "—";
    const displayMoney = (value) => value ? formatMatrixMoney(value) : "—";
    const metricCells = (item, sideClass) => severityRanks.map((rank) => {
      const value = item(rank);
      const startClass = rank === 1 ? ` ${sideClass}-start` : "";
      return `<td class="num ${sideClass}${startClass}">${displayCases(value[CASES])}</td><td class="num ${sideClass}">${displayMoney(value[IDRG])}</td>`;
    }).join("");

    document.getElementById("comparisonSlideTitle").textContent = `Kasus Target vs RS Lain Per Layanan - ${target.name}`;
    document.getElementById("comparisonSlide").innerHTML = `
      <div class="existing-report-kpis">
        <article class="existing-report-kpi kpi-cases"><span>Total Kasus Regional:</span><strong>${formatNumber(regionalTotal[CASES])}</strong><em>Seluruh rumah sakit regional</em></article>
        <article class="existing-report-kpi kpi-ina"><span>INA-CBG Regional:</span><strong>${formatMoney(regionalTotal[INA])}</strong><em>Pendapatan regional</em></article>
        <article class="existing-report-kpi kpi-idrg"><span>iDRG Regional:</span><strong>${formatMoney(regionalTotal[IDRG])}</strong><em>Potensi pendapatan regional</em></article>
        <article class="existing-report-kpi kpi-difference ${delta < 0 ? "is-loss" : "is-gain"}"><span>Selisih Regional:</span><strong>${formatMoney(delta)}</strong><em>iDRG - INA-CBG regional</em></article>
        <article class="existing-report-kpi kpi-percentage ${delta < 0 ? "is-loss" : "is-gain"}"><span>Persentase Regional:</span><strong>${formatPercent(deltaPercent)}</strong><em>Dari pendapatan INA-CBG regional</em></article>
      </div>
      <div class="existing-matrix-wrap">
        <table class="existing-matrix-table comparison-matrix-table" aria-label="Perbandingan kasus dan iDRG RS target dengan RS lainnya per layanan dan tingkat keparahan">
          <thead>
            <tr><th rowspan="2" class="matrix-no">No</th><th rowspan="2" class="matrix-service">Layanan RS</th><th rowspan="2" class="matrix-competency">Kompetensi</th>${severityRanks.map((rank) => `<th colspan="4" class="comparison-target-heading" style="border-left: 2px solid #007b83;">${levelNames[rank]}</th>`).join("")}</tr>
            <tr>${severityRanks.map((rank) => `<th class="comparison-target" style="border-left: 2px solid #007b83;">Kasus RS</th><th class="comparison-other">Kasus Regional</th><th class="comparison-target">iDRG RS</th><th class="comparison-other">iDRG Regional</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${data.services.map((service, index) => {
              const targetItem = target.services?.[service];
              const competency = getCompetency(target, service);
              
              const combinedCells = severityRanks.map(rank => {
                const targetVal = severityMetric(targetItem, rank);
                const otherVal = subtractMetrics(severityMetric(regionalService(service), rank), severityMetric(targetItem, rank));
                return `<td class="num comparison-target" style="border-left: 2px solid #007b83;">${displayCases(targetVal[CASES])}</td><td class="num comparison-other">${displayCases(otherVal[CASES])}</td><td class="num comparison-target">${displayMoney(targetVal[IDRG])}</td><td class="num comparison-other">${displayMoney(otherVal[IDRG])}</td>`;
              }).join("");
              
              return `<tr><td class="matrix-no">${index + 1}</td><td class="matrix-service">${escapeHtml(formatService(service))}</td><td class="matrix-competency">${levelNames[competency]}</td>${combinedCells}</tr>`;
            }).join("")}
          </tbody>
          <tfoot><tr><td></td><td colspan="2">Total D–M–U–P</td>${severityRanks.map(rank => {
            const targetVal = targetSeverityTotals[rank];
            const otherVal = otherSeverityTotals[rank];
            return `<td class="num comparison-target" style="border-left: 2px solid #007b83;">${displayCases(targetVal[CASES])}</td><td class="num comparison-other">${displayCases(otherVal[CASES])}</td><td class="num comparison-target">${displayMoney(targetVal[IDRG])}</td><td class="num comparison-other">${displayMoney(otherVal[IDRG])}</td>`;
          }).join("")}</tr></tfoot>
        </table>
      </div>`;
  }

  function renderRegionalProfileSlide() {
    const target = targetHospital();
    const classifiedCases = sumMetrics(severityRanks.map((rank) => severityMetric(data.regional, rank)))[CASES];
    const leadingSeverity = severityRanks
      .map((rank) => ({ rank, value: severityMetric(data.regional, rank) }))
      .sort((a, b) => b.value[CASES] - a.value[CASES])[0];
    const topHospitals = [...data.hospitals]
      .sort((a, b) => b.total[CASES] - a.total[CASES])
      .slice(0, 5);

    document.getElementById("regionalProfileSlideTitle").textContent = `Profil & Kasus Regional - ${target.name}`;
    document.getElementById("regionalProfileSlide").innerHTML = `
      <div class="regional-profile-layout">
        <div class="regional-map-column">
          <div class="regional-map-crop" role="img" aria-label="Peta ilustratif wilayah regional Jawa Tengah"><img src="assets/regional-profile-reference.png" alt=""></div>
          <strong>Regional wilayah Jawa Tengah</strong>
        </div>
        <div class="regional-profile-main">
          <section class="regional-profile-summary" aria-label="Ringkasan profil regional">
            <div>
              <h2>Sebaran RS aktif: ${formatNumber(data.hospitals.length)}</h2>
              <div class="regional-class-line">A: ${formatNumber(hospitalClassCounts.A)} <span>|</span> B: ${formatNumber(hospitalClassCounts.B)} <span>|</span> C: ${formatNumber(hospitalClassCounts.C)} <span>|</span> D: ${formatNumber(hospitalClassCounts.D)}</div>
              <dl><div><dt>Total kasus regional</dt><dd>${formatNumber(data.regional.total[CASES])} kasus</dd></div><div><dt>Pendapatan INA-CBG regional</dt><dd>${formatMoney(data.regional.total[INA])}</dd></div><div><dt>Potensi iDRG regional</dt><dd>${formatMoney(data.regional.total[IDRG])}</dd></div></dl>
            </div>
            <img src="assets/icons/hospital.svg" alt="" aria-hidden="true">
          </section>
          <div class="regional-profile-tables">
            <table class="regional-severity-table" aria-label="Distribusi kasus regional berdasarkan tingkat keparahan"><thead><tr><th>Tingkat</th><th class="num">Kasus</th><th class="num">%</th></tr></thead><tbody>${severityRanks.map((rank) => { const value = severityMetric(data.regional, rank); return `<tr><td>${levelNames[rank]}</td><td class="num">${formatNumber(value[CASES])}</td><td class="num">${formatPercent(classifiedCases ? value[CASES] / classifiedCases : 0)}</td></tr>`; }).join("")}</tbody><tfoot><tr><td>Total regional</td><td class="num">${formatNumber(classifiedCases)}</td><td class="num">100%</td></tr></tfoot></table>
            <table class="regional-ranking-table" aria-label="Lima rumah sakit dengan jumlah kasus terbesar"><thead><tr><th>No</th><th>Rumah sakit</th><th>Kelas</th><th class="num">Kasus</th></tr></thead><tbody>${topHospitals.map((hospital, index) => `<tr class="${hospital.code === target.code ? "is-target" : ""}"><td>${index + 1}</td><td>${escapeHtml(hospital.name)}</td><td>${escapeHtml(hospital.class || "—")}</td><td class="num">${formatNumber(hospital.total[CASES])}</td></tr>`).join("")}</tbody></table>
          </div>
          <aside class="regional-profile-insight"><strong>Ringkasan regional</strong><ul><li>Terdapat ${formatNumber(data.regional.total[CASES])} kasus pada layanan regional yang dianalisis.</li><li>Kasus terbanyak berada pada tingkat ${levelNames[leadingSeverity.rank]}: ${formatPercent(leadingSeverity.value[CASES] / classifiedCases)} (${formatNumber(leadingSeverity.value[CASES])} kasus).</li></ul></aside>
        </div>
      </div>
      <p class="regional-profile-footnote">*Terdapat ${formatNumber(metric(data.regional.unclassified)[CASES])} kasus yang belum memiliki mapping tingkat keparahan.</p>`;
  }

  function renderSimulatorSlide() {
    const result = computeScenario();
    const target = targetHospital();
    const overrideCount = Object.values(state.overrides).filter((item) => item.enabled).length;
    document.getElementById("simulatorSlide").innerHTML = `
      <div class="simulator-layout">
        <article class="panel control-panel">
          <div class="panel-heading"><h2>Asumsi global</h2><span>${overrideCount} override layanan</span></div>
          <table class="assumption-table"><thead><tr><th>Keparahan</th><th>Capture external</th><th>Retensi eksisting</th></tr></thead><tbody>
            ${severityRanks.map((rank) => `<tr><td>${levelNames[rank]}</td><td><span class="input-suffix"><input class="global-rate" data-type="capture" data-rank="${rank}" type="number" min="0" max="100" step="1" value="${state.globalRates.capture[rank]}" aria-label="Capture external ${levelNames[rank]}"></span></td><td><span class="input-suffix"><input class="global-rate" data-type="retention" data-rank="${rank}" type="number" min="0" max="100" step="1" value="${state.globalRates.retention[rank]}" aria-label="Retensi eksisting ${levelNames[rank]}"></span></td></tr>`).join("")}
          </tbody></table>
          <div class="formula-box"><strong>Proyeksi per tingkat:</strong><br>Eksisting × retensi + external pool × capture.<br><br>Kasus di atas kompetensi target tidak dipertahankan. Kasus tanpa klasifikasi ICD tetap pada baseline dan tidak dicapture.</div>
        </article>
        <div class="simulator-main">
          <div class="kpi-grid simulator-kpis">
            <article class="kpi-card is-primary"><div class="kpi-label">Proyeksi total kasus</div><div class="kpi-value">${formatNumber(result.projected[CASES])}</div><div class="kpi-note">${formatSignedNumber(result.delta[CASES])} dari eksisting</div></article>
            <article class="kpi-card"><div class="kpi-label">Kasus hasil capture</div><div class="kpi-value">${formatNumber(result.captured[CASES])}</div><div class="kpi-note">Dari RS lain</div></article>
            <article class="kpi-card"><div class="kpi-label">Proyeksi iDRG</div><div class="kpi-value">${formatMoney(result.projected[IDRG])}</div><div class="kpi-note">${formatMoney(result.delta[IDRG])} vs eksisting</div></article>
            <article class="kpi-card"><div class="kpi-label">Projected regional share</div><div class="kpi-value">${formatPercent(result.projected[CASES] / data.regional.total[CASES])}</div><div class="kpi-note">Eksisting ${formatPercent(target.total[CASES] / data.regional.total[CASES])}</div></article>
          </div>
          <article class="panel simulation-table-panel">
            <div class="panel-heading"><h2>Proyeksi seluruh layanan</h2><span>Klik layanan untuk melihat kompetitor dan override</span></div>
            <div class="table-wrap"><table class="compact-table"><thead><tr><th>Layanan</th><th>Kompetensi</th><th class="num">Eksisting</th><th class="num">Retained</th><th class="num">Captured</th><th class="num">Proyeksi</th><th class="num">Δ kasus</th><th class="num">Proyeksi iDRG</th><th class="num">Δ iDRG</th></tr></thead><tbody>
              ${result.serviceRows.map((row) => `<tr class="${row.service === state.selectedService ? "is-selected" : ""} ${row.competency ? "" : "is-disabled"}"><td><button class="service-button" data-service="${escapeHtml(row.service)}" type="button">${escapeHtml(formatService(row.service))}</button></td><td>${levelBadge(row.competency)}</td><td class="num">${formatNumber(row.existing[CASES])}</td><td class="num">${formatNumber(row.retained[CASES])}</td><td class="num">${formatNumber(row.captured[CASES])}</td><td class="num">${formatNumber(row.projected[CASES])}</td><td class="num ${deltaClass(row.delta[CASES])}">${formatSignedNumber(row.delta[CASES])}</td><td class="num">${formatMoney(row.projected[IDRG])}</td><td class="num ${deltaClass(row.delta[IDRG])}">${formatMoney(row.delta[IDRG])}</td></tr>`).join("")}
            </tbody></table></div>
          </article>
        </div>
      </div>`;
    attachSimulatorEvents();
  }

  function renderCompetitionSlide() {
    const target = targetHospital();
    const service = state.selectedService;
    const rank = state.selectedSeverity;
    const competency = getCompetency(target, service);
    const capable = competency >= rank;
    const competition = competitorsFor(service, rank);
    const override = state.overrides[service] || {
      enabled: false,
      capture: { ...state.globalRates.capture },
      retention: { ...state.globalRates.retention },
    };
    const share = capable ? Math.min(Math.max(state.targetShare, 0), 100) : 0;
    const targetAllocationCases = competition.regional[CASES] * share / 100;
    const targetAllocationIdrg = competition.regional[IDRG] * share / 100;
    const providerCount = competition.rows.length + (capable ? 1 : 0);

    document.getElementById("competitionSlide").innerHTML = `
      <div class="competition-layout">
        <article class="panel competition-controls">
          <div class="field-grid">
            <label class="select-field"><span>Layanan</span><select id="serviceSelect">${data.services.map((item) => `<option value="${escapeHtml(item)}" ${item === service ? "selected" : ""}>${escapeHtml(formatService(item))}</option>`).join("")}</select></label>
            <label class="select-field"><span>Tingkat keparahan</span><select id="severitySelect">${severityRanks.map((item) => `<option value="${item}" ${item === rank ? "selected" : ""}>${levelNames[item]}</option>`).join("")}</select></label>
          </div>
          <div class="share-split">
            <div class="field-grid">
              <label class="number-field"><span>Target share RS target</span><span class="input-suffix"><input id="targetShareInput" type="number" min="0" max="100" step="1" value="${state.targetShare}" ${capable ? "" : "disabled"}></span></label>
              <div class="number-field"><span>Provider setara/mampu</span><input value="${providerCount}" disabled aria-label="Jumlah provider setara yang mampu"></div>
            </div>
            <div class="share-track" aria-label="Pembagian target market share"><div class="share-target" style="width:${share}%">${share ? `${share}% target` : ""}</div><div class="share-competitors" style="width:${100 - share}%">${100 - share}% kompetitor</div></div>
            <div class="allocation-result"><div><span>Target kasus pada share tersebut</span><strong>${formatNumber(targetAllocationCases)}</strong></div><div><span>Target iDRG pada share tersebut</span><strong>${formatMoney(targetAllocationIdrg)}</strong></div></div>
          </div>
          <div>
            <div class="override-header"><div><strong>Override ${escapeHtml(formatService(service))}</strong><div class="muted" style="font-size:12px">Menggantikan asumsi global pada simulator</div></div><label><input id="overrideEnabled" type="checkbox" ${override.enabled ? "checked" : ""}> Aktifkan</label></div>
            <table class="assumption-table override-table"><thead><tr><th>Keparahan</th><th>Capture</th><th>Retensi</th></tr></thead><tbody>
              ${severityRanks.map((item) => `<tr><td>${levelNames[item]}</td><td><span class="input-suffix"><input class="override-rate" data-type="capture" data-rank="${item}" type="number" min="0" max="100" value="${override.capture[item]}" ${override.enabled ? "" : "disabled"}></span></td><td><span class="input-suffix"><input class="override-rate" data-type="retention" data-rank="${item}" type="number" min="0" max="100" value="${override.retention[item]}" ${override.enabled ? "" : "disabled"}></span></td></tr>`).join("")}
            </tbody></table>
          </div>
        </article>
        <div class="competition-main">
          <div class="kpi-grid competition-summary">
            <article class="kpi-card ${capable ? "is-primary" : "is-negative"}"><div class="kpi-label">Kompetensi target</div><div class="kpi-value">${levelNames[competency]}</div><div class="kpi-note">${capable ? `Mampu melayani ${levelNames[rank]}` : `Tidak mampu melayani ${levelNames[rank]}`}</div></article>
            <article class="kpi-card"><div class="kpi-label">Kasus regional</div><div class="kpi-value">${formatNumber(competition.regional[CASES])}</div><div class="kpi-note">${escapeHtml(formatService(service))} · ${levelNames[rank]}</div></article>
            <article class="kpi-card"><div class="kpi-label">Eksisting RS target</div><div class="kpi-value">${formatNumber(competition.targetExisting[CASES])}</div><div class="kpi-note">Share ${formatPercent(competition.regional[CASES] ? competition.targetExisting[CASES] / competition.regional[CASES] : 0)}</div></article>
            <article class="kpi-card"><div class="kpi-label">External pool</div><div class="kpi-value">${formatNumber(competition.external[CASES])}</div><div class="kpi-note">Target dikeluarkan</div></article>
          </div>
          <article class="panel competitor-table-panel">
            <div class="panel-heading"><h2>RS kompetitor setara yang mampu melayani</h2><span>${competition.rows.length} RS · minimum ${levelNames[competition.minimumCompetency]}</span></div>
            <div class="table-wrap"><table class="compact-table"><thead><tr><th>#</th><th>Rumah sakit</th><th>Kota</th><th>Kompetensi</th><th class="num">Kasus eksisting</th><th class="num">iDRG</th><th class="num">Share regional</th></tr></thead><tbody>
              ${competition.rows.length ? competition.rows.map((row, index) => `<tr><td>${index + 1}</td><td class="service-name">${escapeHtml(row.hospital.name)}</td><td>${escapeHtml(row.hospital.city)}</td><td>${levelBadge(row.competency)}</td><td class="num">${formatNumber(row.existing[CASES])}</td><td class="num">${formatMoney(row.existing[IDRG])}</td><td class="num">${formatPercent(row.share)}</td></tr>`).join("") : `<tr><td colspan="7"><div class="empty-state"><div><strong>Tidak ada RS kompetitor yang memenuhi kemampuan ini.</strong><span>Pilih layanan atau tingkat keparahan lain.</span></div></div></td></tr>`}
              ${competition.outsideCapable[CASES] > 0 ? `<tr class="is-disabled"><td>—</td><td class="service-name">Kasus pada RS di luar kelompok kompetitor setara</td><td>Regional</td><td><span class="level-badge level-0">Di luar kriteria</span></td><td class="num">${formatNumber(competition.outsideCapable[CASES])}</td><td class="num">${formatMoney(competition.outsideCapable[IDRG])}</td><td class="num">${formatPercent(competition.regional[CASES] ? competition.outsideCapable[CASES] / competition.regional[CASES] : 0)}</td></tr>` : ""}
            </tbody></table></div>
          </article>
        </div>
      </div>`;
    attachCompetitionEvents();
  }

  function renderSummarySlide() {
    const target = targetHospital();
    const result = computeScenario();
    const sorted = [...result.serviceRows].sort((a, b) => b.delta[CASES] - a.delta[CASES]);
    const gains = sorted.filter((row) => row.delta[CASES] > 0).slice(0, 5);
    const losses = sorted.filter((row) => row.delta[CASES] < 0).sort((a, b) => a.delta[CASES] - b.delta[CASES]).slice(0, 5);
    const overrideCount = Object.values(state.overrides).filter((item) => item.enabled).length;
    const caseShareBefore = target.total[CASES] / data.regional.total[CASES];
    const caseShareAfter = result.projected[CASES] / data.regional.total[CASES];
    document.getElementById("slide8Subtitle").textContent = `${target.name} · seluruh layanan · parameter dapat diubah pada slide simulator.`;
    const ranked = (rows, emptyText) => rows.length
      ? rows.map((row, index) => `<div class="ranked-row"><span class="rank-number">${index + 1}</span><span>${escapeHtml(formatService(row.service))}</span><strong class="${deltaClass(row.delta[CASES])}">${formatSignedNumber(row.delta[CASES])}</strong></div>`).join("")
      : `<div class="empty-state"><div><strong>${emptyText}</strong><span>Ubah parameter simulasi untuk melihat dampak.</span></div></div>`;
    document.getElementById("summarySlide").innerHTML = `
      <div class="summary-layout">
        <article class="panel summary-hero">
          <h2>Proyeksi total kasus ${escapeHtml(target.name)}</h2>
          <div class="summary-big"><span>Setelah skenario</span><strong>${formatNumber(result.projected[CASES])}</strong><em>${formatSignedNumber(result.delta[CASES])} kasus terhadap baseline · market share ${formatPercent(caseShareBefore)} → ${formatPercent(caseShareAfter)}</em></div>
          <div class="summary-mini-grid">
            <div class="summary-mini"><span>Eksisting</span><strong>${formatNumber(result.existing[CASES])}</strong></div>
            <div class="summary-mini"><span>Captured</span><strong>${formatNumber(result.captured[CASES])}</strong></div>
            <div class="summary-mini"><span>Proyeksi iDRG</span><strong>${formatMoney(result.projected[IDRG])}</strong></div>
            <div class="summary-mini"><span>Δ iDRG</span><strong>${formatMoney(result.delta[IDRG])}</strong></div>
          </div>
        </article>
        <div class="summary-right">
          <article class="panel"><div class="panel-heading"><h2>Layanan dengan penambahan terbesar</h2><span>Δ kasus</span></div><div class="ranked-list">${ranked(gains, "Belum ada penambahan kasus")}</div></article>
          <article class="panel"><div class="panel-heading"><h2>Asumsi dan risiko volume</h2><span>${overrideCount} override aktif</span></div>
            <div class="two-column">
              <div class="ranked-list">${ranked(losses, "Tidak ada layanan yang berkurang")}</div>
              <div class="assumption-summary">${severityRanks.map((rank) => `<div><span>${levelNames[rank]}</span><strong>Capture ${state.globalRates.capture[rank]}% · Retensi ${state.globalRates.retention[rank]}%</strong></div>`).join("")}</div>
            </div>
            <p class="source-note">Proyeksi mempertahankan kasus tanpa klasifikasi ICD pada baseline. Layanan yang tidak memiliki kompetensi target tidak menerima capture dan kasus di atas kompetensi tidak dipertahankan.</p>
          </article>
        </div>
      </div>`;
  }

  function updateTargetMeta() {
    const target = targetHospital();
    document.getElementById("targetMeta").innerHTML = `<strong>${escapeHtml(target.city || "Lokasi tidak tersedia")}</strong><span>Kelas ${escapeHtml(target.class || "—")} · kode ${escapeHtml(target.code)} · ${formatNumber(target.total[CASES])} kasus</span>`;
  }

  function renderAll() {
    updateTargetMeta();
    renderExistingSlide();
    renderRegionalSlide();
    renderAddressableSlide();
    renderComparisonSlide();
    renderRegionalProfileSlide();
    renderSimulatorSlide();
    renderCompetitionSlide();
    renderSummarySlide();
    showSlide(state.activeSlide);
  }

  function attachSimulatorEvents() {
    document.querySelectorAll(".global-rate").forEach((input) => {
      const updateRate = () => {
        const type = input.dataset.type;
        const rank = Number(input.dataset.rank);
        state.globalRates[type][rank] = Math.min(100, Math.max(0, Number(input.value) || 0));
      };
      input.addEventListener("input", () => {
        updateRate();
        scheduleLiveRender(renderAll);
      });
      input.addEventListener("change", () => {
        updateRate();
        flushLiveRender(renderAll);
      });
    });
    document.querySelectorAll(".service-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedService = button.dataset.service;
        state.selectedSeverity = getCompetency(targetHospital(), state.selectedService) || 1;
        state.activeSlide = 4;
        renderCompetitionSlide();
        renderSimulatorSlide();
        showSlide(4);
      });
    });
  }

  function attachCompetitionEvents() {
    document.getElementById("serviceSelect")?.addEventListener("change", (event) => {
      state.selectedService = event.target.value;
      state.selectedSeverity = getCompetency(targetHospital(), state.selectedService) || 1;
      renderCompetitionSlide();
    });
    document.getElementById("severitySelect")?.addEventListener("change", (event) => {
      state.selectedSeverity = Number(event.target.value);
      renderCompetitionSlide();
    });
    const targetShareInput = document.getElementById("targetShareInput");
    const updateTargetShare = () => {
      state.targetShare = Math.min(100, Math.max(0, Number(targetShareInput.value) || 0));
    };
    targetShareInput?.addEventListener("input", () => {
      updateTargetShare();
      scheduleLiveRender(renderCompetitionSlide);
    });
    targetShareInput?.addEventListener("change", () => {
      updateTargetShare();
      flushLiveRender(renderCompetitionSlide);
    });
    document.getElementById("overrideEnabled")?.addEventListener("change", (event) => {
      const service = state.selectedService;
      if (!state.overrides[service]) {
        state.overrides[service] = {
          enabled: false,
          capture: { ...state.globalRates.capture },
          retention: { ...state.globalRates.retention },
        };
      }
      state.overrides[service].enabled = event.target.checked;
      renderAll();
    });
    document.querySelectorAll(".override-rate").forEach((input) => {
      const updateOverrideRate = () => {
        const service = state.selectedService;
        if (!state.overrides[service]) {
          state.overrides[service] = {
            enabled: true,
            capture: { ...state.globalRates.capture },
            retention: { ...state.globalRates.retention },
          };
        }
        const type = input.dataset.type;
        const rank = Number(input.dataset.rank);
        state.overrides[service][type][rank] = Math.min(100, Math.max(0, Number(input.value) || 0));
      };
      input.addEventListener("input", () => {
        updateOverrideRate();
        scheduleLiveRender(renderAll);
      });
      input.addEventListener("change", () => {
        updateOverrideRate();
        flushLiveRender(renderAll);
      });
    });
  }

  function showSlide(index) {
    const slides = [...document.querySelectorAll(".slide")];
    state.activeSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === state.activeSlide;
      slide.hidden = !active;
      slide.classList.toggle("is-active", active);
    });
    document.getElementById("slideCounter").textContent = `${state.activeSlide + 1} / ${slides.length}`;
    document.querySelectorAll(".slide-dot").forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === state.activeSlide));
  }

  let isHospitalSearchSetup = false;

  function populateHospitalSelector() {
    const input = document.getElementById("targetHospitalInput");
    const dropdown = document.getElementById("targetHospitalDropdown");
    
    if (!input || !dropdown) return;

    window.renderHospitalList = (searchTerm = "") => {
      const term = searchTerm.toLowerCase();
      const filtered = data.hospitals.filter(h => 
        h.name.toLowerCase().includes(term) || h.city.toLowerCase().includes(term) || h.code.toLowerCase().includes(term)
      );
      
      dropdown.innerHTML = filtered.map(hospital => `
        <div class="search-select-item ${hospital.code === state.targetCode ? 'is-active' : ''}" data-code="${escapeHtml(hospital.code)}">
          <strong>${escapeHtml(hospital.name)}</strong>
          <span>${escapeHtml(hospital.city)}</span>
        </div>
      `).join("");
      
      dropdown.querySelectorAll(".search-select-item").forEach(item => {
        item.addEventListener("click", () => {
          state.targetCode = item.dataset.code;
          const target = targetHospital();
          input.value = `${target.name} · ${target.city}`;
          dropdown.classList.remove("is-open");
          
          if (!getCompetency(target, state.selectedService)) {
            state.selectedService = data.services.find((service) => getCompetency(target, service) > 0) || data.services[0];
          }
          state.selectedSeverity = getCompetency(target, state.selectedService) || 1;
          renderAll();
          window.renderHospitalList();
        });
      });
    };

    window.renderHospitalList();

    const target = targetHospital();
    if (target) {
      input.value = `${target.name} · ${target.city}`;
    } else {
      input.value = "";
    }

    if (!isHospitalSearchSetup) {
      isHospitalSearchSetup = true;
      input.addEventListener("input", (e) => {
        dropdown.classList.add("is-open");
        window.renderHospitalList(e.target.value);
      });
      
      input.addEventListener("focus", () => {
        dropdown.classList.add("is-open");
        window.renderHospitalList(""); 
        input.select();
      });

      document.addEventListener("click", (e) => {
        if (!e.target.closest("#hospitalSelectWrapper")) {
          dropdown.classList.remove("is-open");
          const currentTarget = targetHospital();
          if (currentTarget) {
            input.value = `${currentTarget.name} · ${currentTarget.city}`;
          }
        }
      });
    }
  }

  function populateSlideDots() {
    const count = document.querySelectorAll(".slide").length;
    const container = document.getElementById("slideDots");
    container.innerHTML = Array.from({ length: count }, (_, index) => `<button class="slide-dot ${index === 0 ? "is-active" : ""}" type="button" data-index="${index}" aria-label="Buka slide ${index + 1}"></button>`).join("");
    container.querySelectorAll(".slide-dot").forEach((button) => button.addEventListener("click", () => showSlide(Number(button.dataset.index))));
  }

  function freezeExportControls(sourceRoot, cloneRoot) {
    const sourceControls = [...sourceRoot.querySelectorAll("select, input")];
    const cloneControls = [...cloneRoot.querySelectorAll("select, input")];
    sourceControls.forEach((sourceControl, index) => {
      const cloneControl = cloneControls[index];
      if (!cloneControl) return;
      const replacement = document.createElement("span");
      replacement.className = "pptx-static-control";

      if (sourceControl.tagName === "SELECT") {
        replacement.textContent = sourceControl.selectedOptions[0]?.textContent || "—";
      } else if (sourceControl.type === "checkbox") {
        replacement.classList.add("pptx-static-checkbox");
        replacement.textContent = sourceControl.checked ? "Aktif" : "Nonaktif";
        [...cloneControl.parentNode.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .forEach((node) => node.remove());
      } else {
        replacement.textContent = sourceControl.value || "0";
      }

      if (sourceControl.disabled) replacement.classList.add("is-disabled");
      cloneControl.replaceWith(replacement);
    });
  }

  function removeDuplicateExportIds(root) {
    root.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    root.querySelectorAll("[for]").forEach((element) => element.removeAttribute("for"));
    root.querySelectorAll("[aria-labelledby]").forEach((element) => element.removeAttribute("aria-labelledby"));
  }

  function buildPptxExportPages() {
    const exportStage = document.createElement("div");
    exportStage.className = "pptx-export-stage";
    exportStage.setAttribute("aria-hidden", "true");
    const headerSource = document.querySelector(".global-toolbar");
    const sourceSlides = [...document.querySelectorAll(".slide-stack > .slide")];
    const target = targetHospital();

    const pages = sourceSlides.map((sourceSlide, index) => {
      const page = document.createElement("section");
      page.className = "pptx-export-page";
      page.dataset.pptxNotes = `Sumber data: Laporan_Agregat_iDRG_Simulasi_2.xlsx. RS target: ${target.name}. Parameter simulasi mengikuti nilai dashboard saat ekspor.`;

      const headerClone = headerSource.cloneNode(true);
      freezeExportControls(headerSource, headerClone);
      removeDuplicateExportIds(headerClone);

      const slideClone = sourceSlide.cloneNode(true);
      slideClone.hidden = false;
      slideClone.classList.remove("is-active");
      freezeExportControls(sourceSlide, slideClone);
      removeDuplicateExportIds(slideClone);

      const footer = document.createElement("footer");
      footer.className = "pptx-export-footer";
      footer.innerHTML = `<strong>Simulator Market Share Regional</strong><span>${escapeHtml(target.name)} · ${index + 1} / ${sourceSlides.length}</span>`;
      page.append(headerClone, slideClone, footer);
      exportStage.appendChild(page);
      return page;
    });

    document.body.appendChild(exportStage);
    return { exportStage, pages };
  }

  const waitForExportLayout = () => new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });

  async function exportDashboardToPptx() {
    const button = document.getElementById("exportPptx");
    const status = document.getElementById("exportStatus");
    const defaultLabel = "Export PPTX";
    let exportStage;

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Membuat PPTX…";
    status.textContent = "Sedang membuat file PowerPoint.";

    try {
      if (!window.domToPptx?.exportToPptx) throw new Error("Library dom-to-pptx tidak tersedia.");
      const built = buildPptxExportPages();
      exportStage = built.exportStage;
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForExportLayout();

      const target = targetHospital();
      const exportDate = new Date().toISOString().slice(0, 10);
      await window.domToPptx.exportToPptx(built.pages, {
        fileName: `market-share-idrg-${target.code}-${exportDate}.pptx`,
        autoEmbedFonts: false,
        svgAsVector: true,
      });

      button.textContent = "PPTX terunduh";
      status.textContent = "File PowerPoint berhasil dibuat dan diunduh.";
    } catch (error) {
      console.error("PPTX export failed", error);
      button.textContent = "Ekspor gagal";
      status.textContent = `Ekspor PowerPoint gagal: ${error.message}`;
    } finally {
      exportStage?.remove();
      button.removeAttribute("aria-busy");
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = defaultLabel;
      }, 2400);
    }
  }

  function resizeDeck() {
    const scale = Math.min((window.innerWidth - 20) / 1920, (window.innerHeight - 20) / 1080);
    const scaler = document.getElementById("deckScaler");
    const width = 1920 * scale;
    const height = 1080 * scale;
    scaler.style.transform = `scale(${scale})`;
    scaler.style.left = `${Math.max((window.innerWidth - width) / 2, 0)}px`;
    scaler.style.top = `${Math.max((window.innerHeight - height) / 2, 0)}px`;
  }

  function populateFilters() {
    const provinces = [...new Set(originalData.hospitals.map(h => h.province).filter(Boolean))].sort();
    const cities = [...new Set(originalData.hospitals.map(h => h.city).filter(Boolean))].sort();
    
    const provDropdown = document.getElementById("provDropdown");
    const cityDropdown = document.getElementById("cityDropdown");
    const provBtn = document.getElementById("provBtn");
    const cityBtn = document.getElementById("cityBtn");
    
    const buildCheckboxes = (items, container, filterType) => {
      if (!container) return;
      container.innerHTML = items.map(item => `
        <label class="checkbox-label">
          <input type="checkbox" value="${escapeHtml(item)}" data-filter="${filterType}">
          <span>${escapeHtml(item)}</span>
        </label>
      `).join("");
      
      container.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => {
          applyFilters();
          updateButtonLabels();
        });
      });
    };
    
    buildCheckboxes(provinces, provDropdown, "province");
    buildCheckboxes(cities, cityDropdown, "city");
    
    const toggleDropdown = (btn, dropdown) => {
      if (!btn || !dropdown) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains("is-open");
        document.querySelectorAll(".multi-select-dropdown").forEach(d => d.classList.remove("is-open"));
        if (!isOpen) dropdown.classList.add("is-open");
      });
    };
    
    toggleDropdown(provBtn, provDropdown);
    toggleDropdown(cityBtn, cityDropdown);
    
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".custom-multi")) {
        document.querySelectorAll(".multi-select-dropdown").forEach(d => d.classList.remove("is-open"));
      }
    });
  }

  function updateButtonLabels() {
    const provBtn = document.getElementById("provBtn");
    const cityBtn = document.getElementById("cityBtn");
    
    const getChecked = (dropdown) => Array.from(dropdown?.querySelectorAll("input:checked") || []).map(i => i.value);
    
    const selProv = getChecked(document.getElementById("provDropdown"));
    const selCity = getChecked(document.getElementById("cityDropdown"));
    
    if (provBtn) {
      provBtn.textContent = selProv.length === 0 ? "Semua Provinsi" : 
                           (selProv.length === 1 ? selProv[0] : `${selProv.length} Provinsi dipilih`);
    }
    if (cityBtn) {
      cityBtn.textContent = selCity.length === 0 ? "Semua Kab/Kota" : 
                           (selCity.length === 1 ? selCity[0] : `${selCity.length} Kab/Kota dipilih`);
    }
  }

  function computeRegionalFromHospitals(hospitals) {
    const regional = {
      total: [0, 0, 0],
      severity: {},
      unclassified: [0, 0, 0],
      services: {}
    };
    for (const h of hospitals) {
      regional.total[0] += h.total[0];
      regional.total[1] += h.total[1];
      regional.total[2] += h.total[2];
      
      if (h.unclassified) {
        regional.unclassified[0] += h.unclassified[0] || 0;
        regional.unclassified[1] += h.unclassified[1] || 0;
        regional.unclassified[2] += h.unclassified[2] || 0;
      }
      
      for (const sev in h.severity) {
        if (!regional.severity[sev]) regional.severity[sev] = [0, 0, 0];
        regional.severity[sev][0] += h.severity[sev][0];
        regional.severity[sev][1] += h.severity[sev][1];
        regional.severity[sev][2] += h.severity[sev][2];
      }
      
      for (const svc in h.services) {
        if (!regional.services[svc]) {
          regional.services[svc] = { competency: 0, total: [0,0,0], severity: {} };
        }
        const s = h.services[svc];
        const rs = regional.services[svc];
        
        rs.total[0] += s.total[0];
        rs.total[1] += s.total[1];
        rs.total[2] += s.total[2];
        
        if (s.unclassified) {
          if (!rs.unclassified) rs.unclassified = [0,0,0];
          rs.unclassified[0] += s.unclassified[0];
          rs.unclassified[1] += s.unclassified[1];
          rs.unclassified[2] += s.unclassified[2];
        }
        
        for (const sev in s.severity) {
          if (!rs.severity[sev]) rs.severity[sev] = [0, 0, 0];
          rs.severity[sev][0] += s.severity[sev][0];
          rs.severity[sev][1] += s.severity[sev][1];
          rs.severity[sev][2] += s.severity[sev][2];
        }
      }
    }
    return regional;
  }

  function applyFilters() {
    const getChecked = (dropdown) => Array.from(dropdown?.querySelectorAll("input:checked") || []).map(i => i.value);
    
    const selectedProvinces = getChecked(document.getElementById("provDropdown"));
    const selectedCities = getChecked(document.getElementById("cityDropdown"));
    
    const filteredHospitals = originalData.hospitals.filter(h => {
      let passProv = selectedProvinces.length === 0 || selectedProvinces.includes(h.province);
      let passCity = selectedCities.length === 0 || selectedCities.includes(h.city);
      return passProv && passCity;
    });
    
    data = {
      ...originalData,
      hospitals: filteredHospitals,
      regional: computeRegionalFromHospitals(filteredHospitals)
    };
    
    updateDataState();
    
    if (!hospitalByCode.has(state.targetCode) && filteredHospitals.length > 0) {
      state.targetCode = filteredHospitals[0].code;
    } else if (filteredHospitals.length === 0) {
      state.targetCode = "";
    }
    
    populateHospitalSelector();
    renderAll();
  }

  populateFilters();
  populateHospitalSelector();
  populateSlideDots();
  document.getElementById("previousSlide").addEventListener("click", () => showSlide(state.activeSlide - 1));
  document.getElementById("nextSlide").addEventListener("click", () => showSlide(state.activeSlide + 1));
  document.getElementById("exportPptx").addEventListener("click", exportDashboardToPptx);
  document.addEventListener("keydown", (event) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
    if (["ArrowRight", "PageDown", " "].includes(event.key)) showSlide(state.activeSlide + 1);
    if (["ArrowLeft", "PageUp"].includes(event.key)) showSlide(state.activeSlide - 1);
    if (event.key === "Home") showSlide(0);
    if (event.key === "End") showSlide(5);
  });
  window.addEventListener("resize", resizeDeck);
  resizeDeck();
  renderAll();
})();
