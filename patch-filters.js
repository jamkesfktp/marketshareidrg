const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /function populateFilters\(\) \{([\s\S]*?)buildCheckboxes\(cities, cityDropdown, "city"\);[\s\S]*?\}/;
const match = code.match(regex);
if (match) {
  const newFunction = `function populateFilters() {
    const provinces = [...new Set(originalData.hospitals.map(h => h.province).filter(Boolean))].sort();
    
    // Group cities by province
    const citiesByProv = {};
    originalData.hospitals.forEach(h => {
      if (h.city && h.province) {
        if (!citiesByProv[h.province]) citiesByProv[h.province] = new Set();
        citiesByProv[h.province].add(h.city);
      }
    });
    
    const groupedCities = Object.keys(citiesByProv).sort().map(prov => ({
      prov: prov,
      cities: [...citiesByProv[prov]].sort()
    }));
    
    const provDropdown = document.getElementById("provDropdown");
    const cityDropdown = document.getElementById("cityDropdown");
    const provBtn = document.getElementById("provBtn");
    const cityBtn = document.getElementById("cityBtn");
    
    const buildCheckboxes = (items, container, filterType) => {
      if (!container) return;
      
      const searchHtml = \`
        <div class="multi-select-search-container">
          <input type="text" class="multi-select-search" placeholder="Cari..." autocomplete="off">
        </div>
        <div class="multi-select-options">
      \`;
      
      const optionsHtml = items.map(item => \`
        <label class="checkbox-label" data-search="\${escapeHtml(item.toLowerCase())}">
          <input type="checkbox" value="\${escapeHtml(item)}" data-filter="\${filterType}">
          <span>\${escapeHtml(item)}</span>
        </label>
      \`).join("");
      
      container.innerHTML = searchHtml + optionsHtml + \`</div>\`;
      
      const searchInput = container.querySelector('.multi-select-search');
      const labels = container.querySelectorAll('.checkbox-label');
      
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        labels.forEach(label => {
          if (label.dataset.search.includes(term)) {
            label.style.display = 'flex';
          } else {
            label.style.display = 'none';
          }
        });
      });

      searchInput.addEventListener('click', (e) => e.stopPropagation());
      
      container.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
          applyFilters();
          updateButtonLabels();
        });
      });
    };
    
    const buildCityCheckboxes = (groups, container, filterType) => {
      if (!container) return;
      
      const searchHtml = \`
        <div class="multi-select-search-container">
          <input type="text" class="multi-select-search" placeholder="Cari..." autocomplete="off">
        </div>
        <div class="multi-select-options">
      \`;
      
      const optionsHtml = groups.map(g => \`
        <div class="city-group" data-search="\${escapeHtml(g.prov.toLowerCase())}">
          <div class="city-group-title" style="font-weight:bold; padding: 4px 8px; background: #f1f5f9; font-size: 11px; color: #475569; position: sticky; top: 0; z-index: 2;">\${escapeHtml(g.prov)}</div>
          \${g.cities.map(item => \`
            <label class="checkbox-label" data-search="\${escapeHtml(item.toLowerCase())}">
              <input type="checkbox" value="\${escapeHtml(item)}" data-filter="\${filterType}">
              <span>\${escapeHtml(item)}</span>
            </label>
          \`).join("")}
        </div>
      \`).join("");
      
      container.innerHTML = searchHtml + optionsHtml + \`</div>\`;
      
      const searchInput = container.querySelector('.multi-select-search');
      const groupsEls = container.querySelectorAll('.city-group');
      
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        groupsEls.forEach(group => {
          let hasVisibleChild = false;
          const groupLabels = group.querySelectorAll('.checkbox-label');
          groupLabels.forEach(label => {
            if (label.dataset.search.includes(term) || group.dataset.search.includes(term)) {
              label.style.display = 'flex';
              hasVisibleChild = true;
            } else {
              label.style.display = 'none';
            }
          });
          group.style.display = hasVisibleChild ? 'block' : 'none';
        });
      });

      searchInput.addEventListener('click', (e) => e.stopPropagation());
      
      container.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
          applyFilters();
          updateButtonLabels();
        });
      });
    };
    
    buildCheckboxes(provinces, provDropdown, "province");
    buildCityCheckboxes(groupedCities, cityDropdown, "city");
  }`;
  
  code = code.replace(regex, newFunction);
  fs.writeFileSync('js/app.js', code);
  console.log('Successfully updated buildCheckboxes logic!');
} else {
  console.log('Regex match failed!');
}
