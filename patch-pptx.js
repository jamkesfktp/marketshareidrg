const fs = require('fs');

let content = fs.readFileSync('js/export-gslides.js', 'utf8');

const startIdx = content.indexOf('  function buildRecapSlide(pptx, appState) {');
const endIdx = content.indexOf('  function buildCoverSlide', startIdx);

const before = content.substring(0, startIdx);
const after = content.substring(endIdx);

const newRender = `  function buildRecapSlide(pptx, appState) {
    var data=appState.data, state=appState.state, target=appState.target;
    var services=appState.services;
    var CASES=appState.CASES, INA=appState.INA, IDRG=appState.IDRG, dateStr=appState.dateStr;

    var slide=pptx.addSlide();
    slide.background={color:C.bgray};

    /* ── Header ── */
    slide.addShape("rect",{x:0,y:0,w:W,h:0.50,fill:{color:C.teal},line:{color:C.teal}});
    slide.addText("Rekap Simulasi Seluruh Layanan — "+target.name,{
      x:0.18,y:0,w:9.5,h:0.50,fontSize:13,bold:true,color:C.white,valign:"middle"
    });
    slide.addShape("rect",{x:W-2.8,y:0.04,w:2.62,h:0.42,fill:{color:C.redD},line:{color:C.redD}});
    slide.addText("Data Mirroring Uji Coba iDRG\\n"+dateStr,{
      x:W-2.8,y:0.04,w:2.62,h:0.42,fontSize:6.5,color:C.white,align:"center",valign:"middle"
    });

    /* ── Sub-header KPI strip ── */
    var tHosp=data.hospitals&&data.hospitals.find(function(h){return h.code===target.code;});
    var tTotal=tHosp&&tHosp.total||[0,0,0];
    var rTotal=data.regional&&data.regional.total||[0,0,0];
    var msAll=rTotal[CASES]?tTotal[CASES]/rTotal[CASES]:0;

    var kpiY=0.54, kpiH=0.42;
    var kpis=[
      {lbl:"Total Kasus RS Target",val:num(tTotal[CASES]),color:C.teal},
      {lbl:"Total Kasus Regional",val:num(rTotal[CASES]),color:C.green},
      {lbl:"Market Share Keseluruhan",val:pct(msAll),color:"f59e0b"},
      {lbl:"Jumlah Layanan",val:String(services.length)+" Layanan",color:"6d28d9"},
    ];
    var kpiW=(W-0.24)/kpis.length;
    kpis.forEach(function(k,i){
      var kx=0.12+i*kpiW;
      slide.addShape("rect",{x:kx,y:kpiY,w:kpiW-0.06,h:kpiH,fill:{color:C.white},line:{color:C.lgray,pt:0.5}});
      slide.addShape("rect",{x:kx,y:kpiY,w:kpiW-0.06,h:0.05,fill:{color:k.color},line:{color:k.color}});
      slide.addText(k.lbl,{x:kx+0.06,y:kpiY+0.06,w:kpiW-0.18,h:0.13,fontSize:6,color:"64748b"});
      slide.addText(k.val,{x:kx+0.06,y:kpiY+0.19,w:kpiW-0.18,h:0.20,fontSize:13,bold:true,color:k.color});
    });

    var rows=[];
    rows.push([
      {text:"No",          options:hG(C.tealL, 2)},
      {text:"Layanan",     options:Object.assign({},hG(C.tealL, 2),{align:"left"})},
      {text:"Komp.",       options:hG(C.tealL, 2)},
      {text:"Dampak per Tingkat Kompetensi (Rentang Kasus & Rp M)", options:Object.assign({},hG("16a085"),{colspan:4})},
      {text:"Net +/- Pasca iDRG & RBKP", options:Object.assign({},hG("0e7490"),{colspan:3})},
      {text:"Eksisting\\nINA-CBG\\n(Rp M)", options:hG("1e40af", 2)},
      {text:"% Kenaikan\\nthd INA-CBG", options:hG("1e40af", 2)},
    ]);
    rows.push([
      {text:"Paripurna", options:hG("20b2aa")},
      {text:"Utama",     options:hG("20b2aa")},
      {text:"Madya",     options:hG("20b2aa")},
      {text:"Dasar",     options:hG("20b2aa")},
      {text:"+/- Jml Kasus", options:hG("0284c7")},
      {text:"% thd\\nEksisting", options:hG("0284c7")},
      {text:"+/- Net Rp (M)", options:hG("0284c7")},
    ]);

    services.forEach(function(service, idx){
      var tHospSvc = tHosp&&tHosp.services&&tHosp.services[service];
      var svcData  = data.regional&&data.regional.services&&data.regional.services[service];
      var tSvc     = tHospSvc;
      var tSvcTotal= tSvc&&tSvc.total||[0,0,0];
      var rSvcTotal= svcData&&svcData.total||[0,0,0];

      var tKasus=tSvcTotal[CASES]||0;
      var rKasus=rSvcTotal[CASES]||0;
      var existingIna=tSvcTotal[INA]||0;

      var targetCompetency=tSvc?(tSvc.competency||0):0;
      var rules=getLevelRules(targetCompetency);

      var baseTambahan={1:[0,0],2:[0,0],3:[0,0],4:[0,0]};
      var basePengurangan={1:[0,0],2:[0,0],3:[0,0],4:[0,0]};
      rules.tambah.forEach(function(lvl){
        var rM=severityMetric(svcData,lvl), tM=severityMetric(tSvc,lvl);
        baseTambahan[lvl][0]=Math.max(0,(rM[CASES]||0)-(tM[CASES]||0));
        baseTambahan[lvl][1]=Math.max(0,(rM[IDRG]||0)-(tM[IDRG]||0));
      });
      rules.kurang.forEach(function(lvl){
        var tM=severityMetric(tSvc,lvl);
        basePengurangan[lvl][0]=tM[CASES]||0;
        basePengurangan[lvl][1]=tM[INA]||0;
      });

      var scenarios=(state&&state.serviceScenarios&&state.serviceScenarios[service])||[];
      if(!scenarios||scenarios.length===0){
        scenarios=[];
        for(var si=0;si<6;si++){
          var scn={};
          rules.tambah.forEach(function(lvl){
            var lvlComp=data.hospitals.filter(function(h){return h.code!==target.code&&getCompetency(h,service)>=lvl;}).length;
            var base=lvlComp>0?Math.min(50,100/(lvlComp+1)):50;
            scn["tambah_"+lvl]=parseFloat(Math.min(100,Math.max(0,base+si*10)).toFixed(1));
          });
          rules.kurang.forEach(function(lvl){
            scn["kurang_"+lvl]=(lvl>targetCompetency||lvl===4)?100:90;
          });
          scenarios.push(scn);
        }
      }

      var allDampak = { 4: {k:[],rp:[]}, 3: {k:[],rp:[]}, 2: {k:[],rp:[]}, 1: {k:[],rp:[]} };
      var allNetK = [], allNetRp = [];
      
      scenarios.forEach(function(scn){
        var totalNetK=0, totalNetRp=0;
        [4,3,2,1].forEach(function(lvl){
          var k=0, rp=0;
          if(rules.tambah.indexOf(lvl) !== -1 && scn.hasOwnProperty("tambah_"+lvl)) {
            var pp = scn["tambah_"+lvl]/100;
            k = (baseTambahan[lvl][0]||0) * pp;
            rp = (baseTambahan[lvl][1]||0) * pp;
          } else if(rules.kurang.indexOf(lvl) !== -1 && scn.hasOwnProperty("kurang_"+lvl)) {
            var pk = scn["kurang_"+lvl]/100;
            k = -((basePengurangan[lvl][0]||0) * pk);
            rp = -((basePengurangan[lvl][1]||0) * pk);
          }
          allDampak[lvl].k.push(k);
          allDampak[lvl].rp.push(rp);
          totalNetK += k;
          totalNetRp += rp;
        });
        allNetK.push(totalNetK);
        allNetRp.push(totalNetRp);
      });

      var bg=idx%2===0?C.bgray:C.white;
      function dO(extra){ return Object.assign({fontSize:6,fill:{color:bg},align:"center",valign:"middle"},extra||{}); }

      function formatCellArr(minV, maxV, isRp) {
        if (minV === 0 && maxV === 0) return [{text:"-", options:dO({color:"cbd5e1"})}];
        var isMinPos = minV > 0;
        var isMaxPos = maxV > 0;
        var color = (isMinPos || isMaxPos) ? "15803d" : "b91c1c";
        var signMin = minV > 0 ? "+" : (minV < 0 ? "-" : "");
        var signMax = maxV > 0 ? "+" : (maxV < 0 ? "-" : "");
        
        var tMin = isRp ? (Math.abs(minV)/1000000000).toFixed(1)+" M" : num(Math.abs(minV),0);
        var tMax = isRp ? (Math.abs(maxV)/1000000000).toFixed(1)+" M" : num(Math.abs(maxV),0);
        
        if (minV === maxV) {
          return [{text: signMin + " " + tMin, options: dO({color:color, bold:true})}];
        } else {
          return [
            {text: signMin + " " + tMin + " ", options: dO({color:color, bold:true})},
            {text: "s.d ", options: dO({color:"94a3b8", fontSize:5.5})},
            {text: signMax + " " + tMax, options: dO({color:color, bold:true})}
          ];
        }
      }

      var rowCells = [
        {text:String(idx+1), options:dO({color:"94a3b8"})},
        {text:service, options:dO({align:"left",bold:true,fontSize:6,wrap:true})},
        {text:["","Dsr","Mdy","Utm","Prp"][targetCompetency]||"-", options:dO({fontSize:6})}
      ];

      [4,3,2,1].forEach(function(lvl){
        var minK = Math.min.apply(null, allDampak[lvl].k);
        var maxK = Math.max.apply(null, allDampak[lvl].k);
        var minRp = Math.min.apply(null, allDampak[lvl].rp);
        var maxRp = Math.max.apply(null, allDampak[lvl].rp);

        if (minK === 0 && maxK === 0) {
          rowCells.push({text:"-", options:dO({color:"cbd5e1"})});
        } else {
          var arrK = formatCellArr(minK, maxK, false);
          arrK.push({text:"\\n", options:dO()});
          var arrRp = formatCellArr(minRp, maxRp, true);
          rowCells.push({text: arrK.concat(arrRp), options:dO()});
        }
      });

      var minNetK = Math.min.apply(null, allNetK);
      var maxNetK = Math.max.apply(null, allNetK);
      var minNetRp = Math.min.apply(null, allNetRp);
      var maxNetRp = Math.max.apply(null, allNetRp);

      var minPctK = tKasus ? minNetK/tKasus : 0;
      var maxPctK = tKasus ? maxNetK/tKasus : 0;
      var minPctRp = existingIna ? minNetRp/existingIna : 0;
      var maxPctRp = existingIna ? maxNetRp/existingIna : 0;
      
      rowCells.push({text: formatCellArr(minNetK, maxNetK, false), options:dO({fill:{color:"f0f9ff"}})});
      rowCells.push({text: formatCellArr(minPctK*100, maxPctK*100, false).map(function(c){ c.text=c.text.replace(" M","")+"%"; return c;}), options:dO({fill:{color:"f0f9ff"}})});
      rowCells.push({text: formatCellArr(minNetRp, maxNetRp, true), options:dO({fill:{color:"f0f9ff"}})});
      
      rowCells.push({text: (existingIna/1000000000).toFixed(1)+" M", options:dO({fill:{color:"fbfccb"}, color:"854d0e", bold:true})});
      
      rowCells.push({text: formatCellArr(minPctRp*100, maxPctRp*100, false).map(function(c){ c.text=c.text.replace(" M","")+"%"; return c;}), options:dO({fill:{color:"eff6ff"}})});

      rows.push(rowCells);
    });

    var tableY=kpiY+kpiH+0.10;
    var totalW=W-0.24;
    var colW=[0.25, 1.45, 0.40, 0.95, 0.95, 0.95, 0.95, 0.90, 0.70, 0.90, 0.65, 0.70];
    var rawSum=colW.reduce(function(a,b){return a+b;},0);
    var scaledW=colW.map(function(w){return parseFloat((w*totalW/rawSum).toFixed(3));});

    var nDataRows=services.length;
    var rowHArr=[0.36,0.22];
    for(var r=0;r<nDataRows;r++) rowHArr.push(0.35);

    var tableH=H-tableY-0.55;
    slide.addTable(rows,{
      x:0.12, y:tableY, w:totalW, h:tableH,
      border:{type:"solid",color:C.lgray,pt:0.5},
      autoPage:false,
      rowH:rowHArr,
      colW:scaledW,
    });

    var noteY=H-0.50;
    slide.addShape("rect",{x:0,y:noteY,w:W,h:0.48,fill:{color:"f7fbfa"},line:{color:"cfe8e5",pt:0.5}});
    slide.addText(
      "* Warna Hijau menandakan potensi penambahan (capture); warna Merah menandakan potensi kehilangan (loss).  "+
      "* % Kenaikan thd INA-CBG dihitung dari (Proyeksi Tambahan iDRG - Pengurangan INA-CBG) / Eksisting INA-CBG.",
      {x:0.15,y:noteY+0.03,w:W-1.4,h:0.40,fontSize:5.5,color:"4e5d59",valign:"top",wrap:true}
    );
    slide.addText("Kemenkes",{x:W-1.25,y:noteY+0.06,w:1.15,h:0.35,fontSize:8,bold:true,color:C.teal,align:"right",valign:"middle"});
  }
`;

fs.writeFileSync('js/export-gslides.js', before + newRender + after, 'utf8');
console.log('PPTX patched successfully');
