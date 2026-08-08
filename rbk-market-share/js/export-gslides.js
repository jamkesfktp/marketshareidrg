/**
 * export-gslides.js  (v3 – matches screenshot layout)
 * Builds a fully editable PPTX using PptxGenJS (native PPTX objects).
 * Compatible with Google Slides import.
 */
(function () {
  "use strict";

  const W = 13.33, H = 7.5;

  const C = {
    teal:"087e83", tealL:"0aa7ad", tealD:"065f64",
    green:"187a59", greenL:"2e9b5f",
    purple:"6d28d9", blue:"0891b2",
    amber:"b45309", red:"dc2626", redD:"b93d4a",
    slate:"334155", dark:"263238",
    white:"FFFFFF", lime:"dce744",
    bgray:"f8fafc", lgray:"e2e8f0",
    insightBg:"f7fbfa", insightBorder:"cfe8e5",
  };

  function num(n, dec) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    return Number(n).toLocaleString("id-ID", { maximumFractionDigits: dec !== undefined ? dec : 0 });
  }
  function pct(n) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    return (n * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + "%";
  }
  function money(n) {
    if (n === null || n === undefined || isNaN(n)) return "-";
    var abs = Math.abs(n), sign = n < 0 ? "-" : "";
    if (abs >= 1e12) return sign + "Rp " + num(abs / 1e12, 2) + " T";
    if (abs >= 1e9)  return sign + "Rp " + num(abs / 1e9,  2) + " M";
    if (abs >= 1e6)  return sign + "Rp " + num(abs / 1e6,  2) + " Jt";
    if (abs >= 1e3)  return sign + "Rp " + num(abs / 1e3,  2) + " Rb";
    return sign + "Rp " + num(abs, 0);
  }
  function signed(n) { return (n > 0 ? "+" : "") + num(n, 0); }
  function signedPct(n) { return (n > 0 ? "+" : "") + pct(n); }

  function severityMetric(svc, lvl) {
    if (!svc) return [0, 0, 0];
    return svc["lvl" + lvl] || [0, 0, 0];
  }
  function getLevelRules(comp) {
    var all = [4, 3, 2, 1];
    return {
      tambah: all.filter(function(l){ return l > comp; }),
      kurang: all.filter(function(l){ return l <= comp; }),
    };
  }
  function getCompetency(hosp, service) {
    if (!hosp.services || !hosp.services[service]) return 0;
    var svc = hosp.services[service];
    for (var i = 0; i < [4,3,2,1].length; i++) {
      var lvl = [4,3,2,1][i];
      var m = svc["lvl" + lvl];
      if (m && m[0] > 0) return lvl;
    }
    return 0;
  }
  function levelName(lvl) {
    return ["", "Dasar", "Madya", "Utama", "Paripurna"][lvl] || "";
  }

  function addHeader(slide, serviceName, dateStr) {
    var H_BAR = 0.50;
    slide.addShape("rect", { x:0, y:0, w:W, h:H_BAR, fill:{color:C.teal}, line:{color:C.teal} });
    slide.addText("Simulasi Kasus Market Share - " + serviceName, {
      x:0.18, y:0, w:9.5, h:H_BAR, fontSize:13, bold:true, color:C.white, valign:"middle"
    });
    slide.addShape("rect", { x:W-2.8, y:0.04, w:2.62, h:H_BAR-0.08, fill:{color:C.redD}, line:{color:C.redD} });
    slide.addText("Data Mirroring Uji Coba iDRG\nperiode " + dateStr, {
      x:W-2.8, y:0.04, w:2.62, h:H_BAR-0.08, fontSize:6.5, color:C.white, align:"center", valign:"middle"
    });
  }

  function addComparisonCards(slide, p) {
    var CARD_H=1.70, COL1X=0.12, COL1W=5.40;
    var COL2X=COL1X+COL1W+0.42, COL2W=COL1W;
    var MSX=COL2X+COL2W+0.10, MSW=W-MSX-0.12;
    var y=p.yStart;

    // RS Target
    slide.addShape("rect",{x:COL1X,y:y,w:COL1W,h:CARD_H,fill:{color:C.white},line:{color:C.lgray,pt:0.75}});
    slide.addShape("rect",{x:COL1X,y:y,w:COL1W,h:0.06,fill:{color:C.tealL},line:{color:C.tealL}});
    slide.addText("EKSISTING",{x:COL1X+0.08,y:y+0.08,w:COL1W-0.12,h:0.20,fontSize:8.5,bold:true,color:C.teal});
    slide.addText("RUMAH SAKIT",{x:COL1X+0.08,y:y+0.27,w:COL1W-0.12,h:0.22,fontSize:10,bold:true,color:C.teal});
    slide.addText("Total Kasus",{x:COL1X+0.08,y:y+0.51,w:2.4,h:0.16,fontSize:7,color:"66736f"});
    slide.addText(num(p.tKasus),{x:COL1X+0.08,y:y+0.66,w:2.4,h:0.35,fontSize:22,bold:true,color:C.dark});
    slide.addText("Pendapatan iDRG",{x:COL1X+2.6,y:y+0.51,w:2.7,h:0.16,fontSize:7,color:"66736f",align:"right"});
    slide.addText(money(p.tIdrg),{x:COL1X+2.6,y:y+0.66,w:2.7,h:0.35,fontSize:18,bold:true,color:"059669",align:"right"});
    slide.addShape("rect",{x:COL1X,y:y+1.03,w:COL1W,h:0.20,fill:{color:"f4f8f7"},line:{color:"f4f8f7"}});
    slide.addText("Rata-rata Tarif: "+money(p.tKasus?p.tIdrg/p.tKasus:0)+" / kasus",{x:COL1X+0.08,y:y+1.03,w:COL1W-0.12,h:0.20,fontSize:6.5,color:C.slate});
    slide.addText("RINCIAN KASUS EKSISTING RS:",{x:COL1X+0.08,y:y+1.26,w:COL1W-0.12,h:0.16,fontSize:6.5,bold:true,color:C.slate});
    var bW=(COL1W-0.12-0.03*3)/4;
    [["Dasar",p.tD],["Madya",p.tM],["Utama",p.tU],["Paripurna",p.tP]].forEach(function(x,i){
      var bx=COL1X+0.08+i*(bW+0.03), by=y+1.43;
      slide.addShape("rect",{x:bx,y:by,w:bW,h:0.25,fill:{color:"f0f9f8"},line:{color:"ccebe8",pt:0.5}});
      slide.addText(x[0],{x:bx,y:by+0.01,w:bW,h:0.12,fontSize:5.5,bold:true,color:C.tealL,align:"center"});
      slide.addText(num(x[1]),{x:bx,y:by+0.12,w:bW,h:0.13,fontSize:11,bold:true,color:C.teal,align:"center"});
    });

    // VS
    slide.addText("VS",{x:COL1X+COL1W+0.08,y:y+CARD_H/2-0.16,w:0.32,h:0.32,fontSize:9,bold:true,color:"94a3b8",align:"center"});

    // Regional
    slide.addShape("rect",{x:COL2X,y:y,w:COL2W,h:CARD_H,fill:{color:C.white},line:{color:C.lgray,pt:0.75}});
    slide.addShape("rect",{x:COL2X,y:y,w:COL2W,h:0.06,fill:{color:"43b77a"},line:{color:"43b77a"}});
    slide.addText("EKSISTING",{x:COL2X+0.08,y:y+0.08,w:COL2W-0.12,h:0.20,fontSize:8.5,bold:true,color:C.green});
    slide.addText("REGIONAL",{x:COL2X+0.08,y:y+0.27,w:COL2W-0.12,h:0.22,fontSize:10,bold:true,color:C.green});
    slide.addText("Total Kasus",{x:COL2X+0.08,y:y+0.51,w:2.4,h:0.16,fontSize:7,color:"66736f"});
    slide.addText(num(p.rKasus),{x:COL2X+0.08,y:y+0.66,w:2.4,h:0.35,fontSize:22,bold:true,color:C.dark});
    slide.addText("Pendapatan iDRG",{x:COL2X+2.6,y:y+0.51,w:2.7,h:0.16,fontSize:7,color:"66736f",align:"right"});
    slide.addText(money(p.rIdrg),{x:COL2X+2.6,y:y+0.66,w:2.7,h:0.35,fontSize:18,bold:true,color:"059669",align:"right"});
    slide.addShape("rect",{x:COL2X,y:y+1.03,w:COL2W,h:0.20,fill:{color:"f4f8f7"},line:{color:"f4f8f7"}});
    slide.addText("Rata-rata Tarif: "+money(p.rKasus?p.rIdrg/p.rKasus:0)+" / kasus",{x:COL2X+0.08,y:y+1.03,w:COL2W-0.12,h:0.20,fontSize:6.5,color:C.slate});
    slide.addText("RINCIAN KASUS EKSISTING RS:",{x:COL2X+0.08,y:y+1.26,w:COL2W-0.12,h:0.16,fontSize:6.5,bold:true,color:C.slate});
    [["Dasar",p.rD],["Madya",p.rM],["Utama",p.rU],["Paripurna",p.rP]].forEach(function(x,i){
      var bx=COL2X+0.08+i*(bW+0.03), by=y+1.43;
      slide.addShape("rect",{x:bx,y:by,w:bW,h:0.25,fill:{color:"eaf7ef"},line:{color:"bce6cb",pt:0.5}});
      slide.addText(x[0],{x:bx,y:by+0.01,w:bW,h:0.12,fontSize:5.5,bold:true,color:C.greenL,align:"center"});
      slide.addText(num(x[1]),{x:bx,y:by+0.12,w:bW,h:0.13,fontSize:11,bold:true,color:C.green,align:"center"});
    });

    // Market Share
    var ms = p.rKasus ? p.tKasus/p.rKasus : 0;
    slide.addShape("rect",{x:MSX,y:y,w:MSW,h:CARD_H,fill:{color:C.teal},line:{color:C.teal}});
    slide.addText("MARKET\nSHARE",{x:MSX,y:y+0.20,w:MSW,h:0.40,fontSize:9,bold:true,color:C.white,align:"center"});
    slide.addText(pct(ms),{x:MSX,y:y+0.65,w:MSW,h:0.65,fontSize:22,bold:true,color:C.lime,align:"center"});
    slide.addText("Dari Total\nKasus",{x:MSX,y:y+1.32,w:MSW,h:0.32,fontSize:7,color:C.white,align:"center"});
  }

  function addCompetitorRow(slide, p) {
    var y=p.yStart;
    slide.addText("Kompetensi Layanan RS : Kompetensi "+levelName(p.targetCompetency),{x:0.12,y:y,w:5,h:0.22,fontSize:7,color:C.slate});
    slide.addText("RS Kompetitor Setara atau Lebih Tinggi: ",{x:7,y:y,w:4,h:0.20,fontSize:6.5,bold:true,color:C.slate,align:"right"});
    slide.addShape("rect",{x:11.1,y:y+0.01,w:0.80,h:0.18,fill:{color:"dbeafe"},line:{color:"bfdbfe",pt:0.5}});
    slide.addText(String(p.competitors)+" RS",{x:11.1,y:y+0.01,w:0.80,h:0.18,fontSize:6.5,bold:true,color:"1d4ed8",align:"center"});
    var py=y+0.25;
    slide.addText("RS Kompetitor Regional per Kompetensi :",{x:0.12,y:py,w:3.2,h:0.20,fontSize:6.5,color:C.slate});
    var badges=[
      {lbl:"Paripurna: "+(p.compCountByLevel[4]||0)+" RS",bg:"fdf4ff",fg:"86198f",br:"f5d0fe"},
      {lbl:"Utama: "+(p.compCountByLevel[3]||0)+" RS",bg:"fff7ed",fg:"c2410c",br:"fed7aa"},
      {lbl:"Madya: "+(p.compCountByLevel[2]||0)+" RS",bg:"fefce8",fg:"a16207",br:"fef08a"},
      {lbl:"Dasar: "+(p.compCountByLevel[1]||0)+" RS",bg:"f0fdfa",fg:"0f766e",br:"99f6e4"},
    ];
    var bx=3.35;
    badges.forEach(function(b){
      slide.addShape("rect",{x:bx,y:py,w:1.10,h:0.20,fill:{color:b.bg},line:{color:b.br,pt:0.5}});
      slide.addText(b.lbl,{x:bx,y:py,w:1.10,h:0.20,fontSize:6,color:b.fg,align:"center",valign:"middle"});
      bx+=1.20;
    });
    if(p.topCompetitorName){
      slide.addShape("rect",{x:W-2.5,y:py,w:2.38,h:0.20,fill:{color:"fff7e6"},line:{color:"fbbf24",pt:0.5}});
      slide.addText(p.topCompetitorName,{x:W-2.5,y:py,w:2.38,h:0.20,fontSize:6,color:"b45309",bold:true,align:"center",valign:"middle"});
    }
  }

  function buildScenarioTable(slide, p) {
    var scenarios=p.scenarios, rules=p.rules;
    if(!scenarios||scenarios.length===0) return;

    var COL_SCN=0.60,COL_PCT=0.50,COL_KAS=0.65,COL_RP=0.70;
    var COL_NET_K=0.62,COL_NET_P=0.55,COL_NET_RP=0.72,COL_INA=0.80,COL_PCT_INA=0.65;

    var colW=[COL_SCN];
    rules.tambah.forEach(function(){ colW.push(COL_PCT,COL_KAS,COL_RP); });
    rules.kurang.forEach(function(){ colW.push(COL_PCT,COL_KAS,COL_RP); });
    colW.push(COL_NET_K,COL_NET_P,COL_NET_RP,COL_INA,COL_PCT_INA);

    var totalW=W-0.24;
    var rawSum=colW.reduce(function(a,b){return a+b;},0);
    var scaledW=colW.map(function(w){return parseFloat((w*totalW/rawSum).toFixed(3));});

    function hG(bg){ return {bold:true,color:C.white,fill:{color:bg},fontSize:5.5,align:"center",valign:"middle"}; }

    var h1=[];
    h1.push({text:"SKENARIO",options:Object.assign({},hG(C.tealL),{rowspan:2})});
    rules.tambah.forEach(function(lvl){
      var cnt=p.compCountByLevel[lvl]||0;
      h1.push({text:"TAMBAHAN KASUS\n"+levelName(lvl).toUpperCase()+" ("+cnt+" RS)",options:Object.assign({},hG("16a085"),{colspan:3})});
    });
    rules.kurang.forEach(function(lvl){
      var cnt=p.compCountByLevel[lvl]||0;
      h1.push({text:"PENGURANGAN KASUS\n"+levelName(lvl).toUpperCase()+" ("+cnt+" RS)",options:Object.assign({},hG(C.redD),{colspan:3})});
    });
    h1.push({text:"NET +/- PASCA iDRG & RBKP",options:Object.assign({},hG(C.slate),{colspan:3})});
    h1.push({text:"PENDAPATAN\nEKSISTING\nINA CBG\n(Rp M)",options:Object.assign({},hG("1e293b"),{rowspan:2})});
    h1.push({text:"% KENAIKAN\nTHD INA-CBG\nEKSISTING",options:Object.assign({},hG("1e293b"),{rowspan:2})});

    var h2=[];
    rules.tambah.forEach(function(){
      h2.push({text:"PERSEN\nTASE\n(%)",options:hG("1e7e56")});
      h2.push({text:"JUMLAH\nKASUS",options:hG("1e7e56")});
      h2.push({text:"TAMBAHAN\nPENDAPATAN\n(Rp M)",options:hG("1e7e56")});
    });
    rules.kurang.forEach(function(){
      h2.push({text:"PERSEN\nTASE\n(%)",options:hG(C.redD)});
      h2.push({text:"JUMLAH\nKASUS",options:hG(C.redD)});
      h2.push({text:"PENGURANGAN\nPENDAPATAN\n(Rp M)",options:hG(C.redD)});
    });
    h2.push({text:"+/-\nJUMLAH\nKASUS",options:hG(C.slate)});
    h2.push({text:"% THD TOTAL\nKASUS\nEKSISTING",options:hG(C.slate)});
    h2.push({text:"+/-\nPENDAPATAN\n(Rp M)",options:hG(C.slate)});

    var dataRows=scenarios.map(function(scn,i){
      var bg=i%2===0?C.bgray:C.white;
      function dO(extra){ return Object.assign({fontSize:6.5,fill:{color:bg},align:"center",valign:"middle"},extra||{}); }
      var totalTambahKasus=0,totalTambahRp=0,totalKurangKasus=0,totalKurangRp=0;
      var cells=[{text:"Skenario "+(i+1),options:dO({bold:true,align:"left"})}];

      rules.tambah.forEach(function(lvl){
        if(scn.hasOwnProperty("tambah_"+lvl)){
          var pp=scn["tambah_"+lvl]/100;
          var tk=(p.baseTambahan[lvl]&&p.baseTambahan[lvl][0]||0)*pp;
          var trp=(p.baseTambahan[lvl]&&p.baseTambahan[lvl][1]||0)*pp;
          totalTambahKasus+=tk; totalTambahRp+=trp;
          cells.push({text:String(scn["tambah_"+lvl])+"%",options:dO()});
          cells.push({text:num(tk,0),options:dO()});
          cells.push({text:money(trp),options:dO()});
        }else{
          cells.push({text:"-",options:dO()},{text:"-",options:dO()},{text:"-",options:dO()});
        }
      });
      rules.kurang.forEach(function(lvl){
        if(scn.hasOwnProperty("kurang_"+lvl)){
          var pk=scn["kurang_"+lvl]/100;
          var kk=(p.basePengurangan[lvl]&&p.basePengurangan[lvl][0]||0)*pk;
          var krp=(p.basePengurangan[lvl]&&p.basePengurangan[lvl][1]||0)*pk;
          totalKurangKasus+=kk; totalKurangRp+=krp;
          cells.push({text:String(scn["kurang_"+lvl])+"%",options:dO()});
          cells.push({text:num(kk,0),options:dO()});
          cells.push({text:money(krp),options:dO()});
        }else{
          cells.push({text:"-",options:dO()},{text:"-",options:dO()},{text:"-",options:dO()});
        }
      });

      var netKasus=totalTambahKasus-totalKurangKasus;
      var netRp=totalTambahRp-totalKurangRp;
      var pctNet=p.existingKasus?(netKasus-p.existingKasus)/p.existingKasus:0;
      var pctIna=p.existingIna?(netRp-p.existingIna)/p.existingIna:0;
      var nc=netRp>=0?"059669":"dc2626";
      cells.push(
        {text:signed(netKasus),options:dO({color:nc})},
        {text:signedPct(pctNet),options:dO({color:nc})},
        {text:money(netRp),options:dO({bold:true,color:nc})},
        {text:money(p.existingIna),options:dO()},
        {text:signedPct(pctIna),options:Object.assign(dO({bold:true}),{fill:{color:i%2===0?"fffcf0":"fffff5"}})}
      );
      return cells;
    });

    var availH=H-p.yStart-0.95;
    var rowHArr=[0.32,0.30];
    scenarios.forEach(function(){ rowHArr.push(0.26); });

    slide.addTable([h1,h2].concat(dataRows),{
      x:0.12, y:p.yStart, w:totalW, h:availH,
      border:{type:"solid",color:C.lgray,pt:0.5},
      autoPage:false, rowH:rowHArr, colW:scaledW,
    });
  }

  function addInsightBar(slide, p) {
    var IY=H-0.90, IH=0.52, LABEL_W=0.90;
    slide.addShape("rect",{x:0,y:IY,w:W,h:IH,fill:{color:C.insightBg},line:{color:C.insightBorder,pt:0.75}});
    slide.addShape("rect",{x:0,y:IY,w:LABEL_W,h:IH,fill:{color:C.teal},line:{color:C.teal}});
    slide.addText("INSIGHT",{x:0,y:IY,w:LABEL_W,h:IH,fontSize:7,bold:true,color:C.white,align:"center",valign:"middle"});
    var cW=(W-LABEL_W-0.08)/3;
    var txts=["Peluang Kasus: "+p.opportunityTxt+" "+p.riskTxt,"Saingan: "+p.competitorTxt,"Skenario Terbaik: "+p.scenarioTxt];
    txts.forEach(function(txt,i){
      var ix=LABEL_W+0.04+i*cW;
      slide.addText(txt,{x:ix,y:IY,w:cW-0.04,h:IH,fontSize:6,color:C.slate,valign:"middle",wrap:true});
    });
    var NY=IY+IH+0.02;
    slide.addText("* % Penambahan kasus dihitung dari Total Kasus Regional   * % Pengurangan kasus dihitung dari Kasus Eksisting RS   * Insight adalah pembacaan langsung atas angka simulasi; kapasitas, SDM, pola rujukan, dan kesiapan layanan belum dimasukkan.",{
      x:0.12,y:NY,w:W-1.4,h:0.28,fontSize:5.5,color:"4e5d59",valign:"top",wrap:true
    });
    slide.addText("Kemenkes",{x:W-1.25,y:NY,w:1.15,h:0.28,fontSize:8,bold:true,color:C.teal,align:"right",valign:"middle"});
  }

  function buildServiceSlide(pptx, service, appState) {
    var data=appState.data, state=appState.state, target=appState.target;
    var CASES=appState.CASES, INA=appState.INA, IDRG=appState.IDRG, dateStr=appState.dateStr;

    var slide=pptx.addSlide();
    slide.background={color:C.bgray};

    var tHosp=data.hospitals&&data.hospitals.find(function(h){return h.code===target.code;});
    var svcData=data.regional&&data.regional.services&&data.regional.services[service];
    var tSvc=tHosp&&tHosp.services&&tHosp.services[service];
    var tTotal=(tSvc&&tSvc.total)||[0,0,0];
    var rTotal=(svcData&&svcData.total)||[0,0,0];

    var tKasus=tTotal[CASES]||0, tIdrg=tTotal[IDRG]||0;
    var rKasus=rTotal[CASES]||0, rIdrg=rTotal[IDRG]||0;

    function smOf(s,lvl){ return severityMetric(s,lvl); }
    function lvOf(h,lvl){ return h&&h.services&&h.services[service]?smOf(h.services[service],lvl):[0,0,0]; }

    var tD=lvOf(tHosp,1)[CASES],tM=lvOf(tHosp,2)[CASES],tU=lvOf(tHosp,3)[CASES],tP=lvOf(tHosp,4)[CASES];
    var rD=smOf(svcData,1)[CASES],rM=smOf(svcData,2)[CASES],rU=smOf(svcData,3)[CASES],rP=smOf(svcData,4)[CASES];

    var targetCompetency=1;
    if(tSvc){ for(var li=0;li<[4,3,2,1].length;li++){var ll=[4,3,2,1][li];if(lvOf(tHosp,ll)[CASES]>0){targetCompetency=ll;break;}} }

    var compCountByLevel={1:0,2:0,3:0,4:0};
    data.hospitals.filter(function(h){return h.code!==target.code;}).forEach(function(h){
      var c=getCompetency(h,service);
      if(c in compCountByLevel) compCountByLevel[c]++;
    });
    var competitors=data.hospitals.filter(function(h){return h.code!==target.code&&getCompetency(h,service)>=targetCompetency;}).length;
    var sortedH=[].concat(data.hospitals).filter(function(h){return h.code!==target.code;})
      .sort(function(a,b){return (b.total&&b.total[CASES]||0)-(a.total&&a.total[CASES]||0);});
    var topComp=sortedH[0];

    var rules=getLevelRules(targetCompetency);
    var baseTambahan={1:[0,0],2:[0,0],3:[0,0],4:[0,0]};
    var basePengurangan={1:[0,0],2:[0,0],3:[0,0],4:[0,0]};
    rules.tambah.forEach(function(lvl){
      var rM2=smOf(svcData,lvl), tM2=smOf(tSvc,lvl);
      baseTambahan[lvl][0]=Math.max(0,(rM2[CASES]||0)-(tM2[CASES]||0));
      baseTambahan[lvl][1]=Math.max(0,(rM2[IDRG]||0)-(tM2[IDRG]||0));
    });
    rules.kurang.forEach(function(lvl){
      var tM2=smOf(tSvc,lvl);
      basePengurangan[lvl][0]=tM2[CASES]||0;
      basePengurangan[lvl][1]=tM2[INA]||0;
    });

    var existingKasus=tTotal[CASES]||0, existingIna=tTotal[INA]||0;
    var scenarios=(state&&state.serviceScenarios&&state.serviceScenarios[service])||[];

    var opportunityTxt=rKasus>0?"Peluang pasar regional: "+num(rKasus)+" kasus.":"Pasar regional belum mencatat volume kasus signifikan.";
    var riskTxt=tKasus>0?"RS target saat ini memegang "+num(tKasus)+" kasus.":"RS target belum memiliki basis kasus eksisting.";
    var competitorTxt=competitors>0?"Terdapat "+competitors+" RS pesaing se-level/setingkat lebih tinggi di wilayah ini.":"Tidak ada pesaing langsung se-level di wilayah ini (peluang dominasi tinggi).";

    var bestScnIdx=-1, bestNetRp=-Infinity;
    scenarios.forEach(function(scn,i){
      var tRp=0,kRp=0;
      rules.tambah.forEach(function(lvl){ if(scn.hasOwnProperty("tambah_"+lvl)) tRp+=baseTambahan[lvl][1]*(scn["tambah_"+lvl]/100); });
      rules.kurang.forEach(function(lvl){ if(scn.hasOwnProperty("kurang_"+lvl)) kRp+=basePengurangan[lvl][1]*(scn["kurang_"+lvl]/100); });
      var nrp=tRp-kRp;
      if(nrp>bestNetRp){bestNetRp=nrp;bestScnIdx=i;}
    });
    var scenarioTxt=bestScnIdx>=0?"Skenario "+(bestScnIdx+1)+" memberikan net pendapatan iDRG terbaik ("+(bestNetRp>0?"+":"")+money(bestNetRp)+").":"Belum ada skenario yang menghasilkan kenaikan positif.";

    var CARD_TOP=0.52;
    addHeader(slide, service, dateStr);
    addComparisonCards(slide, {tKasus:tKasus,tIdrg:tIdrg,tD:tD,tM:tM,tU:tU,tP:tP,rKasus:rKasus,rIdrg:rIdrg,rD:rD,rM:rM,rU:rU,rP:rP,yStart:CARD_TOP});

    var COMP_Y=CARD_TOP+1.74;
    addCompetitorRow(slide, {targetCompetency:targetCompetency,compCountByLevel:compCountByLevel,competitors:competitors,topCompetitorName:topComp?topComp.name:null,yStart:COMP_Y});

    var TABLE_Y=COMP_Y+0.50;
    buildScenarioTable(slide, {scenarios:scenarios,rules:rules,compCountByLevel:compCountByLevel,baseTambahan:baseTambahan,basePengurangan:basePengurangan,existingKasus:existingKasus,existingIna:existingIna,CASES:CASES,INA:INA,IDRG:IDRG,yStart:TABLE_Y});

    addInsightBar(slide, {opportunityTxt:opportunityTxt,riskTxt:riskTxt,competitorTxt:competitorTxt,scenarioTxt:scenarioTxt});
  }

  function buildCoverSlide(pptx, target, dateStr) {
    var slide=pptx.addSlide();
    slide.addShape("rect",{x:0,y:0,w:W,h:H,fill:{color:C.teal},line:{color:C.teal}});
    slide.addText("SIMULATOR MARKET SHARE REGIONAL",{x:0.5,y:1.5,w:W-1,h:1.0,fontSize:32,bold:true,color:C.white,align:"center"});
    slide.addText("Data Mirroring Uji Coba iDRG",{x:0.5,y:2.7,w:W-1,h:0.5,fontSize:14,color:"d6f3f1",align:"center"});
    slide.addShape("rect",{x:2,y:3.5,w:W-4,h:0.04,fill:{color:C.lime},line:{color:C.lime}});
    slide.addText("RS TARGET: "+(target.name||"").toUpperCase(),{x:0.5,y:3.7,w:W-1,h:0.6,fontSize:20,bold:true,color:C.lime,align:"center"});
    slide.addText("Tanggal ekspor: "+dateStr,{x:0.5,y:H-0.8,w:W-1,h:0.4,fontSize:10,color:"d6f3f1",align:"center"});
    slide.addText("KEMENTERIAN KESEHATAN RI",{x:0.5,y:H-0.45,w:W-1,h:0.35,fontSize:9,color:"d6f3f1",align:"center"});
  }

  async function exportGoogleSlides(appState) {
    var data=appState.data, state=appState.state, target=appState.target;
    var services=appState.services;
    var CASES=appState.CASES!==undefined?appState.CASES:0;
    var INA=appState.INA!==undefined?appState.INA:1;
    var IDRG=appState.IDRG!==undefined?appState.IDRG:(appState.REVENUE!==undefined?appState.REVENUE:2);

    var pptx=new PptxGenJS();
    pptx.layout="LAYOUT_WIDE";
    pptx.title="Market Share iDRG - "+target.name;

    var dateStr=new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"});
    buildCoverSlide(pptx, target, dateStr);

    for(var i=0;i<services.length;i++){
      buildServiceSlide(pptx, services[i], {data:data,state:state,target:target,CASES:CASES,INA:INA,IDRG:IDRG,dateStr:dateStr});
    }

    var safeCode=(target.code||"rs").replace(/[^a-z0-9]/gi,"_");
    var fileDateStr=new Date().toISOString().slice(0,10);
    await pptx.writeFile({fileName:"market-share-gslides-"+safeCode+"-"+fileDateStr+".pptx"});
  }

  window.exportGoogleSlides = exportGoogleSlides;
})();
