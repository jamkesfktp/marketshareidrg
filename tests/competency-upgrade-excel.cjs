const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const XLSX = require('xlsx');

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/competency-upgrade-excel.js', 'utf8'), context);
const metric = (cases, ina, idrg) => [cases, ina, idrg];
const levelRows = [1,2,3,4].map(level => ({ level, eligible: level <= 2, competitors: 2, naturalShare: 1/3, captureRate: level <= 2 ? 1/3 : 0, existing: metric(10,100,120), external: metric(30,300,360), retained: level <= 2 ? metric(10,100,120) : metric(0,0,0), captured: level <= 2 ? metric(10,100,120) : metric(0,0,0) }));
const recapRows = Array.from({ length: 24 }, (_, i) => ({ service:`L${i+1}`, targetCompetency:1, targetLevel:2, existing:metric(40,400,480), retained:metric(20,200,240), captured:metric(20,200,240), projected:metric(40,400,480), deltaIdrgVsIna:80, levelRows }));
const comparisons = [1,2,3,4].map(level => ({ targetLevel:level, existing:metric(40,400,480), retained:metric(20,200,240), captured:metric(20,200,240), projected:metric(40,400,480), deltaIdrgVsIna:80 }));
const wb = context.window.CompetencyUpgradeExcel.buildWorkbook({ XLSX, target:{name:'RS Test',code:'001'}, settings:{targetLevel:2,captureMultiplier:100,retention:100}, levelNames:{1:'Dasar',2:'Madya',3:'Utama',4:'Paripurna'}, formatService:x=>x, recapRows, comparisons, selectedService:'L1', datasetLabel:'Dataset', tariffLabel:'Tarif', filterDesc:'Semua', CASES:0, INA:1, IDRG:2 });
assert.deepEqual(wb.SheetNames, ['00_Petunjuk','01_Perbandingan','02_Rekap_24','03_Detail_Driver','99_Rekonsiliasi']);
assert.equal(wb.Sheets['02_Rekap_24']['A26'].v, 24);
assert.equal(wb.Sheets['99_Rekonsiliasi']['D3'].v, 'PASS');
assert.equal(wb.Sheets['03_Detail_Driver']['A98'].v, 'L24');
console.log('competency-upgrade-excel tests passed');
