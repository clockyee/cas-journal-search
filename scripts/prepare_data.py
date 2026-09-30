"""Convert the supplied, cleaned reference CSV into the static site's dataset.

Usage: python3 scripts/prepare_data.py /path/to/cleaned.csv /path/to/source.xlsx
The source files stay outside the repository; their hashes document provenance.
"""
import csv
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

csv_path, source_path = map(Path, sys.argv[1:3])
output = Path(__file__).resolve().parents[1] / "docs" / "data"
expected_headers = ["期刊名称", "中科院分区", "Top期刊", "开放获取OA"]
with csv_path.open(encoding="utf-8-sig", newline="") as handle:
    reader = csv.DictReader(handle)
    assert reader.fieldnames == expected_headers, reader.fieldnames
    rows = []
    for row in reader:
        assert set(row) == set(expected_headers), row
        name = row["期刊名称"]
        division = int(row["中科院分区"])
        assert name and division in (1, 2, 3, 4), row
        assert row["Top期刊"] in ("是", "否"), row
        assert row["开放获取OA"] in ("是", "否"), row
        rows.append([name, division, row["Top期刊"] == "是", row["开放获取OA"] == "是"])
assert len(rows) == len({row[0] for row in rows}) == 21772
divisions = Counter(row[1] for row in rows)
assert divisions == {1: 1451, 2: 2844, 3: 4583, 4: 12894}
assert sum(row[2] for row in rows) == 1789
assert sum(row[3] for row in rows) == 5955
payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n"
metadata = {
    "year": 2025,
    "sourceFile": source_path.name,
    "sourceSHA256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
    "cleanedCsvSHA256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
    "dataSHA256": hashlib.sha256(payload.encode()).hexdigest(),
    "columns": ["Journal", "CAS Division", "Top Journal", "Open Access"],
    "rowFormat": ["string", "integer 1–4", "boolean", "boolean"],
    "total": len(rows),
    "divisions": dict(sorted(divisions.items())),
    "top": sum(row[2] for row in rows),
    "openAccess": sum(row[3] for row in rows),
    "note": "User-supplied 2025 reference spreadsheet. This is not an official or live CAS service. Names and classifications are preserved; Chinese yes/no values are encoded as booleans. CAS divisions are not JCR quartiles. No subject category, ISSN or impact factor was supplied."
}
output.mkdir(exist_ok=True, parents=True)
(output / "journals.json").write_text(payload, encoding="utf-8")
(output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"records": len(rows), "divisions": dict(divisions), "bytes": len(payload.encode())}))
