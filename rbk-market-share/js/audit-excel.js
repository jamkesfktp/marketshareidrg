(function marketShareAuditExcel(global) {
  "use strict";

  const COLORS = {
    tealDeep: "087E83",
    teal: "0AA7AD",
    green: "43B77A",
    greenSoft: "E8F6F2",
    blue: "0AA7AD",
    blueSoft: "E8F7F8",
    orange: "E88725",
    orangeSoft: "FFF2E2",
    red: "B93D4A",
    redSoft: "FDEBED",
    yellow: "F7F9DC",
    grey: "E6EFED",
    light: "F4F8F7",
    white: "FFFFFF",
    ink: "2E3432",
    muted: "66736F",
    border: "C8DFDB",
  };

  const thinBorder = {
    top: { style: "thin", color: { rgb: COLORS.border } },
    bottom: { style: "thin", color: { rgb: COLORS.border } },
    left: { style: "thin", color: { rgb: COLORS.border } },
    right: { style: "thin", color: { rgb: COLORS.border } },
  };

  const numberFormat = "#,##0";
  const moneyFormat = '"Rp" #,##0';
  const percentFormat = "0.00%";
  const insightNumberFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const insightPercentFormatter = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const insightNumber = (value) => insightNumberFormatter.format(Math.round(Number(value) || 0));
  const insightMoney = (value) => `Rp ${insightNumber(Math.abs(Number(value) || 0))}`;
  const insightSignedNumber = (value) => {
    const numeric = Math.round(Number(value) || 0);
    return `${numeric > 0 ? "+" : numeric < 0 ? "−" : ""}${insightNumber(Math.abs(numeric))}`;
  };
  const insightPercent = (value) => `${insightPercentFormatter.format((Number(value) || 0) * 100)}%`;

  function formula(f, v, z, type) {
    const cell = { t: type || (typeof v === "string" ? "s" : "n"), f, v };
    if (z) cell.z = z;
    return cell;
  }

  function inputCell(value) {
    return { t: "n", v: Number(value) || 0, z: percentFormat };
  }

  function quoteSheet(name) {
    return `'${String(name).replace(/'/g, "''")}'`;
  }

  function excelColumn(index) {
    let value = index + 1;
    let label = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      value = Math.floor((value - 1) / 26);
    }
    return label;
  }

  function safeSheetName(value, used) {
    const base = String(value || "Sheet")
      .replace(/[\\/?*\[\]:]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || "Sheet";
    let name = base;
    let suffix = 2;
    while (used.has(name.toUpperCase())) {
      const tail = `_${suffix++}`;
      name = `${base.slice(0, 31 - tail.length)}${tail}`;
    }
    used.add(name.toUpperCase());
    return name;
  }

  function styleCell(cell, options) {
    if (!cell) return;
    const opts = options || {};
    cell.s = cell.s || {};
    cell.s.font = {
      name: "Aptos",
      sz: opts.size || 10,
      bold: Boolean(opts.bold),
      color: { rgb: opts.fontColor || COLORS.ink },
    };
    cell.s.fill = { fgColor: { rgb: opts.fill || COLORS.white } };
    cell.s.border = opts.border === false ? undefined : thinBorder;
    cell.s.alignment = {
      vertical: opts.vertical || "center",
      horizontal: opts.align || "left",
      wrapText: opts.wrap !== false,
    };
    if (opts.numFmt) cell.s.numFmt = opts.numFmt;
  }

  function styleRange(XLSX, ws, range, options) {
    const decoded = typeof range === "string" ? XLSX.utils.decode_range(range) : range;
    for (let row = decoded.s.r; row <= decoded.e.r; row += 1) {
      for (let col = decoded.s.c; col <= decoded.e.c; col += 1) {
        const ref = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[ref]) ws[ref] = { t: "s", v: "" };
        styleCell(ws[ref], options);
      }
    }
  }

  function styleTitle(XLSX, ws, lastCol) {
    styleRange(XLSX, ws, `A1:${excelColumn(lastCol)}1`, {
      fill: COLORS.teal,
      fontColor: COLORS.white,
      bold: true,
      size: 16,
      border: false,
      align: "left",
    });
    ws["!merges"] = ws["!merges"] || [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });
    ws["!rows"] = ws["!rows"] || [];
    ws["!rows"][0] = { hpt: 28 };
  }

  function styleHeader(XLSX, ws, range, fill) {
    styleRange(XLSX, ws, range, {
      fill: fill || COLORS.tealDeep,
      fontColor: COLORS.white,
      bold: true,
      align: "center",
    });
  }

  function setSheetDefaults(ws, widths, freezeRows) {
    ws["!cols"] = widths.map((wch) => ({ wch }));
    ws["!freeze"] = { xSplit: 0, ySplit: freezeRows || 0 };
    ws["!margins"] = { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
    ws["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0 };
  }

  function styleDataBody(XLSX, ws, startRow, endRow, endCol, numericCols, moneyCols, percentCols) {
    if (endRow < startRow) return;
    styleRange(XLSX, ws, { s: { r: startRow - 1, c: 0 }, e: { r: endRow - 1, c: endCol } }, { fill: COLORS.white });
    (numericCols || []).forEach((col) => styleRange(XLSX, ws, `${col}${startRow}:${col}${endRow}`, { align: "right", numFmt: numberFormat }));
    (moneyCols || []).forEach((col) => styleRange(XLSX, ws, `${col}${startRow}:${col}${endRow}`, { align: "right", numFmt: moneyFormat }));
    (percentCols || []).forEach((col) => styleRange(XLSX, ws, `${col}${startRow}:${col}${endRow}`, { align: "right", numFmt: percentFormat }));
  }

  function buildWorkbook(context) {
    const {
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
    } = context;

    if (!XLSX || !XLSX.utils) throw new Error("Library Excel belum tersedia.");
    if (!data || !target) throw new Error("Data target rumah sakit tidak tersedia.");

    const usedSheetNames = new Set();
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `Kertas Kerja Audit Market Share - ${target.name}`,
      Subject: "Simulasi market share iDRG dengan formula lintas-sheet",
      Author: "Kementerian Kesehatan RI",
      Company: "Kementerian Kesehatan RI",
      Comments: "Parameter input, sumber data, formula, dan rekonsiliasi dipisahkan untuk kebutuhan audit.",
      CreatedDate: new Date(),
    };

    function appendSheet(ws, requestedName) {
      const name = safeSheetName(requestedName, usedSheetNames);
      XLSX.utils.book_append_sheet(wb, ws, name);
      return name;
    }

    // 00 - Petunjuk audit dan identitas target.
    const guideRows = [
      [`KERTAS KERJA AUDIT MARKET SHARE iDRG - ${target.name}`, "", "", "", "", "", "", ""],
      ["Workbook ini memisahkan sumber, parameter, kalkulasi, dan kontrol rekonsiliasi."],
      ["IDENTITAS ANALISIS", "NILAI"],
      ["Nama RS target", target.name],
      ["Kode RS target", target.code],
      ["Kelas RS", target.class || "-"],
      ["Kabupaten/Kota", target.city || "-"],
      ["Jumlah layanan regional", data.services.length],
      ["Jumlah RS regional", data.hospitals.length],
      ["Tanggal ekspor", new Date().toLocaleString("id-ID")],
      [],
      ["ALUR AUDIT", "KETERANGAN"],
      ["1. 01_Data_RS", "Daftar RS dan total kasus/pendapatan dari dataset aplikasi."],
      ["2. 01B_Kompetitor_RS", "Roster kompetitor per layanan dan level kompetensi; nama RS tetap dapat ditelusuri tanpa memperbesar workbook secara berlebihan."],
      ["3. 02_Data_Layanan", "Data target dan regional per layanan serta D-M-U-P; external pool dihitung dengan formula."],
      ["4. 03_Parameter", "Satu-satunya area input simulasi. Sel kuning dapat diedit."],
      ["5. SIM_xx", "Satu layanan per sheet. Semua hasil merupakan formula yang menunjuk sheet sumber/parameter."],
      ["6. 04_Rekap_Simulasi", "Rekap seluruh layanan dan enam skenario per layanan."],
      ["7. 99_Rekonsiliasi", "Kontrol bahwa angka di sheet simulasi sama dengan sheet sumber."],
      [],
      ["KONVENSI", "ARTI"],
      ["Toska muda", "Data sumber hasil ekstraksi aplikasi (tidak untuk diedit)."],
      ["Kuning", "Parameter yang dapat diedit auditor/pengguna."],
      ["Hijau", "Perhitungan tambahan kasus dan pendapatan iDRG."],
      ["Merah", "Perhitungan pengurangan kasus dan pendapatan INA-CBG."],
      ["Formula", "Klik sel hasil untuk melihat referensi sheet dan sel sumber pada formula bar Excel."],
      ["Insight snapshot", "Narasi pada sheet SIM_xx dibuat dari angka dan parameter saat ekspor. Jika parameter diubah di Excel, formula hasil akan berubah tetapi narasi diperbarui dengan mengekspor ulang dari aplikasi."],
    ];
    const guide = XLSX.utils.aoa_to_sheet(guideRows);
    styleTitle(XLSX, guide, 1);
    styleHeader(XLSX, guide, "A3:B3", COLORS.tealDeep);
    styleHeader(XLSX, guide, "A12:B12", COLORS.tealDeep);
    styleHeader(XLSX, guide, "A21:B21", COLORS.tealDeep);
    styleRange(XLSX, guide, "A4:B10", { fill: COLORS.white });
    styleRange(XLSX, guide, "A13:B19", { fill: COLORS.white });
    styleRange(XLSX, guide, "A22:B27", { fill: COLORS.white });
    styleRange(XLSX, guide, "B4:B10", { fill: COLORS.blueSoft, bold: true });
    setSheetDefaults(guide, [28, 92, 2, 2, 2, 2, 2, 2], 3);
    const guideName = appendSheet(guide, "00_Petunjuk_Audit");

    // 01 - Daftar rumah sakit.
    const hospitalRows = [["Kode RS", "Nama Rumah Sakit", "Kelas", "Kab/Kota", "Total Kasus", "Total INA-CBG", "Total iDRG", "Selisih iDRG - INA"]];
    data.hospitals.forEach((hospital, index) => {
      const row = index + 2;
      hospitalRows.push([
        hospital.code,
        hospital.name,
        hospital.class || "-",
        hospital.city || "-",
        Number(hospital.total?.[CASES]) || 0,
        Number(hospital.total?.[INA]) || 0,
        Number(hospital.total?.[IDRG]) || 0,
        formula(`G${row}-F${row}`, (Number(hospital.total?.[IDRG]) || 0) - (Number(hospital.total?.[INA]) || 0), moneyFormat),
      ]);
    });
    const hospitalsWs = XLSX.utils.aoa_to_sheet(hospitalRows);
    styleHeader(XLSX, hospitalsWs, "A1:H1", COLORS.tealDeep);
    styleDataBody(XLSX, hospitalsWs, 2, hospitalRows.length, 7, ["E"], ["F", "G", "H"]);
    styleRange(XLSX, hospitalsWs, `A2:G${hospitalRows.length}`, { fill: COLORS.blueSoft });
    styleRange(XLSX, hospitalsWs, `H2:H${hospitalRows.length}`, { fill: COLORS.light, align: "right", numFmt: moneyFormat });
    hospitalsWs["!autofilter"] = { ref: `A1:H${hospitalRows.length}` };
    setSheetDefaults(hospitalsWs, [14, 46, 9, 24, 15, 20, 20, 20], 1);
    appendSheet(hospitalsWs, "01_Data_RS");

    // 01B - Roster kompetitor per layanan. Ringkas, tetapi nama RS tetap lengkap untuk audit.
    const competencyRows = [[
      "Kode Layanan", "Nama Layanan", "Rank Kompetensi Target", "Kompetensi Target",
      "Jumlah Dasar", "Daftar RS Dasar", "Jumlah Madya", "Daftar RS Madya",
      "Jumlah Utama", "Daftar RS Utama", "Jumlah Paripurna", "Daftar RS Paripurna",
      "Jumlah Setara/Lebih Tinggi", "Daftar RS Setara/Lebih Tinggi",
    ]];
    const competitorSourceRows = {};
    data.services.forEach((service) => {
      const targetCompetency = getCompetency(target, service);
      const groups = { 1: [], 2: [], 3: [], 4: [] };
      data.hospitals.forEach((hospital) => {
        if (hospital.code === target.code) return;
        const rank = getCompetency(hospital, service);
        if (groups[rank]) groups[rank].push(hospital);
      });
      const capable = targetCompetency
        ? data.hospitals.filter((hospital) => hospital.code !== target.code && getCompetency(hospital, service) >= targetCompetency)
        : [];
      competitorSourceRows[service] = competencyRows.length + 1;
      competencyRows.push([
        service,
        formatService(service),
        targetCompetency,
        levelNames[targetCompetency] || "Tidak terpetakan",
        groups[1].length,
        groups[1].map((hospital) => hospital.name).join("; ") || "Tidak ada",
        groups[2].length,
        groups[2].map((hospital) => hospital.name).join("; ") || "Tidak ada",
        groups[3].length,
        groups[3].map((hospital) => hospital.name).join("; ") || "Tidak ada",
        groups[4].length,
        groups[4].map((hospital) => hospital.name).join("; ") || "Tidak ada",
        capable.length,
        capable.map((hospital) => `${hospital.name} (${levelNames[getCompetency(hospital, service)]})`).join("; ") || "Tidak ada kompetitor",
      ]);
    });
    const competencyWs = XLSX.utils.aoa_to_sheet(competencyRows);
    styleHeader(XLSX, competencyWs, "A1:N1", COLORS.tealDeep);
    styleDataBody(XLSX, competencyWs, 2, competencyRows.length, 13, ["C", "E", "G", "I", "K", "M"]);
    styleRange(XLSX, competencyWs, `A2:N${competencyRows.length}`, { fill: COLORS.blueSoft });
    competencyWs["!autofilter"] = { ref: `A1:N${competencyRows.length}` };
    setSheetDefaults(competencyWs, [30, 36, 18, 18, 14, 70, 14, 70, 14, 70, 16, 70, 22, 90], 1);
    const competencyName = appendSheet(competencyWs, "01B_Kompetitor_RS");

    // 02 - Sumber utama simulasi per layanan dan tingkat keparahan.
    const serviceRows = [[
      "No", "Kode Layanan", "Nama Layanan", "Rank Kompetensi Target", "Kompetensi Target",
      "Rank D-M-U-P", "Tingkat Keparahan", "Kasus Target", "INA Target", "iDRG Target",
      "Kasus Regional", "INA Regional", "iDRG Regional", "External Pool Kasus", "External Pool iDRG",
      "Kompetitor Tepat Level", "Kompetitor Setara/Lebih Tinggi", "Daftar Kompetitor Setara/Lebih Tinggi",
    ]];
    const serviceSource = {};
    data.services.forEach((service, serviceIndex) => {
      const targetService = target.services?.[service];
      const regionalService = data.regional?.services?.[service];
      const targetCompetency = getCompetency(target, service);
      serviceSource[service] = { rows: {}, targetCompetency };
      severityRanks.forEach((rank) => {
        const excelRow = serviceRows.length + 1;
        const targetMetric = severityMetric(targetService, rank);
        const regionalMetric = severityMetric(regionalService, rank);
        const externalCases = Math.max(0, (Number(regionalMetric[CASES]) || 0) - (Number(targetMetric[CASES]) || 0));
        const externalIdrg = Math.max(0, (Number(regionalMetric[IDRG]) || 0) - (Number(targetMetric[IDRG]) || 0));
        const exactCompetitors = data.hospitals.filter((hospital) => hospital.code !== target.code && getCompetency(hospital, service) === rank);
        const capableCompetitors = targetCompetency
          ? data.hospitals.filter((hospital) => hospital.code !== target.code && getCompetency(hospital, service) >= targetCompetency)
          : [];
        const compSheet = quoteSheet(competencyName);
        const compSourceRow = competitorSourceRows[service];
        const exactCountCols = { 1: "E", 2: "G", 3: "I", 4: "K" };
        serviceRows.push([
          serviceIndex + 1,
          service,
          formatService(service),
          targetCompetency,
          levelNames[targetCompetency] || "Tidak terpetakan",
          rank,
          levelNames[rank],
          Number(targetMetric[CASES]) || 0,
          Number(targetMetric[INA]) || 0,
          Number(targetMetric[IDRG]) || 0,
          Number(regionalMetric[CASES]) || 0,
          Number(regionalMetric[INA]) || 0,
          Number(regionalMetric[IDRG]) || 0,
          formula(`MAX(K${excelRow}-H${excelRow},0)`, externalCases, numberFormat),
          formula(`MAX(M${excelRow}-J${excelRow},0)`, externalIdrg, moneyFormat),
          formula(`${compSheet}!${exactCountCols[rank]}${compSourceRow}`, exactCompetitors.length, numberFormat),
          formula(`${compSheet}!M${compSourceRow}`, capableCompetitors.length, numberFormat),
          formula(`${compSheet}!N${compSourceRow}`, capableCompetitors.map((hospital) => `${hospital.name} (${levelNames[getCompetency(hospital, service)]})`).join("; ") || "Tidak ada kompetitor", undefined, "s"),
        ]);
        serviceSource[service].rows[rank] = excelRow;
      });
    });
    const serviceWs = XLSX.utils.aoa_to_sheet(serviceRows);
    styleHeader(XLSX, serviceWs, "A1:R1", COLORS.tealDeep);
    styleDataBody(XLSX, serviceWs, 2, serviceRows.length, 17, ["A", "D", "F", "H", "K", "N", "P", "Q"], ["I", "J", "L", "M", "O"]);
    styleRange(XLSX, serviceWs, `A2:M${serviceRows.length}`, { fill: COLORS.blueSoft });
    styleRange(XLSX, serviceWs, `N2:Q${serviceRows.length}`, { fill: COLORS.light });
    styleRange(XLSX, serviceWs, `R2:R${serviceRows.length}`, { fill: COLORS.white });
    serviceWs["!autofilter"] = { ref: `A1:R${serviceRows.length}` };
    setSheetDefaults(serviceWs, [6, 30, 34, 17, 19, 12, 18, 14, 19, 19, 15, 19, 19, 18, 20, 18, 22, 70], 1);
    const serviceDataName = appendSheet(serviceWs, "02_Data_Layanan");

    // Pastikan enam skenario tersedia untuk setiap layanan yang terpetakan.
    data.services.forEach((service) => {
      if (state.serviceScenarios[service]) return;
      const competency = getCompetency(target, service);
      const rules = getLevelRules(competency);
      state.serviceScenarios[service] = Array.from({ length: 6 }, (_, index) => {
        const scenario = {};
        rules.tambah.forEach((rank) => {
          const competitorCount = data.hospitals.filter((hospital) => hospital.code !== target.code && getCompetency(hospital, service) >= rank).length;
          const base = competitorCount > 0 ? Math.min(50, 100 / (competitorCount + 1)) : 50;
          scenario[`tambah_${rank}`] = Math.min(100, Math.max(0, base + (index * 10)));
        });
        rules.kurang.forEach((rank) => {
          scenario[`kurang_${rank}`] = rank > competency ? 100 : Math.min(100, 50 + (index * 10));
        });
        return scenario;
      });
    });

    // 03 - Parameter input yang menjadi satu-satunya sel editable.
    const parameterRows = [[
      "Kode Layanan", "Nama Layanan", "Kompetensi", "Skenario",
      "% Tambah Dasar", "% Tambah Madya", "% Tambah Utama", "% Tambah Paripurna",
      "% Kurang Dasar", "% Kurang Madya", "% Kurang Utama", "% Kurang Paripurna",
    ]];
    const parameterMap = {};
    data.services.forEach((service) => {
      parameterMap[service] = {};
      const competency = getCompetency(target, service);
      const scenarios = state.serviceScenarios[service] || Array.from({ length: 6 }, () => ({}));
      scenarios.forEach((scenario, index) => {
        const rowNumber = parameterRows.length + 1;
        parameterMap[service][index + 1] = rowNumber;
        parameterRows.push([
          service,
          formatService(service),
          levelNames[competency] || "Tidak terpetakan",
          index + 1,
          inputCell((scenario.tambah_1 || 0) / 100),
          inputCell((scenario.tambah_2 || 0) / 100),
          inputCell((scenario.tambah_3 || 0) / 100),
          inputCell((scenario.tambah_4 || 0) / 100),
          inputCell((scenario.kurang_1 || 0) / 100),
          inputCell((scenario.kurang_2 || 0) / 100),
          inputCell((scenario.kurang_3 || 0) / 100),
          inputCell((scenario.kurang_4 || 0) / 100),
        ]);
      });
    });
    const parameterWs = XLSX.utils.aoa_to_sheet(parameterRows);
    styleHeader(XLSX, parameterWs, "A1:L1", COLORS.tealDeep);
    styleDataBody(XLSX, parameterWs, 2, parameterRows.length, 11, ["D"], [], ["E", "F", "G", "H", "I", "J", "K", "L"]);
    styleRange(XLSX, parameterWs, `A2:D${parameterRows.length}`, { fill: COLORS.blueSoft });
    styleRange(XLSX, parameterWs, `E2:L${parameterRows.length}`, { fill: COLORS.yellow, align: "right", numFmt: percentFormat });
    parameterWs["!autofilter"] = { ref: `A1:L${parameterRows.length}` };
    setSheetDefaults(parameterWs, [30, 36, 18, 10, 16, 16, 16, 18, 16, 16, 16, 18], 1);
    const parameterName = appendSheet(parameterWs, "03_Parameter");

    const addParameterCols = { 1: "E", 2: "F", 3: "G", 4: "H" };
    const reduceParameterCols = { 1: "I", 2: "J", 3: "K", 4: "L" };
    const serviceSheetMeta = [];

    function buildServiceSheet(service, serviceIndex) {
      const displayName = formatService(service);
      const competency = getCompetency(target, service);
      const rules = getLevelRules(competency);
      const addLevels = [...rules.tambah].sort((a, b) => b - a);
      const reduceLevels = [...rules.kurang].sort((a, b) => a - b);
      const sourceRows = serviceSource[service].rows;
      const firstSourceRow = sourceRows[1];
      const targetMetric = target.services?.[service]?.total || [0, 0, 0];
      const regionalMetric = data.regional?.services?.[service]?.total || [0, 0, 0];
      const capableCompetitors = competency
        ? data.hospitals.filter((hospital) => hospital.code !== target.code && getCompetency(hospital, service) >= competency)
        : [];
      const competitorSummary = capableCompetitors.length
        ? `${capableCompetitors.slice(0, 8).map((hospital) => hospital.name).join("; ")}${capableCompetitors.length > 8 ? `; +${capableCompetitors.length - 8} RS lainnya (lihat ${competencyName})` : ""}`
        : "Tidak ada kompetitor";

      const columns = [{ key: "scenario", width: 13 }];
      addLevels.forEach((rank) => {
        columns.push({ key: `addPct${rank}`, width: 12 }, { key: `addCase${rank}`, width: 14 }, { key: `addIdrg${rank}`, width: 19 });
      });
      reduceLevels.forEach((rank) => {
        columns.push({ key: `redPct${rank}`, width: 12 }, { key: `redCase${rank}`, width: 14 }, { key: `redIna${rank}`, width: 19 });
      });
      columns.push(
        { key: "deltaCase", width: 15 },
        { key: "projectedCase", width: 17 },
        { key: "deltaCasePct", width: 15 },
        { key: "deltaRevenue", width: 20 },
        { key: "projectedRevenue", width: 21 },
        { key: "deltaRevenuePct", width: 17 },
      );
      const colIndex = Object.fromEntries(columns.map((column, index) => [column.key, index]));
      const lastCol = columns.length - 1;
      const lastColLetter = excelColumn(lastCol);
      const rows = [];
      rows.push([`SIMULASI KASUS MARKET SHARE - ${displayName}`]);
      rows.push([`RS Target: ${target.name} | Kode RS: ${target.code} | Sel kuning diedit pada ${parameterName}`]);
      rows.push([]);
      rows.push(["RS TARGET", "", "", "", "REGIONAL", "", "", "", "MARKET SHARE", "", "KOMPETITOR", ""]);
      rows.push(["Kompetensi", competency, levelNames[competency] || "Tidak terpetakan", "", "Jumlah RS", data.hospitals.length, "", "", "Eksisting", formula("IFERROR(B6/F6,0)", regionalMetric[CASES] ? targetMetric[CASES] / regionalMetric[CASES] : 0, percentFormat), "Setara/lebih tinggi", formula(`${quoteSheet(serviceDataName)}!Q${firstSourceRow}`, capableCompetitors.length, numberFormat)]);
      rows.push(["Total Kasus", formula(`SUM(${quoteSheet(serviceDataName)}!H${sourceRows[1]},${quoteSheet(serviceDataName)}!H${sourceRows[2]},${quoteSheet(serviceDataName)}!H${sourceRows[3]},${quoteSheet(serviceDataName)}!H${sourceRows[4]})`, Number(targetMetric[CASES]) || 0, numberFormat), "", "", "Total Kasus", formula(`SUM(${quoteSheet(serviceDataName)}!K${sourceRows[1]},${quoteSheet(serviceDataName)}!K${sourceRows[2]},${quoteSheet(serviceDataName)}!K${sourceRows[3]},${quoteSheet(serviceDataName)}!K${sourceRows[4]})`, Number(regionalMetric[CASES]) || 0, numberFormat), "", "", "", "", "Daftar RS", competitorSummary]);
      rows.push(["Pendapatan INA", formula(`SUM(${quoteSheet(serviceDataName)}!I${sourceRows[1]},${quoteSheet(serviceDataName)}!I${sourceRows[2]},${quoteSheet(serviceDataName)}!I${sourceRows[3]},${quoteSheet(serviceDataName)}!I${sourceRows[4]})`, Number(targetMetric[INA]) || 0, moneyFormat), "", "", "Pendapatan INA", formula(`SUM(${quoteSheet(serviceDataName)}!L${sourceRows[1]},${quoteSheet(serviceDataName)}!L${sourceRows[2]},${quoteSheet(serviceDataName)}!L${sourceRows[3]},${quoteSheet(serviceDataName)}!L${sourceRows[4]})`, Number(regionalMetric[INA]) || 0, moneyFormat)]);
      rows.push(["Pendapatan iDRG", formula(`SUM(${quoteSheet(serviceDataName)}!J${sourceRows[1]},${quoteSheet(serviceDataName)}!J${sourceRows[2]},${quoteSheet(serviceDataName)}!J${sourceRows[3]},${quoteSheet(serviceDataName)}!J${sourceRows[4]})`, Number(targetMetric[IDRG]) || 0, moneyFormat), "", "", "Pendapatan iDRG", formula(`SUM(${quoteSheet(serviceDataName)}!M${sourceRows[1]},${quoteSheet(serviceDataName)}!M${sourceRows[2]},${quoteSheet(serviceDataName)}!M${sourceRows[3]},${quoteSheet(serviceDataName)}!M${sourceRows[4]})`, Number(regionalMetric[IDRG]) || 0, moneyFormat)]);
      rows.push([]);
      rows.push(["TINGKAT", "KASUS TARGET", "INA TARGET", "iDRG TARGET", "KASUS REGIONAL", "INA REGIONAL", "iDRG REGIONAL", "EXTERNAL KASUS", "EXTERNAL iDRG", "KOMPETITOR TEPAT LEVEL"]);
      severityRanks.forEach((rank) => {
        const sourceRow = sourceRows[rank];
        const t = severityMetric(target.services?.[service], rank);
        const r = severityMetric(data.regional?.services?.[service], rank);
        rows.push([
          levelNames[rank],
          formula(`${quoteSheet(serviceDataName)}!H${sourceRow}`, Number(t[CASES]) || 0, numberFormat),
          formula(`${quoteSheet(serviceDataName)}!I${sourceRow}`, Number(t[INA]) || 0, moneyFormat),
          formula(`${quoteSheet(serviceDataName)}!J${sourceRow}`, Number(t[IDRG]) || 0, moneyFormat),
          formula(`${quoteSheet(serviceDataName)}!K${sourceRow}`, Number(r[CASES]) || 0, numberFormat),
          formula(`${quoteSheet(serviceDataName)}!L${sourceRow}`, Number(r[INA]) || 0, moneyFormat),
          formula(`${quoteSheet(serviceDataName)}!M${sourceRow}`, Number(r[IDRG]) || 0, moneyFormat),
          formula(`${quoteSheet(serviceDataName)}!N${sourceRow}`, Math.max(0, (Number(r[CASES]) || 0) - (Number(t[CASES]) || 0)), numberFormat),
          formula(`${quoteSheet(serviceDataName)}!O${sourceRow}`, Math.max(0, (Number(r[IDRG]) || 0) - (Number(t[IDRG]) || 0)), moneyFormat),
          formula(`${quoteSheet(serviceDataName)}!P${sourceRow}`, data.hospitals.filter((hospital) => hospital.code !== target.code && getCompetency(hospital, service) === rank).length, numberFormat),
        ]);
      });
      rows.push([]);
      rows.push([competency ? "ASUMSI SKENARIO - edit parameter pada sheet 03_Parameter" : "LAYANAN TIDAK DAPAT DISIMULASIKAN: kompetensi target tidak terpetakan"]);

      const groupHeaderRow = rows.length + 1;
      const groupHeader = Array(columns.length).fill("");
      groupHeader[0] = "SKENARIO";
      addLevels.forEach((rank) => { groupHeader[colIndex[`addPct${rank}`]] = `TAMBAHAN ${levelNames[rank].toUpperCase()}`; });
      reduceLevels.forEach((rank) => { groupHeader[colIndex[`redPct${rank}`]] = `PENGURANGAN ${levelNames[rank].toUpperCase()}`; });
      groupHeader[colIndex.deltaCase] = "DAMPAK KASUS";
      groupHeader[colIndex.deltaRevenue] = "DAMPAK PENDAPATAN";
      rows.push(groupHeader);

      const detailHeader = Array(columns.length).fill("");
      detailHeader[0] = "Skenario";
      addLevels.forEach((rank) => {
        detailHeader[colIndex[`addPct${rank}`]] = "% Tambah";
        detailHeader[colIndex[`addCase${rank}`]] = "Kasus";
        detailHeader[colIndex[`addIdrg${rank}`]] = "iDRG";
      });
      reduceLevels.forEach((rank) => {
        detailHeader[colIndex[`redPct${rank}`]] = "% Kurang";
        detailHeader[colIndex[`redCase${rank}`]] = "Kasus";
        detailHeader[colIndex[`redIna${rank}`]] = "INA-CBG";
      });
      detailHeader[colIndex.deltaCase] = "Delta Kasus";
      detailHeader[colIndex.projectedCase] = "Proyeksi Kasus";
      detailHeader[colIndex.deltaCasePct] = "% Delta";
      detailHeader[colIndex.deltaRevenue] = "Delta Pendapatan";
      detailHeader[colIndex.projectedRevenue] = "Proyeksi Pendapatan";
      detailHeader[colIndex.deltaRevenuePct] = "% vs INA Eksisting";
      rows.push(detailHeader);
      const detailHeaderRow = rows.length;
      const scenarioStartRow = rows.length + 1;
      const scenarioValues = {};

      for (let scenarioIndex = 1; scenarioIndex <= 6; scenarioIndex += 1) {
        const excelRow = rows.length + 1;
        const paramRow = parameterMap[service][scenarioIndex];
        const scenario = state.serviceScenarios[service]?.[scenarioIndex - 1] || {};
        const row = Array(columns.length).fill("");
        row[0] = `Skenario ${scenarioIndex}`;
        const addCaseCells = [];
        const addIdrgCells = [];
        const reduceCaseCells = [];
        const reduceInaCells = [];
        let addedCases = 0;
        let addedIdrg = 0;
        let reducedCases = 0;
        let reducedIna = 0;

        addLevels.forEach((rank) => {
          const sourceRow = sourceRows[rank];
          const pct = (Number(scenario[`tambah_${rank}`]) || 0) / 100;
          const pctCol = excelColumn(colIndex[`addPct${rank}`]);
          const caseCol = excelColumn(colIndex[`addCase${rank}`]);
          const idrgCol = excelColumn(colIndex[`addIdrg${rank}`]);
          const externalCases = Math.max(0, Number(severityMetric(data.regional?.services?.[service], rank)[CASES] || 0) - Number(severityMetric(target.services?.[service], rank)[CASES] || 0));
          const externalIdrg = Math.max(0, Number(severityMetric(data.regional?.services?.[service], rank)[IDRG] || 0) - Number(severityMetric(target.services?.[service], rank)[IDRG] || 0));
          addedCases += externalCases * pct;
          addedIdrg += externalIdrg * pct;
          row[colIndex[`addPct${rank}`]] = formula(`${quoteSheet(parameterName)}!${addParameterCols[rank]}${paramRow}`, pct, percentFormat);
          row[colIndex[`addCase${rank}`]] = formula(`${quoteSheet(serviceDataName)}!N${sourceRow}*${pctCol}${excelRow}`, externalCases * pct, numberFormat);
          row[colIndex[`addIdrg${rank}`]] = formula(`${quoteSheet(serviceDataName)}!O${sourceRow}*${pctCol}${excelRow}`, externalIdrg * pct, moneyFormat);
          addCaseCells.push(`${caseCol}${excelRow}`);
          addIdrgCells.push(`${idrgCol}${excelRow}`);
        });

        reduceLevels.forEach((rank) => {
          const sourceRow = sourceRows[rank];
          const pct = (Number(scenario[`kurang_${rank}`]) || 0) / 100;
          const pctCol = excelColumn(colIndex[`redPct${rank}`]);
          const caseCol = excelColumn(colIndex[`redCase${rank}`]);
          const inaCol = excelColumn(colIndex[`redIna${rank}`]);
          const existingCases = Number(severityMetric(target.services?.[service], rank)[CASES]) || 0;
          const existingIna = Number(severityMetric(target.services?.[service], rank)[INA]) || 0;
          reducedCases += existingCases * pct;
          reducedIna += existingIna * pct;
          row[colIndex[`redPct${rank}`]] = formula(`${quoteSheet(parameterName)}!${reduceParameterCols[rank]}${paramRow}`, pct, percentFormat);
          row[colIndex[`redCase${rank}`]] = formula(`${quoteSheet(serviceDataName)}!H${sourceRow}*${pctCol}${excelRow}`, existingCases * pct, numberFormat);
          row[colIndex[`redIna${rank}`]] = formula(`${quoteSheet(serviceDataName)}!I${sourceRow}*${pctCol}${excelRow}`, existingIna * pct, moneyFormat);
          reduceCaseCells.push(`${caseCol}${excelRow}`);
          reduceInaCells.push(`${inaCol}${excelRow}`);
        });

        const deltaCases = addedCases - reducedCases;
        const projectedCases = (Number(targetMetric[CASES]) || 0) + deltaCases;
        const deltaRevenue = addedIdrg - reducedIna;
        const projectedRevenue = (Number(targetMetric[INA]) || 0) + deltaRevenue;
        const deltaCasesCol = excelColumn(colIndex.deltaCase);
        const deltaRevenueCol = excelColumn(colIndex.deltaRevenue);
        row[colIndex.deltaCase] = formula(`${addCaseCells.length ? addCaseCells.join("+") : "0"}-(${reduceCaseCells.length ? reduceCaseCells.join("+") : "0"})`, deltaCases, numberFormat);
        row[colIndex.projectedCase] = formula(`$B$6+${deltaCasesCol}${excelRow}`, projectedCases, numberFormat);
        row[colIndex.deltaCasePct] = formula(`IF($B$6=0,0,${deltaCasesCol}${excelRow}/$B$6)`, targetMetric[CASES] ? deltaCases / targetMetric[CASES] : 0, percentFormat);
        row[colIndex.deltaRevenue] = formula(`${addIdrgCells.length ? addIdrgCells.join("+") : "0"}-(${reduceInaCells.length ? reduceInaCells.join("+") : "0"})`, deltaRevenue, moneyFormat);
        row[colIndex.projectedRevenue] = formula(`$B$7+${deltaRevenueCol}${excelRow}`, projectedRevenue, moneyFormat);
        row[colIndex.deltaRevenuePct] = formula(`IF($B$7=0,0,${deltaRevenueCol}${excelRow}/$B$7)`, targetMetric[INA] ? deltaRevenue / targetMetric[INA] : 0, percentFormat);
        rows.push(row);
        scenarioValues[scenarioIndex] = { addedCases, reducedCases, deltaCases, projectedCases, addedIdrg, reducedIna, deltaRevenue, projectedRevenue, row: excelRow };
      }

      const scenarioList = Object.entries(scenarioValues).map(([scenarioIndex, values]) => ({
        scenarioIndex: Number(scenarioIndex),
        ...values,
      }));
      const closestVolumeScenario = scenarioList.reduce((best, current) => {
        if (!best) return current;
        const currentGap = Math.abs(current.deltaCases);
        const bestGap = Math.abs(best.deltaCases);
        if (currentGap < bestGap) return current;
        if (currentGap === bestGap && current.deltaRevenue > best.deltaRevenue) return current;
        return best;
      }, null);
      const highestRevenueScenario = scenarioList.reduce((best, current) => (!best || current.deltaRevenue > best.deltaRevenue ? current : best), null);
      const topOpportunity = addLevels
        .map((rank) => {
          const regional = severityMetric(data.regional?.services?.[service], rank);
          const existing = severityMetric(target.services?.[service], rank);
          return {
            rank,
            cases: Math.max(0, (Number(regional[CASES]) || 0) - (Number(existing[CASES]) || 0)),
            idrg: Math.max(0, (Number(regional[IDRG]) || 0) - (Number(existing[IDRG]) || 0)),
          };
        })
        .sort((a, b) => b.cases - a.cases || b.idrg - a.idrg)[0];
      const topReductionRisk = reduceLevels
        .map((rank) => {
          const existing = severityMetric(target.services?.[service], rank);
          return { rank, cases: Number(existing[CASES]) || 0, ina: Number(existing[INA]) || 0 };
        })
        .sort((a, b) => b.cases - a.cases || b.ina - a.ina)[0];
      const opportunityText = topOpportunity?.cases > 0
        ? `Peluang kasus paling besar ada di ${levelNames[topOpportunity.rank]}: ${insightNumber(topOpportunity.cases)} kasus regional berada di luar RS target, dengan potensi iDRG ${insightMoney(topOpportunity.idrg)}.`
        : "Belum ada kasus regional di luar RS target pada tingkat yang masuk aturan penambahan.";
      const riskText = topReductionRisk?.cases > 0
        ? `Basis pengurangan terbesar ada di ${levelNames[topReductionRisk.rank]}: ${insightNumber(topReductionRisk.cases)} kasus eksisting.`
        : "Tidak ada kasus eksisting pada tingkat yang menjadi basis pengurangan.";
      const competitionText = capableCompetitors.length
        ? `Ada ${insightNumber(capableCompetitors.length)} RS lain dengan kompetensi ${levelNames[competency]}${competency < 4 ? " atau lebih tinggi" : ""}. Jadi, persentase tambahan masih harus dibagi dengan kekuatan pesaing.`
        : `Tidak ada RS lain dengan kompetensi ${levelNames[competency] || "terpetakan"}${competency > 0 && competency < 4 ? " atau lebih tinggi" : ""} pada data regional.`;
      const closestRevenueText = closestVolumeScenario.deltaRevenue >= 0
        ? `pendapatan naik ${insightMoney(closestVolumeScenario.deltaRevenue)}`
        : `pendapatan turun ${insightMoney(closestVolumeScenario.deltaRevenue)}`;
      const scenarioText = `Dari enam pilihan, Skenario ${closestVolumeScenario.scenarioIndex} paling dekat dengan volume sekarang: selisih ${insightSignedNumber(closestVolumeScenario.deltaCases)} kasus (${insightPercent(targetMetric[CASES] ? closestVolumeScenario.deltaCases / targetMetric[CASES] : 0)}) dan ${closestRevenueText}.`;
      const revenueText = highestRevenueScenario.scenarioIndex === closestVolumeScenario.scenarioIndex
        ? "Skenario ini juga menghasilkan proyeksi pendapatan tertinggi."
        : `Bila yang dikejar pendapatan, angka tertinggi ada di Skenario ${highestRevenueScenario.scenarioIndex}: ${insightMoney(highestRevenueScenario.projectedRevenue)}.`;

      rows.push([]);
      const insightTitleRow = rows.length + 1;
      rows.push(["INSIGHT SNAPSHOT", "Narasi berikut dihasilkan langsung dari data dan parameter simulasi pada saat workbook diekspor."]);
      const insightRows = [];
      rows.push(["PELUANG", `${opportunityText} ${riskText}`]);
      insightRows.push(rows.length);
      rows.push(["SAINGAN", competitionText]);
      insightRows.push(rows.length);
      rows.push(["SKENARIO TERDEKAT", `${scenarioText} ${revenueText}`]);
      insightRows.push(rows.length);
      rows.push(["BATASAN", "Insight ini belum memasukkan kapasitas, ketersediaan SDM, pola rujukan, waktu tunggu, atau kesiapan operasional layanan."]);
      insightRows.push(rows.length);
      rows.push(["CATATAN FORMULA", `Tambahan = external pool regional × % tambah. Pengurangan = eksisting target × % kurang. Proyeksi kasus = eksisting + tambahan − pengurangan. Proyeksi pendapatan = INA eksisting + tambahan iDRG − pengurangan INA.`]);
      rows.push(["SUMBER", `Data: ${serviceDataName} | Parameter: ${parameterName} | Kompetitor: ${competencyName}`]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!merges"] = ws["!merges"] || [];
      ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });
      if (lastCol >= 11) ws["!merges"].push({ s: { r: 5, c: 11 }, e: { r: 5, c: lastCol } });
      [insightTitleRow, ...insightRows].forEach((rowNumber) => {
        ws["!merges"].push({ s: { r: rowNumber - 1, c: 1 }, e: { r: rowNumber - 1, c: lastCol } });
      });
      ws["!merges"].push({ s: { r: rows.length - 2, c: 1 }, e: { r: rows.length - 2, c: lastCol } });
      ws["!merges"].push({ s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: lastCol } });
      styleTitle(XLSX, ws, lastCol);
      styleRange(XLSX, ws, `A2:${lastColLetter}2`, { fill: COLORS.light, fontColor: COLORS.muted, border: false });
      styleRange(XLSX, ws, `A4:D8`, { fill: COLORS.blueSoft });
      styleRange(XLSX, ws, `E4:H8`, { fill: "F3EEFF" });
      styleRange(XLSX, ws, `I4:J8`, { fill: COLORS.tealDeep, fontColor: COLORS.white, bold: true, align: "center" });
      if (lastCol >= 11) styleRange(XLSX, ws, `K4:${lastColLetter}8`, { fill: COLORS.light });
      styleHeader(XLSX, ws, "A10:J10", COLORS.tealDeep);
      styleDataBody(XLSX, ws, 11, 14, 9, ["B", "E", "H", "J"], ["C", "D", "F", "G", "I"]);
      styleRange(XLSX, ws, `A16:${lastColLetter}16`, { fill: competency ? COLORS.light : COLORS.redSoft, bold: true, fontColor: competency ? COLORS.ink : COLORS.red });
      styleHeader(XLSX, ws, `A${groupHeaderRow}:${lastColLetter}${groupHeaderRow}`, COLORS.tealDeep);
      styleHeader(XLSX, ws, `A${detailHeaderRow}:${lastColLetter}${detailHeaderRow}`, COLORS.tealDeep);

      addLevels.forEach((rank) => {
        const start = excelColumn(colIndex[`addPct${rank}`]);
        const end = excelColumn(colIndex[`addIdrg${rank}`]);
        styleRange(XLSX, ws, `${start}${groupHeaderRow}:${end}${groupHeaderRow}`, { fill: COLORS.green, fontColor: COLORS.white, bold: true, align: "center" });
        styleRange(XLSX, ws, `${start}${scenarioStartRow}:${end}${scenarioStartRow + 5}`, { fill: COLORS.greenSoft });
        styleRange(XLSX, ws, `${start}${scenarioStartRow}:${start}${scenarioStartRow + 5}`, { fill: COLORS.yellow, align: "right", numFmt: percentFormat });
      });
      reduceLevels.forEach((rank) => {
        const start = excelColumn(colIndex[`redPct${rank}`]);
        const end = excelColumn(colIndex[`redIna${rank}`]);
        styleRange(XLSX, ws, `${start}${groupHeaderRow}:${end}${groupHeaderRow}`, { fill: COLORS.red, fontColor: COLORS.white, bold: true, align: "center" });
        styleRange(XLSX, ws, `${start}${scenarioStartRow}:${end}${scenarioStartRow + 5}`, { fill: COLORS.redSoft });
        styleRange(XLSX, ws, `${start}${scenarioStartRow}:${start}${scenarioStartRow + 5}`, { fill: COLORS.yellow, align: "right", numFmt: percentFormat });
      });
      styleRange(XLSX, ws, `${excelColumn(colIndex.deltaCase)}${scenarioStartRow}:${lastColLetter}${scenarioStartRow + 5}`, { fill: COLORS.light });
      styleRange(XLSX, ws, `${excelColumn(colIndex.deltaCasePct)}${scenarioStartRow}:${excelColumn(colIndex.deltaCasePct)}${scenarioStartRow + 5}`, { fill: COLORS.light, align: "right", numFmt: percentFormat });
      styleRange(XLSX, ws, `${excelColumn(colIndex.deltaRevenuePct)}${scenarioStartRow}:${excelColumn(colIndex.deltaRevenuePct)}${scenarioStartRow + 5}`, { fill: COLORS.light, align: "right", numFmt: percentFormat });
      styleRange(XLSX, ws, `${excelColumn(colIndex.deltaRevenue)}${scenarioStartRow}:${excelColumn(colIndex.projectedRevenue)}${scenarioStartRow + 5}`, { fill: COLORS.light, align: "right", numFmt: moneyFormat });
      styleRange(XLSX, ws, `A${scenarioStartRow}:A${scenarioStartRow + 5}`, { fill: COLORS.white, bold: true });
      styleRange(XLSX, ws, `A${insightTitleRow}:${lastColLetter}${insightTitleRow}`, { fill: "E2F4F1", fontColor: COLORS.ink, bold: true });
      insightRows.forEach((rowNumber) => {
        styleRange(XLSX, ws, `A${rowNumber}:A${rowNumber}`, { fill: COLORS.teal, fontColor: COLORS.white, bold: true });
        styleRange(XLSX, ws, `B${rowNumber}:${lastColLetter}${rowNumber}`, { fill: COLORS.white, fontColor: COLORS.ink });
      });
      styleRange(XLSX, ws, `A${rows.length - 1}:${lastColLetter}${rows.length}`, { fill: COLORS.light, fontColor: COLORS.muted });
      ws["!rows"] = ws["!rows"] || [];
      ws["!rows"][1] = { hpt: 24 };
      ws["!rows"][5] = { hpt: 48 };
      ws["!rows"][insightTitleRow - 1] = { hpt: 26 };
      insightRows.forEach((rowNumber) => { ws["!rows"][rowNumber - 1] = { hpt: 34 }; });
      ws["!autofilter"] = { ref: `A${detailHeaderRow}:${lastColLetter}${scenarioStartRow + 5}` };
      setSheetDefaults(ws, columns.map((column) => column.width), detailHeaderRow);

      const shortService = displayName.replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).slice(0, 3).join("_");
      const sheetName = appendSheet(ws, `SIM_${String(serviceIndex + 1).padStart(2, "0")}_${shortService}`);
      return {
        service,
        displayName,
        competency,
        sheetName,
        scenarioStartRow,
        colIndex,
        scenarioValues,
        sourceRows,
      };
    }

    data.services.forEach((service, index) => serviceSheetMeta.push(buildServiceSheet(service, index)));

    // 04 - Rekap seluruh sheet simulasi.
    const recapRows = [[
      "No", "Kode Layanan", "Nama Layanan", "Sheet Simulasi", "Kompetensi", "Skenario",
      "Kasus Eksisting", "Tambahan Kasus", "Pengurangan Kasus", "Delta Kasus", "Proyeksi Kasus", "% Delta Kasus",
      "INA Eksisting", "Tambahan iDRG", "Pengurangan INA", "Delta Pendapatan", "Proyeksi Pendapatan", "% vs INA Eksisting",
    ]];
    serviceSheetMeta.forEach((meta, serviceIndex) => {
      for (let scenarioIndex = 1; scenarioIndex <= 6; scenarioIndex += 1) {
        const values = meta.scenarioValues[scenarioIndex];
        const sheet = quoteSheet(meta.sheetName);
        const row = values.row;
        const col = meta.colIndex;
        const addCaseCells = Object.keys(col).filter((key) => key.startsWith("addCase")).map((key) => `${sheet}!${excelColumn(col[key])}${row}`);
        const redCaseCells = Object.keys(col).filter((key) => key.startsWith("redCase")).map((key) => `${sheet}!${excelColumn(col[key])}${row}`);
        const addIdrgCells = Object.keys(col).filter((key) => key.startsWith("addIdrg")).map((key) => `${sheet}!${excelColumn(col[key])}${row}`);
        const redInaCells = Object.keys(col).filter((key) => key.startsWith("redIna")).map((key) => `${sheet}!${excelColumn(col[key])}${row}`);
        recapRows.push([
          serviceIndex + 1,
          meta.service,
          meta.displayName,
          meta.sheetName,
          levelNames[meta.competency] || "Tidak terpetakan",
          scenarioIndex,
          formula(`${sheet}!$B$6`, Number(target.services?.[meta.service]?.total?.[CASES]) || 0, numberFormat),
          formula(addCaseCells.length ? addCaseCells.join("+") : "0", values.addedCases, numberFormat),
          formula(redCaseCells.length ? redCaseCells.join("+") : "0", values.reducedCases, numberFormat),
          formula(`${sheet}!${excelColumn(col.deltaCase)}${row}`, values.deltaCases, numberFormat),
          formula(`${sheet}!${excelColumn(col.projectedCase)}${row}`, values.projectedCases, numberFormat),
          formula(`${sheet}!${excelColumn(col.deltaCasePct)}${row}`, target.services?.[meta.service]?.total?.[CASES] ? values.deltaCases / target.services[meta.service].total[CASES] : 0, percentFormat),
          formula(`${sheet}!$B$7`, Number(target.services?.[meta.service]?.total?.[INA]) || 0, moneyFormat),
          formula(addIdrgCells.length ? addIdrgCells.join("+") : "0", values.addedIdrg, moneyFormat),
          formula(redInaCells.length ? redInaCells.join("+") : "0", values.reducedIna, moneyFormat),
          formula(`${sheet}!${excelColumn(col.deltaRevenue)}${row}`, values.deltaRevenue, moneyFormat),
          formula(`${sheet}!${excelColumn(col.projectedRevenue)}${row}`, values.projectedRevenue, moneyFormat),
          formula(`${sheet}!${excelColumn(col.deltaRevenuePct)}${row}`, target.services?.[meta.service]?.total?.[INA] ? values.deltaRevenue / target.services[meta.service].total[INA] : 0, percentFormat),
        ]);
      }
    });
    const recapWs = XLSX.utils.aoa_to_sheet(recapRows);
    styleHeader(XLSX, recapWs, "A1:R1", COLORS.tealDeep);
    styleDataBody(XLSX, recapWs, 2, recapRows.length, 17, ["A", "F", "G", "H", "I", "J", "K"], ["M", "N", "O", "P", "Q"], ["L", "R"]);
    styleRange(XLSX, recapWs, `A2:F${recapRows.length}`, { fill: COLORS.blueSoft });
    styleRange(XLSX, recapWs, `G2:R${recapRows.length}`, { fill: COLORS.light });
    recapWs["!autofilter"] = { ref: `A1:R${recapRows.length}` };
    setSheetDefaults(recapWs, [6, 30, 34, 30, 18, 10, 16, 16, 18, 15, 17, 15, 20, 20, 20, 20, 22, 18], 1);
    appendSheet(recapWs, "04_Rekap_Simulasi");

    // 99 - Rekonsiliasi sumber dengan sheet simulasi.
    const reconciliationRows = [[
      "No", "Layanan", "Sheet", "Kasus Target - Sumber", "Kasus Target - Simulasi", "Selisih",
      "Kasus Regional - Sumber", "Kasus Regional - Simulasi", "Selisih", "Status",
    ]];
    serviceSheetMeta.forEach((meta, index) => {
      const excelRow = reconciliationRows.length + 1;
      const sourceRowRefs = severityRanks.map((rank) => `${quoteSheet(serviceDataName)}!H${meta.sourceRows[rank]}`);
      const regionalRowRefs = severityRanks.map((rank) => `${quoteSheet(serviceDataName)}!K${meta.sourceRows[rank]}`);
      const targetCases = Number(target.services?.[meta.service]?.total?.[CASES]) || 0;
      const regionalCases = Number(data.regional?.services?.[meta.service]?.total?.[CASES]) || 0;
      reconciliationRows.push([
        index + 1,
        meta.displayName,
        meta.sheetName,
        formula(sourceRowRefs.join("+"), targetCases, numberFormat),
        formula(`${quoteSheet(meta.sheetName)}!$B$6`, targetCases, numberFormat),
        formula(`E${excelRow}-D${excelRow}`, 0, numberFormat),
        formula(regionalRowRefs.join("+"), regionalCases, numberFormat),
        formula(`${quoteSheet(meta.sheetName)}!$F$6`, regionalCases, numberFormat),
        formula(`H${excelRow}-G${excelRow}`, 0, numberFormat),
        formula(`IF(AND(ABS(F${excelRow})<0.01,ABS(I${excelRow})<0.01),"PASS","FAIL")`, "PASS", undefined, "s"),
      ]);
    });
    const reconciliationWs = XLSX.utils.aoa_to_sheet(reconciliationRows);
    styleHeader(XLSX, reconciliationWs, "A1:J1", COLORS.tealDeep);
    styleDataBody(XLSX, reconciliationWs, 2, reconciliationRows.length, 9, ["A", "D", "E", "F", "G", "H", "I"]);
    styleRange(XLSX, reconciliationWs, `A2:C${reconciliationRows.length}`, { fill: COLORS.blueSoft });
    styleRange(XLSX, reconciliationWs, `D2:J${reconciliationRows.length}`, { fill: COLORS.light });
    styleRange(XLSX, reconciliationWs, `J2:J${reconciliationRows.length}`, { fill: COLORS.greenSoft, bold: true, fontColor: "08705A", align: "center" });
    reconciliationWs["!autofilter"] = { ref: `A1:J${reconciliationRows.length}` };
    setSheetDefaults(reconciliationWs, [6, 36, 30, 20, 22, 13, 22, 24, 13, 12], 1);
    appendSheet(reconciliationWs, "99_Rekonsiliasi");

    return wb;
  }

  function exportWorkbook(context) {
    const wb = buildWorkbook(context);
    const safeTarget = String(context.target.name || "RS_Target").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const fileName = `Kertas_Kerja_Audit_Market_Share_${safeTarget}.xlsx`;
    context.XLSX.writeFile(wb, fileName, { compression: true });
    return { workbook: wb, fileName };
  }

  global.MarketShareAuditExcel = { buildWorkbook, exportWorkbook };
})(window);
