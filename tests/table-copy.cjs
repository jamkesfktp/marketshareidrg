const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<table><tr><th rowspan="2" style="background:red">Kasus</th><th colspan="2">Persentase<button>copy</button></th></tr><tr><th>Tambah</th><th>Kurang</th></tr><tr><td>42</td><td style="background:yellow"><label><span>U</span><span><input value="10">%</span></label><label><span>P</span><span><input value="0">%</span></label></td><td><input value="100">%</td></tr></table><button id="copy">Salin</button>', { runScripts:'outside-only' });
const w = dom.window;
w.eval(fs.readFileSync('js/table-copy.js','utf8'));
const table=w.document.querySelector('table');
table.querySelector('input').value='23.75';
const payload=w.TableCopy.serialize(table);
assert(payload.text.includes('U 23.75%'));
assert(payload.text.includes('P 0%'));
assert(payload.text.includes('100%'));
assert(!payload.text.includes('copy'));
assert(!payload.html.includes('<input'));
const parsed=new JSDOM(payload.html);
for(const el of parsed.window.document.querySelectorAll('table,table *')) {
  assert(el.style.fontFamily.includes('Century Gothic'));
  assert.equal(el.style.fontSize,'8pt');
  assert.equal(el.style.backgroundColor,'transparent');
  assert.equal(el.style.color,'rgb(0, 0, 0)');
}
assert.equal(parsed.window.document.querySelector('th').rowSpan,2);
assert.equal(payload.text.split('\n')[1],'\tTambah\tKurang');
assert.equal(table.querySelector('td[style]').style.background,'yellow');
Object.defineProperty(w.navigator,'clipboard',{value:{write:async()=>{throw Error('Denied');}}});
w.ClipboardItem=class {};
w.console.error=()=>{};
(async()=>{
 const btn=w.document.getElementById('copy');
 await w.TableCopy.copy(btn,table);
 assert(btn.textContent.includes('gagal'));
 console.log('Copy tests passed: live decimals, zero, percent signs, merged cells, font 8 pt, no fill, rejected clipboard.');
 dom.window.close();parsed.window.close();
})().catch(error=>{console.error(error);process.exitCode=1;dom.window.close();});
