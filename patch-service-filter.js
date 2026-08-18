const fs = require('fs');

let appJs = fs.readFileSync('js/app.js', 'utf8');

// 1. Populate globalSimServiceSelect in populateFilters
const populateFiltersHook = 'const provDropdown = document.getElementById("provDropdown");';
const populateCode = `
    const globalSimServiceSelect = document.getElementById("globalSimServiceSelect");
    if (globalSimServiceSelect && originalData.services) {
      const currentVal = globalSimServiceSelect.value || 'ALL';
      globalSimServiceSelect.innerHTML = '<option value="ALL">Semua Layanan (Global)</option>' + originalData.services.map(s => \`<option value="\${s}">\${formatService(s)}</option>\`).join('');
      if (Array.from(globalSimServiceSelect.options).some(o => o.value === currentVal)) {
        globalSimServiceSelect.value = currentVal;
      }
    }
`;
appJs = appJs.replace(populateFiltersHook, populateCode + '\n    ' + populateFiltersHook);


// 2. Add Event Listener at the end of the file
const renderAllHook = 'renderAll();';
const listenerCode = `
  document.getElementById('globalSimServiceSelect')?.addEventListener('change', () => {
    if(typeof renderGlobalSimulationSlide === "function") renderGlobalSimulationSlide();
    if(typeof renderCompetencySimSlide === "function") renderCompetencySimSlide();
  });
`;
appJs = appJs.replace(renderAllHook, listenerCode + '\n  ' + renderAllHook);


// 3. Update renderGlobalSimulationSlide loop
const globalLoopHook = 'data.services.forEach(service => {';
const globalLoopReplacement = `
    const targetServiceSelect = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
    const servicesToSimulate = targetServiceSelect === 'ALL' ? data.services : (data.services.includes(targetServiceSelect) ? [targetServiceSelect] : []);
    
    let competitorCount = 0;
    if (targetServiceSelect !== 'ALL') {
      data.hospitals.forEach(h => {
        if (h.code === target.code) return;
        const hComp = getCompetency(h, targetServiceSelect);
        if (hComp && hComp > 0) competitorCount++;
      });
    } else {
      competitorCount = data.hospitals.length - 1;
    }
    
    const compBadge = document.getElementById('globalSimCompetitorBadge');
    if (compBadge) {
      compBadge.innerHTML = targetServiceSelect === 'ALL' 
        ? \`Menampilkan \${competitorCount} RS Regional\` 
        : \`<strong>\${competitorCount}</strong> RS Kompetitor Regional\`;
    }

    servicesToSimulate.forEach(service => {
`;
// We must replace ALL instances in renderGlobalSimulationSlide. There's one for simulation, and one inside exportCSV.
// Wait, exportCSV is inside renderGlobalSimulationSlide. We can just replace both `data.services.forEach(service => {` in the file?
// Actually, there are multiple data.services.forEach in app.js!
// Let's replace only the ones inside renderGlobalSimulationSlide and renderCompetencySimSlide.

// The easier way is to use regex matching only inside these functions.
`;

fs.writeFileSync('patch-service-filter.js', ''); // Reset file
