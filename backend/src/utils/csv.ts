// src/utils/csv.ts
export function parseCsv(text: string): string[][] {
  // Parser simples e robusto para CSV com aspas
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (ch === ',')) {
      row.push(cur);
      cur = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cur);
      cur = '';

      // evita linha vazia do final
      const hasAny = row.some((c) => (c ?? '').trim() !== '');
      if (hasAny) rows.push(row);

      row = [];
      continue;
    }

    cur += ch;
  }

  // último token
  row.push(cur);
  const hasAny = row.some((c) => (c ?? '').trim() !== '');
  if (hasAny) rows.push(row);

  return rows;
}

export function normalizeHeader(h: string) {
  return (h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w ]/g, '');
}
