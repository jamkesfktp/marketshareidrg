/** Chart and slide hydration helpers. Requires Chart.js and data.js. */
(function exposeMarketCharts(global) {
  const data = global.marketShareData;
  const COLORS = {
    green: "#43B77A",
    greenLight: "#E8F6F2",
    teal: "#0AA7AD",
    tealLight: "#E8F7F8",
    deepTeal: "#087E83",
    slate: "#66736F",
    gray: "#C8DFDB",
    grayLight: "#F4F8F7",
    red: "#C2414B",
  };

  const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = new Intl.NumberFormat("id-ID", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmt = {
    number: (value) => number.format(value),
    pct: (value) => pct.format(value),
    signedPct: (value) => `${value >= 0 ? "+" : ""}${pct.format(value)}`,
    compactCases: (value) => value >= 1e6 ? `${decimal.format(value / 1e6)} jt` : `${number.format(value / 1e3)} rb`,
    rupiah: (value) => {
      const absolute = Math.abs(value);
      const sign = value < 0 ? "-" : "";
      const inMilyar = absolute / 1e9;
      let formatted;
      if (absolute >= 1e9) {
      formatted = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(inMilyar);
    } else {
      formatted = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(inMilyar);
    }
      return `${sign}Rp ${formatted} M`;
    },
  };

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  const shortLabel = (label) => ({
    "THT": "THT",
    "MUSCULOSKELETAL DAN JARINGAN LUNAK": "Muskuloskeletal & jaringan lunak",
    "JANTUNG DAN PEMBULUH DARAH": "Jantung & pembuluh darah",
    "PENCERNAAN DAN HEPATOBILIER": "Pencernaan & hepatobilier",
    "ENDOKRIN, NUTRISI DAN METABOLIK": "Endokrin, nutrisi & metabolik",
    "ALERGI IMUNOLOGI DAN RHEUMATOLOGI": "Alergi, imunologi & rheumatologi",
    "KULIT & PENYAKIT KELAMIN": "Kulit & penyakit kelamin",
    "REKONSTRUKSI DAN ESTETIKA": "Rekonstruksi & estetika",
    "SARAF/ NEUROSCIENCE": "Saraf / neuroscience",
    "IBU DAN GINEKOLOGI": "Ibu & ginekologi",
    "INFEKSI DAN PARASIT": "Infeksi & parasit",
    "PARU DAN PERNAFASAN": "Paru & pernafasan",
  }[label] || label.charAt(0) + label.slice(1).toLowerCase());

  const chartLabel = (label) => ({
    "MUSCULOSKELETAL DAN JARINGAN LUNAK": "Muskuloskeletal",
    "PENCERNAAN DAN HEPATOBILIER": "Pencernaan & hepato",
    "JANTUNG DAN PEMBULUH DARAH": "Jantung & pembuluh",
  }[label] || shortLabel(label));

  const tierClass = (level) => {
    if (level.includes("Paripurna")) return "tier-green";
    if (level.includes("Utama")) return "tier-blue";
    return "tier-gray";
  };

  const tierLabel = (level) => level.replace(/^\d\.\s*/, "");

  const valueLabels = {
    id: "valueLabels",
    afterDatasetsDraw(chart, _args, options) {
      if (!options?.display) return;
      const { ctx } = chart;
      ctx.save();
      ctx.font = options.font || "600 18px Inter, Arial, sans-serif";
      ctx.fillStyle = options.color || COLORS.deepTeal;
      ctx.textBaseline = "middle";
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;
        meta.data.forEach((bar, index) => {
          const raw = dataset.data[index];
          const label = options.formatter ? options.formatter(raw, index, datasetIndex) : String(raw);
          if (chart.options.indexAxis === "y") {
            ctx.textAlign = "left";
            ctx.fillText(label, Math.min(bar.x + 11, chart.chartArea.right - 64), bar.y);
          } else {
            ctx.textAlign = "center";
            ctx.fillText(label, bar.x, bar.y - 14);
          }
        });
      });
      ctx.restore();
    },
  };

  const baseOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    devicePixelRatio: 2,
    plugins: {
      legend: {
        labels: {
          color: COLORS.slate,
          font: { family: "Inter, Arial, sans-serif", size: 17, weight: "500" },
          boxWidth: 18,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: "rectRounded",
        },
      },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { color: "#E7ECF2", drawTicks: false },
        ticks: { color: COLORS.slate, font: { family: "Inter, Arial, sans-serif", size: 16 } },
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: COLORS.deepTeal, font: { family: "Inter, Arial, sans-serif", size: 17, weight: "500" } },
      },
    },
  });

  const makeChart = (id, config) => {
    const canvas = document.getElementById(id);
    if (!canvas || !global.Chart) return null;
    return new global.Chart(canvas, config);
  };

  function hydrateCompetencyMatrix() {
    const container = document.getElementById("competencyMatrix");
    if (!container) return;
    container.innerHTML = data.competencies
      .slice()
      .sort((a, b) => a.service.localeCompare(b.service, "id"))
      .map((item) => `
        <div class="competency-row ${item.mapped ? "" : "competency-unmapped"}">
          <span>${shortLabel(item.service)}</span>
          <strong class="tier ${tierClass(item.level)}">${tierLabel(item.level)}</strong>
        </div>`)
      .join("");
  }

  function initSlide1() {
    setText("hospitalName", data.hospital.name);
    setText("hospitalCode", `Kode RS ${data.hospital.code}`);
    setText("hospitalClass", `Kelas ${data.hospital.class}`);
    setText("hospitalLocation", `${data.hospital.city}, ${data.hospital.province}`);
    setText("existingCases", fmt.number(data.hospital.cases));
    setText("inaRevenue", fmt.rupiah(data.hospital.ina));
    setText("idrgRevenue", fmt.rupiah(data.hospital.idrg));
    setText("revenueDifference", fmt.rupiah(data.hospital.difference));
    setText("revenueDifferencePct", fmt.signedPct(data.metrics.hospitalIdrgDeltaPct));
    setText("serviceCoverage", `${data.source.mappedServiceCount}/${data.source.serviceReferenceCount}`);
    setText("serviceCoverageProfile", `${data.source.mappedServiceCount}/${data.source.serviceReferenceCount}`);
    setText("serviceCoverageHeadline", `${data.source.mappedServiceCount} dari ${data.source.serviceReferenceCount}`);
    setText("missingService", data.source.missingService);
    setText("missingServiceProfile", data.source.missingService);
    setText("missingServiceHeadline", data.source.missingService);
    setText("paripurnaCount", data.competencyCounts.paripurna);
    setText("utamaCount", data.competencyCounts.utama);
    setText("unmappedCount", data.competencyCounts.unmapped);
    setText("competencySummaryLabel", `${data.competencyCounts.paripurna} Paripurna · ${data.competencyCounts.utama} Utama · ${data.competencyCounts.unmapped} tidak terpetakan`);
    hydrateCompetencyMatrix();
  }

  function initSlide2() {
    setText("regionalCases", fmt.number(data.regional.cases));
    setText("sameCompetencyCases", fmt.number(data.matchedMarket.sameCompetencyCases));
    setText("excludedCases", fmt.number(data.matchedMarket.excludedIncompatibleCases));
    setText("matchedCases", fmt.number(data.matchedMarket.cases));
    setText("matchedCasesHeadline", fmt.number(data.matchedMarket.cases));
    setText("matchedCasesFunnel", fmt.number(data.matchedMarket.cases));
    setText("matchedIdrg", fmt.rupiah(data.matchedMarket.idrg));
    setText("matchedServiceCount", data.matchedMarket.matchedServiceCount);
    setText("peerHospitalCount", data.matchedMarket.competitorHospitalCount);
    setText("matchedMarketShare", fmt.pct(data.metrics.matchedMarketRegionalShare));
    setText("noPeerCount", data.noPeerServices.length);

    const noPeer = document.getElementById("noPeerServices");
    if (noPeer) {
      noPeer.innerHTML = data.noPeerServices.map((item) => `<span>${shortLabel(item.service)}</span>`).join("");
    }

    const options = baseOptions();
    options.indexAxis = "y";
    options.layout = { padding: { right: 82 } };
    options.scales.x.ticks.display = false;
    options.scales.x.grid.display = false;
    options.scales.y.ticks.font.size = 16;
    options.plugins.legend.display = false;
    options.plugins.valueLabels = { display: true, formatter: (value) => fmt.compactCases(value), font: "600 16px Inter, Arial, sans-serif" };
    makeChart("matchedServiceChart", {
      type: "bar",
      data: {
        labels: data.topServicePools.map((item) => chartLabel(item.service)),
        datasets: [{
          data: data.topServicePools.map((item) => item.eligibleCases),
          backgroundColor: data.topServicePools.map((item) => item.competency.includes("Paripurna") ? COLORS.green : COLORS.teal),
          borderRadius: 5,
          barThickness: 24,
        }],
      },
      options,
      plugins: [valueLabels],
    });
  }

  function initSlide3A() {
    const workScenario = data.scenarios.find((item) => item.share === 0.20);
    setText("eligibleBase", fmt.number(data.matchedMarket.cases));
    setText("eligibleShareRegional", fmt.pct(data.metrics.matchedMarketRegionalShare));
    setText("workScenarioShare", fmt.pct(workScenario.share));
    setText("workScenarioCases", fmt.compactCases(workScenario.capturedCases));
    setText("workScenarioTotalCases", fmt.number(workScenario.projectedTotalCases));

    const grid = document.getElementById("scenarioCards");
    if (grid) {
      grid.innerHTML = data.scenarios.map((scenario) => `
        <article class="scenario-card ${scenario.share === 0.20 ? "scenario-featured" : ""}">
          <div class="scenario-share">${fmt.pct(scenario.share)}</div>
          <div class="scenario-cases">+${fmt.number(scenario.capturedCases)}</div>
          <div class="scenario-label">kasus direbut</div>
          <div class="scenario-total">Total Moewardi: <strong>${fmt.number(scenario.projectedTotalCases)}</strong></div>
          ${scenario.share === 0.20 ? '<div class="recommended-tag">Skenario kerja</div>' : ""}
        </article>`).join("");
    }

    const options = baseOptions();
    options.indexAxis = "y";
    options.layout = { padding: { right: 108 } };
    options.scales.x.max = 115000;
    options.scales.x.ticks.callback = (value) => `${number.format(value / 1000)} rb`;
    options.scales.y.ticks.font.size = 20;
    options.plugins.legend.display = false;
    options.plugins.valueLabels = { display: true, formatter: (value) => `+${fmt.number(value)}` };
    makeChart("volumeScenarioChart", {
      type: "bar",
      data: {
        labels: data.scenarios.map((item) => `Capture ${fmt.pct(item.share)}`),
        datasets: [{
          data: data.scenarios.map((item) => item.capturedCases),
          backgroundColor: data.scenarios.map((item) => item.share === 0.20 ? COLORS.green : COLORS.tealLight),
          borderColor: data.scenarios.map((item) => item.share === 0.20 ? COLORS.green : COLORS.teal),
          borderWidth: 1,
          borderRadius: 7,
          barThickness: 42,
        }],
      },
      options,
      plugins: [valueLabels],
    });
  }

  function initSlide3B() {
    const workScenario = data.scenarios.find((item) => item.share === 0.20);
    setText("marketDeltaPct", fmt.signedPct(data.metrics.matchedMarketIdrgDeltaPct));
    setText("marketDeltaAmount", fmt.rupiah(data.matchedMarket.difference));
    setText("workCapturedIdrg", fmt.rupiah(workScenario.capturedIdrg));
    setText("workProjectedIdrg", fmt.rupiah(workScenario.projectedTotalIdrg));

    const body = document.getElementById("revenueScenarioRows");
    if (body) {
      body.innerHTML = data.scenarios.map((item) => `
        <tr class="${item.share === 0.20 ? "highlight-row" : ""}">
          <td>${fmt.pct(item.share)}</td>
          <td>+${fmt.number(item.capturedCases)}</td>
          <td>${fmt.rupiah(item.capturedIna)}</td>
          <td>${fmt.rupiah(item.capturedIdrg)}</td>
          <td>${fmt.rupiah(item.projectedTotalIdrg)}</td>
          <td class="negative">${fmt.rupiah(item.capturedDifference)}</td>
        </tr>`).join("");
    }

    const options = baseOptions();
    options.scales.y.ticks.callback = (value) => `Rp${number.format(value / 1e9)} M`;
    options.scales.x.grid.display = false;
    options.plugins.legend.position = "top";
    makeChart("revenueScenarioChart", {
      type: "bar",
      data: {
        labels: data.scenarios.map((item) => fmt.pct(item.share)),
        datasets: [
          { label: "INA-CBG incremental", data: data.scenarios.map((item) => item.capturedIna), backgroundColor: COLORS.teal, borderRadius: 5, barPercentage: 0.72 },
          { label: "iDRG incremental", data: data.scenarios.map((item) => item.capturedIdrg), backgroundColor: COLORS.green, borderRadius: 5, barPercentage: 0.72 },
        ],
      },
      options,
    });
  }

  function initSlide4() {
    const neoplasma = data.neoplasma;
    const capture20Cases = Math.round(neoplasma.eligibleCases * 0.20);
    const capture20Idrg = neoplasma.eligibleIdrg * 0.20;
    setText("neoplasmaCompetency", tierLabel(neoplasma.competency));
    setText("neoplasmaPool", fmt.number(neoplasma.eligibleCases));
    setText("neoplasmaPoolKpi", fmt.number(neoplasma.eligibleCases));
    setText("neoplasmaCompetitorCount", neoplasma.competitors.length);
    setText("neoplasmaCaptureCases", fmt.number(capture20Cases));
    setText("neoplasmaCaptureRevenue", fmt.rupiah(capture20Idrg));

    const rows = document.getElementById("peerServiceRows");
    if (rows) {
      rows.innerHTML = data.topServicePools.slice(0, 5).map((item, index) => `
        <div class="peer-service-row ${item.service === "NEOPLASMA" ? "peer-highlight" : ""}">
          <div class="rank-number">${index + 1}</div>
          <div class="peer-service-name">${shortLabel(item.service)}</div>
          <div><span class="tier ${tierClass(item.competency)}">${tierLabel(item.competency)}</span></div>
          <div class="peer-number">${fmt.number(item.eligibleCases)}</div>
          <div class="peer-number">${item.competitorCount} RS</div>
          <div class="peer-hospital">${item.topCompetitor}</div>
        </div>`).join("");
    }

    const cards = document.getElementById("neoplasmaCompetitors");
    if (cards) {
      cards.innerHTML = neoplasma.competitors.map((item) => `
        <div class="competitor-card">
          <strong>${item.name}</strong>
          <span>${item.city} · ${fmt.number(item.cases)} kasus</span>
          <small>${fmt.pct(item.cases / neoplasma.eligibleCases)} dari pool Neoplasma Utama</small>
        </div>`).join("");
    }

    const comparison = [
      { label: "Moewardi eksisting", cases: neoplasma.existingCases, color: COLORS.deepTeal },
      ...neoplasma.competitors.map((item, index) => ({ label: index === 0 ? "Margono" : "Kariadi", cases: item.cases, color: index === 0 ? COLORS.green : COLORS.teal })),
    ];
    const options = baseOptions();
    options.indexAxis = "y";
    options.layout = { padding: { right: 82 } };
    options.scales.x.ticks.display = false;
    options.scales.x.grid.display = false;
    options.plugins.legend.display = false;
    options.plugins.valueLabels = { display: true, formatter: (value) => fmt.number(value) };
    makeChart("neoplasmaCompetitorChart", {
      type: "bar",
      data: {
        labels: comparison.map((item) => item.label),
        datasets: [{ data: comparison.map((item) => item.cases), backgroundColor: comparison.map((item) => item.color), borderRadius: 6, barThickness: 36 }],
      },
      options,
      plugins: [valueLabels],
    });
  }

  function initSlide5() {
    const workScenario = data.scenarios.find((item) => item.share === 0.20);
    setText("summaryMatchedMarket", fmt.number(data.matchedMarket.cases));
    setText("summaryPeerHospitals", data.matchedMarket.competitorHospitalCount);
    setText("summaryMatchedServices", data.matchedMarket.matchedServiceCount);
    setText("summaryExistingCases", fmt.number(data.hospital.cases));
    setText("summaryCapturedCases", fmt.number(workScenario.capturedCases));
    setText("summaryCapturedCases2", fmt.number(workScenario.capturedCases));
    setText("summaryProjectedCases", fmt.number(workScenario.projectedTotalCases));
    setText("summaryProjectedIdrg", fmt.rupiah(workScenario.projectedTotalIdrg));
    setText("summaryDeltaPct", fmt.signedPct(data.metrics.matchedMarketIdrgDeltaPct));
    setText("summaryMissingService", data.source.missingService);
    setText("summaryNeoplasmaPool", fmt.number(data.neoplasma.eligibleCases));
    setText("summaryNeoplasmaPeers", data.neoplasma.competitors.length);
  }

  global.MarketCharts = { initSlide1, initSlide2, initSlide3A, initSlide3B, initSlide4, initSlide5, fmt };
})(window);
