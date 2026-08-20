/**
 * export-gslides.js
 * Generator PPTX Native berkecepatan tinggi menggunakan PptxGenJS.
 * Menghasilkan SELURUH slide dashboard simulator (20–30+ slide) secara native,
 * rapi, dan dapat diedit langsung saat diimpor ke Google Slides.
 */
(function () {
  "use strict";

  const W = 13.33, H = 7.5;

  const C = {
    teal: "087e83",
    tealL: "0aa7ad",
    tealD: "065f64",
    green: "187a59",
    greenL: "2e9b5f",
    purple: "6d28d9",
    blue: "0891b2",
    amber: "b45309",
    amberL: "d97706",
    red: "dc2626",
    redD: "b93d4a",
    slate: "334155",
    slateL: "64748b",
    dark: "1e293b",
    navy: "0f172a",
    white: "FFFFFF",
    lime: "dce744",
    bgray: "f8fafc",
    lgray: "e2e8f0",
    mgray: "cbd5e1",
    insightBg: "f7fbfa",
    insightBorder: "cfe8e5",
    cyanBg: "f0fdfa",
    cyanBorder: "ccfbf1",
    amberBg: "fffbeb",
    amberBorder: "fef3c7",
    emerald: "059669",
  };

  function num(n, dec) {
    if (n === null || n === undefined || isNaN(n)) return "0";
    return Number(n).toLocaleString("id-ID", { maximumFractionDigits: dec !== undefined ? dec : 0 });
  }

  function pct(n, dec) {
    if (n === null || n === undefined || isNaN(n)) return "0%";
    return (n * 100).toLocaleString("id-ID", { minimumFractionDigits: dec !== undefined ? dec : 2, maximumFractionDigits: dec !== undefined ? dec : 2 }) + "%";
  }

  function money(n) {
    if (n === null || n === undefined || isNaN(n)) return "Rp 0 M";
    var abs = Math.abs(n), sign = n < 0 ? "- " : "";
    var inMilyar = abs / 1e9;
    var formatted;
    if (abs > 0 && abs < 1e6) {
        formatted = inMilyar.toLocaleString("id-ID", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    } else if (abs < 1e8) {
        formatted = inMilyar.toLocaleString("id-ID", { maximumFractionDigits: 3 });
    } else {
        formatted = inMilyar.toLocaleString("id-ID", { maximumFractionDigits: 2 });
    }
    return sign + "Rp " + formatted + " M";
  }

  function moneyM(n) {
    if (n === null || n === undefined || isNaN(n)) return "0 M";
    var abs = Math.abs(n), sign = n < 0 ? "-" : "";
    var inMilyar = abs / 1e9;
    var formatted;
    if (abs > 0 && abs < 1e6) {
        formatted = inMilyar.toLocaleString("id-ID", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    } else if (abs < 1e8) {
        formatted = inMilyar.toLocaleString("id-ID", { maximumFractionDigits: 3 });
    } else {
        formatted = inMilyar.toLocaleString("id-ID", { maximumFractionDigits: 2 });
    }
    return sign + formatted + " M";
  }

  function signed(n) {
    if (n === 0 || !n) return "0";
    return (n > 0 ? "+ " : "− ") + num(Math.abs(n), 0);
  }

  function signedPct(n) {
    if (n === 0 || !n) return "0,00%";
    return (n > 0 ? "+ " : "− ") + pct(Math.abs(n));
  }

  function signedMoney(n) {
    if (n === 0 || !n) return "Rp 0";
    return (n > 0 ? "+ " : "− ") + money(Math.abs(n));
  }

  function signedMoneyM(n) {
    if (n === 0 || !n) return "0,0 M";
    return (n > 0 ? "+ " : "− ") + (Math.abs(n) / 1e9).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M";
  }

  function severityMetric(svc, lvl) {
    if (!svc) return [0, 0, 0];
    var v = svc.severity && svc.severity[lvl];
    return Array.isArray(v) ? v : [0, 0, 0];
  }

  function getLevelRules(comp, serviceName) {
    serviceName = serviceName || "";
    if (comp === 0 && serviceName.toLowerCase().includes("forensik")) {
      return { tambah: [1], kurang: [2, 3, 4] };
    }
    switch (comp) {
      case 1: return { tambah: [1],       kurang: [2, 3, 4] };
      case 2: return { tambah: [1, 2],    kurang: [3, 4] };
      case 3: return { tambah: [2, 3],    kurang: [1, 4] };
      case 4: return { tambah: [3, 4],    kurang: [1, 2] };
      default: return { tambah: [],       kurang: [] };
    }
  }

  function getCompetency(hosp, service) {
    if (!hosp || !hosp.services || !hosp.services[service]) return 0;
    return hosp.services[service].competency || 0;
  }

  function levelName(lvl) {
    return ["", "Dasar", "Madya", "Utama", "Paripurna"][lvl] || "-";
  }

  function shortLevelName(lvl) {
    return ["", "Dsr", "Mdy", "Utm", "Prp"][lvl] || "-";
  }

  function hCell(text, bg, extra) {
    return Object.assign({
      text: text,
      options: Object.assign({
        bold: true,
        color: C.white,
        fill: { color: bg || C.teal },
        fontSize: 7.5,
        align: "center",
        valign: "middle"
      }, extra || {})
    });
  }

  function dCell(text, extra) {
    return Object.assign({
      text: text,
      options: Object.assign({
        fontSize: 7.5,
        align: "center",
        valign: "middle",
        fill: { color: C.white },
        color: C.dark
      }, extra || {})
    });
  }

  function addSlideHeader(slide, title, subtitle, dateStr, rightBadgeText) {
    slide.addShape("rect", { x: 0, y: 0, w: W, h: 0.68, fill: { color: C.teal }, line: { color: C.teal } });
    slide.addText(title, {
      x: 0.35, y: 0.08, w: W - 3.8, h: 0.30, fontSize: 14, bold: true, color: C.white, fontFace: "Century Gothic"
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.35, y: 0.38, w: W - 3.8, h: 0.22, fontSize: 8, color: "d6f3f1", fontFace: "Century Gothic"
      });
    }
    slide.addShape("rect", { x: W - 3.1, y: 0.08, w: 2.85, h: 0.52, fill: { color: C.redD }, line: { color: C.redD } });
    slide.addText((rightBadgeText || "Data Mirroring Uji Coba iDRG") + "\n" + dateStr, {
      x: W - 3.1, y: 0.08, w: 2.85, h: 0.52, fontSize: 6.5, color: C.white, align: "center", valign: "middle", fontFace: "Century Gothic"
    });
  }

  function addKpiStrip(slide, kpis, y, h) {
    y = y || 0.76;
    h = h || 0.64;
    var count = kpis.length;
    var gap = 0.12;
    var totalW = W - 0.70;
    var kw = (totalW - (count - 1) * gap) / count;

    kpis.forEach(function (k, i) {
      var kx = 0.35 + i * (kw + gap);
      var cardColor = k.color || C.teal;
      slide.addShape("rect", { x: kx, y: y, w: kw, h: h, fill: { color: C.white }, line: { color: C.lgray, pt: 0.5 } });
      slide.addShape("rect", { x: kx, y: y, w: kw, h: 0.04, fill: { color: cardColor }, line: { color: cardColor } });
      slide.addText(k.lbl, { x: kx + 0.08, y: y + 0.06, w: kw - 0.16, h: 0.18, fontSize: 6.5, color: C.slateL, fontFace: "Century Gothic" });
      slide.addText(k.val, { x: kx + 0.08, y: y + 0.24, w: kw - 0.16, h: 0.26, fontSize: k.valSize || 13, bold: true, color: cardColor, fontFace: "Century Gothic" });
      if (k.sub) {
        slide.addText(k.sub, { x: kx + 0.08, y: y + 0.48, w: kw - 0.16, h: 0.14, fontSize: 5.5, color: C.slateL, fontFace: "Century Gothic" });
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 1: COVER SLIDE
  ══════════════════════════════════════════════════════════════ */
  function buildCoverSlide(pptx, appState) {
    var target = appState.target || {};
    var dateStr = appState.dateStr;
    var filters = appState.filters || {};
    var hospCount = (appState.data.hospitals || []).length;

    var slide = pptx.addSlide();
    slide.background = { color: C.navy };

    slide.addShape("rect", { x: 0, y: 0, w: W, h: H, fill: { color: C.navy }, line: { color: C.navy } });
    slide.addText("SIMULATOR MARKET SHARE REGIONAL", {
      x: 0.6, y: 1.3, w: W - 1.2, h: 0.8, fontSize: 28, bold: true, color: C.white, align: "center", fontFace: "Century Gothic"
    });
    slide.addText("Data Mirroring Uji Coba iDRG vs INA-CBG", {
      x: 0.6, y: 2.1, w: W - 1.2, h: 0.4, fontSize: 13, color: "94a3b8", align: "center", fontFace: "Century Gothic"
    });

    slide.addShape("rect", { x: 3.5, y: 2.7, w: W - 7.0, h: 0.04, fill: { color: C.lime }, line: { color: C.lime } });

    var targetName = (target.name || "Regional / Seluruh RS Terpilih").toUpperCase();
    slide.addText("RS TARGET: " + targetName, {
      x: 0.6, y: 2.9, w: W - 1.2, h: 0.6, fontSize: 18, bold: true, color: C.lime, align: "center", fontFace: "Century Gothic"
    });

    var provInfo = filters.selectedProvinces && filters.selectedProvinces.length ? filters.selectedProvinces.join(", ") : "Semua Provinsi";
    var cityInfo = filters.selectedCities && filters.selectedCities.length ? filters.selectedCities.join(", ") : 
      (filters.selectedProvinces && filters.selectedProvinces.length ? 
        Array.from(new Set(
          window.marketSimulatorDatasets[document.getElementById('datasetSelect')?.value || 'okt_jun'].hospitals
          .filter(h => filters.selectedProvinces.includes(h.province))
          .map(h => h.city)
        )).sort().join(", ") 
      : "Semua Kab/Kota");
    var groupInfo = filters.isMuhammadiyahOnly ? "Khusus RS Muhammadiyah / Aisyiyah" : "Semua Kategori RS";

    var infoText = "Wilayah: " + provInfo + " (" + cityInfo + ")  •  " + groupInfo + " (" + hospCount + " RS Terpilih)\n" +
                   "Periode Data: " + (filters.activeDatasetPeriod === "jan_des" ? "1 Tahun Penuh (Jan - Des)" : "Uji Coba 8 Bulan (15 Okt 2025 - 14 Jun 2026)") +
                   "  •  Skenario Tarif: " + (filters.activeTariff || "AF + AFreg + AFkep");

    slide.addShape("rect", { x: 1.5, y: 3.8, w: W - 3.0, h: 0.9, fill: { color: "1e293b" }, line: { color: "334155", pt: 0.75 } });
    slide.addText(infoText, {
      x: 1.7, y: 3.9, w: W - 3.4, h: 0.7, fontSize: 8.5, color: "e2e8f0", align: "center", valign: "middle", fontFace: "Century Gothic"
    });

    slide.addText("Tanggal Ekspor: " + dateStr, {
      x: 0.6, y: H - 1.1, w: W - 1.2, h: 0.3, fontSize: 9.5, color: "94a3b8", align: "center", fontFace: "Century Gothic"
    });
    slide.addText("KEMENTERIAN KESEHATAN REPUBLIK INDONESIA", {
      x: 0.6, y: H - 0.7, w: W - 1.2, h: 0.35, fontSize: 10, bold: true, color: C.tealL, align: "center", fontFace: "Century Gothic"
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 2: RINGKASAN RS TARGET (TARGET SUMMARY)
  ══════════════════════════════════════════════════════════════ */
  function buildTargetSummarySlide(pptx, appState) {
    var target = appState.target || {};
    var data = appState.data, CASES = appState.CASES, INA = appState.INA, IDRG = appState.IDRG;
    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    var tTotal = target.total || data.regional.total || [0,0,0];
    var totalCases = tTotal[CASES] || 0;
    var totalIna = tTotal[INA] || 0;
    var totalIdrg = tTotal[IDRG] || 0;
    var selisih = totalIdrg - totalIna;
    var pctSelisih = totalIna ? selisih / totalIna : 0;

    addSlideHeader(slide, "Ringkasan Eksisting Kasus & Pendapatan — " + (target.name || "RS Target"),
      "Profil klaim agregat dan dampak penyesuaian tarif iDRG terhadap pendapatan INA-CBG", appState.dateStr);

    var kpis = [
      { lbl: "Total Kasus Eksisting", val: num(totalCases), color: C.dark, sub: "Jumlah klaim terdata" },
      { lbl: "Pendapatan INA-CBG", val: money(totalIna), color: C.amberL, sub: "Basis tarif INA-CBG" },
      { lbl: "Pendapatan iDRG", val: money(totalIdrg), color: C.emerald, sub: "Hasil uji coba iDRG" },
      { lbl: "Selisih Pendapatan", val: signedMoney(selisih), color: selisih >= 0 ? C.emerald : C.red, sub: "iDRG − INA-CBG" },
      { lbl: "% Dampak Pertumbuhan", val: signedPct(pctSelisih), color: selisih >= 0 ? C.emerald : C.red, sub: "Terhadap INA-CBG" }
    ];
    addKpiStrip(slide, kpis, 0.76, 0.72);

    var rows = [
      [
        hCell("Tingkat Keparahan / Strata", C.tealL),
        hCell("Kasus Eksisting", C.tealL),
        hCell("% Share Kasus", C.tealL),
        hCell("Pendapatan INA-CBG (Rp M)", C.tealL),
        hCell("Pendapatan iDRG (Rp M)", C.tealL),
        hCell("Selisih (+/- Rp M)", C.tealL),
        hCell("% Selisih", C.tealL)
      ]
    ];

    [1, 2, 3, 4].forEach(function (lvl) {
      var m = (target.severity && target.severity[lvl]) || (data.regional.severity && data.regional.severity[lvl]) || [0,0,0];
      var k = m[CASES] || 0;
      var ina = m[INA] || 0;
      var idrg = m[IDRG] || 0;
      var diff = idrg - ina;
      var pDiff = ina ? diff / ina : 0;
      var pShare = totalCases ? k / totalCases : 0;
      var cColor = diff >= 0 ? "15803d" : "b91c1c";

      rows.push([
        dCell(levelName(lvl), { bold: true, align: "left" }),
        dCell(num(k), { align: "right" }),
        dCell(pct(pShare), { align: "right" }),
        dCell(moneyM(ina), { align: "right" }),
        dCell(moneyM(idrg), { align: "right", bold: true }),
        dCell(signedMoneyM(diff), { align: "right", bold: true, color: cColor }),
        dCell(signedPct(pDiff), { align: "right", bold: true, color: cColor })
      ]);
    });

    // Total row
    var cTotColor = selisih >= 0 ? "15803d" : "b91c1c";
    rows.push([
      dCell("TOTAL D–M–U–P", { bold: true, align: "left", fill: { color: "e0f2fe" } }),
      dCell(num(totalCases), { bold: true, align: "right", fill: { color: "e0f2fe" } }),
      dCell("100,0%", { bold: true, align: "right", fill: { color: "e0f2fe" } }),
      dCell(moneyM(totalIna), { bold: true, align: "right", fill: { color: "e0f2fe" } }),
      dCell(moneyM(totalIdrg), { bold: true, align: "right", fill: { color: "e0f2fe" } }),
      dCell(signedMoneyM(selisih), { bold: true, align: "right", fill: { color: "e0f2fe" }, color: cTotColor }),
      dCell(signedPct(pctSelisih), { bold: true, align: "right", fill: { color: "e0f2fe" }, color: cTotColor })
    ]);

    slide.addTable(rows, {
      x: 0.35, y: 1.62, w: W - 0.70,
      border: { pt: 0.5, color: C.lgray },
      colW: [2.6, 1.6, 1.4, 2.0, 2.0, 1.6, 1.45],
      margin: [0.06, 0.06, 0.06, 0.06]
    });

    slide.addShape("rect", { x: 0.35, y: H - 0.75, w: W - 0.70, h: 0.55, fill: { color: C.insightBg }, line: { color: C.insightBorder, pt: 0.5 } });
    slide.addText("💡 Catatan: Seluruh perhitungan pendapatan di atas merupakan hasil simulasi tarif iDRG terhadap data transaksi klaim RS target. Warna hijau menandakan surplus/kenaikan tarif, sedangkan warna merah menandakan defisit/penurunan.", {
      x: 0.50, y: H - 0.70, w: W - 1.0, h: 0.45, fontSize: 6.5, color: C.slate, valign: "middle"
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE: PETA SEBARAN RUMAH SAKIT
  ══════════════════════════════════════════════════════════════ */
  function buildMapSlide(pptx, appState) {
    var target = appState.target || {};
    var data = appState.data;
    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    var hospCount = (data.hospitals || []).length;
    addSlideHeader(slide, "Peta Interaktif Sebaran Rumah Sakit — " + (target.name || "Regional"),
      "Sebaran geografis fasilitas kesehatan di wilayah terpilih (" + hospCount + " RS Terdata)", appState.dateStr);

    if (appState.mapImageData) {
      slide.addImage({
        data: appState.mapImageData,
        x: 0.35, y: 0.78, w: W - 0.70, h: H - 0.95
      });
    } else {
      var rows = [
        [hCell("No", C.tealL), hCell("Nama Rumah Sakit", C.tealL, { align: "left" }), hCell("Kab / Kota", C.tealL), hCell("Provinsi", C.tealL), hCell("Kelas", C.tealL), hCell("Kasus Eksisting", C.tealL)]
      ];
      (data.hospitals || []).slice(0, 16).forEach(function (h, idx) {
        var bg = idx % 2 === 0 ? C.bgray : C.white;
        var k = (h.total && h.total[appState.CASES]) || 0;
        rows.push([
          dCell(String(idx + 1), { fill: { color: bg } }),
          dCell(h.name, { fill: { color: bg }, align: "left", bold: true }),
          dCell(h.city || "−", { fill: { color: bg } }),
          dCell(h.province || "−", { fill: { color: bg } }),
          dCell(h.class || "−", { fill: { color: bg } }),
          dCell(num(k), { fill: { color: bg }, align: "right", bold: true })
        ]);
      });
      slide.addTable(rows, {
        x: 0.35, y: 0.85, w: W - 0.70,
        border: { pt: 0.5, color: C.lgray },
        colW: [0.6, 4.5, 2.5, 2.5, 1.0, 1.55],
        margin: [0.04, 0.04, 0.04, 0.04]
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 3: KASUS EKSISTING PER LAYANAN RS TARGET
  ══════════════════════════════════════════════════════════════ */
  function buildExistingSlide(pptx, appState) {
    var target = appState.target || {};
    var data = appState.data, CASES = appState.CASES, INA = appState.INA, IDRG = appState.IDRG;
    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    addSlideHeader(slide, "Kasus Eksisting Per Layanan — " + (target.name || "RS Target"),
      "Matriks 24 layanan rumah sakit dengan rincian volume kasus, INA-CBG, iDRG, dan tingkat keparahan", appState.dateStr);

    var rankedServices = (data.services || [])
      .map(function (svc) {
        var tSvc = target.services && target.services[svc];
        var tot = (tSvc && tSvc.total) || [0,0,0];
        return { service: svc, total: tot, competency: getCompetency(target, svc) };
      })
      .sort(function (a, b) { return (b.total[CASES] || 0) - (a.total[CASES] || 0); });

    var h1 = [
      hCell("No", C.tealL, { rowspan: 2 }),
      hCell("Layanan RS", C.tealL, { rowspan: 2, align: "left" }),
      hCell("Komp", C.tealL, { rowspan: 2 }),
      hCell("Total Kasus", C.teal, { rowspan: 2 }),
      hCell("% Share", C.teal, { rowspan: 2 }),
      hCell("INA-CBG (Rp M)", C.teal, { rowspan: 2 }),
      hCell("iDRG (Rp M)", C.teal, { rowspan: 2 }),
      hCell("Dasar", "0e7490", { colspan: 2 }),
      hCell("Madya", "0e7490", { colspan: 2 }),
      hCell("Utama", "0e7490", { colspan: 2 }),
      hCell("Paripurna", "0e7490", { colspan: 2 })
    ];

    var h2 = [
      hCell("Kasus", "0284c7"), hCell("Rp M", "0284c7"),
      hCell("Kasus", "0284c7"), hCell("Rp M", "0284c7"),
      hCell("Kasus", "0284c7"), hCell("Rp M", "0284c7"),
      hCell("Kasus", "0284c7"), hCell("Rp M", "0284c7")
    ];

    var tTotCases = (target.total && target.total[CASES]) || 1;
    var rows = [h1, h2];

    rankedServices.slice(0, 18).forEach(function (item, idx) {
      var svc = item.service;
      var tSvc = target.services && target.services[svc];
      var tot = item.total;
      var k = tot[CASES] || 0;
      var ina = tot[INA] || 0;
      var idrg = tot[IDRG] || 0;
      var bg = idx % 2 === 0 ? C.bgray : C.white;

      var row = [
        dCell(String(idx + 1), { fill: { color: bg } }),
        dCell(svc, { fill: { color: bg }, align: "left", bold: true }),
        dCell(shortLevelName(item.competency), { fill: { color: bg } }),
        dCell(num(k), { fill: { color: bg }, align: "right", bold: true }),
        dCell(pct(k / tTotCases), { fill: { color: bg }, align: "right" }),
        dCell(moneyM(ina), { fill: { color: bg }, align: "right" }),
        dCell(moneyM(idrg), { fill: { color: bg }, align: "right", bold: true })
      ];

      [1, 2, 3, 4].forEach(function (lvl) {
        var sm = severityMetric(tSvc, lvl);
        row.push(dCell(sm[CASES] ? num(sm[CASES]) : "−", { fill: { color: bg }, align: "right", fontSize: 6.5 }));
        row.push(dCell(sm[IDRG] ? (sm[IDRG] / 1e9).toFixed(2) : "−", { fill: { color: bg }, align: "right", fontSize: 6.5 }));
      });

      rows.push(row);
    });

    slide.addTable(rows, {
      x: 0.30, y: 0.78, w: W - 0.60,
      border: { pt: 0.5, color: C.lgray },
      colW: [0.35, 2.3, 0.55, 0.95, 0.75, 1.1, 1.1, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72],
      margin: [0.03, 0.03, 0.03, 0.03]
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 4: POTENSI PASAR & KARAKTERISTIK REGIONAL
  ══════════════════════════════════════════════════════════════ */
  function buildRegionalSlide(pptx, appState) {
    var data = appState.data, CASES = appState.CASES, INA = appState.INA, IDRG = appState.IDRG;
    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    var rTotal = data.regional.total || [0,0,0];
    addSlideHeader(slide, "Potensi Pasar & Karakteristik Kasus Regional",
      "Analisis volume klaim regional, sebaran tingkat keparahan, dan proporsi kelas rumah sakit", appState.dateStr);

    var kpis = [
      { lbl: "Total Kasus Regional", val: num(rTotal[CASES]), color: C.teal, sub: (data.hospitals || []).length + " RS terdata" },
      { lbl: "Pendapatan INA-CBG Regional", val: money(rTotal[INA]), color: C.amberL, sub: "Total pasar regional" },
      { lbl: "Pendapatan iDRG Regional", val: money(rTotal[IDRG]), color: C.emerald, sub: "Nilai simulasi iDRG" },
      { lbl: "Layanan Aktif", val: (data.services || []).length + " Layanan", color: C.purple, sub: "Seluruh bidang layanan" }
    ];
    addKpiStrip(slide, kpis, 0.76, 0.68);

    // Left Table: Severity breakdown regional
    var sRows = [
      [hCell("Strata Keparahan", C.tealL), hCell("Kasus Regional", C.tealL), hCell("% Share", C.tealL), hCell("Nilai iDRG (Rp M)", C.tealL)]
    ];
    [1, 2, 3, 4].forEach(function (lvl) {
      var sm = severityMetric(data.regional, lvl);
      var k = sm[CASES] || 0;
      var idrg = sm[IDRG] || 0;
      var pShare = rTotal[CASES] ? k / rTotal[CASES] : 0;
      sRows.push([
        dCell(levelName(lvl), { bold: true, align: "left" }),
        dCell(num(k), { align: "right" }),
        dCell(pct(pShare), { align: "right" }),
        dCell(moneyM(idrg), { align: "right", bold: true })
      ]);
    });
    slide.addTable(sRows, {
      x: 0.35, y: 1.58, w: 5.5,
      border: { pt: 0.5, color: C.lgray },
      colW: [1.8, 1.2, 1.0, 1.5],
      margin: [0.05, 0.05, 0.05, 0.05]
    });

    // Right Table: Top Services regional
    var svcRows = [
      [hCell("No", C.tealL), hCell("Layanan Regional Terbesar", C.tealL, { align: "left" }), hCell("Kasus", C.tealL), hCell("iDRG (Rp M)", C.tealL)]
    ];
    var rankedSvc = (data.services || []).map(function (s) {
      var st = (data.regional.services && data.regional.services[s] && data.regional.services[s].total) || [0,0,0];
      return { name: s, total: st };
    }).sort(function (a, b) { return (b.total[CASES] || 0) - (a.total[CASES] || 0); });

    rankedSvc.slice(0, 10).forEach(function (item, idx) {
      svcRows.push([
        dCell(String(idx + 1)),
        dCell(item.name, { align: "left", bold: true }),
        dCell(num(item.total[CASES]), { align: "right" }),
        dCell(moneyM(item.total[IDRG]), { align: "right", bold: true })
      ]);
    });

    slide.addTable(svcRows, {
      x: 6.1, y: 1.58, w: 6.85,
      border: { pt: 0.5, color: C.lgray },
      colW: [0.45, 3.4, 1.3, 1.7],
      margin: [0.04, 0.04, 0.04, 0.04]
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 5: ANALISIS ADDRESSABLE MARKET RS TARGET
  ══════════════════════════════════════════════════════════════ */
  function buildAddressableSlide(pptx, appState) {
    var target = appState.target || {};
    var data = appState.data, CASES = appState.CASES, IDRG = appState.IDRG;
    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    addSlideHeader(slide, "Analisis Addressable Market — " + (target.name || "RS Target"),
      "Potensi serapan kasus dan nilai klaim regional yang eligible dilayani berdasarkan strata kompetensi", appState.dateStr);

    var rows = [
      [
        hCell("No", C.tealL),
        hCell("Layanan RS", C.tealL, { align: "left" }),
        hCell("Komp Target", C.tealL),
        hCell("Kasus Reg. Eligible", C.tealL),
        hCell("Eksisting Eligible", C.tealL),
        hCell("External Pool Kasus", C.tealL),
        hCell("iDRG External (Rp M)", C.tealL),
        hCell("Kompetitor Setara/+", C.tealL)
      ]
    ];

    var totalExtKasus = 0, totalExtIdrg = 0, compCount = 0;

    (data.services || []).forEach(function (svc, idx) {
      var comp = getCompetency(target, svc);
      if (comp > 0) compCount++;
      var tSvc = target.services && target.services[svc];
      var rSvc = data.regional.services && data.regional.services[svc];

      var eligRegK = 0, eligRegIdrg = 0, eligEkK = 0;
      for (var l = 1; l <= Math.max(1, comp); l++) {
        var rsm = severityMetric(rSvc, l);
        var tsm = severityMetric(tSvc, l);
        eligRegK += rsm[CASES] || 0;
        eligRegIdrg += rsm[IDRG] || 0;
        eligEkK += tsm[CASES] || 0;
      }

      var extK = Math.max(0, eligRegK - eligEkK);
      var extIdrg = Math.max(0, eligRegIdrg - ((tSvc && tSvc.total && tSvc.total[IDRG]) || 0));
      totalExtKasus += extK;
      totalExtIdrg += extIdrg;

      var rivals = (data.hospitals || []).filter(function (h) {
        return h.code !== target.code && getCompetency(h, svc) >= comp;
      }).length;

      var bg = idx % 2 === 0 ? C.bgray : C.white;
      rows.push([
        dCell(String(idx + 1), { fill: { color: bg } }),
        dCell(svc, { fill: { color: bg }, align: "left", bold: true }),
        dCell(levelName(comp), { fill: { color: bg } }),
        dCell(num(eligRegK), { fill: { color: bg }, align: "right" }),
        dCell(num(eligEkK), { fill: { color: bg }, align: "right" }),
        dCell(num(extK), { fill: { color: bg }, align: "right", bold: true, color: "0369a1" }),
        dCell(moneyM(extIdrg), { fill: { color: bg }, align: "right", bold: true, color: "059669" }),
        dCell(String(rivals) + " RS", { fill: { color: bg }, align: "center" })
      ]);
    });

    var kpis = [
      { lbl: "Layanan Kompeten", val: compCount + " / 24", color: C.teal, sub: "Strata ≥ Dasar" },
      { lbl: "External Pool Kasus", val: num(totalExtKasus), color: C.blue, sub: "Peluang capture pasar" },
      { lbl: "Potensi Nilai iDRG External", val: money(totalExtIdrg), color: C.emerald, sub: "Nilai klaim yang bisa diserap" }
    ];
    addKpiStrip(slide, kpis, 0.76, 0.64);

    slide.addTable(rows.slice(0, 16), {
      x: 0.35, y: 1.48, w: W - 0.70,
      border: { pt: 0.5, color: C.lgray },
      colW: [0.45, 2.7, 1.2, 1.5, 1.5, 1.6, 1.8, 1.8],
      margin: [0.04, 0.04, 0.04, 0.04]
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 6: PERBANDINGAN RS TARGET VS RS LAIN REGIONAL
  ══════════════════════════════════════════════════════════════ */
  function buildComparisonSlide(pptx, appState) {
    var target = appState.target || {};
    var data = appState.data, CASES = appState.CASES, IDRG = appState.IDRG;
    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    addSlideHeader(slide, "Perbandingan RS Target vs RS Lain Regional — " + (target.name || "RS Target"),
      "Komparasi market share kasus dan nilai klaim per layanan", appState.dateStr);

    var rows = [
      [
        hCell("No", C.tealL, { rowspan: 2 }),
        hCell("Layanan RS", C.tealL, { rowspan: 2, align: "left" }),
        hCell("RS Target", C.teal, { colspan: 2 }),
        hCell("RS Pesaing / Regional Lain", "0e7490", { colspan: 2 }),
        hCell("Total Regional", "1e293b", { colspan: 2 }),
        hCell("Market Share (%)", C.tealD, { rowspan: 2 })
      ],
      [
        hCell("Kasus", C.teal), hCell("iDRG (Rp M)", C.teal),
        hCell("Kasus", "0e7490"), hCell("iDRG (Rp M)", "0e7490"),
        hCell("Kasus", "1e293b"), hCell("iDRG (Rp M)", "1e293b")
      ]
    ];

    (data.services || []).slice(0, 16).forEach(function (svc, idx) {
      var tSvc = (target.services && target.services[svc] && target.services[svc].total) || [0,0,0];
      var rSvc = (data.regional.services && data.regional.services[svc] && data.regional.services[svc].total) || [0,0,0];
      var tK = tSvc[CASES] || 0, tIdrg = tSvc[IDRG] || 0;
      var rK = rSvc[CASES] || 0, rIdrg = rSvc[IDRG] || 0;
      var oK = Math.max(0, rK - tK), oIdrg = Math.max(0, rIdrg - tIdrg);
      var ms = rK ? tK / rK : 0;
      var bg = idx % 2 === 0 ? C.bgray : C.white;

      rows.push([
        dCell(String(idx + 1), { fill: { color: bg } }),
        dCell(svc, { fill: { color: bg }, align: "left", bold: true }),
        dCell(num(tK), { fill: { color: bg }, align: "right", bold: true }),
        dCell(moneyM(tIdrg), { fill: { color: bg }, align: "right" }),
        dCell(num(oK), { fill: { color: bg }, align: "right" }),
        dCell(moneyM(oIdrg), { fill: { color: bg }, align: "right" }),
        dCell(num(rK), { fill: { color: bg }, align: "right", bold: true }),
        dCell(moneyM(rIdrg), { fill: { color: bg }, align: "right", bold: true }),
        dCell(pct(ms), { fill: { color: bg }, align: "right", bold: true, color: ms > 0.2 ? "059669" : "334155" })
      ]);
    });

    slide.addTable(rows, {
      x: 0.35, y: 0.80, w: W - 0.70,
      border: { pt: 0.5, color: C.lgray },
      colW: [0.45, 2.8, 1.2, 1.4, 1.2, 1.4, 1.2, 1.5, 1.4],
      margin: [0.04, 0.04, 0.04, 0.04]
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 7: DISTRIBUSI KASUS REGIONAL PER LAYANAN
  ══════════════════════════════════════════════════════════════ */
  function buildRegionalCasesSlide(pptx, appState) {
    var data = appState.data, CASES = appState.CASES, IDRG = appState.IDRG;
    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    addSlideHeader(slide, "Distribusi Kasus Pasar Regional per Layanan",
      "Rincian volume kasus dan nilai klaim regional per strata Dasar, Madya, Utama, dan Paripurna", appState.dateStr);

    var rows = [
      [
        hCell("No", C.tealL),
        hCell("Layanan RS", C.tealL, { align: "left" }),
        hCell("Dasar (K / Rp M)", "0e7490"),
        hCell("Madya (K / Rp M)", "0e7490"),
        hCell("Utama (K / Rp M)", "0e7490"),
        hCell("Paripurna (K / Rp M)", "0e7490"),
        hCell("Total Kasus", C.teal),
        hCell("Total iDRG (Rp M)", C.teal)
      ]
    ];

    (data.services || []).slice(0, 16).forEach(function (svc, idx) {
      var rSvc = data.regional.services && data.regional.services[svc];
      var tot = (rSvc && rSvc.total) || [0,0,0];
      var bg = idx % 2 === 0 ? C.bgray : C.white;

      function fmtLvl(l) {
        var m = severityMetric(rSvc, l);
        var k = m[CASES] || 0;
        var r = m[IDRG] || 0;
        if (!k && !r) return "−";
        return num(k) + " (" + (r / 1e9).toFixed(2) + ")";
      }

      rows.push([
        dCell(String(idx + 1), { fill: { color: bg } }),
        dCell(svc, { fill: { color: bg }, align: "left", bold: true }),
        dCell(fmtLvl(1), { fill: { color: bg }, align: "center", fontSize: 6.5 }),
        dCell(fmtLvl(2), { fill: { color: bg }, align: "center", fontSize: 6.5 }),
        dCell(fmtLvl(3), { fill: { color: bg }, align: "center", fontSize: 6.5 }),
        dCell(fmtLvl(4), { fill: { color: bg }, align: "center", fontSize: 6.5 }),
        dCell(num(tot[CASES]), { fill: { color: bg }, align: "right", bold: true }),
        dCell(moneyM(tot[IDRG]), { fill: { color: bg }, align: "right", bold: true })
      ]);
    });

    slide.addTable(rows, {
      x: 0.35, y: 0.80, w: W - 0.70,
      border: { pt: 0.5, color: C.lgray },
      colW: [0.45, 2.7, 1.8, 1.8, 1.8, 1.8, 1.2, 1.4],
      margin: [0.04, 0.04, 0.04, 0.04]
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 8: PROFIL KAPASITAS & AGREGAT REGIONAL
  ══════════════════════════════════════════════════════════════ */
  function buildRegionalProfileSlide(pptx, appState) {
    var data = appState.data, CASES = appState.CASES, IDRG = appState.IDRG;
    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    addSlideHeader(slide, "Profil Kapasitas & Agregat Pasar Regional",
      "Daftar rumah sakit terbesar dan sebaran profil keparahan regional", appState.dateStr);

    var topHospitals = (data.hospitals || []).slice().sort(function (a, b) {
      return ((b.total && b.total[CASES]) || 0) - ((a.total && a.total[CASES]) || 0);
    }).slice(0, 10);

    var rows = [
      [
        hCell("Rank", C.tealL),
        hCell("Nama Rumah Sakit", C.tealL, { align: "left" }),
        hCell("Kota / Kab", C.tealL),
        hCell("Kelas", C.tealL),
        hCell("Total Kasus", C.tealL),
        hCell("Nilai iDRG (Rp M)", C.tealL)
      ]
    ];

    topHospitals.forEach(function (h, idx) {
      var tot = h.total || [0,0,0];
      var bg = idx % 2 === 0 ? C.bgray : C.white;
      rows.push([
        dCell(String(idx + 1), { fill: { color: bg } }),
        dCell(h.name || "RS", { fill: { color: bg }, align: "left", bold: true }),
        dCell(h.city || "−", { fill: { color: bg } }),
        dCell(h.class || "−", { fill: { color: bg } }),
        dCell(num(tot[CASES]), { fill: { color: bg }, align: "right", bold: true }),
        dCell(moneyM(tot[IDRG]), { fill: { color: bg }, align: "right", bold: true })
      ]);
    });

    slide.addTable(rows, {
      x: 0.35, y: 0.85, w: W - 0.70,
      border: { pt: 0.5, color: C.lgray },
      colW: [0.6, 5.0, 2.4, 0.8, 1.8, 2.0],
      margin: [0.05, 0.05, 0.05, 0.05]
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 9: PROFIL JARINGAN RS MUHAMMADIYAH / AISYIYAH (Kondisional)
  ══════════════════════════════════════════════════════════════ */
  function buildMuhammadiyahSlide(pptx, appState) {
    var data = appState.data, CASES = appState.CASES, INA = appState.INA, IDRG = appState.IDRG;
    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    var isMhk = appState.helpers && appState.helpers.isMuhammadiyahHospital;
    var mhkHospitals = (data.hospitals || []).filter(function (h) {
      return isMhk ? isMhk(h) : (h.name && (h.name.toUpperCase().includes("MUHAMMADIYAH") || h.name.toUpperCase().includes("AISYIYAH") || h.name.toUpperCase().includes("PKU")));
    });

    addSlideHeader(slide, "Profil Eksekutif Jaringan RS Muhammadiyah & 'Aisyiyah",
      "Agregat data klaim dan kontribusi jaringan rumah sakit Muhammadiyah secara nasional", appState.dateStr);

    var totK = 0, totIna = 0, totIdrg = 0;
    mhkHospitals.forEach(function (h) {
      totK += (h.total && h.total[CASES]) || 0;
      totIna += (h.total && h.total[INA]) || 0;
      totIdrg += (h.total && h.total[IDRG]) || 0;
    });

    var kpis = [
      { lbl: "Total RS Jaringan Terdata", val: mhkHospitals.length + " RS", color: C.teal, sub: "Persyarikatan Muhammadiyah" },
      { lbl: "Total Kasus Jaringan", val: num(totK), color: C.blue, sub: "Volume klaim terdata" },
      { lbl: "Total Pendapatan INA-CBG", val: money(totIna), color: C.amberL, sub: "Basis tarif INA-CBG" },
      { lbl: "Total Pendapatan iDRG", val: money(totIdrg), color: C.emerald, sub: "Hasil simulasi iDRG" }
    ];
    addKpiStrip(slide, kpis, 0.76, 0.68);

    var topMhk = mhkHospitals.slice().sort(function (a, b) {
      return ((b.total && b.total[CASES]) || 0) - ((a.total && a.total[CASES]) || 0);
    }).slice(0, 10);

    var rows = [
      [
        hCell("No", C.tealL),
        hCell("Nama RS Muhammadiyah / 'Aisyiyah", C.tealL, { align: "left" }),
        hCell("Kota / Kab", C.tealL),
        hCell("Provinsi", C.tealL),
        hCell("Kasus", C.tealL),
        hCell("iDRG (Rp M)", C.tealL)
      ]
    ];

    topMhk.forEach(function (h, idx) {
      var tot = h.total || [0,0,0];
      var bg = idx % 2 === 0 ? C.bgray : C.white;
      rows.push([
        dCell(String(idx + 1), { fill: { color: bg } }),
        dCell(h.name, { fill: { color: bg }, align: "left", bold: true }),
        dCell(h.city || "−", { fill: { color: bg } }),
        dCell(h.province || "−", { fill: { color: bg } }),
        dCell(num(tot[CASES]), { fill: { color: bg }, align: "right", bold: true }),
        dCell(moneyM(tot[IDRG]), { fill: { color: bg }, align: "right", bold: true })
      ]);
    });

    slide.addTable(rows, {
      x: 0.35, y: 1.58, w: W - 0.70,
      border: { pt: 0.5, color: C.lgray },
      colW: [0.5, 4.5, 2.2, 2.2, 1.5, 1.7],
      margin: [0.04, 0.04, 0.04, 0.04]
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 10-15: DATA MIRRORING NASIONAL UJI COBA iDRG (6 Slides)
  ══════════════════════════════════════════════════════════════ */
  function buildNationalMirroringSlides(pptx, appState) {
    var metrics = appState.nationalMetrics;
    if (!metrics || !metrics.result) return;

    var res = metrics.result;
    var classes = ["A", "B", "C", "D"];

    /* ── 10.1: JENIS RAWAT (RAJAL VS RANAP) ── */
    var slide1 = pptx.addSlide();
    slide1.background = { color: C.bgray };
    addSlideHeader(slide1, "Data Klaim iDRG Menurut Jenis Perawatan (Rawat Inap vs Rawat Jalan)",
      "Proporsi volume klaim dan belanja tarif klaim antara Rawat Inap dan Rawat Jalan", appState.dateStr);

    var kpis1 = [
      { lbl: "Total Kasus Terdata", val: num(metrics.totalKasus), color: C.dark, sub: metrics.hospitalCount + " RS Terpilih" },
      { lbl: "Rawat Jalan (Rajal)", val: pct(metrics.pctRajal / 100), color: C.teal, sub: num(metrics.rjCases) + " kasus" },
      { lbl: "Rawat Inap (Ranap)", val: pct(metrics.pctRanap / 100), color: C.amberL, sub: num(metrics.riCases) + " kasus" },
      { lbl: "Total Belanja iDRG", val: money(metrics.totalIdrg), color: C.emerald, sub: "Hasil uji coba" }
    ];
    addKpiStrip(slide1, kpis1, 0.76, 0.68);

    var rRows1 = [
      [
        hCell("Kelas RS", C.tealL),
        hCell("Kasus Ranap", "0e7490"),
        hCell("INA Ranap (Rp M)", "0e7490"),
        hCell("iDRG Ranap (Rp M)", "0e7490"),
        hCell("Kasus Rajal", C.teal),
        hCell("INA Rajal (Rp M)", C.teal),
        hCell("iDRG Rajal (Rp M)", C.teal),
        hCell("Total Kasus", "1e293b"),
        hCell("Total iDRG (Rp M)", "1e293b")
      ]
    ];

    classes.forEach(function (cls) {
      var ri = res.RI.total[cls] || [0,0,0,0,0];
      var rj = res.RJ.total[cls] || [0,0,0,0,0];
      var grd = res.grand[cls] || [0,0,0,0,0];

      rRows1.push([
        dCell("Kelas " + cls, { bold: true }),
        dCell(num(ri[0]), { align: "right" }),
        dCell(moneyM(ri[1]), { align: "right" }),
        dCell(moneyM(ri[2]), { align: "right", bold: true }),
        dCell(num(rj[0]), { align: "right" }),
        dCell(moneyM(rj[1]), { align: "right" }),
        dCell(moneyM(rj[2]), { align: "right", bold: true }),
        dCell(num(grd[0]), { align: "right", bold: true }),
        dCell(moneyM(grd[2]), { align: "right", bold: true })
      ]);
    });

    slide1.addTable(rRows1, {
      x: 0.35, y: 1.58, w: W - 0.70,
      border: { pt: 0.5, color: C.lgray },
      colW: [1.2, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.6],
      margin: [0.05, 0.05, 0.05, 0.05]
    });

    /* ── 10.2: SPENDING PER KELAS RS ── */
    var slide2 = pptx.addSlide();
    slide2.background = { color: C.bgray };
    addSlideHeader(slide2, "Simulasi Spending iDRG Nasional Berdasarkan Kelas Rumah Sakit",
      "Perbandingan total pendapatan klaim INA-CBG vs iDRG per kelas RS", appState.dateStr);

    var rRows2 = [
      [
        hCell("Kelas RS", C.tealL),
        hCell("Jumlah RS", C.tealL),
        hCell("Total Kasus", C.tealL),
        hCell("INA-CBG (Rp M)", C.tealL),
        hCell("iDRG (Rp M)", C.tealL),
        hCell("Selisih (+/- Rp M)", C.tealL),
        hCell("% Kenaikan / Penurunan", C.tealL)
      ]
    ];

    classes.forEach(function (cls) {
      var grd = res.grand[cls] || [0,0,0,0,0];
      var diff = grd[3] || 0;
      var pDiff = grd[4] || 0;
      var cColor = diff >= 0 ? "15803d" : "b91c1c";

      rRows2.push([
        dCell("Rumah Sakit Kelas " + cls, { bold: true, align: "left" }),
        dCell(String(metrics.classCounts[cls] || 0) + " RS", { align: "center" }),
        dCell(num(grd[0]), { align: "right" }),
        dCell(moneyM(grd[1]), { align: "right" }),
        dCell(moneyM(grd[2]), { align: "right", bold: true }),
        dCell(signedMoneyM(diff), { align: "right", bold: true, color: cColor }),
        dCell(signedPct(pDiff), { align: "right", bold: true, color: cColor })
      ]);
    });

    slide2.addTable(rRows2, {
      x: 0.35, y: 1.10, w: W - 0.70,
      border: { pt: 0.5, color: C.lgray },
      colW: [2.5, 1.3, 1.8, 2.0, 2.0, 1.7, 1.35],
      margin: [0.06, 0.06, 0.06, 0.06]
    });

    /* ── 10.3: SEVERITY KEPARAHAN KLAIM NASIONAL ── */
    var slide3 = pptx.addSlide();
    slide3.background = { color: C.bgray };
    addSlideHeader(slide3, "Distribusi Kasus & Spending Berdasarkan Tingkat Keparahan (Severity)",
      "Rincian klaim nasional untuk tingkat keparahan Dasar, Madya, Utama, dan Paripurna", appState.dateStr);

    var rRows3 = [
      [
        hCell("Tingkat Keparahan", C.tealL),
        hCell("Kasus Ranap", "0e7490"),
        hCell("iDRG Ranap (Rp M)", "0e7490"),
        hCell("Kasus Rajal", C.teal),
        hCell("iDRG Rajal (Rp M)", C.teal),
        hCell("Total Kasus", "1e293b"),
        hCell("Total iDRG (Rp M)", "1e293b")
      ]
    ];

    [1, 2, 3, 4].forEach(function (lvl) {
      var ri = res.RI[lvl].Total || [0,0,0,0,0];
      var rj = res.RJ[lvl].Total || [0,0,0,0,0];
      var totK = ri[0] + rj[0];
      var totIdrg = ri[2] + rj[2];

      rRows3.push([
        dCell(levelName(lvl), { bold: true, align: "left" }),
        dCell(num(ri[0]), { align: "right" }),
        dCell(moneyM(ri[2]), { align: "right" }),
        dCell(num(rj[0]), { align: "right" }),
        dCell(moneyM(rj[2]), { align: "right" }),
        dCell(num(totK), { align: "right", bold: true }),
        dCell(moneyM(totIdrg), { align: "right", bold: true })
      ]);
    });

    slide3.addTable(rRows3, {
      x: 0.35, y: 1.10, w: W - 0.70,
      border: { pt: 0.5, color: C.lgray },
      colW: [2.2, 1.8, 1.8, 1.8, 1.8, 1.6, 1.65],
      margin: [0.06, 0.06, 0.06, 0.06]
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 16: PEMETAAN KOMPETENSI ICD
  ══════════════════════════════════════════════════════════════ */
  function buildIcdCompetencySlide(pptx, appState) {
    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    addSlideHeader(slide, "Pemetaan Strata Kompetensi ICD terhadap Layanan Rumah Sakit",
      "Standarisasi penjenjangan layanan kesehatan berdasarkan kompleksitas diagnosis dan tindakan", appState.dateStr);

    var rows = [
      [
        hCell("Tingkat Strata", C.tealL),
        hCell("Definisi & Karakteristik Layanan", C.tealL, { align: "left" }),
        hCell("Kemampuan Penanganan ICD", C.tealL, { align: "left" }),
        hCell("Contoh Kategori Kasus", C.tealL, { align: "left" })
      ],
      [
        dCell("Level 1: Dasar", { bold: true, fill: { color: "f0fdfa" } }),
        dCell("Penanganan kasus medis dasar/umum tanpa komplikasi berat.", { align: "left" }),
        dCell("ICD diagnosis primer standar dan tindakan non-invasif dasar.", { align: "left" }),
        dCell("Pelayanan rawat jalan umum, persalinan normal, penanganan infeksi umum.", { align: "left" })
      ],
      [
        dCell("Level 2: Madya", { bold: true, fill: { color: "fefce8" } }),
        dCell("Penanganan kasus medis spesialistik dengan komplikasi sedang.", { align: "left" }),
        dCell("ICD dengan kode komorbiditas ringan-sedang dan bedah minor-moderat.", { align: "left" }),
        dCell("Spesialis dasar 4 besar, bedah apendiks, rawat inap penyakit dalam.", { align: "left" })
      ],
      [
        dCell("Level 3: Utama", { bold: true, fill: { color: "fff7ed" } }),
        dCell("Penanganan kasus subspesialistik kompleks dan tindakan operatif lanjut.", { align: "left" }),
        dCell("ICD dengan komplikasi berat (Major CC) dan prosedur bedah mayor.", { align: "left" }),
        dCell("Cath lab jantung dasar, bedah onkologi, ICU lanjutan, hemodialisis.", { align: "left" })
      ],
      [
        dCell("Level 4: Paripurna", { bold: true, fill: { color: "fdf4ff" } }),
        dCell("Pusat rujukan tertinggi dengan teknologi mutakhir dan subspesialistik komprehensif.", { align: "left" }),
        dCell("ICD tingkat keparahan tertinggi (Extreme CC) dan prosedur intervensi berisiko tinggi.", { align: "left" }),
        dCell("Operasi bedah jantung terbuka, transplantasi organ, onkologi radiasi, bedah saraf kompleks.", { align: "left" })
      ]
    ];

    slide.addTable(rows, {
      x: 0.35, y: 1.05, w: W - 0.70,
      border: { pt: 0.5, color: C.lgray },
      colW: [2.0, 3.4, 3.4, 3.85],
      margin: [0.08, 0.08, 0.08, 0.08]
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 17: REKAPITULASI SELURUH LAYANAN (MASTER RECAP)
  ══════════════════════════════════════════════════════════════ */
  function buildRecapSlide(pptx, appState) {
    var data = appState.data, state = appState.state, target = appState.target || {};
    var services = appState.services || [];
    var CASES = appState.CASES, IDRG = appState.IDRG;

    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    addSlideHeader(slide, "Rekap Simulasi Seluruh Layanan — " + (target.name || "RS Target"),
      "Ringkasan rentang dampak skenario (kasus & Rp M) terhadap pendapatan eksisting", appState.dateStr);

    var tHosp = data.hospitals && data.hospitals.find(function (h) { return h.code === target.code; });
    var tTotal = (tHosp && tHosp.total) || [0,0,0];
    var rTotal = (data.regional && data.regional.total) || [0,0,0];
    var msAll = rTotal[CASES] ? tTotal[CASES] / rTotal[CASES] : 0;

    var kpis = [
      { lbl: "Total Kasus RS Target", val: num(tTotal[CASES]), color: C.teal },
      { lbl: "Total Kasus Regional", val: num(rTotal[CASES]), color: C.green },
      { lbl: "Market Share Keseluruhan", val: pct(msAll), color: "f59e0b" },
      { lbl: "Jumlah Layanan Terdata", val: services.length + " Layanan", color: "6d28d9" }
    ];
    addKpiStrip(slide, kpis, 0.74, 0.52);

    var rows = [
      [
        hCell("No", C.tealL, { rowspan: 2 }),
        hCell("Layanan", C.tealL, { rowspan: 2, align: "left" }),
        hCell("Komp", C.tealL, { rowspan: 2 }),
        hCell("Dampak per Tingkat Kompetensi (Rentang Kasus & Rp M)", "16a085", { colspan: 4 }),
        hCell("Net +/- Pasca iDRG & RBKP", "0e7490", { colspan: 3 }),
        hCell("Eksisting INA (Rp M)", "1e40af", { rowspan: 2 }),
        hCell("% Kenaikan thd INA", "1e40af", { rowspan: 2 })
      ],
      [
        hCell("Paripurna", "20b2aa"),
        hCell("Utama", "20b2aa"),
        hCell("Madya", "20b2aa"),
        hCell("Dasar", "20b2aa"),
        hCell("+/- Kasus", "0284c7"),
        hCell("% thd Eks.", "0284c7"),
        hCell("+/- Net Rp (M)", "0284c7")
      ]
    ];

    services.slice(0, 16).forEach(function (service, idx) {
      var tHospSvc = tHosp && tHosp.services && tHosp.services[service];
      var svcData = data.regional && data.regional.services && data.regional.services[service];
      var tSvcTotal = (tHospSvc && tHospSvc.total) || [0,0,0];

      var tKasus = tSvcTotal[CASES] || 0;
      var existingIna = tSvcTotal[INA] || 0;
      var existingIdrg = tSvcTotal[IDRG] || 0;
      var targetCompetency = tHospSvc ? (tHospSvc.competency || 0) : 0;
      var rules = getLevelRules(targetCompetency, service);

      var baseTambahan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };
      var basePengurangan = { 1: [0,0], 2: [0,0], 3: [0,0], 4: [0,0] };

      rules.tambah.forEach(function (lvl) {
        var rM = severityMetric(svcData, lvl), tM = severityMetric(tHospSvc, lvl);
        baseTambahan[lvl][0] = Math.max(0, (rM[CASES] || 0) - (tM[CASES] || 0));
        baseTambahan[lvl][1] = Math.max(0, (rM[IDRG] || 0) - (tM[IDRG] || 0));
      });
      rules.kurang.forEach(function (lvl) {
        var tM = severityMetric(tHospSvc, lvl);
        basePengurangan[lvl][0] = tM[CASES] || 0;
        basePengurangan[lvl][1] = tM[IDRG] || 0;
      });

      var scenarios = (state && state.serviceScenarios && state.serviceScenarios[service]) || [];

      var allNetK = [], allNetRp = [], allPasca = [];
      scenarios.forEach(function (scn) {
        var totalNetK = 0, totalTambahRp = 0, totalKurangRp = 0;
        [4, 3, 2, 1].forEach(function (lvl) {
          var k = 0, rp = 0;
          if (rules.tambah.indexOf(lvl) !== -1 && scn.hasOwnProperty("tambah_" + lvl)) {
            var pp = scn["tambah_" + lvl] / 100;
            k = (baseTambahan[lvl][0] || 0) * pp;
            rp = (baseTambahan[lvl][1] || 0) * pp;
            totalTambahRp += rp;
          } else if (rules.kurang.indexOf(lvl) !== -1 && scn.hasOwnProperty("kurang_" + lvl)) {
            var pk = scn["kurang_" + lvl] / 100;
            k = -((basePengurangan[lvl][0] || 0) * pk);
            rp = -((basePengurangan[lvl][1] || 0) * pk);
            totalKurangRp += ((basePengurangan[lvl][1] || 0) * pk);
          }
          totalNetK += k;
        });
        var sisa = existingIdrg - totalKurangRp;
        var pasca = sisa + totalTambahRp;
        allNetK.push(totalNetK);
        allNetRp.push(totalTambahRp - totalKurangRp);
        allPasca.push(pasca);
      });

      if (allNetK.length === 0) { allNetK.push(0); allNetRp.push(0); allPasca.push(tKasus); }
      var minNetK = Math.min.apply(null, allNetK);
      var maxNetK = Math.max.apply(null, allNetK);
      var minNetRp = Math.min.apply(null, allNetRp);
      var maxNetRp = Math.max.apply(null, allNetRp);
      var minPasca = Math.min.apply(null, allPasca);
      var maxPasca = Math.max.apply(null, allPasca);

      var minPctK = tKasus ? minNetK / tKasus : 0;
      var maxPctK = tKasus ? maxNetK / tKasus : 0;
      var minPctRp = existingIna ? (minPasca - existingIna) / existingIna : 0;
      var maxPctRp = existingIna ? (maxPasca - existingIna) / existingIna : 0;

      var bg = idx % 2 === 0 ? C.bgray : C.white;
      function fmtRange(minV, maxV, isRp) {
        if (minV === 0 && maxV === 0) return "−";
        var sMin = (minV >= 0 ? "+" : "−") + (isRp ? (Math.abs(minV) / 1e9).toFixed(2) + " M" : num(Math.abs(minV)));
        var sMax = (maxV >= 0 ? "+" : "−") + (isRp ? (Math.abs(maxV) / 1e9).toFixed(2) + " M" : num(Math.abs(maxV)));
        return minV === maxV ? sMin : sMin + " s.d " + sMax;
      }

      rows.push([
        dCell(String(idx + 1), { fill: { color: bg } }),
        dCell(service, { fill: { color: bg }, align: "left", bold: true }),
        dCell(shortLevelName(targetCompetency), { fill: { color: bg } }),
        dCell(rules.tambah.indexOf(4) !== -1 ? "Tersedia" : "−", { fill: { color: bg }, fontSize: 8.5 }),
        dCell(rules.tambah.indexOf(3) !== -1 ? "Tersedia" : "−", { fill: { color: bg }, fontSize: 8.5 }),
        dCell(rules.tambah.indexOf(2) !== -1 ? "Tersedia" : "−", { fill: { color: bg }, fontSize: 8.5 }),
        dCell(rules.tambah.indexOf(1) !== -1 ? "Tersedia" : "−", { fill: { color: bg }, fontSize: 8.5 }),
        dCell(fmtRange(minNetK, maxNetK, false), { fill: { color: bg }, align: "right", fontSize: 8.5 }),
        dCell(pct(minPctK) + " s.d " + pct(maxPctK), { fill: { color: bg }, align: "right", fontSize: 8.5 }),
        dCell(fmtRange(minNetRp, maxNetRp, true), { fill: { color: bg }, align: "right", bold: true, fontSize: 8.5, color: maxNetRp >= 0 ? "15803d" : "b91c1c" }),
        dCell(moneyM(existingIna), { fill: { color: bg }, align: "right", fontSize: 8.5 }),
        dCell(pct(minPctRp) + " s.d " + pct(maxPctRp), { fill: { color: bg }, align: "right", bold: true, fontSize: 8.5, color: maxPctRp >= 0 ? "15803d" : "b91c1c" })
      ]);
    });

    slide.addTable(rows, {
      x: 0.30, y: 1.30, w: W - 0.60,
      border: { pt: 0.5, color: C.lgray },
      colW: [0.35, 2.3, 0.55, 0.9, 0.9, 0.9, 0.9, 1.25, 1.25, 1.45, 1.0, 1.0],
      margin: [0.03, 0.03, 0.03, 0.03],
      autoPage: true, autoPageRepeatHeader: true, autoPageLineWeight: 0
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 17B: REKAPITULASI SKENARIO PALING LOGIS SELURUH LAYANAN
  ══════════════════════════════════════════════════════════════ */
  function buildLogicalRecapSlide(pptx, appState) {
    var data = appState.data, state = appState.state, target = appState.target || {};
    var services = appState.services || [];
    var CASES = appState.CASES, INA = appState.INA !== undefined ? appState.INA : 1, IDRG = appState.IDRG;

    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    addSlideHeader(slide, "Rekap Skenario Paling Logis — " + (target.name || "RS Target"),
      "Skenario terpilih per layanan yang paling rasional (kasus pasca penambahan tidak melampaui kapasitas eksisting awal)", appState.dateStr);

    var tHosp = data.hospitals && data.hospitals.find(function (h) { return h.code === target.code; });
    var tTotal = (tHosp && tHosp.total) || [0,0,0];

    var grandEksKasus = 0, grandKurangKasus = 0, grandTambahKasus = 0, grandNetKasus = 0, grandPascaKasus = 0;
    var grandEksIna = 0, grandKurangRp = 0, grandTambahRp = 0, grandNetRp = 0, grandPascaRp = 0;

    var rows = [
      [
        hCell("No", C.tealL),
        hCell("Layanan", C.tealL, { align: "left" }),
        hCell("Komp", C.tealL),
        hCell("Skenario", "0284c7"),
        hCell("Eksisting", "334155"),
        hCell("Pengurangan (-)", "e11d48"),
        hCell("Sisa Eksisting", "0891b2"),
        hCell("Tambahan (+)", "16a34a"),
        hCell("Pasca Kasus", "b45309"),
        hCell("Pasca Rp (M)", "b45309"),
        hCell("Net Kasus", "475569"),
        hCell("Net Rp (M)", "475569"),
        hCell("% vs INA", "475569")
      ]
    ];

    services.slice(0, 16).forEach(function (service, idx) {
      var tHospSvc = tHosp && tHosp.services && tHosp.services[service];
      var svcData = data.regional && data.regional.services && data.regional.services[service];
      var tSvcTotal = (tHospSvc && tHospSvc.total) || [0,0,0];

      var tKasus = tSvcTotal[CASES] || 0;
      var existingIna = tSvcTotal[INA] || 0;
      var existingIdrg = tSvcTotal[IDRG] || 0;
      var targetCompetency = tHospSvc ? (tHospSvc.competency || 0) : 0;
      if (!state.serviceScenarios) state.serviceScenarios = {};
      if (!state.serviceScenarios[service] || state.serviceScenarios[service].length === 0) {
        var defaultLowLevels = [1, 2, 3, 4, 5, 10];
        var scns = [];
        var rules = getLevelRules(targetCompetency, service);
        for (var si = 0; si < 6; si++) {
          var scn = {};
          rules.tambah.forEach(function (lvl) {
            if (lvl === 1 || lvl === 2) {
              scn["tambah_" + lvl] = defaultLowLevels[si];
            } else {
              var lvlComp = (data.hospitals || []).filter(function (h) {
                return h.code !== target.code && getCompetency(h, service) >= lvl;
              }).length;
              var base = lvlComp > 0 ? Math.min(50, 100 / (lvlComp + 1)) : 50;
              scn["tambah_" + lvl] = parseFloat(Math.min(100, Math.max(0, base + si * 2)).toFixed(1));
            }
          });
          rules.kurang.forEach(function (lvl) {
            scn["kurang_" + lvl] = (lvl > targetCompetency || lvl === 4) ? 100 : 90;
          });
          scns.push(scn);
        }
        state.serviceScenarios[service] = scns;
      }
      
      var calcResult = window.computeServiceScenarios(
        service, target, data, state, CASES, INA, IDRG, severityMetric, getLevelRules
      );
      
      var chosenObj = calcResult.chosen || calcResult.scnEvals[0];
      var chosen = {
        index: chosenObj.idx + 1,
        tk: chosenObj.totalTambahKasus,
        trp: chosenObj.totalTambahRp,
        kk: chosenObj.totalKurangKasus,
        krp: chosenObj.totalKurangRp,
        sisaK: chosenObj.sisaKasus,
        sisaRp: chosenObj.sisaIdrg,
        pascaK: chosenObj.pascaKasus,
        pascaRp: chosenObj.pascaRp,
        netK: chosenObj.netKasus,
        netRp: chosenObj.netRp,
        isSafe: chosenObj.isSafe
      };

      grandEksKasus += tKasus;
      grandEksIna += existingIna;
      grandKurangKasus += chosen.kk;
      grandKurangRp += chosen.krp;
      grandTambahKasus += chosen.tk;
      grandTambahRp += chosen.trp;
      grandNetKasus += chosen.netK;
      grandNetRp += chosen.netRp;
      grandPascaKasus += chosen.pascaK;
      grandPascaRp += chosen.pascaRp;

      var pctPascaIna = existingIna ? ((chosen.pascaRp - existingIna) / existingIna) : 0;
      var bg = idx % 2 === 0 ? C.bgray : C.white;
      var nc = chosen.netRp >= 0 ? "15803d" : "b91c1c";

      rows.push([
        dCell(String(idx + 1), { fill: { color: bg } }),
        dCell(service, { fill: { color: bg }, align: "left", bold: true }),
        dCell(shortLevelName(targetCompetency), { fill: { color: bg } }),
        dCell("Skenario " + chosen.index + "\n" + (["Baseline","Konservatif","Moderat","Optimistik","Agresif","Maksimum"][chosen.index - 1] || ""), { fill: { color: bg }, bold: true, color: "0284c7", fontSize: 8.5 }),
        dCell(num(tKasus), { fill: { color: bg }, align: "right" }),
        dCell("−" + num(chosen.kk) + "\n(" + moneyM(chosen.krp) + ")", { fill: { color: bg }, color: "b91c1c", align: "right", fontSize: 8.5 }),
        dCell(num(chosen.sisaK) + "\n(" + moneyM(chosen.sisaRp) + ")", { fill: { color: bg }, color: "0891b2", align: "right", fontSize: 8.5 }),
        dCell("+" + num(chosen.tk) + "\n(" + moneyM(chosen.trp) + ")", { fill: { color: bg }, color: "15803d", align: "right", fontSize: 8.5 }),
        dCell(num(chosen.pascaK), { fill: { color: bg }, bold: true, color: "b45309", align: "right", fontSize: 8.5 }),
        dCell(moneyM(chosen.pascaRp), { fill: { color: bg }, bold: true, color: chosen.pascaRp < 0 ? "b91c1c" : "b45309", align: "right", fontSize: 8.5 }),
        dCell(signed(chosen.netK), { fill: { color: bg }, color: nc, align: "right", fontSize: 8.5 }),
        dCell(signedMoneyM(chosen.netRp), { fill: { color: bg }, bold: true, color: nc, align: "right", fontSize: 8.5 }),
        dCell(signedPct(pctPascaIna), { fill: { color: bg }, bold: true, color: pctPascaIna >= 0 ? "15803d" : "b91c1c", align: "right", fontSize: 8.5 })
      ]);
    });

    var kpis = [
      { lbl: "Kasus Pasca RBKP (Optimal)", val: num(grandPascaKasus) + " (" + pct(grandEksKasus ? grandPascaKasus / grandEksKasus : 0) + ")", color: C.teal },
      { lbl: "Proyeksi Pendapatan Pasca", val: moneyM(grandPascaRp), color: C.green },
      { lbl: "Dampak Net (+/-) Pendapatan", val: signedMoneyM(grandNetRp), color: grandNetRp >= 0 ? C.green : "dc2626" },
      { lbl: "Prinsip Batas Kapasitas", val: "Terkendali ≤ 100% Eksisting", color: "6d28d9" }
    ];
    addKpiStrip(slide, kpis, 0.74, 0.52);

    slide.addTable(rows, {
      x: 0.30, y: 1.30, w: W - 0.60,
      border: { pt: 0.5, color: C.lgray },
      colW: [0.30, 2.0, 0.50, 0.90, 0.85, 1.05, 1.05, 1.05, 0.90, 1.00, 0.85, 1.00, 0.85],
      margin: [0.03, 0.03, 0.03, 0.03],
      autoPage: true, autoPageRepeatHeader: true, autoPageLineWeight: 0
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SLIDE 18+: SLIDE SIMULASI PER LAYANAN (DYNAMIC SERVICE SLIDE)
  ══════════════════════════════════════════════════════════════ */
  function buildServiceSlide(pptx, service, appState) {
    var data = appState.data, state = appState.state, target = appState.target || {};
    var CASES = appState.CASES, INA = appState.INA !== undefined ? appState.INA : 1, IDRG = appState.IDRG, dateStr = appState.dateStr;

    var slide = pptx.addSlide();
    slide.background = { color: C.bgray };

    var tHosp = data.hospitals && data.hospitals.find(function (h) { return h.code === target.code; });
    var svcData = data.regional && data.regional.services && data.regional.services[service];
    var tSvc = tHosp && tHosp.services && tHosp.services[service];
    var tTotal = (tSvc && tSvc.total) || [0,0,0];
    var rTotal = (svcData && svcData.total) || [0,0,0];

    var tKasus = tTotal[CASES] || 0, tIna = tTotal[INA] || 0, tIdrg = tTotal[IDRG] || 0;
    var rKasus = rTotal[CASES] || 0, rIna = rTotal[INA] || 0, rIdrg = rTotal[IDRG] || 0;

    var targetCompetency = tSvc ? (tSvc.competency || getCompetency(tHosp, service) || 1) : 1;

    var compCountByLevel = { 1: 0, 2: 0, 3: 0, 4: 0 };
    (data.hospitals || []).filter(function (h) { return h.code !== target.code; }).forEach(function (h) {
      var c = getCompetency(h, service);
      if (c in compCountByLevel) compCountByLevel[c]++;
    });

    var topComp = (data.hospitals || []).filter(function (h) { return h.code !== target.code; })
      .sort(function (a, b) { return ((b.total && b.total[CASES]) || 0) - ((a.total && a.total[CASES]) || 0); })[0];

    var competitors = (data.hospitals || []).filter(function (h) {
      return h.code !== target.code && getCompetency(h, service) >= targetCompetency;
    }).length;

    var calcResult = window.computeServiceScenarios(
      service, target, data, state, CASES, INA, IDRG, severityMetric, getLevelRules
    );
    
    var rules = getLevelRules(targetCompetency, service);
    var baseTambahan = calcResult.baseTambahan;
    var basePengurangan = calcResult.basePengurangan;
    var existingKasus = tTotal[CASES] || 0, existingIna = tTotal[INA] || 0, existingIdrg = tTotal[IDRG] || 0;
    var scenarios = (state && state.serviceScenarios && state.serviceScenarios[service]) || [];

    var opportunityTxt = rKasus > 0 ? "Peluang pasar regional: " + num(rKasus) + " kasus." : "Pasar regional belum mencatat volume kasus signifikan.";
    var riskTxt = tKasus > 0 ? "RS target saat ini memegang " + num(tKasus) + " kasus." : "RS target belum memiliki basis kasus eksisting.";
    var competitorTxt = competitors > 0 ? "Terdapat " + competitors + " RS pesaing se-level/setingkat lebih tinggi di wilayah ini." : "Tidak ada pesaing langsung se-level di wilayah ini (peluang dominasi tinggi).";

    var maxRevenue = Math.max(0.001, ...calcResult.scnEvals.map(function(s) { return s.netRp; }));
    
    var bestScnIdx = calcResult.chosenIdx;
    var bestNetRp = calcResult.chosen ? calcResult.chosen.netRp : 0;

    var scenarioTxt = bestScnIdx >= 0 ? "Skenario " + (bestScnIdx + 1) + " terpilih sebagai Paling Logis (kapasitas kasus terkendali ≤ eksisting, dampak net " + (bestNetRp > 0 ? "+" : "") + money(bestNetRp) + ")." : "Belum ada skenario yang menghasilkan kenaikan positif.";

    addSlideHeader(slide, "Simulasi Kasus Market Share — " + service,
      "RS Target: " + (target.name || "RS Target") + "  •  Kompetensi: " + levelName(targetCompetency), dateStr);

    // Comparison cards
    var BOX_X = 0.30, BOX_Y = 0.74, BOX_W = W - 0.60, BOX_H = 1.15;
    slide.addShape("rect", { x: BOX_X, y: BOX_Y, w: BOX_W, h: BOX_H, fill: { color: C.white }, line: { color: C.lgray, pt: 0.5 } });

    var COL1X = BOX_X + 0.15, COL1W = 5.20;
    var COL2X = COL1X + COL1W + 0.40, COL2W = COL1W;
    var MSX = COL2X + COL2W + 0.10, MSW = (BOX_X + BOX_W) - MSX - 0.15;

    // RS Target Card
    slide.addShape("rect", { x: COL1X, y: BOX_Y + 0.08, w: COL1W, h: 0.05, fill: { color: C.tealL }, line: { color: C.tealL } });
    slide.addText("EKSISTING RUMAH SAKIT", { x: COL1X, y: BOX_Y + 0.15, w: COL1W, h: 0.22, fontSize: 8.5, bold: true, color: C.teal });
    slide.addText("Total Kasus: " + num(tKasus), { x: COL1X, y: BOX_Y + 0.40, w: 2.5, h: 0.35, fontSize: 13, bold: true, color: C.dark });
    slide.addText("Pendapatan INACBG: " + money(tIna), { x: COL1X + 2.6, y: BOX_Y + 0.40, w: 2.5, h: 0.35, fontSize: 13, bold: true, color: "059669", align: "right" });

    // Regional Card
    slide.addShape("rect", { x: COL2X, y: BOX_Y + 0.08, w: COL2W, h: 0.05, fill: { color: C.green }, line: { color: C.green } });
    slide.addText("EKSISTING REGIONAL", { x: COL2X, y: BOX_Y + 0.15, w: COL2W, h: 0.22, fontSize: 8.5, bold: true, color: C.green });
    slide.addText("Total Kasus: " + num(rKasus), { x: COL2X, y: BOX_Y + 0.40, w: 2.5, h: 0.35, fontSize: 13, bold: true, color: C.dark });
    slide.addText("Pendapatan INACBG: " + money(rIna), { x: COL2X + 2.6, y: BOX_Y + 0.40, w: 2.5, h: 0.35, fontSize: 13, bold: true, color: "059669", align: "right" });

    // Market Share
    var ms = rKasus ? tKasus / rKasus : 0;
    slide.addShape("rect", { x: MSX, y: BOX_Y + 0.08, w: MSW, h: BOX_H - 0.16, fill: { color: C.teal }, line: { color: C.teal } });
    slide.addText("MARKET\nSHARE", { x: MSX, y: BOX_Y + 0.15, w: MSW, h: 0.35, fontSize: 8, bold: true, color: C.white, align: "center" });
    slide.addText(pct(ms), { x: MSX, y: BOX_Y + 0.50, w: MSW, h: 0.40, fontSize: 16, bold: true, color: C.lime, align: "center" });

    // Competitor Row
    var COMP_Y = 1.95, COMP_H = 0.50;
    slide.addShape("rect", { x: BOX_X, y: COMP_Y, w: BOX_W, h: COMP_H, fill: { color: C.white }, line: { color: C.lgray, pt: 0.5 } });
    slide.addText("Kompetitor Setara/+: " + competitors + " RS  •  Paripurna: " + (compCountByLevel[4] || 0) + " RS  •  Utama: " + (compCountByLevel[3] || 0) + " RS  •  Madya: " + (compCountByLevel[2] || 0) + " RS  •  Dasar: " + (compCountByLevel[1] || 0) + " RS" + (topComp ? "  •  Top RS: " + topComp.name : ""), {
      x: BOX_X + 0.2, y: COMP_Y + 0.08, w: BOX_W - 0.4, h: 0.35, fontSize: 7, color: C.slate, valign: "middle"
    });

    // Scenario Table
    var colW = [0.70];
    rules.tambah.forEach(function () { colW.push(0.50, 0.65, 0.70); });
    rules.kurang.forEach(function () { colW.push(0.50, 0.65, 0.70); });
    colW.push(0.65, 0.55, 0.75, 0.85, 0.85, 0.70);

    var totalTableW = BOX_W;
    var rawSum = colW.reduce(function (a, b) { return a + b; }, 0);
    var scaledW = colW.map(function (w) { return parseFloat((w * totalTableW / rawSum).toFixed(3)); });

    var h1 = [{ text: "SKENARIO", options: { bold: true, color: C.white, fill: { color: C.tealL }, fontSize: 7, align: "center", valign: "middle", rowspan: 2 } }];
    rules.tambah.forEach(function (lvl) {
      h1.push({ text: "TAMBAHAN " + levelName(lvl).toUpperCase(), options: { bold: true, color: C.white, fill: { color: "16a085" }, fontSize: 7, align: "center", valign: "middle", colspan: 3 } });
    });
    rules.kurang.forEach(function (lvl) {
      h1.push({ text: "PENGURANGAN " + levelName(lvl).toUpperCase(), options: { bold: true, color: C.white, fill: { color: C.redD }, fontSize: 7, align: "center", valign: "middle", colspan: 3 } });
    });
    h1.push({ text: "NET +/- PASCA iDRG", options: { bold: true, color: C.white, fill: { color: C.slate }, fontSize: 7, align: "center", valign: "middle", colspan: 3 } });
    h1.push({ text: "EKSISTING DENGAN iDRG", options: { bold: true, color: C.white, fill: { color: "1e293b" }, fontSize: 7, align: "center", valign: "middle", rowspan: 2 } });
    h1.push({ text: "PASCA RBKP (Rp M)", options: { bold: true, color: C.white, fill: { color: "0e7490" }, fontSize: 7, align: "center", valign: "middle", rowspan: 2 } });
    h1.push({ text: "% KENAIKAN", options: { bold: true, color: C.white, fill: { color: "1e293b" }, fontSize: 7, align: "center", valign: "middle", rowspan: 2 } });

    var h2 = [];
    rules.tambah.forEach(function () {
      h2.push(hCell("%", "1e7e56", { fontSize: 6.5 }));
      h2.push(hCell("Kasus", "1e7e56", { fontSize: 6.5 }));
      h2.push(hCell("Rp M", "1e7e56", { fontSize: 6.5 }));
    });
    rules.kurang.forEach(function () {
      h2.push(hCell("%", C.redD, { fontSize: 6.5 }));
      h2.push(hCell("Kasus", C.redD, { fontSize: 6.5 }));
      h2.push(hCell("Rp M", C.redD, { fontSize: 6.5 }));
    });
    h2.push(hCell("+/- Kasus", C.slate, { fontSize: 6.5 }));
    h2.push(hCell("% Kasus", C.slate, { fontSize: 6.5 }));
    h2.push(hCell("+/- Rp M", C.slate, { fontSize: 6.5 }));

    var dataRows = scenarios.map(function (scn, i) {
      var isLogis = (i === bestScnIdx);
      var bg = isLogis ? "fff7ed" : (i % 2 === 0 ? C.bgray : C.white);
      var totalTambahKasus = 0, totalTambahRp = 0, totalKurangKasus = 0, totalKurangRp = 0;
      var scnText = "Skenario " + (i + 1) + (isLogis ? "\n⚡ (Paling Logis)" : "");
      var cells = [{ text: scnText, options: { fontSize: 7, fill: { color: isLogis ? "ffedd5" : bg }, color: isLogis ? "c2410c" : C.dark, bold: true, align: "center", valign: "middle" } }];

      rules.tambah.forEach(function (lvl) {
        if (scn.hasOwnProperty("tambah_" + lvl)) {
          var pp = scn["tambah_" + lvl] / 100;
          var tk = (baseTambahan[lvl] && baseTambahan[lvl][0] || 0) * pp;
          var trp = (baseTambahan[lvl] && baseTambahan[lvl][1] || 0) * pp;
          totalTambahKasus += tk; totalTambahRp += trp;
          cells.push(dCell(String(scn["tambah_" + lvl]) + "%", { fill: { color: bg }, fontSize: 6.5 }));
          cells.push(dCell(num(tk, 0), { fill: { color: bg }, fontSize: 6.5 }));
          cells.push(dCell(moneyM(trp), { fill: { color: bg }, fontSize: 6.5 }));
        } else {
          cells.push(dCell("−", { fill: { color: bg } }), dCell("−", { fill: { color: bg } }), dCell("−", { fill: { color: bg } }));
        }
      });

      rules.kurang.forEach(function (lvl) {
        if (scn.hasOwnProperty("kurang_" + lvl)) {
          var pk = scn["kurang_" + lvl] / 100;
          var kk = (basePengurangan[lvl] && basePengurangan[lvl][0] || 0) * pk;
          var krp = (basePengurangan[lvl] && basePengurangan[lvl][1] || 0) * pk;
          totalKurangKasus += kk; totalKurangRp += krp;
          cells.push(dCell(String(scn["kurang_" + lvl]) + "%", { fill: { color: bg }, fontSize: 6.5 }));
          cells.push(dCell(num(kk, 0), { fill: { color: bg }, fontSize: 6.5 }));
          cells.push(dCell(moneyM(krp), { fill: { color: bg }, fontSize: 6.5 }));
        } else {
          cells.push(dCell("−", { fill: { color: bg } }), dCell("−", { fill: { color: bg } }), dCell("−", { fill: { color: bg } }));
        }
      });

      var netKasus = totalTambahKasus - totalKurangKasus;
      var netRp = totalTambahRp - totalKurangRp;
      var sisaIdrg = existingIdrg - totalKurangRp;
      var pascaRbkp = sisaIdrg + totalTambahRp;
      var pctNet = existingKasus ? netKasus / existingKasus : 0;
      var pctIna = existingIna ? (pascaRbkp - existingIna) / existingIna : 0;
      var nc = netRp >= 0 ? "059669" : "dc2626";

      cells.push(
        dCell(signed(netKasus), { fill: { color: bg }, color: nc, fontSize: 6.5 }),
        dCell(signedPct(pctNet), { fill: { color: bg }, color: nc, fontSize: 6.5 }),
        dCell(signedMoneyM(netRp), { fill: { color: bg }, bold: true, color: nc, fontSize: 6.5 }),
        dCell(moneyM(sisaIdrg), { fill: { color: bg }, color: sisaIdrg >= 0 ? "334155" : "dc2626", fontSize: 6.5 }),
        dCell(moneyM(pascaRbkp), { fill: { color: bg }, bold: true, color: pascaRbkp >= 0 ? "0e7490" : "dc2626", fontSize: 6.5 }),
        dCell(signedPct(pctIna), { fill: { color: isLogis ? "ffedd5" : (i % 2 === 0 ? "fffcf0" : "fffff5") }, bold: true, color: nc, fontSize: 6.5 })
      );

      if (isLogis) {
        cells.forEach(function (c) {
          c.options = Object.assign(c.options || {}, { border: { type: "solid", color: "ea580c", pt: 1.5 } });
        });
      }
      return cells;
    });

    slide.addTable([h1, h2].concat(dataRows), {
      x: BOX_X, y: 2.52, w: totalTableW,
      border: { type: "solid", color: C.lgray, pt: 0.5 },
      colW: scaledW,
      margin: [0.03, 0.03, 0.03, 0.03]
    });

    // Insight bar
    var IY = H - 0.72, IH = 0.50, LABEL_W = 0.95;
    slide.addShape("rect", { x: 0.30, y: IY, w: BOX_W, h: IH, fill: { color: C.insightBg }, line: { color: C.insightBorder, pt: 0.75 } });
    slide.addShape("rect", { x: 0.30, y: IY, w: LABEL_W, h: IH, fill: { color: C.teal }, line: { color: C.teal } });
    slide.addText("INSIGHT", { x: 0.30, y: IY, w: LABEL_W, h: IH, fontSize: 7, bold: true, color: C.white, align: "center", valign: "middle" });
    var cW = (BOX_W - LABEL_W - 0.10) / 3;
    var txts = ["Peluang: " + opportunityTxt + " " + riskTxt, "Saingan: " + competitorTxt, "Rekomendasi: " + scenarioTxt];
    txts.forEach(function (txt, i) {
      var ix = 0.30 + LABEL_W + 0.05 + i * cW;
      slide.addText(txt, { x: ix, y: IY, w: cW - 0.05, h: IH, fontSize: 6, color: C.slate, valign: "middle", wrap: true });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     MASTER EXPORT GOOGLE SLIDES FUNCTION
  ══════════════════════════════════════════════════════════════ */
  async function exportGoogleSlides(appState) {
    var data = appState.data, target = appState.target || {};
    var services = appState.services || [];
    var CASES = appState.CASES !== undefined ? appState.CASES : 0;
    var INA = appState.INA !== undefined ? appState.INA : 1;
    var IDRG = appState.IDRG !== undefined ? appState.IDRG : (appState.REVENUE !== undefined ? appState.REVENUE : 2);

    // Polyfill scenarios just for export to prevent crash
    function ensureScenarios(service, targetCompetency) {
      if (!appState.state.serviceScenarios) appState.state.serviceScenarios = {};
      var scenarios = appState.state.serviceScenarios[service];
      if (!scenarios || scenarios.length === 0) {
        scenarios = [];
        var rules = window.getLevelRules ? window.getLevelRules(targetCompetency) : { tambah: [1,2,3,4], kurang: [1,2,3,4] };
        var defaultLowLevels = [1, 2, 3, 4, 5, 10];
        for (var si = 0; si < 6; si++) {
          var scn = {};
          rules.tambah.forEach(function (lvl) {
            if (lvl === 1 || lvl === 2) {
              scn["tambah_" + lvl] = defaultLowLevels[si];
            } else {
              var lvlComp = (appState.data.hospitals || []).filter(function (h) {
                return h.code !== target.code && getCompetency(h, service) >= lvl;
              }).length;
              var base = lvlComp > 0 ? Math.min(50, 100 / (lvlComp + 1)) : 50;
              scn["tambah_" + lvl] = parseFloat(Math.min(100, Math.max(0, base + si * 2)).toFixed(1));
            }
          });
          rules.kurang.forEach(function (lvl) {
            scn["kurang_" + lvl] = (lvl > targetCompetency || lvl === 4) ? 100 : 90;
          });
          scenarios.push(scn);
        }
        appState.state.serviceScenarios[service] = scenarios;
      }
    }

    var availableServices = services.filter(function (svc) {
      var targetCompetency = getCompetency(target, svc);
      if (appState.state && appState.state.excludeUnmapped && targetCompetency === 0 && !svc.toLowerCase().includes("forensik")) {
        return false;
      }
      return true;
    });
    if (availableServices.length === 0) availableServices = services;
    
    availableServices.forEach(function(svc) {
      ensureScenarios(svc, getCompetency(target, svc));
    });

    var pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = "Market Share iDRG - " + (target.name || "Regional");

    var dateStr = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
    var appStateWithIdx = Object.assign({}, appState, { CASES: CASES, INA: INA, IDRG: IDRG, dateStr: dateStr, services: availableServices });

    /* 1. Cover Slide */
    buildCoverSlide(pptx, appStateWithIdx);

    /* 2. Slide 0: Ringkasan RS Target */
    buildTargetSummarySlide(pptx, appStateWithIdx);

    /* 3. Slide 1: Peta Sebaran RS */
    buildMapSlide(pptx, appStateWithIdx);

    /* 4. Slide 2: Kasus Eksisting per Layanan */
    buildExistingSlide(pptx, appStateWithIdx);

    /* 4. Slide 2: Potensi Pasar Regional */
    buildRegionalSlide(pptx, appStateWithIdx);

    /* 5. Slide 3: Analisis Addressable Market */
    buildAddressableSlide(pptx, appStateWithIdx);

    /* 6. Slide 4: Perbandingan RS Target vs Regional */
    buildComparisonSlide(pptx, appStateWithIdx);

    /* 7. Slide 5: Distribusi Kasus Regional per Layanan */
    buildRegionalCasesSlide(pptx, appStateWithIdx);

    /* 8. Slide 6: Profil Kapasitas & Agregat Regional */
    buildRegionalProfileSlide(pptx, appStateWithIdx);

    /* 9. Slide Khusus Muhammadiyah (Jika relevan / ada RS Muhammadiyah) */
    var isMhk = appState.helpers && appState.helpers.isMuhammadiyahHospital;
    var hasMhk = (data.hospitals || []).some(function (h) {
      return isMhk ? isMhk(h) : (h.name && (h.name.toUpperCase().includes("MUHAMMADIYAH") || h.name.toUpperCase().includes("AISYIYAH")));
    });
    if (appState.filters && appState.filters.isMuhammadiyahOnly || hasMhk) {
      buildMuhammadiyahSlide(pptx, appStateWithIdx);
    }

    /* 10. Slide 10-15: Mirroring Nasional */
    if (appState.nationalMetrics) {
      buildNationalMirroringSlides(pptx, appStateWithIdx);
    }

    /* 11. Slide 16: Pemetaan Kompetensi ICD */
    buildIcdCompetencySlide(pptx, appStateWithIdx);

    /* 12. Slide 17: Rekap Seluruh Layanan (Rentang) */
    buildRecapSlide(pptx, appStateWithIdx);

    /* 12B. Slide 17B: Rekap Skenario Paling Logis Seluruh Layanan */
    buildLogicalRecapSlide(pptx, appStateWithIdx);

    /* 13. Slide 18+: Dynamic Service Slides (Layanan aktif pada RS target) */
    for (var i = 0; i < availableServices.length; i++) {
      buildServiceSlide(pptx, availableServices[i], appStateWithIdx);
    }

    var safeCode = ((target.code || target.name || "regional")).toLowerCase().replace(/[^a-z0-9]/gi, "_");
    var fileDateStr = new Date().toISOString().slice(0, 10);
    await pptx.writeFile({ fileName: "market-share-gslides-" + safeCode + "-" + fileDateStr + ".pptx" });
  }

  window.exportGoogleSlides = exportGoogleSlides;
})();
