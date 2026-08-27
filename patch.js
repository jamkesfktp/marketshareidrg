const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

code = code.split('"1370_full": { index: 2, label: "iDRG 1370 - AF + AFreg + AFkep (Default)"').join('"1370_full": { index: 2, label: "iDRG 1370 - AF + AFreg + AFkep"');
code = code.split('"1370_af": { index: 4, label: "iDRG 1370 - AF Saja"').join('"1370_af": { index: 4, label: "iDRG 1370 - AF Saja (Default)"');

code = code.split('TARIFF_SCENARIOS["1370_full"]').join('TARIFF_SCENARIOS["1370_af"]');
code = code.split('activeTariffScenario: "1370_full",').join('activeTariffScenario: "1370_af",');
code = code.split('state.activeTariffScenario || "1370_full"').join('state.activeTariffScenario || "1370_af"');

code = code.split('"1370_full": "iDRG 1370 - AF + AFreg + AFkep (Default)"').join('"1370_full": "iDRG 1370 - AF + AFreg + AFkep"');
code = code.split('"1370_af": "iDRG 1370 - AF Saja"').join('"1370_af": "iDRG 1370 - AF Saja (Default)"');

fs.writeFileSync('js/app.js', code);
console.log('Patch complete.');
