(function marketShareSimulator() {
  "use strict";

  const data = window.marketSimulatorData;
  if (!data) throw new Error("Dataset simulator tidak tersedia.");

  const CASES = 0;
  const INA = 1;
  const IDRG = 2;
  const severityRanks = [1, 2, 3, 4];
  const levelNames = { 0: "Tidak terpetakan", 1: "Dasar", 2: "Madya", 3: "Utama", 4: "Paripurna" };
  const shortLevelNames = { 1: "D", 2: "M", 3: "U", 4: "P" };
  const hospitalByCode = new Map(data.hospitals.map((hospital) => [hospital.code, hospital]));
  const hospitalClassCounts = ["A", "B", "C", "D"].reduce((counts, className) => {
    counts[className] = data.hospitals.filter((hospital) => String(hospital.class || "").trim().toUpperCase() === className).length;
    return counts;
  }, {});
  const defaultTarget = hospitalByCode.has(data.meta.defaultTargetCode)
    ? data.meta.defaultTargetCode
    : data.hospitals[0]?.code;

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
    const maxSeverityCases = Math.max(...severityRanks.map((rank) => severityMetric(target, rank)[CASES]), 1);
    const topServices = Object.entries(target.services)
      .map(([service, item]) => ({ service, item }))
      .sort((a, b) => b.item.total[CASES] - a.item.total[CASES])
      .slice(0, 4);
    const mappedCount = data.services.filter((service) => getCompetency(target, service) > 0).length;

    document.getElementById("slide1Title").textContent = `Profil eksisting ${target.name}`;
    document.getElementById("slide1Subtitle").textContent = `${target.city} · kelas ${target.class || "—"} · kode RS ${target.code}`;
    document.getElementById("existingSlide").innerHTML = `
      <div class="kpi-grid">
        <article class="kpi-card is-primary"><div class="kpi-label">Kasus eksisting</div><div class="kpi-value">${formatNumber(target.total[CASES])}</div><div class="kpi-note">Seluruh layanan dan tingkat keparahan</div></article>
        <article class="kpi-card"><div class="kpi-label">Pendapatan INA-CBG</div><div class="kpi-value">${formatMoney(target.total[INA])}</div><div class="kpi-note">Baseline klaim</div></article>
        <article class="kpi-card"><div class="kpi-label">Pendapatan iDRG</div><div class="kpi-value">${formatMoney(target.total[IDRG])}</div><div class="kpi-note">Skenario 2 workbook</div></article>
        <article class="kpi-card ${delta < 0 ? "is-negative" : "is-positive"}"><div class="kpi-label">Selisih iDRG vs INA-CBG</div><div class="kpi-value">${formatMoney(delta)}</div><div class="kpi-note">${formatPercent(target.total[INA] ? delta / target.total[INA] : 0)}</div></article>
      </div>
      <div class="two-column existing-layout">
        <article class="panel profile-panel">
          <div class="hospital-identity"><span class="hospital-icon" aria-hidden="true">✚</span><div><h2>${escapeHtml(target.name)}</h2><p>${escapeHtml(target.city)}, ${escapeHtml(target.province)}</p></div></div>
          <div>
            <div class="fact-grid">
              <div class="fact"><span>Kelas RS</span><strong>Kelas ${escapeHtml(target.class || "—")}</strong></div>
              <div class="fact"><span>Cakupan layanan</span><strong>${mappedCount}/24</strong></div>
            </div>
            <div class="panel-heading" style="margin-top:18px"><h2>Kasus menurut keparahan</h2><span>D–M–U–P</span></div>
            <div class="severity-bars">
              ${severityRanks.map((rank) => {
                const cases = severityMetric(target, rank)[CASES];
                return `<div class="metric-bar-row"><span>${levelNames[rank]}</span><div class="bar-track"><div class="bar-fill level-${rank}" style="width:${Math.max((cases / maxSeverityCases) * 100, cases ? 1 : 0)}%"></div></div><strong>${formatNumber(cases)}</strong></div>`;
              }).join("")}
            </div>
          </div>
          <div class="profile-note"><strong>${formatNumber(metric(target.unclassified)[CASES])} kasus</strong> belum memiliki klasifikasi tingkat keparahan ICD dan dipertahankan sebagai baseline, tetapi tidak masuk pool capture D–M–U–P.</div>
        </article>
        <div class="existing-right">
          <article class="panel">
            <div class="panel-heading"><h2>Peta kompetensi 24 layanan</h2><span>${mappedCount} terpetakan · ${24 - mappedCount} belum terpetakan</span></div>
            <div class="competency-grid">
              ${data.services.map((service) => `<div class="competency-row"><span>${escapeHtml(formatService(service))}</span>${levelBadge(getCompetency(target, service))}</div>`).join("")}
            </div>
          </article>
          <article class="panel">
            <div class="panel-heading"><h2>Empat layanan dengan kasus terbesar</h2><span>Eksisting RS target</span></div>
            <table class="compact-table"><thead><tr><th>Layanan</th><th class="num">Kasus</th><th class="num">iDRG</th><th>Kompetensi</th></tr></thead><tbody>
              ${topServices.map(({ service, item }) => `<tr><td class="service-name">${escapeHtml(formatService(service))}</td><td class="num">${formatNumber(item.total[CASES])}</td><td class="num">${formatMoney(item.total[IDRG])}</td><td>${levelBadge(item.competency)}</td></tr>`).join("")}
            </tbody></table>
          </article>
        </div>
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
        <div class="table-wrap"><table class="compact-table"><thead><tr><th>Layanan</th><th>Kompetensi target</th><th>Keparahan yang mampu dilayani</th><th class="num">Kasus regional eligible</th><th class="num">Eksisting eligible</th><th class="num">External pool</th><th class="num">iDRG external</th><th class="num">Kompetitor setara</th></tr></thead><tbody>
          ${result.rows.map((row) => `<tr class="${row.competency ? "" : "is-disabled"}"><td class="service-name">${escapeHtml(formatService(row.service))}</td><td>${levelBadge(row.competency)}</td><td>${capabilityCells(row.competency)}</td><td class="num">${formatNumber(row.eligibleRegional[CASES])}</td><td class="num">${formatNumber(row.eligibleExisting[CASES])}</td><td class="num">${formatNumber(row.external[CASES])}</td><td class="num">${formatMoney(row.external[IDRG])}</td><td class="num">${formatNumber(row.competitors)}</td></tr>`).join("")}
        </tbody></table></div>
      </article>`;
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
    document.getElementById("slide6Subtitle").textContent = `${target.name} · seluruh layanan · parameter dapat diubah pada slide simulator.`;
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

  function populateHospitalSelector() {
    const selector = document.getElementById("targetHospital");
    selector.innerHTML = data.hospitals.map((hospital) => `<option value="${escapeHtml(hospital.code)}" ${hospital.code === state.targetCode ? "selected" : ""}>${escapeHtml(hospital.name)} · ${escapeHtml(hospital.city)}</option>`).join("");
    selector.addEventListener("change", () => {
      state.targetCode = selector.value;
      const target = targetHospital();
      if (!getCompetency(target, state.selectedService)) {
        state.selectedService = data.services.find((service) => getCompetency(target, service) > 0) || data.services[0];
      }
      state.selectedSeverity = getCompetency(target, state.selectedService) || 1;
      renderAll();
    });
  }

  function populateSlideDots() {
    const count = document.querySelectorAll(".slide").length;
    const container = document.getElementById("slideDots");
    container.innerHTML = Array.from({ length: count }, (_, index) => `<button class="slide-dot ${index === 0 ? "is-active" : ""}" type="button" data-index="${index}" aria-label="Buka slide ${index + 1}"></button>`).join("");
    container.querySelectorAll(".slide-dot").forEach((button) => button.addEventListener("click", () => showSlide(Number(button.dataset.index))));
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

  populateHospitalSelector();
  populateSlideDots();
  document.getElementById("previousSlide").addEventListener("click", () => showSlide(state.activeSlide - 1));
  document.getElementById("nextSlide").addEventListener("click", () => showSlide(state.activeSlide + 1));
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
