"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCsv = parseCsv;
exports.normalizeHeader = normalizeHeader;
function parseCsv(text) {
    const rows = [];
    let row = [];
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
            if (ch === '\r' && next === '\n')
                i++;
            row.push(cur);
            cur = '';
            const hasAny = row.some((c) => (c ?? '').trim() !== '');
            if (hasAny)
                rows.push(row);
            row = [];
            continue;
        }
        cur += ch;
    }
    row.push(cur);
    const hasAny = row.some((c) => (c ?? '').trim() !== '');
    if (hasAny)
        rows.push(row);
    return rows;
}
function normalizeHeader(h) {
    return (h || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .replace(/[^\w ]/g, '');
}
//# sourceMappingURL=csv.js.map