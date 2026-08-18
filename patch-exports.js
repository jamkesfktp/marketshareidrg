const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// Export simulation variables to window in renderGlobalSimulationSlide
code = code.replace(
  '    let potensiSerapanKasus = 0;\n    let potensiSerapanIdrg = 0;\n    \n    let potensiRedistribusiKasus = 0;\n    let potensiRedistribusiIdrg = 0;',
  '    window.potensiSerapanKasus = 0;\n    window.potensiSerapanIdrg = 0;\n    window.potensiRedistribusiKasus = 0;\n    window.potensiRedistribusiIdrg = 0;\n    let potensiSerapanKasus = 0;\n    let potensiSerapanIdrg = 0;\n    let potensiRedistribusiKasus = 0;\n    let potensiRedistribusiIdrg = 0;'
);

code = code.replace(/potensiSerapanKasus \+=/g, 'window.potensiSerapanKasus += potensiSerapanKasus +=');
code = code.replace(/potensiSerapanIdrg \+=/g, 'window.potensiSerapanIdrg += potensiSerapanIdrg +=');
code = code.replace(/potensiRedistribusiKasus \+=/g, 'window.potensiRedistribusiKasus += potensiRedistribusiKasus +=');
code = code.replace(/potensiRedistribusiIdrg \+=/g, 'window.potensiRedistribusiIdrg += potensiRedistribusiIdrg +=');
code = code.replace(/potensiSerapanKasus = \(/g, 'window.potensiSerapanKasus = potensiSerapanKasus = (');
code = code.replace(/potensiSerapanIdrg = \(/g, 'window.potensiSerapanIdrg = potensiSerapanIdrg = (');
code = code.replace(/potensiRedistribusiKasus = \(/g, 'window.potensiRedistribusiKasus = potensiRedistribusiKasus = (');
code = code.replace(/potensiRedistribusiIdrg = \(/g, 'window.potensiRedistribusiIdrg = potensiRedistribusiIdrg = (');

fs.writeFileSync('js/app.js', code);
console.log('App patched');
