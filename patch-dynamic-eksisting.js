const fs = require('fs');

let appJs = fs.readFileSync('js/app.js', 'utf8');

const hook = `    // Hitung Kondisi Eksisting
    const eksistingKasus = target.total[CASES] || 0;
    const eksistingIna = target.total[INA] || 0;
    const eksistingIdrg = target.total[IDRG] || 0;`;

const replacement = `    // Hitung Kondisi Eksisting Dinamis
    const globalSimSelectVal = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
    const targetServices = globalSimSelectVal === 'ALL' ? data.services : (data.services.includes(globalSimSelectVal) ? [globalSimSelectVal] : []);
    
    let eksistingKasus = 0;
    let eksistingIna = 0;
    let eksistingIdrg = 0;
    
    if (globalSimSelectVal === 'ALL') {
      eksistingKasus = target.total[CASES] || 0;
      eksistingIna = target.total[INA] || 0;
      eksistingIdrg = target.total[IDRG] || 0;
    } else {
      targetServices.forEach(service => {
        const srv = target.services[service];
        if (srv) {
          [1,2,3,4].forEach(rank => {
            const metrics = severityMetric(srv, rank);
            eksistingKasus += metrics[CASES] || 0;
            eksistingIna += metrics[INA] || 0;
            eksistingIdrg += metrics[IDRG] || 0;
          });
        }
      });
    }`;

appJs = appJs.replace(hook, replacement);

fs.writeFileSync('js/app.js', appJs);
console.log("App patched for dynamic eksisting calculation.");
