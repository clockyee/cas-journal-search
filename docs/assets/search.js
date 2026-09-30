// The complete dataset is searched locally. No API, tracking, or result cap.
export const DEFAULTS = Object.freeze({ q: '', division: '', top: '', oa: '', sort: 'name', page: 1, size: 50 });
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function normalize(text) {
  return String(text).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export function makeIndex(rows) {
  return rows.map(([name, division, top, oa]) => ({ name, division, top, oa, search: normalize(name) }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function validateDataset(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Empty or invalid dataset');
  const names = new Set();
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 4 || typeof row[0] !== 'string' || !row[0].trim()
      || ![1, 2, 3, 4].includes(row[1]) || typeof row[2] !== 'boolean' || typeof row[3] !== 'boolean'
      || names.has(row[0])) throw new Error('Invalid journal record');
    names.add(row[0]);
  }
  return rows;
}

export function readState(params) {
  const allowed = (key, options, fallback = '') => options.includes(params.get(key)) ? params.get(key) : fallback;
  const page = Number(params.get('page'));
  return {
    q: (params.get('q') || '').slice(0, 200),
    division: allowed('division', ['1', '2', '3', '4']),
    top: allowed('top', ['yes', 'no']), oa: allowed('oa', ['yes', 'no']),
    sort: allowed('sort', ['name', 'name-desc', 'division'], 'name'),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    size: Number(allowed('size', ['25', '50', '100'], '50')),
  };
}

export function stateParams(state) {
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULTS)) {
    if (state[key] !== DEFAULTS[key]) params.set(key, String(state[key]));
  }
  return params.toString();
}

export function findJournals(index, state) {
  const terms = normalize(state.q).split(' ').filter(Boolean);
  // Punctuation-only input should not accidentally return every journal.
  if (state.q.trim() && !terms.length) return [];
  const rows = index.filter(row => (!state.division || row.division === Number(state.division))
    && (!state.top || row.top === (state.top === 'yes'))
    && (!state.oa || row.oa === (state.oa === 'yes'))
    && terms.every(term => row.search.includes(term)));
  if (state.sort === 'division') rows.sort((a, b) => a.division - b.division || collator.compare(a.name, b.name));
  if (state.sort === 'name-desc') rows.reverse();
  return rows;
}

export function paginate(rows, requestedPage, size) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(Math.max(1, requestedPage), pages);
  const offset = (page - 1) * size;
  return { rows: rows.slice(offset, offset + size), page, pages, start: rows.length ? offset + 1 : 0, end: Math.min(offset + size, rows.length) };
}

export function toCSV(rows) {
  const escape = value => {
    let text = String(value);
    // Keep exported journal titles from becoming formulas in spreadsheet apps.
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [
    ['Journal', 'CAS Division', 'Top Journal', 'Open Access'],
    ...rows.map(row => [row.name, row.division, row.top ? 'Yes' : 'No', row.oa ? 'Yes' : 'No']),
  ].map(row => row.map(escape).join(',')).join('\r\n') + '\r\n';
}
