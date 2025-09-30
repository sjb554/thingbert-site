import csv
import json
import os
import sys
import urllib.request
from datetime import datetime, UTC

INDICATOR_URL = "https://pfs.data.cms.gov/sites/default/files/data/indicators2024B-09-18-2024.csv"
LOCALITY_URL = "https://pfs.data.cms.gov/sites/default/files/data/localities2024B.csv"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "pfs")

INDICATOR_COLUMNS = [
    ("hcpc", "hcpc"),
    ("modifier", "modifier"),
    ("short_desc", "sdesc"),
    ("status", "proc_stat"),
    ("pctc", "pctc"),
    ("global", "global"),
    ("rvu_work", "rvu_work"),
    ("trans_nfac_pe", "trans_nfac_pe"),
    ("trans_fac_pe", "trans_fac_pe"),
    ("rvu_mp", "rvu_mp"),
    ("work_adjustor", "work_adjustor"),
    ("conv_fact", "conv_fact"),
    ("opps_nfac_pe", "opps_nfac_pe"),
    ("opps_fac_pe", "opps_fac_pe"),
    ("opps_mp", "opps_mp"),
    ("nfac_total", "nfac_total"),
    ("fac_total", "fac_total"),
    ("trans_nfac_total", "trans_nfac_total"),
    ("trans_fac_total", "trans_fac_total"),
    ("full_nfac_total", "full_nfac_total"),
    ("full_fac_total", "full_fac_total"),
    ("nfac_pe", "nfac_pe"),
    ("fac_pe", "fac_pe"),
    ("nfac_pe_naflag", "nfac_pe_naflag"),
    ("fac_pe_naflag", "fac_pe_naflag"),
    ("trans_nfac_pe_naflag", "trans_nfac_pe_naflag"),
    ("trans_fac_pe_naflag", "trans_fac_pe_naflag"),
    ("mult_surg", "mult_surg"),
    ("bilt_surg", "bilt_surg"),
    ("asst_surg", "asst_surg"),
    ("co_surg", "co_surg"),
    ("team_surg", "team_surg"),
    ("phy_superv", "phy_superv"),
    ("family_ind", "family_ind"),
    ("pre_op", "pre_op"),
    ("intra_op", "intra_op"),
    ("post_op", "post_op"),
    ("nused_for_med", "nused_for_med"),
    ("endobase", "endobase")
]

NUMERIC_COLUMNS = {
    "rvu_work",
    "trans_nfac_pe",
    "trans_fac_pe",
    "rvu_mp",
    "work_adjustor",
    "conv_fact",
    "opps_nfac_pe",
    "opps_fac_pe",
    "opps_mp",
    "nfac_total",
    "fac_total",
    "trans_nfac_total",
    "trans_fac_total",
    "full_nfac_total",
    "full_fac_total",
    "nfac_pe",
    "fac_pe"
}

LOCALITY_COLUMNS = [
    ("code", "locality"),
    ("description", "loc_description"),
    ("mac", "mac"),
    ("mac_description", "mac_description"),
    ("gpci_work", "gpci_work"),
    ("gpci_pe", "gpci_pe"),
    ("gpci_mp", "gpci_mp")
]

LOCALITY_NUMERIC_COLUMNS = {"gpci_work", "gpci_pe", "gpci_mp"}

KEEP_EMPTY = {"modifier"}
USER_AGENT = "ThingbertMedicareTool/1.0"


def fetch_csv(url: str) -> list[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req) as resp:
        text = resp.read().decode("utf-8")
    reader = csv.DictReader(text.splitlines())
    return list(reader)


def to_number(value: str) -> float | None:
    value = value.strip()
    if value == "" or value.upper() in {"NA", "N/A"}:
        return None
    try:
        number = float(value)
        return round(number, 4)
    except ValueError:
        return None


def build_indicators(rows: list[dict]) -> dict:
    column_names = [c[0] for c in INDICATOR_COLUMNS]
    data_rows: list[list[object]] = []
    for row in rows:
        hcpc = row.get("hcpc", "").strip().upper()
        if not hcpc:
            continue
        parsed: list[object] = []
        for key, source in INDICATOR_COLUMNS:
            raw = row.get(source, "")
            if key == "hcpc":
                parsed.append(hcpc)
            elif key == "modifier":
                parsed.append(raw.strip())
            elif key in NUMERIC_COLUMNS:
                parsed.append(to_number(raw))
            else:
                parsed.append(raw.strip())
        if parsed[1] is None or parsed[1] == "None":
            parsed[1] = ""
        data_rows.append(parsed)
    return {"columns": column_names, "rows": data_rows}


def build_localities(rows: list[dict]) -> dict:
    column_names = [c[0] for c in LOCALITY_COLUMNS]
    data_rows: list[list[object]] = []
    for row in rows:
        code = row.get("locality", "").strip()
        if not code:
            continue
        parsed: list[object] = []
        for key, source in LOCALITY_COLUMNS:
            raw = row.get(source, "")
            if key == "code":
                parsed.append(code)
            elif key in LOCALITY_NUMERIC_COLUMNS:
                parsed.append(to_number(raw))
            else:
                parsed.append(raw.strip())
        data_rows.append(parsed)
    return {"columns": column_names, "rows": data_rows}


def main() -> int:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    indicators_csv = fetch_csv(INDICATOR_URL)
    localities_csv = fetch_csv(LOCALITY_URL)

    indicators = build_indicators(indicators_csv)
    localities = build_localities(localities_csv)

    manifest = {
        "year": "2024B",
        "sources": {
            "indicators": INDICATOR_URL,
            "localities": LOCALITY_URL
        },
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "indicator_count": len(indicators["rows"]),
        "locality_count": len(localities["rows"])
    }

    with open(os.path.join(OUTPUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "indicators-2024B.json"), "w", encoding="utf-8") as f:
        json.dump(indicators, f, separators=(",", ":"))

    with open(os.path.join(OUTPUT_DIR, "localities-2024B.json"), "w", encoding="utf-8") as f:
        json.dump(localities, f, separators=(",", ":"))

    print(
        "Wrote {} indicators and {} localities to {}.".format(
            len(indicators["rows"]),
            len(localities["rows"]),
            OUTPUT_DIR,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
