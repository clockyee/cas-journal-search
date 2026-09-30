import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DEFAULTS, normalize, makeIndex, validateDataset, findJournals, paginate, readState, stateParams, toCSV } from '../docs/assets/search.js';

const raw = readFileSync(new URL('../docs/data/journals.json', import.meta.url));
const rows = JSON.parse(raw);
const meta = JSON.parse(readFileSync(new URL('../docs/data/metadata.json', import.meta.url)));
const index = makeIndex(validateDataset(rows));
const search = changes => findJournals(index, { ...DEFAULTS, ...changes });

test('all 21,772 source records, division totals and boolean flags are preserved', () => {
  assert.equal(rows.length, 21772);
  assert.equal(meta.total, rows.length);
  assert.equal(createHash('sha256').update(raw).digest('hex'), meta.dataSHA256);
  const divisions = Object.fromEntries([1, 2, 3, 4].map(n => [n, rows.filter(row => row[1] === n).length]));
  assert.deepEqual(divisions, { 1: 1451, 2: 2844, 3: 4583, 4: 12894 });
  assert.equal(rows.filter(row => row[2]).length, 1789);
  assert.equal(rows.filter(row => row[3]).length, 5955);
  assert.equal(search({}).length, 21772);
});

test('partial names, all keywords, accents and punctuation are matched', () => {
  assert.equal(search({ q: 'NaTuRe' }).length, 76);
  assert.equal(search({ q: 'soft robot' }).length, 1);
  assert.equal(search({ q: ' robot   SOFT ' })[0].name, 'Soft Robotics');
  assert.equal(search({ q: 'soft-robot' })[0].name, 'Soft Robotics');
  assert.equal(normalize('Études & SCIENCE'), 'etudes science');
  assert.equal(search({ q: 'zygote' })[0].name, 'ZYGOTE');
  assert.equal(search({ q: 'zzzznoresult2025' }).length, 0);
  assert.equal(search({ q: '**' }).length, 0);
  assert.equal(search({ q: '   ' }).length, 21772);
});

test('all filters combine and no flags are treated distinctly from unset filters', () => {
  const found = search({ q: 'nature', division: '1', top: 'yes', oa: 'yes' });
  assert.deepEqual(found.map(row => row.name), ['Nature Communications']);
  assert.equal(search({ top: 'no' }).length, 19983);
  assert.equal(search({ oa: 'no' }).length, 15817);
  const zygote = search({ q: 'zygote', division: '4', top: 'no', oa: 'no' });
  assert.equal(zygote.length, 1);
  assert.equal(search({ q: 'zygote', division: '1' }).length, 0);
});

test('broad matches and the last page are never truncated', () => {
  const found = search({ q: 'science' });
  assert.equal(found.length, 1535);
  const allPages = [];
  for (let page = 1; page <= Math.ceil(found.length / 50); page++) allPages.push(...paginate(found, page, 50).rows);
  assert.deepEqual(allPages, found);
  assert.equal(paginate(found, 99, 50).rows.length, 35);
  assert.equal(paginate(found, 99, 50).page, 31);
  assert.equal(paginate(search({}), 9999, 50).end, 21772);
  assert.deepEqual(paginate([], 999, 50), { rows: [], page: 1, pages: 1, start: 0, end: 0 });
});

test('division sorting and reverse alphabetical sorting retain every match', () => {
  const found = search({ sort: 'division' });
  assert.equal(found.length, 21772);
  assert.ok(found.every((row, i) => i === 0 || row.division >= found[i - 1].division));
  assert.deepEqual(search({ q: 'nature', sort: 'name-desc' }), search({ q: 'nature' }).reverse());
});

test('shared URL state roundtrips and invalid input is sanitized', () => {
  const state = { ...DEFAULTS, q: 'nature & science', division: '2', top: 'no', oa: 'yes', sort: 'division', page: 3, size: 100 };
  assert.deepEqual(readState(new URLSearchParams(stateParams(state))), state);
  assert.equal(stateParams(DEFAULTS), '');
  assert.deepEqual(readState(new URLSearchParams('division=9&top=false&oa=1&sort=oops&page=-1&size=0')), DEFAULTS);
  assert.equal(readState(new URLSearchParams('page=Infinity')).page, 1);
});

test('CSV contains English headers and every filtered result, with safe escaping', () => {
  const found = search({ q: 'science' });
  const csv = toCSV(found);
  assert.ok(csv.startsWith('\uFEFF"Journal","CAS Division","Top Journal","Open Access"\r\n'));
  assert.equal(csv.trimEnd().split('\r\n').length, found.length + 1);
  assert.ok(toCSV([{ name: '=DANGER("x")', division: 1, top: true, oa: false }]).includes('"\'=DANGER(""x"")","1","Yes","No"'));
});

test('malformed and duplicate data are rejected rather than silently displayed', () => {
  assert.throws(() => validateDataset([]));
  assert.throws(() => validateDataset([['Journal', 5, true, false]]));
  assert.throws(() => validateDataset([['Journal', 1, 'Yes', false]]));
  assert.throws(() => validateDataset([['Journal', 1, true, false], ['Journal', 2, true, false]]));
});
