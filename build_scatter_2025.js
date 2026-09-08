const fs = require('fs');
const readline = require('readline');
const path = require('path');
const input = process.argv[2] || 'C:/Backup Riki/Drive D/Analsisi Uji Coba/spending_jan_des_v11_gabungan.csv';
// Reuse the established quoted-CSV parser; locate every metric by header name.
const parserSource = fs.readFileSync('build_idrg_map_data.js', 'utf8');
const csv = new Function(parserSource.slice(parserSource.indexOf('function csv('), parserSource.indexOf('const clean =')) + ';return csv;')();
const metrics = ['jml_kasus','total_tarif_inacbg','idrg_total_tarif_1370_dengan_af_afreg_afkep','idrg_total_tarif_1370_dengan_af_afreg','idrg_total_tarif_1370_dengan_af','idrg_total_tarif_1370_tanpa_af','idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup','idrg_total_tarif_1363_dengan_af_afreg_afkep','idrg_total_tarif_1363_dengan_af'];
(async()=>{
 const groups=new Map(); let headers, rows=0, totalCases=0, covidCases=0;
 for await(const line of readline.createInterface({input:fs.createReadStream(input),crlfDelay:Infinity})) {
  if(!headers){headers=csv(line);for(const name of metrics)if(!headers.includes(name))throw Error('Missing '+name);continue;}
  if(!line.trim())continue;
  const values=csv(line); const field=name=>values[headers.indexOf(name)]?.trim()||'';
  const nums=metrics.map(name=>{const value=Number(field(name));if(!Number.isFinite(value))throw Error('Invalid '+name+' row '+rows);return value;});
  rows++;totalCases+=nums[0];if(/^287[34]11/.test(field('idrg_code_1370')))covidCases+=nums[0];
  if(nums[0]<=0)continue;
  const service=field('kelompok_idrg').toUpperCase(),code=field('idrg_code_1370');if(!service||!code||!field('inacbg'))throw Error('Missing mapping row '+rows);
  const owner=field('pemilik_faskes').toUpperCase();const raw=field('kelas_rawat').toUpperCase().replace(/\s+/g,'');
  const dims=[code,owner==='P'?'PEMERINTAH':owner==='S'?'SWASTA':'LAINNYA',field('kelas_faskes').toUpperCase(),/^[0-3]$/.test(raw)?'KELAS'+raw:raw,field('regional_2023').toUpperCase().replace('REG','R')];
  const key=JSON.stringify([service,...dims]);let group=groups.get(key);if(!group){group={service,segment:[dims[0],field('desc_idrg_1370'),...dims.slice(1),...Array(9).fill(0)]};groups.set(key,group);}
  nums.forEach((v,i)=>group.segment[6+i]+=v);
  if(rows%1000000===0)console.log(rows+' rows');
 }
 const scatterServices={};for(const {service,segment} of groups.values()){segment.splice(7,8,...segment.slice(7).map(Math.round));(scatterServices[service]||=[]).push(segment);}
 const meta={sourceFile:path.basename(input),period:'Januari–Desember 2025',sourceRows:rows,totalCases,covidCases,generatedAt:new Date().toISOString()};
 fs.writeFileSync('js/scatter-2025-data.js','window.scatter2025Data='+JSON.stringify({meta,scatterServices})+';\n');console.log(meta);
})();
