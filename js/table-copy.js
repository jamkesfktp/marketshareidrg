(function () {
  'use strict';
  const style = 'font-family:"Century Gothic",sans-serif;font-size:8pt;background-color:transparent;color:#000;';
  function prepare(table) {
    const clone = table.cloneNode(true);
    const originals = table.querySelectorAll('input,select,textarea');
    clone.querySelectorAll('input,select,textarea').forEach((node, index) => {
      const original = originals[index];
      const value = original.tagName === 'SELECT' ? original.selectedOptions[0]?.textContent || '' : original.value;
      node.replaceWith(document.createTextNode(value));
    });
    clone.querySelectorAll('button,script,style').forEach(node => node.remove());
    clone.querySelectorAll('label').forEach(label => {
      if (label.firstElementChild) label.firstElementChild.append(' ');
    });
    [clone, ...clone.querySelectorAll('*')].forEach(node => {
      const isCell = /^(TD|TH)$/.test(node.tagName);
      for (const attr of Array.from(node.attributes)) {
        if (!['rowspan', 'colspan'].includes(attr.name)) node.removeAttribute(attr.name);
      }
      node.setAttribute('style', style + (isCell ? 'border:1px solid #999;padding:3pt;vertical-align:middle;' : ''));
    });
    clone.setAttribute('style', style + 'border-collapse:collapse;');
    return clone;
  }
  function cellText(cell) {
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
    clone.querySelectorAll('div,label,p').forEach(n => n.append('\n'));
    return clone.textContent.split('\n').map(s => s.replace(/[\t\r ]+/g, ' ').trim()).filter(Boolean).join('\n');
  }
  function serialize(table) {
    const clone = prepare(table);
    const grid = [];
    Array.from(clone.rows).forEach((row, r) => {
      grid[r] ||= [];
      let c = 0;
      Array.from(row.cells).forEach(cell => {
        while (grid[r][c] !== undefined) c++;
        for (let dr = 0; dr < cell.rowSpan; dr++) {
          grid[r + dr] ||= [];
          for (let dc = 0; dc < cell.colSpan; dc++) grid[r + dr][c + dc] = dr === 0 && dc === 0 ? cellText(cell) : '';
        }
        c += cell.colSpan;
      });
    });
    const text = grid.map(row => row.map(value => /[\t\n"]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value).join('\t')).join('\n');
    return { html: clone.outerHTML, text };
  }
  async function write(payload) {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([payload.html], { type: 'text/html' }),
        'text/plain': new Blob([payload.text], { type: 'text/plain' })
      })]);
      return;
    }
    // Legacy copy event retains rich formatting; never report formatted success for plain text only.
    let supplied = false;
    const listener = event => {
      if (!event.clipboardData) return;
      event.clipboardData.setData('text/html', payload.html);
      event.clipboardData.setData('text/plain', payload.text);
      event.preventDefault(); supplied = true;
    };
    document.addEventListener('copy', listener);
    try {
      if (!document.execCommand('copy') || !supplied) throw new Error('Clipboard tidak tersedia');
    } finally { document.removeEventListener('copy', listener); }
  }
  async function copy(button, table) {
    const old = button.innerHTML;
    try {
      if (!table) throw new Error('Tabel tidak ditemukan');
      await write(serialize(table));
      button.textContent = '✓ Tersalin · Century Gothic 8 pt';
    } catch (error) {
      button.textContent = 'Salin gagal — coba lagi';
      console.error('Gagal menyalin tabel:', error);
    }
    setTimeout(() => { button.innerHTML = old; }, 2500);
  }
  function selectionPayload(selection) {
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer;
    const element = ancestor.nodeType === 1 ? ancestor : ancestor.parentElement;
    let table = element?.closest('table');
    // Also support SelectNode/SelectNodeContents on a table wrapper.
    if (!table && element) {
      const tables = Array.from(element.querySelectorAll('table')).filter(t => range.intersectsNode(t));
      if (tables.length !== 1) return null;
      table = tables[0];
      const fragment = range.cloneContents();
      fragment.querySelectorAll('table').forEach(t => t.remove());
      if (fragment.textContent.trim()) return null;
    }
    if (!table || !table.closest('.slide')) return null;
    const cells = Array.from(table.querySelectorAll('th,td'));
    const selected = cells.map(cell => range.intersectsNode(cell));
    // Preserve normal copying of an individual text fragment or an input value.
    if (selected.filter(Boolean).length < 2) return null;
    const clone = prepare(table);
    clone.querySelectorAll('th,td').forEach((cell, index) => {
      if (!selected[index]) cell.remove();
    });
    Array.from(clone.rows).forEach(row => { if (!row.cells.length) row.remove(); });
    Array.from(clone.rows).forEach((row, index) => {
      Array.from(row.cells).forEach(cell => { cell.rowSpan = Math.min(cell.rowSpan, clone.rows.length - index); });
    });
    return serialize(clone);
  }
  document.addEventListener('copy', event => {
    if (event.defaultPrevented || !event.clipboardData) return;
    const active = document.activeElement;
    if (active && (active.matches('input,textarea') || active.isContentEditable)) return;
    const payload = selectionPayload(window.getSelection());
    if (!payload) return;
    event.clipboardData.setData('text/html', payload.html);
    event.clipboardData.setData('text/plain', payload.text);
    event.preventDefault();
  });
  window.TableCopy = { prepare, serialize, write, copy, selectionPayload };
})();

