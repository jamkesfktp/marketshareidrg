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
    scenarios: [100, 75, 50, 25, 15, 0].map(val => ({ tambah: val, kurang: val })),
    serviceScenarios: {},
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
  function getCompetency(hospital, service) {
    if (!hospital || !hospital.services || !hospital.services[service]) return 0;
    return hospital.services[service].competency || 0;
  }

  function getLevelRules(competency) {
    switch (competency) {
      case 1: return { tambah: [1], kurang: [2, 3, 4] };
      case 2: return { tambah: [1, 2], kurang: [3, 4] };
      case 3: return { tambah: [1, 2, 3], kurang: [4] };
      case 4: return { tambah: [3, 4], kurang: [1, 2] };
      default: return { tambah: [], kurang: [] };
    }
  }
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
    const subtitleEl = document.getElementById("slide9Subtitle") || document.getElementById("slide8Subtitle");
    if (subtitleEl) subtitleEl.textContent = `${target.name} · seluruh layanan · parameter dapat diubah pada slide simulator.`;
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

  function renderScenarioSlide() {
    const target = targetHospital();
    if (!target) return;

    const existingIna = target.total[INA];
    const existingKasus = target.total[CASES];
    
    let globalTambahKasus = 0;
    let globalTambahRp = 0;
    let globalKurangKasus = 0;
    let globalKurangRp = 0;
    let globalExistingKasus = 0;
    let globalExistingRp = 0;
    
    const rows = [];
    
    data.services.forEach(service => {
      const targetCompetency = getCompetency(target, service);
      if (targetCompetency === 0) return;
      
      const competitorsList = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= targetCompetency);
      const competitors = competitorsList.length;
      
      const rules = getLevelRules(targetCompetency);
      const baseTambahan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
      const basePengurangan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
      
      const regionalSvc = data.regional.services[service];
      const targetSvcRef = target.services[service];
      
      rules.tambah.forEach(lvl => {
        const rMetric = regionalSvc ? severityMetric(regionalSvc, lvl) : [0,0,0];
        const tMetric = targetSvcRef ? severityMetric(targetSvcRef, lvl) : [0,0,0];
        baseTambahan[lvl][0] = Math.max(0, (rMetric[CASES] || 0) - (tMetric[CASES] || 0));
        baseTambahan[lvl][1] = Math.max(0, (rMetric[IDRG] || 0) - (tMetric[IDRG] || 0));
      });
      
      const targetSvc = target.services[service];
      let svcExistingKasus = 0;
      let svcExistingRp = 0;
      
      if (targetSvc) {
        svcExistingKasus = targetSvc.total[CASES] || 0;
        svcExistingRp = targetSvc.total[INA] || 0;
        
        rules.kurang.forEach(lvl => {
          const targetLvl = severityMetric(targetSvc, lvl);
          basePengurangan[lvl][0] += targetLvl[CASES] || 0;
          basePengurangan[lvl][1] += targetLvl[INA] || 0;
        });
      }
      
      let totalPlayers = competitors + 1;
      let pctTambah = (100 / totalPlayers);
      let pctKurang = (100 / totalPlayers);
      
      let svcTambahKasus = 0;
      let svcTambahRp = 0;
      let svcKurangKasus = 0;
      let svcKurangRp = 0;
      
      rules.tambah.forEach(lvl => {
        svcTambahKasus += baseTambahan[lvl][0] * (pctTambah / 100);
        svcTambahRp += baseTambahan[lvl][1] * (pctTambah / 100);
      });
      
      rules.kurang.forEach(lvl => {
        svcKurangKasus += basePengurangan[lvl][0] * (pctKurang / 100);
        svcKurangRp += basePengurangan[lvl][1] * (pctKurang / 100);
      });
      
      globalTambahKasus += svcTambahKasus;
      globalTambahRp += svcTambahRp;
      globalKurangKasus += svcKurangKasus;
      globalKurangRp += svcKurangRp;
      globalExistingKasus += svcExistingKasus;
      globalExistingRp += svcExistingRp;
      
      const svcNetKasus = svcTambahKasus - svcKurangKasus;
      const svcNetRp = svcTambahRp - svcKurangRp;
      const svcPctKenaikan = svcExistingRp ? (svcNetRp / svcExistingRp) : 0;
      
      let competitorHtml = '';
      if (competitors > 0) {
        const groups = { 'A': [], 'B': [], 'C': [], 'D': [], 'Lainnya': [] };
        competitorsList.forEach(h => {
           let cls = h.class ? h.class.toUpperCase() : 'Lainnya';
           if (!groups[cls]) cls = 'Lainnya';
           groups[cls].push(h);
        });
        
        ['A', 'B', 'C', 'D', 'Lainnya'].forEach(cls => {
          if (groups[cls].length > 0) {
            const badgeColor = cls === 'A' ? 'background: #fdf4ff; color: #a21caf; border: 1px solid #f5d0fe;' : 
                               cls === 'B' ? 'background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa;' : 
                               cls === 'C' ? 'background: #fefce8; color: #a16207; border: 1px solid #fef08a;' : 
                                           'background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4;';
            competitorHtml += `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;">
              ${groups[cls].map(h => `<span style="font-size: 10px; padding: 2px 4px; border-radius: 4px; ${badgeColor} white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" title="Kelas ${cls}">${escapeHtml(h.name)}</span>`).join('')}
            </div>`;
          }
        });
      } else {
        competitorHtml = '<span style="font-size: 11px; color: #94a3b8;">Tidak ada</span>';
      }
      
      rows.push(`
        <tr>
          <td style="text-align: left; vertical-align: top;">
            <div style="font-weight: 600; color: #1e293b; font-size: 13px;">${formatService(service)}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Kompetensi RS: <span style="font-weight:600; color:#3b82f6;">${levelNames[targetCompetency]}</span></div>
          </td>
          <td style="text-align: left; vertical-align: top; max-width: 280px; padding: 6px;">
             <div style="font-size: 10px; font-weight: 600; color: var(--muted); margin-bottom: 4px; text-transform: uppercase;">KOMPETITOR (${competitors} RS)</div>
             <div style="max-height: 80px; overflow-y: auto; padding-right: 2px;">${competitorHtml}</div>
          </td>
          <td style="vertical-align: top; font-weight: 500;">${formatNumber(svcExistingKasus)}</td>
          <td style="vertical-align: top; font-weight: 500;" class="b-right-yellow">${formatMatrixMoney(svcExistingRp)}</td>
          
          <td style="vertical-align: top; color: #047857;" class="b-left-green">${formatPercent(pctTambah / 100)}</td>
          <td style="vertical-align: top; color: #047857;">${formatNumber(svcTambahKasus)}</td>
          <td style="vertical-align: top; color: #047857;" class="b-right-green">${formatMatrixMoney(svcTambahRp)}</td>
          
          <td style="vertical-align: top; color: #b91c1c;" class="b-left-red">${formatPercent(pctKurang / 100)}</td>
          <td style="vertical-align: top; color: #b91c1c;">${formatNumber(svcKurangKasus)}</td>
          <td style="vertical-align: top; color: #b91c1c;" class="b-right-red">${formatMatrixMoney(svcKurangRp)}</td>
          
          <td style="vertical-align: top;" class="b-left-yellow"><strong>${formatSignedNumber(svcNetKasus)}</strong></td>
          <td style="vertical-align: top;"><strong>${svcNetRp > 0 ? '+' : ''}${formatMatrixMoney(svcNetRp)}</strong></td>
          <td style="vertical-align: top;" class="b-right-yellow"><strong>${formatPercent(svcPctKenaikan)}</strong></td>
        </tr>
      `);
    });
    
    const globalNetKasus = globalTambahKasus - globalKurangKasus;
    const globalNetRp = globalTambahRp - globalKurangRp;
    const globalPctKenaikan = globalExistingRp ? (globalNetRp / globalExistingRp) : 0;
    const deltaIdrg = target.total[IDRG] - target.total[INA];
    const deltaPercentIdrg = existingIna ? deltaIdrg / existingIna : 0;
    
    document.getElementById("scenarioSlide").innerHTML = `
      <div class="existing-report-kpis" style="margin-bottom: 15px;">
        <article class="existing-report-kpi kpi-cases"><span>Total Kasus:</span><strong>${formatNumber(target.total[CASES])}</strong><em>Jumlah kasus eklaim</em></article>
        <article class="existing-report-kpi kpi-ina"><span>Pendapatan INA CBGs:</span><strong>${formatMoney(target.total[INA])}</strong><em>Dari data 8 bulan</em></article>
        <article class="existing-report-kpi kpi-idrg"><span>Pendapatan iDRG:</span><strong>${formatMoney(target.total[IDRG])}</strong><em>Klaim uji coba iDRG</em></article>
        <article class="existing-report-kpi kpi-difference ${deltaIdrg < 0 ? "is-loss" : "is-gain"}"><span>Selisih Pendapatan:</span><strong>${formatMoney(deltaIdrg)}</strong><em>iDRG - INA CBGs</em></article>
        <article class="existing-report-kpi kpi-percentage ${deltaIdrg < 0 ? "is-loss" : "is-gain"}"><span>Persentase:</span><strong>${formatPercent(deltaPercentIdrg)}</strong><em>Dari Pendapatan INACBG</em></article>
      </div>
      
      <div style="margin-bottom: 12px; font-weight: 600; color: #1e293b; font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
        Laporan Rekapitulasi Potensi Skenario Berdasarkan Kompetensi Layanan
        <div style="font-size: 12px; font-weight: 400; color: #64748b; margin-top: 4px;">Dihitung dari persentase default (100% / total kompetitor per layanan) dengan aturan matriks kelas kompetensi.</div>
      </div>
      
      <div class="table-container" style="max-height: 400px; overflow-y: auto;">
        <table class="scenario-table" style="table-layout: auto; min-width: 1200px;">
          <thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <th rowspan="2" style="width: 180px; text-align: left; background-color: #f8f9fa; color: #17233b;">Layanan</th>
              <th rowspan="2" style="width: 280px; text-align: left; background-color: #f8f9fa; color: #17233b;">Daftar Kompetitor</th>
              <th colspan="2" class="b-right-yellow" style="background-color: #f8f9fa; color: #17233b;">Eksisting INA-CBG</th>
              <th colspan="3" class="b-left-green b-right-green" style="background-color: #e8f5e9; color: #17233b;">Proyeksi Tambahan</th>
              <th colspan="3" class="b-left-red b-right-red" style="background-color: #ffebee; color: #17233b;">Proyeksi Pengurangan</th>
              <th colspan="3" class="b-left-yellow b-right-yellow" style="background-color: #fff8e1; color: #17233b;">Net (Selisih)</th>
            </tr>
            <tr>
              <th style="background-color: #f8f9fa; color: #17233b;">Kasus</th>
              <th class="b-right-yellow" style="background-color: #f8f9fa; color: #17233b;">Pendapatan<br>(Rp M)</th>
              <th class="b-left-green" style="background-color: #e8f5e9; color: #17233b;">%</th>
              <th style="background-color: #e8f5e9; color: #17233b;">Kasus</th>
              <th class="b-right-green" style="background-color: #e8f5e9; color: #17233b;">Pendapatan<br>(Rp M)</th>
              <th class="b-left-red" style="background-color: #ffebee; color: #17233b;">%</th>
              <th style="background-color: #ffebee; color: #17233b;">Kasus</th>
              <th class="b-right-red" style="background-color: #ffebee; color: #17233b;">Pendapatan<br>(Rp M)</th>
              <th class="b-left-yellow" style="background-color: #fff8e1; color: #17233b;">Kasus</th>
              <th style="background-color: #fff8e1; color: #17233b;">Pendapatan<br>(Rp M)</th>
              <th class="b-right-yellow" style="background-color: #fff8e1; color: #17233b;">% Kenaikan</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join('')}
          </tbody>
          <tfoot style="position: sticky; bottom: 0; z-index: 10; box-shadow: 0 -1px 3px rgba(0,0,0,0.1);">
            <tr style="background-color: #1e293b; color: white; font-weight: bold; font-size: 13px;">
              <td colspan="2" style="text-align: right; padding-right: 15px; background-color: #1e293b;">TOTAL GLOBAL (Semua Layanan)</td>
              <td style="background-color: #1e293b; border-color: #334155;">${formatNumber(globalExistingKasus)}</td>
              <td class="b-right-yellow" style="background-color: #1e293b; border-color: #334155;">${formatMatrixMoney(globalExistingRp)}</td>
              
              <td class="b-left-green" style="background-color: #064e3b; color: #34d399; border-color: #065f46;">-</td>
              <td style="background-color: #064e3b; color: #34d399; border-color: #065f46;">${formatNumber(globalTambahKasus)}</td>
              <td class="b-right-green" style="background-color: #064e3b; color: #34d399; border-color: #065f46;">${formatMatrixMoney(globalTambahRp)}</td>
              
              <td class="b-left-red" style="background-color: #7f1d1d; color: #f87171; border-color: #991b1b;">-</td>
              <td style="background-color: #7f1d1d; color: #f87171; border-color: #991b1b;">${formatNumber(globalKurangKasus)}</td>
              <td class="b-right-red" style="background-color: #7f1d1d; color: #f87171; border-color: #991b1b;">${formatMatrixMoney(globalKurangRp)}</td>
              
              <td class="b-left-yellow" style="background-color: #713f12; color: #fef08a; border-color: #854d0e;">${formatSignedNumber(globalNetKasus)}</td>
              <td style="background-color: #713f12; color: #fef08a; border-color: #854d0e;">${globalNetRp > 0 ? '+' : ''}${formatMatrixMoney(globalNetRp)}</td>
              <td class="b-right-yellow" style="background-color: #713f12; color: #fef08a; border-color: #854d0e;">${formatPercent(globalPctKenaikan)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  function renderDynamicServiceSlides() {
    const target = targetHospital();
    if (!target) return;
    
    let container = document.getElementById("dynamicServiceSlides");
    if (!container) {
      container = document.createElement("div");
      container.id = "dynamicServiceSlides";
      const stack = document.querySelector(".slide-stack");
      if (stack) {
        stack.appendChild(container);
      } else {
        return;
      }
    }
    
    // Extract available services for the target hospital
    const availableServices = data.services.filter(service => getCompetency(target, service) > 0);
    
    let html = "";
    
    availableServices.forEach((service, idx) => {
      const targetCompetency = getCompetency(target, service);
      // Hitung kompetitor (RS lain yang punya kompetensi >= targetCompetency)
      const competitorsList = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= targetCompetency);
      const competitors = competitorsList.length;
      let competitorHtml = '';
      if (competitors > 0) {
        const groups = { 4: [], 3: [], 2: [], 1: [] };
        competitorsList.forEach(h => groups[getCompetency(h, service)].push(h));
        
        [4, 3, 2, 1].forEach(lvl => {
          if (groups[lvl].length > 0) {
            const badgeColor = lvl === 4 ? 'background: #fdf4ff; color: #a21caf; border: 1px solid #f5d0fe;' : 
                               lvl === 3 ? 'background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa;' : 
                               lvl === 2 ? 'background: #fefce8; color: #a16207; border: 1px solid #fef08a;' : 
                                           'background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4;';
            competitorHtml += `
              <div style="margin-top: 6px; text-align: right;">
                <div style="font-size: 10px; font-weight: 700; color: var(--muted); margin-bottom: 3px; text-transform: uppercase;">${levelNames[lvl]} (${groups[lvl].length} RS)</div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end;">
                  ${groups[lvl].map(h => `<span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; ${badgeColor} white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${escapeHtml(h.name)}</span>`).join('')}
                </div>
              </div>
            `;
          }
        });
        competitorHtml = `<div style="max-height: 120px; overflow-y: auto; padding-right: 4px; margin-top: 4px; margin-left: auto; max-width: 600px;">${competitorHtml}</div>`;
      } else {
        competitorHtml = `<div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Tidak ada kompetitor</div>`;
      }
      
      // Hitung Persentase Default
      if (!state.serviceScenarios[service]) {
        const competitorCounts = { 1:0, 2:0, 3:0, 4:0 };
        competitorsList.forEach(h => competitorCounts[getCompetency(h, service)]++);
        
        state.serviceScenarios[service] = Array(6).fill().map((_, i) => {
          let scn = {};
          const rules = getLevelRules(targetCompetency);
          
          rules.tambah.forEach(lvl => {
            let lvlCompetitors = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= lvl).length;
            let val = (100 / (lvlCompetitors + 1)) + (i * 5);
            scn['tambah_' + lvl] = parseFloat(Math.min(100, Math.max(0, val)).toFixed(1));
          });
          
          rules.kurang.forEach(lvl => {
            const targetSvc = target.services[service];
            if (targetSvc && severityMetric(targetSvc, lvl)[CASES] > 0) {
              // Start at 50%, increase 10% per scenario: 50, 60, 70, 80, 90, 100
              let val = 50 + (i * 10);
              scn['kurang_' + lvl] = parseFloat(Math.min(100, val).toFixed(1));
            }
          });
          
          return scn;
        });
      }
      
      const targetExistingService = target.services[service] ? target.services[service].total : [0, 0, 0];
      const regionalExistingService = data.regional.services[service] ? data.regional.services[service].total : [0, 0, 0];
      
      const targetKasus = targetExistingService[CASES];
      const regionalKasus = regionalExistingService[CASES];
      const targetIdrg = targetExistingService[IDRG];
      const regionalIdrg = regionalExistingService[IDRG];
      const regionalIna = regionalExistingService[INA];
      
      const potensiRegional = regionalIdrg - regionalIna;
      const selisih = potensiRegional - targetIdrg;
      
      const targetSvc = target.services[service];
      const targetKasusArr = targetSvc ? targetSvc.total : [0,0,0];
      const existingKasus = targetKasusArr[CASES] || 0;
      const existingIna = targetKasusArr[INA] || 0;
      
      const rules = getLevelRules(targetCompetency);
      const baseTambahan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
      const regionalSvc = data.regional.services[service];
      const targetSvcRef = target.services[service];
      
      rules.tambah.forEach(lvl => {
        const rMetric = regionalSvc ? severityMetric(regionalSvc, lvl) : [0,0,0];
        const tMetric = targetSvcRef ? severityMetric(targetSvcRef, lvl) : [0,0,0];
        baseTambahan[lvl][0] = Math.max(0, (rMetric[CASES] || 0) - (tMetric[CASES] || 0));
        baseTambahan[lvl][1] = Math.max(0, (rMetric[IDRG] || 0) - (tMetric[IDRG] || 0));
      });
      
      const basePengurangan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
      if (targetSvc) {
        rules.kurang.forEach(lvl => {
          const targetLvl = severityMetric(targetSvc, lvl);
          basePengurangan[lvl][0] = targetLvl[CASES] || 0;
          basePengurangan[lvl][1] = targetLvl[INA] || 0;
        });
      }
      
      const generateRow = (index, scn) => {
        let totalTambahKasus = 0;
        let totalTambahRp = 0;
        let totalKurangKasus = 0;
        let totalKurangRp = 0;
        
        let tambahCols = '';
        [1, 2, 3, 4].forEach(lvl => {
          if (scn.hasOwnProperty('tambah_' + lvl)) {
            const pTambah = scn['tambah_' + lvl] / 100;
            const tk = baseTambahan[lvl][0] * pTambah;
            const trp = baseTambahan[lvl][1] * pTambah;
            totalTambahKasus += tk;
            totalTambahRp += trp;
            tambahCols += `
              <td class="b-left-green b-top-green b-bottom-green"><input type="number" class="scenario-input dynamic-scenario-input" data-service="${escapeHtml(service)}" data-index="${index}" data-field="tambah_${lvl}" value="${scn['tambah_' + lvl]}" step="0.1" style="width: 60px;"></td>
              <td class="b-top-green b-bottom-green">${formatNumber(tk)}</td>
              <td class="b-right-green b-top-green b-bottom-green">${formatMatrixMoney(trp)}</td>
            `;
          }
        });
        
        let kurangCols = '';
        [1, 2, 3, 4].forEach(lvl => {
          if (scn.hasOwnProperty('kurang_' + lvl)) {
            const pKurang = scn['kurang_' + lvl] / 100;
            const kk = basePengurangan[lvl][0] * pKurang;
            const krp = basePengurangan[lvl][1] * pKurang;
            totalKurangKasus += kk;
            totalKurangRp += krp;
            kurangCols += `
              <td class="b-left-red b-top-red b-bottom-red"><input type="number" class="scenario-input dynamic-scenario-input" data-service="${escapeHtml(service)}" data-index="${index}" data-field="kurang_${lvl}" value="${scn['kurang_' + lvl]}" step="0.1" style="width: 60px;"></td>
              <td class="b-top-red b-bottom-red">${formatNumber(kk)}</td>
              <td class="b-right-red b-top-red b-bottom-red">${formatMatrixMoney(krp)}</td>
            `;
          }
        });
        
        const netKasus = totalTambahKasus - totalKurangKasus;
        const pctNetKasus = existingKasus ? netKasus / existingKasus : 0;
        
        const netRp = totalTambahRp - totalKurangRp;
        const pctKenaikan = existingIna ? netRp / existingIna : 0;

        return `<tr>
          <td style="font-weight: 700; text-align: left; padding-left: 10px; background-color: #f8f9fa;">Skenario ${index + 1}</td>
          ${tambahCols}
          ${kurangCols}
          <td>${formatSignedNumber(netKasus)}</td>
          <td>${formatPercent(pctNetKasus)}</td>
          <td>${netRp > 0 ? '+' : ''}${formatMatrixMoney(netRp)}</td>
          <td class="b-left-yellow b-top-yellow b-bottom-yellow">${formatMatrixMoney(existingIna)}</td>
          <td class="b-right-yellow b-top-yellow b-bottom-yellow" style="background:#fffcf0;"><strong>${formatPercent(pctKenaikan)}</strong></td>
        </tr>`;
      };
      
      html += `
        <section class="slide" data-slide="${9 + idx}" aria-labelledby="dynamicSlide${idx}Title">
          <div class="slide-heading compact-heading">
            <div><p class="eyebrow">${String(10 + idx).padStart(2, '0')} · Simulasi Kasus Market Share</p><h1 id="dynamicSlide${idx}Title">Simulasi Kasus Market Share - <span style="color: #ffc107;">layanan ${escapeHtml(service)}</span></h1><p>Data Mirroring Uji Coba iDRG</p></div>
            <span class="slide-chip">Layanan</span>
          </div>
          <div class="slide-content" style="padding-top: 10px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 20px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              
              <div style="flex: 1; background: white; padding: 16px; border-radius: 10px; border-top: 4px solid #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-size: 13px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">🏥 Eksisting RS Target</div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
                  <div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Total Kasus</div>
                    <div style="font-size: 24px; font-weight: 800; color: #1e293b; line-height: 1;">${formatNumber(targetKasus)}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Pendapatan iDRG</div>
                    <div style="font-size: 20px; font-weight: 700; color: #059669; line-height: 1;">${formatMoney(targetIdrg)}</div>
                  </div>
                </div>
                <div style="font-size: 11px; color: #94a3b8; background: #f8fafc; padding: 4px 8px; border-radius: 4px; display: inline-block;">Rata-rata Tarif: <strong>${formatMoney(targetKasus ? targetIdrg/targetKasus : 0)}</strong> / kasus</div>
              </div>

              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; width: 40px; height: 40px; border-radius: 50%; font-weight: 800; color: #cbd5e1; font-size: 12px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); border: 2px solid #f1f5f9;">VS</div>

              <div style="flex: 1; background: white; padding: 16px; border-radius: 10px; border-top: 4px solid #8b5cf6; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-size: 13px; font-weight: 700; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">🌍 Eksisting Regional</div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
                  <div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Total Kasus</div>
                    <div style="font-size: 24px; font-weight: 800; color: #1e293b; line-height: 1;">${formatNumber(regionalKasus)}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Pendapatan iDRG</div>
                    <div style="font-size: 20px; font-weight: 700; color: #059669; line-height: 1;">${formatMoney(regionalIdrg)}</div>
                  </div>
                </div>
                <div style="font-size: 11px; color: #94a3b8; background: #f8fafc; padding: 4px 8px; border-radius: 4px; display: inline-block;">Rata-rata Tarif: <strong>${formatMoney(regionalKasus ? regionalIdrg/regionalKasus : 0)}</strong> / kasus</div>
              </div>

              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1e293b; color: white; padding: 16px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); min-width: 140px;">
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Market Share</div>
                <div style="font-size: 28px; font-weight: 800; color: #38bdf8;">${formatPercent(regionalKasus ? targetKasus / regionalKasus : 0)}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Dari total kasus</div>
              </div>

            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 1rem; margin-bottom: 0.5rem; font-size: 14px; font-weight: 500;">
              <div>Kompetensi Layanan RS : <span style="background: var(--amber-300); padding: 4px 8px; border-radius: 4px; font-weight: bold; color: var(--amber-900);">Kompetensi ${levelNames[targetCompetency]}</span></div>
              <div style="text-align: right; flex-grow: 1;">
                <div style="font-weight: bold; color: var(--slate-800);">RS Kompetitor Setara atau Lebih Tinggi: <span style="background: var(--blue-soft); color: var(--blue); padding: 2px 8px; border-radius: 99px; font-size: 12px; margin-left: 4px;">${competitors} RS</span></div>
                ${competitorHtml}
              </div>
            </div>
            ${(() => {
              let tHead1 = '';
              let tHead2 = '';
              [1, 2, 3, 4].forEach(lvl => {
                if (state.serviceScenarios[service][0].hasOwnProperty('tambah_' + lvl)) {
                  tHead1 += `<th colspan="3" class="b-top-green b-left-green b-right-green" style="background-color: #e8f5e9; color: #17233b;">Tambahan Kasus<br>${levelNames[lvl]}</th>`;
                  tHead2 += `<th style="color: #17233b;">Persentase<br>(%)</th><th style="color: #17233b;">Jumlah<br>Kasus</th><th style="color: #17233b;">Tambahan<br>Pendapatan<br>(Rp M)</th>`;
                }
              });
              [1, 2, 3, 4].forEach(lvl => {
                if (state.serviceScenarios[service][0].hasOwnProperty('kurang_' + lvl)) {
                  tHead1 += `<th colspan="3" class="b-top-red b-left-red b-right-red" style="background-color: #ffebee; color: #17233b;">Pengurangan Kasus<br>${levelNames[lvl]}</th>`;
                  tHead2 += `<th style="color: #17233b;">Persentase<br>(%)</th><th style="color: #17233b;">Jumlah<br>Kasus</th><th style="color: #17233b;">Pengurangan<br>Pendapatan<br>(Rp M)</th>`;
                }
              });
              
              return `
                <div style="overflow-x: auto; width: 100%;">
                  <table class="scenario-table" style="table-layout: auto; min-width: 1000px;">
                    <thead>
                      <tr>
                        <th rowspan="2" style="background-color: #f8f9fa; color: #17233b;">Skenario</th>
                        ${tHead1}
                        <th colspan="3">Net +/- Pasca iDRG & RBKP</th>
                        <th rowspan="2">Pendapatan<br>Eksisting INA<br>CBG (Rp M)</th>
                        <th rowspan="2">% Kenaikan<br>thd INA-CBG<br>Eksisting</th>
                      </tr>
                      <tr>
                        ${tHead2}
                        <th>+/-<br>Jumlah<br>Kasus</th>
                        <th>% thd total<br>kasus<br>eksisting</th>
                        <th>+/-<br>Pendapatan<br>(Rp M)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${state.serviceScenarios[service].map((scn, i) => generateRow(i, scn)).join("")}
                    </tbody>
                  </table>
                </div>
              `;
            })()}
          </div>
        </section>
      `;
    });
    
    container.innerHTML = html;
    
    container.querySelectorAll('.dynamic-scenario-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const srv = e.target.dataset.service;
        const idx = e.target.dataset.index;
        const field = e.target.dataset.field;
        const val = parseFloat(e.target.value) || 0;
        state.serviceScenarios[srv][idx][field] = val;
        
        // Save current slide position before re-render
        const savedSlide = state.activeSlide;
        const savedService = srv;
        const savedIndex = idx;
        const savedField = field;
        
        renderDynamicServiceSlides();
        
        // Restore slide position and focus after re-render
        showSlide(savedSlide);
        setTimeout(() => {
          const selector = `.dynamic-scenario-input[data-service="${savedService.replace(/"/g, '\\"')}"][data-index="${savedIndex}"][data-field="${savedField}"]`;
          const inputToFocus = document.querySelector(selector);
          if (inputToFocus) {
            inputToFocus.focus();
            try { inputToFocus.select(); } catch(e) {}
          }
        }, 0);
      });
    });
  }

  function renderAll() {
    // Simpan fokus saat ini agar tidak hilang saat re-render
    const activeEl = document.activeElement;
    let focusData = null;
    let selectionStart = 0;
    if (activeEl && activeEl.tagName === "INPUT" && activeEl.classList.contains("dynamic-scenario-input")) {
      focusData = { service: activeEl.dataset.service, index: activeEl.dataset.index, field: activeEl.dataset.field };
      try { selectionStart = activeEl.selectionStart; } catch(e) {}
    }

    updateTargetMeta();
    renderExistingSlide();
    renderRegionalSlide();
    renderAddressableSlide();
    renderComparisonSlide();
    renderRegionalProfileSlide();
    renderScenarioSlide();
    renderSimulatorSlide();
    renderCompetitionSlide();
    renderSummarySlide();
    renderDynamicServiceSlides();
    populateSlideDots();
    
    // Kembalikan fokus
    if (focusData) {
      setTimeout(() => {
        const selector = `.dynamic-scenario-input[data-service="${focusData.service.replace(/"/g, '\\"')}"][data-index="${focusData.index}"][data-field="${focusData.field}"]`;
        const inputToFocus = document.querySelector(selector);
        if (inputToFocus) {
          inputToFocus.focus();
          try { inputToFocus.setSelectionRange(selectionStart, selectionStart); } catch(e) {}
        }
      }, 0);
    }

    // Ensure active slide is not out of bounds after dynamically removing slides
    const slides = document.querySelectorAll(".slide");
    if (state.activeSlide >= slides.length) {
      state.activeSlide = slides.length - 1;
    }
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
          state.serviceScenarios = {};
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
    const sourceSlides = [...document.querySelectorAll(".slide")];
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
      
      const searchHtml = `
        <div class="multi-select-search-container">
          <input type="text" class="multi-select-search" placeholder="Cari..." autocomplete="off">
        </div>
        <div class="multi-select-options">
      `;
      
      const optionsHtml = items.map(item => `
        <label class="checkbox-label" data-search="${escapeHtml(item.toLowerCase())}">
          <input type="checkbox" value="${escapeHtml(item)}" data-filter="${filterType}">
          <span>${escapeHtml(item)}</span>
        </label>
      `).join("");
      
      container.innerHTML = searchHtml + optionsHtml + `</div>`;
      
      const searchInput = container.querySelector('.multi-select-search');
      const labels = container.querySelectorAll('.checkbox-label');
      
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        labels.forEach(label => {
          if (label.dataset.search.includes(term)) {
            label.style.display = 'flex';
          } else {
            label.style.display = 'none';
          }
        });
      });

      searchInput.addEventListener('click', (e) => e.stopPropagation());
      
      container.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
          applyFilters();
          updateButtonLabels();
        });
      });
    };
    
    buildCheckboxes(provinces, provDropdown, "province");
    buildCheckboxes(cities, cityDropdown, "city");
    
    // Preset Moewardi logic
    const presetBtn = document.getElementById("presetMoewardiBtn");
    if (presetBtn) {
      presetBtn.addEventListener("click", () => {
        console.log("Preset Moewardi clicked!");
        const moewardiProvTerms = ['DI YOGYAKARTA', 'JAWA TENGAH', 'JAWA TIMUR', 'DIY'];
        const moewardiCityTerms = ['SURAKARTA', 'SUKOHARJO', 'KARANGANYAR', 'SRAGEN', 'BOYOLALI', 'WONOGIRI', 'KLATEN', 'PACITAN', 'NGAWI', 'MADIUN', 'YOGYAKARTA', 'SLEMAN', 'SEMARANG'];
        
        document.querySelectorAll('#provDropdown input[type="checkbox"], #cityDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
        
        document.querySelectorAll('#provDropdown input[type="checkbox"]').forEach(cb => {
          const val = cb.value.toUpperCase();
          if (moewardiProvTerms.some(term => val.includes(term))) {
            cb.checked = true;
          }
        });

        document.querySelectorAll('#cityDropdown input[type="checkbox"]').forEach(cb => {
          const val = cb.value.toUpperCase();
          if (moewardiCityTerms.some(term => val.includes(term))) {
            cb.checked = true;
          }
        });

        // Set Target RS ke RS Moewardi
        if (originalData.hospitals.some(h => h.code === "3372015")) {
          state.targetCode = "3372015";
          const input = document.getElementById("targetHospitalInput");
          if (input) {
            const h = originalData.hospitals.find(h => h.code === "3372015");
            input.value = `${h.name} · ${h.city}`;
          }
        }

        applyFilters();
        updateButtonLabels();
      });
    }

    // Preset Jabar EX BEBODEPOK logic
    const presetJabarBtn = document.getElementById("presetJabarBtn");
    if (presetJabarBtn) {
      presetJabarBtn.addEventListener("click", () => {
        const excludedTerms = ['BEKASI', 'BOGOR', 'DEPOK'];
        const jabarCities = Array.from(new Set(
          data.hospitals
            .filter(h => h.province && h.province.toUpperCase() === 'JAWA BARAT')
            .map(h => h.city.toUpperCase())
        ));
        const includedCities = jabarCities.filter(city => !excludedTerms.some(term => city.includes(term)));
        
        document.querySelectorAll('#provDropdown input[type="checkbox"], #cityDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
        
        document.querySelectorAll('#provDropdown input[type="checkbox"]').forEach(cb => {
          if (cb.value.toUpperCase() === 'JAWA BARAT') {
            cb.checked = true;
          }
        });

        document.querySelectorAll('#cityDropdown input[type="checkbox"]').forEach(cb => {
          if (includedCities.includes(cb.value.toUpperCase())) {
            cb.checked = true;
          }
        });

        applyFilters();
        updateButtonLabels();
      });
    }

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
    
    state.serviceScenarios = {};
    
    populateHospitalSelector();
    renderAll();
  }

  populateFilters();
  populateHospitalSelector();
  populateSlideDots();
  document.getElementById("previousSlide").addEventListener("click", () => showSlide(state.activeSlide - 1));
  document.getElementById("nextSlide").addEventListener("click", () => showSlide(state.activeSlide + 1));
  document.getElementById("exportExcelBtn").addEventListener("click", () => {
    try {
      exportToExcel();
    } catch (err) {
      alert("Gagal meng-export Excel: " + err.message);
      console.error(err);
    }
  });

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
  
  function exportToExcel() {
    if (typeof XLSX === 'undefined') {
      alert("SheetJS library belum termuat. Silakan periksa koneksi internet.");
      return;
    }
    
    function applyStyles(ws, isSheet5 = false) {
      if (!ws['!ref']) return;
      const range = XLSX.utils.decode_range(ws['!ref']);
      const colWidths = [];
      const border = {
        top: { style: 'thin', color: { rgb: "000000" } },
        bottom: { style: 'thin', color: { rgb: "000000" } },
        left: { style: 'thin', color: { rgb: "000000" } },
        right: { style: 'thin', color: { rgb: "000000" } }
      };
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({c:C, r:R});
          if (!ws[cellRef]) continue;
          if (!ws[cellRef].s) ws[cellRef].s = {};
          
          // Ensure formula cells have a cached value so Excel doesn't show blank
          if (ws[cellRef].f && ws[cellRef].v === undefined) {
            ws[cellRef].v = 0;
          }
          
          ws[cellRef].s.border = border;
          ws[cellRef].s.alignment = { wrapText: true, vertical: 'center' };
          
          let isHeader = false;
          const val = ws[cellRef].v;
          const strVal = ws[cellRef].f ? '' : (val !== undefined && val !== null ? val.toString() : '');
          
          if (isSheet5) {
            if (typeof val === 'string' && (val.startsWith("Layanan:") || val.startsWith("Kompetensi") || val.startsWith("Skenario") || val.includes("Tambahan Kasus") || val.includes("Pengurangan Kasus") || val.includes("Net Kasus") || val.includes("Net Pendapatan") || val === "% T" || val === "% K" || val === "Kasus" || val === "INA (Rp)" || val === "% Net Kasus" || val === "Net Rp" || val === "Eksisting" || val === "% Kenaikan")) {
              isHeader = true;
            }
          } else {
            if (R === 0) isHeader = true;
          }
          
          if (isHeader) {
            ws[cellRef].s.font = { bold: true, color: { rgb: "FFFFFF" } };
            ws[cellRef].s.fill = { fgColor: { rgb: "4F46E5" } };
            ws[cellRef].s.alignment.horizontal = "center";
          } else if (ws[cellRef].t === 'n') {
            ws[cellRef].s.numFmt = "#,##0";
          }
          
          let len = strVal ? strVal.length : (val !== undefined ? val.toString().length : 10);
          if (!colWidths[C]) colWidths[C] = 10;
          if (len > colWidths[C]) colWidths[C] = len > 30 ? 30 : len;
        }
      }
      ws['!cols'] = colWidths.map(w => ({ wch: w + 2 }));
    }
    
    const target = targetHospital();
    if (!target) return;
    
    // Ensure all service scenarios are initialized before export
    data.services.forEach(service => {
      if (!state.serviceScenarios[service]) {
        const targetCompetency = getCompetency(target, service);
        if (targetCompetency > 0) {
          state.serviceScenarios[service] = Array(6).fill().map((_, i) => {
            let scn = {};
            const rules = getLevelRules(targetCompetency);
            rules.tambah.forEach(lvl => {
              let lvlCompetitors = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= lvl).length;
              scn['tambah_' + lvl] = parseFloat(Math.min(100, Math.max(0, (100 / (lvlCompetitors + 1)) + (i * 5))).toFixed(1));
            });
            rules.kurang.forEach(lvl => {
              const tSvc = target.services[service];
              if (tSvc && severityMetric(tSvc, lvl)[CASES] > 0) {
                // Start at 50%, increase 10% per scenario: 50, 60, 70, 80, 90, 100
                scn['kurang_' + lvl] = parseFloat(Math.min(100, 50 + (i * 10)).toFixed(1));
              }
            });
            return scn;
          });
        }
      }
    });
    
    const wb = XLSX.utils.book_new();
    
    // SHEET 1: DATA RS
    const ws1_data = [
      ["Kode RS", "Nama RS", "Kelas", "Kab/Kota", "Total Kasus", "Total Pendapatan INA-CBG (Rp)", "Total Pendapatan iDRG (Rp)", "Selisih (iDRG - INA)"]
    ];
    data.hospitals.forEach(h => {
      ws1_data.push([
        h.code, h.name, h.class || "-", h.city || "-", h.total[CASES] || 0, h.total[INA] || 0, h.total[IDRG] || 0, (h.total[IDRG] || 0) - (h.total[INA] || 0)
      ]);
    });
    const ws1 = XLSX.utils.aoa_to_sheet(ws1_data);
    applyStyles(ws1, false);
    XLSX.utils.book_append_sheet(wb, ws1, "1_Data_Seluruh_RS");
    
    // SHEET 2: KASUS REGIONAL VS TARGET
    const ws2_data = [
      ["Layanan", 
       "Target_Kasus_Dasar", "Target_Kasus_Madya", "Target_Kasus_Utama", "Target_Kasus_Paripurna",
       "Target_INA_Dasar", "Target_INA_Madya", "Target_INA_Utama", "Target_INA_Paripurna",
       "Eksternal_Kasus_Dasar", "Eksternal_Kasus_Madya", "Eksternal_Kasus_Utama", "Eksternal_Kasus_Paripurna",
       "Eksternal_iDRG_Dasar", "Eksternal_iDRG_Madya", "Eksternal_iDRG_Utama", "Eksternal_iDRG_Paripurna",
       "Target_Total_Kasus", "Target_Total_INA"]
    ];
    
    data.services.forEach(service => {
      const targetSvc = target.services[service];
      const regionalSvc = data.regional.services[service];
      
      // t: [cases, ina, idrg] for target
      const t = { 1: [0,0,0], 2: [0,0,0], 3: [0,0,0], 4: [0,0,0] };
      if (targetSvc) {
        [1,2,3,4].forEach(lvl => {
          const m = severityMetric(targetSvc, lvl);
          t[lvl] = [m[CASES]||0, m[INA]||0, m[IDRG]||0];
        });
      }
      
      // r: [cases, ina, idrg] for regional
      const r = { 1: [0,0,0], 2: [0,0,0], 3: [0,0,0], 4: [0,0,0] };
      if (regionalSvc) {
        [1,2,3,4].forEach(lvl => {
          const m = severityMetric(regionalSvc, lvl);
          r[lvl] = [m[CASES]||0, m[INA]||0, m[IDRG]||0];
        });
      }
      
      const e = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
      [1,2,3,4].forEach(lvl => {
        e[lvl][0] = Math.max(0, r[lvl][0] - t[lvl][0]); // Eksternal Kasus
        e[lvl][1] = Math.max(0, r[lvl][2] - t[lvl][2]); // Eksternal iDRG (bukan INA!)
      });
      
      const targetTotalKasus = t[1][0] + t[2][0] + t[3][0] + t[4][0];
      const targetTotalIna = t[1][1] + t[2][1] + t[3][1] + t[4][1];
      
      ws2_data.push([
        formatService(service),
        t[1][0], t[2][0], t[3][0], t[4][0],
        t[1][1], t[2][1], t[3][1], t[4][1],
        e[1][0], e[2][0], e[3][0], e[4][0],
        e[1][1], e[2][1], e[3][1], e[4][1],
        targetTotalKasus, targetTotalIna
      ]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(ws2_data);
    applyStyles(ws2, false);
    XLSX.utils.book_append_sheet(wb, ws2, "2_Kasus_Regional_Vs_Target");
    
    // SHEET 3: REKAP LAYANAN & KOMPETITOR
    const ws3_data = [
      ["Layanan", "Kompetensi Target", "Jumlah Kompetitor", "Daftar Kompetitor"]
    ];
    
    data.services.forEach(service => {
      const targetCompetency = getCompetency(target, service);
      let compCount = 0;
      let compNames = "";
      if (targetCompetency > 0) {
        const competitorsList = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= targetCompetency);
        compCount = competitorsList.length;
        compNames = competitorsList.map(h => h.name).join(", ");
      }
      ws3_data.push([
        formatService(service),
        targetCompetency,
        compCount,
        compNames
      ]);
    });
    const ws3 = XLSX.utils.aoa_to_sheet(ws3_data);
    applyStyles(ws3, false);
    XLSX.utils.book_append_sheet(wb, ws3, "3_Rekap_Kompetitor");
    
    // SHEET 4: SIMULASI GLOBAL (RUMUS EXCEL)
    const ws4_data = [
      ["Layanan", "Eksisting Kasus", "Eksisting INA-CBG", "% Tambah (Default)", "% Kurang (Default)", "Tambahan Kasus", "Tambahan iDRG (Rp)", "Kurang Kasus", "Kurang INA-CBG (Rp)", "Net Kasus", "Net iDRG (Rp)", "% Kenaikan iDRG"]
    ];
    
    let ws4TotalEksKasus = 0, ws4TotalEksIna = 0;
    let ws4TotalTambahKasus = 0, ws4TotalTambahIdrg = 0;
    let ws4TotalKurangKasus = 0, ws4TotalKurangIna = 0;
    let ws4TotalNetKasus = 0, ws4TotalNetIdrg = 0;
    
    data.services.forEach((service, i) => {
      const rowNum = i + 2; 
      const targetCompetency = getCompetency(target, service);
      
      // Compute actual values in JS (mirrors Slide 6 / renderComparisonSlide logic)
      const tSvc = target.services[service];
      const rSvc = data.regional.services[service];
      const rules = getLevelRules(targetCompetency);
      
      const eksKasusVal = tSvc ? (tSvc.total[CASES] || 0) : 0;
      const eksInaVal = tSvc ? (tSvc.total[INA] || 0) : 0;
      
      ws4TotalEksKasus += eksKasusVal;
      ws4TotalEksIna += eksInaVal;
      
      let pctTambahVal = 0, pctKurangVal = 0;
      let tambahKasusVal = 0, tambahIdrgVal = 0;
      let kurangKasusVal = 0, kurangInaVal = 0;
      
      if (targetCompetency > 0) {
        const competitors = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= targetCompetency).length;
        pctTambahVal = 100 / (competitors + 1);
        pctKurangVal = 50; // Skenario 1 default kurang = 50%
        
        rules.tambah.forEach(lvl => {
          const rMetric = rSvc ? severityMetric(rSvc, lvl) : [0,0,0];
          const tMetric = tSvc ? severityMetric(tSvc, lvl) : [0,0,0];
          const eksCases = Math.max(0, (rMetric[CASES]||0) - (tMetric[CASES]||0));
          const eksIdrg = Math.max(0, (rMetric[IDRG]||0) - (tMetric[IDRG]||0));
          tambahKasusVal += eksCases * (pctTambahVal / 100);
          tambahIdrgVal += eksIdrg * (pctTambahVal / 100);
        });
        
        rules.kurang.forEach(lvl => {
          const tMetric = tSvc ? severityMetric(tSvc, lvl) : [0,0,0];
          kurangKasusVal += (tMetric[CASES]||0) * (pctKurangVal / 100);
          kurangInaVal += (tMetric[INA]||0) * (pctKurangVal / 100);
        });
      }
      
      const netKasusVal = tambahKasusVal - kurangKasusVal;
      const netIdrgVal = tambahIdrgVal - kurangInaVal;
      const pctKenaikanVal = eksInaVal ? netIdrgVal / eksInaVal : 0;
      
      ws4TotalTambahKasus += tambahKasusVal;
      ws4TotalTambahIdrg += tambahIdrgVal;
      ws4TotalKurangKasus += kurangKasusVal;
      ws4TotalKurangIna += kurangInaVal;
      ws4TotalNetKasus += netKasusVal;
      ws4TotalNetIdrg += netIdrgVal;
      
      // Build formula references (for kertas kerja editability)
      const extKasusCols = {1:'J', 2:'K', 3:'L', 4:'M'};
      const extIdrgCols = {1:'N', 2:'O', 3:'P', 4:'Q'};
      const tarKasusCols = {1:'B', 2:'C', 3:'D', 4:'E'};
      const tarInaCols = {1:'F', 2:'G', 3:'H', 4:'I'};
      
      let tkF = rules.tambah.length > 0 ? rules.tambah.map(lvl => `'2_Kasus_Regional_Vs_Target'!${extKasusCols[lvl]}${rowNum}`).join("+") : "0";
      let tiF = rules.tambah.length > 0 ? rules.tambah.map(lvl => `'2_Kasus_Regional_Vs_Target'!${extIdrgCols[lvl]}${rowNum}`).join("+") : "0";
      let kkF = rules.kurang.length > 0 ? rules.kurang.map(lvl => `'2_Kasus_Regional_Vs_Target'!${tarKasusCols[lvl]}${rowNum}`).join("+") : "0";
      let kiF = rules.kurang.length > 0 ? rules.kurang.map(lvl => `'2_Kasus_Regional_Vs_Target'!${tarInaCols[lvl]}${rowNum}`).join("+") : "0";
      
      ws4_data.push([
        formatService(service),
        { t: 'n', f: `'2_Kasus_Regional_Vs_Target'!R${rowNum}`, v: eksKasusVal },
        { t: 'n', f: `'2_Kasus_Regional_Vs_Target'!S${rowNum}`, v: eksInaVal },
        { t: 'n', v: parseFloat(pctTambahVal.toFixed(2)) },
        { t: 'n', v: pctKurangVal },
        { t: 'n', f: `(${tkF}) * (D${rowNum}/100)`, v: tambahKasusVal },
        { t: 'n', f: `(${tiF}) * (D${rowNum}/100)`, v: tambahIdrgVal },
        { t: 'n', f: `(${kkF}) * (E${rowNum}/100)`, v: kurangKasusVal },
        { t: 'n', f: `(${kiF}) * (E${rowNum}/100)`, v: kurangInaVal },
        { t: 'n', f: `F${rowNum}-H${rowNum}`, v: netKasusVal },
        { t: 'n', f: `G${rowNum}-I${rowNum}`, v: netIdrgVal },
        { t: 'n', f: `IF(C${rowNum}=0,0,K${rowNum}/C${rowNum})`, v: pctKenaikanVal }
      ]);
    });
    
    const pctKenaikanTotal = ws4TotalEksIna ? ws4TotalNetIdrg / ws4TotalEksIna : 0;
    ws4_data.push([
      "TOTAL",
      { t: 'n', f: `SUM(B2:B${data.services.length+1})`, v: ws4TotalEksKasus },
      { t: 'n', f: `SUM(C2:C${data.services.length+1})`, v: ws4TotalEksIna },
      "", "",
      { t: 'n', f: `SUM(F2:F${data.services.length+1})`, v: ws4TotalTambahKasus },
      { t: 'n', f: `SUM(G2:G${data.services.length+1})`, v: ws4TotalTambahIdrg },
      { t: 'n', f: `SUM(H2:H${data.services.length+1})`, v: ws4TotalKurangKasus },
      { t: 'n', f: `SUM(I2:I${data.services.length+1})`, v: ws4TotalKurangIna },
      { t: 'n', f: `SUM(J2:J${data.services.length+1})`, v: ws4TotalNetKasus },
      { t: 'n', f: `SUM(K2:K${data.services.length+1})`, v: ws4TotalNetIdrg },
      { t: 'n', v: pctKenaikanTotal }
    ]);
    
    const ws4 = XLSX.utils.aoa_to_sheet(ws4_data);
    applyStyles(ws4, false);
    XLSX.utils.book_append_sheet(wb, ws4, "4_Simulasi_Global");
    
    // Helper for excel columns
    const getExcelCol = (i) => {
      let letter = '';
      while (i >= 0) {
        letter = String.fromCharCode(i % 26 + 65) + letter;
        i = Math.floor(i / 26) - 1;
      }
      return letter;
    };

    // SHEET 5: SIMULASI PER PELAYANAN
    const ws5_data = [];
    let currentRow = 1; 
    let merges = [];
    
    data.services.forEach((service, idx) => {
      const targetCompetency = getCompetency(target, service);
      if (targetCompetency === 0) return;
      
      const scn = state.serviceScenarios[service][0]; // to check which levels have scenarios
      
      ws5_data.push([`Layanan: ${formatService(service)}`, "", "", "", "", "Eksisting Kasus", { t: 'n', f: `'2_Kasus_Regional_Vs_Target'!R${idx+2}` }]);
      ws5_data.push(["Kompetensi", levelNames[targetCompetency], "", "", "", "Eksisting INA", { t: 'n', f: `'2_Kasus_Regional_Vs_Target'!S${idx+2}` }]);
      currentRow += 2;
      
      let header1 = ["Skenario"];
      let header2 = [""];
      
      [1, 2, 3, 4].forEach(lvl => {
        if (scn.hasOwnProperty('tambah_' + lvl)) {
          header1.push(`Tambahan Kasus ${levelNames[lvl]}`, "", "");
          header2.push("% T", "Kasus", "INA (Rp)");
          merges.push({ s: { r: currentRow - 1, c: header1.length - 3 }, e: { r: currentRow - 1, c: header1.length - 1 } });
        }
      });
      
      [1, 2, 3, 4].forEach(lvl => {
        if (scn.hasOwnProperty('kurang_' + lvl)) {
          header1.push(`Pengurangan Kasus ${levelNames[lvl]}`, "", "");
          header2.push("% K", "Kasus", "INA (Rp)");
          merges.push({ s: { r: currentRow - 1, c: header1.length - 3 }, e: { r: currentRow - 1, c: header1.length - 1 } });
        }
      });
      
      header1.push("Net Kasus", "", "Net Pendapatan", "", "");
      merges.push({ s: { r: currentRow - 1, c: header1.length - 5 }, e: { r: currentRow - 1, c: header1.length - 4 } });
      merges.push({ s: { r: currentRow - 1, c: header1.length - 3 }, e: { r: currentRow - 1, c: header1.length - 1 } });
      
      header2.push("Kasus", "% Net Kasus", "Net Rp", "Eksisting", "% Kenaikan");
      
      // Merge 'Skenario' column (rowspan)
      merges.push({ s: { r: currentRow - 1, c: 0 }, e: { r: currentRow, c: 0 } });
      
      ws5_data.push(header1);
      ws5_data.push(header2);
      currentRow += 2;
      
      const extKasusCols = {1:'J', 2:'K', 3:'L', 4:'M'};
      const extInaCols = {1:'N', 2:'O', 3:'P', 4:'Q'};
      const tarKasusCols = {1:'B', 2:'C', 3:'D', 4:'E'};
      const tarInaCols = {1:'F', 2:'G', 3:'H', 4:'I'};
      
      for (let s = 0; s < 6; s++) {
        let rowData = [`Skenario ${s+1}`];
        const scnData = state.serviceScenarios[service][s];
        
        let tkFormulaParts = [];
        let tiFormulaParts = [];
        
        [1,2,3,4].forEach(lvl => {
          if (scn.hasOwnProperty('tambah_' + lvl)) {
            let pctVal = scnData['tambah_' + lvl];
            rowData.push(pctVal); // % T
            
            const colLetterPct = getExcelCol(rowData.length - 1);
            const tkCell = `('2_Kasus_Regional_Vs_Target'!${extKasusCols[lvl]}${idx+2} * (${colLetterPct}${currentRow}/100))`;
            const tiCell = `('2_Kasus_Regional_Vs_Target'!${extInaCols[lvl]}${idx+2} * (${colLetterPct}${currentRow}/100))`;
            
            rowData.push({ t: 'n', f: tkCell }); // Kasus
            rowData.push({ t: 'n', f: tiCell }); // INA
            
            const colLetterTk = getExcelCol(rowData.length - 2);
            const colLetterTi = getExcelCol(rowData.length - 1);
            
            tkFormulaParts.push(`${colLetterTk}${currentRow}`);
            tiFormulaParts.push(`${colLetterTi}${currentRow}`);
          }
        });
        
        let kkFormulaParts = [];
        let kiFormulaParts = [];
        
        [1,2,3,4].forEach(lvl => {
          if (scn.hasOwnProperty('kurang_' + lvl)) {
            let pctVal = scnData['kurang_' + lvl];
            rowData.push(pctVal); // % K
            
            const colLetterPct = getExcelCol(rowData.length - 1);
            const kkCell = `('2_Kasus_Regional_Vs_Target'!${tarKasusCols[lvl]}${idx+2} * (${colLetterPct}${currentRow}/100))`;
            const kiCell = `('2_Kasus_Regional_Vs_Target'!${tarInaCols[lvl]}${idx+2} * (${colLetterPct}${currentRow}/100))`;
            
            rowData.push({ t: 'n', f: kkCell }); // Kasus
            rowData.push({ t: 'n', f: kiCell }); // INA
            
            const colLetterKk = getExcelCol(rowData.length - 2);
            const colLetterKi = getExcelCol(rowData.length - 1);
            
            kkFormulaParts.push(`${colLetterKk}${currentRow}`);
            kiFormulaParts.push(`${colLetterKi}${currentRow}`);
          }
        });
        
        let tkF = tkFormulaParts.length > 0 ? tkFormulaParts.join("+") : "0";
        let tiF = tiFormulaParts.length > 0 ? tiFormulaParts.join("+") : "0";
        let kkF = kkFormulaParts.length > 0 ? kkFormulaParts.join("+") : "0";
        let kiF = kiFormulaParts.length > 0 ? kiFormulaParts.join("+") : "0";
        
        // Net Kasus
        rowData.push({ t: 'n', f: `(${tkF}) - (${kkF})` }); 
        
        const eksRow = currentRow - s - 4;
        
        // % Net Kasus
        const netKasusCol = getExcelCol(rowData.length - 1);
        rowData.push({ t: 'n', f: `IF(G${eksRow}=0, 0, ${netKasusCol}${currentRow}/G${eksRow})` });
        
        // Net Rp
        rowData.push({ t: 'n', f: `(${tiF}) - (${kiF})` });
        
        // Eksisting Rp
        rowData.push({ t: 'n', f: `G${eksRow+1}` });
        
        // % Kenaikan
        const netRpCol = getExcelCol(rowData.length - 2);
        rowData.push({ t: 'n', f: `IF(G${eksRow+1}=0, 0, ${netRpCol}${currentRow}/G${eksRow+1})` }); 
        
        ws5_data.push(rowData);
        currentRow += 1;
      }
      ws5_data.push([]); 
      currentRow += 1;
    });
    
    const ws5 = XLSX.utils.aoa_to_sheet(ws5_data);
    ws5['!merges'] = merges;
    applyStyles(ws5, true);
    XLSX.utils.book_append_sheet(wb, ws5, "5_Simulasi_Per_Layanan");
    
    XLSX.writeFile(wb, `Kertas_Kerja_Market_Share_${target.name.replace(/\\s+/g, '_')}.xlsx`);
  }

  renderAll();
})();
