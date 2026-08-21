(function dynamicMarketExcelModule(global) {
  "use strict";

  const COLORS = {
    navy: "334155", teal: "0F766E", green: "059669", greenSoft: "F0FDF4",
    red: "E11D48", redSoft: "FFF1F2", blue: "2563EB", blueSoft: "EFF6FF",
    purple: "7C3AED", grey: "E2E8F0", light: "F8FAFC", white: "FFFFFF", ink: "0F172A"
  };
  const BORDER = {
    top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } },
    left: { style: "thin", color: { rgb: "CBD5E1" } }, right: { style: "thin", color: { rgb: "CBD5E1" } }
  };

  const formulaCell = (formula, value, format) => ({ t: "n", f: formula, v: Number(value) || 0, z: format });
  const quote = (name) => `'${String(name).replace(/'/g, "''")}'`;
  const safeFile = (value) => String(value || "RS").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");

  function styleCell(cell, options) {
    if (!cell) return;
    const opts = options || {};
    cell.s = {
      font: { name: "Aptos", sz: opts.size || 10, bold: Boolean(opts.bold), color: { rgb: opts.fontColor || COLORS.ink } },
      fill: { fgColor: { rgb: opts.fill || COLORS.white } },
      border: opts.border === false ? undefined : BORDER,
      alignment: { vertical: "center", horizontal: opts.align || "left", wrapText: opts.wrap !== false }
    };
    if (opts.numFmt) cell.s.numFmt = opts.numFmt;
  }

  function styleRange(XLSX, ws, range, options) {
    const decoded = XLSX.utils.decode_range(range);
    for (let r = decoded.s.r; r <= decoded.e.r; r += 1) {
      for (let c = decoded.s.c; c <= decoded.e.c; c += 1) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) ws[ref] = { t: "s", v: "" };
        styleCell(ws[ref], options);
      }
    }
  }

  function setupSheet(XLSX, ws, title, lastColumn, widths, headerRow) {
    ws["!merges"] = ws["!merges"] || [];
    ws["!merges"].push(XLSX.utils.decode_range(`A1:${lastColumn}1`));
    styleRange(XLSX, ws, `A1:${lastColumn}1`, { fill: COLORS.purple, fontColor: COLORS.white, bold: true, size: 15, border: false });
    ws.A1.v = title;
    if (headerRow) styleRange(XLSX, ws, `A${headerRow}:${lastColumn}${headerRow}`, { fill: COLORS.teal, fontColor: COLORS.white, bold: true, align: "center" });
    ws["!cols"] = widths.map((wch) => ({ wch }));
    ws["!freeze"] = { xSplit: 0, ySplit: headerRow || 1 };
    ws["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0 };
    ws["!margins"] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
  }

  function exportWorkbook(context) {
    const { XLSX, target, service, targetComp, levelNames, levelData, scenarioDefs, scenarioResults, pctFor,
      baselineCases, baselineIna, baselineIdrg, datasetLabel, tariffLabel, filterDescription } = context;
    if (!XLSX?.utils) throw new Error("Library XLSX belum tersedia.");

    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: `Kertas Kerja Audit Simulasi Dinamis - ${target.name}`,
      Subject: `Market share dinamis layanan ${service}`,
      Author: "Kementerian Kesehatan RI",
      Company: "Kementerian Kesehatan RI",
      Comments: "Kasus tambah hanya bersumber dari RS dengan kompetensi layanan lebih tinggi. Pengurangan di luar kompetensi default 100% dan dapat diuji sensitivitasnya.",
      CreatedDate: new Date()
    };

    const append = (rows, name, title, lastCol, widths, headerRow) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      setupSheet(XLSX, ws, title, lastCol, widths, headerRow);
      XLSX.utils.book_append_sheet(wb, ws, name);
      return ws;
    };

    const guideRows = [
      [`KERTAS KERJA AUDIT SIMULASI MARKET SHARE DINAMIS`, "", "", "", "", ""],
      ["Identitas", "Nilai", "", "", "", ""],
      ["RS target", target.name], ["Kode RS", target.code], ["Layanan", service],
      ["Kompetensi target", levelNames[targetComp] || targetComp], ["Dataset", datasetLabel],
      ["Skenario tarif", tariffLabel], ["Filter regional", filterDescription], ["Tanggal ekspor", new Date().toLocaleString("id-ID")],
      [], ["Ketentuan audit", "Penjelasan"],
      ["Sumber kasus tambah", "Hanya kasus pada RS yang kompetensi layanannya lebih tinggi daripada kompetensi RS target."],
      ["Kasus pengurang", "Satu parameter untuk seluruh skenario; default 100% dari kasus eksisting di luar kompetensi dan dapat diedit untuk sensitivitas."],
      ["Natural share", "100 / (jumlah RS sumber berkompetensi lebih tinggi + 1 RS target)."],
      ["Area input", "Kolom Persentase Simulasi pada sheet 03_Parameter dapat diedit untuk audit sensitivitas."],
      [], ["Urutan penelusuran", "01_Eksisting → 02_Driver_Pasar → 03_Parameter → 04_Hasil → 05_Rekonsiliasi"]
    ];
    const guide = append(guideRows, "00_Petunjuk", "KERTAS KERJA AUDIT SIMULASI MARKET SHARE DINAMIS", "F", [25, 85, 12, 12, 12, 12], 2);
    styleRange(XLSX, guide, "A3:B18", { fill: COLORS.white });
    styleRange(XLSX, guide, "A12:B12", { fill: COLORS.navy, fontColor: COLORS.white, bold: true });

    const existingRows = [
      ["KOMPOSISI KASUS EKSISTING RS TARGET D–M–U–P", "", "", "", ""],
      ["Layanan", service, "Kompetensi target", levelNames[targetComp] || targetComp, ""],
      ["Level", "Jumlah Kasus", "INA-CBG (Rp)", "iDRG (Rp)", "Selisih iDRG–INA (Rp)"],
      ...levelData.map((item) => [levelNames[item.level], item.targetCases, item.targetIna, item.targetIdrg, item.targetIdrg - item.targetIna]),
      ["TOTAL", formulaCell("SUM(B4:B7)", baselineCases, "#,##0"), formulaCell("SUM(C4:C7)", baselineIna, '"Rp" #,##0'), formulaCell("SUM(D4:D7)", baselineIdrg, '"Rp" #,##0'), formulaCell("D8-C8", baselineIdrg - baselineIna, '"Rp" #,##0')]
    ];
    const existing = append(existingRows, "01_Eksisting", "KOMPOSISI KASUS EKSISTING RS TARGET D–M–U–P", "E", [18, 18, 22, 22, 24], 3);
    styleRange(XLSX, existing, "A4:E8", { fill: COLORS.white });
    styleRange(XLSX, existing, "A8:E8", { fill: COLORS.grey, bold: true });
    styleRange(XLSX, existing, "B4:B8", { align: "right", numFmt: "#,##0" });
    styleRange(XLSX, existing, "C4:E8", { align: "right", numFmt: '"Rp" #,##0' });

    const driverRows = [
      ["DRIVER PASAR DAN SUMBER KASUS", "", "", "", "", "", "", "", "", ""],
      ["Kasus tambah hanya dijumlahkan dari RS dengan kompetensi layanan lebih tinggi.", "", "", "", "", "", "", "", "", ""],
      ["Level", "Arah", "Kasus Regional", "Kasus Target", "Target INA", "Target iDRG", "Pool Kasus", "Pool iDRG", "RS Sumber/Eligible", "Natural Share"],
      ...levelData.map((item) => [levelNames[item.level], item.direction.toUpperCase(), item.regionalCases, item.targetCases, item.targetIna, item.targetIdrg,
        item.direction === "tambah" ? item.externalCases : item.targetCases,
        item.direction === "tambah" ? item.externalIdrg : item.targetIdrg,
        item.competitors, item.direction === "kurang" ? pctFor(0, item) / 100 : item.direction === "tambah" ? item.naturalShare / 100 : 0])
    ];
    const driver = append(driverRows, "02_Driver_Pasar", "DRIVER PASAR DAN SUMBER KASUS", "J", [15, 14, 18, 18, 20, 20, 18, 20, 20, 18], 3);
    styleRange(XLSX, driver, "A4:J7", { fill: COLORS.white });
    styleRange(XLSX, driver, "C4:I7", { align: "right", numFmt: "#,##0" });
    styleRange(XLSX, driver, "J4:J7", { align: "right", numFmt: "0.00%" });

    const parameterRows = [["PARAMETER SKENARIO DINAMIS", "", "", "", "", "", "", "", "", "", ""], [],
      ["No Skenario", "Nama", "Faktor Natural", "Level", "Arah", "Natural Share", "Persentase Simulasi", "Pool Kasus", "Pool iDRG", "Kasus Dampak", "iDRG Dampak"]];
    scenarioDefs.forEach((scenario, scenarioIndex) => {
      levelData.forEach((item, levelIndex) => {
        const driverRow = 4 + levelIndex;
        const row = 4 + parameterRows.length - 3;
        const pct = pctFor(scenarioIndex, item) / 100;
        const poolCases = item.direction === "tambah" ? item.externalCases : item.direction === "kurang" ? item.targetCases : 0;
        const poolIdrg = item.direction === "tambah" ? item.externalIdrg : item.direction === "kurang" ? item.targetIdrg : 0;
        parameterRows.push([scenarioIndex + 1, scenario.name, scenario.factor, levelNames[item.level], item.direction.toUpperCase(),
          formulaCell(`${quote("02_Driver_Pasar")}!J${driverRow}`, item.direction === "kurang" ? 1 : item.naturalShare / 100, "0.00%"),
          { t: "n", v: pct, z: "0.00%" },
          formulaCell(`${quote("02_Driver_Pasar")}!G${driverRow}`, poolCases, "#,##0"),
          formulaCell(`${quote("02_Driver_Pasar")}!H${driverRow}`, poolIdrg, '"Rp" #,##0'),
          formulaCell(`G${row}*H${row}`, poolCases * pct, "#,##0"),
          formulaCell(`G${row}*I${row}`, poolIdrg * pct, '"Rp" #,##0')]);
      });
    });
    const parameter = append(parameterRows, "03_Parameter", "PARAMETER SKENARIO DINAMIS", "K", [14, 22, 15, 14, 14, 17, 20, 18, 20, 18, 20], 3);
    styleRange(XLSX, parameter, `A4:K${parameterRows.length}`, { fill: COLORS.white });
    styleRange(XLSX, parameter, `G4:G${parameterRows.length}`, { fill: "FFF2CC", bold: true, align: "right", numFmt: "0.00%" });
    styleRange(XLSX, parameter, `F4:G${parameterRows.length}`, { align: "right", numFmt: "0.00%" });
    styleRange(XLSX, parameter, `H4:H${parameterRows.length}`, { align: "right", numFmt: "#,##0" });
    styleRange(XLSX, parameter, `I4:K${parameterRows.length}`, { align: "right", numFmt: '"Rp" #,##0' });

    const firstParam = 4;
    const lastParam = parameterRows.length;
    const resultRows = [["HASIL SIMULASI DINAMIS", "", "", "", "", "", "", "", "", "", ""], [],
      ["No", "Skenario", "+ Kasus", "+ iDRG", "- Kasus (default 100%)", "- iDRG (default 100%)", "Kasus Pasca", "iDRG Pasca", "Delta Kasus", "Delta vs INA", "% Delta vs INA"]];
    scenarioResults.forEach((result, index) => {
      const excelRow = 4 + index;
      const scenarioNo = index + 1;
      const addCasesFormula = `SUMIFS(${quote("03_Parameter")}!$J$${firstParam}:$J$${lastParam},${quote("03_Parameter")}!$A$${firstParam}:$A$${lastParam},A${excelRow},${quote("03_Parameter")}!$E$${firstParam}:$E$${lastParam},"TAMBAH")`;
      const addIdrgFormula = `SUMIFS(${quote("03_Parameter")}!$K$${firstParam}:$K$${lastParam},${quote("03_Parameter")}!$A$${firstParam}:$A$${lastParam},A${excelRow},${quote("03_Parameter")}!$E$${firstParam}:$E$${lastParam},"TAMBAH")`;
      const lossCasesFormula = `SUMIFS(${quote("03_Parameter")}!$J$${firstParam}:$J$${lastParam},${quote("03_Parameter")}!$A$${firstParam}:$A$${lastParam},A${excelRow},${quote("03_Parameter")}!$E$${firstParam}:$E$${lastParam},"KURANG")`;
      const lossIdrgFormula = `SUMIFS(${quote("03_Parameter")}!$K$${firstParam}:$K$${lastParam},${quote("03_Parameter")}!$A$${firstParam}:$A$${lastParam},A${excelRow},${quote("03_Parameter")}!$E$${firstParam}:$E$${lastParam},"KURANG")`;
      const deltaIna = result.projectedIdrg - baselineIna;
      resultRows.push([scenarioNo, result.definition.name,
        formulaCell(addCasesFormula, result.addCases, "#,##0"), formulaCell(addIdrgFormula, result.addIdrg, '"Rp" #,##0'),
        formulaCell(lossCasesFormula, result.lossCases, "#,##0"), formulaCell(lossIdrgFormula, result.lossIdrg, '"Rp" #,##0'),
        formulaCell(`${quote("01_Eksisting")}!B8+C${excelRow}-E${excelRow}`, result.projectedCases, "#,##0"),
        formulaCell(`${quote("01_Eksisting")}!D8+D${excelRow}-F${excelRow}`, result.projectedIdrg, '"Rp" #,##0'),
        formulaCell(`G${excelRow}-${quote("01_Eksisting")}!B8`, result.projectedCases - baselineCases, "#,##0"),
        formulaCell(`H${excelRow}-${quote("01_Eksisting")}!C8`, deltaIna, '"Rp" #,##0'),
        formulaCell(`IFERROR(J${excelRow}/${quote("01_Eksisting")}!C8,0)`, baselineIna ? deltaIna / baselineIna : 0, "0.00%")]);
    });
    const results = append(resultRows, "04_Hasil", "HASIL SIMULASI DINAMIS", "K", [9, 23, 16, 20, 18, 20, 18, 20, 16, 20, 18], 3);
    styleRange(XLSX, results, `A4:K${resultRows.length}`, { fill: COLORS.white });
    styleRange(XLSX, results, `C4:K${resultRows.length}`, { align: "right" });
    styleRange(XLSX, results, `D4:D${resultRows.length}`, { numFmt: '"Rp" #,##0' });
    styleRange(XLSX, results, `F4:F${resultRows.length}`, { numFmt: '"Rp" #,##0' });
    styleRange(XLSX, results, `H4:J${resultRows.length}`, { numFmt: '"Rp" #,##0' });
    styleRange(XLSX, results, `K4:K${resultRows.length}`, { numFmt: "0.00%" });

    const lossCasesExpected = levelData.filter((item) => item.direction === "kurang").reduce((sum, item) => sum + item.targetCases * pctFor(0, item) / 100, 0);
    const lossIdrgExpected = levelData.filter((item) => item.direction === "kurang").reduce((sum, item) => sum + item.targetIdrg * pctFor(0, item) / 100, 0);
    const reconciliationRows = [
      ["REKONSILIASI DAN KONTROL AUDIT", "", "", ""], [], ["Kontrol", "Nilai Sumber", "Nilai Hasil", "Status"],
      ["Total kasus eksisting D-M-U-P", baselineCases, formulaCell(`${quote("01_Eksisting")}!B8`, baselineCases, "#,##0"), { t: "s", f: `IF(B4=C4,"OK","SELISIH")`, v: "OK" }],
      ["Total INA eksisting D-M-U-P", baselineIna, formulaCell(`${quote("01_Eksisting")}!C8`, baselineIna, '"Rp" #,##0'), { t: "s", f: `IF(B5=C5,"OK","SELISIH")`, v: "OK" }],
      ["Total iDRG eksisting D-M-U-P", baselineIdrg, formulaCell(`${quote("01_Eksisting")}!D8`, baselineIdrg, '"Rp" #,##0'), { t: "s", f: `IF(B6=C6,"OK","SELISIH")`, v: "OK" }],
      ["Pengurangan kasus sesuai parameter global", lossCasesExpected, formulaCell(`${quote("04_Hasil")}!E4`, lossCasesExpected, "#,##0"), { t: "s", f: `IF(B7=C7,"OK","SELISIH")`, v: "OK" }],
      ["Pengurangan iDRG sesuai parameter global", lossIdrgExpected, formulaCell(`${quote("04_Hasil")}!F4`, lossIdrgExpected, '"Rp" #,##0'), { t: "s", f: `IF(B8=C8,"OK","SELISIH")`, v: "OK" }]
    ];
    const recon = append(reconciliationRows, "05_Rekonsiliasi", "REKONSILIASI DAN KONTROL AUDIT", "D", [38, 24, 24, 16], 3);
    styleRange(XLSX, recon, "A4:D8", { fill: COLORS.white });
    styleRange(XLSX, recon, "D4:D8", { fill: COLORS.greenSoft, fontColor: COLORS.green, bold: true, align: "center" });

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Kertas_Kerja_Dinamis_${safeFile(target.code)}_${safeFile(service)}_${date}.xlsx`, { compression: true });
  }

  global.DynamicMarketExcel = { exportWorkbook };
})(window);
