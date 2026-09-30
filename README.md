# Journal Atlas · 2025 CAS Journal Search

A static, English-language journal directory based on the supplied **2025 CAS journal classification reference spreadsheet**. It includes all **21,772 unique journal names**.

**Website:** https://clockyee.github.io/cas-journal-search/

## Features

- Case-insensitive partial-name search; multiple keywords match together.
- Filters for CAS Division (1–4), Top Journal and Open Access.
- Sorting, complete pagination, shareable search URLs and CSV export of all matching rows.
- Responsive, keyboard-accessible interface. Press `/` to focus search.
- Searches run in the browser with no backend, API keys, account or result limit.

All table and export headers are English: **Journal**, **CAS Division**, **Top Journal**, **Open Access**.

## Dataset

Source: `附件7：2025中科院期刊分区表(参考).xlsx`, sheet `2025中科院期刊分区表excel完整版`.

| CAS Division | Journals |
| --- | ---: |
| 1 | 1,451 |
| 2 | 2,844 |
| 3 | 4,583 |
| 4 | 12,894 |
| **Total** | **21,772** |

Top journals: **1,789**. Open Access journals: **5,955**.

The empty first row and five empty leading columns were removed in preparing the source CSV. Journal names and classification values are preserved. Yes/No flags are stored as booleans. Each row in `docs/data/journals.json` has the format `[name, division, top, openAccess]`. Provenance and SHA-256 hashes are in `docs/data/metadata.json`.

This is an independent **reference tool**, not an official CAS service or a current, live ranking. **CAS divisions are not JCR quartiles**. The source contains no subject categories, ISSNs or impact factors. A “No” Open Access flag reflects the source and does not establish an individual article’s availability. Dataset ownership and any applicable reuse terms remain with the original source; this repository does not claim ownership of the classification data.

## Run locally

Requires Python 3 for serving and Node.js 20+ for tests; no package installation is needed.

```sh
npm test
npm start
```

Open http://127.0.0.1:8765. Serve the `docs/` folder over HTTP; opening `index.html` directly with `file://` cannot load the JSON dataset.

## Rebuild the data

```sh
python3 scripts/prepare_data.py /path/to/cleaned.csv /path/to/source.xlsx
npm test
```

The cleaned CSV has the original prepared headers `期刊名称,中科院分区,Top期刊,开放获取OA`. The script checks the dataset counts before writing output. For another year, update the expected counts, year, page copy and tests together; do not silently replace the 2025 data.

## GitHub Pages

Publish from the `main` branch, `/docs` directory. The site uses relative URLs so it works under the repository path. `.nojekyll` enables direct static serving. No build pipeline is required.

## Checks

The Node test suite verifies counts and dataset integrity, partial/multiword matching, combined filters, sorting, complete pagination (including 1,535 `science` matches), URL state handling and CSV export. Browser checks additionally cover the rendered page and controls.
