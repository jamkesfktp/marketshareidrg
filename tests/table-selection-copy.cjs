const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const dom = new JSDOM('<section class="slide"><table><tr><th colspan="2" bgcolor="red">Persentase</th></tr><tr><td><label><span>U</span><span><input value="5">%</span></label></td><td><label><span>P</span><span><input value="0">%</span></label></td></tr><tr><td>Jangan salin</td><td>99%</td></tr></table></section>', {runScripts:'outside-only'});
const w = dom.window, doc = w.document;
w.eval(fs.readFileSync('js/table-copy.js','utf8'));
doc.querySelector('input').value='27.25';
const selection=w.getSelection();
function select(range) { selection.removeAllRanges(); selection.addRange(range); }
function copy() {
 const event=new w.Event('copy',{bubbles:true,cancelable:true});
 const formats={};Object.defineProperty(event,'clipboardData',{value:{setData:(k,v)=>formats[k]=v}});
 doc.dispatchEvent(event);return {event,formats};
}
const full=doc.createRange();full.selectNodeContents(doc.querySelector('table'));select(full);
let result=copy();
assert(result.event.defaultPrevented);
assert(result.formats['text/plain'].includes('U 27.25%'));
assert(result.formats['text/plain'].includes('P 0%'));
assert(!result.formats['text/html'].includes('bgcolor'));
assert(!result.formats['text/html'].includes('<input'));
const parsed=new JSDOM(result.formats['text/html']);
for(const node of parsed.window.document.querySelectorAll('table,table *')) {
 assert(node.style.fontFamily.includes('Century Gothic'));
 assert.equal(node.style.fontSize,'8pt');
 assert.equal(node.style.backgroundColor,'transparent');
}
const partial=doc.createRange();partial.selectNodeContents(doc.querySelectorAll('tr')[1]);select(partial);
result=copy();assert(result.event.defaultPrevented);assert(!result.formats['text/plain'].includes('Jangan salin'));
const single=doc.createRange();single.selectNodeContents(doc.querySelector('th'));select(single);
assert.equal(copy().event.defaultPrevented,false);
select(full);doc.querySelector('input').focus();assert.equal(copy().event.defaultPrevented,false);
parsed.window.close();dom.window.close();
console.log('Native selection copy passed: full and partial table, live decimal, zero, styles, normal text/input preserved.');
