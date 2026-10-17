// CSV compatibile con Excel italiano (separatore ";" e BOM UTF-8).

export function toCSV(rows, sep = ';') {
  const cell = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map(r => r.map(cell).join(sep)).join('\r\n');
}

export function parseCSV(text) {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}

// Converte "17/10/2026", "17-10-26" o "2026-10-17" in ISO
export function parseDateIT(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = (Number(y) > (new Date().getFullYear() % 100) ? '19' : '20') + y;
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}
