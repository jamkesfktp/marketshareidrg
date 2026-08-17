const fs = require('fs');

let content = fs.readFileSync('js/audit-excel.js', 'utf8');

const startIdx = content.indexOf('    // 04 - Rekap seluruh sheet simulasi.');
const endIdx = content.indexOf('    appendSheet(recapWs, "04_Rekap_Simulasi");') + 46;

const before = content.substring(0, startIdx);
const after = content.substring(endIdx);

const newRender = `    // 04 - Rekap seluruh sheet simulasi.
    const recapRows = [
      [
        "No", "Kode Layanan", "Nama Layanan", "Kompetensi", 
        "Dampak Kasus Paripurna", "Dampak Rp Paripurna", 
        "Dampak Kasus Utama", "Dampak Rp Utama", 
        "Dampak Kasus Madya", "Dampak Rp Madya", 
        "Dampak Kasus Dasar", "Dampak Rp Dasar", 
        "Net +/- Kasus", "% Net thd Eksisting", 
        "Net +/- Pendapatan Rp", "Pendapatan Eksisting INA-CBG", "% Kenaikan thd INA-CBG"
      ]
    ];

    serviceSheetMeta.forEach((meta, serviceIndex) => {
      const allDampak = { 4: {k:[],rp:[]}, 3: {k:[],rp:[]}, 2: {k:[],rp:[]}, 1: {k:[],rp:[]} };
      const allNetK = [], allNetRp = [];
      const sheet = quoteSheet(meta.sheetName);
      const col = meta.colIndex;
      
      const targetCompetency = getCompetency(target, meta.service);
      const rules = getLevelRules(targetCompetency);
      
      const tSvcTotal = target.services?.[meta.service]?.total || [0,0,0];
      const existingCases = Number(tSvcTotal[CASES]) || 0;
      const existingIna = Number(tSvcTotal[INA]) || 0;
      
      for (let scenarioIndex = 1; scenarioIndex <= 6; scenarioIndex += 1) {
        const values = meta.scenarioValues[scenarioIndex];
        
        [4,3,2,1].forEach(lvl => {
          let k=0, rp=0;
          if (rules.tambah.includes(lvl)) {
             const scn = state.serviceScenarios[meta.service]?.[scenarioIndex - 1] || {};
             const pp = (Number(scn['tambah_'+lvl]) || 0) / 100;
             const rM = severityMetric(data.regional?.services?.[meta.service], lvl);
             const tM = severityMetric(target.services?.[meta.service], lvl);
             k = Math.max(0, (Number(rM[CASES])||0) - (Number(tM[CASES])||0)) * pp;
             rp = Math.max(0, (Number(rM[IDRG])||0) - (Number(tM[IDRG])||0)) * pp;
          } else if (rules.kurang.includes(lvl)) {
             const scn = state.serviceScenarios[meta.service]?.[scenarioIndex - 1] || {};
             const pk = (Number(scn['kurang_'+lvl]) || 0) / 100;
             const tM = severityMetric(target.services?.[meta.service], lvl);
             k = -(Number(tM[CASES])||0) * pk;
             rp = -(Number(tM[INA])||0) * pk;
          }
          allDampak[lvl].k.push(k);
          allDampak[lvl].rp.push(rp);
        });
        
        allNetK.push(values.deltaCases);
        allNetRp.push(values.deltaRevenue);
      }
      
      const formatCellArr = (minV, maxV, isRp) => {
        if (minV === 0 && maxV === 0) return "-";
        const signMin = minV > 0 ? "+" : (minV < 0 ? "-" : "");
        const signMax = maxV > 0 ? "+" : (maxV < 0 ? "-" : "");
        
        const fMin = isRp ? (Math.abs(minV)/1000000000).toFixed(1) + " M" : Math.abs(minV).toFixed(0);
        const fMax = isRp ? (Math.abs(maxV)/1000000000).toFixed(1) + " M" : Math.abs(maxV).toFixed(0);
        
        if (minV === maxV) return \`\${signMin} \${fMin}\`;
        return \`\${signMin} \${fMin} s.d \${signMax} \${fMax}\`;
      };
      
      const formatPctArr = (minV, maxV) => {
        if (minV === 0 && maxV === 0) return "-";
        const signMin = minV > 0 ? "+" : (minV < 0 ? "-" : "");
        const signMax = maxV > 0 ? "+" : (maxV < 0 ? "-" : "");
        const fMin = (Math.abs(minV) * 100).toFixed(2) + "%";
        const fMax = (Math.abs(maxV) * 100).toFixed(2) + "%";
        if (minV === maxV) return \`\${signMin}\${fMin}\`;
        return \`\${signMin}\${fMin} s.d \${signMax}\${fMax}\`;
      };

      const minNetK = Math.min(...allNetK);
      const maxNetK = Math.max(...allNetK);
      const minNetRp = Math.min(...allNetRp);
      const maxNetRp = Math.max(...allNetRp);
      
      const minPctK = existingCases ? minNetK/existingCases : 0;
      const maxPctK = existingCases ? maxNetK/existingCases : 0;
      const minPctRp = existingIna ? minNetRp/existingIna : 0;
      const maxPctRp = existingIna ? maxNetRp/existingIna : 0;

      const rowData = [
        serviceIndex + 1,
        meta.service,
        meta.displayName,
        levelNames[meta.competency] || "Tidak terpetakan"
      ];
      
      [4,3,2,1].forEach(lvl => {
         const minK = Math.min(...allDampak[lvl].k);
         const maxK = Math.max(...allDampak[lvl].k);
         const minRp = Math.min(...allDampak[lvl].rp);
         const maxRp = Math.max(...allDampak[lvl].rp);
         rowData.push(formatCellArr(minK, maxK, false));
         rowData.push(formatCellArr(minRp, maxRp, true));
      });
      
      rowData.push(formatCellArr(minNetK, maxNetK, false));
      rowData.push(formatPctArr(minPctK, maxPctK));
      rowData.push(formatCellArr(minNetRp, maxNetRp, true));
      rowData.push((existingIna/1000000000).toFixed(1) + " M");
      rowData.push(formatPctArr(minPctRp, maxPctRp));
      
      recapRows.push(rowData);
    });

    const recapWs = XLSX.utils.aoa_to_sheet(recapRows);
    styleHeader(XLSX, recapWs, "A1:Q1", COLORS.tealDeep);
    styleRange(XLSX, recapWs, \`A2:Q\${recapRows.length}\`, { fill: COLORS.light });
    recapWs["!autofilter"] = { ref: \`A1:Q\${recapRows.length}\` };
    setSheetDefaults(recapWs, [6, 15, 30, 15, 25, 25, 25, 25, 25, 25, 25, 25, 25, 20, 25, 25, 20], 1);
    appendSheet(recapWs, "04_Rekap_Simulasi");`;

fs.writeFileSync('js/audit-excel.js', before + newRender + after, 'utf8');
console.log('Excel patched successfully');
