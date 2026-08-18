const fs = require('fs');

let appJs = fs.readFileSync('js/app.js', 'utf8');

appJs = appJs.replace(
  "keterangan = `Serapan dari ${tambahMode === 'tambah_cross_comp' ? 'Lintas Kompetensi' : (tambahMode === 'tambah_up' ? 'Sisa Regional U/P' : 'RS Tinggi D/M')}; Lepas ${kurangMode === 'kurang_dm' ? 'D/M' : 'U/P'} RS Eksisting`;",
  "keterangan = `Serapan dari ${tambahMode === 'tambah_cross_comp' ? 'Lintas Kompetensi' : (tambahMode === 'tambah_up' ? 'Sisa Regional U/P' : (tambahMode === 'tambah_dm_reg' ? 'Sisa Regional D/M' : 'RS Tinggi D/M'))}; Lepas ${kurangMode === 'kurang_dm' ? 'D/M' : 'U/P'} RS Eksisting`;"
);

appJs = appJs.replace(
  "const modeStr = (tambahMode === 'tambah_cross_comp' ? 'T:CC' : (tambahMode === 'tambah_up' ? 'T:UP' : 'T:DM')) + ' / ' + (kurangMode === 'kurang_dm' ? 'K:DM' : 'K:UP');",
  "const modeStr = (tambahMode === 'tambah_cross_comp' ? 'T:CC' : (tambahMode === 'tambah_up' ? 'T:UP' : (tambahMode === 'tambah_dm_reg' ? 'T:DM_REG' : 'T:DM'))) + ' / ' + (kurangMode === 'kurang_dm' ? 'K:DM' : 'K:UP');"
);

fs.writeFileSync('js/app.js', appJs);
console.log("App patched for export strings.");
