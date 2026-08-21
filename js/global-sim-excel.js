/**
 * global-sim-excel.js
 * Kertas Kerja Audit - Menu Simulasi Global (Per Layanan + 3 Skenario)
 * Sheet: 00_Info_Global | 01_Data_Regional | 02_Audit_Per_Layanan
 *        03_Skenario_Global | 04_Rekap_Layanan | 99_Rekonsiliasi
 */
(function (global) {
  "use strict";

  const C = {
    tealDeep:"087E83", teal:"0AA7AD", green:"43B77A", greenSoft:"E8F6F2",
    blueSoft:"E8F7F8", orange:"E88725", orangeSoft:"FFF2E2",
    red:"B93D4A", redSoft:"FDEBED", yellow:"FEFCE8",
    light:"F4F8F7", white:"FFFFFF", ink:"2E3432", muted:"66736F",
    border:"C8DFDB", purpleSoft:"F5F3FF",
  };
  const THIN = {
    top:{style:"thin",color:{rgb:C.border}}, bottom:{style:"thin",color:{rgb:C.border}},
    left:{style:"thin",color:{rgb:C.border}}, right:{style:"thin",color:{rgb:C.border}},
  };
  const FMT_NUM="#,##0", FMT_MONEY='"Rp" #,##0', FMT_PCT="0.00%";

  function nFmt(v,z){return{t:"n",v:Number(v)||0,z:z};}
  function s(v){return{t:"s",v:String(v??"")};}
  function fml(f,v,z){const c={t:(typeof v==="string"?"s":"n"),f,v};if(z)c.z=z;return c;}

  function styleCell(cell,o){
    if(!cell)return;
    o=o||{};
    cell.s={
      font:{name:"Aptos",sz:o.size||10,bold:Boolean(o.bold),color:{rgb:o.fontColor||C.ink}},
      fill:{fgColor:{rgb:o.fill||C.white}},
      border:o.border===false?undefined:THIN,
      alignment:{vertical:o.vertical||"center",horizontal:o.align||"left",wrapText:o.wrap!==false},
    };
    if(o.numFmt)cell.s.numFmt=o.numFmt;
  }

  function styleRange(XLSX,ws,range,o){
    const d=typeof range==="string"?XLSX.utils.decode_range(range):range;
    for(let r=d.s.r;r<=d.e.r;r++){
      for(let c=d.s.c;c<=d.e.c;c++){
        const ref=XLSX.utils.encode_cell({r,c});
        if(!ws[ref])ws[ref]={t:"s",v:""};
        styleCell(ws[ref],o);
      }
    }
  }

  function setDefaults(ws,widths,fr){
    ws["!cols"]=widths.map(w=>({wch:w}));
    ws["!freeze"]={xSplit:0,ySplit:fr||0};
    ws["!pageSetup"]={orientation:"landscape",fitToWidth:1,fitToHeight:0};
    ws["!margins"]={left:0.3,right:0.3,top:0.5,bottom:0.5,header:0.2,footer:0.2};
  }

  function addTitle(XLSX,ws,text,cols){
    ws["A1"]={t:"s",v:text};
    styleCell(ws["A1"],{fill:C.teal,fontColor:C.white,bold:true,size:14,border:false});
    ws["!merges"]=ws["!merges"]||[];
    ws["!merges"].push({s:{r:0,c:0},e:{r:0,c:cols-1}});
    ws["!rows"]=ws["!rows"]||[];
    ws["!rows"][0]={hpt:28};
  }

  function hdrRow(XLSX,ws,values,rowIdx,fill){
    values.forEach((v,c)=>{
      const ref=XLSX.utils.encode_cell({r:rowIdx,c});
      ws[ref]={t:"s",v:String(v)};
      styleCell(ws[ref],{fill:fill||C.tealDeep,fontColor:C.white,bold:true,align:"center"});
    });
  }

  function writeAoa(XLSX,ws,aoa,startRow){
    aoa.forEach((row,ri)=>{
      row.forEach((cell,ci)=>{
        const ref=XLSX.utils.encode_cell({r:startRow+ri,c:ci});
        if(cell&&typeof cell==="object"&&("v" in cell||"f" in cell)){
          ws[ref]=cell;
        } else {
          ws[ref]={t:typeof cell==="number"?"n":"s",v:cell??""};
        }
      });
    });
  }

  function safeSheet(name,used){
    const base=String(name||"Sheet").replace(/[\\/?*[\]:]/g," ").replace(/\s+/g," ").trim().slice(0,31)||"Sheet";
    let nm=base,suf=2;
    while(used.has(nm.toUpperCase())){const tail=`_${suf++}`;nm=`${base.slice(0,31-tail.length)}${tail}`;}
    used.add(nm.toUpperCase());
    return nm;
  }

  const fmtN=(v)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Math.round(Number(v)||0));
  const fmtM=(v)=>`Rp ${fmtN(Math.abs(Number(v)||0))}`;

  /* ===================== COMPUTE POOL HELPERS ===================== */
  function computePool(svc,tambahMode,kurangMode,target,data,CASES,INA,IDRG,severityMetric,getCompetency){
    const srvT=target.services?.[svc];
    const srvR=data.regional?.services?.[svc];
    let addK=0,addIdrg=0,redK=0,redIdrg=0;

    if(tambahMode==="tambah_cross_comp"){
      data.hospitals.forEach(h=>{
        if(h.code===target.code)return;
        const hComp=getCompetency(h,svc);
        if(!hComp||hComp===0)return;
        const hSrv=h.services?.[svc];
        if(!hSrv)return;
        [1,2,3,4].forEach(rank=>{
          if(hComp!==rank){const m=severityMetric(hSrv,rank);addK+=m[CASES]||0;addIdrg+=m[IDRG]||0;}
        });
      });
    } else if(tambahMode==="tambah_up"){
      [3,4].forEach(rank=>{const rM=severityMetric(srvR,rank),tM=severityMetric(srvT,rank);addK+=Math.max(0,(rM[CASES]||0)-(tM[CASES]||0));addIdrg+=Math.max(0,(rM[IDRG]||0)-(tM[IDRG]||0));});
    } else if(tambahMode==="tambah_dm_reg"){
      [1,2].forEach(rank=>{const rM=severityMetric(srvR,rank),tM=severityMetric(srvT,rank);addK+=Math.max(0,(rM[CASES]||0)-(tM[CASES]||0));addIdrg+=Math.max(0,(rM[IDRG]||0)-(tM[IDRG]||0));});
    } else if(tambahMode==="tambah_mu_reg"){
      [2,3].forEach(rank=>{const rM=severityMetric(srvR,rank),tM=severityMetric(srvT,rank);addK+=Math.max(0,(rM[CASES]||0)-(tM[CASES]||0));addIdrg+=Math.max(0,(rM[IDRG]||0)-(tM[IDRG]||0));});
    } else if(tambahMode==="tambah_d_reg"){
      const rM=severityMetric(srvR,1),tM=severityMetric(srvT,1);addK+=Math.max(0,(rM[CASES]||0)-(tM[CASES]||0));addIdrg+=Math.max(0,(rM[IDRG]||0)-(tM[IDRG]||0));
    } else {
      // tambah_dm / tambah_mu_higher / tambah_d_higher — dari RS kompetensi lebih tinggi
      const ranks=tambahMode==="tambah_mu_higher"?[2,3]:tambahMode==="tambah_d_higher"?[1]:[1,2];
      data.hospitals.forEach(h=>{
        if(h.code===target.code)return;
        if(getCompetency(h,svc)>getCompetency(target,svc)){
          const hSrv=h.services?.[svc];
          if(hSrv)ranks.forEach(rank=>{const m=severityMetric(hSrv,rank);addK+=m[CASES]||0;addIdrg+=m[IDRG]||0;});
        }
      });
    }

    let kRanks=[1,2];
    if(kurangMode==="kurang_up")kRanks=[3,4];
    if(kurangMode==="kurang_dp")kRanks=[1,4];
    if(kurangMode==="kurang_mup")kRanks=[2,3,4];
    if(srvT)kRanks.forEach(rank=>{const tM=severityMetric(srvT,rank);redK+=tM[CASES]||0;redIdrg+=tM[IDRG]||0;});
    return{addK,addIdrg,redK,redIdrg};
  }

  /* ===================== BUILD WORKBOOK ===================== */
  function buildGlobalSimWorkbook(ctx){
    const{XLSX,data,target,CASES,INA,IDRG,severityMetric,getCompetency,formatService,
      tambahMode,kurangMode,globalSimScenarios,globalSimKurangScenarios,
      totalCompetitors,tariffLabel,datasetLabel,filterDesc}=ctx;

    const LN={0:"Tidak Kompeten",1:"Dasar",2:"Madya",3:"Utama",4:"Paripurna"};
    const ML={
      tambah_cross_comp:"Serapan Lintas Kompetensi Layanan (Semua Strata)",
      tambah_up:"Serap Utama & Paripurna (dari Sisa Regional)",
      tambah_dm:"Serap Dasar & Madya (dari RS Kelas Lebih Tinggi)",
      tambah_dm_reg:"Serap Dasar & Madya (dari Sisa Regional)",
      tambah_mu_reg:"Serap Madya & Utama (dari Sisa Regional)",
      tambah_mu_higher:"Serap Madya & Utama (dari RS Kompetensi Lebih Tinggi)",
      tambah_d_reg:"Serap Dasar (dari Sisa Regional)",
      tambah_d_higher:"Serap Dasar (dari RS Kompetensi Lebih Tinggi)",
    };
    const KL={
      kurang_dm:"Lepas Dasar & Madya (dari Eksisting RS Target)",
      kurang_up:"Lepas Utama & Paripurna (dari Eksisting RS Target)",
      kurang_dp:"Lepas Dasar & Paripurna (dari Eksisting RS Target)",
      kurang_mup:"Lepas Madya, Utama & Paripurna (dari Eksisting RS Target)",
    };
    const SCN=["Optimistik","Proporsional","Konservatif"];
    const used=new Set();
    const wb=XLSX.utils.book_new();
    wb.Props={
      Title:`Kertas Kerja Audit Simulasi Global - ${target.name}`,
      Author:"Kementerian Kesehatan RI",
      CreatedDate:new Date(),
    };
    function app(ws,name){const nm=safeSheet(name,used);XLSX.utils.book_append_sheet(wb,ws,nm);return nm;}

    /* --- SHEET 00: INFO GLOBAL --- */
    (function(){
      const pct0=Math.round(globalSimScenarios[0]*100)+"%";
      const pct1=Math.round(globalSimScenarios[1]*100)+"%";
      const pct2=Math.round(globalSimScenarios[2]*100)+"%";
      const kpct0=Math.round(globalSimKurangScenarios[0]*100)+"%";
      const kpct1=Math.round(globalSimKurangScenarios[1]*100)+"%";
      const kpct2=Math.round(globalSimKurangScenarios[2]*100)+"%";
      const rows=[
        [`KERTAS KERJA AUDIT SIMULASI GLOBAL - ${target.name}`,"","",""],
        ["","","",""],
        ["IDENTITAS ANALISIS","NILAI","",""],
        ["Nama RS Target",target.name,"",""],
        ["Kode RS Target",target.code,"",""],
        ["Kelas RS",target.class||"-","",""],
        ["Kab/Kota",target.city||"-","",""],
        ["Tanggal Ekspor",new Date().toLocaleString("id-ID"),"",""],
        ["","","",""],
        ["PARAMETER SIMULASI AKTIF","NILAI","",""],
        ["Dataset / Periode",datasetLabel||"-","",""],
        ["Skenario Tarif iDRG",tariffLabel||"-","",""],
        ["Mode Penambah Kasus (+)",ML[tambahMode]||tambahMode,"",""],
        ["Mode Pengurang Kasus (-)",KL[kurangMode]||kurangMode,"",""],
        ["Filter Aktif",filterDesc||"Tidak ada filter (Semua RS regional)","",""],
        ["Total RS Regional",totalCompetitors,"",""],
        ["Jumlah Layanan Dianalisis",data.services.length,"",""],
        ["","","",""],
        ["PARAMETER SKENARIO","% Serapan Tambah","% Pelepasan Kurang","Keterangan"],
        ["Skenario 1 - Optimistik",pct0,kpct0,"Target serapan dan pelepasan kasus maksimum"],
        ["Skenario 2 - Proporsional",pct1,kpct1,"Market share alami = 1/(N_kompetitor+1)"],
        ["Skenario 3 - Konservatif",pct2,kpct2,"Setengah dari market share alami"],
        ["","","",""],
        ["ALUR AUDIT WORKBOOK","KETERANGAN","",""],
        ["01_Data_Regional","Data kasus & pendapatan regional per layanan per tingkat keparahan","",""],
        ["02_Audit_Per_Layanan","Potensi tambah/kurang per layanan + breakdown D/M/U/P","",""],
        ["03_Skenario_Global","Tabel 3-skenario x seluruh layanan","",""],
        ["04_Rekap_Layanan","Ringkasan net kasus & pendapatan per layanan, ketiga skenario","",""],
        ["99_Rekonsiliasi","Cek silang: total simulasi vs total sumber data","",""],
        ["","","",""],
        ["KONVENSI WARNA","ARTI","",""],
        ["Toska (header)","Data sumber tidak untuk diedit","",""],
        ["Hijau muda","Penambahan kasus dan pendapatan (+)","",""],
        ["Merah muda","Pengurangan kasus dan pendapatan (-)","",""],
        ["Kuning","Parameter input / sel yang dapat diubah","",""],
        ["Ungu muda","Hasil akhir / nilai pasca simulasi","",""],
      ];
      const ws=XLSX.utils.aoa_to_sheet(rows);
      ws["!merges"]=[
        {s:{r:0,c:0},e:{r:0,c:3}},
      ];
      styleCell(ws["A1"],{fill:C.teal,fontColor:C.white,bold:true,size:15,border:false});
      styleRange(XLSX,ws,"A3:B3",{fill:C.tealDeep,fontColor:C.white,bold:true});
      styleRange(XLSX,ws,"A4:B8",{fill:C.blueSoft});
      styleRange(XLSX,ws,"B4:B8",{bold:true});
      styleRange(XLSX,ws,"A10:B10",{fill:C.tealDeep,fontColor:C.white,bold:true});
      styleRange(XLSX,ws,"A11:B17",{fill:C.blueSoft});
      styleRange(XLSX,ws,"B11:B17",{bold:true});
      styleRange(XLSX,ws,"A19:D19",{fill:C.tealDeep,fontColor:C.white,bold:true});
      styleRange(XLSX,ws,"A20:D22",{fill:C.yellow});
      styleRange(XLSX,ws,"A24:B24",{fill:C.tealDeep,fontColor:C.white,bold:true});
      styleRange(XLSX,ws,"A25:B29",{fill:C.light});
      styleRange(XLSX,ws,"A31:B31",{fill:C.tealDeep,fontColor:C.white,bold:true});
      styleRange(XLSX,ws,"A32:B36",{fill:C.light});
      setDefaults(ws,[38,62,24,56],0);
      app(ws,"00_Info_Global");
    })();

    /* --- SHEET 01: DATA REGIONAL --- */
    const regRowMap={};
    let regSheetName="";
    (function(){
      const HDR=["No","Kode Layanan","Nama Layanan","Tingkat","Keparahan",
        "Kasus Regional","INA-CBG Regional","iDRG Regional",
        "Kasus Target","INA Target","iDRG Target",
        "Potensi Tambah Kasus","Potensi Tambah iDRG"];
      const rows=[HDR];
      let no=1;
      data.services.forEach(svc=>{
        regRowMap[svc]={};
        [1,2,3,4].forEach(rank=>{
          const rM=severityMetric(data.regional?.services?.[svc],rank);
          const tM=severityMetric(target.services?.[svc],rank);
          const exR=rows.length;
          regRowMap[svc][rank]=exR+1;
          const extK=Math.max(0,(Number(rM[CASES])||0)-(Number(tM[CASES])||0));
          const extIdrg=Math.max(0,(Number(rM[IDRG])||0)-(Number(tM[IDRG])||0));
          rows.push([
            rank===1?no++:"", rank===1?svc:"", rank===1?formatService(svc):"",
            rank, LN[rank],
            Number(rM[CASES])||0, Number(rM[INA])||0, Number(rM[IDRG])||0,
            Number(tM[CASES])||0, Number(tM[INA])||0,  Number(tM[IDRG])||0,
            fml(`MAX(F${exR+1}-I${exR+1},0)`,extK,FMT_NUM),
            fml(`MAX(H${exR+1}-K${exR+1},0)`,extIdrg,FMT_MONEY),
          ]);
        });
      });
      const ws=XLSX.utils.aoa_to_sheet(rows);
      addTitle(XLSX,ws,"01 DATA REGIONAL - Kasus & Pendapatan per Layanan per Tingkat Keparahan",HDR.length);
      hdrRow(XLSX,ws,HDR,1,C.tealDeep);
      writeAoa(XLSX,ws,rows.slice(1),1);
      const L=rows.length;
      styleRange(XLSX,ws,{s:{r:1,c:0},e:{r:L,c:2}},{fill:C.blueSoft});
      styleRange(XLSX,ws,{s:{r:1,c:3},e:{r:L,c:7}},{fill:C.light});
      styleRange(XLSX,ws,{s:{r:1,c:8},e:{r:L,c:10}},{fill:C.blueSoft});
      styleRange(XLSX,ws,{s:{r:1,c:11},e:{r:L,c:12}},{fill:C.greenSoft});
      ws["!autofilter"]={ref:`A2:M${L+1}`};
      setDefaults(ws,[6,28,36,10,15,16,20,20,16,20,20,20,22],2);
      regSheetName=app(ws,"01_Data_Regional");
    })();

    /* --- SHEET 02: AUDIT PER LAYANAN --- */
    let auditSheetName="";
    (function(){
      const HDR=["No","Kode Layanan","Nama Layanan","Kompetensi Target",
        "Kasus Dasar","Kasus Madya","Kasus Utama","Kasus Paripurna","Total Kasus Eksisting",
        "iDRG Dasar","iDRG Madya","iDRG Utama","iDRG Paripurna","Total iDRG Eksisting",
        "Pool Tambah Kasus (mode aktif)","Pool Tambah iDRG (mode aktif)",
        "Pool Kurang Kasus (mode aktif)","Pool Kurang iDRG (mode aktif)",
        "MS Kasus Eksisting (%)","MS iDRG Eksisting (%)","Jml Kompetitor","Keterangan Mode"];
      const rows=[HDR];
      let no=1;
      data.services.forEach(svc=>{
        const srvT=target.services?.[svc];
        const tComp=getCompetency(target,svc);
        const tD=severityMetric(srvT,1),tM2=severityMetric(srvT,2),tU=severityMetric(srvT,3),tP=severityMetric(srvT,4);
        const rTot=data.regional?.services?.[svc]?.total||[0,0,0];
        const totK=(tD[CASES]||0)+(tM2[CASES]||0)+(tU[CASES]||0)+(tP[CASES]||0);
        const totIdrg=(tD[IDRG]||0)+(tM2[IDRG]||0)+(tU[IDRG]||0)+(tP[IDRG]||0);
        const regK=Number(rTot[CASES])||0, regIdrg=Number(rTot[IDRG])||0;
        const {addK,addIdrg,redK,redIdrg}=computePool(svc,tambahMode,kurangMode,target,data,CASES,INA,IDRG,severityMetric,getCompetency);
        const compCnt=data.hospitals.filter(h=>h.code!==target.code&&getCompetency(h,svc)>0).length;
        const msK=regK>0?totK/regK:0, msIdrg=regIdrg>0?totIdrg/regIdrg:0;
        rows.push([
          no++, svc, formatService(svc), LN[tComp]||"Tidak Kompeten",
          nFmt(tD[CASES],FMT_NUM), nFmt(tM2[CASES],FMT_NUM), nFmt(tU[CASES],FMT_NUM), nFmt(tP[CASES],FMT_NUM), nFmt(totK,FMT_NUM),
          nFmt(tD[IDRG],FMT_MONEY), nFmt(tM2[IDRG],FMT_MONEY), nFmt(tU[IDRG],FMT_MONEY), nFmt(tP[IDRG],FMT_MONEY), nFmt(totIdrg,FMT_MONEY),
          nFmt(addK,FMT_NUM), nFmt(addIdrg,FMT_MONEY),
          nFmt(redK,FMT_NUM), nFmt(redIdrg,FMT_MONEY),
          nFmt(msK,FMT_PCT), nFmt(msIdrg,FMT_PCT),
          nFmt(compCnt,FMT_NUM),
          s(`Tambah: ${ML[tambahMode]||tambahMode}; Kurang: ${KL[kurangMode]||kurangMode}`),
        ]);
      });
      const ws=XLSX.utils.aoa_to_sheet(rows);
      addTitle(XLSX,ws,"02 AUDIT PER LAYANAN - Potensi Tambah & Kurang sesuai Mode Simulasi Aktif",HDR.length);
      hdrRow(XLSX,ws,HDR,1,C.tealDeep);
      writeAoa(XLSX,ws,rows.slice(1),1);
      const L=rows.length;
      styleRange(XLSX,ws,{s:{r:1,c:0},e:{r:L,c:3}},{fill:C.blueSoft});
      styleRange(XLSX,ws,{s:{r:1,c:4},e:{r:L,c:13}},{fill:C.light});
      styleRange(XLSX,ws,{s:{r:1,c:14},e:{r:L,c:15}},{fill:C.greenSoft});
      styleRange(XLSX,ws,{s:{r:1,c:16},e:{r:L,c:17}},{fill:C.redSoft});
      styleRange(XLSX,ws,{s:{r:1,c:18},e:{r:L,c:19}},{fill:C.purpleSoft});
      styleRange(XLSX,ws,{s:{r:1,c:20},e:{r:L,c:21}},{fill:C.light});
      ws["!autofilter"]={ref:`A2:V${L+1}`};
      setDefaults(ws,[5,28,36,18,13,13,13,13,16,18,18,18,18,20,22,22,22,22,18,18,16,52],2);
      auditSheetName=app(ws,"02_Audit_Per_Layanan");
    })();

    /* --- SHEET 03: SKENARIO GLOBAL --- */
    let scnSheetName="";
    (function(){
      const HDR=["No","Kode Layanan","Nama Layanan","Kompetensi Target",
        "Skenario","% Serapan Tambah","% Pelepasan Kurang",
        "Kasus Eksisting","iDRG Eksisting",
        "Tambah Kasus","Tambah iDRG",
        "Kurang Kasus","Kurang iDRG",
        "Net Kasus","Net iDRG","% Net thd Eksisting",
        "Proyeksi Kasus","Proyeksi iDRG",
        "Market Share Kasus Pasca (%)","Market Share iDRG Pasca (%)"];
      const rows=[HDR];
      let no=1;
      data.services.forEach(svc=>{
        const srvT=target.services?.[svc];
        const tComp=getCompetency(target,svc);
        let eksK=0,eksIdrg=0;
        [1,2,3,4].forEach(rank=>{const m=severityMetric(srvT,rank);eksK+=m[CASES]||0;eksIdrg+=m[IDRG]||0;});
        const rTot=data.regional?.services?.[svc]?.total||[0,0,0];
        const regK=Number(rTot[CASES])||0, regIdrg=Number(rTot[IDRG])||0;
        const {addK,addIdrg,redK,redIdrg}=computePool(svc,tambahMode,kurangMode,target,data,CASES,INA,IDRG,severityMetric,getCompetency);
        globalSimScenarios.forEach((pA,si)=>{
          const pR=globalSimKurangScenarios[si]!==undefined?globalSimKurangScenarios[si]:1.0;
          const tK=Math.round(addK*pA), tIdrg=addIdrg*pA;
          const kK=Math.round(redK*pR), kIdrg=redIdrg*pR;
          const netK=tK-kK, netIdrg=tIdrg-kIdrg;
          const pctNet=eksK>0?netK/eksK:0;
          const proyK=eksK+netK, proyIdrg=eksIdrg+netIdrg;
          const msKP=regK>0?proyK/regK:0, msIP=regIdrg>0?proyIdrg/regIdrg:0;
          rows.push([
            si===0?no:"", si===0?svc:"", si===0?formatService(svc):"", si===0?(LN[tComp]||"Tidak Kompeten"):"",
            s(SCN[si]||`Skenario ${si+1}`),
            nFmt(pA,FMT_PCT), nFmt(pR,FMT_PCT),
            nFmt(eksK,FMT_NUM), nFmt(eksIdrg,FMT_MONEY),
            nFmt(tK,FMT_NUM), nFmt(tIdrg,FMT_MONEY),
            nFmt(kK,FMT_NUM), nFmt(kIdrg,FMT_MONEY),
            nFmt(netK,FMT_NUM), nFmt(netIdrg,FMT_MONEY), nFmt(pctNet,FMT_PCT),
            nFmt(proyK,FMT_NUM), nFmt(proyIdrg,FMT_MONEY),
            nFmt(msKP,FMT_PCT), nFmt(msIP,FMT_PCT),
          ]);
        });
        no++;
      });
      const ws=XLSX.utils.aoa_to_sheet(rows);
      addTitle(XLSX,ws,"03 SKENARIO GLOBAL - 3 Skenario x Seluruh Layanan (Optimistik / Proporsional / Konservatif)",HDR.length);
      hdrRow(XLSX,ws,HDR,1,C.tealDeep);
      writeAoa(XLSX,ws,rows.slice(1),1);
      const L=rows.length;
      styleRange(XLSX,ws,{s:{r:1,c:0},e:{r:L,c:3}},{fill:C.blueSoft});
      styleRange(XLSX,ws,{s:{r:1,c:4},e:{r:L,c:6}},{fill:C.yellow});
      styleRange(XLSX,ws,{s:{r:1,c:7},e:{r:L,c:8}},{fill:C.light});
      styleRange(XLSX,ws,{s:{r:1,c:9},e:{r:L,c:10}},{fill:C.greenSoft});
      styleRange(XLSX,ws,{s:{r:1,c:11},e:{r:L,c:12}},{fill:C.redSoft});
      styleRange(XLSX,ws,{s:{r:1,c:13},e:{r:L,c:15}},{fill:C.light,bold:true});
      styleRange(XLSX,ws,{s:{r:1,c:16},e:{r:L,c:17}},{fill:C.purpleSoft,bold:true});
      styleRange(XLSX,ws,{s:{r:1,c:18},e:{r:L,c:19}},{fill:C.purpleSoft});
      ws["!autofilter"]={ref:`A2:T${L+1}`};
      setDefaults(ws,[5,28,36,18,15,16,18,18,20,16,20,16,20,16,20,18,20,22,20,22],2);
      scnSheetName=app(ws,"03_Skenario_Global");
    })();

    /* --- SHEET 04: REKAP LAYANAN --- */
    (function(){
      const HDR=["No","Kode Layanan","Nama Layanan","Kompetensi Target",
        "Kasus Eksisting","iDRG Eksisting",
        "Net Kasus - Opt","Net iDRG - Opt","Proyeksi Kasus Opt","Proyeksi iDRG Opt",
        "Net Kasus - Prop","Net iDRG - Prop","Proyeksi Kasus Prop","Proyeksi iDRG Prop",
        "Net Kasus - Kons","Net iDRG - Kons","Proyeksi Kasus Kons","Proyeksi iDRG Kons",
        "Rentang Net Kasus","Rentang Net iDRG","Skenario Terbaik (iDRG)"];
      const rows=[HDR];
      let no=1;
      data.services.forEach(svc=>{
        const srvT=target.services?.[svc];
        const tComp=getCompetency(target,svc);
        let eksK=0,eksIdrg=0;
        [1,2,3,4].forEach(rank=>{const m=severityMetric(srvT,rank);eksK+=m[CASES]||0;eksIdrg+=m[IDRG]||0;});
        const {addK,addIdrg,redK,redIdrg}=computePool(svc,tambahMode,kurangMode,target,data,CASES,INA,IDRG,severityMetric,getCompetency);
        const scnD=globalSimScenarios.map((pA,si)=>{
          const pR=globalSimKurangScenarios[si]!==undefined?globalSimKurangScenarios[si]:1.0;
          const nK=Math.round(addK*pA)-Math.round(redK*pR);
          const nIdrg=addIdrg*pA-redIdrg*pR;
          return{nK,nIdrg,proyK:eksK+nK,proyIdrg:eksIdrg+nIdrg};
        });
        const allNK=scnD.map(x=>x.nK), allNIdrg=scnD.map(x=>x.nIdrg);
        const minNK=Math.min(...allNK), maxNK=Math.max(...allNK);
        const minNIdrg=Math.min(...allNIdrg), maxNIdrg=Math.max(...allNIdrg);
        const bestIdx=allNIdrg.indexOf(Math.max(...allNIdrg));
        const fRng=(mn,mx,isRp)=>{
          if(mn===0&&mx===0)return"-";
          const fmt=v=>isRp?`${v>=0?"+":"-"} ${fmtM(Math.abs(v))}`:`${v>=0?"+":"-"} ${fmtN(Math.abs(v))}`;
          return mn===mx?fmt(mn):`${fmt(mn)} s.d. ${fmt(mx)}`;
        };
        rows.push([
          no++, svc, formatService(svc), LN[tComp]||"Tidak Kompeten",
          nFmt(eksK,FMT_NUM), nFmt(eksIdrg,FMT_MONEY),
          nFmt(scnD[0].nK,FMT_NUM), nFmt(scnD[0].nIdrg,FMT_MONEY), nFmt(scnD[0].proyK,FMT_NUM), nFmt(scnD[0].proyIdrg,FMT_MONEY),
          nFmt(scnD[1].nK,FMT_NUM), nFmt(scnD[1].nIdrg,FMT_MONEY), nFmt(scnD[1].proyK,FMT_NUM), nFmt(scnD[1].proyIdrg,FMT_MONEY),
          nFmt(scnD[2].nK,FMT_NUM), nFmt(scnD[2].nIdrg,FMT_MONEY), nFmt(scnD[2].proyK,FMT_NUM), nFmt(scnD[2].proyIdrg,FMT_MONEY),
          s(fRng(minNK,maxNK,false)), s(fRng(minNIdrg,maxNIdrg,true)),
          s(SCN[bestIdx]||`Skenario ${bestIdx+1}`),
        ]);
      });
      const ws=XLSX.utils.aoa_to_sheet(rows);
      addTitle(XLSX,ws,"04 REKAP LAYANAN - Ringkasan Net Kasus & Pendapatan per Layanan (Ketiga Skenario)",HDR.length);
      hdrRow(XLSX,ws,HDR,1,C.tealDeep);
      writeAoa(XLSX,ws,rows.slice(1),1);
      const L=rows.length;
      styleRange(XLSX,ws,{s:{r:1,c:0},e:{r:L,c:3}},{fill:C.blueSoft});
      styleRange(XLSX,ws,{s:{r:1,c:4},e:{r:L,c:5}},{fill:C.light});
      styleRange(XLSX,ws,{s:{r:1,c:6},e:{r:L,c:9}},{fill:C.greenSoft});
      styleRange(XLSX,ws,{s:{r:1,c:10},e:{r:L,c:13}},{fill:C.orangeSoft});
      styleRange(XLSX,ws,{s:{r:1,c:14},e:{r:L,c:17}},{fill:C.redSoft});
      styleRange(XLSX,ws,{s:{r:1,c:18},e:{r:L,c:20}},{fill:C.purpleSoft,bold:true});
      ws["!autofilter"]={ref:`A2:U${L+1}`};
      setDefaults(ws,[5,28,36,18,18,22,16,22,18,22,16,22,18,22,16,22,18,22,30,30,20],2);
      app(ws,"04_Rekap_Layanan");
    })();

    /* --- SHEET 99: REKONSILIASI --- */
    (function(){
      const HDR=["No","Kode Layanan","Nama Layanan",
        "Kasus Eksisting (Sumber)","iDRG Eksisting (Sumber)",
        "Pool Tambah Kasus","Pool Tambah iDRG",
        "Pool Kurang Kasus","Pool Kurang iDRG",
        "Net Kasus S1","Net iDRG S1","Net Kasus S2","Net iDRG S2","Net Kasus S3","Net iDRG S3",
        "Cek Logika","Status"];
      const rows=[HDR];
      let no=1;
      let gEksK=0,gEksIdrg=0,gAddK=0,gAddIdrg=0,gRedK=0,gRedIdrg=0;
      const gNet=[0,0,0],gNetIdrg=[0,0,0];
      data.services.forEach(svc=>{
        const srvT=target.services?.[svc];
        let eksK=0,eksIdrg=0;
        [1,2,3,4].forEach(rank=>{const m=severityMetric(srvT,rank);eksK+=m[CASES]||0;eksIdrg+=m[IDRG]||0;});
        const {addK,addIdrg,redK,redIdrg}=computePool(svc,tambahMode,kurangMode,target,data,CASES,INA,IDRG,severityMetric,getCompetency);
        const nets=globalSimScenarios.map((pA,si)=>{
          const pR=globalSimKurangScenarios[si]!==undefined?globalSimKurangScenarios[si]:1.0;
          return{nK:Math.round(addK*pA)-Math.round(redK*pR),nIdrg:addIdrg*pA-redIdrg*pR};
        });
        const cek=(Math.round(addK*globalSimScenarios[0])-Math.round(redK*(globalSimKurangScenarios[0]||1)))===nets[0].nK;
        gEksK+=eksK;gEksIdrg+=eksIdrg;
        gAddK+=addK;gAddIdrg+=addIdrg;
        gRedK+=redK;gRedIdrg+=redIdrg;
        nets.forEach((n,i)=>{gNet[i]+=n.nK;gNetIdrg[i]+=n.nIdrg;});
        rows.push([
          no++, svc, formatService(svc),
          nFmt(eksK,FMT_NUM), nFmt(eksIdrg,FMT_MONEY),
          nFmt(addK,FMT_NUM), nFmt(addIdrg,FMT_MONEY),
          nFmt(redK,FMT_NUM), nFmt(redIdrg,FMT_MONEY),
          nFmt(nets[0].nK,FMT_NUM), nFmt(nets[0].nIdrg,FMT_MONEY),
          nFmt(nets[1].nK,FMT_NUM), nFmt(nets[1].nIdrg,FMT_MONEY),
          nFmt(nets[2].nK,FMT_NUM), nFmt(nets[2].nIdrg,FMT_MONEY),
          s(cek?"OK":"PERIKSA"), s(cek?"PASS":"FAIL"),
        ]);
      });
      // Grand total row
      rows.push([
        "TOTAL","","Agregat Seluruh Layanan",
        nFmt(gEksK,FMT_NUM), nFmt(gEksIdrg,FMT_MONEY),
        nFmt(gAddK,FMT_NUM), nFmt(gAddIdrg,FMT_MONEY),
        nFmt(gRedK,FMT_NUM), nFmt(gRedIdrg,FMT_MONEY),
        nFmt(gNet[0],FMT_NUM), nFmt(gNetIdrg[0],FMT_MONEY),
        nFmt(gNet[1],FMT_NUM), nFmt(gNetIdrg[1],FMT_MONEY),
        nFmt(gNet[2],FMT_NUM), nFmt(gNetIdrg[2],FMT_MONEY),
        s("-"), s("GRAND TOTAL"),
      ]);
      const ws=XLSX.utils.aoa_to_sheet(rows);
      addTitle(XLSX,ws,"99 REKONSILIASI - Cek Silang Hasil Simulasi vs Data Sumber",HDR.length);
      hdrRow(XLSX,ws,HDR,1,C.tealDeep);
      writeAoa(XLSX,ws,rows.slice(1),1);
      const L=rows.length;
      styleRange(XLSX,ws,{s:{r:1,c:0},e:{r:L,c:2}},{fill:C.blueSoft});
      styleRange(XLSX,ws,{s:{r:1,c:3},e:{r:L,c:4}},{fill:C.light});
      styleRange(XLSX,ws,{s:{r:1,c:5},e:{r:L,c:6}},{fill:C.greenSoft});
      styleRange(XLSX,ws,{s:{r:1,c:7},e:{r:L,c:8}},{fill:C.redSoft});
      styleRange(XLSX,ws,{s:{r:1,c:9},e:{r:L,c:14}},{fill:C.light});
      styleRange(XLSX,ws,{s:{r:1,c:15},e:{r:L,c:15}},{fill:C.yellow});
      styleRange(XLSX,ws,{s:{r:1,c:16},e:{r:L,c:16}},{fill:C.greenSoft,bold:true,align:"center"});
      // Total row bold
      styleRange(XLSX,ws,{s:{r:L,c:0},e:{r:L,c:16}},{fill:C.tealDeep,fontColor:C.white,bold:true});
      ws["!autofilter"]={ref:`A2:Q${L}`};
      setDefaults(ws,[5,28,36,18,22,18,22,18,22,16,22,16,22,16,22,18,14],2);
      app(ws,"99_Rekonsiliasi");
    })();

    return wb;
  }

  /* ===================== EXPORT ===================== */
  function exportGlobalSimWorkbook(ctx){
    const wb=buildGlobalSimWorkbook(ctx);
    const safe=String(ctx.target.name||"RS_Target").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
    const fileName=`Kertas_Kerja_Audit_SimGlobal_${safe}.xlsx`;
    ctx.XLSX.writeFile(wb,fileName,{compression:true,bookType:"xlsx"});
    return{workbook:wb,fileName};
  }

  global.GlobalSimExcel={buildGlobalSimWorkbook,exportGlobalSimWorkbook};
})(window);
