/**
 * export-gslides.js
 * Builds a fully editable PPTX using PptxGenJS (native PPTX objects).
 * Compatible with Google Slides import.
 */
(function () {
  "use strict";
  const W = 13.33, H = 7.5;
  const TEAL="087e83", TEAL_L="0aa7ad", GREEN="187a59", GREEN_L="2e9b5f";
  const WHITE="FFFFFF", DARK="263238", SLATE="334155", LIME="dce744";
  const BGRAY="f8fafc", LGRAY="e2e8f0";

  function fmtNum(n) {
    if (!n && n !== 0) return "-";
    return Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });
  }
  function fmtPct(n) {
    if (!n && n !== 0) return "-";
    return (n * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + "%";
  }
  function fmtMoney(n) {
    if (!n && n !== 0) return "-";
    const abs = Math.abs(n);
    const prefix = n < 0 ? "-" : "";
    if (abs >= 1e9) return prefix + "Rp" + (abs / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " T";
    if (abs >= 1e6) return prefix + "Rp" + (abs / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M";
    if (abs >= 1e3) return prefix + "Rp" + (abs / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " Jt";
    return prefix + "Rp" + abs.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  }

  function addHeader(slide, title, subtitle) {
    slide.addShape("rect", { x:0, y:0, w:W, h:0.55, fill:{color:TEAL}, line:{color:TEAL} });
    slide.addText("KEMENKES RI", { x:W-1.8, y:0.05, w:1.7, h:0.45, fontSize:9, bold:true, color:WHITE, align:"right", valign:"middle" });
    slide.addText(title, { x:0.2, y:0.05, w:W-2.1, h:0.45, fontSize:14, bold:true, color:WHITE, valign:"middle" });
    if (subtitle) {
      slide.addText(subtitle, { x:0.15, y:0.57, w:W-0.3, h:0.22, fontSize:8, color:SLATE });
    }
  }

  function addComparisonCards(slide, tKasus, tIdrg, tD, tM, tU, tP, rKasus, rIdrg, rD, rM, rU, rP, yStart) {
    const cardH=1.65, col1X=0.15, col2X=6.85, msX=W-1.85, msW=1.7;

    // RS Target
    slide.addShape("rect", { x:col1X, y:yStart, w:6.5, h:cardH, fill:{color:WHITE}, line:{color:LGRAY,pt:1} });
    slide.addShape("rect", { x:col1X, y:yStart, w:6.5, h:0.07, fill:{color:TEAL_L}, line:{color:TEAL_L} });
    slide.addText("?? EKSISTING RS TARGET", { x:col1X+0.1, y:yStart+0.09, w:6.2, h:0.2, fontSize:8, bold:true, color:TEAL });
    slide.addText("Total Kasus", { x:col1X+0.1, y:yStart+0.32, w:3, h:0.18, fontSize:7, color:"66736f" });
    slide.addText(fmtNum(tKasus), { x:col1X+0.1, y:yStart+0.48, w:3, h:0.32, fontSize:20, bold:true, color:DARK });
    slide.addText("Pendapatan iDRG", { x:col1X+3.3, y:yStart+0.32, w:3, h:0.18, fontSize:7, color:"66736f", align:"right" });
    slide.addText(fmtMoney(tIdrg), { x:col1X+3.3, y:yStart+0.48, w:3, h:0.32, fontSize:16, bold:true, color:"059669", align:"right" });
    slide.addText("Rata-rata Tarif: "+fmtMoney(tKasus?tIdrg/tKasus:0)+" / kasus", { x:col1X+0.1, y:yStart+0.83, w:6.2, h:0.18, fontSize:7, color:SLATE, fill:{color:"f4f8f7"} });

    const rW=1.5, rY=yStart+1.05;
    [{l:"Dasar",v:tD},{l:"Madya",v:tM},{l:"Utama",v:tU},{l:"Paripurna",v:tP}].forEach(function(x,i){
      const lx=col1X+0.1+i*(rW+0.04);
      slide.addShape("rect",{x:lx,y:rY,w:rW,h:0.56,fill:{color:"f0f9f8"},line:{color:"ccebe8",pt:1}});
      slide.addText(x.l,{x:lx,y:rY+0.02,w:rW,h:0.18,fontSize:7,bold:true,color:TEAL_L,align:"center"});
      slide.addText(fmtNum(x.v),{x:lx,y:rY+0.2,w:rW,h:0.32,fontSize:14,bold:true,color:TEAL,align:"center"});
    });

    // VS
    slide.addText("VS",{x:col2X-0.35,y:yStart+0.6,w:0.5,h:0.4,fontSize:10,bold:true,color:"94a3b8",align:"center"});

    // Regional
    slide.addShape("rect",{x:col2X,y:yStart,w:6.5,h:cardH,fill:{color:WHITE},line:{color:LGRAY,pt:1}});
    slide.addShape("rect",{x:col2X,y:yStart,w:6.5,h:0.07,fill:{color:"43b77a"},line:{color:"43b77a"}});
    slide.addText("?? EKSISTING REGIONAL",{x:col2X+0.1,y:yStart+0.09,w:6.2,h:0.2,fontSize:8,bold:true,color:GREEN});
    slide.addText("Total Kasus",{x:col2X+0.1,y:yStart+0.32,w:3,h:0.18,fontSize:7,color:"66736f"});
    slide.addText(fmtNum(rKasus),{x:col2X+0.1,y:yStart+0.48,w:3,h:0.32,fontSize:20,bold:true,color:DARK});
    slide.addText("Pendapatan iDRG",{x:col2X+3.3,y:yStart+0.32,w:3,h:0.18,fontSize:7,color:"66736f",align:"right"});
    slide.addText(fmtMoney(rIdrg),{x:col2X+3.3,y:yStart+0.48,w:3,h:0.32,fontSize:16,bold:true,color:"059669",align:"right"});
    slide.addText("Rata-rata Tarif: "+fmtMoney(rKasus?rIdrg/rKasus:0)+" / kasus",{x:col2X+0.1,y:yStart+0.83,w:6.2,h:0.18,fontSize:7,color:SLATE,fill:{color:"f4f8f7"}});

    [{l:"Dasar",v:rD},{l:"Madya",v:rM},{l:"Utama",v:rU},{l:"Paripurna",v:rP}].forEach(function(x,i){
      const lx=col2X+0.1+i*(rW+0.04);
      slide.addShape("rect",{x:lx,y:rY,w:rW,h:0.56,fill:{color:"eaf7ef"},line:{color:"bce6cb",pt:1}});
      slide.addText(x.l,{x:lx,y:rY+0.02,w:rW,h:0.18,fontSize:7,bold:true,color:GREEN_L,align:"center"});
      slide.addText(fmtNum(x.v),{x:lx,y:rY+0.2,w:rW,h:0.32,fontSize:14,bold:true,color:GREEN,align:"center"});
    });

    // Market Share
    const ms = rKasus ? tKasus/rKasus : 0;
    slide.addShape("rect",{x:msX,y:yStart,w:msW,h:cardH,fill:{color:TEAL},line:{color:TEAL}});
    slide.addText("MARKET\nSHARE",{x:msX,y:yStart+0.18,w:msW,h:0.42,fontSize:10,bold:true,color:WHITE,align:"center"});
    slide.addText(fmtPct(ms),{x:msX,y:yStart+0.65,w:msW,h:0.55,fontSize:24,bold:true,color:LIME,align:"center"});
    slide.addText("Dari total kasus",{x:msX,y:yStart+1.25,w:msW,h:0.3,fontSize:8,color:WHITE,align:"center"});
  }

  function buildServiceSlide(pptx, service, data, CASES, REVENUE, target, state) {
    const slide = pptx.addSlide();
    const tHosp = data.hospitals && data.hospitals.find(function(h){return h.code===target.code;});
    const svcData = data.regional && data.regional.services && data.regional.services[service];

    const tKasus  = (tHosp&&tHosp.services&&tHosp.services[service]&&tHosp.services[service].total&&tHosp.services[service].total[CASES])||0;
    const tIdrg   = (tHosp&&tHosp.services&&tHosp.services[service]&&tHosp.services[service].total&&tHosp.services[service].total[REVENUE])||0;
    const rKasus  = (svcData&&svcData.total&&svcData.total[CASES])||0;
    const rIdrg   = (svcData&&svcData.total&&svcData.total[REVENUE])||0;
    function lv(h,lvl){return (h&&h.services&&h.services[service]&&h.services[service]["lvl"+lvl]&&h.services[service]["lvl"+lvl][CASES])||0;}
    function rlv(s,lvl){return (s&&s["lvl"+lvl]&&s["lvl"+lvl][CASES])||0;}

    addHeader(slide, "Simulasi Kasus Market Share \u2014 "+service, "Data Mirroring Uji Coba iDRG");

    const cardTop=0.85;
    addComparisonCards(slide, tKasus, tIdrg, lv(tHosp,1), lv(tHosp,2), lv(tHosp,3), lv(tHosp,4),
                       rKasus, rIdrg, rlv(svcData,1), rlv(svcData,2), rlv(svcData,3), rlv(svcData,4), cardTop);

    // Scenario table
    const tableTop = cardTop + 1.78;
    const scenarios = (state&&state.serviceScenarios&&state.serviceScenarios[service])||[];
    if (scenarios.length > 0) {
      const hOpts = function(bg) { return {bold:true, color:WHITE, fill:{color:bg||TEAL_L}, fontSize:6, align:"center", valign:"middle"}; };
      const rows = [];

      // Header

      rows.push([
        {text:"",      options:hOpts(TEAL)},
        {text:"%",     options:hOpts("6d28d9")},
        {text:"Kasus", options:hOpts("6d28d9")},
        {text:"%",     options:hOpts("0891b2")},
        {text:"Kasus", options:hOpts("0891b2")},
        {text:"%",     options:hOpts("b45309")},
        {text:"Kasus", options:hOpts("b45309")},
        {text:"%",     options:hOpts("dc2626")},
        {text:"Kasus", options:hOpts("dc2626")},
        {text:"",      options:hOpts(SLATE)},
        {text:"(Rp M)",options:hOpts(SLATE)},
        {text:"",      options:hOpts(SLATE)},
        {text:"",      options:hOpts("1e293b")},
        {text:"",      options:hOpts("1e293b")},
      ]);

      scenarios.forEach(function(scn, i) {
        const bg = i%2===0 ? BGRAY : WHITE;
        const dOpts = function(extra) { return Object.assign({fontSize:7, fill:{color:bg}, align:"center", valign:"middle"}, extra||{}); };
        rows.push([
          {text:"Skenario "+(i+1), options:dOpts({bold:true})},
          {text:String(scn.addPct4||0)+"%",       options:dOpts()},
          {text:fmtNum(scn.addCases4||0),         options:dOpts()},
          {text:String(scn.addPct3||0)+"%",       options:dOpts()},
          {text:fmtNum(scn.addCases3||0),         options:dOpts()},
          {text:String(scn.redPct2||0)+"%",       options:dOpts()},
          {text:fmtNum(scn.redCases2||0),         options:dOpts()},
          {text:String(scn.redPct1||0)+"%",       options:dOpts()},
          {text:fmtNum(scn.redCases1||0),         options:dOpts()},
          {text:fmtNum(scn.netCases||0),          options:dOpts()},
          {text:fmtMoney(scn.netRevenue||0),      options:dOpts()},
          {text:fmtPct((scn.pctOfExisting||0)/100), options:dOpts()},
          {text:fmtMoney(scn.existingInaCbg||0),  options:dOpts()},
          {text:fmtPct((scn.pctVsInaCbg||0)/100), options:dOpts()},
        ]);
      });

      const availH = H - tableTop - 0.9;
      slide.addTable(rows, {
        x:0.15, y:tableTop, w:W-0.3, h:availH,
        border:{type:"solid", color:LGRAY, pt:0.5},
        autoPage:false,
        rowH:0.25,
        colW:[0.7,0.55,0.65,0.55,0.65,0.55,0.65,0.55,0.65,0.65,0.8,0.7,0.8,0.7],
      });
    }

    // Insight bar
    const insightY = H - 0.82;
    slide.addShape("rect",{x:0,y:insightY,w:W,h:0.72,fill:{color:"f7fbfa"},line:{color:"cfe8e5",pt:1}});
    slide.addShape("rect",{x:0,y:insightY,w:1.4,h:0.72,fill:{color:TEAL},line:{color:TEAL}});
    slide.addText("INSIGHT \ud83d\udca1",{x:0,y:insightY,w:1.4,h:0.72,fontSize:9,bold:true,color:WHITE,align:"center",valign:"middle"});
    const insightTxt = "Peluang pasar regional: "+fmtNum(rKasus)+" kasus | RS Target saat ini: "+fmtNum(tKasus)+" kasus | Market Share: "+fmtPct(rKasus?tKasus/rKasus:0);
    slide.addText(insightTxt,{x:1.45,y:insightY,w:W-1.55,h:0.72,fontSize:8,color:SLATE,valign:"middle",wrap:true});
  }

  async function exportGoogleSlides(appState) {
    const { data, state, target, CASES, REVENUE, services } = appState;
    const pptx = new PptxGenJS();
    pptx.layout  = "LAYOUT_WIDE";
    pptx.title   = "Market Share iDRG - "+target.name;

    // Cover
    const cover = pptx.addSlide();
    cover.addShape("rect",{x:0,y:0,w:W,h:H,fill:{color:TEAL},line:{color:TEAL}});
    cover.addText("SIMULATOR MARKET SHARE REGIONAL",{x:0.5,y:1.5,w:W-1,h:1.0,fontSize:32,bold:true,color:WHITE,align:"center"});
    cover.addText("Data Mirroring Uji Coba iDRG",{x:0.5,y:2.7,w:W-1,h:0.5,fontSize:14,color:"d6f3f1",align:"center"});
    cover.addShape("rect",{x:2,y:3.5,w:W-4,h:0.04,fill:{color:LIME},line:{color:LIME}});
    cover.addText("RS TARGET: "+(target.name||"").toUpperCase(),{x:0.5,y:3.7,w:W-1,h:0.6,fontSize:20,bold:true,color:LIME,align:"center"});
    cover.addText("Tanggal ekspor: "+new Date().toLocaleDateString("id-ID"),{x:0.5,y:H-0.8,w:W-1,h:0.4,fontSize:10,color:"d6f3f1",align:"center"});
    cover.addText("KEMENTERIAN KESEHATAN RI",{x:0.5,y:H-0.45,w:W-1,h:0.35,fontSize:9,color:"d6f3f1",align:"center"});

    // Per-service slides
    for (let i=0; i<services.length; i++) {
      buildServiceSlide(pptx, services[i], data, CASES, REVENUE, target, state);
    }

    const safeCode = (target.code||"rs").replace(/[^a-z0-9]/gi,"_");
    const dateStr  = new Date().toISOString().slice(0,10);
    await pptx.writeFile({ fileName: "market-share-gslides-"+safeCode+"-"+dateStr+".pptx" });
  }

  window.exportGoogleSlides = exportGoogleSlides;
})();
