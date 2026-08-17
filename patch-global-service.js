const fs = require('fs');

let appJs = fs.readFileSync('js/app.js', 'utf8');

// 1. Hook populateFilters to build globalSimServiceSelect options
const populateFiltersHook = 'const provDropdown = document.getElementById("provDropdown");';
const populateCode = `
    const globalSimServiceSelect = document.getElementById("globalSimServiceSelect");
    if (globalSimServiceSelect && originalData.services) {
      const currentVal = globalSimServiceSelect.value || 'ALL';
      // Use standard JS replacement instead of formatService since formatService might not be available here, or it is?
      // formatService is usually available globally. Let's assume it is.
      globalSimServiceSelect.innerHTML = '<option value="ALL">Semua Layanan (Global)</option>' + originalData.services.map(s => \`<option value="\${s}">\${typeof formatService === 'function' ? formatService(s) : s.replace(/_/g, ' ')}</option>\`).join('');
      if (Array.from(globalSimServiceSelect.options).some(o => o.value === currentVal)) {
        globalSimServiceSelect.value = currentVal;
      }
    }
`;
appJs = appJs.replace(populateFiltersHook, populateCode + '\n    ' + populateFiltersHook);

// 2. Add event listener to re-render when dropdown changes
const renderAllHook = 'renderAll();';
const listenerCode = `
  document.getElementById('globalSimServiceSelect')?.addEventListener('change', () => {
    if(typeof renderGlobalSimulationSlide === "function") renderGlobalSimulationSlide();
    if(typeof renderCompetencySimSlide === "function") renderCompetencySimSlide();
    if(typeof renderRecapSlide === "function") renderRecapSlide();
    if(typeof renderLogicalRecapSlide === "function") renderLogicalRecapSlide();
  });
`;
appJs = appJs.replace(renderAllHook, listenerCode + '\n  ' + renderAllHook);

// 3. Replace all data.services.forEach to use the filtered services
appJs = appJs.replace(/data\.services\.forEach\(/g, `
    (function(){
      const targetServiceSelect = document.getElementById('globalSimServiceSelect')?.value || 'ALL';
      const servicesToSimulate = targetServiceSelect === 'ALL' ? data.services : (data.services.includes(targetServiceSelect) ? [targetServiceSelect] : []);
      
      // Compute Competitor count for the badge (we only need to do this once per function, but doing it in an IIFE wrapper is safe)
      let competitorCount = 0;
      if (targetServiceSelect !== 'ALL') {
        data.hospitals.forEach(h => {
          if (h.code === targetHospital()?.code) return;
          const hComp = getCompetency(h, targetServiceSelect);
          if (hComp && hComp > 0) competitorCount++;
        });
      } else {
        competitorCount = Math.max(0, data.hospitals.length - 1);
      }
      
      const compBadge = document.getElementById('globalSimCompetitorBadge');
      if (compBadge) {
        compBadge.innerHTML = targetServiceSelect === 'ALL' 
          ? \`Menampilkan \${competitorCount} RS Regional\` 
          : \`<strong>\${competitorCount}</strong> RS Kompetitor Regional\`;
      }
      
      return servicesToSimulate;
    })().forEach(`);

fs.writeFileSync('js/app.js', appJs);
console.log("App patched for Global Service Filter.");
