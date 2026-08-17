const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

code = code.replace(/const isMostLogical = index === mostLogicalScenarioIndex;/g, 'const isMostLogical = false;');
code = code.replace(/const bgRow = isMostLogical \? \'#eff6ff\' : \'#ffffff\';/g, 'const bgRow = \'#ffffff\';');
code = code.replace(/const cellBorder = isMostLogical \? \'border: 2px solid #3b82f6;\' : \'border: 1px solid #cbd5e1;\';/g, 'const cellBorder = \'border: 1px solid #cbd5e1;\';');
code = code.replace(/const outlineRow = isMostLogical \? \'outline: 2px solid #3b82f6; outline-offset: -2px; z-index: 10; position: relative;\' : \'\';/g, 'const outlineRow = \'\';');
code = code.replace(/const badge = isMostLogical \? \<div style=\"margin-top: 2px;\"><span style=\"font-size: 8px; color: #fff; background: #3b82f6; padding: 2px 4px; border-radius: 4px; font-weight: 700; text-transform: uppercase;\">Paling Logis<\/span><\/div>\ : \'\';/g, 'const badge = \'\';');

code = code.replace(/background-color: #f8fafc;/g, 'background-color: #ffffff;');
code = code.replace(/background:#f0f9ff;/g, 'background:#ffffff;');
code = code.replace(/background:#eff6ff;/g, 'background:#ffffff;');
code = code.replace(/background:#fbfccb;/g, 'background:#ffffff;');

fs.writeFileSync('js/app.js', code);
