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
const initial=run();
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
