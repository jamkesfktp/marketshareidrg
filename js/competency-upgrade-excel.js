(function (global) {
  "use strict";
  const COLORS = { teal: "0F766E", blue: "2563EB", green: "059669", red: "BE123C", amber: "F59E0B", light: "F8FAFC", white: "FFFFFF", ink: "0F172A", border: "CBD5E1", input: "FFF2CC" };
  const border = { top:{style:"thin",color:{rgb:COLORS.border}}, bottom:{style:"thin",color:{rgb:COLORS.border}}, left:{style:"thin",color:{rgb:COLORS.border}}, right:{style:"thin",color:{rgb:COLORS.border}} };
  const formula = (f, v, z, t) => ({ t: t || "n", f, v, z });
  const quote = (name) => `'${String(name).replace(/'/g, "''")}'`;
  function style(XLSX, ws, range, opts) {
    const d=XLSX.utils.decode_range(range), o=opts||{};
    for(let r=d.s.r;r<=d.e.r;r++) for(let c=d.s.c;c<=d.e.c;c++){
      const ref=XLSX.utils.encode_cell({r,c}); if(!ws[ref]) ws[ref]={t:"s",v:""};
      ws[ref].s={font:{name:"Aptos",sz:o.size||10,bold:!!o.bold,color:{rgb:o.font||COLORS.ink}},fill:{fgColor:{rgb:o.fill||COLORS.white}},border:o.noBorder?undefined:border,alignment:{vertical:"center",horizontal:o.align||"left",wrapText:o.wrap!==false}};
      if(o.numFmt) ws[ref].z=o.numFmt;
    }
  }
  function setup(XLSX, ws, title, lastCol, widths, headerRow) {
    ws["!merges"]=[XLSX.utils.decode_range(`A1:${lastCol}1`)]; ws.A1.v=title;
    style(XLSX,ws,`A1:${lastCol}1`,{fill:COLORS.teal,font:COLORS.white,bold:true,size:15,noBorder:true});
    if(headerRow) style(XLSX,ws,`A${headerRow}:${lastCol}${headerRow}`,{fill:COLORS.blue,font:COLORS.white,bold:true,align:"center"});
    ws["!cols"]=widths.map(w=>({wch:w})); ws["!freeze"]={xSplit:0,ySplit:headerRow||1}; ws["!pageSetup"]={orientation:"landscape",fitToWidth:1,fitToHeight:0};
  }
  function buildWorkbook(ctx) {
    const {XLSX,target,settings,levelNames,formatService,recapRows,comparisons,selectedService,datasetLabel,tariffLabel,filterDesc,CASES,INA,IDRG}=ctx;
    const wb=XLSX.utils.book_new(); wb.Props={Title:`Kertas Kerja Upgrade Kompetensi - ${target.name}`,Author:"Kementerian Kesehatan RI",CreatedDate:new Date()};
    const append=(rows,name,title,last,widths,header)=>{const ws=XLSX.utils.aoa_to_sheet(rows);setup(XLSX,ws,title,last,widths,header);XLSX.utils.book_append_sheet(wb,ws,name);return ws;};
    const guide=append([["KERTAS KERJA SIMULASI PENINGKATAN KOMPETENSI","","",""],["Parameter","Nilai","Satuan/Keterangan","Sumber"],["RS target",target.name,"",target.code],["Layanan pembanding",formatService(selectedService),"",selectedService],["Target rekap",levelNames[settings.targetLevel],"Level kompetensi","Input dashboard"],["Faktor capture",settings.captureMultiplier/100,"% dari natural share","Input dashboard"],["Retensi eligible",settings.retention/100,"% kasus eksisting eligible","Input dashboard"],["Dataset",datasetLabel,"","Filter aktif"],["Tarif",tariffLabel,"","Tarif aktif"],["Regional",filterDesc,"","Filter aktif"],[],["Rumus","Definisi","",""] ,["Kemampuan layanan","Level kompetensi dan satu tingkat di bawahnya","",""] ,["Natural share","1 / (jumlah RS kompetitor eligible + 1 RS target)","",""] ,["Capture rate","MIN(100%; natural share × faktor capture)","",""] ,["Proyeksi","Kasus retained + kasus captured + kasus belum terklasifikasi","",""]],"00_Petunjuk","KERTAS KERJA SIMULASI PENINGKATAN KOMPETENSI","D",[28,75,24,25],2);
    style(XLSX,guide,"A3:D16",{fill:COLORS.light}); style(XLSX,guide,"B6:B7",{fill:COLORS.input,numFmt:"0.0%"});
    const compRows=[["PERBANDINGAN KOMPETENSI PER LAYANAN","","","","","",""],["Layanan",formatService(selectedService),"","","","",""] ,["Kompetensi","Kasus eksisting","Kasus retained","Kasus captured","Proyeksi kasus","Proyeksi iDRG","Selisih iDRG vs INA-CBG"]];
    comparisons.forEach((r,i)=>{const er=i+4;compRows.push([levelNames[r.targetLevel],r.existing[CASES],r.retained[CASES],r.captured[CASES],formula(`C${er}+D${er}`,r.projected[CASES],"#,##0"),r.projected[IDRG],formula(`F${er}-${Number(r.existing[INA])||0}`,r.deltaIdrgVsIna,'"Rp" #,##0')]);});
    const comp=append(compRows,"01_Perbandingan","PERBANDINGAN KOMPETENSI PER LAYANAN","G",[18,18,18,18,18,23,25],3); style(XLSX,comp,`A4:G${compRows.length}`,{fill:COLORS.light}); style(XLSX,comp,`B4:G${compRows.length}`,{align:"right",numFmt:'"Rp" #,##0'}); style(XLSX,comp,`B4:E${compRows.length}`,{align:"right",numFmt:"#,##0"});
    const recap=[["REKAP 24 LAYANAN","","","","","","","","",""],["No","Layanan","Kompetensi saat ini","Target efektif","Kasus eksisting","INA-CBG eksisting","Kasus captured","Proyeksi kasus","Proyeksi iDRG","Selisih iDRG vs INA-CBG"]];
    recapRows.forEach((r,i)=>{const er=i+3;recap.push([i+1,formatService(r.service),levelNames[r.targetCompetency]||"Tidak Kompeten",levelNames[r.targetLevel],r.existing[CASES],r.existing[INA],r.captured[CASES],formula(`E${er}+G${er}-(E${er}-${r.retained[CASES]})`,r.projected[CASES],"#,##0"),r.projected[IDRG],formula(`I${er}-F${er}`,r.deltaIdrgVsIna,'"Rp" #,##0')]);});
    const rec=append(recap,"02_Rekap_24","REKAP 24 LAYANAN","J",[7,38,20,18,18,23,18,18,23,25],2); style(XLSX,rec,`A3:J${recap.length}`,{fill:COLORS.light}); style(XLSX,rec,`E3:E${recap.length}`,{align:"right",numFmt:"#,##0"}); style(XLSX,rec,`F3:F${recap.length}`,{align:"right",numFmt:'"Rp" #,##0'}); style(XLSX,rec,`G3:H${recap.length}`,{align:"right",numFmt:"#,##0"}); style(XLSX,rec,`I3:J${recap.length}`,{align:"right",numFmt:'"Rp" #,##0'}); rec["!autofilter"]={ref:`A2:J${recap.length}`};
    const detail=[["DETAIL DRIVER PER LEVEL","","","","","","","","","","",""],["Layanan","Target","Level kasus","Eligible","Kompetitor","Natural share","Capture rate","Kasus target","Kasus regional eksternal","Kasus retained","Kasus captured","iDRG captured"]];
    recapRows.forEach(r=>r.levelRows.forEach(l=>detail.push([formatService(r.service),levelNames[r.targetLevel],levelNames[l.level],l.eligible?"Ya":"Tidak",l.competitors,l.naturalShare,l.captureRate,l.existing[CASES],l.external[CASES],l.retained[CASES],l.captured[CASES],l.captured[IDRG]])));
    const det=append(detail,"03_Detail_Driver","DETAIL DRIVER PER LEVEL","L",[36,15,15,10,13,15,15,16,22,17,17,23],2); style(XLSX,det,`A3:L${detail.length}`,{fill:COLORS.light}); style(XLSX,det,`F3:G${detail.length}`,{align:"right",numFmt:"0.00%"}); style(XLSX,det,`H3:K${detail.length}`,{align:"right",numFmt:"#,##0"}); style(XLSX,det,`L3:L${detail.length}`,{align:"right",numFmt:'"Rp" #,##0'}); det["!autofilter"]={ref:`A2:L${detail.length}`};
    const controls=[["REKONSILIASI","","",""],["Kontrol","Sumber","Hasil","Status"],["Jumlah layanan",24,recapRows.length,formula('IF(B3=C3,"PASS","FAIL")',recapRows.length===24?"PASS":"FAIL",undefined,"s")],["Total kasus eksisting",recapRows.reduce((s,r)=>s+r.existing[CASES],0),formula(`SUM(${quote("02_Rekap_24")}!E3:E${recap.length})`,recapRows.reduce((s,r)=>s+r.existing[CASES],0),"#,##0"),formula('IF(ABS(B4-C4)<0.01,"PASS","FAIL")',"PASS",undefined,"s")],["Total INA-CBG",recapRows.reduce((s,r)=>s+r.existing[INA],0),formula(`SUM(${quote("02_Rekap_24")}!F3:F${recap.length})`,recapRows.reduce((s,r)=>s+r.existing[INA],0),'"Rp" #,##0'),formula('IF(ABS(B5-C5)<0.01,"PASS","FAIL")',"PASS",undefined,"s")],["Total proyeksi kasus",recapRows.reduce((s,r)=>s+r.projected[CASES],0),formula(`SUM(${quote("02_Rekap_24")}!H3:H${recap.length})`,recapRows.reduce((s,r)=>s+r.projected[CASES],0),"#,##0"),formula('IF(ABS(B6-C6)<0.01,"PASS","FAIL")',"PASS",undefined,"s")],["Total proyeksi iDRG",recapRows.reduce((s,r)=>s+r.projected[IDRG],0),formula(`SUM(${quote("02_Rekap_24")}!I3:I${recap.length})`,recapRows.reduce((s,r)=>s+r.projected[IDRG],0),'"Rp" #,##0'),formula('IF(ABS(B7-C7)<0.01,"PASS","FAIL")',"PASS",undefined,"s")]];
    const ctl=append(controls,"99_Rekonsiliasi","REKONSILIASI","D",[35,25,25,14],2);style(XLSX,ctl,"A3:D7",{fill:COLORS.light});style(XLSX,ctl,"D3:D7",{fill:"DCFCE7",font:COLORS.green,bold:true,align:"center"});
    return wb;
  }
  function exportWorkbook(ctx){const wb=buildWorkbook(ctx);const safe=String(ctx.target.code||"RS").replace(/[^A-Za-z0-9_-]/g,"_");const name=`Kertas_Kerja_Upgrade_Kompetensi_${safe}_${new Date().toISOString().slice(0,10)}.xlsx`;ctx.XLSX.writeFile(wb,name,{compression:true});return{name,workbook:wb};}
  global.CompetencyUpgradeExcel={buildWorkbook,exportWorkbook};
})(window);
