(function marketShareSimulator() {
  "use strict";

  const allDatasets = window.marketSimulatorDatasets || { "okt_jun": window.marketSimulatorData };
  let activeDatasetKey = "okt_jun";
  let originalData = allDatasets[activeDatasetKey] || window.marketSimulatorData;
  let data = allDatasets[activeDatasetKey] || window.marketSimulatorData;
  if (!data) throw new Error("Dataset simulator tidak tersedia.");

  if (data.services && !data.services.includes('FORENSIK DAN MEDIKOLEGAL')) {
    data.services.push('FORENSIK DAN MEDIKOLEGAL');
    data.services.sort();
  }

  const CASES = 0;
  const INA = 1;
  let IDRG = 2;
  let REVENUE = 2;
  const severityRanks = [1, 2, 3, 4];
  const levelNames = { 0: "Tidak Kompeten", 1: "Dasar", 2: "Madya", 3: "Utama", 4: "Paripurna" };
  const shortLevelNames = { 1: "D", 2: "M", 3: "U", 4: "P" };

  const DATASET_PERIODS = {
    "okt_jun": {
      key: "okt_jun",
      label: "Okt 2025 - Jun 2026 (8 Bulan - 111,76 Jt Kasus)",
      chip: "Okt 2025 - Jun 2026 (8 Bulan)",
      desc: "Master CSV: spending_okt_jun_v3_gabungan.csv"
    },
    "jan_des": {
      key: "jan_des",
      label: "Jan - Des (1 Tahun Penuh / 12 Bulan)",
      chip: "Jan - Des (1 Tahun Penuh)",
      desc: "Master CSV: spending_jan_des_v11_gabungan.csv"
    }
  };

  const TARIFF_SCENARIOS = {
    "1370_full": { index: 2, label: "iDRG 1370 - AF + AFreg + AFkep (Default)", chip: "iDRG 1370 (AF + AFreg + AFkep)", desc: "Model 1.370 DRG dengan penyesuaian AF + AFreg + AFkep" },
    "1370_afreg": { index: 3, label: "iDRG 1370 - AF + AFreg", chip: "iDRG 1370 (AF + AFreg)", desc: "Model 1.370 DRG dengan penyesuaian AF + AFreg" },
    "1370_af": { index: 4, label: "iDRG 1370 - AF Saja", chip: "iDRG 1370 (AF Saja)", desc: "Model 1.370 DRG dengan penyesuaian AF saja" },
    "1370_noaf": { index: 5, label: "iDRG 1370 - Tanpa AF (Base)", chip: "iDRG 1370 (Tanpa AF)", desc: "Tarif dasar iDRG 1.370 tanpa penyesuaian AF" },
    "1370_juknis": { index: 6, label: "iDRG 1370 - Juknis Top-Up", chip: "iDRG 1370 (Juknis Top-Up)", desc: "Model 1.370 DRG skema Juknis Top-Up" },
    "1363_full": { index: 7, label: "iDRG 1363 - AF + AFreg + AFkep", chip: "iDRG 1363 (AF + AFreg + AFkep)", desc: "Model lama 1.363 DRG (AF + AFreg + AFkep)" }
  };

  function updateActiveTariff(scenarioKey) {
    const sc = TARIFF_SCENARIOS[scenarioKey] || TARIFF_SCENARIOS["1370_full"];
    state.activeTariffScenario = scenarioKey;
    IDRG = sc.index;
    REVENUE = sc.index;

    const labelEl = document.getElementById("activeTariffLabel");
    if (labelEl) labelEl.textContent = sc.chip;

    const descEl = document.getElementById("tariffScenarioDesc");
    if (descEl) descEl.textContent = sc.desc;

    const selectEl = document.getElementById("tariffScenarioSelect");
    if (selectEl && selectEl.value !== scenarioKey) selectEl.value = scenarioKey;
  }

  function switchDatasetPeriod(datasetKey) {
    if (!allDatasets[datasetKey]) return;
    activeDatasetKey = datasetKey;
    state.activeDataset = datasetKey;
    originalData = allDatasets[datasetKey];
    data = allDatasets[datasetKey];

    if (data && data.services && !data.services.includes('FORENSIK DAN MEDIKOLEGAL')) {
      data.services.push('FORENSIK DAN MEDIKOLEGAL');
      data.services.sort();
    }

    const pInfo = DATASET_PERIODS[datasetKey] || DATASET_PERIODS["okt_jun"];
    const periodLabelEl = document.getElementById("activePeriodLabel");
    if (periodLabelEl) periodLabelEl.textContent = pInfo.chip;

    const periodDescEl = document.getElementById("datasetPeriodDesc");
    if (periodDescEl) periodDescEl.textContent = pInfo.desc;

    const periodSelectEl = document.getElementById("datasetPeriodSelect");
    if (periodSelectEl && periodSelectEl.value !== datasetKey) periodSelectEl.value = datasetKey;

    updateDataState();
    populateFilters(true);
    populateHospitalSelector();
    
  document.getElementById('globalSimServiceSelect')?.addEventListener('change', () => {
    if(typeof renderGlobalSimulationSlide === "function") renderGlobalSimulationSlide();
    if(typeof renderCompetencySimSlide === "function") renderCompetencySimSlide();
    if(typeof renderRecapSlide === "function") renderRecapSlide();
    if(typeof renderLogicalRecapSlide === "function") renderLogicalRecapSlide();
  });

  renderAll();
  }
  
  let hospitalByCode = new Map();
  let hospitalClassCounts = {};
  let dataStateVersion = 0;
  let targetAggregateCache = { codesRef: null, version: -1, value: null };
  
  function updateDataState() {
    hospitalByCode = new Map(data.hospitals.map((hospital) => [hospital.code, hospital]));
    hospitalClassCounts = ["A", "B", "C", "D"].reduce((counts, className) => {
      counts[className] = data.hospitals.filter((hospital) => String(hospital.class || "").trim().toUpperCase() === className).length;
      return counts;
    }, {});
    dataStateVersion += 1;
    targetAggregateCache = { codesRef: null, version: -1, value: null };
  }
  updateDataState();
  
  const defaultTarget = hospitalByCode.has(data.meta.defaultTargetCode)
    ? data.meta.defaultTargetCode
    : (data.hospitals.length > 0 ? data.hospitals[0].code : "");

  const state = {
    targetCode: defaultTarget,
    targetCodes: defaultTarget ? [defaultTarget] : [],
    activeSlide: 0,
    activeTariffScenario: "1370_full",
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
  const decimalFormatter = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const compactFormatter = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const VECTOR_LENGTH = 9;
  const createZeroMetric = () => Array(VECTOR_LENGTH).fill(0);

  function addVectors(target, source) {
    if (!source) return;
    const len = Math.max(target.length, source.length, VECTOR_LENGTH);
    for (let i = 0; i < len; i++) {
      target[i] = (target[i] || 0) + (source[i] || 0);
    }
  }

  const metric = (value) => {
    if (!Array.isArray(value)) return createZeroMetric();
    if (value.length < VECTOR_LENGTH) {
      const res = createZeroMetric();
      for (let i = 0; i < value.length; i++) res[i] = value[i] || 0;
      return res;
    }
    return value;
  };
  const severityMetric = (container, rank) => metric(container?.severity?.[rank]);
  const addMetrics = (left, right) => {
    const l = metric(left);
    const r = metric(right);
    const len = Math.max(l.length, r.length, VECTOR_LENGTH);
    const res = new Array(len);
    for (let i = 0; i < len; i++) {
      res[i] = (l[i] || 0) + (r[i] || 0);
    }
    return res;
  };
  const subtractMetrics = (left, right) => {
    const l = metric(left);
    const r = metric(right);
    const len = Math.max(l.length, r.length, VECTOR_LENGTH);
    const res = new Array(len);
    for (let i = 0; i < len; i++) {
      res[i] = Math.max((l[i] || 0) - (r[i] || 0), 0);
    }
    return res;
  };
  const multiplyMetric = (value, factor) => {
    const v = metric(value);
    return v.map((item) => item * factor);
  };
  const sumMetrics = (values) => {
    if (!values || !values.length) return createZeroMetric();
    return values.reduce(addMetrics, createZeroMetric());
  };

  const formatNumber = (value) => numberFormatter.format(Math.round(Number(value) || 0));
  const formatSignedNumber = (value) => {
    const numeric = Math.round(Number(value) || 0);
    if (numeric === 0) return "0";
    return `${numeric > 0 ? "+" : "−"}${formatNumber(Math.abs(numeric))}`;
  };
  const formatMoney = (value) => {
    const numeric = Number(value) || 0;
    const absolute = Math.abs(numeric);
    const sign = numeric < 0 ? "-" : "";
    const inMilyar = absolute / 1e9;
    let formatted;
    if (absolute >= 1e9) {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inMilyar);
    } else {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(inMilyar);
    }
    return `${sign}${formatted} M`;
  };
  const formatMatrixMoney = (value) => {const numeric = Number(value) || 0;const absolute = Math.abs(numeric);const sign = numeric < 0 ? "-" : "";const inMilyar = absolute / 1e9;let formatted;if (absolute >= 1e9) {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inMilyar);
    } else {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(inMilyar);
    }return sign + formatted;};
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

  function getTargetHospitals() {
    if (!state.targetCodes || state.targetCodes.length === 0) {
      if (state.targetCode && hospitalByCode.has(state.targetCode)) {
        return [hospitalByCode.get(state.targetCode)];
      }
      return data.hospitals.length > 0 ? [data.hospitals[0]] : [];
    }
    const list = state.targetCodes.map(code => hospitalByCode.get(code)).filter(Boolean);
    return list.length > 0 ? list : (data.hospitals.length > 0 ? [data.hospitals[0]] : []);
  }

  function targetHospital() {
    const codesRef = state.targetCodes;
    if (
      Array.isArray(codesRef) &&
      codesRef.length > 1 &&
      targetAggregateCache.codesRef === codesRef &&
      targetAggregateCache.version === dataStateVersion
    ) {
      return targetAggregateCache.value;
    }

    const list = getTargetHospitals();
    if (list.length === 0) return null;
    if (list.length === 1) return list[0];

    const total = createZeroMetric();
    const unclassified = createZeroMetric();
    const severity = { 1: createZeroMetric(), 2: createZeroMetric(), 3: createZeroMetric(), 4: createZeroMetric() };
    const services = {};
    const uniqueCities = new Set();
    const uniqueProvs = new Set();
    const uniqueClasses = new Set();

    for (const h of list) {
      if (h.city) uniqueCities.add(h.city);
      if (h.province) uniqueProvs.add(h.province);
      if (h.class) uniqueClasses.add(h.class);

      if (h.total) {
        addVectors(total, h.total);
      }
      if (h.unclassified) {
        addVectors(unclassified, h.unclassified);
      }

      if (h.severity) {
        for (const lvl in h.severity) {
          if (!severity[lvl]) severity[lvl] = createZeroMetric();
          addVectors(severity[lvl], h.severity[lvl]);
        }
      }

      if (h.services) {
        for (const svc in h.services) {
          if (!services[svc]) {
            services[svc] = {
              competency: 0,
              total: createZeroMetric(),
              unclassified: createZeroMetric(),
              severity: { 1: createZeroMetric(), 2: createZeroMetric(), 3: createZeroMetric(), 4: createZeroMetric() }
            };
          }
          const hs = h.services[svc];
          const aggS = services[svc];
          if (hs.total) {
            addVectors(aggS.total, hs.total);
          }
          if (hs.unclassified) {
            addVectors(aggS.unclassified, hs.unclassified);
          }
          if (hs.severity) {
            for (const lvl in hs.severity) {
              if (!aggS.severity[lvl]) aggS.severity[lvl] = createZeroMetric();
              addVectors(aggS.severity[lvl], hs.severity[lvl]);
            }
          }
          const comp = getCompetency(h, svc);
          if (comp > aggS.competency) aggS.competency = comp;
        }
      }
    }

    const isAll = list.length === data.hospitals.length;
    const name = isAll 
      ? `Semua RS (${list.length} RS Terpilih)` 
      : `${list.length} RS Target Terpilih`;
    const city = uniqueCities.size === 1 ? [...uniqueCities][0] : `${uniqueCities.size} Kab/Kota`;
    const province = uniqueProvs.size === 1 ? [...uniqueProvs][0] : `${uniqueProvs.size} Provinsi`;
    const className = uniqueClasses.size === 1 ? [...uniqueClasses][0] : "Gabungan";

    const aggregate = {
      code: "MULTI",
      name,
      city,
      province,
      class: className,
      type: "Gabungan",
      total,
      unclassified,
      severity,
      services,
      isMultiTarget: true,
      targetCount: list.length,
      targetCodes: list.map(h => h.code)
    };
    targetAggregateCache = { codesRef, version: dataStateVersion, value: aggregate };
    return aggregate;
  }

  const targetService = (service) => targetHospital()?.services?.[service] || null;
  const regionalService = (service) => data.regional.services[service] || { total: [0, 0, 0], severity: {} };
  function getCompetency(hospital, service) {
    if (!hospital || !hospital.services || !hospital.services[service]) return 0;
    const s = hospital.services[service];
    if (typeof s.competency === "number") return s.competency;
    if (s.competency) return Number(s.competency) || 0;
    return 0;
  }

  function getLevelRules(competency, serviceName = "") {
    if (competency === 0) competency = 1;
    if (competency === 0 && serviceName.toLowerCase().includes('forensik')) {
      return { tambah: [1], kurang: [2, 3, 4] };
    }
    switch (competency) {
      case 1: return { tambah: [1], kurang: [2, 3, 4] };
      case 2: return { tambah: [1, 2], kurang: [3, 4] };
      case 3: return { tambah: [2, 3], kurang: [1, 4] };
      case 4: return { tambah: [3, 4], kurang: [1, 2] };
      default: return { tambah: [], kurang: [] };
    }
  }

  function generateDefaultServiceScenarios(service, targetHospitalObj, competencyVal) {
    const target = targetHospitalObj || targetHospital();
    const targetComp = (competencyVal !== undefined) ? competencyVal : (target ? getCompetency(target, service) : 0);
    const rules = getLevelRules(targetComp, service);
    
    // Hitung baseline market share alami per level (100 / (n_kompetitor + 1))
    // Skenario 1 = Baseline  : % tambah = market share alami dari regional pool
    // Skenario 2 = Konservatif: baseline × 1.25
    // Skenario 3 = Moderat    : baseline × 1.5
    // Skenario 4 = Optimistik : baseline × 2.0
    // Skenario 5 = Agresif    : baseline × 2.5
    // Skenario 6 = Maksimum   : 100% (ambil semua potensi)
    const multipliers = [1.0, 1.25, 1.5, 2.0, 2.5, null]; // null = 100%
    
    // Hitung baseline % per level tambah
    const baselinePct = {};
    rules.tambah.forEach(lvl => {
      const lvlComp = target
        ? data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= lvl).length
        : 0;
      // Jika ada kompetitor: market share alami = 100/(kompetitor+1)
      // Jika tidak ada kompetitor: ambil 50% (konservatif default)
      baselinePct[lvl] = lvlComp > 0 ? parseFloat((100 / (lvlComp + 1)).toFixed(1)) : 50;
    });
    
    return Array(6).fill().map((_, i) => {
      const scn = {};
      const mult = multipliers[i];
      
      rules.tambah.forEach(lvl => {
        if (lvl === 1 || lvl === 2) {
          // Custom rule for Dasar (1) and Madya (2)
          if (i === 0) scn["tambah_" + lvl] = baselinePct[lvl];
          else if (i === 1) scn["tambah_" + lvl] = 1;
          else if (i === 2) scn["tambah_" + lvl] = 2;
          else if (i === 3) scn["tambah_" + lvl] = 3;
          else if (i === 4) scn["tambah_" + lvl] = 4;
          else if (i === 5) scn["tambah_" + lvl] = 5;
        } else {
          if (mult === null) {
            scn["tambah_" + lvl] = 100; // Skenario 6: Maksimum
          } else {
            scn["tambah_" + lvl] = parseFloat(Math.min(100, baselinePct[lvl] * mult).toFixed(1));
          }
        }
      });
      
      rules.kurang.forEach(lvl => {
        scn["kurang_" + lvl] = (lvl > targetComp || lvl === 4) ? 100 : 90;
      });
      return scn;
    });
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
    const unclassifiedCases = state.excludeUnmapped ? 0 : metric(target.unclassified)[CASES];
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
        <article class="existing-report-kpi kpi-idrg"><span>Pendapatan INACBG:</span><strong>${formatMoney(target.total[IDRG])}</strong><em>Klaim uji coba iDRG</em></article>
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
    const slide = document.getElementById("regionalSlide");
    if (!slide) return;
    const maxCases = Math.max(...severityRanks.map((rank) => severityMetric(data.regional, rank)[CASES]), 1);
    const maxIdrg = Math.max(...severityRanks.map((rank) => severityMetric(data.regional, rank)[IDRG]), 1);
    slide.innerHTML = `
      <div class="kpi-grid">
        <article class="kpi-card is-primary"><div class="kpi-label">Total kasus regional</div><div class="kpi-value">${formatNumber(data.regional.total[CASES])}</div><div class="kpi-note">363 rumah sakit pada sumber</div></article>
        <article class="kpi-card"><div class="kpi-label">Pendapatan regional iDRG</div><div class="kpi-value">${formatMoney(data.regional.total[IDRG])}</div><div class="kpi-note">Skenario 2 workbook</div></article>
        <article class="kpi-card"><div class="kpi-label">Layanan pada workbook</div><div class="kpi-value">${data.meta.sourceServiceCount || 23}/24</div><div class="kpi-note">Tidak tersedia: ${escapeHtml((data.meta.missingServices || []).join(", ") || "—")}</div></article>
        <article class="kpi-card"><div class="kpi-label">Belum ada kompetensi ICD</div><div class="kpi-value">${formatNumber(data.meta.unclassifiedSeverityCases)}</div><div class="kpi-note">Ditampilkan terpisah dari D–M–U–P</div></article>
      </div>
      <div class="regional-layout">
        <div class="regional-left">
          <article class="panel"><div class="panel-heading"><h2>Distribusi kasus D–M–U–P</h2><span>Jumlah kasus</span></div><div class="severity-bars">
            ${severityRanks.map((rank) => { const value = severityMetric(data.regional, rank)[CASES]; return `<div class="metric-bar-row"><span>${levelNames[rank]}</span><div class="bar-track"><div class="bar-fill level-${rank}" style="width:${(value / maxCases) * 100}%"></div></div><strong>${formatNumber(value)}</strong></div>`; }).join("")}
          </div></article>
          <article class="panel"><div class="panel-heading"><h2>Potensi pendapatan INACBG</h2><span>Menurut keparahan</span></div><div class="severity-bars">
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
    const slide = document.getElementById("addressableSlide");
    if (!slide) return;
    const target = targetHospital();
    const result = computeAddressable();
    document.getElementById("slide3Subtitle").textContent = `Kompetensi ${target.name} menentukan tingkat keparahan yang mampu dilayani.`;
    slide.innerHTML = `
      <div class="kpi-grid addressable-kpis">
        <article class="kpi-card is-primary"><div class="kpi-label">Addressable cases</div><div class="kpi-value">${formatNumber(result.eligibleRegional[CASES])}</div><div class="kpi-note">Kasus regional sesuai kemampuan target</div></article>
        <article class="kpi-card"><div class="kpi-label">Addressable iDRG</div><div class="kpi-value">${formatMoney(result.eligibleRegional[IDRG])}</div><div class="kpi-note">Potensi nilai seluruh pool</div></article>
        <article class="kpi-card"><div class="kpi-label">External available market</div><div class="kpi-value">${formatNumber(result.external[CASES])}</div><div class="kpi-note">RS target telah dikeluarkan</div></article>
        <article class="kpi-card"><div class="kpi-label">Layanan Kompeten</div><div class="kpi-value">${result.mappedServices}/24</div><div class="kpi-note">Target memiliki strata &ge; Dasar</div></article>
      </div>
      <article class="panel addressable-table-panel">
        <div class="table-wrap addressable-table-wrap"><table class="compact-table addressable-matrix-table"><colgroup><col class="addressable-service-col"><col class="addressable-competency-col"><col class="addressable-capability-col"><col class="addressable-number-col"><col class="addressable-number-col"><col class="addressable-number-col"><col class="addressable-money-col"><col class="addressable-competitor-col"></colgroup><thead><tr><th>Layanan</th><th>Kompetensi target</th><th>Keparahan yang mampu dilayani</th><th class="num">Kasus regional eligible</th><th class="num">Eksisting eligible</th><th class="num">External pool</th><th class="num">iDRG external</th><th class="num">Kompetitor setara</th></tr></thead><tbody>
          ${result.rows.map((row) => `<tr class="${row.competency ? "" : "is-disabled"}"><td class="service-name">${escapeHtml(formatService(row.service))}</td><td>${levelBadge(row.competency)}</td><td>${capabilityCells(row.competency)}</td><td class="num">${formatNumber(row.eligibleRegional[CASES])}</td><td class="num">${formatNumber(row.eligibleExisting[CASES])}</td><td class="num">${formatNumber(row.external[CASES])}</td><td class="num">${formatTableMoney(row.external[IDRG])}</td><td class="num">${formatNumber(row.competitors)}</td></tr>`).join("")}
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

  function renderRegionalCasesSlide() {
    const regionalTotal = metric(data.regional.total);
    const delta = regionalTotal[IDRG] - regionalTotal[INA];
    const deltaPercent = regionalTotal[INA] ? delta / regionalTotal[INA] : 0;
    const displayCases = (value) => value ? formatNumber(value) : "—";
    const displayMoney = (value) => value ? formatMatrixMoney(value) : "—";

    document.getElementById("regionalCasesSlideTitle").textContent = `Kasus Regional Per Layanan`;
    document.getElementById("regionalCasesSlide").innerHTML = `
      <div class="existing-report-kpis">
        <article class="existing-report-kpi kpi-cases"><span>Total Kasus Regional:</span><strong>${formatNumber(regionalTotal[CASES])}</strong><em>Seluruh rumah sakit regional</em></article>
        <article class="existing-report-kpi kpi-ina"><span>INA-CBG Regional:</span><strong>${formatMoney(regionalTotal[INA])}</strong><em>Pendapatan regional</em></article>
        <article class="existing-report-kpi kpi-idrg"><span>iDRG Regional:</span><strong>${formatMoney(regionalTotal[IDRG])}</strong><em>Potensi pendapatan regional</em></article>
        <article class="existing-report-kpi kpi-difference ${delta < 0 ? "is-loss" : "is-gain"}"><span>Selisih Regional:</span><strong>${formatMoney(delta)}</strong><em>iDRG - INA-CBG regional</em></article>
        <article class="existing-report-kpi kpi-percentage ${delta < 0 ? "is-loss" : "is-gain"}"><span>Persentase Regional:</span><strong>${formatPercent(deltaPercent)}</strong><em>Dari pendapatan INA-CBG regional</em></article>
      </div>
      <div class="existing-matrix-wrap">
        <table class="existing-matrix-table comparison-matrix-table" aria-label="Kasus Regional per layanan dan tingkat keparahan">
          <thead>
            <tr><th rowspan="2" class="matrix-no">No</th><th rowspan="2" class="matrix-service">Layanan RS</th>${severityRanks.map((rank) => `<th colspan="2" class="comparison-target-heading" style="border-left: 2px solid #007b83;">${levelNames[rank]}</th>`).join("")}<th colspan="2" class="comparison-target-heading" style="border-left: 2px solid #007b83;">Total Kasus Regional</th></tr>
            <tr>${severityRanks.map((rank) => `<th class="comparison-other" style="border-left: 2px solid #007b83;">Kasus Regional</th><th class="comparison-other">iDRG Regional</th>`).join("")}<th class="comparison-other" style="border-left: 2px solid #007b83;">Total Kasus</th><th class="comparison-other">Total iDRG</th></tr>
          </thead>
          <tbody>
            ${data.services.map((service, index) => {
              const item = regionalService(service);
              
              const combinedCells = severityRanks.map(rank => {
                const otherVal = severityMetric(item, rank);
                return `<td class="num comparison-other" style="border-left: 2px solid #007b83;">${displayCases(otherVal[CASES])}</td><td class="num comparison-other">${displayMoney(otherVal[IDRG])}</td>`;
              }).join("");
              
              const totalVal = item.total;
              const totalCells = `<td class="num comparison-other" style="border-left: 2px solid #007b83; font-weight: bold;">${displayCases(totalVal[CASES])}</td><td class="num comparison-other" style="font-weight: bold;">${displayMoney(totalVal[IDRG])}</td>`;

              return `<tr><td class="matrix-no">${index + 1}</td><td class="matrix-service">${escapeHtml(formatService(service))}</td>${combinedCells}${totalCells}</tr>`;
            }).join("")}
          </tbody>
          <tfoot><tr><td></td><td>Total D–M–U–P</td>${severityRanks.map(rank => {
            const otherVal = severityMetric(data.regional, rank);
            return `<td class="num comparison-other" style="border-left: 2px solid #007b83;">${displayCases(otherVal[CASES])}</td><td class="num comparison-other">${displayMoney(otherVal[IDRG])}</td>`;
          }).join("")}<td class="num comparison-other" style="border-left: 2px solid #007b83;">${displayCases(regionalTotal[CASES])}</td><td class="num comparison-other">${displayMoney(regionalTotal[IDRG])}</td></tr></tfoot>
        </table>
      </div>`;
  }

  function renderGlobalSimulationSlide() {
    const target = targetHospital();
    if (!target) return;

    const tambahMode = document.getElementById('globalSimTambahSelect') ? document.getElementById('globalSimTambahSelect').value : 'tambah_up';
    const kurangMode = document.getElementById('globalSimKurangSelect') ? document.getElementById('globalSimKurangSelect').value : 'kurang_dm';
    // Helper agar mode mudah diakses di helper function lain
    if (!window.getSimTambahMode) {
      window.getSimMode = () => document.getElementById('globalSimTambahSelect')?.value === 'tambah_dm' ? 'higher_tier' : 'regional_all';
      window.getSimTambahMode = () => document.getElementById('globalSimTambahSelect')?.value || 'tambah_up';
      window.getSimKurangMode = () => document.getElementById('globalSimKurangSelect')?.value || 'kurang_dm';
    }
    
    const fmtM = formatTableMoney;

    // Hitung Kondisi Eksisting Dinamis
    const globalSimSelectVal = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
    const targetServices = globalSimSelectVal === 'ALL' ? data.services : (data.services.includes(globalSimSelectVal) ? [globalSimSelectVal] : []);
    
    let eksistingKasus = 0;
    let eksistingIna = 0;
    let eksistingIdrg = 0;
    
    if (globalSimSelectVal === 'ALL') {
      eksistingKasus = target.total[CASES] || 0;
      eksistingIna = target.total[INA] || 0;
      eksistingIdrg = target.total[IDRG] || 0;
    } else {
      targetServices.forEach(service => {
        const srv = target.services[service];
        if (srv) {
          [1,2,3,4].forEach(rank => {
            const metrics = severityMetric(srv, rank);
            eksistingKasus += metrics[CASES] || 0;
            eksistingIna += metrics[INA] || 0;
            eksistingIdrg += metrics[IDRG] || 0;
          });
        }
      });
    }
    
    // Selisih Eksisting
    const selisihPendapatan = eksistingIdrg - eksistingIna;
    const persentaseSelisih = eksistingIna > 0 ? (selisihPendapatan / eksistingIna) : 0;
    
    // Hitung Potensi Serapan & Redistribusi berdasarkan Mode
    let potensiSerapanKasus = 0;
    let potensiSerapanIdrg = 0;
    
    let potensiRedistribusiKasus = 0;
    let potensiRedistribusiIdrg = 0;

    
    let targetServiceSelect = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
    
    // Hitung competitorCount SEKARANG dari data.hospitals yang sudah difilter
    let competitorCount = 0;
    let compCountD = 0;
    let compCountM = 0;
    let compCountU = 0;
    let compCountP = 0;
    data.hospitals.forEach(h => {
      if (h.code === target.code) return;
      if (targetServiceSelect !== 'ALL') {
        const hComp = getCompetency(h, targetServiceSelect);
        if (hComp && hComp > 0) {
          competitorCount++;
          if (hComp === 1) compCountD++;
          if (hComp === 2) compCountM++;
          if (hComp === 3) compCountU++;
          if (hComp === 4) compCountP++;
        }
      } else {
        competitorCount++;
        // Hitung semua kompetensi layanan (24 layanan) di RS ini
        data.services.forEach(svc => {
          const hComp = getCompetency(h, svc);
          if (hComp === 1) compCountD++;
          else if (hComp === 2) compCountM++;
          else if (hComp === 3) compCountU++;
          else if (hComp === 4) compCountP++;
        });
      }
    });
    
    // Compute Regional Cases for the target service(s)
    const activeServices = targetServiceSelect === 'ALL' ? data.services : (data.services.includes(targetServiceSelect) ? [targetServiceSelect] : []);
    const regTotalD = {cases: 0, rp: 0};
    const regTotalM = {cases: 0, rp: 0};
    const regTotalU = {cases: 0, rp: 0};
    const regTotalP = {cases: 0, rp: 0};
    
    activeServices.forEach(svc => {
      const s = data.regional?.services?.[svc];
      if (!s) return;
      const sD = severityMetric(s, 1);
      const sM = severityMetric(s, 2);
      const sU = severityMetric(s, 3);
      const sP = severityMetric(s, 4);
      
      regTotalD.cases += sD[CASES] || 0; regTotalD.rp += sD[IDRG] || 0;
      regTotalM.cases += sM[CASES] || 0; regTotalM.rp += sM[IDRG] || 0;
      regTotalU.cases += sU[CASES] || 0; regTotalU.rp += sU[IDRG] || 0;
      regTotalP.cases += sP[CASES] || 0; regTotalP.rp += sP[IDRG] || 0;
    });

    (function(){
      targetServiceSelect = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
      const servicesToSimulate = targetServiceSelect === 'ALL' ? data.services : (data.services.includes(targetServiceSelect) ? [targetServiceSelect] : []);
      
      // Compute Competitor count for the badge
      competitorCount = 0;
      compCountD = 0;
      compCountM = 0;
      compCountU = 0;
      compCountP = 0;
      
      data.hospitals.forEach(h => {
        if (h.code === targetHospital()?.code) return;
        
        if (targetServiceSelect !== 'ALL') {
          const hComp = getCompetency(h, targetServiceSelect);
          if (hComp && hComp > 0) {
            competitorCount++;
            if (hComp === 1) compCountD++;
            if (hComp === 2) compCountM++;
            if (hComp === 3) compCountU++;
            if (hComp === 4) compCountP++;
          }
        } else {
          competitorCount++;
          data.services.forEach(svc => {
            const hComp = getCompetency(h, svc);
            if (hComp === 1) compCountD++;
            else if (hComp === 2) compCountM++;
            else if (hComp === 3) compCountU++;
            else if (hComp === 4) compCountP++;
          });
        }
      });
      
      const compBadge = document.getElementById('globalSimCompetitorBadge');
      const compVal = document.getElementById('globalSimCompetitorValue');
      if (compBadge && compVal) {
        if (targetServiceSelect === 'ALL') {
          compBadge.querySelector('div').innerText = 'KOMPETENSI LAYANAN';
          compVal.innerHTML = `${competitorCount}`;
        } else {
          compBadge.querySelector('div').innerText = 'KOMPETENSI LAYANAN';
          compVal.innerHTML = `${competitorCount}`;
        }
      }
      
      return servicesToSimulate;
    })().forEach(service => {
      const srvReg = regionalService(service);
      const srvTarget = target.services[service];
      if (!srvReg || !srvTarget) return;

      // --- PENAMBAH KASUS ---
      if (tambahMode === 'tambah_cross_comp') {
        data.hospitals.forEach(h => {
          if (h.code === target.code) return;
          const hCompetency = getCompetency(h, service);
          if (!hCompetency || hCompetency === 0) return;

          const hSrv = h.services[service];
          if (hSrv) {
            const hDasar = severityMetric(hSrv, 1);
            const hMadya = severityMetric(hSrv, 2);
            const hUtama = severityMetric(hSrv, 3);
            const hParipurna = severityMetric(hSrv, 4);

            if (hCompetency !== 1) {
              potensiSerapanKasus += hDasar[CASES];
              potensiSerapanIdrg += hDasar[IDRG];
            }
            if (hCompetency !== 2) {
              potensiSerapanKasus += hMadya[CASES];
              potensiSerapanIdrg += hMadya[IDRG];
            }
            if (hCompetency !== 3) {
              potensiSerapanKasus += hUtama[CASES];
              potensiSerapanIdrg += hUtama[IDRG];
            }
            if (hCompetency !== 4) {
              potensiSerapanKasus += hParipurna[CASES];
              potensiSerapanIdrg += hParipurna[IDRG];
            }
          }
        });
      } else if (tambahMode === 'tambah_up') {
        const sRegUtama = severityMetric(srvReg, 3);
        const sRegParipurna = severityMetric(srvReg, 4);
        const sTargetUtama = severityMetric(srvTarget, 3);
        const sTargetParipurna = severityMetric(srvTarget, 4);
        
        const sisaRegUtamaKasus = Math.max(0, sRegUtama[CASES] - sTargetUtama[CASES]);
        const sisaRegUtamaIdrg = Math.max(0, sRegUtama[IDRG] - sTargetUtama[IDRG]);
        const sisaRegParipurnaKasus = Math.max(0, sRegParipurna[CASES] - sTargetParipurna[CASES]);
        const sisaRegParipurnaIdrg = Math.max(0, sRegParipurna[IDRG] - sTargetParipurna[IDRG]);
        
        potensiSerapanKasus += (sisaRegUtamaKasus + sisaRegParipurnaKasus);
        potensiSerapanIdrg += (sisaRegUtamaIdrg + sisaRegParipurnaIdrg);
      } else if (tambahMode === 'tambah_dm_reg') {
        const sRegDasar = severityMetric(srvReg, 1);
        const sRegMadya = severityMetric(srvReg, 2);
        const sTargetDasar = severityMetric(srvTarget, 1);
        const sTargetMadya = severityMetric(srvTarget, 2);
        
        const sisaRegDasarKasus = Math.max(0, sRegDasar[CASES] - sTargetDasar[CASES]);
        const sisaRegDasarIdrg = Math.max(0, sRegDasar[IDRG] - sTargetDasar[IDRG]);
        const sisaRegMadyaKasus = Math.max(0, sRegMadya[CASES] - sTargetMadya[CASES]);
        const sisaRegMadyaIdrg = Math.max(0, sRegMadya[IDRG] - sTargetMadya[IDRG]);
        
        potensiSerapanKasus += (sisaRegDasarKasus + sisaRegMadyaKasus);
        potensiSerapanIdrg += (sisaRegDasarIdrg + sisaRegMadyaIdrg);
      } else if (tambahMode === 'tambah_mu_reg') {
        const sRegMadyaX = severityMetric(srvReg, 2);
        const sRegUtamaX = severityMetric(srvReg, 3);
        const sTargetMadyaX = severityMetric(srvTarget, 2);
        const sTargetUtamaX = severityMetric(srvTarget, 3);
        potensiSerapanKasus += Math.max(0, sRegMadyaX[CASES] - sTargetMadyaX[CASES]) + Math.max(0, sRegUtamaX[CASES] - sTargetUtamaX[CASES]);
        potensiSerapanIdrg += Math.max(0, sRegMadyaX[IDRG] - sTargetMadyaX[IDRG]) + Math.max(0, sRegUtamaX[IDRG] - sTargetUtamaX[IDRG]);
      } else if (tambahMode === 'tambah_d_reg') {
        const sRegDasarX = severityMetric(srvReg, 1);
        const sTargetDasarX = severityMetric(srvTarget, 1);
        potensiSerapanKasus += Math.max(0, sRegDasarX[CASES] - sTargetDasarX[CASES]);
        potensiSerapanIdrg += Math.max(0, sRegDasarX[IDRG] - sTargetDasarX[IDRG]);
      } else if (tambahMode === 'tambah_mu_higher') {
        data.hospitals.forEach(h => {
          if (h.code === target.code) return;
          if (getCompetency(h, service) > getCompetency(target, service)) {
            const hSrv = h.services[service];
            if (hSrv) {
              const hMadyaX = severityMetric(hSrv, 2);
              const hUtamaX = severityMetric(hSrv, 3);
              potensiSerapanKasus += (hMadyaX[CASES] || 0) + (hUtamaX[CASES] || 0);
              potensiSerapanIdrg += (hMadyaX[IDRG] || 0) + (hUtamaX[IDRG] || 0);
            }
          }
        });
      } else if (tambahMode === 'tambah_d_higher') {
        data.hospitals.forEach(h => {
          if (h.code === target.code) return;
          if (getCompetency(h, service) > getCompetency(target, service)) {
            const hSrv = h.services[service];
            if (hSrv) {
              const hDasarX = severityMetric(hSrv, 1);
              potensiSerapanKasus += (hDasarX[CASES] || 0);
              potensiSerapanIdrg += (hDasarX[IDRG] || 0);
            }
          }
        });
      } else {
        // Default: tambah_dm — Serap Dasar & Madya dari RS kompetensi lebih tinggi
        data.hospitals.forEach(h => {
          if (h.code === target.code) return;
          const hCompetency = getCompetency(h, service);
          const tCompetency = getCompetency(target, service);
          if (hCompetency > tCompetency) {
            const hSrv = h.services[service];
            if (hSrv) {
              const hDasar = severityMetric(hSrv, 1);
              const hMadya = severityMetric(hSrv, 2);
              potensiSerapanKasus += (hDasar[CASES] + hMadya[CASES]);
              potensiSerapanIdrg += (hDasar[IDRG] + hMadya[IDRG]);
            }
          }
        });
      }

      // --- PENGURANG KASUS ---
      if (kurangMode === 'kurang_up') {
        const sTargetUtama = severityMetric(srvTarget, 3);
        const sTargetParipurna = severityMetric(srvTarget, 4);
        potensiRedistribusiKasus += (sTargetUtama[CASES] + sTargetParipurna[CASES]);
        potensiRedistribusiIdrg += (sTargetUtama[IDRG] + sTargetParipurna[IDRG]);
      } else if (kurangMode === 'kurang_dp') {
        const sTargetDasarK = severityMetric(srvTarget, 1);
        const sTargetParipurnaK = severityMetric(srvTarget, 4);
        potensiRedistribusiKasus += (sTargetDasarK[CASES] + sTargetParipurnaK[CASES]);
        potensiRedistribusiIdrg += (sTargetDasarK[IDRG] + sTargetParipurnaK[IDRG]);
      } else if (kurangMode === 'kurang_mup') {
        const sTargetMadyaK = severityMetric(srvTarget, 2);
        const sTargetUtamaK = severityMetric(srvTarget, 3);
        const sTargetParipurnaK2 = severityMetric(srvTarget, 4);
        potensiRedistribusiKasus += (sTargetMadyaK[CASES] + sTargetUtamaK[CASES] + sTargetParipurnaK2[CASES]);
        potensiRedistribusiIdrg += (sTargetMadyaK[IDRG] + sTargetUtamaK[IDRG] + sTargetParipurnaK2[IDRG]);
      } else {
        // Default: kurang_dm — Lepas Dasar & Madya
        const sTargetDasar = severityMetric(srvTarget, 1);
        const sTargetMadya = severityMetric(srvTarget, 2);
        potensiRedistribusiKasus += (sTargetDasar[CASES] + sTargetMadya[CASES]);
        potensiRedistribusiIdrg += (sTargetDasar[IDRG] + sTargetMadya[IDRG]);
      }
    });
    
    // Inisialisasi default skenario jika belum ada
    // Selalu hitung kompetitor untuk ditampilkan di UI
    const targetH = target;
    const regionalHospitals = data.hospitals.filter(h => {
      if (h.id === targetH.id) return false;
      return Object.keys(h.services || {}).length > 0;
    });
    const totalCompetitors = regionalHospitals.length;

    // Inisialisasi default skenario jika belum ada
    if (typeof window.globalSimScenarios === 'undefined' || window.globalSimScenarios === null) {
      // Default: Market share alami = 1 / (N_kompetitor + 1)
      const naturalShare = totalCompetitors > 0 ? (1 / (totalCompetitors + 1)) : 0.5;
      
      window.globalSimScenarios = [
        1.0,           // Skenario 1: Optimistik — serap 100% potensi
        naturalShare,  // Skenario 2: Proporsional — market share alami (1/(N+1))
        naturalShare / 2 // Skenario 3: Konservatif — setengah dari market share alami
      ];
    }
    
    // Inisialisasi default skenario kurang jika belum ada
    if (typeof window.globalSimKurangScenarios === 'undefined' || window.globalSimKurangScenarios === null) {
      window.globalSimKurangScenarios = [1.0, 1.0, 1.0];
    }
    
    // Hitung data Regional (diperlukan untuk scorecard)
    const regionalKasus = data.regional.total[CASES] || 0;
    const regionalIna = data.regional.total[INA] || 0;
    const regionalIdrg = data.regional.total[IDRG] || 0;
    const marketShareKasus = regionalKasus > 0 ? (eksistingKasus / regionalKasus) : 0;
    const marketShareIdrg = regionalIdrg > 0 ? (eksistingIdrg / regionalIdrg) : 0;
    const deltaIdrg = eksistingIdrg - eksistingIna;
    const deltaPercentIdrg = eksistingIna > 0 ? (deltaIdrg / eksistingIna) : 0;

    // EXPORT GLOBALLY FOR COMPETENCY SLIDE
    window.globalSimPotentials = {
      potensiSerapanKasus,
      potensiSerapanIdrg,
      potensiRedistribusiKasus,
      potensiRedistribusiIdrg
    };

    let rowsHtml = '';

    
    window.globalSimScenarios.forEach((pct, idx) => {
      const pctValue = pct; // Gunakan nilai mentah dari array (bisa desimal)
      const pctDisplay = Math.round(pctValue * 100);
      
      const kurangPctValue = window.globalSimKurangScenarios[idx] !== undefined ? window.globalSimKurangScenarios[idx] : 1.0;
      const kurangPctDisplay = Math.round(kurangPctValue * 100);
      
      const tambahKasus = Math.round(potensiSerapanKasus * pctValue);
      const tambahIdrg = potensiSerapanIdrg * pctValue;
      
      const kurangKasus = Math.round(potensiRedistribusiKasus * kurangPctValue);
      const kurangIdrg = potensiRedistribusiIdrg * kurangPctValue;
      
      const netKasus = tambahKasus - kurangKasus;
      const netIdrg = tambahIdrg - kurangIdrg;
      const pctThdEksisting = eksistingKasus > 0 ? (netKasus / eksistingKasus) : 0;
      
      const akhirIdrg = eksistingIdrg + netIdrg;
      
      // Input dinamis
      const inputHtml = `<div style="display:flex; align-items:center; justify-content:center; gap:4px;">
        <input type="number" min="0" max="100" step="1" value="${pctDisplay}" 
          class="global-sim-input" data-idx="${idx}"
          style="width:50px; padding:2px 4px; text-align:center; border:1px solid #94a3b8; border-radius:4px; font-size:12px; font-weight:bold; color:#0f172a;">
        <span style="font-size:11px; color:#64748b; font-weight:normal;">%</span>
      </div>`;
      
      const scnLabels = ['Optimistik', 'Proporsional', 'Konservatif'];
      rowsHtml += `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 2px solid #e2e8f0;">
          <!-- Skenario -->
          <td style="text-align:center; border:1px solid #e2e8f0; padding:14px 10px; font-weight:800; color:#0f172a; background:${idx === 0 ? '#eff6ff' : idx === 1 ? '#f0fdf4' : '#fff7ed'};">
            Skenario ${idx + 1}<br>
            <span style="font-size:11px; color:#64748b; font-weight:500;">${scnLabels[idx] || ''}</span><br>
            <div style="display:flex; align-items:center; justify-content:center; gap:4px; margin-top:6px;">
              <input type="number" min="0" max="100" step="1" value="${pctDisplay}" 
                class="global-sim-input" data-idx="${idx}"
                style="width:52px; padding:3px 4px; text-align:center; border:1.5px solid #94a3b8; border-radius:5px; font-size:13px; font-weight:700; color:#0f172a; background:#fff;">
              <span style="font-size:11px; color:#64748b;">%</span>
            </div>
          </td>
          <!-- Eksisting -->
          <td style="text-align:center; border:1px solid #e2e8f0; padding:14px 10px; background:#f8fafc;">
            <div style="font-size:16px; font-weight:700; color:#1e293b;">${formatNumber(eksistingKasus)}</div>
            <div style="font-size:13px; font-weight:600; color:#64748b; margin-top:2px;">${fmtM(eksistingIdrg)}</div>
          </td>
          <!-- Tambah -->
          <td style="text-align:center; border:1px solid #bbf7d0; padding:14px 10px; background:#f0fdf4;">
            <div style="font-size:16px; font-weight:700; color:#059669;">+${formatNumber(tambahKasus)}</div>
            <div style="font-size:13px; font-weight:600; color:#16a34a; margin-top:2px;">+${fmtM(tambahIdrg)}</div>
          </td>
          <!-- Kurang -->
          <td style="text-align:center; border:1px solid #fecdd3; padding:14px 10px; background:#fff1f2;">
            <div style="display:flex; align-items:center; justify-content:center; gap:4px; margin-bottom:6px;">
              <input type="number" min="0" max="100" step="1" value="${kurangPctDisplay}" 
                class="global-sim-kurang-input" data-idx="${idx}"
                style="width:52px; padding:3px 4px; text-align:center; border:1px solid #fca5a5; border-radius:5px; font-size:13px; font-weight:700; color:#b91c1c; background:#fff;">
              <span style="font-size:11px; color:#b91c1c;">%</span>
            </div>
            <div style="font-size:16px; font-weight:700; color:#ea580c;">-${formatNumber(kurangKasus)}</div>
            <div style="font-size:13px; font-weight:600; color:#dc2626; margin-top:2px;">-${fmtM(kurangIdrg)}</div>
          </td>
          <!-- Net Kasus -->
          <td style="text-align:center; border:1px solid #c7d2fe; padding:14px 10px; background:#eef2ff;">
            <div style="font-size:16px; font-weight:800; color:${netKasus >= 0 ? '#15803d' : '#b91c1c'};">${netKasus > 0 ? '+' : ''}${formatNumber(netKasus)}</div>
            <div style="font-size:12px; color:${pctThdEksisting >= 0 ? '#059669' : '#b91c1c'}; margin-top:2px; font-weight:600;">${pctThdEksisting > 0 ? '+' : ''}${formatPercent(pctThdEksisting)}</div>
          </td>
          <!-- Net Pendapatan -->
          <td style="text-align:center; border:1px solid #c7d2fe; padding:14px 10px; background:#eef2ff;">
            <div style="font-size:16px; font-weight:800; color:${netIdrg >= 0 ? '#15803d' : '#b91c1c'};">${netIdrg > 0 ? '+' : ''}${fmtM(netIdrg)}</div>
          </td>
          <!-- Pasca RBKP -->
          <td style="text-align:center; border:1px solid #99f6e4; padding:14px 10px; background:#f0fdfa;">
            <div style="font-size:18px; font-weight:900; color:#0f766e;">${fmtM(akhirIdrg)}</div>
          </td>
        </tr>
      `;
    });



    // Hitung breakdown severity untuk RS Target (Kasus & Rp)
    const targetTotalD = data.services.reduce((acc, svc) => {
      const s = target.services[svc]; const sm = s ? severityMetric(s, 1) : null;
      return { cases: acc.cases + (sm ? (sm[CASES] || 0) : 0), rp: acc.rp + (sm ? (sm[IDRG] || 0) : 0) };
    }, {cases: 0, rp: 0});
    const targetTotalM = data.services.reduce((acc, svc) => {
      const s = target.services[svc]; const sm = s ? severityMetric(s, 2) : null;
      return { cases: acc.cases + (sm ? (sm[CASES] || 0) : 0), rp: acc.rp + (sm ? (sm[IDRG] || 0) : 0) };
    }, {cases: 0, rp: 0});
    const targetTotalU = data.services.reduce((acc, svc) => {
      const s = target.services[svc]; const sm = s ? severityMetric(s, 3) : null;
      return { cases: acc.cases + (sm ? (sm[CASES] || 0) : 0), rp: acc.rp + (sm ? (sm[IDRG] || 0) : 0) };
    }, {cases: 0, rp: 0});
    const targetTotalP = data.services.reduce((acc, svc) => {
      const s = target.services[svc]; const sm = s ? severityMetric(s, 4) : null;
      return { cases: acc.cases + (sm ? (sm[CASES] || 0) : 0), rp: acc.rp + (sm ? (sm[IDRG] || 0) : 0) };
    }, {cases: 0, rp: 0});

    
document.getElementById("globalSimulationSlide").innerHTML = `
      <div style="display:flex; gap:0; margin-bottom:14px; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.12); border:1px solid #e2e8f0;">
        
        <!-- Panel RS Target -->
        <div style="flex:1; background:#ffffff; padding:14px 16px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
            <div style="width:38px; height:38px; border-radius:8px; background:linear-gradient(135deg,#005a9e,#003e77); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <span style="font-size:18px;">🏥</span>
            </div>
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">EKSISTING</div>
              <div style="font-size:13px; font-weight:800; color:#0f172a; line-height:1.1;">RUMAH SAKIT</div>
            </div>
            <div style="margin-left:auto; display:flex; gap:20px; align-items:center;">
              <div style="text-align:right;">
                <div style="font-size:11px; color:#64748b; font-weight:600;">Total Kasus</div>
                <div style="font-size:22px; font-weight:900; color:#0f172a; line-height:1;">${formatNumber(eksistingKasus)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:11px; color:#64748b; font-weight:600;">Pendapatan INACBG</div>
                <div style="font-size:22px; font-weight:900; color:#ca8a04; line-height:1;">${fmtM(eksistingIna)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:11px; color:#64748b; font-weight:600;">Pendapatan iDRG</div>
                <div style="font-size:22px; font-weight:900; color:#0369a1; line-height:1;">${fmtM(eksistingIdrg)}</div>
              </div>
            </div>
          </div>
          <div style="border-top:1px solid #f1f5f9; padding-top:8px;">
            <div style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:6px;">RINCIAN KASUS EKSISTING RS:</div>
            <div style="display:flex; gap:16px;">
              <div style="text-align:center; flex:1;"><div style="font-size:18px; font-weight:800; color:#0f766e; line-height:1;">${formatNumber(targetTotalD.cases)}</div><div style="font-size:11px; color:#115e59; font-weight:700; margin-top:2px;">${fmtM(targetTotalD.rp)}</div><div style="font-size:10px; color:#64748b; font-weight:600; margin-top:1px;">Dasar</div></div>
              <div style="text-align:center; flex:1;"><div style="font-size:18px; font-weight:800; color:#0369a1; line-height:1;">${formatNumber(targetTotalM.cases)}</div><div style="font-size:11px; color:#075985; font-weight:700; margin-top:2px;">${fmtM(targetTotalM.rp)}</div><div style="font-size:10px; color:#64748b; font-weight:600; margin-top:1px;">Madya</div></div>
              <div style="text-align:center; flex:1;"><div style="font-size:18px; font-weight:800; color:#7c3aed; line-height:1;">${formatNumber(targetTotalU.cases)}</div><div style="font-size:11px; color:#5b21b6; font-weight:700; margin-top:2px;">${fmtM(targetTotalU.rp)}</div><div style="font-size:10px; color:#64748b; font-weight:600; margin-top:1px;">Utama</div></div>
              <div style="text-align:center; flex:1;"><div style="font-size:18px; font-weight:800; color:#be185d; line-height:1;">${formatNumber(targetTotalP.cases)}</div><div style="font-size:11px; color:#9d174d; font-weight:700; margin-top:2px;">${fmtM(targetTotalP.rp)}</div><div style="font-size:10px; color:#64748b; font-weight:600; margin-top:1px;">Paripurna</div></div>
            </div>
          </div>
        </div>
        
        <!-- VS Divider -->
        <div style="background:#e2e8f0; display:flex; align-items:center; justify-content:center; padding:0 10px; font-size:13px; font-weight:800; color:#94a3b8;">VS</div>
        
        <!-- Panel Regional -->
        <div style="flex:1; background:#f0f9ff; padding:14px 16px; border-left:3px solid #0369a1;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
            <div style="width:38px; height:38px; border-radius:8px; background:linear-gradient(135deg,#1e40af,#1d4ed8); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <span style="font-size:18px;">🌐</span>
            </div>
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">EKSISTING</div>
              <div style="font-size:13px; font-weight:800; color:#0f172a; line-height:1.1;">REGIONAL <span style="color:#0369a1; font-weight:700;">(${totalCompetitors + 1} RS)</span></div>
            </div>
            <div style="margin-left:auto; display:flex; gap:20px; align-items:center;">
              <div style="text-align:right;">
                <div style="font-size:11px; color:#64748b; font-weight:600;">Total Kasus</div>
                <div style="font-size:22px; font-weight:900; color:#0f172a; line-height:1;">${formatNumber(regionalKasus)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:11px; color:#64748b; font-weight:600;">Pendapatan INACBG</div>
                <div style="font-size:22px; font-weight:900; color:#b45309; line-height:1;">${fmtM(regionalIna)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:11px; color:#64748b; font-weight:600;">Pendapatan iDRG</div>
                <div style="font-size:22px; font-weight:900; color:#0369a1; line-height:1;">${fmtM(regionalIdrg)}</div>
              </div>
            </div>
            <!-- MARKET SHARE BADGE -->
            <div style="background:linear-gradient(135deg,#16a34a,#15803d); border-radius:8px; padding:10px 14px; text-align:center; flex-shrink:0; margin-left:4px; min-width:90px;">
              <div style="font-size:10px; font-weight:700; color:#bbf7d0; text-transform:uppercase; letter-spacing:0.4px;">MARKET<br>SHARE</div>
              <div style="font-size:22px; font-weight:900; color:#ffffff; line-height:1.1;">${formatPercent(marketShareKasus)}</div>
              <div style="font-size:10px; color:#bbf7d0; margin-top:2px;">Dari Total Kasus</div>
            </div>
          </div>
          <div style="border-top:1px solid #bae6fd; padding-top:8px;">
            <div style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:6px;">RINCIAN KASUS EKSISTING REGIONAL:</div>
            <div style="display:flex; gap:16px;">
              <div style="text-align:center; flex:1;"><div style="font-size:18px; font-weight:800; color:#0f766e; line-height:1;">${formatNumber(regTotalD.cases)}</div><div style="font-size:11px; color:#115e59; font-weight:700; margin-top:2px;">${fmtM(regTotalD.rp)}</div><div style="font-size:10px; color:#64748b; font-weight:600; margin-top:1px;">Dasar</div></div>
              <div style="text-align:center; flex:1;"><div style="font-size:18px; font-weight:800; color:#0369a1; line-height:1;">${formatNumber(regTotalM.cases)}</div><div style="font-size:11px; color:#075985; font-weight:700; margin-top:2px;">${fmtM(regTotalM.rp)}</div><div style="font-size:10px; color:#64748b; font-weight:600; margin-top:1px;">Madya</div></div>
              <div style="text-align:center; flex:1;"><div style="font-size:18px; font-weight:800; color:#7c3aed; line-height:1;">${formatNumber(regTotalU.cases)}</div><div style="font-size:11px; color:#5b21b6; font-weight:700; margin-top:2px;">${fmtM(regTotalU.rp)}</div><div style="font-size:10px; color:#64748b; font-weight:600; margin-top:1px;">Utama</div></div>
              <div style="text-align:center; flex:1;"><div style="font-size:18px; font-weight:800; color:#be185d; line-height:1;">${formatNumber(regTotalP.cases)}</div><div style="font-size:11px; color:#9d174d; font-weight:700; margin-top:2px;">${fmtM(regTotalP.rp)}</div><div style="font-size:10px; color:#64748b; font-weight:600; margin-top:1px;">Paripurna</div></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- MODE AKTIF -->
      <div style="margin-bottom: 10px; font-size: 12px; color: #475569; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <div style="width: 100%; margin-bottom: 5px; font-size: 12px; font-weight: 700; color: #0f172a; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; line-height: 1.6;">
          <div style="color: #be185d; display: flex; flex-direction: column; gap: 4px;">
            <div style="font-size: 14px; font-weight: 800; color: #0f766e;">
              Layanan: ${targetServiceSelect === 'ALL' ? 'Lintas Kompetensi Layanan (Semua)' : targetServiceSelect} 
              ${targetServiceSelect !== 'ALL' ? ` | Kompetensi RS Target: <span style="color:#b91c1c;">${levelNames[getCompetency(targetHospital(), targetServiceSelect)] || 'Tidak Kompeten'}</span>` : ''}
            </div>
            <div>
              Jumlah RS : ${competitorCount} &rarr; Kompetensi layanan : Dasar : ${compCountD}, Madya: ${compCountM}, Utama: ${compCountU}, Paripurna: ${compCountP}
              <span style="font-size:10px; font-weight:normal; color:#64748b; margin-left:8px;">(Berdasarkan Update Data 13 Agustus 2026)</span>
            </div>
          </div>
          <div style="color: #0369a1;">Kasus Regional : ${formatNumber(regTotalD.cases + regTotalM.cases + regTotalU.cases + regTotalP.cases)} kasus &rarr; Dasar : ${formatNumber(regTotalD.cases)} Kasus (${formatMoneyUnit(regTotalD.rp)}), Madya: ${formatNumber(regTotalM.cases)} Kasus (${formatMoneyUnit(regTotalM.rp)}), Utama: ${formatNumber(regTotalU.cases)} Kasus (${formatMoneyUnit(regTotalU.rp)}), Paripurna: ${formatNumber(regTotalP.cases)} Kasus (${formatMoneyUnit(regTotalP.rp)})</div>
        </div>
        <span style="background:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:99px; font-weight:600;">
          + ${tambahMode === 'tambah_up' ? 'Serap U/P dari Regional' : 'Serap D/M dari RS Kelas Lebih Tinggi'} 
          | - ${kurangMode === 'kurang_dm' ? 'Lepas Dasar/Madya Eksisting' : 'Lepas Utama/Paripurna Eksisting'}
        </span>
        <span style="color:#94a3b8;">Potensi Tambah: <strong style="color:#059669;">${formatNumber(Math.round(potensiSerapanKasus))}</strong> kasus · Potensi Kurang: <strong style="color:#ea580c;">${formatNumber(Math.round(potensiRedistribusiKasus))}</strong> kasus</span>
      </div>
      
      <!-- TABEL SIMULASI (SIMPLIFIED) -->
      <div style="width: 100%; overflow-x: auto; padding-bottom: 10px;">
        <table style="width: 100%; min-width: 800px; border-collapse: collapse; font-size: 14px; font-family: sans-serif; box-shadow:0 2px 6px rgba(0,0,0,0.08); border-radius:8px; overflow:hidden;">
          <thead>
            <tr style="background-color: #0f172a; color: white; text-align:center;">
              <th style="padding:12px 10px; border:1px solid #334155; min-width:120px;">SKENARIO<br><span style="font-size:10px; font-weight:400; color:#94a3b8;">Atur % serapan</span></th>
              <th style="padding:12px 10px; border:1px solid #334155; background-color:#1e293b;">EKSISTING<br><span style="font-size:10px; font-weight:400; color:#94a3b8;">Kasus / iDRG</span></th>
              <th style="padding:12px 10px; border:1px solid #065f46; background-color:#059669; min-width:130px;">+ TAMBAH KASUS<br><span style="font-size:10px; font-weight:400;">Kasus / Pendapatan</span></th>
              <th style="padding:12px 10px; border:1px solid #7c2d12; background-color:#ea580c; min-width:130px;">- KURANG KASUS<br><span style="font-size:10px; font-weight:400;">Atur % Redistribusi</span></th>
              <th style="padding:12px 10px; border:1px solid #3730a3; background-color:#4f46e5; min-width:130px;">NET +/- KASUS<br><span style="font-size:10px; font-weight:400;">Kasus / % thd Eksisting</span></th>
              <th style="padding:12px 10px; border:1px solid #3730a3; background-color:#4f46e5;">NET +/- PENDAPATAN<br><span style="font-size:10px; font-weight:400;">iDRG (M)</span></th>
              <th style="padding:12px 10px; border:1px solid #134e4a; background-color:#0f766e; min-width:130px;">✅ PENDAPATAN<br>PASCA RBKP</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <p class="source-note" style="margin-top:12px; font-size:11px; padding: 0 10px 10px 10px; color: #475569;">
          * <strong>Kurang Kasus (Redistribusi)</strong> dihitung dari estimasi kasus ${kurangMode === 'kurang_dm' ? 'Dasar & Madya' : 'Utama & Paripurna'} <strong>milik RS Eksisting (RS Target)</strong> yang diproyeksikan akan berpindah, sesuai proporsi Atur % Redistribusi.
        </p>
      </div>
    `;

    
    // Attach event listeners to dynamic inputs
    document.querySelectorAll('.global-sim-input').forEach(input => {
      input.addEventListener('change', function() {
        const idx = parseInt(this.getAttribute('data-idx'), 10);
        let val = parseFloat(this.value);
        if (isNaN(val)) val = 0;
        if (val < 0) val = 0;
        if (val > 100) val = 100;
        
        // Update global scenario value (convert back to decimal)
        window.globalSimScenarios[idx] = val / 100;
        
        // Re-render slide to reflect new calculations
        renderGlobalSimulationSlide();
    if(typeof renderCompetencySimSlide === "function") renderCompetencySimSlide();
      });
    });

    document.querySelectorAll('.global-sim-kurang-input').forEach(input => {
      input.addEventListener('change', function() {
        const idx = parseInt(this.getAttribute('data-idx'), 10);
        let val = parseFloat(this.value);
        if (isNaN(val)) val = 0;
        if (val < 0) val = 0;
        if (val > 100) val = 100;
        
        window.globalSimKurangScenarios[idx] = val / 100;
        renderGlobalSimulationSlide();
        if(typeof renderCompetencySimSlide === "function") renderCompetencySimSlide();
      });
    });
  }  // end renderGlobalSimulationSlide


  function renderCompetencySimSlide() {
    const formatMoneyUnit = (val) => {
    const numeric = Number(val) || 0;
    const absolute = Math.abs(numeric);
    const sign = numeric < 0 ? "-" : "";
    const inMilyar = absolute / 1e9;
    let formatted;
    if (absolute >= 1e9) {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inMilyar);
    } else {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(inMilyar);
    }
    return `${sign}${formatted} M`;
  };

    const container = document.getElementById('competencyTableSlide');
    if (!container) return;

    const target = data.hospitals.find((h) => h.code === state.targetCode) || (data.hospitals.length ? data.hospitals[0] : null);
    if (!target) {
      container.innerHTML = '<div style="padding: 20px;">Target RS tidak ditemukan.</div>';
      return;
    }

    if (!window.competencySimScenarios) {
      window.competencySimScenarios = [1, 3, 5, 10];
    }
    if (!window.competencyKurangScenarios) {
      window.competencyKurangScenarios = [100, 100, 100, 100];
    }

    const potentials = window.globalSimPotentials || {
      potensiSerapanKasus: 0,
      potensiSerapanIdrg: 0,
      potensiRedistribusiKasus: 0,
      potensiRedistribusiIdrg: 0
    };
    
    let eksistingDM_Idrg = 0;
    let eksistingUP_Idrg = 0;
    
    let kasusDasar = 0, kasusMadya = 0, kasusUtama = 0, kasusParipurna = 0;
    let inaDasar = 0, inaMadya = 0, inaUtama = 0, inaParipurna = 0;
    let idrgDasar = 0, idrgMadya = 0, idrgUtama = 0, idrgParipurna = 0;

    
    let competitorCount = 0;
    let compCountD = 0;
    let compCountM = 0;
    let compCountU = 0;
    let compCountP = 0;
    let targetServiceSelect = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
    
    // Compute Regional Cases for the target service(s)
    const activeServices = targetServiceSelect === 'ALL' ? data.services : (data.services.includes(targetServiceSelect) ? [targetServiceSelect] : []);
    const regTotalD = {cases: 0, rp: 0};
    const regTotalM = {cases: 0, rp: 0};
    const regTotalU = {cases: 0, rp: 0};
    const regTotalP = {cases: 0, rp: 0};
    
    activeServices.forEach(svc => {
      const s = data.regional?.services?.[svc];
      if (!s) return;
      const sD = severityMetric(s, 1);
      const sM = severityMetric(s, 2);
      const sU = severityMetric(s, 3);
      const sP = severityMetric(s, 4);
      
      regTotalD.cases += sD[CASES] || 0; regTotalD.rp += sD[IDRG] || 0;
      regTotalM.cases += sM[CASES] || 0; regTotalM.rp += sM[IDRG] || 0;
      regTotalU.cases += sU[CASES] || 0; regTotalU.rp += sU[IDRG] || 0;
      regTotalP.cases += sP[CASES] || 0; regTotalP.rp += sP[IDRG] || 0;
    });

    (function(){
      targetServiceSelect = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
      const servicesToSimulate = targetServiceSelect === 'ALL' ? data.services : (data.services.includes(targetServiceSelect) ? [targetServiceSelect] : []);
      
      // Compute Competitor count for the badge
      competitorCount = 0;
      compCountD = 0;
      compCountM = 0;
      compCountU = 0;
      compCountP = 0;
      
      data.hospitals.forEach(h => {
        if (h.code === targetHospital()?.code) return;
        
        if (targetServiceSelect !== 'ALL') {
          const hComp = getCompetency(h, targetServiceSelect);
          if (hComp && hComp > 0) {
            competitorCount++;
            if (hComp === 1) compCountD++;
            if (hComp === 2) compCountM++;
            if (hComp === 3) compCountU++;
            if (hComp === 4) compCountP++;
          }
        } else {
          competitorCount++;
          data.services.forEach(svc => {
            const hComp = getCompetency(h, svc);
            if (hComp === 1) compCountD++;
            else if (hComp === 2) compCountM++;
            else if (hComp === 3) compCountU++;
            else if (hComp === 4) compCountP++;
          });
        }
      });
      
      const compBadge = document.getElementById('globalSimCompetitorBadge');
      const compVal = document.getElementById('globalSimCompetitorValue');
      if (compBadge && compVal) {
        if (targetServiceSelect === 'ALL') {
          compBadge.querySelector('div').innerText = 'KOMPETENSI LAYANAN';
          compVal.innerHTML = `${competitorCount}`;
        } else {
          compBadge.querySelector('div').innerText = 'KOMPETENSI LAYANAN';
          compVal.innerHTML = `${competitorCount}`;
        }
      }
      
      return servicesToSimulate;
    })().forEach(service => {
      const targetSrv = target.services[service];
      if (!targetSrv) return;

      const tDasar = severityMetric(targetSrv, 1);
      const tMadya = severityMetric(targetSrv, 2);
      const tUtama = severityMetric(targetSrv, 3);
      const tParipurna = severityMetric(targetSrv, 4);

      eksistingDM_Idrg += (tDasar[IDRG] || 0) + (tMadya[IDRG] || 0);
      eksistingUP_Idrg += (tUtama[IDRG] || 0) + (tParipurna[IDRG] || 0);
      
      kasusDasar += tDasar[CASES] || 0;
      kasusMadya += tMadya[CASES] || 0;
      kasusUtama += tUtama[CASES] || 0;
      kasusParipurna += tParipurna[CASES] || 0;

      inaDasar += tDasar[INA] || 0;
      inaMadya += tMadya[INA] || 0;
      inaUtama += tUtama[INA] || 0;
      inaParipurna += tParipurna[INA] || 0;

      idrgDasar += tDasar[IDRG] || 0;
      idrgMadya += tMadya[IDRG] || 0;
      idrgUtama += tUtama[IDRG] || 0;
      idrgParipurna += tParipurna[IDRG] || 0;
    });

    const targetTotalKasus = kasusDasar + kasusMadya + kasusUtama + kasusParipurna;
    const targetInaTotal = inaDasar + inaMadya + inaUtama + inaParipurna;
    const targetIdrgTotal = idrgDasar + idrgMadya + idrgUtama + idrgParipurna;
    
    const selisihPendapatan = targetIdrgTotal - targetInaTotal;
    const pctSelisih = targetInaTotal > 0 ? (selisihPendapatan / targetInaTotal) * 100 : 0;
    
    // Dynamic Modes
    const tambahMode = document.getElementById('globalSimTambahSelect')?.value || 'tambah_cross_comp';
    const kurangMode = document.getElementById('globalSimKurangSelect')?.value || 'kurang_up';
    
    const isTambahUP = (tambahMode === 'tambah_up');
    const isKurangDM = (kurangMode === 'kurang_dm');

    
    let headerTambahan = 'Tambahan Kasus Dasar & Madya';
    if (tambahMode === 'tambah_up') headerTambahan = 'Tambahan Kasus Utama & Paripurna';
    else if (tambahMode === 'tambah_mu_reg' || tambahMode === 'tambah_mu_higher') headerTambahan = 'Tambahan Kasus Madya & Utama';
    else if (tambahMode === 'tambah_d_reg' || tambahMode === 'tambah_d_higher') headerTambahan = 'Tambahan Kasus Dasar';
    
    let headerPengurangan = 'Pengurangan Kasus Dasar & Madya';
    if (kurangMode === 'kurang_up') headerPengurangan = 'Pengurangan Kasus Utama & Paripurna';
    else if (kurangMode === 'kurang_dp') headerPengurangan = 'Pengurangan Kasus Dasar & Paripurna';
    else if (kurangMode === 'kurang_mup') headerPengurangan = 'Pengurangan Kasus Madya, Utama & Paripurna';
    
    let headerEksisting = 'Pendapatan Eksisting iDRG Kasus Dasar & Madya (Rp. M)';
    if (tambahMode === 'tambah_up') headerEksisting = 'Pendapatan Eksisting iDRG Kasus Utama & Paripurna (Rp. M)';
    else if (tambahMode === 'tambah_mu_reg' || tambahMode === 'tambah_mu_higher') headerEksisting = 'Pendapatan Eksisting iDRG Kasus Madya & Utama (Rp. M)';
    else if (tambahMode === 'tambah_d_reg' || tambahMode === 'tambah_d_higher') headerEksisting = 'Pendapatan Eksisting iDRG Kasus Dasar (Rp. M)';

    let eksistingTambahan = eksistingDM_Idrg;
    if (tambahMode === 'tambah_up') eksistingTambahan = eksistingUP_Idrg;
    else if (tambahMode === 'tambah_mu_reg' || tambahMode === 'tambah_mu_higher') eksistingTambahan = idrgMadya + idrgUtama;
    else if (tambahMode === 'tambah_d_reg' || tambahMode === 'tambah_d_higher') eksistingTambahan = idrgDasar;

    const html = `
      <div style="font-family: Arial, sans-serif; padding-top: 10px;">
        
        <!-- Summary Cards -->
        <div style="display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 180px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; text-align: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Total Kasus:</div>
            <div style="color: #be185d; font-size: 24px; font-weight: 900;">${formatNumber(targetTotalKasus)}</div>
            <div style="margin-top: 8px; font-size: 10px; color: #475569; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <div>D: <strong style="color: #0f172a;">${formatNumber(kasusDasar)}</strong></div>
              <div>M: <strong style="color: #0f172a;">${formatNumber(kasusMadya)}</strong></div>
              <div>U: <strong style="color: #0f172a;">${formatNumber(kasusUtama)}</strong></div>
              <div>P: <strong style="color: #0f172a;">${formatNumber(kasusParipurna)}</strong></div>
            </div>
          </div>
          <div style="flex: 1; min-width: 180px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; text-align: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Pendapatan INA:</div>
            <div style="color: #c2410c; font-size: 24px; font-weight: 900;">${formatMoneyUnit(targetInaTotal)}</div>
            <div style="margin-top: 8px; font-size: 10px; color: #475569; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <div>D: <strong style="color: #0f172a;">${formatMoneyUnit(inaDasar)}</strong></div>
              <div>M: <strong style="color: #0f172a;">${formatMoneyUnit(inaMadya)}</strong></div>
              <div>U: <strong style="color: #0f172a;">${formatMoneyUnit(inaUtama)}</strong></div>
              <div>P: <strong style="color: #0f172a;">${formatMoneyUnit(inaParipurna)}</strong></div>
            </div>
          </div>
          <div style="flex: 1; min-width: 180px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; text-align: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Total iDRG Eksisting:</div>
            <div style="color: #c2410c; font-size: 24px; font-weight: 900;">${formatMoneyUnit(targetIdrgTotal)}</div>
            <div style="margin-top: 8px; font-size: 10px; color: #475569; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <div>D: <strong style="color: #0f172a;">${formatMoneyUnit(idrgDasar)}</strong></div>
              <div>M: <strong style="color: #0f172a;">${formatMoneyUnit(idrgMadya)}</strong></div>
              <div>U: <strong style="color: #0f172a;">${formatMoneyUnit(idrgUtama)}</strong></div>
              <div>P: <strong style="color: #0f172a;">${formatMoneyUnit(idrgParipurna)}</strong></div>
            </div>
          </div>
          
          <!-- Scorecard Selisih -->
          <div style="flex: 1; min-width: 160px; background: ${selisihPendapatan >= 0 ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${selisihPendapatan >= 0 ? '#bbf7d0' : '#fecaca'}; padding: 12px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
            <div style="color: #64748b; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Selisih Pendapatan:</div>
            <div style="color: ${selisihPendapatan >= 0 ? '#15803d' : '#b91c1c'}; font-size: 24px; font-weight: 900;">${selisihPendapatan >= 0 ? '+' : ''}${formatMoneyUnit(selisihPendapatan)}</div>
            <div style="color: ${selisihPendapatan >= 0 ? '#15803d' : '#b91c1c'}; font-size: 14px; font-weight: bold; margin-top: 4px;">${selisihPendapatan >= 0 ? '+' : ''}${pctSelisih.toFixed(2).replace('.', ',')}%</div>
          </div>

          <div style="flex: 1; min-width: 160px; background: #fdf2f8; border: 1px solid #fbcfe8; padding: 12px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
            <div style="color: #be185d; font-size: 13px; font-weight: bold; margin-bottom: 5px;">Potensi Tambah Max:</div>
            <div style="color: #059669; font-size: 24px; font-weight: 900;">${formatMoneyUnit(potentials.potensiSerapanIdrg)}</div>
            <div style="color: #f43f5e; font-size: 11px; font-weight: 700; margin-top: 4px;">Filter Global Aktif</div>
          </div>
        </div>

        <!-- Competitor Breakdown -->
        <div style="width: 100%; margin-bottom: 5px; font-size: 12px; font-weight: 700; color: #0f172a; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; line-height: 1.6;">
          <div style="color: #be185d; display: flex; flex-direction: column; gap: 4px;">
            <div style="font-size: 14px; font-weight: 800; color: #0f766e;">
              Layanan: ${targetServiceSelect === 'ALL' ? 'Lintas Kompetensi Layanan (Semua)' : targetServiceSelect} 
              ${targetServiceSelect !== 'ALL' ? ` | Kompetensi RS Target: <span style="color:#b91c1c;">${levelNames[getCompetency(targetHospital(), targetServiceSelect)] || 'Tidak Kompeten'}</span>` : ''}
            </div>
            <div>
              Jumlah RS : ${competitorCount} &rarr; Kompetensi layanan : Dasar : ${compCountD}, Madya: ${compCountM}, Utama: ${compCountU}, Paripurna: ${compCountP}
              <span style="font-size:10px; font-weight:normal; color:#64748b; margin-left:8px;">(Berdasarkan Update Data 13 Agustus 2026)</span>
            </div>
          </div>
          <div style="color: #0369a1;">Kasus Regional : ${formatNumber(regTotalD.cases + regTotalM.cases + regTotalU.cases + regTotalP.cases)} kasus &rarr; Dasar : ${formatNumber(regTotalD.cases)} Kasus (${formatMoneyUnit(regTotalD.rp)}), Madya: ${formatNumber(regTotalM.cases)} Kasus (${formatMoneyUnit(regTotalM.rp)}), Utama: ${formatNumber(regTotalU.cases)} Kasus (${formatMoneyUnit(regTotalU.rp)}), Paripurna: ${formatNumber(regTotalP.cases)} Kasus (${formatMoneyUnit(regTotalP.rp)})</div>
        </div>

        <!-- Table -->
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #1e293b; text-align: center; font-size: 13px;">
            <thead style="background: #38bdf8; color: white;">
              <tr>
                <th rowspan="2" style="border: 1px solid #1e293b; padding: 8px; background: #0f766e;">Skenario</th>
                <th rowspan="2" style="border: 1px solid #1e293b; padding: 8px; background: #334155;">Eksisting Kasus & Pendapatan (Rp. M)<br><span style="font-size:10px;font-weight:normal;">(${headerTambahan.replace('Tambahan Kasus ', '')})</span></th>
                <th colspan="3" style="border: 1px solid #1e293b; padding: 8px; background: #059669;">${headerTambahan}</th>
                <th colspan="3" style="border: 1px solid #1e293b; padding: 8px; background: #e11d48;">${headerPengurangan}</th>
                <th rowspan="2" style="border: 1px solid #1e293b; padding: 8px; background: #047857;">Total Pendapatan Pasca iDRG & RBKP (Rp. M)</th>
                <th colspan="4" style="border: 1px solid #1e293b; padding: 8px; background: #0d9488;">Net +/- Pasca iDRG & RBKP (vs INACBG)</th>
              </tr>
              <tr>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #10b981;">Persentase</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #10b981;">Jumlah Kasus</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #10b981;">Tambahan (Rp. M)</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #f43f5e;">Persentase</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #f43f5e;">Jumlah Kasus</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #f43f5e;">Pengurangan (Rp. M)</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #14b8a6;">+/- Kasus</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #14b8a6;">% thd total kasus</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #14b8a6;">+/- Pendapatan (Rp. M)</th>
                <th style="border: 1px solid #1e293b; padding: 8px; background: #14b8a6;">% +/- Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              ${window.competencySimScenarios.map((pctTambah, idx) => {
                const pctKurang = window.competencyKurangScenarios[idx];
                
                const tambahKasus = Math.round(potentials.potensiSerapanKasus * (pctTambah / 100));
                const tambahIdrg = potentials.potensiSerapanIdrg * (pctTambah / 100);
                
                const kurangKasus = Math.round(potentials.potensiRedistribusiKasus * (pctKurang / 100));
                const kurangIdrg = potentials.potensiRedistribusiIdrg * (pctKurang / 100);
                
                const netKasus = tambahKasus - kurangKasus;
                const netKasusPct = targetTotalKasus > 0 ? (netKasus / targetTotalKasus) * 100 : 0;
                const netIdrg = tambahIdrg - kurangIdrg; 
                
                // Total Pasca RS Keseluruhan = Total Awal + Tambahan - Pengurangan
                const totalPasca = targetIdrgTotal + netIdrg;
                const selisihVsInacbg = totalPasca - targetInaTotal;
                const pctSelisihVsInacbg = targetInaTotal > 0 ? (selisihVsInacbg / targetInaTotal) * 100 : 0;

                return `
                  <tr>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold;">Skenario ${idx + 1}</td>
                    
                    <!-- Eksisting -->
                    ${idx === 0 ? `
                      <td rowspan="${window.competencySimScenarios.length}" style="border: 1px solid #1e293b; padding: 8px; background: #f8fafc;">
                        <div style="font-size:11px; color:#475569; margin-bottom:2px;">Total Kasus:</div>
                        <div style="font-weight:bold; font-size:14px; color:#0f172a;">${formatNumber(
                          tambahMode === 'tambah_up' ? (kasusUtama + kasusParipurna) :
                          (tambahMode === 'tambah_mu_reg' || tambahMode === 'tambah_mu_higher') ? (kasusMadya + kasusUtama) :
                          (tambahMode === 'tambah_d_reg' || tambahMode === 'tambah_d_higher') ? kasusDasar :
                          (kasusDasar + kasusMadya)
                        )}</div>
                        <div style="font-size:11px; color:#475569; margin-top:4px; display:flex; justify-content:center; gap:8px;">
                          ${tambahMode === 'tambah_up' ? `<div>U: ${formatNumber(kasusUtama)}</div><div>P: ${formatNumber(kasusParipurna)}</div>` :
                            (tambahMode === 'tambah_mu_reg' || tambahMode === 'tambah_mu_higher') ? `<div>M: ${formatNumber(kasusMadya)}</div><div>U: ${formatNumber(kasusUtama)}</div>` :
                            (tambahMode === 'tambah_d_reg' || tambahMode === 'tambah_d_higher') ? `<div>D: ${formatNumber(kasusDasar)}</div>` :
                            `<div>D: ${formatNumber(kasusDasar)}</div><div>M: ${formatNumber(kasusMadya)}</div>`}
                        
                        </div>
                        <div style="font-weight:bold; font-size:13px; color:#c2410c; margin-top:6px; padding-top:6px; border-top:1px solid #e2e8f0;">${formatMoneyUnit(eksistingTambahan)}</div>
                      </td>
                    ` : ''}

                    <!-- Tambahan -->
                    <td style="border: 1px solid #1e293b; padding: 8px;">
                      <div style="display:flex; align-items:center; justify-content:center;">
                        <input type="number" class="comp-sim-tambah-pct-input" data-idx="${idx}" value="${pctTambah}" min="0" max="100" style="width: 45px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; font-weight: bold;">
                        <span style="margin-left: 2px;">%</span>
                      </div>
                    </td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold;">${formatNumber(tambahKasus)}</td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: #059669;">+${formatMoneyUnit(tambahIdrg)}</td>
                    
                    <!-- Pengurangan -->
                    <td style="border: 1px solid #1e293b; padding: 8px;">
                      <div style="display:flex; align-items:center; justify-content:center;">
                        <input type="number" class="comp-sim-kurang-pct-input" data-idx="${idx}" value="${pctKurang}" min="0" max="100" style="width: 45px; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; font-weight: bold;">
                        <span style="margin-left: 2px;">%</span>
                      </div>
                    </td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold;">${formatNumber(kurangKasus)}</td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: #e11d48;">-${formatMoneyUnit(kurangIdrg)}</td>
                    
                    <!-- Total Pasca -->
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; background: #f0fdf4;">${formatMoneyUnit(totalPasca)}</td>

                    <!-- Net -->
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: ${netKasus >= 0 ? '#059669' : '#e11d48'}">${netKasus >= 0 ? '+' : ''}${formatNumber(netKasus)}</td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: ${netKasus >= 0 ? '#059669' : '#e11d48'}">${netKasus >= 0 ? '+' : ''}${netKasusPct.toFixed(2).replace('.', ',')} %</td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: ${selisihVsInacbg >= 0 ? '#059669' : '#e11d48'}">${selisihVsInacbg >= 0 ? '+' : ''}${formatMoneyUnit(Math.abs(selisihVsInacbg))}</td>
                    <td style="border: 1px solid #1e293b; padding: 8px; font-weight: bold; color: ${selisihVsInacbg >= 0 ? '#059669' : '#e11d48'}">${selisihVsInacbg >= 0 ? '+' : ''}${pctSelisihVsInacbg.toFixed(2).replace('.', ',')} %</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <div style="margin-top: 15px; font-size: 11px; color: #475569;">
          <div style="margin-bottom: 4px;"><strong>Catatan:</strong> Tabel ini terhubung secara dinamis dengan pengaturan <em>Skenario Simulasi Global</em> di bilah samping.</div>
          <div>* Total Pendapatan Pasca iDRG = Total iDRG Eksisting RS (${formatMoneyUnit(targetIdrgTotal)}) + Tambahan - Pengurangan.</div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    container.querySelectorAll('.comp-sim-tambah-pct-input').forEach(input => {
      input.addEventListener('change', function() {
        const idx = parseInt(this.getAttribute('data-idx'), 10);
        let val = parseFloat(this.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 100) val = 100;
        window.competencySimScenarios[idx] = val;
        renderCompetencySimSlide();
      });
    });

    container.querySelectorAll('.comp-sim-kurang-pct-input').forEach(input => {
      input.addEventListener('change', function() {
        const idx = parseInt(this.getAttribute('data-idx'), 10);
        let val = parseFloat(this.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 100) val = 100;
        window.competencyKurangScenarios[idx] = val;
        renderCompetencySimSlide();
      });
    });
  }

  function renderDynamicMarketShareSlide() {
    const container = document.getElementById("dynamicMarketShareSlide");
    if (!container) return;

    const selectedTargets = getTargetHospitals();
    const target = selectedTargets[0] || null;
    if (!target) {
      container.innerHTML = '<div style="padding:24px;color:#b91c1c;font-weight:700;">RS target tidak tersedia.</div>';
      return;
    }

    const globalService = document.getElementById("globalSimServiceSelect")?.value;
    if (!window.dynamicMarketService || !data.services.includes(window.dynamicMarketService)) {
      window.dynamicMarketService = globalService && globalService !== "ALL" && data.services.includes(globalService)
        ? globalService
        : data.services.find((service) => getCompetency(target, service) > 0) || data.services[0];
    }
    const service = window.dynamicMarketService;
    const targetComp = getCompetency(target, service);
    const targetSrv = target.services?.[service];
    const regionalSrv = data.regional?.services?.[service] || { total: createZeroMetric(), severity: {} };

    if (!targetSrv || targetComp <= 0) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <label style="font-size:12px;font-weight:800;color:#334155;">Layanan:</label>
          <select id="dynamicMarketServiceSelect" style="min-width:420px;padding:7px 10px;border:1.5px solid #7c3aed;border-radius:7px;font-weight:700;">
            ${data.services.map((item) => `<option value="${escapeHtml(item)}" ${item === service ? "selected" : ""}>${escapeHtml(formatService(item))}</option>`).join("")}
          </select>
        </div>
        <div style="padding:24px;border:1px solid #fde68a;background:#fffbeb;border-radius:10px;color:#92400e;font-weight:700;">RS target tidak memiliki kompetensi pada layanan ini. Pilih layanan lain untuk menjalankan simulasi dinamis.</div>`;
      container.querySelector("#dynamicMarketServiceSelect")?.addEventListener("change", (event) => {
        window.dynamicMarketService = event.target.value;
        renderDynamicMarketShareSlide();
      });
      return;
    }

    const rules = getLevelRules(targetComp, service);
    const targetCodes = new Set(selectedTargets.map((hospital) => hospital.code));
    const levelData = severityRanks.map((level) => {
      const regionalMetric = severityMetric(regionalSrv, level);
      const targetMetric = severityMetric(targetSrv, level);
      const competitors = data.hospitals.filter((hospital) =>
        !targetCodes.has(hospital.code) && getCompetency(hospital, service) >= level
      ).length;
      const naturalShare = competitors > 0 ? 100 / (competitors + 1) : 100;
      const direction = rules.tambah.includes(level) ? "tambah" : (rules.kurang.includes(level) ? "kurang" : "netral");
      return {
        level,
        direction,
        competitors,
        naturalShare,
        regionalCases: regionalMetric[CASES] || 0,
        regionalIdrg: regionalMetric[IDRG] || 0,
        targetCases: targetMetric[CASES] || 0,
        targetIna: targetMetric[INA] || 0,
        targetIdrg: targetMetric[IDRG] || 0,
        externalCases: Math.max(0, (regionalMetric[CASES] || 0) - (targetMetric[CASES] || 0)),
        externalIdrg: Math.max(0, (regionalMetric[IDRG] || 0) - (targetMetric[IDRG] || 0))
      };
    });

    const baselineCases = levelData.reduce((sum, item) => sum + item.targetCases, 0);
    const baselineIna = levelData.reduce((sum, item) => sum + item.targetIna, 0);
    const baselineIdrg = levelData.reduce((sum, item) => sum + item.targetIdrg, 0);
    const scenarioDefs = [
      { name: "Konservatif", factor: 0.50 },
      { name: "Moderat", factor: 0.75 },
      { name: "Proporsional", factor: 1.00 },
      { name: "Ekspansif", factor: 1.50 },
      { name: "Maksimum Rasional", factor: 2.00 }
    ];
    const overrideKey = `${activeDatasetKey}|${target.code}|${service}`;
    window.dynamicMarketOverrides = window.dynamicMarketOverrides || {};
    const overrides = window.dynamicMarketOverrides[overrideKey] || {};
    const pctFor = (scenarioIndex, item) => {
      const field = `${item.direction}_${item.level}`;
      const manual = overrides[scenarioIndex]?.[field];
      return Number.isFinite(manual) ? manual : Math.min(100, item.naturalShare * scenarioDefs[scenarioIndex].factor);
    };

    const scenarioResults = scenarioDefs.map((definition, scenarioIndex) => {
      let addCases = 0, addIdrg = 0, lossCases = 0, lossIdrg = 0;
      levelData.forEach((item) => {
        const pct = pctFor(scenarioIndex, item) / 100;
        if (item.direction === "tambah") {
          addCases += item.externalCases * pct;
          addIdrg += item.externalIdrg * pct;
        } else if (item.direction === "kurang") {
          lossCases += item.targetCases * pct;
          lossIdrg += item.targetIdrg * pct;
        }
      });
      const projectedCases = Math.max(0, baselineCases + addCases - lossCases);
      const projectedIdrg = Math.max(0, baselineIdrg + addIdrg - lossIdrg);
      return { definition, scenarioIndex, addCases, addIdrg, lossCases, lossIdrg, projectedCases, projectedIdrg };
    });

    const pctInputLines = (scenarioIndex, direction) => levelData
      .filter((item) => item.direction === direction)
      .map((item) => `<label style="display:flex;align-items:center;justify-content:space-between;gap:4px;white-space:nowrap;"><span>${shortLevelNames[item.level]}</span><span><input class="dynamic-market-pct" data-scenario="${scenarioIndex}" data-direction="${direction}" data-level="${item.level}" type="number" min="0" max="100" step="0.1" value="${pctFor(scenarioIndex, item).toFixed(1)}" style="width:52px;padding:3px;text-align:right;border:1px solid #cbd5e1;border-radius:4px;font-weight:800;">%</span></label>`)
      .join("") || '<span style="color:#94a3b8;">—</span>';

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;padding:8px 10px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:9px;">
        <div style="display:flex;align-items:center;gap:9px;min-width:0;">
          <label style="font-size:11px;font-weight:900;color:#5b21b6;white-space:nowrap;">LAYANAN</label>
          <select id="dynamicMarketServiceSelect" style="min-width:420px;max-width:660px;padding:6px 9px;border:1.5px solid #7c3aed;border-radius:7px;background:#fff;font-size:12px;font-weight:750;color:#312e81;">
            ${data.services.map((item) => `<option value="${escapeHtml(item)}" ${item === service ? "selected" : ""}>${escapeHtml(formatService(item))}</option>`).join("")}
          </select>
          <span style="padding:5px 9px;border-radius:999px;background:#7c3aed;color:#fff;font-size:11px;font-weight:900;white-space:nowrap;">Target: ${levelNames[targetComp]}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:10.5px;color:#64748b;font-weight:700;">${escapeHtml(target.name)}</span>
          <button id="dynamicMarketResetBtn" type="button" style="border:1px solid #c4b5fd;background:#fff;color:#6d28d9;border-radius:6px;padding:5px 9px;font-size:10.5px;font-weight:800;cursor:pointer;white-space:nowrap;">↻ Hitung Ulang Otomatis</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:9px;">
        <div style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;"><div style="font-size:10px;color:#64748b;font-weight:800;">KASUS EKSISTING</div><strong style="font-size:18px;color:#0f172a;">${formatNumber(baselineCases)}</strong></div>
        <div style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;"><div style="font-size:10px;color:#64748b;font-weight:800;">INA-CBG EKSISTING</div><strong style="font-size:18px;color:#c2410c;">${formatTableMoney(baselineIna)}</strong></div>
        <div style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;"><div style="font-size:10px;color:#64748b;font-weight:800;">iDRG EKSISTING</div><strong style="font-size:18px;color:#0369a1;">${formatTableMoney(baselineIdrg)}</strong></div>
        <div style="padding:8px 10px;border:1px solid #ddd6fe;border-radius:8px;background:#f5f3ff;"><div style="font-size:10px;color:#6d28d9;font-weight:800;">ATURAN KOMPETENSI</div><strong style="font-size:12px;color:#4c1d95;">Tambah ${rules.tambah.map((level) => shortLevelNames[level]).join("+") || "—"} · Kurang ${rules.kurang.map((level) => shortLevelNames[level]).join("+") || "—"}</strong></div>
      </div>

      <div style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin-bottom:8px;">
        <div style="padding:5px 9px;background:#334155;color:#fff;font-size:10.5px;font-weight:900;">DRIVER PASAR DINAMIS PER TINGKAT KOMPETENSI</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;text-align:center;">
          <thead><tr style="background:#e2e8f0;color:#334155;"><th style="padding:4px;">Level</th><th>Arah</th><th>Kasus Regional</th><th>Kasus Target</th><th>Pool Simulasi</th><th>RS Kompetitor Eligible</th><th>Natural Share</th></tr></thead>
          <tbody>${levelData.map((item) => `<tr style="border-top:1px solid #e2e8f0;background:${item.direction === "tambah" ? "#f0fdf4" : item.direction === "kurang" ? "#fff1f2" : "#fff"};"><td style="padding:4px;font-weight:900;">${levelNames[item.level]}</td><td style="font-weight:900;color:${item.direction === "tambah" ? "#15803d" : item.direction === "kurang" ? "#be123c" : "#64748b"};">${item.direction === "tambah" ? "↑ TAMBAH" : item.direction === "kurang" ? "↓ KURANG" : "—"}</td><td>${formatNumber(item.regionalCases)}</td><td>${formatNumber(item.targetCases)}</td><td>${formatNumber(item.direction === "tambah" ? item.externalCases : item.targetCases)}</td><td>${item.competitors}</td><td style="font-weight:900;">${item.naturalShare.toFixed(1).replace(".", ",")}%</td></tr>`).join("")}</tbody>
        </table>
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;border:1px solid #1e293b;text-align:center;font-size:11px;">
          <thead style="background:#38bdf8;color:white;">
            <tr>
              <th rowspan="2" style="border:1px solid #1e293b;padding:7px;background:#0f766e;">Skenario</th>
              <th rowspan="2" style="border:1px solid #1e293b;padding:7px;background:#334155;">Eksisting Kasus &amp; Pendapatan<br><span style="font-size:9px;font-weight:normal;">RS Target</span></th>
              <th colspan="3" style="border:1px solid #1e293b;padding:7px;background:#059669;">Tambahan Kasus Sesuai Kompetensi</th>
              <th colspan="3" style="border:1px solid #1e293b;padding:7px;background:#e11d48;">Pengurangan Kasus di Luar Kompetensi</th>
              <th rowspan="2" style="border:1px solid #1e293b;padding:7px;background:#047857;">Total Pendapatan Pasca iDRG &amp; RBKP</th>
              <th colspan="4" style="border:1px solid #1e293b;padding:7px;background:#0d9488;">Net +/- Pasca iDRG &amp; RBKP (vs INA-CBG)</th>
            </tr>
            <tr>
              <th style="border:1px solid #1e293b;padding:6px;background:#10b981;">Persentase Dinamis</th><th style="border:1px solid #1e293b;padding:6px;background:#10b981;">Jumlah Kasus</th><th style="border:1px solid #1e293b;padding:6px;background:#10b981;">Tambahan</th>
              <th style="border:1px solid #1e293b;padding:6px;background:#f43f5e;">Persentase Dinamis</th><th style="border:1px solid #1e293b;padding:6px;background:#f43f5e;">Jumlah Kasus</th><th style="border:1px solid #1e293b;padding:6px;background:#f43f5e;">Pengurangan</th>
              <th style="border:1px solid #1e293b;padding:6px;background:#14b8a6;">+/- Kasus</th><th style="border:1px solid #1e293b;padding:6px;background:#14b8a6;">% thd Total Kasus</th><th style="border:1px solid #1e293b;padding:6px;background:#14b8a6;">+/- Pendapatan</th><th style="border:1px solid #1e293b;padding:6px;background:#14b8a6;">% +/- Pendapatan</th>
            </tr>
          </thead>
          <tbody>${scenarioResults.map((result) => {
            const deltaCases = result.projectedCases - baselineCases;
            const deltaCasesPct = baselineCases > 0 ? deltaCases / baselineCases * 100 : 0;
            const deltaIna = result.projectedIdrg - baselineIna;
            const deltaInaPct = baselineIna > 0 ? deltaIna / baselineIna * 100 : 0;
            return `<tr style="background:${result.scenarioIndex === 2 ? "#ecfeff" : "#fff"};">
              <td style="border:1px solid #1e293b;padding:6px;font-weight:900;white-space:nowrap;">Skenario ${result.scenarioIndex + 1}<div style="font-size:9px;color:#64748b;">${result.definition.name}<br>${result.definition.factor.toFixed(2).replace(".", ",")}× natural</div></td>
              ${result.scenarioIndex === 0 ? `<td rowspan="${scenarioResults.length}" style="border:1px solid #1e293b;padding:7px;background:#f8fafc;"><div style="font-size:10px;color:#475569;">Total Kasus</div><div style="font-size:15px;font-weight:900;color:#0f172a;">${formatNumber(baselineCases)}</div><div style="margin-top:5px;font-size:10px;color:#475569;">INA-CBG</div><div style="font-weight:900;color:#c2410c;">${formatTableMoney(baselineIna)}</div><div style="margin-top:5px;font-size:10px;color:#475569;">iDRG</div><div style="font-weight:900;color:#0369a1;">${formatTableMoney(baselineIdrg)}</div></td>` : ""}
              <td style="border:1px solid #1e293b;padding:5px;min-width:105px;color:#15803d;font-weight:700;">${pctInputLines(result.scenarioIndex, "tambah")}</td><td style="border:1px solid #1e293b;padding:6px;font-weight:900;">${formatNumber(Math.round(result.addCases))}</td><td style="border:1px solid #1e293b;padding:6px;font-weight:900;color:#059669;">+${formatTableMoney(result.addIdrg)}</td>
              <td style="border:1px solid #1e293b;padding:5px;min-width:105px;color:#be123c;font-weight:700;">${pctInputLines(result.scenarioIndex, "kurang")}</td><td style="border:1px solid #1e293b;padding:6px;font-weight:900;">${formatNumber(Math.round(result.lossCases))}</td><td style="border:1px solid #1e293b;padding:6px;font-weight:900;color:#e11d48;">−${formatTableMoney(result.lossIdrg)}</td>
              <td style="border:1px solid #1e293b;padding:6px;font-weight:900;background:#f0fdf4;">${formatTableMoney(result.projectedIdrg)}</td>
              <td style="border:1px solid #1e293b;padding:6px;font-weight:900;color:${deltaCases >= 0 ? "#059669" : "#e11d48"};">${deltaCases >= 0 ? "+" : ""}${formatNumber(Math.round(deltaCases))}</td><td style="border:1px solid #1e293b;padding:6px;font-weight:900;color:${deltaCases >= 0 ? "#059669" : "#e11d48"};">${deltaCases >= 0 ? "+" : ""}${deltaCasesPct.toFixed(2).replace(".", ",")}%</td><td style="border:1px solid #1e293b;padding:6px;font-weight:900;color:${deltaIna >= 0 ? "#059669" : "#e11d48"};">${deltaIna >= 0 ? "+" : ""}${formatTableMoney(deltaIna)}</td><td style="border:1px solid #1e293b;padding:6px;font-weight:900;color:${deltaIna >= 0 ? "#059669" : "#e11d48"};">${deltaIna >= 0 ? "+" : ""}${deltaInaPct.toFixed(2).replace(".", ",")}%</td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
      <div style="margin-top:7px;padding:6px 9px;border-radius:7px;background:#eff6ff;color:#1e40af;font-size:10px;font-weight:650;">Mode otomatis membuat lima skenario dari natural share masing-masing level. Perubahan manual disimpan khusus untuk kombinasi periode, RS target, dan layanan yang sedang dipilih.</div>`;

    container.querySelector("#dynamicMarketServiceSelect")?.addEventListener("change", (event) => {
      window.dynamicMarketService = event.target.value;
      renderDynamicMarketShareSlide();
    });
    container.querySelector("#dynamicMarketResetBtn")?.addEventListener("click", () => {
      delete window.dynamicMarketOverrides[overrideKey];
      renderDynamicMarketShareSlide();
    });
    container.querySelectorAll(".dynamic-market-pct").forEach((input) => {
      input.addEventListener("change", () => {
        const scenarioIndex = Number(input.dataset.scenario);
        const field = `${input.dataset.direction}_${input.dataset.level}`;
        const value = Math.min(100, Math.max(0, Number(input.value) || 0));
        window.dynamicMarketOverrides[overrideKey] = window.dynamicMarketOverrides[overrideKey] || {};
        window.dynamicMarketOverrides[overrideKey][scenarioIndex] = window.dynamicMarketOverrides[overrideKey][scenarioIndex] || {};
        window.dynamicMarketOverrides[overrideKey][scenarioIndex][field] = value;
        renderDynamicMarketShareSlide();
      });
    });
  }

  function renderRegionalProfileSlide() {
    const target = targetHospital();
    const totalCases = data.regional.total[CASES];
    const totalIna = data.regional.total[INA];
    const totalIdrg = data.regional.total[IDRG];
    const totalActive = data.hospitals.length;

    const formatMoneyUnit = (val) => {
    const numeric = Number(val) || 0;
    const absolute = Math.abs(numeric);
    const sign = numeric < 0 ? "-" : "";
    const inMilyar = absolute / 1e9;
    let formatted;
    if (absolute >= 1e9) {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inMilyar);
    } else {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(inMilyar);
    }
    return `${sign}${formatted} M`;
  };

    // Hospital classes
    const classCounts = { A: 0, B: 0, C: 0, D: 0 };
    data.hospitals.forEach(h => {
      const cls = String(h.class || '').toUpperCase().trim();
      if (classCounts[cls] !== undefined) classCounts[cls]++;
    });

    // Top 5 hospitals
    const topHospitals = [...data.hospitals]
      .sort((a, b) => b.total[CASES] - a.total[CASES])
      .slice(0, 5);

    // Severity metric breakdown
    const kDasar = severityMetric(data.regional, 1)[CASES];
    const kMadya = severityMetric(data.regional, 2)[CASES];
    const kUtama = severityMetric(data.regional, 3)[CASES];
    const kParipurna = severityMetric(data.regional, 4)[CASES];
    const kLainnya = state.excludeUnmapped ? 0 : metric(data.regional.unclassified)[CASES];

    const severityRows = [
      { name: "Dasar", cases: kDasar, pct: totalCases ? (kDasar / totalCases) * 100 : 0 },
      { name: "Madya", cases: kMadya, pct: totalCases ? (kMadya / totalCases) * 100 : 0 },
      { name: "Utama", cases: kUtama, pct: totalCases ? (kUtama / totalCases) * 100 : 0 },
      { name: "Paripurna", cases: kParipurna, pct: totalCases ? (kParipurna / totalCases) * 100 : 0 },
      { name: "Lainnya", cases: kLainnya, pct: totalCases ? (kLainnya / totalCases) * 100 : 0 }
    ];

    
    const getChecked = (dropdown) => Array.from(dropdown?.querySelectorAll("input:checked") || []).map(i => i.value);
    const selectedProvinces = getChecked(document.getElementById("provDropdown"));
    const selectedCities = getChecked(document.getElementById("cityDropdown"));
    const baseData = allDatasets[activeDatasetKey] || window.marketSimulatorData;
    
    let filterText = 'NASIONAL';
    if (selectedProvinces.length > 0) {
      const parts = [];
      for (const p of selectedProvinces) {
          let pCities = selectedCities.filter(c => {
            return baseData.hospitals.some(h => h.city === c && h.province === p);
          });
          if (pCities.length === 0) {
            pCities = Array.from(new Set(data.hospitals.filter(h => h.province === p).map(h => h.city))).sort();
          }
          parts.push(`${p} (${pCities.join(', ')})`);
        }
      filterText = parts.join(' | ');
    }


    const filterSummaryHTML = selectedProvinces.length > 0 ? 
      '<div style="font-size: 13.5px; font-weight: 600; color: #1e293b; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; max-height: 120px; overflow-y: auto;">' +
      selectedProvinces.map(p => {
          let pCities = selectedCities.filter(c => baseData.hospitals.some(h => h.city === c && h.province === p));
          if (pCities.length === 0) {
            pCities = Array.from(new Set(data.hospitals.filter(h => h.province === p).map(h => h.city))).sort();
          }
          return '<div><span style="color: #0f766e;">' + p + '</span> : <span style="font-weight: 400; color: #475569;">' + pCities.join(', ') + '</span></div>';
        }).join('') +
      '</div>' : 
      '<div style="font-size: 13.5px; font-weight: 600; color: #1e293b; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">Nasional (Semua Provinsi)</div>';

    document.getElementById("regionalProfileSlideTitle").innerHTML = `Profil & Kasus Regional - ${target.name} `;
    document.getElementById("regionalProfileSlide").innerHTML = `
      <div class="regional-profile-layout" style="display: grid; grid-template-columns: 460px minmax(0, 1fr); gap: 20px; height: 100%; min-height: 0;">
        <!-- Left: Interactive Vector Map Container -->
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); display: flex; flex-direction: column; height: 100%; min-height: 0;">
          <div id="junwatuMapContainer" class="regional-map-crop" role="img" aria-label="Peta Vektor Indonesia" style="flex: 1 1 auto; height: 100%; min-height: 380px; position:relative; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; background: #ffffff; display:flex; align-items:center; justify-content:center;">
            <div id="junwatuLoader" style="color:#0284c7; font-size: 14px; font-weight:600; display:flex; gap:8px; align-items:center;">
              <div style="width:20px;height:20px;border:2px solid #0284c7;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
              Memuat Peta Regional...
            </div>
          </div>
        </div>

        <!-- Right: Summary and Tables -->
        <div class="regional-profile-main" style="display: flex; flex-direction: column; gap: 14px; height: 100%; min-height: 0;">
          <!-- Top KPI Card -->
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 16px; padding: 16px 22px; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="position: absolute; right: 20px; top: 16px; opacity: 0.85;">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0f766e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/>
              </svg>
            </div>
            
            <div style="font-size: 15px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
              Sebaran RS AKTIF: <span style="color: #dc2626; font-size: 22px; font-weight: 900;">${formatNumber(totalActive)}</span>
            </div>

            <div style="font-size: 26px; font-weight: 900; color: #0d9488; margin: 3px 0 10px; letter-spacing: 0.5px;">
              A: ${classCounts.A} | B: ${classCounts.B} | C: ${classCounts.C} | D: ${classCounts.D}
            </div>
            ${filterSummaryHTML}

            <div style="display: grid; grid-template-columns: 240px 1fr; row-gap: 5px; column-gap: 8px; font-size: 13.5px; font-weight: 700; color: #475569; text-transform: uppercase;">
              <div>TOTAL KASUS REGIONAL</div>
              <div style="color: #0f172a; font-weight: 800;">: ${formatNumber(totalCases)} Kasus</div>
              <div>PENDAPATAN INA-CBG REGIONAL</div>
              <div style="color: #0f172a; font-weight: 800;">: Rp ${formatMoneyUnit(totalIna)}</div>
              <div>POTENSI iDRG REGIONAL</div>
              <div style="color: #0f172a; font-weight: 800;">: Rp ${formatMoneyUnit(totalIdrg)}</div>
            </div>
          </div>

          <!-- Bottom Tables Row -->
          <div style="display: grid; grid-template-columns: 38% 1fr; gap: 14px; flex: 1 1 auto; min-height: 0;">
            <!-- Left Table: Tingkat Keparahan -->
            <div style="border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px;">
                <thead>
                  <tr style="background: #16a085; color: #ffffff; font-weight: 800; text-transform: uppercase; font-size: 13px;">
                    <th style="padding: 10px 12px; border-right: 1px solid rgba(255,255,255,0.2);">TINGKAT</th>
                    <th style="padding: 10px 12px; text-align: right; border-right: 1px solid rgba(255,255,255,0.2);">KASUS</th>
                    <th style="padding: 10px 12px; text-align: right;">%</th>
                  </tr>
                </thead>
                <tbody>
                  ${severityRows.map(r => `
                    <tr style="background: #fefce8; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">
                      <td style="padding: 7px 12px; border-right: 1px solid #e2e8f0;">${escapeHtml(r.name)}</td>
                      <td style="padding: 7px 12px; text-align: right; border-right: 1px solid #e2e8f0; font-variant-numeric: tabular-nums;">${formatNumber(r.cases)}</td>
                      <td style="padding: 7px 12px; text-align: right; font-variant-numeric: tabular-nums;">${r.pct.toFixed(2).replace('.', ',')}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Right Table: Top 5 RS -->
            <div style="border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px;">
                <thead>
                  <tr style="background: #ea580c; color: #ffffff; font-weight: 800; text-transform: uppercase; font-size: 13px;">
                    <th style="padding: 10px 8px; width: 36px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">NO</th>
                    <th style="padding: 10px 12px; border-right: 1px solid rgba(255,255,255,0.2);">RUMAH SAKIT</th>
                    <th style="padding: 10px 8px; width: 55px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">KELAS</th>
                    <th style="padding: 10px 12px; width: 90px; text-align: right;">KASUS</th>
                  </tr>
                </thead>
                <tbody>
                  ${topHospitals.map((h, i) => {
                    const isTarget = target.isMultiTarget ? (target.targetCodes || []).includes(h.code) : h.code === target.code;
                    return `
                      <tr style="background: ${isTarget ? '#fed7aa' : (i % 2 === 0 ? '#ffffff' : '#f8fafc')}; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: ${isTarget ? '800' : '600'};">
                        <td style="padding: 7px 8px; text-align: center; border-right: 1px solid #e2e8f0;">${i + 1}</td>
                        <td style="padding: 7px 12px; border-right: 1px solid #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${escapeHtml(h.name)}">
                          ${escapeHtml(h.name)}
                        </td>
                        <td style="padding: 7px 8px; text-align: center; border-right: 1px solid #e2e8f0;">${escapeHtml(h.class || '—')}</td>
                        <td style="padding: 7px 12px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(h.total[CASES])}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render unified interactive map for Slide 7/8
    renderUnifiedInteractiveMap("junwatuMapContainer", { isSlide8: true });
  }

  function getActiveMirroringHospitals() {
    // Agar perhitungan konsisten dengan Slide 6 (Regional), kita gunakan data rumah sakit yang sesuai dengan filter aktif
    return data.hospitals || [];
  }

  // Alias untuk format uang: T (triliun), M (miliar), 2 desimal
  function formatMoneyUnit(val) {
    const numeric = Number(val) || 0;
    const absolute = Math.abs(numeric);
    const sign = numeric < 0 ? "-" : "";
    const inMilyar = absolute / 1e9;
    let formatted;
    if (absolute >= 1e9) {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inMilyar);
    } else {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(inMilyar);
    }
    return `${sign}${formatted} M`;
  }

  function formatTableMoney(val) {
    const numeric = Number(val) || 0;
    const absolute = Math.abs(numeric);
    const sign = numeric < 0 ? "-" : "";
    const inMilyar = absolute / 1e9;
    let formatted;
    if (absolute >= 1e9) {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inMilyar);
    } else {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(inMilyar);
    }
    return `${sign}${formatted}`;
  }

  function formatNetMoneyUnit(val) {
    const numeric = Number(val) || 0;
    const absolute = Math.abs(numeric);
    const sign = numeric < 0 ? "-" : "";
    const inMilyar = absolute / 1e9;
    let formatted;
    if (absolute >= 1e9) {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inMilyar);
    } else {
      formatted = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(inMilyar);
    }
    return `${sign}${formatted} M`;
  }

  function formatTablePct(pct) {
    if (pct === undefined || pct === null || isNaN(pct)) return "—";
    const val = pct * 100;
    const sign = val > 0 ? "+" : "";
    return `${sign}${val.toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`;
  }

  function computeNationalMirroringMetrics(hospitalsList) {
  const roundM = (val) => {
    if (typeof val !== "number" || val === 0 || isNaN(val)) return val;
    const abs = Math.abs(val);
    const sign = val < 0 ? -1 : 1;
    const inM = abs / 1e9;
    let factor = (abs >= 1e9) ? 1e2 : 1e3;
    return sign * (Math.round(inM * factor) / factor) * 1e9;
  };

    const list = hospitalsList && hospitalsList.length > 0 ? hospitalsList : (data.hospitals || []);
    
    const classCounts = { A: 0, B: 0, C: 0, D: 0 };
    let totalKasus = 0;
    let totalIna = 0;
    let totalIdrg = 0;

    const base = {
      A: { 4: [0,0,0], 3: [0,0,0], 2: [0,0,0], 1: [0,0,0] },
      B: { 4: [0,0,0], 3: [0,0,0], 2: [0,0,0], 1: [0,0,0] },
      C: { 4: [0,0,0], 3: [0,0,0], 2: [0,0,0], 1: [0,0,0] },
      D: { 4: [0,0,0], 3: [0,0,0], 2: [0,0,0], 1: [0,0,0] }
    };

    const uniqueProvs = new Set();
    const uniqueCities = new Set();

    list.forEach((h) => {
      const cls = (h.class || "").toUpperCase();
      if (classCounts[cls] !== undefined) classCounts[cls]++;
      if (h.province) uniqueProvs.add(h.province);
      if (h.city) uniqueCities.add(h.city);

      const hCases = h.total ? (h.total[0] || 0) : 0;
      const hIna = h.total ? (h.total[1] || 0) : 0;
      const hIdrg = h.total ? (h.total[IDRG] !== undefined ? h.total[IDRG] : (h.total[2] || 0)) : 0;

      totalKasus += hCases;
      totalIna += hIna;
      totalIdrg += hIdrg;

      if (base[cls]) {
        [4, 3, 2, 1].forEach((lvl) => {
          const sev = h.severity && h.severity[lvl] ? h.severity[lvl] : [0,0,0];
          base[cls][lvl][0] += sev[0] || 0;
          base[cls][lvl][1] += sev[1] || 0;
          base[cls][lvl][2] += (sev[IDRG] !== undefined ? sev[IDRG] : (sev[2] || 0));
        });
      }
    });

    const RATIOS = {
      A: {
        4: [0.09541996, 0.72008650, 0.72113603],
        3: [0.21595121, 0.85250423, 0.85996614],
        2: [0.10784881, 0.69410185, 0.69639535],
        1: [0.04342000, 0.45890000, 0.49876000]
      },
      B: {
        4: [0.09535068, 0.63833671, 0.64906560],
        3: [0.17735431, 0.88289370, 0.88349272],
        2: [0.15616439, 0.66563849, 0.67389423],
        1: [0.05770000, 0.52700000, 0.51970000]
      },
      C: {
        4: [0.06413407, 0.56849360, 0.55700000],
        3: [0.16124709, 0.82358079, 0.83690000],
        2: [0.19265339, 0.68862837, 0.71210000],
        1: [0.06815000, 0.55400000, 0.55620000]
      },
      D: {
        4: [0.04555842, 0.37230000, 0.39500000],
        3: [0.09527512, 0.61612735, 0.67320000],
        2: [0.17937517, 0.56135706, 0.61480000],
        1: [0.04377000, 0.37790000, 0.39860000]
      }
    };

    const classes = ["A", "B", "C", "D"];
    const levels = [4, 3, 2, 1];

    const result = {
      RI: { 4: {}, 3: {}, 2: {}, 1: {}, total: { A: [0,0,0,0,0], B: [0,0,0,0,0], C: [0,0,0,0,0], D: [0,0,0,0,0], Total: [0,0,0,0,0] } },
      RJ: { 4: {}, 3: {}, 2: {}, 1: {}, total: { A: [0,0,0,0,0], B: [0,0,0,0,0], C: [0,0,0,0,0], D: [0,0,0,0,0], Total: [0,0,0,0,0] } },
      grand: { A: [0,0,0,0,0], B: [0,0,0,0,0], C: [0,0,0,0,0], D: [0,0,0,0,0], Total: [0,0,0,0,0] }
    };

    classes.forEach((cls) => {
      let totRiK = 0, totRiIna = 0, totRiIdrg = 0;
      let totRjK = 0, totRjIna = 0, totRjIdrg = 0;

      levels.forEach((lvl) => {
        const [kTot, inaTot, idrgTot] = base[cls][lvl];
        const [rK, rIna, rIdrg] = RATIOS[cls][lvl];

        const riK = Math.round(kTot * rK);
        const rjK = kTot - riK;

        const riIna = roundM(inaTot * rIna);
        const rjIna = roundM(inaTot - riIna);

        const riIdrg = roundM(idrgTot * rIdrg);
        const rjIdrg = roundM(idrgTot - riIdrg);

        result.RI[lvl][cls] = [riK, riIna, riIdrg, riIdrg - riIna, riIna ? (riIdrg - riIna) / riIna : 0];
        result.RJ[lvl][cls] = [rjK, rjIna, rjIdrg, rjIdrg - rjIna, rjIna ? (rjIdrg - rjIna) / rjIna : 0];

        totRiK += riK; totRiIna += riIna; totRiIdrg += riIdrg;
        totRjK += rjK; totRjIna += rjIna; totRjIdrg += rjIdrg;
      });

      result.RI.total[cls] = [totRiK, totRiIna, totRiIdrg, totRiIdrg - totRiIna, totRiIna ? (totRiIdrg - totRiIna) / totRiIna : 0];
      result.RJ.total[cls] = [totRjK, totRjIna, totRjIdrg, totRjIdrg - totRjIna, totRjIna ? (totRjIdrg - totRjIna) / totRjIna : 0];

      const totGrdK = totRiK + totRjK;
      const totGrdIna = totRiIna + totRjIna;
      const totGrdIdrg = totRiIdrg + totRjIdrg;
      result.grand[cls] = [totGrdK, totGrdIna, totGrdIdrg, totGrdIdrg - totGrdIna, totGrdIna ? (totGrdIdrg - totGrdIna) / totGrdIna : 0];
    });

    ["RI", "RJ"].forEach((type) => {
      levels.forEach((lvl) => {
        let sK = 0, sIna = 0, sIdrg = 0;
        classes.forEach((cls) => {
          sK += result[type][lvl][cls][0];
          sIna += roundM(result[type][lvl][cls][1]);
          sIdrg += roundM(result[type][lvl][cls][2]);
        });
        result[type][lvl].Total = [sK, sIna, sIdrg, sIdrg - sIna, sIna ? (sIdrg - sIna) / sIna : 0];
      });

      let sTotK = 0, sTotIna = 0, sTotIdrg = 0;
      classes.forEach((cls) => {
        sTotK += result[type].total[cls][0];
        sTotIna += roundM(result[type].total[cls][1]);
        sTotIdrg += roundM(result[type].total[cls][2]);
      });
      result[type].total.Total = [sTotK, sTotIna, sTotIdrg, sTotIdrg - sTotIna, sTotIna ? (sTotIdrg - sTotIna) / sTotIna : 0];
    });

    let gTotK = 0, gTotIna = 0, gTotIdrg = 0;
    classes.forEach((cls) => {
      gTotK += result.grand[cls][0];
      gTotIna += roundM(result.grand[cls][1]);
      gTotIdrg += roundM(result.grand[cls][2]);
    });
    result.grand.Total = [gTotK, gTotIna, gTotIdrg, gTotIdrg - gTotIna, gTotIna ? (gTotIdrg - gTotIna) / gTotIna : 0];

    const riCases = result.RI.total.Total[0];
    const rjCases = result.RJ.total.Total[0];
    const totalCalcKasus = riCases + rjCases;
    const finalTotalKasus = totalKasus || totalCalcKasus;

    const pctRanap = finalTotalKasus > 0 ? (riCases / finalTotalKasus) * 100 : 11.8;
    const pctRajal = finalTotalKasus > 0 ? (rjCases / finalTotalKasus) * 100 : 88.2;

    const diffRI_M = (result.RI.total.Total[2] - result.RI.total.Total[1]) / 1e9;
    const pctRI = result.RI.total.Total[1] > 0 ? ((result.RI.total.Total[2] - result.RI.total.Total[1]) / result.RI.total.Total[1]) * 100 : 0;

    const diffRJ_M = (result.RJ.total.Total[2] - result.RJ.total.Total[1]) / 1e9;
    const pctRJ = result.RJ.total.Total[1] > 0 ? ((result.RJ.total.Total[2] - result.RJ.total.Total[1]) / result.RJ.total.Total[1]) * 100 : 0;

    const diffTotal_T = (result.grand.Total[2] - result.grand.Total[1]) / 1e12;
    const pctTotal = result.grand.Total[1] > 0 ? ((result.grand.Total[2] - result.grand.Total[1]) / result.grand.Total[1]) * 100 : 0;

    return {
      list,
      totalKasus: finalTotalKasus,
      totalIna: totalIna || result.grand.Total[1],
      totalIdrg: totalIdrg || result.grand.Total[2],
      hospitalCount: list.length,
      provCount: uniqueProvs.size || (list.length > 0 ? 1 : 0),
      cityCount: uniqueCities.size || (list.length > 0 ? 1 : 0),
      classCounts,
      base,
      result,
      riCases,
      rjCases,
      pctRanap,
      pctRajal,
      diffRI_M,
      pctRI,
      diffRJ_M,
      pctRJ,
      diffTotal_T,
      pctTotal
    };
  }

  // --- SLIDE: PROFIL & KASUS REGIONAL BERDASARKAN KOMPETENSI ICD ---
  function renderIcdCompetencySlide() {
    const container = document.getElementById("icdCompetencySlide");
    if (!container) return;

    // Gunakan data regional sesuai filter aktif
    const activeHospitals = data.hospitals || [];
    
    const metrics = computeNationalMirroringMetrics(activeHospitals);
    const { classCounts, result, diffRI_M, pctRI, diffRJ_M, pctRJ, diffTotal_T, pctTotal } = metrics;
    const totalActive = metrics.hospitalCount;

    const classes = ["A", "B", "C", "D"];
    const levels = [4, 3, 2, 1];
    const levelLabels = { 4: "Paripurna", 3: "Utama", 2: "Madya", 1: "Dasar" };

    const fmtInt = (v) => formatNumber(Math.round(v || 0));
    const fmtPct = (v) => {
      if (!v && v !== 0) return "0,0%";
      const sign = v > 0 ? "+" : "";
      return sign + (v * 100).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
    };

    const fmtM = formatTableMoney;

    const renderCells = (groupData) => {
      const [k, ina, idrg, selisih, pct] = groupData || [0,0,0,0,0];
      const pctColor = pct > 0 ? "#15803d" : (pct < 0 ? "#b91c1c" : "#334155");
      return `
        <td style="text-align: right; padding: 4px 5px; font-size: 11px; border: 1px solid #cbd5e1; white-space: nowrap;">${fmtInt(k)}</td>
        <td style="text-align: right; padding: 4px 5px; font-size: 11px; border: 1px solid #cbd5e1; white-space: nowrap;">${fmtM(ina)}</td>
        <td style="text-align: right; padding: 4px 5px; font-size: 11px; border: 1px solid #cbd5e1; white-space: nowrap;">${fmtM(idrg)}</td>
        <td style="text-align: right; padding: 4px 5px; font-size: 11px; border: 1px solid #cbd5e1; white-space: nowrap; color: ${pctColor}; font-weight: 600;">${fmtM(selisih)}</td>
        <td style="text-align: right; padding: 4px 5px; font-size: 11px; border: 1px solid #cbd5e1; white-space: nowrap; color: ${pctColor}; font-weight: 700;">${fmtPct(pct)}</td>
      `;
    };

    let html = `
      <div style="display: flex; flex-direction: column; gap: 8px; height: 100%;">
        <!-- Top Sub-Navigation Tabs for National Mirroring -->
        ${renderNationalNavTabs(6)}

        <!-- Top Summary Cards Row -->
        <div style="display: flex; gap: 14px; align-items: stretch;">
          
          <!-- Left Card: Sebaran RS Aktif -->
          <div style="flex: 0 0 40%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="flex-shrink: 0; width: 42px; height: 42px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px;">
              🏥
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <div style="font-size: 14.5px; font-weight: 800; color: #475569; letter-spacing: 0.3px;">
                Sebaran RS AKTIF: <span style="font-weight: 900; color: #1e293b; font-size: 17px;">${fmtInt(totalActive)}</span>
              </div>
              <div style="font-size: 13.5px; font-weight: 700; color: #0284c7; letter-spacing: 0.5px;">
                A: ${classCounts.A} <span style="color: #cbd5e1; font-weight: 400;">|</span> B: ${classCounts.B} <span style="color: #cbd5e1; font-weight: 400;">|</span> C: ${classCounts.C} <span style="color: #cbd5e1; font-weight: 400;">|</span> D: ${classCounts.D}
              </div>
            </div>
          </div>

          <!-- Right Card: Financial and Case Stats -->
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 16px; display: flex; flex-direction: column; justify-content: center; gap: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #475569; font-weight: 700;">
              <span>TOTAL KASUS AKTIF</span>
              <span style="font-weight: 800; color: #1e293b;">: ${fmtInt(metrics.totalKasus)} Kasus</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #475569; font-weight: 700;">
              <span>PENDAPATAN INA-CBG AKTIF</span>
              <span style="font-weight: 800; color: #1e293b;">: ${fmtM(metrics.totalIna)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #475569; font-weight: 700;">
              <span>POTENSI iDRG AKTIF</span>
              <span style="font-weight: 800; color: #1e293b;">: ${fmtM(metrics.totalIdrg)}</span>
            </div>
          </div>

        </div>

        <!-- Main Matrix Table -->
        <div style="flex: 1; overflow-x: auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-family: inherit; font-size: 11px;">
            <thead>
              <!-- Top Group Headers -->
              <tr style="color: white; font-weight: 800;">
                <th rowspan="2" style="background-color: #16a085; width: 68px; padding: 5px 3px; font-size: 11px; border: 1px solid #0d735f; vertical-align: middle;">Jenis<br>Layanan</th>
                <th rowspan="2" style="background-color: #16a085; width: 72px; padding: 5px 3px; font-size: 11px; border: 1px solid #0d735f; vertical-align: middle;">Komp.<br>ICD</th>
                <th colspan="5" style="background-color: #e06d75; padding: 4px; font-size: 11.5px; border: 1px solid #cf565e; letter-spacing: 0.5px;">RS A</th>
                <th colspan="5" style="background-color: #84cc16; padding: 4px; font-size: 11.5px; border: 1px solid #65a30d; letter-spacing: 0.5px;">RS B</th>
                <th colspan="5" style="background-color: #06b6d4; padding: 4px; font-size: 11.5px; border: 1px solid #0891b2; letter-spacing: 0.5px;">RS C</th>
                <th colspan="5" style="background-color: #8b5cf6; padding: 4px; font-size: 11.5px; border: 1px solid #7c3aed; letter-spacing: 0.5px;">RS D</th>
                <th colspan="5" style="background-color: #d97706; padding: 4px; font-size: 11.5px; border: 1px solid #b45309; letter-spacing: 0.5px;">Total</th>
              </tr>
              <!-- Sub Headers -->
              <tr style="color: white; font-weight: 700; font-size: 9.5px;">
                <!-- RS A sub headers -->
                <th style="background-color: #e77f86; padding: 3px 2px; border: 1px solid #cf565e;">Jumlah<br>Kasus</th>
                <th style="background-color: #e77f86; padding: 3px 2px; border: 1px solid #cf565e;">INA CBG<br>(Rp,M)</th>
                <th style="background-color: #e77f86; padding: 3px 2px; border: 1px solid #cf565e;">IDRG<br>(Rp,M)</th>
                <th style="background-color: #e77f86; padding: 3px 2px; border: 1px solid #cf565e;">Selisih<br>(Rp,M)</th>
                <th style="background-color: #e77f86; padding: 3px 2px; border: 1px solid #cf565e;">% Selisih</th>

                <!-- RS B sub headers -->
                <th style="background-color: #9ecc1a; padding: 3px 2px; border: 1px solid #65a30d;">Jumlah<br>Kasus</th>
                <th style="background-color: #9ecc1a; padding: 3px 2px; border: 1px solid #65a30d;">INA CBG<br>(Rp,M)</th>
                <th style="background-color: #9ecc1a; padding: 3px 2px; border: 1px solid #65a30d;">IDRG<br>(Rp,M)</th>
                <th style="background-color: #9ecc1a; padding: 3px 2px; border: 1px solid #65a30d;">Selisih<br>(Rp,M)</th>
                <th style="background-color: #9ecc1a; padding: 3px 2px; border: 1px solid #65a30d;">% Selisih</th>

                <!-- RS C sub headers -->
                <th style="background-color: #22c7e0; padding: 3px 2px; border: 1px solid #0891b2;">Jumlah<br>Kasus</th>
                <th style="background-color: #22c7e0; padding: 3px 2px; border: 1px solid #0891b2;">INA CBG<br>(Rp,M)</th>
                <th style="background-color: #22c7e0; padding: 3px 2px; border: 1px solid #0891b2;">IDRG<br>(Rp,M)</th>
                <th style="background-color: #22c7e0; padding: 3px 2px; border: 1px solid #0891b2;">Selisih<br>(Rp,M)</th>
                <th style="background-color: #22c7e0; padding: 3px 2px; border: 1px solid #0891b2;">% Selisih</th>

                <!-- RS D sub headers -->
                <th style="background-color: #a77ef8; padding: 3px 2px; border: 1px solid #7c3aed;">Jumlah<br>Kasus</th>
                <th style="background-color: #a77ef8; padding: 3px 2px; border: 1px solid #7c3aed;">INA CBG<br>(Rp,M)</th>
                <th style="background-color: #a77ef8; padding: 3px 2px; border: 1px solid #7c3aed;">IDRG<br>(Rp,M)</th>
                <th style="background-color: #a77ef8; padding: 3px 2px; border: 1px solid #7c3aed;">Selisih<br>(Rp,M)</th>
                <th style="background-color: #a77ef8; padding: 3px 2px; border: 1px solid #7c3aed;">% Selisih</th>

                <!-- Total sub headers -->
                <th style="background-color: #e58d13; padding: 3px 2px; border: 1px solid #b45309;">Jumlah<br>Kasus</th>
                <th style="background-color: #e58d13; padding: 3px 2px; border: 1px solid #b45309;">INA CBG<br>(Rp,M)</th>
                <th style="background-color: #e58d13; padding: 3px 2px; border: 1px solid #b45309;">IDRG<br>(Rp,M)</th>
                <th style="background-color: #e58d13; padding: 3px 2px; border: 1px solid #b45309;">Selisih<br>(Rp,M)</th>
                <th style="background-color: #e58d13; padding: 3px 2px; border: 1px solid #b45309;">% Selisih</th>
              </tr>
            </thead>
            <tbody>
              <!-- RAWAT INAP -->
              ${levels.map((lvl, idx) => `
                <tr style="background-color: #ffffff;">
                  ${idx === 0 ? `<td rowspan="5" style="vertical-align: middle; font-weight: 700; font-size: 11.5px; background: #ffffff; border: 1px solid #cbd5e1; text-align: center; color: #1e293b; line-height: 1.2;">Rawat<br>Inap</td>` : ''}
                  <td style="font-weight: 600; font-size: 11px; background: #fefce8; border: 1px solid #cbd5e1; text-align: center; color: #334155;">${levelLabels[lvl]}</td>
                  ${renderCells(result.RI[lvl].A)}
                  ${renderCells(result.RI[lvl].B)}
                  ${renderCells(result.RI[lvl].C)}
                  ${renderCells(result.RI[lvl].D)}
                  ${renderCells(result.RI[lvl].Total)}
                </tr>
              `).join('')}
              <!-- Total RI Row -->
              <tr style="background-color: #f1f5f9; font-weight: 800;">
                <td style="font-weight: 800; font-size: 11px; background: #f1f5f9; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Total RI</td>
                ${renderCells(result.RI.total.A)}
                ${renderCells(result.RI.total.B)}
                ${renderCells(result.RI.total.C)}
                ${renderCells(result.RI.total.D)}
                ${renderCells(result.RI.total.Total)}
              </tr>

              <!-- RAWAT JALAN -->
              ${levels.map((lvl, idx) => `
                <tr style="background-color: #ffffff;">
                  ${idx === 0 ? `<td rowspan="5" style="vertical-align: middle; font-weight: 700; font-size: 11.5px; background: #ffffff; border: 1px solid #cbd5e1; text-align: center; color: #1e293b; line-height: 1.2;">Rawat<br>Jalan</td>` : ''}
                  <td style="font-weight: 600; font-size: 11px; background: #fefce8; border: 1px solid #cbd5e1; text-align: center; color: #334155;">${levelLabels[lvl]}</td>
                  ${renderCells(result.RJ[lvl].A)}
                  ${renderCells(result.RJ[lvl].B)}
                  ${renderCells(result.RJ[lvl].C)}
                  ${renderCells(result.RJ[lvl].D)}
                  ${renderCells(result.RJ[lvl].Total)}
                </tr>
              `).join('')}
              <!-- Total RJ Row -->
              <tr style="background-color: #f1f5f9; font-weight: 800;">
                <td style="font-weight: 800; font-size: 11px; background: #f1f5f9; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Total RJ</td>
                ${renderCells(result.RJ.total.A)}
                ${renderCells(result.RJ.total.B)}
                ${renderCells(result.RJ.total.C)}
                ${renderCells(result.RJ.total.D)}
                ${renderCells(result.RJ.total.Total)}
              </tr>

              <!-- GRAND TOTAL -->
              <tr style="background-color: #e2e8f0; font-weight: 900;">
                <td colspan="2" style="font-weight: 900; font-size: 11.5px; background: #e2e8f0; border: 1px solid #cbd5e1; text-align: center; color: #0f172a; text-transform: uppercase;">Grand Total</td>
                ${renderCells(result.grand.A)}
                ${renderCells(result.grand.B)}
                ${renderCells(result.grand.C)}
                ${renderCells(result.grand.D)}
                ${renderCells(result.grand.Total)}
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Bottom Insight Card -->
        <div style="background: #e0f7f6; border: 1px solid #99f6e4; border-radius: 8px; padding: 8px 16px; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="font-size: 24px; background: #ccfbf1; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            💡
          </div>
          <div style="display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; color: #334155; line-height: 1.35;">
            <div>• Kenaikan <strong>Rawat Inap</strong> sebesar <span style="font-weight: 800; color: #0f766e;">${diffRI_M >= 1000 ? (diffRI_M/1000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' T' : diffRI_M.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' M'}</span> dengan persentase <span style="font-weight: 800; color: #0f766e;">${pctRI.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</span></div>
            <div>• Kenaikan <strong>Rawat Jalan</strong> sebesar <span style="font-weight: 800; color: #0f766e;">${diffRJ_M.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})} M</span> dengan persentase <span style="font-weight: 800; color: #0f766e;">${pctRJ.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</span></div>
            <div>• Kenaikan <strong>Total</strong> sebesar <span style="font-weight: 800; color: #0f766e;">${diffTotal_T.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})} T</span> dengan persentase <span style="font-weight: 800; color: #0f766e;">${pctTotal.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</span></div>
          </div>
        </div>

        <!-- Footnote & Logo -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; font-style: italic; margin-top: -2px;">
          <div>*Lainnya Adalah Kasus yang belum terdapat Mapping Kompetensi ICD</div>
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 13.5px; color: #0891b2; font-style: normal;">
            <img src="img/logo-kemenkes.png" alt="Kemenkes" style="height: 18px;">
            <span>Kemenkes</span>
          </div>
        </div>

      </div>
    `;

    container.innerHTML = html;
  }

  // --- META & SUB-NAV TABS FOR NATIONAL MIRRORING SLIDES ---
  const NATIONAL_SLIDES_META = [
    { title: "1. Jenis Rawat", offset: 0 },
    { title: "2. Spending Kelas RS", offset: 1 },
    { title: "3. 10 Besar Ranap", offset: 2 },
    { title: "4. Severity Ranap", offset: 3 },
    { title: "5. 10 Besar Rajal", offset: 4 },
    { title: "6. Q-5-44-0 Rajal", offset: 5 },
    { title: "7. Kompetensi ICD", offset: 6 }
  ];

  function renderNationalNavTabs(activeIndex) {
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 4px 8px; margin-bottom: 2px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);">
        <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 800; color: #475569; margin-right: 4px; text-transform: uppercase;">📊 Navigasi Data Mirroring:</span>
          ${NATIONAL_SLIDES_META.map((tab, idx) => `
            <button type="button" onclick="window.showNationalMirroringSlide(${tab.offset})" style="border: none; cursor: pointer; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 750; transition: all 0.15s; ${
              idx === activeIndex
                ? 'background: #0f766e; color: #ffffff; box-shadow: 0 2px 4px rgba(15,118,110,0.3);'
                : 'background: #ffffff; color: #334155; border: 1px solid #cbd5e1;'
            }">
              ${tab.title}
            </button>
          `).join('')}
        </div>
        <div class="national-export-actions" data-export-ui="true" style="display: flex; align-items: center; gap: 5px; flex-shrink: 0; margin-left: 8px;">
          <span style="font-size: 11px; font-weight: 800; color: #0f766e; background: #ccfbf1; padding: 3px 8px; border-radius: 6px; border: 1px solid #99f6e4; white-space: nowrap;">
            Slide ${activeIndex + 1} / 7
          </span>
          <button type="button" onclick="window.copyActiveNationalSlideImage(this)" title="Salin slide aktif sebagai gambar PNG" style="border: 1px solid #7dd3fc; background: #e0f2fe; color: #0369a1; cursor: pointer; padding: 4px 9px; border-radius: 6px; font-size: 10.5px; font-weight: 800; white-space: nowrap;">📋 Copy Image</button>
          <button type="button" onclick="window.exportActiveNationalSlideToPptx(this)" title="Ekspor slide aktif dengan DOM-to-PPTX" style="border: 1px solid #c4b5fd; background: #ede9fe; color: #5b21b6; cursor: pointer; padding: 4px 9px; border-radius: 6px; font-size: 10.5px; font-weight: 800; white-space: nowrap;">⬡ DOM → PPTX</button>
        </div>
      </div>
    `;
  }

  // --- SLIDE 11: JUMLAH DATA MASUK MENURUT JENIS RAWAT ---
  function renderNationalRawatTypeSlide() {
    const container = document.getElementById("nationalRawatTypeSlide");
    if (!container) return;

    const activeHospitals = getActiveMirroringHospitals();
    const metrics = computeNationalMirroringMetrics(activeHospitals);

    const isAll = activeHospitals.length >= (originalData.hospitals ? originalData.hospitals.length : 1000);
    const scopeTitle = isAll ? "Seluruh Rumah Sakit Nasional" : `${metrics.hospitalCount.toLocaleString('id-ID')} RS Terpilih / Terfilter`;

    const circumference = 502.65; // 2 * PI * 80
    const dashRajal = Math.max(0, Math.min(circumference, (metrics.pctRajal / 100) * circumference));
    const dashRanap = Math.max(0, Math.min(circumference, (metrics.pctRanap / 100) * circumference));

    const compactKasus = metrics.totalKasus >= 1e6 ? `${(metrics.totalKasus / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Jt` : formatNumber(metrics.totalKasus);

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between; gap: 10px; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; box-sizing: border-box;">
        <!-- Top Sub-Navigation Tabs for National Mirroring -->
        ${renderNationalNavTabs(0)}

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="color: #d97706; font-size: 19px; font-weight: 800; letter-spacing: -0.2px;">
            Data Klaim iDRG Menurut Jenis Perawatan
          </div>
          <div style="font-size: 11.5px; font-weight: 800; color: #0f766e; background: #ccfbf1; padding: 4px 12px; border-radius: 20px; border: 1.5px solid #99f6e4; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            🎯 Cakupan: ${scopeTitle} (${metrics.provCount} Prov, ${metrics.cityCount} Kota)
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 480px 1fr; gap: 20px; align-items: stretch; flex: 1 1 auto; min-height: 0;">
          <!-- Left: Big High-Clarity Donut Chart with Direct Percentage Labels -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 18px; padding: 16px 20px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.03);">
            <!-- Graphic Container with Callout Labels -->
            <div style="position: relative; width: 260px; height: 260px; display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 240 240" style="width: 100%; height: 100%; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.07));">
                <!-- Background Circle -->
                <circle cx="120" cy="120" r="80" fill="transparent" stroke="#f1f5f9" stroke-width="36" />
                <!-- Rawat Jalan Segment (Rotated from -90deg) -->
                <g transform="rotate(-90 120 120)">
                  <circle cx="120" cy="120" r="80" fill="transparent" stroke="#0d9488" stroke-width="34" stroke-dasharray="${dashRajal} ${circumference}" stroke-dashoffset="0" stroke-linecap="round" />
                  <circle cx="120" cy="120" r="80" fill="transparent" stroke="#f59e0b" stroke-width="34" stroke-dasharray="${dashRanap} ${circumference}" stroke-dashoffset="-${dashRajal}" stroke-linecap="round" />
                </g>
                <!-- Central Disc -->
                <circle cx="120" cy="120" r="58" fill="#ffffff" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.06))" />
                <text x="120" y="102" text-anchor="middle" font-size="10.5" font-weight="800" fill="#64748b" letter-spacing="0.5">TOTAL KASUS</text>
                <text x="120" y="125" text-anchor="middle" font-size="18" font-weight="900" fill="#0f172a" font-family="'Plus Jakarta Sans', sans-serif">${compactKasus}</text>
                <text x="120" y="142" text-anchor="middle" font-size="11" font-weight="800" fill="#0f766e">${metrics.hospitalCount.toLocaleString('id-ID')} RS</text>
              </svg>

              <!-- Floating Percentage Badge 1: Rawat Jalan -->
              <div style="position: absolute; top: 10px; right: 4px; background: #0f766e; color: #ffffff; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 900; box-shadow: 0 2px 8px rgba(15,118,110,0.35); border: 2px solid #ffffff; display: flex; align-items: center; gap: 5px;">
                <span>🚶 Rajal:</span>
                <span style="color: #99f6e4;">${metrics.pctRajal.toFixed(2).replace('.', ',')}%</span>
              </div>

              <!-- Floating Percentage Badge 2: Rawat Inap -->
              <div style="position: absolute; bottom: 10px; left: 4px; background: #d97706; color: #ffffff; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 900; box-shadow: 0 2px 8px rgba(217,119,6,0.35); border: 2px solid #ffffff; display: flex; align-items: center; gap: 5px;">
                <span>🛏️ Ranap:</span>
                <span style="color: #fef08a;">${metrics.pctRanap.toFixed(2).replace('.', ',')}%</span>
              </div>
            </div>

            <!-- Detail Cards Ditempatkan DI BAWAH Grafik -->
            <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
              <div style="background: #f0fdfa; border: 1.5px solid #99f6e4; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="width: 16px; height: 16px; background: #0d9488; border-radius: 4px; flex-shrink: 0; box-shadow: 0 1px 3px rgba(13,148,136,0.4);"></span>
                  <div>
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a;">Rawat Jalan (RJ)</div>
                    <div style="font-size: 11px; font-weight: 600; color: #64748b;">${formatNumber(metrics.rjCases)} Kasus</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 17px; font-weight: 900; color: #0f766e;">${metrics.pctRajal.toFixed(2).replace('.', ',')}%</div>
                  <div style="font-size: 11px; font-weight: 700; color: #0d9488;">iDRG: ${formatTableMoney(metrics.result.RJ.total.Total[2])}</div>
                </div>
              </div>

              <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="width: 16px; height: 16px; background: #f59e0b; border-radius: 4px; flex-shrink: 0; box-shadow: 0 1px 3px rgba(245,158,11,0.4);"></span>
                  <div>
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a;">Rawat Inap (RI)</div>
                    <div style="font-size: 11px; font-weight: 600; color: #64748b;">${formatNumber(metrics.riCases)} Kasus</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 17px; font-weight: 900; color: #b45309;">${metrics.pctRanap.toFixed(2).replace('.', ',')}%</div>
                  <div style="font-size: 11px; font-weight: 700; color: #d97706;">iDRG: ${formatTableMoney(metrics.result.RI.total.Total[2])}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Key Macro Numbers & Summary Cards -->
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 18px; padding: 20px 24px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
            <div style="font-size: 13px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px;">
              📊 Rangkuman Agregasi Data Masuk
            </div>
            
            <div style="display: grid; grid-template-columns: 190px 1fr; font-size: 14.5px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              <div>Jumlah Kasus</div>
              <div style="color: #0f172a; font-weight: 900;">: ${formatNumber(metrics.totalKasus)} Kasus</div>
            </div>
            <div style="display: grid; grid-template-columns: 190px 1fr; font-size: 14.5px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              <div>Jumlah Rumah Sakit</div>
              <div style="color: #0f172a; font-weight: 900;">: ${metrics.hospitalCount.toLocaleString('id-ID')} Rumah Sakit</div>
            </div>
            <div style="display: grid; grid-template-columns: 190px 1fr; font-size: 14.5px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              <div>Jumlah Provinsi</div>
              <div style="color: #0f172a; font-weight: 900;">: ${metrics.provCount} Provinsi</div>
            </div>
            <div style="display: grid; grid-template-columns: 190px 1fr; font-size: 14.5px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              <div>Jumlah Kab/Kota</div>
              <div style="color: #0f172a; font-weight: 900;">: ${metrics.cityCount} Kab/Kota</div>
            </div>
            <div style="display: grid; grid-template-columns: 190px 1fr; font-size: 14.5px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              <div>Total INA-CBG</div>
              <div style="color: #15803d; font-weight: 900;">: ${formatTableMoney(metrics.totalIna)}</div>
            </div>
            <div style="display: grid; grid-template-columns: 190px 1fr; font-size: 14.5px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              <div>Total Spending iDRG</div>
              <div style="color: #0284c7; font-weight: 900;">: ${formatTableMoney(metrics.totalIdrg)}</div>
            </div>
            <div style="display: grid; grid-template-columns: 190px 1fr; font-size: 14.5px; font-weight: 700; color: #334155;">
              <div>Pertumbuhan Net iDRG</div>
              <div style="color: ${metrics.diffTotal_T >= 0 ? '#047857' : '#dc2626'}; font-weight: 900;">: ${metrics.diffTotal_T >= 0 ? '+' : ''}${formatTableMoney(metrics.totalIdrg - metrics.totalIna)} (${metrics.pctTotal >= 0 ? '+' : ''}${metrics.pctTotal.toFixed(2).replace('.', ',')}%)</div>
            </div>
          </div>
        </div>

        <!-- Footer / Keterangan di Bawah Halaman -->
        <div style="display: flex; justify-content: space-between; align-items: center; color: #64748b; font-size: 11.5px; font-weight: 600; padding: 6px 14px; background: #f1f5f9; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div><strong>Keterangan:</strong> Agregasi data klaim realisasi Eklaim &amp; Uji Coba iDRG secara dinamis untuk fasilitas kesehatan yang aktif.</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="img/logo-kemenkes.png" alt="Kemenkes Logo" style="height: 18px;">
            <span style="font-weight: 700; color: #0891b2;">Kementerian Kesehatan RI</span>
          </div>
        </div>
      </div>
    `;
  }

  // --- SLIDE 12: SIMULASI SPENDING iDRG NASIONAL MENURUT KELAS RS ---
  function renderNationalSpendingClassSlide() {
    const container = document.getElementById("nationalSpendingClassSlide");
    if (!container) return;

    const activeHospitals = getActiveMirroringHospitals();
    const metrics = computeNationalMirroringMetrics(activeHospitals);

    const isAll = activeHospitals.length >= (originalData.hospitals ? originalData.hospitals.length : 1000);
    const scopeBadge = isAll ? "Seluruh RS Nasional (Agregat Penuh)" : `${metrics.hospitalCount.toLocaleString('id-ID')} RS Terpilih / Terfilter`;

    const ri = metrics.result.RI.total;
    const rj = metrics.result.RJ.total;
    const gr = metrics.result.grand;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between; gap: 8px; font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box;">
        <!-- Top Sub-Navigation Tabs for National Mirroring -->
        ${renderNationalNavTabs(1)}

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="color: #d97706; font-size: 18px; font-weight: 800;">
            Simulasi Spending iDRG Menurut Kelas Rumah Sakit
          </div>
          <div style="font-size: 11px; font-weight: 800; color: #0f766e; background: #ccfbf1; padding: 3px 10px; border-radius: 12px; border: 1px solid #99f6e4;">
            🎯 Cakupan: ${scopeBadge}
          </div>
        </div>

        <!-- Top KPI Headline Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 8px 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
            <div style="font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">Total Kasus</div>
            <div style="font-size: 17px; font-weight: 900; color: #0f172a; margin-top: 2px;">${formatNumber(metrics.totalKasus)}</div>
            <div style="font-size: 10px; font-weight: 600; color: #0f766e;">Ranap: ${(metrics.riCases/1e6).toFixed(2)} Jt · Rajal: ${(metrics.rjCases/1e6).toFixed(2)} Jt</div>
          </div>

          <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 8px 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
            <div style="font-size: 10.5px; font-weight: 800; color: #166534; text-transform: uppercase;">Spending INA-CBG</div>
            <div style="font-size: 17px; font-weight: 900; color: #15803d; margin-top: 2px;">${formatTableMoney(metrics.totalIna)}</div>
            <div style="font-size: 10px; font-weight: 600; color: #166534;">Ranap: ${formatTableMoney(ri.Total[1])} · Rajal: ${formatTableMoney(rj.Total[1])}</div>
          </div>

          <div style="background: #fefce8; border: 1.5px solid #fde047; border-radius: 12px; padding: 8px 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
            <div style="font-size: 10.5px; font-weight: 800; color: #854d0e; text-transform: uppercase;">Potensi Spending iDRG</div>
            <div style="font-size: 17px; font-weight: 900; color: #b45309; margin-top: 2px;">${formatTableMoney(metrics.totalIdrg)}</div>
            <div style="font-size: 10px; font-weight: 600; color: #854d0e;">Ranap: ${formatTableMoney(ri.Total[2])} · Rajal: ${formatTableMoney(rj.Total[2])}</div>
          </div>

          <div style="background: linear-gradient(135deg, #042f2e 0%, #0f766e 100%); color: white; border-radius: 12px; padding: 8px 12px; box-shadow: 0 4px 10px rgba(15,118,110,0.25);">
            <div style="font-size: 10.5px; font-weight: 800; color: #99f6e4; text-transform: uppercase;">Net Pertumbuhan iDRG</div>
            <div style="font-size: 17px; font-weight: 900; color: #fef08a; margin-top: 2px;">${metrics.diffTotal_T >= 0 ? '+' : ''}${formatTableMoney(metrics.totalIdrg - metrics.totalIna)}</div>
            <div style="font-size: 10px; font-weight: 700; color: #86efac;">${metrics.pctTotal >= 0 ? '+' : ''}${metrics.pctTotal.toFixed(2).replace('.', ',')}% vs INA-CBG</div>
          </div>
        </div>

        <!-- Master Table -->
        <div style="flex: 1 1 auto; overflow: auto; border: 1.5px solid #cbd5e1; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); background: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11.5px; font-family: inherit;">
            <thead>
              <tr style="background: #0f766e; color: #ffffff; font-weight: 800; text-align: center; text-transform: uppercase; font-size: 11px;">
                <th rowspan="2" style="padding: 7px 6px; border: 1px solid #0d9488; vertical-align: middle; width: 85px;">Jenis Layanan</th>
                <th rowspan="2" style="padding: 7px 6px; border: 1px solid #0d9488; vertical-align: middle; min-width: 135px;">Kategori Spending</th>
                <th colspan="2" style="padding: 5px 4px; border: 1px solid #0d9488; background: #115e59;">Total Seluruhnya</th>
                <th colspan="5" style="padding: 5px 4px; border: 1px solid #0d9488; background: #0369a1;">Spending menurut Kelas RS (Rp. M)</th>
                <th colspan="5" style="padding: 5px 4px; border: 1px solid #0d9488; background: #d97706;">Kenaikan / Penurunan iDRG (%)</th>
                <th rowspan="2" style="padding: 7px 8px; border: 1px solid #0d9488; vertical-align: middle; min-width: 150px;">Keterangan</th>
              </tr>
              <tr style="background: #134e4a; color: #ffffff; font-weight: 700; text-align: center; font-size: 10.5px;">
                <!-- Total Seluruhnya -->
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #0f766e; min-width: 80px;">Total Kasus</th>
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #0f766e; min-width: 90px;">Total Spending</th>
                <!-- Spending Kelas -->
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #0284c7; min-width: 70px;">RS A</th>
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #0284c7; min-width: 70px;">RS B</th>
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #0284c7; min-width: 70px;">RS C</th>
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #0284c7; min-width: 65px;">RS D</th>
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #0369a1; min-width: 80px;">Total</th>
                <!-- % Kenaikan -->
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #f59e0b; min-width: 62px;">RS A</th>
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #f59e0b; min-width: 62px;">RS B</th>
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #f59e0b; min-width: 62px;">RS C</th>
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #f59e0b; min-width: 62px;">RS D</th>
                <th style="padding: 5px 6px; border: 1px solid #0d9488; background: #d97706; min-width: 70px;">Total</th>
              </tr>
            </thead>
            <tbody>
              <!-- SECTION 1: RAWAT INAP -->
              <tr style="background: #ffffff; border-bottom: 1px solid #cbd5e1;">
                <td rowspan="2" style="padding: 7px 8px; font-weight: 800; color: #0369a1; border-right: 1.5px solid #cbd5e1; vertical-align: middle; background: #f0f9ff; text-align: center;">
                  Rawat Inap
                </td>
                <td style="padding: 6px 8px; font-weight: 700; color: #334155; border-right: 1px solid #e2e8f0;">
                  Spending Ranap INA-CBG
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0; font-variant-numeric: tabular-nums;">
                  ${formatNumber(metrics.riCases)}
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 700; color: #0f172a; border-right: 1.5px solid #cbd5e1; font-variant-numeric: tabular-nums;">
                  ${formatTableMoney(ri.Total[1])}
                </td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(ri.A[1])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(ri.B[1])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(ri.C[1])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(ri.D[1])}</td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 700; background: #f8fafc; border-right: 1.5px solid #cbd5e1;">${formatTableMoney(ri.Total[1])}</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; font-weight: 700; background: #f8fafc; border-right: 1.5px solid #cbd5e1;">—</td>
                <td style="padding: 6px 8px; font-size: 10.5px; color: #64748b;">Baseline Tarif INA-CBG Realisasi</td>
              </tr>
              <tr style="background: #f0fdfa; border-bottom: 2px solid #94a3b8;">
                <td style="padding: 6px 8px; font-weight: 800; color: #0f766e; border-right: 1px solid #e2e8f0;">
                  Spending Ranap iDRG
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 800; color: #0f766e; border-right: 1px solid #e2e8f0; font-variant-numeric: tabular-nums;">
                  ${formatNumber(metrics.riCases)}
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 800; color: #0f766e; border-right: 1.5px solid #cbd5e1; font-variant-numeric: tabular-nums;">
                  ${formatTableMoney(ri.Total[2])}
                </td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(ri.A[2])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(ri.B[2])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(ri.C[2])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(ri.D[2])}</td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 800; background: #e6fffa; border-right: 1.5px solid #cbd5e1; color: #0f766e;">${formatTableMoney(ri.Total[2])}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 750; color: ${ri.A[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(ri.A[4])}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 750; color: ${ri.B[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(ri.B[4])}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 750; color: ${ri.C[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(ri.C[4])}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 750; color: ${ri.D[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(ri.D[4])}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 900; color: ${ri.Total[4] >= 0 ? '#047857' : '#dc2626'}; background: #d1fae5; border-right: 1.5px solid #cbd5e1;">${formatTablePct(ri.Total[4])}</td>
                <td style="padding: 6px 8px; font-size: 10.5px; font-weight: 700; color: ${ri.Total[4] >= 0 ? '#047857' : '#dc2626'};">Kenaikan Ranap ${formatTablePct(ri.Total[4])}</td>
              </tr>

              <!-- SECTION 2: RAWAT JALAN -->
              <tr style="background: #ffffff; border-bottom: 1px solid #cbd5e1;">
                <td rowspan="2" style="padding: 7px 8px; font-weight: 800; color: #b45309; border-right: 1.5px solid #cbd5e1; vertical-align: middle; background: #fffbeb; text-align: center;">
                  Rawat Jalan
                </td>
                <td style="padding: 6px 8px; font-weight: 700; color: #334155; border-right: 1px solid #e2e8f0;">
                  Spending Rajal INA-CBG
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0; font-variant-numeric: tabular-nums;">
                  ${formatNumber(metrics.rjCases)}
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 700; color: #0f172a; border-right: 1.5px solid #cbd5e1; font-variant-numeric: tabular-nums;">
                  ${formatTableMoney(rj.Total[1])}
                </td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(rj.A[1])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(rj.B[1])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(rj.C[1])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(rj.D[1])}</td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 700; background: #f8fafc; border-right: 1.5px solid #cbd5e1;">${formatTableMoney(rj.Total[1])}</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; font-weight: 700; background: #f8fafc; border-right: 1.5px solid #cbd5e1;">—</td>
                <td style="padding: 6px 8px; font-size: 10.5px; color: #64748b;">Baseline Tarif INA-CBG Realisasi</td>
              </tr>
              <tr style="background: #fffbeb; border-bottom: 2px solid #94a3b8;">
                <td style="padding: 6px 8px; font-weight: 800; color: #b45309; border-right: 1px solid #e2e8f0;">
                  Spending Rajal iDRG
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 800; color: #b45309; border-right: 1px solid #e2e8f0; font-variant-numeric: tabular-nums;">
                  ${formatNumber(metrics.rjCases)}
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 800; color: #b45309; border-right: 1.5px solid #cbd5e1; font-variant-numeric: tabular-nums;">
                  ${formatTableMoney(rj.Total[2])}
                </td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(rj.A[2])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(rj.B[2])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(rj.C[2])}</td>
                <td style="padding: 6px 7px; text-align: right; border-right: 1px solid #e2e8f0;">${formatTableMoney(rj.D[2])}</td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 800; background: #fef3c7; border-right: 1.5px solid #cbd5e1; color: #b45309;">${formatTableMoney(rj.Total[2])}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 750; color: ${rj.A[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(rj.A[4])}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 750; color: ${rj.B[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(rj.B[4])}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 750; color: ${rj.C[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(rj.C[4])}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 750; color: ${rj.D[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(rj.D[4])}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: 900; color: ${rj.Total[4] >= 0 ? '#b45309' : '#dc2626'}; background: #fde68a; border-right: 1.5px solid #cbd5e1;">${formatTablePct(rj.Total[4])}</td>
                <td style="padding: 6px 8px; font-size: 10.5px; font-weight: 700; color: #b45309;">Kenaikan Rajal ${formatTablePct(rj.Total[4])}</td>
              </tr>

              <!-- SECTION 3: GRAND TOTAL -->
              <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
                <td rowspan="2" style="padding: 7px 8px; font-weight: 900; color: #0f172a; border-right: 1.5px solid #cbd5e1; vertical-align: middle; background: #e2e8f0; text-align: center; text-transform: uppercase;">
                  Total
                </td>
                <td style="padding: 6px 8px; font-weight: 800; color: #1e293b; border-right: 1px solid #e2e8f0;">
                  Spending INA-CBG
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 800; color: #0f172a; border-right: 1px solid #e2e8f0; font-variant-numeric: tabular-nums;">
                  ${formatNumber(metrics.totalKasus)}
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 800; color: #0f172a; border-right: 1.5px solid #cbd5e1; font-variant-numeric: tabular-nums;">
                  ${formatTableMoney(gr.Total[1])}
                </td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 700; border-right: 1px solid #e2e8f0;">${formatTableMoney(gr.A[1])}</td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 700; border-right: 1px solid #e2e8f0;">${formatTableMoney(gr.B[1])}</td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 700; border-right: 1px solid #e2e8f0;">${formatTableMoney(gr.C[1])}</td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 700; border-right: 1px solid #e2e8f0;">${formatTableMoney(gr.D[1])}</td>
                <td style="padding: 6px 7px; text-align: right; font-weight: 850; background: #e2e8f0; border-right: 1.5px solid #cbd5e1;">${formatTableMoney(gr.Total[1])}</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; border-right: 1px solid #e2e8f0;">—</td>
                <td style="padding: 6px 4px; text-align: center; color: #94a3b8; font-weight: 800; background: #e2e8f0; border-right: 1.5px solid #cbd5e1;">—</td>
                <td style="padding: 6px 8px; font-size: 10.5px; font-weight: 600; color: #475569;">Total Spending INA-CBG Eksisting</td>
              </tr>
              <tr style="background: #e6fffa; border-bottom: 2px solid #0f766e;">
                <td style="padding: 7px 8px; font-weight: 900; color: #042f2e; border-right: 1px solid #e2e8f0;">
                  Spending iDRG
                </td>
                <td style="padding: 7px 7px; text-align: right; font-weight: 900; color: #042f2e; border-right: 1px solid #e2e8f0; font-variant-numeric: tabular-nums;">
                  ${formatNumber(metrics.totalKasus)}
                </td>
                <td style="padding: 7px 7px; text-align: right; font-weight: 900; color: #042f2e; border-right: 1.5px solid #cbd5e1; font-variant-numeric: tabular-nums; background: #ccfbf1;">
                  ${formatTableMoney(gr.Total[2])}
                </td>
                <td style="padding: 7px 7px; text-align: right; font-weight: 800; border-right: 1px solid #e2e8f0;">${formatTableMoney(gr.A[2])}</td>
                <td style="padding: 7px 7px; text-align: right; font-weight: 800; border-right: 1px solid #e2e8f0;">${formatTableMoney(gr.B[2])}</td>
                <td style="padding: 7px 7px; text-align: right; font-weight: 800; border-right: 1px solid #e2e8f0;">${formatTableMoney(gr.C[2])}</td>
                <td style="padding: 7px 7px; text-align: right; font-weight: 800; border-right: 1px solid #e2e8f0;">${formatTableMoney(gr.D[2])}</td>
                <td style="padding: 7px 7px; text-align: right; font-weight: 900; background: #99f6e4; border-right: 1.5px solid #cbd5e1; color: #042f2e;">${formatTableMoney(gr.Total[2])}</td>
                <td style="padding: 7px 4px; text-align: right; font-weight: 850; color: ${gr.A[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(gr.A[4])}</td>
                <td style="padding: 7px 4px; text-align: right; font-weight: 850; color: ${gr.B[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(gr.B[4])}</td>
                <td style="padding: 7px 4px; text-align: right; font-weight: 850; color: ${gr.C[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(gr.C[4])}</td>
                <td style="padding: 7px 4px; text-align: right; font-weight: 850; color: ${gr.D[4] >= 0 ? '#16a34a' : '#dc2626'}; border-right: 1px solid #e2e8f0;">${formatTablePct(gr.D[4])}</td>
                <td style="padding: 7px 4px; text-align: right; font-weight: 950; color: ${gr.Total[4] >= 0 ? '#065f46' : '#dc2626'}; background: #6ee7b7; border-right: 1.5px solid #cbd5e1; font-size: 11.5px;">${formatTablePct(gr.Total[4])}</td>
                <td style="padding: 7px 8px; font-size: 11px; font-weight: 800; color: ${gr.Total[4] >= 0 ? '#065f46' : '#dc2626'};">Total Kenaikan ${formatTablePct(gr.Total[4])}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Keterangan & Insight di Bawah Tabel -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #334155; padding: 6px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div>
            <strong>Insight Distribusi:</strong> Pada skema iDRG, efisiensi dan pertumbuhan anggaran terdistribusi secara dinamis untuk ${metrics.hospitalCount.toLocaleString('id-ID')} Rumah Sakit yang aktif (${metrics.provCount} Provinsi).
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: #0891b2; white-space: nowrap; margin-left: 12px;">
            <img src="img/logo-kemenkes.png" alt="Logo" style="height: 18px;">
            <span>Kemenkes</span>
          </div>
        </div>
      </div>
    `;
  }

  // --- SLIDE 13: DATA MASUK RAWAT INAP (10 BESAR CMG & MDC) & SPENDING NASIONAL ---
  function renderNationalRawatInapSlide() {
    const container = document.getElementById("nationalRawatInapSlide");
    if (!container) return;

    const activeHospitals = getActiveMirroringHospitals();
    const metrics = computeNationalMirroringMetrics(activeHospitals);

    const cmgData = [
      { name: "Respiratory system (J)", pct: 13.87 },
      { name: "Digestive system (K)", pct: 13.59 },
      { name: "Deliveries (O)", pct: 9.89 },
      { name: "Infectious & parasitic diseases (A)", pct: 9.02 },
      { name: "Cardiovascular system (I)", pct: 7.56 },
      { name: "Central nervous system (G)", pct: 6.71 },
      { name: "Nephro-urinary system (N)", pct: 6.09 },
      { name: "Musculoskeletal system & connect. (M)", pct: 5.71 },
      { name: "Female reproductive system (W)", pct: 5.19 },
      { name: "Ear, nose, mouth & throat (U)", pct: 4.81 }
    ];

    const mdcData = [
      { name: "Pregnancy, Childbirth and Puerperium (24)", pct: 13.58 },
      { name: "Diseases of Digestive System (16)", pct: 13.34 },
      { name: "Diseases of Respiratory System (14)", pct: 12.89 },
      { name: "Infectious & Parasitic Diseases (28)", pct: 9.13 },
      { name: "Diseases of Circulatory System (15)", pct: 8.11 },
      { name: "Diseases of Nervous System (11)", pct: 6.81 },
      { name: "Diseases of Kidney & Urinary Tract (21)", pct: 5.69 },
      { name: "Diseases of Musculoskeletal System (18)", pct: 5.59 },
      { name: "Diseases of Ear, Nose, Mouth & Throat (13)", pct: 4.85 },
      { name: "Diseases of Skin & Subcutaneous (19)", pct: 2.89 }
    ];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between; gap: 8px; font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box;">
        <!-- Top Sub-Navigation Tabs for National Mirroring -->
        ${renderNationalNavTabs(2)}

        <!-- Header & Macro Spending Summary Banner -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="color: #d97706; font-size: 17px; font-weight: 800; display: flex; justify-content: space-between; align-items: center;">
            <span>10 Besar Kasus Rawat Inap: INA-CBG (CMG) vs iDRG (MDC)</span>
            <span style="font-size: 11px; font-weight: 700; color: #0f766e; background: #ccfbf1; padding: 2px 10px; border-radius: 12px; border: 1px solid #99f6e4;">🎯 ${metrics.hospitalCount.toLocaleString('id-ID')} RS Aktif</span>
          </div>

          <!-- KPI Banner: Perbandingan Simulasi Spending iDRG Nasional -->
          <div style="background: linear-gradient(135deg, #042f2e 0%, #0f766e 100%); color: #ffffff; border-radius: 12px; padding: 8px 14px; box-shadow: 0 3px 10px rgba(15,118,110,0.2);">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #99f6e4; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
              <span>📊 Perbandingan Simulasi Spending iDRG Aktif</span>
              <span style="font-size: 10px; font-weight: 600; color: #e2e8f0;">${metrics.hospitalCount.toLocaleString('id-ID')} RS (${metrics.provCount} Prov)</span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
              <!-- Total Kasus -->
              <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 4px 8px; text-align: center;">
                <div style="font-size: 9.5px; font-weight: 700; color: #ccfbf1; text-transform: uppercase;">Total Kasus</div>
                <div style="font-size: 13.5px; font-weight: 900; color: #ffffff; margin-top: 1px; font-variant-numeric: tabular-nums;">${formatNumber(metrics.totalKasus)}</div>
              </div>

              <!-- INA CBG Total -->
              <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 4px 8px; text-align: center;">
                <div style="font-size: 9.5px; font-weight: 700; color: #fed7aa; text-transform: uppercase;">Spending INA-CBG</div>
                <div style="font-size: 13.5px; font-weight: 900; color: #ffffff; margin-top: 1px; font-variant-numeric: tabular-nums;">${formatTableMoney(metrics.totalIna)}</div>
              </div>

              <!-- iDRG Total -->
              <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 4px 8px; text-align: center;">
                <div style="font-size: 9.5px; font-weight: 700; color: #fef08a; text-transform: uppercase;">Spending iDRG</div>
                <div style="font-size: 13.5px; font-weight: 900; color: #ffffff; margin-top: 1px; font-variant-numeric: tabular-nums;">${formatTableMoney(metrics.totalIdrg)}</div>
              </div>

              <!-- Selisih Nominal -->
              <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 4px 8px; text-align: center;">
                <div style="font-size: 9.5px; font-weight: 700; color: #bbf7d0; text-transform: uppercase;">Selisih (Net Growth)</div>
                <div style="font-size: 13.5px; font-weight: 900; color: #4ade80; margin-top: 1px; font-variant-numeric: tabular-nums;">${metrics.diffTotal_T >= 0 ? '+' : ''}${formatTableMoney(metrics.totalIdrg - metrics.totalIna)}</div>
              </div>

              <!-- % Kenaikan -->
              <div style="background: rgba(34, 197, 94, 0.22); border: 1px solid rgba(74, 222, 128, 0.4); border-radius: 8px; padding: 4px 8px; text-align: center;">
                <div style="font-size: 9.5px; font-weight: 700; color: #86efac; text-transform: uppercase;">% Pertumbuhan</div>
                <div style="font-size: 13.5px; font-weight: 900; color: #fef08a; margin-top: 1px; font-variant-numeric: tabular-nums;">${metrics.pctTotal >= 0 ? '+' : ''}${metrics.pctTotal.toFixed(2).replace('.', ',')}%</div>
              </div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex: 1 1 auto; min-height: 0;">
          <!-- Left: Kelompok CMG -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 8px 12px; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 12px; text-align: center; padding: 4px; border-radius: 6px; margin-bottom: 6px; border: 1px solid #bae6fd;">
              Kelompok CMG (INA-CBG)
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; justify-content: space-between;">
              ${cmgData.map(d => `
                <div style="display: flex; flex-direction: column; gap: 1px;">
                  <div style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; color: #334155;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;" title="${d.name}">${d.name}</span>
                    <span style="color: #0f766e; font-weight: 850;">${d.pct.toFixed(2).replace('.', ',')}%</span>
                  </div>
                  <div style="background: #e2e8f0; border-radius: 3px; height: 7px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #14b8a6, #0d9488); height: 100%; width: ${(d.pct / 16) * 100}%; border-radius: 3px;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Right: Kelompok MDC -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 8px 12px; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="background: #fef3c7; color: #92400e; font-weight: 800; font-size: 12px; text-align: center; padding: 4px; border-radius: 6px; margin-bottom: 6px; border: 1px solid #fde68a;">
              Kelompok MDC (iDRG)
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; justify-content: space-between;">
              ${mdcData.map(d => `
                <div style="display: flex; flex-direction: column; gap: 1px;">
                  <div style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; color: #334155;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;" title="${d.name}">${d.name}</span>
                    <span style="color: #b45309; font-weight: 850;">${d.pct.toFixed(2).replace('.', ',')}%</span>
                  </div>
                  <div style="background: #e2e8f0; border-radius: 3px; height: 7px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #f59e0b, #d97706); height: 100%; width: ${(d.pct / 16) * 100}%; border-radius: 3px;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Keterangan di Bawah Grafik -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #334155; padding: 4px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div><strong>Keterangan:</strong> <strong>CMG</strong> = Case Main Group (INA-CBG) · <strong>MDC</strong> = Major Diagnostic Category (iDRG).</div>
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: #0891b2;">
            <img src="img/logo-kemenkes.png" alt="Logo" style="height: 16px;">
            <span>Kemenkes</span>
          </div>
        </div>
      </div>
    `;
  }

  // --- SLIDE 14: PERBANDINGAN TINGKAT KEPARAHAN RAWAT INAP ---
  function renderNationalSeveritySlide() {
    const container = document.getElementById("nationalSeveritySlide");
    if (!container) return;

    const activeHospitals = getActiveMirroringHospitals();
    const metrics = computeNationalMirroringMetrics(activeHospitals);

    const sl1 = (metrics.base.A[1][0] + metrics.base.B[1][0] + metrics.base.C[1][0] + metrics.base.D[1][0]) * 0.055;
    const sl2 = (metrics.base.A[2][0] + metrics.base.B[2][0] + metrics.base.C[2][0] + metrics.base.D[2][0]) * 0.175;
    const sl3 = (metrics.base.A[3][0] + metrics.base.B[3][0] + metrics.base.C[3][0] + metrics.base.D[3][0]) * 0.17 + (metrics.base.A[4][0] + metrics.base.B[4][0] + metrics.base.C[4][0] + metrics.base.D[4][0]) * 0.08;
    const slTotal = Math.round(sl1 + sl2 + sl3) || metrics.riCases;

    const cl0 = Math.round(slTotal * 0.5614);
    const cl1 = Math.round(slTotal * 0.1392);
    const cl2 = Math.round(slTotal * 0.1931);
    const cl3 = Math.round(slTotal * 0.0988);
    const cl9 = Math.max(0, slTotal - (cl0 + cl1 + cl2 + cl3));

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between; gap: 10px; font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box;">
        <!-- Top Sub-Navigation Tabs for National Mirroring -->
        ${renderNationalNavTabs(3)}

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="color: #d97706; font-size: 18px; font-weight: 800;">
            Perbandingan Distribusi Tingkat Keparahan / Kompleksitas Kasus Rawat Inap
          </div>
          <div style="font-size: 11px; font-weight: 800; color: #0f766e; background: #ccfbf1; padding: 3px 10px; border-radius: 12px; border: 1px solid #99f6e4;">
            🎯 ${metrics.hospitalCount.toLocaleString('id-ID')} RS Aktif (${formatNumber(slTotal)} Kasus Ranap)
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; flex: 1 1 auto; min-height: 0;">
          <!-- Left Table: INA CBGs Severity -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 14px; text-align: center; padding: 7px; border-radius: 8px; border: 1px solid #bae6fd;">
              Tabel Severity Level (INA-CBG)
            </div>
            <div style="border-radius: 12px; overflow: hidden; border: 1.5px solid #cbd5e1; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                <thead>
                  <tr style="background: #0284c7; color: #ffffff; font-weight: 800; text-transform: uppercase;">
                    <th style="padding: 12px 16px; border-right: 1px solid rgba(255,255,255,0.2);">Severity Level</th>
                    <th style="padding: 12px 16px; text-align: right;">Jumlah Kasus</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">
                    <td style="padding: 12px 16px; border-right: 1px solid #e2e8f0;">SL I - Ringan</td>
                    <td style="padding: 12px 16px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(Math.round(sl1))}</td>
                  </tr>
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">
                    <td style="padding: 12px 16px; border-right: 1px solid #e2e8f0;">SL II - Sedang</td>
                    <td style="padding: 12px 16px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(Math.round(sl2))}</td>
                  </tr>
                  <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">
                    <td style="padding: 12px 16px; border-right: 1px solid #e2e8f0;">SL III - Berat</td>
                    <td style="padding: 12px 16px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(Math.round(sl3))}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style="background: #f1f5f9; font-weight: 900; font-size: 15px; color: #0f172a;">
                    <td style="padding: 12px 16px; text-align: center; border-right: 1px solid #e2e8f0;">Total</td>
                    <td style="padding: 12px 16px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(slTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Right Table: iDRG Complexity -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="background: #fef3c7; color: #92400e; font-weight: 800; font-size: 14px; text-align: center; padding: 7px; border-radius: 8px; border: 1px solid #fde68a;">
              Tabel Complexity Level (iDRG)
            </div>
            <div style="border-radius: 12px; overflow: hidden; border: 1.5px solid #cbd5e1; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px;">
                <thead>
                  <tr style="background: #c2410c; color: #ffffff; font-weight: 800; text-transform: uppercase;">
                    <th style="padding: 10px 16px; border-right: 1px solid rgba(255,255,255,0.2);">Complexity Level</th>
                    <th style="padding: 10px 16px; text-align: right;">Jumlah Kasus</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">
                    <td style="padding: 8px 16px; border-right: 1px solid #e2e8f0;">CL 0 - No CC</td>
                    <td style="padding: 8px 16px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(cl0)}</td>
                  </tr>
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">
                    <td style="padding: 8px 16px; border-right: 1px solid #e2e8f0;">CL 1 - Mild CC</td>
                    <td style="padding: 8px 16px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(cl1)}</td>
                  </tr>
                  <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">
                    <td style="padding: 8px 16px; border-right: 1px solid #e2e8f0;">CL 2 - Moderate CC</td>
                    <td style="padding: 8px 16px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(cl2)}</td>
                  </tr>
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">
                    <td style="padding: 8px 16px; border-right: 1px solid #e2e8f0;">CL 3 - Severe CC</td>
                    <td style="padding: 8px 16px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(cl3)}</td>
                  </tr>
                  <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b;">
                    <td style="padding: 8px 16px; border-right: 1px solid #e2e8f0;">CL 9 - Merged CC</td>
                    <td style="padding: 8px 16px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(cl9)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style="background: #f1f5f9; font-weight: 900; font-size: 14.5px; color: #0f172a;">
                    <td style="padding: 10px 16px; text-align: center; border-right: 1px solid #e2e8f0;">Total</td>
                    <td style="padding: 10px 16px; text-align: right; font-variant-numeric: tabular-nums;">${formatNumber(slTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <!-- Keterangan Ditempatkan DI BAWAH Tabel -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: #334155; padding: 8px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div>
            <strong>Keterangan:</strong> <strong>CL 0</strong> = No CC (Severity level paling rendah) · <strong>CL 9</strong> = Merged CC (Tanpa tingkatan severity level, dalam 1 DC hanya ada 1 DRG).
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: #0891b2;">
            <img src="img/logo-kemenkes.png" alt="Logo" style="height: 18px;">
            <span>Kemenkes</span>
          </div>
        </div>
      </div>
    `;
  }

  // --- SLIDE 15: DATA MASUK RAWAT JALAN (10 BESAR CMG & MDC) ---
  function renderNationalRawatJalanSlide() {
    const container = document.getElementById("nationalRawatJalanSlide");
    if (!container) return;

    const activeHospitals = getActiveMirroringHospitals();
    const metrics = computeNationalMirroringMetrics(activeHospitals);

    const cmgData = [
      { name: "Rawat Jalan (Q)", pct: 63.33 },
      { name: "Musculoskeletal system & connect. (M)", pct: 9.91 },
      { name: "Factors influencing health status (Z)", pct: 9.70 },
      { name: "Nephro-urinary system (N)", pct: 6.28 },
      { name: "Ear, nose, mouth & throat (U)", pct: 3.79 },
      { name: "Eye and adnexa (H)", pct: 2.40 },
      { name: "Respiratory system (J)", pct: 1.11 },
      { name: "Myeloproliferative system & neopl. (C)", pct: 1.02 },
      { name: "Cardiovascular system (I)", pct: 0.84 },
      { name: "Digestive system (K)", pct: 0.51 }
    ];

    const mdcData = [
      { name: "Diseases of Circulatory System (15)", pct: 10.66 },
      { name: "Diseases of Musculoskeletal System (18)", pct: 9.42 },
      { name: "Diseases of Kidney & Urinary Tract (21)", pct: 8.50 },
      { name: "Diseases of Nervous System (11)", pct: 8.47 },
      { name: "Contact with Health Services (35)", pct: 8.23 },
      { name: "Diseases of Ear, Nose, Mouth & Throat (13)", pct: 6.89 },
      { name: "Alcohol/Drug Use or Induced Mental (30)", pct: 6.42 },
      { name: "Diseases of Eye & Adnexa (12)", pct: 6.00 },
      { name: "Diseases of Respiratory System (14)", pct: 5.64 },
      { name: "Endocrine, Nutritional & Metabolic (20)", pct: 5.26 }
    ];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between; gap: 8px; font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box;">
        <!-- Top Sub-Navigation Tabs for National Mirroring -->
        ${renderNationalNavTabs(4)}

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="color: #d97706; font-size: 18px; font-weight: 800;">
            10 Besar Kasus Rawat Jalan: INA-CBG (CMG) vs iDRG (MDC)
          </div>
          <div style="font-size: 11px; font-weight: 800; color: #0f766e; background: #ccfbf1; padding: 3px 10px; border-radius: 12px; border: 1px solid #99f6e4;">
            🎯 ${metrics.hospitalCount.toLocaleString('id-ID')} RS Aktif (${formatNumber(metrics.rjCases)} Kasus Rajal)
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex: 1 1 auto; min-height: 0;">
          <!-- Left: Kelompok CMG -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 10px 14px; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 13px; text-align: center; padding: 6px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #bae6fd;">
              Kelompok CMG (INA-CBG)
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; flex: 1 1 auto; justify-content: space-between;">
              ${cmgData.map(d => `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #334155;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;" title="${d.name}">${d.name}</span>
                    <span style="color: #0f766e; font-weight: 850;">${d.pct.toFixed(2).replace('.', ',')}%</span>
                  </div>
                  <div style="background: #e2e8f0; border-radius: 4px; height: 9px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #14b8a6, #0d9488); height: 100%; width: ${(d.pct / 70) * 100}%; border-radius: 4px;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Right: Kelompok MDC -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 10px 14px; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="background: #fef3c7; color: #92400e; font-weight: 800; font-size: 13px; text-align: center; padding: 6px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #fde68a;">
              Kelompok MDC (iDRG)
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; flex: 1 1 auto; justify-content: space-around;">
              ${mdcData.map(d => `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #334155;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;" title="${d.name}">${d.name}</span>
                    <span style="color: #b45309; font-weight: 850;">${d.pct.toFixed(2).replace('.', ',')}%</span>
                  </div>
                  <div style="background: #e2e8f0; border-radius: 4px; height: 9px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #f59e0b, #d97706); height: 100%; width: ${(d.pct / 12) * 100}%; border-radius: 4px;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Keterangan Ditempatkan DI BAWAH Grafik -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: #334155; padding: 6px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div><strong>Keterangan:</strong> <strong>CMG</strong> = Case Main Group (INA-CBG) · <strong>MDC</strong> = Major Diagnostic Category (iDRG).</div>
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: #0891b2;">
            <img src="img/logo-kemenkes.png" alt="Logo" style="height: 18px;">
            <span>Kemenkes</span>
          </div>
        </div>
      </div>
    `;
  }

  // --- SLIDE 16: DISTRIBUSI Q-5-44-0 (RAWAT JALAN) - DENGAN DESKRIPSI & EYE-CATCHING ---
  function renderNationalQ5440Slide() {
    const container = document.getElementById("nationalQ5440Slide");
    if (!container) return;

    const activeHospitals = getActiveMirroringHospitals();
    const metrics = computeNationalMirroringMetrics(activeHospitals);

    const totalQ5440 = Math.round(metrics.rjCases * 0.3524);

    const q5440Data = [
      {
        code: "1560220",
        descEn: "Chronic Circulatory System Disorder - Follow Up",
        descId: "Kontrol Jantung & Sirkulasi Darah Kronik",
        cases: Math.round(totalQ5440 * 0.2527),
        pct: 25.3,
        color: "#0d9488",
        gradient: "linear-gradient(90deg, #14b8a6, #0d9488)"
      },
      {
        code: "1160220",
        descEn: "Chronic Nervous System Disorders - Follow Up",
        descId: "Kontrol Penyakit Saraf & Neurologi Kronik",
        cases: Math.round(totalQ5440 * 0.1831),
        pct: 18.3,
        color: "#2563eb",
        gradient: "linear-gradient(90deg, #3b82f6, #2563eb)"
      },
      {
        code: "2060220",
        descEn: "Chronic Endocrine / Nutritional / Metabolic - Follow Up",
        descId: "Kontrol Gangguan Endokrin / Diabetes / Metabolik Kronik",
        cases: Math.round(totalQ5440 * 0.1221),
        pct: 12.2,
        color: "#7c3aed",
        gradient: "linear-gradient(90deg, #8b5cf6, #7c3aed)"
      },
      {
        code: "2160220",
        descEn: "Chronic Kidney Disease - Follow Up",
        descId: "Kontrol Penyakit Ginjal Kronik (PGK)",
        cases: Math.round(totalQ5440 * 0.1051),
        pct: 10.5,
        color: "#f59e0b",
        gradient: "linear-gradient(90deg, #fbbf24, #f59e0b)"
      },
      {
        code: "1860220",
        descEn: "Chronic Musculoskeletal Disorders - Follow Up",
        descId: "Kontrol Otot, Sendi & Tulang Kronik",
        cases: Math.round(totalQ5440 * 0.0871),
        pct: 8.7,
        color: "#e11d48",
        gradient: "linear-gradient(90deg, #f43f5e, #e11d48)"
      },
      {
        code: "3060220",
        descEn: "Mental / Behavioral Disorders - Follow Up",
        descId: "Kontrol Kesehatan Jiwa / Perilaku Kronik",
        cases: Math.round(totalQ5440 * 0.0800),
        pct: 8.0,
        color: "#059669",
        gradient: "linear-gradient(90deg, #10b981, #059669)"
      },
      {
        code: "1260220",
        descEn: "Chronic Eye Disorders - Follow Up",
        descId: "Kontrol Penyakit Mata Kronik (Glaukoma/Katarak dll)",
        cases: Math.round(totalQ5440 * 0.0680),
        pct: 6.8,
        color: "#0284c7",
        gradient: "linear-gradient(90deg, #38bdf8, #0284c7)"
      },
      {
        code: "1460220",
        descEn: "Chronic Respiratory Diseases - Follow Up",
        descId: "Kontrol Paru & Pernapasan Kronik (Asma/PPOK)",
        cases: Math.round(totalQ5440 * 0.0550),
        pct: 5.5,
        color: "#d97706",
        gradient: "linear-gradient(90deg, #f59e0b, #d97706)"
      },
      {
        code: "1360220",
        descEn: "Chronic ENT Disorders - Follow Up",
        descId: "Kontrol Penyakit THT Kronik",
        cases: Math.round(totalQ5440 * 0.0360),
        pct: 3.6,
        color: "#475569",
        gradient: "linear-gradient(90deg, #64748b, #475569)"
      },
      {
        code: "LAINNYA",
        descEn: "Other Chronic Follow Up Conditions",
        descId: "Kontrol Penyakit Kronik Lainnya",
        cases: Math.round(totalQ5440 * 0.0110),
        pct: 1.1,
        color: "#94a3b8",
        gradient: "linear-gradient(90deg, #cbd5e1, #94a3b8)"
      }
    ];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between; gap: 8px; font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box;">
        <!-- Top Sub-Navigation Tabs for National Mirroring -->
        ${renderNationalNavTabs(5)}

        <div style="color: #d97706; font-size: 18px; font-weight: 800; display: flex; justify-content: space-between; align-items: center;">
          <span>Distribusi INA CBGs kode Q-5-44-0 pada DRG dan jumlah kasusnya</span>
          <span style="font-size: 11.5px; font-weight: 700; color: #0d9488; background: #ccfbf1; padding: 3px 10px; border-radius: 12px; border: 1px solid #99f6e4;">
            🎯 ${metrics.hospitalCount.toLocaleString('id-ID')} RS Aktif
          </span>
        </div>

        <div style="display: grid; grid-template-columns: 66% 1fr; gap: 18px; flex: 1 1 auto; min-height: 0;">
          <!-- Left: 10 Bars Breakdown with descriptions -->
          <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 10px 14px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; flex-direction: column; gap: 4px; height: 100%; justify-content: space-between;">
              ${q5440Data.map((d, i) => `
                <div style="display: grid; grid-template-columns: 28px 75px 1fr 75px; gap: 8px; align-items: center; padding: 2px 4px; border-radius: 6px; background: ${i % 2 === 0 ? '#f8fafc' : '#ffffff'};">
                  <!-- Rank Badge -->
                  <span style="font-size: 11px; font-weight: 800; color: #64748b; text-align: center;">#${i + 1}</span>

                  <!-- Code Pill -->
                  <span style="background: ${d.color}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-align: center; letter-spacing: 0.5px;">
                    ${d.code}
                  </span>

                  <!-- Clinical Description & Bar -->
                  <div style="display: flex; flex-direction: column; gap: 1px; min-width: 0;">
                    <div style="font-weight: 700; color: #0f172a; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${d.descEn} (${d.descId})">
                      ${d.descEn} <span style="font-size: 10px; color: #64748b; font-weight: 600;">• ${d.descId}</span>
                    </div>
                    <div style="background: #e2e8f0; border-radius: 4px; height: 7px; overflow: hidden; margin-top: 2px;">
                      <div style="background: ${d.gradient}; height: 100%; width: ${(d.pct / 26) * 100}%; border-radius: 4px; transition: width 0.6s ease;"></div>
                    </div>
                  </div>

                  <!-- Value Callout -->
                  <div style="text-align: right; line-height: 1.1;">
                    <div style="font-size: 11.5px; font-weight: 900; color: ${d.color}; font-variant-numeric: tabular-nums;">${formatNumber(d.cases)}</div>
                    <div style="font-size: 9.5px; font-weight: 700; color: #64748b;">${d.pct}%</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Right: Strategic Insights & Summary -->
          <div style="display: flex; flex-direction: column; gap: 10px; height: 100%;">
            <!-- KPI Summary Card -->
            <div style="background: linear-gradient(135deg, #042f2e 0%, #0f766e 100%); color: #ffffff; border-radius: 14px; padding: 14px 18px; box-shadow: 0 4px 12px rgba(15,118,110,0.25);">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #99f6e4;">
                Total Kasus Q-5-44-0
              </div>
              <div style="font-size: 22px; font-weight: 900; margin: 4px 0 2px; letter-spacing: -0.5px; color: #fef08a; font-variant-numeric: tabular-nums;">
                ${formatNumber(totalQ5440)} Kasus
              </div>
              <div style="font-size: 11.5px; color: #e2e8f0; font-weight: 600;">
                Mencakup <strong>35.2%</strong> dari seluruh klaim Rawat Jalan (${formatNumber(metrics.rjCases)} Kasus).
              </div>
            </div>

            <!-- Transformation Insight Card -->
            <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 14px; padding: 12px 16px; flex: 1 1 auto; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 13px; font-weight: 800; color: #15803d; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                  <span>💡</span> Transformasi Tarif INA-CBG &rarr; iDRG
                </div>
                <p style="font-size: 11.5px; color: #1e293b; line-height: 1.45; font-weight: 600; margin-bottom: 6px;">
                  Pada <strong>INA-CBG</strong>, kode <span style="background: #fee2e2; color: #b91c1c; padding: 1px 4px; border-radius: 3px;">Q-5-44-0</span> adalah <em>"catch-all code"</em> konsultasi umum bertarif homogen.
                </p>
                <p style="font-size: 11.5px; color: #1e293b; line-height: 1.45; font-weight: 600;">
                  Pada <strong>iDRG</strong>, kasus dipecah presisi menjadi <strong>10 kode DRG organ spesifik</strong> dengan <em>Adjustment Factor (AF)</em> dan tarif yang mencerminkan beban pelayanan riil faskes.
                </p>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #86efac; padding-top: 8px; margin-top: 4px; font-size: 11px; font-weight: 700; color: #047857;">
                <span>Sumber: Data Mirroring iDRG Kemenkes</span>
                <img src="img/logo-kemenkes.png" alt="Logo" style="height: 18px;">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- SLIDE KHUSUS: PETA SEBARAN & PROFIL EKSEKUTIF RS MUHAMMADIYAH ---
  // Data Sumber Resmi Persyarikatan (131 RSMA dari Data RSMA.xlsx)
  const RSMA_MASTER_REGISTRY = [
  {
    "no": 1,
    "name": "RSU Muhammadiyah Sumatera Utara",
    "email": "rsumuhammadiyahsumut27@gmail.com",
    "code": "1275885",
    "rsoName": "RS Umum Muhammadiyah Sumatera Utara",
    "class": "D",
    "city": "Kota Medan",
    "prov": "SUMATERA UTARA"
  },
  {
    "no": 2,
    "name": "RSU ‘Aisyiyah Padang",
    "email": "rsuaisyiyahpadang@gmail.com",
    "code": "1371112",
    "rsoName": "RS Umum Aisyiyah Padang",
    "class": "C",
    "city": "Kota Padang",
    "prov": "SUMATERA BARAT"
  },
  {
    "no": 3,
    "name": "RS ‘Aisyiyah Pariaman",
    "email": "rsapariaman@yahoo.co.id",
    "code": "1306050",
    "rsoName": "-",
    "class": "-",
    "city": "-",
    "prov": "-"
  },
  {
    "no": 4,
    "name": "RS Muhammadiyah Palembang",
    "email": "rsmuh_plg@yahoo.co.id",
    "code": "1671301",
    "rsoName": "RS Muhammadiyah Palembang",
    "class": "C",
    "city": "Kota Palembang",
    "prov": "SUMATERA SELATAN"
  },
  {
    "no": 5,
    "name": "RSU Muhammadiyah Metro",
    "email": "info.rsumm@gmail.com",
    "code": "1872031",
    "rsoName": "RS Umum Islam Metro",
    "class": "D",
    "city": "Kota Metro",
    "prov": "LAMPUNG"
  },
  {
    "no": 6,
    "name": "RSIA PKU Muhammadiyah Cipondoh Kota Tangerang",
    "email": "rspkumcipondoh@gmail.com",
    "code": "3671218",
    "rsoName": "RS Ibu dan Anak PKU Muhammadiyah Cipondoh",
    "class": "C",
    "city": "Kota Tangerang",
    "prov": "BANTEN"
  },
  {
    "no": 7,
    "name": "RS Islam Jakarta Cempaka Putih",
    "email": "rsijpusat@rsi.co.id",
    "code": "3173036",
    "rsoName": "RS Umum AL Dr. Mintohardjo",
    "class": "B",
    "city": "Kota Jakarta Pusat",
    "prov": "DKI JAKARTA"
  },
  {
    "no": 8,
    "name": "RS Islam Jakarta Pondok Kopi",
    "email": "rsijpk@rsijpondokkopi.co.id",
    "code": "3172505",
    "rsoName": "RS Islam Jakarta Pondok Kopi",
    "class": "B",
    "city": "Kota Jakarta Timur",
    "prov": "DKI JAKARTA"
  },
  {
    "no": 9,
    "name": "RS Islam Jakarta Sukapura Kelapa Gading",
    "email": "rsijsukapura@gmail.com",
    "code": "3175326",
    "rsoName": "RS Islam Jakarta Sukapura",
    "class": "C",
    "city": "Kota Jakarta Utara",
    "prov": "DKI JAKARTA"
  },
  {
    "no": 10,
    "name": "RS Jiwa Islam Klender",
    "email": "rsjiwaislam@yahoo.co.id / sekretariatrsjik@gmail.com",
    "code": "3172735",
    "rsoName": "RS Jiwa Islam Klender",
    "class": "C",
    "city": "Kota Jakarta Timur",
    "prov": "DKI JAKARTA"
  },
  {
    "no": 11,
    "name": "RSU Muhammadiyah Taman Puring",
    "email": "rsmtp@rsmtp.co.id / sekretariat@rsmtp.co.id / sdi@rsmtp.co.id",
    "code": "3171781",
    "rsoName": "RS Muhammadiyah Taman Puring",
    "class": "C",
    "city": "Kota Jakarta Selatan",
    "prov": "DKI JAKARTA"
  },
  {
    "no": 12,
    "name": "RS Muhammadiyah Bandung",
    "email": "rsmuhammadiyahbandung53@yahoo.co.id",
    "code": "3273106",
    "rsoName": "RS Umum Muhammadiyah",
    "class": "C",
    "city": "Kota Bandung",
    "prov": "JAWA BARAT"
  },
  {
    "no": 13,
    "name": "RS Islam Zam Zam Muhammadiyah Jatibarang",
    "email": "rsizjtbimy@yahoo.co.id / rspkujtb@gmail.com",
    "code": "3212055",
    "rsoName": "RS Umum Pertamina Balongan Indramayu",
    "class": "D",
    "city": "Indramayu",
    "prov": "JAWA BARAT"
  },
  {
    "no": 14,
    "name": "RS Muhammadiyah Cirebon",
    "email": "rsumuhammadiyahcrb@gmail.com / muhammadiyah.hospital@yahoo.com",
    "code": "3274111",
    "rsoName": "RS Umum Muhammadiyah",
    "class": "D",
    "city": "Kota Cirebon",
    "prov": "JAWA BARAT"
  },
  {
    "no": 15,
    "name": "RSU Universitas Muhammadiyah Cirebon",
    "email": "rstmumc@gmail.com / rsuumc@rsu-umc.com",
    "code": "3209052",
    "rsoName": "RS Umum Universitas Muhammadiyah Cirebon",
    "class": "C",
    "city": "Cirebon",
    "prov": "JAWA BARAT"
  },
  {
    "no": 16,
    "name": "RS Muhammadiyah Bandung Selatan",
    "email": "rsmbandungselatan@gmail.com",
    "code": "3204169",
    "rsoName": "RS Muhammadiyah Bandung Selatan",
    "class": "D",
    "city": "Bandung",
    "prov": "JAWA BARAT"
  },
  {
    "no": 17,
    "name": "RS Roemani Muhammadiyah Semarang",
    "email": "rs_roemani@yahoo.co.id",
    "code": "3374080",
    "rsoName": "RS Roemani Muhammadiyah Semarang",
    "class": "C",
    "city": "Kota Semarang",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 18,
    "name": "RS PKU Muhammadiyah Surakarta",
    "email": "humas_pkusolo@yahoo.co.id / pkumuhammadiyahsolo@gmail.com",
    "code": "3372096",
    "rsoName": "RS PKU Muhammadiyah Surakarta",
    "class": "B",
    "city": "Kota Surakarta",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 19,
    "name": "RS PKU Muhammadiyah Delanggu",
    "email": "humas@pku-delanggu.com / info@pku-delanggu.com / sekretariat@pku-delanggu.com",
    "code": "3310416",
    "rsoName": "RS Umum PKU Muhammadiyah Delanggu",
    "class": "C",
    "city": "Klaten",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 20,
    "name": "RS PKU Muhammadiyah Temanggung",
    "email": "tmg.rspku@gmail.com",
    "code": "3323050",
    "rsoName": "RS PKU Muhammadiyah Temanggung",
    "class": "C",
    "city": "Temanggung",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 21,
    "name": "RS PKU Muhammadiyah Sruweng",
    "email": "rsmuhammadiyahsruweng@yahoo.co.id",
    "code": "3305103",
    "rsoName": "RS Umum PKU Muhammadiyah Sruweng",
    "class": "C",
    "city": "Kebumen",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 22,
    "name": "RS PKU Muhammadiyah Mayong-Jepara",
    "email": "rspkumuhammadiyah77@yahoo.com",
    "code": "3320089",
    "rsoName": "RS Umum PKU Muhammadiyah Mayong",
    "class": "C",
    "city": "Jepara",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 23,
    "name": "RS PKU Muhammadiyah Karanganyar",
    "email": "rspkumuhammadiyah@yahoo.com",
    "code": "3313033",
    "rsoName": "RS PKU Muhammadiyah Karanganyar",
    "class": "C",
    "city": "Karanganyar",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 24,
    "name": "RS PKU Muhammadiyah Cepu",
    "email": "rspku_cepu@yahoo.co.id",
    "code": "3316051",
    "rsoName": "RS Umum PKU Muhammadiyah Cepu",
    "class": "C",
    "city": "Blora",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 25,
    "name": "RS PKU Muhammadiyah Gombong",
    "email": "admin.rs@pkugombong.com / rspkumuhammadiyahgb@gmail.com",
    "code": "3305066",
    "rsoName": "RS Umum PKU Muhamadiyah Gombong",
    "class": "B",
    "city": "Kebumen",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 26,
    "name": "RSU PKU ‘Aisyiyah Boyolali",
    "email": "rspkuaboy@yahoo.co.id",
    "code": "3309063",
    "rsoName": "RS Umum PKU Aisyiyah Boyolali",
    "class": "C",
    "city": "Boyolali",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 27,
    "name": "RS Muhammadiyah Selogiri-Wonogiri",
    "email": "muhammadiyahwonogiri@yahoo.co.id / rsmuhammadiyahselogiri@gmail.com",
    "code": "3312284",
    "rsoName": "RS Umum Muhammadiyah Selogiri",
    "class": "D",
    "city": "Wonogiri",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 28,
    "name": "RSU PKU Muhammadiyah Gubug Grobogan",
    "email": "rsmgbg@yahoo.co.id / rsmgbg@yahoo.com",
    "code": "3315059",
    "rsoName": "RS Umum Islam Purwodadi",
    "class": "D",
    "city": "Grobogan",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 29,
    "name": "RSU Muhammadiyah Siti Aminah-Bumiayu",
    "email": "rsm.sitiaminah@gmail.com / rsm.sitiaminah@yahoo.com",
    "code": "3329056",
    "rsoName": "RS Umum Muhammadiyah Siti Aminah",
    "class": "C",
    "city": "Brebes",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 30,
    "name": "RS Islam PKU Muhammadiyah Tegal",
    "email": "rsi_muhtegal@ymail.com / rsi_muhtegal@gmail.com",
    "code": "3328055",
    "rsoName": "RSI PKU Muhammadiyah Tegal",
    "class": "C",
    "city": "Tegal",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 31,
    "name": "RS Islam PKU Muhammadiyah Pekajangan",
    "email": "rsi.pekajangan@yahoo.co.id / info@rsipekajangan.com",
    "code": "3326016",
    "rsoName": "RS Islam PKU Muhammadiyah Pekajangan",
    "class": "C",
    "city": "Pekalongan",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 32,
    "name": "RS Muhammadiyah Rodliyah Achid Moga",
    "email": "rsmrodliyahachid@gmail.com / rsmuhammadiyahmoga@gmail.com",
    "code": "3327032",
    "rsoName": "RS Muhammadiyah Rodliyah Achid",
    "class": "D",
    "city": "Pemalang",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 33,
    "name": "RS Islam Kendal",
    "email": "rsimuhkendal@yahoo.co.id / rsi.kendal@gmail.com",
    "code": "3324036",
    "rsoName": "RS Umum Islam Kendal",
    "class": "C",
    "city": "Kendal",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 34,
    "name": "RSIA ‘Aisyiyah Klaten",
    "email": "rsia.klt@gmail.com",
    "code": "3310405",
    "rsoName": "RS Umum Diponegoro Dua Satu Klaten",
    "class": "C",
    "city": "Klaten",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 35,
    "name": "RSU Muhammadiyah Darul Istiqomah Kaliwungu Kendal",
    "email": "rsdimuhammadiyah@yahoo.com",
    "code": "3324037",
    "rsoName": "RS Umum Muhammadiyah Darul Istiqomah Kendal",
    "class": "D",
    "city": "Kendal",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 36,
    "name": "RS ‘Aisyiyah Kudus",
    "email": "rsa_kudus@yahoo.com",
    "code": "3319021",
    "rsoName": "RS Aisyiyah Kudus",
    "class": "C",
    "city": "Kudus",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 37,
    "name": "RS ‘Aisyiyah Muntilan",
    "email": "rsia.muntilan@gmail.com / rsiamuntilan@gmail.com / rsa.muntilan@gmail.com",
    "code": "3308017",
    "rsoName": "RS Umum Aisyiyah Muntilan",
    "class": "C",
    "city": "Magelang",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 38,
    "name": "RS PKU Muhammadiyah Sragen",
    "email": "pkum_sragen@yahoo.com",
    "code": "3314090",
    "rsoName": "RS Umum PKU Muhammadiyah Sragen",
    "class": "C",
    "city": "Sragen",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 39,
    "name": "RSU Fastabiq Sehat PKU Muhammadiyah Pati",
    "email": "rsfastabiqsehat@gmail.com",
    "code": "3318108",
    "rsoName": "RS Umum Keluarga Sehat",
    "class": "C",
    "city": "Pati",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 40,
    "name": "RS PKU Muhammadiyah Petanahan",
    "email": "rspkupetanahan@yahoo.com",
    "code": "3305117",
    "rsoName": "RS Umum PKU Muhammadiyah Petanahan Kebumen",
    "class": "D",
    "city": "Kebumen",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 41,
    "name": "RS PKU Muhammadiyah Wonosobo",
    "email": "pkuwsb@gmail.com / pkuwsb@yahoo.co.id",
    "code": "3307051",
    "rsoName": "RS Umum  PKU Muhammadiyah Wonosobo",
    "class": "C",
    "city": "Wonosobo",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 42,
    "name": "RS PKU Muhammadiyah Kartasura",
    "email": "pkumuhammadiyahkartasura@yahoo.com",
    "code": "3311230",
    "rsoName": "RS PKU Muhammadiyah Kartasura",
    "class": "D",
    "city": "Sukoharjo",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 43,
    "name": "RSU PKU Muhammadiyah Sukoharjo",
    "email": "pku.sukoharjo@gmail.com",
    "code": "3311225",
    "rsoName": "RS Umum PKU Muhammadiyah Sukoharjo",
    "class": "C",
    "city": "Sukoharjo",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 44,
    "name": "RSU ‘Aisyiyah Purworejo",
    "email": "rsiaa_pwr@yahoo.com",
    "code": "3306023",
    "rsoName": "RS Umum  Aisyiyah",
    "class": "D",
    "city": "Purworejo",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 45,
    "name": "RS PKU Muhammadiyah Blora",
    "email": "rsmuhblora@yahoo.co.id / rsmuhblora@gmail.com",
    "code": "3316063",
    "rsoName": "RS Umum PKU Muhammadiyah Blora",
    "class": "D",
    "city": "Blora",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 46,
    "name": "RS Muhammadiyah Mardhatillah Randudongkal",
    "email": "rsmuhmardhatillah@gmail.com",
    "code": "3327047",
    "rsoName": "RS Umum Muhammadiyah Mardhatillah",
    "class": "D",
    "city": "Pemalang",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 47,
    "name": "RSU PKU Muhammadiyah Jatinom Klaten",
    "email": "pkumuhammadiyah_jtn@yahoo.co.id",
    "code": "3310418",
    "rsoName": "RS Umum PKU Muhammadiyah Jatinom",
    "class": "C",
    "city": "Klaten",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 48,
    "name": "RS PKU ‘Aisyiyah Jepara",
    "email": "sitikhadijahjpr@yahoo.com",
    "code": "3320046",
    "rsoName": "RS PKU Aisyiyah Jepara",
    "class": "D",
    "city": "Jepara",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 49,
    "name": "RS PKU Muhammadiyah Kutowinangun",
    "email": "pkukuto@yahoo.co.id / pkukuto@gmail.com",
    "code": "3305118",
    "rsoName": "RS Umum PKU Muhammadiyah Kutowinangun",
    "class": "D",
    "city": "Kebumen",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 50,
    "name": "RSIA ‘Aisyiyah Pekajangan Pekalongan",
    "email": "rba610@gmail.com / rsi.pekajangan@yahoo.co.id",
    "code": "3326051",
    "rsoName": "RS Ibu dan Anak Aisyiyah Pekajangan Pekalongan",
    "class": "C",
    "city": "Pekalongan",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 51,
    "name": "RSGM Universitas Muhammadiyah Semarang",
    "email": "rsgm@unimus.ac.id",
    "code": "3374373",
    "rsoName": "RS Gigi dan Mulut Unimus",
    "class": "C",
    "city": "Kota Semarang",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 52,
    "name": "RSGM Soelastri Universitas Muhammadiyah Surakarta",
    "email": "rsgmsoelastri@ums.ac.id",
    "code": "3372239",
    "rsoName": "RS Gigi dan Mulut Soelastri",
    "class": "C",
    "city": "Kota Surakarta",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 53,
    "name": "RS PKU Muhammadiyah Sampangan Surakarta",
    "email": "pkusampangan@gmail.com",
    "code": "3372238",
    "rsoName": "RS PKU Muhammadiyah Sampangan Surakarta",
    "class": "D",
    "city": "Kota Surakarta",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 54,
    "name": "RS PKU Muhammadiyah Pedan Klaten",
    "email": "rsupkumuhpedan@gmail.com",
    "code": "3310425",
    "rsoName": "RS Umum PKU Muhammadiyah Pedan",
    "class": "D",
    "city": "Klaten",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 55,
    "name": "RS PKU Muhammadiyah Wonogiri",
    "email": "pkumuhammadiyah30@gmail.com / rspkuwngkota@gmail.com",
    "code": "3312316",
    "rsoName": "-",
    "class": "-",
    "city": "-",
    "prov": "-"
  },
  {
    "no": 56,
    "name": "RS Islam Purwokerto",
    "email": "info@rsipurwokerto.co.id / rsislam.purwokerto@gmail.com",
    "code": "3302132",
    "rsoName": "RS Umum Islam Purwokerto",
    "class": "C",
    "city": "Banyumas",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 57,
    "name": "RSU PKU Muhammadiyah Banjarnegara",
    "email": "rsupkumuhammadiyah.bna@gmail.com",
    "code": "3304035",
    "rsoName": "RS Umum PKU Muhammadiyah Banjarnegara",
    "class": "D",
    "city": "Banjarnegara",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 58,
    "name": "RS PKU Muhammadiyah Purbalingga",
    "email": "pkum_pbg@yahoo.com",
    "code": "3303102",
    "rsoName": "RS Umum PKU Muhammadiyah Purbalingga",
    "class": "D",
    "city": "Purbalingga",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 59,
    "name": "RS Hj. Fatimah Sulhan PKU Muhammadiyah Demak",
    "email": "rspkumudemak@gmail.com",
    "code": "3321036",
    "rsoName": "RS Hj. Fatimah Sulhan PKU Muhammadiyah Demak",
    "class": "D",
    "city": "Demak",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 60,
    "name": "RS PKU Muhammadiyah Boja Kendal",
    "email": "rspkumuhammadiyahboja@gmail.com",
    "code": "3324053",
    "rsoName": "RS PKU Muhammadiyah Boja",
    "class": "D",
    "city": "Kendal",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 61,
    "name": "RS PKU ‘Aisyiyah Kota Kendal",
    "email": "rspkuaisyiyahkendal@gmail.com",
    "code": "3324052",
    "rsoName": "RS PKU Aisyiyah Kendal",
    "class": "D",
    "city": "Kendal",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 62,
    "name": "RSU Amanah Muhammadiyah Sumpiuh Banyumas",
    "email": "rsiaamanahsumpiuh@gmail.com",
    "code": "3302121",
    "rsoName": "RS Umum PKU Muhammadiyah Amanah Sumpiuh",
    "class": "C",
    "city": "Banyumas",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 63,
    "name": "RSU PKU Muhammadiyah Prambanan",
    "email": "rspkum.prambanan@gmail.com",
    "code": "3310426",
    "rsoName": "RS PKU Muhammadiyah Prambanan",
    "class": "D",
    "city": "Klaten",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 64,
    "name": "RS PKU Muhammadiyah Pamotan",
    "email": "rspku_muhpa@yahoo.com",
    "code": "3317038",
    "rsoName": "RS PKU Muhammadiyah Pamotan",
    "class": "C",
    "city": "Rembang",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 65,
    "name": "RSU PKU Dr. Soemowidagdo Boyolali",
    "email": "rsupkudrsoemowidagdo@gmail.com",
    "code": "3309149",
    "rsoName": "RS Umum PKU dr. Soemowidagdo Boyolali",
    "class": "D",
    "city": "Boyolali",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 66,
    "name": "RS Sarkies ‘Aisyiyah Kudus",
    "email": "rssarkies@gmail.com",
    "code": "3319113",
    "rsoName": "RS Sarkies 'Aisyiyah Kudus",
    "class": "C",
    "city": "Kudus",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 67,
    "name": "RSU Aghisna Medika Kroya Cilacap",
    "email": "pkuaghisnakroya@gmail.com",
    "code": "3301108",
    "rsoName": "RS Umum PKU Muhammdiyah Aghisna Kroya",
    "class": "C",
    "city": "Cilacap",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 68,
    "name": "RS Aghisna Medika Sidareja",
    "email": "rsaghisna.sidareja@gmail.com",
    "code": "3301114",
    "rsoName": "RS Umum Aghisna Medika Sidareja",
    "class": "D",
    "city": "Cilacap",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 69,
    "name": "RSU PKU Muhammadiyah AR Fachrudin Salatiga",
    "email": "–",
    "code": "3373092",
    "rsoName": "RS Ibu dan Anak Hermina Mutiara Bunda",
    "class": "C",
    "city": "Kota Salatiga",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 70,
    "name": "RS Islam Muhammadiyah 2 Kendal",
    "email": "rsim2kendal@gmail.com",
    "code": "3324054",
    "rsoName": "RSI MUHAMMADIYAH 2 KENDAL",
    "class": "D",
    "city": "Kendal",
    "prov": "JAWA TENGAH"
  },
  {
    "no": 71,
    "name": "RS Muhammadiyah Ahmad Dahlan Kota Kediri",
    "email": "rsmad.kotakediri@yahoo.com",
    "code": "3571122",
    "rsoName": "RS Muhammadiyah Ahmad Dahlan",
    "class": "C",
    "city": "Kota Kediri",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 72,
    "name": "RSU Muhammadiyah Surya Melati",
    "email": "surya.melati@yahoo.co.id",
    "code": "3506047",
    "rsoName": "RS Umum Muhammadiyah Surya Melati",
    "class": "D",
    "city": "Kediri",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 73,
    "name": "RSI Aminah Blitar",
    "email": "rsiaminahblitar@gmail.com",
    "code": "3572073",
    "rsoName": "RS Islam Aminah",
    "class": "C",
    "city": "Kota Blitar",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 74,
    "name": "RSU Aminah Blitar",
    "email": "rsua_aminah@yahoo.co.id / rsuaminah.blitar39@gmail.com / rsua_blitar@yahoo.co.id",
    "code": "3572065",
    "rsoName": "RS Umum Aminah Blitar",
    "class": "C",
    "city": "Kota Blitar",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 75,
    "name": "RS Muhammadiyah Tuban",
    "email": "rsab_muh_tbn@ymail.com / rsabmtuban@gmail.com",
    "code": "3523052",
    "rsoName": "RS Muhammadiyah Tuban",
    "class": "D",
    "city": "Tuban",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 76,
    "name": "RSIA Muhammadiyah Malang",
    "email": "rsabm_mlg@yahoo.com",
    "code": "3573135",
    "rsoName": "RS Ibu dan Anak Muhammadiyah Malang",
    "class": "C",
    "city": "Kota Malang",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 77,
    "name": "RSU Islam ‘Aisyiyah Malang",
    "email": "rsiaisyiyah_malang@yahoo.com / rsiaisyiyah_malang@yahoo.co.id",
    "code": "3573215",
    "rsoName": "RS Umum Islam Aisyiyah Malang",
    "class": "C",
    "city": "Kota Malang",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 78,
    "name": "RS ‘Aisyiyah Bojonegoro",
    "email": "rsabgoro@gmail.com",
    "code": "3522025",
    "rsoName": "Rumah Sakit Aisyiyah Bojonegoro",
    "class": "C",
    "city": "Bojonegoro",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 79,
    "name": "RS Muhammadiyah Kalitidu Bojonegoro",
    "email": "rsmuhammadiyahkalitidu@gmail.com",
    "code": "3522060",
    "rsoName": "RS Muhammadiyah Kalitidu",
    "class": "D",
    "city": "Bojonegoro",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 80,
    "name": "RS Siti Khodijah Muhammadiyah Cabang Sepanjang",
    "email": "sekretariat.rssk@gmail.com",
    "code": "3515026",
    "rsoName": "RS Umum Siti Khodijah Muhammadiyah Cabang Sepanjan",
    "class": "B",
    "city": "Sidoarjo",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 81,
    "name": "RS ‘Aisyiyah Siti Fatimah Tulangan, Sidoarjo",
    "email": "aisyiyah.15@gmail.com",
    "code": "3515138",
    "rsoName": "RS Umum Aisyiyah Siti Fatimah",
    "class": "D",
    "city": "Sidoarjo",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 82,
    "name": "RS Muhammadiyah Lamongan",
    "email": "rsmlamongan@gmail.com / sekretariat@rsmlamongan.com",
    "code": "3524031",
    "rsoName": "RS Umum Muhammadiyah Lamongan",
    "class": "B",
    "city": "Lamongan",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 83,
    "name": "RS Muhammadiyah Babat",
    "email": "eresembe@gmail.com",
    "code": "3524047",
    "rsoName": "RS Muhammadiyah Babat",
    "class": "D",
    "city": "Lamongan",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 84,
    "name": "RSI Muhammadiyah Sumberrejo",
    "email": "rsimsumberrejo@yahoo.co.id",
    "code": "3522036",
    "rsoName": "RSI Muhammadiyah Sumberrejo",
    "class": "D",
    "city": "Bojonegoro",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 85,
    "name": "RSI Hasanah Muhammadiyah Mojokerto",
    "email": "rsihasanah@gmail.com / rsihasanah@yahoo.com",
    "code": "3576051",
    "rsoName": "RS Islam Hasanah Muhammadiyah",
    "class": "C",
    "city": "Kota Mojokerto",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 86,
    "name": "RSU ‘Aisyiyah Ponorogo",
    "email": "rsuapo@yahoo.co.id",
    "code": "3502112",
    "rsoName": "RS Umum Aisyiyah Ponorogo",
    "class": "C",
    "city": "Ponorogo",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 87,
    "name": "RSU Muhammadiyah Ponorogo",
    "email": "rsum_ponorogo@yahoo.com",
    "code": "3502134",
    "rsoName": "RS Umum Muhammadiyah Ponorogo",
    "class": "C",
    "city": "Ponorogo",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 88,
    "name": "RSU PKU Muhammadiyah Rogojampi",
    "email": "pkurogojampi@gmail.com",
    "code": "3510104",
    "rsoName": "RS Umum PKU Muhammadiyah Rogojampi",
    "class": "D",
    "city": "Banyuwangi",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 89,
    "name": "RS Islam Fatimah Banyuwangi",
    "email": "rsifatimah@gmail.com",
    "code": "3510054",
    "rsoName": "RS Islam Fatimah",
    "class": "C",
    "city": "Banyuwangi",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 90,
    "name": "RSIA Muhammadiyah Kota Probolinggo",
    "email": "rsabm_probolinggo@yahoo.com",
    "code": "3574069",
    "rsoName": "RS Ibu dan Anak Muhammadiyah Kota Probolinggo",
    "class": "C",
    "city": "Kota Probolinggo",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 91,
    "name": "RS Muhammadiyah Gresik",
    "email": "rsibmg@yahoo.com / rsabmg@yahoo.com",
    "code": "3525088",
    "rsoName": "RS Muhammadiyah Gresik",
    "class": "C",
    "city": "Gresik",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 92,
    "name": "RSU PKU Muhammadiyah Sekapuk",
    "email": "rs.pku.muhammadiyah@gmail.com",
    "code": "3525095",
    "rsoName": "RS PKU Muhammadiyah Sekapuk",
    "class": "D",
    "city": "Gresik",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 93,
    "name": "RS PKU Muhammadiyah Surabaya",
    "email": "rsm_sby@yahoo.com",
    "code": "3578793",
    "rsoName": "RS PKU Muhammadiyah Surabaya",
    "class": "D",
    "city": "Kota Surabaya",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 94,
    "name": "RS Islam ‘Aisyiyah Nganjuk",
    "email": "rsianganjuk@yahoo.com",
    "code": "3518046",
    "rsoName": "RS Islam Aisyiyah Nganjuk",
    "class": "D",
    "city": "Nganjuk",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 95,
    "name": "RSI Siti Aisyah Madiun",
    "email": "rsi_madiun@yahoo.co.id",
    "code": "3577074",
    "rsoName": "RS Umum Islam Siti Aisyah",
    "class": "C",
    "city": "Kota Madiun",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 96,
    "name": "RS Muhammadiyah Jombang",
    "email": "rumahsakitmuhammadiyahjombang@yahoo.com",
    "code": "3517092",
    "rsoName": "RS Muhammadiyah Jombang",
    "class": "D",
    "city": "Jombang",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 97,
    "name": "RS PKU Muhammadiyah Mojoagung Jombang",
    "email": "pkumuhammadiyahjmbg@yahoo.com / pkumuhammadiyahmjg@yahoo.co.id",
    "code": "3517109",
    "rsoName": "RS Umum PKU Muhammadiyah Mojoagung",
    "class": "D",
    "city": "Jombang",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 98,
    "name": "RSU Muhammadiyah Bandung Tulungagung",
    "email": "rsum_bandung@yahoo.co.id",
    "code": "3504071",
    "rsoName": "RS Umum Muhammadiyah Bandung",
    "class": "D",
    "city": "Tulungagung",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 99,
    "name": "RS Muhammadiyah Siti Khodijah Gurah-Kediri",
    "email": "rsm.sitikhodijah.kediri@gmail.com",
    "code": "3506059",
    "rsoName": "RS Muhammadiyah Siti Khodijah",
    "class": "D",
    "city": "Kediri",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 100,
    "name": "RSU Universitas Muhammadiyah Malang",
    "email": "rumahsakit.umm@gmail.com / hospital@umm.ac.id",
    "code": "3507108",
    "rsoName": "RS Umum Universitas Muhammadiyah Malang",
    "class": "C",
    "city": "Malang",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 101,
    "name": "RS Muhammadiyah Lumajang",
    "email": "rsum.lmj@gmail.com",
    "code": "3508060",
    "rsoName": "RS Umum Muhammadiyah Lumajang",
    "class": "D",
    "city": "Lumajang",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 102,
    "name": "RS Muhammadiyah Kali Kapas Lamongan",
    "email": "rsmkalikapas@gmail.com / rsmuhammadiyahkalikapas@gmail.com",
    "code": "3524056",
    "rsoName": "RS Muhammadiyah Kalikapas Lamongan",
    "class": "D",
    "city": "Lamongan",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 103,
    "name": "RSU Muhammadiyah Babat",
    "email": "rsumbabat@gmail.com",
    "code": "3524049",
    "rsoName": "RS Umum Muhammadiyah Babat",
    "class": "C",
    "city": "Lamongan",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 104,
    "name": "RSU Universitas Muhammadiyah Jember",
    "email": "rsuunmuhjember@unmuhjember.ac.id",
    "code": "3509151",
    "rsoName": "RS Umum Universitas Muhammadiyah Jember",
    "class": "C",
    "city": "Jember",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 105,
    "name": "RSIA Aisyiyah Bangkalan",
    "email": "aisyiyah.rsia@gmail.com",
    "code": "3526030",
    "rsoName": "RS Ibu dan Anak Aisyiyah",
    "class": "C",
    "city": "Bangkalan",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 106,
    "name": "RSU Assakinah Medika",
    "email": "humasrsuamedika@gmail.com",
    "code": "3515127",
    "rsoName": "RS Umum Assakinah Medika",
    "class": "D",
    "city": "Sidoarjo",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 107,
    "name": "RS Moedjito Dwidjosiswojo",
    "email": "office.moedjito@gmail.com",
    "code": "3517091",
    "rsoName": "RS Umum dr. Moedjito Dwidjosiswojo",
    "class": "D",
    "city": "Jombang",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 108,
    "name": "RSIA Sekarwangi Magetan",
    "email": "rsia.sekarwangi@gmail.com",
    "code": "3520014",
    "rsoName": "RS Ibu dan Anak Sekar Wangi",
    "class": "C",
    "city": "Magetan",
    "prov": "JAWA TIMUR"
  },
  {
    "no": 109,
    "name": "RS PKU Muhammadiyah Yogyakarta",
    "email": "pkujogja@yahoo.co.id / pkujogja@gmail.com",
    "code": "3471041",
    "rsoName": "RS PKU Muhammadiyah Yogyakarta",
    "class": "B",
    "city": "Kota Yogyakarta",
    "prov": "D I YOGYAKARTA"
  },
  {
    "no": 110,
    "name": "RSU PKU Muhammadiyah Bantul",
    "email": "pkubantul@gmail.com",
    "code": "3402031",
    "rsoName": "RSU PKU Muhammadiyah Bantul",
    "class": "C",
    "city": "Bantul",
    "prov": "D I YOGYAKARTA"
  },
  {
    "no": 111,
    "name": "RSKIA PKU Muhammadiyah Kotagede",
    "email": "pkukotagede@yahoo.co.id",
    "code": "3471107",
    "rsoName": "RS Khusus Ibu dan Anak  PKU Muhammadiyah Kotagede",
    "class": "C",
    "city": "Kota Yogyakarta",
    "prov": "D I YOGYAKARTA"
  },
  {
    "no": 112,
    "name": "RSU PKU Muhammadiyah Nanggulan",
    "email": "rs.pku.nanggulan@gmail.com",
    "code": "3401050",
    "rsoName": "RS Umum PKU Muhammadiyah Nanggulan",
    "class": "D",
    "city": "Kulon Progo",
    "prov": "D I YOGYAKARTA"
  },
  {
    "no": 113,
    "name": "RS PKU Muhammadiyah Gamping Yogyakarta",
    "email": "pku.gamping@gmail.com",
    "code": "3404183",
    "rsoName": "RS Umum PKU Muhammadiyah Gamping",
    "class": "B",
    "city": "Sleman",
    "prov": "D I YOGYAKARTA"
  },
  {
    "no": 114,
    "name": "RS PKU Muhammadiyah Wonosari",
    "email": "rspkuwonosari@yahoo.co.id",
    "code": "3403024",
    "rsoName": "RS Umum PKU Muhammadiyah Wonosari",
    "class": "D",
    "city": "Gunung Kidul",
    "prov": "D I YOGYAKARTA"
  },
  {
    "no": 115,
    "name": "RS Universitas Ahmad Dahlan Yogyakarta",
    "email": "info@rsuad.co.id / holistika.medika@gmail.com",
    "code": "3404191",
    "rsoName": "RS Universitas Ahmad Dahlan",
    "class": "D",
    "city": "Sleman",
    "prov": "D I YOGYAKARTA"
  },
  {
    "no": 116,
    "name": "RSGM Universitas Muhammadiyah Yogyakarta",
    "email": "rsgmp@umy.ac.id / rektorat@umy.ac.id",
    "code": "3471374",
    "rsoName": "RS Gigi dan Mulut Universitas Muhammadiyah Yogyakarta",
    "class": "A",
    "city": "Kota Yogyakarta",
    "prov": "D I YOGYAKARTA"
  },
  {
    "no": 117,
    "name": "RS Asri Medical Centre",
    "email": "asrimedicalcenter@gmail.com",
    "code": "3471381",
    "rsoName": "RS AMC Muhammadiyah",
    "class": "D",
    "city": "Kota Yogyakarta",
    "prov": "D I YOGYAKARTA"
  },
  {
    "no": 118,
    "name": "RS PKU Muhammadiyah Sleman",
    "email": "rspkusleman@gmail.com",
    "code": "3404210",
    "rsoName": "RS PKU Muhammadiyah Sleman",
    "class": "C",
    "city": "Sleman",
    "prov": "D I YOGYAKARTA"
  },
  {
    "no": 119,
    "name": "RS PKU Muhammadiyah Bima",
    "email": "rspkubima@yahoo.co.id",
    "code": "5206028",
    "rsoName": "RS PKU Muhammadiyah Bima",
    "class": "D",
    "city": "Kota Bima",
    "prov": "NUSA TENGGARA BARAT"
  },
  {
    "no": 120,
    "name": "RS Surya Medika PKU Muhammadiyah Sumbawa",
    "email": "suryamedikahospital@umm.ac.id",
    "code": "5207004",
    "rsoName": "RS Abdul Malik Fadjar PKU Muhammadiyah Sumbawa",
    "class": "D",
    "city": "Sumbawa",
    "prov": "NUSA TENGGARA BARAT"
  },
  {
    "no": 121,
    "name": "RSI PKU Muhammadiyah Palangkaraya",
    "email": "rsipalangkaraya@yahoo.co.id",
    "code": "6271024",
    "rsoName": "RS Islam PKU Muhammadiyah Palangka Raya",
    "class": "C",
    "city": "Kota Palangka Raya",
    "prov": "KALIMANTAN TENGAH"
  },
  {
    "no": 122,
    "name": "RSIA ‘Aisyiyah Samarinda",
    "email": "rsiaa_smd@yahoo.com / rsiaaa_smd@yahoo.com",
    "code": "6472052",
    "rsoName": "RS Ibu dan Anak  Aisyiyah Samarinda",
    "class": "C",
    "city": "Kota Samarinda",
    "prov": "KALIMANTAN TIMUR"
  },
  {
    "no": 123,
    "name": "RS Islam Banjarmasin",
    "email": "rs_islambjm@yahoo.com",
    "code": "6371046",
    "rsoName": "RS Islam Banjarmasin",
    "class": "C",
    "city": "Kota Banjarmasin",
    "prov": "KALIMANTAN SELATAN"
  },
  {
    "no": 124,
    "name": "RSIA Sitti Khadijah I Muhammadiyah Cab.Makassar",
    "email": "rsia.sitti.khadijah@gmail.com",
    "code": "7371191",
    "rsoName": "RS Ibu dan Anak Sitti Khadijah 1 Muhammadiyah",
    "class": "C",
    "city": "Kota Makassar",
    "prov": "SULAWESI SELATAN"
  },
  {
    "no": 125,
    "name": "RS PKU Muhammadiyah Mamajang",
    "email": "rsiakhadijahmamajang@rocketmail.com / rsiakhadijahtigamamajang@gmail.com",
    "code": "7371400",
    "rsoName": "RS PKU Muhammadiyah Mamajang",
    "class": "D",
    "city": "Kota Makassar",
    "prov": "SULAWESI SELATAN"
  },
  {
    "no": 126,
    "name": "RS ‘Aisyiyah Siti Khadijah Pinrang",
    "email": "rsa.stkhadijah@yahoo.com",
    "code": "7315016",
    "rsoName": "RS Umum Aisyiyah St. Khadijah",
    "class": "D",
    "city": "Pinrang",
    "prov": "SULAWESI SELATAN"
  },
  {
    "no": 127,
    "name": "RS PKU Muhammadiyah Unismuh Makassar",
    "email": "sekretariat@rsunismuh.com",
    "code": "7306070",
    "rsoName": "RS PKU Muhammadiyah Unismuh Makassar",
    "class": "C",
    "city": "Gowa",
    "prov": "SULAWESI SELATAN"
  },
  {
    "no": 128,
    "name": "RSIA PKU Muhammadiyah Palu",
    "email": "sudirman.aulia@gmail.com",
    "code": "7271032",
    "rsoName": "-",
    "class": "-",
    "city": "-",
    "prov": "-"
  },
  {
    "no": 129,
    "name": "RSIA Siti Khadijah Kota Gorontalo",
    "email": "rsia_gtlo@yahoo.co.id",
    "code": "7571022",
    "rsoName": "RS Ibu dan Anak Siti Khadidjah",
    "class": "C",
    "city": "Kota Gorontalo",
    "prov": "GORONTALO"
  },
  {
    "no": 130,
    "name": "RS Islam PKU Muhammadiyah Maluku Utara",
    "email": "rs_islam_ternate@yahoo.co.id",
    "code": "8271042",
    "rsoName": "RS Islam PKU Muhammadiyah Maluku Utara",
    "class": "D",
    "city": "Kota Ternate",
    "prov": "MALUKU UTARA"
  },
  {
    "no": 131,
    "name": "RS UMS AR Fachrudin",
    "email": "",
    "code": "3372255",
    "rsoName": "RS UMS AR FACHRUDIN",
    "class": "D",
    "city": "Kota Surakarta",
    "prov": "JAWA TENGAH"
  }
];

  const MUHAMMADIYAH_HOSPITAL_CODES = new Set(["1275885","1371112","1306050","1671301","1872031","3671218","3173036","3172505","3175326","3172735","3171781","3273106","3212055","3274111","3209052","3204169","3374080","3372096","3310416","3323050","3305103","3320089","3313033","3316051","3305066","3309063","3312284","3315059","3329056","3328055","3326016","3327032","3324036","3310405","3324037","3319021","3308017","3314090","3318108","3305117","3307051","3311230","3311225","3306023","3316063","3327047","3310418","3320046","3305118","3326051","3374373","3372239","3372238","3310425","3312316","3302132","3304035","3303102","3321036","3324053","3324052","3302121","3310426","3317038","3309149","3319113","3301108","3301114","3373092","3324054","3571122","3506047","3572073","3572065","3523052","3573135","3573215","3522025","3522060","3515026","3515138","3524031","3524047","3522036","3576051","3502112","3502134","3510104","3510054","3574069","3525088","3525095","3578793","3518046","3577074","3517092","3517109","3504071","3506059","3507108","3508060","3524056","3524049","3509151","3526030","3515127","3517091","3520014","3471041","3402031","3471107","3401050","3404183","3403024","3404191","3471374","3471381","3404210","5206028","5207004","6271024","6472052","6371046","7371191","7371400","7315016","7306070","7271032","7571022","8271042","3372255"]);

  function isMuhammadiyahHospital(h) {
    if (!h) return false;
    const code = String(h.code || "").trim();
    return MUHAMMADIYAH_HOSPITAL_CODES.has(code);
  }

  let muhMapActiveRegion = "ALL";

  function renderMuhammadiyahMapSlide() {
    const container = document.getElementById("muhammadiyahMapSlide");
    if (!container) return;

    const allMuhammadiyah = (data.hospitals || []).filter(isMuhammadiyahHospital);

    let totalCases = 0;
    let totalIna = 0;
    let totalIdrg = 0;
    const provMap = {};
    const classCounts = { A: 0, B: 0, C: 0, D: 0, Other: 0 };

    allMuhammadiyah.forEach(h => {
      totalCases += h.total ? h.total[CASES] : 0;
      totalIna += h.total ? h.total[INA] : 0;
      totalIdrg += h.total ? h.total[IDRG] : 0;

      const p = h.province || 'Lainnya';
      if (!provMap[p]) provMap[p] = { count: 0, cases: 0, idrg: 0 };
      provMap[p].count++;
      provMap[p].cases += h.total ? h.total[CASES] : 0;
      provMap[p].idrg += h.total ? h.total[IDRG] : 0;

      const c = (h.class || '').trim().toUpperCase();
      if (classCounts[c] !== undefined) classCounts[c]++;
      else classCounts.Other++;
    });

    const totalDelta = totalIdrg - totalIna;
    const totalDeltaPct = totalIna > 0 ? (totalDelta / totalIna) : 0;
    const totalProvinces = Object.keys(provMap).length;

    // Top regions
    const sortedProvs = Object.entries(provMap).sort((a, b) => b[1].cases - a[1].cases);
    const top4Provs = sortedProvs.slice(0, 4);
    const outerProvs = sortedProvs.slice(4);
    const outerCount = outerProvs.reduce((acc, cur) => acc + cur[1].count, 0);
    const outerCases = outerProvs.reduce((acc, cur) => acc + cur[1].cases, 0);
    const outerShare = totalCases > 0 ? (outerCases / totalCases) : 0;

    const jatengCount = provMap['JAWA TENGAH'] ? provMap['JAWA TENGAH'].count : 0;
    const jatimCount = provMap['JAWA TIMUR'] ? provMap['JAWA TIMUR'].count : 0;
    const diyCount = (provMap['DIY'] || provMap['DAERAH ISTIMEWA YOGYAKARTA']) ? (provMap['DIY'] || provMap['DAERAH ISTIMEWA YOGYAKARTA']).count : 0;
    const jabarCount = provMap['JAWA BARAT'] ? provMap['JAWA BARAT'].count : 0;

    container.innerHTML = `
      <!-- TOP EXECUTIVE SCORECARD (5 KPIS) -->
      <div class="muhammadiyah-kpis" style="grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 0;">
        <article class="kpi-card is-highlight">
          <div class="kpi-label" style="color: #047857; font-weight: 800; font-size: 10px;">TOTAL RS JEJARING</div>
          <div class="kpi-value" style="color: #065f46; font-size: 18px; font-weight: 900;">${allMuhammadiyah.length} RS</div>
          <div class="kpi-note" style="color: #047857; font-size: 10.5px;">${totalProvinces} Provinsi (131 Faskes RSMA)</div>
        </article>
        <article class="kpi-card">
          <div class="kpi-label" style="font-size: 10px;">TOTAL KASUS KLAIM</div>
          <div class="kpi-value" style="font-size: 18px; font-weight: 900; color: #1e293b;">${formatNumber(totalCases)}</div>
          <div class="kpi-note" style="font-size: 10.5px;">Mirroring Uji Coba iDRG</div>
        </article>
        <article class="kpi-card">
          <div class="kpi-label" style="font-size: 10px;">PENDAPATAN INA-CBG</div>
          <div class="kpi-value" style="font-size: 18px; font-weight: 900; color: #1e293b;">${formatMoney(totalIna)}</div>
          <div class="kpi-note" style="font-size: 10.5px;">Tarif Eksisting Klaim</div>
        </article>
        <article class="kpi-card">
          <div class="kpi-label" style="font-size: 10px;">POTENSI PORTOFOLIO iDRG</div>
          <div class="kpi-value" style="font-size: 18px; font-weight: 900; color: #0284c7;">${formatMoney(totalIdrg)}</div>
          <div class="kpi-note" style="font-size: 10.5px;">Potensi Klaim Era Baru</div>
        </article>
        <article class="kpi-card is-highlight">
          <div class="kpi-label" style="color: #047857; font-weight: 800; font-size: 10px;">STIMULUS PERTUMBUHAN (DELTA)</div>
          <div class="kpi-value ${totalDelta >= 0 ? 'delta-positive' : 'delta-negative'}" style="font-size: 18px; font-weight: 900;">
            ${totalDelta >= 0 ? '+' : ''}${formatMoney(totalDelta)}
          </div>
          <div class="kpi-note" style="color: #047857; font-weight: 700; font-size: 10.5px;">
            ${totalDeltaPct >= 0 ? '▲ +' : '▼ '}${formatPercent(totalDeltaPct)} vs INA-CBG
          </div>
        </article>
      </div>

      <!-- MAIN 2-COLUMN SPLIT: MAP (LEFT 65%) + SCORECARD PANEL (RIGHT 35%) -->
      <div style="flex: 1; min-height: 0; display: grid; grid-template-columns: 1.85fr 1fr; gap: 12px; margin-top: 4px;">
        <!-- MAP COLUMN (LEFT) -->
        <div style="display: flex; flex-direction: column; gap: 6px; height: 100%; min-height: 0;">
          <!-- Map Region Filter Controls & Legend -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 10px; font-size: 11px;">
            <div style="display: flex; gap: 5px; align-items: center;" id="muhMapRegionFilterBtns">
              <span style="font-weight: 800; color: #334155; font-size: 10.5px; margin-right: 2px;">Fokus:</span>
              <button type="button" class="muh-map-filter-btn ${muhMapActiveRegion === 'ALL' ? 'is-active' : ''}" data-region="ALL">Semua (${allMuhammadiyah.length})</button>
              <button type="button" class="muh-map-filter-btn ${muhMapActiveRegion === 'JAWA TENGAH' ? 'is-active' : ''}" data-region="JAWA TENGAH">Jateng (${jatengCount})</button>
              <button type="button" class="muh-map-filter-btn ${muhMapActiveRegion === 'JAWA TIMUR' ? 'is-active' : ''}" data-region="JAWA TIMUR">Jatim (${jatimCount})</button>
              <button type="button" class="muh-map-filter-btn ${muhMapActiveRegion === 'DAERAH ISTIMEWA YOGYAKARTA' || muhMapActiveRegion === 'DIY' ? 'is-active' : ''}" data-region="DAERAH ISTIMEWA YOGYAKARTA">DIY (${diyCount})</button>
              <button type="button" class="muh-map-filter-btn ${muhMapActiveRegion === 'JAWA BARAT' ? 'is-active' : ''}" data-region="JAWA BARAT">Jabar (${jabarCount})</button>
              <button type="button" class="muh-map-filter-btn ${muhMapActiveRegion === 'LUAR_JAWA' ? 'is-active' : ''}" data-region="LUAR_JAWA">Luar Jawa (${outerCount})</button>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; font-weight: 700; font-size: 10.5px;">
              <span style="display: flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 8px; height: 8px; background: #059669; border-radius: 50%; border: 1.5px solid white;"></span> RS Muhammadiyah</span>
              <span style="display: flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 9px; height: 9px; background: #dc2626; border-radius: 50%; border: 1.5px solid #fef08a;"></span> RS Target</span>
            </div>
          </div>

          <!-- Map Container -->
          <div id="muhammadiyahSvgMapContainer" style="width: 100%; flex: 1; min-height: 380px; border-radius: 10px; border: 1px solid #cbd5e1; background: #e0f2fe; position: relative; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06);"></div>
        </div>

        <!-- RIGHT PANEL: PROVINCIAL & STRATEGIC INSIGHT SCORECARD -->
        <div style="display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; overflow-y: auto; padding-right: 2px;">
          <!-- Top Provinces Card -->
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
              <span>📍 Konsentrasi Utama Faskes</span>
              <span style="font-size: 10px; color: #64748b; font-weight: 600;">${totalProvinces} Provinsi</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 5px;">
              ${top4Provs.map(([prov, pData]) => {
                const provShare = totalCases > 0 ? (pData.cases / totalCases) : 0;
                return `
                  <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px; padding: 5px 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                      <span style="font-weight: 700; font-size: 11.5px; color: #1e293b;">${escapeHtml(prov)}</span>
                      <span style="font-size: 11px; font-weight: 800; color: #059669;">${pData.count} RS (${(provShare*100).toFixed(2).replace('.', ',')}%)</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
                      <span>${formatNumber(pData.cases)} Kasus</span>
                      <span style="font-weight: 600; color: #0284c7;">${formatMoney(pData.idrg)}</span>
                    </div>
                  </div>
                `;
              }).join('')}

              ${outerCount > 0 ? `
                <div style="background: #f0fdf4; border: 1px dashed #86efac; border-radius: 6px; padding: 5px 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span style="font-weight: 700; font-size: 11px; color: #166534;">Luar Jawa (${outerProvs.length} Provinsi)</span>
                    <span style="font-size: 11px; font-weight: 800; color: #16a34a;">${outerCount} RS (${(outerShare*100).toFixed(2).replace('.', ',')}%)</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 10px; color: #15803d;">
                    <span>${formatNumber(outerCases)} Kasus</span>
                    <span style="font-weight: 600;">${formatMoney(outerProvs.reduce((a,c)=>a+c[1].idrg, 0))}</span>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Class Distribution Card -->
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              🏥 Distribusi Kelas RS Jejaring
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; text-align: center;">
              <div style="background: #fee2e2; border-radius: 6px; padding: 4px 2px;">
                <div style="font-size: 9px; font-weight: 700; color: #991b1b;">KELAS A</div>
                <div style="font-size: 13px; font-weight: 900; color: #dc2626;">${classCounts.A || 0}</div>
              </div>
              <div style="background: #fef3c7; border-radius: 6px; padding: 4px 2px;">
                <div style="font-size: 9px; font-weight: 700; color: #92400e;">KELAS B</div>
                <div style="font-size: 13px; font-weight: 900; color: #d97706;">${classCounts.B}</div>
              </div>
              <div style="background: #dcfce7; border-radius: 6px; padding: 4px 2px;">
                <div style="font-size: 9px; font-weight: 700; color: #166534;">KELAS C</div>
                <div style="font-size: 13px; font-weight: 900; color: #16a34a;">${classCounts.C}</div>
              </div>
              <div style="background: #f1f5f9; border-radius: 6px; padding: 4px 2px;">
                <div style="font-size: 9px; font-weight: 700; color: #475569;">KELAS D</div>
                <div style="font-size: 13px; font-weight: 900; color: #334155;">${classCounts.D}</div>
              </div>
            </div>
          </div>

          <!-- Strategic Narrative Card -->
          <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid #a7f3d0; border-radius: 10px; padding: 10px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); flex: 1;">
            <div style="font-size: 11px; font-weight: 800; color: #065f46; display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
              <span>💡</span> Ringkasan Strategis Jejaring RSMA
            </div>
            <p style="margin: 0; font-size: 11px; color: #047857; line-height: 1.45; text-align: justify;">
              Jejaring <strong>${allMuhammadiyah.length} RS Muhammadiyah/Aisyiyah</strong> (dari total 131 RSMA resmi) melayani <strong>${(totalCases/1e6).toFixed(2).replace('.', ',')} Juta kasus</strong> dalam periode simulasi. Transisi ke tarif iDRG menghasilkan potensi kenaikan pendapatan agregat <strong>+${(totalDeltaPct*100).toFixed(2).replace('.', ',')}% (+${formatMoney(totalDelta)})</strong>, membuktikan kesiapan jejaring faskes persyarikatan dalam penguatan transformasi sistem rujukan nasional.
            </p>
          </div>
        </div>
      </div>
    `;

    // Render interactive vector map for Muhammadiyah
    renderUnifiedInteractiveMap("muhammadiyahSvgMapContainer", { isMuhammadiyahMap: true, regionFilter: muhMapActiveRegion });

    // Attach region filter click listeners
    const filterContainer = container.querySelector("#muhMapRegionFilterBtns");
    if (filterContainer) {
      filterContainer.querySelectorAll(".muh-map-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          muhMapActiveRegion = btn.dataset.region;
          renderMuhammadiyahMapSlide();
        });
      });
    }
  }

  // --- ANALISIS KHUSUS GROUP RS MUHAMMADIYAH & AISYIYAH ---
  const muhammadiyahState = {
    activeTab: 'hospitals', // 'hospitals' | 'services' | 'provinces' | 'registry'
    search: '',
    provFilter: 'ALL',
    classFilter: 'ALL',
    sortBy: 'cases_desc'
  };

  function renderHospitalsTabHtml(filteredHospitals, provinceOptions, totalGroupCases) {
    return `
      <div class="muhammadiyah-filter-bar">
        <div style="position: relative; flex: 1; min-width: 200px;">
          <input type="text" id="muhammadiyahSearchInput" placeholder="🔍 Cari nama RS, kota, atau kode..." value="${escapeHtml(muhammadiyahState.search)}" style="width: 100%; box-sizing: border-box;">
          ${muhammadiyahState.search ? `<button id="clearMuhammadiyahSearch" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 13px; font-weight: 700;">×</button>` : ''}
        </div>
        <select id="muhammadiyahProvSelect" aria-label="Filter Provinsi">
          <option value="ALL">Semua Provinsi (${data.hospitals.filter(isMuhammadiyahHospital).length} RS)</option>
          ${provinceOptions}
        </select>
        <select id="muhammadiyahClassSelect" aria-label="Filter Kelas RS">
          <option value="ALL" ${muhammadiyahState.classFilter === 'ALL' ? 'selected' : ''}>Semua Kelas RS</option>
          <option value="A" ${muhammadiyahState.classFilter === 'A' ? 'selected' : ''}>Kelas A</option>
          <option value="B" ${muhammadiyahState.classFilter === 'B' ? 'selected' : ''}>Kelas B</option>
          <option value="C" ${muhammadiyahState.classFilter === 'C' ? 'selected' : ''}>Kelas C</option>
          <option value="D" ${muhammadiyahState.classFilter === 'D' ? 'selected' : ''}>Kelas D</option>
        </select>
        <select id="muhammadiyahSortSelect" aria-label="Urutkan Data">
          <option value="cases_desc" ${muhammadiyahState.sortBy === 'cases_desc' ? 'selected' : ''}>Urutkan: Kasus Terbanyak ↓</option>
          <option value="idrg_desc" ${muhammadiyahState.sortBy === 'idrg_desc' ? 'selected' : ''}>Urutkan: iDRG Terbesar ↓</option>
          <option value="delta_desc" ${muhammadiyahState.sortBy === 'delta_desc' ? 'selected' : ''}>Urutkan: Selisih Potensi Terbesar ↓</option>
          <option value="name_asc" ${muhammadiyahState.sortBy === 'name_asc' ? 'selected' : ''}>Urutkan: Nama RS (A - Z)</option>
        </select>
        <span style="font-size: 11.5px; font-weight: 700; color: #047857; margin-left: auto;">
          Ditemukan: <strong>${filteredHospitals.length}</strong> RS
        </span>
      </div>

      <div class="muhammadiyah-table-wrap">
        <table class="muhammadiyah-table" aria-label="Tabel Rinci RS Muhammadiyah">
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">No</th>
              <th style="min-width: 220px;">Nama Rumah Sakit &amp; Kode</th>
              <th style="min-width: 140px;">Kota/Kab &amp; Provinsi</th>
              <th style="width: 55px; text-align: center;">Kelas</th>
              <th style="width: 95px; text-align: center;">Layanan Kompeten</th>
              <th class="num" style="min-width: 100px;">Kasus Mirroring</th>
              <th class="num" style="min-width: 120px;">INA-CBG (Rp. M)</th>
              <th class="num" style="min-width: 120px;">Potensi iDRG (Rp. M)</th>
              <th class="num" style="min-width: 120px;">Selisih (+/– Rp)</th>
              <th class="num" style="min-width: 65px;">Share</th>
              <th style="width: 95px; text-align: center;">Aksi Target</th>
            </tr>
          </thead>
          <tbody>
            ${filteredHospitals.length === 0 ? `
              <tr><td colspan="11" style="text-align: center; padding: 25px; color: #64748b; font-weight: 600;">Tidak ada RS Muhammadiyah yang sesuai dengan filter pencarian ini.</td></tr>
            ` : filteredHospitals.map((h, idx) => {
              const hCases = h.total ? h.total[CASES] : 0;
              const hIna = h.total ? h.total[INA] : 0;
              const hIdrg = h.total ? h.total[IDRG] : 0;
              const hDelta = hIdrg - hIna;
              const hDeltaPct = hIna > 0 ? (hDelta / hIna) : 0;
              const share = totalGroupCases > 0 ? (hCases / totalGroupCases) : 0;
              const isTarget = (state.targetCodes || []).includes(h.code) || h.code === state.targetCode;

              let competentCount = 0;
              Object.keys(h.services || {}).forEach(s => {
                if ((h.services[s].competency || 0) > 0) competentCount++;
              });

              return `
                <tr class="${isTarget ? 'is-current-target' : ''}">
                  <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
                  <td>
                    <div style="font-weight: 800; color: ${isTarget ? '#dc2626' : '#1e293b'};">${escapeHtml(h.name)}</div>
                    <div style="font-size: 10px; color: #64748b;">Kode RS: <span style="font-family: monospace; font-weight: 700;">${escapeHtml(h.code)}</span></div>
                  </td>
                  <td>
                    <div style="font-weight: 600;">${escapeHtml(h.city || '-')}</div>
                    <div style="font-size: 10.5px; color: #64748b;">${escapeHtml(h.province || '-')}</div>
                  </td>
                  <td style="text-align: center;">
                    <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 11px; background: ${h.class === 'A' ? '#fee2e2; color: #dc2626;' : h.class === 'B' ? '#fef3c7; color: #d97706;' : h.class === 'C' ? '#dcfce7; color: #15803d;' : '#f1f5f9; color: #475569;'}">${escapeHtml(h.class || '-')}</span>
                  </td>
                  <td style="text-align: center; font-weight: 700;">
                    <span style="color: ${competentCount >= 18 ? '#15803d' : competentCount >= 10 ? '#0284c7' : '#d97706'};">${competentCount}</span><span style="color: #94a3b8; font-size: 10.5px;">/24</span>
                  </td>
                  <td class="num" style="font-weight: 800; color: #1e293b;">${formatNumber(hCases)}</td>
                  <td class="num">${formatTableMoney(hIna)}</td>
                  <td class="num" style="font-weight: 800; color: #0284c7;">${formatTableMoney(hIdrg)}</td>
                  <td class="num ${hDelta >= 0 ? 'delta-positive' : 'delta-negative'}">
                    ${hDelta >= 0 ? '+' : ''}${formatMoney(hDelta)}
                    <div style="font-size: 9.5px; font-weight: 600; opacity: 0.85;">${hDeltaPct >= 0 ? '▲ +' : '▼ '}${formatPercent(hDeltaPct)}</div>
                  </td>
                  <td class="num" style="font-weight: 700; color: #059669;">${formatPercent(share)}</td>
                  <td style="text-align: center;">
                    <button type="button" class="btn-set-target ${isTarget ? 'is-active' : ''}" data-code="${escapeHtml(h.code)}">
                      ${isTarget ? '🎯 Target Aktif' : '🎯 Pilih Target'}
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderServicesTabHtml(serviceSummary, totalGroupCases) {
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px;">
        <span style="font-size: 12px; font-weight: 700; color: #1e293b;">
          Agregasi 24 Kelompok Pelayanan Medis pada RS Jejaring Muhammadiyah &amp; Aisyiyah
        </span>
        <span style="font-size: 11.5px; color: #64748b;">
          Diurutkan berdasarkan volume kasus terbesar
        </span>
      </div>

      <div class="muhammadiyah-table-wrap">
        <table class="muhammadiyah-table" aria-label="Tabel Layanan RS Muhammadiyah">
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">No</th>
              <th style="min-width: 200px;">Kelompok Layanan</th>
              <th class="num" style="min-width: 95px;">Total Kasus Group</th>
              <th class="num" style="min-width: 115px;">Nilai INA-CBG (Rp. M)</th>
              <th class="num" style="min-width: 115px;">Potensi iDRG (Rp. M)</th>
              <th class="num" style="min-width: 115px;">Selisih (+/– Rp)</th>
              <th class="num" style="min-width: 65px;">Share Group</th>
              <th style="min-width: 170px; text-align: center;">Distribusi Strata RS Muhammadiyah</th>
              <th style="min-width: 180px;">RS Kontributor Terbesar</th>
            </tr>
          </thead>
          <tbody>
            ${serviceSummary.map((s, idx) => {
              return `
                <tr>
                  <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
                  <td style="font-weight: 800; color: #1e293b;">${escapeHtml(formatService(s.service))}</td>
                  <td class="num" style="font-weight: 800; color: #1e293b;">${formatNumber(s.cases)}</td>
                  <td class="num">${formatTableMoney(s.ina)}</td>
                  <td class="num" style="font-weight: 800; color: #0284c7;">${formatTableMoney(s.idrg)}</td>
                  <td class="num ${s.delta >= 0 ? 'delta-positive' : 'delta-negative'}">
                    ${s.delta >= 0 ? '+' : ''}${formatMoney(s.delta)}
                    <div style="font-size: 9.5px; font-weight: 600; opacity: 0.85;">${s.deltaPct >= 0 ? '▲ +' : '▼ '}${formatPercent(s.deltaPct)}</div>
                  </td>
                  <td class="num" style="font-weight: 700; color: #059669;">${formatPercent(s.share)}</td>
                  <td style="text-align: center; font-size: 10.5px;">
                    <span style="display: inline-flex; gap: 3px; align-items: center; justify-content: center;">
                      ${s.compDist[4] > 0 ? `<span style="background: #dff3ec; color: #08765b; font-weight: 800; padding: 1px 4px; border-radius: 3px;" title="${s.compDist[4]} RS Paripurna">P: ${s.compDist[4]}</span>` : ''}
                      ${s.compDist[3] > 0 ? `<span style="background: #f5f7d6; color: #6f7614; font-weight: 800; padding: 1px 4px; border-radius: 3px;" title="${s.compDist[3]} RS Utama">U: ${s.compDist[3]}</span>` : ''}
                      ${s.compDist[2] > 0 ? `<span style="background: #e7f5ed; color: #187a59; font-weight: 800; padding: 1px 4px; border-radius: 3px;" title="${s.compDist[2]} RS Madya">M: ${s.compDist[2]}</span>` : ''}
                      ${s.compDist[1] > 0 ? `<span style="background: #e2f4f3; color: #087e83; font-weight: 800; padding: 1px 4px; border-radius: 3px;" title="${s.compDist[1]} RS Dasar">D: ${s.compDist[1]}</span>` : ''}
                      <span style="background: #f1f5f9; color: #64748b; font-weight: 700; padding: 1px 4px; border-radius: 3px;" title="${s.compDist[0]} RS Tidak Kompeten">TK: ${s.compDist[0]}</span>
                    </span>
                  </td>
                  <td>
                    ${s.topHosp ? `
                      <div style="font-weight: 700; color: #1e293b; font-size: 11px;">${escapeHtml(s.topHosp.name)}</div>
                      <div style="font-size: 10px; color: #059669; font-weight: 600;">${formatNumber(s.topHosp.cases)} kasus (${escapeHtml(s.topHosp.city || '')})</div>
                    ` : '<span style="color: #94a3b8;">—</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderProvincesTabHtml(provSummary, totalGroupCases) {
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px;">
        <span style="font-size: 12px; font-weight: 700; color: #1e293b;">
          Sebaran dan Kinerja RS Jejaring Muhammadiyah &amp; Aisyiyah di ${provSummary.length} Provinsi
        </span>
        <span style="font-size: 11.5px; color: #64748b;">
          Diurutkan berdasarkan volume kasus per provinsi
        </span>
      </div>

      <div class="muhammadiyah-table-wrap">
        <table class="muhammadiyah-table" aria-label="Tabel Provinsi RS Muhammadiyah">
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">No</th>
              <th style="min-width: 180px;">Provinsi</th>
              <th class="num" style="min-width: 80px;">Jumlah RS</th>
              <th class="num" style="min-width: 100px;">Total Kasus</th>
              <th class="num" style="min-width: 120px;">INA-CBG (Rp. M)</th>
              <th class="num" style="min-width: 120px;">Potensi iDRG (Rp. M)</th>
              <th class="num" style="min-width: 120px;">Selisih (+/– Rp)</th>
              <th class="num" style="min-width: 65px;">Share Group</th>
              <th style="min-width: 200px;">RS Terbesar di Provinsi</th>
            </tr>
          </thead>
          <tbody>
            ${provSummary.map((p, idx) => {
              return `
                <tr>
                  <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
                  <td style="font-weight: 800; color: #1e293b;">${escapeHtml(p.province)}</td>
                  <td class="num" style="font-weight: 800; color: #059669;">${p.rsCount} RS</td>
                  <td class="num" style="font-weight: 800; color: #1e293b;">${formatNumber(p.cases)}</td>
                  <td class="num">${formatTableMoney(p.ina)}</td>
                  <td class="num" style="font-weight: 800; color: #0284c7;">${formatTableMoney(p.idrg)}</td>
                  <td class="num ${p.delta >= 0 ? 'delta-positive' : 'delta-negative'}">
                    ${p.delta >= 0 ? '+' : ''}${formatMoney(p.delta)}
                    <div style="font-size: 9.5px; font-weight: 600; opacity: 0.85;">${p.deltaPct >= 0 ? '▲ +' : '▼ '}${formatPercent(p.deltaPct)}</div>
                  </td>
                  <td class="num" style="font-weight: 700; color: #059669;">${formatPercent(p.share)}</td>
                  <td>
                    ${p.topHosp ? `
                      <div style="font-weight: 700; color: #1e293b; font-size: 11px;">${escapeHtml(p.topHosp.name)}</div>
                      <div style="font-size: 10px; color: #059669; font-weight: 600;">${formatNumber(p.topHosp.total ? p.topHosp.total[CASES] : 0)} kasus · ${escapeHtml(p.topHosp.city || '')}</div>
                    ` : '<span style="color: #94a3b8;">—</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderRegistryTabHtml(provinceOptions) {
    let list = RSMA_MASTER_REGISTRY;
    if (muhammadiyahState.search) {
      const q = muhammadiyahState.search.toLowerCase();
      list = list.filter(r => 
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.prov.toLowerCase().includes(q) ||
        (r.rsoName && r.rsoName.toLowerCase().includes(q))
      );
    }
    if (muhammadiyahState.provFilter !== 'ALL') {
      list = list.filter(r => r.prov === muhammadiyahState.provFilter);
    }
    if (muhammadiyahState.classFilter !== 'ALL') {
      list = list.filter(r => (r.class || '').trim().toUpperCase() === muhammadiyahState.classFilter);
    }

    const totalActiveClaim = RSMA_MASTER_REGISTRY.filter(r => data.hospitals.some(h => h.code === r.code)).length;

    return `
      <div class="muhammadiyah-filter-bar">
        <div style="position: relative; flex: 1; min-width: 200px;">
          <input type="text" id="muhammadiyahSearchInput" placeholder="🔍 Cari nama RSMA, email, kota, atau kode..." value="${escapeHtml(muhammadiyahState.search)}" style="width: 100%; box-sizing: border-box;">
          ${muhammadiyahState.search ? `<button id="clearMuhammadiyahSearch" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 13px; font-weight: 700;">×</button>` : ''}
        </div>
        <select id="muhammadiyahProvSelect" aria-label="Filter Provinsi">
          <option value="ALL">Semua Provinsi (${RSMA_MASTER_REGISTRY.length} RSMA)</option>
          ${provinceOptions}
        </select>
        <select id="muhammadiyahClassSelect" aria-label="Filter Kelas RS">
          <option value="ALL" ${muhammadiyahState.classFilter === 'ALL' ? 'selected' : ''}>Semua Kelas RS</option>
          <option value="A" ${muhammadiyahState.classFilter === 'A' ? 'selected' : ''}>Kelas A</option>
          <option value="B" ${muhammadiyahState.classFilter === 'B' ? 'selected' : ''}>Kelas B</option>
          <option value="C" ${muhammadiyahState.classFilter === 'C' ? 'selected' : ''}>Kelas C</option>
          <option value="D" ${muhammadiyahState.classFilter === 'D' ? 'selected' : ''}>Kelas D</option>
        </select>
        <span style="font-size: 11.5px; font-weight: 700; color: #047857; margin-left: auto;">
          Menampilkan: <strong>${list.length}</strong> dari <strong>${RSMA_MASTER_REGISTRY.length}</strong> RSMA Resmi (<strong>${totalActiveClaim}</strong> RS Terdata Klaim)
        </span>
      </div>

      <div class="muhammadiyah-table-wrap">
        <table class="muhammadiyah-table" aria-label="Tabel Master Registry RS Muhammadiyah & Aisyiyah">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">No</th>
              <th style="min-width: 230px;">Nama Resmi RSMA (Data RSMA.xlsx)</th>
              <th style="min-width: 180px;">E-mail Resmi Persyarikatan</th>
              <th style="min-width: 200px;">Kode &amp; Nama RS Online (Kemenkes)</th>
              <th style="min-width: 130px;">Kota/Kab &amp; Provinsi</th>
              <th style="width: 60px; text-align: center;">Kelas</th>
              <th style="min-width: 160px; text-align: center;">Status Data Transaksi Klaim</th>
              <th style="width: 95px; text-align: center;">Aksi Target</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `
              <tr><td colspan="8" style="text-align: center; padding: 25px; color: #64748b; font-weight: 600;">Tidak ada RSMA yang sesuai dengan filter pencarian ini.</td></tr>
            ` : list.map(r => {
              const h = data.hospitals.find(x => x.code === r.code);
              const isTarget = h && ((state.targetCodes || []).includes(h.code) || h.code === state.targetCode);
              const hCases = h && h.total ? h.total[CASES] : 0;
              return `
                <tr class="${isTarget ? 'is-current-target' : ''}">
                  <td style="text-align: center; font-weight: 800; color: #047857;">${r.no}</td>
                  <td>
                    <div style="font-weight: 800; color: #1e293b;">${escapeHtml(r.name)}</div>
                    <div style="font-size: 10px; color: #64748b;">No. Urut Master: <span style="font-weight: 700;">#${r.no}</span></div>
                  </td>
                  <td>
                    ${r.email ? `<div style="font-family: monospace; font-size: 11px; color: #0284c7; font-weight: 600;">✉️ ${escapeHtml(r.email)}</div>` : `<span style="color: #94a3b8;">—</span>`}
                  </td>
                  <td>
                    <div style="font-weight: 700; color: #334155; font-size: 11.5px;">${escapeHtml(r.rsoName || r.name)}</div>
                    <div style="font-size: 10.5px; color: #64748b;">Kode Kemenkes: <span style="font-family: monospace; font-weight: 800; color: #0f172a;">${escapeHtml(r.code)}</span></div>
                  </td>
                  <td>
                    <div style="font-weight: 600;">${escapeHtml(r.city)}</div>
                    <div style="font-size: 10.5px; color: #64748b;">${escapeHtml(r.prov)}</div>
                  </td>
                  <td style="text-align: center;">
                    <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 11px; background: ${r.class === 'A' ? '#fee2e2; color: #dc2626;' : r.class === 'B' ? '#fef3c7; color: #d97706;' : r.class === 'C' ? '#dcfce7; color: #15803d;' : '#f1f5f9; color: #475569;'}">${escapeHtml(r.class)}</span>
                  </td>
                  <td style="text-align: center;">
                    ${h ? `
                      <span style="display: inline-flex; align-items: center; gap: 4px; background: #ecfdf5; color: #047857; padding: 3px 8px; border-radius: 12px; font-size: 10.5px; font-weight: 800; border: 1px solid #a7f3d0;">
                        <span>✓</span> Terdata (${formatNumber(hCases)} kss)
                      </span>
                    ` : `
                      <span style="display: inline-flex; align-items: center; gap: 4px; background: #f8fafc; color: #64748b; padding: 3px 8px; border-radius: 12px; font-size: 10.5px; font-weight: 700; border: 1px solid #e2e8f0;" title="Faskes baru/khusus/non-klaim uji coba">
                        Non-Klaim Uji Coba
                      </span>
                    `}
                  </td>
                  <td style="text-align: center;">
                    ${h ? `
                      <button type="button" class="btn-set-target ${isTarget ? 'is-active' : ''}" data-code="${escapeHtml(r.code)}">
                        ${isTarget ? '🎯 Target Aktif' : '🎯 Pilih Target'}
                      </button>
                    ` : `
                      <span style="color: #cbd5e1; font-size: 11px; font-weight: 600;">—</span>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function attachMuhammadiyahEvents(container) {
    container.querySelectorAll(".muhammadiyah-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        muhammadiyahState.activeTab = btn.dataset.tab;
        renderMuhammadiyahGroupSlide();
      });
    });

    const searchInput = container.querySelector("#muhammadiyahSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        muhammadiyahState.search = e.target.value;
        renderMuhammadiyahGroupSlide();
        const inputAfter = container.querySelector("#muhammadiyahSearchInput");
        if (inputAfter) {
          inputAfter.focus();
          inputAfter.selectionStart = inputAfter.selectionEnd = inputAfter.value.length;
        }
      });
    }

    const clearSearchBtn = container.querySelector("#clearMuhammadiyahSearch");
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        muhammadiyahState.search = '';
        renderMuhammadiyahGroupSlide();
      });
    }

    const provSelect = container.querySelector("#muhammadiyahProvSelect");
    if (provSelect) {
      provSelect.addEventListener("change", (e) => {
        muhammadiyahState.provFilter = e.target.value;
        renderMuhammadiyahGroupSlide();
      });
    }

    const classSelect = container.querySelector("#muhammadiyahClassSelect");
    if (classSelect) {
      classSelect.addEventListener("change", (e) => {
        muhammadiyahState.classFilter = e.target.value;
        renderMuhammadiyahGroupSlide();
      });
    }

    const sortSelect = container.querySelector("#muhammadiyahSortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        muhammadiyahState.sortBy = e.target.value;
        renderMuhammadiyahGroupSlide();
      });
    }

    container.querySelectorAll(".btn-set-target").forEach(btn => {
      btn.addEventListener("click", () => {
        const code = btn.dataset.code;
        if (code) {
          window.selectTargetHospital(code);
          renderMuhammadiyahGroupSlide();
        }
      });
    });
  }

  function renderMuhammadiyahGroupSlide() {
    const container = document.getElementById("muhammadiyahGroupSlide");
    if (!container) return;

    const allMuhammadiyah = (data.hospitals || []).filter(isMuhammadiyahHospital);

    let totalCases = 0;
    let totalIna = 0;
    let totalIdrg = 0;
    const provCounts = {};
    const classCounts = { A: 0, B: 0, C: 0, D: 0, Other: 0 };

    allMuhammadiyah.forEach(h => {
      totalCases += h.total ? h.total[CASES] : 0;
      totalIna += h.total ? h.total[INA] : 0;
      totalIdrg += h.total ? h.total[IDRG] : 0;

      const p = h.province || 'Lainnya';
      provCounts[p] = (provCounts[p] || 0) + 1;

      const c = (h.class || '').trim().toUpperCase();
      if (classCounts[c] !== undefined) classCounts[c]++;
      else classCounts.Other++;
    });

    const totalDelta = totalIdrg - totalIna;
    const totalDeltaPct = totalIna > 0 ? (totalDelta / totalIna) : 0;
    const totalProvinces = Object.keys(provCounts).length;

    let filteredHospitals = allMuhammadiyah.filter(h => {
      if (muhammadiyahState.provFilter !== 'ALL' && h.province !== muhammadiyahState.provFilter) return false;
      if (muhammadiyahState.classFilter !== 'ALL' && (h.class || '').trim().toUpperCase() !== muhammadiyahState.classFilter) return false;
      if (muhammadiyahState.search) {
        const q = muhammadiyahState.search.toLowerCase();
        const matchName = h.name.toLowerCase().includes(q);
        const matchCity = (h.city || '').toLowerCase().includes(q);
        const matchCode = (h.code || '').toLowerCase().includes(q);
        if (!matchName && !matchCity && !matchCode) return false;
      }
      return true;
    });

    filteredHospitals.sort((a, b) => {
      const aCases = a.total ? a.total[CASES] : 0;
      const bCases = b.total ? b.total[CASES] : 0;
      const aIna = a.total ? a.total[INA] : 0;
      const bIna = b.total ? b.total[INA] : 0;
      const aIdrg = a.total ? a.total[IDRG] : 0;
      const bIdrg = b.total ? b.total[IDRG] : 0;
      const aDelta = aIdrg - aIna;
      const bDelta = bIdrg - bIna;

      if (muhammadiyahState.sortBy === 'cases_desc') return bCases - aCases;
      if (muhammadiyahState.sortBy === 'idrg_desc') return bIdrg - aIdrg;
      if (muhammadiyahState.sortBy === 'delta_desc') return bDelta - aDelta;
      if (muhammadiyahState.sortBy === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });

    const serviceSummary = (data.services || []).map(service => {
      let sCases = 0, sIna = 0, sIdrg = 0;
      const compDist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      let topHosp = null, maxHospCases = -1;

      allMuhammadiyah.forEach(h => {
        const sObj = h.services && h.services[service];
        const cases = sObj && sObj.total ? sObj.total[CASES] : 0;
        const ina = sObj && sObj.total ? sObj.total[INA] : 0;
        const idrg = sObj && sObj.total ? sObj.total[IDRG] : 0;
        const comp = sObj ? (sObj.competency || 0) : 0;

        sCases += cases;
        sIna += ina;
        sIdrg += idrg;
        compDist[comp]++;

        if (cases > maxHospCases) {
          maxHospCases = cases;
          topHosp = { name: h.name, cases, city: h.city };
        }
      });

      const sDelta = sIdrg - sIna;
      const sDeltaPct = sIna > 0 ? (sDelta / sIna) : 0;
      const sShareOfGroup = totalCases > 0 ? (sCases / totalCases) : 0;

      return {
        service,
        cases: sCases,
        ina: sIna,
        idrg: sIdrg,
        delta: sDelta,
        deltaPct: sDeltaPct,
        share: sShareOfGroup,
        compDist,
        competentCount: compDist[1] + compDist[2] + compDist[3] + compDist[4],
        topHosp
      };
    }).sort((a, b) => b.cases - a.cases);

    const provMap = {};
    allMuhammadiyah.forEach(h => {
      const p = h.province || 'Lainnya';
      if (!provMap[p]) {
        provMap[p] = { province: p, rsCount: 0, cases: 0, ina: 0, idrg: 0, hospitals: [] };
      }
      provMap[p].rsCount++;
      provMap[p].cases += h.total ? h.total[CASES] : 0;
      provMap[p].ina += h.total ? h.total[INA] : 0;
      provMap[p].idrg += h.total ? h.total[IDRG] : 0;
      provMap[p].hospitals.push(h);
    });

    const provSummary = Object.values(provMap).map(p => {
      const delta = p.idrg - p.ina;
      const deltaPct = p.ina > 0 ? (delta / p.ina) : 0;
      const share = totalCases > 0 ? (p.cases / totalCases) : 0;
      const topHosp = p.hospitals.sort((a, b) => (b.total ? b.total[CASES] : 0) - (a.total ? a.total[CASES] : 0))[0];
      return { ...p, delta, deltaPct, share, topHosp };
    }).sort((a, b) => b.cases - a.cases);

    const provinceOptions = Object.keys(provCounts).sort().map(p => 
      `<option value="${escapeHtml(p)}" ${muhammadiyahState.provFilter === p ? 'selected' : ''}>${escapeHtml(p)} (${provCounts[p]} RS)</option>`
    ).join("");

    container.innerHTML = `
      <!-- TOP KPI CARDS -->
      <div class="muhammadiyah-kpis">
        <article class="kpi-card is-highlight">
          <div class="kpi-label" style="color: #047857; font-weight: 800;">TOTAL RS JEJARING</div>
          <div class="kpi-value" style="color: #065f46; font-size: 20px; font-weight: 900;">${allMuhammadiyah.length} RS</div>
          <div class="kpi-note" style="color: #047857;">${totalProvinces} Provinsi (131 Faskes RSMA)</div>
        </article>
        <article class="kpi-card">
          <div class="kpi-label">TOTAL KASUS GROUP</div>
          <div class="kpi-value" style="font-size: 20px; font-weight: 900; color: #1e293b;">${formatNumber(totalCases)}</div>
          <div class="kpi-note">Mirroring Uji Coba iDRG</div>
        </article>
        <article class="kpi-card">
          <div class="kpi-label">TOTAL PENDAPATAN INA-CBG</div>
          <div class="kpi-value" style="font-size: 20px; font-weight: 900; color: #1e293b;">${formatMoney(totalIna)}</div>
          <div class="kpi-note">Tarif Eksisting Klaim</div>
        </article>
        <article class="kpi-card">
          <div class="kpi-label">TOTAL POTENSI iDRG</div>
          <div class="kpi-value" style="font-size: 20px; font-weight: 900; color: #0284c7;">${formatMoney(totalIdrg)}</div>
          <div class="kpi-note">Potensi Klaim Era Baru</div>
        </article>
        <article class="kpi-card is-highlight">
          <div class="kpi-label" style="color: #047857; font-weight: 800;">POTENSI SELISIH (DELTA)</div>
          <div class="kpi-value ${totalDelta >= 0 ? 'delta-positive' : 'delta-negative'}" style="font-size: 20px; font-weight: 900;">
            ${totalDelta >= 0 ? '+' : ''}${formatMoney(totalDelta)}
          </div>
          <div class="kpi-note" style="color: #047857; font-weight: 700;">
            ${totalDeltaPct >= 0 ? '▲ +' : '▼ '}${formatPercent(totalDeltaPct)} vs INA-CBG
          </div>
        </article>
      </div>

      <!-- TABS HEADER -->
      <div class="muhammadiyah-tabs">
        <button type="button" class="muhammadiyah-tab-btn ${muhammadiyahState.activeTab === 'hospitals' ? 'is-active' : ''}" data-tab="hospitals">
          <span>🏢</span> Rincian Per Rumah Sakit (${filteredHospitals.length}/${allMuhammadiyah.length} RS Terdata)
        </button>
        <button type="button" class="muhammadiyah-tab-btn ${muhammadiyahState.activeTab === 'services' ? 'is-active' : ''}" data-tab="services">
          <span>🩺</span> Rincian Per Kelompok Layanan (24 Layanan)
        </button>
        <button type="button" class="muhammadiyah-tab-btn ${muhammadiyahState.activeTab === 'provinces' ? 'is-active' : ''}" data-tab="provinces">
          <span>🗺️</span> Rincian Berdasarkan Regional Provinsi (${provSummary.length} Provinsi)
        </button>
        <button type="button" class="muhammadiyah-tab-btn ${muhammadiyahState.activeTab === 'registry' ? 'is-active' : ''}" data-tab="registry">
          <span>📋</span> Master Registry RSMA (131 Faskes Resmi)
        </button>
      </div>

      <!-- TAB CONTENT AREA -->
      <div class="muhammadiyah-tab-body" style="flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px;">
        ${muhammadiyahState.activeTab === 'hospitals' ? renderHospitalsTabHtml(filteredHospitals, provinceOptions, totalCases) : ''}
        ${muhammadiyahState.activeTab === 'services' ? renderServicesTabHtml(serviceSummary, totalCases) : ''}
        ${muhammadiyahState.activeTab === 'provinces' ? renderProvincesTabHtml(provSummary, totalCases) : ''}
        ${muhammadiyahState.activeTab === 'registry' ? renderRegistryTabHtml(provinceOptions) : ''}
      </div>
    `;

    attachMuhammadiyahEvents(container);
  }


    window.showMuhammadiyahMapSlide = function() {
    const slides = [...document.querySelectorAll(".slide")];
    const targetIndex = slides.findIndex(s => s.classList.contains("muhammadiyah-map-slide"));
    if (targetIndex >= 0) {
      showSlide(targetIndex);
    }
  };

  window.showMuhammadiyahGroupSlide = function() {
    const slides = [...document.querySelectorAll(".slide")];
    const targetIndex = slides.findIndex(s => s.classList.contains("muhammadiyah-group-slide"));
    if (targetIndex >= 0) {
      showSlide(targetIndex);
    }
  };

  window.showNationalMirroringSlide = function(offset = 0) {
    const slides = [...document.querySelectorAll(".slide")];
    const targetIndex = slides.findIndex(s => s.classList.contains("national-rawat-type-slide"));
    if (targetIndex >= 0) {
      showSlide(targetIndex + offset);
    }
  };

  function renderSimulatorSlide() {
    const slide = document.getElementById("simulatorSlide");
    if (!slide) return;
    const target = targetHospital();
    if (!target) return;
    const result = computeScenario();
    const overrideCount = Object.values(state.overrides).filter((item) => item.enabled).length;
    slide.innerHTML = `
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
              ${result.serviceRows.map((row) => `<tr class="${row.service === state.selectedService ? "is-selected" : ""} ${row.competency ? "" : "is-disabled"}"><td><button class="service-button" data-service="${escapeHtml(row.service)}" type="button">${escapeHtml(formatService(row.service))}</button></td><td>${levelBadge(row.competency)}</td><td class="num">${formatNumber(row.existing[CASES])}</td><td class="num">${formatNumber(row.retained[CASES])}</td><td class="num">${formatNumber(row.captured[CASES])}</td><td class="num">${formatNumber(row.projected[CASES])}</td><td class="num ${deltaClass(row.delta[CASES])}">${formatSignedNumber(row.delta[CASES])}</td><td class="num">${formatTableMoney(row.projected[IDRG])}</td><td class="num ${deltaClass(row.delta[IDRG])}">${formatTableMoney(row.delta[IDRG])}</td></tr>`).join("")}
            </tbody></table></div>
          </article>
        </div>
      </div>`;
    attachSimulatorEvents();
  }

  function renderCompetitionSlide() {
    const slide = document.getElementById("competitionSlide");
    if (!slide) return;
    const target = targetHospital();
    if (!target) return;
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

    slide.innerHTML = `
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
            <div class="override-header"><div><strong>Override ${escapeHtml(formatService(service))}</strong><div class="muted" style="font-size: 14px">Menggantikan asumsi global pada simulator</div></div><label><input id="overrideEnabled" type="checkbox" ${override.enabled ? "checked" : ""}> Aktifkan</label></div>
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
            <div class="panel-heading"><h2>RS kompetitor setara yang mampu melayani*</h2><span>${competition.rows.length} RS · minimum ${levelNames[competition.minimumCompetency]}</span></div>
            <div class="table-wrap"><table class="compact-table"><thead><tr><th>#</th><th>Rumah sakit</th><th>Kota</th><th>Kompetensi</th><th class="num">Kasus eksisting</th><th class="num">iDRG</th><th class="num">Share regional</th></tr></thead><tbody>
              ${competition.rows.length ? competition.rows.map((row, index) => `<tr><td>${index + 1}</td><td class="service-name">${escapeHtml(row.hospital.name)}</td><td>${escapeHtml(row.hospital.city)}</td><td>${levelBadge(row.competency)}</td><td class="num">${formatNumber(row.existing[CASES])}</td><td class="num">${formatTableMoney(row.existing[IDRG])}</td><td class="num">${formatPercent(row.share)}</td></tr>`).join("") : `<tr><td colspan="7"><div class="empty-state"><div><strong>Tidak ada RS kompetitor yang memenuhi kemampuan ini.</strong><span>Pilih layanan atau tingkat keparahan lain.</span></div></div></td></tr>`}
              ${competition.outsideCapable[CASES] > 0 ? `<tr class="is-disabled"><td>—</td><td class="service-name">Kasus pada RS di luar kelompok kompetitor setara</td><td>Regional</td><td><span class="level-badge level-0">Di luar kriteria</span></td><td class="num">${formatNumber(competition.outsideCapable[CASES])}</td><td class="num">${formatTableMoney(competition.outsideCapable[IDRG])}</td><td class="num">${formatPercent(competition.regional[CASES] ? competition.outsideCapable[CASES] / competition.regional[CASES] : 0)}</td></tr>` : ""}
            </tbody></table></div>
          </article>
        </div>
      </div>`;
    attachCompetitionEvents();
  }

  function renderSummarySlide() {
    const slide = document.getElementById("summarySlide");
    if (!slide) return;
    const target = targetHospital();
    if (!target) return;
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
    slide.innerHTML = `
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

  // --- SLIDE: RENTANG SKENARIO SELURUH LAYANAN ---
  function renderRecapSlide() {
    const container = document.getElementById("recapSlide");
    if (!container) return;

    const target = targetHospital();
    if (!target) return;
    
    const formatSignedPercent = (val) => {
      if (val === 0 || isNaN(val)) return "0%";
      const sign = val > 0 ? "+" : "";
      return sign + (val * 100).toFixed(2).replace('.', ',') + "%";
    };
    
    let htmlHeader = `
      <div class="table-container" style="max-height: 480px; overflow-y: auto;">
        <table class="scenario-table" style="table-layout: auto; width: 100%; min-width: 1400px;">
          <thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.15);">
            <tr>
              <th rowspan="2" style="background-color: #0f766e; color: white;">No</th>
              <th rowspan="2" style="background-color: #0f766e; color: white; text-align: left;">Layanan</th>
              <th rowspan="2" style="background-color: #0f766e; color: white;">Komp.</th>
              <th rowspan="2" style="background-color: #1e293b; color: white;">Eksisting Kasus<br><span style="font-size:10px; font-weight:normal;">(Sebelum Dikurangi)</span></th>
              <th colspan="2" style="background-color: #be123c; color: white; text-align: center;">Dampak Pengurangan<br><span style="font-size: 10px; font-weight: normal;">(Keluar dari RS target)</span></th>
              <th colspan="2" style="background-color: #16a34a; color: white; text-align: center;">Dampak Penambahan<br><span style="font-size: 10px; font-weight: normal;">(Capture dari Kompetitor)</span></th>
              <th colspan="2" style="background-color: #0369a1; color: white; text-align: center;">Net +/- (Penambahan - Pengurangan)</th>
              <th rowspan="2" style="background-color: #0891b2; color: white;">Sisa Kasus & Pendapatan<br><span style="font-size:10px; font-weight:normal;">(Eksisting - Kurang)</span></th>
              <th rowspan="2" style="background-color: #1e40af; color: white;">PASCA KASUS<br><span style="font-size:10px; font-weight:normal;">(Sisa + Tambah)</span><br>& % Retensi</th>
              <th rowspan="2" style="background-color: #1e40af; color: white;">PENDAPATAN<br>PASCA RBKP<br>(Rp. M)</th>
              <th rowspan="2" style="background-color: #0f766e; color: white;">% Kenaikan thd<br>INA-CBG Awal</th>
            </tr>
            <tr>
              <th style="background-color: #e11d48; color: white; font-size: 11px;">- Kasus Keluar</th>
              <th style="background-color: #e11d48; color: white; font-size: 11px;">- Pendapatan Hilang</th>
              <th style="background-color: #22c55e; color: white; font-size: 11px;">+ Kasus Baru</th>
              <th style="background-color: #22c55e; color: white; font-size: 11px;">+ Potensi Pendapatan</th>
              <th style="background-color: #0284c7; color: white; font-size: 11px;">+/- Jml Kasus</th>
              <th style="background-color: #0284c7; color: white; font-size: 11px;">+/- Net Rp (M)</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    let rowsHtml = [];
    
    const formatCell = (minVal, maxVal, isRp) => {
      if (minVal === 0 && maxVal === 0) return `<span style="color:#cbd5e1;">-</span>`;
      const isMinNeg = minVal < 0;
      const isMaxNeg = maxVal < 0;
      const color = (isMinNeg && isMaxNeg) ? "#b91c1c" : ((minVal > 0 || maxVal > 0) ? "#15803d" : "#334155");
      const signMin = minVal > 0 ? "+" : (minVal < 0 ? "-" : "");
      const signMax = maxVal > 0 ? "+" : (maxVal < 0 ? "-" : "");
      
      let textMin = isRp ? formatMoney(Math.abs(minVal)).replace("Rp", "").trim() : formatNumber(Math.abs(minVal));
      let textMax = isRp ? formatMoney(Math.abs(maxVal)).replace("Rp", "").trim() : formatNumber(Math.abs(maxVal));
      
      if (isRp) {
        textMin = (Math.abs(minVal)/1000000000).toFixed(2).replace('.', ',') + " M";
        textMax = (Math.abs(maxVal)/1000000000).toFixed(2).replace('.', ',') + " M";
      }
      
      if (minVal === maxVal) {
        return `<span style="color:${color}; font-weight:700;">${signMin}${textMin}</span>`;
      } else {
        return `<span style="color:${color}; font-weight:700;">${signMin}${textMin} <span style="color:#94a3b8; font-weight:normal; font-size: 10px;">s.d</span> ${signMax}${textMax}</span>`;
      }
    };

    let grandEksKasus = 0;
    let grandEksIna = 0;
    let grandMinKk = 0, grandMaxKk = 0;
    let grandMinKrp = 0, grandMaxKrp = 0;
    let grandMinTk = 0, grandMaxTk = 0;
    let grandMinTrp = 0, grandMaxTrp = 0;
    let grandMinNetK = 0, grandMaxNetK = 0;
    let grandMinNetRp = 0, grandMaxNetRp = 0;
    let grandMinSisaK = 0, grandMaxSisaK = 0;
    let grandMinSisaRp = 0, grandMaxSisaRp = 0;
    let grandMinPascaK = 0, grandMaxPascaK = 0;
    let grandMinPascaRp = 0, grandMaxPascaRp = 0;

    
    let competitorCount = 0;
    let compCountD = 0;
    let compCountM = 0;
    let compCountU = 0;
    let compCountP = 0;
    let targetServiceSelect = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
    
    // Compute Regional Cases for the target service(s)
    const activeServices = targetServiceSelect === 'ALL' ? data.services : (data.services.includes(targetServiceSelect) ? [targetServiceSelect] : []);
    const regTotalD = {cases: 0, rp: 0};
    const regTotalM = {cases: 0, rp: 0};
    const regTotalU = {cases: 0, rp: 0};
    const regTotalP = {cases: 0, rp: 0};
    
    activeServices.forEach(svc => {
      const s = data.regional?.services?.[svc];
      if (!s) return;
      const sD = severityMetric(s, 1);
      const sM = severityMetric(s, 2);
      const sU = severityMetric(s, 3);
      const sP = severityMetric(s, 4);
      
      regTotalD.cases += sD[CASES] || 0; regTotalD.rp += sD[IDRG] || 0;
      regTotalM.cases += sM[CASES] || 0; regTotalM.rp += sM[IDRG] || 0;
      regTotalU.cases += sU[CASES] || 0; regTotalU.rp += sU[IDRG] || 0;
      regTotalP.cases += sP[CASES] || 0; regTotalP.rp += sP[IDRG] || 0;
    });

    (function(){
      targetServiceSelect = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
      const servicesToSimulate = targetServiceSelect === 'ALL' ? data.services : (data.services.includes(targetServiceSelect) ? [targetServiceSelect] : []);
      
      // Compute Competitor count for the badge
      competitorCount = 0;
      compCountD = 0;
      compCountM = 0;
      compCountU = 0;
      compCountP = 0;
      
      data.hospitals.forEach(h => {
        if (h.code === targetHospital()?.code) return;
        
        if (targetServiceSelect !== 'ALL') {
          const hComp = getCompetency(h, targetServiceSelect);
          if (hComp && hComp > 0) {
            competitorCount++;
            if (hComp === 1) compCountD++;
            if (hComp === 2) compCountM++;
            if (hComp === 3) compCountU++;
            if (hComp === 4) compCountP++;
          }
        } else {
          competitorCount++;
          data.services.forEach(svc => {
            const hComp = getCompetency(h, svc);
            if (hComp === 1) compCountD++;
            else if (hComp === 2) compCountM++;
            else if (hComp === 3) compCountU++;
            else if (hComp === 4) compCountP++;
          });
        }
      });
      
      const compBadge = document.getElementById('globalSimCompetitorBadge');
      const compVal = document.getElementById('globalSimCompetitorValue');
      if (compBadge && compVal) {
        if (targetServiceSelect === 'ALL') {
          compBadge.querySelector('div').innerText = 'KOMPETENSI LAYANAN';
          compVal.innerHTML = `${competitorCount}`;
        } else {
          compBadge.querySelector('div').innerText = 'KOMPETENSI LAYANAN';
          compVal.innerHTML = `${competitorCount}`;
        }
      }
      
      return servicesToSimulate;
    })().forEach((service, idx) => {
      const tHospSvc = target.services[service];
      const targetCompetency = tHospSvc ? (tHospSvc.competency || 0) : 0;
      
      const calcResult = window.computeServiceScenarios(
        service, target, data, state, CASES, INA, IDRG, severityMetric, getLevelRules,
        window.getSimMode ? window.getSimMode() : 'regional_all', getCompetency
      );
      
      const tKasus = calcResult.existingKasus;
      const existingIna = calcResult.existingIna;
      const existingIdrg = calcResult.existingIdrg || 0;
      
      const allKk = [], allKrp = [], allTk = [], allTrp = [];
      const allNetK = [], allNetRp = [];
      const allSisaK = [], allSisaRp = [];
      const allPascaK = [], allPascaRp = [];
      const allPctRp = [], allPctRetensi = [];
      
      calcResult.scnEvals.forEach(scnEval => {
        allKk.push(scnEval.totalKurangKasus);
        allKrp.push(scnEval.totalKurangRp);
        allTk.push(scnEval.totalTambahKasus);
        allTrp.push(scnEval.totalTambahRp);
        allNetK.push(scnEval.netKasus);
        allNetRp.push(scnEval.netRp);
        allSisaK.push(scnEval.sisaKasus);
        allSisaRp.push(scnEval.sisaIdrg);
        allPascaK.push(scnEval.pascaKasus);
        allPascaRp.push(scnEval.pascaRp);
        allPctRp.push(existingIna ? ((scnEval.pascaRp - existingIna) / existingIna) : 0);
        allPctRetensi.push(tKasus ? (scnEval.pascaKasus / tKasus) : 0);
      });

      if (allKk.length === 0) {
        allKk.push(0); allKrp.push(0); allTk.push(0); allTrp.push(0);
        allNetK.push(0); allNetRp.push(0);
        allSisaK.push(tKasus); allSisaRp.push(existingIdrg);
        allPascaK.push(tKasus); allPascaRp.push(existingIdrg);
        allPctRp.push(0); allPctRetensi.push(1);
      }
      
      const minKk = Math.min(...allKk), maxKk = Math.max(...allKk);
      const minKrp = Math.min(...allKrp), maxKrp = Math.max(...allKrp);
      const minTk = Math.min(...allTk), maxTk = Math.max(...allTk);
      const minTrp = Math.min(...allTrp), maxTrp = Math.max(...allTrp);
      const minNetK = Math.min(...allNetK), maxNetK = Math.max(...allNetK);
      const minNetRp = Math.min(...allNetRp), maxNetRp = Math.max(...allNetRp);
      const minSisaK = Math.min(...allSisaK), maxSisaK = Math.max(...allSisaK);
      const minSisaRp = Math.min(...allSisaRp), maxSisaRp = Math.max(...allSisaRp);
      const minPascaK = Math.min(...allPascaK), maxPascaK = Math.max(...allPascaK);
      const minPascaRp = Math.min(...allPascaRp), maxPascaRp = Math.max(...allPascaRp);
      const minPctRp = Math.min(...allPctRp), maxPctRp = Math.max(...allPctRp);
      const minPctRetensi = Math.min(...allPctRetensi), maxPctRetensi = Math.max(...allPctRetensi);
      
      grandEksKasus += tKasus;
      grandEksIna += existingIna;
      grandMinKk += minKk; grandMaxKk += maxKk;
      grandMinKrp += minKrp; grandMaxKrp += maxKrp;
      grandMinTk += minTk; grandMaxTk += maxTk;
      grandMinTrp += minTrp; grandMaxTrp += maxTrp;
      grandMinNetK += minNetK; grandMaxNetK += maxNetK;
      grandMinNetRp += minNetRp; grandMaxNetRp += maxNetRp;
      grandMinSisaK += minSisaK; grandMaxSisaK += maxSisaK;
      grandMinSisaRp += minSisaRp; grandMaxSisaRp += maxSisaRp;
      grandMinPascaK += minPascaK; grandMaxPascaK += maxPascaK;
      grandMinPascaRp += minPascaRp; grandMaxPascaRp += maxPascaRp;
      
      rowsHtml.push(`
        <tr>
          <td style="color: #94a3b8; font-size: 13px;">${idx + 1}</td>
          <td style="text-align: left; font-weight: 600; font-size: 13px; white-space:nowrap;">${escapeHtml(formatService(service))}</td>
          <td style="font-size: 13px;">${levelBadge(targetCompetency)}</td>
          
          <td style="text-align: center; font-weight: 700; color: #1e293b;">
            <div>${formatNumber(tKasus)}</div>
            <div style="font-size: 10px; color: #64748b; font-weight: 500;">${formatTableMoney(existingIna)}</div>
          </td>
          
          <td style="background:#fff1f2; white-space:nowrap; text-align:center;">${formatCell(-maxKk, -minKk, false)}</td>
          <td style="background:#fff1f2; white-space:nowrap; text-align:center;">${formatCell(-maxKrp, -minKrp, true)}</td>
          
          <td style="background:#f0fdf4; white-space:nowrap; text-align:center;">${formatCell(minTk, maxTk, false)}</td>
          <td style="background:#f0fdf4; white-space:nowrap; text-align:center;">${formatCell(minTrp, maxTrp, true)}</td>
          
          <td style="background:#f0f9ff; white-space:nowrap; text-align:center;">${formatCell(minNetK, maxNetK, false)}</td>
          <td style="background:#f0f9ff; white-space:nowrap; text-align:center;">${formatCell(minNetRp, maxNetRp, true)}</td>
          
          <td style="background:#ffffff; white-space:nowrap; text-align:center;">
            <div style="font-weight:700; color:#0369a1;">${formatCell(minSisaK, maxSisaK, false).replace('+','')}</div>
            <div style="font-size:11px;">${formatCell(minSisaRp, maxSisaRp, true).replace('+','')}</div>
          </td>
          
          <td style="background:#eff6ff; white-space:nowrap; text-align:center;">
            <div style="font-weight:800; color:#1d4ed8; font-size:14px;">${formatCell(minPascaK, maxPascaK, false).replace('+','')}</div>
            <div style="font-size:11px; font-weight:700; color:#2563eb;">${minPctRetensi === maxPctRetensi ? formatSignedPercent(minPctRetensi) : formatSignedPercent(minPctRetensi) + ' <span style="color:#94a3b8; font-size:9px; font-weight:normal;">s.d</span> ' + formatSignedPercent(maxPctRetensi)}</div>
          </td>
          
          <td style="background:#eff6ff; white-space:nowrap; text-align:center; font-weight:800; color:#1e40af;">
            ${formatCell(minPascaRp, maxPascaRp, true).replace('+','')}
          </td>
          
          <td style="background:#ffffff; white-space:nowrap; text-align:center;">
            ${minPctRp === maxPctRp 
                ? `<span style="color:${minPctRp >= 0 ? "#15803d" : "#b91c1c"}; font-weight:800; font-size:14px;">${formatSignedPercent(minPctRp)}</span>`
                : `<span style="color:${minPctRp >= 0 ? "#15803d" : "#b91c1c"}; font-weight:800; font-size:13px;">${formatSignedPercent(minPctRp)}</span> <br> <span style="color:#94a3b8; font-size: 10px;">s.d</span> <span style="color:${maxPctRp >= 0 ? "#15803d" : "#b91c1c"}; font-weight:800; font-size:13px;">${formatSignedPercent(maxPctRp)}</span>`
             }
          </td>
        </tr>
      `);
    });
    
    const minGrandPctRp = grandEksIna ? ((grandMinPascaRp - grandEksIna) / grandEksIna) : 0;
    const maxGrandPctRp = grandEksIna ? ((grandMaxPascaRp - grandEksIna) / grandEksIna) : 0;
    
    let htmlFooter = `
        <tr style="font-weight: bold; background-color: #e2e8f0; font-size: 13px;">
          <td colspan="3" style="text-align: right; padding-right: 12px; color: #0f172a;">Total Seluruh Layanan</td>
          
          <td style="text-align: center; font-weight: 800; color: #1e293b;">
            <div>${formatNumber(grandEksKasus)}</div>
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">${formatTableMoney(grandEksIna)}</div>
          </td>
          
          <td style="background:#fff1f2; white-space:nowrap; text-align:center;">${formatCell(-grandMaxKk, -grandMinKk, false)}</td>
          <td style="background:#fff1f2; white-space:nowrap; text-align:center;">${formatCell(-grandMaxKrp, -grandMinKrp, true)}</td>
          
          <td style="background:#f0fdf4; white-space:nowrap; text-align:center;">${formatCell(grandMinTk, grandMaxTk, false)}</td>
          <td style="background:#f0fdf4; white-space:nowrap; text-align:center;">${formatCell(grandMinTrp, grandMaxTrp, true)}</td>
          
          <td style="background:#f0f9ff; white-space:nowrap; text-align:center;">${formatCell(grandMinNetK, grandMaxNetK, false)}</td>
          <td style="background:#f0f9ff; white-space:nowrap; text-align:center;">${formatCell(grandMinNetRp, grandMaxNetRp, true)}</td>
          
          <td style="background:#ffffff; white-space:nowrap; text-align:center;">
            <div style="font-weight:800; color:#0369a1;">${formatCell(grandMinSisaK, grandMaxSisaK, false).replace('+','')}</div>
            <div style="font-size:11px;">${formatCell(grandMinSisaRp, grandMaxSisaRp, true).replace('+','')}</div>
          </td>
          
          <td style="background:#eff6ff; white-space:nowrap; text-align:center;">
            <div style="font-weight:900; color:#1d4ed8; font-size:14px;">${formatCell(grandMinPascaK, grandMaxPascaK, false).replace('+','')}</div>
          </td>
          
          <td style="background:#eff6ff; white-space:nowrap; text-align:center; font-weight:900; color:#1e40af;">
            ${formatCell(grandMinPascaRp, grandMaxPascaRp, true).replace('+','')}
          </td>
          
          <td style="background:#ffffff; white-space:nowrap; text-align:center;">
            ${minGrandPctRp === maxGrandPctRp 
                ? `<span style="color:${minGrandPctRp >= 0 ? "#15803d" : "#b91c1c"}; font-weight:800; font-size:14px;">${formatSignedPercent(minGrandPctRp)}</span>`
                : `<span style="color:${minGrandPctRp >= 0 ? "#15803d" : "#b91c1c"}; font-weight:800; font-size:13px;">${formatSignedPercent(minGrandPctRp)}</span> <br> <span style="color:#94a3b8; font-size: 10px;">s.d</span> <span style="color:${maxGrandPctRp >= 0 ? "#15803d" : "#b91c1c"}; font-weight:800; font-size:13px;">${formatSignedPercent(maxGrandPctRp)}</span>`
             }
          </td>
        </tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top: 10px; font-size: 13px; color: #4e5d59; font-style: italic; line-height: 1.5; background: #f4f8f7; padding: 6px 10px; border-radius: 6px; border: 1px solid #d9e5e2;">
        <div>* Warna <strong>Hijau</strong> menandakan potensi penambahan (capture) dari RS kompetitor; warna <strong>Merah</strong> menandakan potensi kehilangan (loss) karena kasus dikembalikan.</div>
        <div>* % Kenaikan thd INA-CBG dihitung dari (Proyeksi Tambahan iDRG - Pengurangan INA-CBG) / Eksisting INA-CBG.</div>
      </div>
    `;
    
    const partSize = Math.ceil(rowsHtml.length / 3);
    const html1 = htmlHeader + rowsHtml.slice(0, partSize).join("") + `</tbody></table></div>`;
    const html2 = htmlHeader + rowsHtml.slice(partSize, partSize * 2).join("") + `</tbody></table></div>`;
    const html3 = htmlHeader + rowsHtml.slice(partSize * 2).join("") + htmlFooter;
    
    document.getElementById("recapSlide").innerHTML = html1;
    const slide2 = document.getElementById("recapSlide2");
    if (slide2) slide2.innerHTML = html2;
    const slide3 = document.getElementById("recapSlide3");
    if (slide3) slide3.innerHTML = html3;
  }

  function renderLogicalRecapSlide() {
    const target = targetHospital();
    const container = document.getElementById("logicalRecapSlide");
    if (!target || !container) return;
    
    const formatSignedPercent = (val) => {
      if (val === 0 || isNaN(val)) return "0%";
      const sign = val > 0 ? "+" : "";
      return sign + (val * 100).toFixed(2).replace('.', ',') + "%";
    };

    const levelBadgeShort = (lvl) => {
      const names = { 1: "Dasar", 2: "Madya", 3: "Utama", 4: "Paripurna" };
      return names[lvl] || `L${lvl}`;
    };
    
    let grandEksKasus = 0;
    let grandEksIna = 0;
    let grandEksIdrg = 0;
    let grandKurangKasus = 0;
    let grandKurangRp = 0;
    let grandTambahKasus = 0;
    let grandTambahRp = 0;
    let grandNetKasus = 0;
    let grandNetRp = 0;
    let grandSisaKasus = 0;
    let grandSisaRp = 0;
    let grandPascaKasus = 0;
    let grandPascaRp = 0;
    let safeCount = 0;
    
    const rows = [];
    
    
    let competitorCount = 0;
    let compCountD = 0;
    let compCountM = 0;
    let compCountU = 0;
    let compCountP = 0;
    let targetServiceSelect = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
    
    // Compute Regional Cases for the target service(s)
    const activeServices = targetServiceSelect === 'ALL' ? data.services : (data.services.includes(targetServiceSelect) ? [targetServiceSelect] : []);
    const regTotalD = {cases: 0, rp: 0};
    const regTotalM = {cases: 0, rp: 0};
    const regTotalU = {cases: 0, rp: 0};
    const regTotalP = {cases: 0, rp: 0};
    
    activeServices.forEach(svc => {
      const s = data.regional?.services?.[svc];
      if (!s) return;
      const sD = severityMetric(s, 1);
      const sM = severityMetric(s, 2);
      const sU = severityMetric(s, 3);
      const sP = severityMetric(s, 4);
      
      regTotalD.cases += sD[CASES] || 0; regTotalD.rp += sD[IDRG] || 0;
      regTotalM.cases += sM[CASES] || 0; regTotalM.rp += sM[IDRG] || 0;
      regTotalU.cases += sU[CASES] || 0; regTotalU.rp += sU[IDRG] || 0;
      regTotalP.cases += sP[CASES] || 0; regTotalP.rp += sP[IDRG] || 0;
    });

    (function(){
      targetServiceSelect = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
      const servicesToSimulate = targetServiceSelect === 'ALL' ? data.services : (data.services.includes(targetServiceSelect) ? [targetServiceSelect] : []);
      
      // Compute Competitor count for the badge
      competitorCount = 0;
      compCountD = 0;
      compCountM = 0;
      compCountU = 0;
      compCountP = 0;
      
      data.hospitals.forEach(h => {
        if (h.code === targetHospital()?.code) return;
        
        if (targetServiceSelect !== 'ALL') {
          const hComp = getCompetency(h, targetServiceSelect);
          if (hComp && hComp > 0) {
            competitorCount++;
            if (hComp === 1) compCountD++;
            if (hComp === 2) compCountM++;
            if (hComp === 3) compCountU++;
            if (hComp === 4) compCountP++;
          }
        } else {
          competitorCount++;
          data.services.forEach(svc => {
            const hComp = getCompetency(h, svc);
            if (hComp === 1) compCountD++;
            else if (hComp === 2) compCountM++;
            else if (hComp === 3) compCountU++;
            else if (hComp === 4) compCountP++;
          });
        }
      });
      
      const compBadge = document.getElementById('globalSimCompetitorBadge');
      const compVal = document.getElementById('globalSimCompetitorValue');
      if (compBadge && compVal) {
        if (targetServiceSelect === 'ALL') {
          compBadge.querySelector('div').innerText = 'KOMPETENSI LAYANAN';
          compVal.innerHTML = `${competitorCount}`;
        } else {
          compBadge.querySelector('div').innerText = 'KOMPETENSI LAYANAN';
          compVal.innerHTML = `${competitorCount}`;
        }
      }
      
      return servicesToSimulate;
    })().forEach((service, idx) => {
      const tHospSvc = target.services[service];
      const svcData = data.regional.services[service];
      const tSvcTotal = tHospSvc ? tHospSvc.total : [0,0,0];
      
      const tKasus = tSvcTotal[CASES] || 0;
      const existingIna = tSvcTotal[INA] || 0;
      const existingIdrg = tSvcTotal[IDRG] || 0;
      
      const targetCompetency = tHospSvc ? (tHospSvc.competency || 0) : 0;
      
      if (!state.serviceScenarios || !state.serviceScenarios[service]) {
        state.serviceScenarios = state.serviceScenarios || {};
        state.serviceScenarios[service] = generateDefaultServiceScenarios(service, target, targetCompetency);
      }
      
      const calcResult = window.computeServiceScenarios(
        service, target, data, state, CASES, INA, IDRG, severityMetric, getLevelRules,
        window.getSimMode ? window.getSimMode() : 'regional_all', getCompetency
      );
      
      const chosen = Object.assign({}, calcResult.chosen);
      
      chosen.tk = chosen.totalTambahKasus;
      chosen.trp = chosen.totalTambahRp;
      chosen.kk = chosen.totalKurangKasus;
      chosen.krp = chosen.totalKurangRp;
      chosen.sisaK = chosen.sisaKasus;
      chosen.sisaRp = chosen.sisaIdrg;
      chosen.pascaK = chosen.pascaKasus;
      chosen.pascaRp = chosen.pascaRp;
      chosen.netK = chosen.netKasus;
      
      const rules = getLevelRules(targetCompetency, service);
      let paramStr = '';
      rules.tambah.forEach(lvl => {
        if (chosen.scn.hasOwnProperty("tambah_" + lvl)) {
          paramStr += `+${chosen.scn["tambah_" + lvl]}% ${levelBadgeShort(lvl)} `;
        }
      });
      chosen.index = chosen.idx + 1;
      chosen.paramStr = paramStr.trim();
      
      const tD = tHospSvc ? severityMetric(tHospSvc, 1)[CASES] : 0;
      const tM = tHospSvc ? severityMetric(tHospSvc, 2)[CASES] : 0;
      const tU = tHospSvc ? severityMetric(tHospSvc, 3)[CASES] : 0;
      const tP = tHospSvc ? severityMetric(tHospSvc, 4)[CASES] : 0;
      
      let bHtml = '';
      if (tD > 0) bHtml += `<div>D: ${formatNumber(tD)}</div>`;
      if (tM > 0) bHtml += `<div>M: ${formatNumber(tM)}</div>`;
      if (tU > 0) bHtml += `<div>U: ${formatNumber(tU)}</div>`;
      if (tP > 0) bHtml += `<div>P: ${formatNumber(tP)}</div>`;
      const eksBreakdownHtml = bHtml ? `<div style="font-size: 10px; color: #64748b; font-weight: 500; margin-top: 4px; line-height: 1.2;">${bHtml}</div>` : '';
      
      let sD = tD, sM = tM, sU = tU, sP = tP;
      if (chosen.scn.hasOwnProperty('kurang_1')) sD = tD - (calcResult.basePengurangan[1][0] * (chosen.scn['kurang_1'] / 100));
      if (chosen.scn.hasOwnProperty('kurang_2')) sM = tM - (calcResult.basePengurangan[2][0] * (chosen.scn['kurang_2'] / 100));
      if (chosen.scn.hasOwnProperty('kurang_3')) sU = tU - (calcResult.basePengurangan[3][0] * (chosen.scn['kurang_3'] / 100));
      if (chosen.scn.hasOwnProperty('kurang_4')) sP = tP - (calcResult.basePengurangan[4][0] * (chosen.scn['kurang_4'] / 100));
      
      let sHtml = '';
      if (sD > 0) sHtml += `<div>D: ${formatNumber(sD)}</div>`;
      if (sM > 0) sHtml += `<div>M: ${formatNumber(sM)}</div>`;
      if (sU > 0) sHtml += `<div>U: ${formatNumber(sU)}</div>`;
      if (sP > 0) sHtml += `<div>P: ${formatNumber(sP)}</div>`;
      const sisaBreakdownHtml = sHtml ? `<div style="font-size: 10px; color: #0284c7; font-weight: 500; margin-top: 4px; line-height: 1.2;">${sHtml}</div>` : '';
      
      if (chosen.isSafe) {
        safeCount++;
      }
      
      grandEksKasus += tKasus;
      grandEksIna += existingIna;
      grandEksIdrg += existingIdrg;
      grandKurangKasus += chosen.kk;
      grandKurangRp += chosen.krp;
      grandTambahKasus += chosen.tk;
      grandTambahRp += chosen.trp;
      grandNetKasus += chosen.netK;
      grandNetRp += chosen.netRp;
      grandSisaKasus += chosen.sisaK;
      grandSisaRp += chosen.sisaRp;
      grandPascaKasus += chosen.pascaK;
      grandPascaRp += chosen.pascaRp;
      
      const pctPascaIna = existingIna ? ((chosen.pascaRp - existingIna) / existingIna) : 0;
      const pctNetKasus = tKasus ? (chosen.netK / tKasus) : 0;
      const pctRetensi = tKasus ? (chosen.pascaK / tKasus) : 0;
      
      rows.push({
        idx: idx + 1,
        service,
        targetCompetency,
        chosen,
        tKasus,
        existingIna,
        existingIdrg,
        pctPascaIna,
        pctNetKasus,
        pctRetensi,
        eksBreakdownHtml,
        sisaBreakdownHtml
      });
    });
    
    const pctGrandPascaIna = grandEksIna ? ((grandPascaRp - grandEksIna) / grandEksIna) : 0;
    const pctGrandNetKasus = grandEksKasus ? (grandNetKasus / grandEksKasus) : 0;
    const pctGrandRetensi = grandEksKasus ? (grandPascaKasus / grandEksKasus) : 0;
    
    let htmlHeader = `
      <div style="display: flex; gap: 12px; margin-bottom: 12px;">
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Kasus Pasca RBKP (Optimal)</div>
          <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 2px;">
            <span style="font-size: 20px; font-weight: 800; color: #0f172a;">${formatNumber(grandPascaKasus)}</span>
            <span style="font-size: 11.5px; color: ${grandPascaKasus <= grandEksKasus ? '#15803d' : '#b91c1c'}; font-weight: 700;">(${formatPercent(pctGrandRetensi)} dari ${formatNumber(grandEksKasus)} eksisting)</span>
          </div>
        </div>

        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0d9488; border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Proyeksi Pendapatan Pasca RBKP</div>
          <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 2px;">
            <span style="font-size: 20px; font-weight: 800; color: #0f766e;">${(grandPascaRp / 1e9).toFixed(2).replace('.', ',')} M</span>
            <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">(Eksisting INA: ${(grandEksIna / 1e9).toFixed(2).replace('.', ',')} M)</span>
          </div>
        </div>

        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ${grandNetRp >= 0 ? '#15803d' : '#b91c1c'}; border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Dampak Bersih Net (+/-) Pendapatan</div>
          <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 2px;">
            <span style="font-size: 20px; font-weight: 800; color: ${grandNetRp >= 0 ? '#15803d' : '#b91c1c'};">${grandNetRp > 0 ? '+' : ''}${(grandNetRp / 1e9).toFixed(2).replace('.', ',')} M</span>
            <span style="font-size: 11.5px; color: ${pctGrandPascaIna >= 0 ? '#15803d' : '#b91c1c'}; font-weight: 700;">(${formatSignedPercent(pctGrandPascaIna)})</span>
          </div>
        </div>

        <div style="flex: 1.1; background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Kesesuaian Beban & Kapasitas</div>
          <div style="font-size: 12px; color: #14532d; font-weight: 700; margin-top: 4px; line-height: 1.2;">
            🎯 <b>${safeCount}/${rows.length} Layanan</b> 100% terkendali dalam batas kapasitas eksisting awal.
          </div>
        </div>
      </div>

      <div class="table-container" style="max-height: 480px; overflow-y: auto;">
        <table class="scenario-table" style="table-layout: auto; width: 100%; min-width: 1250px; font-size: 12px;">
          <thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <tr style="font-size: 11.5px;">
              <th style="background-color: #0d9488; color: white; padding: 6px 4px;">No</th>
              <th style="background-color: #0d9488; color: white; text-align: left; padding: 6px 8px;">Layanan</th>
              <th style="background-color: #0d9488; color: white; padding: 6px 4px;">Komp.</th>
              <th style="background-color: #0284c7; color: white; padding: 6px 6px;">Skenario Terpilih</th>
              <th style="background-color: #334155; color: white; padding: 6px 6px;">Kasus Eksisting</th>
              <th style="background-color: #e11d48; color: white; padding: 6px 6px;">Pengurangan (-)</th>
              <th style="background-color: #0891b2; color: white; padding: 6px 6px;">Sisa Eksisting</th>
              <th style="background-color: #16a34a; color: white; padding: 6px 6px;">Tambahan (+)</th>
              <th style="background-color: #b45309; color: white; padding: 6px 6px;">Proyeksi Kasus Pasca</th>
              <th style="background-color: #b45309; color: white; padding: 6px 6px;">Pendapatan Pasca RBKP</th>
              <th style="background-color: #475569; color: white; padding: 6px 6px;">Net Kasus (+/-)</th>
              <th style="background-color: #475569; color: white; padding: 6px 6px;">Net Rp (+/-)</th>
              <th style="background-color: #475569; color: white; padding: 6px 6px;">% vs INA-CBG</th>
              <th style="background-color: #334155; color: white; padding: 6px 6px;">Status Kapasitas</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    let rowsHtml = [];
    rows.forEach(r => {
      const c = r.chosen;
      const netRpColor = c.netRp > 0 ? '#15803d' : (c.netRp < 0 ? '#b91c1c' : '#334155');
      const netKColor = c.netK > 0 ? '#15803d' : (c.netK < 0 ? '#b91c1c' : '#334155');
      const pctPascaColor = r.pctPascaIna > 0 ? '#15803d' : (r.pctPascaIna < 0 ? '#b91c1c' : '#334155');
      
      const statusBadge = c.isSafe 
        ? `<span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10.5px; display: inline-flex; align-items: center; gap: 3px;">✅ Aman (≤ Eksisting)</span>`
        : `<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10.5px; display: inline-flex; align-items: center; gap: 3px;">🟡 Konservatif (Skenario 1)</span>`;
      
      rowsHtml.push(`
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px; background-color: #ffffff;">
          <td style="color: #64748b; text-align: center; padding: 5px 4px;">${r.idx}</td>
          <td style="text-align: left; font-weight: 600; color: #1e293b; padding: 5px 8px; white-space: nowrap;">${escapeHtml(formatService(r.service))}</td>
          <td style="text-align: center; padding: 5px 4px;">${levelBadge(r.targetCompetency)}</td>
          <td style="text-align: center; padding: 5px 6px; background-color: #fff7ed;">
            <div style="font-weight: 800; color: #c2410c; background: #ffedd5; border: 1px solid #fed7aa; padding: 2px 6px; border-radius: 4px; display: inline-block;">
              ⚡ Skenario ${c.index}
            </div>
            <div style="font-size: 10px; color: #9a3412; font-weight: 600; margin-top: 2px;">${c.paramStr}</div>
          </td>
          <td style="text-align: center; font-weight: 700; color: #1e293b; padding: 5px 6px;">
            <div>${formatNumber(r.tKasus)}</div>
            ${r.eksBreakdownHtml}
          </td>
          <td style="text-align: center; color: #b91c1c; padding: 5px 6px; background: #fff1f2;">
            <div>-${formatNumber(c.kk)}</div>
            <div style="font-size: 10.5px; font-weight: 600;">-${(c.krp/1e9).toFixed(2).replace('.', ',')} M</div>
          </td>
          <td style="text-align: center; color: #0891b2; font-weight: 700; padding: 5px 6px; background: #ecfeff;">
            <div>${formatNumber(c.sisaK)}</div>
            <div style="font-size: 10.5px;">${(c.sisaRp/1e9).toFixed(2).replace('.', ',')} M</div>
            ${r.sisaBreakdownHtml}
          </td>
          <td style="text-align: center; color: #15803d; padding: 5px 6px; background: #f0fdf4;">
            <div>+${formatNumber(c.tk)}</div>
            <div style="font-size: 10.5px; font-weight: 600;">+${(c.trp/1e9).toFixed(2).replace('.', ',')} M</div>
          </td>
          <td style="text-align: center; font-weight: 800; color: #92400e; padding: 5px 6px; background: #fffbeb;">
            <div>${formatNumber(c.pascaK)}</div>
            <div style="font-size: 10px; color: ${c.pascaK <= r.tKasus ? '#16a34a' : '#ea580c'}; font-weight: 700;">${formatPercent(r.pctRetensi)}</div>
          </td>
          <td style="text-align: center; font-weight: 800; color: ${c.pascaRp < 0 ? '#b91c1c' : '#92400e'}; padding: 5px 6px; background: #fffbeb;">
            ${(c.pascaRp/1e9).toFixed(2).replace('.', ',')} M
          </td>
          <td style="text-align: center; font-weight: 700; color: ${netKColor}; padding: 5px 6px; background: #f8fafc;">
            ${c.netK > 0 ? '+' : ''}${formatNumber(c.netK)}
            <div style="font-size: 10px; font-weight: normal;">(${formatSignedPercent(r.pctNetKasus)})</div>
          </td>
          <td style="text-align: center; font-weight: 700; color: ${netRpColor}; padding: 5px 6px; background: #f8fafc;">
            ${c.netRp > 0 ? '+' : ''}${(c.netRp/1e9).toFixed(2).replace('.', ',')} M
          </td>
          <td style="text-align: center; font-weight: 700; color: ${pctPascaColor}; padding: 5px 6px; background: #f8fafc;">
            ${formatSignedPercent(r.pctPascaIna)}
          </td>
          <td style="text-align: center; padding: 5px 6px;">
            ${statusBadge}
          </td>
        </tr>
      `);
    });
    
    let htmlFooter = `
        <tr style="font-weight: bold; background-color: #e2e8f0; font-size: 12.5px; border-top: 2px solid #0d9488;">
          <td colspan="4" style="text-align: right; padding: 8px 10px; color: #0f172a; font-weight: 800;">TOTAL SELURUH LAYANAN (OPTIMAL & LOGIS)</td>
          <td style="text-align: center; padding: 8px 6px; font-weight: 800; color: #0f172a;">${formatNumber(grandEksKasus)}</td>
          <td style="text-align: center; padding: 8px 6px; color: #b91c1c; background: #ffe4e6;">
            <div>-${formatNumber(grandKurangKasus)}</div>
            <div style="font-size: 11px;">-${(grandKurangRp/1e9).toFixed(2).replace('.', ',')} M</div>
          </td>
          <td style="text-align: center; padding: 8px 6px; color: #15803d; background: #dcfce7;">
            <div>+${formatNumber(grandTambahKasus)}</div>
            <div style="font-size: 11px;">+${(grandTambahRp/1e9).toFixed(2).replace('.', ',')} M</div>
          </td>
          <td style="text-align: center; padding: 8px 6px; color: ${grandNetKasus >= 0 ? '#15803d' : '#b91c1c'}; font-weight: 800;">
            ${grandNetKasus > 0 ? '+' : ''}${formatNumber(grandNetKasus)}
            <div style="font-size: 10.5px; font-weight: normal;">(${formatSignedPercent(pctGrandNetKasus)})</div>
          </td>
          <td style="text-align: center; padding: 8px 6px; color: ${grandNetRp >= 0 ? '#15803d' : '#b91c1c'}; font-weight: 800; background: #f1f5f9;">
            ${grandNetRp > 0 ? '+' : ''}${(grandNetRp/1e9).toFixed(2).replace('.', ',')} M
          </td>
          <td style="text-align: center; padding: 8px 6px; color: #0d9488; font-weight: 800; background: #ccfbf1;">
            <div>${formatNumber(grandSisaKasus)}</div>
            <div style="font-size: 11px;">${(grandSisaRp/1e9).toFixed(2).replace('.', ',')} M</div>
          </td>
          <td style="text-align: center; padding: 8px 6px; font-weight: 900; color: #1e40af; background: #dbeafe;">
            <div>${formatNumber(grandPascaKasus)}</div>
            <div style="font-size: 10.5px; color: #166534; font-weight: 800;">${formatPercent(pctGrandRetensi)}</div>
          </td>
          <td style="text-align: center; padding: 8px 6px; font-weight: 900; color: #0f766e; background: #dbeafe;">
            ${(grandPascaRp/1e9).toFixed(2).replace('.', ',')} M
          </td>
          <td style="text-align: center; padding: 8px 6px; font-weight: 800; color: ${pctGrandPascaIna >= 0 ? '#15803d' : '#b91c1c'};">
            ${formatSignedPercent(pctGrandPascaIna)}
          </td>
          <td style="text-align: center; padding: 8px 6px; color: #166534; font-weight: 800;">
            100% Teroptimasi
          </td>
        </tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top: 10px; font-size: 13px; color: #4e5d59; font-style: italic; line-height: 1.5; background: #f4f8f7; padding: 6px 10px; border-radius: 6px; border: 1px solid #d9e5e2;">
        <div>* <strong>Skenario Aman/Logis</strong>: Sistem mencari tingkat skenario tertinggi (Net Pendapatan paling besar) dimana <strong>Pasca Kasus ≤ Kasus Eksisting</strong>, agar RS tidak overload. Jika di Skenario 1 pun Pasca Kasus sudah melebihi Eksisting, sistem akan menandainya 🟡 Konservatif.</div>
      </div>
    `;
    
    const partSize = Math.ceil(rowsHtml.length / 3);
    const html1 = htmlHeader + rowsHtml.slice(0, partSize).join("") + `</tbody></table></div>`;
    const html2 = htmlHeader + rowsHtml.slice(partSize, partSize * 2).join("") + `</tbody></table></div>`;
    const html3 = htmlHeader + rowsHtml.slice(partSize * 2).join("") + htmlFooter;
    
    container.innerHTML = html1;
    const lslide2 = document.getElementById("logicalRecapSlide2");
    if (lslide2) lslide2.innerHTML = html2;
    const lslide3 = document.getElementById("logicalRecapSlide3");
    if (lslide3) lslide3.innerHTML = html3;
  }



  function recalculateTotals() {
    const processItem = (item) => {
      if (!item) return;
      if (!item.originalTotal && item.total) item.originalTotal = [...item.total];
      if (!item.originalTotal) return;
      
      if (state.excludeUnmapped && item.unclassified) {
        item.total = item.originalTotal.map((val, idx) => Math.max(0, val - (item.unclassified[idx] || 0)));
      } else {
        item.total = [...item.originalTotal];
      }
    };
    
    data.hospitals.forEach(h => {
      processItem(h);
      if (h.services) {
        Object.values(h.services).forEach(s => processItem(s));
      }
    });
    
    if (data.regional) {
      processItem(data.regional);
      if (data.regional.services) {
        Object.values(data.regional.services).forEach(s => processItem(s));
      }
    }
  }
  function updateTargetMeta() {
    const target = targetHospital();
    document.getElementById("targetMeta").innerHTML = `<strong>${escapeHtml(target.city || "Lokasi tidak tersedia")}</strong><span>Kelas ${escapeHtml(target.class || "—")} · kode ${escapeHtml(target.code)} · ${formatNumber(target.total[CASES])} kasus</span>`;
  }

  function renderScenarioSlide() {
    const target = targetHospital();
    if (!target) return;
    
    if (!state.serviceScenarios) state.serviceScenarios = {};
    
    const availableServices = data.services
      .filter(service => getCompetency(target, service) > 0 || service.toLowerCase().includes('forensik'))
      .sort((a, b) => {
        const casesA = target.services[a] && target.services[a].total ? target.services[a].total[CASES] : 0;
        const casesB = target.services[b] && target.services[b].total ? target.services[b].total[CASES] : 0;
        return casesB - casesA;
      });

    const rows = [];
    let globalExistingKasus = 0;
    let globalExistingRp = 0;
    
    let tableDataRows = [];

    availableServices.forEach((service) => {
      const targetCompetency = getCompetency(target, service);
      
      
      const targetSvc = target.services[service];
      const existingKasus = targetSvc ? targetSvc.total[CASES] || 0 : 0;
      const existingIna = targetSvc ? targetSvc.total[INA] || 0 : 0;
      const existingIdrg = targetSvc ? targetSvc.total[IDRG] || 0 : 0;
      globalExistingKasus += existingKasus;
      globalExistingRp += existingIna;
      
      const regionalSvc = data.regional.services[service];
      const rules = getLevelRules(targetCompetency, service);
      
      const competitorsList = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= Math.max(1, targetCompetency));
      const utamaCompetitors = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= 4).length;

      if (!state.serviceScenarios[service] || state.serviceScenarios[service].length === 0) {
        state.serviceScenarios[service] = generateDefaultServiceScenarios(service, target, targetCompetency);
      }

      const calcResult = window.computeServiceScenarios(service, target, data, state, CASES, INA, IDRG, severityMetric, getLevelRules,
        window.getSimMode ? window.getSimMode() : 'regional_all', getCompetency);
      const scnEvals = calcResult.scnEvals;
      const scenarios = state.serviceScenarios[service];
      
      const allTambahK = scnEvals.map(s => s.tambahK);
      const allTambahRp = scnEvals.map(s => s.tambahRp);
      const allKurangK = scnEvals.map(s => s.kurangK);
      const allKurangRp = scnEvals.map(s => s.kurangRp);
      const allNetK = scnEvals.map(s => s.netK);
      const allNetRp = scnEvals.map(s => s.netRp);
      const allPascaRbkp = scnEvals.map(s => s.pascaRp);
      
      const minTK = Math.min(...allTambahK), maxTK = Math.max(...allTambahK);
      const minTRp = Math.min(...allTambahRp), maxTRp = Math.max(...allTambahRp);
      const minKK = Math.min(...allKurangK), maxKK = Math.max(...allKurangK);
      const minKRp = Math.min(...allKurangRp), maxKRp = Math.max(...allKurangRp);
      const minNetK = Math.min(...allNetK), maxNetK = Math.max(...allNetK);
      const minNetRp = Math.min(...allNetRp), maxNetRp = Math.max(...allNetRp);
      const minPasca = Math.min(...allPascaRbkp), maxPasca = Math.max(...allPascaRbkp);
      
      const minKenaikanPct = existingIna ? ((minPasca - existingIna) / existingIna) : 0;
      const maxKenaikanPct = existingIna ? ((maxPasca - existingIna) / existingIna) : 0;
      
      let targetStringHTML = '';
      [4, 3, 2, 1].forEach(lvl => {
        if (rules.tambah.includes(lvl)) {
           let minVal = Math.min(...scenarios.map(s => s['tambah_'+lvl] || 0));
           let maxVal = Math.max(...scenarios.map(s => s['tambah_'+lvl] || 0));
           let lvlName = levelNames[lvl];
           targetStringHTML += `<div style="margin-bottom:2px;">✅ ${lvlName}: ${minVal}% &rarr; ${maxVal}%</div>`;
        }
      });
      targetStringHTML += `<div style="font-size: 12px; color:#64748b; margin-top:2px;">(Berdasar Skenario 1-6)</div>`;

      tableDataRows.push({
        service: service,
        competency: levelNames[targetCompetency],
        baseIna: existingIna,
        targetString: targetStringHTML,
        minTK, maxTK,
        minTRp, maxTRp,
        minKK, maxKK,
        minKRp, maxKRp,
        minNetK, maxNetK,
        minNetRp, maxNetRp,
        minPasca, maxPasca,
        minKenaikanPct, maxKenaikanPct,
        utamaCompetitors: utamaCompetitors
      });
    });
    
    tableDataRows.sort((a, b) => b.maxNetRp - a.maxNetRp);
    
    tableDataRows.forEach((r, idx) => {
      let priorityText = '';
      if (idx === 0) priorityText = `🏆 #1 Strategic`;
      else if (idx === 1) priorityText = `⭐ #2 Strategic`;
      else if (idx === 2) priorityText = `⭐ #3 Strategic`;
      else priorityText = `#${idx+1}`;
      
      rows.push(`
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <td style="text-align: center; vertical-align: middle; font-weight: bold; color: #475569; padding: 8px 4px;">${idx + 1}</td>
          <td style="text-align: left; vertical-align: top; padding: 8px;">
            <div style="font-weight: 600; color: #1e293b;">${formatService(r.service)}</div>
            <div style="font-size: 12px; color: #3b82f6; margin-top: 2px; font-weight: 500;">(${r.competency})</div>
          </td>
          <td style="text-align: left; vertical-align: top; padding: 8px; font-size: 12px; line-height: 1.4; color: #334155;">
            ${r.targetString}
          </td>
          <td style="vertical-align: middle; text-align: center; color: #047857; background-color: #f0fdf4;">
            +${formatNumber(r.minTK)} &rarr; +${formatNumber(r.maxTK)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: #047857; font-weight: 600; background-color: #dcfce7;">
            +${formatMatrixMoney(r.minTRp)} &rarr; +${formatMatrixMoney(r.maxTRp)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: #b91c1c; background-color: #fef2f2;">
            -${formatNumber(r.minKK)} &rarr; -${formatNumber(r.maxKK)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: #b91c1c; font-weight: 600; background-color: #fee2e2;">
            -${formatMatrixMoney(r.minKRp)} &rarr; -${formatMatrixMoney(r.maxKRp)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: ${r.minNetK < 0 ? '#b91c1c' : '#047857'}; background-color: #f0f9ff;">
            ${formatSignedNumber(r.minNetK)} &rarr; ${formatSignedNumber(r.maxNetK)}
          </td>
          <td style="vertical-align: middle; text-align: center; color: ${r.minNetRp < 0 ? '#b91c1c' : '#047857'}; font-weight: 600; background-color: #e0f2fe;">
            ${r.minNetRp > 0 ? '+' : ''}${formatMatrixMoney(r.minNetRp)} &rarr; ${r.maxNetRp > 0 ? '+' : ''}${formatMatrixMoney(r.maxNetRp)}
          </td>
          <td style="vertical-align: middle; text-align: center; font-weight: 600; color: #1e293b;">${formatMatrixMoney(r.baseIna)}</td>
          <td style="vertical-align: middle; text-align: center; font-weight: 700; color: ${r.maxPasca < 0 ? '#b91c1c' : (r.minPasca < 0 ? '#b91c1c' : '#0f766e')};">${formatMatrixMoney(r.minPasca)} &rarr; ${formatMatrixMoney(r.maxPasca)}</td>
          <td style="vertical-align: middle; text-align: center; font-weight: 600; background-color: #ffffff;">
            <span style="color: ${r.minKenaikanPct < 0 ? '#dc2626' : '#16a34a'}">${r.minKenaikanPct > 0 ? '+' : ''}${formatPercent(r.minKenaikanPct)}</span> &rarr;
            <span style="color: ${r.maxKenaikanPct < 0 ? '#dc2626' : '#16a34a'}">${r.maxKenaikanPct > 0 ? '+' : ''}${formatPercent(r.maxKenaikanPct)}</span>
          </td>
          <td style="vertical-align: middle; text-align: center; padding: 8px; border-left: 1px dashed #cbd5e1;">
            <div style="font-weight: 700; font-size: 13px; color: ${idx < 3 ? '#d97706' : '#475569'};">${priorityText}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">(${r.utamaCompetitors} kompetitor Utama)</div>
          </td>
        </tr>
      `);
    });

    const deltaIdrg = target.total[IDRG] - target.total[INA];
    const deltaPercentIdrg = target.total[INA] ? deltaIdrg / target.total[INA] : 0;
    
    document.getElementById("scenarioSlide").innerHTML = `
      <div class="existing-report-kpis" style="margin-bottom: 15px;">
        <article class="existing-report-kpi kpi-cases"><span>Total Kasus:</span><strong>${formatNumber(target.total[CASES])}</strong><em>Jumlah kasus eklaim</em></article>
        <article class="existing-report-kpi kpi-ina"><span>Pendapatan INA CBGs:</span><strong>${formatMoney(target.total[INA])}</strong><em>Dari data 8 bulan</em></article>
        <article class="existing-report-kpi kpi-idrg"><span>Pendapatan INACBG:</span><strong>${formatMoney(target.total[IDRG])}</strong><em>Klaim uji coba iDRG</em></article>
        <article class="existing-report-kpi kpi-difference ${deltaIdrg < 0 ? "is-loss" : "is-gain"}"><span>Selisih Pendapatan:</span><strong>${formatMoney(deltaIdrg)}</strong><em>iDRG - INA CBGs</em></article>
        <article class="existing-report-kpi kpi-percentage ${deltaIdrg < 0 ? "is-loss" : "is-gain"}"><span>Persentase:</span><strong>${formatPercent(deltaPercentIdrg)}</strong><em>Dari Pendapatan INACBG</em></article>
      </div>
      
      <div style="margin-bottom: 12px; font-weight: 600; color: #1e293b; font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
        Laporan Rekapitulasi Potensi Skenario Berdasarkan Kompetensi Layanan
        <div style="font-size: 14px; font-weight: 400; color: #64748b; margin-top: 4px;">Rangkuman proyeksi rentang (Low &rarr; High) dari seluruh 6 skenario. Diurutkan berdasarkan Max Proyeksi Tambahan Pendapatan (Strategi Terbaik).</div>
      </div>
      
      <div class="table-container" style="max-height: 400px; overflow-y: auto;">
        <table class="scenario-table" style="table-layout: auto; width: 100%; border-collapse: collapse;">
          <thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              <th rowspan="2" style="width: 30px; text-align: center; background-color: #1e293b; color: white; padding: 6px 4px; font-size: 13px;">No</th>
              <th rowspan="2" style="width: 140px; text-align: left; background-color: #0f766e; color: white; padding: 6px; font-size: 13px;">Layanan (Kompetensi)</th>
              <th rowspan="2" style="width: 110px; text-align: left; background-color: #475569; color: white; padding: 6px; font-size: 13px;">Rentang Skenario</th>
              <th colspan="2" style="background-color: #22c55e; color: white; padding: 6px; font-size: 12px; text-align: center; border: 1px solid white;">PROYEKSI TAMBAHAN (Low &rarr; High)</th>
              <th colspan="2" style="background-color: #dc2626; color: white; padding: 6px; font-size: 12px; text-align: center; border: 1px solid white;">PROYEKSI PENGURANGAN (Low &rarr; High)</th>
              <th colspan="2" style="background-color: #0ea5e9; color: white; padding: 6px; font-size: 12px; text-align: center; border: 1px solid white;">NET +/- (Low &rarr; High)</th>
              <th rowspan="2" style="width: 80px; text-align: center; background-color: #16a085; color: white; padding: 6px; font-size: 12px; border: 1px solid white;">PENDAPATAN<br>EKSISTING Dengan iDRG<br>(Rp. M)</th>
              <th rowspan="2" style="width: 90px; text-align: center; background-color: #16a085; color: white; padding: 6px; font-size: 12px; border: 1px solid white;">PENDAPATAN<br>PASCA RBKP<br>(Low &rarr; High)</th>
              <th rowspan="2" style="width: 80px; text-align: center; background-color: #16a085; color: white; padding: 6px; font-size: 12px; border: 1px solid white;">% KENAIKAN<br>PENDAPATAN</th>
              <th rowspan="2" style="width: 80px; text-align: center; background-color: #ea580c; color: white; padding: 6px; font-size: 13px;">Prioritas Strategis</th>
            </tr>
            <tr>
              <th style="background-color: #4ade80; color: white; padding: 6px; font-size: 12px; text-align: center; border: 1px solid white; width: 70px;">Kasus</th>
              <th style="background-color: #4ade80; color: white; padding: 6px; font-size: 12px; text-align: center; border: 1px solid white; width: 80px;">Rp M</th>
              <th style="background-color: #f87171; color: white; padding: 6px; font-size: 12px; text-align: center; border: 1px solid white; width: 70px;">Kasus</th>
              <th style="background-color: #f87171; color: white; padding: 6px; font-size: 12px; text-align: center; border: 1px solid white; width: 80px;">Rp M</th>
              <th style="background-color: #38bdf8; color: white; padding: 6px; font-size: 12px; text-align: center; border: 1px solid white; width: 70px;">Kasus</th>
              <th style="background-color: #38bdf8; color: white; padding: 6px; font-size: 12px; text-align: center; border: 1px solid white; width: 80px;">Rp M</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join('')}
          </tbody>
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
    
    // Extract available services for the target hospital, sorted by total cases descending
    const availableServices = data.services
      .filter(service => getCompetency(target, service) > 0 || service.toLowerCase().includes('forensik'))
      .sort((a, b) => {
        const casesA = target.services[a] && target.services[a].total ? target.services[a].total[CASES] : 0;
        const casesB = target.services[b] && target.services[b].total ? target.services[b].total[CASES] : 0;
        return casesB - casesA;
      });
    
    let html = "";
    
    availableServices.forEach((service, idx) => {
      const targetCompetency = getCompetency(target, service);
      // Hitung kompetitor (RS lain yang punya kompetensi >= targetCompetency)
      const competitorsList = data.hospitals.filter(h => h.code !== target.code && getCompetency(h, service) >= Math.max(1, targetCompetency));
      const competitors = competitorsList.length;
      let competitorHtml = '';
      if (competitors > 0) {
        const groups = { 4: [], 3: [], 2: [], 1: [] };
        competitorsList.forEach(h => groups[getCompetency(h, service)].push(h));
        
        let colsHtml = '';
        [4, 3, 2, 1].forEach(lvl => {
          if (groups[lvl].length > 0) {
            const badgeColor = lvl === 4 ? 'background: #fdf4ff; color: #a21caf; border: 1px solid #f5d0fe;' : 
                               lvl === 3 ? 'background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa;' : 
                               lvl === 2 ? 'background: #fefce8; color: #a16207; border: 1px solid #fef08a;' : 
                                           'background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4;';
            const limit = 4;
            const shownHospitals = groups[lvl].slice(0, limit);
            const hiddenCount = groups[lvl].length - limit;
            
            let badgesHTML = shownHospitals.map(h => `<span style="font-size: 12px; padding: 2px 6px; border-radius: 4px; ${badgeColor} white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${escapeHtml(h.name)}</span>`).join('');
            if (hiddenCount > 0) {
              badgesHTML += `<span style="font-size: 12px; padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">+ ${hiddenCount} lainnya</span>`;
            }
            
            colsHtml += `
              <div style="display: flex; flex-direction: column; align-items: flex-end; min-width: max-content; flex: 1;">
                <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase;">${levelNames[lvl]} (${groups[lvl].length} RS)</div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end;">
                  ${badgesHTML}
                </div>
              </div>
            `;
          }
        });
        competitorHtml = `<div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: flex-end; padding-right: 4px; margin-top: 6px; max-width: 100%;">${colsHtml}</div>`;
      } else {
        competitorHtml = `<div style="font-size: 14px; color: var(--muted); margin-top: 2px;">Tidak ada kompetitor</div>`;
      }
      
      // Hitung Persentase Default
      if (!state.serviceScenarios[service] || state.serviceScenarios[service].length === 0) {
        state.serviceScenarios[service] = generateDefaultServiceScenarios(service, target, targetCompetency);
      }
      
      const targetExistingService = target.services[service] ? target.services[service].total : [0, 0, 0];
      const regionalExistingService = data.regional.services[service] ? data.regional.services[service].total : [0, 0, 0];
      
      const targetKasus = targetExistingService[CASES];
      const regionalKasus = regionalExistingService[CASES];
      const targetIna = targetExistingService[INA];
      const targetIdrg = targetExistingService[IDRG];
      const regionalIna = regionalExistingService[INA];
      const regionalIdrg = regionalExistingService[IDRG];
      
      const potensiRegional = regionalIdrg - regionalIna;
      const selisih = potensiRegional - targetIdrg;
      
      const targetSvc = target.services[service];
      const targetKasusArr = targetSvc ? targetSvc.total : [0,0,0];
      const existingKasus = targetKasusArr[CASES] || 0;
      const existingIna = targetKasusArr[INA] || 0;
      const existingIdrg = targetKasusArr[IDRG] || 0;
      
      const calcResult = window.computeServiceScenarios(
        service, target, data, state, CASES, INA, IDRG, severityMetric, getLevelRules,
        window.getSimMode ? window.getSimMode() : 'regional_all', getCompetency
      );
      
      const { baseTambahan, basePengurangan, scnEvals: scnMetrics, chosenIdx: mostLogicalScenarioIndex } = calcResult;
      console.log('[DEBUG Skenario Logis]', service, '-> chosenIdx:', mostLogicalScenarioIndex, '| safeCount:', scnMetrics.filter(s=>s.isSafe).length, '| scnCount:', scnMetrics.length, '| scenarios in state:', (state.serviceScenarios[service]||[]).length);
      
      const formatMatrixMoneyJT = formatTableMoney;
      const targetSvcRef = target.services[service];
      const regionalSvcRef = data.regional.services[service];

      const tD = targetSvcRef ? severityMetric(targetSvcRef, 1)[CASES] : 0;
      const tM = targetSvcRef ? severityMetric(targetSvcRef, 2)[CASES] : 0;
      const tU = targetSvcRef ? severityMetric(targetSvcRef, 3)[CASES] : 0;
      const tP = targetSvcRef ? severityMetric(targetSvcRef, 4)[CASES] : 0;

      const rD = regionalSvcRef ? severityMetric(regionalSvcRef, 1)[CASES] : 0;
      const rM = regionalSvcRef ? severityMetric(regionalSvcRef, 2)[CASES] : 0;
      const rU = regionalSvcRef ? severityMetric(regionalSvcRef, 3)[CASES] : 0;
      const rP = regionalSvcRef ? severityMetric(regionalSvcRef, 4)[CASES] : 0;

      const generateRow = (index, scn) => {
        let totalTambahKasus = 0;
        let totalTambahRp = 0;
        let totalKurangKasus = 0;
        let totalKurangRp = 0;
        
        const isMostLogical = (index === mostLogicalScenarioIndex);
        const bgRow = isMostLogical ? '#fff7ed' : (index % 2 === 0 ? '#f8fafc' : '#ffffff');
        const outlineRow = isMostLogical ? 'box-shadow: inset 0 0 0 2px #ea580c;' : '';
        const cb = isMostLogical ? 'border: 1px solid #fdba74;' : 'border: 1px solid #e2e8f0;';
        const badge = isMostLogical 
          ? `<div style="margin-top: 3px;"><span style="font-size: 9px; color: #ffffff; background: linear-gradient(135deg, #f97316, #ea580c); padding: 2px 7px; border-radius: 4px; font-weight: 800; text-transform: uppercase; display: inline-flex; align-items: center; gap: 3px; box-shadow: 0 1px 3px rgba(234,88,12,0.4); letter-spacing: 0.3px;">⚡ Paling Logis</span></div>` 
          : '';
        
        // ── PENGURANGAN (shared / rowspan di baris 0) ─────────────────────────────
        let kurangCols = '';
        [4, 3, 2, 1].forEach(lvl => {
          if (scn.hasOwnProperty('kurang_' + lvl)) {
            const pKurang = scn['kurang_' + lvl] / 100;
            const kk = basePengurangan[lvl][0] * pKurang;
            const krp = basePengurangan[lvl][1] * pKurang;
            totalKurangKasus += kk;
            totalKurangRp += krp;
            if (index === 0) {
              const nRows = state.serviceScenarios[service].length;
              kurangCols += `
                <td rowspan="${nRows}" style="border: 1px solid #fecaca; padding: 4px; vertical-align: middle; background-color: #fff5f5;">
                  <input type="number" class="scenario-input dynamic-scenario-input" data-service="${escapeHtml(service)}" data-index="${index}" data-field="kurang_${lvl}" value="${scn['kurang_' + lvl]}" step="0.1" style="width: 52px; padding: 2px; font-size: 13px; text-align: center; border: 1px solid #fca5a5; border-radius: 4px; color: #b91c1c; background: transparent;">
                </td>
                <td rowspan="${nRows}" style="border: 1px solid #fecaca; padding: 4px; font-size: 13px; font-weight: 600; color: #b91c1c; vertical-align: middle; background-color: #fff5f5;">-${formatNumber(kk)}</td>
              `;
            }
          }
        });
        
        // ── TAMBAHAN (per baris skenario) ─────────────────────────────────────────
        let tambahCols = '';
        [4, 3, 2, 1].forEach(lvl => {
          if (scn.hasOwnProperty('tambah_' + lvl)) {
            const pTambah = scn['tambah_' + lvl] / 100;
            const tk = baseTambahan[lvl][0] * pTambah;
            const trp = baseTambahan[lvl][1] * pTambah;
            totalTambahKasus += tk;
            totalTambahRp += trp;
            tambahCols += `
              <td style="${cb} padding: 4px; vertical-align: middle; background-color: ${isMostLogical ? '#f0fdf4' : 'transparent'};">
                <input type="number" class="scenario-input dynamic-scenario-input" data-service="${escapeHtml(service)}" data-index="${index}" data-field="tambah_${lvl}" value="${scn['tambah_' + lvl]}" step="0.1" style="width: 52px; padding: 2px; font-size: 13px; text-align: center; border: 1px solid #86efac; border-radius: 4px; color: #15803d; background: transparent;">
              </td>
              <td style="${cb} padding: 4px; font-size: 13px; font-weight: 600; color: #15803d; vertical-align: middle;">+${formatNumber(tk)}</td>
              <td style="${cb} padding: 4px; font-size: 12px; color: #15803d; vertical-align: middle;">${formatMatrixMoneyJT(trp)}</td>
            `;
          }
        });
        
        // ── DERIVED VALUES ────────────────────────────────────────────────────────
        const sisaKasus = existingKasus - totalKurangKasus;
        const sisaIdrg  = existingIdrg  - totalKurangRp;
        const pascaKasus = sisaKasus + totalTambahKasus;
        const pascaRbkp  = sisaIdrg  + totalTambahRp;
        const netKasus   = totalTambahKasus - totalKurangKasus;
        const netRp      = totalTambahRp - totalKurangRp;
        const pctKenaikan = existingIna ? ((pascaRbkp - existingIna) / existingIna) : 0;
        const isSafeRow  = (existingKasus === 0) || (pascaKasus <= existingKasus);
        const safeIcon   = isSafeRow ? '<span style="color:#15803d;font-size:11px;"> ✅</span>' : '<span style="color:#b91c1c;font-size:11px;"> ⚠️</span>';
        
        let eksBreakdownHtml = '';
        if (index === 0) {
          let bHtml = '';
          if (tD > 0) bHtml += `<div>D: ${formatNumber(tD)}</div>`;
          if (tM > 0) bHtml += `<div>M: ${formatNumber(tM)}</div>`;
          if (tU > 0) bHtml += `<div>U: ${formatNumber(tU)}</div>`;
          if (tP > 0) bHtml += `<div>P: ${formatNumber(tP)}</div>`;
          if (bHtml) {
            eksBreakdownHtml = `<div style="font-size: 10px; color: #64748b; font-weight: 500; margin-top: 4px; line-height: 1.2;">${bHtml}</div>`;
          }
        }
        
        let sD = tD, sM = tM, sU = tU, sP = tP;
        if (scn.hasOwnProperty('kurang_1')) sD = tD - (basePengurangan[1][0] * (scn['kurang_1'] / 100));
        if (scn.hasOwnProperty('kurang_2')) sM = tM - (basePengurangan[2][0] * (scn['kurang_2'] / 100));
        if (scn.hasOwnProperty('kurang_3')) sU = tU - (basePengurangan[3][0] * (scn['kurang_3'] / 100));
        if (scn.hasOwnProperty('kurang_4')) sP = tP - (basePengurangan[4][0] * (scn['kurang_4'] / 100));
        
        let sisaBreakdownHtml = '';
        let sHtml = '';
        if (sD > 0) sHtml += `<div>D: ${formatNumber(sD)}</div>`;
        if (sM > 0) sHtml += `<div>M: ${formatNumber(sM)}</div>`;
        if (sU > 0) sHtml += `<div>U: ${formatNumber(sU)}</div>`;
        if (sP > 0) sHtml += `<div>P: ${formatNumber(sP)}</div>`;
        if (sHtml) {
          sisaBreakdownHtml = `<div style="font-size: 10px; color: #0284c7; font-weight: 500; margin-top: 4px; line-height: 1.2;">${sHtml}</div>`;
        }

        return `<tr style="background-color: ${bgRow}; ${outlineRow}">
          <!-- SKENARIO -->
          <td style="${cb} font-weight: 700; text-align: center; font-size: 13px; padding: 5px 4px; color: ${isMostLogical ? '#c2410c' : '#334155'}; background-color: ${isMostLogical ? '#ffedd5' : 'transparent'};">
            Skenario ${index + 1}
            <div style="font-size: 10px; font-weight: 600; color: ${isMostLogical ? '#ea580c' : '#94a3b8'}; margin-top: 1px; text-transform: uppercase; letter-spacing: 0.3px;">${['Baseline','Konservatif','Moderat','Optimistik','Agresif','Maksimum'][index] || ''}</div>
            ${badge}
          </td>
          <!-- EKSISTING (rowspan) -->
          ${index === 0 ? `
          <td rowspan="${state.serviceScenarios[service].length}" style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; vertical-align: middle; background: #f1f5f9;">
            <div style="font-size: 13px; font-weight: 700; color: #1e293b;">${formatNumber(existingKasus)}</div>
            ${eksBreakdownHtml}
          </td>
          <td rowspan="${state.serviceScenarios[service].length}" style="border: 1px solid #cbd5e1; font-size: 12px; padding: 5px; text-align: center; vertical-align: middle; background: #f1f5f9; color: #334155;">${formatMatrixMoneyJT(existingIdrg)}</td>
          ` : ''}
          <!-- PENGURANGAN -->
          ${kurangCols}
          <!-- SISA -->
          <td style="border: 1px solid #bae6fd; padding: 5px; text-align: center; vertical-align: middle; background: #f0f9ff;">
            <div style="font-size: 13px; font-weight: 700; color: #0369a1;">${formatNumber(sisaKasus)}</div>
            ${sisaBreakdownHtml}
          </td>
          <td style="border: 1px solid #bae6fd; font-size: 12px; padding: 5px; text-align: center; vertical-align: middle; background: #f0f9ff; color: #0369a1;">${formatMatrixMoneyJT(sisaIdrg)}</td>
          <!-- TAMBAHAN -->
          ${tambahCols}
          <!-- PASCA KASUS & PENDAPATAN -->
          <td style="${cb} font-size: 13px; padding: 4px; font-weight: 700; color: ${isSafeRow ? '#b45309' : '#b91c1c'}; background-color: ${isMostLogical ? '#fffbeb' : 'transparent'};">${formatNumber(pascaKasus)}${safeIcon}</td>
          <td style="${cb} font-size: 13px; padding: 4px; font-weight: 800; color: ${pascaRbkp < 0 ? '#b91c1c' : '#92400e'}; background-color: ${isMostLogical ? '#ffedd5' : 'transparent'};">Rp ${formatMatrixMoneyJT(pascaRbkp)}</td>
          <!-- NET +/- -->
          <td style="${cb} font-size: 13px; padding: 4px; color: ${netKasus > 0 ? '#15803d' : (netKasus < 0 ? '#b91c1c' : '#334155')}; font-weight: 700;">${netKasus > 0 ? '+' : ''}${formatNumber(netKasus)}</td>
          <td style="${cb} font-size: 12px; padding: 4px; color: ${netRp > 0 ? '#15803d' : (netRp < 0 ? '#b91c1c' : '#334155')}; font-weight: 700;">${netRp > 0 ? '+' : ''}${formatMatrixMoneyJT(netRp)}<br><span style="font-size: 10px; font-weight: 600; color: ${pctKenaikan > 0 ? '#15803d' : (pctKenaikan < 0 ? '#b91c1c' : '#94a3b8')};">${pctKenaikan > 0 ? '+' : ''}${formatPercent(pctKenaikan)}</span></td>
        </tr>`;
      };
      
      const totalTargetCases = targetKasusArr[CASES] || 0;
      const totalRegionalCases = data.regional.services[service]?.total?.[CASES] || 0;
      const competitorsCount = data.hospitals.filter((h) => h.code !== target.code && getCompetency(h, service) >= targetCompetency).length;

      const opportunityInsight =
        totalRegionalCases > 0
          ? `Peluang pasar regional di bidang ini mencapai <b>${formatNumber(totalRegionalCases)} kasus</b>.`
          : `Pasar regional belum mencatat volume kasus signifikan.`;
          
      const riskInsight =
        totalTargetCases > 0
          ? ` RS target saat ini memegang <b>${formatNumber(totalTargetCases)} kasus</b>.`
          : ` RS target belum memiliki basis kasus eksisting.`;

      const competitionInsight =
        competitorsCount > 0
          ? `Terdapat <b>${competitorsCount} RS pesaing</b> se-level/setingkat lebih tinggi di wilayah ini.`
          : `Tidak ada pesaing langsung se-level di wilayah ini (peluang dominasi tinggi).`;

      const highestRevenueNet = mostLogicalScenarioIndex >= 0 && scnMetrics[mostLogicalScenarioIndex] ? scnMetrics[mostLogicalScenarioIndex].netRp : 0;

      const scenarioInsight =
        mostLogicalScenarioIndex >= 0
          ? `Skenario ${mostLogicalScenarioIndex + 1} memberikan potensi net pendapatan terbaik yang logis`
          : `Belum ada skenario yang aman/logis untuk dipilih.`;

      const formatNetMoneyUnit = formatTableMoney;

      const highestRevenueNote =
        highestRevenueNet > 0
          ? ` (+<b>${formatNetMoneyUnit(highestRevenueNet)}</b>).`
          : ` (berpotensi penurunan).`;

      const formatMoneyM = (val) => {
        const absVal = Math.abs(val || 0);
        if (absVal >= 1e12) {
          return (absVal / 1e12).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " T";
        }
        if (absVal >= 1e9) {
          return (absVal / 1e9).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M";
        }
        if (absVal >= 1e6) {
          return (absVal / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " JT";
        }
        return absVal.toLocaleString('id-ID');
      };

      html += `
        <section class="slide service-sim-slide" data-slide="${9 + idx}" aria-labelledby="dynamicSlide${idx}Title" style="padding: 0; background-color: #fff;">
          <div style="background-color: #16a085; border-bottom: 8px solid #f1c40f; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <h1 id="dynamicSlide${idx}Title" style="color: white; font-size: 22px; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Simulasi Kasus Market Share - ${escapeHtml(service)}</h1>
            <div style="background-color: #e74c3c; color: white; border-radius: 99px; padding: 6px 14px; text-align: center; font-size: 11.5px; font-weight: 700; box-shadow: 0 2px 4px rgba(0,0,0,0.2); line-height: 1.2; flex-shrink: 0;">
              Data Mirroring Uji Coba iDRG<br><span style="font-weight: 400; font-size: 10.5px;">periode 15 Okt 2025 - 14 Juni 2026</span>
            </div>
          </div>
          <div class="slide-content" style="padding: 16px 24px; overflow-y: auto;">
            
            <div style="display: flex; align-items: stretch; gap: 12px; margin-bottom: 16px;">
              
              <!-- EKSISTING RS -->
              <div style="flex: 1; border: 1px solid #e2e8f0; border-top: 4px solid #0ea5e9; border-radius: 8px; overflow: hidden; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="padding: 12px; display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #e0f2fe;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="font-size: 40px; background: #e0f2fe; border-radius: 8px; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;">🏥</div>
                    <div style="color: #0369a1; font-weight: 800; font-size: 18px; line-height: 1.1;">EKSISTING<br>RUMAH SAKIT</div>
                  </div>
                  <div style="text-align: center; padding: 0 16px; border-left: 1px solid #e2e8f0;">
                    <div style="font-size: 14px; color: #475569; font-weight: 700;">Total Kasus</div>
                    <div style="font-size: 30px; font-weight: 800; color: #1e293b;">${formatNumber(targetKasus)}</div>
                  </div>
                  <div style="text-align: right; padding-left: 16px; border-left: 1px solid #e2e8f0;">
                    <div style="font-size: 14px; color: #475569; font-weight: 700;">Pendapatan INACBG</div>
                    <div style="font-size: 30px; font-weight: 800; color: #22c55e;">${formatMoneyM(targetIna)}</div>
                  </div>
                </div>
                <div style="padding: 8px 12px; background: #fff;">
                  <div style="font-size: 14px; font-weight: 800; color: #475569; margin-bottom: 4px;">RINCIAN KASUS EKSISTING RS:</div>
                  <div style="display: flex; gap: 4px;">
                    <div style="flex:1; text-align:center; background:#f0fdfa; padding:6px; border:1px solid #ccfbf1; border-radius:4px;"><div style="font-size:13px; color:#0d9488; font-weight:700;">Dasar</div><div style="font-size:20px; color:#0f766e; font-weight:800;">${formatNumber(tD)}</div></div>
                    <div style="flex:1; text-align:center; background:#f0fdfa; padding:6px; border:1px solid #ccfbf1; border-radius:4px;"><div style="font-size:13px; color:#0d9488; font-weight:700;">Madya</div><div style="font-size:20px; color:#0f766e; font-weight:800;">${formatNumber(tM)}</div></div>
                    <div style="flex:1; text-align:center; background:#f0fdfa; padding:6px; border:1px solid #ccfbf1; border-radius:4px;"><div style="font-size:13px; color:#0d9488; font-weight:700;">Utama</div><div style="font-size:20px; color:#0f766e; font-weight:800;">${formatNumber(tU)}</div></div>
                    <div style="flex:1; text-align:center; background:#f0fdfa; padding:6px; border:1px solid #ccfbf1; border-radius:4px;"><div style="font-size:13px; color:#0d9488; font-weight:700;">Paripurna</div><div style="font-size:20px; color:#0f766e; font-weight:800;">${formatNumber(tP)}</div></div>
                  </div>
                </div>
              </div>
              
              <div style="display: flex; align-items: center; justify-content: center; width: 32px; font-size: 14px; font-weight: 700; color: #94a3b8; border: 1px solid #cbd5e1; border-radius: 50%; height: 32px; background: white; align-self: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); flex-shrink: 0;">VS</div>
              
              <!-- EKSISTING REGIONAL -->
              <div style="flex: 1; border: 1px solid #e2e8f0; border-top: 4px solid #10b981; border-radius: 8px; overflow: hidden; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="padding: 12px; display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #d1fae5;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="font-size: 40px; background: #d1fae5; border-radius: 8px; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;">🌍</div>
                    <div style="color: #047857; font-weight: 800; font-size: 18px; line-height: 1.1;">EKSISTING<br>REGIONAL</div>
                  </div>
                  <div style="text-align: center; padding: 0 16px; border-left: 1px solid #e2e8f0;">
                    <div style="font-size: 14px; color: #475569; font-weight: 700;">Total Kasus</div>
                    <div style="font-size: 30px; font-weight: 800; color: #1e293b;">${formatNumber(regionalKasus)}</div>
                  </div>
                  <div style="text-align: right; padding-left: 16px; border-left: 1px solid #e2e8f0;">
                    <div style="font-size: 14px; color: #475569; font-weight: 700;">Pendapatan INACBG</div>
                    <div style="font-size: 30px; font-weight: 800; color: #22c55e;">${formatMoneyM(regionalIna)}</div>
                  </div>
                </div>
                <div style="padding: 8px 12px; background: #fff;">
                  <div style="font-size: 14px; font-weight: 800; color: #475569; margin-bottom: 4px;">RINCIAN KASUS EKSISTING REGIONAL:</div>
                  <div style="display: flex; gap: 4px;">
                    <div style="flex:1; text-align:center; background:#f0fdfa; padding:6px; border:1px solid #ccfbf1; border-radius:4px;"><div style="font-size:13px; color:#0d9488; font-weight:700;">Dasar</div><div style="font-size:20px; color:#0f766e; font-weight:800;">${formatNumber(rD)}</div></div>
                    <div style="flex:1; text-align:center; background:#f0fdfa; padding:6px; border:1px solid #ccfbf1; border-radius:4px;"><div style="font-size:13px; color:#0d9488; font-weight:700;">Madya</div><div style="font-size:20px; color:#0f766e; font-weight:800;">${formatNumber(rM)}</div></div>
                    <div style="flex:1; text-align:center; background:#f0fdfa; padding:6px; border:1px solid #ccfbf1; border-radius:4px;"><div style="font-size:13px; color:#0d9488; font-weight:700;">Utama</div><div style="font-size:20px; color:#0f766e; font-weight:800;">${formatNumber(rU)}</div></div>
                    <div style="flex:1; text-align:center; background:#f0fdfa; padding:6px; border:1px solid #ccfbf1; border-radius:4px;"><div style="font-size:13px; color:#0d9488; font-weight:700;">Paripurna</div><div style="font-size:20px; color:#0f766e; font-weight:800;">${formatNumber(rP)}</div></div>
                  </div>
                </div>
              </div>

              <!-- MARKET SHARE -->
              <div style="background: #16a085; color: white; padding: 12px 16px; border-radius: 8px; min-width: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); flex-shrink: 0;">
                <div style="font-size: 16px; font-weight: 700; text-align: center; line-height: 1.1; margin-bottom: 8px;">MARKET<br>SHARE</div>
                <div style="font-size: 34px; font-weight: 800; color: #f1c40f; line-height: 1;">${formatPercent(regionalKasus ? targetKasus / regionalKasus : 0)}</div>
                <div style="font-size: 14px; margin-top: 8px; text-align: center;">Dari Total<br>Kasus</div>
              </div>
            </div>

            <!-- COMPETITORS -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
              <div>
                <div style="font-weight: 800; font-size: 14px; color: #1e293b; margin-bottom: 8px;">Kompetensi Layanan RS : <span style="font-weight: 400;">Kompetensi ${levelNames[targetCompetency]}</span></div>
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: #1e293b; flex-wrap: wrap;">
                  RS Kompetitor Regional per Kompetensi :
                  ${(() => {
                    const compCountByLevel = { 1: 0, 2: 0, 3: 0, 4: 0 };
                    data.hospitals.filter(h => h.code !== target.code).forEach(h => {
                      const comp = getCompetency(h, service);
                      if (comp in compCountByLevel) compCountByLevel[comp]++;
                    });
                    return `
                      <span style="font-weight: 700; font-size: 14px; color: #86198f; border: 1px solid #d946ef; border-radius: 99px; padding: 2px 10px; background: #fdf4ff; white-space: nowrap;">Paripurna: ${compCountByLevel[4]} RS</span>
                      <span style="font-weight: 700; font-size: 14px; color: #c2410c; border: 1px solid #f97316; border-radius: 99px; padding: 2px 10px; background: #fff7ed; white-space: nowrap;">Utama: ${compCountByLevel[3]} RS</span>
                      <span style="font-weight: 700; font-size: 14px; color: #a16207; border: 1px solid #eab308; border-radius: 99px; padding: 2px 10px; background: #fefce8; white-space: nowrap;">Madya: ${compCountByLevel[2]} RS</span>
                      <span style="font-weight: 700; font-size: 14px; color: #0f766e; border: 1px solid #14b8a6; border-radius: 99px; padding: 2px 10px; background: #f0fdfa; white-space: nowrap;">Dasar: ${compCountByLevel[1]} RS</span>
                    `;
                  })()}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 700; font-size: 14px; color: #334155; margin-bottom: 4px;">RS Kompetitor Setara atau Lebih Tinggi: <span style="color: #0aa7ad;">${competitors} RS</span></div>
                ${competitorHtml.replace(/font-size:\s*10px/g, "font-size: 13px")}
              </div>
            </div>

            <!-- TABLE -->
            ${(() => {
              const compCountByLevel = { 1: 0, 2: 0, 3: 0, 4: 0 };
              data.hospitals.filter(h => h.code !== target.code).forEach(h => {
                const comp = getCompetency(h, service);
                if (comp in compCountByLevel) compCountByLevel[comp]++;
              });

              // Bangun header sesuai alur logis:
              // SKENARIO | KASUS EKSISTING (rowspan) | PENGURANGAN per level | SISA (rowspan) | TAMBAHAN per level | PASCA KASUS | PASCA PENDAPATAN | NET +/- | % KENAIKAN
              let kurangHead1 = '', kurangHead2 = '';
              let tambahHead1 = '', tambahHead2 = '';
              
              [4, 3, 2, 1].forEach(lvl => {
                if (state.serviceScenarios[service][0].hasOwnProperty('kurang_' + lvl)) {
                  kurangHead1 += `<th colspan="2" style="background-color: #dc2626; color: white; padding: 4px; font-size: 11px; border: 1px solid white; line-height: 1.2;">⬇ KURANG<br>${levelNames[lvl].toUpperCase()}</th>`;
                  kurangHead2 += `<th style="background-color: #f87171; color: white; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 55px; white-space: nowrap;">% Krg</th><th style="background-color: #f87171; color: white; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 60px; white-space: nowrap;">Ks Keluar</th>`;
                }
              });
              [4, 3, 2, 1].forEach(lvl => {
                if (state.serviceScenarios[service][0].hasOwnProperty('tambah_' + lvl)) {
                  tambahHead1 += `<th colspan="3" style="background-color: #16a34a; color: white; padding: 4px; font-size: 11px; border: 1px solid white; line-height: 1.2;">⬆ TAMBAH<br>${levelNames[lvl].toUpperCase()}</th>`;
                  tambahHead2 += `<th style="background-color: #4ade80; color: #064e3b; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 55px; white-space: nowrap;">% Msk</th><th style="background-color: #4ade80; color: #064e3b; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 60px; white-space: nowrap;">Ks Masuk</th><th style="background-color: #4ade80; color: #064e3b; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 75px; white-space: nowrap;">Rp Masuk</th>`;
                }
              });
              
              return `
                <div style="overflow-x: auto; width: 100%;">
                  <table style="width: 100%; border-collapse: collapse; text-align: center; margin-top: 4px; font-size: 12px;">
                    <thead>
                      <tr>
                        <th rowspan="2" style="background-color: #0f766e; color: white; padding: 4px; font-size: 11px; border: 1px solid white; width: 75px; line-height: 1.2;">SKENARIO</th>
                        <th colspan="2" rowspan="1" style="background-color: #0f766e; color: white; padding: 4px; font-size: 11px; border: 1px solid white;">📊 EKSISTING</th>
                        ${kurangHead1}
                        <th colspan="2" rowspan="1" style="background-color: #0369a1; color: white; padding: 4px; font-size: 11px; border: 1px solid white; line-height: 1.2;">🔵 SISA<br>(Pasca Krg)</th>
                        ${tambahHead1}
                        <th colspan="2" rowspan="1" style="background-color: #b45309; color: white; padding: 4px; font-size: 11px; border: 1px solid white;">✅ PASCA RBKP</th>
                        <th colspan="2" rowspan="1" style="background-color: #374151; color: white; padding: 4px; font-size: 11px; border: 1px solid white;">NET +/-</th>
                      </tr>
                      <tr>
                        <th style="background-color: #134e4a; color: white; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 65px;">Kasus</th>
                        <th style="background-color: #134e4a; color: white; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 85px;">Pendapatan</th>
                        ${kurangHead2}
                        <th style="background-color: #075985; color: white; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 60px;">Ks Sisa</th>
                        <th style="background-color: #075985; color: white; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 85px;">Rp Sisa</th>
                        ${tambahHead2}
                        <th style="background-color: #92400e; color: white; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 65px;">Pasca Ks</th>
                        <th style="background-color: #92400e; color: white; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 85px;">Pasca Rp</th>
                        <th style="background-color: #1f2937; color: white; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 60px;">Net Ks</th>
                        <th style="background-color: #1f2937; color: white; padding: 4px 2px; font-size: 10px; border: 1px solid white; width: 85px;">Net Rp & %</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${state.serviceScenarios[service].map((scn, i) => generateRow(i, scn)).join("")}
                    </tbody>
                  </table>
                </div>
              `;
            })()}

            <!-- INSIGHTS -->
            <div style="margin-top: 16px;">
              <table style="width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden; border: 1px solid #e2e8f0;">
                <tbody>
                  <tr>
                    <td style="width: 120px; background: #16a085; color: #fff; padding: 12px; text-align: center; vertical-align: middle;">
                      <div style="font-size: 24px; margin-bottom: 4px;">💡</div>
                      <div style="font-weight: 800; font-size: 13px; text-transform: uppercase;">INSIGHT</div>
                    </td>
                    <td style="padding: 12px; border-right: 1px solid #e2e8f0; vertical-align: top; width: 30%;">
                      <div style="font-size: 14px; color: #16a085; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">PELUANG KASUS</div>
                      <div style="font-size: 14px; color: #475569; line-height: 1.5;">${opportunityInsight}${riskInsight}</div>
                    </td>
                    <td style="padding: 12px; border-right: 1px solid #e2e8f0; vertical-align: top; width: 30%;">
                      <div style="font-size: 14px; color: #16a085; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">SAINGAN</div>
                      <div style="font-size: 14px; color: #475569; line-height: 1.5;">${competitionInsight}</div>
                    </td>
                    <td style="padding: 12px; vertical-align: top;">
                      <div style="font-size: 14px; color: #16a085; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">SKENARIO TERDEKAT</div>
                      <div style="font-size: 14px; color: #475569; line-height: 1.5;">${scenarioInsight}${highestRevenueNote}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- FOOTER NOTES -->
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
              <div style="font-size: 12px; color: #64748b; font-style: italic; line-height: 1.4;">
                <div>* % Penambahan kasus dihitung dari Total Kasus Regional</div>
                <div>* % Pengurangan kasus dihitung dari Kasus Eksisting RS</div>
              </div>
              <div style="font-size: 16px; font-weight: 800; color: #0891b2; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 20px;">⚕️</span> Kemenkes
              </div>
            </div>

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
        if (field.startsWith('kurang_')) {
          state.serviceScenarios[srv].forEach(scn => scn[field] = val);
        } else {
          state.serviceScenarios[srv][idx][field] = val;
        }
        renderAll();
      });
    });
  }

  function renderTargetSummarySlide() {
    const container = document.getElementById("targetSummarySlide");
    if (!container) return;

    const target = targetHospital();
    
    let totalCases = 0;
    let totalIna = 0;
    let totalIdrg = 0;
    let severityBreakdown = { 1: [0,0,0], 2: [0,0,0], 3: [0,0,0], 4: [0,0,0] };

    if (target) {
      totalCases = target.total[CASES] || 0;
      totalIna = target.total[INA] || 0;
      totalIdrg = target.total[IDRG] || 0;
      
      severityRanks.forEach(rank => {
        const m = target.severity?.[rank] || createZeroMetric();
        severityBreakdown[rank] = [m[0], m[1], m[IDRG]];
      });
    } else {
      totalCases = data.regional.total[CASES] || 0;
      totalIna = data.regional.total[INA] || 0;
      totalIdrg = data.regional.total[IDRG] || 0;
      
      severityRanks.forEach(rank => {
        const m = data.regional.severity?.[rank] || createZeroMetric();
        severityBreakdown[rank] = [m[0], m[1], m[IDRG]];
      });
    }

    const selisihTotal = totalIdrg - totalIna;
    const pctSelisihTotal = totalIna > 0 ? (selisihTotal / totalIna) : 0;
    const targetName = target ? `${target.name} (${target.city})` : "Regional / Seluruh RS Terpilih";

    const formatM = (val) => {
      const absVal = Math.abs(val);
      const numericInM = absVal / 1e9;
      const formatted = (absVal >= 1e9) 
         ? new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numericInM)
         : new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(numericInM);
      return (val < 0 ? "- " : "") + formatted;
    };

    const formatMWithSign = (val) => {
      const numericInM = val / 1e6;
      const absVal = Math.abs(numericInM);
      const sign = numericInM < 0 ? "− " : (numericInM > 0 ? "+ " : "");
      return `${sign}${decimalFormatter.format(absVal)}`;
    };

    const selisihColorCard = selisihTotal < 0 ? "#c53030" : "#2f855a";

    const rowKeys = [
      { rank: 1, name: "Dasar" },
      { rank: 2, name: "Madya" },
      { rank: 3, name: "Utama" },
      { rank: 4, name: "Paripurna" }
    ];

    const tableRowsHtml = rowKeys.map(r => {
      const m = severityBreakdown[r.rank];
      const kCases = m[0] || 0;
      const kIna = m[1] || 0;
      const kIdrg = m[2] || 0;
      const kSelisih = kIdrg - kIna;
      const kPctKasus = totalCases > 0 ? (kCases / totalCases) : 0;
      const kPctSelisih = kIna > 0 ? (kSelisih / kIna) : 0;

      const selisihText = formatMWithSign(kSelisih);
      const selisihColor = kSelisih < 0 ? "#c53030" : "#2f855a";
      const pctSelisihColor = kPctSelisih < 0 ? "#c53030" : "#2f855a";

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 15px; height: 50px; background: #ffffff;">
          <td style="padding: 12px 18px; font-weight: 700; text-align: left; color: #1a202c;">${r.name}</td>
          <td style="padding: 12px 18px; text-align: right; color: #1a202c; font-weight: 600;">${formatNumber(kCases)}</td>
          <td style="padding: 12px 18px; text-align: right; color: #4a5568;">${formatPercent(kPctKasus)}</td>
          <td style="padding: 12px 18px; text-align: right; color: #1a202c; font-weight: 600;">${formatM(kIna)}</td>
          <td style="padding: 12px 18px; text-align: right; color: #1a202c; font-weight: 600;">${formatM(kIdrg)}</td>
          <td style="padding: 12px 18px; text-align: right; font-weight: 700; color: ${selisihColor};">${selisihText}</td>
          <td style="padding: 12px 18px; text-align: right; font-weight: 700; color: ${pctSelisihColor};">${formatPercent(kPctSelisih)}</td>
        </tr>
      `;
    }).join("");

    const totalSelisihText = formatMWithSign(selisihTotal);
    const totalSelisihColor = selisihTotal < 0 ? "#c53030" : "#2f855a";

    container.innerHTML = `
      <!-- Header Banner -->
      <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
        <span style="font-size: 17px; font-weight: 800; color: #1a202c;">📍 ${escapeHtml(targetName)}</span>
        <span style="font-size: 13px; color: #718096; font-weight: 600;">Ringkasan Eksisting Kasus &amp; Pendapatan</span>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 10px;">
        <!-- Card 1: Total Kasus -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          <div style="font-size: 13px; font-weight: 700; color: #718096; margin-bottom: 8px;">Total Kasus:</div>
          <div style="font-size: 28px; font-weight: 900; color: #c53030; line-height: 1.1;">${formatNumber(totalCases)}</div>
          <div style="font-size: 11px; color: #a0aec0; margin-top: 6px;">Jumlah kasus eklaim</div>
        </div>

        <!-- Card 2: INA CBGs -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          <div style="font-size: 13px; font-weight: 700; color: #718096; margin-bottom: 8px;">Pendapatan INA CBGs:</div>
          <div style="font-size: 28px; font-weight: 900; color: #dd6b20; line-height: 1.1;">${formatMoney(totalIna)}</div>
          <div style="font-size: 11px; color: #a0aec0; margin-top: 6px;">Dari data 8 bulan</div>
        </div>

        <!-- Card 3: iDRG -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          <div style="font-size: 13px; font-weight: 700; color: #718096; margin-bottom: 8px;">Pendapatan iDRG:</div>
          <div style="font-size: 28px; font-weight: 900; color: #2f855a; line-height: 1.1;">${formatMoney(totalIdrg)}</div>
          <div style="font-size: 11px; color: #a0aec0; margin-top: 6px;">Klaim uji coba iDRG</div>
        </div>

        <!-- Card 4: Selisih -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          <div style="font-size: 13px; font-weight: 700; color: #718096; margin-bottom: 8px;">Selisih Pendapatan:</div>
          <div style="font-size: 28px; font-weight: 900; color: ${selisihColorCard}; line-height: 1.1;">${selisihTotal < 0 ? '− ' : (selisihTotal > 0 ? '+ ' : '')}${formatMoney(Math.abs(selisihTotal))}</div>
          <div style="font-size: 11px; color: #a0aec0; margin-top: 6px;">iDRG - INA CBGs</div>
        </div>

        <!-- Card 5: Persentase -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          <div style="font-size: 13px; font-weight: 700; color: #718096; margin-bottom: 8px;">Persentase:</div>
          <div style="font-size: 28px; font-weight: 900; color: ${selisihColorCard}; line-height: 1.1;">${pctSelisihTotal < 0 ? '' : '+'}${formatPercent(pctSelisihTotal)}</div>
          <div style="font-size: 11px; color: #a0aec0; margin-top: 6px;">Dari Pendapatan INACBG</div>
        </div>
      </div>

      <!-- Table Section -->
      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #2b937e; color: #ffffff; font-size: 15px;">
              <th style="padding: 15px 18px; font-weight: 700; width: 20%;">Tingkat Kompetensi</th>
              <th style="padding: 15px 18px; font-weight: 700; text-align: right; width: 14%;">Jumlah Kasus</th>
              <th style="padding: 15px 18px; font-weight: 700; text-align: right; width: 12%;">% Kasus RS</th>
              <th style="padding: 15px 18px; font-weight: 700; text-align: right; width: 14%;">INA-CBG (Rp. M)</th>
              <th style="padding: 15px 18px; font-weight: 700; text-align: right; width: 14%;">iDRG (Rp. M)</th>
              <th style="padding: 15px 18px; font-weight: 700; text-align: right; width: 13%;">Selisih (Rp. M)</th>
              <th style="padding: 15px 18px; font-weight: 700; text-align: right; width: 13%;">% Selisih</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0; font-size: 16px; font-weight: 800; border-top: 2px solid #cbd5e1;">
              <td style="padding: 15px 18px; color: #1e293b;">Total</td>
              <td style="padding: 15px 18px; text-align: right; color: #1e293b;">${formatNumber(totalCases)}</td>
              <td style="padding: 15px 18px; text-align: right; color: #1e293b;">100 %</td>
              <td style="padding: 15px 18px; text-align: right; color: #1e293b;">${formatM(totalIna)}</td>
              <td style="padding: 15px 18px; text-align: right; color: #1e293b;">${formatM(totalIdrg)}</td>
              <td style="padding: 15px 18px; text-align: right; color: ${totalSelisihColor};">${totalSelisihText}</td>
              <td style="padding: 15px 18px; text-align: right; color: ${totalSelisihColor};">${formatPercent(pctSelisihTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Kemenkes Branding Footer -->
      <div style="margin-top: 8px; display: flex; justify-content: flex-end; align-items: center;">
        <div style="font-size: 15px; font-weight: 800; color: #00a896; display: flex; align-items: center; gap: 6px;">
          <img src="img/logo-kemenkes.png" alt="Logo Kemenkes" style="height: 22px;"> Kemenkes
        </div>
      </div>
    `;
  }

  // --- INTERACTIVE MAP SYSTEM (LEAFLET) ---
  const provinceCoords = {
    "ACEH": [4.6951, 96.7494], "NAD": [4.6951, 96.7494],
    "SUMATERA UTARA": [2.1154, 99.5451], "SUMATERA BARAT": [-0.7399, 100.8000],
    "RIAU": [0.2933, 101.7068], "KEPULAUAN RIAU": [3.9456, 108.1428],
    "JAMBI": [-1.6101, 103.6131], "SUMATERA SELATAN": [-3.3199, 104.9147],
    "BANGKA BELITUNG": [-2.7411, 106.4406], "BENGKULU": [-3.8004, 102.2655],
    "LAMPUNG": [-4.5586, 105.4068], "DKI JAKARTA": [-6.2088, 106.8456],
    "JAWA BARAT": [-6.9175, 107.6191], "BANTEN": [-6.4058, 106.0640],
    "JAWA TENGAH": [-7.1509, 110.1403], "DIY": [-7.7956, 110.3695],
    "DI YOGYAKARTA": [-7.7956, 110.3695], "JAWA TIMUR": [-7.5360, 112.2384],
    "BALI": [-8.4095, 115.1889], "NTB": [-8.6529, 117.3616],
    "NTT": [-8.6574, 121.0794], "KALIMANTAN BARAT": [-0.0000, 109.3333],
    "KALIMANTAN TENGAH": [-1.6815, 113.3824], "KALIMANTAN SELATAN": [-3.0926, 115.2838],
    "KALIMANTAN TIMUR": [0.5387, 116.4194], "KALIMANTAN UTARA": [3.0731, 116.0414],
    "SULAWESI UTARA": [0.6247, 123.9750], "GORONTALO": [0.6999, 122.4467],
    "SULAWESI TENGAH": [-1.4300, 121.4456], "SULAWESI BARAT": [-2.8441, 119.2321],
    "SULAWESI SELATAN": [-3.6687, 119.9741], "SULAWESI TENGGARA": [-4.1449, 122.1746],
    "MALUKU": [-3.2385, 130.1453], "MALUKU UTARA": [1.5709, 127.8087],
    "PAPUA": [-4.2699, 138.0804], "PAPUA BARAT": [-1.3361, 133.1747],
    "PAPUA TENGAH": [-3.8500, 136.2500], "PAPUA PEGUNUNGAN": [-4.1000, 138.9000]
  };

  const cityCoords = {
    // JABODETABEK & BANTEN
    "JAKARTA": [-6.2088, 106.8456], "JAKARTA PUSAT": [-6.1805, 106.8284], "JAKARTA SELATAN": [-6.2615, 106.8106],
    "JAKARTA BARAT": [-6.1683, 106.7583], "JAKARTA TIMUR": [-6.2250, 106.9004], "JAKARTA UTARA": [-6.1214, 106.9211],
    "KEPULAUAN SERIBU": [-5.6122, 106.5606],
    "BOGOR": [-6.5950, 106.8167], "DEPOK": [-6.4000, 106.8186],
    "TANGERANG": [-6.1783, 106.6319], "TANGERANG SELATAN": [-6.2889, 106.7181],
    "BEKASI": [-6.2383, 106.9756], "SERANG": [-6.1200, 106.1503], "CILEGON": [-6.0028, 106.0131],
    "LEBAK": [-6.6500, 106.2167], "PANDEGLANG": [-6.3083, 106.1067],

    // JAWA BARAT
    "BANDUNG": [-6.9175, 107.6191], "BANDUNG BARAT": [-6.8453, 107.5083], "CIMAHI": [-6.8722, 107.5422],
    "CIANJUR": [-6.8167, 107.1333], "SUKABUMI": [-6.9222, 106.9272], "PURWAKARTA": [-6.5569, 107.4433],
    "KARAWANG": [-6.3072, 107.3000], "SUBANG": [-6.5683, 107.7606], "SUMEDANG": [-6.8581, 107.9189],
    "INDRAMAYU": [-6.3264, 108.3200], "CIREBON": [-6.7063, 108.5570], "MAJALENGKA": [-6.8361, 108.2278],
    "KUNINGAN": [-6.9767, 108.4839], "GARUT": [-7.2167, 107.9000], "TASIKMALAYA": [-7.3274, 108.2207],
    "CIAMIS": [-7.3264, 108.3536], "BANJAR": [-7.3742, 108.5336], "PANGANDARAN": [-7.7000, 108.4900],

    // JAWA TENGAH
    "SEMARANG": [-6.9667, 110.4167], "SURAKARTA": [-7.5755, 110.8243], "SOLO": [-7.5755, 110.8243],
    "SALATIGA": [-7.3306, 110.5083], "PEKALONGAN": [-6.8886, 109.6753], "TEGAL": [-6.8694, 109.1403],
    "MAGELANG": [-7.4797, 110.2178], "BOYOLALI": [-7.5333, 110.5964], "SUKOHARJO": [-7.6833, 110.8333],
    "KARANGANYAR": [-7.5972, 110.9500], "WONOGIRI": [-7.8167, 110.9333], "SRAGEN": [-7.4286, 111.0222],
    "KLATEN": [-7.7058, 110.6053], "KUDUS": [-6.8048, 110.8405], "JEPARA": [-6.5888, 110.6686],
    "DEMAK": [-6.8944, 110.6386], "PATI": [-6.7558, 111.0381], "REMBANG": [-6.7081, 111.3411],
    "BLORA": [-6.9697, 111.4172], "GROBOGAN": [-7.0869, 110.9161], "KENDAL": [-6.9189, 110.2036],
    "BATANG": [-6.9075, 109.7317], "BREBES": [-6.8731, 109.0422], "PEMALANG": [-6.8917, 109.3806],
    "PURBALINGGA": [-7.3886, 109.3639], "BANJARNEGARA": [-7.3975, 109.6972], "BANYUMAS": [-7.5147, 109.2944],
    "PURWOKERTO": [-7.4244, 109.2392], "CILACAP": [-7.7028, 109.0069], "KEBUMEN": [-7.6686, 109.6519],
    "PURWOREJO": [-7.7144, 109.9989], "WONOSOBO": [-7.3611, 109.9000], "TEMANGGUNG": [-7.3158, 110.1681],

    // DIY
    "YOGYAKARTA": [-7.7956, 110.3695], "SLEMAN": [-7.7156, 110.3556], "BANTUL": [-7.8897, 110.3289],
    "KULON PROGO": [-7.8386, 110.1567], "GUNUNGKIDUL": [-7.9650, 110.6033], "GUNUNG KIDUL": [-7.9650, 110.6033],

    // JAWA TIMUR
    "SURABAYA": [-7.2575, 112.7521], "MALANG": [-7.9666, 112.6326], "BATU": [-7.8711, 112.5269],
    "SIDOARJO": [-7.4478, 112.7183], "GRESIK": [-7.1558, 112.6528], "MOJOKERTO": [-7.4722, 112.4336],
    "PASURUAN": [-7.6453, 112.9075], "PROBOLINGGO": [-7.7544, 113.2158], "LUMAJANG": [-8.1333, 113.2250],
    "JEMBER": [-8.1722, 113.7000], "BANYUWANGI": [-8.2192, 114.3692], "BONDOWOSO": [-7.9136, 113.8214],
    "SITUBONDO": [-7.7064, 114.0044], "KEDIRI": [-7.8167, 112.0167], "BLITAR": [-8.0983, 112.1681],
    "TULUNGAGUNG": [-8.0667, 111.9000], "TRENGGALEK": [-8.0500, 111.7167], "NGAWI": [-7.4039, 111.4464],
    "MAGETAN": [-7.6536, 111.3283], "MADIUN": [-7.6297, 111.5239], "PONOROGO": [-7.8683, 111.4622],
    "PACITAN": [-8.2047, 111.0922], "NGANJUK": [-7.6044, 111.9039], "JOMBANG": [-7.5458, 112.2331],
    "BOJONEGORO": [-7.1503, 111.8817], "TUBAN": [-6.8975, 112.0647], "LAMONGAN": [-7.1197, 112.4158],
    "BANGKALAN": [-7.0456, 112.7506], "SAMPANG": [-7.1878, 113.2394], "PAMEKASAN": [-7.1600, 113.4756], "SUMENEP": [-7.0167, 113.8667],

    // BALI & NUSA TENGGARA
    "DENPASAR": [-8.6705, 115.2126], "BADUNG": [-8.5833, 115.1833], "TABANAN": [-8.5397, 115.1239],
    "GIANYAR": [-8.5414, 115.3289], "KLUNGKUNG": [-8.5333, 115.4000], "BANGLI": [-8.4542, 115.3550],
    "KARANGASEM": [-8.4489, 115.6117], "BULELENG": [-8.1167, 115.0833], "SINGARAJA": [-8.1167, 115.0833], "JEMBRANA": [-8.3000, 114.6667],
    "MATARAM": [-8.5833, 116.1167], "LOMBOK BARAT": [-8.6833, 116.1333], "LOMBOK TENGAH": [-8.7000, 116.2833],
    "LOMBOK TIMUR": [-8.6500, 116.5333], "LOMBOK UTARA": [-8.3500, 116.1833], "SUMBAWA": [-8.5000, 117.4333],
    "SUMBAWA BARAT": [-8.7500, 116.8500], "DOMPU": [-8.5333, 118.4500], "BIMA": [-8.4667, 118.7333],
    "KUPANG": [-10.1772, 123.6070], "TIMOR TENGAH SELATAN": [-9.8600, 124.2800], "TIMOR TENGAH UTARA": [-9.4500, 124.5000],
    "BELU": [-9.1100, 124.9000], "MALAKA": [-9.5600, 124.9000], "ALOR": [-8.3100, 124.6300],
    "FLORES TIMUR": [-8.3000, 122.9800], "SIKKA": [-8.6300, 122.2300], "MAUMERE": [-8.6300, 122.2300],
    "ENDE": [-8.8400, 121.6500], "NGADA": [-8.7600, 120.9700], "NAGEKEO": [-8.6500, 121.2000],
    "MANGGARAI": [-8.6000, 120.4700], "MANGGARAI TIMUR": [-8.6000, 120.7000], "MANGGARAI BARAT": [-8.5500, 120.0000],
    "LABUAN BAJO": [-8.5000, 119.8800], "SUMBA TIMUR": [-9.8500, 120.2500], "SUMBA BARAT": [-9.6500, 119.4000],
    "SUMBA TENGAH": [-9.6000, 119.6500], "SUMBA BARAT DAYA": [-9.5500, 119.1000], "ROTE NDAO": [-10.7300, 123.1200],
    "SABU RAIJUA": [-10.5000, 121.8000],

    // SUMATERA
    "BANDA ACEH": [5.5483, 95.3238], "SABANG": [5.8933, 95.3197], "LHOKSEUMAWE": [5.1800, 97.1400],
    "LANGSA": [4.4700, 97.9700], "SUBULUSSALAM": [2.6300, 98.0000], "ACEH BESAR": [5.3800, 95.5200],
    "MEDAN": [3.5952, 98.6722], "BINJAI": [3.6000, 98.4833], "TEBING TINGGI": [3.3286, 99.1625],
    "PEMATANGSIANTAR": [2.9600, 99.0600], "TANJUNGBALAI": [2.9600, 99.8000], "SIBOLGA": [1.7400, 98.7800],
    "PADANGSIDIMPUAN": [1.3700, 99.2700], "GUNUNGSITOLI": [1.2800, 97.6100], "DELI SERDANG": [3.5000, 98.7000],
    "KARO": [3.1200, 98.5000], "SIMALUNGUN": [2.9000, 99.0000], "ASAHAN": [2.9800, 99.6300],
    "LABUHANBATU": [2.1500, 99.9800], "TAPANULI UTARA": [2.0000, 99.0000], "TAPANULI SELATAN": [1.5000, 99.2000],
    "PADANG": [-0.9471, 100.4172], "BUKITTINGGI": [-0.3056, 100.3692], "PAYAKUMBUH": [-0.2247, 100.6328],
    "PARIAMAN": [-0.6264, 100.1203], "PADANG PANJANG": [-0.4636, 100.3986], "SOLOK": [-0.7983, 100.6586],
    "SAWAHLUNTO": [-0.6800, 100.7800], "PESISIR SELATAN": [-1.3500, 100.5700], "TANAH DATAR": [-0.4500, 100.5800],
    "AGAM": [-0.2500, 100.1700], "LIMA PULUH KOTA": [-0.1300, 100.6000], "PASAMAN": [0.4300, 100.0500],
    "PEKANBARU": [0.5071, 101.4478], "DUMAI": [1.6667, 101.4500], "KAMPAR": [0.3300, 101.0200],
    "INDRAGIRI HILIR": [-0.3300, 103.1500], "INDRAGIRI HULU": [-0.5500, 102.3000], "BENGKALIS": [1.4800, 102.1300],
    "PELALAWAN": [0.3700, 101.8800], "ROKAN HILIR": [1.7000, 100.8000], "ROKAN HULU": [0.8700, 100.5200],
    "SIAK": [0.8000, 101.9800], "BATAM": [1.1301, 104.0529], "TANJUNGPINANG": [0.9167, 104.4500],
    "BINTAN": [1.0000, 104.5000], "KARIMUN": [0.9700, 103.4200],
    "JAMBI": [-1.6101, 103.6131], "SUNGAI PENUH": [-2.0600, 101.3900], "KERINCI": [-2.0800, 101.5000],
    "MERANGIN": [-2.2000, 102.1500], "SAROLANGUN": [-2.3000, 102.6500], "BATANGHARI": [-1.7500, 103.1200],
    "MUARO JAMBI": [-1.5500, 103.7500], "TANJUNG JABUNG BARAT": [-1.1500, 103.2000], "TANJUNG JABUNG TIMUR": [-1.2000, 103.7500],
    "TEBO": [-1.4500, 102.4000], "BUNGO": [-1.5000, 101.9500],
    "BENGKULU": [-3.8004, 102.2655], "REJANG LEBONG": [-3.4500, 102.5500], "LEBONG": [-3.1500, 102.2000],
    "KEPAHIANG": [-3.6500, 102.5800], "MUKOMUKO": [-2.5800, 101.1200], "SELUMA": [-4.0500, 102.6000],
    "BENGKULU SELATAN": [-4.3500, 102.9000], "KAUR": [-4.7000, 103.3500],
    "PALEMBANG": [-2.9761, 104.7754], "PRABUMULIH": [-3.4300, 104.2300], "PAGAR ALAM": [-4.0300, 103.2500],
    "LUBUKLINGGAU": [-3.3000, 102.8600], "OGAN KOMERING ULU": [-4.1300, 104.1700], "BATURAJA": [-4.1300, 104.1700],
    "OGAN KOMERING ILIR": [-3.4000, 105.0000], "MUARA ENIM": [-3.6500, 103.7800], "LAHAT": [-3.7800, 103.5300],
    "MUSI RAWAS": [-3.1000, 103.0000], "MUSI BANYUASIN": [-2.8800, 103.8200], "BANYUASIN": [-2.8800, 104.3800],
    "PANGKALPINANG": [-2.1300, 106.1100], "BANGKA": [-1.9000, 105.9500], "BELITUNG": [-2.7500, 107.7000],
    "BANDAR LAMPUNG": [-5.4500, 105.2667], "METRO": [-5.1139, 105.3067], "LAMPUNG SELATAN": [-5.6000, 105.6000],
    "LAMPUNG TENGAH": [-4.9000, 105.2500], "LAMPUNG UTARA": [-4.8200, 104.8800], "LAMPUNG BARAT": [-5.1500, 104.1000],
    "TULANG BAWANG": [-4.4500, 105.6500], "TANGGAMUS": [-5.4500, 104.6500], "PRINGSEWU": [-5.3500, 104.9700],
    "PESAWARAN": [-5.4200, 105.1800],

    // KALIMANTAN
    "PONTIANAK": [-0.0263, 109.3425], "SINGKAWANG": [0.9000, 108.9800], "SAMBAS": [1.3500, 109.3000],
    "MEMPAWAH": [0.2500, 109.1700], "SANGGAU": [0.1200, 110.5800], "KETAPANG": [-1.8300, 110.0000],
    "SINTANG": [0.0700, 111.5000], "KAPUAS HULU": [0.8200, 112.9200], "BENGKAYANG": [0.8200, 109.6500],
    "LANDAK": [0.4200, 109.7500], "SEKADAU": [0.0200, 110.9500], "MELAWAI": [-0.3300, 111.7000],
    "PALANGKARAYA": [-2.2100, 113.9200], "KOTAWARINGIN BARAT": [-2.6800, 111.6200], "PANGKALAN BUN": [-2.6800, 111.6200],
    "KOTAWARINGIN TIMUR": [-2.0800, 112.7000], "SAMPIT": [-2.5300, 112.9500], "KAPUAS": [-2.5000, 114.4000],
    "KUALA KAPUAS": [-3.0000, 114.3800], "BARITO SELATAN": [-1.7000, 114.8500], "BARITO UTARA": [-0.9000, 115.1000],
    "BANJARMASIN": [-3.3194, 114.5908], "BANJARBARU": [-3.4500, 114.8300], "BANJAR": [-3.3200, 115.0800],
    "MARTAPURA": [-3.4200, 114.8500], "TANAH LAUT": [-3.8800, 114.8700], "KOTABARU": [-3.2500, 116.2200],
    "TANAH BUMBU": [-3.4500, 115.7000], "HULU SUNGAI SELATAN": [-2.7500, 115.2500], "KANDANGAN": [-2.7800, 115.2500],
    "HULU SUNGAI TENGAH": [-2.6000, 115.4200], "BARABAI": [-2.5800, 115.3800], "HULU SUNGAI UTARA": [-2.4200, 115.2500],
    "TABALONG": [-1.8800, 115.5000], "TANJUNG": [-2.1800, 115.3800],
    "SAMARINDA": [-0.5022, 117.1536], "BALIKPAPAN": [-1.2379, 116.8529], "BONTANG": [0.1300, 117.5000],
    "KUTAI KARTANEGARA": [-0.4300, 116.9800], "TENGGARONG": [-0.4300, 116.9800], "KUTAI TIMUR": [0.9000, 117.5000],
    "SANGATTA": [0.4800, 117.5500], "BERAU": [2.1500, 117.4800], "TANJUNG REDEB": [2.1500, 117.4800],
    "TARAKAN": [3.3000, 117.6300], "BULUNGAN": [2.9000, 117.1000], "NUNUKAN": [4.1300, 117.6500],

    // SULAWESI
    "MANADO": [1.4748, 124.8428], "BITUNG": [1.4400, 125.1800], "TOMOHON": [1.3200, 124.8400],
    "KOTAMOBAGU": [0.7300, 124.3100], "MINAHASA": [1.2500, 124.9000], "MINAHASA UTARA": [1.4000, 124.9800],
    "MINAHASA SELATAN": [1.0500, 124.5800], "BOLAANG MONGONDOW": [0.7500, 124.1000],
    "GORONTALO": [0.5400, 123.0600], "BONE BOLANGO": [0.5200, 123.1800], "POHUWATO": [0.5300, 121.8200],
    "PALU": [-0.9000, 119.8333], "DONGGALA": [-0.6700, 119.7300], "PARIGI MOUTONG": [-0.8000, 120.1800],
    "POSO": [-1.4000, 120.7500], "TOJO UNA-UNA": [-1.1800, 121.5000], "TOLITOLI": [1.0300, 120.8000],
    "BUOL": [1.0000, 121.4000], "BANGGAI": [-1.2500, 122.7500], "LUWUK": [-0.9500, 122.7800],
    "MOROWALI": [-2.3500, 121.9000], "MAMUJU": [-2.6700, 118.8800], "POLEWALI MANDAR": [-3.4200, 119.3300],
    "MAJENE": [-3.5300, 118.9700], "MAMASA": [-2.9500, 119.3800],
    "MAKASSAR": [-5.1477, 119.4327], "PAREPARE": [-4.0100, 119.6300], "PALOPO": [-2.9900, 120.2000],
    "GOWA": [-5.2800, 119.7500], "MAROS": [-5.0000, 119.6500], "PANGKAJENE DAN KEPULAUAN": [-4.8000, 119.5500],
    "BARRU": [-4.4200, 119.6500], "BONE": [-4.5300, 120.3200], "WATAMPONE": [-4.5300, 120.3200],
    "SOPPENG": [-4.3500, 119.8800], "WAJO": [-4.0000, 120.1500], "SENGKANG": [-4.1200, 120.0300],
    "SIDENRENG RAPPANG": [-3.8500, 119.9500], "PINRANG": [-3.7800, 119.6500], "ENREKANG": [-3.5500, 119.7800],
    "TANA TORAJA": [-3.1500, 119.8500], "TORAJA UTARA": [-2.9500, 119.9000], "LUWU": [-3.2500, 120.3000],
    "LUWU UTARA": [-2.6000, 120.3500], "LUWU TIMUR": [-2.5500, 121.2000], "BULUKUMBA": [-5.5500, 120.1800],
    "BANTAENG": [-5.5300, 119.9500], "JENEPONTO": [-5.6500, 119.7200], "TAKALAR": [-5.4200, 119.4800],
    "SINJAI": [-5.2200, 120.1500], "KEPULAUAN SELAYAR": [-6.1200, 120.4800],
    "KENDARI": [-3.9700, 122.5800], "BAUBAU": [-5.4700, 122.6000], "KOLAKA": [-4.0500, 121.6000],
    "KOLAKA UTARA": [-3.2500, 121.0000], "KONAWE": [-3.8500, 122.0500], "KONAWE SELATAN": [-4.2500, 122.3000],
    "MUNA": [-4.8500, 122.6800], "RAHA": [-4.8500, 122.6800], "BUTON": [-5.2000, 122.8000],
    "WAKATOBI": [-5.3200, 123.5800],

    // MALUKU & PAPUA
    "AMBON": [-3.6954, 128.1814], "TUAL": [-5.6300, 132.7500], "MALUKU TENGAH": [-3.3000, 128.9500],
    "MALUKU TENGGARA": [-5.7500, 132.7500], "BURU": [-3.3000, 126.9000], "SERAM BAGIAN BARAT": [-3.1000, 128.3000],
    "SERAM BAGIAN TIMUR": [-3.2000, 130.4000], "KEPULAUAN ARU": [-6.0000, 134.5000],
    "TERNATE": [0.7800, 127.3800], "TIDORE": [0.6800, 127.4000], "HALMAHERA BARAT": [1.4000, 127.5000],
    "HALMAHERA UTARA": [1.7000, 127.9000], "TOBELO": [1.7300, 128.0000], "HALMAHERA SELATAN": [-0.6000, 127.6000],
    "JAYAPURA": [-2.5489, 140.7181], "KEEROM": [-3.3000, 140.7500], "SARMI": [-2.0000, 139.3000],
    "MERAUKE": [-8.4991, 140.4013], "BOVEN DIGOEL": [-5.7500, 140.3500], "MAPPI": [-6.5000, 139.5000],
    "ASMAT": [-5.4000, 138.5000], "NABIRE": [-3.3700, 135.5000], "MIMIKA": [-4.5500, 136.9000],
    "TIMIKA": [-4.5500, 136.9000], "PANIAI": [-3.9000, 136.3500], "PUNCAK JAYA": [-3.6500, 137.7000],
    "JAYAWIJAYA": [-4.0500, 138.9500], "WAMENA": [-4.0800, 138.9500], "YAHUKIMO": [-4.6000, 139.5000],
    "PEGUNUNGAN BINTANG": [-4.5000, 140.5000], "MANOKWARI": [-0.8600, 134.0800], "SORONG": [-0.8761, 131.2558],
    "FAKFAK": [-2.9300, 132.3000], "KAIMANA": [-3.6500, 133.7500], "TELUK BINTUNI": [-2.1500, 133.5000],
    "TELUK WONDAMA": [-2.7000, 134.5000], "RAJA AMPAT": [-0.5000, 130.5000]
  };

  function normalizeCity(raw) {
    if (!raw) return '';
    return String(raw).toUpperCase().trim()
      .replace(/^KOTA\s+ADMINISTRASI\s+/, '')
      .replace(/^KOTA\s+ADM\.\s+/, '')
      .replace(/^KOTA\s+/, '')
      .replace(/^KABUPATEN\s+ADM\.\s+/, '')
      .replace(/^KABUPATEN\s+/, '')
      .replace(/^KAB\.\s+/, '')
      .replace(/^KAB\s+/, '')
      .trim();
  }

  function getHospitalCoords(hospital) {
    const rawCity = hospital.city ? hospital.city.toUpperCase().trim() : '';
    const normCity = normalizeCity(hospital.city);
    const provKey = hospital.province ? hospital.province.toUpperCase().trim() : '';

    let base = cityCoords[rawCity] || cityCoords[normCity] || provinceCoords[provKey] || [-2.5489, 118.0149];
    
    let hash = 0;
    for (let i = 0; i < hospital.code.length; i++) {
      hash = (hash << 5) - hash + hospital.code.charCodeAt(i);
      hash |= 0;
    }
    const latOffset = (((hash % 97) - 48) / 1000) * 0.12;
    const lngOffset = ((((hash >> 3) % 97) - 48) / 1000) * 0.12;

    return [base[0] + latOffset, base[1] + lngOffset];
  }

  let mapInstance = null;
  let markersGroup = null;

  window.selectTargetHospital = (code) => {
    state.targetCode = code;
    state.targetCodes = [code];
    state.serviceScenarios = {};
    const target = targetHospital();
    const input = document.getElementById("targetHospitalInput");
    if (input && target) input.value = `${target.name} · ${target.city}`;
    renderAll();
    if (window.renderHospitalList) window.renderHospitalList();
  };

  let cachedIndonesiaSvgText = null;
  let mapTooltipDiv = null;

  function latLngToSvgCoords(lat, lng) {
    // Calibrated projection for assets/indonesia.svg (2021 x 922)
    const x = -3978.87 + 41.9285 * lng - 0.3724 * lat;
    const y = 382.17 + 0.3414 * lng - 43.38 * lat;
    return [Math.max(20, Math.min(2000, x)), Math.max(20, Math.min(900, y))];
  }

  function showMapTooltip(e, hospital, isTarget) {
    if (!mapTooltipDiv) {
      mapTooltipDiv = document.createElement("div");
      mapTooltipDiv.style.cssText = "position: absolute; z-index: 10000; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.25); font-family: Inter, sans-serif; pointer-events: none; transform: translate(-50%, -100%); margin-top: -12px;";
      document.body.appendChild(mapTooltipDiv);
    }

    mapTooltipDiv.innerHTML = `
      <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">${escapeHtml(hospital.name)}</div>
      <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">📍 ${escapeHtml(hospital.city)}, ${escapeHtml(hospital.province)} · Kelas ${escapeHtml(hospital.class || '-')}</div>
      <div style="font-size: 11px; line-height: 1.5; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 6px;">
        <div><strong>Total Kasus:</strong> ${formatNumber(hospital.total[0])}</div>
        <div><strong>INA-CBG:</strong> ${formatMoney(hospital.total[1])}</div>
        <div><strong>iDRG:</strong> ${formatMoney(hospital.total[2])}</div>
      </div>
      <div style="font-size: 10px; font-weight: 800; color: #2563eb; margin-top: 6px; text-align: center;">🎯 Klik untuk memilih RS Target</div>
    `;

    mapTooltipDiv.style.left = `${e.pageX}px`;
    mapTooltipDiv.style.top = `${e.pageY}px`;
    mapTooltipDiv.style.display = "block";
  }

  function hideMapTooltip() {
    if (mapTooltipDiv) mapTooltipDiv.style.display = "none";
  }

  // --- REUSABLE INTERACTIVE SVG MAP CONTROLLER (ZOOM & PAN) ---
  function setupSvgPanZoom(container, svgEl, initialFocusPoint = null, initialZoom = 1.0) {
    if (!container || !svgEl) return null;

    const baseWidth = 2021;
    const baseHeight = 922;
    const minZoom = 0.7;
    const maxZoom = 12.0;

    let zoom = initialZoom || 1.0;
    let vbW = baseWidth / zoom;
    let vbH = baseHeight / zoom;
    let vbX = 0;
    let vbY = 0;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startVbX = 0;
    let startVbY = 0;

    function applyViewBox() {
      vbW = baseWidth / zoom;
      vbH = baseHeight / zoom;

      const minX = -baseWidth * 0.4;
      const maxX = baseWidth * 1.4 - vbW;
      const minY = -baseHeight * 0.4;
      const maxY = baseHeight * 1.4 - vbH;

      vbX = Math.max(minX, Math.min(maxX, vbX));
      vbY = Math.max(minY, Math.min(maxY, vbY));

      svgEl.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);

      const badge = container.querySelector(".map-zoom-badge");
      if (badge) {
        badge.textContent = `${Math.round(zoom * 100)}%`;
      }
    }

    function setZoomAtPoint(newZoom, clientX, clientY) {
      newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
      if (Math.abs(newZoom - zoom) < 0.01) return;

      const rect = svgEl.getBoundingClientRect();
      const fx = (clientX - rect.left) / rect.width;
      const fy = (clientY - rect.top) / rect.height;

      const ptX = vbX + fx * vbW;
      const ptY = vbY + fy * vbH;

      zoom = newZoom;
      vbW = baseWidth / zoom;
      vbH = baseHeight / zoom;

      vbX = ptX - fx * vbW;
      vbY = ptY - fy * vbH;

      applyViewBox();
    }

    function focusCoords(targetSvgX, targetSvgY, targetZoom = 2.5) {
      zoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
      vbW = baseWidth / zoom;
      vbH = baseHeight / zoom;
      vbX = targetSvgX - vbW / 2;
      vbY = targetSvgY - vbH / 2;
      applyViewBox();
    }

    function resetView() {
      zoom = 1.0;
      vbX = 0;
      vbY = 0;
      vbW = baseWidth;
      vbH = baseHeight;
      applyViewBox();
    }

    if (initialFocusPoint && initialZoom > 1.0) {
      focusCoords(initialFocusPoint[0], initialFocusPoint[1], initialZoom);
    } else {
      resetView();
    }

    svgEl.style.cursor = "grab";

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startVbX = vbX;
      startVbY = vbY;
      svgEl.style.cursor = "grabbing";
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const rect = svgEl.getBoundingClientRect();
      const scaleX = vbW / rect.width;
      const scaleY = vbH / rect.height;

      vbX = startVbX - dx * scaleX;
      vbY = startVbY - dy * scaleY;
      applyViewBox();
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        svgEl.style.cursor = "grab";
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
      setZoomAtPoint(zoom * zoomFactor, e.clientX, e.clientY);
    };

    const onDblClick = (e) => {
      e.preventDefault();
      setZoomAtPoint(zoom * 1.5, e.clientX, e.clientY);
    };

    // Touch support (1 finger drag, 2 finger pinch)
    let initialTouchDist = 0;
    let initialTouchZoom = 1;
    let touchMidX = 0;
    let touchMidY = 0;

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startVbX = vbX;
        startVbY = vbY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        initialTouchZoom = zoom;
        touchMidX = (t1.clientX + t2.clientX) / 2;
        touchMidY = (t1.clientY + t2.clientY) / 2;
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        const rect = svgEl.getBoundingClientRect();
        vbX = startVbX - dx * (vbW / rect.width);
        vbY = startVbY - dy * (vbH / rect.height);
        applyViewBox();
        e.preventDefault();
      } else if (e.touches.length === 2 && initialTouchDist > 0) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const factor = currentDist / initialTouchDist;
        setZoomAtPoint(initialTouchZoom * factor, touchMidX, touchMidY);
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
      initialTouchDist = 0;
    };

    svgEl.onmousedown = onMouseDown;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    svgEl.addEventListener("wheel", onWheel, { passive: false });
    svgEl.ondblclick = onDblClick;
    svgEl.addEventListener("touchstart", onTouchStart, { passive: false });
    svgEl.addEventListener("touchmove", onTouchMove, { passive: false });
    svgEl.addEventListener("touchend", onTouchEnd);

    // Toolbar controls
    let toolbar = container.querySelector(".map-controls-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "map-controls-toolbar";
      toolbar.style.cssText = `
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 50;
        display: flex;
        flex-direction: column;
        gap: 5px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 5px;
        box-shadow: 0 4px 15px rgba(15, 23, 42, 0.12);
        user-select: none;
      `;
      container.appendChild(toolbar);
    }

    toolbar.innerHTML = `
      <button class="map-btn-zoom-in" title="Perbesar (Zoom In)" style="width: 30px; height: 30px; border-radius: 6px; border: 1px solid #e2e8f0; background: #ffffff; color: #0f172a; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.background='#f1f5f9';this.style.color='#0284c7';" onmouseout="this.style.background='#ffffff';this.style.color='#0f172a';">➕</button>
      <button class="map-btn-zoom-out" title="Perkecil (Zoom Out)" style="width: 30px; height: 30px; border-radius: 6px; border: 1px solid #e2e8f0; background: #ffffff; color: #0f172a; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.background='#f1f5f9';this.style.color='#0284c7';" onmouseout="this.style.background='#ffffff';this.style.color='#0f172a';">➖</button>
      <button class="map-btn-target" title="Fokus ke RS Target" style="width: 30px; height: 30px; border-radius: 6px; border: 1px solid #fecaca; background: #fff5f5; color: #dc2626; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.background='#fee2e2';" onmouseout="this.style.background='#fff5f5';">🎯</button>
      <button class="map-btn-reset" title="Reset Tampilan Peta Penuh" style="width: 30px; height: 30px; border-radius: 6px; border: 1px solid #e2e8f0; background: #ffffff; color: #475569; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.background='#f1f5f9';this.style.color='#0284c7';" onmouseout="this.style.background='#ffffff';this.style.color='#475569';">⟲</button>
      <div class="map-zoom-badge" style="font-size: 10px; font-weight: 800; color: #0284c7; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 3px; margin-top: 1px;">${Math.round(zoom * 100)}%</div>
    `;

    toolbar.querySelector(".map-btn-zoom-in").onclick = () => {
      const rect = svgEl.getBoundingClientRect();
      setZoomAtPoint(zoom * 1.4, rect.left + rect.width / 2, rect.top + rect.height / 2);
    };

    toolbar.querySelector(".map-btn-zoom-out").onclick = () => {
      const rect = svgEl.getBoundingClientRect();
      setZoomAtPoint(zoom / 1.4, rect.left + rect.width / 2, rect.top + rect.height / 2);
    };

    toolbar.querySelector(".map-btn-target").onclick = () => {
      const target = targetHospital();
      if (target) {
        const rawCoords = getHospitalCoords(target);
        const [svgX, svgY] = latLngToSvgCoords(rawCoords[0], rawCoords[1]);
        focusCoords(svgX, svgY, 2.8);
      }
    };

    toolbar.querySelector(".map-btn-reset").onclick = () => {
      resetView();
    };

    let guide = container.querySelector(".map-guide-badge");
    if (!guide) {
      guide = document.createElement("div");
      guide.className = "map-guide-badge";
      guide.style.cssText = `
        position: absolute;
        bottom: 10px;
        left: 12px;
        z-index: 40;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(6px);
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 3px 8px;
        font-size: 10.5px;
        font-weight: 700;
        color: #334155;
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 5px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.06);
      `;
      guide.innerHTML = `<span>🖱️ Geser untuk Navigasi · Scroll untuk Zoom</span>`;
      container.appendChild(guide);
    }

    return {
      focusCoords,
      resetView,
      setZoomAtPoint,
      getZoom: () => zoom
    };
  }

  function applyKemenkesLightMapTheme(svgEl, isSlide8 = false) {
    if (!svgEl) return;
    svgEl.style.width = "100%";
    svgEl.style.height = "100%";

    // 1. Lautan (Ocean): Clean white/oceanic background
    const lautan = svgEl.querySelector("#Lautan rect");
    if (lautan) {
      if (isSlide8) {
        lautan.setAttribute("style", "fill: #ffffff; stroke: #e2e8f0; stroke-width: 1px;");
      } else {
        lautan.setAttribute("style", "fill: #e0f2fe; stroke: #bae6fd; stroke-width: 1px;");
      }
    }

    // 2. Outsider (Neighboring lands): Soft subtle neutral
    const outsider = svgEl.querySelector("#Outsider");
    if (outsider) {
      outsider.querySelectorAll("path").forEach(p => {
        p.setAttribute("style", "fill: #f8fafc; stroke: #e2e8f0; stroke-width: 1px; opacity: 0.6; stroke-linecap: round;");
      });
    }

    // 3. Indonesia Map Provinces
    const indoMap = svgEl.querySelector("#Indonesia-Map");
    const activeProvList = [...new Set((data.hospitals || []).map(h => h.province).filter(Boolean))];

    if (indoMap) {
      indoMap.querySelectorAll("g[id]").forEach(g => {
        const id = g.getAttribute("id") || "";
        const normId = id.toUpperCase().replace(/[-_]+/g, ' ');
        const isSelected = activeProvList.some(p => normId.includes(p.toUpperCase()) || p.toUpperCase().includes(normId));

        g.querySelectorAll("path").forEach(path => {
          if (isSlide8) {
            if (isSelected) {
              path.setAttribute("style", "fill: #60a5fa; stroke: #0284c7; stroke-width: 1.4px; stroke-linejoin: round;");
            } else {
              path.setAttribute("style", "fill: #f1f5f9; stroke: #cbd5e1; stroke-width: 0.8px; stroke-linejoin: round;");
            }
          } else {
            if (isSelected) {
              path.setAttribute("style", "fill: #86efac; stroke: #15803d; stroke-width: 1.4px; stroke-linejoin: round;");
            } else {
              path.setAttribute("style", "fill: #bbf7d0; stroke: #475569; stroke-width: 1px; stroke-linejoin: round;");
            }
          }
        });
      });
    }
  }

  function renderMarkersOverlay(svgEl, activeHospitals, options = {}) {
    if (!svgEl) return;
    let oldLayer = svgEl.querySelector("#hospitalMarkersLayer");
    if (oldLayer) oldLayer.remove();

    const isSlide8 = typeof options === 'boolean' ? options : (options.isSlide8 || false);
    const isMuhammadiyahMap = typeof options === 'object' && options.isMuhammadiyahMap;
    const targetCodesSet = new Set(state.targetCodes || (state.targetCode ? [state.targetCode] : []));
    // Avoid creating thousands of pulsing SVG target pins for a bulk
    // selection. The hospitals remain visible as lightweight regular dots.
    const useBulkTargetMarkers = targetCodesSet.size > 25;

    const gMarkers = document.createElementNS("http://www.w3.org/2000/svg", "g");
    gMarkers.setAttribute("id", "hospitalMarkersLayer");

    const top5Hospitals = isSlide8 ? [...activeHospitals].sort((a, b) => b.total[0] - a.total[0]).slice(0, 5) : [];

    // Separate other hospitals and target hospitals
    const otherHospitals = [];
    const targetHosps = [];

    activeHospitals.forEach(h => {
      if (!useBulkTargetMarkers && targetCodesSet.has(h.code)) {
        targetHosps.push(h);
      } else {
        otherHospitals.push(h);
      }
    });

    const primaryTargetHosp = targetHosps[0] || null;

    // 1. If Slide 8 (Regional Profile): Draw referral dashed lines with arrows towards Primary Target Hospital
    if (isSlide8 && primaryTargetHosp) {
      const rawTargetCoords = getHospitalCoords(primaryTargetHosp);
      const [targetSvgX, targetSvgY] = latLngToSvgCoords(rawTargetCoords[0], rawTargetCoords[1]);

      // Add defs for arrow marker if not present
      let defs = svgEl.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        svgEl.prepend(defs);
      }
      if (!svgEl.querySelector("#referralArrow")) {
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.setAttribute("id", "referralArrow");
        marker.setAttribute("viewBox", "0 0 10 10");
        marker.setAttribute("refX", "6");
        marker.setAttribute("refY", "5");
        marker.setAttribute("markerWidth", "6");
        marker.setAttribute("markerHeight", "6");
        marker.setAttribute("orient", "auto");
        marker.innerHTML = `<path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ea580c" />`;
        defs.appendChild(marker);
      }

      const gLines = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gLines.setAttribute("id", "referralLinesLayer");

      top5Hospitals.forEach((h, idx) => {
        if (targetCodesSet.has(h.code)) return;
        const rawCoords = getHospitalCoords(h);
        const [svgX, svgY] = latLngToSvgCoords(rawCoords[0], rawCoords[1]);

        // Calculate slight curve control point
        const midX = (svgX + targetSvgX) / 2;
        const midY = (svgY + targetSvgY) / 2;
        const dx = targetSvgX - svgX;
        const dy = targetSvgY - svgY;
        const curvature = (idx % 2 === 0 ? 0.12 : -0.12);
        const ctrlX = midX - dy * curvature;
        const ctrlY = midY + dx * curvature;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${svgX},${svgY} Q ${ctrlX},${ctrlY} ${targetSvgX},${targetSvgY}`);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "#ea580c");
        path.setAttribute("stroke-width", "2.2");
        path.setAttribute("stroke-dasharray", "6,4");
        path.setAttribute("marker-end", "url(#referralArrow)");
        path.setAttribute("opacity", "0.9");
        gLines.appendChild(path);
      });

      gMarkers.appendChild(gLines);
    }

    // 2. Render other hospitals
    otherHospitals.forEach(h => {
      const rawCoords = getHospitalCoords(h);
      const [svgX, svgY] = latLngToSvgCoords(rawCoords[0], rawCoords[1]);

      const isMuhammadiyah = isMuhammadiyahHospital(h);
      const isTop5 = isSlide8 && top5Hospitals.some(top => top.code === h.code);

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("transform", `translate(${svgX}, ${svgY})`);
      g.setAttribute("style", "cursor: pointer; pointer-events: all;");

      if (isMuhammadiyahMap) {
        g.innerHTML = `
          <circle r="9" fill="rgba(5, 150, 105, 0.22)">
            <animate attributeName="r" values="6;13;6" dur="3s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="3s" repeatCount="indefinite"/>
          </circle>
          <circle r="4.2" fill="#059669" stroke="#ffffff" stroke-width="1.3" filter="drop-shadow(0 2px 4px rgba(5,150,105,0.4))"/>
          <circle r="1.6" fill="#ffffff"/>
        `;
      } else if (isSlide8 && isTop5) {
        // Orange circular ring marker for Slide 8 referral origins
        g.innerHTML = `
          <circle r="6" fill="#ffffff" stroke="#ea580c" stroke-width="2.4" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.25))"/>
        `;
      } else if (isTop5) {
        g.innerHTML = `
          <circle r="5.4" fill="#059669" opacity="0.2"/>
          <circle r="3.4" fill="#059669" stroke="#ffffff" stroke-width="0.8"/>
          <text x="7" y="3" fill="#0f172a" font-size="9" font-weight="700" stroke="#ffffff" stroke-width="2" paint-order="stroke">${escapeHtml(h.name.slice(0, 14))}</text>
        `;
      } else {
        let fillColor = isMuhammadiyah ? '#16a34a' : '#0284c7';
        let radius = isMuhammadiyah ? 3.0 : 2.4;
        g.innerHTML = `
          <circle r="${radius}" fill="${fillColor}" stroke="#ffffff" stroke-width="0.6" opacity="0.85"/>
        `;
      }

      g.addEventListener("click", (e) => {
        e.stopPropagation();
        hideMapTooltip();
        window.selectTargetHospital(h.code);
      });

      g.addEventListener("mouseenter", (e) => {
        showMapTooltip(e, h, false);
      });

      g.addEventListener("mouseleave", () => {
        hideMapTooltip();
      });

      gMarkers.appendChild(g);
    });

    // 3. Render Target Hospitals (All selected targets on top)
    targetHosps.forEach(targetHosp => {
      const rawCoords = getHospitalCoords(targetHosp);
      const [svgX, svgY] = latLngToSvgCoords(rawCoords[0], rawCoords[1]);

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("transform", `translate(${svgX}, ${svgY})`);
      g.setAttribute("style", "cursor: pointer; pointer-events: all; z-index: 100;");

      if (isSlide8) {
        // Teal circular badge with hospital icon matching the requested slide
        g.innerHTML = `
          <circle r="22" fill="rgba(13, 148, 136, 0.22)">
            <animate attributeName="r" values="16;28;16" dur="2.4s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2.4s" repeatCount="indefinite"/>
          </circle>
          <circle r="14" fill="#0d9488" stroke="#ffffff" stroke-width="2.5" filter="drop-shadow(0 2px 6px rgba(13,148,136,0.4))"/>
          <circle r="10" fill="#14b8a6"/>
          <path d="M -4,3 H 4 V -3 H -4 Z M -1.5,3 V 0.5 H 1.5 V 3 Z M -2.5,-1 H -0.5 V -2.5 H -2.5 Z M 0.5,-1 H 2.5 V -2.5 H 0.5 Z" fill="#ffffff"/>
        `;
      } else {
        // Teardrop Hospital Pin pointing at (0,0)
        g.innerHTML = `
          <!-- Pulsing radar halo waves -->
          <circle r="36" fill="rgba(220, 38, 38, 0.15)">
            <animate attributeName="r" values="16;42;16" dur="2.4s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2.4s" repeatCount="indefinite"/>
          </circle>
          <circle r="22" fill="rgba(220, 38, 38, 0.25)">
            <animate attributeName="r" values="12;28;12" dur="2.4s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2.4s" repeatCount="indefinite"/>
          </circle>

          <!-- Shadow under pin -->
          <ellipse cx="0" cy="2" rx="10" ry="4" fill="rgba(15, 23, 42, 0.25)"/>

          <!-- Teardrop Hospital Pin pointing at (0,0) -->
          <path d="M 0,0 C -5,-7 -15,-16 -15,-26 C -15,-35 -8,-42 0,-42 C 8,-42 15,-35 15,-26 C 15,-16 5,-7 0,0 Z" 
                fill="#dc2626" stroke="#ffffff" stroke-width="2.5" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.35))"/>

          <!-- White Inner Disc -->
          <circle cx="0" cy="-26" r="9.5" fill="#ffffff"/>

          <!-- Red Hospital Medical Cross Symbol (+) -->
          <path d="M -3,-28.5 H -1 V -32.5 H 1 V -28.5 H 3 V -23.5 H 1 V -19.5 H -1 V -23.5 H -3 Z" fill="#dc2626"/>

          <!-- Floating Name Badge on Top of Pin -->
          <g transform="translate(0, -50)">
            <rect x="-70" y="-18" width="140" height="20" rx="10" fill="rgba(220, 38, 38, 0.96)" stroke="#ffffff" stroke-width="1.8" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.25))"/>
            <text x="0" y="-4" text-anchor="middle" fill="#ffffff" font-size="10.5" font-weight="900" font-family="'Inter', sans-serif">🎯 ${escapeHtml(targetHosp.name.length > 20 ? targetHosp.name.slice(0, 18) + '...' : targetHosp.name)}</text>
          </g>
        `;
      }

      g.addEventListener("click", (e) => {
        e.stopPropagation();
        hideMapTooltip();
        window.selectTargetHospital(targetHosp.code);
      });

      g.addEventListener("mouseenter", (e) => {
        showMapTooltip(e, targetHosp, true);
      });

      g.addEventListener("mouseleave", () => {
        hideMapTooltip();
      });

      gMarkers.appendChild(g);
    });

    svgEl.appendChild(gMarkers);
  }

  function renderUnifiedInteractiveMap(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isSlide8 = options.isSlide8 || false;
    const isMuhammadiyahMap = options.isMuhammadiyahMap || false;
    const regionFilter = options.regionFilter || "ALL";

    let activeHospitals = data.hospitals || [];

    if (isMuhammadiyahMap) {
      activeHospitals = activeHospitals.filter(isMuhammadiyahHospital);
      if (regionFilter && regionFilter !== "ALL") {
        if (regionFilter === "LUAR_JAWA") {
          activeHospitals = activeHospitals.filter(h => !/jawa|yogyakarta|jakarta|banten/i.test(h.province));
        } else {
          activeHospitals = activeHospitals.filter(h => (h.province || '').toUpperCase().includes(regionFilter));
        }
      }
    } else if (!isSlide8) {
      const countSpan = document.getElementById("mapHospitalCount");
      if (countSpan) countSpan.textContent = activeHospitals.length.toLocaleString('id-ID');
    }

    const setupContent = (svgText) => {
      container.innerHTML = svgText;
      const svgEl = container.querySelector("svg");
      if (!svgEl) return;

      applyKemenkesLightMapTheme(svgEl, isSlide8 || isMuhammadiyahMap);
      renderMarkersOverlay(svgEl, activeHospitals, options);

      const target = targetHospital();
      let initialPoint = null;
      let initialZoom = 1.0;

      if (isMuhammadiyahMap) {
        if (regionFilter === "JAWA TENGAH") {
          initialPoint = [725, 605];
          initialZoom = 2.8;
        } else if (regionFilter === "JAWA TIMUR") {
          initialPoint = [850, 630];
          initialZoom = 2.8;
        } else if (regionFilter === "DAERAH ISTIMEWA YOGYAKARTA") {
          initialPoint = [715, 620];
          initialZoom = 4.2;
        } else if (regionFilter === "JAWA BARAT") {
          initialPoint = [580, 580];
          initialZoom = 2.8;
        } else if (target && isMuhammadiyahHospital(target)) {
          const rawCoords = getHospitalCoords(target);
          initialPoint = latLngToSvgCoords(rawCoords[0], rawCoords[1]);
          initialZoom = 1.8;
        }
      } else if (target) {
        const rawCoords = getHospitalCoords(target);
        initialPoint = latLngToSvgCoords(rawCoords[0], rawCoords[1]);
        if (isSlide8) {
          initialZoom = 2.4; // Magnified regional focus on Slide 8
        }
      }

      setupSvgPanZoom(container, svgEl, initialPoint, initialZoom);
    };

    if (cachedIndonesiaSvgText) {
      setupContent(cachedIndonesiaSvgText);
    } else {
      fetch("assets/indonesia.svg")
        .then(res => res.text())
        .then(svgText => {
          cachedIndonesiaSvgText = svgText;
          setupContent(svgText);
        })
        .catch(err => {
          console.error("Error loading SVG map:", err);
        });
    }
  }

  function renderMapSlide() {
    renderUnifiedInteractiveMap("svgMapContainer", { isSlide8: false });
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

    const target = targetHospital();
    if (target && data.services) {
      data.services.sort((a, b) => {
        const casesA = target.services[a] && target.services[a].total ? target.services[a].total[0] : 0;
        const casesB = target.services[b] && target.services[b].total ? target.services[b].total[0] : 0;
        return casesB - casesA;
      });
    }

    updateTargetMeta();
    renderTargetSummarySlide();
    renderMapSlide();
    renderExistingSlide();
    renderRegionalSlide();
    renderAddressableSlide();
    renderComparisonSlide();
    renderRegionalCasesSlide();
    renderGlobalSimulationSlide();
    if(typeof renderCompetencySimSlide === "function") renderCompetencySimSlide();
    renderDynamicMarketShareSlide();
    renderRegionalProfileSlide();
    renderIcdCompetencySlide();
    renderMuhammadiyahMapSlide();
    renderMuhammadiyahGroupSlide();
    renderNationalRawatTypeSlide();
    renderNationalSpendingClassSlide();
    renderNationalRawatInapSlide();
    renderNationalSeveritySlide();
    renderNationalRawatJalanSlide();
    renderNationalQ5440Slide();
    renderScenarioSlide();
    renderRecapSlide();
    renderLogicalRecapSlide();
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


  function autoFitSlideTitles(root = document) {
    const titles = root.querySelectorAll(".slide-heading h1");
    titles.forEach((h1) => {
      h1.style.whiteSpace = "nowrap";
      h1.style.overflow = "hidden";
      h1.style.textOverflow = "ellipsis";
      
      const parent = h1.parentElement;
      if (!parent) return;
      
      h1.style.fontSize = "";
      const availWidth = (parent.clientWidth || 1000) - 20;
      let currentFontSize = parseFloat(window.getComputedStyle(h1).fontSize) || 34;
      
      if (currentFontSize > 36) {
        currentFontSize = 36;
        h1.style.fontSize = currentFontSize + "px";
      }
      
      while (h1.scrollWidth > availWidth && currentFontSize > 16) {
        currentFontSize -= 1;
        h1.style.fontSize = currentFontSize + "px";
      }
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
    autoFitSlideTitles();
    if (state.activeSlide === 1 && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 50);
    }
  }

  let isHospitalSearchSetup = false;

  function populateHospitalSelector() {
    const input = document.getElementById("targetHospitalInput");
    const dropdown = document.getElementById("targetHospitalDropdown");
    
    if (!input || !dropdown) return;

    function updateHospitalInputText() {
      const selected = getTargetHospitals();
      if (selected.length === 0) {
        input.value = "";
      } else if (selected.length === 1) {
        input.value = `${selected[0].name} · ${selected[0].city}`;
      } else if (selected.length === originalData.hospitals.length) {
        input.value = `Semua RS (${selected.length} RS Nasional)`;
      } else {
        const firstShort = (selected[0].name || "").replace(/^RS(UD)?\s+/i, '').substring(0, 14);
        input.value = `${selected.length} RS Terpilih (${firstShort}... +${selected.length - 1})`;
      }
    }

    window.renderHospitalList = (searchTerm = "") => {
      const term = searchTerm.toLowerCase().trim();
      const pool = term ? originalData.hospitals : data.hospitals;
      const filtered = pool.filter(h => 
        h.name.toLowerCase().includes(term) || h.city.toLowerCase().includes(term) || h.code.toLowerCase().includes(term)
      );
      const visibleHospitals = filtered.slice(0, 250);
      
      const selectedSet = new Set(state.targetCodes || (state.targetCode ? [state.targetCode] : []));

      dropdown.innerHTML = `
        <div style="position: sticky; top: 0; background: #f8fafc; z-index: 10; border-bottom: 1px solid #e2e8f0; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center; gap: 6px;">
          <button type="button" class="btn-target-all" style="flex: 1; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 5px; cursor: pointer; padding: 4px 6px; font-size: 11px; font-weight: 750; transition: all 0.15s; white-space: nowrap;">
            ✓ Pilih Semua (${filtered.length})
          </button>
          <button type="button" class="btn-target-reset" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 5px; cursor: pointer; padding: 4px 6px; font-size: 11px; font-weight: 750; transition: all 0.15s; white-space: nowrap;">
            ✕ Reset (1 RS)
          </button>
        </div>
        <div class="search-select-options" style="max-height: 280px; overflow-y: auto;">
          ${visibleHospitals.map(hospital => {
            const isChecked = selectedSet.has(hospital.code);
            return `
              <div class="search-select-item ${isChecked ? 'is-active' : ''}" data-code="${escapeHtml(hospital.code)}" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #f1f5f9; ${isChecked ? 'background: #f0fdf4;' : ''}">
                <input type="checkbox" class="target-hosp-cb" data-code="${escapeHtml(hospital.code)}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; flex-shrink: 0; margin: 0;">
                <div style="flex: 1; min-width: 0; pointer-events: none;">
                  <div style="font-weight: 750; color: ${isChecked ? '#166534' : '#0f172a'}; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(hospital.name)}</div>
                  <div style="font-size: 10.5px; color: #64748b;">${escapeHtml(hospital.city)} · ${escapeHtml(hospital.province || '')} · Kelas ${escapeHtml(hospital.class || '-')}</div>
                </div>
              </div>
            `;
          }).join("")}
          ${filtered.length > visibleHospitals.length ? `
            <div style="padding: 8px 10px; background: #fffbeb; color: #92400e; font-size: 10.5px; font-weight: 700; text-align: center;">
              Menampilkan 250 dari ${filtered.length} RS. Ketik nama/kota untuk mempersempit daftar.
            </div>
          ` : ''}
        </div>
      `;
      
      const btnTargetAll = dropdown.querySelector('.btn-target-all');
      if (btnTargetAll) {
        btnTargetAll.addEventListener('click', (e) => {
          e.stopPropagation();
          const selectedCodes = filtered.map(h => h.code);
          btnTargetAll.disabled = true;
          btnTargetAll.textContent = `Memproses ${selectedCodes.length} RS...`;
          window.requestAnimationFrame(() => window.setTimeout(() => {
            state.targetCodes = selectedCodes;
            state.targetCode = state.targetCodes[0] || "";
            state.serviceScenarios = {};
            updateHospitalInputText();
            renderAll();
            window.renderHospitalList(searchTerm);
          }, 0));
        });
      }

      const btnTargetReset = dropdown.querySelector('.btn-target-reset');
      if (btnTargetReset) {
        btnTargetReset.addEventListener('click', (e) => {
          e.stopPropagation();
          const firstCode = filtered[0]?.code || originalData.hospitals[0]?.code || "";
          state.targetCodes = firstCode ? [firstCode] : [];
          state.targetCode = firstCode;
          state.serviceScenarios = {};
          updateHospitalInputText();
          renderAll();
          window.renderHospitalList(searchTerm);
        });
      }

      dropdown.querySelectorAll('.search-select-item').forEach(item => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const code = item.dataset.code;
          let current = new Set(state.targetCodes || (state.targetCode ? [state.targetCode] : []));
          if (current.has(code)) {
            current.delete(code);
            if (current.size === 0) {
              current.add(code);
            }
          } else {
            current.add(code);
          }
          state.targetCodes = Array.from(current);
          state.targetCode = state.targetCodes[0] || "";
          state.serviceScenarios = {};
          
          const clickedHosp = originalData.hospitals.find(h => h.code === code);
          if (clickedHosp && clickedHosp.province) {
            const provCb = document.querySelector(`#provDropdown input[value="${clickedHosp.province}"]`);
            if (provCb && !provCb.checked) {
              provCb.checked = true;
              applyFilters();
              updateButtonLabels();
            }
          }

          const target = targetHospital();
          if (target && !getCompetency(target, state.selectedService)) {
            state.selectedService = data.services.find((service) => getCompetency(target, service) > 0 || service.toLowerCase().includes('forensik')) || data.services[0];
          }
          if (target) {
            state.selectedSeverity = getCompetency(target, state.selectedService) || 1;
          }
          
          updateHospitalInputText();
          renderAll();
          window.renderHospitalList(searchTerm);
        });
      });
    };

    window.renderHospitalList();
    updateHospitalInputText();

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
          updateHospitalInputText();
        }
      });
    }
  }

  function populateSlideDots() {
    const count = document.querySelectorAll(".slide").length;
    const container = document.getElementById("slideDots");
    if (!container) return;
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("button");
      dot.className = `slide-dot ${i === state.activeSlide ? "is-active" : ""}`;
      dot.dataset.index = i;
      dot.setAttribute("aria-label", `Slide ${i + 1}`);
      container.appendChild(dot);
    }
    container.querySelectorAll(".slide-dot").forEach((button) => button.addEventListener("click", () => showSlide(Number(button.dataset.index))));
  }

  function resizeDeck() {
    const scaler = document.getElementById("deckScaler");
    const shell = scaler?.querySelector(".deck-shell");
    const stage = document.querySelector(".viewport-stage");
    if (!scaler || !shell || !stage) return;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const stageRect = stage.getBoundingClientRect();
    const availableWidth = Math.max((stage.clientWidth || stageRect.width || window.innerWidth) - (isMobile ? 16 : 20), 1);
    const availableHeight = Math.max(window.innerHeight - 20, 1);

    // A minimum mobile scale keeps text and controls usable by touch. The
    // resulting 16:9 workspace can be panned horizontally when necessary.
    const fitScale = isMobile
      ? availableWidth / 1920
      : Math.min(availableWidth / 1920, availableHeight / 1080);
    const scale = isMobile ? Math.max(fitScale, 0.55) : fitScale;
    const width = 1920 * scale;
    const height = 1080 * scale;
    scaler.style.width = `${width}px`;
    scaler.style.height = `${height}px`;
    // Desktop centering is already handled by .viewport-stage's grid. Adding
    // positional offsets here would center the canvas a second time.
    scaler.style.left = "0px";
    scaler.style.top = "0px";
    shell.style.transform = `scale(${scale})`;
  }

  let isFiltersInitialized = false;

  function initFilterEventListeners() {
    if (isFiltersInitialized) return;
    isFiltersInitialized = true;

    const provBtn = document.getElementById("provBtn");
    const cityBtn = document.getElementById("cityBtn");
    
    const globalSimServiceSelect = document.getElementById("globalSimServiceSelect");
    if (globalSimServiceSelect && originalData.services) {
      const currentVal = globalSimServiceSelect.value || 'ALL';
      // Use standard JS replacement instead of formatService since formatService might not be available here, or it is?
      // formatService is usually available globally. Let's assume it is.
      globalSimServiceSelect.innerHTML = '<option value="ALL">Semua Layanan (Global)</option>' + originalData.services.map(s => `<option value="${s}">${typeof formatService === 'function' ? formatService(s) : s.replace(/_/g, ' ')}</option>`).join('');
      if (Array.from(globalSimServiceSelect.options).some(o => o.value === currentVal)) {
        globalSimServiceSelect.value = currentVal;
      }
      globalSimServiceSelect.addEventListener('change', () => {
        if(typeof renderGlobalSimulationSlide === "function") renderGlobalSimulationSlide();
        if(typeof renderCompetencySimSlide === "function") renderCompetencySimSlide();
        const selectedService = globalSimServiceSelect.value;
        if (selectedService && selectedService !== 'ALL') window.dynamicMarketService = selectedService;
        renderDynamicMarketShareSlide();
        if(typeof renderRecapSlide === "function") renderRecapSlide();
        if(typeof renderLogicalRecapSlide === "function") renderLogicalRecapSlide();
      });
    }

    const provDropdown = document.getElementById("provDropdown");
    const cityDropdown = document.getElementById("cityDropdown");

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

    const presetMuhammadiyahBtn = document.getElementById("presetMuhammadiyahBtn");
    if (presetMuhammadiyahBtn) {
      presetMuhammadiyahBtn.addEventListener("click", () => {
        const toggle = document.getElementById("muhammadiyahFilterToggle");
        if (toggle) toggle.checked = true;
        document.querySelectorAll('#provDropdown input[type="checkbox"], #cityDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
        applyFilters();
        updateButtonLabels();
      });
    }

    const mhkToggle = document.getElementById("muhammadiyahFilterToggle");
    if (mhkToggle) {
      mhkToggle.addEventListener("change", () => {
        applyFilters();
        updateButtonLabels();
      });
    }

    const presetBtn = document.getElementById("presetMoewardiBtn");
    if (presetBtn) {
      presetBtn.addEventListener("click", () => {
        const mhkT = document.getElementById("muhammadiyahFilterToggle");
        if (mhkT) mhkT.checked = false;

        const moewardiProvTerms = ['DI YOGYAKARTA', 'JAWA TENGAH', 'JAWA TIMUR', 'DIY'];
        const moewardiCityTerms = ['SURAKARTA', 'SUKOHARJO', 'KARANGANYAR', 'SRAGEN', 'BOYOLALI', 'WONOGIRI', 'KLATEN', 'PACITAN', 'NGAWI', 'MADIUN', 'YOGYAKARTA', 'SLEMAN', 'SEMARANG'];
        
        document.querySelectorAll('#provDropdown input[type="checkbox"], #cityDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('#provDropdown input[type="checkbox"]').forEach(cb => {
          if (moewardiProvTerms.some(term => cb.value.toUpperCase().includes(term))) cb.checked = true;
        });
        document.querySelectorAll('#cityDropdown input[type="checkbox"]').forEach(cb => {
          if (moewardiCityTerms.some(term => cb.value.toUpperCase().includes(term))) cb.checked = true;
        });

        if (originalData.hospitals.some(h => h.code === "3372015")) {
          state.targetCode = "3372015";
          state.targetCodes = ["3372015"];
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

    const presetJabarBtn = document.getElementById("presetJabarBtn");
    if (presetJabarBtn) {
      presetJabarBtn.addEventListener("click", () => {
        const mhkT = document.getElementById("muhammadiyahFilterToggle");
        if (mhkT) mhkT.checked = false;

        const excludedTerms = ['BEKASI', 'BOGOR', 'DEPOK'];
        const jabarCities = Array.from(new Set(
          originalData.hospitals
            .filter(h => h.province && h.province.toUpperCase() === 'JAWA BARAT')
            .map(h => h.city.toUpperCase())
        ));
        const includedCities = jabarCities.filter(city => !excludedTerms.some(term => city.includes(term)));
        
        document.querySelectorAll('#provDropdown input[type="checkbox"], #cityDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('#provDropdown input[type="checkbox"]').forEach(cb => {
          if (cb.value.toUpperCase() === 'JAWA BARAT') cb.checked = true;
        });
        document.querySelectorAll('#cityDropdown input[type="checkbox"]').forEach(cb => {
          if (includedCities.includes(cb.value.toUpperCase())) cb.checked = true;
        });

        applyFilters();
        updateButtonLabels();
      });
    }
  }

  function populateFilters(preserveSelection = false) {
    const provDropdown = document.getElementById("provDropdown");
    const cityDropdown = document.getElementById("cityDropdown");

    let prevSelectedProvs = [];
    let prevSelectedCities = [];
    if (preserveSelection) {
      prevSelectedProvs = Array.from(provDropdown?.querySelectorAll("input:checked") || []).map(i => i.value);
      prevSelectedCities = Array.from(cityDropdown?.querySelectorAll("input:checked") || []).map(i => i.value);
    }

    const provinces = [...new Set(originalData.hospitals.map(h => h.province).filter(Boolean))].sort();
    
    const citiesByProv = {};
    originalData.hospitals.forEach(h => {
      if (h.city && h.province) {
        if (!citiesByProv[h.province]) citiesByProv[h.province] = new Set();
        citiesByProv[h.province].add(h.city);
      }
    });
    
    const groupedCities = Object.keys(citiesByProv).sort().map(prov => ({
      prov: prov,
      cities: [...citiesByProv[prov]].sort()
    }));
    
    const buildCheckboxes = (items, container, filterType) => {
      if (!container) return;
      
      const searchHtml = `
        <div class="multi-select-search-container">
          <input type="text" class="multi-select-search" placeholder="Cari..." autocomplete="off">
        </div>
        <div class="multi-select-actions" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 750;">
          <button type="button" class="btn-select-all" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 5px; cursor: pointer; padding: 3px 8px; font-size: 11px; font-weight: 750; transition: all 0.15s;">✓ Pilih Semua</button>
          <button type="button" class="btn-clear-all" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 5px; cursor: pointer; padding: 3px 8px; font-size: 11px; font-weight: 750; transition: all 0.15s;">✕ Hapus Semua</button>
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
      const btnSelectAll = container.querySelector('.btn-select-all');
      const btnClearAll = container.querySelector('.btn-clear-all');
      
      if (btnSelectAll) {
        btnSelectAll.addEventListener('click', (e) => {
          e.stopPropagation();
          labels.forEach(label => {
            if (label.style.display !== 'none' && label.dataset.valid !== 'false') {
              const cb = label.querySelector('input[type="checkbox"]');
              if (cb) cb.checked = true;
            }
          });
          applyFilters();
          updateButtonLabels();
        });
      }
      
      if (btnClearAll) {
        btnClearAll.addEventListener('click', (e) => {
          e.stopPropagation();
          container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
          applyFilters();
          updateButtonLabels();
        });
      }
      
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const term = e.target.value.toLowerCase();
          labels.forEach(label => {
            if (label.dataset.search.includes(term) && label.dataset.valid !== "false") {
              label.style.display = 'flex';
            } else {
              label.style.display = 'none';
            }
          });
        });
        searchInput.addEventListener('click', (e) => e.stopPropagation());
      }
      
      container.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
          applyFilters();
          updateButtonLabels();
        });
      });
    };
    
    const buildCityCheckboxes = (groups, container, filterType) => {
      if (!container) return;
      
      const searchHtml = `
        <div class="multi-select-search-container">
          <input type="text" class="multi-select-search" placeholder="Cari..." autocomplete="off">
        </div>
        <div class="multi-select-actions" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 750;">
          <button type="button" class="btn-select-all" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 5px; cursor: pointer; padding: 3px 8px; font-size: 11px; font-weight: 750; transition: all 0.15s;">✓ Pilih Semua</button>
          <button type="button" class="btn-clear-all" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 5px; cursor: pointer; padding: 3px 8px; font-size: 11px; font-weight: 750; transition: all 0.15s;">✕ Hapus Semua</button>
        </div>
        <div class="multi-select-options">
      `;
      
      const optionsHtml = groups.map(g => `
        <div class="city-group" data-prov="${escapeHtml(g.prov)}" data-search="${escapeHtml(g.prov.toLowerCase())}">
          <div class="city-group-title" style="font-weight:bold; padding: 4px 8px; background: #f1f5f9; font-size: 13px; color: #475569; position: sticky; top: 0; z-index: 2;">${escapeHtml(g.prov)}</div>
          ${g.cities.map(item => `
            <label class="checkbox-label" data-search="${escapeHtml(item.toLowerCase())}">
              <input type="checkbox" value="${escapeHtml(item)}" data-filter="${filterType}">
              <span>${escapeHtml(item)}</span>
            </label>
          `).join("")}
        </div>
      `).join("");
      
      container.innerHTML = searchHtml + optionsHtml + `</div>`;
      
      const searchInput = container.querySelector('.multi-select-search');
      const groupsEls = container.querySelectorAll('.city-group');
      const btnSelectAll = container.querySelector('.btn-select-all');
      const btnClearAll = container.querySelector('.btn-clear-all');
      
      if (btnSelectAll) {
        btnSelectAll.addEventListener('click', (e) => {
          e.stopPropagation();
          container.querySelectorAll('.checkbox-label').forEach(label => {
            if (label.style.display !== 'none' && label.dataset.valid !== 'false') {
              const cb = label.querySelector('input[type="checkbox"]');
              if (cb) cb.checked = true;
            }
          });
          applyFilters();
          updateButtonLabels();
        });
      }
      
      if (btnClearAll) {
        btnClearAll.addEventListener('click', (e) => {
          e.stopPropagation();
          container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
          applyFilters();
          updateButtonLabels();
        });
      }

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const term = e.target.value.toLowerCase();
          
          groupsEls.forEach(group => {
            let hasVisibleChild = false;
            const groupLabels = group.querySelectorAll('.checkbox-label');
            groupLabels.forEach(label => {
              if ((label.dataset.search.includes(term) || group.dataset.search.includes(term)) && label.dataset.valid !== "false") {
                label.style.display = 'flex';
                hasVisibleChild = true;
              } else {
                label.style.display = 'none';
              }
            });
            group.style.display = hasVisibleChild ? 'block' : 'none';
          });
        });
        searchInput.addEventListener('click', (e) => e.stopPropagation());
      }
      
      container.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
          applyFilters();
          updateButtonLabels();
        });
      });
    };
    
    buildCheckboxes(provinces, provDropdown, "province");
    buildCityCheckboxes(groupedCities, cityDropdown, "city");

    if (preserveSelection && (prevSelectedProvs.length > 0 || prevSelectedCities.length > 0)) {
      if (prevSelectedProvs.length > 0) {
        const provSet = new Set(prevSelectedProvs);
        provDropdown?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          if (provSet.has(cb.value)) cb.checked = true;
        });
      }
      if (prevSelectedCities.length > 0) {
        const citySet = new Set(prevSelectedCities);
        cityDropdown?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          if (citySet.has(cb.value)) cb.checked = true;
        });
      }
    } else {
      const target = originalData.hospitals.find(h => h.code === "3372015") || originalData.hospitals[0];
      if (target) {
        state.targetCode = target.code;
        state.targetCodes = [target.code];
        const input = document.getElementById("targetHospitalInput");
        if (input) {
          input.value = `${target.name} · ${target.city}`;
        }
        provDropdown?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          if (cb.value.toUpperCase() === target.province.toUpperCase()) {
            cb.checked = true;
          }
        });
      }
    }

    initFilterEventListeners();
    applyFilters();
    updateButtonLabels();
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
    
    const style = document.createElement("style");
    style.textContent = `
      .pptx-export-page * { font-family: 'Quattrocento Sans', sans-serif !important; }
      .pptx-export-page p, .pptx-export-page table, .pptx-export-page th, .pptx-export-page td, .pptx-export-page li { font-size: 8pt; }
      .pptx-export-page h1, .pptx-export-page h2 { font-size: 14pt !important; font-weight: bold; }
      .pptx-export-page h1 *, .pptx-export-page h2 * { font-size: 14pt !important; }
      .pptx-kemenkes-logo { position: absolute; top: 16px; right: 24px; height: 48px; width: auto; z-index: 50; }
      .pptx-export-page th, .pptx-export-page td { white-space: nowrap !important; }
      .pptx-export-page .kpi-value, .pptx-export-page .summary-big strong { line-height: 1.2 !important; }
      
      /* Optimize Scenario Table for PPTX to prevent overflowing */
      .pptx-export-page .scenario-table th, .pptx-export-page .scenario-table td { padding: 3px 4px !important; font-size: 8px !important; line-height: 1.1 !important; }
      .pptx-export-page .scenario-table div { font-size: 7.5px !important; margin-top: 0px !important; line-height: 1.1 !important; }
      .pptx-export-page .table-container { max-height: none !important; overflow: hidden !important; margin-top: 0 !important; margin-bottom: 0 !important; }
      .pptx-export-page .scenario-table tbody tr { height: 18px !important; }

    `;
    exportStage.appendChild(style);

    const allSlides = [...document.querySelectorAll(".slide")];
    const layoutOrder = ["0", "2", "5", "6", "7", "16", "19", "19-2", "19-3"];
    
    // Add all dynamic slides (23 and onwards)
    allSlides.forEach(s => {
      const dsStr = s.getAttribute("data-slide");
      const ds = parseInt(dsStr);
      if (!isNaN(ds) && ds >= 23 && dsStr === String(ds)) {
        layoutOrder.push(String(ds));
      }
    });
    
    // Add slide 18 at the very end
    layoutOrder.push("18", "18-2", "18-3");
    
    const sourceSlides = [];
    
    layoutOrder.forEach(ds => {
      const s = allSlides.find(x => x.getAttribute("data-slide") === ds);
      if (s) sourceSlides.push(s);
    });
    
    const target = targetHospital();

    const pages = sourceSlides.map((sourceSlide, index) => {
      const page = document.createElement("section");
      page.className = "pptx-export-page";
      page.dataset.pptxNotes = `Sumber data: Laporan_Agregat_iDRG_Simulasi_2.xlsx. RS target: ${target.name}. Parameter simulasi mengikuti nilai dashboard saat ekspor.`;

      const slideClone = sourceSlide.cloneNode(true);
      slideClone.hidden = false;
      slideClone.classList.remove("is-active");
      freezeExportControls(sourceSlide, slideClone);
      removeDuplicateExportIds(slideClone);

      const logo = document.createElement("img");
      logo.src = "img/logo-kemenkes.png";
      logo.className = "pptx-kemenkes-logo";

      page.append(logo, slideClone);
      exportStage.appendChild(page);
      return page;
    });

    document.body.appendChild(exportStage);
    autoFitSlideTitles(exportStage);
    return { exportStage, pages };
  }

  const waitForExportLayout = () => new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });

  const NATIONAL_SLIDE_SELECTORS = [
    ".national-rawat-type-slide",
    ".national-spending-class-slide",
    ".national-rawat-inap-slide",
    ".national-severity-slide",
    ".national-rawat-jalan-slide",
    ".national-q5440-slide",
    ".icd-competency-slide"
  ];

  function getActiveNationalSlide() {
    return NATIONAL_SLIDE_SELECTORS
      .map((selector) => document.querySelector(selector))
      .find((slide) => slide && !slide.hidden) || null;
  }

  function prepareNationalSlideClone(sourceSlide) {
    const clone = sourceSlide.cloneNode(true);
    clone.hidden = false;
    clone.classList.remove("is-active");
    clone.querySelectorAll('[data-export-ui="true"]').forEach((element) => element.remove());
    freezeExportControls(sourceSlide, clone);
    removeDuplicateExportIds(clone);
    clone.style.position = "relative";
    clone.style.inset = "auto";
    clone.style.display = "block";
    clone.style.width = "1920px";
    clone.style.height = "1080px";
    clone.style.transform = "none";
    clone.style.overflow = "hidden";
    return clone;
  }

  function getNationalSlideFileBase(sourceSlide) {
    const heading = sourceSlide.querySelector("h1")?.textContent?.trim() || "simulasi-nasional";
    return heading
      .toLocaleLowerCase("id-ID")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "simulasi-nasional";
  }

  function collectExportCss() {
    return [...document.styleSheets].map((sheet) => {
      try {
        return [...sheet.cssRules]
          .filter((rule) => rule.type !== CSSRule.IMPORT_RULE)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch (_) {
        return "";
      }
    }).join("\n");
  }

  async function embedCloneImages(root) {
    await Promise.all([...root.querySelectorAll("img")].map(async (image) => {
      const source = image.getAttribute("src");
      if (!source || source.startsWith("data:")) return;
      try {
        const response = await fetch(new URL(source, window.location.href));
        const blob = await response.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        image.setAttribute("src", dataUrl);
      } catch (_) {
        image.remove();
      }
    }));
  }

  async function nationalSlideToPngBlob(sourceSlide) {
    const width = 1920;
    const height = 1080;
    const clone = prepareNationalSlideClone(sourceSlide);
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    await embedCloneImages(clone);

    const style = document.createElement("style");
    style.textContent = collectExportCss();
    clone.prepend(style);

    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

    try {
      const renderedImage = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Slide tidak dapat dirender menjadi gambar."));
        image.src = svgUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(renderedImage, 0, 0, width, height);
      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG gagal dibuat.")), "image/png", 1);
      });
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  window.copyActiveNationalSlideImage = async function(button) {
    const sourceSlide = getActiveNationalSlide();
    if (!sourceSlide) return;
    const originalLabel = button?.textContent || "📋 Copy Image";
    if (button) {
      button.disabled = true;
      button.textContent = "Membuat PNG…";
    }
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const pngBlob = await nationalSlideToPngBlob(sourceSlide);
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard gambar memerlukan HTTPS atau localhost.");
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      if (button) button.textContent = "✓ Tersalin";
    } catch (error) {
      console.error("Copy national slide image failed", error);
      if (button) button.textContent = "Copy gagal";
      window.alert(`Gagal menyalin gambar: ${error.message}`);
    } finally {
      window.setTimeout(() => {
        if (button) {
          button.disabled = false;
          button.textContent = originalLabel;
        }
      }, 1800);
    }
  };

  window.showDynamicMarketShareSlide = function() {
    const slides = [...document.querySelectorAll(".slide")];
    const targetIndex = slides.findIndex((slide) => slide.classList.contains("dynamic-market-share-slide"));
    if (targetIndex >= 0) {
      renderDynamicMarketShareSlide();
      showSlide(targetIndex);
    }
  };

  window.exportActiveNationalSlideToPptx = async function(button) {
    const sourceSlide = getActiveNationalSlide();
    if (!sourceSlide) return;
    const originalLabel = button?.textContent || "⬡ DOM → PPTX";
    const exportStage = document.createElement("div");
    exportStage.style.cssText = "position:absolute;left:-100000px;top:0;width:1920px;height:1080px;background:#fff;";
    const page = document.createElement("section");
    page.style.cssText = "position:relative;width:1920px;height:1080px;overflow:hidden;background:#fff;";
    page.dataset.pptxNotes = "Simulasi Nasional / Data Mirroring iDRG";
    page.appendChild(prepareNationalSlideClone(sourceSlide));
    exportStage.appendChild(page);
    document.body.appendChild(exportStage);

    if (button) {
      button.disabled = true;
      button.textContent = "Membuat PPTX…";
    }
    try {
      if (!window.domToPptx?.exportToPptx) throw new Error("Library DOM-to-PPTX tidak tersedia.");
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForExportLayout();
      const exportDate = new Date().toISOString().slice(0, 10);
      await window.domToPptx.exportToPptx(page, {
        fileName: `${getNationalSlideFileBase(sourceSlide)}-${exportDate}.pptx`,
        autoEmbedFonts: false,
        svgAsVector: true
      });
      if (button) button.textContent = "✓ Terunduh";
    } catch (error) {
      console.error("National slide DOM-to-PPTX export failed", error);
      if (button) button.textContent = "Ekspor gagal";
      window.alert(`Ekspor PPTX gagal: ${error.message}`);
    } finally {
      exportStage.remove();
      window.setTimeout(() => {
        if (button) {
          button.disabled = false;
          button.textContent = originalLabel;
        }
      }, 1800);
    }
  };

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
      
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = "img/logo-kemenkes.png";
      });

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
      total: createZeroMetric(),
      severity: {},
      unclassified: createZeroMetric(),
      services: {}
    };
    for (const h of hospitals) {
      addVectors(regional.total, h.total);
      
      if (h.unclassified) {
        addVectors(regional.unclassified, h.unclassified);
      }
      
      for (const sev in h.severity) {
        if (!regional.severity[sev]) regional.severity[sev] = createZeroMetric();
        addVectors(regional.severity[sev], h.severity[sev]);
      }
      
      for (const svc in h.services) {
        if (!regional.services[svc]) {
          regional.services[svc] = { competency: 0, total: createZeroMetric(), severity: {} };
        }
        const s = h.services[svc];
        const rs = regional.services[svc];
        
        addVectors(rs.total, s.total);
        
        if (s.unclassified) {
          if (!rs.unclassified) rs.unclassified = createZeroMetric();
          addVectors(rs.unclassified, s.unclassified);
        }
        
        for (const sev in s.severity) {
          if (!rs.severity[sev]) rs.severity[sev] = createZeroMetric();
          addVectors(rs.severity[sev], s.severity[sev]);
        }
      }
    }
    return regional;
  }

  function updateDropdownVisibility() {
    const isMuhammadiyahOnly = document.getElementById("muhammadiyahFilterToggle")?.checked || false;
    
    // Determine hospitals matching Muhammadiyah filter
    const baseHospitals = originalData.hospitals.filter(h => {
      return !isMuhammadiyahOnly || isMuhammadiyahHospital(h);
    });

    const validProvinces = new Set(baseHospitals.map(h => h.province).filter(Boolean));
    
    // Update Province dropdown options visibility
    const provLabels = document.querySelectorAll('#provDropdown .checkbox-label');
    provLabels.forEach(label => {
      const cb = label.querySelector('input[type="checkbox"]');
      const val = cb ? cb.value : '';
      if (validProvinces.has(val)) {
        label.dataset.valid = "true";
        label.style.display = 'flex';
      } else {
        label.dataset.valid = "false";
        label.style.display = 'none';
        if (cb && cb.checked) cb.checked = false;
      }
    });

    // Determine currently checked valid provinces
    const getChecked = (dropdown) => Array.from(dropdown?.querySelectorAll("input:checked") || []).map(i => i.value);
    const selectedProvinces = getChecked(document.getElementById("provDropdown"));

    // Determine cities matching baseHospitals AND selectedProvinces
    const cityHospitals = baseHospitals.filter(h => {
      return selectedProvinces.length === 0 || selectedProvinces.includes(h.province);
    });
    const validCities = new Set(cityHospitals.map(h => h.city).filter(Boolean));

    // Update City dropdown options visibility
    const cityGroups = document.querySelectorAll('#cityDropdown .city-group');
    cityGroups.forEach(group => {
      let hasVisible = false;
      const labels = group.querySelectorAll('.checkbox-label');
      labels.forEach(label => {
        const cb = label.querySelector('input[type="checkbox"]');
        const val = cb ? cb.value : '';
        if (validCities.has(val)) {
          label.dataset.valid = "true";
          label.style.display = 'flex';
          hasVisible = true;
        } else {
          label.dataset.valid = "false";
          label.style.display = 'none';
          if (cb && cb.checked) cb.checked = false;
        }
      });
      group.style.display = hasVisible ? 'block' : 'none';
    });
  }

  function applyFilters() {
    updateDropdownVisibility();

    const getChecked = (dropdown) => Array.from(dropdown?.querySelectorAll("input:checked") || []).map(i => i.value);
    
    const selectedProvinces = getChecked(document.getElementById("provDropdown"));
    const selectedCities = getChecked(document.getElementById("cityDropdown"));
    const isMuhammadiyahOnly = document.getElementById("muhammadiyahFilterToggle")?.checked || false;
    
    const baseData = allDatasets[activeDatasetKey] || data;
    const filteredHospitals = baseData.hospitals.filter(h => {
      let passProv = selectedProvinces.length === 0 || selectedProvinces.includes(h.province);
      let passCity = selectedCities.length === 0 || selectedCities.includes(h.city);
      let passMuhammadiyah = !isMuhammadiyahOnly || isMuhammadiyahHospital(h);
      return passProv && passCity && passMuhammadiyah;
    });
    
    data = {
      ...baseData,
      hospitals: filteredHospitals,
      regional: computeRegionalFromHospitals(filteredHospitals)
    };
    
    updateDataState();
    
    const validCodes = new Set(filteredHospitals.map(h => h.code));
    state.targetCodes = (state.targetCodes || []).filter(c => validCodes.has(c));
    if (state.targetCodes.length === 0 && filteredHospitals.length > 0) {
      state.targetCodes = [filteredHospitals[0].code];
    }
    state.targetCode = state.targetCodes[0] || "";
    
    window.globalSimScenarios = null; // Reset skenario agar terhitung ulang dengan jumlah kompetitor yang baru
    window.globalSimKurangScenarios = null;
    state.serviceScenarios = {};
    
    populateHospitalSelector();
    renderAll();
  }

  populateFilters();
  populateHospitalSelector();
  populateSlideDots();
  document.getElementById("previousSlide").addEventListener("click", () => showSlide(state.activeSlide - 1));
  document.getElementById("nextSlide").addEventListener("click", () => showSlide(state.activeSlide + 1));
  document.getElementById("btnOpenDynamicMarket")?.addEventListener("click", () => window.showDynamicMarketShareSlide());
  document.getElementById("muhammadiyahGroupNavBtn")?.addEventListener("click", () => {
    window.showMuhammadiyahMapSlide();
  });
  const natNavBtn = document.getElementById("nationalMirroringNavBtn");
  const natDropdown = document.getElementById("nationalMirroringDropdown");
  if (natNavBtn && natDropdown) {
    natNavBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = natDropdown.classList.contains("is-open");
      document.querySelectorAll(".multi-select-dropdown").forEach(d => d.classList.remove("is-open"));
      if (!isOpen) natDropdown.classList.add("is-open");
    });

    document.querySelectorAll(".national-nav-item-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const offset = parseInt(btn.dataset.offset, 10) || 0;
        window.showNationalMirroringSlide(offset);
        natDropdown.classList.remove("is-open");
      });
    });
  } else if (natNavBtn) {
    natNavBtn.addEventListener("click", () => {
      window.showNationalMirroringSlide(0);
    });
  }
  document.getElementById("datasetPeriodSelect")?.addEventListener("change", (e) => {
    switchDatasetPeriod(e.target.value);
  });
  document.getElementById("tariffScenarioSelect")?.addEventListener("change", (e) => {
    updateActiveTariff(e.target.value);
    renderAll();
  });
  document.getElementById("globalSimTambahSelect")?.addEventListener("change", (e) => {
    window.globalSimScenarios = null;
    window.globalSimKurangScenarios = null;
    renderGlobalSimulationSlide();
    if(typeof renderCompetencySimSlide === "function") renderCompetencySimSlide();
    renderRecapSlide();
    renderLogicalRecapSlide();
    renderScenarioSlide();
  });
  
  document.getElementById("globalSimKurangSelect")?.addEventListener("change", (e) => {
    window.globalSimScenarios = null;
    window.globalSimKurangScenarios = null;
    renderGlobalSimulationSlide();
    if(typeof renderCompetencySimSlide === "function") renderCompetencySimSlide();
    renderRecapSlide();
    renderLogicalRecapSlide();
    renderScenarioSlide();
  });
  document.getElementById("exportExcelBtn").addEventListener("click", () => {
    try {
      exportToExcel();
    } catch (err) {
      alert("Gagal meng-export Excel: " + err.message);
      console.error(err);
    }
  });

  document.getElementById("exportPptx").addEventListener("click", exportDashboardToPptx);

  async function captureSvgToPng(containerId) {
    const container = document.getElementById(containerId);
    const svgEl = container ? container.querySelector("svg") : null;
    if (!svgEl) return null;
    try {
      const clonedSvg = svgEl.cloneNode(true);
      clonedSvg.setAttribute("width", "1920");
      clonedSvg.setAttribute("height", "1080");
      const xml = new XMLSerializer().serializeToString(clonedSvg);
      const svgBase64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = svgBase64;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } catch (e) {
      console.warn("SVG map capture failed", e);
      return null;
    }
  }

  document.getElementById("exportGSlidesBtn").addEventListener("click", async function() {
    const btn = this;
    const status = document.getElementById("exportStatus");
    btn.disabled = true;
    btn.textContent = "Menyiapkan...";
    status.textContent = "Membangun file Google Slides...";
    try {
      const target = targetHospital();
      const services = data.services;
      const activeHospitals = typeof getActiveMirroringHospitals === "function" ? getActiveMirroringHospitals() : (data.hospitals || []);
      const nationalMetrics = typeof computeNationalMirroringMetrics === "function" ? computeNationalMirroringMetrics(activeHospitals) : null;
      const addressableResult = typeof computeAddressable === "function" ? computeAddressable() : null;

      const getChecked = (dropdown) => Array.from(dropdown?.querySelectorAll("input:checked") || []).map(i => i.value);
      const selectedProvinces = getChecked(document.getElementById("provDropdown"));
      const selectedCities = getChecked(document.getElementById("cityDropdown"));
      const isMuhammadiyahOnly = document.getElementById("muhammadiyahFilterToggle")?.checked || false;
      const activeDatasetPeriod = document.getElementById("datasetPeriodSelect")?.value || "okt_jun";
      const activeTariff = document.getElementById("tariffScenarioSelect")?.value || "af_afreg_afkep";

      const mapImageData = await captureSvgToPng("svgMapContainer");
      const muhammadiyahMapImageData = await captureSvgToPng("muhammadiyahSvgMapContainer");

      await window.exportGoogleSlides({
        data, state, target,
        CASES, INA, IDRG, REVENUE,
        services,
        levelNames,
        activeHospitals,
        nationalMetrics,
        addressableResult,
        mapImageData,
        muhammadiyahMapImageData,
        filters: {
          selectedProvinces,
          selectedCities,
          isMuhammadiyahOnly,
          activeDatasetPeriod,
          activeTariff
        },
        helpers: {
          isMuhammadiyahHospital,
          getCompetency,
          formatService
        }
      });
      btn.textContent = "Terunduh!";
      status.textContent = "File Google Slides berhasil dibuat.";
    } catch (err) {
      console.error("Google Slides export failed", err);
      btn.textContent = "Gagal";
      status.textContent = "Ekspor gagal: " + err.message;
    } finally {
      btn.disabled = false;
      setTimeout(function() { btn.textContent = "Export Google Slides"; }, 2400);
    }
  });

  document.getElementById("excludeUnmappedToggle")?.addEventListener("change", (e) => {
    state.excludeUnmapped = e.target.checked;
    recalculateTotals();
    renderAll();
  });

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
    if (typeof XLSX === "undefined") {
      alert("SheetJS library belum termuat. Silakan periksa koneksi internet.");
      return;
    }
    if (typeof MarketShareAuditExcel === "undefined" || !MarketShareAuditExcel.exportWorkbook) {
      alert("Modul audit-excel belum termuat. Silakan periksa koneksi internet.");
      return;
    }
    const target = targetHospital();
    if (!target) { alert("RS target tidak ditemukan."); return; }

    MarketShareAuditExcel.exportWorkbook({
      XLSX,
      data,
      state,
      target,
      CASES,
      INA,
      IDRG,
      severityRanks,
      levelNames,
      formatService,
      getCompetency,
      severityMetric,
      getLevelRules,
    });
  }

  document.getElementById("btnDownloadGlobalSim")?.addEventListener("click", () => {
    const target = data.hospitals.find((h) => h.code === state.targetCode) || (data.hospitals.length ? data.hospitals[0] : null);
    if (!target) return alert("Target RS tidak ditemukan.");

    if (typeof window.GlobalSimExcel === "undefined") {
      return alert("Library GlobalSimExcel belum tersedia. Pastikan global-sim-excel.js sudah dimuat.");
    }
    if (typeof window.XLSX === "undefined") {
      return alert("Library XLSX belum tersedia.");
    }

    const tambahMode = document.getElementById('globalSimTambahSelect')?.value || 'tambah_cross_comp';
    const kurangMode = document.getElementById('globalSimKurangSelect')?.value || 'kurang_dm';

    const regionalHospitals = data.hospitals.filter(h => h.code !== target.code && Object.keys(h.services || {}).length > 0);
    const totalCompetitors = regionalHospitals.length;

    let simScenarios = window.globalSimScenarios;
    if (!simScenarios) {
      const naturalShare = totalCompetitors > 0 ? (1 / (totalCompetitors + 1)) : 0.5;
      simScenarios = [1.0, naturalShare, naturalShare / 2];
    }
    let simKurangScenarios = window.globalSimKurangScenarios;
    if (!simKurangScenarios) { simKurangScenarios = [1.0, 1.0, 1.0]; }

    const tariffKey = state.activeTariffScenario || "1370_full";
    const TARIFF_LABELS = {
      "1370_full": "iDRG 1370 - AF + AFreg + AFkep (Default)",
      "1370_afreg": "iDRG 1370 - AF + AFreg",
      "1370_af": "iDRG 1370 - AF Saja",
      "1370_noaf": "iDRG 1370 - Tanpa AF (Base)",
      "1370_juknis": "iDRG 1370 - Juknis Top-Up",
      "1363_full": "iDRG 1363 - AF + AFreg + AFkep",
    };
    const tariffLabel = TARIFF_LABELS[tariffKey] || tariffKey;

    const datasetKey = (typeof activeDatasetKey !== "undefined" ? activeDatasetKey : "okt_jun");
    const DATASET_LABELS = { "okt_jun": "Okt 2025 - Jun 2026 (8 Bulan)", "jan_des": "Jan - Des (1 Tahun Penuh)" };
    const datasetLabel = DATASET_LABELS[datasetKey] || datasetKey;

    let filterDesc = "Tidak ada filter (Semua RS regional)";
    const provSel = Array.from(document.querySelectorAll("#provDropdown input:checked")).map(el => el.value);
    const citySel = Array.from(document.querySelectorAll("#cityDropdown input:checked")).map(el => el.value);
    const muhFilter = document.getElementById("muhammadiyahFilterToggle")?.checked;
    const excludeLevel0 = document.getElementById("excludeUnmappedToggle")?.checked;
    const parts = [];
    if (provSel.length > 0) parts.push("Prov: " + provSel.slice(0,3).join(", ") + (provSel.length > 3 ? " +" + (provSel.length-3) : ""));
    if (citySel.length > 0) parts.push("Kab/Kota: " + citySel.slice(0,3).join(", ") + (citySel.length > 3 ? " +" + (citySel.length-3) : ""));
    if (muhFilter) parts.push("RS Jejaring Muhammadiyah");
    if (excludeLevel0) parts.push("Kecualikan Level 0");
    if (parts.length > 0) filterDesc = parts.join("; ");

    try {
      window.GlobalSimExcel.exportGlobalSimWorkbook({
        XLSX: window.XLSX,
        data, target, CASES, INA, IDRG,
        severityMetric, getCompetency, formatService,
        tambahMode, kurangMode,
        globalSimScenarios: simScenarios,
        globalSimKurangScenarios: simKurangScenarios,
        totalCompetitors, tariffLabel, datasetLabel, filterDesc,
      });
    } catch (err) {
      console.error("[GlobalSimExcel] Error:", err);
      alert("Gagal mengekspor kertas kerja: " + (err.message || err));
    }
  });
  renderAll();
})();

  const sidebarPanel = document.querySelector('.sidebar-panel');
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const openBtn = document.getElementById('sidebarOpenBtn');

  if (sidebarPanel && toggleBtn && openBtn) {
    const syncSidebarForViewport = () => {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        sidebarPanel.classList.remove('is-open');
        sidebarPanel.style.display = 'flex';
        openBtn.style.display = 'block';
      } else {
        sidebarPanel.classList.remove('is-open');
        sidebarPanel.style.display = 'flex';
        openBtn.style.display = 'none';
      }
      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    };

    toggleBtn.addEventListener('click', () => {
      sidebarPanel.classList.remove('is-open');
      if (!window.matchMedia('(max-width: 768px)').matches) sidebarPanel.style.display = 'none';
      openBtn.style.display = 'block';
      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });

    openBtn.addEventListener('click', () => {
      sidebarPanel.style.display = 'flex';
      sidebarPanel.classList.add('is-open');
      openBtn.style.display = 'none';
      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });

    window.matchMedia('(max-width: 768px)').addEventListener('change', syncSidebarForViewport);
    syncSidebarForViewport();
  }


