const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<body></body>', { runScripts: 'outside-only' });
const ctx = dom.getInternalVMContext();
vm.runInContext(fs.readFileSync('js/idrg-map-data.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('js/scatter-af10-data.js','utf8'),ctx);
vm.runInContext(`var state={activeTariffScenario:'1363_full'};var TARIFF_SCENARIOS={'1363_full':{chip:'iDRG 1363'}};var escapeHtml=s=>String(s);var formatNumber=n=>String(n);var lastChart;window.Chart=class {constructor(canvas,config){this.data=config.data;lastChart=this;}destroy(){}};`,ctx);
const app = fs.readFileSync('js/app.js','utf8');
vm.runInContext(app.slice(app.indexOf('  function renderTariffScatterWorkspace()'),app.indexOf('  window.showTariffScatterWorkspace')),ctx);
const run=()=>vm.runInContext('renderTariffScatterWorkspace();lastChart.data.datasets.flatMap(d=>d.data)',ctx);
vm.runInContext(fs.readFileSync('js/scatter-2025-data.js','utf8'),ctx);
const initial=run();
assert.equal(dom.window.document.querySelector('#scatterDataset').value,'jan_des');
assert(!initial.some(p=>/^287[34]11/.test(p.code)), '2025 must not contain COVID cases');
const select=dom.window.document.querySelector('#scatterDataSource');
assert(select);select.value='af10';select.dispatchEvent(new dom.window.Event('change'));
const alternative=vm.runInContext('lastChart.data.datasets.flatMap(d=>d.data)',ctx);
assert.equal(initial.length,alternative.length);
let changed=0;
for(const p of alternative){const before=initial.find(x=>x.code===p.code);assert.equal(p.cases,before.cases);assert.equal(p.ina,before.ina);assert(Math.abs(p.idrg-dom.window.scatterAf10Data.tariffs[p.code].tariff)<0.001);if(Math.abs(p.idrg-before.idrg)>0.01)changed++;}
assert(changed>0);
for(const region of ['R1','R2','R3','R4','R5']){
 dom.window.tariffScatterUi.region=region;dom.window.tariffScatterUi.dataSource='existing';const old=run();dom.window.tariffScatterUi.dataSource='af10';const newer=run();assert.equal(old.length,newer.length);for(const p of newer){const prior=old.find(x=>x.code===p.code);assert.equal(p.cases,prior.cases);assert.equal(p.ina,prior.ina);}
}
console.log(JSON.stringify({points:initial.length,changedTariffs:changed,caseAndInaPreservation:'passed',regions:'5 passed',selectorEvent:'passed'}));

const selectPeriod=dom.window.document.querySelector('#scatterDataset');selectPeriod.value='okt_jun';selectPeriod.dispatchEvent(new dom.window.Event('change'));
assert.equal(dom.window.tariffScatterUi.dataset,'okt_jun');
dom.window.tariffScatterUi.region='ALL';const trial=run();
assert.equal(trial.filter(p=>/^287[34]11/.test(p.code)).reduce((n,p)=>n+p.cases,0),5);
for(const dataset of ['jan_des','okt_jun']){
 dom.window.tariffScatterUi.dataset=dataset;dom.window.tariffScatterUi.dataSource='existing';vm.runInContext("state.activeTariffScenario='1370_noaf'",ctx);const base=run();
 dom.window.tariffScatterUi.dataSource='af19';assert.deepStrictEqual(run(),base);
}
console.log('Both periods and AF19 passed; 2025 COVID=0, trial COVID=5.');
