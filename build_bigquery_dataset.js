const fs = require('fs');
const path = require('path');
const vm = require('vm');
const readline = require('readline');
const XLSX = require('xlsx');

const input = 'C:\\Users\\PUSBIKES-KEMKES\\Downloads\\TARIF\\Data Spending\\bq-results-20261029-044944-1793249396242.csv';
const output = path.join(__dirname, 'js', 'data.js');
const vectorLen = 13;
const zeros = () => Array(vectorLen).fill(0);
function add(a,b){for(let i=0;i<vectorLen;i++)a[i]=(a[i]||0)+(b[i]||0);}
function csv(line){const a=[];let v='',q=false;for(const c of line){if(c==='"')q=!q;else if(c===','&&!q){a.push(v);v='';}else v+=c;}a.push(v);return a;}
function n(v){const s=String(v??'').trim();return s===''||s==='-'?0:Number(s)||0;}
function id(v){return String(v??'').trim();}
function parseIndo(v){const s=id(v).replace(/\s/g,'');if(!s||s==='-')return 0;return Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s.replace(/\./g,''))||0;}

const tariffRows=fs.readFileSync(path.join(__dirname,'data','spending-tariffs.tsv'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).slice(1);
const tariffs=new Map();
for(const line of tariffRows){const r=line.split('\t');if(r.length<11)continue;const p=id(r[0]),drg=id(r[3]);if(!p||!drg)continue;const cw=parseIndo(r[7]),adj=parseIndo(r[9]),nbrNew=parseIndo(r[10]),nbrOld=p==='1'?8037060:461474;tariffs.set(`${p}:${drg}`,[cw*adj*nbrNew,cw*adj*nbrOld,cw*nbrNew,cw*nbrOld]);}

const vmctx={window:{}};vm.createContext(vmctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'js','idrg-map-data.js'),'utf8'),vmctx,{timeout:120000});
const codeService=new Map();for(const [service,rows] of Object.entries(vmctx.window.idrgMapData.services||{}))for(const row of rows)codeService.set(id(row.idrg),service);
const competency=JSON.parse(fs.readFileSync(path.join(__dirname,'data','competencies-2026-10-01.json'),'utf8'));
const hosp=new Map(),services=new Set(),regional={total:zeros(),severity:{},unclassified:zeros(),services:{}};
let rows=0,totalCases=0,matchedCases=0;
function ensure(obj,key,create){if(!obj[key])obj[key]=create();return obj[key];}
async function main(){
 const rl=readline.createInterface({input:fs.createReadStream(input),crlfDelay:Infinity});let header=true;
 for await(const line of rl){if(header){header=false;continue;}const r=csv(line);if(r.length<18)continue;
  const code=id(r[0]),name=id(r[1]),province=id(r[2]).toUpperCase(),city=id(r[3]),hclass=id(r[4]),ptd=id(r[8]),drg=id(r[13]);
  const cases=n(r[15]),ina=n(r[16]),rs=n(r[17]);if(!code||!cases)continue;
  const svc=codeService.get(drg)||'LAINNYA';services.add(svc);
  if(!hosp.has(code))hosp.set(code,{code,name,class:hclass,province,city,total:zeros(),severity:{},services:{},unclassified:zeros()});
  const h=hosp.get(code),s=ensure(h.services,svc,()=>({competency:competency.hospitals?.[code]?.[svc]||0,total:zeros(),severity:{},unclassified:zeros()}));
  const rate=tariffs.get(`${ptd}:${drg}`),vec=zeros();vec[0]=cases;vec[1]=ina;if(rate){vec[9]=cases*rate[0];vec[10]=cases*rate[1];vec[11]=cases*rate[2];vec[12]=cases*rate[3];matchedCases+=cases;}
  // This BigQuery extract has no competency/severity fields. Keep cases unclassified.
  add(h.total,vec);add(h.unclassified,vec);add(s.total,vec);add(s.unclassified,vec);add(regional.total,vec);add(regional.unclassified,vec);
  rows++;totalCases+=cases;if(rows%500000===0)console.log(`Processed ${rows.toLocaleString()} rows`);
 }
 for(const h of hosp.values())for(const [svc,s] of Object.entries(h.services)){const rs=ensure(regional.services,svc,()=>({competency:0,total:zeros(),severity:{},unclassified:zeros()}));add(rs.total,s.total);add(rs.unclassified,s.unclassified);}
 const previous=fs.readFileSync(output,'utf8');const oldctx={window:{}};vm.createContext(oldctx);vm.runInContext(previous,oldctx,{timeout:120000});
 const datasets=oldctx.window.marketSimulatorDatasets;delete datasets.okt_jun;
 datasets.okt_oct={meta:{sourceFile:path.basename(input),periodName:'15 Okt 2025 - 15 Okt 2026',periodCode:'okt_oct',sourceRows:rows,generatedAt:new Date().toISOString(),defaultTargetCode:hosp.has('3372015')?'3372015':hosp.keys().next().value,hospitalCount:hosp.size,sourceServiceCount:services.size,competencySource:'RS Online 1 Oktober 2026; layanan dipetakan dari kode iDRG',caseMixNote:'Sumber BigQuery tidak memuat kompetensi/keparahan klaim; seluruh kasus dicatat sebagai belum terklasifikasi.',matchedTariffCases:matchedCases,tariffScenarios:{cw_adj_nbr_new:{index:9,label:'CW × Adj CW × NBR Baru'},cw_adj_nbr_old:{index:10,label:'CW × Adj CW × NBR Lama'},cw_nbr_new:{index:11,label:'CW × NBR Baru'},cw_nbr_old:{index:12,label:'CW × NBR Lama'}}},severityLabels:{},services:[...services].sort(),regional,hospitals:[...hosp.values()]};
 fs.writeFileSync(output,`window.marketSimulatorDatasets = ${JSON.stringify(datasets)};\nwindow.marketSimulatorData = window.marketSimulatorDatasets["okt_oct"];\n`);
 console.log(JSON.stringify({rows,totalCases,matchedCases,hospitals:hosp.size,services:services.size,bytes:fs.statSync(output).size}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
