const fs = require("fs");
let content = fs.readFileSync("js/app.js", "utf8");

// Change 1: excludeUnmapped in state
content = content.replace(
  `state = {\n    selectedService: null,`,
  `state = {\n    selectedService: null,\n    excludeUnmapped: false,`
);

// Change 2: default non-Paripurna kurang 90%
content = content.replace(
  `// Level lain (Dasar, Madya, Utama) → default 80%
              scn['kurang_' + lvl] = 80;`,
  `// Level lain (Dasar, Madya, Utama) → default 90%
              scn['kurang_' + lvl] = 90;`
);

// Change 3: Remove "(X RS)" from UI headers (in app.js renderScenarioSlide)
content = content.replace(
  `<div class="panel-heading"><h2>RS kompetitor setara yang mampu melayani</h2><span>\${competition.rows.length} RS · minimum \${levelNames[competition.minimumCompetency]}</span></div>`,
  `<div class="panel-heading"><h2>RS kompetitor setara yang mampu melayani*</h2><span>\${competition.rows.length} RS · minimum \${levelNames[competition.minimumCompetency]}</span></div>`
);

// Add footnote below the table
content = content.replace(
  `</tbody></table></div>\n          </article>`,
  `</tbody></table></div>\n            <div style="font-size: 10px; color: #64748b; margin-top: 8px; font-style: italic;">*Dihitung berdasarkan RS dengan tingkat kompetensi ≥ \${levelNames[competition.minimumCompetency]} pada layanan \${escapeHtml(service)}.</div>\n          </article>`
);

// Change 4: Inject renderRecapSlide and its call inside updateAll()
content = content.replace(
  `function updateAll() {\n    if (isUpdating) return;\n    isUpdating = true;`,
  `function updateAll() {\n    if (isUpdating) return;\n    isUpdating = true;\n    recalculateTotals();`
);

content = content.replace(
  `renderScenarioSlide();\n    updateGlobalRisk();\n    renderExportPreview();`,
  `renderScenarioSlide();\n    updateGlobalRisk();\n    renderRecapSlide();\n    renderExportPreview();`
);

// Change 5: Insert recalculateTotals before updateTargetMeta
content = content.replace(
  `function updateTargetMeta() {`,
  `function recalculateTotals() {
    const processItem = (item) => {
      if (!item) return;
      if (!item.originalTotal && item.total) item.originalTotal = [...item.total];
      if (!item.originalTotal) return;
      
      if (state.excludeUnmapped && item.unclassified) {
        item.total = [
          Math.max(0, item.originalTotal[0] - (item.unclassified[0] || 0)),
          Math.max(0, item.originalTotal[1] - (item.unclassified[1] || 0)),
          Math.max(0, item.originalTotal[2] - (item.unclassified[2] || 0))
        ];
      } else {
        item.total = [...item.originalTotal];
      }
    };
    
    data.hospitals.forEach(h => {
      processItem(h);
      if (h.services) {
        Object.values(h.services).forEach(s => processItem(s));
      }
    });
    
    if (data.regional) {
      processItem(data.regional);
      if (data.regional.services) {
        Object.values(data.regional.services).forEach(s => processItem(s));
      }
    }
  }

  function updateTargetMeta() {`
);

// Change 6: Exclude unmapped in computeScenario
content = content.replace(
  `let projected = metric(targetItem?.unclassified);\n      let retained = metric(targetItem?.unclassified);`,
  `let unclass = state.excludeUnmapped ? [0,0,0] : metric(targetItem?.unclassified);\n      let projected = [...unclass];\n      let retained = [...unclass];`
);

// Change 7: Inject event listener for excludeUnmappedToggle
content = content.replace(
  `document.getElementById("presetJabarBtn")?.addEventListener("click", function() {`,
  `document.getElementById("excludeUnmappedToggle")?.addEventListener("change", function(e) {
    state.excludeUnmapped = e.target.checked;
    recalculateTotals();
    updateAll();
  });
  document.getElementById("presetJabarBtn")?.addEventListener("click", function() {`
);

fs.writeFileSync("js/app.js", content, "utf8");
console.log("Clean applied");
