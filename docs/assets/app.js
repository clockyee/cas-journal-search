import { DEFAULTS, makeIndex, validateDataset, readState, stateParams, findJournals, paginate, toCSV } from './search.js';

const $ = id => document.getElementById(id);
const format = value => value.toLocaleString('en-US');
let state = readState(new URLSearchParams(location.search));
let index = [], matches = [], pageInfo;
let ready = false, timer, toastTimer;

function syncInputs() {
  for (const key of ['division', 'top', 'oa', 'sort', 'size']) $(key).value = state[key];
  $('search').value = state.q;
  $('clear-search').hidden = !state.q;
}

function writeURL() {
  const url = new URL(location.href);
  url.search = stateParams(state);
  if (url.href !== location.href) history.replaceState(null, '', url);
}

function update() {
  if (!ready) return;
  matches = findJournals(index, state);
  pageInfo = paginate(matches, state.page, state.size);
  state.page = pageInfo.page;
  writeURL();
  render();
}

function render() {
  const fragment = document.createDocumentFragment();
  for (const journal of pageInfo.rows) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = journal.name;
    const division = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `division-badge division-${journal.division}`;
    badge.textContent = `Division ${journal.division}`;
    division.append(badge);
    const top = document.createElement('td');
    const topFlag = document.createElement('span');
    topFlag.className = journal.top ? 'yes-top' : 'no-flag';
    topFlag.textContent = journal.top ? 'Yes' : 'No';
    top.append(topFlag);
    const oa = document.createElement('td');
    const oaFlag = document.createElement('span');
    oaFlag.className = journal.oa ? 'yes-oa' : 'no-flag';
    oaFlag.textContent = journal.oa ? 'Yes' : 'No';
    oa.append(oaFlag);
    tr.append(name, division, top, oa);
    fragment.append(tr);
  }
  $('results').replaceChildren(fragment);
  $('result-count').textContent = format(matches.length);
  const filtered = Boolean(state.q || state.division || state.top || state.oa);
  $('result-summary').textContent = matches.length
    ? `Showing ${format(pageInfo.start)}–${format(pageInfo.end)} of ${format(matches.length)} ${filtered ? 'matches' : 'journals'}`
    : `0 matches in ${format(index.length)} journals`;
  $('table-status').textContent = filtered ? `Searching all ${format(index.length)} journals` : 'Complete 2025 reference collection';
  $('empty').hidden = matches.length > 0;
  $('pagination').hidden = matches.length === 0;
  $('page-label').textContent = `Page ${format(pageInfo.page)} of ${format(pageInfo.pages)}`;
  for (const id of ['first', 'previous']) $(id).disabled = pageInfo.page <= 1;
  for (const id of ['next', 'last']) $(id).disabled = pageInfo.page >= pageInfo.pages;
  $('export').disabled = matches.length === 0;
  $('clear-search').hidden = !state.q;
  $('reset').disabled = !filtered;
}

function reset() {
  clearTimeout(timer);
  state = { ...DEFAULTS };
  syncInputs();
  update();
  $('search').focus();
}

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}

function searchNow() {
  clearTimeout(timer);
  state.q = $('search').value;
  state.page = 1;
  update();
}

$('search-form').addEventListener('submit', event => { event.preventDefault(); searchNow(); });
$('search').addEventListener('input', event => {
  // State changes immediately, so export and share always reflect the visible input.
  state.q = event.target.value;
  state.page = 1;
  $('clear-search').hidden = !state.q;
  clearTimeout(timer);
  timer = setTimeout(update, 100);
});
$('clear-search').addEventListener('click', () => { $('search').value = ''; searchNow(); $('search').focus(); });
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => {
  state = { ...DEFAULTS, q: button.dataset.query };
  syncInputs(); update(); $('search').focus();
}));
for (const key of ['division', 'top', 'oa', 'sort', 'size']) $(key).addEventListener('change', event => {
  clearTimeout(timer);
  state[key] = key === 'size' ? Number(event.target.value) : event.target.value;
  state.page = 1; update();
});
for (const id of ['reset', 'empty-reset']) $(id).addEventListener('click', reset);
for (const [id, target] of Object.entries({ first: () => 1, previous: () => state.page - 1, next: () => state.page + 1, last: () => pageInfo.pages })) {
  $(id).addEventListener('click', () => {
    clearTimeout(timer);
    state.page = target(); update();
    // Keep the first visible result in view after paging through long lists.
    $('table-wrap').scrollIntoView({ block: 'start', behavior: 'instant' });
    $('table-wrap').focus({ preventScroll: true });
  });
}
$('share').addEventListener('click', async () => {
  clearTimeout(timer); update();
  try { await navigator.clipboard.writeText(location.href); notify('Search link copied.'); }
  catch { notify('Copy the link from your browser’s address bar to share this search.'); }
});
$('export').addEventListener('click', () => {
  clearTimeout(timer); update();
  if (!matches.length) return;
  const url = URL.createObjectURL(new Blob([toCSV(matches)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `cas-journals-2025-${matches.length}-results.csv`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify(`Exported ${format(matches.length)} journals.`);
});
window.addEventListener('popstate', () => { clearTimeout(timer); state = readState(new URLSearchParams(location.search)); syncInputs(); update(); });
document.addEventListener('keydown', event => {
  const active = document.activeElement;
  if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !active.isContentEditable && !['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) {
    event.preventDefault(); $('search').focus();
  }
  if (event.key === 'Escape' && active === $('search')) { $('search').value = ''; searchNow(); }
});

async function load() {
  $('load-error').hidden = true;
  $('retry').disabled = true;
  $('table-wrap').setAttribute('aria-busy', 'true');
  $('result-summary').textContent = 'Loading the journal collection…';
  try {
    const [dataResponse, metadataResponse] = await Promise.all([fetch('./data/journals.json'), fetch('./data/metadata.json')]);
    if (!dataResponse.ok || !metadataResponse.ok) throw new Error('Dataset request failed');
    const [rows, meta] = await Promise.all([dataResponse.json(), metadataResponse.json()]);
    validateDataset(rows);
    if (rows.length !== meta.total || meta.year !== 2025) throw new Error('Dataset metadata mismatch');
    index = makeIndex(rows);
    ready = true;
    $('collection-total').textContent = format(index.length);
    for (const id of ['filters', 'sort', 'size', 'share']) $(id).disabled = false;
    update();
  } catch (error) {
    ready = false;
    $('load-error').hidden = false;
    $('result-summary').textContent = 'Dataset unavailable. Please retry.';
    $('table-status').textContent = 'Dataset unavailable';
    $('results').replaceChildren();
    $('pagination').hidden = true;
    console.error('Unable to load journal dataset:', error);
  } finally {
    $('table-wrap').setAttribute('aria-busy', 'false');
    $('retry').disabled = false;
  }
}
$('retry').addEventListener('click', load);
syncInputs();
load();
